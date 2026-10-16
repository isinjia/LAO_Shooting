from pathlib import Path
p=Path('js/native-weapon-fx.js');s=p.read_text(encoding='utf-8');s=s.replace("case 'merlin':\n      stamp", "case 'merlin':\n      ctx.shadowColor = '#ffae69'; ctx.shadowBlur = 4;\n      stamp")
s=s.replace("case 'fafnir':\n      stamp", "case 'fafnir':\n      ctx.globalCompositeOperation = 'lighter';\n      ctx.shadowColor = '#76dcff'; ctx.shadowBlur = 5;\n      stamp")
s=s.replace("stamp(28+power*4,18+power*1.5);", "stamp(28+power*4,18+power*1.5);\n      stamp(28+power*4,18+power*1.5);")
s=s.replace('stamp(length,r*2.9,0,-length/2);','stamp(length,r*2.9,Math.PI,-length/2);').replace('stamp(length,r*1.15,0,-length/2,0,0.85,true);','stamp(length,r*1.15,Math.PI,-length/2,0,0.85,true);')
p.write_text(s,encoding='utf-8')
