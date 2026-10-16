/**
 * Tick127: OPTIONS panel caps to #app and scrolls `.opt-scroll` so long
 * en/pt/es/ru autofire/padNote/keys never push BACK past body
 * overflow:hidden. Strings / tip61 / Box2 / tick35 / tick120–121 / dens /
 * tick116–126 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncOptionsPanelBudget/);
assert.match(main, /Tick127:/);
assert.match(main, /syncOptionsPanelBudget\(\)/);
assert.match(main, /screen === 'options'\) syncOptionsPanelBudget/);
assert.match(main, /class="opt-scroll"/);
assert.match(main, /oc\.style\.maxHeight/);
assert.match(main, /scroll\.style\.minHeight/);
// Tick141/142: ratio uses measured fitH (was appH*0.92).
assert.match(main, /fitH \* 0\.92/);

// CSS: panel cap + pinned chrome + scrollable opt-scroll (beats touch-ui whole-panel scroll).
assert.match(css, /TICK127 — OPTIONS i18n panel budget/);
assert.match(
  css,
  /body\.touch-ui #overlay-content\.screen-options,\s*#overlay-content\.screen-options\s*\{[\s\S]*?max-height:\s*min\(92%,\s*680px\)/,
);
assert.match(
  css,
  /#overlay-content\.screen-options\s*\{[\s\S]*?min-height:\s*0/,
);
assert.match(
  css,
  /#overlay-content\.screen-options\s*\{[\s\S]*?overflow-y:\s*hidden/,
);
assert.match(
  css,
  /#overlay-content\.screen-options > \.opt-scroll\s*\{[\s\S]*?overflow-y:\s*auto/,
);
assert.match(
  css,
  /#overlay-content\.screen-options > \.opt-actions\s*\{[\s\S]*?flex:\s*0\s*0\s*auto/,
);

// Prior OPTIONS NewUI / tip densify / autofire+fullscreen ships retained.
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK61 —/);
assert.match(css, /TICK120 — OPTIONS autofire/);
assert.match(css, /TICK121 — OPTIONS mute\/fullscreen/);
assert.match(main, /function showOptions/);
assert.match(main, /opt-autofire/);
assert.match(main, /btn-opt-back/);
assert.match(main, /opt\.padNote/);

// Muddy input: long locales keep long autofire / padNote / back strings.
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('opt.autoFire')].length >= 24, `${loc} opt.autoFire stays long (${[...t('opt.autoFire')].length})`);
  assert.ok([...t('opt.padNote')].length >= 40, `${loc} opt.padNote stays long (${[...t('opt.padNote')].length})`);
  assert.ok([...t('opt.back')].length >= 3, `${loc} opt.back kept`);
  assert.ok([...t('opt.fullscreen')].length >= 6, `${loc} opt.fullscreen kept`);
}
setLocale('ko');
assert.ok([...t('opt.autoFire')].length >= 12, 'ko autofire kept');
assert.ok([...t('opt.padNote')].length >= 20, 'ko padNote kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

// Tick126 select budget retained; no dens churn in the new sync.
assert.match(main, /function syncSelectPanelBudget/);
assert.match(css, /TICK126 — select i18n panel budget/);
const syncSlice = main.match(
  /function syncOptionsPanelBudget\([\s\S]*?\n\}/,
)?.[0] || '';
assert.ok(syncSlice.length > 200, 'syncOptionsPanelBudget body present');
assert.ok(!/HOLD dens|emitRate|gridFull|fullNeed/.test(syncSlice),
  'no HOLD dens / CONTROLS tick124 churn inside options sync');

console.log(
  'PASS qa-options-panel-i18n:',
  'panel maxCap + opt-scroll scroll',
  'CTA pin',
  'long en/pt/es/ru autofire/padNote retained',
  'tick35/61/120–121 + 116–126 frozen',
);
