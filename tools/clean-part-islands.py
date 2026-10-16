"""Remove stray fragments from parts-only bakes (Rampalion graft parts).

Mesh-based partners leave tiny detached slivers (neighbouring atlas islands, cut seams).
For every native frame, alpha islands smaller than MIN_FRAC of the largest island are
cleared. Then re-pack: python tools/pack_sprite_sheets.py --keys <key> --force
usage: python tools/clean-part-islands.py <key> [<key> ...] [--min-frac 0.06]
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'sd_baked'


def clean(key: str, min_frac: float) -> tuple[int, int]:
    frames = sorted((ROOT / key / 'native').glob('*.png'))
    removed = 0
    for f in frames:
        im = np.array(Image.open(f).convert('RGBA'))
        mask = (im[:, :, 3] > 20).astype(np.uint8)
        n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        if n <= 2:
            continue
        areas = stats[1:, cv2.CC_STAT_AREA]
        keep_min = areas.max() * min_frac
        for i, a in enumerate(areas, start=1):
            if a < keep_min:
                im[labels == i, 3] = 0
                removed += 1
        # Faint halo pixels left around cleared islands.
        Image.fromarray(im).save(f)
    if frames:
        Image.open(frames[0]).save(ROOT / key / 'preview.png')
    return len(frames), removed


if __name__ == '__main__':
    args = sys.argv[1:]
    frac = 0.06
    if '--min-frac' in args:
        i = args.index('--min-frac')
        frac = float(args[i + 1])
        del args[i:i + 2]
    for k in args:
        n, r = clean(k, frac)
        print(f'{k}: {n} frames, {r} stray islands cleared')
