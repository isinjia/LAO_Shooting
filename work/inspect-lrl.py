from PIL import Image,ImageDraw
im=Image.open('assets/native-shots/lrl.png').convert('RGBA'); out=Image.new('RGB',(1000,600),'#152b3c');d=ImageDraw.Draw(out)
for i in range(12):
 x=(i%4)*512;y=(i//4)*512
 t=im.crop((x,y,x+512,y+512));t.thumbnail((230,170));px=(i%4)*250;py=(i//4)*200;out.paste(t,(px,py),t);d.text((px+10,py+175),str(i),fill='white')
out.save('work/lrl-all-frames.jpg')
