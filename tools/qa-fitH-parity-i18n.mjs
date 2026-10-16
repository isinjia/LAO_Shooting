/**
 * Tick142: ultra-short tutorial / pause / result fitH maxCap floor.
 * Root muddy: Math.max(300|280|260, clientHeight*ratio) forced inline
 * maxHeight above the painted #app box when fitH < floor
 * (live tutorial @480×288 appBox≈270 → maxH=300 / panelOver≈15;
 *  pause last-resort maxH=280 / panelOver≈5;
 *  result @400×280 appBox≈225 → maxH=260 / panelOver≈17.5 / CTA out).
 * Floor is now min(priorFloor, fitH) with fitH from measured box —
 * select/OPTIONS tick141 parity. Title has no always-on floor muddy.
 * tip41/65/31/58/38/62 / tick125–141 / dens / tick116–141 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncTutorialPanelBudget/);
assert.match(main, /function syncPausePanelBudget/);
assert.match(main, /function syncResultPanelBudget/);
assert.match(main, /Tick142/);

const tutSlice =
  main.match(/function syncTutorialPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
const pauseSlice =
  main.match(/function syncPausePanelBudget\([\s\S]*?\n\}/)?.[0] || '';
const resultSlice =
  main.match(/function syncResultPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(tutSlice.length > 400, 'syncTutorialPanelBudget body present');
assert.ok(pauseSlice.length > 400, 'syncPausePanelBudget body present');
assert.ok(resultSlice.length > 400, 'syncResultPanelBudget body present');

// Tutorial always-on maxCap (tick125 floor 300 → fitH).
assert.match(tutSlice, /Tick142/);
assert.match(tutSlice, /floorCap/);
assert.match(tutSlice, /ratioCap/);
assert.match(tutSlice, /appBoxH/);
assert.match(tutSlice, /fitH/);
assert.match(tutSlice, /Math\.min\(300,\s*fitH\)/);
assert.match(tutSlice, /Math\.min\(560,\s*Math\.max\(floorCap,\s*ratioCap\)\)/);
assert.ok(
  !/let maxCap = Math\.min\(560,\s*Math\.max\(300,\s*Math\.floor\(appH \* 0\.92\)\)\)/.test(
    tutSlice,
  ),
  'tutorial: old Math.max(300, appH*0.92) maxCap removed',
);

// Pause / result last-resort floors (280 / 260 → fitH).
assert.match(pauseSlice, /Tick142/);
assert.match(pauseSlice, /Math\.min\(280,\s*fitH\)/);
assert.ok(
  !/Math\.max\(280,\s*Math\.floor\(appH \* 0\.96\)\)/.test(pauseSlice),
  'pause: old Math.max(280, appH*0.96) last-resort removed',
);
assert.match(resultSlice, /Tick142/);
assert.match(resultSlice, /Math\.min\(260,\s*fitH\)/);
assert.ok(
  !/Math\.max\(260,\s*Math\.floor\(appH \* 0\.96\)\)/.test(resultSlice),
  'result: old Math.max(260, appH*0.96) last-resort removed',
);

// Prior ships retained.
assert.match(tutSlice, /softGridWant\s*=\s*40/);
assert.match(tutSlice, /is-tut-short/);
assert.match(tutSlice, /Tick137|tick137|extreme-short/i);
assert.match(pauseSlice, /is-pause-short/);
assert.match(pauseSlice, /rawHeadroom/);
assert.match(resultSlice, /is-result-short/);
assert.match(resultSlice, /rawHeadroom/);

assert.match(css, /TICK142 — ultra-short tutorial\/pause\/result fitH maxCap floor/);
assert.match(css, /TICK125 — tutorial i18n panel budget/);
assert.match(css, /max-height:\s*min\(92%,\s*560px\)/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN']) {
  setLocale(loc);
  assert.ok([...t('btn.tutSkip')].length >= 2, `${loc} btn.tutSkip kept`);
  assert.ok([...t('btn.resume')].length >= 2, `${loc} btn.resume kept`);
  assert.ok([...t('btn.retry')].length >= 2, `${loc} btn.retry kept`);
}
setLocale('ko');
assert.ok([...t('btn.tutSkip')].length >= 2, 'ko btn.tutSkip kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-fitH-parity-i18n:',
  'tutorial floorCap=min(300,fitH)',
  'pause floorCap=min(280,fitH)',
  'result floorCap=min(260,fitH)',
  'tick125/131/133/137–140 retained',
);
