// Maisons et garages figurés à titre indicatif : volumes simples de style provençal (toit à quatre pans en
// tuiles, génoise, volets, porte d'entrée tournée vers l'accès du lot).
import * as THREE from 'three';
import { SITE } from './data.js';
import { rnd, box, beam, merge, shadows, canvasTexture, footprint } from './util.js';

const WALL_TONES = ['#eddcc0', '#f2e6d0', '#e8d1aa', '#f0e0c7', '#ead5b6', '#f4e9d6', '#e6cda7', '#efe1c9'];
const SHUTTER_TONES = ['#7f95a9', '#73917e', '#9ba7ad', '#8d735e', '#62829a', '#9db19b', '#a9906f', '#6f8a93'];

// Toit à quatre pans : demi-longueur a, demi-largeur b, hauteur d'égout y0, pente.
function hipRoof(a, b, y0, slope) {
  const ridge = Math.max(a - b, 0), y1 = y0 + b * slope;
  const k = 1 / 1.6, vTop = b * Math.hypot(1, slope) * k; // une tuile de la texture = 20 cm
  const pos = [], uv = [];
  const tri = (p, q, r, tp, tq, tr) => { pos.push(...p, ...q, ...r); uv.push(...tp, ...tq, ...tr); };
  const quad = (p, q, r, s, tp, tq, tr, ts) => { tri(p, q, r, tp, tq, tr); tri(p, r, s, tp, tr, ts); };
  const long = [[-a * k, 0], [a * k, 0], [ridge * k, vTop], [-ridge * k, vTop]];
  quad([-a, y0, b], [a, y0, b], [ridge, y1, 0], [-ridge, y1, 0], ...long);
  quad([a, y0, -b], [-a, y0, -b], [-ridge, y1, 0], [ridge, y1, 0], ...long);
  tri([a, y0, b], [a, y0, -b], [ridge, y1, 0], [-b * k, 0], [b * k, 0], [0, vTop]);
  tri([-a, y0, -b], [-a, y0, b], [-ridge, y1, 0], [-b * k, 0], [b * k, 0], [0, vTop]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export function createHouses(scene, { envMap, anisotropy }) {
  const tiles = canvasTexture(256, (c) => {
    const tones = ['#c98562', '#d19270', '#bf7a58', '#d69c7a', '#c78a69', '#b97353', '#cf8d66'];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
      c.fillStyle = tones[(rnd() * tones.length) | 0];
      c.fillRect(i * 32, j * 64, 32, 64);
      const g = c.createLinearGradient(i * 32, 0, (i + 1) * 32, 0); // galbe de la tuile canal
      g.addColorStop(0, 'rgba(60,25,10,.42)');
      g.addColorStop(0.5, 'rgba(255,235,210,.18)');
      g.addColorStop(1, 'rgba(60,25,10,.42)');
      c.fillStyle = g;
      c.fillRect(i * 32, j * 64, 32, 64);
      c.fillStyle = 'rgba(50,20,8,.30)';
      c.fillRect(i * 32, j * 64, 32, 3);
    }
  }, { repeat: true, anisotropy });
  const stucco = canvasTexture(128, (c, s) => {
    c.fillStyle = '#f4f4f4';
    c.fillRect(0, 0, s, s);
    for (let n = 0; n < 2600; n++) {
      const v = (232 + rnd() * 23) | 0;
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
  }, { repeat: true, anisotropy });

  const M = (o) => new THREE.MeshStandardMaterial(o);
  const mat = {
    roof: M({ map: tiles, roughness: 0.92 }),
    roofLight: M({ map: tiles, color: '#f3e3d4', roughness: 0.92 }),
    terracotta: M({ color: '#c8876a', roughness: 0.95 }),
    trim: M({ color: '#f5f0e6', roughness: 0.85 }),
    glass: M({ color: '#22303b', roughness: 0.08, metalness: 0.55, envMap, envMapIntensity: 0.7 }),
    garageDoor: M({ color: '#dedad0', roughness: 0.6 }),
  };
  const perLot = {};
  const lotMats = (lot) => {
    const i = (lot - 1) % WALL_TONES.length;
    return perLot[i] || (perLot[i] = {
      wall: M({ color: WALL_TONES[i], map: stucco, roughness: 0.94 }),
      base: M({ color: new THREE.Color(WALL_TONES[i]).multiplyScalar(0.8), roughness: 0.95 }),
      shutter: M({ color: SHUTTER_TONES[i], roughness: 0.75 }),
      door: M({ color: new THREE.Color(SHUTTER_TONES[i]).multiplyScalar(0.72), roughness: 0.6 }),
    });
  };

  const group = new THREE.Group();
  scene.add(group);
  const ridgeHeights = {};

  function build(floors) {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    group.clear();

    for (const h of SITE.houses) {
      const f = footprint(h.pts);
      const main = h.kind === 'M';
      const wallH = main ? (floors === 2 ? 5.75 : 2.95) : 2.65;
      const slope = main ? 0.33 : 0.27;
      const eave = main ? 0.45 : 0.3;
      const A = f.a + eave, B = f.b + eave;        // demi-dimensions du toit, débords compris
      const ridge = Math.max(A - B, 0);
      const top = wallH + B * slope;
      const m = lotMats(h.lot);

      const g = new THREE.Group();
      g.position.set(f.cx, 0, f.cz);
      g.rotation.y = f.rot;
      g.userData.lot = h.lot;
      if (main) ridgeHeights[h.lot] = top;

      const walls = [box(2 * f.a, wallH, 2 * f.b, 0, wallH / 2, 0)];
      const base = [box(2 * f.a + 0.05, 0.42, 2 * f.b + 0.05, 0, 0.21, 0)];
      const trim = [], terra = [], glass = [], shutters = [], door = [], garage = [];

      terra.push(box(2 * (f.a + eave * 0.5), 0.13, 2 * (f.b + eave * 0.5), 0, wallH - 0.2, 0)); // génoise
      trim.push(box(2 * A, 0.1, 2 * B, 0, wallH - 0.06, 0));                                      // sous-face du débord
      if (ridge > 0.3) terra.push(box(2 * ridge + 0.3, 0.13, 0.3, 0, top + 0.02, 0));               // faîtage
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        terra.push(beam(new THREE.Vector3(sx * A, wallH + 0.05, sz * B), new THREE.Vector3(sx * ridge, top + 0.05, 0), 0.26, 0.11));
      }

      // Les quatre façades, dans le repère de la maison.
      const sides = [
        { len: 2 * f.a, dist: f.b, ry: 0, n: [0, 1] },
        { len: 2 * f.a, dist: f.b, ry: Math.PI, n: [0, -1] },
        { len: 2 * f.b, dist: f.a, ry: Math.PI / 2, n: [1, 0] },
        { len: 2 * f.b, dist: f.a, ry: -Math.PI / 2, n: [-1, 0] },
      ];
      const put = (list, w, hgt, d, x, y, side, out) => {
        const b = new THREE.BoxGeometry(w, hgt, d);
        b.translate(x, y, side.dist + out);
        b.rotateY(side.ry);
        list.push(b);
      };
      // Façade d'entrée : celle qui regarde l'accès du lot.
      const dx = h.drive[0] - f.cx, dz = h.drive[1] - f.cz, cos = Math.cos(f.rot), sin = Math.sin(f.rot);
      let front = sides[0], best = -Infinity;
      for (const s of sides) {
        const score = (s.n[0] * cos + s.n[1] * sin) * dx + (-s.n[0] * sin + s.n[1] * cos) * dz;
        if (score > best) { best = score; front = s; }
      }

      if (main) {
        // Cheminée
        const cx = ridge > 0.6 ? ridge * 0.45 : 0, cz = B * 0.42, cy = wallH + (B - cz) * slope;
        walls.push(box(0.55, 1.25, 0.8, cx, cy + 0.35, cz));
        trim.push(box(0.72, 0.08, 0.97, cx, cy + 1, cz));
        terra.push(box(0.5, 0.12, 0.75, cx, cy + 1.12, cz));

        for (const s of sides) {
          const bays = Math.max(1, Math.floor(s.len / 3.3)), step = s.len / bays;
          const longSide = s.len === 2 * f.a;
          const doorBay = s === front ? Math.floor(bays / 2) : -1;
          for (let level = 0; level < floors; level++) for (let i = 0; i < bays; i++) {
            const x = -s.len / 2 + step * (i + 0.5);
            if (level === 0 && i === doorBay) {
              put(trim, 1.2, 2.3, 0.05, x, 1.15, s, 0);
              put(door, 1, 2.15, 0.07, x, 1.08, s, 0.01);
              put(base, 1.9, 0.16, 0.9, x, 0.08, s, 0.45);   // seuil
              put(terra, 1.8, 0.09, 0.85, x, 2.52, s, 0.42); // marquise en tuiles
              put(trim, 1.7, 0.06, 0.8, x, 2.45, s, 0.4);
              continue;
            }
            const bay = level === 0 && longSide; // porte-fenêtre au rez-de-chaussée des grandes façades
            const w = bay ? 1.4 : 1, hgt = bay ? 2.15 : 1.25, y = bay ? 1.1 : level * 2.8 + 1.55, sw = w / 2;
            put(trim, w + 0.16, hgt + 0.16, 0.05, x, y, s, 0);
            put(glass, w, hgt, 0.06, x, y, s, 0.012);
            put(trim, 0.05, hgt, 0.07, x, y, s, 0.02);
            if (!bay) put(trim, w, 0.05, 0.07, x, y, s, 0.02);
            put(shutters, sw, hgt + 0.06, 0.05, x - w / 2 - sw / 2 - 0.1, y, s, 0.015);
            put(shutters, sw, hgt + 0.06, 0.05, x + w / 2 + sw / 2 + 0.1, y, s, 0.015);
          }
        }
      } else {
        const doors = front.len > 6.5 ? 2 : 1, step = front.len / doors, w = Math.min(2.5, step - 0.7);
        for (let i = 0; i < doors; i++) {
          const x = -front.len / 2 + step * (i + 0.5);
          put(trim, w + 0.18, 2.2, 0.05, x, 1.08, front, 0);
          put(garage, w, 2.1, 0.06, x, 1.05, front, 0.012);
          for (let k = 1; k < 4; k++) put(trim, w, 0.025, 0.07, x, k * 0.52, front, 0.014);
        }
      }

      const add = (list, material, cast = true) => { if (list.length) g.add(shadows(new THREE.Mesh(merge(list), material), cast)); };
      add(walls, m.wall);
      add(base, m.base);
      add(trim, mat.trim);
      add(terra, mat.terracotta);
      g.add(shadows(new THREE.Mesh(hipRoof(A, B, wallH, slope), main ? mat.roof : mat.roofLight)));
      add(glass, mat.glass, false);
      add(shutters, m.shutter, false);
      add(door, m.door, false);
      add(garage, mat.garageDoor, false);
      group.add(g);
    }
  }

  return { group, build, ridgeHeight: (lot) => ridgeHeights[lot] || 7 };
}
