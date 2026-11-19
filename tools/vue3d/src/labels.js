// Étiquettes des lots : de vrais éléments HTML posés au-dessus de la scène (texte net, à la taille de lecture du
// site), repositionnés à chaque image d'après la caméra. Elles laissent passer les gestes (glisser, molette,
// pincer) vers la scène ; le clic sur une étiquette est reconnu par hit(), appelé depuis la scène.
import * as THREE from 'three';
import { SITE } from './data.js';

const fr = (n) => Number(n).toLocaleString('fr-FR').replace(/[\u202f\u2009 ]/g, '\u00a0');

export function createLabels(container, lots, houses) {
  const items = [];

  for (const l of SITE.labels) {
    const lot = lots.lots[l.n];
    const el = document.createElement('span');
    el.className = 'tag';
    const name = document.createElement('b');
    const word = document.createElement('i'); // masqué sur petit écran : il ne reste que le numéro
    word.textContent = 'Lot\u00a0';
    name.append(word, String(l.n));
    const area = document.createElement('span');
    area.textContent = fr(lot.area) + '\u00a0m²';
    el.append(name, area);
    container.append(el);
    items.push({ el, n: l.n, pos: new THREE.Vector3(l.p[0], 8, l.p[1]) });
  }
  for (const g of SITE.gardenLabels) {
    const el = document.createElement('span');
    el.className = 'tag tag--garden';
    const ga = lots.lots[g.n] && lots.lots[g.n].garden;
    el.textContent = 'Jardin du lot\u00a0' + g.n + (ga && (window.LOTISSEMENT || {}).afficherJardins ? '\u00a0· ' + fr(ga) + '\u00a0m²' : '');
    container.append(el);
    items.push({ el, n: g.n, garden: true, pos: new THREE.Vector3(g.p[0], 1.6, g.p[1]) });
  }

  const v = new THREE.Vector3();
  return {
    // Les étiquettes des lots se posent juste au-dessus du faîtage (qui change entre étage et plain-pied).
    setHeights() {
      for (const it of items) if (!it.garden) it.pos.y = houses.ridgeHeight(it.n) + 0.9;
    },
    // Les étiquettes « Jardin du lot » n'apparaissent qu'avec leur lot (survol, sélection) ou avec les limites.
    setState(selected, hovered, showGardens) {
      for (const it of items) {
        it.el.classList.toggle('is-on', it.n === selected);
        it.el.classList.toggle('is-hover', it.n === hovered && it.n !== selected);
        if (it.garden) it.el.classList.toggle('is-shown', !!showGardens || it.n === selected || it.n === hovered);
      }
    },
    setVisible(on) { container.hidden = !on; },
    // Numéro du lot dont l'étiquette se trouve sous le point (clientX, clientY), sinon null.
    hit(clientX, clientY) {
      if (container.hidden) return null;
      let best = null, bestZ = -Infinity;
      for (const it of items) {
        if (it.garden || it.hidden) continue;
        const r = it.el.getBoundingClientRect();
        if (clientX < r.left - 4 || clientX > r.right + 4 || clientY < r.top - 4 || clientY > r.bottom + 8) continue;
        const z = Number(it.el.style.zIndex) || 0;
        if (z > bestZ) { bestZ = z; best = it.n; }
      }
      return best;
    },
    update(camera, width, height) {
      if (container.hidden) return;
      for (const it of items) {
        v.copy(it.pos).project(camera);
        const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.2;
        if (visible !== !it.hidden) { it.hidden = !visible; it.el.style.visibility = visible ? '' : 'hidden'; }
        if (!visible) continue;
        const x = Math.round((v.x * 0.5 + 0.5) * width), y = Math.round((-v.y * 0.5 + 0.5) * height);
        it.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
        it.el.style.zIndex = String(1000 - Math.round(v.z * 1000) + (it.el.classList.contains('is-on') ? 2000 : 0));
      }
    },
  };
}
