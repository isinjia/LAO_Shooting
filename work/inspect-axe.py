from PIL import Image
from pathlib import Path
p=Path(r'E:\LAO\Google_QA\Assets\AssetBundleResource\Character\Char_PECS_LRL_N\Model_PECS_LRL_N\Materials\Texture_PECS_LRL_N.png')
im=Image.open(p).convert('RGBA'); crop=im.crop((536,7,938,177));print(crop.getpixel((30,130)),crop.getpixel((180,120)));crop.save('work/lrl-axe-crop.png')
