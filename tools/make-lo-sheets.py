"""Half-resolution copies of every packed sprite sheet for low-end phones.

assets/sd_baked/<key>/sheet_XX.webp -> sheet_XX.lo.webp (scale 0.5; leaders 0.3) plus sheet_lo.json:
  {"scale": 0.5, "sheets": {"sheet_00.webp": {"file": "sheet_00.lo.webp", "sx": lw / w, "sy": lh / h}}}
The game (js/clip-anim.js) loads these when sheetDecodeScale() < 1 and scales the frame
rects by sx / sy (frame.k carries it, so the on-screen size is unchanged).
usage: python tools/make-lo-sheets.py [--force] [keys...]
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sd_baked")
SCALE = 0.5
# Stage leaders (bosses / midbosses / the Commander's bodies) are baked at 768 px but drawn
# ~180 px tall on a phone: their low-end atlases go to 0.3 (their skill clips made 3-5 pages
# each, 16 MB decoded per page at 0.5).
LEADER_SCALE = 0.3
LEADER_PREFIX = ("boss_", "mid_", "final_")


def main():
    force = "--force" in sys.argv
    keys = [a for a in sys.argv[1:] if not a.startswith("--")] or sorted(os.listdir(ROOT))
    total_in = total_out = 0
    for key in keys:
        d = os.path.join(ROOT, key)
        sj = os.path.join(d, "sheet.json")
        if not os.path.isfile(sj):
            continue
        with open(sj, encoding="utf-8") as f:
            sheets = json.load(f).get("sheets") or []
        scale = LEADER_SCALE if key.startswith(LEADER_PREFIX) else SCALE
        out = {"scale": scale, "sheets": {}}
        for rel in sheets:
            src = os.path.join(d, rel)
            if not os.path.isfile(src):
                continue
            base, ext = os.path.splitext(rel)
            lo_rel = f"{base}.lo.webp"
            dst = os.path.join(d, lo_rel)
            with Image.open(src) as im:
                w, h = im.size
                lw, lh = max(1, round(w * scale)), max(1, round(h * scale))
                stale = not os.path.isfile(dst) or os.path.getmtime(dst) < os.path.getmtime(src)
                if not stale:
                    with Image.open(dst) as lo:
                        stale = lo.size != (lw, lh)
                if force or stale:
                    im.convert("RGBA").resize((lw, lh), Image.LANCZOS).save(dst, "WEBP", quality=88, method=5)
            out["sheets"][rel] = {"file": lo_rel, "sx": lw / w, "sy": lh / h}
            total_in += os.path.getsize(src)
            total_out += os.path.getsize(dst)
        with open(os.path.join(d, "sheet_lo.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1)
        print(key, len(out["sheets"]))
    print(f"full {total_in / 1048576:.1f} MB -> lo {total_out / 1048576:.1f} MB")


if __name__ == "__main__":
    main()
