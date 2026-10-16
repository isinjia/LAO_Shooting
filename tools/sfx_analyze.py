"""Shared helpers: decode any audio via ffmpeg to mono float32 and measure it."""
import subprocess
import numpy as np

SR = 44100


def decode(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def measure(x, sr=SR, gate_db=-45):
    if not len(x):
        return {"dur": 0, "lead": 0, "active": 0, "peak_db": -120, "rms_db": -120}
    peak = float(np.max(np.abs(x)))
    thr = peak * 10 ** (gate_db / 20)
    idx = np.nonzero(np.abs(x) > max(thr, 1e-4))[0]
    lead = idx[0] / sr if len(idx) else 0
    tail = idx[-1] / sr if len(idx) else 0
    seg = x[idx[0]:idx[-1] + 1] if len(idx) else x
    # Loudness proxy: RMS of the loudest 300 ms window (short one-shots read by their body).
    win = int(0.3 * sr)
    if len(seg) > win:
        c = np.concatenate(([0.0], np.cumsum(seg.astype(np.float64) ** 2)))
        rms = float(np.sqrt(((c[win:] - c[:-win]) / win).max()))
    else:
        rms = float(np.sqrt(np.mean(seg ** 2)))
    return {"dur": len(x) / sr, "lead": lead, "active": tail - lead,
            "peak_db": 20 * np.log10(max(peak, 1e-9)), "rms_db": 20 * np.log10(max(rms, 1e-9))}
