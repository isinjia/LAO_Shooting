"""Rampalion's original skill SFX -> assets/audio/skill/<stem>.ogg (played by js/rampalion-skill.js).

The custom-pack Rampart (Model_AGS_Rampart_NS1) animation events use these clips:
  skill_1: char 47_skill1_01 (t0), atk_swing_robot_big (0.55-0.87), enemy_06_skill1_01 (1.2),
           robot_03_skill1_NS1 (1.917)
  skill_2: char 47_skill1_01 (0.05), robot_03_skill2_NS1 (0.65), atk_light (1.667)
  die:     atk_laser_big (0), atk_elec (0.1 / 1.03 / 1.65)
Each clip: leading silence trimmed, loudness-matched (-13 dB RMS of the loudest 300 ms); peaky
clips reach the target through a soft-knee limiter under a -3 dBFS ceiling (the ogg encode can
overshoot a sharp transient by ~2 dB), mono ogg. fit() is shared with tools/import-pilot-voices.py.
usage: python tools/import-rampalion-sfx.py
"""
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sfx_analyze import SR, decode, measure  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("E:/LAO/Google_QA/Assets/AssetBundleResource/Sounds/SFX")
OUT = ROOT / "assets" / "audio" / "skill"
TARGET = -13.0

CLIPS = {  # stem -> original clip
    "rampalion_charge": "Robot/Seljuq/char 47_skill1_01.wav",
    "rampalion_swing": "Common/Atk/Swing/atk_swing_robot_big.wav",
    "rampalion_launch": "Enemy/Kidnapper/enemy_06_skill1_01.wav",
    "rampalion_skill1": "Robot/Rampart/robot_03_skill1_NS1.wav",
    "rampalion_skill2": "Robot/Rampart/robot_03_skill2_NS1.wav",
    "rampalion_light": "Common/Atk/Energy/atk_light.wav",
    "rampalion_laser": "Common/Atk/Shot/atk_laser_big.wav",
    "rampalion_elec": "Common/Atk/Energy/atk_elec.wav",
}


def soft_limit(y, ceiling):
    """Soft knee above 70 % of the ceiling: transparent below it, never past the ceiling."""
    k = 0.7 * ceiling
    a = np.abs(y)
    over = a > k
    out = y.copy()
    out[over] = np.sign(y[over]) * (k + (ceiling - k) * np.tanh((a[over] - k) / (ceiling - k)))
    return out


def fit(x, target, ceiling_db=-3.0):
    """Trim the lead, then gain + soft limiter until the loudness lands on target (+-0.5 dB)."""
    for _ in range(3):  # onset gate at -36 dB: a hiss just over -45 dB read as silence once encoded
        lead = measure(x, gate_db=-36)["lead"]
        if lead <= 0.002:
            break
        x = x[int(lead * SR):].copy()
    x[:32] *= np.linspace(0, 1, min(32, len(x)), dtype=np.float32)
    c = 10 ** (ceiling_db / 20)
    for _ in range(6):
        g = 10 ** ((target - measure(x)["rms_db"]) / 20)
        x = soft_limit((x * g).astype(np.float32), c)
        if abs(measure(x)["rms_db"] - target) <= 0.5:
            break
    return x


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for stem, rel in CLIPS.items():
        src = SRC / rel
        if not src.exists():
            print("  missing", src)
            continue
        x = fit(decode(src), TARGET)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-c:a", "libvorbis", "-q:a", "4", str(OUT / f"{stem}.ogg")],
                       input=x.astype(np.float32).tobytes(), check=True)
        print(f"{stem:20} <- {rel:44} {len(x) / SR:.2f}s")


if __name__ == "__main__":
    main()
