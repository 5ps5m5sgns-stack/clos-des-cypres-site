# tools/ — outils de développement (non utilisés par le site)

Rien ici n'est chargé par les pages. Python 3.9 suffit (macOS), sans Node.

Exception : la vue 3D du lotissement (`/lotissement-3d`) se fabrique avec Node, voir `tools/vue3d/README.md`.

## Régénérer les fichiers `.min.js`

`main.min.js`, `consent.min.js` et `animations.min.js` sont les versions allégées de
`main.js`, `consent.js` et `animations.js`. **Toute modification d'un `.js` doit être suivie
de cette commande**, sinon le site (qui charge les `.min.js`) ne change pas.

```sh
python3 -m venv ~/.venv-clos-min          # une seule fois, HORS du dépôt
~/.venv-clos-min/bin/pip install rjsmin    # (testé avec rjsmin 1.2.5)

~/.venv-clos-min/bin/python tools/minify.py          # main + consent
~/.venv-clos-min/bin/python tools/minify.py animations   # un fichier précis
~/.venv-clos-min/bin/python tools/minify.py --all    # les trois
~/.venv-clos-min/bin/python tools/minify.py --check  # ne modifie rien : « à jour » ou « PÉRIMÉ »
```

- Idempotent : relancé sans changement de source, il répond « inchangé » (mêmes octets).
- `rjsmin` ne retire que les espaces et les commentaires (aucun renommage de variable) : le
  fichier est plus gros que l'ancien (≈ 17 Ko contre 13 Ko pour `main`), mais sans risque.
- Avant d'écrire, le script vérifie que chaînes, gabarits et expressions régulières sont
  identiques à la source et que le code ne diffère que par les espaces ; après écriture, il
  fait un test de syntaxe avec JavaScriptCore (`osascript`, macOS) ou, à défaut, `node --check`.
- `animations.min.js` n'est PAS régénéré par défaut : il date de l'ancienne chaîne et
  `animations.js` n'a pas changé. Ne le relancer que si `animations.js` est modifié.

## Ce qui n'est PAS régénérable (chaîne d'origine perdue)

Le code des pages cite `scripts/build-critical.mjs` et `npm run build:min`. Ils n'existent
pas dans le dépôt (ni `package.json`, ni dossier `scripts/`), et Node n'est pas installé.
Conséquences :

- `style.min.css` ne peut pas être reproduit : `rcssmin` donne un résultat équivalent mais
  différent (69 095 octets contre 67 581), donc il n'est ni utilisé ni écrit par `minify.py`.
  Après une modification de `style.css`, `style.min.css` doit être mis à jour à la main
  (ou avec `rcssmin` après essai visuel de toutes les pages).
- Le CSS critique (≈ 22 Ko) recopié dans le `<head>` de chaque page ne se régénère pas non
  plus : toute modification du haut de page se fait à la main, page par page.

## Contrôler les dates du sitemap

`sitemap.xml` est écrit par `python3 tools/build_blog.py` : pages de la racine = date du dernier commit qui a touché
le fichier (ou date de modification s'il n'est pas commité), articles = champ `updated` / `date` du texte.
**Le dépôt ne doit pas être cloné en « shallow »** : toutes les dates seraient celles du dernier commit
(`git fetch --unshallow` d'abord).
`python3 tools/lastmod_check.py` compare chaque `<lastmod>` à cette règle (blog inclus). Il n'écrit rien ; code retour 1
en cas d'écart, 2 si le dépôt est « shallow ».

`python3 tools/sync_datemodified.py` aligne le `dateModified` des données structurées (JSON-LD) des pages de la racine
sur la même date (`--check` pour seulement contrôler). Ordre conseillé avant de publier : modifier les pages, lancer
`sync_datemodified.py`, `build_blog.py` (sitemap, flux), `build_llms.py`, puis commiter.

## En-têtes de sécurité (CSP)

`_headers` contient une `Content-Security-Policy`. Elle autorise par empreinte (sha256) les deux scripts écrits dans les
pages (`lots.html`, `lotissement-3d.html`) : **si l'un de ces deux scripts change, son empreinte change et le navigateur le
bloque.** `python3 tools/csp_check.py` recalcule les empreintes de toutes les pages et dit si `_headers` est à jour
(code retour 1 sinon, avec les empreintes à coller).

## Blog : couvertures allégées (srcset), polices et CSS critique

`python3 tools/build_blog.py` fabrique les pages du blog (voir son en-tête) ; `--check` ne modifie rien.

- **Couvertures** : dès que des variantes `<nom>-640.avif` et `<nom>-1024.avif` existent à côté de l'image (ex.
  `images-optimized/blog/<slug>/couverture-640.avif`), la page déclare un `srcset` + `sizes` ; sans variantes, l'image
  est servie seule. Fabrication d'une variante (macOS, `avifenc` de Homebrew), à partir de la couverture 1600 x 900 :
  `avifdec couverture.avif /tmp/c.png && sips --resampleWidth 640 /tmp/c.png --out /tmp/c640.png &&
  avifenc -q 38 -s 3 -y 420 -j all /tmp/c640.png couverture-640.avif` (idem en 1024).
- **Polices préchargées** par le blog : constante `BLOG_FONT_PRELOADS` de `build_blog.py` (indépendante de l'accueil).
- **CSS critique** : le blog reprend celui d'`index.html` (`<style data-critical>`) à chaque génération ; après une
  modification à la main du CSS critique des 11 pages, relancer `python3 tools/build_blog.py`.

## Règle de déploiement

Ce dossier ne doit pas être publié : l'ajouter à `.assetsignore` (ligne `tools`).
