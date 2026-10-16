import sys
from pathlib import Path

sys.path.insert(0, str(Path(r"E:\Test_Ban\2_LAO_MINI_ACTION\tools")))
sys.path.insert(0, str(Path(r"E:\LAO_WEB_GAME\Skin_3P_Hirume_R1\tools")))
import export_sd_glb as ex
import render_native_hirume as rh

clip = next(iter(rh.documents(rh.MODEL / "animation" / "Idle_1.anim").values()))["AnimationClip"]
trs, parts = ex.pose_state(clip, 0.0)
for p in parts:
    if any(k in p["name"] for k in ["Eye", "Mouth", "Eyebrow", "cheek", "head"]):
        s = trs[p["tid"]]["s"]
        print(f"{p['name']:30s} vis={trs[p['tid']]['visible']} scale={s[0]:.4f} partEn={p.get('enabled')}")
