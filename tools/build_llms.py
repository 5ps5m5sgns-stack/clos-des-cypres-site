#!/usr/bin/env python3
"""Génère llms.txt (index du site pour les assistants IA) à partir du sitemap, des balises title / meta description
et des catégories des articles (content/blog/*.md).

    python3 tools/build_llms.py        (à relancer après tout nouvel article ou changement de page, puis publier)

Le résumé ne reprend que ce que le site dit déjà : pas de prix, pas de plan, rien qui change sans que le site change."""
import html
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BASE = "https://clos-des-cypres.fr"
DATE_FR = os.environ.get("LLMS_DATE_FR", "11/11/2026")

RESUME = (
    "Lotissement de huit terrains à bâtir, de 500 à 1 133 m², libres de constructeur, avenue du Pilon du Roy, à Biver "
    "(commune de Gardanne, 13120, Bouches-du-Rhône), à environ 25 minutes d'Aix-en-Provence et 30 minutes de Marseille en voiture. "
    "Permis d'aménager n° PA 013 041 22 K0001 délivré ; livraison des terrains viabilisés prévue en mars 2027. "
    "Le plan, la disponibilité et le prix des lots sont communiqués lors d'un échange (06 09 20 45 90, ventes@ponthieu.fr) : "
    "le site ne publie pas les prix. Aménageur : PONTHIEU DH (SIREN 440 312 791), Aix-en-Provence. "
    "Les guides du blog donnent des informations générales, avec leurs sources officielles. "
    f"Dernière mise à jour : {DATE_FR}."
)

CATEGORIES = {
    "acheter-un-terrain": "Acheter un terrain",
    "construire-en-provence": "Construire en Provence",
    "vivre-a-gardanne-biver": "Vivre à Biver",
    "financer-son-projet": "Financer son projet",
    "suivi-du-chantier": "Suivi du chantier",
}
LOTISSEMENT = ["/", "/lots", "/galerie", "/environnement", "/contact"]
TERRAINS = ["/terrain-a-batir-gardanne", "/terrain-a-batir-aix-en-provence", "/terrain-a-batir-marseille", "/terrain-a-batir-provence"]
EDITEUR = ["/mentions-legales", "/confidentialite"]


def page_file(path):
    if path == "/":
        return os.path.join(ROOT, "index.html")
    if path.endswith("/"):
        return os.path.join(ROOT, path.strip("/"), "index.html")
    return os.path.join(ROOT, path.lstrip("/") + ".html")


def meta(path):
    s = open(page_file(path), encoding="utf-8").read()
    t = html.unescape(re.search(r"<title>(.*?)</title>", s, re.S).group(1)).strip()
    t = re.sub(r"\s*[|·–—-]\s*(?:Le )?Clos des Cyprès.*$", "", t).strip()
    d = html.unescape(re.search(r'<meta name="description" content="(.*?)"', s, re.S).group(1)).strip()
    return t, d


def line(path):
    t, d = meta(path)
    return f"- [{t}]({BASE}{path}): {d}"


def category_of(slug):
    md = os.path.join(ROOT, "content", "blog", slug + ".md")
    m = re.search(r"^category:\s*(\S+)\s*$", open(md, encoding="utf-8").read(), re.M)
    return m.group(1)


sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
paths = [u[len(BASE):] or "/" for u in re.findall(r"<loc>([^<]+)</loc>", sitemap)]
posts = [p for p in paths if re.fullmatch(r"/blog/[^/]+/", p)]
by_cat = {}
for p in posts:
    by_cat.setdefault(category_of(p.split("/")[2]), []).append(p)

out = ["# Le Clos des Cyprès", "", "> " + RESUME, "", "## Le lotissement"]
out += [line(p) for p in LOTISSEMENT if p in paths]
out += ["", "## Terrain à bâtir près d'Aix-en-Provence, de Marseille et de Gardanne"]
out += [line(p) for p in TERRAINS if p in paths]
for cat, label in CATEGORIES.items():
    if cat in by_cat:
        out += ["", f"## Blog : {label}"]
        out += [line(p) for p in sorted(by_cat[cat])]
out += ["", "## Éditeur"] + [line(p) for p in EDITEUR if p in paths]
text = "\n".join(out).rstrip() + "\n"
open(os.path.join(ROOT, "llms.txt"), "w", encoding="utf-8").write(text)
print(len(text), "octets,", text.count("\n- ["), "liens,", len(posts), "articles")
