from pathlib import Path
import re, json, subprocess
from PIL import Image, ImageDraw
ROOT=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResource')
cache=Path('work/unity-fx-index.json')
if cache.exists(): index=json.loads(cache.read_text(encoding='utf8'))
else:
    index={}
    for folder in ['FX','Texture','Bullet_Effect']:
        for p in (ROOT/folder).rglob('*.meta'):
            with p.open('r',encoding='utf8',errors='ignore') as f: head=f.read(180)
            m=re.search(r'^guid: (\w+)',head,re.M)
            if m:index[m[1]]=str(p)[:-5]
    cache.write_text(json.dumps(index),encoding='utf8')
names=['Constantia_skill/skill1/Constantia_bullet.prefab','emily_skill/skill2/lazer_beam_emily.prefab',
 'Hirume_skill/skill1/Hirume_skill1_Hit_flame.prefab','Labiata_skill/skill1/Labiata_skill1_blade1.prefab',
 'fafnir_skill/fafnir_N_Skill1_A.prefab']
roots=[ROOT/'FX/character_prefab'/p for p in names]
roots += [ROOT/'Bullet_Effect'/p for p in ['merlin_N_bullet.prefab','Eternity_skill1_bullet.prefab','FX_bullet_emilyRailGun_Gun 1.prefab']]
roots += list((ROOT/'FX/character_prefab/LRL_skill').glob('*.prefab'))
extra=subprocess.run(['rg','--no-ignore','--no-heading','-g','*.meta','^guid:',str(ROOT.parent/'GraphicResources/FX'),str(ROOT.parent/'AssetBundleResourceSub/FX')],capture_output=True,text=True,encoding='utf8').stdout
for line in extra.splitlines():
    m=re.match(r'(.+\.meta):guid: (\w+)',line)
    if m:index[m[2]]=m[1][:-5]
cache.write_text(json.dumps(index),encoding='utf8')
rows=[]
def walk(p,seen,depth=0):
    if str(p) in seen or depth>5:return []
    seen.add(str(p))
    if p.suffix.lower() in ['.png','.tga']:return [p]
    if p.suffix not in ['.prefab','.mat']:return []
    out=[]
    for guid in set(re.findall(r'guid: (\w+)',p.read_text(encoding='utf8',errors='ignore'))):
        if guid in index:out+=walk(Path(index[guid]),seen,depth+1)
    return out
for root in roots:
    textures=walk(root,set())
    print(root.name,':',','.join(p.name for p in textures))
    for p in textures:
        if str(p) not in [r['path'] for r in rows]:rows.append({'path':str(p),'prefab':str(root)})
Path('work/native-fx-candidates.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
out=Image.new('RGB',(1000,((len(rows)+5)//6)*150),'#263449');d=ImageDraw.Draw(out)
for i,row in enumerate(rows):
    im=Image.open(row['path']).convert('RGBA');im.thumbnail((150,110))
    x=(i%6)*166;y=(i//6)*150
    out.paste(im,(x+(150-im.width)//2,y),im)
    d.text((x+3,y+111),f"{i}: {Path(row['path']).stem[:21]}",fill='white')
out.save('work/native-fx-candidates.jpg')
