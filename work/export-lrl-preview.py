from pathlib import Path
from PIL import Image
out=Path(r'C:\Users\반진우\Documents\Codex\2026-10-03\e-test-ban-2-lao-mini\outputs');out.mkdir(exist_ok=True)
frames=[Image.open(p).convert('RGB') for p in sorted(Path('work/lrl-animation-frames').glob('*.png'))]
frames[0].save(out/'lrl-animation.gif',save_all=True,append_images=frames[1:],duration=42,loop=0,optimize=False,disposal=2)
print(out/'lrl-animation.gif')
