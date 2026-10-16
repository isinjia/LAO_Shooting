/**
 * Tick119: title CONTROLS `.keys` panel budget — after tick118 rules grow /
 * tall touchHelp, flex must not crush keys-grid to 0 or overflow-hide HI-SCORE.
 * Measure-then-minHeight (+ optional touchHelp clamp). Pins / rules grow / tip61 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

// Measure-then-budget (tick119).
assert.match(main, /Tick119: after rules grow/);
assert.match(main, /function syncTitleKeysPanelBudget/);
assert.match(main, /syncTitleKeysPanelBudget\(\)/);
assert.match(main, /function _blockBudgetH/);
assert.match(main, /keys\.style\.minHeight/);
assert.match(main, /keys\.style\.maxHeight/);
assert.match(main, /cssMax \+ 48/);
assert.match(main, /title-touch-help/);
assert.match(main, /gridLh \* 2\.5/);

// Call order: rules grow first, then panel budget.
const rulesCall = main.indexOf('syncTitleKeysRulesHeight();');
const budgetCall = main.indexOf('syncTitleKeysPanelBudget();');
assert.ok(rulesCall >= 0 && budgetCall > rulesCall, 'budget runs after rules grow');

// Tick118 rules grow retained.
assert.match(main, /function syncTitleKeysRulesHeight/);
assert.match(main, /fs \* 3\.6/);
assert.match(main, /fs \* 6\.6/);

// CONTROLS pins / keys-grid scroll / tip61 / tick32 retained.
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /#overlay-content\.screen-title \.keys-grid/);
assert.match(
  css,
  /#overlay-content\.screen-title \.keys-rules\s*\{[\s\S]*?max-height:\s*3\.6em/,
);
assert.match(main, /keys-head">CONTROLS/);
assert.match(main, /title\.contactRule/);
assert.match(main, /title\.comboRule/);

// Long locales still prove muddy rules (tick118 input) + tall touchHelp.
for (const loc of ['es', 'ru', 'en', 'pt']) {
  setLocale(loc);
  const rulesLen = [...t('title.contactRule')].length + [...t('title.comboRule')].length;
  assert.ok(rulesLen >= 100, `${loc} contact+combo stay long`);
  assert.ok([...t('title.touchHelp')].length >= 100, `${loc} touchHelp stays long`);
}
setLocale('ko');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length < 60,
  'ko contact+combo stay compact',
);

assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-keys-panel-budget-i18n:',
  'measure-then-minHeight keys panel',
  'touchHelp reclaim clamp',
  'grid floor 2.5lh',
  'tick118 rules grow + CONTROLS pins frozen',
);
