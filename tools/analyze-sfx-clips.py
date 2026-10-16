"""Clip sanity check for SFX: length, number of separate hits inside the clip (a 'single shot'
that contains a burst sounds wrong), spectral centroid (shrillness), RMS / peak.
usage: python tools/analyze-sfx-clips.py <file> [...]"""
import subprocess, sys
import numpy as np
SR = 44100

def decode(p):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def onsets(x):
    hop = int(0.005 * SR)
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    db = 20 * np.log10(env + 1e-9)
    top = db.max()
    hits, last = [], -1e9
    first = int(np.argmax(db > top - 14))
    hits.append(round(first * 0.005, 3)); last = first * 0.005
    for i in range(first + 1, len(db)):
        t = i * 0.005
        # a new hit: sharp rise (>9 dB in 10 ms) to within 14 dB of the loudest point
        if db[i] > top - 14 and db[i] - db[max(0, i - 2)] > 9 and t - last > 0.045:
            hits.append(round(t, 3)); last = t
    return hits

for p in sys.argv[1:]:
    x = decode(p)
    if not len(x):
        print(p, 'empty'); continue
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    f = np.fft.rfftfreq(len(x), 1 / SR)
    cen = float((spec * f).sum() / (spec.sum() + 1e-9))
    rms = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    pk = 20 * np.log10(np.max(np.abs(x)) + 1e-9)
    h = onsets(x)
    print(f"{p.split('/')[-1][:44]:44} {len(x)/SR:5.2f}s hits {len(h)} {h[:6]} centroid {cen:6.0f}Hz rms {rms:6.1f} pk {pk:5.1f}")
