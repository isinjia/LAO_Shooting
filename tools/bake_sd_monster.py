"""Bake LAO Metal Parasite / monster skins into assets/sd_baked/{key}/.

Reuses CharacterBaker from bake_sd_character.py. Prefabs live under
AssetBundleResource/monster; meshes/anims under AssetBundleResourceSub/Character.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bake_sd_character as bake

MONSTER_MODEL_ROOT = Path(
    r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets\AssetBundleResourceSub\Character"
)
MONSTER_PREFAB_ROOT = Path(
    r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets\AssetBundleResource\monster"
)

# True monsters (not bioroid skins). Idle/move/die is enough for the HTML shmup
# (loadNativeAnim currently skips skill PNG frames).
MONSTERS = {
    "deathstalker": {
        "model_abs": MONSTER_MODEL_ROOT / "Model_MP_DeathStalker_N",
        "prefab_abs": MONSTER_PREFAB_ROOT / "Model_MP_DeathStalker_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "Idle1",
            "move": "Move",
            "skill1": "Skill1",
            "die": "Die",
        },
    },
    "doomeater": {
        "model_abs": MONSTER_MODEL_ROOT / "Model_MP_DoomEater_N",
        "prefab_abs": MONSTER_PREFAB_ROOT / "Model_MP_DoomEater_N.prefab",
        "materials": "Materials",
        "fbx_glob": "3D/*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "stand_1",
            "move": "move",
            "skill1": "skil_1_1",
            "die": "die",
        },
    },
    "blackknight": {
        "model_abs": MONSTER_MODEL_ROOT / "Model_MP_BlackKnight_N",
        "prefab_abs": MONSTER_PREFAB_ROOT / "Model_MP_BlackKnight_N.prefab",
        "materials": "Materials",
        "fbx_glob": "*.[Ff][Bb][Xx]",
        "clips": {
            "idle": "Idle1",
            "move": "Move",
            "skill1": "Skill1",
            "die": "Die",
        },
    },
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--monster", choices=list(MONSTERS))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--size", type=int, default=512)
    args = ap.parse_args()

    bake.SIZE = args.size
    bake.OUT_ROOT = Path(__file__).resolve().parents[1] / "assets" / "sd_baked"

    keys = list(MONSTERS) if args.all or not args.monster else [args.monster]
    failures = []
    for key in keys:
        try:
            cfg = dict(MONSTERS[key])
            # CharacterBaker still expects these keys when abs paths are absent.
            cfg.setdefault("char_dir", "")
            cfg.setdefault("model", "")
            cfg.setdefault("prefab", "")
            baker = bake.CharacterBaker(key, cfg)
            baker.cfg = {**cfg, "clips": bake.resolve_clips(baker, cfg)}
            baker.bake()
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
