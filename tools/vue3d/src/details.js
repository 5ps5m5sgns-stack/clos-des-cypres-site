// Ce qui habille le plan : murets, haies, pergolas, piscines, voitures, boîtes aux lettres, maisons voisines, canal.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SITE } from './data.js';
import { rnd, rng, box, beam, merge, shadows, canvasTexture, footprint, shapeOf, flatGeo } from './util.js';

const M = (o) => new THREE.MeshStandardMaterial(o);

// Coins d'un rectangle orienté (emprise « f »), agrandi de « grow » mètres de chaque côté.
function rectPts(f, grow = 0) {
  const cos = Math.cos(f.rot), sin = Math.sin(f.rot);
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([sx, sz]) => {
    const x = sx * (f.a + grow), z = sz * (f.b + grow);
    return [f.cx + x * cos + z * sin, f.cz - x * sin + z * cos];
  });
}

export function createDetails(scene, { envMap, anisotropy }) {
  const stucco = canvasTexture(128, (c, s) => {
    c.fillStyle = '#f4f4f4';
    c.fillRect(0, 0, s, s);
    for (let n = 0; n < 2600; n++) {
      const v = (230 + rnd() * 25) | 0;
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
  }, { repeat: true, anisotropy });
  const leaves = canvasTexture(128, (c, s) => {
    c.fillStyle = '#b9b9b9';
    c.fillRect(0, 0, s, s);
    for (let n = 0; n < 2200; n++) {
      const v = (120 + rnd() * 135) | 0;
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.beginPath();
      c.arc(rnd() * s, rnd() * s, 1 + rnd() * 2.4, 0, 6.3);
      c.fill();
    }
  }, { repeat: true, anisotropy });
  leaves.repeat.set(3, 1.5);

  // Pergolas en bois sur quatre terrasses.
  const pergolas = [];
  for (const t of SITE.terraces.filter((t) => [1, 3, 5, 8].includes(t.lot))) {
    const f = footprint(t.pts), l = Math.min(f.a * 0.55, 2.7), w = f.b - 0.2, parts = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(box(0.13, 2.45, 0.13, sx * l, 1.225, sz * w));
    for (const sz of [1, -1]) parts.push(box(2 * l + 0.4, 0.16, 0.1, 0, 2.5, sz * w));
    for (let x = -l; x <= l + 0.01; x += 0.42) parts.push(box(0.06, 0.11, 2 * w + 0.45, x, 2.62, 0));
    const g = merge(parts);
    g.rotateY(f.rot);
    g.translate(f.cx, 0, f.cz);
    pergolas.push(g);
  }
  if (pergolas.length) scene.add(shadows(new THREE.Mesh(merge(pergolas), M({ color: '#8b6a4c', roughness: 0.9 }))));

  // Murets de clôture et leur couvertine.
  const walls = [], caps = [];
  for (const [x1, z1, x2, z2] of SITE.walls) {
    walls.push(beam(new THREE.Vector3(x1, 0.36, z1), new THREE.Vector3(x2, 0.36, z2), 0.2, 0.72));
    caps.push(beam(new THREE.Vector3(x1, 0.75, z1), new THREE.Vector3(x2, 0.75, z2), 0.28, 0.06));
  }
  scene.add(shadows(new THREE.Mesh(merge(walls), M({ color: '#ece2cd', map: stucco, roughness: 0.95 }))));
  scene.add(shadows(new THREE.Mesh(merge(caps), M({ color: '#dad3c4', roughness: 0.95 }))));

  // Haies vives : tronçons arrondis, plus clairs en tête.
  const hedges = [];
  for (const [x1, z1, x2, z2] of SITE.hedges) {
    const len = Math.hypot(x2 - x1, z2 - z1), h = rng(1.5, 1.8);
    const g = new RoundedBoxGeometry(len + 0.5, h, rng(0.8, 0.95), 2, 0.26);
    const tone = rng(0.86, 1.08), pos = g.attributes.position, col = [];
    for (let i = 0; i < pos.count; i++) {
      const v = tone * (0.68 + 0.44 * (pos.getY(i) / h + 0.5));
      col.push(v, v, v);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.rotateY(-Math.atan2(z2 - z1, x2 - x1));
    g.translate((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
    hedges.push(g);
  }
  scene.add(shadows(new THREE.Mesh(merge(hedges, true), M({ color: '#5a8442', map: leaves, vertexColors: true, roughness: 1 }))));

  // Voitures stationnées.
  const paints = ['#f1f1ee', '#c9ccd0', '#3a4654', '#24282d', '#7c2f2a', '#8f9aa3'];
  const carGlass = M({ color: '#1f2b35', roughness: 0.08, metalness: 0.55, envMap, envMapIntensity: 0.6 });
  const tyre = M({ color: '#1c1c1e', roughness: 0.9 });
  const bodyGeo = new RoundedBoxGeometry(4.25, 0.62, 1.78, 2, 0.2).translate(0, 0.58, 0);
  const cabinGeo = new RoundedBoxGeometry(2.3, 0.58, 1.56, 2, 0.22).translate(-0.25, 1.12, 0);
  const wheelGeo = merge([[1.38, 0.84], [1.38, -0.84], [-1.38, 0.84], [-1.38, -0.84]].map(([x, z]) =>
    new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14).rotateX(Math.PI / 2).translate(x, 0.33, z)));
  for (const [x, z, rot, tone] of SITE.cars) {
    const car = new THREE.Group();
    car.position.set(x, 0, z);
    car.rotation.y = -rot;
    car.add(shadows(new THREE.Mesh(bodyGeo, M({ color: paints[tone % paints.length], roughness: 0.35, metalness: 0.4, envMap, envMapIntensity: 0.5 }))));
    car.add(shadows(new THREE.Mesh(cabinGeo, carGlass)));
    car.add(new THREE.Mesh(wheelGeo, tyre));
    scene.add(car);
  }

  // Boîtes aux lettres à l'entrée.
  const bal = shadows(new THREE.Mesh(box(1.9, 1.1, 0.32, 0, 0.75, 0), M({ color: '#9aa19c', roughness: 0.6 })));
  bal.position.set(SITE.bal[0], 0, SITE.bal[1]);
  bal.rotation.y = -SITE.bal[2];
  scene.add(bal);

  // Maisons voisines : volumes neutres, pour situer le lotissement dans son quartier.
  const nWalls = [], nRoofs = [];
  for (const pts of SITE.neighbors) {
    const shape = shapeOf(pts), h = rng(3, 3.6);
    nWalls.push(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2));
    nRoofs.push(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSegments: 1, bevelSize: 2.3, bevelOffset: -2, bevelThickness: 0.75 })
      .rotateX(-Math.PI / 2).translate(0, h + 0.02, 0));
  }
  scene.add(shadows(new THREE.Mesh(merge(nWalls), M({ color: '#e9e2d4', roughness: 0.95 }))));
  scene.add(shadows(new THREE.Mesh(merge(nRoofs), M({ color: '#c79f87', roughness: 1 }))));

  // Eau : piscines et canal.
  // Reflets du soleil au fond de l'eau : un réseau de lignes claires, répété tous les 3 m.
  const ripples = canvasTexture(256, (c, s) => {
    c.fillStyle = '#e2eef0';
    c.fillRect(0, 0, s, s);
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineCap = 'round';
    for (let n = 0; n < 70; n++) {
      const x = rnd() * s, y = rnd() * s, rx = 22 + rnd() * 44, ry = 14 + rnd() * 30, rot = rnd() * 3.14;
      const from = rnd() * 6.3, sweep = 0.9 + rnd() * 1.6; // des arcs ouverts : un réseau de vaguelettes, pas des bulles
      c.lineWidth = 1 + rnd() * 2.2;
      for (const [dx, dy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
        c.beginPath();
        c.ellipse(x + dx, y + dy, rx, ry, rot, from, from + sweep);
        c.stroke();
      }
    }
  }, { repeat: true, anisotropy });
  ripples.repeat.set(1 / 3, 1 / 3);
  const water = M({ color: '#46b9d6', map: ripples, roughness: 0.06, metalness: 0.1, envMap, envMapIntensity: 0.5 });
  const waterAt = (pts, y) => {
    const m = new THREE.Mesh(flatGeo(pts), water);
    m.position.y = y;
    m.receiveShadow = true;
    return m;
  };
  for (const pts of SITE.pools) scene.add(waterAt(pts, 0.035));

  // Piscines des lots (indicatives) : margelle en pierre claire, eau légèrement en retrait.
  const pools = new THREE.Group();
  const copings = [];
  for (const pts of SITE.sitePools) {
    const f = footprint(pts);
    const ring = shapeOf(rectPts(f, 0.38));
    ring.holes.push(new THREE.Path(rectPts(f, 0).map(([x, z]) => new THREE.Vector2(x, -z))));
    copings.push(new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: false }).rotateX(-Math.PI / 2));
    pools.add(waterAt(pts, 0.045));
  }
  pools.add(shadows(new THREE.Mesh(merge(copings), M({ color: '#ece6d8', roughness: 0.9 })), false));
  scene.add(pools);

  const canal = M({ color: '#5d8f8a', roughness: 0.25, envMap, envMapIntensity: 0.3 });
  for (const pts of SITE.canal) {
    const m = new THREE.Mesh(flatGeo(pts), canal);
    m.position.y = 0.03;
    m.receiveShadow = true;
    scene.add(m);
  }

  return {
    // Sans les piscines, il reste la plage dallée dessinée dans l'image de sol : une simple terrasse.
    setPools(on) { pools.visible = on; },
  };
}
