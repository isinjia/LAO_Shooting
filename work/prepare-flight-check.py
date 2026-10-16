from pathlib import Path
p=Path('work/check-lrl-game.mjs');s=p.read_text();a=s.index('await p.evaluate(()=>{const g=window');b=s.index('console.log(await',a)
s=s[:a]+'''for(let i=0;i<5;i++){
 await p.evaluate(()=>{const g=window.__LAO__.getGame();g.player.shotLevel=5;g.player.fireCooldown=0;g.player.shoot(g.bullets);});
 await p.waitForTimeout(280);
}
''' +s[b:];s=s.replace('native-game-lrl.png','lrl-flight-volley-game.png');Path('work/check-lrl-volley-game.mjs').write_text(s)
p=Path('work/export-lrl-preview.py');s=p.read_text().replace('lrl-animation-frames','lrl-flight-volley-frames').replace('lrl-animation.gif','lrl-flight-volley.gif');Path('work/export-lrl-volley.py').write_text(s)
