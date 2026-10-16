"""Bake native PNG clips for LAO SD characters into assets/sd_baked/{key}/.

Reuses Skin_3P_Hirume_R1 tools (fbx_binary) + Unity prefab/anim YAML pose + cv2 raster.
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import numpy as np
import cv2
import yaml
from PIL import Image

HIRUME_TOOLS = Path(r"E:\LAO_WEB_GAME\Skin_3P_Hirume_R1\tools")
sys.path.insert(0, str(HIRUME_TOOLS))
from fbx_binary import read as fbx_read, child as fbx_child  # noqa: E402

CHAR_ROOT = Path(
    r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets\AssetBundleResource\Character"
)
OUT_ROOT = Path(__file__).resolve().parents[1] / "assets" / "sd_baked"
SIZE = 768
# Framing pad around posed AABB (fraction of span). Wide tails/horns/ribbons
# need more than a tight 4% or tips get raster-clipped against the square canvas.
BOUNDS_PAD = 0.20
# Unity sprite meta rects are often 1–2px tight; only pad tiny bleed.
# Large expands pull neighboring atlas sprites (floating horn/hair debris).
SPRITE_ALPHA_EXPAND = 2
SPRITE_ALPHA_THR = 12
# Pixel-space pad written into anim.json contentBox (matches clip-anim.js).
CONTENT_BOX_PAD = 4
# Death poses collapse/slide beyond the locomotion camera. Bake die on a canvas this
# much larger with the camera span widened by the same factor (identical px scale);
# anim.json "dieOffset" lets the packer map frames back into SIZE coordinates.
DIE_CANVAS_SCALE = 2.0
# Skill clips: locomotion scale, body-centred, on a wider canvas (anim.json "skillOffset").
SKILL_CANVAS_SCALE = 1.5
# True detached FX / props — excluded from bounds AND skipped when rasterizing.
# Do NOT put blanket "skill"/"skil"/"wing" here: Fafnir Skill*_Tail / Wing_* are
# body silhouette pieces and were getting clipped when those tokens matched.
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
    # Merlin skill spawns detached gun / drone / carrier meshes far from body.
    "_box_",
    "box_skinned",
    "gun_",
    "dron",
    "drone",
)
# Silhouette tokens that override hard-FX name collisions (Skill1_Tail, Wing_*).
_BODY_SILHOUETTE_TOKENS = (
    "tail",
    "taill",
    "wing",
    "hair",
    "horn",
    "coat",
    "skirt",
    "baton",
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
    "shoe",
    "acc",
    "ribbon",
    "cloth",
    "dress",
    "cape",
    "cloak",
    "weist",
    "waist",
)

CHARACTERS = {
    "constantia": {
        "char_dir": "Char_3P_ConstantiaS2_N",
        "model": "Model_3P_ConstantiaS2_N",
        "prefab": "Model_3P_ConstantiaS2_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "stand",
            "move": "move",
            "skill1": "Attack_01",
            "skill2": "Attack_02",
            "die": "die",
        },
        # Attack_01 swaps eye_L -> eye_L2 (wink line). Die disables parent
        # `eye` (eye_set/eye) and enables eye_>< — empty glasses, no irises.
        # Mini-action wants both irises visible like stand/move.
        "pin_open_eyes": True,
    },
    "lrl": {
        "char_dir": "Char_PECS_LRL_N",
        "model": "Model_PECS_LRL_N",
        "prefab": "Model_PECS_LRL_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "idle1",
            "move": "move",
            "skill1": "skill1",
            "skill2": "skill2",
            "die": "die",
        },
    },
    "merlin": {
        "char_dir": "Char_PECS_Merlin_N",
        "model": "Model_PECS_Merlin_N",
        "prefab": "Model_PECS_Merlin_N.prefab",
        "materials": "materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "Idle1",
            "move": "Move",
            "skill1": "Skill1",
            "skill2": "Skill2",
            "die": "Die",
        },
    },
    "fafnir": {
        "char_dir": "Char_BR_Fafnir_N",
        "model": "Model_BR_Fafnir_N",
        "prefab": "Model_BR_Fafnir_N.prefab",
        "materials": "materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "Idle1",
            "move": "Move",
            "skill1": "Skill1",
            "skill2": "Skill2",
            "die": "Die",
        },
    },
    # Rare Random-slot characters — idle / move / die only (skill1/2 unused in mini-action).
    "eternity": {
        "char_dir": "Char_3P_Eternity_N",
        "model": "Model_3P_Eternity_N",
        "prefab": "Model_3P_Eternity_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "Idle_1",
            "move": "Move",
            "die": "Die",
        },
    },
    # Constantia's Bori (FX_hit_bori: paper-doll dog spawned by Attack_02 EventThrowEffect),
    # baked from the FX prefab + fx_Hit_bori.anim with the Bori mesh/materials.
    "bori": {
        "char_dir": "Char_3P_ConstantiaS2_N",
        "model": "FX_hit_bori",
        "model_abs": "E:/LAO/Google_QA/Assets/AssetBundleResource/Character/Char_3P_ConstantiaS2_N/Model_3P_ConstantiaS2_N",
        "prefab_abs": "E:/LAO/Google_QA/Assets/AssetBundleResource/FX/FX_hit_bori.prefab",
        "anim_dir_abs": "E:/LAO/Google_QA/Assets/AssetBundleResourceSub/FX/animation",
        "materials": "Materials",
        "fbx_glob": "3D_mesh/mesh_3P_Bori_N.[Ff][Bb][Xx]",
        "clips": {"idle": "fx_Hit_bori", "move": "fx_Hit_bori", "skill2": "fx_Hit_bori"},
        "keep_bori": True,
        # LO_bori_hide: material._change keys from fx_Hit_bori.anim (hidden until 0.88s,
        # materialise by 1.23s, dissolve away 1.38-2.25s).
        "dissolve": {
            "parts": ["bori_body", "bori_leg_B", "bori_leg_F"],
            "keys": [[0.8833333, 1], [1.2333333, 0], [1.3833333, 0], [2.25, 1]],
            "mask": "E:/LAO/Google_QA/Assets/AssetBundleResourceSub/FX/Texture/hexagon_Invisible.png",
            "ramp": "E:/LAO/Google_QA/Assets/AssetBundleResourceSub/Shader/SF_blue.png",
            "tiling": 5.52,
        },
        "frame_size_units": [16, 16],
        "skill_canvas_scale": 1.0,
    },
    # Peregrinus human form (her C transformation in the mini-action): Idle_1 / Move / Die.
    "peregrinus_human": {
        "char_dir": "Char_PECS_Peregrinus_N",
        "model": "Model_PECS_Peregrinus_N",
        "prefab": "Model_PECS_Peregrinus_N_CH.prefab",  # human-form defaults (upright)
        "materials": "materials",
        "sprites_only": True,
        "no_sprite_expand": True,
        "sprite_outline": True,
        "skip_parts": ["parts_Shadow"],
        # One camera for bird / human / change (union of all three, model units).
        "fixed_bounds": [-15.0, -6.5, 18.5, 24.2],
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die"},
    },
    # Peregrinus bird -> human transformation (bird_change_motion, 5.33s) baked as one
    # loop-less "idle" clip on the bird prefab; played once when her C fires.
    "peregrinus_change": {
        "char_dir": "Char_PECS_Peregrinus_N",
        "model": "Model_PECS_Peregrinus_N",
        "prefab": "Model_PECS_Peregrinus_N.prefab",
        "materials": "materials",
        "sprites_only": True,
        "no_sprite_expand": True,
        "sprite_outline": True,
        "skip_parts": ["parts_Shadow"],
        # One camera for bird / human / change (union of all three, model units).
        "fixed_bounds": [-15.0, -6.5, 18.5, 24.2],
        "clips": {"idle": "bird_change_motion", "move": "bird_change_motion"},
    },
    # Peregrinus human -> bird (change_motion, 6.45s) on the human-form prefab; played
    # when her human form runs out.
    "peregrinus_revert": {
        "char_dir": "Char_PECS_Peregrinus_N",
        "model": "Model_PECS_Peregrinus_N",
        "prefab": "Model_PECS_Peregrinus_N_CH.prefab",
        "materials": "materials",
        "sprites_only": True,
        "no_sprite_expand": True,
        "sprite_outline": True,
        "skip_parts": ["parts_Shadow"],
        # One camera for bird / human / change (union of all three, model units).
        "fixed_bounds": [-15.0, -6.5, 18.5, 24.2],
        "clips": {"idle": "change_motion", "move": "change_motion"},
    },
    # Peregrinus human-form Skil_2 (7.48s: charge, giant beam, back to the bird) - her X
    # in human form; baked as one "idle" clip on the shared camera.
    "peregrinus_hskill2": {
        "char_dir": "Char_PECS_Peregrinus_N",
        "model": "Model_PECS_Peregrinus_N",
        "prefab": "Model_PECS_Peregrinus_N_CH.prefab",
        "materials": "materials",
        "sprites_only": True,
        "no_sprite_expand": True,
        "sprite_outline": True,
        "skip_parts": ["parts_Shadow"],
        "fixed_bounds": [-15.0, -6.5, 18.5, 24.2],
        "clips": {"idle": "Skil_2", "move": "Skil_2"},
    },
    # Peregrinus bird-form bird_Skil_2 (4.5s: dive in, 8-hit flurry, fly back) - her X in
    # bird form; baked as one "idle" clip on the shared camera.
    "peregrinus_bskill2": {
        "char_dir": "Char_PECS_Peregrinus_N",
        "model": "Model_PECS_Peregrinus_N",
        "prefab": "Model_PECS_Peregrinus_N.prefab",
        "materials": "materials",
        "sprites_only": True,
        "no_sprite_expand": True,
        "sprite_outline": True,
        "skip_parts": ["parts_Shadow"],
        "fixed_bounds": [-15.0, -6.5, 18.5, 24.2],
        "clips": {"idle": "bird_Skil_2", "move": "bird_Skil_2"},
    },
    # Final boss bodies (the commander's face is drawn over the head by the game):
    # head parts hidden, head bone tracked per frame.
    "final_yimir": {
        "char_dir": "Char_PECS_Yimir_N", "model": "Model_PECS_Yimir_N",
        "prefab": "Model_PECS_Yimir_N.prefab", "materials": "materials",
        "skip_parts": ["parts_Head", "parts_Shadow"], "head_track": "Bone_Head",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die", "skill1": "Skil_1", "skill2": "Skil_2"},
    },
    "final_arachne": {
        "char_dir": "Char_AGS_Arachne_N", "model": "Model_AGS_Arachne_N",
        "prefab": "Model_AGS_Arachne_N.prefab", "materials": "Texture",
        "sprites_only": True, "no_sprite_expand": True, "sprite_outline": True,
        "skip_parts": ["Part_Head", "Part_Head_Light", "parts_Shadow"], "head_track": "Bone_Head",
        "clips": {"idle": "idle1", "move": "move", "die": "die", "skill1": "skill1", "skill2": "skill2"},
    },
    "final_roc": {
        "char_dir": "Char_AGS_Roc_N", "model": "Model_AGS_Roc_N",
        "prefab": "Model_AGS_Roc_N.prefab",
        "materials": "E:/LAO/Google_QA/Assets/AssetBundleResource/Character/Char_AGS_Roc_N/Model_AGS_Roc_N",
        "sprites_only": True, "no_sprite_expand": True, "sprite_outline": True,
        "skip_parts": ["parts_head", "parts_Shadow"], "head_track": "bone_head",
        "clips": {"idle": "stand_1", "move": "move", "die": "die", "skill1": "skill_1", "skill2": "skill_2"},
    },
    # Stage midbosses (bioroids as enemy leaders): idle / move / die only.
    "mid_triton": {
        "char_dir": "Char_PECS_Triton_N", "model": "Model_PECS_Triton_N",
        "prefab": "Model_PECS_Triton_N.prefab", "materials": "Texture",
        "sprites_only": True, "no_sprite_expand": True, "sprite_outline": True,
        "skip_parts": ["parts_Shadow"],
        "clips": {"idle": "stand", "move": "move", "die": "die", "skill1": "skill_1", "skill2": "skill_2"},
    },
    "mid_nidhogg": {
        "char_dir": "Char_PECS_Nidhogg_N", "model": "Model_PECS_Nidhogg_N",
        "prefab": "Model_PECS_Nidhogg_N.prefab", "materials": "Materials",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die", "skill1": "Skil_1", "skill2": "Skil_2"},
    },
    "mid_glacias": {
        "char_dir": "Char_PECS_Glacias_N", "model": "Model_PECS_Glacias_N",
        "prefab": "Model_PECS_Glacias_N.prefab", "materials": "Material",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die", "skill1": "Skil_1", "skill2": "Skil_2"},
    },
    "mid_goltarion": {
        "char_dir": "Char_AGS_Goltarion_N", "model": "Model_AGS_Goltarion_N",
        "prefab": "Model_AGS_Goltarion_N.prefab", "materials": "Material",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die", "skill1": "Skil_1", "skill2": "Skil_2"},
    },
    "mid_satgat": {
        "char_dir": "Char_3P_Satgat_N", "model": "Char_3P_Satgat_N",
        "prefab": "Model_3P_Satgat_N.prefab", "materials": "materials",
        "clips": {"idle": "Idle1", "move": "Move", "die": "Die", "skill1": "Skill1", "skill2": "Skill2"},
    },
    # Stage bosses (bioroids as enemy leaders): idle / move / die only.
    "boss_hachiko": {
        "char_dir": "Char_3P_Hachiko_N",
        "model": "Model_3P_Hachiko_N",
        "prefab": "Model_3P_Hachiko_N.prefab",
        "materials": "Materials",
        "fbx_abs": ["E:/LAO/Google_QA/Assets/AssetBundleResource/Character/Char_BR_AS12TurtleDragon_N/Model_BR_AS12TurtleDragon_N/3D_mesh/Model_BR_AS12TurtleDragon_N_mesh.FBX"],
        "clips": {"idle": "idle1", "move": "move", "die": "die", "skill1": "skill1", "skill2": "skill2"},
    },
    "boss_csperrault": {
        "char_dir": "Char_3P_CSPerrault_N",
        "model": "Model_3P_CSPerrault_N",
        "prefab": "Model_3P_CSPerrault_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D_mesh/*.[Ff][Bb][Xx]",
        "clips": {"idle": "idle1", "move": "move", "die": "die", "skill1": "skill1", "skill2": "skill2"},
    },
    "boss_snowfeather": {
        "char_dir": "Char_3P_SnowFeather_N",
        "model": "Model_3P_SnowFeather_N",
        "prefab": "Model_3P_SnowFeather_N.prefab",
        "materials": "3D/Materials",
        "clips": {"idle": "Idle_1", "move": "Move", "die": "Die", "skill1": "Skil_1", "skill2": "Skil_2"},
    },
    "boss_blacklilith": {
        "char_dir": "Char_3P_BlackLilith_N",
        "model": "Model_3P_BlackLilith_N",
        "prefab": "Model_3P_BlackLilith_N.prefab",
        "materials": "materials",
        "fbx_glob": "3d_mesh/*.[Ff][Bb][Xx]",
        "clips": {"idle": "idle1", "move": "move", "die": "die", "skill1": "skill1", "skill2": "skill2"},
    },
    # Peregrinus, bird form (bird_* clips). Sprite-only puppet: no FBX meshes exist.
    "peregrinus": {
        "char_dir": "Char_PECS_Peregrinus_N",
        "model": "Model_PECS_Peregrinus_N",
        "prefab": "Model_PECS_Peregrinus_N.prefab",
        "materials": "materials",
        "sprites_only": True,
        # Its atlases pack sprites edge to edge: growing rects by alpha pulled the head
        # into the tail sprite. The drop shadow is not drawn in the mini-action.
        "no_sprite_expand": True,
        "sprite_outline": True,
        "skip_parts": ["parts_Shadow"],
        # One camera for bird / human / change (union of all three, model units).
        "fixed_bounds": [-15.0, -6.5, 18.5, 24.2],
        "clips": {
            "idle": "bird_Idle_1",
            "move": "bird_Move",
            "skill1": "bird_Skil_1",
            "skill2": "bird_Skil_2",
            "die": "bird_Die",
        },
    },
    "labiata": {
        "char_dir": "Char_3P_Labiata_N",
        "model": "Model_3P_Labiata_N",
        "prefab": "Model_3P_Labiata_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "idle1",
            "move": "move",
            # 3P_Labiata_N.controller: anim_skill1 / anim_skill2 states.
            "skill1": "skill1",
            "skill2": "skill2",
            "die": "die",
        },
        "skill_center_exclude": ["weapon", "battery", "blade", "sword"],
        # The transformed sword reaches far past the 1.5x skill canvas.
        "skill_canvas_scale": 2.3,
        # Hand/foot IK CTRL objects are inactive in the prefab, but Puppet2D Global_CTRL
        # still solves them in game (sword raised, seated on the battery).
        "ik_ignore_ctrl_active": True,
    },
    "emily": {
        "char_dir": "Char_BR_Emily_N",
        "model": "Model_BR_Emily_N",
        "prefab": "Model_BR_Emily_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "idle1",
            "move": "move",
            "die": "die",
        },
    },
    "griffin": {
        "char_dir": "Char_BR_PA00EL_N",
        "model": "Model_BR_PA00EL_N",
        "prefab": "Model_BR_PA00EL_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D_mesh/*.[Ff][Bb][Xx]",
        "model_abs": r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_BR_PA00EL_N\Model_BR_PA00EL_N",
        "prefab_abs": r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_BR_PA00EL_N\Model_BR_PA00EL_N.prefab",
        "clips": {
            "idle": "stand",
            "move": "move_fly_jet",
            # SD_BR_PA00_L_N.controller: anim_skill1 / anim_skill2 states.
            "skill1": "attack_hand_missile",
            "skill2": "attack_hand_missile_skill",
            "die": "die",
        },
    },
    "sleipnir": {
        "char_dir": "Char_BR_Sleipnir_N",
        "model": "Model_BR_Sleipnir_N",
        "prefab": "Model_BR_Sleipnir_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D_Model/*.[Ff][Bb][Xx]",
        "model_abs": r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_BR_Sleipnir_N\Model_BR_Sleipnir_N",
        "prefab_abs": r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_BR_Sleipnir_N\Model_BR_Sleipnir_N.prefab",
        "die_canvas_scale": 4.0,
        "clips": {
            "idle": "Idle_1",
            "move": "Move",
            "skill1": "Skil_1",
            "skill2": "Skil_2",
            "die": "Die",
        },
    },
    "express76": {
        "char_dir": "Char_PECS_Express76_N",
        "model": "Model_PECS_Express76_N",
        "prefab": "Model_PECS_Express76_N.prefab",
        "materials": "materials",
        "fbx_glob": "3d_mesh/*.[Ff][Bb][Xx]",
        "model_abs": r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_PECS_Express76_N\Model_PECS_Express76_N",
        "prefab_abs": r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_PECS_Express76_N\Model_PECS_Express76_N.prefab",
        "die_canvas_scale": 3.0,
        "clips": {
            "idle": "idle1",
            "move": "move",
            "skill1": "skill1",
            "skill2": "skill2",
            "die": "die",
        },
    },
}


def documents(path: Path):
    text = path.read_text(encoding="utf8")
    return {
        int(m.group(1)): yaml.safe_load(m.group(2))
        for m in re.finditer(r"--- !u!\d+ &(-?\d+)\n(.*?)(?=\n--- !u!|\Z)", text, re.S)
    }


def expand_sprite_by_alpha(entry: dict, alpha: np.ndarray, max_pad: int = SPRITE_ALPHA_EXPAND):
    """Grow Unity sprite rect into neighboring opaque atlas pixels; keep pivot stable."""
    th, tw = alpha.shape
    x = int(entry["x"])
    y = int(entry["y"])  # Unity bottom-left
    w = int(entry["w"])
    h = int(entry["h"])
    if w <= 0 or h <= 0:
        return entry
    # Image-space rows: top-left origin
    r0 = th - (y + h)
    r1 = th - y
    c0, c1 = x, x + w
    left = right = top_off = bot_off = 0

    def col_opaque(cx: int, ra: int, rb: int) -> bool:
        if cx < 0 or cx >= tw or ra >= rb:
            return False
        return bool(np.any(alpha[ra:rb, cx] > SPRITE_ALPHA_THR))

    def row_opaque(ry: int, ca: int, cb: int) -> bool:
        if ry < 0 or ry >= th or ca >= cb:
            return False
        return bool(np.any(alpha[ry, ca:cb] > SPRITE_ALPHA_THR))

    for _ in range(max_pad):
        grew = False
        if col_opaque(c0 - 1, r0, r1):
            left += 1
            c0 -= 1
            grew = True
        if col_opaque(c1, r0, r1):
            right += 1
            c1 += 1
            grew = True
        if row_opaque(r0 - 1, c0, c1):
            top_off += 1
            r0 -= 1
            grew = True
        if row_opaque(r1, c0, c1):
            bot_off += 1
            r1 += 1
            grew = True
        if not grew:
            break

    if left or right or top_off or bot_off:
        new_w = c1 - c0
        new_h = r1 - r0
        px, py = entry["pivot"]
        entry["x"] = c0
        entry["y"] = th - r1
        entry["w"] = new_w
        entry["h"] = new_h
        entry["pivot"] = (
            (px * w + left) / new_w if new_w else px,
            (py * h + bot_off) / new_h if new_h else py,
        )
    return entry


def parse_sprites(meta_path: Path, tex_path: Path, expand: bool = True):
    meta = yaml.safe_load(meta_path.read_text(encoding="utf8"))
    ti = meta.get("TextureImporter") or {}
    guid = meta.get("guid")
    sheet = (ti.get("spriteSheet") or {}).get("sprites") or []
    out = {}
    alpha = None
    if sheet and expand:
        try:
            alpha = np.array(Image.open(tex_path).convert("RGBA"))[:, :, 3]
        except OSError:
            alpha = None
    for sp in sheet:
        name = sp.get("name")
        rect = sp.get("rect") or {}
        pivot = sp.get("pivot") or {"x": 0.5, "y": 0.5}
        fid = sp.get("internalID") or sp.get("spriteID")
        entry = {
            "name": name,
            "tex": tex_path,
            "guid": guid,
            "x": int(rect.get("x", 0)),
            "y": int(rect.get("y", 0)),
            "w": int(rect.get("width", 0)),
            "h": int(rect.get("height", 0)),
            "pivot": (float(pivot.get("x", 0.5)), float(pivot.get("y", 0.5))),
        }
        if alpha is not None:
            expand_sprite_by_alpha(entry, alpha)
        if fid is not None:
            out[f"id:{fid}|{guid}"] = entry
        out[f"name:{name}|{guid}"] = entry
    if not sheet and guid:
        try:
            with Image.open(tex_path) as im:
                w, h = im.size
        except OSError:
            w = h = 0
        entry = {
            "name": tex_path.stem,
            "tex": tex_path,
            "guid": guid,
            "x": 0,
            "y": 0,
            "w": w,
            "h": h,
            "pivot": (0.5, 0.5),
        }
        out[f"guid:{guid}"] = entry
    return out


def is_body_silhouette(part_name: str) -> bool:
    low = part_name.lower()
    return any(tok in low for tok in _BODY_SILHOUETTE_TOKENS)


def is_hard_fx(part_name: str) -> bool:
    """True for detached FX that must not frame (or paint) the character bake."""
    low = part_name.lower()
    if "shadow" in low:
        return True
    # Skill*_Tail / Wing_* / Hand_skill_* are silhouette, not FX.
    if is_body_silhouette(part_name):
        return False
    return any(tok in low for tok in _HARD_FX_TOKENS)


def include_in_frame_bounds(part_name: str) -> bool:
    """Skip true FX when computing bake viewports; keep body / tails / wings.

    Uses ALL clip frames (no early-frame cap / no truncated anim length).
    Merlin carriers / gun boxes must not inflate AABB; Fafnir Skill*_Tail
    and Wing_* must still define bounds.
    """
    return not is_hard_fx(part_name)


def body_points_for_bounds(parts) -> np.ndarray | None:
    """Collect body mesh verts for framing; drop far projectile-like outliers."""
    named = [
        (p[1], p[2])
        for p in parts
        if include_in_frame_bounds(p[1]) and len(p[2])
    ]
    if not named:
        return None
    centers = np.array([v.mean(axis=0) for _, v in named], dtype=float)
    median = np.median(centers, axis=0)
    spans = np.array(
        [float(np.max(v.max(axis=0) - v.min(axis=0))) for _, v in named], dtype=float
    )
    typical = float(np.median(spans)) if len(spans) else 1.0
    # Tails / wings can sit farther from the torso median than limbs.
    max_dist = max(typical * 5.0, 10.0)
    kept = []
    for (name, verts), center in zip(named, centers):
        dist = float(np.linalg.norm(center - median))
        if dist <= max_dist or is_body_silhouette(name):
            kept.append(verts)
    if not kept:
        kept = [v for _, v in named]
    return np.concatenate(kept)


def padded_bounds_from_points(points: np.ndarray, pad_frac: float = BOUNDS_PAD):
    lo = points.min(axis=0)
    hi = points.max(axis=0)
    span = np.maximum(hi - lo, 1e-3)
    pad = span * pad_frac
    return (*(lo - pad), *(hi + pad))


def _norm_bone_name(name: str) -> str:
    """Normalize Unity duplicate suffixes so FBX/prefab bone names can match."""
    s = name.strip()
    s = re.sub(r"\s*\(\d+\)\s*$", "", s)
    s = re.sub(r"\s+\d+\s*$", "", s)
    return s


def _parse_fbx_id_map(importer: dict) -> dict:
    """Build fileID -> name map from legacy and internalID Unity FBX metas."""
    out = {}
    recycle = importer.get("fileIDToRecycleName") or {}
    for fid, name in recycle.items():
        out[int(fid)] = name
    for entry in importer.get("internalIDToNameTable") or []:
        first = entry.get("first") or {}
        second = entry.get("second")
        if second is None:
            continue
        for _class_id, local_id in first.items():
            try:
                out[int(local_id)] = second
            except (TypeError, ValueError):
                continue
    return out


def export_rig(fbx_path: Path) -> dict:
    tree = fbx_read(fbx_path)
    objects = {
        n["props"][0]: n
        for n in next(n for n in tree if n["name"] == "Objects")["children"]
    }
    connections = next(n for n in tree if n["name"] == "Connections")["children"]
    links = {}
    for c in connections:
        if len(c["props"]) >= 3:
            links.setdefault(c["props"][2], []).append(c["props"][1])

    def array(n, key):
        a = fbx_child(n, key)
        if a is None:
            return None
        nested = fbx_child(a, "a")
        if nested is not None:
            return np.asarray(nested["props"])
        props = a.get("props") or []
        if len(props) == 1 and hasattr(props[0], "__len__"):
            return np.asarray(props[0])
        return np.asarray(props)

    result = {}
    for mid, model in objects.items():
        if model["name"] != "Model" or model["props"][2] != "Mesh":
            continue
        geo = next(
            (objects[i] for i in links.get(mid, []) if objects[i]["name"] == "Geometry"),
            None,
        )
        if geo is None:
            continue
        skin = next(
            (
                objects[i]
                for i in links.get(geo["props"][0], [])
                if objects[i]["name"] == "Deformer"
            ),
            None,
        )
        if skin is None:
            continue
        props = {
            p["props"][0]: p["props"][4:]
            for p in fbx_child(model, "Properties70")["children"]
        }
        geometric = np.eye(4)
        geometric[:3, 3] = props.get("GeometricTranslation", [0, 0, 0])
        x, y, z = np.radians(props.get("GeometricRotation", [0, 0, 0]))
        cx, sx = np.cos(x), np.sin(x)
        cy, sy = np.cos(y), np.sin(y)
        cz, sz = np.cos(z), np.sin(z)
        geometric[:3, :3] = (
            np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
            @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
            @ np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
            @ np.diag(props.get("GeometricScaling", [1, 1, 1]))
        )
        clusters = []
        for cid in links.get(skin["props"][0], []):
            c = objects[cid]
            if c.get("props", [None, None, None])[2] != "Cluster":
                continue
            bone = next(
                (objects[i] for i in links.get(cid, []) if objects[i]["name"] == "Model"),
                None,
            )
            if bone is None:
                continue
            idxs = array(c, "Indexes")
            wts = array(c, "Weights")
            xform = array(c, "Transform")
            if idxs is None or wts is None or xform is None:
                continue
            bind = xform.reshape(4, 4).T @ geometric
            clusters.append(
                {
                    "bone": bone["props"][1].split("::")[-1].split("\x00")[0],
                    "bind": bind.tolist(),
                    "indices": idxs.astype(int).tolist(),
                    "weights": wts.tolist(),
                }
            )
        if not clusters:
            continue
        indices = array(geo, "PolygonVertexIndex")
        if indices is None:
            continue
        indices = indices.astype(int)
        triangles = []
        face = []
        for corner, v in enumerate(indices):
            face.append(corner)
            if v < 0:
                indices[corner] = -v - 1
                for k in range(1, len(face) - 1):
                    triangles.append([face[0], face[k], face[k + 1]])
                face = []
        uvnode = fbx_child(geo, "LayerElementUV")
        if uvnode is None:
            continue
        uv = array(uvnode, "UV")
        uvidx = array(uvnode, "UVIndex")
        if uv is None or uvidx is None:
            continue
        uv = uv.reshape(-1, 2)[uvidx.astype(int)]
        verts = array(geo, "Vertices")
        if verts is None:
            continue
        result[model["props"][1].split("::")[-1].split("\x00")[0]] = {
            "vertices": verts.reshape(-1, 3).tolist(),
            "indices": indices.tolist(),
            "uv": uv.tolist(),
            "triangles": triangles,
            "clusters": clusters,
        }
    return result


def resolve_mesh_name(rig: dict, fbxmeta: dict, mesh_ref: dict, go_name: str):
    """Resolve SkinnedMeshRenderer mesh via fileID, GO name, then fuzzy name."""
    fid = (mesh_ref or {}).get("fileID")
    guid = (mesh_ref or {}).get("guid")
    meshname = None
    if isinstance(fbxmeta, dict) and guid and isinstance(fbxmeta.get(guid), dict):
        meshname = fbxmeta[guid].get(fid)
    if meshname is None and isinstance(fbxmeta, dict):
        meshname = fbxmeta.get(fid)
    if meshname and meshname in rig:
        return meshname, rig[meshname]
    if go_name in rig:
        return go_name, rig[go_name]
    # Strip common Unity suffixes / prefixes
    candidates = [
        go_name.replace("_Skinned", ""),
        go_name.replace("parts_", ""),
        go_name.replace("parts_", "").replace("_Skinned", ""),
        re.sub(r"\s*\(\d+\)\s*$", "", go_name).strip(),
    ]
    for alt in candidates:
        if alt and alt in rig:
            return alt, rig[alt]
    gnorm = _norm_bone_name(go_name).lower().replace("parts_", "").replace("_skinned", "")
    for key in rig:
        kn = _norm_bone_name(key).lower().replace("parts_", "").replace("_skinned", "")
        if kn == gnorm or (gnorm and (kn.endswith(gnorm) or gnorm.endswith(kn))):
            return key, rig[key]
    return None, None


def map_skin_bones(prefab_bone_ids, prefab_bone_names, clusters, byname):
    """
    Bind FBX skin clusters to prefab bones by name first.

    Index-only binding breaks when Unity m_Bones has extra/missing/renamed
    entries vs FBX clusters (Constantia Hair_F, many Fafnir variants).
    """
    used = set()
    mapped = []
    for ci, cluster in enumerate(clusters):
        cname = cluster["bone"]
        idx = next(
            (
                i
                for i, n in enumerate(prefab_bone_names)
                if i not in used and n == cname
            ),
            None,
        )
        if idx is None:
            cnorm = _norm_bone_name(cname)
            idx = next(
                (
                    i
                    for i, n in enumerate(prefab_bone_names)
                    if i not in used and _norm_bone_name(n) == cnorm
                ),
                None,
            )
        if idx is None and ci < len(prefab_bone_ids) and ci not in used:
            idx = ci
        if idx is None:
            bone_tid = byname.get(cname) or byname.get(_norm_bone_name(cname))
            mapped.append(bone_tid)
            continue
        used.add(idx)
        mapped.append(prefab_bone_ids[idx])
    return mapped


def should_skip_part(path: str, name: str) -> bool:
    """Skip companion / UI / leftover duplicate parts that are not the character."""
    low_path = path.lower().replace("\\", "/")
    low_name = name.lower()
    if "/bori/" in low_path or low_name.startswith("bori"):
        return True
    if low_name in {
        "skill_bubble",
        "damage font",
        "bufficon",
        "buficon",
        "buff_label",
        "ap",
        "skilconfirm",
        "stun_position_point",
    }:
        return True
    # Constantia leftover body sprite parented under skirt_B_root
    if low_name == "parts_body (1)" or low_name.endswith("parts_body (1)"):
        return True
    if re.search(r"parts_body\s*\(\d+\)", low_name):
        return True
    # Emily: GPU-skinned front hair / ears mis-bind and stretch into a NE spike.
    # Keep Hair_Base sprite; skip Hair_[FLR]_Skinned + Ear_[LR]_Skinned (same as glb-actor).
    if re.search(r"hair_[flr]_skinned|ear_[lr]_skinned", low_name):
        return True
    return False


# Open-eye SpriteRenderer / container names (Constantia eye_set/eye/{eye_L,eye_R}).
# Include parent `eye` — die.anim sets m_IsActive 0 on that GO while leaving
# the leaf renderers flagged on, so children never pass visible().
_OPEN_EYE_NAMES = frozenset({"eye_l", "eye_r", "eye"})
# Closed / alternate expression roots & wink leaf (eye_L2 = thin wink line).
_CLOSED_EYE_NAMES = frozenset(
    {
        "eye_l2",
        "eye_><",
        "eye_o_o",
        "eye_^_^",
        "eye_-_-",
        "bone_eye_sleep",
        "bone_eye_smile",
        "bone_eye_hit",
        "bone_eye_c",
    }
)


def _is_under_eye_set(path: str) -> bool:
    low = path.lower().replace("\\", "/")
    return "/eye_set/" in low or low.endswith("/eye_set") or "/bone_eye_" in low


def vector(v):
    return np.array([v[a] for a in "xyz"], float)


def quat(q):
    x, y, z, w = [q[a] for a in "xyzw"]
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ]
    )


def euler(v):
    x, y, z = np.radians(v)
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return (
        np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
        @ np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
        @ np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    )


def sample(curve, t):
    keys = curve["m_Curve"]

    def val(v):
        return vector(v) if isinstance(v, dict) else float(v)

    if t <= keys[0]["time"]:
        return val(keys[0]["value"])
    for a, b in zip(keys, keys[1:]):
        if t <= b["time"]:
            d = b["time"] - a["time"]
            u = (t - a["time"]) / d
            av, bv = val(a["value"]), val(b["value"])
            out, inc = val(a["outSlope"]), val(b["inSlope"])
            if not np.all(np.isfinite(out)) or not np.all(np.isfinite(inc)):
                return av
            return (
                (2 * u**3 - 3 * u * u + 1) * av
                + (u**3 - 2 * u * u + u) * d * out
                + (-2 * u**3 + 3 * u * u) * bv
                + (u**3 - u * u) * d * inc
            )
    return val(keys[-1]["value"])


class CharacterBaker:
    def __init__(self, key: str, cfg: dict):
        self.key = key
        self.cfg = cfg
        # Optional absolute paths (used by monster bake; characters keep char_dir/model/prefab).
        if cfg.get("model_abs"):
            self.model_path = Path(cfg["model_abs"])
            self.char_path = self.model_path.parent
        else:
            self.char_path = CHAR_ROOT / cfg["char_dir"]
            self.model_path = self.char_path / cfg["model"]
        if cfg.get("prefab_abs"):
            self.prefab_path = Path(cfg["prefab_abs"])
        else:
            self.prefab_path = self.char_path / cfg["prefab"]

        mat_name = cfg.get("materials") or "Materials"
        self.mat_dir = self.model_path / mat_name
        if not self.mat_dir.exists():
            for alt_name in ("Materials", "materials", "Material", "material"):
                alt = self.model_path / alt_name
                if alt.exists():
                    self.mat_dir = alt
                    break

        self.anim_dir = self.model_path / "animation"
        if not self.anim_dir.exists():
            for alt_name in ("Animation", "animations", "Animations", "ani", "Ani"):
                alt = self.model_path / alt_name
                if alt.exists():
                    self.anim_dir = alt
                    break
        if cfg.get("anim_dir_abs"):
            self.anim_dir = Path(cfg["anim_dir_abs"])

        fbx_candidates = list(self.model_path.glob(cfg.get("fbx_glob") or "3D/*.[Ff][Bb][Xx]"))
        if not fbx_candidates:
            for pat in (
                "3D_mesh/*.[Ff][Bb][Xx]",
                "3D_Model/*.[Ff][Bb][Xx]",
                "3d_mesh/*.[Ff][Bb][Xx]",
            ):
                fbx_candidates = list(self.model_path.glob(pat))
                if fbx_candidates:
                    break
        if not fbx_candidates:
            fbx_candidates = list(self.model_path.glob("3d/*.[Ff][Bb][Xx]"))
        if not fbx_candidates:
            # Some MP monsters keep the mesh FBX next to Materials/animation.
            fbx_candidates = list(self.model_path.glob("*.[Ff][Bb][Xx]"))
        # Skip companion pets when possible for primary listing, but still load all for rig merge
        if cfg.get("fbx_abs"):
            # Meshes borrowed from another unit's FBX (Hachiko's shield/pistol = AS-12's).
            fbx_candidates = [Path(x) for x in cfg["fbx_abs"]] + list(fbx_candidates)
        if not fbx_candidates and cfg.get("sprites_only"):
            # Sprite-only puppets (Peregrinus: every SkinnedMeshRenderer has no mesh; the
            # body is SpriteRenderers on the bones). No FBX rig to merge.
            fbx_candidates = []
        elif not fbx_candidates:
            raise FileNotFoundError(f"No FBX under {self.model_path}")
        # Prefer Constantia body over Bori companion for primary fbx/meta scale
        primary_pool = [
            p for p in fbx_candidates if "Bori" not in p.stem and "bori" not in p.stem
        ] or fbx_candidates or [None]
        preferred = [
            p
            for p in primary_pool
            if p is not None
            if key.lower() in p.stem.lower()
            or "Constantia" in p.stem
            or cfg["model"].replace("Model_", "") in p.stem
            or "Fafnir" in p.stem
        ]
        self.fbx_path = preferred[0] if preferred else primary_pool[0]
        self.fbx_paths = sorted(set(fbx_candidates), key=lambda p: p.name.lower())
        self.fbx_meta_path = Path(str(self.fbx_path) + ".meta") if self.fbx_path else None

        print(
            f"[{key}] prefab={self.prefab_path.name} fbx={self.fbx_path.name if self.fbx_path else None} (+{max(0, len(self.fbx_paths)-1)} more)",
            flush=True,
        )

        self.docs = documents(self.prefab_path)
        self.gos = {i: d["GameObject"] for i, d in self.docs.items() if "GameObject" in d}
        self.tfs = {i: d["Transform"] for i, d in self.docs.items() if "Transform" in d}
        self.go_tf = {d["m_GameObject"]["fileID"]: i for i, d in self.tfs.items()}

        self.sprites = {}
        self.ppus = {}
        for meta in self.mat_dir.glob("*.png.meta"):
            tex = Path(str(meta)[:-5])
            self.sprites.update(parse_sprites(meta, tex, expand=not self.cfg.get("no_sprite_expand")))
            ti = yaml.safe_load(meta.read_text(encoding="utf8")).get("TextureImporter") or {}
            self.ppus[tex] = ti.get("spritePixelsToUnits", 100)
            if self.cfg.get("sprite_outline"):
                self._outline_sprites(ti, tex)

        self.rig = {}
        self.mesh_scales = {}
        # Flat map kept for LRL-style metas; per-guid map avoids multi-FBX collisions.
        self.fbxmeta = {}
        self.fbxmeta_by_guid = {}
        self.mesh_scale = 0.01
        primary_scale_set = False
        for fbx in self.fbx_paths:
            # Skip obvious companion-only mesh for Constantia (Bori) unless alone
            if "Bori" in fbx.stem and len(self.fbx_paths) > 1 and key == "constantia":
                continue
            part = export_rig(fbx)
            overlap = set(part) & set(self.rig)
            if overlap:
                print(
                    f"[{key}] WARNING: FBX mesh name overlap from {fbx.name}: {sorted(overlap)}",
                    flush=True,
                )
            meta_path = Path(str(fbx) + ".meta")
            scale = 0.01
            if meta_path.exists():
                meta_doc = yaml.safe_load(meta_path.read_text(encoding="utf8"))
                importer = meta_doc["ModelImporter"]
                id_map = _parse_fbx_id_map(importer)
                guid = meta_doc.get("guid")
                if guid:
                    self.fbxmeta_by_guid[guid] = id_map
                # Prefer primary FBX ids in flat map; do not let later FBXs overwrite.
                for fid, name in id_map.items():
                    self.fbxmeta.setdefault(fid, name)
                scale = 0.01 * importer["meshes"]["globalScale"]
                if fbx == self.fbx_path or not primary_scale_set:
                    self.mesh_scale = scale
                    primary_scale_set = True
            for mesh_name in part:
                self.mesh_scales[mesh_name] = scale
            self.rig.update(part)
        print(f"[{key}] rig meshes={list(self.rig.keys())}", flush=True)

        self.materials = {}
        # Sprite atlases live in materials/; skinned-mesh .mat files often sit
        # next to the FBX (3d_mesh/Materials). Express76 hair/chest/necklace
        # used that nested folder — missing it dropped GPU hair and baked bald.
        mat_files = []
        seen_mat = set()
        extra_mat_dirs = [
            self.mat_dir,
            self.model_path / "3d_mesh" / "Materials",
            self.model_path / "3D_mesh" / "Materials",
            self.model_path / "3D_Model" / "Materials",
            self.model_path / "3D" / "Materials",
        ]
        for fbx in self.fbx_paths:
            extra_mat_dirs.append(fbx.parent / "Materials")
            extra_mat_dirs.append(fbx.parent / "materials")
        for d in extra_mat_dirs:
            if not d.is_dir():
                continue
            for mat in d.glob("*.mat"):
                keyp = mat.resolve()
                if keyp in seen_mat:
                    continue
                seen_mat.add(keyp)
                mat_files.append(mat)
        for mat in mat_files:
            try:
                guid = yaml.safe_load(Path(str(mat) + ".meta").read_text(encoding="utf8"))["guid"]
                if guid in self.materials:
                    continue
                data = next(iter(documents(mat).values()))["Material"]
                envs = data.get("m_SavedProperties", {}).get("m_TexEnvs") or []
                env = next((v["_MainTex"] for v in envs if "_MainTex" in v), None)
                if env is None:  # Bori's custom shader names its albedo "_texture"
                    env = next((v["_texture"] for v in envs if "_texture" in v), None)
                if env is None:
                    continue
                texguid = (env.get("m_Texture") or {}).get("guid")
                if not texguid:
                    continue
                tex = next(
                    (s["tex"] for s in self.sprites.values() if s.get("guid") == texguid),
                    None,
                )
                if tex is None:
                    search_metas = list(self.mat_dir.glob("*.png.meta"))
                    # 2D lobby models keep the parts atlas at the model root or in Texture/.
                    search_metas += list(self.model_path.glob("*.png.meta"))
                    search_metas += list((self.model_path / "Texture").glob("*.png.meta"))
                    nested = mat.parent / (Path(str(mat.stem) + ".png.meta"))
                    if nested.exists():
                        search_metas.append(nested)
                    for meta in search_metas:
                        if yaml.safe_load(meta.read_text(encoding="utf8")).get("guid") == texguid:
                            tex = Path(str(meta)[:-5])
                            break
                if tex is None:
                    print(f"[{key}] skip mat {mat.name}: texture guid {texguid} not found", flush=True)
                    continue
                self.materials[guid] = tex
            except Exception as e:
                print(f"[{key}] skip mat {mat.name}: {e}", flush=True)
        print(
            f"[{key}] materials={len(self.materials)} from {len(mat_files)} .mat files",
            flush=True,
        )

        self._textures = getattr(self, "_textures", {})  # may hold outline crops already
        self._skip_logged = set()

    def name(self, tid):
        return self.gos[self.tfs[tid]["m_GameObject"]["fileID"]]["m_Name"]

    def path(self, tid):
        parent = self.tfs[tid]["m_Father"]["fileID"]
        return (self.path(parent) + "/" if parent else "") + self.name(tid)

    def _outline_sprites(self, ti, tex):
        """cfg "sprite_outline": Unity draws each sprite through its outline mesh, so
        atlas pixels inside the rect but outside the outline (a neighbour's art) never
        show. Give every outlined sprite its own masked crop (in-memory texture)."""
        from PIL import ImageDraw

        sheet = (ti.get("spriteSheet") or {}).get("sprites") or []
        guid = None
        for k, v in self.sprites.items():
            if v.get("tex") == tex:
                guid = v.get("guid")
                break
        if not sheet or not guid:
            return
        if not hasattr(self, "_textures"):
            self._textures = {}
        atlas = Image.open(tex).convert("RGBA")
        th = atlas.size[1]
        for sp in sheet:
            outline = sp.get("outline") or []
            fid = sp.get("internalID") or sp.get("spriteID")
            entry = self.sprites.get(f"id:{fid}|{guid}")
            if not outline or not entry:
                continue
            r = sp.get("rect") or {}
            x, y, w, h = int(r.get("x", 0)), int(r.get("y", 0)), int(r.get("width", 0)), int(r.get("height", 0))
            if w <= 0 or h <= 0:
                continue
            crop = atlas.crop((x, th - y - h, x + w, th - y))
            mask = Image.new("L", (w, h), 0)
            draw = ImageDraw.Draw(mask)
            for poly in outline:
                # Outline points: px from the rect centre, y up.
                pts = [(w / 2 + float(q["x"]), h / 2 - float(q["y"])) for q in poly]
                if len(pts) >= 3:
                    draw.polygon(pts, fill=255)
            a = np.array(crop, dtype=np.float32) / 255
            a[:, :, 3] *= np.array(mask, dtype=np.float32) / 255
            a[:, :, :3] *= a[:, :, 3:4]
            key = Path(f"{tex}#{sp.get('name')}")
            self._textures[key] = a
            self.ppus[key] = self.ppus[tex]
            entry.update({"tex": key, "x": 0, "y": 0, "w": w, "h": h})

    def _build_paths(self):
        self.paths = {i: self.path(i) for i in self.tfs}
        # Last-wins is fine as fallback; skinning prefers m_Bones name matching.
        self.byname = {self.name(i): i for i in self.tfs}
        for i in self.tfs:
            self.byname.setdefault(_norm_bone_name(self.name(i)), i)

    def find_path(self, p):
        return next(
            (i for i, v in self.paths.items() if v.endswith("/" + p) or v == p), None
        )

    def texture(self, p):
        if p not in self._textures:
            a = np.array(Image.open(p).convert("RGBA"), dtype=np.float32) / 255
            a[:, :, :3] *= a[:, :, 3:4]
            self._textures[p] = a
        return self._textures[p]

    def shaded_texture(self, p, part_name, time):
        """cfg "dissolve": LO_bori_hide shader (Bori). _change (material curve, flat-tangent
        keys) dissolves the mesh through a tiled hexagon mask; kept pixels get SF_blue added
        by how close they are to the cut (emissive = texture + FX_color(v)).

            v = 1 - sat(((change*2.6 - 1.6) + mask.r + noise) * 2.3 - 1.3)   (noise: white)
            clip(v * texture.a - 0.5);  colour = texture.rgb + FX_color(u=v).rgb
        """
        dz = self.cfg.get("dissolve")
        if not dz or part_name not in dz["parts"]:
            return self.texture(p)
        keys = dz["keys"]
        if time <= keys[0][0]:
            c = keys[0][1]
        elif time >= keys[-1][0]:
            c = keys[-1][1]
        else:
            for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
                if t0 <= time <= t1:
                    k = (time - t0) / max(1e-6, t1 - t0)
                    c = v0 + (v1 - v0) * (k * k * (3 - 2 * k))  # Hermite, zero slopes
                    break
        c = round(float(c), 3)
        cache = self.__dict__.setdefault("_dissolve_cache", {})
        if (p, c) in cache:
            return cache[(p, c)]
        if "_dz_mask" not in self.__dict__:
            self._dz_mask = np.array(Image.open(dz["mask"]).convert("RGBA"), np.float32)[..., 0] / 255
            self._dz_ramp = np.array(Image.open(dz["ramp"]).convert("RGB"), np.float32)[0] / 255
        base = np.array(Image.open(p).convert("RGBA"), np.float32) / 255
        h, w = base.shape[:2]
        u = (np.arange(w) + 0.5) / w
        vv = 1 - (np.arange(h) + 0.5) / h
        uu, vg = np.meshgrid(u, vv)
        mh, mw = self._dz_mask.shape
        til = dz["tiling"]
        mx = ((uu * til) % 1.0 * mw).astype(int) % mw
        my = ((1 - (vg * til) % 1.0) * mh).astype(int) % mh
        m = self._dz_mask[my, mx]
        vis = 1 - np.clip(((c * 2.6 - 1.6) + m + 1.0) * 2.3 - 1.3, 0, 1)
        keep = vis * base[..., 3] > 0.5
        ramp = self._dz_ramp
        ri = np.clip((vis * (len(ramp) - 1)).round().astype(int), 0, len(ramp) - 1)
        rgb = np.clip(base[..., :3] + ramp[ri], 0, 1)
        out = np.zeros_like(base)
        out[..., :3] = rgb
        out[..., 3] = np.where(keep, 1.0, 0.0) * np.clip(base[..., 3] * 2, 0, 1)
        out[..., :3] *= out[..., 3:4]
        cache[(p, c)] = out
        return out

    def _pin_open_eyes(self, active, pos, rot, scale, overrides):
        """Keep stand open-eye sprites; suppress wink/closed expression swaps.

        Constantia Attack_01 disables eye_L and enables eye_L2 (wink line) for
        most of the clip, and also squashes eye_L via scale/position curves.
        Die disables the parent `eye` GO (not the leaves), which hid irises
        while glasses/face still drew — empty sockets.
        """
        tfs = self.tfs
        open_tids = []
        for tid, path in self.paths.items():
            if not _is_under_eye_set(path):
                continue
            name = self.name(tid)
            low = name.lower()
            gid = tfs[tid]["m_GameObject"]["fileID"]
            if low in _OPEN_EYE_NAMES:
                active[gid] = True
                # Restore prefab local TRS so wink squash/offset does not apply.
                pos[tid] = vector(tfs[tid]["m_LocalPosition"])
                rot[tid] = quat(tfs[tid]["m_LocalRotation"])
                scale[tid] = vector(tfs[tid]["m_LocalScale"])
                # SpriteRenderer.m_Enabled is independent of GO active.
                overrides[(tid, "m_Enabled", 212)] = 1.0
                open_tids.append(tid)
            elif low in _CLOSED_EYE_NAMES:
                active[gid] = False
                overrides[(tid, "m_Enabled", 212)] = 0.0
        # visible() walks parents: a disabled eye_set/eye ancestor still hides
        # forced-on leaves. Re-enable those containers only.
        for tid in open_tids:
            parent = tfs[tid]["m_Father"]["fileID"]
            while parent:
                path = self.paths.get(parent, "")
                if not _is_under_eye_set(path):
                    break
                active[tfs[parent]["m_GameObject"]["fileID"]] = True
                parent = tfs[parent]["m_Father"]["fileID"]

    def pose(self, clip, time):
        tfs = self.tfs
        gos = self.gos
        pos = {i: vector(d["m_LocalPosition"]) for i, d in tfs.items()}
        rot = {i: quat(d["m_LocalRotation"]) for i, d in tfs.items()}
        scale = {i: vector(d["m_LocalScale"]) for i, d in tfs.items()}
        active = {i: bool(d["m_IsActive"]) for i, d in gos.items()}
        overrides = {}
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
                if tid is not None:
                    v = sample(c["curve"], time)
                    target[tid] = euler(v) if key == "m_EulerCurves" else v
        for c in clip.get("m_FloatCurves", []) or []:
            path = c.get("path")
            if path is None:
                continue
            tid = self.find_path(path)
            if tid is None:
                continue
            value = sample(c["curve"], time)
            if c["attribute"] == "m_IsActive":
                active[tfs[tid]["m_GameObject"]["fileID"]] = value > 0.5
            else:
                overrides[(tid, c["attribute"], c["classID"])] = value

        # cfg "active_override": {GameObject name: bool} applied after the clip curves
        # (e.g. swap in the battle weapon set the game enables at runtime).
        for name, val in (self.cfg.get("active_override") or {}).items():
            for gid, d in gos.items():
                if d.get("m_Name") == name:
                    active[gid] = bool(val)
        if self.cfg.get("pin_open_eyes"):
            self._pin_open_eyes(active, pos, rot, scale, overrides)

        world = {}

        def matrix(i):
            if i not in world:
                m = np.eye(4)
                m[:3, :3] = rot[i] @ np.diag(scale[i])
                m[:3, 3] = pos[i]
                parent = tfs[i]["m_Father"]["fileID"]
                world[i] = matrix(parent) @ m if parent else m
            return world[i]

        def visible(i):
            if not active[tfs[i]["m_GameObject"]["fileID"]]:
                return False
            p = tfs[i]["m_Father"]["fileID"]
            return visible(p) if p else True

        ik_enabled = {}
        for doc in self.docs.values():
            control = doc.get("MonoBehaviour", {})
            if "_Ikhandles" not in control:
                continue
            tid = self.go_tf[control["m_GameObject"]["fileID"]]
            for index, handle in enumerate(control["_Ikhandles"]):
                axis = "xyzw"[index] if index < 4 else None
                ik_enabled[handle["fileID"]] = axis is None or overrides.get(
                    (tid, "OnOff." + axis, 114), control["OnOff"][axis]
                ) > 0.5

        def world_rotation(i):
            p = tfs[i]["m_Father"]["fileID"]
            return world_rotation(p) @ rot[i] if p else rot[i]

        def set_rotation(i, value):
            p = tfs[i]["m_Father"]["fileID"]
            rot[i] = world_rotation(p).T @ value if p else value
            world.clear()

        def look_rotation(direction, up):
            forward = direction / np.linalg.norm(direction)
            right = np.cross(up, forward)
            right /= np.linalg.norm(right)
            return np.column_stack([right, np.cross(forward, right), forward])

        for component_id, doc in self.docs.items():
            d = doc.get("MonoBehaviour", {})
            if d.get("m_Script", {}).get("guid") != "62fc74be5d0ea434fa84a6add19b6c84":
                continue
            if not ik_enabled.get(component_id, True):
                continue
            ctrl = self.go_tf[d["m_GameObject"]["fileID"]]
            # Puppet2D Global_CTRL runs its _Ikhandles even when the (hidden) CTRL objects
            # are inactive; cfg "ik_ignore_ctrl_active" follows that for such rigs.
            ctrl_on = visible(ctrl) or (self.cfg.get("ik_ignore_ctrl_active") and visible(tfs[ctrl]["m_Father"]["fileID"]))
            if not ctrl_on or not overrides.get((ctrl, "m_Enabled", 114), d["m_Enabled"]):
                continue
            top, mid, end = [
                d[k]["fileID"]
                for k in [
                    "topJointTransform",
                    "middleJointTransform",
                    "bottomJointTransform",
                ]
            ]
            if d["SquashAndStretch"]:
                scale[top] = vector(d["scaleStart"][0])
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
            aim = vector(d["AimDirection"])
            up = vector(d["UpDirection"])
            turn = euler(up * 90)
            set_rotation(top, look_rotation(target - a, aim) @ turn @ euler([0, 0, angle * flip]))
            set_rotation(mid, look_rotation(target - matrix(mid)[:3, 3], aim) @ turn)
            if not self.cfg.get("ik_end_keep_local"):
                set_rotation(end, world_rotation(ctrl) @ quat(d["Offset"]))
            dbg = (self.cfg.get("debug_end_rot") or {}).get(self.name(end))
            if dbg:
                set_rotation(end, world_rotation(end) @ euler([0, 0, dbg]))
            if d["Scale"]:
                scale[end] = scale[ctrl] * vector(d["OffsetScale"])
                world.clear()

        parts = []
        for doc in self.docs.values():
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
            tid = self.go_tf[r["m_GameObject"]["fileID"]]
            part_name = self.name(tid)
            part_path = self.paths.get(tid, part_name)
            classid = 212 if kind == "SpriteRenderer" else 137
            if not visible(tid) or not overrides.get(
                (tid, "m_Enabled", classid), r["m_Enabled"]
            ):
                continue
            if part_name in (self.cfg.get("skip_parts") or ()):
                continue
            if should_skip_part(part_path, part_name) and not (self.cfg.get("keep_bori") and "bori" in part_path.lower()):
                continue
            if kind == "SpriteRenderer":
                s = r["m_Sprite"]
                sp = self.sprites.get(f"id:{s['fileID']}|{s.get('guid', '')}")
                if not sp:
                    continue
                tex = self.texture(sp["tex"])
                w, h = sp["w"], sp["h"]
                px, py = sp["pivot"]
                ppu = self.ppus[sp["tex"]]
                verts = (
                    np.array(
                        [
                            [-px * w, -py * h, 0, ppu],
                            [(1 - px) * w, -py * h, 0, ppu],
                            [(1 - px) * w, (1 - py) * h, 0, ppu],
                            [-px * w, (1 - py) * h, 0, ppu],
                        ]
                    )
                    / ppu
                )
                if overrides.get((tid, "m_FlipX", 212), r["m_FlipX"]) > 0.5:
                    verts[:, 0] *= -1
                if overrides.get((tid, "m_FlipY", 212), r.get("m_FlipY", 0)) > 0.5:
                    verts[:, 1] *= -1
                verts = verts @ matrix(tid).T
                x, y = sp["x"], tex.shape[0] - sp["y"]
                uv = np.array([[x, y], [x + w, y], [x + w, y - h], [x, y - h]], float)
                tris = [[0, 1, 2], [0, 2, 3]]
                alpha = overrides.get(
                    (tid, "m_Color.a", 212), r.get("m_Color", {}).get("a", 1)
                )
            else:
                mesh_ref = r.get("m_Mesh") or {}
                meshname = None
                mesh = None
                guid = mesh_ref.get("guid")
                fid = mesh_ref.get("fileID")
                if guid and guid in self.fbxmeta_by_guid:
                    meshname = self.fbxmeta_by_guid[guid].get(fid)
                    mesh = self.rig.get(meshname) if meshname else None
                if mesh is None:
                    meshname = self.fbxmeta.get(fid)
                    mesh = self.rig.get(meshname) if meshname else None
                if mesh is None:
                    meshname, mesh = resolve_mesh_name(
                        self.rig, {}, mesh_ref, part_name
                    )
                if not mesh and len(self.rig) == 1:
                    meshname, mesh = next(iter(self.rig.items()))
                if not mesh:
                    logk = ("mesh", part_name)
                    if logk not in self._skip_logged:
                        self._skip_logged.add(logk)
                        print(f"[{self.key}] skip skinned {part_name}: no mesh", flush=True)
                    continue
                mats = r.get("m_Materials") or []
                texpath = self.materials.get(mats[0].get("guid")) if mats else None
                # Do not silently steal an unrelated material; only soft-fallback
                # when this character has exactly one resolved texture.
                if not texpath and len(self.materials) == 1:
                    texpath = next(iter(self.materials.values()))
                if not texpath:
                    logk = ("tex", part_name)
                    if logk not in self._skip_logged:
                        self._skip_logged.add(logk)
                        mg = (mats[0].get("guid") if mats else None)
                        print(
                            f"[{self.key}] skip skinned {part_name}: no material texture guid={mg}",
                            flush=True,
                        )
                    continue
                tex = self.shaded_texture(texpath, part_name, time)
                v = np.array(mesh["vertices"])
                v = np.column_stack([v, np.ones(len(v))])
                out = np.zeros_like(v)
                mesh_scale = self.mesh_scales.get(meshname, self.mesh_scale)
                convert = np.diag([-mesh_scale, mesh_scale, mesh_scale, 1])
                bones = r.get("m_Bones") or []
                bone_ids = [b["fileID"] for b in bones]
                bone_names = [
                    self.name(bid) if bid in self.tfs else f"?{bid}" for bid in bone_ids
                ]
                mapped = map_skin_bones(
                    bone_ids, bone_names, mesh["clusters"], self.byname
                )
                for cluster, bone_tid in zip(mesh["clusters"], mapped):
                    if bone_tid is None or bone_tid not in self.tfs:
                        continue
                    ids = np.array(cluster["indices"])
                    weights = np.array(cluster["weights"])
                    transformed = v[ids] @ (
                        matrix(bone_tid) @ convert @ np.array(cluster["bind"])
                    ).T
                    out[ids] += transformed * weights[:, None]
                verts = out[np.array(mesh["indices"])]
                uv = np.array(mesh["uv"]) * [tex.shape[1], -tex.shape[0]]
                uv[:, 1] += tex.shape[0]
                tris = mesh["triangles"]
                alpha = 1
            order = round(
                overrides.get((tid, "m_SortingOrder", classid), r["m_SortingOrder"])
            )
            if alpha > 0:
                parts.append(
                    (order, part_name, self.view(verts), uv, tris, tex, alpha)
                )
        want = getattr(self, "_want_world", None)
        if want:
            self._last_world = {self.name(t): matrix(t)[:3, 3].copy() for t in tfs if self.name(t) in want}
            self._last_world_m = {self.name(t): matrix(t).copy() for t in tfs if self.name(t) in want}
        return sorted(parts, key=lambda p: p[0])

    def view(self, verts):
        """Project to the bake plane. cfg "view_rotation" = [pitch, yaw] degrees rotates
        the model first (LAO battle camera looks down at the 2.5D field), so props that
        reach into depth (Labiata's sword) foreshorten like in game."""
        rot = self.cfg.get("view_rotation")
        if not rot:
            return verts[:, :2]
        pitch, yaw = np.radians(rot[0]), np.radians(rot[1])
        ry = np.array([[np.cos(yaw), 0, np.sin(yaw)], [0, 1, 0], [-np.sin(yaw), 0, np.cos(yaw)]])
        rx = np.array([[1, 0, 0], [0, np.cos(pitch), -np.sin(pitch)], [0, np.sin(pitch), np.cos(pitch)]])
        return (verts[:, :3] @ (rx @ ry).T)[:, :2]

    def render(self, parts, bounds, size=SIZE, content_acc=None):
        xmin, ymin, xmax, ymax = bounds
        factor = min(size / (xmax - xmin), size / (ymax - ymin))
        canvas = np.zeros((size, size, 4), np.float32)
        for order, name, verts, uv, tris, tex, alpha in parts:
            # Skip detached FX so carriers/gun boxes never paint clipped edges.
            if is_hard_fx(name):
                continue
            screen = np.column_stack(
                [
                    (verts[:, 0] - (xmin + xmax) / 2) * factor + size / 2,
                    ((ymin + ymax) / 2 - verts[:, 1]) * factor + size / 2,
                ]
            )
            layer = np.zeros_like(canvas)
            for tri in tris:
                dst = np.float32(screen[tri])
                src = np.float32(uv[tri])
                if abs(cv2.contourArea(dst)) < 0.01:
                    continue
                x0, y0 = np.maximum(0, np.floor(dst.min(axis=0)).astype(int))
                x1, y1 = np.minimum(size, np.ceil(dst.max(axis=0)).astype(int) + 1)
                if x1 <= x0 or y1 <= y0:
                    continue
                shifted = dst - [x0, y0]
                aff = cv2.getAffineTransform(src, shifted.astype(np.float32))
                pixels = cv2.warpAffine(
                    tex,
                    aff,
                    (x1 - x0, y1 - y0),
                    flags=cv2.INTER_LINEAR,
                    borderMode=cv2.BORDER_CONSTANT,
                )
                mask = np.zeros((y1 - y0, x1 - x0), np.uint8)
                cv2.fillConvexPoly(
                    mask, np.round(shifted * 256).astype(np.int32), 255, shift=8
                )
                target = layer[y0:y1, x0:x1]
                target[mask > 0] = pixels[mask > 0]
            layer *= alpha
            canvas = layer + canvas * (1 - layer[:, :, 3:4])
        canvas[:, :, :3] /= np.maximum(canvas[:, :, 3:4], 1e-7)
        arr = np.uint8(np.clip(canvas, 0, 1) * 255)
        if content_acc is not None:
            ys, xs = np.where(arr[:, :, 3] > SPRITE_ALPHA_THR)
            if len(xs):
                content_acc[0] = min(content_acc[0], int(xs.min()))
                content_acc[1] = min(content_acc[1], int(ys.min()))
                content_acc[2] = max(content_acc[2], int(xs.max()))
                content_acc[3] = max(content_acc[3], int(ys.max()))
        return Image.fromarray(arr)

    def load_clip(self, stem: str):
        matches = list(self.anim_dir.glob(f"{stem}.anim"))
        if not matches:
            matches = [
                p for p in self.anim_dir.glob("*.anim") if p.stem.lower() == stem.lower()
            ]
        if not matches:
            raise FileNotFoundError(f"Missing anim {stem} in {self.anim_dir}")
        return next(iter(documents(matches[0]).values()))["AnimationClip"]

    def bake(self, write_keys=None):
        self._build_paths()
        clip_map = self.cfg["clips"]
        write_set = set(write_keys) if write_keys else set(clip_map)
        unknown = write_set - set(clip_map)
        if unknown:
            raise ValueError(f"[{self.key}] unknown clips {sorted(unknown)}")
        pose_map = {
            k: v
            for k, v in clip_map.items()
            if k in write_set or k in ("idle", "move")
        }
        clips = {k: self.load_clip(v) for k, v in pose_map.items()}

        poses = {}
        for key, clip in clips.items():
            # Full Unity clip length at 24fps — do not truncate frame count.
            duration = float(clip["m_AnimationClipSettings"]["m_StopTime"])
            count = max(1, math.ceil(duration * 24))
            # cfg "head_track": bone name whose world matrix is recorded per frame (for a
            # face overlay drawn by the game: metadata headTrack[clip] = [x, y, angle, scale]).
            track = self.cfg.get("head_track")
            if track:
                self._want_world = {track}
            frames = []
            mats = []
            for i in range(count):
                frames.append(self.pose(clip, duration * i / count))
                if track:
                    mats.append((getattr(self, "_last_world_m", {}) or {}).get(track))
            if track:
                self._want_world = None
                self._head_mats = getattr(self, "_head_mats", {})
                self._head_mats[key] = mats
            poses[key] = frames
            print(
                f"[{self.key}] {key}: {count} frames posed (duration={duration:.4f}s),"
                f" parts0={len(frames[0])}",
                flush=True,
            )

        # Idle+move+die share one AABB so walk/idle/death stay the same pixel density.
        # Skill uses PER-FRAME body bounds so attack motion / flight never clips
        # and Merlin late FX / travel cannot shrink idle into a tiny stamp.
        # (Die used to share skill's per-frame zoom — collapsing poses reframed the
        # body and made death flash look momentarily smaller/larger than idle.)
        locomotion_pts = []
        for key in ("idle", "move"):
            for frame in poses.get(key) or []:
                pts = body_points_for_bounds(frame)
                if pts is not None:
                    locomotion_pts.append(pts)
        if not locomotion_pts:
            raise RuntimeError(
                f"[{self.key}] no renderable parts — check prefab/rig linkage"
            )
        locomotion_bounds = padded_bounds_from_points(np.concatenate(locomotion_pts))
        if self.cfg.get("frame_size_units"):
            # Travelling FX actors (Bori) would make the shared camera span their whole path.
            fw, fh = self.cfg["frame_size_units"]
            cxl = (locomotion_bounds[0] + locomotion_bounds[2]) / 2
            cyl = (locomotion_bounds[1] + locomotion_bounds[3]) / 2
            locomotion_bounds = (cxl - fw / 2, cyl - fh / 2, cxl + fw / 2, cyl + fh / 2)
        if self.cfg.get("fixed_bounds"):
            # Several bakes of one unit sharing one camera (Peregrinus bird / change / human).
            locomotion_bounds = tuple(self.cfg["fixed_bounds"])
        lo = np.array(locomotion_bounds[:2])
        hi = np.array(locomotion_bounds[2:])
        print(
            f"[{self.key}] idle+move bounds size="
            f"({hi[0]-lo[0]:.3f}x{hi[1]-lo[1]:.3f}) pad={BOUNDS_PAD}",
            flush=True,
        )

        out = OUT_ROOT / self.key
        native = out / "native"
        native.mkdir(parents=True, exist_ok=True)
        partial = write_set != set(clip_map)
        for key in write_set:
            for old in native.glob(f"{key}_*.png"):
                old.unlink()

        # Union of opaque pixels across all baked frames (draw crop for JS).
        content_acc = [SIZE, SIZE, -1, -1]
        metadata = {
            "source": f"Unity prefab + FBX bake ({self.cfg['char_dir']}/{self.cfg['model']})",
            "native": True,
            "size": SIZE,
            "character": self.key,
        }
        if partial and (out / "anim.json").exists():
            metadata.update(json.loads((out / "anim.json").read_text(encoding="utf-8")))
        for key, frames in poses.items():
            if key not in write_set:
                continue
            clip = clips[key]
            duration = float(clip["m_AnimationClipSettings"]["m_StopTime"])
            metadata[key] = []
            metadata[key + "Fps"] = len(frames) / max(duration, 1e-6)
            metadata[key + "Duration"] = duration
            if key.startswith("skill"):
                events = clip.get("m_Events") or []
                hit = next(
                    (
                        e["time"]
                        for e in events
                        if e.get("functionName")
                        in ("EventHit", "EventThrowEffectGround", "EventAttack")
                    ),
                    None,
                )
                if hit is not None:
                    metadata[key + "HitTime"] = hit
            if key.startswith("skill"):
                metadata.setdefault("skillCamera", {})[key] = []
            for i, parts in enumerate(frames):
                frame_size = SIZE
                off = 0
                head_m = (getattr(self, "_head_mats", {}).get(key) or [None] * len(frames))[i]
                if key.startswith("skill"):
                    # Follow the body each frame but keep the locomotion camera's scale:
                    # per-frame auto-fit zoom made skill poses ~9% larger than idle.
                    pts = body_points_for_bounds(parts)
                    # Giant props (Labiata's sword) must not steer the camera, or the
                    # body jumps around inside the frame as the prop swings.
                    excl = self.cfg.get("skill_center_exclude")
                    if excl:
                        keep = [p[2] for p in parts if include_in_frame_bounds(p[1]) and len(p[2])
                                and not any(t in p[1].lower() for t in excl)]
                        if keep:
                            pts = np.concatenate(keep)
                    lb = locomotion_bounds
                    if pts is not None:
                        fb = padded_bounds_from_points(pts)
                        cx, cy = (fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2
                    else:
                        cx, cy = (lb[0] + lb[2]) / 2, (lb[1] + lb[3]) / 2
                    scs = self.cfg.get("skill_canvas_scale", SKILL_CANVAS_SCALE)
                    hw = (lb[2] - lb[0]) / 2 * scs
                    hh = (lb[3] - lb[1]) / 2 * scs
                    bounds = (cx - hw, cy - hh, cx + hw, cy + hh)
                    frame_size = int(round(SIZE * scs))
                    off = (frame_size - SIZE) // 2
                    metadata["skillOffset"] = off
                    # Skill frames are body-centred; record where this frame's camera sits
                    # relative to the idle camera (bake px) so packers can place the frame
                    # back in idle space (no jump at cast, in-clip root motion kept).
                    f_px = min(SIZE / (lb[2] - lb[0]), SIZE / (lb[3] - lb[1]))
                    lcx, lcy = (lb[0] + lb[2]) / 2, (lb[1] + lb[3]) / 2
                    metadata.setdefault("skillCamera", {}).setdefault(key, []).append(
                        [round((cx - lcx) * f_px, 2), round((lcy - cy) * f_px, 2)])
                else:
                    # idle / move / die — shared locomotion camera (stable on-screen size).
                    bounds = locomotion_bounds
                if key == "die":
                    # Same scale, wider view: the collapse no longer runs off the canvas.
                    cx = (locomotion_bounds[0] + locomotion_bounds[2]) / 2
                    cy = (locomotion_bounds[1] + locomotion_bounds[3]) / 2
                    # Per-character override: Sleipnir is flung high above the frame.
                    dcs = self.cfg.get("die_canvas_scale", DIE_CANVAS_SCALE)
                    hw = (locomotion_bounds[2] - locomotion_bounds[0]) / 2 * dcs
                    hh = (locomotion_bounds[3] - locomotion_bounds[1]) / 2 * dcs
                    bounds = (cx - hw, cy - hh, cx + hw, cy + hh)
                    frame_size = int(round(SIZE * dcs))
                    off = (frame_size - SIZE) // 2
                    metadata["dieOffset"] = off
                img = self.render(parts, bounds, size=frame_size, content_acc=None)
                if head_m is not None:
                    xmin, ymin, xmax, ymax = bounds
                    fac = min(frame_size / (xmax - xmin), frame_size / (ymax - ymin))
                    hx = (head_m[0, 3] - (xmin + xmax) / 2) * fac + frame_size / 2 - off
                    hy = ((ymin + ymax) / 2 - head_m[1, 3]) * fac + frame_size / 2 - off
                    ang = math.atan2(head_m[1, 0], head_m[0, 0])
                    sc = math.hypot(head_m[0, 0], head_m[1, 0]) * fac
                    metadata.setdefault("headTrack", {}).setdefault(key, []).append(
                        [round(hx, 1), round(hy, 1), round(ang, 3), round(sc, 2)])
                # contentBox: include skill/die only when body stays inset (skip FX
                # frames that paint to canvas edges and would shrink idle draw).
                arr = np.asarray(img)
                if arr.ndim == 3 and arr.shape[2] >= 4:
                    ys, xs = np.where(arr[:, :, 3] > SPRITE_ALPHA_THR)
                    if len(xs):
                        x0, x1 = int(xs.min()) - off, int(xs.max()) - off
                        y0, y1 = int(ys.min()) - off, int(ys.max()) - off
                        touches_edge = (
                            x0 <= 4
                            or y0 <= 4
                            or x1 >= SIZE - 5
                            or y1 >= SIZE - 5
                        )
                        skip_for_box = (
                            (key.startswith("skill") or key == "die") and touches_edge
                        )
                        if not skip_for_box:
                            content_acc[0] = min(content_acc[0], x0)
                            content_acc[1] = min(content_acc[1], y0)
                            content_acc[2] = max(content_acc[2], x1)
                            content_acc[3] = max(content_acc[3], y1)
                filename = f"{key}_{i:03d}.png"
                img.save(native / filename, optimize=True)
                metadata[key].append("native/" + filename)
            print(f"[{self.key}] {key} written {len(frames)} @ {SIZE}px", flush=True)

        if (not partial) and content_acc[2] >= content_acc[0]:
            pad_px = CONTENT_BOX_PAD
            x0 = max(0, content_acc[0] - pad_px)
            y0 = max(0, content_acc[1] - pad_px)
            x1 = min(SIZE - 1, content_acc[2] + pad_px)
            y1 = min(SIZE - 1, content_acc[3] + pad_px)
            metadata["contentBox"] = {
                "x": x0,
                "y": y0,
                "w": x1 - x0 + 1,
                "h": y1 - y0 + 1,
            }
            print(
                f"[{self.key}] contentBox="
                f"{metadata['contentBox']['w']}x{metadata['contentBox']['h']}"
                f" @ ({x0},{y0})",
                flush=True,
            )

        (out / "anim.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        if "idle" in poses and (not partial or "idle" in write_set):
            preview = self.render(poses["idle"][0], locomotion_bounds, size=SIZE)
            preview.save(out / "preview.png", optimize=True)
        print(f"[{self.key}] done -> {out}", flush=True)
        return out


def resolve_clips(baker: CharacterBaker, cfg: dict) -> dict:
    fixed = {}
    alts = {
        "idle": ["idle1", "Idle1", "Idle_1", "stand", "Stand", "idle", "Idle"],
        "move": ["move", "Move", "run", "Run"],
        "skill1": [
            "skill1",
            "Skill1",
            "Skil_1",
            "Attack_01",
            "attack_hand_missile_skill",
            "attack_hand_missile",
            "attack",
            "Attack",
            "skill_1",
            "Skill_1",
        ],
        "skill2": [
            "skill2",
            "Skill2",
            "Skil_2",
            "Attack_02",
            "Attack_02_new",
            "attack2",
            "Attack2",
            "skill_2",
            "Skill_2",
        ],
        "die": ["die", "Die", "death", "Death", "dead", "Dead"],
    }
    for clip_key, stem in cfg["clips"].items():
        try:
            baker.load_clip(stem)
            fixed[clip_key] = stem
            continue
        except FileNotFoundError:
            pass
        found = None
        for alt in alts.get(clip_key, [stem]):
            try:
                baker.load_clip(alt)
                found = alt
                break
            except FileNotFoundError:
                continue
        if not found:
            raise FileNotFoundError(f"No clip for {clip_key} (tried {stem} + alts)")
        print(f"[{baker.key}] clip {clip_key}: {stem} -> {found}", flush=True)
        fixed[clip_key] = found
    return fixed


def main():
    import argparse

    global SIZE
    ap = argparse.ArgumentParser()
    ap.add_argument("--char", choices=list(CHARACTERS))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--size", type=int, default=768)
    ap.add_argument(
        "--clips",
        default="",
        help="comma-separated clip keys to rewrite (e.g. die). Others stay.",
    )
    args = ap.parse_args()
    SIZE = args.size
    write_keys = [k.strip() for k in args.clips.split(",") if k.strip()] or None

    keys = list(CHARACTERS) if args.all or not args.char else [args.char]
    failures = []
    for key in keys:
        try:
            cfg = dict(CHARACTERS[key])
            baker = CharacterBaker(key, cfg)
            baker.cfg = {**cfg, "clips": resolve_clips(baker, cfg)}
            baker.bake(write_keys=write_keys)
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
