import re

def anim_paths(path):
    paths = []
    for line in open(path, "r", encoding="utf-8", errors="ignore"):
        line = line.strip()
        if line.startswith("path:"):
            p = line[5:].strip().strip('"')
            if not p.isdigit():
                paths.append(p)
    return paths

anim = r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\alcyone\anims\idle1.anim"
paths = anim_paths(anim)
print("total paths", len(paths))
# categorize
for p in sorted(set(paths))[:80]:
    print(p)
