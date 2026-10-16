"""Bake monster idle/move/die frames from SpriteRenderer prefabs (no FBX needed).

Many LAO MP monsters are Puppet2D/sprite hierarchies; their FBX only holds a few
helper meshes. This baker composites enabled SpriteRenderer parts using prefab
bind pose + AnimationClip transform curves.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

import bake_sd_character as bake

MONSTER_MODEL_ROOT = Path(
    r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets\AssetBundleResourceSub\Character"
)
MONSTER_PREFAB_ROOT = Path(
    r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets\AssetBundleResource\monster"
)
OUT_ROOT = Path(__file__).resolve().parents[1] / "assets" / "sd_baked"
CONTENT_BOX_PAD = 4

MONSTERS = {
    # --- Digital / Program ---
    "programmob_an": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_ProgramMobAN_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_ProgramMobAN_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "programmob_as": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_ProgramMobAS_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_ProgramMobAS_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    # --- Insectoid ---
    "wasp": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Wasp_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Wasp_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "scarab": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Scarab_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Scarab_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "deathstalker": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_DeathStalker_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_DeathStalker_N.prefab",
        "clips": {"idle": "Idle1", "move": "Move", "die": "Die"},
    },
    # --- Chick family ---
    "nightchick": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_NightChick_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_NightChick_N.prefab",
        "clips": {
            "idle": "MP_Night_chicken_Stand_1_loop",
            "move": "MP_Night_chicken_move",
            "die": "MP_Night_chicken_die_01",
        },
    },
    "bigchick": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_BigChick_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_BigChick_N.prefab",
        "clips": {
            "idle": "MP_Night_chicken_Stand_1_loop_big",
            "move": "MP_Night_chicken_move_big",
            "die": "MP_Night_chicken_die_big",
        },
    },
    # --- Mech / armor ---
    "scout": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Scout_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Scout_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "legion": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Legion_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Legion_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    # --- Horror / boss ---
    "doomeater": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_DoomEater_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_DoomEater_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    # --- Stage midbosses / bosses (5-act roster) ---
    "spector": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Spector_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Spector_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "predator": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Predator_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Predator_B0208.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "tarantula": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Tarantula_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Tarantula_N.prefab",
        "clips": {"idle": "turret_idle", "move": "turret_move", "die": "turret_die"},
    },
    "nestchaser": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_NestChaser_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_NestChaser_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "emperorchick": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_EmperorChick_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_EmperorChick_N.prefab",
        "clips": {
            "idle": "MP_EmperorChick_Stand_1_loop 1",
            "move": "MP_EmperorChick_move 1",
            "die": "MP_EmperorChick_die",
        },
    },
    "juggernaut": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Juggernaut_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Juggernaut_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "destroyer": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Destroyer_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Destroyer_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "harvester": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Harvester_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Harvester_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    # More grunt variety (user: too few monster types).
    "impet": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Impet_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Impet_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "tracker": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Tracker_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Tracker_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "slasher": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Slasher_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Slasher_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "phalangites": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Phalangites_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Phalangites_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "intruder": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Intruder_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Intruder_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "testudo": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Testudo_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Testudo_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    # --- Named mobs (one before / one after each midboss) ---
    "predator_ew": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Predator_EW",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Predator_EW.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "nest": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Nest_B07",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Nest_B07.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "ravager": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Ravager",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Ravager.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "dreadlurker": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Dreadlurker_BOSS_IW_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Dreadlurker_BOSS_IW_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "demolisher": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Demolisher_BOSS_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Demolisher_BOSS_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "stalker": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Stalker_EW",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Stalker_EW.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "kidnapper": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Kidnapper_V2",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Kidnapper_V2.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "charybdis": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Charybdis_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Charybdis_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "efreeti": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Efreeti_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Efreeti_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "executioner": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Executioner_EW",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Executioner_EW.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "centurion": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Centurion_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Centurion_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "tyrant": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Tyrant_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Tyrant_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "mammoth": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Mammoth_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Mammoth_N.prefab",
        "clips": {"idle": "idle1", "move": "move", "die": "die"},
    },
    "vargr": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Vargr_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Vargr_N.prefab",
        "clips": {"idle": "Idle1", "move": "Move", "die": "Die"},
    },
    "chiller": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Chiller_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Chiller_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "tortoise": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Tortoise_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Tortoise_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "frostbite": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_Frostbite_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_Frostbite_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
    "nestguardian": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_NestGuardian_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_NestGuardian_N.prefab",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    "lightningbomber": {
        "model": MONSTER_MODEL_ROOT / "Model_MP_LightningBomber_N",
        "prefab": MONSTER_PREFAB_ROOT / "Model_MP_LightningBomber_N.prefab",
        "clips": {"idle": "stand_1", "move": "move", "die": "die"},
    },
}


def rot_to_mat2(r):
    """Extract 2D XY rotation from baker rot (3x3 matrix or xyzw quat-like)."""
    r = np.asarray(r, dtype=np.float64)
    if r.shape == (3, 3):
        # Column0 is local X in world; use atan2 of that for 2D.
        return np.array([[r[0, 0], r[0, 1]], [r[1, 0], r[1, 1]]], dtype=np.float64)
    if r.shape == (4,):
        x, y, z, w = r
        siny_cosp = 2 * (w * z + x * y)
        cosy_cosp = 1 - 2 * (y * y + z * z)
        ang = math.atan2(siny_cosp, cosy_cosp)
        c, s = math.cos(ang), math.sin(ang)
        return np.array([[c, -s], [s, c]], dtype=np.float64)
    raise TypeError(f"unexpected rot shape {r.shape}")


def mat_mul(a, b):
    return a @ b


class SpriteMonsterBaker:
    def __init__(self, key: str, cfg: dict, size: int = 512):
        self.key = key
        self.cfg = cfg
        self.size = size
        self.model_path = Path(cfg["model"])
        self.prefab_path = Path(cfg["prefab"])

        self.anim_dir = self.model_path / "animation"
        if not self.anim_dir.exists():
            for n in ("Animation", "animations", "Animations"):
                if (self.model_path / n).exists():
                    self.anim_dir = self.model_path / n
                    break

        self.mat_dirs = []
        for n in ("Materials", "materials", "Material", "material"):
            p = self.model_path / n
            if p.exists():
                self.mat_dirs.append(p)

        self.docs = bake.documents(self.prefab_path)
        self.gos = {i: d["GameObject"] for i, d in self.docs.items() if "GameObject" in d}
        self.tfs = {i: d["Transform"] for i, d in self.docs.items() if "Transform" in d}
        self.go_tf = {d["m_GameObject"]["fileID"]: i for i, d in self.tfs.items()}
        self.srs = {
            d["SpriteRenderer"]["m_GameObject"]["fileID"]: d["SpriteRenderer"]
            for i, d in self.docs.items()
            if "SpriteRenderer" in d
        }

        self.sprites = {}
        self.ppus = {}
        self._tex_cache = {}
        for mat_dir in self.mat_dirs:
            for meta in mat_dir.glob("*.png.meta"):
                tex = Path(str(meta)[:-5])
                if not tex.exists():
                    continue
                self.sprites.update(bake.parse_sprites(meta, tex))
                ti = yaml.safe_load(meta.read_text(encoding="utf8")).get("TextureImporter") or {}
                self.ppus[tex] = float(ti.get("spritePixelsToUnits") or 100)

        self._build_paths()
        print(
            f"[{key}] sprites={len(self.sprites)} sr={len(self.srs)} "
            f"tf={len(self.tfs)} anim={self.anim_dir.name}",
            flush=True,
        )

    def name(self, tid):
        gid = self.tfs[tid]["m_GameObject"]["fileID"]
        return self.gos[gid]["m_Name"]

    def path(self, tid, _seen=None):
        if _seen is None:
            _seen = set()
        if tid in _seen or tid not in self.tfs:
            return self.name(tid) if tid in self.tfs else "?"
        _seen.add(tid)
        father = (self.tfs[tid].get("m_Father") or {}).get("fileID") or 0
        if not father or father not in self.tfs:
            return self.name(tid)
        return self.path(father, _seen) + "/" + self.name(tid)

    def _build_paths(self):
        self.paths = {i: self.path(i) for i in self.tfs}
        self.byname = {}
        for i in self.tfs:
            self.byname[self.name(i)] = i
            self.byname.setdefault(self.paths[i], i)

    def find_path(self, p):
        if p in self.byname and self.byname[p] in self.tfs:
            # byname may map short names; prefer full path match
            pass
        return next(
            (i for i, v in self.paths.items() if v.endswith("/" + p) or v == p), None
        )

    def load_clip(self, stem: str):
        matches = list(self.anim_dir.glob(f"{stem}.anim"))
        if not matches:
            matches = [
                p for p in self.anim_dir.glob("*.anim") if p.stem.lower() == stem.lower()
            ]
        if not matches:
            raise FileNotFoundError(f"Missing anim {stem} in {self.anim_dir}")
        return next(iter(bake.documents(matches[0]).values()))["AnimationClip"]

    def texture(self, path: Path):
        if path not in self._tex_cache:
            self._tex_cache[path] = np.array(Image.open(path).convert("RGBA"))
        return self._tex_cache[path]

    def lookup_sprite(self, file_id, guid):
        key = f"id:{file_id}|{guid}"
        if key in self.sprites:
            return self.sprites[key]
        # Some metas only expose legacy 213xxxxx ids.
        for k, v in self.sprites.items():
            if v.get("guid") == guid and k.startswith(f"id:{file_id}|"):
                return v
        return None

    def sample_pose(self, clip, time):
        pos = {i: bake.vector(d["m_LocalPosition"]) for i, d in self.tfs.items()}
        rot = {i: bake.quat(d["m_LocalRotation"]) for i, d in self.tfs.items()}
        scale = {i: bake.vector(d["m_LocalScale"]) for i, d in self.tfs.items()}
        active = {i: bool(d["m_IsActive"]) for i, d in self.gos.items()}

        if clip is not None:
            for key, target in [
                ("m_PositionCurves", pos),
                ("m_ScaleCurves", scale),
                ("m_EulerCurves", rot),
            ]:
                for c in clip.get(key, []) or []:
                    path = c.get("path")
                    if path is None:
                        continue
                    tid = self.find_path(path)
                    if tid is None:
                        continue
                    v = bake.sample(c["curve"], time)
                    target[tid] = bake.euler(v) if key == "m_EulerCurves" else v
            for c in clip.get("m_FloatCurves", []) or []:
                path = c.get("path")
                if path is None:
                    continue
                attr = (c.get("attribute") or "")
                tid = self.find_path(path)
                if tid is None:
                    continue
                raw = bake.sample(c["curve"], time)
                if isinstance(raw, (list, tuple, np.ndarray)):
                    v = float(np.asarray(raw).reshape(-1)[0])
                else:
                    v = float(raw)
                if attr == "m_IsActive":
                    gid = self.tfs[tid]["m_GameObject"]["fileID"]
                    active[gid] = v > 0.5
                elif "localEulerAnglesRaw.z" in attr or attr.endswith(".z"):
                    e = np.array([0.0, 0.0, v])
                    rot[tid] = bake.euler(e)

        return pos, rot, scale, active

    def world_trs(self, tid, pos, rot, scale, _cache=None):
        if _cache is None:
            _cache = {}
        if tid in _cache:
            return _cache[tid]
        father = (self.tfs[tid].get("m_Father") or {}).get("fileID") or 0
        local_p = pos[tid]
        local_r = rot_to_mat2(rot[tid])
        local_s = scale[tid]
        # 2D: use x,y and scale x,y
        S = np.diag([local_s[0], local_s[1]])
        M = local_r @ S
        T = local_p[:2]
        if father and father in self.tfs:
            Mw, Tw = self.world_trs(father, pos, rot, scale, _cache)
            M = Mw @ M
            T = Mw @ T + Tw
        _cache[tid] = (M, T)
        return _cache[tid]

    def is_hard_fx_name(self, name: str) -> bool:
        low = name.lower()
        tokens = (
            "shadow",
            "smoke",
            "fire",
            "fx",
            "bullet",
            "trail",
            "beam",
            "muzzle",
            "cicle",
            "circle",
            "white",
            "imp",
            "hit_fx",
        )
        if any(t in low for t in tokens):
            # Keep body weapon / gun parts
            if "gun" in low or "weapon" in low or "parts_" in low:
                return False
            return True
        return False

    def collect_draw_list(self, pos, rot, scale, active):
        items = []
        cache = {}
        for gid, sr in self.srs.items():
            if not sr.get("m_Enabled", 1):
                continue
            if not active.get(gid, True):
                continue
            # ancestor inactive?
            tid = self.go_tf.get(gid)
            if tid is None:
                continue
            walk = tid
            dead = False
            seen = set()
            while walk and walk in self.tfs and walk not in seen:
                seen.add(walk)
                g2 = self.tfs[walk]["m_GameObject"]["fileID"]
                if not active.get(g2, True):
                    dead = True
                    break
                walk = (self.tfs[walk].get("m_Father") or {}).get("fileID") or 0
            if dead:
                continue

            name = self.gos[gid]["m_Name"]
            if self.is_hard_fx_name(name):
                continue

            sp = sr.get("m_Sprite") or {}
            entry = self.lookup_sprite(sp.get("fileID"), sp.get("guid"))
            if not entry:
                continue

            M, T = self.world_trs(tid, pos, rot, scale, cache)
            order = int(sr.get("m_SortingOrder") or 0)
            color = sr.get("m_Color") or {}
            flip_x = bool(sr.get("m_FlipX"))
            flip_y = bool(sr.get("m_FlipY"))
            items.append(
                {
                    "entry": entry,
                    "M": M,
                    "T": T,
                    "order": order,
                    "path": self.paths.get(tid, name),
                    "color": (
                        float(color.get("r", 1)),
                        float(color.get("g", 1)),
                        float(color.get("b", 1)),
                        float(color.get("a", 1)),
                    ),
                    "flip_x": flip_x,
                    "flip_y": flip_y,
                }
            )
        items.sort(key=lambda x: (x["order"], x["path"]))
        return items

    def sprite_quads(self, items):
        """World-space quads for each drawable sprite (Unity y-up)."""
        quads = []
        for it in items:
            e = it["entry"]
            ppu = self.ppus.get(e["tex"], 100.0) or 100.0
            w = e["w"] / ppu
            h = e["h"] / ppu
            px, py = e["pivot"]
            # local corners relative to pivot (Unity sprite: pivot in [0,1])
            x0, x1 = -px * w, (1 - px) * w
            y0, y1 = -py * h, (1 - py) * h
            if it["flip_x"]:
                x0, x1 = -x1, -x0
            if it["flip_y"]:
                y0, y1 = -y1, -y0
            local = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=np.float64)
            world = (it["M"] @ local.T).T + it["T"]
            quads.append(world)
        return quads

    def world_aabb(self, items):
        """Tight world AABB of body sprites (no pad)."""
        quads = self.sprite_quads(items)
        if not quads:
            return None
        all_c = np.concatenate(quads, axis=0)
        return all_c.min(axis=0), all_c.max(axis=0)

    def render_frame(self, items, bounds=None):
        if not items:
            raise RuntimeError(f"[{self.key}] no drawable sprites")

        quads = self.sprite_quads(items)
        all_c = np.concatenate(quads, axis=0)
        min_xy = all_c.min(axis=0)
        max_xy = all_c.max(axis=0)
        if bounds is None:
            pad = 0.12 * max(max_xy - min_xy)
            min_xy = min_xy - pad
            max_xy = max_xy + pad
        else:
            min_xy, max_xy = bounds

        span = np.maximum(max_xy - min_xy, 1e-4)
        scale = (self.size * 0.92) / float(max(span))
        # Center in canvas
        origin = (min_xy + max_xy) * 0.5

        canvas = np.zeros((self.size, self.size, 4), dtype=np.float32)
        for it, world in zip(items, quads):
            e = it["entry"]
            tex = self.texture(e["tex"]).astype(np.float32) / 255.0
            # Unity rect y is bottom-left
            th, tw = tex.shape[0], tex.shape[1]
            x, y, w, h = e["x"], e["y"], e["w"], e["h"]
            r0 = th - (y + h)
            r1 = th - y
            patch = tex[r0:r1, x : x + w].copy()
            if patch.size == 0:
                continue
            cr, cg, cb, ca = it["color"]
            patch[:, :, 0] *= cr
            patch[:, :, 1] *= cg
            patch[:, :, 2] *= cb
            patch[:, :, 3] *= ca

            # Affine: map patch pixel -> world -> canvas
            # Destination quad in canvas pixels (x right, y down)
            dst = np.zeros((4, 2), dtype=np.float64)
            # world corners order: bl, br, tr, tl in Unity y-up
            # canvas y-down: flip y
            for i, (wx, wy) in enumerate(world):
                cx = (wx - origin[0]) * scale + self.size * 0.5
                cy = -(wy - origin[1]) * scale + self.size * 0.5
                dst[i] = (cx, cy)

            # PIL needs coeffs mapping output->input; use Inverse of dst->src
            src = np.array([[0, h], [w, h], [w, 0], [0, 0]], dtype=np.float64)
            try:
                coeffs = _find_coeffs(dst, src)
            except Exception:
                continue
            layer = Image.fromarray((np.clip(patch, 0, 1) * 255).astype(np.uint8), "RGBA")
            warped = layer.transform(
                (self.size, self.size), Image.PERSPECTIVE, coeffs, Image.BILINEAR
            )
            arr = np.array(warped).astype(np.float32) / 255.0
            # premultiplied over
            a = arr[:, :, 3:4]
            canvas[:, :, :3] = canvas[:, :, :3] * (1 - a) + arr[:, :, :3] * a
            canvas[:, :, 3:4] = canvas[:, :, 3:4] + a * (1 - canvas[:, :, 3:4])

        out = (np.clip(canvas, 0, 1) * 255).astype(np.uint8)
        return out, (min_xy.copy(), max_xy.copy())

    def content_box(self, img: np.ndarray):
        a = img[:, :, 3]
        ys, xs = np.where(a > 12)
        if len(xs) == 0:
            return {"x": 0, "y": 0, "w": self.size, "h": self.size}
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        pad = CONTENT_BOX_PAD
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(self.size - 1, x1 + pad)
        y1 = min(self.size - 1, y1 + pad)
        return {"x": x0, "y": y0, "w": x1 - x0 + 1, "h": y1 - y0 + 1}

    def clip_frame_plan(self, clips):
        """Frame times for every baked clip (idle/move/die)."""
        SAMPLE_FPS = 24
        max_frames = {"idle": 72, "move": 48, "die": 48}
        plan = {}
        for ck in ("idle", "move", "die"):
            clip = clips.get(ck)
            if clip is None:
                plan[ck] = {"clip": None, "dur": 0.0, "times": [0.0]}
                continue
            dur = float(clip["m_AnimationClipSettings"]["m_StopTime"])
            count = max(1, min(max_frames[ck], math.ceil(dur * SAMPLE_FPS)))
            times = [dur * i / count for i in range(count)]
            plan[ck] = {"clip": clip, "dur": dur, "times": times}
        return plan

    def bake(self):
        out_dir = OUT_ROOT / self.key / "native"
        out_dir.mkdir(parents=True, exist_ok=True)

        clips = {}
        for ck, stem in self.cfg["clips"].items():
            try:
                clips[ck] = self.load_clip(stem)
                print(f"[{self.key}] clip {ck}: {stem}", flush=True)
            except FileNotFoundError as e:
                print(f"[{self.key}] WARN {e}", flush=True)
                clips[ck] = None

        plan = self.clip_frame_plan(clips)

        # Shared world camera = UNION of body silhouette across ALL frames of
        # idle+move+die. Idle-only fit clips die/move limbs that leave that box;
        # per-clip auto-fit also jumps on-screen scale. One AABB fixes both.
        bound_mins = []
        bound_maxs = []
        for ck, info in plan.items():
            for t in info["times"]:
                pos, rot, scale, active = self.sample_pose(info["clip"], t)
                items = self.collect_draw_list(pos, rot, scale, active)
                if not items:
                    continue
                aabb = self.world_aabb(items)
                if aabb is None:
                    continue
                bound_mins.append(aabb[0])
                bound_maxs.append(aabb[1])
        if bound_mins:
            mins = np.min(np.stack(bound_mins), axis=0)
            maxs = np.max(np.stack(bound_maxs), axis=0)
            pad = 0.15 * np.maximum(maxs - mins, 1e-4)
            shared_bounds = (mins - pad, maxs + pad)
            span = maxs - mins
            print(
                f"[{self.key}] shared AABB (idle+move+die all frames)="
                f"({span[0]:.3f}x{span[1]:.3f}) +pad15%",
                flush=True,
            )
        else:
            shared_bounds = None
            print(f"[{self.key}] WARN no shared AABB - per-frame fit", flush=True)

        manifest = {
            "source": f"sprite-composite bake ({self.prefab_path.name})",
            "size": self.size,
            "idle": [],
            "move": [],
            "die": [],
        }
        # Pixel contentBox = union of opaque pixels across ALL baked frames so
        # runtime crop never cuts die/move body that left the idle silhouette.
        all_boxes = []
        SAMPLE_FPS = 24

        for ck, info in plan.items():
            times = info["times"]
            dur = info["dur"]
            clip = info["clip"]
            # Clear stale frames from prior lower-fps bakes
            for old in out_dir.glob(f"{ck}_*.png"):
                old.unlink()
            paths = []
            for i, t in enumerate(times):
                pos, rot, scale, active = self.sample_pose(clip, t)
                items = self.collect_draw_list(pos, rot, scale, active)
                frame, _ = self.render_frame(items, shared_bounds)
                rel = f"native/{ck}_{i:03d}.png"
                Image.fromarray(frame).save(OUT_ROOT / self.key / rel)
                paths.append(rel)
                # Sample every frame into contentBox union (cheap alpha scan).
                all_boxes.append(self.content_box(frame))
            manifest[ck] = paths
            if clip is None:
                manifest[f"{ck}Fps"] = SAMPLE_FPS
                manifest[f"{ck}Duration"] = 0.0
                print(f"[{self.key}] {ck}: 1 bind frame", flush=True)
            else:
                count = len(times)
                manifest[f"{ck}Fps"] = count / max(dur, 1e-6)
                manifest[f"{ck}Duration"] = dur
                print(
                    f"[{self.key}] {ck}: {count} frames "
                    f"(dur={dur:.3f}s fps={manifest[f'{ck}Fps']:.2f})",
                    flush=True,
                )

        xs = [b["x"] for b in all_boxes]
        ys = [b["y"] for b in all_boxes]
        x2 = [b["x"] + b["w"] for b in all_boxes]
        y2 = [b["y"] + b["h"] for b in all_boxes]
        manifest["contentBox"] = {
            "x": int(min(xs)),
            "y": int(min(ys)),
            "w": int(max(x2) - min(xs)),
            "h": int(max(y2) - min(ys)),
        }
        print(
            f"[{self.key}] contentBox="
            f"{manifest['contentBox']['w']}x{manifest['contentBox']['h']}"
            f" @ ({manifest['contentBox']['x']},{manifest['contentBox']['y']})"
            f" (union idle+move+die)",
            flush=True,
        )
        (OUT_ROOT / self.key / "anim.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf8"
        )
        print(f"[{self.key}] done -> {OUT_ROOT / self.key}", flush=True)


def _find_coeffs(dst, src):
    """Perspective coeffs mapping dst quad -> src quad for PIL."""
    matrix = []
    for (x, y), (u, v) in zip(dst, src):
        matrix.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        matrix.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(matrix, dtype=np.float64)
    B = np.array(src, dtype=np.float64).reshape(8)
    res = np.linalg.lstsq(A, B, rcond=None)[0]
    return res.tolist()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--monster", choices=list(MONSTERS))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--size", type=int, default=512)
    args = ap.parse_args()

    keys = list(MONSTERS) if args.all or not args.monster else [args.monster]
    failures = []
    for key in keys:
        try:
            SpriteMonsterBaker(key, MONSTERS[key], size=args.size).bake()
        except Exception as e:
            failures.append((key, str(e)))
            print(f"[{key}] FAILED: {e}", flush=True)
            import traceback

            traceback.print_exc()
    if failures:
        print("FAILURES:", failures, flush=True)
        sys.exit(1)
    print("ALL OK", flush=True)


if __name__ == "__main__":
    main()
