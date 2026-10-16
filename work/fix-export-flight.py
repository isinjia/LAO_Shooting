from pathlib import Path
p=Path('work/export-lrl-preview.py');s=p.read_text(encoding='utf-8-sig').replace('lrl-animation-frames','lrl-flight-volley-frames').replace('lrl-animation.gif','lrl-flight-volley.gif');Path('work/export-lrl-volley.py').write_text(s,encoding='utf-8')
