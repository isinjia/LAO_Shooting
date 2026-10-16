"""Pose-only pass (no rendering) for a baked character's skill clips.

1. anim.json "skillCamera": per skill frame, the body-centred skill camera's offset from the
   idle camera in bake px (same maths as bake_sd_character.py), so the trimmed skill atlas
   (import-skill-body-sheets.py) places every frame back in idle space: no jump at cast,
   the clip's own root motion (lunges, hops, jumps) kept.
2. Optional FX anchors: idle-space bake px of named transforms (original FX objects) at
   given clip times, written to a JS module the skill script reads, so effects spawn
   exactly where the original FX objects sit relative to the body.

usage: python tools/skill-camera-and-fx.py labiata [--fx-js js/labiata-fx-anchors.js]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake_sd_character as B  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

# clip key -> [(label, transform name, clip time)]
FX_ANCHORS = {
    "labiata": {
        "skill1": [
            ("smoke5", "Labiata_skill1_smoke5", 0.95),
            ("downsmoke", "Labiata_skill_down_smoke", 1.5),
            ("blade1", "Labiata_skill1_blade1", 2.0333),
            ("baglight1", "Labiata_buff_lighting_FX", 2.0667),
            ("baglight2", "Labiata_buff_lighting_FX", 2.9),
            ("baglight3", "Labiata_buff_lighting_FX", 3.4333),
            ("baglight4", "Labiata_buff_lighting_FX", 3.8833),
            ("blade2", "Labiata_skill2_blade2", 2.9167),
            ("smoke2", "Labiata_skill1_smoke2", 3.05),
            ("blade3", "Labiata_skill1_blade3", 3.9333),
            ("smoke4", "Labiata_skill1_smoke4", 4.1167),
            ("spark1", "Labiata_buff_skill1_hit2", 4.1833),
            ("spark2", "Labiata_buff_skill1_hit2", 4.3667),
            ("spark3", "Labiata_buff_skill1_hit2", 4.5667),
            ("spark4", "Labiata_buff_skill1_hit2", 4.7833),
            ("downsmoke2", "Labiata_skill_down_smoke", 5.7167),
        ],
        "skill2": [
            ("inparticle", "Labiata_skill2_blade_in_particle", 2.3333),
            ("inaura", "Labiata_skill2_blade_in_aura", 3.65),
            ("swing", "Labiata_skill2_blade_swing", 4.1333),
            ("swingsmoke", "Labiata_skill2_blade_swing_back_smoke", 4.2833),
            ("light1", "Labiata_buff_lighting_skill2", 4.8333),
            ("light2", "Labiata_buff_lighting_skill2", 5.3333),
            ("light3", "Labiata_buff_lighting_skill2", 5.8167),
            ("upsmoke", "Labiata_skill2_blade_up_smoke", 4.95),
            ("inparticle2", "Labiata_skill2_blade_in_particle2", 5.3833),
            ("windaura", "Labiata_skill2_blade_wind_aura", 5.7167),
            ("buffaura", "Labiata_skill2_blade_buffaura", 5.9833),
            ("jumpsmoke", "Labiata_skill2_jump_up_smoke", 6.9),
            ("ground", "skill2_ground_attack", 9.1833),
            ("finalhit", "Labiata_buff_skill2_hit", 9.5667),
            ("downsmoke", "Labiata_skill2_down_smoke", 10.7667),
            ("glow", "fx_skill2_glow_1", 4.9167),
        ],
    },
}


def main() -> None:
    key = sys.argv[1]
    fx_js = sys.argv[sys.argv.index("--fx-js") + 1] if "--fx-js" in sys.argv else None
    cfg = dict(B.CHARACTERS[key])
    b = B.CharacterBaker(key, cfg)
    b.cfg = {**cfg, "clips": B.resolve_clips(b, cfg)}
    b._build_paths()
    clips = b.cfg["clips"]

    def frames_of(stem):
        clip = b.load_clip(stem)
        dur = float(clip["m_AnimationClipSettings"]["m_StopTime"])
        n = max(1, math.ceil(dur * 24))
        return clip, dur, n

    loco = []
    for k in ("idle", "move"):
        clip, dur, n = frames_of(clips[k])
        for i in range(n):
            pts = B.body_points_for_bounds(b.pose(clip, dur * i / n))
            if pts is not None:
                loco.append(pts)
    lb = B.padded_bounds_from_points(np.concatenate(loco))
    if b.cfg.get("frame_size_units"):
        fw, fh = b.cfg["frame_size_units"]
        cxl, cyl = (lb[0] + lb[2]) / 2, (lb[1] + lb[3]) / 2
        lb = (cxl - fw / 2, cyl - fh / 2, cxl + fw / 2, cyl + fh / 2)
    f_px = min(B.SIZE / (lb[2] - lb[0]), B.SIZE / (lb[3] - lb[1]))
    lcx, lcy = (lb[0] + lb[2]) / 2, (lb[1] + lb[3]) / 2
    excl = b.cfg.get("skill_center_exclude")

    def to_idle_px(p):
        return [round((p[0] - lcx) * f_px + B.SIZE / 2, 1), round((lcy - p[1]) * f_px + B.SIZE / 2, 1)]

    anim_path = ROOT / "assets" / "sd_baked" / key / "anim.json"
    anim = json.loads(anim_path.read_text(encoding="utf-8"))
    cams = {}
    for k in [c for c in clips if c.startswith("skill")]:
        clip, dur, n = frames_of(clips[k])
        rows = []
        for i in range(n):
            parts = b.pose(clip, dur * i / n)
            pts = B.body_points_for_bounds(parts)
            if excl:
                keep = [p[2] for p in parts if B.include_in_frame_bounds(p[1]) and len(p[2])
                        and not any(t in p[1].lower() for t in excl)]
                if keep:
                    pts = np.concatenate(keep)
            if pts is not None:
                fb = B.padded_bounds_from_points(pts)
                cx, cy = (fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2
            else:
                cx, cy = lcx, lcy
            rows.append([round((cx - lcx) * f_px, 2), round((lcy - cy) * f_px, 2)])
        cams[k] = rows
        print(k, "frames", n, "camera dx range", min(r[0] for r in rows), max(r[0] for r in rows),
              "dy range", min(r[1] for r in rows), max(r[1] for r in rows))
    anim["skillCamera"] = cams
    anim_path.write_text(json.dumps(anim, indent=2), encoding="utf-8")

    if fx_js and key in FX_ANCHORS:
        out = {"fPx": round(f_px, 4)}
        for k, rows in FX_ANCHORS[key].items():
            clip, dur, n = frames_of(clips[k])
            res = {}
            for label, name, t in rows:
                b._want_world = {name}
                b.pose(clip, t)
                w = (b._last_world or {}).get(name)
                if w is None:
                    print("  missing", name)
                    continue
                res[label] = to_idle_px(w)
            out[k] = res
            print(k, json.dumps(res))
        b._want_world = None
        Path(fx_js).write_text(
            "// Generated by tools/skill-camera-and-fx.py. Do not edit.\n"
            f"// Original FX object positions in idle bake px ({key}), and bake px per model unit.\n"
            f"export const FX_ANCHORS = {json.dumps(out)};\n", encoding="utf-8")
        print("wrote", fx_js)


if __name__ == "__main__":
    main()
