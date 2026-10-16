/**
 * Tick128: OPTIONS flatten nested scroll — `.opt-scroll` outer alone
 * scrolls; `.opt-keys` inside it loses max-height:220 / touch 34dvh cap
 * so short-landscape users are not trapped in dual scrollers.
 * Strings / tip61 / Box2 / tick35 / tick120–121 / panel maxCap+BACK
 * (tick127) / dens / tick116–126 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

assert.match(css, /TICK128 — OPTIONS flatten nested scroll/);
assert.match(
  css,
  /#overlay-content\.screen-options \.opt-scroll \.opt-keys,\s*body\.touch-ui #overlay-content\.screen-options \.opt-scroll \.opt-keys\s*\{[\s\S]*?max-height:\s*none/,
);
assert.match(
  css,
  /#overlay-content\.screen-options \.opt-scroll \.opt-keys[\s\S]*?overflow:\s*visible/,
);

// Prior nested-cap sources still exist for non-scroll contexts / history,
// but the tick128 override must win for keys inside opt-scroll.
assert.match(css, /\.opt-keys\s*\{[\s\S]*?max-height:\s*220px/);
assert.match(css, /body\.touch-ui \.opt-keys\s*\{[\s\S]*?max-height:\s*min\(34dvh,\s*180px\)/);

// Tick127 panel budget / BACK pin retained.
assert.match(css, /TICK127 — OPTIONS i18n panel budget/);
assert.match(
  css,
  /#overlay-content\.screen-options > \.opt-scroll\s*\{[\s\S]*?overflow-y:\s*auto/,
);
assert.match(main, /function syncOptionsPanelBudget/);
assert.match(main, /class="opt-scroll"/);
assert.match(main, /btn-opt-back/);

// Tip / NewUI / autofire / mute pair retained.
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK61 —/);
assert.match(css, /TICK120 — OPTIONS autofire/);
assert.match(css, /TICK121 — OPTIONS mute\/fullscreen/);

// Long locale strings kept (no crush to "fix" dual-scroll).
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('opt.autoFire')].length >= 24, `${loc} opt.autoFire stays long`);
  assert.ok([...t('opt.padNote')].length >= 40, `${loc} opt.padNote stays long`);
  assert.ok([...t('opt.keysHead')].length >= 3, `${loc} opt.keysHead kept`);
}
setLocale('ko');
assert.ok([...t('opt.padNote')].length >= 20, 'ko padNote kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-options-nested-scroll-i18n:',
  'opt-scroll .opt-keys max-height:none + overflow:visible',
  'tick127 BACK pin retained',
  'long en/pt/es/ru strings retained',
  'tick35/61/120–121 + 116–127 frozen',
);
