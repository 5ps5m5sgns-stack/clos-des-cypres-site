// Décor : ciel, lumière du soleil, sol (image du plan + terrain lointain) et reliefs à l'horizon.
import * as THREE from 'three';
import { SITE } from './data.js';
import { rnd, canvasTexture } from './util.js';

// Soleil de fin d'après-midi, au sud-ouest : les façades sud et ouest sont éclairées, les ombres s'allongent vers le nord-est.
export const SUN_DIR = new THREE.Vector3(-0.56, 0.56, 0.61).normalize();

const HAZE = new THREE.Color('#dde7ea'); // brume d'horizon, reprise par le brouillard
const ZENITH = new THREE.Color('#3f86d8');

function makeSky(radius) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: ZENITH },
      uHorizon: { value: HAZE },
      uSunColor: { value: new THREE.Color('#fff2d6') },
      uSunDir: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uSunColor, uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, 1.0 - pow(1.0 - h, 3.6));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (0.16 * pow(s, 5.0) + 0.9 * pow(s, 220.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  return sky;
}

// Relief d'horizon : une couronne dont la hauteur suit une silhouette. « bumps » = massifs [direction, hauteur, finesse].
function makeRidge(radius, base, bumps, color, phase) {
  const N = 240, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let h = base;
    for (const [dir, height, sharp] of bumps) h += height * Math.pow(Math.max(0, Math.cos(a - dir)), sharp);
    h += base * (0.22 * Math.sin(a * 7 + phase) + 0.12 * Math.sin(a * 17 + phase * 2) + 0.06 * Math.sin(a * 41 + 1 + phase));
    pos.push(Math.cos(a) * radius, -20, Math.sin(a) * radius, Math.cos(a) * radius, Math.max(h, 2), Math.sin(a) * radius);
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

// Fondu des bords de l'image de sol vers le terrain lointain (calculé point par point : le flou de canevas
// n'existe pas dans tous les navigateurs).
function edgeFade(w, h, margin) {
  const data = new Uint8Array(w * h * 4);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y) / margin;
      const v = Math.round(255 * smooth(Math.min(1, Math.max(0, d))));
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, w, h);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function buildWorld(scene, renderer, { groundUrl, onGroundReady }) {
  scene.fog = new THREE.FogExp2(HAZE, 0.00135);
  scene.add(makeSky(5200));

  // Reflets (vitres, piscines, carrosseries) : une petite carte d'environnement tirée du même ciel.
  let envMap = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(makeSky(900));
    envMap = pmrem.fromScene(envScene, 0, 1, 2000).texture;
    pmrem.dispose();
  } catch (e) {
    envMap = null;
  }

  scene.add(new THREE.HemisphereLight('#d3e3fb', '#b3a67e', 1.55));
  const sun = new THREE.DirectionalLight('#fff1dc', 3.7);
  sun.position.copy(SUN_DIR).multiplyScalar(260);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = -118; cam.right = 118; cam.top = 118; cam.bottom = -118; cam.near = 20; cam.far = 620;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.07;
  sun.shadow.radius = 2.2;
  scene.add(sun, sun.target);

  // Horizon : la chaîne de l'Étoile au sud, une longue crête claire au nord-est, des collines basses ailleurs.
  scene.add(makeRidge(3400, 60, [[Math.PI * 0.55, 250, 2], [Math.PI * 1.72, 300, 9], [Math.PI * 1.66, 150, 3]], '#c3d2dc', 0));
  scene.add(makeRidge(2500, 40, [[Math.PI * 0.5, 150, 3], [Math.PI * 1.05, 70, 4], [Math.PI * 1.9, 60, 5]], '#aebfc6', 2.1));
  scene.add(makeRidge(1700, 22, [[Math.PI * 0.62, 70, 4], [Math.PI * 0.2, 40, 6], [Math.PI * 1.35, 45, 5]], '#98ab9f', 4.4));

  // Terrain lointain : prairie sèche et garrigue, en taches douces.
  const far = canvasTexture(512, (c, s) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s, s);
    for (let n = 0; n < 240; n++) {
      const x = rnd() * s, y = rnd() * s, r = 18 + rnd() * 70;
      const tone = pick3(rnd());
      for (const [dx, dy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
        const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, `rgba(${tone},0.5)`);
        g.addColorStop(1, `rgba(${tone},0)`);
        c.fillStyle = g;
        c.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
    }
  }, { repeat: true, anisotropy: 4 });
  far.repeat.set(22, 22);
  const farGround = new THREE.Mesh(
    new THREE.CircleGeometry(4600, 72),
    new THREE.MeshStandardMaterial({ color: '#c3c6a0', map: far, roughness: 1 }),
  );
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.y = -0.06;
  farGround.receiveShadow = true;
  scene.add(farGround);

  // Image du plan (pelouses, voirie, accès) posée au sol, bords fondus.
  const [W, H] = SITE.size, [OX, OZ] = SITE.origin;
  const groundMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', alphaMap: edgeFade(256, 181, 22), transparent: true, depthWrite: false, roughness: 1,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2 - OX, 0, H / 2 - OZ);
  ground.renderOrder = -1;
  ground.receiveShadow = true;
  ground.visible = false;
  scene.add(ground);

  new THREE.TextureLoader().load(
    groundUrl,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      groundMat.map = tex;
      groundMat.needsUpdate = true;
      ground.visible = true;
      onGroundReady(true);
    },
    undefined,
    () => onGroundReady(false),
  );

  return { envMap, sun, inGroundImage: (x, z, pad = 6) => x > -OX - pad && x < W - OX + pad && z > -OZ - pad && z < H - OZ + pad };
}

function pick3(t) {
  if (t < 0.4) return '232,230,214';
  if (t < 0.75) return '216,222,204';
  return '255,255,250';
}
