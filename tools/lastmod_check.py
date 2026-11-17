#!/usr/bin/env python3
"""Contrôle (lecture seule) des <lastmod> de sitemap.xml.

N'ÉCRIT RIEN : ni sitemap.xml, ni aucun autre fichier. Le sitemap est tenu à la main
tant que le générateur du blog n'en a pas repris la main.

Règle appliquée : pour chaque page du sitemap, la date attendue est
  - la date du dernier commit qui a touché le fichier source (git log -1 --format=%cs) ;
  - ou, si le fichier est modifié mais pas encore commité, la date de sa dernière
    modification sur disque.
Les URLs propres (sans .html) correspondent aux fichiers x.html du dépôt ; "/" = index.html.

Usage (depuis la racine du dépôt) :
    python3 tools/lastmod_check.py          # affiche le tableau, code retour 1 si écart
"""
import datetime
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def source_file(loc):
    path = re.sub(r"^https?://[^/]+", "", loc).strip("/")
    return "index.html" if path == "" else path + ".html"


def blog_date(loc):
    """Blog : la date vient du texte (champ « updated », sinon « date » de content/blog/<slug>.md), comme dans
    build_blog.py ; pour /blog/, la plus récente de tous les articles. None si le texte est introuvable."""
    slug = re.sub(r"^https?://[^/]+/blog/?", "", loc).strip("/")
    dates = []
    folder = os.path.join(ROOT, "content", "blog")
    for name in ([slug + ".md"] if slug else sorted(os.listdir(folder))):
        path = os.path.join(folder, name)
        if name.startswith("_") or not name.endswith(".md") or not os.path.exists(path):
            continue
        head = open(path, encoding="utf-8").read().split("---")[1]
        if re.search(r"^draft:\s*true\s*$", head, re.M):
            continue
        d = re.search(r"^updated:\s*(\S+)", head, re.M) or re.search(r"^date:\s*(\S+)", head, re.M)
        if d:
            dates.append(d.group(1))
    return max(dates) if dates else None


def expected_date(rel):
    full = os.path.join(ROOT, rel)
    if not os.path.exists(full):
        return None
    def git(*a):
        return subprocess.run(["git", "-C", ROOT] + list(a), capture_output=True, text=True).stdout.strip()
    if git("status", "--porcelain", "--", rel):
        return datetime.date.fromtimestamp(os.path.getmtime(full)).isoformat()
    return git("log", "-1", "--format=%cs", "--", rel) or None


def main():
    shallow = subprocess.run(["git", "-C", ROOT, "rev-parse", "--is-shallow-repository"], capture_output=True, text=True).stdout.strip()
    if shallow == "true":
        print("ATTENTION : dépôt cloné en profondeur partielle (shallow) : toutes les dates de commit sont celles du dernier commit. "
              "Lancer d'abord « git fetch --unshallow ».", file=sys.stderr)
        return 2
    tree = ET.parse(os.path.join(ROOT, "sitemap.xml"))
    bad = 0
    for url in tree.getroot().findall("s:url", NS):
        loc = url.find("s:loc", NS).text
        lm = url.find("s:lastmod", NS)
        have = lm.text if lm is not None else None
        rel = source_file(loc)
        if "/blog/" in loc or loc.rstrip("/").endswith("/blog"):
            rel, want = "content/blog (date / updated)", blog_date(loc)
        else:
            want = expected_date(rel)
        flag = "ok " if have == want else "ECART"
        bad += have != want
        print("%-5s %-58s sitemap=%s attendu=%s (%s)" % (flag, loc, have, want, rel))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
