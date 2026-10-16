from PIL import Image,ImageDraw
from pathlib import Path
root=Path('assets/sd_baked/lrl/native');indices=[0,24,48,72,87,96,120,144,168,192,216,238]
out=Image.new('RGB',(1200,750),'#162739');d=ImageDraw.Draw(out)
for i,n in enumerate(indices):
 p=root/f'skill1_{n:03d}.png';im=Image.open(p).convert('RGBA');im.thumbnail((280,205));x=i%4*300;y=i//4*250;out.paste(im,(x,y),im);d.text((x+8,y+215),str(n),fill='white')
out.save('work/lrl-skill1-contact.jpg')
