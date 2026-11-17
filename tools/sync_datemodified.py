#!/usr/bin/env python3
"""Aligne « dateModified » (données structurées JSON-LD des pages de la racine) sur le <lastmod> du sitemap.

Pourquoi : la date écrite à la main dans chaque page ne bougeait plus alors que les pages évoluaient (2026-10-06 partout) ;
Google et les assistants IA lisent cette date. La règle est celle de tools/lastmod_check.py : date du dernier commit qui a
touché la page, ou date de modification du fichier s'il est modifié et pas encore commité.
Le blog n'est pas concerné (build_blog.py écrit déjà datePublished / dateModified depuis le texte des articles).

    python3 tools/sync_datemodified.py            écrit les dates qui diffèrent
    python3 tools/sync_datemodified.py --check    n'écrit rien ; code retour 1 s'il y a un écart

À lancer juste avant de commiter les pages, puis `python3 tools/build_blog.py` (sitemap) : les trois dates concordent.
Python 3.9, bibliothèque standard uniquement.
"""
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lastmod_check as lm  # noqa: E402

RE = re.compile(r'("dateModified":\s*")(\d{4}-\d{2}-\d{2})(")')


def main(argv):
    check = "--check" in argv
    bad = 0
    for name in sorted(os.listdir(lm.ROOT)):
        if not name.endswith(".html") or name in ("404.html", "merci.html", "lotissement-3d.html"):
            continue
        path = os.path.join(lm.ROOT, name)
        src = open(path, encoding="utf-8").read()
        if not RE.search(src):
            continue
        want = lm.expected_date(name)
        found = RE.findall(src)
        if all(f[1] == want for f in found):
            continue
        bad += 1
        print("%-40s dateModified %s -> %s" % (name, ",".join(sorted({f[1] for f in found})), want))
        if not check:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(RE.sub(lambda m: m.group(1) + want + m.group(3), src))
    if not bad:
        print("dateModified : à jour")
    return 1 if (bad and check) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
