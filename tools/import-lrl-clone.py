from PIL import Image
from pathlib import Path
import json,hashlib
root=Path('assets/sd_baked/lrl/native');out=Image.new('RGBA',(768,768));samples=list(range(36,73,3))
for i,n in enumerate(samples):
 im=Image.open(root/f'skill1_{n:03d}.png').convert('RGBA')
 crop=im.crop((109,108,659,659)).resize((192,192),Image.Resampling.LANCZOS)
 out.alpha_composite(crop,((i%4)*192,(i//4)*192))
path=Path('assets/native-shots/lrl-skill1-clone.png');out.save(path,optimize=True)
Path('assets/native-shots/lrl-skill1-clone-source.json').write_text(json.dumps({'source':'assets/sd_baked/lrl/native/skill1_###.png (baked from Unity LRL skill1.anim)','frames':samples,'sourceHashes':{str(n):hashlib.sha256((root/f'skill1_{n:03d}.png').read_bytes()).hexdigest() for n in samples},'processing':'Fixed contentBox crop and 192px resize, 4x4 sheet; original character art only'},ensure_ascii=False,indent=2),encoding='utf-8')
print(path,path.stat().st_size)
