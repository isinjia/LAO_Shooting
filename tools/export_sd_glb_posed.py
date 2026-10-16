"""
Bake skinned parts to world-space morph meshes so Three.js doesn't GPU-skin.
Sprites keep hierarchy TRS animation.
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HIRUME_TOOLS = Path(r"E:\LAO_WEB_GAME\Skin_3P_Hirume_R1\tools")
sys.path.insert(0, str(HIRUME_TOOLS))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import render_native_hirume as rh
from export_sd_glb import (
    GlbWriter,
    build_sprite_mesh,
    mat3_to_quat,
    pose_state,
)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "sd_glb"


def skinned_world_mesh(part, clip, time, mesh_scale):
    """Return world-space positions/uvs/indices for a skinned renderer at time."""
    # Reuse rh.pose parts list and find matching name — returns world verts already
    parts = rh.pose(clip, time)
    for order, name, verts, uv, tris, tex, alpha in parts:
        if name != part["name"]:
            continue
        # verts are Nx2 world XY from rh; add Z from sorting
        z = float(order) * 1e-4
        pos = np.zeros((len(verts), 3), np.float32)
        pos[:, 0:2] = verts.astype(np.float32)
        pos[:, 2] = z
        # uv from rh is pixel space in texture array coords
        tex_img = tex
        th, tw = tex_img.shape[0], tex_img.shape[1]
        uv_px = np.asarray(uv, np.float32)
        # rh uv: [[x,y],[x+w,y],[x+w,y-h],[x,y-h]] with y from top of numpy image
        u = uv_px[:, 0] / tw
        v = 1.0 - uv_px[:, 1] / th
        uvs = np.stack([u, v], axis=1).astype(np.float32)
        # Expand unique corners for tris
        # rh passes verts per corner already aligned with uv rows; tris index into those
        indices = np.asarray(tris, np.uint16).reshape(-1)
        # Deduce: verts rows are unique corners matching uv rows
        return pos, uvs, indices, order
    return None


def export_posed(clips_wanted, fps, out_path: Path):
    MODEL = rh.MODEL
    clip_files = {
        "idle": "Idle_1",
        "move": "Move",
        "skill1": "Skil_1",
        "skill2": "Skil_2",
    }
    clips = {}
    for key in clips_wanted:
        anim_path = MODEL / "animation" / f"{clip_files[key]}.anim"
        clips[key] = next(iter(rh.documents(anim_path).values()))["AnimationClip"]

    bind_trs, bind_parts = pose_state(clips[clips_wanted[0]], 0.0)
    tf_ids = list(rh.tfs.keys())
    tid_to_node = {tid: i for i, tid in enumerate(tf_ids)}
    writer = GlbWriter()
    mesh_scale = rh.mesh_scale

    for p in bind_parts:
        writer.add_texture(Path(p["tex"]))

    # Transform hierarchy for sprites only
    for tid in tf_ids:
        trs = bind_trs[tid]
        writer.nodes.append(
            {
                "name": rh.name(tid),
                "translation": trs["t"],
                "rotation": trs["r"],
                "scale": trs["s"],
                "extras": {"tid": tid, "path": rh.paths[tid]},
            }
        )
    root_nodes = []
    for tid in tf_ids:
        parent = rh.tfs[tid]["m_Father"]["fileID"]
        ni = tid_to_node[tid]
        if parent and parent in tid_to_node:
            writer.nodes[tid_to_node[parent]].setdefault("children", []).append(ni)
        else:
            root_nodes.append(ni)

    sprite_parts = [p for p in bind_parts if p["kind"] == "sprite"]
    skinned_parts = [p for p in bind_parts if p["kind"] == "skinned"]

    # Sprites on hierarchy
    for part in sprite_parts:
        tid = part["tid"]
        ni = tid_to_node[tid]
        _, mat_index, tex_size = writer.add_texture(Path(part["tex"]))
        verts, uvs, indices = build_sprite_mesh(part, tex_size)
        mesh_index = writer.add_mesh_triangles(
            part["name"],
            verts,
            uvs,
            indices,
            mat_index,
            extras={"sortingOrder": part["order"], "kind": "sprite"},
        )
        if "mesh" in writer.nodes[ni]:
            child = {
                "name": part["name"] + "_mesh",
                "mesh": mesh_index,
                "extras": {"sortingOrder": part["order"]},
            }
            writer.nodes.append(child)
            writer.nodes[ni].setdefault("children", []).append(len(writer.nodes) - 1)
        else:
            writer.nodes[ni]["mesh"] = mesh_index
            writer.nodes[ni]["extras"]["sortingOrder"] = part["order"]

    # Skinned → world-space base mesh + morphs per clip (no GPU skin)
    posed_nodes = []
    morph_anims = []  # filled per clip later
    skinned_mesh_meta = []

    for part in skinned_parts:
        baked = skinned_world_mesh(part, clips[clips_wanted[0]], 0.0, mesh_scale)
        if baked is None:
            print("skip skinned", part["name"])
            continue
        pos0, uvs0, indices0, order = baked
        _, mat_index, _ = writer.add_texture(Path(part["tex"]))

        # Build morph targets later; for now create mesh with empty morphs placeholder
        mesh_index = writer.add_mesh_triangles(
            part["name"],
            pos0,
            uvs0,
            indices0,
            mat_index,
            extras={"sortingOrder": order, "kind": "skinned_posed"},
        )
        node = {
            "name": part["name"],
            "mesh": mesh_index,
            "extras": {"sortingOrder": order, "kind": "skinned_posed"},
        }
        writer.nodes.append(node)
        node_idx = len(writer.nodes) - 1
        posed_nodes.append(node_idx)
        skinned_mesh_meta.append(
            {
                "part": part,
                "mesh_index": mesh_index,
                "node_index": node_idx,
                "base": pos0,
                "count": len(pos0),
            }
        )

    # Sample morph positions for each clip
    # We'll store absolute positions as morph targets and animate weights.
    for key, clip in clips.items():
        duration = clip["m_AnimationClipSettings"]["m_StopTime"]
        count = max(2, math.ceil(duration * fps))
        times = [duration * i / count for i in range(count)]

        # Hierarchy TRS for sprites (same as export_sd_glb)
        T = {tid: [] for tid in tf_ids}
        R = {tid: [] for tid in tf_ids}
        S = {tid: [] for tid in tf_ids}
        for t in times:
            trs, _ = pose_state(clip, t)
            for tid in tf_ids:
                T[tid].append(trs[tid]["t"])
                R[tid].append(trs[tid]["r"])
                S[tid].append(trs[tid]["s"])

        time_arr = np.array(times, np.float32)
        time_view = writer.add_bin(time_arr.tobytes())
        time_acc = writer.add_accessor(
            time_view, len(times), 5126, "SCALAR", maxv=[float(times[-1])], minv=[0.0]
        )
        channels = []
        samplers = []
        for tid in tf_ids:
            ni = tid_to_node[tid]
            t_data = np.array(T[tid], np.float32)
            r_data = np.array(R[tid], np.float32)
            s_data = np.array(S[tid], np.float32)
            for i in range(1, len(r_data)):
                if np.dot(r_data[i], r_data[i - 1]) < 0:
                    r_data[i] *= -1
            for data, path, typ in [
                (t_data, "translation", "VEC3"),
                (r_data, "rotation", "VEC4"),
                (s_data, "scale", "VEC3"),
            ]:
                view = writer.add_bin(data.tobytes())
                acc = writer.add_accessor(view, len(times), 5126, typ)
                si = len(samplers)
                samplers.append({"input": time_acc, "output": acc, "interpolation": "LINEAR"})
                channels.append({"sampler": si, "target": {"node": ni, "path": path}})

        # Morph weight tracks: one weight per frame target (exclusive)
        for meta in skinned_mesh_meta:
            part = meta["part"]
            mesh = writer.meshes[meta["mesh_index"]]
            targets = []
            base = meta["base"]
            for ti, t in enumerate(times):
                baked = skinned_world_mesh(part, clip, t, mesh_scale)
                if baked is None:
                    delta = np.zeros_like(base)
                else:
                    pos, _, _, _ = baked
                    if len(pos) != len(base):
                        delta = np.zeros_like(base)
                    else:
                        delta = (pos - base).astype(np.float32)
                view = writer.add_bin(delta.tobytes(), 34962)
                acc = writer.add_accessor(
                    view,
                    len(base),
                    5126,
                    "VEC3",
                    maxv=delta.max(axis=0).tolist(),
                    minv=delta.min(axis=0).tolist(),
                )
                targets.append({"POSITION": acc})

            mesh["weights"] = [0.0] * len(targets)
            mesh["primitives"][0]["targets"] = targets
            if "extras" not in mesh:
                mesh["extras"] = {}
            mesh["extras"]["targetNames"] = [f"{key}_{i}" for i in range(len(targets))]

            # weights animation: at time i, weight[i]=1 others 0
            w_data = np.zeros((len(times), len(targets)), np.float32)
            for i in range(len(times)):
                w_data[i, i] = 1.0
            view = writer.add_bin(w_data.tobytes())
            acc = writer.add_accessor(view, len(times), 5126, "SCALAR")
            # glTF morph weights accessor is SCALAR with count = times * nTargets
            # Fix: weights output should be length times * num_targets as flat scalars
            writer.accessors[-1]["count"] = len(times) * len(targets)
            si = len(samplers)
            samplers.append({"input": time_acc, "output": acc, "interpolation": "LINEAR"})
            channels.append(
                {
                    "sampler": si,
                    "target": {"node": meta["node_index"], "path": "weights"},
                }
            )

        writer.animations.append({"name": key, "samplers": samplers, "channels": channels})
        print(f"{key}: {count} keys @ {fps}fps", flush=True)

    meta = {
        "source": "posed morph skinned + hierarchy sprites",
        "character": "hirume",
        "clips": {
            k: {
                "frames": math.ceil(clips[k]["m_AnimationClipSettings"]["m_StopTime"] * fps),
                "fps": fps,
                "duration": clips[k]["m_AnimationClipSettings"]["m_StopTime"],
            }
            for k in clips
        },
    }
    if "skill1" in clips:
        hit = next(
            (
                e["time"]
                for e in clips["skill1"]["m_Events"]
                if e["functionName"] in ("EventHit", "EventThrowEffectGround")
            ),
            None,
        )
        if hit is not None:
            meta["clips"]["skill1"]["hitTime"] = hit

    root = {
        "name": "HirumeRoot",
        "children": root_nodes + posed_nodes,
        "scale": [1, 1, 1],
    }
    writer.nodes.append(root)
    gltf = writer.finish([len(writer.nodes) - 1], meta)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    writer.write(out_path, gltf)
    (out_path.with_suffix(".meta.json")).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} ({out_path.stat().st_size / 1024 / 1024:.2f} MB)", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=float, default=12.0)
    ap.add_argument("--clips", default="idle,move,skill1")
    ap.add_argument("--out", default=str(OUT_DIR / "hirume.glb"))
    args = ap.parse_args()
    clips = [c.strip() for c in args.clips.split(",") if c.strip()]
    export_posed(clips, args.fps, Path(args.out))


if __name__ == "__main__":
    main()
