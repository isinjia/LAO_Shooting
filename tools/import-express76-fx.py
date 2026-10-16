"""Import Express 76 original skill FX textures (Unity AssetBundleResourceSub/FX) for C / X.

Sources were resolved from the prefabs under
AssetBundleResource/FX/character_prefab/express_skill/{skill1,skill2} via their
material GUIDs. Grey additive sheets are tinted with the prefab particle colours
(materials use a neutral 0.5 _TintColor); bright cores stay white-hot.
Writes assets/native-shots/express76-fx-*.png + express76-fx-source.json.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FX = Path(r"E:\LAO\Google_QA\Assets\AssetBundleResourceSub\FX")
OUT = ROOT / "assets" / "native-shots"

# key, source, grid (cols, rows), output cell px, tint (None = keep colours), prefab
JOBS = [
    ("sonicboom", "sqns_fx/Padong_sqns2.PNG", (3, 3), 160, "#ff6e00", "skill1/Express_skill1_sonicboom"),
    ("impact", "sqns_fx/DrM_1skill_last_attack.PNG", (3, 3), 192, "#ff5a1c", "Express_skill1_attack"),
    ("smoke", "sqns_fx/smoke_ground.PNG", (3, 3), 192, "#bd8f7e", "skill1/Express_down_smoke"),
    ("trail", "Texture/trail_fire4.png", (1, 1), 256, "#ff6e00", "skill1/Express_skill1_fire_particle"),
    ("box", "Texture/express_box.png", (1, 1), 256, None, "skill2/Express_box_lighting"),
    ("light", "Texture/express_light_text 2.png", (1, 1), 256, "#ffb800", "skill2/Express_skill2_lighting"),
    ("bling", "sqns_fx/bling_particle.PNG", (3, 2), 128, "#ffe556", "skill2/eye_bling_express"),
    ("hit", "sqns_fx/simple_hit 1.PNG", (3, 3), 160, "#f9ad09", "skill2/Express_simple_skill_hit"),
    ("fireparticle", "sqns_fx/DrM_skill2_last_hit.PNG", (4, 2), 192, "#ff6e00", "skill1/Express_skill1_fire_particle"),
    ("buffline", "Texture/trail_fire4.png", (1, 1), 256, "#ffb800", "skill2/Express_skill2_buff_lighting_event"),
]


def tint(im: Image.Image, hex_color: str) -> Image.Image:
    a = np.asarray(im.convert("RGBA")).astype(np.float32) / 255
    rgb, alpha = a[..., :3], a[..., 3]
    lum = rgb.max(axis=2)
    if alpha.min() > 0.99:  # opaque black-background sheet: luminance is the mask
        alpha = lum
    col = np.array([int(hex_color[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
    # Intensity lives in alpha (RGB is flat white); only the densest core stays white-hot.
    hot = (np.clip((alpha * lum - 0.8) / 0.2, 0, 1) ** 2)[..., None]
    out = col * (1 - hot) + hot
    res = np.dstack([out, alpha])
    return Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8), "RGBA")


def main() -> None:
    meta = {}
    for key, rel, (cols, rows), cell, color, prefab in JOBS:
        src = FX / rel
        im = Image.open(src).convert("RGBA")
        if color:
            im = tint(im, color)
        cw, ch = im.width // cols, im.height // rows
        sheet = Image.new("RGBA", (cols * cell, rows * cell))
        for r in range(rows):
            for c in range(cols):
                tile = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
                sheet.alpha_composite(tile.resize((cell, cell), Image.Resampling.LANCZOS), (c * cell, r * cell))
        dest = OUT / f"express76-fx-{key}.png"
        sheet.save(dest, optimize=True)
        meta[key] = {
            "source": str(rel), "prefab": prefab, "grid": [cols, rows], "cell": cell,
            "tint": color, "sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
        }
        print(dest.name, sheet.size, dest.stat().st_size)
    (OUT / "express76-fx-source.json").write_text(json.dumps({
        "root": str(FX), "processing": "prefab-colour tint on grey additive sheets; resize only; no AI art",
        "sheets": meta,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
