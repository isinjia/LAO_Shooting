"""contentBox (idle+move alpha bounds, pad 4) for partial bakes, then pack sheets."""
import json, sys, subprocess
import numpy as np
from PIL import Image
for key in sys.argv[1:]:
    p = f'assets/sd_baked/{key}/anim.json'
    d = json.load(open(p, encoding='utf-8'))
    acc = [9999, 9999, -1, -1]
    for k in ('idle', 'move'):
        for rel in d[k]:
            a = np.array(Image.open(f'assets/sd_baked/{key}/' + rel).convert('RGBA'))[..., 3]
            ys, xs = np.nonzero(a > 8)
            if len(xs):
                acc = [min(acc[0], xs.min()), min(acc[1], ys.min()), max(acc[2], xs.max()), max(acc[3], ys.max())]
    x0, y0 = max(0, acc[0] - 4), max(0, acc[1] - 4)
    x1, y1 = min(767, acc[2] + 4), min(767, acc[3] + 4)
    d['contentBox'] = {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0 + 1), 'h': int(y1 - y0 + 1)}
    json.dump(d, open(p, 'w', encoding='utf-8'), indent=2)
    print(key, d['contentBox'])
subprocess.run([sys.executable, 'tools/pack_sprite_sheets.py', '--keys', ','.join(sys.argv[1:]), '--force'], check=True)
