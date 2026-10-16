from PIL import Image,ImageDraw
from pathlib import Path
root=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResourceSub\FX\sqns_fx')
names=['FX_basic_Slash_Sqns.PNG','3_2_hit_sqns.PNG','blade_line.PNG','blade_line_attack_ver2.PNG','blade_attack_crop.PNG','Charlotte_skill2_hit_sqns.png','Fenrir_skill2_Hit_line_03.png','2blade_attack_sqsn.PNG']
out=Image.new('RGB',(1000,520),'#183045');d=ImageDraw.Draw(out)
for i,n in enumerate(names):
 im=Image.open(root/n).convert('RGBA');print(n,im.size);im.thumbnail((235,225));x=i%4*250;y=i//4*260;out.paste(im,(x,y),im);d.text((x,y+235),n[:30],fill='white')
out.save('work/slash-hit-candidates.jpg')
