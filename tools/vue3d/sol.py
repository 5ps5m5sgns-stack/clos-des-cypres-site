#!/usr/bin/env python3
"""Fabrique l'image de sol de la vue 3D à partir de tools/vue3d/sol-source.jpg (plan rendu, 3311 x 2341 px).

- Les abords (teinte kaki d'origine) sont éclaircis en prairie sèche claire : le lotissement ressort mieux.
- Les pelouses sont légèrement désaturées.
- Deux fichiers WebP sont écrits dans images-optimized/ (grand écran et mobile).

Les images d'images-optimized/ sont servies avec un cache d'un an : pour changer le rendu, changer VERSION
(nouveau nom de fichier) et reporter ce nom dans lotissement-3d-config.js (bloc « sol ») et lotissement-3d.html (balises preload).

Usage :  ~/.venv-clos-qa/bin/python tools/vue3d/sol.py     (Pillow + numpy)
"""
from pathlib import Path
import numpy as np
from PIL import Image

VERSION = "v2"
HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "images-optimized"
MEADOW = np.array([190.0, 193.0, 152.0])   # teinte cible des abords
REF_LUM = 139.0                            # luminance moyenne des abords dans la source


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def main():
    im = np.asarray(Image.open(HERE / "sol-source.jpg").convert("RGB")).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    green = (g - r) / np.maximum(g, 1.0)          # pelouse : nettement plus de vert que de rouge
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Abords : peu saturés, à peine plus verts que rouges, ni gris (voirie) ni beige (dallages).
    k = smooth(0.16, 0.26, sat) * (1.0 - smooth(0.09, 0.18, green)) * (1.0 - smooth(2.0, 12.0, r - g))
    meadow = MEADOW[None, None, :] * (np.maximum(lum, 1.0) / REF_LUM)[..., None] ** 0.32
    out = im + (meadow - im) * k[..., None]

    # Pelouses : un peu moins saturées.
    lawn = smooth(0.18, 0.28, green)
    out = out + (lum[..., None] - out) * (0.10 * lawn)[..., None]

    res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    res.save(OUT / f"vue3d-sol-{VERSION}-3311.webp", "WEBP", quality=82, method=6)
    small = res.resize((2048, round(2048 * res.height / res.width)), Image.LANCZOS)
    small.save(OUT / f"vue3d-sol-{VERSION}-2048.webp", "WEBP", quality=80, method=6)
    corner = np.asarray(res)[5:60, 5:60].reshape(-1, 3).mean(0).round(1)
    print("écrit :", f"vue3d-sol-{VERSION}-3311.webp", f"vue3d-sol-{VERSION}-2048.webp", "| teinte des abords (coin) :", corner)


if __name__ == "__main__":
    main()
