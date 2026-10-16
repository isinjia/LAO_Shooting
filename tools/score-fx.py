"""Effect-quality score (0-100 per effect) from tools/eval-fx.mjs captures.

Each frame is diffed against the pre-spawn baseline (flat backdrop), so only the effect's
own pixels count. Criteria (weights per category, see WEIGHTS):
  layers   bright core + saturated colour body + soft glow halo all present at the peak
           (peak = brightest frame that is not a full-screen flash)
  soft     share of soft halo pixels at the peak (glow falloff, not hard cut-outs)
  anim     frame-to-frame change over the effect's life (it moves / evolves)
  envelope no pop: fades out (last frame <= 25% of peak); persistent effects exempt
  detail   secondary elements: most separate blobs (sparks / debris / particles) on any visible frame
  read     contrast: mean brightness lift of the effect pixels over the backdrop
  duration visible life within the category's range
usage: python tools/score-fx.py <outDir> [--json out.json]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

WEIGHTS = {
    'burst': dict(layers=25, soft=10, anim=15, envelope=15, detail=15, read=10, duration=10),
    'beam': dict(layers=25, soft=15, anim=15, envelope=15, detail=5, read=15, duration=10),
    'projectile': dict(layers=30, soft=20, anim=10, envelope=0, detail=15, read=25, duration=0),
    'skill': dict(layers=25, soft=10, anim=20, envelope=10, detail=20, read=15, duration=0),
    'ui': dict(layers=15, soft=10, anim=20, envelope=20, detail=10, read=25, duration=0),
}
DUR = {'burst': (0.12, 0.9), 'beam': (0.5, 2.2)}


def load(p):
    return np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)


def lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def sat(a):
    mx = a.max(axis=-1)
    mn = a.min(axis=-1)
    return np.where(mx > 1, (mx - mn) / np.maximum(mx, 1), 0)


def blobs(mask):
    """Connected components (4-neighbour) with >= 4 px; tiny pure-numpy flood fill."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    count = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        size = 0
        while stack:
            y, x = stack.pop()
            size += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if size >= 4:
            count += 1
            if count >= 40:
                return count
    return count


def score(effect, d):
    base = load(d / effect['base'])
    frames = [load(d / f) for f in effect['frames']]
    diffs = [np.abs(f - base).max(axis=-1) for f in frames]
    inten = np.array([float(x[x > 12].sum()) / max(1, x.size) for x in diffs])
    # A full-screen flash frame (most of the region lifted at once) is the screen flash, not
    # the effect body: judge layers / softness on the brightest frame without one.
    cover = np.array([float((x > 12).mean()) for x in diffs])
    body_frames = [i for i in range(len(frames)) if cover[i] < 0.85] or list(range(len(frames)))
    peak_i = max(body_frames, key=lambda i: inten[i])
    peak = float(inten.max())
    w = WEIGHTS[effect['cat']]
    if peak <= 0.01:
        return 0, {'note': 'nothing drawn'}
    f = frames[peak_i]
    dmask = diffs[peak_i]
    mask = dmask > 12
    n = max(1, int(mask.sum()))
    L = lum(f)
    S = sat(f)
    core = float(((L > 225) & (S < 0.3) & mask).sum()) / n
    body = float(((S > 0.35) & (L > 70) & mask).sum()) / n
    halo = float(((dmask > 12) & (dmask < 70)).sum()) / n
    layers = (min(1, core / 0.01) + min(1, body / 0.08) + min(1, halo / 0.15)) / 3
    soft = min(1, halo / 0.3)
    # Animation: mean relative change between consecutive frames while visible.
    ch = []
    for a, b, ia in zip(frames, frames[1:], inten[1:]):
        if ia > peak * 0.05:
            ch.append(float(np.abs(a - b).max(axis=-1).mean()) / max(1e-3, float(peak)))
    anim = min(1, (np.mean(ch) if ch else 0) / 0.15)
    envelope = 1.0 if inten[-1] <= peak * 0.25 else max(0, 1 - (inten[-1] / peak - 0.25) / 0.5)
    # Secondary elements separate a few frames in: count blobs on every visible frame.
    detail = min(1, max(blobs((dd > 12)[::2, ::2]) for dd, ii in zip(diffs, inten) if ii > peak * 0.2) / 4)
    lift = float(dmask[mask].mean())
    read = min(1, lift / 70)
    vis = float((inten > peak * 0.1).sum()) * effect['dt']
    lo, hi = DUR.get(effect['cat'], (0, 99))
    duration = 1.0 if lo <= vis <= hi else max(0, 1 - (abs(vis - (lo if vis < lo else hi)) / max(lo, 0.1)))
    parts = dict(layers=layers, soft=soft, anim=anim, envelope=envelope, detail=detail, read=read, duration=duration)
    total = sum(w[k] * parts[k] for k in w)
    return total, {k: round(v, 2) for k, v in parts.items()} | {'vis': round(vis, 2), 'core': round(core, 3), 'body': round(body, 3), 'halo': round(halo, 3)}


def main():
    d = Path(sys.argv[1])
    m = json.loads((d / 'manifest.json').read_text(encoding='utf-8'))
    rows = []
    for e in m['effects']:
        t, parts = score(e, d)
        rows.append((e['name'], e['cat'], t, parts))
    for name, cat, t, parts in sorted(rows, key=lambda r: r[2]):
        print(f"{name:22s} {cat:10s} {t:5.1f}  {parts}")
    avg = sum(r[2] for r in rows) / max(1, len(rows))
    print(f"FX avg {avg:.1f}  min {min(r[2] for r in rows):.1f}  ({len(rows)} effects)")
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(rows, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
