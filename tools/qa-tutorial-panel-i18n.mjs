/**
 * Tick125: tutorial panel caps to #app and scrolls `.tutorial-grid` so long
 * en/pt/es/ru tut rows never push sortie / skip CTAs past body overflow:hidden.
 * Strings / tip65 / Box2 / tick41 / dens / tick116–124 frozen.
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
assert.match(main, /Tick125:/);
assert.match(main, /syncTutorialPanelBudget\(\)/);
assert.match(main, /screen === 'tutorial'\) syncTutorialPanelBudget/);
assert.match(main, /oc\.style\.maxHeight/);
assert.match(main, /grid\.style\.minHeight/);
// Tick142: ratio uses measured fitH (was appH*0.92); floorCap=min(300,fitH).
assert.match(main, /fitH \* 0\.92/);

// CSS: panel cap + pinned chrome + scrollable grid (beats touch-ui whole-panel scroll).
assert.match(css, /TICK125 — tutorial i18n panel budget/);
assert.match(
  css,
  /body\.touch-ui #overlay-content\.screen-tutorial,\s*#overlay-content\.screen-tutorial\s*\{[\s\S]*?max-height:\s*min\(92%,\s*560px\)/,
);
assert.match(
  css,
  /#overlay-content\.screen-tutorial\s*\{[\s\S]*?min-height:\s*0/,
);
assert.match(
  css,
  /#overlay-content\.screen-tutorial\s*\{[\s\S]*?overflow-y:\s*hidden/,
);
assert.match(
  css,
  /#overlay-content\.screen-tutorial > \.tutorial-grid\s*\{[\s\S]*?overflow-y:\s*auto/,
);
assert.match(
  css,
  /#overlay-content\.screen-tutorial > \.pause-actions\s*\{[\s\S]*?flex:\s*0\s*0\s*auto/,
);

// Prior tutorial NewUI / tip densify retained.
assert.match(css, /TICK41 — tutorial NewUI residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(main, /function showTutorialThen/);
assert.match(main, /t\('tut\.p'\)/);
assert.match(main, /t\('tut\.note'\)/);
assert.match(main, /btn-tut-go/);
assert.match(main, /btn-tut-skip/);

// Muddy input: long locales keep long tut.p / tut.note (not shortened away).
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('tut.p')].length >= 40, `${loc} tut.p stays long (${[...t('tut.p')].length})`);
  assert.ok([...t('tut.note')].length >= 40, `${loc} tut.note stays long (${[...t('tut.note')].length})`);
  assert.ok([...t('btn.tutSkip')].length >= 8, `${loc} btn.tutSkip kept`);
}
setLocale('ko');
assert.ok([...t('tut.p')].length >= 20, 'ko tut.p kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

// No dens / HOLD / CONTROLS budget churn in the new sync.
const syncSlice = main.match(
  /function syncTutorialPanelBudget\([\s\S]*?\n\}/,
)?.[0] || '';
assert.ok(syncSlice.length > 200, 'syncTutorialPanelBudget body present');
assert.ok(!/HOLD dens|emitRate|gridFull|fullNeed/.test(syncSlice),
  'no HOLD dens / CONTROLS tick124 churn inside tutorial sync');

console.log(
  'PASS qa-tutorial-panel-i18n:',
  'panel maxCap + grid scroll',
  'CTA pin',
  'long en/pt/es/ru tut retained',
  'tick41/65 + 116–124 frozen',
);
