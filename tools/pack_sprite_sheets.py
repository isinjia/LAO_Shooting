#!/usr/bin/env python3
"""
Pack sd_baked idle/move/die frames into per-character sprite sheets.

Writes:
  assets/sd_baked/<key>/sheet.json
  assets/sd_baked/<key>/sheet_00.webp (or .png with --format png)

Does not delete native/*.png (loader keeps per-frame fallback).
Usage:
  python tools/pack_sprite_sheets.py
  python tools/pack_sprite_sheets.py --keys hirume,wasp --force
  python tools/pack_sprite_sheets.py --force --format webp --quality 78
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BAKED = ROOT / "assets" / "sd_baked"
MAX_SHEET = 4096
CLIP_KEYS = ("idle", "move", "die")
ALL_CLIPS = CLIP_KEYS + ("skill1", "skill2")
SKILL_STEP = 2
SKILL_PRE = 1.0
SKILL_POST = 1.8
PAD = 1  # pixel gap between packed rects
TRIM_PAD = 1  # keep 1px alpha border after bbox trim
# Extra trim padding for characters whose silhouette has thin protrusions
# (Emily bunny-ear / railgun / hover glow) so shelf-trim + lossy WebP
# doesn't nibble those edges. Other keys keep the default.
TRIM_PAD_BY_KEY = {
    "emily": 3,
}


def die_list(data: dict) -> list:
    return data.get("die") or data.get("Die") or []


def collect_rel_paths(data: dict) -> dict[str, list[str]]:
    return {
        "idle": list(data.get("idle") or []),
        "move": list(data.get("move") or []),
        "die": list(die_list(data)),
        # Leader skill clips (anim.json "sheetSkills"): played by the boss attack routines.
        "skill1": list(data.get("skill1") or []) if data.get("sheetSkills") else [],
        "skill2": list(data.get("skill2") or []) if data.get("sheetSkills") else [],
    }


# Clips whose art flies off the bake canvas (Triton's skill_2 missiles leave through the top,
# Sleipnir is flung high off the 6x die canvas, Peregrinus' bird dive exits right):
# fade the art out over this many px before each canvas edge, so it vanishes instead of
# being cut by a hard line (tools/check-sprite-integrity.py bake-edge).
EDGE_FEATHER = {"mid_triton": {"skill2": 120}, "sleipnir": {"die": 160},
                "peregrinus_bskill2": {"idle": 140, "move": 140}}


def feather_edges(img, px):
    """Alpha x a 0..1 ramp over the outer `px` pixels of the canvas (all four edges)."""
    import numpy as np
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    ys = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    xs = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    ramp = np.clip(np.minimum(ys, xs) / float(px), 0.0, 1.0)
    a[..., 3] *= ramp
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def trim_bounds(im: Image.Image, pad: int = TRIM_PAD) -> tuple[int, int, int, int]:
    """Original-frame coordinates of the packed crop."""
    bbox = im.getbbox()
    if not bbox:
        return (0, 0, 1, 1)
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
    return (x0, y0, x1, y1)


def trim_rgba(im: Image.Image, pad: int = TRIM_PAD) -> Image.Image:
    """Crop transparent margins; keep a tiny pad so filtering doesn't clip."""
    return im.crop(trim_bounds(im, pad))


def shelf_pack(
    sizes: list[tuple[int, int]],
    max_size: int = MAX_SHEET,
    pad: int = PAD,
) -> tuple[list[tuple[int, int, int, int, int]], list[tuple[int, int]]]:
    """
    Shelf pack rectangles.
    Returns (placements, sheet_sizes) where placement is (sheet, x, y, w, h).
    """
    placements: list[tuple[int, int, int, int, int]] = []
    sheets: list[tuple[int, int]] = []

    sheet_i = 0
    shelf_y = 0
    shelf_h = 0
    cursor_x = 0
    sheet_w = 0
    sheet_h = 0

    def new_sheet() -> None:
        nonlocal sheet_i, shelf_y, shelf_h, cursor_x, sheet_w, sheet_h
        if sheet_w or sheet_h:
            sheets.append((max(1, sheet_w), max(1, sheet_h)))
            sheet_i += 1
        shelf_y = 0
        shelf_h = 0
        cursor_x = 0
        sheet_w = 0
        sheet_h = 0

    for w, h in sizes:
        if w > max_size or h > max_size:
            raise RuntimeError(f"frame {w}x{h} exceeds max sheet {max_size}")

        # New shelf if this row can't fit the width
        if cursor_x > 0 and cursor_x + w > max_size:
            shelf_y += shelf_h + pad
            cursor_x = 0
            shelf_h = 0

        # New sheet if vertical space is gone
        if shelf_y + h > max_size:
            new_sheet()

        x, y = cursor_x, shelf_y
        placements.append((sheet_i, x, y, w, h))
        cursor_x = x + w + pad
        shelf_h = max(shelf_h, h)
        sheet_w = max(sheet_w, cursor_x - pad)
        sheet_h = max(sheet_h, shelf_y + shelf_h)

    if sheet_w or sheet_h or placements:
        sheets.append((max(1, sheet_w), max(1, sheet_h)))

    return placements, sheets


def pack_character(
    key: str,
    force: bool = False,
    fmt: str = "webp",
    quality: int = 78,
) -> dict:
    base = BAKED / key
    anim_path = base / "anim.json"
    if not anim_path.exists():
        raise FileNotFoundError(f"missing {anim_path}")

    out_json = base / "sheet.json"
    if out_json.exists() and not force:
        meta = json.loads(out_json.read_text(encoding="utf-8"))
        return {
            "key": key,
            "skipped": True,
            "frames": meta.get("frameCount", 0),
            "sheets": len(meta.get("sheets") or []),
            "bytes": sum(
                (base / s).stat().st_size
                for s in (meta.get("sheets") or [])
                if (base / s).exists()
            ),
        }

    data = json.loads(anim_path.read_text(encoding="utf-8"))
    clips = collect_rel_paths(data)
    ordered: list[tuple[str, str]] = []
    # Skill clips keep every SKILL_STEP-th frame (leaders are drawn small; halves the bytes).
    # Long skill clips (10 s ultimates) keep only a window around the release frame:
    # SKILL_PRE s before it, SKILL_POST s after.
    skill_from = {}
    for clip in ALL_CLIPS:
        step = SKILL_STEP if clip.startswith("skill") else 1
        lo, hi = 0, len(clips[clip])
        if clip.startswith("skill") and data.get(clip + "HitTime") is not None:
            fps = data.get(clip + "Fps") or 24
            hit = float(data[clip + "HitTime"])
            lo = max(0, int((hit - SKILL_PRE) * fps))
            lo -= lo % step
            hi = min(hi, int((hit + SKILL_POST) * fps) + 1)
        skill_from[clip] = lo
        for n, rel in enumerate(clips[clip]):
            if lo <= n < hi and (n - lo) % step == 0:
                ordered.append((clip, rel, n))

    if not ordered:
        raise RuntimeError(f"{key}: no idle/move/die frames")

    trim_pad = TRIM_PAD_BY_KEY.get(key, TRIM_PAD)
    feather = EDGE_FEATHER.get(key, {})
    # Die frames may be baked on a larger canvas (bake_sd_character DIE_CANVAS_SCALE);
    # shift their origins back into the shared idle/move coordinate space.
    die_off = int(data.get("dieOffset") or 0)
    # idle / move baked on a wider canvas at the same scale (bake loco_canvas_scale).
    loco_off = int(data.get("locoOffset") or 0)
    # Skill frames: body-centred on a wider canvas; skillOffset + per-frame skillCamera put
    # them back in idle space (same as import-skill-body-sheets.py).
    skill_off = int(data.get("skillOffset") or 0)
    skill_cam = data.get("skillCamera") or {}
    images: list[Image.Image] = []
    origins: list[tuple[int, int]] = []
    for clip, rel, n in ordered:
        fp = base / rel
        if not fp.exists():
            raise FileNotFoundError(fp)
        img = Image.open(fp).convert("RGBA")
        if clip in feather:
            img = feather_edges(img, feather[clip])
        x0, y0, _, _ = trim_bounds(img, trim_pad)
        if clip.startswith("skill"):
            # Leader skill clips (sheetSkills) drop the root motion: the body stays on the
            # leader's hit point (lunges / dives used to carry the art off its hitbox).
            cam = [] if data.get("sheetSkills") else (skill_cam.get(clip) or [])
            dx, dy = (cam[n] if n < len(cam) else (0, 0))
            origins.append((round(x0 - skill_off + dx, 1), round(y0 - skill_off + dy, 1)))
        else:
            off = die_off if clip == "die" else loco_off if clip in ("idle", "move") else 0
            origins.append((x0 - off, y0 - off))
        images.append(trim_rgba(img, trim_pad))
        img.close()

    sizes = [(im.width, im.height) for im in images]
    # Uniform cell (legacy-friendly metrics) = max trimmed frame
    cell_w = max(w for w, _h in sizes)
    cell_h = max(h for _w, h in sizes)

    placements, sheet_dims = shelf_pack(sizes, MAX_SHEET, PAD)

    # Remove previous sheets (png + webp)
    for old in base.glob("sheet_*.png"):
        old.unlink()
    for old in base.glob("sheet_*.webp"):
        old.unlink()

    ext = "webp" if fmt == "webp" else "png"
    atlases: list[Image.Image] = [
        Image.new("RGBA", (sw, sh), (0, 0, 0, 0)) for sw, sh in sheet_dims
    ]
    frames_by_clip: dict[str, list[dict]] = {c: [] for c in ALL_CLIPS}

    for i, ((si, x, y, w, h), im) in enumerate(zip(placements, images)):
        # Copy RGBA pixels directly. Using the sprite's alpha as an extra paste
        # mask squares the alpha and makes translucent wings/hair disappear.
        atlases[si].paste(im, (x, y))
        clip, _rel, _n = ordered[i]
        ox, oy = origins[i]
        frames_by_clip[clip].append({"s": si, "x": x, "y": y, "w": w, "h": h, "ox": ox, "oy": oy})

    sheets: list[str] = []
    total_bytes = 0
    for si, atlas in enumerate(atlases):
        name = f"sheet_{si:02d}.{ext}"
        out = base / name
        if ext == "webp":
            atlas.save(out, "WEBP", quality=quality, method=4, lossless=False)
        else:
            atlas.save(out, optimize=True)
        total_bytes += out.stat().st_size
        sheets.append(name)
        atlas.close()

    for im in images:
        im.close()

    content_box = data.get("contentBox")
    meta = {
        "version": 2,
        "character": key,
        "source": "pack_sprite_sheets.py",
        "format": ext,
        "pack": "shelf-trim",
        "cell": {"w": cell_w, "h": cell_h},
        "maxSheet": MAX_SHEET,
        "pad": PAD,
        "trimPad": trim_pad,
        "sheets": sheets,
        "frameCount": len(ordered),
        "idleFps": data.get("idleFps") or 24,
        "moveFps": data.get("moveFps") or 24,
        "dieFps": data.get("dieFps") or 24,
        "attackFps": data.get("skill1Fps") or data.get("attackFps") or 24,
        "skill2Fps": data.get("skill2Fps") or data.get("skill1Fps") or data.get("attackFps") or 24,
        "idle": frames_by_clip["idle"],
        "move": frames_by_clip["move"],
        "die": frames_by_clip["die"],
    }
    for clip in ("skill1", "skill2"):
        if frames_by_clip[clip]:
            meta[clip] = frames_by_clip[clip]
            meta[clip + "Fps"] = (data.get(clip + "Fps") or 24) / SKILL_STEP
            if data.get(clip + "HitTime") is not None:
                fps = data.get(clip + "Fps") or 24
                meta[clip + "HitTime"] = round(float(data[clip + "HitTime"]) - skill_from[clip] / fps, 4)
    if (
        isinstance(content_box, dict)
        and all(k in content_box for k in ("x", "y", "w", "h"))
    ):
        meta["contentBox"] = content_box

    # Mark anim.json so tooling can see sheet preference (loader also probes sheet.json).
    data["sheet"] = "sheet.json"
    data["sheetFrames"] = len(ordered)
    data["sheetFiles"] = sheets
    data["sheetFormat"] = ext
    anim_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {
        "key": key,
        "skipped": False,
        "frames": len(ordered),
        "sheets": len(sheets),
        "cell": [cell_w, cell_h],
        "format": ext,
        "bytes": total_bytes,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", default="", help="comma-separated character keys")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--format", choices=("webp", "png"), default="webp")
    ap.add_argument("--quality", type=int, default=78, help="WebP quality 1-100")
    args = ap.parse_args()

    if args.keys.strip():
        keys = [k.strip() for k in args.keys.split(",") if k.strip()]
    else:
        keys = sorted(
            p.name
            for p in BAKED.iterdir()
            if p.is_dir() and (p / "anim.json").exists()
        )

    results = []
    for key in keys:
        try:
            info = pack_character(
                key,
                force=args.force,
                fmt=args.format,
                quality=max(1, min(100, args.quality)),
            )
            results.append(info)
            flag = "skip" if info.get("skipped") else "ok"
            print(
                f"[{flag}] {key}: frames={info['frames']} sheets={info['sheets']}"
                + (f" cell={info.get('cell')}" if info.get("cell") else "")
                + (f" bytes={info.get('bytes')}" if info.get("bytes") is not None else "")
            )
        except Exception as exc:
            print(f"[fail] {key}: {exc}", file=sys.stderr)
            results.append({"key": key, "error": str(exc)})

    summary = {
        "packed": sum(1 for r in results if not r.get("skipped") and not r.get("error")),
        "skipped": sum(1 for r in results if r.get("skipped")),
        "failed": sum(1 for r in results if r.get("error")),
        "totalFrames": sum(r.get("frames") or 0 for r in results if not r.get("error")),
        "totalSheets": sum(r.get("sheets") or 0 for r in results if not r.get("error")),
        "totalBytes": sum(r.get("bytes") or 0 for r in results if not r.get("error")),
        "format": args.format,
        "pack": "shelf-trim",
        "results": results,
    }
    out = ROOT / "tools" / "sheet-pack-report.json"
    out.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                k: summary[k]
                for k in (
                    "packed",
                    "skipped",
                    "failed",
                    "totalFrames",
                    "totalSheets",
                    "totalBytes",
                    "format",
                    "pack",
                )
            },
            indent=2,
        )
    )
    return 1 if summary["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
