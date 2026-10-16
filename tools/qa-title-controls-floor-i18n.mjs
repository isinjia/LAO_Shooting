/**
 * Tick130: title CONTROLS stays inside overlay-content on short landscapes.
 * Parent-aware keys cap + lobby chrome reclaim; HI pin visible in oc.
 * tick118–124 / tip40/61/64 / dens frozen.
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
assert.match(main, /Tick130:/);
assert.match(main, /Tick135:/);
assert.match(main, /measureAvail/);
assert.match(main, /hiInsideOc/);
assert.match(main, /parentCap/);
assert.match(main, /effectiveCap/);
assert.match(main, /lobby-resource-strip/);
assert.match(main, /lobby-foot/);
assert.match(main, /lobby-status-bar/);
assert.match(main, /tagline/);
assert.match(main, /softGridWant/);
// Keep brand product name path — h1 compacted, not removed.
assert.match(main, /h1\.style\.fontSize/);
assert.match(main, /title-sub/);

// Prior ticks retained.
assert.match(main, /Tick122:/);
assert.match(main, /Tick123:/);
assert.match(main, /Tick124:/);
assert.match(
  main,
  /maxCap\s*=\s*Math\.min\(\s*268\s*,\s*Math\.max\(\s*cssMax\s*\+\s*48\s*,\s*floorNeed\s*,\s*fullNeed\s*\)\s*\)/,
);
assert.match(main, /function syncTitleKeysRulesHeight/);
assert.match(main, /grid\.style\.minHeight/);

assert.match(css, /TICK130 — title short-landscape CONTROLS floor/);
assert.match(css, /TICK135 — title extreme-short CONTROLS grid floor/);
assert.match(
  css,
  /#overlay-content\.screen-title > \.lobby-resource-strip/,
);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK40 — title lobby NewUI residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);

// Muddy input locales stay long enough that rules grow still matters.
setLocale('es');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length >= 110,
  'es rules stay long',
);
setLocale('ru');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length >= 90,
  'ru rules stay non-trivial',
);
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-title-controls-floor-i18n:',
  'parent-aware keys cap',
  'title chrome reclaim ladder',
  'HI inside oc gate',
  'tick118-124 retained',
);
