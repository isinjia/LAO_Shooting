/**
 * Tick123: title CONTROLS HI-SCORE stays inside overflow:hidden `.keys` after
 * tick118 rules grow + tick122 keys-grid minHeight. maxCap must cover
 * pinned+gridFloor (not only cssMax+48) so es compact no longer clips HI.
 * Strings / pins / rules grow / grid floor / tip61 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncTitleKeysPanelBudget/);
assert.match(main, /Tick123:/);
assert.match(main, /floorNeed/);
// Tick123 floorNeed retained; tick124 also folds fullNeed into maxCap (≤268).
assert.match(
  main,
  /maxCap\s*=\s*Math\.min\(\s*268\s*,\s*Math\.max\(\s*cssMax\s*\+\s*48\s*,\s*floorNeed\s*,\s*fullNeed\s*\)\s*\)/,
);
assert.match(main, /floorNeed/);
// Tick130 parent-aware: floorNeed still gates health; may be min()'d with effectiveCap.
assert.match(
  main,
  /keys\.clientHeight \+ 1 >= (?:floorNeed|Math\.min\(floorNeed)/,
);
assert.match(
  main,
  /(?:const target = Math\.min\(maxCap, Math\.max\(need, floorNeed\)\)|effectiveCap >= floorNeed)/,
);

// Prior ticks retained.
assert.match(main, /Tick122:/);
assert.match(main, /grid\.style\.minHeight/);
assert.match(main, /function syncTitleKeysRulesHeight/);
assert.match(main, /cssMax \+ 48/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(main, /keys-hiscore/);

// Muddy input: es contact+combo stay the long rules-grow case.
setLocale('es');
const esRules = [...t('title.contactRule')].length + [...t('title.comboRule')].length;
assert.ok(esRules >= 110, `es rules stay long (${esRules})`);
for (const loc of ['en', 'pt', 'ru']) {
  setLocale(loc);
  const n = [...t('title.contactRule')].length + [...t('title.comboRule')].length;
  assert.ok(n >= 90, `${loc} rules stay non-trivial (${n})`);
}
setLocale('ko');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length < 60,
  'ko rules stay compact',
);

assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-keys-hi-floor-i18n:',
  'maxCap≥floorNeed',
  'HI pin fit after rules+gridFloor',
  'es long rules kept',
  'tick118/119/122 frozen',
);
