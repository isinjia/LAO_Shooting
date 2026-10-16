"""Safe Emily NE hair-spike strip (idle/move only).

The GPU-skinned hair/ear leftover is a thin diagonal ribbon from the crown
toward the top-right. Cutting columns right of the gun never hits it, so
this pass finds the real (solid) crown row and drops the NE finger.

Die clips are left untouched (FX stamps break the compact-locomotion test).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets" / "sd_baked" / "emily"
NATIVE = ROOT / "native"
ANIM = ROOT / "anim.json"
PAD = 4
MIN_KEEP_RATIO = 0.70
MIN_AREA = 12_000


def clean_frame(arr: np.ndarray) -> np.ndarray | None:
    alpha = arr[:, :, 3] > 12
    if not alpha.any():
        return arr
    before = int(alpha.sum())
    ys, xs = np.where(alpha)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    stamp_w = x1 - x0 + 1
    stamp_h = y1 - y0 + 1
    # Idle/move sit in a compact stamp; die FX fills most of the 768 canvas.
    if stamp_h > 320 or stamp_w > 280:
        return arr

    row_n = alpha.sum(axis=1)
    face_lo = y0 + int(stamp_h * 0.28)
    face_hi = y0 + int(stamp_h * 0.52)
    face_rows = [y for y in range(face_lo, face_hi + 1) if 40 <= row_n[y] <= 110]
    if len(face_rows) < 4:
        face_rows = [y for y in range(face_lo, face_hi + 1) if row_n[y] >= 36]
    if not face_rows:
        return arr

    band = alpha[face_rows[0] : face_rows[-1] + 1]
    bxs = np.where(band)[1]
    if len(bxs) == 0:
        return arr
    head_left = int(np.percentile(bxs, 8))
    head_right = int(np.percentile(bxs, 90))
    head_cx = 0.5 * (head_left + head_right)

    crown = None
    for y in range(y0, face_rows[0] + 1):
        cols = np.flatnonzero(alpha[y])
        if len(cols) < 36:
            continue
        span = int(cols[-1] - cols[0] + 1)
        # Skip gappy rows (left hair + detached NE spike).
        if int(cols[0]) <= head_left + 20 and len(cols) >= span * 0.88:
            crown = y
            break
    if crown is None:
        crown = face_rows[0]

    yy, xx = np.indices(alpha.shape)
    spike = (yy < crown) & (xx > head_cx - 4)
    spike |= (yy < crown + 8) & (xx > head_right - 4)
    diag = head_right - 4 + np.maximum(0, crown + 6 - yy) * 0.75
    spike |= (yy < crown + 12) & (xx > diag)

    kept = alpha & ~spike
    after = int(kept.sum())
    removed = before - after
    if removed < 400:
        return arr
    if after < MIN_AREA or after < before * MIN_KEEP_RATIO:
        return None

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
    data = json.loads(ANIM.read_text(encoding="utf-8"))
    targets = []
    for k in ("idle", "move"):
        for rel in data.get(k) or []:
            targets.append(ROOT / rel)

    print(f"safe-clean {len(targets)} idle/move frames (die skipped)…")
    skipped = 0
    removed = 0
    wrote = 0
    for i, path in enumerate(targets):
        arr = np.array(Image.open(path).convert("RGBA"))
        before = int((arr[:, :, 3] > 12).sum())
        out = clean_frame(arr)
        if out is None:
            skipped += 1
            print(f"  SKIP {path.name} before={before}")
            continue
        after = int((out[:, :, 3] > 12).sum())
        removed += max(0, before - after)
        if after != before:
            Image.fromarray(out).save(path)
            wrote += 1
        if i % 8 == 0:
            ys, xs = np.where(out[:, :, 3] > 12)
            print(
                f"  {path.name} {before}->{after} "
                f"bbox=({int(xs.min())},{int(ys.min())})-({int(xs.max())},{int(ys.max())}) "
                f"wh={int(xs.max()-xs.min()+1)}x{int(ys.max()-ys.min()+1)}"
            )

    box = union_box(targets)
    print("contentBox", box, "pixels_removed", removed, "skipped", skipped, "wrote", wrote)
    # Compact silhouette after the NE ribbon is gone (~170x190).
    if not box or box["w"] < 140 or box["h"] < 160 or box["w"] > 400 or box["h"] > 400:
        raise SystemExit(f"safe-clean aborted: contentBox implausible {box}")
    data["contentBox"] = box
    note = "crown-row NE spike strip (idle/move)"
    data["notes"] = ((data.get("notes") or "") + f" | {note}").strip(" |")
    ANIM.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    idle0 = NATIVE / "idle_000.png"
    if idle0.exists():
        Image.open(idle0).convert("RGBA").save(ROOT / "preview.png")
        print("updated preview.png")


if __name__ == "__main__":
    main()
