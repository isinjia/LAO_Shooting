"""Cut Express 76 Skill1 props from the original model atlas (Model_PECS_Express76_Part2.png).

The skill1.anim grab rig (EX_grab/EX_atm) hauls EX_parts_atm, swaps to
EX_parts_atm_broken_grab at the slam (2.78s) and pops EX_money_1_*/2_* banknotes.
Components are found by alpha islands in the atlas (largest first):
  atm (intact), atmbroken, moneystack, bill. Writes assets/native-shots/express76-prop-*.png.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ATLAS = Path(r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_PECS_Express76_N"
             r"\Model_PECS_Express76_N\materials\Model_PECS_Express76_Part2.png")
OUT = ROOT / "assets" / "native-shots"


def main() -> None:
    im = Image.open(ATLAS).convert("RGBA")
    a = np.asarray(im)[..., 3]
    mask = cv2.dilate((a > 8).astype(np.uint8), np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    boxes = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area > 2000:
            boxes.append((x, y, w, h))
    # Atlas layout: banknotes top-left (stack then single), I-beam, ATM row, car at bottom.
    boxes.sort(key=lambda b: (b[1] // 200, b[0]))
    named = {}
    for x, y, w, h in boxes:
        cx, cy = x + w / 2, y + h / 2
        if cy < 250:
            named["moneystack" if cx < 300 else "bill"] = (x, y, w, h)
        elif 600 < cy < 1400:
            named["atm" if cx < 600 else "atmbroken"] = (x, y, w, h)
    meta = {}
    for key, (x, y, w, h) in named.items():
        crop = im.crop((x, y, x + w, y + h))
        scale = 256 / max(w, h)
        crop = crop.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)
        dest = OUT / f"express76-prop-{key}.png"
        crop.save(dest, optimize=True)
        meta[key] = {"atlasRect": [int(x), int(y), int(w), int(h)], "size": list(crop.size)}
        print(dest.name, crop.size, (x, y, w, h))
    (OUT / "express76-prop-source.json").write_text(json.dumps({
        "source": str(ATLAS), "sha256": hashlib.sha256(ATLAS.read_bytes()).hexdigest(),
        "processing": "alpha-island crop + resize (long edge 256); original art only", "props": meta,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
