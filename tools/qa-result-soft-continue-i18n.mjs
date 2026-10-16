/**
 * Tick143: result ultra-short last-resort soft-continue.
 * Root muddy: after tick142 fitH last-resort, @480×288 still hard-returned
 * at the CTA-pad gate when tol over≈1 (≤1.5) while raw headroom≈−2 /
 * panelOverRaw≈2 (maxH=0; CTA clear). Soft-continue when
 * appH≤340 && rawHeadroom<8 so fitH maxCap still funds (pause tick140
 * last-gate parity). tip38/62 / tick133/139/142 / dens frozen.
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
assert.match(main, /Tick143/);

const syncSlice =
  main.match(/function syncResultPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncResultPanelBudget body present');

// Soft-continue on last-resort gate (after CTA pad).
// Tick165 nested the panelOver ladder under softContinue() so CTA chrome
// always runs after — keep soft-continue intent, not the old early-return form.
assert.match(syncSlice, /Tick143/);
assert.match(syncSlice, /rawHeadroom/);
assert.match(syncSlice, /appH0 <= 340/);
assert.match(syncSlice, /softContinue/);
assert.match(
  syncSlice,
  /if \(!\(over <= 1\.5 && !softContinue\(\)\)\) \{[\s\S]*?Step 6 last resort/,
);

// Tick142 fitH last-resort retained.
assert.match(syncSlice, /Tick142/);
assert.match(syncSlice, /Math\.min\(260,\s*fitH\)/);
assert.match(syncSlice, /Math\.floor\(fitH \* 0\.96\)/);

// Prior head reclaim + ladder retained.
assert.match(syncSlice, /is-result-short/);
assert.match(syncSlice, /brand\.style\.display = 'none'/);
assert.match(syncSlice, /h2\.style\.fontSize = '18px'/);
assert.match(syncSlice, /paddingTop = '18px'/);
assert.match(syncSlice, /deco\.style\.display = 'none'/);

assert.ok(
  !/HOLD dens|emitRate|opt-scroll|char-grid|softGridWant|is-pause-short/.test(
    syncSlice,
  ),
  'no HOLD dens / options/select/pause soft-grid churn inside result sync',
);

assert.match(
  css,
  /TICK143 — result ultra-short last-resort soft-continue/,
);
assert.match(css, /TICK142 — ultra-short tutorial\/pause\/result fitH maxCap floor/);
assert.match(css, /TICK139 — result extreme-short head reclaim/);
assert.match(css, /TICK133 — result short-landscape panel floor/);
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN']) {
  setLocale(loc);
  assert.ok([...t('btn.retryRun')].length >= 2, `${loc} btn.retryRun kept`);
  assert.ok([...t('btn.title')].length >= 2, `${loc} btn.title kept`);
}
setLocale('ko');
assert.ok([...t('btn.retryRun')].length >= 2, 'ko retryRun kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-result-soft-continue-i18n:',
  'last-resort soft-continue appH≤340 && rawHeadroom<8',
  'tick142 fitH maxCap retained',
  'tick133/139 + tip38/62 retained',
);
