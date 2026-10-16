"""Re-bake Hirume native clips at higher resolution into this project's assets."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

HIRUME_TOOLS = Path(r"E:\LAO_WEB_GAME\Skin_3P_Hirume_R1\tools")
sys.path.insert(0, str(HIRUME_TOOLS))
import render_native_hirume as rh

OUT = Path(__file__).resolve().parents[1] / "assets" / "sd_baked" / "hirume"
SIZE = 768
BOUNDS_PAD = 0.20
CONTENT_BOX_PAD = 4
SPRITE_ALPHA_THR = 12
CLIPS = ("idle", "move", "skill1", "skill2", "die")
CLIP_FILES = {
    "idle": "Idle_1",
    "move": "Move",
    "skill1": "Skil_1",
    "skill2": "Skil_2",
    "die": "Die",
}
# True detached FX only — do not blanket-exclude skill/wing body pieces.
_HARD_FX_TOKENS = (
    "shadow",
    "buster",
    "carrier",
    "projectile",
    "bullet",
    "muzzle",
    "trail",
    "beam",
    "fx_",
    "_fx",
    "effect_",
    "_effect",
    "_box_",
    "box_skinned",
    "gun_",
    "dron",
    "drone",
)
_BODY_SILHOUETTE_TOKENS = (
    "tail",
    "taill",
    "wing",
    "hair",
    "horn",
    "coat",
    "skirt",
    "hat",
    "hand",
    "arm",
    "leg",
    "calf",
    "thigh",
    "pelvis",
    "spine",
    "breast",
    "neck",
    "head",
    "ear",
    "eye",
    "mouth",
    "eyebrow",
    "finger",
    "foot",
    "boot",
    "acc",
    "ribbon",
    "cloth",
    "dress",
    "cape",
    "cloak",
)


def is_body_silhouette(part_name: str) -> bool:
    low = part_name.lower()
    return any(tok in low for tok in _BODY_SILHOUETTE_TOKENS)


def is_hard_fx(part_name: str) -> bool:
    low = part_name.lower()
    if "shadow" in low:
        return True
    if is_body_silhouette(part_name):
        return False
    return any(tok in low for tok in _HARD_FX_TOKENS)


def include_in_frame_bounds(part_name: str) -> bool:
    return not is_hard_fx(part_name)


def main():
    clips = {
        k: next(iter(rh.documents(rh.MODEL / "animation" / f"{CLIP_FILES[k]}.anim").values()))[
            "AnimationClip"
        ]
        for k in CLIPS
    }

    # Pose all clips at full Unity duration (24fps). Do not truncate length.
    poses = {}
    for key, clip in clips.items():
        duration = float(clip["m_AnimationClipSettings"]["m_StopTime"])
        count = max(1, math.ceil(duration * 24))
        frames = [rh.pose(clip, duration * i / count) for i in range(count)]
        poses[key] = frames
        print(
            f"{key}: {count} frames posed (duration={duration:.4f}s)",
            flush=True,
        )

    def body_points(frame):
        named = [
            (p[1], p[2])
            for p in frame
            if include_in_frame_bounds(p[1]) and len(p[2])
        ]
        if not named:
            return None
        centers = np.array([v.mean(axis=0) for _, v in named], dtype=float)
        median = np.median(centers, axis=0)
        spans = np.array(
            [float(np.max(v.max(axis=0) - v.min(axis=0))) for _, v in named],
            dtype=float,
        )
        typical = float(np.median(spans)) if len(spans) else 1.0
        max_dist = max(typical * 5.0, 10.0)
        kept = []
        for (name, verts), center in zip(named, centers):
            dist = float(np.linalg.norm(center - median))
            if dist <= max_dist or is_body_silhouette(name):
                kept.append(verts)
        if not kept:
            kept = [v for _, v in named]
        return np.concatenate(kept)

    # Idle+move share one AABB; skill uses per-frame body bounds.
    locomotion_pts = []
    for key in ("idle", "move"):
        for frame in poses[key]:
            pts = body_points(frame)
            if pts is not None:
                locomotion_pts.append(pts)
    loc_pts = np.concatenate(locomotion_pts)
    lo = loc_pts.min(axis=0)
    hi = loc_pts.max(axis=0)
    pad = (hi - lo) * BOUNDS_PAD
    locomotion_bounds = (*(lo - pad), *(hi + pad))
    print(
        f"idle+move bounds size=({hi[0]-lo[0]:.3f}x{hi[1]-lo[1]:.3f}) pad={BOUNDS_PAD}",
        flush=True,
    )

    native = OUT / "native"
    native.mkdir(parents=True, exist_ok=True)
    for key in CLIPS:
        for old in native.glob(f"{key}_*.png"):
            old.unlink()

    content_acc = [SIZE, SIZE, -1, -1]
    metadata = {
        "source": "Unity prefab + FBX + Puppet2D IK (hi-res re-bake)",
        "native": True,
        "size": SIZE,
        "character": "hirume",
    }
    for key, frames in poses.items():
        clip = clips[key]
        duration = float(clip["m_AnimationClipSettings"]["m_StopTime"])
        metadata[key] = []
        metadata[key + "Fps"] = len(frames) / max(duration, 1e-6)
        metadata[key + "Duration"] = duration
        if key.startswith("skill"):
            hit = next(
                (
                    e["time"]
                    for e in (clip.get("m_Events") or [])
                    if e.get("functionName")
                    in ("EventHit", "EventThrowEffectGround", "EventAttack")
                ),
                None,
            )
            if hit is not None:
                metadata[key + "HitTime"] = hit
        for i, parts in enumerate(frames):
            if key.startswith("skill") or key == "die":
                pts = body_points(parts)
                if pts is not None:
                    lo = pts.min(axis=0)
                    hi = pts.max(axis=0)
                    pad = (hi - lo) * BOUNDS_PAD
                    bounds = (*(lo - pad), *(hi + pad))
                else:
                    bounds = locomotion_bounds
            else:
                bounds = locomotion_bounds
            # Drop hard FX before raster so detached props never clip the canvas.
            draw_parts = [p for p in parts if not is_hard_fx(p[1])]
            img = rh.render(draw_parts, bounds, size=SIZE)
            arr = np.asarray(img)
            if arr.ndim == 3 and arr.shape[2] >= 4:
                ys, xs = np.where(arr[:, :, 3] > SPRITE_ALPHA_THR)
                if len(xs):
                    x0, x1 = int(xs.min()), int(xs.max())
                    y0, y1 = int(ys.min()), int(ys.max())
                    touches_edge = (
                        x0 <= 4
                        or y0 <= 4
                        or x1 >= SIZE - 5
                        or y1 >= SIZE - 5
                    )
                    if not ((key.startswith("skill") or key == "die") and touches_edge):
                        content_acc[0] = min(content_acc[0], x0)
                        content_acc[1] = min(content_acc[1], y0)
                        content_acc[2] = max(content_acc[2], x1)
                        content_acc[3] = max(content_acc[3], y1)
            filename = f"{key}_{i:03d}.png"
            img.save(native / filename, optimize=True)
            metadata[key].append("native/" + filename)
        print(key, "written", len(frames), f"@ {SIZE}px", flush=True)

    if content_acc[2] >= content_acc[0]:
        x0 = max(0, content_acc[0] - CONTENT_BOX_PAD)
        y0 = max(0, content_acc[1] - CONTENT_BOX_PAD)
        x1 = min(SIZE - 1, content_acc[2] + CONTENT_BOX_PAD)
        y1 = min(SIZE - 1, content_acc[3] + CONTENT_BOX_PAD)
        metadata["contentBox"] = {
            "x": x0,
            "y": y0,
            "w": x1 - x0 + 1,
            "h": y1 - y0 + 1,
        }

    (OUT / "anim.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    preview_parts = [p for p in poses["idle"][0] if not is_hard_fx(p[1])]
    preview = rh.render(preview_parts, locomotion_bounds, size=SIZE)
    preview.save(OUT / "preview.png", optimize=True)
    print("done", OUT, flush=True)


if __name__ == "__main__":
    main()
