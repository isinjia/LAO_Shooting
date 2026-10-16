"""Game SFX from the original Last Origin library -> assets/audio/sfx/*.ogg + js/sfx-table.js.

Every cue the game fires (Game -> ArcadeAudio.play) maps to one or more original clips from
E:/LAO/Google_QA/Assets/AssetBundleResource/Sounds/SFX (variants for frequent cues). Each
clip is processed for an arcade mix:
  - leading silence trimmed (gate -45 dB) so the sound lands on the frame it is fired,
  - cut to the cue's max length with a short fade (rapid-fire cues stay tight),
  - loudness normalised to the cue's category target (RMS of the loudest 300 ms), so
    shots < hits < kills < big events read in that order on any device,
  - peak ceiling -1.5 dBFS (decoded ogg stays under -1 dBFS; no clipping before the mix bus).
A cue with a `free` entry would use a free asset instead (none needed: every cue found a
fitting original). js/sfx-table.js lists files, gains and pitch jitter for ArcadeAudio.
usage: python tools/import-sfx.py
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sfx_analyze import SR, decode, measure  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("E:/LAO/Google_QA/Assets/AssetBundleResource/Sounds/SFX")
OUT = ROOT / "assets" / "audio" / "sfx"

# category -> (target loudness dB, max length s)
CATS = {
    "shot": (-29, 0.16), "tick": (-30, 0.14),  # shots sit ~8-10 dB under the music (1945 style)
     "hit": (-24, 0.15), "hitx": (-22, 0.35), "graze": (-30, 0.2),
    "kill": (-18, 0.7), "ui": (-19, 1.0), "sting": (-16, 0.8), "big": (-13, 1.8),
    "event": (-14, 3.4),
    "breath": (-19, 1.4), "whoosh": (-23, 0.45), "eshot": (-34, 0.22),
}

# cue -> (category, [original files], pitch jitter, max simultaneous voices)
CUES = {
    # player shots, one per pilot shot style (ArcadeAudio key "shoot:<style>")
    "shoot:p38shot": ("shot", ["Common/Atk/Shot/atk_machinegun_small.wav"], 0.04, 3),       # Griffin: twin MG
    "shoot:shindenshot": ("shot", ["Common/Atk/Shot/atk_gun_5.wav"], 0.04, 3),             # Sleipnir: heavy gun
    "shoot:pancakeshot": ("shot", ["Common/Atk/Shot/atk_gun_4.wav"], 0.04, 3),             # Express 76: wide shot
    "shoot:marionshot": ("shot", ["Common/Atk/Energy/Bling_Sound.wav"], 0.05, 3),          # Constantia: magic spread
    "shoot:cleave": ("shot", ["Common/Atk/Swing/atk_swing_small.wav"], 0.05, 3),           # LRL: spinning sword wave
    "shoot:falconshot": ("shot", ["Common/Atk/Shot/atk_gun_1.wav"], 0.04, 3),  # gun_silenced had a double transient       # Peregrinus bird
    "shoot:spiral": ("tick", ["Common/Atk/Energy/atk_energy_loop.wav"], 0.03, 2),         # Peregrinus human beam
    "shoot:hayateshot": ("shot", ["Common/Atk/Shot/atk_gun_2.wav"], 0.04, 3),             # Labiata
    "shoot": ("shot", ["Common/Atk/Shot/atk_machinegun_small.wav"], 0.04, 3),              # any other style
    # combat
    # enemy hit, per projectile class (ArcadeAudio key "enemyHit:<class>", js/audio.js HIT_CLASS)
    "enemyHit:bullet": ("hit", ["Common/Hit/Common/hit_Gun_small-1.wav", "Common/Hit/Common/hit_Gun_small-2.wav",
                                "Common/Hit/Robot/hit_robot_gun_small.wav"], 0.06, 4),
    "enemyHit:heavy": ("hit", ["Common/Hit/Common/hit_Gun_mid-1.wav", "Common/Hit/Common/hit_Gun_mid-2.wav"], 0.05, 4),
    "enemyHit:missile": ("hitx", ["Common/Explosion/explosion_small.wav"], 0.08, 3),
    "enemyHit:energy": ("hit", ["Common/Hit/Common/hit_common_electric_1.wav", "Common/Hit/Common/hit_common_electric_2.wav",
                                "Common/Hit/Common/hit_common_electric_3.wav"], 0.05, 3),
    "enemyHit:slash": ("hit", ["Common/Hit/Common/hit_common_slasl_1.wav", "Common/Hit/Common/hit_common_slasl_2.wav",
                               "Common/Hit/Common/hit_common_slasl_3.wav"], 0.05, 3),
    "enemyHit:magic": ("hit", ["Common/Hit/Common/hit_common_ice_1.wav", "Common/Hit/Common/hit_common_ice_2.wav"], 0.06, 3),
    "enemyHit:impact": ("hit", ["Common/Hit/Common/hit_Phy_mid-1.wav", "Common/Hit/Common/hit_Phy_small-1.wav"], 0.05, 3),
    "enemyHit": ("hit", ["Common/Hit/Common/hit_Gun_mid-2.wav"], 0.05, 4),  # skill / bomb damage (no projectile)
    # one clean blast per kill (QA: explosion_small / SciFi13 hold 3-5 separate pops = a crackle)
    "enemyDeath": ("kill", ["Common/Explosion/explosion_3.wav"], 0.08, 4),  # effectExplosion is pitched (a "ding"), out
    # enemy volley: one soft energy shot under the player's guns (one cue per volley, not per bullet)
    "enemyFire": ("eshot", ["Common/Atk/Shot/atk_cannon_small.wav"], 0.06, 2),  # atk_light read as a high "ding" (user)
    # midboss / boss death sequence: small pops on the body, then the final blast
    "leaderPop": ("kill", ["Common/Explosion/explosion_small.wav", "Common/Explosion/explosion_3.wav",
                           "Common/Explosion/SciFiExplosion13_IN.wav"], 0.07, 3),
    "leaderBlast": ("big", ["Common/Explosion/explosion_2.wav"], 0, 1),
    "playerHit": ("sting", ["Common/Hit/Common/hit_common_smash_2.wav"], 0, 1),  # hit_Heavy held 5 hits
    "playerDeath": ("big", ["Common/Explosion/explosion_big.wav"], 0, 1),
    "powerDown": ("sting", ["Common/Hit/Robot/hit_robot_phy_mid.wav"], 0, 1),
    "graze": ("graze", ["Common/magic/shinny_high_04.wav"], 0.08, 2),
    "bomb": ("big", ["Common/Explosion/BigExplosion6_IN.wav"], 0, 1),
    "special": ("sting", ["Common/Atk/Energy/Energy_In_aura_sound.wav"], 0, 1),
    "charge": ("ui", ["Common/Atk/Swing/atk_swing_big.wav"], 0.04, 1),  # cast_charge was a 9.9 kHz whine at ~1/s
    "chargeHold": ("tick", ["Common/Atk/Energy/atk_energy_loop.wav"], 0, 1),
    # items / UI / flow
    "pickupP": ("ui", ["UI/Reinforce_equip.wav"], 0, 2),
    "pickupB": ("ui", ["UI/collect_coin_03.wav"], 0, 2),
    "deny": ("ui", ["Common/effect/Data 03_IN.wav"], 0, 1),
    "cue": ("ui", ["Common/effect/Data 02_IN.wav"], 0, 1),
    "phase": ("sting", ["Common/Explosion/explosion_deep_low_1.wav"], 0, 1),  # power_up_flash sounded like a pickup (user)
    "warning": ("event", ["UI/Warning_infinite.wav"], 0, 1),
    "clear": ("event", ["UI/stage_clear.wav"], 0, 1),
    "fanfare": ("event", ["UI/pick_SS.wav"], 0, 1),
    # leader area attacks (js/leader-hazards.js): warning cues and the moment they go live
    "hz:meteor": ("kill", ["Common/Explosion/explosion_3.wav", "Common/effectMixMidExplosion.wav"], 0.06, 3),
    "hz:fall": ("whoosh", ["Common/Atk/Swing/atk_heavy_Swing_sound.mp3"], 0.05, 2),  # synth whoosh read as a "ding"
    "hz:charge": ("whoosh", ["Common/Atk/Energy/elec_charge_0002.wav"], 0.03, 2),
    "hz:beam": ("kill", ["Common/Atk/Energy/atk_Beam1.wav", "Common/Atk/Energy/atk_Beam2.wav"], 0.04, 2),
    "hz:bolt": ("kill", ["Common/elec_lightning_magic_spell_11.wav", "Common/Atk/Energy/atk_elec.wav"], 0.05, 3),
    "hz:girder": ("kill", ["Common/Explosion/explosion_deep_low_1.wav"], 0.05, 2),
    "hz:tape": ("hitx", ["Common/Atk/Shot/atk_throw_wire.wav"], 0.05, 2),
    "hz:swoop": ("whoosh", ["Common/Atk/Swing/atk_swing_big_2.wav"], 0.05, 2),
    "hz:spike": ("hitx", ["Common/Hit/Common/hit_common_ice_1.wav", "Common/Hit/Common/hit_common_ice_2.wav"], 0.06, 3),
    "hz:column": ("kill", ["Common/Atk/Energy/atk_earthquake.wav"], 0.05, 2),
    "hz:sigil": ("kill", ["Common/sci-fi_shield_power_on_impact_02.wav"], 0.04, 2),
    "hz:cone": ("breath", ["Common/magic/fire_burner_01.mp3"], 0.03, 1),
    # weapons with no cue before: Griffin C missile salvo, Express sub laser, Peregrinus beam hum
    "missileLaunch": ("whoosh", ["Common/Atk/Shot/atk_missile.wav"], 0.06, 3),
    # Griffin C: one clean blast per missile on its own channel (the shared enemyHit pool
    # capped hits at 2 voices / 0.11 s, so a 20-missile salvo read as one thud - user)
    "missileBlast": ("kill", ["Common/Explosion/explosion_3.wav", "Common/effectMixMidExplosion.wav"], 0.1, 5),
    "laserFire": ("hitx", ["Common/Atk/Shot/atk_laser_small.wav"], 0.04, 2),
    "beamHold": ("tick", ["Common/Atk/Energy/laser/Weapon 12 Loop (Laser)_IN.wav"], 0, 1),
    # menus (title / select / options / pause)
    "ui:move": ("ui", ["Character/Express76/Phone_click_sound.wav"], 0.03, 2),
    "ui:ok": ("ui", ["UI/pick_basic.wav"], 0, 1),
    "ui:open": ("ui", ["UI/Trainsition_in.wav"], 0, 1),
}
LOOPS = {"chargeHold", "beamHold"}  # kept whole (seamless loop), no fade-out


def process(src, cat, loop=False):
    target, maxlen = CATS[cat]
    x = decode(src)
    m = measure(x)
    start = int(m["lead"] * SR)
    x = x[start:]
    if not loop:
        n = min(len(x), int(maxlen * SR))
        x = x[:n].copy()
        fade = min(int(0.03 * SR), n // 3)
        if fade > 0:
            x[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        x[:32] *= np.linspace(0, 1, min(32, len(x)), dtype=np.float32)
    m2 = measure(x)
    gain = 10 ** ((target - m2["rms_db"]) / 20)
    peak = float(np.max(np.abs(x))) * gain
    if peak > 10 ** (-1.5 / 20):  # -1.5 dBFS: ogg encoding can overshoot by ~0.5 dB
        gain *= 10 ** (-1.5 / 20) / peak
    return (x * gain).astype(np.float32)


def write_ogg(x, dst):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libvorbis", "-q:a", "5", str(dst)], input=x.tobytes(), check=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    table = {}
    for cue, (cat, files, jitter, voices) in CUES.items():
        stems = []
        for i, rel in enumerate(files):
            stem = cue.replace(":", "_") + (f"_{i + 1}" if len(files) > 1 else "")
            x = process(SRC / rel, cat, cue in LOOPS)
            write_ogg(x, OUT / f"{stem}.ogg")
            mm = measure(x)
            stems.append(stem)
            print(f"{stem:22} <- {rel:55} {mm['dur']:.2f}s rms {mm['rms_db']:.1f} pk {mm['peak_db']:.1f}")
        table[cue] = {"files": stems, "cat": cat, "jitter": jitter, "voices": voices,
                      "loop": cue in LOOPS, "src": files}
    with open(ROOT / "js" / "sfx-table.js", "w", encoding="utf-8") as f:
        f.write("// Generated by tools/import-sfx.py. Do not edit.\n")
        f.write("// Game SFX from the original Last Origin library (assets/audio/sfx/<stem>.ogg):\n")
        f.write("// cue -> { files (variants), cat, jitter (playbackRate +-), voices (max overlap), loop, src }.\n")
        f.write("export const SFX_TABLE = " + json.dumps(table, ensure_ascii=False, indent=1) + ";\n")
        f.write("export const SFX_CATS = " + json.dumps({k: {"target": v[0], "max": v[1]} for k, v in CATS.items()}) + ";\n")


if __name__ == "__main__":
    main()
