"""File metrics of the shipped SFX (assets/audio/sfx) against js/sfx-table.js -> JSON.
usage: python tools/eval-sfx-files.py out.json
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sfx_analyze import decode, measure  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LAO_SFX = "E:/LAO/Google_QA/Assets/AssetBundleResource/Sounds/SFX"


def main():
    js = (ROOT / "js" / "sfx-table.js").read_text(encoding="utf-8")
    table = json.loads(re.search(r"SFX_TABLE = (\{.*?\});\n", js, re.S).group(1))
    cats = json.loads(re.search(r"SFX_CATS = (\{.*?\});\n", js, re.S).group(1))
    out = {"cats": cats, "cues": {}}
    for cue, e in table.items():
        clips = []
        for stem, src in zip(e["files"], e["src"]):
            f = ROOT / "assets" / "audio" / "sfx" / f"{stem}.ogg"
            m = measure(decode(f)) if f.exists() else {}
            original = (Path(LAO_SFX) / src).exists()
            clips.append({"stem": stem, "src": src, "exists": f.exists(), "original": original, **m})
        out["cues"][cue] = {**e, "clips": clips}
    # Music level per BGM track (whole-file RMS): the SFX balance assumes one music level.
    import numpy as np
    out["bgm"] = {}
    for f in sorted((ROOT / "assets" / "audio" / "bgm").glob("*.ogg")):
        x = decode(f, 22050)
        out["bgm"][f.stem] = round(float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)), 1)
    Path(sys.argv[1]).write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("cues", len(out["cues"]))


if __name__ == "__main__":
    main()
