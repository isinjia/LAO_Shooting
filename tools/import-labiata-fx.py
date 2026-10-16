"""Import Labiata (3P_Labiata_N) original Skill1 / Skill2 FX textures.

Resolved from Unity FX prefabs (FX/character_prefab/Labiata_skill/*, material GUID ->
texture) toggled by skill1.anim / skill2.anim FX m_IsActive windows:
  skill1/Labiata_skill1_hit(_first)      -> sqns_fx/Labiata_skill1_hit (3x3)
  skill1/Labiata_skill1_bag_hit          -> sqns_fx/emily_skill_hit_Sqns (4x4)
  skill1/Labiata_skill1_blade1/3, skill2_blade2 -> blade_Johanna (4x3) + Labiata_skill2_blade2_deco (3x3)
  skill1/Labiata_skill1_smoke2/4/5, Labiata_skill_down_smoke -> Labiata_skill1_smoke2 (3x3),
        Labiata_skill1_smoke4 (4x3), smoke_ground (3x3)
  RF_weapon_battery/Labiata_buff_lighting_FX, Labiata_buff_skill1_hit -> Labiata_buff_bag_lighting (4x3),
        after_lighting (4x4)
  skill2/Labiata_skill2_blade_in_particle(2) -> Labiata_skill2_blade_in_particle (3x3)
  skill2/Labiata_skill2_blade_in_aura    -> Labiata_skill2_blade_in_aura (3x3)
  skill2/Labiata_skill2_blade_swing(+back_smoke) -> Labiata_skill2_blade_swing (3x3),
        Labiata_skill2_blade_swing_back_smoke (4x3)
  skill2/Labiata_skill2_blade_up_smoke   -> Labiata_skill2_blade_up_smoke (3x3)
  skill2/Labiata_skill2_blade_wind_aura  -> Labiata_skill2_blade_wind_aura (4x3)
  skill2/Labiata_skill2_jump_up_smoke    -> Labiata_skill2_jump_up_smoke (4x3)
  skill2/skill2_ground_attack            -> skill2_ground_attack (rocks), Labiata_skill2_ground_bomb (4x3),
        Labiata_ground_attack_deco_2 (4x3), Labiata_ground_smoke (4x3)
  skill2/Labiata_skill2_hit              -> Labiata_skill2_hit (4x5)
  buff2/Labiata_skill2_blade_buffaura, Labiata_buff_skill2_hit -> (3x6) sheets
Grey sheets are tinted with the prefab particle start colours. Blades, blade-in particles,
auras and the final burst use the plasma-generator buff prefabs' blue (as seen in game). Writes assets/native-shots/labiata-fx-*.png + labiata-fx-source.json.
Prints each sheet's non-empty frame count (run-fx SHEETS `n`). No AI art.
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
    ("hit", "sqns_fx/Labiata_skill1_hit.PNG", (3, 3), 192, "#ff4a14", True),
    ("baghit", "sqns_fx/emily_skill_hit_Sqns.PNG", (4, 4), 192, "#ff7a00", True),
    ("blade", "sqns_fx/blade_Johanna.PNG", (4, 3), 256, "#167cff", True),
    ("bladedeco", "sqns_fx/Labiata_skill2_blade2_deco.PNG", (3, 3), 256, "#4fd4ff", True),
    ("smoke2", "sqns_fx/Labiata_skill1_smoke2.PNG", (3, 3), 160, "#bd907e", False),
    ("smoke4", "sqns_fx/Labiata_skill1_smoke4.PNG", (4, 3), 192, "#bd907e", False),
    ("downsmoke", "sqns_fx/smoke_ground.PNG", (3, 3), 160, "#bd907e", False),
    ("baglight", "Texture/Labiata_buff_bag_lighting.PNG", (4, 3), 160, "#1ab4ff", True),
    ("spark", "sqns_fx/after_lighting.PNG", (4, 4), 160, "#2a8cff", True),
    ("inparticle", "sqns_fx/Labiata_skill2_blade_in_particle.PNG", (3, 3), 192, "#3aa8ff", True),
    ("inaura", "sqns_fx/Labiata_skill2_blade_in_aura.PNG", (3, 3), 192, "#9ad8ff", True),
    ("swing", "sqns_fx/Labiata_skill2_blade_swing.PNG", (3, 3), 256, "#d8f0ff", True),
    ("swingsmoke", "sqns_fx/Labiata_skill2_blade_swing_back_smoke.PNG", (4, 3), 192, "#bd907e", False),
    ("upsmoke", "sqns_fx/Labiata_skill2_blade_up_smoke.PNG", (3, 3), 192, "#e2d4cc", False),
    ("windaura", "sqns_fx/Labiata_skill2_blade_wind_aura.PNG", (4, 3), 192, "#f0e6e0", True),
    ("jumpsmoke", "sqns_fx/Labiata_skill2_jump_up_smoke.PNG", (4, 3), 192, "#8a7068", False),
    ("rocks", "Texture/skill2_ground_attack.png", (1, 1), None, None, False),
    ("groundbomb", "sqns_fx/Labiata_skill2_ground_bomb.PNG", (4, 3), 256, "#ffbb8e", True),
    ("grounddeco", "sqns_fx/Labiata_ground_attack_deco_2.PNG", (4, 3), 256, "#ff5a3c", True),
    ("groundsmoke", "sqns_fx/Labiata_ground_smoke.PNG", (4, 3), 256, "#b08a78", False),
    ("hit2", "sqns_fx/Labiata_skill2_hit.PNG", (4, 5), 256, "#ff4a3a", True),
    ("buffaura", "sqns_fx/Labiata_skill2_blade_buffaura.PNG", (3, 6), 192, "#0f2eff", True),
    ("finalhit", "sqns_fx/Labiata_buff_skill2_hit.PNG", (3, 6), 256, "#0a61ff", True),
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
        frames = 0
        if cell:
            cw, ch = im.width // cols, im.height // rows
            sheet = Image.new("RGBA", (cols * cell, rows * cell))
            for r in range(rows):
                for c in range(cols):
                    tile = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
                    if np.asarray(tile)[..., 3].max() > 24:
                        frames = r * cols + c + 1
                    sheet.alpha_composite(tile.resize((cell, cell), Image.Resampling.LANCZOS),
                                          (c * cell, r * cell))
        else:
            bbox = im.getbbox()
            sheet = im.crop(bbox) if bbox else im
            frames = 1
        dest = OUT / f"labiata-fx-{key}.png"
        sheet.save(dest, optimize=True)
        meta[key] = {"source": rel, "grid": [cols, rows], "cell": cell, "tint": color, "frames": frames,
                     "sha256": hashlib.sha256(src.read_bytes()).hexdigest()}
        print(f"{dest.name} {sheet.size} frames={frames} {dest.stat().st_size}")
    (OUT / "labiata-fx-source.json").write_text(json.dumps({
        "root": str(FX), "processing": "resize/crop; grey sheets tinted to prefab colours; original art only",
        "sheets": meta,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
