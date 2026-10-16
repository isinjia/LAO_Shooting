"""Per-pilot SFX score (0-100) from tools/eval-pilot-sfx.mjs + the pilot's own sound files.

Same yardsticks as tools/score-sfx.mjs (the global table score), applied to one pilot's set:
  30 coverage     every probed moment plays at least one decoded, audible sound (cues switched
                  off in js/audio.js DISABLED_CUES do not count); C / X / dock / Hyper / death /
                  leg skills need one of the pilot's own original clips or voice lines
  10 original     the pilot's own files (assets/audio/voice/<pilot>_*, skill/<pilot>_*) come
                  from the original Last Origin library (import tools)
   5 responsive   leading silence <= 5 ms
   5 length       voice lines 0.3..4.0 s, skill clips 0.15..3.5 s
  10 consistency  loudness within +-1.5 dB of the chain target (voice -15, skill clip -13 dB RMS)
  10 headroom     file peaks <= -0.9 dBFS (5) and the in-game master peak < 0.99 (5)
  10 voice        every C / X cast speaks its own line, and no line is cut off by the next one
                  before 70 % of it has played
  10 on-cast      C / X / leg skills sound within 0.1 s of the cast
  10 spam         at most 24 live sources, and no clip fired twice within 60 ms
usage: python tools/score-pilot-sfx.py probe.json [pilot]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sfx_analyze import decode, measure  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DISABLED = {"cue", "enemyDeath", "graze"}
OWN_NEEDED = {"special1", "special2", "special3", "bomb", "dock", "hyper", "death", "legDash", "legBarrier", "barrierAbsorb"}
CAST = {"special1", "special2", "special3", "bomb", "legDash", "legBarrier"}


def main():
    probe = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    pilot = sys.argv[2] if len(sys.argv) > 2 else probe.get("pilot", "rampalion")
    log = probe["log"]
    parts = {}

    def audible(l):
        return l["ok"] and not (l["kind"] == "cue" and l["key"].split(":")[0] in DISABLED)

    own = lambda l: l["kind"] in ("clip", "voice") and l["key"].startswith(pilot + "_")
    cov = []
    for m in probe["moments"]:
        ls = [l for l in log if l["m"] == m and audible(l)]
        good = bool(ls) and (m not in OWN_NEEDED or any(own(l) for l in ls))
        cov.append((m, good))
    parts["coverage"] = 30 * sum(g for _, g in cov) / len(cov)

    files = sorted((ROOT / "assets" / "audio" / "voice").glob(f"{pilot}_*.ogg")) + \
        sorted((ROOT / "assets" / "audio" / "skill").glob(f"{pilot}_*.ogg"))
    rows = []
    for f in files:
        voice = f.parent.name == "voice"
        m = measure(decode(f))
        rows.append({"f": f.name, "voice": voice, **m})
    n = max(1, len(rows))
    tool = {"voice": ROOT / "tools" / "import-pilot-voices.py", "skill": ROOT / "tools" / "import-rampalion-sfx.py"}
    parts["original"] = 10 * (1.0 if all(t.exists() for t in tool.values()) and rows else 0.0)
    parts["responsive"] = 5 * sum(r["lead"] <= 0.005 for r in rows) / n
    parts["length"] = 5 * sum((0.3 <= r["dur"] <= 4.0) if r["voice"] else (0.15 <= r["dur"] <= 3.5) for r in rows) / n
    parts["consistency"] = 10 * sum(abs(r["rms_db"] - (-15 if r["voice"] else -13)) <= 1.5 for r in rows) / n
    parts["headroom"] = 5 * sum(r["peak_db"] <= -0.9 for r in rows) / n + (5 if probe["peak"] < 0.99 else 0)

    # Voice: own line per C / X cast; no line cut before 70 % of its length.
    durs = {r["f"][:-4]: r["dur"] for r in rows if r["voice"]}
    vs = [l for l in log if l["kind"] == "voice"]
    cut = 0
    for a, b in zip(vs, vs[1:]):
        d = durs.get(a["key"], 1.0)
        if b["t"] - a["t"] < 0.7 * d:
            cut += 1
    casts = [m for m in probe["moments"] if m.startswith("special") or m == "bomb"]
    spoke = sum(any(l["m"] == m and l["kind"] == "voice" and own(l) for l in log) for m in casts)
    parts["voice"] = 5 * spoke / max(1, len(casts)) + 5 * (1 - cut / max(1, len(vs) - 1))

    oc = []
    for m in [m for m in probe["moments"] if m in CAST]:
        ls = [l for l in log if l["m"] == m and audible(l)]
        oc.append(bool(ls) and ls[0]["t"] - min(l["t"] for l in log if l["m"] == m) <= 0.1)
    parts["oncast"] = 10 * sum(oc) / max(1, len(oc))

    dup = 0
    clips = [l for l in log if l["kind"] == "clip"]
    for i, a in enumerate(clips):
        if any(b["key"] == a["key"] and 0 < b["t"] - a["t"] < 0.06 for b in clips[i + 1:i + 6]):
            dup += 1
    parts["spam"] = 5 * (1 if probe["maxLive"] <= 24 else 0) + 5 * (1 - min(1, dup / max(1, len(clips))))

    for k, v in parts.items():
        print(f"{k:12} {v:5.1f}")
    for m, g in cov:
        if not g:
            print("  no own / audible sound:", m)
    for r in rows:
        bad = []
        if r["lead"] > 0.005: bad.append(f"lead {r['lead'] * 1000:.0f}ms")
        if abs(r["rms_db"] - (-15 if r["voice"] else -13)) > 1.5: bad.append(f"rms {r['rms_db']:.1f}")
        if r["peak_db"] > -0.9: bad.append(f"pk {r['peak_db']:.1f}")
        if bad: print("  off-spec:", r["f"], ", ".join(bad))
    print(f"voices cut {cut}/{max(0, len(vs) - 1)}, dup clips {dup}, master peak {probe['peak']:.3f}, live {probe['maxLive']}")
    print(f"{pilot.upper()} SFX SCORE {sum(parts.values()):.1f}")


if __name__ == "__main__":
    main()
