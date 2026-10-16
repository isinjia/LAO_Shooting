from pathlib import Path
from PIL import Image
import shutil,json,hashlib
source=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResourceSub\FX\sqns_fx\FX_basic_Slash_Sqns.PNG')
im=Image.open(source).convert('RGBA');boxes=[]
for i in range(16):
 b=im.crop((i%4*512,i//4*512,(i%4+1)*512,(i//4+1)*512)).getchannel('A').point(lambda a:255 if a>10 else 0).getbbox()
 if b:boxes.append(b)
print([min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)])
shutil.copyfile(source,'assets/native-shots/lrl-flight.png')
Path('assets/native-shots/lrl-flight-source.json').write_text(json.dumps({'source':str(source),'grid':[4,4],'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'processing':'Original full 16-cell sheet, RGBA unmodified'},ensure_ascii=False,indent=2),encoding='utf-8')
