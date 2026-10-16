/**
 * Tick135: title extreme-short CONTROLS keys-grid soft floor.
 * Root muddy: @media (max-height:420px) keys 22vh!important + keys-rules
 * display:none crushed grid (~5–14px) while HI stayed inside. Soft floor
 * ≥40 + compact head/rules; tick118–124 / tip40/61/64 / dens / tick116–134
 * frozen.
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
assert.match(main, /Tick135:/);
assert.match(main, /softGridWant/);
assert.match(main, /syncTitleKeysRulesHeight/);

const syncSlice =
  main.match(/function syncTitleKeysPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncTitleKeysPanelBudget body present');
assert.match(syncSlice, /softGridWant\s*=\s*40/);
assert.match(syncSlice, /grid\.clientHeight \+ 0\.5 < softGridWant/);
assert.match(syncSlice, /head\.style\.fontSize = '11px'/);
assert.match(syncSlice, /rules\.style\.maxHeight/);
assert.match(syncSlice, /rules\.style\.minHeight/);
assert.match(syncSlice, /rulesFloor/);
assert.match(syncSlice, /10 \* 2\.8/);
assert.match(syncSlice, /Tick130:/);
assert.match(syncSlice, /Tick124:/);
assert.match(syncSlice, /hiInsideOc/);
assert.match(syncSlice, /parentCap/);
assert.ok(
  !/HOLD dens|emitRate|holdIdentity/.test(syncSlice),
  'no HOLD dens churn inside title keys sync',
);

assert.match(css, /TICK135 — title extreme-short CONTROLS grid floor/);
assert.match(css, /TICK130 — title short-landscape CONTROLS floor/);
assert.match(
  css,
  /@media \(max-height:\s*400px\)\s*\{[\s\S]*?screen-title \.keys-head[\s\S]*?screen-title \.keys-rules[\s\S]*?max-height:\s*2\.8em/,
);

// Legacy crush belt removed (tick135) — assert live rule bodies, not comments.
const short420 =
  css.match(/@media \(max-height:\s*420px\)\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(short420.length > 80, 'short 420 media present');
assert.ok(
  !/#overlay-content\.screen-title \.keys\s*\{[^}]*max-height:\s*min\(22vh/.test(
    short420,
  ),
  '22vh keys hard-cap removed from ≤420 rule body',
);
assert.ok(
  !/#overlay-content\.screen-title \.keys-rules\s*\{[^}]*display:\s*none/.test(
    short420,
  ),
  'keys-rules no longer display:none in ≤420 rule body',
);

assert.match(main, /Tick118: long es\/ru contact\+combo rules/);
assert.match(main, /function syncTitleKeysRulesHeight/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /TICK40 — title lobby NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);

for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok(
    [...t('title.contactRule')].length + [...t('title.comboRule')].length >= 40,
    `${loc} contact+combo kept`,
  );
}
setLocale('es');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length >= 110,
  'es rules stay long',
);
setLocale('ko');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length < 60,
  'ko contact+combo stay compact',
);
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-title-grid-floor-extreme-i18n:',
  'remove 22vh/rules-hide crush',
  'soft grid floor ≥40',
  'tick118-130 + tip40/61 retained',
);
