"""Recolour the yellow eye sparkle on LRL's Skill2 frames 17-26 (her bomb's beam pose) red.

The bomb (js/lrl-skill.js) draws its own red eye glow and beam, so the baked yellow
sparkle over her right eye clashes. Frame 16 (the big yellow star) is simply not used.
Writes assets/native-shots/lrl-skill2-clean.png (same 6x6 grid of 192 px cells);
the original sheet stays untouched.

usage: python tools/clean-lrl-skill2-eye.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "native-shots" / "lrl-skill2.png"
OUT = ROOT / "assets" / "native-shots" / "lrl-skill2-clean.png"
CELL = 192
FRAMES = range(17, 27)
# Right-eye area of the beam pose (cell px): keeps the left eye / hat ornament out.
X0, X1, Y0, Y1 = 104, 160, 30, 96


def main() -> None:
    im = np.array(Image.open(SRC).convert("RGBA"))
    for f in FRAMES:
        ox, oy = (f % 6) * CELL, (f // 6) * CELL
        cell = im[oy:oy + CELL, ox:ox + CELL].copy()
        r, g, b, a = (cell[..., i].astype(int) for i in range(4))
        sparkle = (a > 20) & (r > 200) & (g > 175) & (b < 170) & (r - b > 70)
        region = np.zeros_like(sparkle)
        region[Y0:Y1, X0:X1] = True
        mask = (sparkle & region).astype(np.uint8)
        # Her other (normal amber) eye can fall inside the box: keep only the glowing eye,
        # i.e. the rightmost blob plus anything attached to its sparkle rays.
        n, labels, stats, cent = cv2.connectedComponentsWithStats(mask, connectivity=8)
        blobs = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 4]
        right = max((cent[i][0] for i in blobs), default=0)
        keep = [i for i in blobs if cent[i][0] >= right - 12]
        m = np.isin(labels, keep)
        # Soft yellow fringe around the kept sparkle.
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2) > 0
        m |= near & (a > 20) & (r > 170) & (g > 120) & (b < 150) & (r - b > 60)
        # Recolour to the bomb's red eye glow (keeps the authored sparkle shape and
        # brightness): white-hot core -> red edge.
        rgb = cell[..., :3].astype(float)
        v = rgb.max(axis=2) / 255.0
        hot = np.clip((rgb[..., 2] - 60) / 120.0, 0, 1)  # bluer = whiter core in the source
        red = np.stack([255 * v, 255 * v * (0.18 + 0.6 * hot), 255 * v * (0.14 + 0.55 * hot)], axis=2)
        cell[..., :3][m] = np.clip(red, 0, 255).astype(np.uint8)[m]
        im[oy:oy + CELL, ox:ox + CELL] = cell
        print(f"frame {f}: recoloured {int(m.sum())} px")
    Image.fromarray(im).save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
