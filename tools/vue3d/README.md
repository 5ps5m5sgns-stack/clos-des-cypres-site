# tools/vue3d — source de la vue 3D du lotissement

La page `/lotissement-3d` (affichée seule ou dans le cadre « Explorer en 3D » de `/lots`) est faite de :

| Fichier servi | D'où il vient |
| --- | --- |
| `lotissement-3d.html` | écrit à la main : mise en page, textes, réglages (`window.LOTISSEMENT`) |
| `lotissement-3d.min.js` | **fabriqué** à partir de `tools/vue3d/src/` (commande ci-dessous) |
| `images-optimized/vue3d-sol-v2-*.webp` | fabriqués par `sol.py` à partir de `sol-source.jpg` |
| `images-optimized/apercu-lotissement-3d-v2*` | fabriqués par `apercus.py` (photos de la scène) |

Rien de ce dossier n'est mis en ligne (`tools` est dans `.assetsignore`).

## Changer un texte, une surface, un statut

Tout est dans le bloc `window.LOTISSEMENT` de `lotissement-3d.html` : titre, sous-titre, lien de contact,
surfaces, et par lot les champs facultatifs `statut`, `prix`, `note`. Aucune fabrication à relancer.
`afficherJardins: true` ajoute à la fiche des lots 4 et 5 la surface de leur jardin attenant.

## Modifier la scène

Node est nécessaire (présent : `/opt/homebrew/bin/node`). Une seule fois : `cd tools/vue3d && npm install`.

```sh
cd tools/vue3d
npm run build        # écrit ../../lotissement-3d.min.js (Three.js + la scène, un seul fichier)
python3 serveur.py   # http://127.0.0.1:8766/lots : le site comme en ligne, sans cache
```

Toute modification d'un fichier de `src/` doit être suivie de `npm run build`, sinon le site ne change pas.

| Fichier | Rôle |
| --- | --- |
| `src/data.js` | géométrie en mètres relevée sur le plan de composition PA4 du 3 avril 2026 : lots, jardins, haies, murets, maisons indicatives, arbres |
| `src/main.js` | caméra, points de vue, fiche du lot, boutons, clavier, boucle de rendu |
| `src/world.js` | ciel, soleil, ombres, sol, reliefs d'horizon |
| `src/houses.js` | maisons et garages (étage ou plain-pied) |
| `src/details.js` | haies, murets, pergolas, piscines, voitures, maisons voisines, canal |
| `src/trees.js` | arbres, cyprès, pinède |
| `src/lots.js` | contours et surbrillance des lots, lot sous le pointeur |
| `src/labels.js` | étiquettes « Lot n · surface » posées sur la scène |

Repère : x vers l'est, z vers le sud (le nord est en −z), y vers le haut.

## Images

- **Sol** : `~/.venv-clos-qa/bin/python tools/vue3d/sol.py` (Pillow + numpy).
- **Aperçus** : lancer `serveur.py`, puis `~/.venv-clos-qa/bin/python tools/vue3d/apercus.py` (Playwright + Pillow).

Les fichiers d'`images-optimized/` sont servis avec un cache d'un an : ne jamais réécrire un fichier déjà en
ligne sous le même nom. Pour un nouveau rendu, changer `VERSION` dans le script (`v3`…) et reporter le nouveau
nom dans `lotissement-3d.html` (bloc `sol`, balises `preload`, fond de `#loader`) et dans `lots.html` (`<picture>`
de `#vue-3d`).

## Adresses utiles pour les essais

- `/lotissement-3d?lot=5` : ouvre la fiche du lot 5.
- `/lotissement-3d?vue=dessus` (ou `entree`, `placette`) : point de vue de départ.
- `/lotissement-3d?capture=1` : la scène seule, sans panneaux (c'est ce que photographie `apercus.py`).
- `/lotissement-3d?cam=x,y,z,tx,ty,tz` : cadrage libre (position de la caméra, point visé).

## Règles à garder

- Aucun prix affiché tant que le champ `prix` n'est pas renseigné volontairement.
- La mention « Vue d'ambiance non contractuelle » reste visible dans la page et sous le cadre.
- La page est en `noindex` et absente du sitemap.
