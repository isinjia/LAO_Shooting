/**
 * Tick137: tutorial extreme-short grid floor reclaim.
 * Root muddy: after tick132 @640×360 gridH≈14 (ko/ru) / ≈36 (en/pt/es)
 * while softGridWant 40; decorative brand + tall h2 ate the flex slot.
 * syncTutorialPanelBudget measure-then-reclaim brand/h2 + soft floor ≥40.
 * tip41/65 / tick125 / tick132 / dens frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /Tick137:/);
assert.match(main, /function syncTutorialPanelBudget/);
assert.match(main, /softGridWant/);
assert.match(main, /is-tut-short/);

const syncSlice =
  main.match(/function syncTutorialPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncTutorialPanelBudget body present');
assert.match(syncSlice, /softGridWant\s*=\s*40/);
assert.match(syncSlice, /classList\.add\('is-tut-short'\)/);
assert.match(syncSlice, /brand\.style\.display = 'none'/);
assert.match(syncSlice, /h2\.style\.fontSize = '18px'/);
assert.ok(
  !/HOLD dens|emitRate|HOLD_STYLE/.test(syncSlice),
  'no HOLD dens churn inside tutorial sync',
);

assert.match(css, /TICK137 — tutorial extreme-short grid floor/);
assert.match(
  css,
  /@media \(max-height:\s*400px\)\s*\{[\s\S]*?\.screen-tutorial[\s\S]*?\.brand-mark\s*\{[\s\S]*?display:\s*none/,
);
assert.match(
  css,
  /\.screen-tutorial\.is-tut-short \.opt-head \.brand-mark\s*\{\s*display:\s*none/,
);

// Prior tutorial floors + NewUI / tip densify retained.
assert.match(main, /Tick132:/);
assert.match(css, /TICK132 — tutorial short-landscape grid floor/);
assert.match(css, /TICK125 — tutorial i18n panel budget/);
assert.match(css, /TICK41 — tutorial NewUI residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(main, /function showTutorialThen/);
assert.match(main, /t\('tut\.note'\)/);
assert.match(main, /btn-tut-go/);

for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('tut.p')].length >= 40, `${loc} tut.p stays long`);
  assert.ok([...t('tut.note')].length >= 40, `${loc} tut.note stays long`);
  assert.ok([...t('tut.h2')].length >= 2, `${loc} tut.h2 kept`);
}
setLocale('ko');
assert.ok([...t('tut.p')].length >= 20, 'ko tut.p kept');
assert.ok([...t('tut.h2')].length >= 2, 'ko tut.h2 kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-tutorial-extreme-floor-i18n:',
  'softGridWant 40 + is-tut-short head reclaim',
  'tick132/125/41/65 + long i18n frozen',
);
