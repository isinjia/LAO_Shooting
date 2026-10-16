"""One pilot's sound set in the format of tools/eval-sfx-files.py, for tools/score-sfx.mjs.

The set = the table cues the pilot's kit fires (taken from a tools/eval-pilot-sfx.mjs probe log)
+ its roster shot style, plus the pilot's own original clips (assets/audio/skill/<pilot>_*.ogg)
and voice lines (assets/audio/voice/<pilot>_*.ogg) as cues of the "event" category (-14 dB
target, 3.4 s max: the category of the table's long set-piece sounds).
usage: python tools/eval-pilot-sfx-files.py probe.json out.json [pilot]
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sfx_analyze import decode, measure  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LAO_SFX = Path("E:/LAO/Google_QA/Assets/AssetBundleResource/Sounds/SFX")
LAO_VOICE = Path("E:/LAO/Google_QA/Assets/AssetBundleResource/Sounds/Voice")


def main():
    probe = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    pilot = sys.argv[3] if len(sys.argv) > 3 else probe.get("pilot", "rampalion")
    js = (ROOT / "js" / "sfx-table.js").read_text(encoding="utf-8")
    table = json.loads(re.search(r"SFX_TABLE = (\{.*?\});\n", js, re.S).group(1))
    cats = json.loads(re.search(r"SFX_CATS = (\{.*?\});\n", js, re.S).group(1))
    out = {"cats": cats, "cues": {}, "pilot": pilot}
    used = {l["key"] for l in probe["log"] if l["kind"] == "cue"}
    used.add("shoot:" + probe.get("shotStyle", "shindenshot"))
    for cue in sorted(used):
        e = table.get(cue) or table.get(cue.split(":")[0])
        if not e:
            continue
        clips = []
        for stem, src in zip(e["files"], e["src"]):
            f = ROOT / "assets" / "audio" / "sfx" / f"{stem}.ogg"
            m = measure(decode(f)) if f.exists() else {}
            clips.append({"stem": stem, "src": src, "exists": f.exists(), "original": (LAO_SFX / src).exists(), **m})
        out["cues"][cue] = {**e, "clips": clips}
    # The pilot's own original clips / voice lines, with their import sources.
    sys.path.insert(0, str(ROOT / "tools"))
    import importlib.util
    spec = importlib.util.spec_from_file_location("irs", ROOT / "tools" / "import-rampalion-sfx.py")
    irs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(irs)
    spec = importlib.util.spec_from_file_location("ipv", ROOT / "tools" / "import-pilot-voices.py")
    ipv = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ipv)
    folder, prefix = ipv.PILOTS[pilot]
    slots = {**ipv.SLOTS, **ipv.EXTRA_SLOTS.get(pilot, {})}
    for kind, d in (("clip", "skill"), ("voice", "voice")):
        for f in sorted((ROOT / "assets" / "audio" / d).glob(f"{pilot}_*.ogg")):
            stem = f.stem
            if kind == "clip":
                src = irs.CLIPS.get(stem)
                original = bool(src) and (LAO_SFX / src).exists()
            else:
                slot = stem[len(pilot) + 1:]
                src = f"{folder}/{prefix}_{slots.get(slot, '?')}.mp3"
                original = (LAO_VOICE / src).exists()
            m = measure(decode(f))
            out["cues"][f"{kind}:{stem}"] = {"cat": "event", "files": [stem], "src": [src], "jitter": 0, "voices": 1,
                                            "clips": [{"stem": stem, "src": src, "exists": True, "original": original, **m}]}
    import numpy as np
    out["bgm"] = {}
    for f in sorted((ROOT / "assets" / "audio" / "bgm").glob("*.ogg")):
        x = decode(f, 22050)
        out["bgm"][f.stem] = round(float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)), 1)
    Path(sys.argv[2]).write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("cues", len(out["cues"]))


if __name__ == "__main__":
    main()
