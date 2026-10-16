from pathlib import Path
p=Path('work/check-lrl-volley-game.mjs');s=p.read_text();s=s.replace("const errors=[];", "p.setDefaultTimeout(120000);const errors=[];");p.write_text(s)
