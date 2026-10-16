"""Pack baked Unity skill clips into native-shots sheets (LRL skill1-clone pattern)."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BAKED = ROOT / "assets" / "sd_baked"
OUT = ROOT / "assets" / "native-shots"

JOBS = [
    # Full original clips at 24fps (controller anim_skill1 / anim_skill2), played by the
    # skill runs (skill-run.js / griffin-skill.js). Written as WebP.
    {"key": "griffin-skill1", "char": "griffin", "clip": "skill1", "cols": 6, "rows": 6,
     "cell": 192, "indices": list(range(36)), "webp": True,
     "source_note": "sd_baked/griffin/native/skill1_000-035.png, Unity attack_hand_missile.anim (anim_skill1), full clip"},
    {"key": "griffin-skill2", "char": "griffin", "clip": "skill2", "cols": 17, "rows": 16,
     "cell": 192, "indices": list(range(262)), "webp": True,
     "source_note": "sd_baked/griffin/native/skill2_000-261.png, Unity attack_hand_missile_skill.anim (anim_skill2), full clip"},
    {"key": "sleipnir-skill1", "char": "sleipnir", "clip": "skill1", "cols": 14, "rows": 14,
     "cell": 256, "fit": True, "indices": list(range(184)), "webp": True,
     "source_note": "sd_baked/sleipnir/native/skill1_000-183.png, Unity Skil_1.anim (anim_skill1), full clip"},
    {"key": "sleipnir-skill2", "char": "sleipnir", "clip": "skill2", "cols": 16, "rows": 15,
     "cell": 256, "fit": True, "indices": list(range(228)), "webp": True,
     "source_note": "sd_baked/sleipnir/native/skill2_000-227.png, Unity Skil_2.anim (anim_skill2), full clip"},
    {"key": "express76-skill1", "char": "express76", "clip": "skill1", "cols": 11, "rows": 10,
     "cell": 256, "fit": True,
     # Frames 61-63: EX_grab swings the ATM toward the camera (huge); the game draws
     # the thrown ATM itself from 2.54s, so keep only the body region there.
     "erase": {"frames": [61, 62, 63], "keep": [330, 320, 870, 830]}, "indices": list(range(102)), "webp": True,
     "source_note": "sd_baked/express76/native/skill1_000-101.png, Unity skill1.anim (anim_skill1), full clip"},
    {"key": "express76-skill2", "char": "express76", "clip": "skill2", "cols": 12, "rows": 12,
     "cell": 192, "indices": list(range(140)), "webp": True,
     "source_note": "sd_baked/express76/native/skill2_000-139.png, Unity skill2.anim (anim_skill2), full clip"},
    # Labiata's giant sword reaches far outside the body box: trimmed atlas pages keep
    # the resolution (a square "fit" cell had to shrink the whole pose ~2x).
    {"key": "labiata-skill1", "char": "labiata", "clip": "skill1", "trim": True, "scale": 0.5,
     "source_note": "sd_baked/labiata/native/skill1_000-147.png, Unity skill1.anim (anim_skill1), full clip"},
    {"key": "labiata-skill2", "char": "labiata", "clip": "skill2", "trim": True, "scale": 0.5,
     "source_note": "sd_baked/labiata/native/skill2_000-275.png, Unity skill2.anim (anim_skill2), full clip"},
    {"key": "constantia-skill1", "char": "constantia", "clip": "skill1", "trim": True, "scale": 0.4,
     "source_note": "sd_baked/constantia/native/skill1_*.png, Unity Attack_01.anim (anim_skill1), full clip"},
    {"key": "constantia-skill2", "char": "constantia", "clip": "skill2", "trim": True, "scale": 0.4,
     "source_note": "sd_baked/constantia/native/skill2_*.png, Unity Attack_02.anim (anim_skill2), full clip"},
    # Bori (FX_hit_bori + fx_Hit_bori.anim, baked as the "bori" pseudo-character).
    {"key": "constantia-bori", "char": "bori", "clip": "skill2", "trim": True, "scale": 0.35,
     "source_note": "sd_baked/bori/native/skill2_*.png, Unity fx_Hit_bori.anim (FX_hit_bori), full clip"},
]


def sample_indices(n: int, want: int, cycle: bool = False) -> list[int]:
    if n <= 0:
        return []
    if cycle:
        return [i % n for i in range(want)]
    if n <= want:
        return list(range(n))
    return [round(i * (n - 1) / (want - 1)) for i in range(want)]


def crop_box(im: Image.Image, box: dict | None) -> Image.Image:
    if not box:
        bbox = im.getbbox()
        if not bbox:
            return im
        return im.crop(bbox)
    x, y, w, h = int(box["x"]), int(box["y"]), int(box["w"]), int(box["h"])
    return im.crop((x, y, x + w, y + h))


def pack_job(job: dict) -> None:
    anim_path = BAKED / job["char"] / "anim.json"
    native = BAKED / job["char"] / "native"
    if not anim_path.exists():
        print(f"skip {job['key']}: no anim.json")
        return
    data = json.loads(anim_path.read_text(encoding="utf-8"))
    frames = data.get(job["clip"]) or []
    if not frames:
        print(f"skip {job['key']}: no {job['clip']} frames")
        return
    want = job["cols"] * job["rows"]
    pool = list(range(len(frames)))
    if job.get("skip_empty"):
        pool = [i for i in pool if Image.open(BAKED / job["char"] / frames[i]).getbbox()]
    idxs = job.get("indices") or [pool[i] for i in sample_indices(len(pool), want, cycle=bool(job.get("cycle")))]
    box = data.get("contentBox")
    if box and job["clip"].startswith("skill") and data.get("skillOffset"):
        # Skill frames are baked on a wider canvas; shift the idle box into it.
        so = int(data["skillOffset"])
        box = {**box, "x": int(box["x"]) + so, "y": int(box["y"]) + so}
    scale = 1.0
    if box and job.get("crop") != "union":
        # Square crop centred on contentBox (side = longer edge). Resizing the
        # non-square box straight into a square cell stretched the pose and made
        # skill frames draw larger than idle/move (which map the long edge to size).
        side = max(int(box["w"]), int(box["h"]))
        cx = int(box["x"]) + int(box["w"]) // 2
        cy = int(box["y"]) + int(box["h"]) // 2
        if job.get("fit"):
            # Widen the square until no frame overflows (props / plane form / ATM);
            # the player draws this clip `scale`x larger so the body keeps idle size.
            over = 0
            er = job.get("erase") or {"frames": []}
            for n in idxs:
                fim = Image.open(BAKED / job["char"] / frames[n])
                if n in er["frames"]:
                    fim = fim.crop(tuple(er["keep"]))
                    bbc = fim.getbbox()
                    bb = (bbc[0] + er["keep"][0], bbc[1] + er["keep"][1], bbc[2] + er["keep"][0],
                          bbc[3] + er["keep"][1]) if bbc else None
                else:
                    bb = fim.getbbox()
                if bb:
                    over = max(over, cx - side // 2 - bb[0], cy - side // 2 - bb[1],
                               bb[2] - (cx - side // 2 + side), bb[3] - (cy - side // 2 + side))
            if over > 0:
                big = side + 2 * (over + 6)
                scale = round(big / side, 3)
                side = big
        box = {"x": cx - side // 2, "y": cy - side // 2, "w": side, "h": side}
    if job.get("crop") == "union":
        # Square box around the union of alpha bounds so props (freight) are not clipped.
        bbs = [Image.open(BAKED / job["char"] / frames[n]).getbbox() for n in idxs]
        bbs = [b for b in bbs if b]
        x0, y0 = min(b[0] for b in bbs), min(b[1] for b in bbs)
        x1, y1 = max(b[2] for b in bbs), max(b[3] for b in bbs)
        side = max(x1 - x0, y1 - y0) + 8
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        box = {"x": cx - side // 2, "y": cy - side // 2, "w": side, "h": side}
    cell = job["cell"]
    sheet = Image.new("RGBA", (job["cols"] * cell, job["rows"] * cell))
    hashes = {}
    for i, n in enumerate(idxs):
        rel = frames[n]
        path = BAKED / job["char"] / rel
        im = Image.open(path).convert("RGBA")
        er = job.get("erase")
        if er and n in er["frames"]:
            kx0, ky0, kx1, ky1 = er["keep"]
            keep = im.crop((kx0, ky0, kx1, ky1))
            im = Image.new("RGBA", im.size)
            im.paste(keep, (kx0, ky0))
        crop = crop_box(im, box).resize((cell, cell), Image.Resampling.LANCZOS)
        sheet.alpha_composite(crop, ((i % job["cols"]) * cell, (i // job["cols"]) * cell))
        hashes[str(n)] = hashlib.sha256(path.read_bytes()).hexdigest()
    if job.get("webp"):
        dest = OUT / f"{job['key']}.webp"
        sheet.save(dest, "WEBP", quality=80, method=6)
        stale = OUT / f"{job['key']}.png"
        if stale.exists():
            stale.unlink()
    else:
        dest = OUT / f"{job['key']}.png"
        sheet.save(dest, optimize=True)
    meta = {
        "source": job["source_note"],
        "frames": idxs,
        "grid": [job["cols"], job["rows"]],
        "cell": cell,
        "sourceHashes": hashes,
        "processing": "contentBox crop + LANCZOS resize; original character art only",
        "drawScale": scale,
    }
    (OUT / f"{job['key']}-source.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(dest, dest.stat().st_size, "drawScale", scale)


ATLAS_JS = ROOT / "js" / "skill-body-atlas.js"


def pack_trim(job: dict) -> None:
    """Per-frame trimmed atlas (like pack_sprite_sheets) at `scale` px per bake px.

    Keeps resolution for clips whose props reach far outside the body box (Labiata's
    giant sword): no square "fit" crop, each frame is trimmed, deduped and shelf-packed
    into <= maxSheet pages. Frames carry ox/oy in the character's bake space (skill
    canvas minus skillOffset), so ClipAnimator draws them anchored to the idle
    contentBox with overflow (body stays idle size, sword may exceed the box).
    """
    anim_path = BAKED / job["char"] / "anim.json"
    data = json.loads(anim_path.read_text(encoding="utf-8"))
    frames = data.get(job["clip"]) or []
    so = int(data.get("skillOffset") or 0)
    f = float(job["scale"])
    max_sheet = int(job.get("maxSheet", 4096))
    pad = 2
    items = []  # (frame index, image, ox, oy)
    seen = {}
    out_frames = []
    # anim.json "skillCamera" (bake_sd_character / skill-camera-and-fx.py): per-frame offset
    # of the body-centred skill camera from the idle camera -> frames land in idle space.
    cam = (data.get("skillCamera") or {}).get(job["clip"]) or []
    base = {}
    for n, rel in enumerate(frames):
        im = Image.open(BAKED / job["char"] / rel).convert("RGBA")
        bb = im.getbbox()
        if not bb:
            out_frames.append(None)
            continue
        crop = im.crop(bb)
        base[n] = (bb[0] - so, bb[1] - so)
        h = hashlib.sha256(crop.tobytes() + bytes(str(bb), "ascii")).hexdigest()
        if h in seen:
            out_frames.append(("dup", seen[h]))
            continue
        w2, h2 = max(1, round(crop.width * f)), max(1, round(crop.height * f))
        items.append((n, crop.resize((w2, h2), Image.Resampling.LANCZOS), bb[0] - so, bb[1] - so))
        seen[h] = n
        out_frames.append(("own", n))
    # Shelf pack, tallest first.
    order = sorted(range(len(items)), key=lambda i: -items[i][1].height)
    pages = [[]]
    x = y = shelf = 0
    place = {}
    for i in order:
        im = items[i][1]
        if x + im.width > max_sheet:
            x, y, shelf = 0, y + shelf + pad, 0
        if y + im.height > max_sheet:
            pages.append([])
            x = y = shelf = 0
        place[items[i][0]] = (len(pages) - 1, x, y, im.width, im.height, items[i][2], items[i][3])
        pages[-1].append((im, x, y))
        x += im.width + pad
        shelf = max(shelf, im.height)
    keys = []
    for pi, page in enumerate(pages):
        pw = max(px + im.width for im, px, py in page)
        ph = max(py + im.height for im, px, py in page)
        sheet = Image.new("RGBA", (pw, ph))
        for im, px, py in page:
            sheet.alpha_composite(im, (px, py))
        key = f"{job['key']}-{pi}"
        dest = OUT / f"{key}.webp"
        sheet.save(dest, "WEBP", quality=86, method=6)
        keys.append(key)
        print(dest, sheet.size, dest.stat().st_size)
    rects = []
    for n, entry in enumerate(out_frames):
        if entry is None:
            rects.append(None)
            continue
        pg, px, py, w, h, ox, oy = place[entry[1]]
        ox, oy = base[n]
        if n < len(cam):
            ox, oy = round(ox + cam[n][0], 1), round(oy + cam[n][1], 1)
        rects.append([pg, px, py, w, h, ox, oy])
    meta = {"source": job["source_note"], "scale": f, "pages": keys, "frames": rects,
            "processing": "per-frame trim + LANCZOS resize + dedupe; original character art only"}
    (OUT / f"{job['key']}-source.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    # Generated module read by player.js (frame rects for the trimmed skill atlases).
    atlas = {}
    if ATLAS_JS.exists():
        txt = ATLAS_JS.read_text(encoding="utf-8")
        atlas = json.loads(txt[txt.index("= {") + 2: txt.rindex("}") + 1])
    atlas[job["key"]] = {"k": f, "pages": keys, "frames": rects}
    ATLAS_JS.write_text(
        "// Generated by tools/import-skill-body-sheets.py (trim jobs). Do not edit.\n"
        "// key -> { k: atlas px per bake px, pages: native-shots keys,\n"
        "//         frames: [page, x, y, w, h, ox, oy] in bake space (null = empty) }\n"
        "export const SKILL_ATLAS = " + json.dumps(atlas, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(job["key"], "frames", len(rects), "unique", len(items), "pages", len(keys))


if __name__ == "__main__":
    import sys

    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])  # optional: sheet keys to rebuild
    for job in JOBS:
        if not only or job["key"] in only:
            (pack_trim if job.get("trim") else pack_job)(job)
