import re

def fbx_bones(path):
    data = open(path, "rb").read()
    strs = re.findall(rb"[\x20-\x7e]{3,80}", data)
    bones = set()
    for s in strs:
        d = s.decode("ascii", "ignore")
        if d.startswith("Bone_") or d.startswith("bone_") or d.startswith("Parts_"):
            bones.add(d)
    return bones

def anim_leaves(path):
    leaves = set()
    for line in open(path, "r", encoding="utf-8", errors="ignore"):
        line = line.strip()
        if line.startswith("path:"):
            p = line[5:].strip().strip('"')
            if p.isdigit():
                continue
            leaves.add(p.split("/")[-1])
    return leaves

tests = [
    (
        "undine",
        r"E:\LAO\GoogleBundleResource\AssetBundleResource\Character\Char_BR_Undine_N\Model_BR_Undine_N\3d_Mash\SD_BR_Undine_N.FBX",
        r"E:\LAO\GoogleBundleResource\AssetBundleResource\Character\Char_BR_Undine_N\Model_BR_Undine_N\animation\idle1.anim",
    ),
    (
        "hachiko",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\hachiko\model.fbx",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\hachiko\anims\idle1.anim",
    ),
    (
        "merlin",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\merlin\model.fbx",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\merlin\anims\idle1.anim",
    ),
    (
        "alcyone",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\alcyone\model.fbx",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\alcyone\anims\idle1.anim",
    ),
    (
        "phantom",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\phantom\model.fbx",
        r"E:\Test_Ban\2_LAO_MINI_ACTION\assets\sd\phantom\anims\idle1.anim",
    ),
]

for name, fbx, anim in tests:
    fb = fbx_bones(fbx)
    leaves = anim_leaves(anim)
    inter = sorted(fb & leaves)
    print(f"== {name}: fbx={len(fb)} leaves={len(leaves)} overlap={len(inter)}")
    print(" overlap:", inter[:30])
