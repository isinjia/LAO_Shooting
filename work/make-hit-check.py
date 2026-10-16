from pathlib import Path
p=Path('work/check-lrl-game.mjs');s=p.read_text();a=s.index('await p.evaluate(()=>{const g=window');b=s.index('console.log(await',a)
s=s[:a]+'''await p.evaluate(()=>{const g=window.__LAO__.getGame();const enemy=g.enemies.find(e=>e.alive);if(!enemy)throw Error('No target');g.player.x=enemy.x-220;g.player.y=enemy.y;g.player.invuln=20;g.player.shotLevel=1;g.player.shoot(g.bullets);});
await p.waitForFunction(()=>window.__LAO__.getGame().bullets.nativeEffects.list.some(f=>f.kind==='impact'),null,{timeout:5000});
''' +s[b:];s=s.replace('native-game-lrl.png','lrl-slash-hit-game.png');Path('work/check-lrl-hit-game.mjs').write_text(s)
