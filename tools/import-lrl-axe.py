"""Extract LRL's original parts_weapon sprite, preserving source alpha."""
from pathlib import Path
from PIL import Image
import json,hashlib
source=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_PECS_LRL_N\Model_PECS_LRL_N\Materials\Texture_PECS_LRL_N.png')
root=Path(__file__).resolve().parents[1]
im=Image.open(source).convert('RGBA')
# Unity parts_weapon rect (bottom-left): x536 y847 width402 height170.
im.crop((536,im.height-847-170,938,im.height-847)).save(root/'assets/native-shots/lrl-axe.png')
(root/'assets/native-shots/lrl-axe-source.json').write_text(json.dumps({'source':str(source),'sprite':'parts_weapon','unityRect':[536,847,402,170],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'processing':'Exact sprite rect crop; original RGBA preserved'},ensure_ascii=False,indent=2),encoding='utf-8')
