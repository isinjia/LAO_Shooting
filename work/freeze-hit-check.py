from pathlib import Path
p=Path('work/check-lrl-hit-game.mjs');s=p.read_text().replace("()=>window.__LAO__.getGame().bullets.nativeEffects.list.some(f=>f.kind==='impact')", "()=>{const g=window.__LAO__.getGame();const hit=g.bullets.nativeEffects.list.find(f=>f.kind==='impact');if(!hit)return false;g.debug.manualTick=true;hit.age=.065;return true;}");p.write_text(s)
