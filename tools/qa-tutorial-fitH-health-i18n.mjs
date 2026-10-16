/**
 * Tick163: tutorial ultra-short CTA-health fitH clamp.
 * Root muddy: after tick142 fitH floor, syncTutorialPanelBudget CTA-health
 * still used Math.max(260, …) and re-inflated maxH to 260 while fitH≈202
 * @360×240 (live ko/ru panelOver≈28.75 / skip secOut; pt/es/en already
 * maxH=fitH clear). Clamp shave to fitH / floorCap (select tick144 parity).
 * tip41/65 / tick125/132/137/142 / dens / tick116–162 frozen.
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
assert.match(main, /Tick163/);

const syncSlice =
  main.match(/function syncTutorialPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncTutorialPanelBudget body present');

// Tick163 fitH-aware CTA-health shave (no legacy 260 re-inflate).
assert.match(syncSlice, /Tick163/);
assert.match(
  syncSlice,
  /Math\.max\(floorCap,\s*Math\.min\(fitH,\s*Math\.floor\(maxCap - over - 4\)\)\)/,
);
assert.ok(
  !/Math\.max\(260,\s*Math\.floor\(maxCap - over - 4\)\)/.test(syncSlice),
  'legacy Math.max(260, …) CTA-health inflate removed from tutorial sync',
);

// Tick142 fitH floor retained.
assert.match(syncSlice, /Tick142/);
assert.match(syncSlice, /Math\.min\(300,\s*fitH\)/);
assert.match(syncSlice, /Math\.floor\(fitH \* 0\.92\)/);

// Prior tutorial ladder retained.
assert.match(syncSlice, /Tick137/);
assert.match(syncSlice, /softGridWant/);
assert.match(syncSlice, /is-tut-short/);
assert.match(syncSlice, /tutorial-grid/);
assert.match(main, /Tick132:/);
assert.match(main, /Tick125/);

assert.ok(
  !/HOLD dens|emitRate|is-pause-short|is-result-short|is-select-short/.test(
    syncSlice,
  ),
  'no HOLD dens / pause/result/select soft-grid churn inside tutorial sync',
);

assert.match(
  css,
  /TICK163 — tutorial ultra-short CTA-health fitH clamp/,
);
assert.match(css, /TICK142 — ultra-short tutorial\/pause\/result fitH maxCap floor/);
assert.match(css, /TICK137 — tutorial extreme-short grid floor/);
assert.match(css, /TICK132 — tutorial short-landscape/);
assert.match(css, /TICK125 — tutorial i18n panel budget/);
assert.match(css, /TICK144 — select ultra-short CTA-health fitH clamp/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ko']) {
  setLocale(loc);
  assert.ok([...t('btn.sortie')].length >= 2, `${loc} btn.sortie kept`);
  assert.ok([...t('btn.tutSkip')].length >= 4, `${loc} btn.tutSkip kept`);
  assert.ok([...t('tut.note')].length >= 8, `${loc} tut.note kept`);
}
setLocale('ko');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-tutorial-fitH-health-i18n:',
  'CTA-health clamp fitH/floorCap @ultra-short',
  'tick142 fitH floor + tick125/132/137 ladder retained',
);
