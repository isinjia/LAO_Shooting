"""Rampalion's original effect textures (custom-pack Rampart FX) -> assets/native-shots/ramp-fx-*.png.

Sources (E:/LAO/Google_QA/Assets/AssetBundleResourceSub/FX, used by the Rampart_skill prefabs):
  ramp-fx-fire    sqns_fx/Skin_Rampart_skill2_fire.PNG      3x3 swirling flame (Lion skill2 aura)
  ramp-fx-sparks  sqns_fx/Skin_Rampart_last_particle_sqns   2x2 radial spark burst (body_last_particle)
  ramp-fx-ring    sqns_fx/round_trans_sqns.PNG              3x3 crescent ring (Roket_aura / lion aura)
  ramp-fx-bolts   sqns_fx/after_lighting.PNG                4x4 electric after-lighting sparks
  ramp-fx-cloud   Texture/expolosion_basic_text.png         1x1 soft burst cloud (lion_main_aura)
Cells are downscaled to fit the game's draw sizes (js/run-fx.js SHEETS lists the grids).
usage: python tools/import-rampalion-fx.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("E:/LAO/Google_QA/Assets/AssetBundleResourceSub/FX")
OUT = ROOT / "assets" / "native-shots"

SHEETS = {  # key -> (source, cols, rows, out cell px)
    "ramp-fx-fire": ("sqns_fx/Skin_Rampart_skill2_fire.PNG", 3, 3, 256),
    "ramp-fx-sparks": ("sqns_fx/Skin_Rampart_last_particle_sqns.PNG", 2, 2, 256),
    "ramp-fx-ring": ("sqns_fx/round_trans_sqns.PNG", 3, 3, 256),
    "ramp-fx-bolts": ("sqns_fx/after_lighting.PNG", 4, 4, 128),
    "ramp-fx-cloud": ("Texture/expolosion_basic_text.png", 1, 1, 256),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (rel, cols, rows, cell) in SHEETS.items():
        im = Image.open(SRC / rel).convert("RGBA")
        out = im.resize((cols * cell, rows * cell), Image.LANCZOS)
        out.save(OUT / f"{key}.png", optimize=True)
        print(f"{key:16} <- {rel:44} {im.size} -> {out.size}")


if __name__ == "__main__":
    main()
