/**
 * Tick164: tutorial ultra-short skip/CTA chrome ladder.
 * After tick163 fitH CTA-health, *@320×200 still HARD skip clip with
 * panelOver=0 / maxH=fitH / sortie CTA full (live secVis≈32–36).
 * Measure-then-reclaim: actions compact → brand/h2 → pad
 * (select tick161 / pause tick162 peer). SORTIE/skip strings kept.
 * tip41/65 / 125/132/137/142/163 / dens / tick116–163 frozen.
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
assert.match(main, /Tick164/);

const start = main.indexOf('function syncTutorialPanelBudget');
const next = main.indexOf('\nfunction ', start + 1);
const syncSlice = main.slice(start, next > start ? next : start + 12000);
assert.ok(syncSlice.length > 800, 'syncTutorialPanelBudget body present');

// Tick164 chrome ladder present.
assert.match(syncSlice, /Tick164/);
assert.match(syncSlice, /skipChromeOverflow/);
assert.match(syncSlice, /#btn-tut-skip/);
assert.match(syncSlice, /btn-cta/);
assert.match(syncSlice, /minWidth = '0'/);
assert.match(syncSlice, /actions\.style\.gap = '4px'/);
assert.match(syncSlice, /brand\.style\.display = 'none'/);
assert.match(syncSlice, /fontSize = '16px'/);
assert.match(syncSlice, /paddingTop = '8px'/);
assert.match(syncSlice, /refundGrid/);
// Clear path restores btn chrome between remounts.
assert.match(syncSlice, /actions\.style\.gap = ''/);
assert.match(syncSlice, /b\.style\.minWidth = ''/);
assert.match(syncSlice, /paddingTop = ''/);

// Prior tutorial fitH / floor / reclaim retained.
assert.match(syncSlice, /Tick163/);
assert.match(syncSlice, /Tick142/);
assert.match(syncSlice, /Tick137/);
assert.match(syncSlice, /Math\.min\(300,\s*fitH\)/);
assert.match(
  syncSlice,
  /Math\.max\(floorCap,\s*Math\.min\(fitH,\s*Math\.floor\(maxCap - over - 4\)\)\)/,
);
assert.ok(
  !/Math\.max\(260,\s*Math\.floor\(maxCap - over - 4\)\)/.test(syncSlice),
  'legacy Math.max(260) inflate stays removed',
);

// No dens / HOLD churn inside sync body.
assert.ok(
  !/HOLD dens|emitRate|HOLD_STYLE/.test(syncSlice),
  'no HOLD dens churn inside tutorial sync',
);

assert.match(
  css,
  /TICK164 — tutorial ultra-short skip\/CTA chrome ladder/,
);
assert.match(css, /TICK163 — tutorial ultra-short CTA-health fitH clamp/);
assert.match(css, /TICK142 — ultra-short tutorial\/pause\/result fitH maxCap floor/);
assert.match(css, /TICK137 — tutorial extreme-short grid floor/);
assert.match(css, /TICK132 — tutorial short-landscape/);
assert.match(css, /TICK125 — tutorial i18n panel budget/);
assert.match(css, /\.screen-tutorial\.is-tut-short .opt-head .brand-mark/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ko']) {
  setLocale(loc);
  assert.ok([...t('btn.sortie')].length >= 2, `${loc} btn.sortie kept`);
  assert.ok([...t('btn.tutSkip')].length >= 4, `${loc} btn.tutSkip kept`);
  assert.ok([...t('tut.note')].length >= 8, `${loc} tut.note kept`);
  assert.ok([...t('tut.h2')].length >= 2, `${loc} tut.h2 kept`);
}
setLocale('ko');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log('qa-tutorial-cta-chrome-i18n: PASS');
