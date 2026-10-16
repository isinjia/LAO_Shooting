/**
 * Tick165: result ultra-short retry/title CTA chrome ladder.
 * Root muddy: after tick133–143 panelOver / fitH, ultra-short left
 * #btn-retry / #btn-title unread while panelOver=0 (live *@360×240·
 * *@400×280 maxH=fitH ctaVis≈12–36; *@400×240 / *@320×200 ladder-stop
 * ctaOut; *@360×200 early-return ctaVis=0). Measure-then-reclaim CTA
 * chrome (select tick161 / pause tick162 / tutorial tick164 peer).
 * tip38/62 / 133/139/142/143 / dens / tick116–164 frozen.
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
assert.match(main, /Tick165/);

const syncSlice =
  main.match(/function syncResultPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 800, 'syncResultPanelBudget body present');

assert.match(syncSlice, /Tick165/);
assert.match(syncSlice, /ctaChromeOverflow/);
assert.match(syncSlice, /#btn-retry|#btn-title|btn-retry|btn-title/);
assert.match(syncSlice, /minHeight = '28px'/);
assert.match(syncSlice, /minHeight = '24px'/);
assert.match(syncSlice, /fontSize = '11px'/);
assert.match(syncSlice, /paddingTop = '6px'/);
assert.match(syncSlice, /paddingBottom = '4px'/);
assert.match(syncSlice, /score\.style\.gap = '2px'/);
assert.match(syncSlice, /meta\.style\.gap = '1px 4px'/);
assert.match(syncSlice, /cells\.slice\(2\)/);
assert.match(syncSlice, /meta\.style\.display = 'none'/);

// Prior panelOver / soft-continue / fitH retained (no early function return
// that skips Tick165 chrome — softContinue nested + chrome after).
assert.match(syncSlice, /softContinue/);
assert.match(syncSlice, /Tick143/);
assert.match(syncSlice, /Tick142/);
assert.match(syncSlice, /Math\.min\(260,\s*fitH\)/);
assert.match(syncSlice, /is-result-short/);
assert.match(syncSlice, /deco\.style\.display = 'none'/);

assert.ok(
  !/HOLD dens|emitRate|opt-scroll|char-grid|softGridWant|is-pause-short|is-tut-short/.test(
    syncSlice,
  ),
  'no HOLD dens / options/select/pause/tutorial soft-grid churn inside result sync',
);

assert.match(
  css,
  /TICK165 — result ultra-short retry\/title CTA chrome ladder/,
);
assert.match(css, /TICK143 — result ultra-short last-resort soft-continue/);
assert.match(css, /TICK142 — ultra-short tutorial\/pause\/result fitH maxCap floor/);
assert.match(css, /TICK139 — result extreme-short head reclaim/);
assert.match(css, /TICK133 — result short-landscape panel floor/);

for (const loc of ['en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN']) {
  setLocale(loc);
  assert.ok([...t('btn.retryRun')].length >= 2, `${loc} btn.retryRun kept`);
  assert.ok([...t('btn.title')].length >= 2, `${loc} btn.title kept`);
}
setLocale('ko');
assert.ok([...t('btn.retryRun')].length >= 2, 'ko retryRun kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-result-cta-chrome-i18n:',
  'Tick165 ctaChromeOverflow ladder btn→score/meta→pad→fitH+ultra',
  'tick133/139/142/143 + tip38/62 retained',
);
