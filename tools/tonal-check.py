"""Chime detector for SFX clips: how far the strongest pitched lines in the 400-6000 Hz band
stand above the band's median level (dB). Pickups / chimes / "dings" score high; explosions,
hits and whooshes (noise) score low. Reference: the coin pickup and Common/effectExplosion
(the pitched clip that made kills go "ding").
usage: python tools/tonal-check.py <file> [...]"""
import os, subprocess, sys
import numpy as np
SR = 44100
def dec(p):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-t", "0.7", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
rows = []
for p in sys.argv[1:]:
    x = dec(p); n = 8192
    vals = []
    for i in range(0, max(1, len(x) - n + 1), n // 4):
        fr = x[i:i + n]
        if len(fr) < n: fr = np.pad(fr, (0, n - len(fr)))
        if np.sqrt(np.mean(fr ** 2)) < 0.005: continue
        s = np.abs(np.fft.rfft(fr * np.hanning(n)))
        f = np.arange(len(s)) * SR / n
        b = s[(f > 400) & (f < 6000)] + 1e-9
        top = np.sort(b)[-3:].mean()
        vals.append(20 * np.log10(top / np.median(b)))
    rows.append((max(vals) if vals else 0, os.path.basename(p)))
for v, name in sorted(rows, reverse=True):
    print(f"{v:5.1f} dB  {name}")
