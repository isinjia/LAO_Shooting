"""Sprite integrity check (user: nothing may be cut off or drawn at the wrong depth).

For every baked unit (assets/sd_baked/<key>, packed sheet.json):
  bake-edge   a frame's art touches the edge of its bake canvas (the camera cut it off):
              idle / move canvas [0, size], skill clips [-skillOffset, size + skillOffset],
              die [-dieOffset, size + dieOffset]
  box-crop    idle / move art outside the shared contentBox - ClipAnimator.draw crops those
              states to the box at runtime, so it is cut on screen (attack / skill2 / die and
              rects marked overflow draw whole)
For every FX sheet with a grid in js/run-fx.js SHEETS / js/hit-fx.js GRID, and every
fixed-cell skill body sheet (tools/import-skill-body-sheets.py JOBS without "trim"):
  cell-edge   art on a cell border (the neighbour frame bleeds in / the pose is cut)
Only keys the game can load are checked (sheet.json present / grid listed).
Score = 100 x (checked items without an issue / checked items).
usage: python tools/check-sprite-integrity.py [--json out.json] [--keys a,b]
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BAKED = ROOT / "assets" / "sd_baked"
SHOTS = ROOT / "assets" / "native-shots"
ALPHA = 40          # pixel counts as art above this alpha
EDGE_PX = 3         # art pixels on an edge line before it counts as touching
BOX_PX = 12         # art pixels outside the box before it counts as cut
# One-shot body clips baked as 'idle' that the game draws whole (ClipAnimator.drawWhole,
# player.js setAltForm): no box crop for them.
DRAW_WHOLE = {"peregrinus_change", "peregrinus_revert", "peregrinus_hskill2", "peregrinus_bskill2"}

issues = []
checked = 0


def note(kind, key, detail):
    issues.append({"kind": kind, "key": key, "detail": detail})


def opaque_count(im):
    a = im.getchannel("A")
    return sum(1 for v in a.getdata() if v > ALPHA)


def check_unit(key):
    global checked
    d = BAKED / key
    sj = json.loads((d / "sheet.json").read_text(encoding="utf-8"))
    aj = json.loads((d / "anim.json").read_text(encoding="utf-8")) if (d / "anim.json").exists() else {}
    size = aj.get("size") or 768
    skill_off = aj.get("skillOffset") or 0
    die_off = aj.get("dieOffset") or 0
    box = sj.get("contentBox") or aj.get("contentBox")
    sheets = [Image.open(d / s).convert("RGBA") for s in sj["sheets"]]
    bad_edge = {}
    bad_box = {}
    for clip in ("idle", "move", "die", "skill1", "skill2"):
        rects = sj.get(clip) or []
        if not rects:
            continue
        checked += 1
        off = skill_off if clip.startswith("skill") else die_off if clip == "die" else 0
        lo, hi = -off, size + off
        for i, r in enumerate(rects):
            k = r.get("k", 1) or 1
            x0, y0 = r["ox"], r["oy"]
            x1, y1 = x0 + r["w"] / k, y0 + r["h"] / k
            im = sheets[r["s"]].crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
            w, h = im.size
            # bake-edge: the trimmed rect sits on the canvas edge and has art on that line
            sides = []
            if x0 <= lo + 1 and opaque_count(im.crop((0, 0, 1, h))) >= EDGE_PX:
                sides.append("left")
            if x1 >= hi - 1 and opaque_count(im.crop((w - 1, 0, w, h))) >= EDGE_PX:
                sides.append("right")
            if y0 <= lo + 1 and opaque_count(im.crop((0, 0, w, 1))) >= EDGE_PX:
                sides.append("top")
            if y1 >= hi - 1 and opaque_count(im.crop((0, h - 1, w, h))) >= EDGE_PX:
                sides.append("bottom")
            if sides:
                bad_edge.setdefault(clip, []).append((i, sides))
            # box-crop: idle / move only (other states draw whole)
            if box and clip in ("idle", "move") and not r.get("overflow") and key not in DRAW_WHOLE:
                bx0 = (box["x"] - x0) * k
                by0 = (box["y"] - y0) * k
                bx1 = (box["x"] + box["w"] - x0) * k
                by1 = (box["y"] + box["h"] - y0) * k
                out = 0
                if bx0 > 0:
                    out += opaque_count(im.crop((0, 0, min(w, int(bx0)), h)))
                if bx1 < w:
                    out += opaque_count(im.crop((max(0, int(bx1)), 0, w, h)))
                if by0 > 0:
                    out += opaque_count(im.crop((0, 0, w, min(h, int(by0)))))
                if by1 < h:
                    out += opaque_count(im.crop((0, max(0, int(by1)), w, h)))
                if out >= BOX_PX:
                    bad_box.setdefault(clip, []).append((i, out))
    for clip, fr in bad_edge.items():
        note("bake-edge", key, f"{clip}: {len(fr)} frames, e.g. #{fr[0][0]} {fr[0][1]}")
    for clip, fr in bad_box.items():
        worst = max(fr, key=lambda x: x[1])
        note("box-crop", key, f"{clip}: {len(fr)} frames cut by the contentBox, worst #{worst[0]} {worst[1]} px")


def check_native_only(key):
    """Units without a packed sheet (frames loaded one by one): bake-edge on each PNG."""
    global checked
    d = BAKED / key
    aj = json.loads((d / "anim.json").read_text(encoding="utf-8")) if (d / "anim.json").exists() else {}
    for clip in ("idle", "move", "die", "skill1", "skill2"):
        frames = aj.get(clip) or []
        if not isinstance(frames, list) or not frames:
            continue
        checked += 1
        bad = []
        for i, rel in enumerate(frames):
            fp = d / rel
            if not fp.exists():
                continue
            im = Image.open(fp).convert("RGBA")
            w, h = im.size
            sides = [n for n, b in (("left", (0, 0, 1, h)), ("right", (w - 1, 0, w, h)),
                                    ("top", (0, 0, w, 1)), ("bottom", (0, h - 1, w, h)))
                     if opaque_count(im.crop(b)) >= EDGE_PX]
            if sides:
                bad.append((i, sides))
        if bad:
            note("bake-edge", key, f"{clip}: {len(bad)} frames, e.g. #{bad[0][0]} {bad[0][1]}")


def js_grids():
    """key -> (cols, cellW, cellH, frames) from run-fx.js SHEETS and hit-fx.js GRID."""
    grids = {}
    src = (ROOT / "js" / "run-fx.js").read_text(encoding="utf-8")
    for m in re.finditer(r"'([\w-]+)':\s*\{\s*cols:\s*(\d+),\s*cell:\s*(\d+),\s*n:\s*(\d+)", src):
        grids[m.group(1)] = (int(m.group(2)), int(m.group(3)), int(m.group(3)), int(m.group(4)))
    src = (ROOT / "js" / "hit-fx.js").read_text(encoding="utf-8")
    for m in re.finditer(r"'([\w-]+)':\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]", src):
        grids.setdefault(m.group(1), (int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5))))
    return grids


def skill_body_grids():
    """Fixed-cell skill body sheets (griffin-skill1 ...): key -> (cols, cell, cell, frames)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("isb", ROOT / "tools" / "import-skill-body-sheets.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    out = {}
    for job in mod.JOBS:
        if job.get("trim"):
            continue
        n = len(job.get("indices") or []) or job["cols"] * job["rows"]
        out[job["key"]] = (job["cols"], job["cell"], job["cell"], n)
    return out


def check_fx(key, grid):
    global checked
    p = SHOTS / f"{key}.webp"
    if not p.exists():
        p = SHOTS / f"{key}.png"
    if not p.exists():
        note("missing", key, "FX sheet file not found")
        return
    checked += 1
    im = Image.open(p).convert("RGBA")
    cols, cw, ch, n = grid
    if im.width < cols * cw * 0.98:
        # lo-res copy / different scale: rescale the grid to the file
        s = im.width / (cols * cw)
        cw, ch = cw * s, ch * s
    bad = []
    for f in range(n):
        x0 = (f % cols) * cw
        y0 = (f // cols) * ch
        cell = im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch)))
        w, h = cell.size
        if w < 3 or h < 3:
            continue
        sides = []
        for name, box in (("left", (0, 0, 1, h)), ("right", (w - 1, 0, w, h)),
                          ("top", (0, 0, w, 1)), ("bottom", (0, h - 1, w, h))):
            if opaque_count(cell.crop(box)) >= max(EDGE_PX, int(0.04 * (h if name in ("left", "right") else w))):
                sides.append(name)
        if sides:
            bad.append((f, sides))
    if bad:
        note("cell-edge", key, f"{len(bad)}/{n} cells touch their border, e.g. #{bad[0][0]} {bad[0][1]}")


def main():
    only = None
    if "--keys" in sys.argv:
        only = set(sys.argv[sys.argv.index("--keys") + 1].split(","))
    for d in sorted(BAKED.iterdir()):
        if not d.is_dir() or (only and d.name not in only):
            continue
        if (d / "sheet.json").exists():
            check_unit(d.name)
        elif (d / "anim.json").exists():
            check_native_only(d.name)
    for key, grid in sorted({**js_grids(), **skill_body_grids()}.items()):
        if not only or key in only:
            check_fx(key, grid)
    by = {}
    for it in issues:
        by.setdefault(it["kind"], []).append(it)
    for kind, lst in by.items():
        print(f"== {kind}: {len(lst)}")
        for it in lst:
            print(f"  {it['key']:24} {it['detail']}")
    bad_items = len({(i['kind'], i['key'], i['detail'].split(':')[0]) for i in issues})
    score = 100 * (1 - bad_items / max(1, checked))
    print(f"checked {checked} items, {bad_items} with issues  => INTEGRITY {score:.1f}")
    if "--json" in sys.argv:
        Path(sys.argv[sys.argv.index("--json") + 1]).write_text(json.dumps({"score": score, "issues": issues}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
