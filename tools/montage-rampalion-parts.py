"""Montage of tools/shot-rampalion-parts.mjs captures: one row per combo, one column per frame.
usage: python tools/montage-rampalion-parts.py [dir]"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

d = Path(sys.argv[1] if len(sys.argv) > 1 else 'work/rampalion-parts')
meta = json.loads((d / 'combos.json').read_text(encoding='utf-8'))
names, frames = meta['combos'], meta['frames']
T = 170
for group, sel in (('single', [n for n in names if not n.startswith('full')]), ('full', [n for n in names if n.startswith('full')])):
    W = Image.new('RGB', (110 + T * len(frames), T * len(sel)), (20, 20, 24))
    dr = ImageDraw.Draw(W)
    for r, n in enumerate(sel):
        dr.text((6, r * T + T // 2), n, fill=(230, 230, 230))
        for c in range(len(frames)):
            p = d / f'{n}_{c}.png'
            if p.exists():
                W.paste(Image.open(p).convert('RGB').resize((T, T)), (110 + c * T, r * T))
    for c, (st, tm) in enumerate(frames):
        dr.text((110 + c * T + 4, 2), f'{st} {tm}', fill=(255, 220, 120))
    W.save(d / f'montage-{group}.png')
    print('saved', d / f'montage-{group}.png')
