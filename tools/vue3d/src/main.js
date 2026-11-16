// Vue 3D du lotissement — point d'entrée. Assemble la scène, la caméra et l'interface de /lotissement-3d.
// Les réglages éditoriaux (titres, surfaces, liens) sont dans le bloc window.LOTISSEMENT de la page.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildWorld } from './world.js';
import { createHouses } from './houses.js';
import { createDetails } from './details.js';
import { createTrees } from './trees.js';
import { createLots } from './lots.js';
import { createLabels } from './labels.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const config = window.LOTISSEMENT || {};
const params = new URLSearchParams(location.search);
const canvas = $('scene');
const body = document.body;
const fr = (n) => Number(n).toLocaleString('fr-FR').replace(/[\u202f\u2009 ]/g, '\u00a0');
const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
const touch = mq('(pointer: coarse)');
const small = mq('(max-width: 899px), (pointer: coarse)'); // même condition que le préchargement de l'image de sol
const calm = mq('(prefers-reduced-motion: reduce)');
const capture = params.has('capture'); // ?capture=1 : scène seule, pour fabriquer les images d'aperçu
let embedded = false;
try { embedded = window.self !== window.top; } catch (e) { embedded = true; }

function fail(message, canReload) {
  $('loader').hidden = true;
  $('fail-text').textContent = message;
  $('fail-reload').hidden = !canReload;
  $('fail').hidden = false;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  fail('Cette vue 3D a besoin de WebGL, que ce navigateur n’a pas activé.', false);
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // les ombres ne sont recalculées que si la scène change

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 1, 7000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.485;
controls.minDistance = 16;
controls.maxDistance = 360;
controls.zoomSpeed = 0.9;
controls.rotateSpeed = touch ? 0.7 : 0.9;
controls.autoRotateSpeed = 0.3;

// Rendu à la demande : une image n'est calculée que si quelque chose a bougé.
let dirty = true, shadowsDirty = true;
const invalidate = (withShadows) => { dirty = true; if (withShadows) shadowsDirty = true; };

let groundDone = false;
const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const world = buildWorld(scene, renderer, {
  groundUrl: (config.sol && (small ? config.sol.petit : config.sol.grand)) || '',
  onGroundReady: () => { groundDone = true; invalidate(); reveal(); },
});
world.sun.shadow.mapSize.setScalar(small ? 2048 : 4096);

const houses = createHouses(scene, { envMap: world.envMap, anisotropy });
const details = createDetails(scene, { envMap: world.envMap, anisotropy });
createTrees(scene, world);
const lots = createLots(scene, config, houses);
const labels = createLabels($('tags'), lots, houses);
// Lot sous le pointeur : son étiquette d'abord, puis sa maison ou son terrain.
const lotAt = (x, y) => labels.hit(x, y) || lots.pick(x, y, canvas, camera);

let floors = 2;
function rebuildHouses() {
  houses.build(floors);
  labels.setHeights();
  invalidate(true);
}
rebuildHouses();

// ---------- Caméra : points de vue et déplacements animés ----------
// p / t : position de la caméra et point visé (mètres). pp / pt : variante pour un écran en hauteur.
const VIEWS = {
  ensemble: { p: [72, 60, 98], t: [1, 0, 6], pp: [96, 150, 140], pt: [-3, 0, 4] },
  entree: { p: [88, 22, -34], t: [14, 2, -6], pp: [112, 40, -44], pt: [10, 2, -6] },
  placette: { p: [-60, 40, 62], t: [-9, 1, 9], pp: [-80, 58, 84], pt: [-8, 1, 7] },
  dessus: { p: [-2, 205, 5.5], t: [-2, 0, 5], pp: [-4, 300, 4.5], pt: [-4, 0, 4] },
};
const portrait = () => camera.aspect < 0.9;
let flight = null;
function fly(pos, target, instant, ms = 1100) {
  if (instant || calm) {
    camera.position.copy(pos);
    controls.target.copy(target);
    controls.update();
    flight = null;
    invalidate();
    return;
  }
  flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms };
}
const press = (selector, test) => document.querySelectorAll(selector).forEach((b) => b.setAttribute('aria-pressed', String(test(b))));

function go(name, instant) {
  const v = VIEWS[name];
  if (!v) return;
  press('[data-view]', (b) => b.dataset.view === name);
  const tall = portrait() && v.pp;
  fly(new THREE.Vector3(...(tall ? v.pp : v.p)), new THREE.Vector3(...(tall ? v.pt : v.t)), instant);
}

// Tourner, basculer ou zoomer d'un cran autour du point visé (boutons et clavier).
const sph = new THREE.Spherical(), off = new THREE.Vector3();
function nudge(dAzimuth, dPolar, zoom, absoluteAzimuth) {
  stopIntro();
  off.copy(camera.position).sub(controls.target);
  sph.setFromVector3(off);
  sph.theta = absoluteAzimuth === undefined ? sph.theta + dAzimuth : absoluteAzimuth;
  sph.phi = clamp(sph.phi + dPolar, 0.02, controls.maxPolarAngle);
  sph.radius = clamp(sph.radius * zoom, controls.minDistance, controls.maxDistance);
  press('[data-view]', () => false);
  fly(new THREE.Vector3().setFromSpherical(sph).add(controls.target), controls.target.clone(), false, 380);
}

function stopIntro() {
  controls.autoRotate = false;
  $('hint').classList.add('gone');
}

// ---------- Fiche du lot ----------
const card = $('card');
let limits = false;
const syncLabels = () => labels.setState(lots.selected, lots.hovered, limits);
function row(label, value) {
  const d = document.createElement('div');
  d.className = 'row';
  const s = document.createElement('span');
  s.textContent = label;
  const b = document.createElement('b');
  b.textContent = value;
  d.append(s, b);
  return d;
}

function select(n, moveCamera) {
  lots.setSelected(n);
  syncLabels();
  press('[data-lot]', (b) => Number(b.dataset.lot) === n);
  body.classList.toggle('has-card', !!n);
  invalidate();
  if (!n) { card.hidden = true; return; }

  const lot = lots.lots[n], cfg = lot.cfg;
  $('card-title').textContent = 'Lot\u00a0' + n;
  $('card-area').textContent = fr(lot.area);
  const status = $('card-status');
  status.hidden = !cfg.statut;
  status.textContent = cfg.statut || '';
  status.dataset.s = (cfg.statut || '').toLowerCase();
  const rows = $('card-rows');
  rows.textContent = '';
  if (config.afficherJardins && lot.garden) rows.append(row('Jardin attenant', fr(lot.garden) + '\u00a0m²'));
  if (cfg.prix) rows.append(row('Prix', String(cfg.prix)));
  if (cfg.note) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = String(cfg.note);
    rows.append(p);
  }
  const cta = $('card-cta');
  cta.href = (config.contact || '/contact?lot={n}#contact-form').replace('{n}', n);
  $('card-cta-text').textContent = 'Me renseigner sur le lot\u00a0' + n;
  card.hidden = false;

  if (moveCamera) {
    press('[data-view]', () => false);
    const azimuth = controls.getAzimuthalAngle(), polar = THREE.MathUtils.degToRad(50);
    const dist = clamp(lot.radius * 2.6, 58, 92) * (portrait() ? 1.4 : 1);
    const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(azimuth), Math.cos(polar), Math.sin(polar) * Math.cos(azimuth));
    const target = new THREE.Vector3(lot.center[0], 0, lot.center[1]);
    fly(dir.multiplyScalar(dist).add(target), target);
  }
}
const stepLot = (d) => { stopIntro(); select(((lots.selected || 1) - 1 + d + 8) % 8 + 1, true); };

// ---------- Interface ----------
if (config.titre) { $('title').textContent = config.titre; document.title = config.titre + ' : vue 3D du lotissement'; }
if (config.sousTitre) $('subtitle').textContent = config.sousTitre;
if (config.mention) $('mention').textContent = config.mention;
$('hint').textContent = touch
  ? 'Un doigt pour tourner, deux pour zoomer. Touchez un lot.'
  : 'Glissez pour tourner, molette pour zoomer. Cliquez sur un lot.';

const lotBar = $('lots');
for (const lot of lots.list) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.lot = lot.n;
  b.textContent = lot.n;
  b.setAttribute('aria-pressed', 'false');
  b.setAttribute('aria-label', `Lot ${lot.n}, ${fr(lot.area)} m²`);
  b.addEventListener('click', () => { stopIntro(); select(lots.selected === lot.n ? null : lot.n, true); });
  lotBar.append(b);
}
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { stopIntro(); go(b.dataset.view); }));
$('card-close').addEventListener('click', () => select(null));
$('card-prev').addEventListener('click', () => stepLot(-1));
$('card-next').addEventListener('click', () => stepLot(1));

function toggle(id, apply) {
  const b = $(id);
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    apply(on);
    stopIntro();
    invalidate(true);
  });
}
toggle('toggle-limits', (on) => { limits = on; lots.setShowAll(on); syncLabels(); });
toggle('toggle-tags', (on) => labels.setVisible(on));
toggle('toggle-floors', (on) => { floors = on ? 2 : 1; rebuildHouses(); });
toggle('toggle-pools', (on) => details.setPools(on));

$('north').addEventListener('click', () => nudge(0, 0, 1, 0));
$('zoom-in').addEventListener('click', () => nudge(0, 0, 0.72));
$('zoom-out').addEventListener('click', () => nudge(0, 0, 1 / 0.72));

const fsButton = $('fullscreen');
if (document.fullscreenEnabled) {
  fsButton.addEventListener('click', () => {
    try {
      const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* plein écran refusé : on reste dans le cadre */ }
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    fsButton.setAttribute('aria-pressed', String(on));
    fsButton.setAttribute('aria-label', on ? 'Quitter le plein écran' : 'Plein écran');
  });
} else {
  fsButton.hidden = true;
  if (embedded) $('open').hidden = false; // iPhone : pas de plein écran dans un cadre, on propose la page seule
}
if (!embedded && !capture) $('back').hidden = false;
if (embedded) {
  body.classList.add('embedded'); // dans la page : le titre et la mention complète sont déjà autour du cadre
  document.querySelector('.mention .court').textContent = 'Vue non contractuelle';
}
if (capture) body.classList.add('capture');

// Clic (ou toucher bref) sur un lot ; survol à la souris.
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; stopIntro(); });
canvas.addEventListener('wheel', stopIntro, { passive: true });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 500;
  down = null;
  if (!click) return;
  const n = lotAt(e.clientX, e.clientY);
  select(n === lots.selected ? null : n, !!n);
});
canvas.addEventListener('pointercancel', () => { down = null; });
const hover = (n) => {
  if (!lots.setHovered(n)) return;
  canvas.style.cursor = n ? 'pointer' : '';
  syncLabels();
  invalidate();
};
let pendingMove = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  if (!pendingMove) requestAnimationFrame(() => { const m = pendingMove; pendingMove = null; hover(lotAt(m.clientX, m.clientY)); });
  pendingMove = e;
});
canvas.addEventListener('pointerleave', () => hover(null));

// Clavier, quand la vue a le focus : flèches pour tourner, + et - pour zoomer, 1 à 8 pour un lot, Échap pour fermer.
canvas.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === 'ArrowLeft') nudge(-0.26, 0, 1);
  else if (k === 'ArrowRight') nudge(0.26, 0, 1);
  else if (k === 'ArrowUp') nudge(0, -0.12, 1);
  else if (k === 'ArrowDown') nudge(0, 0.12, 1);
  else if (k === '+' || k === '=') nudge(0, 0, 0.8);
  else if (k === '-' || k === '_') nudge(0, 0, 1.25);
  else if (k >= '1' && k <= '8') { stopIntro(); select(Number(k), true); }
  else return;
  e.preventDefault();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lots.selected) select(null); });

controls.addEventListener('start', () => { flight = null; press('[data-view]', () => false); });
controls.addEventListener('change', () => {
  const t = controls.target; // la vue reste centrée sur le lotissement
  t.x = clamp(t.x, -110, 110);
  t.z = clamp(t.z, -110, 110);
  t.y = clamp(t.y, 0, 12);
  invalidate();
});

// Dans un cadre, la molette fait défiler la page tant qu'on n'a pas cliqué dans la vue.
if (embedded) {
  controls.enableZoom = false;
  document.addEventListener('pointerdown', () => { controls.enableZoom = true; }, true);
  document.documentElement.addEventListener('mouseleave', () => { controls.enableZoom = false; });
}

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  fail('La vue 3D s’est interrompue (mémoire graphique reprise par l’appareil).', true);
});
canvas.addEventListener('webglcontextrestored', () => { $('fail').hidden = true; invalidate(true); });
$('fail-reload').addEventListener('click', () => location.reload());

// ---------- Taille, boucle de rendu, mise en veille ----------
let width = 0, height = 0;

// Les panneaux recouvrent le haut et le bas de l'image : on décale la prise de vue pour que le point visé
// tombe au milieu de la zone restée libre (surtout utile sur téléphone, fiche du lot ouverte).
const dock = document.querySelector('.dock'), cartouche = document.querySelector('.cartouche');
const narrow = window.matchMedia ? window.matchMedia('(max-width: 720px)') : { matches: false };
let shift = 0, shiftGoal = 0;
function measureShift() {
  if (!height || capture) { shiftGoal = 0; return; }
  const bottom = Math.min(height, dock.getBoundingClientRect().top);
  const c = cartouche.getBoundingClientRect();
  const top = narrow.matches && c.height ? Math.max(0, c.bottom) : 0;
  shiftGoal = Math.round(clamp(height / 2 - (top + bottom) / 2, -height * 0.3, height * 0.3));
  invalidate();
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  width = w;
  height = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 56 : w / h < 1.25 ? 46 : 38;
  camera.updateProjectionMatrix();
  lots.setResolution(w, h);
  measureShift();
  if (calm) shift = shiftGoal;
  applyShift();
  invalidate();
}
function applyShift() {
  if (Math.abs(shift) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(width, height, 0, Math.round(shift), width, height);
}
new ResizeObserver(resize).observe(canvas);
new ResizeObserver(measureShift).observe(dock);
resize();
shift = shiftGoal;
applyShift();

const startView = VIEWS[params.get('vue')] ? params.get('vue') : 'ensemble';
go(startView, true);
const cam = (params.get('cam') || '').split(',').map(Number); // ?cam=x,y,z,tx,ty,tz : cadrage libre (aperçus, essais)
if (cam.length === 6 && cam.every(Number.isFinite)) fly(new THREE.Vector3(cam[0], cam[1], cam[2]), new THREE.Vector3(cam[3], cam[4], cam[5]), true);
const startLot = Number(params.get('lot'));
if (startLot >= 1 && startLot <= 8) { select(startLot, true); if (flight) fly(flight.p1, flight.t1, true); stopIntro(); }
const intro = !calm && !capture && !startLot && cam.length !== 6 && config.rotationAccueil !== false;
controls.autoRotate = intro;
// Arrivée : la caméra part d'un peu plus loin et descend vers la vue d'ensemble pendant que la scène apparaît.
let arrival = null;
if (intro) {
  arrival = { p: camera.position.clone(), t: controls.target.clone() };
  off.copy(camera.position).sub(controls.target);
  sph.setFromVector3(off);
  sph.theta += 0.3; // même sens que la rotation d'accueil qui prend le relais
  sph.phi = Math.max(0.3, sph.phi - 0.14);
  sph.radius *= 1.3;
  fly(new THREE.Vector3().setFromSpherical(sph).add(controls.target), controls.target.clone(), true);
}
if (params.get('tags') === '0') { labels.setVisible(false); $('toggle-tags').setAttribute('aria-pressed', 'false'); }

const needle = $('needle');
let running = false, onScreen = true, last = 0, frames = 0, revealed = false;
function reveal() {
  if (revealed || !frames || !groundDone) return;
  revealed = true;
  if (arrival && controls.autoRotate) fly(arrival.p, arrival.t, false, 2600);
  arrival = null;
  requestAnimationFrame(() => { body.classList.remove('is-loading'); $('loader').classList.add('gone'); });
}
function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (flight) {
    const k = Math.min(1, (now - flight.start) / flight.ms);
    const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(flight.p0, flight.p1, ease);
    controls.target.lerpVectors(flight.t0, flight.t1, ease);
    if (k >= 1) flight = null;
    dirty = true;
  }
  if (controls.update(dt)) dirty = true;
  if (Math.abs(shiftGoal - shift) > 0.5) {
    shift = calm ? shiftGoal : shift + (shiftGoal - shift) * Math.min(1, dt * 7);
    applyShift();
    dirty = true;
  }
  if (!dirty || !width) return;
  dirty = false;
  if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
  renderer.render(scene, camera);
  labels.update(camera, width, height);
  needle.style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
  frames++;
  reveal();
}
function wake() {
  const active = onScreen && !document.hidden;
  if (active && !running) { running = true; last = performance.now(); dirty = true; requestAnimationFrame(frame); }
  else if (!active) running = false;
}
document.addEventListener('visibilitychange', wake);
if ('IntersectionObserver' in window) new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; wake(); }).observe(canvas);
wake();
setTimeout(() => { groundDone = true; reveal(); }, 8000); // image de sol trop lente : on montre la scène sans attendre

// Accès pour les essais et la fabrication des aperçus.
window.__scene = {
  go, select, stopIntro, camera, controls, renderer, invalidate,
  ready: () => revealed,
  settle: () => { stopIntro(); if (flight) fly(flight.p1, flight.t1, true); },
};
