from PIL import Image,ImageDraw
from pathlib import Path
root=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResourceSub\FX\Texture')
names=['Shirayuri_NS2_arrow.png','Shirayuri_NS2_arrow2.png','Shirayuri_NS2_arrow3.png','Shirayuri_NS2_arrow4.png'];out=Image.new('RGB',(600,400),'#13243a');d=ImageDraw.Draw(out)
for i,n in enumerate(names):
 im=Image.open(root/n).convert('RGBA');box=im.getchannel('A').getbbox();print(n,im.size,box)
 if box:im=im.crop(box)
 im.thumbnail((250,65));im=im.resize((int(im.width*1.6),int(im.height*1.6)))
 x=i%2*300;y=i//2*200;out.paste(im,(x,y),im);d.text((x,y+125),n,fill='white')
out.save('work/arrow-candidates.jpg')
