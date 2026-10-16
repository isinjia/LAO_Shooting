/**
 * Tick141: SE-class select/OPTIONS maxCap floor.
 * Root muddy: Math.max(320, clientHeight*0.92) forced inline maxHeight 320
 * while the painted #app box is ≈319.5 @568×320 → live panelOver≈0.25 /
 * headroom≈−0.3 on select + OPTIONS (CTA/BACK clear; scroll/grid floors
 * OK). Floor is now min(320, fitH) with fitH from measured box.
 * tip37/63/35/61 / tick120–121 / 126–129 / 134 / 136 / dens / tick116–140
 * frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncSelectPanelBudget/);
assert.match(main, /function syncOptionsPanelBudget/);
assert.match(main, /Tick141/);

const selectSlice =
  main.match(/function syncSelectPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
const optionsSlice =
  main.match(/function syncOptionsPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(selectSlice.length > 400, 'syncSelectPanelBudget body present');
assert.ok(optionsSlice.length > 400, 'syncOptionsPanelBudget body present');

for (const [name, slice] of [
  ['select', selectSlice],
  ['options', optionsSlice],
]) {
  assert.match(slice, /Tick141/);
  assert.match(slice, /floorCap/);
  assert.match(slice, /ratioCap/);
  assert.match(slice, /appBoxH/);
  assert.match(slice, /fitH/);
  assert.match(slice, /Math\.min\(320,\s*fitH\)/);
  assert.match(slice, /Math\.min\(680,\s*Math\.max\(floorCap,\s*ratioCap\)\)/);
  // Old forced floor above #app must not remain as the sole maxCap formula.
  assert.ok(
    !/let maxCap = Math\.min\(680,\s*Math\.max\(320,\s*Math\.floor\(appH \* 0\.92\)\)\)/.test(
      slice,
    ),
    `${name}: old Math.max(320, appH*0.92) maxCap removed`,
  );
  assert.ok(
    !/HOLD dens|emitRate|holdIdentity/.test(slice),
    `${name}: no HOLD dens churn`,
  );
}

// Prior ships retained inside each sync.
assert.match(selectSlice, /Tick134|softFloorWant|select-blurb|sortie-deco/);
assert.match(optionsSlice, /softScrollWant\s*=\s*140/);
assert.match(optionsSlice, /is-opt-short/);
assert.match(optionsSlice, /Tick136/);

assert.match(css, /TICK141 — SE-class select\/OPTIONS maxCap floor/);
assert.match(css, /TICK141 — SE-class OPTIONS maxCap floor/);
assert.match(css, /TICK126 — select i18n panel budget/);
assert.match(css, /TICK127 — OPTIONS i18n panel budget/);
assert.match(css, /TICK134 — select extreme-short grid floor/);
assert.match(css, /TICK136 — OPTIONS extreme-short scroll floor/);
assert.match(css, /TICK129 — select short-landscape head reclaim/);
assert.match(css, /max-height:\s*min\(92%,\s*680px\)/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN']) {
  setLocale(loc);
  assert.ok([...t('opt.back')].length >= 2, `${loc} opt.back kept`);
  assert.ok([...t('btn.sortie')].length >= 2, `${loc} btn.sortie kept`);
}
setLocale('ko');
assert.ok([...t('opt.back')].length >= 2, 'ko opt.back kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-se-maxcap-floor-i18n:',
  'select+OPTIONS floorCap=min(320,fitH)',
  'tick126/127/129/134/136 retained',
);
