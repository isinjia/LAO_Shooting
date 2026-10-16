"""Original character voices on the animations (skill / death shouts).

For each roster character, every .anim of the original model is scanned for
  - EventSoundPlayVoiceSFXPrefab (explicit voice track, e.g. LRL skill1), and
  - EventSoundPlaySFXPrefab whose clip lives in the character's own
    Sounds/SFX/Character/<folder> (char_XX_skill*/death: the battle shouts are baked
    into these; generic swing / hit / whoosh SFX stay with the skill timelines).
Clip guids resolve through Sounds/**/*.meta; clips convert to assets/audio/skill/<stem>.ogg.
The bake config (tools/bake_sd_character.py CHARACTERS[...]["clips"]) maps the game's
animation states to original clip names, giving js/voice-events.js:

  VOICE_EVENTS[gameKey][state] = [[clipTimeSeconds, stem], ...]

ClipAnimator fires them from the animation clock (same pose timing as the original,
also when a clip is sped up, started mid-way or remapped).
usage: python tools/import-voice-events.py
"""
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAO = Path("E:/LAO/Google_QA/Assets/AssetBundleResource")
SOUNDS = LAO / "Sounds"
OUT_AUDIO = ROOT / "assets" / "audio" / "skill"
OUT_JS = ROOT / "js" / "voice-events.js"

ROSTER = ["griffin", "sleipnir", "express76", "constantia", "lrl", "labiata", "peregrinus",
          "peregrinus_human", "peregrinus_change", "peregrinus_revert", "peregrinus_hskill2", "peregrinus_bskill2"]


# (game key, Voice folder, file prefix, [(where, voice slot, game hook)]):
#   'action' special / bomb -> start of the C transform / X clip; 'state' die -> die clip.
VOICE_SETS = [
    # Empty: every roster voice comes from the original animation events. Peregrinus' original
    # clips carry no voice at all, so (matching the original) none is added for her.
]


def bake_configs():
    import importlib.util
    spec = importlib.util.spec_from_file_location("bake", ROOT / "tools" / "bake_sd_character.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.CHARACTERS


EVENT_RE = re.compile(
    r"- time: ([0-9.eE+-]+)\s*\n\s*functionName: (\w+)\s*\n\s*data:[^\n]*\n\s*objectReferenceParameter: \{fileID: (-?\d+)(?:, guid: ([0-9a-f]+))?",
    re.M,
)


def guid_map():
    m = {}
    for p in SOUNDS.rglob("*.meta"):
        if p.name.endswith((".mp3.meta", ".ogg.meta", ".wav.meta")):
            try:
                with open(p, encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if line.startswith("guid:"):
                            m[line.split()[1]] = p.with_suffix("")
                            break
            except OSError:
                pass
    return m


def main():
    gm = guid_map()
    print("sound guids", len(gm))
    cfgs = bake_configs()
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    events = {}
    actions = {}
    need = {}
    for key in ROSTER:
        cfg = cfgs.get(key)
        if not cfg:
            continue
        model = Path(cfg["model_abs"]) if cfg.get("model_abs") else LAO / "Character" / cfg["char_dir"] / cfg["model"]
        anims = {a.stem: a for a in model.rglob("*.anim")}
        parsed = {}
        for state, clip in cfg["clips"].items():
            a = anims.get(clip)
            if not a or clip in parsed:
                parsed.setdefault(clip, [])
                continue
            text = a.read_text(encoding="utf-8", errors="ignore")
            i = text.find("m_Events:")
            parsed[clip] = [] if i < 0 else [
                (float(t), fn, gm.get(g)) for t, fn, _f, g in EVENT_RE.findall(text[i:])
                if fn in ("EventSoundPlayVoiceSFXPrefab", "EventSoundPlaySFXPrefab") and g]
        # The character's own SFX folder: where its char_XX_* clips live.
        folders = {}
        for evs in parsed.values():
            for _t, _fn, src in evs:
                if src and "Character" in src.parts:
                    f = src.parts[src.parts.index("Character") + 1]
                    folders[f] = folders.get(f, 0) + 1
        own = max(folders, key=folders.get) if folders else None
        per = {}
        for state, clip in cfg["clips"].items():
            for t, fn, src in parsed.get(clip, []):
                if not src:
                    continue
                mine = "Character" in src.parts and src.parts[src.parts.index("Character") + 1] == own
                if fn != "EventSoundPlayVoiceSFXPrefab" and not mine:
                    continue
                stem = "vo_" + re.sub(r"[^a-z0-9_]+", "_", src.stem.lower()).strip("_")
                need[stem] = src
                per.setdefault(state, []).append([round(t, 4), stem])
        # Base clip without the shout (LRL die): the skins' same-named clip (same skeleton and
        # timing) carries it; take the most common event list among them.
        cdir = LAO / "Character" / cfg["char_dir"] if cfg.get("char_dir") else model.parent
        for state, clip in cfg["clips"].items():
            if per.get(state) or state in ("idle", "move"):
                continue
            seen = {}
            for a in sorted(cdir.rglob(f"{clip}.anim")):
                text = a.read_text(encoding="utf-8", errors="ignore")
                i = text.find("m_Events:")
                lst = tuple((round(float(t), 4), "vo_" + re.sub(r"[^a-z0-9_]+", "_", gm[g].stem.lower()).strip("_"), gm[g])
                            for t, fn, _f, g in (EVENT_RE.findall(text[i:]) if i >= 0 else [])
                            if g in gm and (fn == "EventSoundPlayVoiceSFXPrefab" or (
                                fn == "EventSoundPlaySFXPrefab" and "Character" in gm[g].parts
                                and gm[g].parts[gm[g].parts.index("Character") + 1] == own)))
                if lst:
                    seen[lst] = seen.get(lst, 0) + 1
            if seen:
                best = max(seen, key=seen.get)
                for t, stem, src in best:
                    need[stem] = src
                    per.setdefault(state, []).append([t, stem])
                print(f"  {key}.{state}: from skins {[s for _, s, _ in best]}")
        # skill1 runs as the 'attack' state when no run spec drives it.
        if "skill1" in per:
            per.setdefault("attack", per["skill1"])
        if per:
            events[key] = per
        print(key, own, per)
    # Pilots whose original animations carry no voice at all (Peregrinus: generic SFX only)
    # use their own battle voice set at the start of the matching animation.
    for key, folder, prefix, slots in VOICE_SETS:
        for where, name, slot in slots:
            src = SOUNDS / "Voice" / folder / f"{prefix}_{name}.mp3"
            if not src.exists():
                print("  missing", src)
                continue
            stem = "vo_" + re.sub(r"[^a-z0-9_]+", "_", src.stem.lower()).strip("_")
            need[stem] = src
            if where == "action":
                actions.setdefault(key, {})[slot] = [[0, stem]]
            else:
                events.setdefault(key, {})[slot] = [[0, stem]]
    for stem, src in need.items():
        dst = OUT_AUDIO / f"{stem}.ogg"
        if dst.exists():
            continue
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "44100",
                        "-c:a", "libvorbis", "-q:a", "4", str(dst)], check=True)
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("// Generated by tools/import-voice-events.py. Do not edit.\n")
        f.write("// Original character voices per animation state (EventSoundPlayVoiceSFXPrefab +\n")
        f.write("// the character's own EventSoundPlaySFXPrefab shouts), in clip seconds:\n")
        f.write("// VOICE_EVENTS[gameKey][state] = [[time, stem], ...] -> assets/audio/skill/<stem>.ogg\n")
        f.write("export const VOICE_EVENTS = " + json.dumps(events, ensure_ascii=False) + ";\n")
        f.write("// Voices started by an action (C / X cast) on their own clock: [[seconds after cast, stem]].\n")
        f.write("export const VOICE_ACTIONS = " + json.dumps(actions, ensure_ascii=False) + ";\n")
    print("voices", len(need), "->", OUT_AUDIO)


if __name__ == "__main__":
    main()
