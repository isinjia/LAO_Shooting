/**
 * Tick126: select panel caps to #app and scrolls `.char-grid` so long
 * en/pt/es/ru kit/dossier never push SORTIE / BACK / OPTIONS past body
 * overflow:hidden. Strings / tip63 / Box2 / tick37 / dens / tick116–125 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, kitText, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncSelectPanelBudget/);
assert.match(main, /Tick126:/);
assert.match(main, /syncSelectPanelBudget\(\)/);
assert.match(main, /screen === 'select'\) syncSelectPanelBudget/);
assert.match(main, /oc\.style\.maxHeight/);
assert.match(main, /grid\.style\.minHeight/);
// Tick141/142: ratio uses measured fitH (was appH*0.92).
assert.match(main, /fitH \* 0\.92/);

// CSS: panel cap + pinned chrome + scrollable char-grid (beats touch-ui whole-panel scroll).
assert.match(css, /TICK126 — select i18n panel budget/);
assert.match(
  css,
  /body\.touch-ui #overlay-content\.screen-select,\s*#overlay-content\.screen-select\s*\{[\s\S]*?max-height:\s*min\(92%,\s*680px\)/,
);
assert.match(
  css,
  /#overlay-content\.screen-select\s*\{[\s\S]*?min-height:\s*0/,
);
assert.match(
  css,
  /#overlay-content\.screen-select\s*\{[\s\S]*?overflow-y:\s*hidden/,
);
assert.match(
  css,
  /#overlay-content\.screen-select > \.char-grid\s*\{[\s\S]*?overflow-y:\s*auto/,
);
assert.match(
  css,
  /#overlay-content\.screen-select > \.select-actions\s*\{[\s\S]*?flex:\s*0\s*0\s*auto/,
);

// Prior select NewUI / tip densify retained.
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK63 — select/);
assert.match(main, /function showSelect/);
assert.match(main, /select-dossier-kit/);
assert.match(main, /select-actions/);
assert.match(main, /btn-go/);

// Muddy input: long locales keep long kit charge strings (not shortened away).
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  const charge = kitText('merlin', 'charge') || '';
  assert.ok([...charge].length >= 18, `${loc} merlin charge stays long (${[...charge].length})`);
  assert.ok([...t('btn.sortie')].length >= 4, `${loc} btn.sortie kept`);
  assert.ok([...t('select.confirm')].length >= 8, `${loc} select.confirm kept`);
}
setLocale('ko');
assert.ok([...kitText('constantia', 'charge')].length >= 8, 'ko Bori charge kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

// Tick125 tutorial budget retained; no dens churn in the new sync.
assert.match(main, /function syncTutorialPanelBudget/);
assert.match(css, /TICK125 — tutorial i18n panel budget/);
const syncSlice = main.match(
  /function syncSelectPanelBudget\([\s\S]*?\n\}/,
)?.[0] || '';
assert.ok(syncSlice.length > 200, 'syncSelectPanelBudget body present');
assert.ok(!/HOLD dens|emitRate|gridFull|fullNeed/.test(syncSlice),
  'no HOLD dens / CONTROLS tick124 churn inside select sync');

console.log(
  'PASS qa-select-panel-i18n:',
  'panel maxCap + char-grid scroll',
  'CTA pin',
  'long en/pt/es/ru kit retained',
  'tick37/63 + 116–125 frozen',
);
