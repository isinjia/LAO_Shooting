"""Bake ending (visual-novel) standing portraits from the original 2D lobby models.

Each pilot's Character_2D model (prefab + FBX puppet + FullbodyIMG parts atlas) is posed
on the first frame of its lobby clip with the SD baker (tools/bake_sd_character.py), then
trimmed and written to assets/ui/vn/<pilot>.webp. The temporary bake folder
(assets/sd_baked/vn_<pilot>) is removed afterwards.
usage: python tools/bake-vn-portraits.py [pilot ...]
"""
import shutil
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake_sd_character as B  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
QA = Path(r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets")
SUB = QA / "AssetBundleResourceSub" / "Character_2D"
BUNDLE = QA / "AssetBundleResource" / "Character_2D"
OUT = ROOT / "assets" / "ui" / "vn"
SIZE = 1400
# pilot -> (model folder, lobby clip)
MODELS = {
    "labiata": ("2DModel_3P_Labiata_N", "Labiata_N_2DModel_lobby"),
    # Prefab lives in AssetBundleResource; FBX / atlas / clips in the Sub folder.
    "constantia": ("2DModel_3P_ConstantiaS2_N", "3P_BConstantiaS2_N_2DModel_lobby", "2DModel_3P_ConstantiaS2_N"),
    "lrl": ("2DModel_PECS_LRL_N", "PECS_LRL_N_2DModel_lobby"),
    "griffin": ("2DModel_BR_PA00EL_N", "BR_PA00EL_N_2DModel_lobby"),
    "sleipnir": ("2DModel_BR_Sleipnir_N", "BR_Sleipnir_N_lobby"),
    "express76": ("2DModel_PECS_Express76_NS1", "PECS_Express76_NS1_Lobby"),
}


def bake(pilot):
    folder, clip, *prefab_name = MODELS[pilot]
    d = SUB / folder
    prefab = (BUNDLE / f"{prefab_name[0]}.prefab" if prefab_name
              else next(iter(d.glob("**/*.prefab")), None) or BUNDLE / f"{folder}.prefab")
    cfg = {"model_abs": str(d), "prefab_abs": str(prefab), "materials": "Materials",
           "model": folder, "char_dir": folder,
           "fbx_glob": "**/*.[Ff][Bb][Xx]", "clips": {"idle": clip}}
    key = f"vn_{pilot}"
    B.SIZE = SIZE
    B.CHARACTERS[key] = cfg
    baker = B.CharacterBaker(key, cfg)
    # One pose is enough: cut the lobby clip to its first frame.
    load = baker.load_clip
    def first_frame(stem):
        clip = load(stem)
        clip["m_AnimationClipSettings"]["m_StopTime"] = 0.02
        return clip
    baker.load_clip = first_frame
    baker.cfg = cfg
    baker.bake()
    tmp = ROOT / "assets" / "sd_baked" / key
    im = Image.open(tmp / "preview.png").convert("RGBA")
    im = im.crop(im.getbbox())
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / f"{pilot}.webp", "WEBP", quality=88, method=5)
    shutil.rmtree(tmp)
    print(f"[{pilot}] -> {OUT / (pilot + '.webp')} {im.size}")


if __name__ == "__main__":
    for p in sys.argv[1:] or list(MODELS):
        try:
            bake(p)
        except Exception as e:  # keep going: one broken model must not stop the rest
            print(f"[{p}] FAILED: {e}")
