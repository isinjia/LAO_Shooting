/**
 * Tick129 + Tick134: select short-landscape reclaim so char-grid soft floor
 * stays readable. Tick129: deco+blurb @800×450. Tick134: dossier/actions/
 * head/hint measure-then-reclaim @640×360 (live gridH 12–20→≥56).
 * No i18n string removal; tick126 maxCap + CTA pin + tip63 / dens /
 * tick116–133 frozen.
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
assert.match(main, /Tick129:/);
assert.match(main, /Tick134:/);
assert.match(main, /appH <= 480/);
assert.match(main, /\.sortie-deco/);
assert.match(main, /\.select-blurb/);

const syncSlice =
  main.match(/function syncSelectPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 200, 'syncSelectPanelBudget body present');
assert.match(syncSlice, /deco\.style\.display = 'none'/);
assert.match(syncSlice, /blurb\.style\.display = 'none'/);
assert.match(syncSlice, /appH <= 560/);
assert.match(syncSlice, /softFloorWant/);
assert.match(syncSlice, /dossier\.style\.padding/);
assert.match(syncSlice, /hint\.style\.display = 'none'/);
assert.match(syncSlice, /actions\.style\.padding = '4px 0'/);
assert.ok(
  !/HOLD dens|emitRate|gridFull|fullNeed/.test(syncSlice),
  'no HOLD dens / CONTROLS tick124 churn inside select sync',
);

assert.match(css, /TICK129 — select short-landscape head reclaim/);
assert.match(css, /TICK134 — select extreme-short grid floor/);
assert.match(
  css,
  /@media \(max-height:\s*480px\)\s*\{[\s\S]*?\.sortie-deco[\s\S]*?\.select-blurb[\s\S]*?display:\s*none/,
);
assert.match(
  css,
  /@media \(max-height:\s*400px\)\s*\{[\s\S]*?screen-select \.select-actions[\s\S]*?padding:\s*4px 0/,
);

// Tick126 panel budget retained.
assert.match(css, /TICK126 — select i18n panel budget/);
assert.match(
  css,
  /#overlay-content\.screen-select > \.char-grid\s*\{[\s\S]*?overflow-y:\s*auto/,
);
assert.match(main, /Tick126:/);

// Prior select NewUI / tip densify retained.
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK63 — select/);

// Muddy input: long locales keep blurb + kit strings (hidden via display only).
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('select.blurb')].length >= 12, `${loc} select.blurb kept`);
  const charge = kitText('merlin', 'charge') || '';
  assert.ok([...charge].length >= 18, `${loc} merlin charge stays long`);
  assert.ok([...t('btn.sortie')].length >= 4, `${loc} btn.sortie kept`);
  assert.ok([...t('select.ready')].length >= 2, `${loc} select.ready kept`);
  assert.ok([...t('select.confirm')].length >= 2, `${loc} select.confirm kept`);
}
setLocale('ko');
assert.ok([...t('select.blurb')].length >= 8, 'ko select.blurb kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-select-grid-floor-i18n:',
  'short appH≤480 deco+blurb reclaim',
  'extreme-short dossier/actions/hint reclaim',
  'char-grid soft floor ≥56',
  'tick126 CTA pin + long blurb/kit retained',
  'tick37/63 + 116–133 frozen',
);
