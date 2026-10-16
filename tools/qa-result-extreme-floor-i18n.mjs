/**
 * Tick139: result extreme-short head reclaim.
 * Root muddy: after tick133 @568×320 real endScreen (3 score + 4 meta)
 * syncSteps=3 flattened Box2 cells while decorative brand (~24px) + tall
 * h2 ate chrome (headroom≈1.3; zh-CN≈−0.8). CTA stayed clear. Reclaim
 * brand + compact h2 before cell flatten (pause/OPTIONS/tutorial parity).
 * CSS belt ≤340 retains @640×360 brand (already clear at step 2).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncResultPanelBudget/);
assert.match(main, /is-result-short/);
assert.match(main, /Tick139/);

const syncSlice = main.match(/function syncResultPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncResultPanelBudget body present');
assert.match(syncSlice, /classList\.remove\('is-result-short'\)/);
assert.match(syncSlice, /classList\.add\('is-result-short'\)/);
assert.match(syncSlice, /brand\.style\.display = 'none'/);
assert.match(syncSlice, /h2\.style\.fontSize = '18px'/);
assert.match(syncSlice, /rawHeadroom/);
assert.match(syncSlice, /appH0 <= 340/);
// Prior tick133 ladder retained after head reclaim.
assert.match(syncSlice, /deco\.style\.display = 'none'/);
assert.match(syncSlice, /marginBottom = '8px'/);
assert.match(syncSlice, /paddingTop = '18px'/);
assert.match(syncSlice, /oc\.style\.maxHeight/);
assert.ok(
  !/HOLD dens|emitRate|opt-scroll|char-grid|softGridWant|is-pause-short/.test(syncSlice),
  'no HOLD dens / options/select/pause soft-grid churn inside result sync',
);

assert.match(css, /TICK139 — result extreme-short head reclaim/);
assert.match(
  css,
  /@media \(max-height:\s*340px\)\s*\{[\s\S]*?\.screen-result > \.brand-mark\s*\{\s*display:\s*none/,
);
assert.match(
  css,
  /\.screen-result\.is-result-short > \.brand-mark\s*\{\s*display:\s*none/,
);
assert.match(
  css,
  /\.screen-result > h2\s*\{\s*font-size:\s*18px !important/,
);

// Tick133 deco belt + tip densify retained.
assert.match(css, /TICK133 — result short-landscape panel floor/);
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(main, /function endScreen/);
assert.match(main, /btn\.retryRun/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN']) {
  setLocale(loc);
  assert.ok([...t('btn.retryRun')].length >= 2, `${loc} btn.retryRun kept`);
  assert.ok([...t('btn.title')].length >= 2, `${loc} btn.title kept`);
}
setLocale('ko');
assert.ok([...t('btn.retryRun')].length >= 2, 'ko retryRun kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-result-extreme-floor-i18n:',
  'is-result-short head reclaim',
  'CSS ≤340 brand hide + h2 compact',
  'tick133 ladder + tip38/62 retained',
);
