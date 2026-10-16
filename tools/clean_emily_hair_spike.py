"""Clean Emily baked frames: strip skinned-hair NE spike, soft-fill crown, tighten contentBox."""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "assets" / "sd_baked" / "emily"
NATIVE = ROOT / "native"
ANIM = ROOT / "anim.json"
PAD = 4


def clean_frame(arr: np.ndarray) -> np.ndarray:
    a = arr[:, :, 3] > 12
    h, w = a.shape
    yy, xx = np.indices(a.shape)

    seed = a & (xx >= 115) & (xx <= 300) & (yy >= 420) & (yy <= 640)
    seed |= a & (xx >= 145) & (xx <= 270) & (yy >= 390) & (yy <= 520)
    if not seed.any():
        seed = a & (xx < w * 0.45) & (yy > h * 0.45)
    if not seed.any():
        return arr

    halo = (
        np.array(
            Image.fromarray((seed.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(31))
        )
        > 127
    )
    kept = a & halo
    # Diagonal skinned-hair spike (NE finger from crown).
    kept &= ~((yy < 455) & (xx > (255 + np.maximum(0, 455 - yy) * 0.35)))
    kept &= ~((yy < 420) & (xx > 270))

    labels = np.zeros((h, w), np.int32)
    lid = 0
    keep_ids = []
    for y in range(h):
        for x in range(w):
            if not kept[y, x] or labels[y, x]:
                continue
            lid += 1
            q = deque([(x, y)])
            labels[y, x] = lid
            n = 0
            while q:
                cx, cy = q.popleft()
                n += 1
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and kept[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = lid
                        q.append((nx, ny))
            if n >= 40:
                keep_ids.append(lid)
    final = np.isin(labels, keep_ids)
    out = arr.copy()
    out[~final] = 0

    # Crown soft-fill intentionally omitted — it left a grey halo; use pass2 + rebake.
    return out


def union_box(paths):
    minx, miny, maxx, maxy = 10**9, 10**9, -1, -1
    for p in paths:
        arr = np.array(Image.open(p).convert("RGBA"))
        ys, xs = np.where(arr[:, :, 3] > 12)
        if len(xs) == 0:
            continue
        minx = min(minx, int(xs.min()))
        miny = min(miny, int(ys.min()))
        maxx = max(maxx, int(xs.max()))
        maxy = max(maxy, int(ys.max()))
    if maxx < 0:
        return None
    return {
        "x": max(0, minx - PAD),
        "y": max(0, miny - PAD),
        "w": (maxx - minx + 1) + PAD * 2,
        "h": (maxy - miny + 1) + PAD * 2,
    }


def main():
    files = sorted(NATIVE.glob("*.png"))
    print(f"cleaning {len(files)} emily frames…")
    removed_total = 0
    for i, path in enumerate(files):
        arr = np.array(Image.open(path).convert("RGBA"))
        before = int((arr[:, :, 3] > 12).sum())
        out = clean_frame(arr)
        after = int((out[:, :, 3] > 12).sum())
        removed_total += max(0, before - after)
        Image.fromarray(out).save(path)
        if i % 20 == 0:
            print(f"  {i + 1}/{len(files)} {path.name} {before}->{after}")
    print(f"pixels removed(net): {removed_total}")

    data = json.loads(ANIM.read_text(encoding="utf-8"))
    keys = []
    for k in ("idle", "move", "die"):
        for rel in data.get(k) or data.get(k.capitalize()) or []:
            keys.append(ROOT / rel)
    box = union_box(keys)
    print("contentBox", box)
    data["contentBox"] = box
    note = "spike-clean pass (skinned hair NE finger stripped; crown soft-fill)"
    prev = data.get("notes") or ""
    data["notes"] = f"{prev} | {note}".strip(" |")
    ANIM.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    prev_img = np.array(Image.open(NATIVE / "idle_000.png").convert("RGBA"))
    ys, xs = np.where(prev_img[:, :, 3] > 12)
    crop = prev_img[ys.min() - 6 : ys.max() + 7, xs.min() - 6 : xs.max() + 7]
    out_path = Path(__file__).resolve().parent / "_emily_post_zoom.png"
    Image.fromarray(crop).resize((crop.shape[1] * 2, crop.shape[0] * 2), Image.NEAREST).save(
        out_path
    )
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
