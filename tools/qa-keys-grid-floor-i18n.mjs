/**
 * Tick122: title CONTROLS keys-grid floor must treat unitless line-height:1.55
 * as a multiplier (not 1.55px). Otherwise es/pt tick118 rules grow early-returns
 * "healthy" while keys-grid crushes to ~7–15px.
 * Strings kept; tick118 rules grow / tick119 budget / CONTROLS pins frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

// Tick122 unitless line-height → px floor.
assert.match(main, /Tick122: keys-grid uses unitless line-height/);
assert.match(main, /lhRaw === 'normal'/);
assert.match(main, /!lhRaw\.endsWith\('px'\)/);
assert.match(main, /gridFs \* mult/);
assert.match(main, /grid\.style\.minHeight = `\$\{(?:gridTarget|gridFinal|g)\}px`/);
assert.match(main, /gridFloor/);
assert.match(main, /Require floorNeed|Compare against maxCap|floorNeed|gridBudget|effectiveCap/);

// Tick119 budget + tick118 rules grow retained.
assert.match(main, /function syncTitleKeysPanelBudget/);
assert.match(main, /function syncTitleKeysRulesHeight/);
assert.match(main, /cssMax \+ 48/);
assert.match(main, /gridLh \* 2\.5/);
assert.match(main, /fs \* 3\.6/);
assert.match(main, /fs \* 6\.6/);

// CSS still declares unitless 1.55 (the muddy parse input).
assert.match(
  css,
  /#overlay-content\.screen-title \.keys-grid\s*\{[\s\S]*?line-height:\s*1\.55/,
);

// CONTROLS pins / tip61 / tick32 retained.
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(main, /keys-head">CONTROLS/);

// Long locales still prove muddy rules that expose the floor bug.
for (const loc of ['es', 'pt', 'en', 'ru']) {
  setLocale(loc);
  const rulesLen = [...t('title.contactRule')].length + [...t('title.comboRule')].length;
  assert.ok(rulesLen >= 100, `${loc} contact+combo stay long (${rulesLen})`);
}
setLocale('ko');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length < 60,
  'ko contact+combo stay compact',
);

assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-keys-grid-floor-i18n:',
  'unitless lh→px floor',
  'grid minHeight protect',
  'maxCap health check',
  'tick118/119 + CONTROLS pins frozen',
);
