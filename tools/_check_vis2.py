import sys
from pathlib import Path
sys.path.insert(0, str(Path(r"E:\Test_Ban\2_LAO_MINI_ACTION\tools")))
sys.path.insert(0, str(Path(r"E:\LAO_WEB_GAME\Skin_3P_Hirume_R1\tools")))
import export_sd_glb as ex
import render_native_hirume as rh
import numpy as np

clip = next(iter(rh.documents(rh.MODEL / "animation" / "Idle_1.anim").values()))["AnimationClip"]
trs, parts = ex.pose_state(clip, 0.0)
hidden = sum(1 for v in trs.values() if not v["visible"])
shown = sum(1 for v in trs.values() if v["visible"])
print("nodes shown", shown, "hidden", hidden, "total", len(trs))
# world-ish local positions of visible sprite parts
for p in parts:
    if not trs[p["tid"]]["visible"]:
        continue
    t = trs[p["tid"]]["t"]
    s = trs[p["tid"]]["s"]
    if abs(t[0]) + abs(t[1]) > 0.01:
        print(f"{p['name'][:28]:28s} t=({t[0]:6.2f},{t[1]:6.2f},{t[2]:6.2f}) s0={s[0]:.3f}")
