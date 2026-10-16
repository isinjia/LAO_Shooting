"""Side-by-side: a monster's original texture atlas(es) next to baked idle / move frames,
to spot parts the sprite baker dropped (e.g. skinned sprite meshes).
usage: python tools/check-monster-bake.py <out.png> key [key ...]"""
import os, sys, re
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
src = open(os.path.join(os.path.dirname(__file__), 'bake_monster_sprites.py'), encoding='utf-8').read()
ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sd_baked')
MODEL = r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets\AssetBundleResourceSub\Character"
out, keys = sys.argv[1], sys.argv[2:]
rows = []
for k in keys:
    m = re.search(r'"%s": \{\s*"model": MONSTER_MODEL_ROOT / "([^"]+)"' % re.escape(k), src)
    row = Image.new('RGBA', (1200, 300), (40, 44, 52, 255))
    d = ImageDraw.Draw(row)
    d.text((6, 4), k, fill=(255, 255, 0, 255))
    x = 0
    if m:
        for dp, _, fs in os.walk(os.path.join(MODEL, m.group(1))):
            for f in fs:
                if f.lower().endswith('.png') and x < 600:
                    t = Image.open(os.path.join(dp, f)).convert('RGBA'); t.thumbnail((280, 280))
                    row.alpha_composite(t, (x, 18)); x += 290
    nd = os.path.join(ROOT, k, 'native')
    if os.path.isdir(nd):
        fs = sorted(os.listdir(nd))
        pick = [f for f in fs if f.startswith('idle')][:1] + [f for f in fs if f.startswith('move')][:1] + [f for f in fs if f.startswith('die')][:1]
        for i, f in enumerate(pick):
            im = Image.open(os.path.join(nd, f)).convert('RGBA').resize((200, 200))
            row.alpha_composite(im, (600 + i * 200, 50))
    rows.append(row)
sheet = Image.new('RGBA', (1200, 300 * len(rows)))
for i, r in enumerate(rows): sheet.paste(r, (0, i * 300))
sheet.save(out)
