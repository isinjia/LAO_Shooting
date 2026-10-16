"""Import Constantia (3P_ConstantiaS2_N) original Attack_01 / Attack_02 FX + Bori sprite.

Resolved from Unity prefabs (material GUID -> texture):
  skill1/Constantia_fire (muzzle)   -> sqns_fx/Emy_fire_skill_2_re (4x2), fire_round_line_re (4x2)
  Bullet_Effect/FX_bullet_Gun_ConstantiaS2 -> FX/ETC_FX/shot.png tracer (+ Texture/glow)
  skill1/Constantia_hit             -> sqns_fx/sniper_hit_fire_sqns_re (4x2), sni_smoke_sqns_re (4x3),
                                       blade_line_skill2_re (1x2)
  FX_hit_bori: Constantia_bori_start -> fire_round_line_re (cyan), valkyrie smoke_sqns_fix_re (3x3)
               Constantia_bort_hit   -> constancha_bori_attack_re (5x2), DrM_1skill_last_attack_re (4x2)
               Constantia_bori_aim   -> Texture/dogaim.png
  FX_ATK_CartridgeCase_fast         -> Texture/CartridgeCase.png
  Bori (fx_Hit_bori 3D paper-doll dog) -> parts of Materials/Texture_3P_Bori_N.png assembled
                                       into one leaping pose (body/head, legs, tail).
Grey sheets are tinted with the prefab particle start colours. Writes
assets/native-shots/constantia-fx-*.png, constantia-prop-bori.png + constantia-fx-source.json.
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
FX_MAIN = Path(r"E:\LAO\Google_QA\Assets\AssetBundleResource\FX")
BORI_TEX = Path(r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_3P_ConstantiaS2_N"
                r"\Model_3P_ConstantiaS2_N\Materials\Texture_3P_Bori_N.png")
OUT = ROOT / "assets" / "native-shots"

# key, source, grid, cell px (None = keep), tint (None = keep colours), hot core
JOBS = [
    ("muzzle", FX / "sqns_fx/Emy_fire_skill_2_re.png", (4, 2), 128, "#ffcd47", True),
    ("muzzlering", FX / "sqns_fx/fire_round_line_re.png", (4, 2), 128, "#f0f0f0", True),
    ("tracer", FX_MAIN / "ETC_FX/shot.png", (1, 1), None, None, False),
    ("hit", FX / "sqns_fx/sniper_hit_fire_sqns_re.png", (4, 2), 128, "#ff6000", True),
    ("hitsmoke", FX / "sqns_fx/sni_smoke_sqns_re.png", (4, 3), 128, "#e3d6d6", False),
    ("hitline", FX / "sqns_fx/blade_line_skill2_re.png", (1, 2), 128, "#ff8200", True),
    ("boriring", FX / "sqns_fx/fire_round_line_re.png", (4, 2), 128, "#10e1ff", True),
    ("borismoke", FX / "valkyrie_texture/valkyrie_text/smoke_sqns_fix_re.png", (3, 3), 160, "#8a7a6c", False),
    ("bite", FX / "sqns_fx/constancha_bori_attack_re.png", (5, 2), 128, "#ffbb70", True),
    ("bitehit", FX / "sqns_fx/DrM_1skill_last_attack_re.png", (4, 2), 128, "#ff800f", True),
    ("aim", FX / "Texture/dogaim.png", (1, 1), None, "#10e1ff", True),
    ("case", FX / "Texture/CartridgeCase.png", (1, 1), None, None, False),
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


def bori_leap() -> Image.Image:
    """Assemble the paper-doll Bori parts into a single leaping pose (facing right)."""
    im = Image.open(BORI_TEX).convert("RGBA")

    def part(box):
        p = im.crop(box)
        return p.crop(p.getbbox())

    body = part((0, 0, 560, 265))  # body + snarling head + collar
    far_f, far_h = part((455, 280, 565, 430)), part((270, 275, 435, 450))
    near_f, near_h = part((30, 280, 250, 510)), part((30, 530, 365, 825))
    tail = part((15, 868, 362, 998))
    canvas = Image.new("RGBA", (1300, 800))

    def put(p, ang, x, y, anchor):
        w, h = p.size
        ax, ay = anchor[0] * w, anchor[1] * h
        big = Image.new("RGBA", (w * 3, h * 3))
        big.alpha_composite(p, (w, h))
        r = big.rotate(ang, resample=Image.BICUBIC, center=(w + ax, h + ay))
        canvas.alpha_composite(r, (int(x - (w + ax)), int(y - (h + ay))))

    bx, by = 380, 200
    put(far_h, 55, bx + 120, by + 190, (0.6, 0.1))
    put(far_f, 75, bx + 440, by + 170, (0.4, 0.05))
    put(tail, -18, bx + 45, by + 75, (0.97, 0.4))
    canvas.alpha_composite(body, (bx, by))
    put(near_h, -62, bx + 120, by + 160, (0.72, 0.14))
    put(near_f, 70, bx + 410, by + 175, (0.45, 0.08))
    out = canvas.crop(canvas.getbbox())
    return out.resize((out.width // 2, out.height // 2), Image.Resampling.LANCZOS)


def main() -> None:
    meta = {}
    for key, src, (cols, rows), cell, color, hot in JOBS:
        im = Image.open(src).convert("RGBA")
        if color:
            im = tint(im, color, hot)
        frames = 1
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
        dest = OUT / f"constantia-fx-{key}.png"
        sheet.save(dest, optimize=True)
        meta[key] = {"source": str(src), "grid": [cols, rows], "cell": cell, "tint": color, "frames": frames,
                     "sha256": hashlib.sha256(Path(src).read_bytes()).hexdigest()}
        print(f"{dest.name} {sheet.size} frames={frames}")
    bori = bori_leap()
    dest = OUT / "constantia-prop-bori.png"
    bori.save(dest, optimize=True)
    meta["bori"] = {"source": str(BORI_TEX), "processing": "paper-doll parts assembled into a leap pose",
                    "sha256": hashlib.sha256(BORI_TEX.read_bytes()).hexdigest()}
    print(dest.name, bori.size)
    (OUT / "constantia-fx-source.json").write_text(json.dumps({
        "processing": "resize/crop; grey sheets tinted to prefab colours; original art only",
        "sheets": meta}, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
