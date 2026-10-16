/**
 * Tick140: pause SE-class soft-continue.
 * Root muddy: after tick138 CSS ≤400 brand/h2 belt, @568×320 ko/en/pt/zh-TW
 * sat at panelOver≈0.83 (under +1.5) / raw headroom≈−1.8 with syncSteps=0
 * early return (CTA clear). Soft-continue when appH≤340 && rawHeadroom<8
 * (result tick139 parity) so actions/panel pad still fund breathing room.
 * tip31/58 / tick131 / tick138 / dens / tick116–139 frozen.
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
assert.match(main, /Tick140/);
assert.match(main, /is-pause-short/);

const syncSlice = main.match(/function syncPausePanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncPausePanelBudget body present');
assert.match(syncSlice, /rawHeadroom/);
assert.match(syncSlice, /appH0 <= 340/);
assert.match(syncSlice, /rawHeadroom\(\) < 8/);
assert.match(syncSlice, /classList\.add\('is-pause-short'\)/);
assert.match(syncSlice, /actions\.style\.padding = '6px'/);
assert.match(syncSlice, /oc\.style\.paddingTop = '22px'/);
assert.match(syncSlice, /oc\.style\.maxHeight/);
// Tick138 head reclaim retained inside soft ladder.
assert.match(syncSlice, /Tick138/);
assert.ok(
  !/HOLD dens|emitRate|opt-scroll|char-grid|softGridWant|is-result-short/.test(syncSlice),
  'no HOLD dens / options/select/result soft-grid churn inside pause sync',
);

assert.match(css, /TICK140 — pause SE-class soft-continue/);
assert.match(css, /TICK138 — pause extreme-short head reclaim/);
assert.match(
  css,
  /@media \(max-height:\s*400px\)\s*\{[\s\S]*?\.screen-pause \.pause-stamp \.brand-mark\s*\{\s*display:\s*none/,
);
assert.match(css, /TICK131 — pause short-landscape panel floor/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(main, /function showPauseMenu/);
assert.match(main, /pause\.p/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN']) {
  setLocale(loc);
  assert.ok([...t('btn.unmute')].length >= 2, `${loc} btn.unmute kept`);
  assert.ok([...t('btn.toTitle')].length >= 2, `${loc} btn.toTitle kept`);
  assert.ok([...t('pause.p')].length >= 4, `${loc} pause.p kept`);
}
setLocale('ko');
assert.ok([...t('pause.p')].length >= 4, 'ko pause.p kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-pause-extreme-soft-i18n:',
  'SE-class soft-continue rawHeadroom<8 @≤340',
  'tick138 head reclaim + tick131 ladder retained',
);
