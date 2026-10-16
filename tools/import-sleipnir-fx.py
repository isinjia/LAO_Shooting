"""Import Sleipnir (P-49) original Skill1 / Skill2 projectile + FX textures.

Resolved from Unity prefabs (material GUID -> texture), grids from prefab tile settings:
  Bullet_Effect/Sleipnir_bullet(2)            -> Texture/Spn_bullet.png (+glow), hit Sleipnir_hit(2)
  Bullet_Effect/Sleipnir_skill1_lastfire_bullet -> Texture/Sleipnir_skill1_lastfire_bullet2.png
  skill1/Sleipnir_fire_L/R        -> Gigantes_attack_fire (4x2) muzzle
  skill1/Sleipnir_hit(2)          -> sniper_hit_fire_sqns (3x3)
  skill1/Sleipnir_skill1_last_hit -> emily_skill_hit_Sqns2 (4x4)
  skill1/Sleipnir_skill1_lastfire -> PD_skill1_hit (4x2)
  skill1/Sleipnir_sonicboom_L/R, skill2 sonic boom -> Padong_sqns2 (3x3)
  skill1/Sleipnir_start_smoke     -> smoke_sqns_ (4x2)
  skill2/Sleipnir_skill2_attack   -> PD_skill1_hit (4x2) + round_trans_sqns (3x3)
  skill2/sleipnir_skill2_boost    -> slepnir_skill2_boost (3x2)
  skill2/sleipnir_skill2_Up_smoke -> DrM_attack_backsmoke1 (3x3)
  skill2/Sleipnir_UP_fly_smoke    -> boom_sqns_234 (4x3)
  skill2/after_smoke(2/3/4), down_smoke -> Sleipnir_ground_boost_smoke (4x3),
        Gigantes_skill2_back_smoke (4x4), Sleipnir_after_smoke (4x3), smoke_ground (3x3)
  skill2/Sleipnir_eyes_lighiting  -> sleipnir_eyes_lighting (4x2)
  skill2/Sleipnir_line_boost      -> blade_line_skill2 (4x2)
Grey sheets are tinted with the prefab particle colours. Writes
assets/native-shots/sleipnir-fx-*.png + sleipnir-fx-source.json. No AI art.
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

# key, source, grid, cell px (None = keep), tint (None = keep colours), hot core
JOBS = [
    ("bullet", "Texture/Spn_bullet.png", (1, 1), None, None, False),
    ("lastbullet", "Texture/Sleipnir_skill1_lastfire_bullet2.png", (1, 1), None, None, False),
    ("muzzle", "sqns_fx/Gigantes_attack_fire.PNG", (4, 2), 192, "#ff8a1c", True),
    ("hit", "sqns_fx/sniper_hit_fire_sqns.PNG", (3, 3), 160, "#ff7a10", True),
    ("lasthit", "sqns_fx/emily_skill_hit_Sqns2.PNG", (4, 4), 192, "#ff8a2e", True),
    ("lastfire", "sqns_fx/PD_skill1_hit.PNG", (4, 2), 192, "#ff7a14", True),
    ("sonic", "sqns_fx/Padong_sqns2.PNG", (3, 3), 160, "#ff6e00", True),
    ("startsmoke", "sqns_fx/smoke_sqns_.PNG", (4, 2), 160, "#d9d2cc", False),
    ("ring", "sqns_fx/round_trans_sqns.PNG", (3, 3), 192, "#ffb43a", True),
    ("boost", "sqns_fx/slepnir_skill2_boost.PNG", (3, 2), 192, "#ffb030", True),
    ("upsmoke", "sqns_fx/DrM_attack_backsmoke1.PNG", (3, 3), 160, "#cfc6bf", False),
    ("flyboom", "sqns_fx/boom_sqns_234.PNG", (4, 3), 192, None, False),
    ("groundsmoke", "sqns_fx/Sleipnir_ground_boost_smoke.PNG", (4, 3), 192, "#bd8f7e", False),
    ("backsmoke", "sqns_fx/Gigantes_skill2_back_smoke.PNG", (4, 4), 192, "#927669", False),
    ("aftersmoke", "sqns_fx/Sleipnir_after_smoke.PNG", (4, 3), 192, "#a8826f", False),
    ("downsmoke", "sqns_fx/smoke_ground.PNG", (3, 3), 160, "#bd8f7e", False),
    ("eyes", "sqns_fx/sleipnir_eyes_lighting.PNG", (4, 2), 256, "#ffd23a", True),
    ("line", "sqns_fx/blade_line_skill2.PNG", (4, 2), 256, "#ff9a30", False),
    # skill2/Sleipnir_gogle_lighting (3x3) and skill1/lastfire_aura glow (guess_texture).
    ("goggle", "sqns_fx/Sleipnir_gogle_lighting.PNG", (3, 3), 160, "#ffd114", True),
    ("aura", "Texture/guess_texture.png", (1, 1), 256, "#ff9a3b", True),
]


def tint(im: Image.Image, hex_color: str, hot_core: bool) -> Image.Image:
    a = np.asarray(im.convert("RGBA")).astype(np.float32) / 255
    rgb, alpha = a[..., :3], a[..., 3]
    lum = rgb.max(axis=2)
    if alpha.min() > 0.99:
        alpha = lum
    col = np.array([int(hex_color[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
    hot = (np.clip((alpha * lum - 0.8) / 0.2, 0, 1) ** 2)[..., None] * (1.0 if hot_core else 0.0)
    out = col * (1 - hot) + hot
    return Image.fromarray((np.clip(np.dstack([out, alpha]), 0, 1) * 255).astype(np.uint8), "RGBA")


def main() -> None:
    meta = {}
    for key, rel, (cols, rows), cell, color, hot in JOBS:
        src = FX / rel
        im = Image.open(src).convert("RGBA")
        if color:
            im = tint(im, color, hot)
        if cell:
            cw, ch = im.width // cols, im.height // rows
            sheet = Image.new("RGBA", (cols * cell, rows * cell))
            for r in range(rows):
                for c in range(cols):
                    tile = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
                    sheet.alpha_composite(tile.resize((cell, cell), Image.Resampling.LANCZOS),
                                          (c * cell, r * cell))
        else:
            bbox = im.getbbox()
            sheet = im.crop(bbox) if bbox else im
        dest = OUT / f"sleipnir-fx-{key}.png"
        sheet.save(dest, optimize=True)
        meta[key] = {"source": rel, "grid": [cols, rows], "cell": cell, "tint": color,
                     "sha256": hashlib.sha256(src.read_bytes()).hexdigest()}
        print(dest.name, sheet.size, dest.stat().st_size)
    (OUT / "sleipnir-fx-source.json").write_text(json.dumps({
        "root": str(FX), "processing": "resize/crop; grey sheets tinted to prefab colours; original art only",
        "sheets": meta,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
