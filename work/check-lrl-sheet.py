import json
from pathlib import Path
x=json.loads(Path('assets/sd_baked/lrl/sheet.json').read_text());print(x.keys());print(len(x.get('skill1',[])),x.get('skill1',[None])[0]);print(x.get('contentBox'));print(x.get('skill1Fps'))
