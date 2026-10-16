/**
 * Tick136: OPTIONS extreme-short `.opt-scroll` soft floor.
 * Root muddy: after tick127–128 @640×360 scrollH≈100–109 (< softScrollWant
 * 140) — SYSTEM + language only; BGM clipped. Head brand + Title_Deco
 * ::after reclaimed; h2 i18n / BACK / tip35/61 / tick120–121 / 127–128 /
 * dens / tick116–135 frozen.
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
assert.match(main, /Tick136:/);
assert.match(main, /softScrollWant/);
assert.match(main, /is-opt-short/);

const syncSlice =
  main.match(/function syncOptionsPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncOptionsPanelBudget body present');
assert.match(syncSlice, /softScrollWant\s*=\s*140/);
assert.match(syncSlice, /scroll\.clientHeight \+ 0\.5 < softScrollWant/);
assert.match(syncSlice, /classList\.add\('is-opt-short'\)/);
assert.match(syncSlice, /brand\.style\.display = 'none'/);
assert.match(syncSlice, /h2\.style\.fontSize = '18px'/);
assert.match(syncSlice, /Tick136:/);
assert.match(main, /Tick127:/);
assert.match(main, /function syncOptionsPanelBudget/);
assert.match(css, /TICK127 — OPTIONS i18n panel budget/);
assert.ok(
  !/HOLD dens|emitRate|holdIdentity/.test(syncSlice),
  'no HOLD dens churn inside options sync',
);

assert.match(css, /TICK136 — OPTIONS extreme-short scroll floor/);
assert.match(
  css,
  /@media \(max-height:\s*400px\)\s*\{[\s\S]*?screen-options \.opt-head::after[\s\S]*?display:\s*none/,
);
assert.match(
  css,
  /\.screen-options\.is-opt-short \.opt-head::after\s*\{\s*display:\s*none/,
);
assert.match(
  css,
  /@media \(max-height:\s*400px\)\s*\{[\s\S]*?screen-options \.opt-head \.brand-mark[\s\S]*?display:\s*none/,
);

// Prior OPTIONS ships retained.
assert.match(css, /TICK127 — OPTIONS i18n panel budget/);
assert.match(css, /TICK128 — OPTIONS flatten nested scroll/);
assert.match(css, /TICK120 — OPTIONS autofire/);
assert.match(css, /TICK121 — OPTIONS mute\/fullscreen/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK61 —/);
assert.match(main, /opt-autofire/);
assert.match(main, /btn-opt-back/);

for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('opt.h2')].length >= 3, `${loc} opt.h2 kept`);
  assert.ok([...t('opt.back')].length >= 3, `${loc} opt.back kept`);
  assert.ok([...t('opt.autoFire')].length >= 24, `${loc} autofire stays long`);
  assert.ok([...t('opt.padNote')].length >= 40, `${loc} padNote stays long`);
}
setLocale('ko');
assert.ok([...t('opt.h2')].length >= 2, 'ko opt.h2 kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-options-scroll-floor-i18n:',
  'softScrollWant 140 + is-opt-short head reclaim',
  'h2/BACK/autofire/padNote retained',
  'tick127–128/120–121/35/61 frozen',
);
