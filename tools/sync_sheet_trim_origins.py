#!/usr/bin/env python3
"""Add original-frame crop origins to existing packed sheet metadata, without repacking images."""
import json
from pathlib import Path

from PIL import Image

from pack_sprite_sheets import BAKED, collect_rel_paths, trim_bounds


def main() -> None:
    updated = 0
    checked = 0
    for sheet_path in sorted(BAKED.glob("*/sheet.json")):
        base = sheet_path.parent
        anim = json.loads((base / "anim.json").read_text(encoding="utf-8"))
        sheet = json.loads(sheet_path.read_text(encoding="utf-8"))
        paths = collect_rel_paths(anim)
        changed = False
        for clip in ("idle", "move", "die"):
            rects = sheet.get(clip) or []
            rels = paths[clip]
            if len(rects) != len(rels):
                raise ValueError(f"{base.name}/{clip}: frame count differs")
            for rect, rel in zip(rects, rels):
                with Image.open(base / rel) as image:
                    rgba = image.convert("RGBA")
                    x0, y0, x1, y1 = trim_bounds(rgba)
                if (x1 - x0, y1 - y0) != (rect["w"], rect["h"]):
                    raise ValueError(f"{base.name}/{rel}: packed rectangle differs from native crop")
                if rect.get("ox") != x0 or rect.get("oy") != y0:
                    rect["ox"], rect["oy"] = x0, y0
                    changed = True
                checked += 1
        if changed:
            sheet_path.write_text(json.dumps(sheet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            updated += 1
    print(f"Verified {checked} frames; updated {updated} sheet manifests")


if __name__ == "__main__":
    main()
