from pathlib import Path
from PIL import Image
import shutil,json,hashlib
root=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResourceSub\FX\sqns_fx');out=Path('assets/native-shots');sources={}
for key,name,cols,rows in [('lrl-hit-cut','blade_line.PNG',4,2),('lrl-hit-sparks','3_2_hit_sqns.PNG',3,2)]:
 p=root/name;im=Image.open(p).convert('RGBA');cw=im.width//cols;ch=im.height//rows;boxes=[]
 for i in range(cols*rows):
  tile=im.crop((i%cols*cw,i//cols*ch,(i%cols+1)*cw,(i//cols+1)*ch));box=tile.getchannel('A').point(lambda x:255 if x>8 else 0).getbbox()
  if box:boxes.append(box)
 union=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
 shutil.copyfile(p,out/(key+'.png'));sources[key]={'source':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'grid':[cols,rows],'bounds':union};print(key,union)
(out/'lrl-hit-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2),encoding='utf-8')
