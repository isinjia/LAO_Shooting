"""Import Griffin (P/A-00) original Skill2 projectile + FX textures.

Resolved from Unity prefabs (material GUID -> texture):
  Bullet_Effect/FX_bullet_hand_Missile, FX_PA00EL_Framebullet
      shot_Missile = Bullet/hand_missile_1/handmissile.png (sprite 0 body, sprite 1 plume)
      booster      = sqns_fx/fire_smoke_sqns_2 (3x3)
  FX/character_prefab/PA00EL_skill/fire_Hit          -> fire_sqns_hit (4x4), fire_sqns_m (4x2)
  FX/character_prefab/PA00EL_skill/PA00EL_skill_2_hit -> hit_fire_m (4x3), hit_smog (4x3)
  PA00EL_up_smoke -> boom_sqns_234 (4x3); PA00EL_up_line / fly_line -> blade_line_skill2 (4x2)
  PA00EL_roket_fire_skill2 -> pani_fire_sqns_43 (4x3)
Writes assets/native-shots/griffin-fx-*.png + griffin-fx-source.json. No AI art.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SUB = Path(r"E:\LAO\Google_QA\Assets\AssetBundleResourceSub")
OUT = ROOT / "assets" / "native-shots"

# key, source (under SUB), grid, cell px (None = keep size), tint, crop box (x0,y0,x1,y1) or None
JOBS = [
    ("missile", "Bullet/hand_missile_1/handmissile.png", (1, 1), None, None, (0, 1, 255, 131)),
    ("plume", "Bullet/hand_missile_1/handmissile.png", (1, 1), None, "#ff6a1a", (0, 131, 256, 256)),
    ("booster", "FX/sqns_fx/fire_smoke_sqns_2.PNG", (3, 3), 128, "#8a847e", None),  # dark chain trail (video)
    ("firehit", "FX/sqns_fx/fire_sqns_hit.PNG", (4, 4), 160, None, None),
    ("groundfire", "FX/sqns_fx/fire_sqns_m.PNG", (4, 2), 160, None, None),
    ("skill2hit", "FX/sqns_fx/hit_fire_m.PNG", (4, 3), 192, None, None),
    ("smog", "FX/sqns_fx/hit_smog.PNG", (4, 3), 192, None, None),
    ("boom", "FX/sqns_fx/boom_sqns_234.PNG", (4, 3), 192, None, None),
    ("jet", "FX/sqns_fx/pani_fire_sqns_43.PNG", (4, 3), 128, "#ff8a2a", None),
    ("line", "FX/sqns_fx/blade_line_skill2.PNG", (4, 2), 256, "#fff0d0", None),
    ("linegold", "FX/sqns_fx/blade_line_skill2.PNG", (4, 2), 256, "#ffb02a", None),  # liftoff pillar (video)
]


def tint(im: Image.Image, hex_color: str, hot_core: bool = True) -> Image.Image:
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
    for key, rel, (cols, rows), cell, color, crop in JOBS:
        src = SUB / rel
        im = Image.open(src).convert("RGBA")
        if crop:
            im = im.crop(crop)
        if color:
            # Smoke chains and the liftoff pillar are solid colour in the video (no white core).
            im = tint(im, color, hot_core=key not in ("booster", "linegold", "plume"))
        if cell:
            cw, ch = im.width // cols, im.height // rows
            sheet = Image.new("RGBA", (cols * cell, rows * cell))
            for r in range(rows):
                for c in range(cols):
                    tile = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
                    sheet.alpha_composite(tile.resize((cell, cell), Image.Resampling.LANCZOS),
                                          (c * cell, r * cell))
        else:
            sheet = im
        dest = OUT / f"griffin-fx-{key}.png"
        sheet.save(dest, optimize=True)
        meta[key] = {"source": rel, "grid": [cols, rows], "cell": cell, "tint": color, "crop": crop,
                     "sha256": hashlib.sha256(src.read_bytes()).hexdigest()}
        print(dest.name, sheet.size, dest.stat().st_size)
    (OUT / "griffin-fx-source.json").write_text(json.dumps({
        "root": str(SUB), "processing": "crop/resize; grey sheets tinted to prefab colours; original art only",
        "sheets": meta,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
