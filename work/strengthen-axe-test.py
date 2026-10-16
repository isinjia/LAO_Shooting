from pathlib import Path
p=Path('tools/test-lrl-axe.mjs');s=p.read_text();s=s.replace("assert(!b.alive,'Returned axe is caught instead of oscillating on player');", "assert(!b.alive,'Returned axe is caught instead of oscillating on player');assert(b.age<b.lifetime,'Catch must occur before timeout');assert(Math.hypot(b.x-p.x,b.y-p.y)<20,'Axe must reach its owner');");p.write_text(s)
