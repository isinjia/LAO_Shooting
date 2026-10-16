/**
 * Tick138: pause extreme-short head reclaim.
 * Root muddy: after tick131 @640×360 es/ru panelOver≈0 / headroom≈0
 * (syncSteps=4 pad shrink) while decorative SYSTEM HOLD brand (~24px) +
 * tall h2 ate chrome. CTA stayed clear. Reclaim brand + compact h2
 * (options/tutorial extreme-short parity) before actions/panel pad.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncPausePanelBudget/);
assert.match(main, /is-pause-short/);
assert.match(main, /Tick138/);

const syncSlice = main.match(/function syncPausePanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncPausePanelBudget body present');
assert.match(syncSlice, /classList\.remove\('is-pause-short'\)/);
assert.match(syncSlice, /classList\.add\('is-pause-short'\)/);
assert.match(syncSlice, /brand\.style\.display = 'none'/);
assert.match(syncSlice, /h2\.style\.fontSize = '18px'/);
// Prior tick131 ladder retained after head reclaim.
assert.match(syncSlice, /actions\.style\.padding = '6px'/);
assert.match(syncSlice, /oc\.style\.paddingTop = '22px'/);
assert.match(syncSlice, /oc\.style\.maxHeight/);
assert.ok(
  !/HOLD dens|emitRate|opt-scroll|char-grid|softGridWant/.test(syncSlice),
  'no HOLD dens / options/select/title soft-grid churn inside pause sync',
);

assert.match(css, /TICK138 — pause extreme-short head reclaim/);
assert.match(
  css,
  /@media \(max-height:\s*400px\)\s*\{[\s\S]*?\.screen-pause \.pause-stamp \.brand-mark\s*\{\s*display:\s*none/,
);
assert.match(
  css,
  /\.screen-pause\.is-pause-short \.pause-stamp \.brand-mark\s*\{\s*display:\s*none/,
);
assert.match(
  css,
  /\.screen-pause \.pause-stamp h2\s*\{\s*font-size:\s*18px !important/,
);

// Tick131 deco belt + tip densify retained.
assert.match(css, /TICK131 — pause short-landscape panel floor/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(main, /function showPauseMenu/);
assert.match(main, /pause\.p/);

for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('btn.unmute')].length >= 4, `${loc} btn.unmute kept`);
  assert.ok([...t('btn.toTitle')].length >= 4, `${loc} btn.toTitle kept`);
  assert.ok([...t('pause.p')].length >= 8, `${loc} pause.p kept`);
}
setLocale('ko');
assert.ok([...t('pause.p')].length >= 6, 'ko pause.p kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-pause-extreme-floor-i18n:',
  'is-pause-short head reclaim',
  'CSS ≤400 brand hide + h2 compact',
  'tick131 ladder + tip31/58 retained',
);
