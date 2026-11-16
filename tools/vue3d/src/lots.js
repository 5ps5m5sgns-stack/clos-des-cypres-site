// Les huit lots : contour, surbrillance au survol et à la sélection, détection du lot sous le pointeur.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITE } from './data.js';
import { flatGeo, pointInPolygon } from './util.js';

const GOLD = new THREE.Color('#ffd166');
const WHITE = new THREE.Color('#ffffff');

export function createLots(scene, config, houses) {
  const group = new THREE.Group();
  scene.add(group);
  const lineMaterials = [];
  const lots = {};

  const outline = (pts, dashed) => {
    const flat = [];
    for (const p of pts.concat([pts[0]])) flat.push(p[0], 0.14, p[1]);
    const mat = new LineMaterial({
      color: 0xffffff, linewidth: 1.6, transparent: true, opacity: 0.75, dashed, dashSize: 1.6, gapSize: 1.1,
      depthWrite: false, depthTest: false,
    });
    lineMaterials.push(mat);
    const line = new Line2(new LineGeometry().setPositions(flat), mat);
    line.computeLineDistances();
    line.renderOrder = 3;
    return line;
  };

  for (const lot of SITE.lots) {
    const cfg = (config.lots && config.lots[lot.n]) || {};
    const polys = [lot.poly].concat(lot.garden ? [lot.garden] : []);
    const fill = new THREE.Mesh(
      mergeGeometries(polys.map(flatGeo)),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false }),
    );
    fill.position.y = 0.09;
    fill.renderOrder = 2;
    fill.visible = false;
    const lines = [outline(lot.poly, false)].concat(lot.garden ? [outline(lot.garden, true)] : []);
    group.add(fill, ...lines);

    // Point visé par la caméra : centre de l'ensemble lot + jardin.
    const all = polys.flat();
    const xs = all.map((p) => p[0]), zs = all.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    lots[lot.n] = {
      n: lot.n, polys, fill, lines, cfg,
      center: [cx, cz],
      radius: Math.max(...all.map((p) => Math.hypot(p[0] - cx, p[1] - cz))),
      area: cfg.surface || lot.area,
      garden: lot.garden ? cfg.jardin || lot.gardenArea : null,
    };
  }

  let hovered = null, selected = null, showAll = false;
  function refresh() {
    for (const lot of Object.values(lots)) {
      const sel = lot.n === selected, hov = lot.n === hovered;
      lot.fill.visible = sel || hov;
      lot.fill.material.opacity = sel ? 0.2 : 0.12;
      for (const line of lot.lines) {
        line.visible = showAll || sel || hov;
        line.material.color.copy(sel || hov ? GOLD : WHITE);
        line.material.linewidth = sel ? 3.8 : hov ? 2.8 : 1.8;
        line.material.opacity = sel || hov ? 1 : 0.8;
        line.renderOrder = sel || hov ? 5 : 3;
      }
    }
  }
  refresh();

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

  return {
    lots,
    list: SITE.lots.map((l) => lots[l.n]),
    get selected() { return selected; },
    get hovered() { return hovered; },
    setHovered(n) { if (n !== hovered) { hovered = n; refresh(); return true; } return false; },
    setSelected(n) { selected = n; refresh(); },
    setShowAll(on) { showAll = on; refresh(); },
    setResolution(w, h) { for (const m of lineMaterials) m.resolution.set(w, h); },
    // Lot sous le point (clientX, clientY) : d'abord une maison, sinon le terrain touché au sol.
    pick(clientX, clientY, canvas, camera) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const first = ray.intersectObjects(houses.group.children, true)[0];
      if (first) {
        let o = first.object;
        while (o && !o.userData.lot) o = o.parent;
        if (o) return o.userData.lot;
      }
      if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
      for (const lot of Object.values(lots)) if (lot.polys.some((p) => pointInPolygon(hit.x, hit.z, p))) return lot.n;
      return null;
    },
  };
}
