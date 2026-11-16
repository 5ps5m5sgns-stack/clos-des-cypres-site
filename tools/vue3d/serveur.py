#!/usr/bin/env python3
"""Serveur local pour essayer le site comme en ligne : /lots sert lots.html, /lotissement-3d sert lotissement-3d.html
(même règle que Cloudflare, « html_handling » automatique). Rien n'est mis en cache.

Usage :  python3 tools/vue3d/serveur.py [port]      puis ouvrir http://127.0.0.1:8766/lots
"""
import functools
import http.server
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p) and os.path.exists(p + ".html"):
            return p + ".html"
        return p

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"http://127.0.0.1:{PORT}/lots  (Ctrl+C pour arrêter)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=str(ROOT))).serve_forever()
