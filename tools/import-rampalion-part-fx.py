"""Rampalion's fused parts fire their robots' own original shots (user: each part's bullets must
follow its original character's concept) -> assets/native-shots/ramp-pf-*.webp.

Sources (E:/LAO/Google_QA/Assets): each robot's skill / Bullet_Effect prefabs, resolved through
their materials to the textures below.
  Tyrant      fire breath + bite: Tyrant_skill2_Fire_2x2 flame, Fortress_skill2_fire mouth
              flash, Tyrant_skill1_bite 2x2 claw-spark hit
  Aeda        cyan parallel barrage: FX_beam cyan orb (muzzle), Labiata_skill1_hit 3x3 hit
  Goltarion   violet crescent sword waves (drawn, shot-fx.js) in Goltarion's colour: the
              round_boom2 ring muzzle and its Fire_sprite_2x2 hit, both tinted violet
  Hestia      orange beam: Hirume_beam body, Ramiel_fire6 4x3 muzzle, Peregrinus_pang2 2x3 hit
  Roc         lightning: Roc_skill1_lighting_text3 strands (on its wing beam), the
              Roc_skill1_bullet_lighting2 electric orb (wing-tip muzzle), handgun_hit 3x3 hit
  SpartanB    missile salvo: Calista_skill2_bullet rocket, fire_smoke 3x3 trail,
              Spartan3_Skill2_fire 2x2 muzzle, FX_Explosion_fire 3x3 hit
  Shade       SMG tracers: gigantes_bullet tracer, Shade_skill1_fire 4x2 muzzle, bullet_tan hit
  Alfred      drone red laser: its FX_beam.png (red dot + capsule beam), Fire_Hit_Sprite 2x2 hit
Black-background (RGB) sources are turned into alpha (max channel) so they draw additively.
usage: python tools/import-rampalion-part-fx.py [--sheet contact.png]
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
A = Path("E:/LAO/Google_QA/Assets/AssetBundleResource")
S = Path("E:/LAO/Google_QA/Assets/AssetBundleResourceSub")
OUT = ROOT / "assets" / "native-shots"

# key -> (source, cols, rows, out cell px [, crop box in source px])
SHEETS = {
    # Tyrant
    "ramp-pf-tyrant-flame": (S / "FX/sqns_fx/Tyrant_skill2_Fire_2x2_Sprite.png", 2, 2, 128),
    "ramp-pf-tyrant-mouth": (S / "FX/sqns_fx/Fortress_skill2_fire_sqns.png", 2, 2, 192),
    "ramp-pf-tyrant-bite": (S / "FX/sqns_fx/Tyrant_skill1_bite_sprite_2x2.png", 2, 2, 192),
    # Aeda
    "ramp-pf-aeda-orb": (S / "FX/Texture/FX_beam.png", 1, 1, 96, None),
    "ramp-pf-aeda-hit": (S / "FX/sqns_fx/Labiata_skill1_hit.PNG", 3, 3, 160),
    # Goltarion
    "ramp-pf-golt-ring": (S / "FX/Texture/round_boom2_text23.png", 1, 1, 160),
    "ramp-pf-golt-hit": (S / "FX/sqns_fx/Fire_sprite_2x2_5924.png", 2, 2, 160),
    # Hestia
    "ramp-pf-hest-beam": (S / "FX/Texture/Hirume_beam.png", 1, 1, 256),
    "ramp-pf-hest-muzzle": (S / "FX/sqns_fx/Ramiel_fire6.png", 4, 3, 64),
    "ramp-pf-hest-hit": (S / "FX/sqns_fx/Peregrinus_pang2.png", 2, 3, 160),
    # Roc
    "ramp-pf-roc-bolt": (S / "FX/Texture/Roc_skill1_lighting_text3.png", 1, 1, 512),
    "ramp-pf-roc-orb": (S / "FX/Texture/Roc_skill1_bullet_lighting2.png", 1, 1, 128),
    "ramp-pf-roc-hit": (S / "FX/Texture/handgun_hit_sqns.PNG", 3, 3, 160),
    # Spartan Boomer
    "ramp-pf-sb-rocket": (S / "FX/Texture/Calista_skill2_bullet_text.png", 1, 1, 128),
    "ramp-pf-sb-smoke": (S / "FX/sqns_fx/fire_smoke_sqns_2.PNG", 3, 3, 96),
    "ramp-pf-sb-muzzle": (S / "FX/sqns_fx/Spartan3_Skill2_fire_sqns.PNG", 2, 2, 128),
    "ramp-pf-sb-boom": (S / "FX/sqns_fx/FX_Explosion_fire_Sqns.PNG", 3, 3, 192),
    # Shade
    "ramp-pf-shade-tracer": (S / "FX/Texture/gigantes_bullet.png", 1, 1, 256),
    "ramp-pf-shade-muzzle": (S / "FX/sqns_fx/Shade_skill1_fire.PNG", 4, 2, 128),
    "ramp-pf-shade-hit": (S / "FX/Texture/bullet_tan.png", 1, 1, 128),
    # Mr. Alfred
    "ramp-pf-alfred-beam": (A / "Character/Char_AGS_MrAlfred2_N/Model_AGS_MrAlfred2_N/mesh/FX_beam.png", 1, 1, 256),
    "ramp-pf-alfred-dot": (A / "Character/Char_AGS_MrAlfred2_N/Model_AGS_MrAlfred2_N/mesh/FX_beam.png", 1, 1, 96),
    "ramp-pf-alfred-hit": (S / "FX/sqns_fx/Fire_Hit_Sprite_2x2.png", 2, 2, 160),
}
# Crops in source px: Aeda's FX_beam atlas orb sprite (FX_beam_0: Unity rect 34,741 162x175,
# y from the bottom of the 1024 atlas); the small rocket / tracer drawn mid-canvas; Alfred's
# FX_beam = red dot (left) + capsule beam (right).
CROPS = {
    "ramp-pf-aeda-orb": (34, 108, 196, 283),
    "ramp-pf-sb-rocket": (80, 226, 293, 285),
    "ramp-pf-shade-tracer": (225, 235, 365, 276),
    "ramp-pf-alfred-beam": (133, 3, 228, 253),
    "ramp-pf-alfred-dot": (0, 10, 90, 100),
}
# Vertical art turned to point right (+x = flight direction).
ROTATE = {"ramp-pf-alfred-beam": 90}
# White sources are coloured in the original by the particle startColor: bake that tint in
# (luminance x tint, the hottest pixels kept white-hot).
TINT = {
    "ramp-pf-aeda-hit": (43, 220, 255),
    "ramp-pf-golt-ring": (176, 106, 255),
    "ramp-pf-golt-hit": (168, 85, 247),
    "ramp-pf-roc-bolt": (255, 192, 74),
    "ramp-pf-roc-hit": (255, 122, 26),
    "ramp-pf-sb-smoke": (120, 116, 112),
    "ramp-pf-sb-muzzle": (255, 106, 44),
    "ramp-pf-sb-boom": (255, 158, 13),
    "ramp-pf-shade-muzzle": (255, 149, 14),
}


def to_alpha(im):
    """RGB / opaque additive art: alpha = brightest channel, colour un-premultiplied."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    opaque = all(px[x, y][3] == 255 for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)))
    if not opaque:
        return im
    out = Image.new("RGBA", im.size)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = max(r, g, b)
            if a == 0:
                op[x, y] = (0, 0, 0, 0)
            else:
                op[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), a)
    return out


def tint(im, rgb):
    import numpy as np
    a = np.asarray(im).astype(np.float32)
    lum = a[..., :3].max(axis=2) / 255.0
    hot = (lum ** 6) * 0.3
    for c in range(3):
        a[..., c] = np.clip(rgb[c] * lum * (1 - hot) + 255 * hot, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for key, spec in SHEETS.items():
        src, cols, rows, cell = spec[:4]
        im = Image.open(src)
        if key in CROPS:
            im = im.crop(CROPS[key])
        im = to_alpha(im)
        if key in ROTATE:
            im = im.rotate(ROTATE[key], expand=True)
        if key in TINT:
            im = tint(im, TINT[key])
        w, h = im.size
        if cols == 1 and rows == 1:
            k = cell / max(w, h)
            out = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        else:
            out = im.resize((cols * cell, rows * cell), Image.LANCZOS)
        out.save(OUT / f"{key}.webp", "WEBP", quality=90, alpha_quality=100, method=6)
        made.append((key, out))
        print(f"{key:22} <- {src.name:44} {im.size} -> {out.size}")
    if "--sheet" in sys.argv:
        path = sys.argv[sys.argv.index("--sheet") + 1]
        tile = 200
        sheet = Image.new("RGBA", (tile * 6, tile * ((len(made) + 5) // 6)), (24, 26, 34, 255))
        for i, (key, im) in enumerate(made):
            t = im.copy()
            t.thumbnail((tile - 10, tile - 24))
            sheet.alpha_composite(t, (i % 6 * tile + 5, i // 6 * tile + 5))
        sheet.save(path)


if __name__ == "__main__":
    main()
