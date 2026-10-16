"""Write each leader's skill release time (original Unity animation events) into anim.json.

skill1HitTime / skill2HitTime = time of the first "release" event in the clip: projectile
fire, hit, thrown effect, attack, self effect, then (fallback) the first camera shake.
The leader script starts the attack's bullets on that frame of the skill animation.
usage: python tools/import-leader-skill-hits.py [keys...]
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bake_sd_character import CHARACTERS  # noqa: E402

ROOTS = [
    Path(r"E:\LAO\Onestore_QA_RenewalBattleSystem\Assets\AssetBundleResource\Character"),
    Path(r"E:\LAO\Google_QA\Assets\AssetBundleResource\Character"),
]
BAKED = Path(__file__).resolve().parents[1] / "assets" / "sd_baked"
LEADERS = ["boss_hachiko", "boss_csperrault", "boss_snowfeather", "boss_blacklilith", "mid_triton",
           "mid_nidhogg", "mid_glacias", "mid_goltarion", "mid_satgat", "final_yimir",
           "final_arachne", "final_roc"]
# Manual release times (s) where the first event is not the visible moment.
OVERRIDE = {("final_yimir", "skill2"): 1.7}
RELEASE = [r"^EventThrowProjectile", r"^EventHit", r"^EventThrowEffect", r"^EventAttack",
           r"^EventSelfEffect", r"^EventMoveMotionStart", r"^EventCameraShake"]


def find_anim(cfg, stem):
    for root in ROOTS:
        d = root / cfg["char_dir"] / cfg["model"]
        if not d.exists():
            continue
        hits = [p for p in d.rglob(f"{stem}.anim")]
        if hits:
            return hits[0]
    return None


def events(path):
    txt = path.read_text(encoding="utf-8", errors="replace")
    out = []
    for m in re.finditer(r"- time: ([0-9.eE+-]+)\s+functionName: (\w+)", txt):
        out.append((float(m.group(1)), m.group(2)))
    return out


def main():
    keys = sys.argv[1:] or LEADERS
    for key in keys:
        cfg = CHARACTERS[key]
        ap = BAKED / key / "anim.json"
        data = json.loads(ap.read_text(encoding="utf-8"))
        for clip in ("skill1", "skill2"):
            stem = cfg["clips"].get(clip)
            path = stem and find_anim(cfg, stem)
            if not path:
                print(f"[{key}] {clip}: no anim")
                continue
            ev = events(path)
            t = None
            for pat in RELEASE:
                ts = [tt for tt, fn in ev if re.match(pat, fn)]
                if ts:
                    t = min(ts)
                    break
            dur = data.get(clip + "Duration") or 0
            if (key, clip) in OVERRIDE:
                t = OVERRIDE[(key, clip)]
            if t is None or (dur and t > dur * 0.8):
                t = round(dur * 0.4, 4)
            data[clip + "HitTime"] = round(t, 4)
            print(f"[{key}] {clip} {stem}: hit {t:.3f}s / {dur:.2f}s  events {[f'{a:.2f}:{b}' for a, b in ev][:8]}")
        # Pack the skill clips into the leader's sheet (pack_sprite_sheets.py).
        data["sheetSkills"] = True
        ap.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
