// Végétation : arbres de haute tige des lots et de la voie, alignement de cyprès, pinède à l'ouest, arbres du
// voisinage. Chaque essence est un seul maillage instancié (quelques appels de dessin pour des centaines d'arbres).
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITE } from './data.js';
import { rnd, rng, pick, clamp } from './util.js';

// Houppier : quelques boules bosselées autour d'une boule centrale, plus claires en tête.
function crown(count, spread, yScale, detail) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.IcosahedronGeometry(i ? rng(0.45, 0.7) : 0.82, i ? 1 : detail);
    const p = g.attributes.position, phase = rnd() * 6.28;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const n = 1 + 0.13 * Math.sin(x * 6.1 + y * 3.3 + phase) * Math.cos(z * 5.3 - y * 2.1 + phase) + 0.07 * Math.sin(y * 9 + x * 4 + phase);
      p.setXYZ(k, x * n, y * n * yScale, z * n);
    }
    if (i) {
      const a = rnd() * Math.PI * 2;
      g.translate(Math.cos(a) * spread, rng(-0.15, 0.35) * yScale, Math.sin(a) * spread);
    }
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    parts.push(mergeVertices(g, 1e-4));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return shade(g, -0.8 * yScale, 0.8 * yScale);
}

// Cyprès de Provence : fuseau étroit, pointe effilée.
function cypress() {
  const profile = [[0.0, 0.0], [0.34, 0.03], [0.52, 0.12], [0.6, 0.28], [0.56, 0.5], [0.44, 0.7], [0.27, 0.86], [0.1, 0.96], [0.0, 1.0]];
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 9);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const n = 1 + 0.1 * Math.sin(y * 31 + x * 9) * Math.cos(z * 11 + y * 17);
    p.setXYZ(k, x * n, y, z * n);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return shade(g, 0, 1);
}

// Dégradé clair-obscur vertical stocké par sommet, multiplié ensuite par la teinte de chaque arbre.
function shade(g, y0, y1) {
  const p = g.attributes.position, col = [];
  for (let k = 0; k < p.count; k++) {
    const v = 0.5 + 0.66 * clamp((p.getY(k) - y0) / (y1 - y0), 0, 1) + 0.07 * Math.sin(p.getX(k) * 13 + p.getZ(k) * 7);
    col.push(v, v, v * 0.97);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function createTrees(scene, { inGroundImage }) {
  const geo = {
    leafA: crown(6, 0.55, 0.9, 2),
    leafB: crown(7, 0.62, 0.78, 2),
    leafC: crown(5, 0.48, 1.05, 2),
    olive: crown(5, 0.6, 0.7, 2),
    pine: crown(5, 0.62, 0.55, 1),
    far: crown(4, 0.5, 0.9, 1),
    cypress: cypress(),
    trunk: new THREE.CylinderGeometry(0.5, 0.7, 1, 6).translate(0, 0.5, 0),
  };
  const lists = Object.fromEntries(Object.keys(geo).map((k) => [k, []]));
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const put = (kind, x, y, z, sx, sy, sz, color) => {
    e.set(0, rnd() * Math.PI * 2, 0);
    q.setFromEuler(e);
    lists[kind].push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.clone(), new THREE.Vector3(sx, sy, sz)), c: color });
  };
  const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l);

  // Feuillus (micocoulier, frêne, tilleul) : verts francs. Oliviers : plus bas, feuillage gris-vert.
  const LEAF = [[0.27, 0.44, 0.29], [0.29, 0.48, 0.27], [0.25, 0.4, 0.31], [0.23, 0.36, 0.32], [0.31, 0.42, 0.26]];
  const broadleaf = (x, z, size, kind) => {
    const r = size * 1.05, trunk = 1.4 + r * 0.55, [h, s, l] = pick(LEAF);
    put('trunk', x, 0, z, r * 0.16, trunk + r * 0.3, r * 0.16);
    put(kind || pick(['leafA', 'leafB', 'leafC']), x, trunk + r * 0.62, z, r * 1.12, r * rng(1, 1.2), r * 1.12, hsl(h + rng(-0.01, 0.01), s, l + rng(-0.02, 0.03)));
  };
  const olive = (x, z, size) => {
    const r = size * 0.95, trunk = 0.9 + r * 0.35;
    put('trunk', x, 0, z, r * 0.2, trunk + r * 0.3, r * 0.2);
    put('olive', x, trunk + r * 0.55, z, r * 1.2, r * rng(0.95, 1.1), r * 1.2, hsl(rng(0.22, 0.25), rng(0.2, 0.26), rng(0.4, 0.45)));
  };
  const pine = (x, z, size, height) => {
    put('trunk', x, 0, z, 0.42, height * 0.6, 0.42);
    put('pine', x, height * 0.68, z, size * 1.5, size * 1.25, size * 1.5, hsl(rng(0.27, 0.31), rng(0.32, 0.44), rng(0.2, 0.26)));
  };

  for (const [x, z, size, kind] of SITE.trees) {
    if (kind === 2) {
      const h = rng(8, 10);
      put('trunk', x, 0, z, 0.2, 0.9, 0.2);
      put('cypress', x, 0.35, z, size * 1.75, h, size * 1.75, hsl(rng(0.33, 0.36), 0.4, rng(0.17, 0.2)));
    } else if (rnd() < 0.24) olive(x, z, size);
    else broadleaf(x, z, size);
  }
  for (const [x, z, size, height] of SITE.pines) pine(x, z, size, height);
  for (const [x, z, size] of SITE.ctx) broadleaf(x, z, size);

  // Paysage lointain : bosquets et arbres isolés, hors de l'emprise de l'image de sol.
  for (let n = 0; n < 46; n++) {
    const a = rnd() * Math.PI * 2, d = 135 + Math.pow(rnd(), 0.8) * 620;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, count = 5 + ((rnd() * 15) | 0), spread = rng(14, 38), pines = rnd() < 0.5;
    for (let i = 0; i < count; i++) {
      const x = cx + (rnd() + rnd() - 1) * spread, z = cz + (rnd() + rnd() - 1) * spread;
      if (inGroundImage(x, z)) continue;
      if (pines) pine(x, z, rng(2.6, 4.2), rng(8, 13));
      else broadleaf(x, z, rng(2.2, 4.4), 'far');
    }
  }
  for (let n = 0; n < 150; n++) {
    const a = rnd() * Math.PI * 2, d = 125 + Math.pow(rnd(), 0.8) * 640;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!inGroundImage(x, z)) broadleaf(x, z, rng(2, 4), 'far');
  }

  const foliage = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ color: '#6b5544', roughness: 1 });
  for (const [kind, items] of Object.entries(lists)) {
    if (!items.length) continue;
    const mesh = new THREE.InstancedMesh(geo[kind], kind === 'trunk' ? bark : foliage, items.length);
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      if (it.c) mesh.setColorAt(i, it.c);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
}
