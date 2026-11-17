#!/usr/bin/env python3
"""Contrôle (lecture seule) de la Content-Security-Policy de _headers par rapport au code des pages.

Vérifie, pour toutes les pages .html (racine et blog) :
  - chaque <script> écrit dans la page (hors données JSON-LD) a son empreinte sha256 dans « script-src » ;
  - chaque <script src="https://..."> vient d'une origine autorisée par « script-src » ;
  - chaque <iframe src="https://..."> vient d'une origine autorisée par « frame-src ».
Affiche les empreintes à coller dans _headers quand elles manquent. Code retour 1 en cas d'écart.

    python3 tools/csp_check.py

Python 3.9, bibliothèque standard uniquement.
"""
import base64
import glob
import hashlib
import os
import re
import sys
from urllib.parse import urlparse

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def policy():
    for line in open(os.path.join(ROOT, "_headers"), encoding="utf-8"):
        m = re.match(r"\s+Content-Security-Policy(?:-Report-Only)?:\s*(.+)$", line)
        if m:
            d = {}
            for part in m.group(1).split(";"):
                bits = part.split()
                if bits:
                    d[bits[0]] = bits[1:]
            return d
    return None


def main():
    pol = policy()
    if pol is None:
        print("Aucune Content-Security-Policy dans _headers.")
        return 1
    script_src = pol.get("script-src", pol.get("default-src", []))
    frame_src = pol.get("frame-src", pol.get("default-src", []))
    pages = sorted(glob.glob(os.path.join(ROOT, "*.html")) + glob.glob(os.path.join(ROOT, "blog", "**", "index.html"), recursive=True))
    bad = 0
    for path in pages:
        rel = os.path.relpath(path, ROOT)
        s = open(path, encoding="utf-8").read()
        for m in re.finditer(r"<script([^>]*)>(.*?)</script>", s, re.S):
            attrs, body = m.group(1), m.group(2)
            src = re.search(r'\bsrc="([^"]+)"', attrs)
            if src:
                u = src.group(1)
                if u.startswith("http") and not any(urlparse(u).netloc == urlparse(o).netloc for o in script_src if o.startswith("http")):
                    print("%s : script externe non autorisé : %s" % (rel, u)); bad += 1
            elif "ld+json" not in attrs:
                h = "'sha256-" + base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest()).decode() + "'"
                if h not in script_src:
                    print("%s : script en ligne sans empreinte dans _headers : %s" % (rel, h)); bad += 1
        for m in re.finditer(r'<iframe[^>]*\bsrc="(https?://[^"]+)"', s):
            if not any(urlparse(m.group(1)).netloc == urlparse(o).netloc for o in frame_src if o.startswith("http")):
                print("%s : cadre externe non autorisé : %s" % (rel, m.group(1))); bad += 1
    print("CSP : %d page(s) contrôlée(s), %s" % (len(pages), "à jour" if not bad else "%d écart(s)" % bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
