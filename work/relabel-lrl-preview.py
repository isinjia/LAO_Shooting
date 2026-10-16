from pathlib import Path
p=Path('work/lrl-flight-volley.html');s=p.read_text().replace('LRL / ORIGINAL UNITY ANIMATION','LRL / ARROW + SWORD WAVE');p.write_text(s)
