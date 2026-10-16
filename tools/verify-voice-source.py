"""Cross-check js/voice-events.js against the original Unity animations, independently of
the importer: re-reads every roster character's .anim files (base model, then skins for a
clip the base leaves silent), lists each EventSoundPlayVoiceSFXPrefab / own
SFX/Character/<folder> sound event and checks the game table holds the same clip at the
same clip time for that state. Also prints which played animations carry no voice in the
original at all. usage: python tools/verify-voice-source.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAO = Path("E:/LAO/Google_QA/Assets/AssetBundleResource")
EV = re.compile(r"- time: ([0-9.eE+-]+)\s*\n\s*functionName: (\w+)\s*\n\s*data:[^\n]*\n\s*objectReferenceParameter: \{fileID: -?\d+(?:, guid: ([0-9a-f]+))?")
ROSTER = {  # game key -> (char dir, base model dir, own SFX folder, played states)
    "griffin": ("Char_BR_PA00EL_N", "Model_BR_PA00EL_N", "PA00EL", ["skill1", "skill2", "die"]),
    "sleipnir": ("Char_BR_Sleipnir_N", "Model_BR_Sleipnir_N", "Sleipnir", ["skill1", "skill2", "die"]),
    "express76": ("Char_PECS_Express76_N", "Model_PECS_Express76_N", "Express76", ["skill1", "skill2", "die"]),
    "constantia": ("Char_3P_ConstantiaS2_N", "Model_3P_ConstantiaS2_N", "ConstantiaS2", ["skill1", "skill2", "die"]),
    "lrl": ("Char_PECS_LRL_N", "Model_PECS_LRL_N", "LRL", ["skill1", "skill2", "die"]),
    "labiata": ("Char_3P_Labiata_N", "Model_3P_Labiata_N", "Labiata", ["skill1", "skill2", "die"]),
    "peregrinus": ("Char_PECS_Peregrinus_N", "Model_PECS_Peregrinus_N", None, ["skill1", "skill2", "die"]),
}


def main():
    gm = {}
    for p in (LAO / "Sounds").rglob("*.meta"):
        if p.name.endswith((".mp3.meta", ".wav.meta", ".ogg.meta")):
            for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                if line.startswith("guid:"):
                    gm[line.split()[1]] = p.with_suffix("")
                    break
    import importlib.util
    spec = importlib.util.spec_from_file_location("bake", ROOT / "tools" / "bake_sd_character.py")
    bake = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bake)
    js = (ROOT / "js" / "voice-events.js").read_text(encoding="utf-8")
    table = json.loads(re.search(r"VOICE_EVENTS = (\{.*?\});\n", js).group(1))
    acts = json.loads(re.search(r"VOICE_ACTIONS = (\{.*?\});\n", js).group(1))
    bad = 0
    for key, (cdir, mdir, own, states) in ROSTER.items():
        clips = bake.CHARACTERS[key]["clips"]
        for state in states:
            clip = clips.get(state)
            if not clip:
                continue
            files = sorted((LAO / "Character" / cdir).rglob(f"{clip}.anim"))
            base = [f for f in files if f.parent.parent.name == mdir]
            origin = None
            orig = []
            for f in base + [f for f in files if f not in base]:
                t = f.read_text(encoding="utf-8", errors="ignore")
                i = t.find("m_Events:")
                evs = [(round(float(x), 4), gm[g]) for x, fn, g in (EV.findall(t[i:]) if i >= 0 else [])
                       if g in gm and (fn == "EventSoundPlayVoiceSFXPrefab" or (
                           own and "Character" in gm[g].parts and gm[g].parts[gm[g].parts.index("Character") + 1] == own))]
                if evs:
                    orig, origin = evs, f.parent.parent.name
                    break
            have = table.get(key, {}).get(state, [])
            for t, src in orig:
                stem = "vo_" + re.sub(r"[^a-z0-9_]+", "_", src.stem.lower()).strip("_")
                ok = any(abs(h[0] - t) < 1e-3 and h[1] == stem for h in have)
                bad += 0 if ok else 1
                print(f"{key:10} {state:6} {t:7.4f}s {src.name:34} {'ok' if ok else 'MISSING'}  ({origin})")
            if not orig:
                print(f"{key:10} {state:6} -- no voice in any original {clip}.anim (base or skins)")
    print("SOURCE MATCH" if not bad else f"SOURCE MISMATCH {bad}")


if __name__ == "__main__":
    main()
