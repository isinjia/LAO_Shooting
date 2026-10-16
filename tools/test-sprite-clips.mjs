import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClipAnimator, makeSheetFrame } from '../js/clip-anim.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/sd_baked');
let checked = 0;
for (const key of fs.readdirSync(root)) {
  const jsonPath = path.join(root, key, 'sheet.json');
  if (!fs.existsSync(jsonPath)) continue;
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const box = data.contentBox;
  for (const clip of ['idle', 'move', 'die']) {
    for (const rect of (data[clip] || [])) {
      assert(Number.isFinite(rect.ox) && Number.isFinite(rect.oy), `${key}/${clip}: missing crop origin`);
      const sheet = { width: 4096, height: 4096 };
      const frame = makeSheetFrame(sheet, rect);
      const anim = new ClipAnimator({ idle: [frame], contentBox: box });
      let draw = null;
      const ctx = {
        save() {}, restore() {}, translate() {}, scale() {},
        drawImage(_img, sx, sy, sw, sh, dx, dy, dw, dh) { draw = { sx, sy, sw, sh, dx, dy, dw, dh }; },
      };
      const flip = checked % 2 === 0;
      anim.draw(ctx, 100, 100, 80, { flipX: flip });
      const ix = Math.max(box.x, rect.ox);
      const iy = Math.max(box.y, rect.oy);
      const iw = Math.min(box.x + box.w, rect.ox + rect.w) - ix;
      const ih = Math.min(box.y + box.h, rect.oy + rect.h) - iy;
      if (iw <= 0 || ih <= 0) {
        assert.equal(draw, null);
      } else {
        assert(draw, `${key}/${clip}: missing draw`);
        assert.deepEqual(
          { sx: draw.sx, sy: draw.sy, sw: draw.sw, sh: draw.sh },
          { sx: rect.x + ix - rect.ox, sy: rect.y + iy - rect.oy, sw: iw, sh: ih },
          `${key}/${clip}: atlas bleed`,
        );
        assert(draw.sx >= rect.x && draw.sy >= rect.y);
        assert(draw.sx + draw.sw <= rect.x + rect.w && draw.sy + draw.sh <= rect.y + rect.h);
        const aspect = box.w / box.h;
        const w = aspect < 1 ? 80 * aspect : 80;
        const h = aspect < 1 ? 80 : 80 / aspect;
        const dx = (flip ? -w / 2 : 100 - w / 2) + (ix - box.x) * w / box.w;
        const dy = (flip ? -h / 2 : 100 - h / 2) + (iy - box.y) * h / box.h;
        assert(Math.abs(draw.dx - dx) < 1e-9 && Math.abs(draw.dy - dy) < 1e-9, `${key}/${clip}: original alignment`);
      }
      checked++;
    }
  }
}
assert(checked > 2000, 'expected player and monster atlases');
console.log(`Sprite clip bounds: ${checked} frames passed`);
