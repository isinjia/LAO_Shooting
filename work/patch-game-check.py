from pathlib import Path
p=Path('work/check-native-game.mjs');s=p.read_text();s=s.replace("await p.waitForTimeout(1500);", "await p.waitForTimeout(1500);\nawait p.evaluate(()=>{const g=window.__LAO__.getGame();g.player.shotLevel=5;g.player.shoot(g.bullets);});\nawait p.waitForTimeout(180);");p.write_text(s)
