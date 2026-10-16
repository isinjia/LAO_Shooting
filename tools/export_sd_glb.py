"""
Export LAO SD (Unity prefab + FBX + Puppet2D IK + .anim) to glTF (.glb).

Reuses Skin_3P_Hirume_R1 tools/render_native_hirume pose (curves + IK),
then writes a skinned/sprite node hierarchy with sampled TRS clips.

Usage:
  python tools/export_sd_glb.py
  python tools/export_sd_glb.py --fps 12 --clips idle,move,skill1
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

HIRUME_TOOLS = Path(r"E:\LAO_WEB_GAME\Skin_3P_Hirume_R1\tools")
sys.path.insert(0, str(HIRUME_TOOLS))
import render_native_hirume as rh  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "sd_glb"


def mat3_to_quat(R: np.ndarray) -> list[float]:
    """Rotation matrix -> quaternion xyzw."""
    m = R
    t = np.trace(m)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        w = 0.25 * s
        x = (m[2, 1] - m[1, 2]) / s
        y = (m[0, 2] - m[2, 0]) / s
        z = (m[1, 0] - m[0, 1]) / s
    else:
        if m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
            s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
            w = (m[2, 1] - m[1, 2]) / s
            x = 0.25 * s
            y = (m[0, 1] + m[1, 0]) / s
            z = (m[0, 2] + m[2, 0]) / s
        elif m[1, 1] > m[2, 2]:
            s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
            w = (m[0, 2] - m[2, 0]) / s
            x = (m[0, 1] + m[1, 0]) / s
            y = 0.25 * s
            z = (m[1, 2] + m[2, 1]) / s
        else:
            s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
            w = (m[1, 0] - m[0, 1]) / s
            x = (m[0, 2] + m[2, 0]) / s
            y = (m[1, 2] + m[2, 1]) / s
            z = 0.25 * s
    q = np.array([x, y, z, w], float)
    q /= max(np.linalg.norm(q), 1e-12)
    return q.tolist()


def pose_state(clip, time):
    """Like rh.pose, but also returns per-transform local TRS + visibility after IK."""
    pos = {i: rh.vector(d["m_LocalPosition"]) for i, d in rh.tfs.items()}
    rot = {i: rh.quat(d["m_LocalRotation"]) for i, d in rh.tfs.items()}
    scale = {i: rh.vector(d["m_LocalScale"]) for i, d in rh.tfs.items()}
    active = {i: bool(d["m_IsActive"]) for i, d in rh.gos.items()}
    overrides = {}
    for key, target in [
        ("m_PositionCurves", pos),
        ("m_ScaleCurves", scale),
        ("m_EulerCurves", rot),
    ]:
        for c in clip.get(key, []):
            tid = rh.find_path(c["path"])
            if tid is not None:
                v = rh.sample(c["curve"], time)
                target[tid] = rh.euler(v) if key == "m_EulerCurves" else v
    for c in clip.get("m_FloatCurves", []):
        tid = rh.find_path(c["path"])
        if tid is None:
            continue
        value = rh.sample(c["curve"], time)
        if c["attribute"] == "m_IsActive":
            active[rh.tfs[tid]["m_GameObject"]["fileID"]] = value > 0.5
        else:
            overrides[(tid, c["attribute"], c["classID"])] = value

    world = {}

    def matrix(i):
        if i not in world:
            m = np.eye(4)
            m[:3, :3] = rot[i] @ np.diag(scale[i])
            m[:3, 3] = pos[i]
            parent = rh.tfs[i]["m_Father"]["fileID"]
            world[i] = matrix(parent) @ m if parent else m
        return world[i]

    def visible(i):
        if not active[rh.tfs[i]["m_GameObject"]["fileID"]]:
            return False
        p = rh.tfs[i]["m_Father"]["fileID"]
        return visible(p) if p else True

    def world_rotation(i):
        p = rh.tfs[i]["m_Father"]["fileID"]
        return world_rotation(p) @ rot[i] if p else rot[i]

    def set_rotation(i, value):
        p = rh.tfs[i]["m_Father"]["fileID"]
        rot[i] = world_rotation(p).T @ value if p else value
        world.clear()

    def look_rotation(direction, up):
        forward = direction / np.linalg.norm(direction)
        right = np.cross(up, forward)
        right /= np.linalg.norm(right)
        return np.column_stack([right, np.cross(forward, right), forward])

    ik_enabled = {}
    for doc in rh.docs.values():
        control = doc.get("MonoBehaviour", {})
        if "_Ikhandles" not in control:
            continue
        tid = rh.go_tf[control["m_GameObject"]["fileID"]]
        for index, handle in enumerate(control["_Ikhandles"]):
            axis = "xyzw"[index] if index < 4 else None
            ik_enabled[handle["fileID"]] = axis is None or overrides.get(
                (tid, "OnOff." + axis, 114), control["OnOff"][axis]
            ) > 0.5

    for component_id, doc in rh.docs.items():
        d = doc.get("MonoBehaviour", {})
        if d.get("m_Script", {}).get("guid") != "62fc74be5d0ea434fa84a6add19b6c84":
            continue
        if not ik_enabled.get(component_id, True):
            continue
        ctrl = rh.go_tf[d["m_GameObject"]["fileID"]]
        if not visible(ctrl) or not overrides.get((ctrl, "m_Enabled", 114), d["m_Enabled"]):
            continue
        top, mid, end = [
            d[k]["fileID"]
            for k in ["topJointTransform", "middleJointTransform", "bottomJointTransform"]
        ]
        if d["SquashAndStretch"]:
            scale[top] = rh.vector(d["scaleStart"][0])
            world.clear()
        a, b, c = [matrix(i)[:3, 3].copy() for i in [top, mid, end]]
        target = matrix(ctrl)[:3, 3].copy()
        l1 = np.linalg.norm(b - a)
        l2 = np.linalg.norm(c - b)
        distance = np.linalg.norm(target - a)
        if min(l1, l2, distance) < 1e-8:
            continue
        if d["SquashAndStretch"] and distance > l1 + l2:
            scale[top][1] *= distance / (l1 + l2)
            world.clear()
        distance = min(distance, l1 + l2 - 0.0001)
        cosine = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance * l1)
        angle = math.degrees(math.acos(np.clip(cosine, -1, 1)))
        flip = 1 if overrides.get((ctrl, "Flip", 114), d["Flip"]) else -1
        aim = rh.vector(d["AimDirection"])
        up = rh.vector(d["UpDirection"])
        turn = rh.euler(up * 90)
        set_rotation(top, look_rotation(target - a, aim) @ turn @ rh.euler([0, 0, angle * flip]))
        set_rotation(mid, look_rotation(target - matrix(mid)[:3, 3], aim) @ turn)
        set_rotation(end, world_rotation(ctrl) @ rh.quat(d["Offset"]))
        if d["Scale"]:
            scale[end] = scale[ctrl] * rh.vector(d["OffsetScale"])
            world.clear()

    # Force world rebuild
    for i in rh.tfs:
        matrix(i)

    # Renderer enabled flags (eyes/mouth often toggle m_Enabled, not only GameObject active)
    renderer_on = {i: True for i in rh.tfs}
    for doc in rh.docs.values():
        kind = (
            "SpriteRenderer"
            if "SpriteRenderer" in doc
            else "SkinnedMeshRenderer"
            if "SkinnedMeshRenderer" in doc
            else None
        )
        if not kind:
            continue
        r = doc[kind]
        tid = rh.go_tf[r["m_GameObject"]["fileID"]]
        classid = 212 if kind == "SpriteRenderer" else 137
        renderer_on[tid] = bool(overrides.get((tid, "m_Enabled", classid), r["m_Enabled"]))

    locals_trs = {}
    for i in rh.tfs:
        vis = visible(i) and renderer_on.get(i, True)
        s = scale[i].copy()
        if not vis:
            s = np.array([1e-4, 1e-4, 1e-4], float)
        locals_trs[i] = {
            "t": pos[i].tolist(),
            "r": mat3_to_quat(rot[i]),
            "s": s.tolist(),
            "visible": vis,
        }

    parts = []  # renderer descriptors for bind meshes
    for doc in rh.docs.values():
        kind = (
            "SpriteRenderer"
            if "SpriteRenderer" in doc
            else "SkinnedMeshRenderer"
            if "SkinnedMeshRenderer" in doc
            else None
        )
        if not kind:
            continue
        r = doc[kind]
        tid = rh.go_tf[r["m_GameObject"]["fileID"]]
        classid = 212 if kind == "SpriteRenderer" else 137
        enabled = overrides.get((tid, "m_Enabled", classid), r["m_Enabled"])
        order = round(overrides.get((tid, "m_SortingOrder", classid), r["m_SortingOrder"]))
        name = rh.name(tid)
        if "shadow" in name.lower():
            continue
        if kind == "SpriteRenderer":
            s = r["m_Sprite"]
            sp = rh.sprites.get(f"id:{s['fileID']}|{s.get('guid', '')}")
            if not sp:
                continue
            tex = sp["tex"]
            w, h = sp["w"], sp["h"]
            px, py = sp["pivot"]
            ppu = rh.ppus[tex]
            flip_x = overrides.get((tid, "m_FlipX", 212), r["m_FlipX"]) > 0.5
            flip_y = overrides.get((tid, "m_FlipY", 212), r.get("m_FlipY", 0)) > 0.5
            parts.append(
                {
                    "kind": "sprite",
                    "tid": tid,
                    "name": name,
                    "order": order,
                    "enabled": bool(enabled),
                    "tex": str(tex),
                    "w": w,
                    "h": h,
                    "px": px,
                    "py": py,
                    "ppu": ppu,
                    "x": sp["x"],
                    "y": sp["y"],
                    "flip_x": flip_x,
                    "flip_y": flip_y,
                    "alpha": float(
                        overrides.get(
                            (tid, "m_Color.a", 212), r.get("m_Color", {}).get("a", 1)
                        )
                    ),
                }
            )
        else:
            meshname = rh.fbxmeta.get(r["m_Mesh"]["fileID"])
            mesh = rh.rig.get(meshname)
            if not mesh:
                continue
            texpath = rh.materials.get(r["m_Materials"][0].get("guid"))
            if not texpath:
                continue
            bone_ids = [b["fileID"] for b in r["m_Bones"]]
            parts.append(
                {
                    "kind": "skinned",
                    "tid": tid,
                    "name": name,
                    "order": order,
                    "enabled": bool(enabled),
                    "tex": str(texpath),
                    "meshname": meshname,
                    "bone_ids": bone_ids,
                    "alpha": 1.0,
                }
            )
    return locals_trs, parts


class GlbWriter:
    def __init__(self):
        self.blob = bytearray()
        self.buffer_views = []
        self.accessors = []
        self.images = []
        self.textures = []
        self.materials = []
        self.meshes = []
        self.nodes = []
        self.skins = []
        self.animations = []
        self.samplers = [{"magFilter": 9729, "minFilter": 9729, "wrapS": 33071, "wrapT": 33071}]
        self._tex_index = {}
        self._mat_index = {}

    def _align(self, n=4):
        while len(self.blob) % n:
            self.blob.append(0)

    def add_bin(self, data: bytes, target=None):
        self._align(4)
        offset = len(self.blob)
        self.blob.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def add_accessor(self, view, count, component_type, type_name, maxv=None, minv=None):
        acc = {
            "bufferView": view,
            "componentType": component_type,
            "count": count,
            "type": type_name,
        }
        if maxv is not None:
            acc["max"] = maxv
        if minv is not None:
            acc["min"] = minv
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_texture(self, path: Path):
        key = str(path)
        if key in self._tex_index:
            return self._tex_index[key]
        img = Image.open(path).convert("RGBA")
        orig_size = img.size  # UVs are authored in original pixel space — do not retarget
        # Compress for web but keep pixel dimensions (UV-safe)
        from io import BytesIO

        buf = BytesIO()
        img.save(buf, format="PNG", optimize=True)
        png = buf.getvalue()
        view = self.add_bin(png)
        image_index = len(self.images)
        self.images.append({"bufferView": view, "mimeType": "image/png", "name": path.stem})
        tex_index = len(self.textures)
        self.textures.append({"sampler": 0, "source": image_index})
        mat_index = len(self.materials)
        self.materials.append(
            {
                "name": path.stem,
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": tex_index},
                    "metallicFactor": 0,
                    "roughnessFactor": 1,
                },
                "alphaMode": "BLEND",
                "doubleSided": True,
            }
        )
        self._tex_index[key] = (tex_index, mat_index, orig_size)
        self._mat_index[key] = mat_index
        return self._tex_index[key]

    def add_mesh_triangles(self, name, positions, uvs, indices, material, extras=None):
        pos = np.asarray(positions, np.float32).reshape(-1, 3)
        uv = np.asarray(uvs, np.float32).reshape(-1, 2)
        idx = np.asarray(indices, np.uint16).reshape(-1)
        pos_view = self.add_bin(pos.tobytes(), 34962)
        uv_view = self.add_bin(uv.tobytes(), 34962)
        idx_view = self.add_bin(idx.tobytes(), 34963)
        pos_acc = self.add_accessor(
            pos_view,
            len(pos),
            5126,
            "VEC3",
            maxv=pos.max(axis=0).tolist(),
            minv=pos.min(axis=0).tolist(),
        )
        uv_acc = self.add_accessor(uv_view, len(uv), 5126, "VEC2")
        idx_acc = self.add_accessor(idx_view, len(idx), 5123, "SCALAR")
        prim = {
            "attributes": {"POSITION": pos_acc, "TEXCOORD_0": uv_acc},
            "indices": idx_acc,
            "material": material,
        }
        mesh = {"name": name, "primitives": [prim]}
        if extras:
            mesh["extras"] = extras
        self.meshes.append(mesh)
        return len(self.meshes) - 1

    def add_skinned_mesh(self, name, positions, uvs, indices, joints, weights, material, extras=None):
        pos = np.asarray(positions, np.float32).reshape(-1, 3)
        uv = np.asarray(uvs, np.float32).reshape(-1, 2)
        idx = np.asarray(indices, np.uint16).reshape(-1)
        j = np.asarray(joints, np.uint16).reshape(-1, 4)
        w = np.asarray(weights, np.float32).reshape(-1, 4)
        pos_view = self.add_bin(pos.tobytes(), 34962)
        uv_view = self.add_bin(uv.tobytes(), 34962)
        j_view = self.add_bin(j.tobytes(), 34962)
        w_view = self.add_bin(w.tobytes(), 34962)
        idx_view = self.add_bin(idx.tobytes(), 34963)
        pos_acc = self.add_accessor(
            pos_view,
            len(pos),
            5126,
            "VEC3",
            maxv=pos.max(axis=0).tolist(),
            minv=pos.min(axis=0).tolist(),
        )
        uv_acc = self.add_accessor(uv_view, len(uv), 5126, "VEC2")
        j_acc = self.add_accessor(j_view, len(j), 5123, "VEC4")
        w_acc = self.add_accessor(w_view, len(w), 5126, "VEC4")
        idx_acc = self.add_accessor(idx_view, len(idx), 5123, "SCALAR")
        prim = {
            "attributes": {
                "POSITION": pos_acc,
                "TEXCOORD_0": uv_acc,
                "JOINTS_0": j_acc,
                "WEIGHTS_0": w_acc,
            },
            "indices": idx_acc,
            "material": material,
        }
        mesh = {"name": name, "primitives": [prim]}
        if extras:
            mesh["extras"] = extras
        self.meshes.append(mesh)
        return len(self.meshes) - 1

    def finish(self, scene_nodes, meta):
        gltf = {
            "asset": {"version": "2.0", "generator": "lao-sd-export"},
            "scene": 0,
            "scenes": [{"nodes": scene_nodes, "extras": meta}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "textures": self.textures,
            "images": self.images,
            "samplers": self.samplers,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.blob)}],
            "animations": self.animations,
        }
        if self.skins:
            gltf["skins"] = self.skins
        return gltf

    def write(self, path: Path, gltf: dict):
        json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        while len(json_bytes) % 4:
            json_bytes += b" "
        bin_bytes = bytes(self.blob)
        while len(bin_bytes) % 4:
            bin_bytes += b"\x00"
        total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        with path.open("wb") as f:
            f.write(struct.pack("<4sII", b"glTF", 2, total))
            f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
            f.write(json_bytes)
            f.write(struct.pack("<I4s", len(bin_bytes), b"BIN\x00"))
            f.write(bin_bytes)


def build_sprite_mesh(part, tex_size):
    tw, th = tex_size
    w, h, px, py, ppu = part["w"], part["h"], part["px"], part["py"], part["ppu"]
    # local quad in Unity units (same as rh.pose)
    verts = np.array(
        [
            [-px * w, -py * h, 0],
            [(1 - px) * w, -py * h, 0],
            [(1 - px) * w, (1 - py) * h, 0],
            [-px * w, (1 - py) * h, 0],
        ],
        np.float32,
    ) / ppu
    if part["flip_x"]:
        verts[:, 0] *= -1
    if part["flip_y"]:
        verts[:, 1] *= -1
    # glTF / Three.js: V=0 at texture bottom (Unity sprite y is also from bottom)
    # Inset half-texel to prevent atlas bleed (black lines / muddy edges)
    x, y = part["x"], part["y"]
    pad = 0.75
    u0, u1 = (x + pad) / tw, (x + w - pad) / tw
    v0, v1 = (y + pad) / th, (y + h - pad) / th
    uvs = np.array([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], np.float32)
    # Stable 2D layering in local Z (parent rotations for SD are mostly planar)
    z = float(part["order"]) * 1e-4
    verts[:, 2] = z
    indices = np.array([0, 1, 2, 0, 2, 3], np.uint16)
    return verts, uvs, indices


def build_skinned_bind(mesh, bone_count, mesh_scale):
    """Expand corners to unique verts with joint/weight attrs (max 4 influences).

    Three.js: skinned = boneWorld @ IBM @ v
    Hirume:   skinned = boneWorld @ convert @ bind @ v_fbx
    => IBM = convert @ bind, v = v_fbx (bind AABB is large; frame in runtime).
    """
    v = np.array(mesh["vertices"], np.float32)
    uv_corner = np.array(mesh["uv"], np.float32)
    # Map corner -> vertex index for triangles already in mesh['triangles'] as corner indices
    # rh stores uv per corner (same length as indices), triangles index into corners.
    indices_corner = np.array(mesh["indices"], int)
    # Build per-vertex joint lists from clusters
    infl = [[] for _ in range(len(v))]
    for ci, cluster in enumerate(mesh["clusters"]):
        for vi, wt in zip(cluster["indices"], cluster["weights"]):
            infl[vi].append((ci, wt))

    # Expand to corner verts (unique per corner for UV)
    positions = []
    uvs = []
    joints = []
    weights = []
    for corner, vi in enumerate(indices_corner):
        positions.append(v[vi])
        u = uv_corner[corner]
        uvs.append([float(u[0]), 1.0 - float(u[1])])  # V flip for glTF
        infl_sorted = sorted(infl[vi], key=lambda x: -x[1])[:4]
        js = [0, 0, 0, 0]
        ws = [0, 0, 0, 0]
        for k, (ji, wt) in enumerate(infl_sorted):
            js[k] = ji
            ws[k] = wt
        s = sum(ws) or 1.0
        ws = [w / s for w in ws]
        joints.append(js)
        weights.append(ws)

    tri_idx = []
    for tri in mesh["triangles"]:
        tri_idx.extend(tri)
    return (
        np.array(positions, np.float32),
        np.array(uvs, np.float32),
        np.array(tri_idx, np.uint16),
        np.array(joints, np.uint16),
        np.array(weights, np.float32),
    )


def export(clips_wanted, fps, out_path: Path):
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

    # Bind from idle t=0
    bind_trs, bind_parts = pose_state(clips[clips_wanted[0]], 0.0)

    # Stable transform order
    tf_ids = list(rh.tfs.keys())
    tid_to_node = {tid: i for i, tid in enumerate(tf_ids)}

    writer = GlbWriter()
    mesh_scale = rh.mesh_scale
    convert = np.diag([-mesh_scale, mesh_scale, mesh_scale, 1.0])

    # Unique parts by (kind, name, mesh/sprite identity) at bind — one mesh node attachment
    # Attach mesh to renderer transform node.
    part_mesh_nodes = []  # metadata for runtime sorting
    skins_for_parts = []

    # Pre-add textures
    for p in bind_parts:
        writer.add_texture(Path(p["tex"]))

    # Create nodes for all transforms
    for tid in tf_ids:
        trs = bind_trs[tid]
        node = {
            "name": rh.name(tid),
            "translation": trs["t"],
            "rotation": trs["r"],
            "scale": trs["s"],
            "extras": {"tid": tid, "path": rh.paths[tid]},
        }
        writer.nodes.append(node)

    # Parent links
    root_nodes = []
    for tid in tf_ids:
        parent = rh.tfs[tid]["m_Father"]["fileID"]
        ni = tid_to_node[tid]
        if parent and parent in tid_to_node:
            pni = tid_to_node[parent]
            writer.nodes[pni].setdefault("children", []).append(ni)
        else:
            root_nodes.append(ni)

    # Attach meshes
    skinned_mounts = []  # identity nodes under HirumeRoot (avoid double-transform)
    for part in bind_parts:
        tid = part["tid"]
        ni = tid_to_node[tid]
        tex_key = part["tex"]
        _, mat_index, tex_size = writer.add_texture(Path(tex_key))
        if part["kind"] == "sprite":
            # flip baked at bind; animated flip handled poorly — resample mesh rare
            verts, uvs, indices = build_sprite_mesh(part, tex_size)
            # Re-read flip from bind part only
            mesh_index = writer.add_mesh_triangles(
                part["name"],
                verts,
                uvs,
                indices,
                mat_index,
                extras={"sortingOrder": part["order"], "kind": "sprite"},
            )
            # If node already has mesh, create child node
            if "mesh" in writer.nodes[ni] or "skin" in writer.nodes[ni]:
                child = {
                    "name": part["name"] + "_mesh",
                    "mesh": mesh_index,
                    "extras": {"sortingOrder": part["order"]},
                }
                writer.nodes.append(child)
                writer.nodes[ni].setdefault("children", []).append(len(writer.nodes) - 1)
                part_mesh_nodes.append(len(writer.nodes) - 1)
            else:
                writer.nodes[ni]["mesh"] = mesh_index
                writer.nodes[ni]["extras"]["sortingOrder"] = part["order"]
                part_mesh_nodes.append(ni)
        else:
            mesh = rh.rig[part["meshname"]]
            positions, uvs, indices, joints, weights = build_skinned_bind(
                mesh, len(part["bone_ids"]), mesh_scale
            )
            # IBM = convert @ bindCluster (matches render_native_hirume skinning)
            ibm_f = []
            for cluster in mesh["clusters"]:
                m = convert @ np.array(cluster["bind"], float)
                ibm_f.append(m.flatten(order="F").tolist())
            ibm_bytes = np.array(ibm_f, np.float32).tobytes()
            ibm_view = writer.add_bin(ibm_bytes)
            ibm_acc = writer.add_accessor(ibm_view, len(mesh["clusters"]), 5126, "MAT4")

            joint_nodes = [tid_to_node[b] for b in part["bone_ids"]]
            skin_index = len(writer.skins)
            writer.skins.append(
                {
                    "joints": joint_nodes,
                    "inverseBindMatrices": ibm_acc,
                    "skeleton": joint_nodes[0] if joint_nodes else ni,
                }
            )
            mesh_index = writer.add_skinned_mesh(
                part["name"],
                positions,
                uvs,
                indices,
                joints,
                weights,
                mat_index,
                extras={"sortingOrder": part["order"], "kind": "skinned"},
            )
            # IMPORTANT: skinned verts are already bone-world posed in shader.
            # Parent under identity mount (not renderer tid) to avoid double transform.
            mount = {
                "name": part["name"],
                "mesh": mesh_index,
                "skin": skin_index,
                "translation": [0.0, 0.0, float(part["order"]) * 1e-4],
                "rotation": [0.0, 0.0, 0.0, 1.0],
                "scale": [1.0, 1.0, 1.0],
                "extras": {
                    "sortingOrder": part["order"],
                    "kind": "skinned",
                    "visibilityTid": tid,
                },
            }
            writer.nodes.append(mount)
            mount_idx = len(writer.nodes) - 1
            skinned_mounts.append({"node": mount_idx, "tid": tid})
            part_mesh_nodes.append(mount_idx)
            skins_for_parts.append(skin_index)

    # Animations
    meta_clips = {}
    for key, clip in clips.items():
        duration = clip["m_AnimationClipSettings"]["m_StopTime"]
        count = max(2, math.ceil(duration * fps))
        times = [duration * i / count for i in range(count)]
        # Sample all node TRS
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
            # quaternion continuity
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

        # Skinned mounts: identity TRS, scale driven by renderer visibility
        for link in skinned_mounts:
            mount_ni = link["node"]
            tid = link["tid"]
            s_vis = []
            for i in range(len(times)):
                # S[tid] already ~1e-4 when invisible
                src = S[tid][i]
                alive = float(np.linalg.norm(src) > 1e-3)
                s_vis.append([alive, alive, alive])
            s_data = np.array(s_vis, np.float32)
            view = writer.add_bin(s_data.tobytes())
            acc = writer.add_accessor(view, len(times), 5126, "VEC3")
            si = len(samplers)
            samplers.append({"input": time_acc, "output": acc, "interpolation": "STEP"})
            channels.append({"sampler": si, "target": {"node": mount_ni, "path": "scale"}})

        writer.animations.append({"name": key, "samplers": samplers, "channels": channels})
        info = {"frames": count, "fps": fps, "duration": duration}
        if key.startswith("skill"):
            hit = next(
                (
                    e["time"]
                    for e in clip["m_Events"]
                    if e["functionName"] in ("EventHit", "EventThrowEffectGround")
                ),
                None,
            )
            if hit is not None:
                info["hitTime"] = hit
        meta_clips[key] = info
        print(f"{key}: {count} keys @ {fps}fps ({duration:.2f}s)", flush=True)

    meta = {
        "source": "Unity prefab + FBX + Puppet2D IK + clips -> glTF",
        "character": "hirume",
        "clips": meta_clips,
        "partNodes": part_mesh_nodes,
    }
    # Wrap under a root that faces camera (Unity Y-up, view from +Z)
    root = {
        "name": "HirumeRoot",
        "children": root_nodes + [s["node"] for s in skinned_mounts],
        "rotation": mat3_to_quat(np.eye(3)),  # identity
        "scale": [1, 1, 1],
    }
    writer.nodes.append(root)
    root_index = len(writer.nodes) - 1

    gltf = writer.finish([root_index], meta)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    writer.write(out_path, gltf)
    (out_path.with_suffix(".meta.json")).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    mb = out_path.stat().st_size / (1024 * 1024)
    print(f"Wrote {out_path} ({mb:.2f} MB)", flush=True)
    return out_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fps", type=float, default=12.0)
    ap.add_argument("--clips", default="idle,move,skill1")
    ap.add_argument("--out", default=str(OUT_DIR / "hirume.glb"))
    args = ap.parse_args()
    clips = [c.strip() for c in args.clips.split(",") if c.strip()]
    export(clips, args.fps, Path(args.out))


if __name__ == "__main__":
    main()
