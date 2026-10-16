"""Emily pass-2: drop soft-fill halo + floating crown debris; retighten contentBox."""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets" / "sd_baked" / "emily"
NATIVE = ROOT / "native"
ANIM = ROOT / "anim.json"
PAD = 4


def largest_component(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    lid = 0
    best_id, best_n = 0, 0
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or labels[y, x]:
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
                    if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = lid
                        q.append((nx, ny))
            if n > best_n:
                best_n = n
                best_id = lid
    return labels == best_id if best_id else mask


def clean_frame(arr: np.ndarray) -> np.ndarray:
    a = arr[:, :, 3] > 12
    if not a.any():
        return arr
    h, w = a.shape
    yy, xx = np.indices(a.shape)

    # Keep only the main body island (drops floating halo shards).
    core = largest_component(a)

    # Estimate head/face band from dense mid column, then strip NE stubs above it.
    ys, xs = np.where(core)
    if len(xs) == 0:
        return arr
    body_top = int(np.percentile(ys, 8))
    face = core & (yy >= body_top) & (yy <= body_top + 90) & (xx >= 150) & (xx <= 260)
    if face.any():
        fxs = xx[face]
        fys = yy[face]
        head_top = int(fys.min())
        head_right = int(np.percentile(fxs, 85))
    else:
        head_top = body_top
        head_right = int(np.percentile(xs, 70))

    kept = core.copy()
    # Cut remaining NE hair finger / soft-fill oval above the crown.
    kept &= ~((yy < head_top + 8) & (xx > head_right - 8))
    kept &= ~((yy < head_top + 28) & (xx > head_right + 18))
    # Semi-transparent soft-fill haze (halo) — drop weak alpha near crown.
    weak = (arr[:, :, 3] < 180) & (yy < head_top + 36) & (xx >= 170) & (xx <= 270)
    kept &= ~weak

    # Re-keep only largest island after cuts.
    kept = largest_component(kept)

    out = arr.copy()
    out[~kept] = 0
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
    print(f"pass2 {len(files)} frames…")
    # Hard stop: a prior pass erased Emily down to ~14k px scraps.
    sample = np.array(Image.open(NATIVE / "idle_000.png").convert("RGBA"))
    sample_area = int((sample[:, :, 3] > 12).sum())
    if sample_area < 20_000:
        raise SystemExit(
            f"pass2 aborted: idle_000 area={sample_area} looks destroyed; rebake first"
        )
    wrote = 0
    for i, path in enumerate(files):
        arr = np.array(Image.open(path).convert("RGBA"))
        before = int((arr[:, :, 3] > 12).sum())
        out = clean_frame(arr)
        after = int((out[:, :, 3] > 12).sum())
        # Never commit a frame that loses most of the silhouette.
        if after < 12_000 or (before > 0 and after < before * 0.55):
            print(f"  SKIP {path.name} before={before} after={after}")
            continue
        Image.fromarray(out).save(path)
        wrote += 1
        if i % 25 == 0:
            ys, xs = np.where(out[:, :, 3] > 12)
            if len(xs):
                print(
                    f"  {path.name} bbox=({xs.min()},{ys.min()})-({xs.max()},{ys.max()}) "
                    f"{xs.max()-xs.min()+1}x{ys.max()-ys.min()+1}"
                )
    if wrote == 0:
        raise SystemExit("pass2 aborted: every frame failed the safety gate")

    data = json.loads(ANIM.read_text(encoding="utf-8"))
    keys = []
    for k in ("idle", "move", "die"):
        for rel in data.get(k) or []:
            keys.append(ROOT / rel)
    box = union_box(keys)
    print("contentBox", box)
    data["contentBox"] = box
    data["notes"] = ((data.get("notes") or "") + " | pass2 halo/debris strip").strip(" |")
    ANIM.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    prev = np.array(Image.open(NATIVE / "idle_000.png").convert("RGBA"))
    ys, xs = np.where(prev[:, :, 3] > 12)
    crop = prev[max(0, ys.min() - 6) : ys.max() + 7, max(0, xs.min() - 6) : xs.max() + 7]
    out_path = Path(__file__).resolve().parent / "_emily_pass2_zoom.png"
    Image.fromarray(crop).resize((crop.shape[1] * 2, crop.shape[0] * 2), Image.NEAREST).save(
        out_path
    )
    print("wrote", out_path)


if __name__ == "__main__":
    main()
