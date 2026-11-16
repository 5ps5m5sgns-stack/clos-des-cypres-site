#!/usr/bin/env python3
"""Fabrique les images d'aperçu de la vue 3D (celles qu'on voit avant de cliquer « Explorer en 3D » sur /lots,
et le fond de l'écran de chargement de /lotissement-3d).

La scène est photographiée telle qu'elle s'affiche (mode ?capture=1 : sans les panneaux), puis déclinée en AVIF
et WebP dans images-optimized/. Ces images ont un cache d'un an : pour un nouveau rendu, changer VERSION et
reporter le nouveau nom dans lots.html (bloc <picture> de #vue-3d) et dans lotissement-3d.html (#loader).

Usage (Playwright + Pillow, venv ~/.venv-clos-qa) :
    python3 tools/vue3d/serveur.py 8766 &          # sert le dépôt comme en ligne (/lotissement-3d)
    ~/.venv-clos-qa/bin/python tools/vue3d/apercus.py
"""
import io
import sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

VERSION = "v2"
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766"
OUT = Path(__file__).resolve().parent.parent.parent / "images-optimized"
NAME = f"apercu-lotissement-3d-{VERSION}"
ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]


def shoot(browser, width, height):
    page = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2).new_page()
    page.route("**/*", lambda r: r.continue_() if BASE.split("//")[1].split(":")[0] in r.request.url else r.abort())
    page.goto(f"{BASE}/lotissement-3d?capture=1", wait_until="load")
    page.wait_for_function("window.__scene && window.__scene.ready()", timeout=40000)
    page.evaluate("window.__scene.settle()")
    page.wait_for_timeout(900)
    png = page.screenshot()
    page.close()
    return Image.open(io.BytesIO(png)).convert("RGB")


def save(im, stem, width):
    out = im if im.width == width else im.resize((width, round(width * im.height / im.width)), Image.LANCZOS)
    out.save(OUT / f"{stem}.webp", "WEBP", quality=80, method=6)
    out.save(OUT / f"{stem}.avif", "AVIF", quality=55, speed=3)
    print(f"  {stem}  {out.width} x {out.height}  webp {(OUT / (stem + '.webp')).stat().st_size // 1024} Ko, avif {(OUT / (stem + '.avif')).stat().st_size // 1024} Ko")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        wide = shoot(browser, 1120, 630)    # format du cadre sur ordinateur (16/9)
        tall = shoot(browser, 400, 533)     # format du cadre sur téléphone (3/4)
        browser.close()
    save(wide, NAME, 1600)
    save(wide, f"{NAME}-1024", 1024)
    save(wide, f"{NAME}-640", 640)
    save(tall, f"{NAME}-portrait-800", 800)
    save(tall, f"{NAME}-portrait-640", 640)


if __name__ == "__main__":
    main()
