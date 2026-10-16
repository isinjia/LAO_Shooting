/**
 * Tick124: title CONTROLS keys-grid prefers full scrollHeight under maxCap≤268
 * so Focus/Bomb/Special + Pause/Mute rows are not left scroll-clipped when the
 * panel budget can fund them. Prior gridWant collapsed to gridFloor.
 * Strings / pins / rules grow / grid floor / HI floor / tip61 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncTitleKeysPanelBudget/);
assert.match(main, /Tick124:/);
assert.match(main, /gridFull/);
assert.match(main, /fullNeed/);
assert.match(main, /gridBudget/);
assert.match(
  main,
  /maxCap\s*=\s*Math\.min\(\s*268\s*,\s*Math\.max\(\s*cssMax\s*\+\s*48\s*,\s*floorNeed\s*,\s*fullNeed\s*\)\s*\)/,
);
// Tick130 may apply via gridFinal / applyKeysTarget — still writes keys-grid minHeight.
assert.match(main, /grid\.style\.minHeight = `\$\{(?:gridTarget|gridFinal|g)\}px`/);
assert.match(main, /grid\.clientHeight >= Math\.max\(0, gridBudget - 1\)|grid\.clientHeight >= gridBudget - 1/);

// Prior ticks retained.
assert.match(main, /Tick123:/);
assert.match(main, /Tick122:/);
assert.match(main, /floorNeed/);
assert.match(main, /gridLh \* 2\.5/);
assert.match(main, /function syncTitleKeysRulesHeight/);
assert.match(main, /cssMax \+ 48/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(
  css,
  /#overlay-content\.screen-title \.keys-grid\s*\{[\s\S]*?line-height:\s*1\.55/,
);
assert.match(
  css,
  /#overlay-content\.screen-title \.keys-grid\s*\{[\s\S]*?overflow-y:\s*auto/,
);

// Muddy input: CONTROLS key rows stay present across long locales.
for (const loc of ['es', 'en', 'pt', 'ru']) {
  setLocale(loc);
  assert.ok([...t('title.focus')].length >= 3, `${loc} title.focus kept`);
  assert.ok([...t('title.bomb')].length >= 3, `${loc} title.bomb kept`);
  assert.ok([...t('title.pause')].length >= 3, `${loc} title.pause kept`);
  assert.ok([...t('title.mute')].length >= 2, `${loc} title.mute kept`);
}
setLocale('ko');
assert.ok([...t('title.focus')].length >= 2, 'ko title.focus kept');

assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-keys-grid-full-i18n:',
  'prefer full grid under maxCap',
  'gridTarget minHeight',
  'maxCap≥fullNeed',
  'tick118–123 + scroll/pins frozen',
);
