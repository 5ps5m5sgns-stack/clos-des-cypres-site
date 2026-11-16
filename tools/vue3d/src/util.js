// Petits outils partagés par les modules de la scène.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Générateur pseudo-aléatoire à graine fixe : la scène est la même à chaque chargement.
let seed = 20260411;
export const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
export const rng = (a, b) => a + (b - a) * rnd();
export const pick = (list) => list[(rnd() * list.length) | 0];

export const clamp = THREE.MathUtils.clamp;

export function centroid(pts) {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  return [x / pts.length, z / pts.length];
}

// Contour [x, z] (mètres) -> forme plane. Le plan XY de la forme devient le sol après rotation.
export function shapeOf(pts) {
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1])));
  s.closePath();
  return s;
}
export const flatGeo = (pts) => new THREE.ShapeGeometry(shapeOf(pts)).rotateX(-Math.PI / 2);

export function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// Boîte allongée posée entre deux points (arêtier de toit, muret, etc.).
const X_AXIS = new THREE.Vector3(1, 0, 0);
export function beam(from, to, depth, height) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const g = new THREE.BoxGeometry(dir.length(), height, depth);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(X_AXIS, dir.normalize()));
  g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  return g;
}

// Fusionne des géométries en un seul maillage (un seul appel de dessin). On ne garde que les attributs
// communs : position, normal, uv, et color si « keepColor ».
export function merge(geos, keepColor = false) {
  const keep = keepColor ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  return mergeGeometries(geos.map((src) => {
    const g = src.index ? src.toNonIndexed() : src;
    for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  }));
}

export function shadows(obj, cast = true, receive = true) {
  obj.castShadow = cast;
  obj.receiveShadow = receive;
  return obj;
}

// Texture dessinée dans un canevas (tuiles, crépi, feuillage). « draw » reçoit le contexte 2D et la taille.
export function canvasTexture(size, draw, { repeat = false, anisotropy = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

// Emprise rectangulaire d'un contour à quatre points : centre, demi-longueur a, demi-largeur b, orientation.
export function footprint(pts) {
  const [cx, cz] = centroid(pts);
  const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
  const e2 = [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]];
  const l1 = Math.hypot(e1[0], e1[1]);
  const l2 = Math.hypot(e2[0], e2[1]);
  const long = l1 >= l2 ? e1 : e2;
  return { cx, cz, a: Math.max(l1, l2) / 2, b: Math.min(l1, l2) / 2, rot: -Math.atan2(long[1], long[0]) };
}

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
