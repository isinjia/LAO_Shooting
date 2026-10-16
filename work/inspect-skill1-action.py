from PIL import Image,ImageDraw
from pathlib import Path
root=Path('assets/sd_baked/lrl/native');indices=[24,30,36,42,48,54,60,66,72,78,84,90]
out=Image.new('RGB',(1200,750),'#162739');d=ImageDraw.Draw(out)
for i,n in enumerate(indices):
 im=Image.open(root/f'skill1_{n:03d}.png').convert('RGBA');im.thumbnail((280,205));x=i%4*300;y=i//4*250;out.paste(im,(x,y),im);d.text((x+8,y+215),str(n),fill='white')
out.save('work/lrl-skill1-action.jpg')
