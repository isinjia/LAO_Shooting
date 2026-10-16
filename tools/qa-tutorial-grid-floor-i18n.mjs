/**
 * Tick132: tutorial short-landscape grid floor reclaim.
 * beginSortie @800×450 left .tutorial-grid at gridH=0 under pinned
 * head+note+CTA while .tutorial-deco stayed visible (≤420 media gap).
 * syncTutorialPanelBudget hides deco at appH≤480 + measure-then-flatten
 * note/actions when avail < 2-row floor. tip41/65 / tick125 / dens frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /Tick132:/);
assert.match(main, /function syncTutorialPanelBudget/);
assert.match(main, /tutorial-deco/);
assert.match(main, /appH <= 480/);
assert.match(main, /gridFloor/);
assert.match(main, /note\.style\.border = 'none'/);
assert.match(main, /actions\.style\.padding = '4px 0'/);
assert.match(main, /note\.style\.display = 'none'/);
// Tick137 raised the note-hide gate to softGridWant(40); keep note reclaim path.
assert.match(main, /avail < softGridWant && note|avail < 36 && note/);
assert.match(main, /softGridWant\s*=\s*40|avail < 36 && note/);

// CSS belt ≤480 hides tutorial-deco (select/pause parity).
assert.match(css, /TICK132 — tutorial short-landscape grid floor/);
assert.match(
  css,
  /@media \(max-height:\s*480px\)\s*\{[\s\S]*?\.tutorial-deco\s*\{[\s\S]*?display:\s*none/,
);

// Prior tutorial panel budget + NewUI / tip densify retained.
assert.match(css, /TICK125 — tutorial i18n panel budget/);
assert.match(css, /TICK41 — tutorial NewUI residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(main, /function showTutorialThen/);
assert.match(main, /t\('tut\.note'\)/);
assert.match(main, /btn-tut-go/);

// Long locales keep long tut strings (not shortened away).
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('tut.p')].length >= 40, `${loc} tut.p stays long`);
  assert.ok([...t('tut.note')].length >= 40, `${loc} tut.note stays long`);
}
setLocale('ko');
assert.ok([...t('tut.p')].length >= 20, 'ko tut.p kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

const syncSlice =
  main.match(/function syncTutorialPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncTutorialPanelBudget body present');
assert.ok(
  !/HOLD dens|emitRate|HOLD_STYLE/.test(syncSlice),
  'no HOLD dens churn inside tutorial sync',
);

console.log(
  'PASS qa-tutorial-grid-floor-i18n:',
  'deco≤480 + note/actions reclaim',
  'gridFloor under maxCap',
  'tick125/41/65 + long i18n frozen',
);
