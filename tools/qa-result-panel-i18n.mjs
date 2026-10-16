/**
 * Tick133: result panel stays inside #app on extreme short landscapes.
 * syncResultPanelBudget reclaim ladder + CSS ≤480 result-deco belt.
 * tip38/62 / dens / tick116–132 frozen. CTA strings retained.
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
assert.match(main, /Tick133:/);
assert.match(main, /syncResultPanelBudget\(\)/);
assert.match(main, /screen === 'result'\) syncResultPanelBudget/);
assert.match(main, /result-deco/);
assert.match(main, /result-score/);
assert.match(main, /result-meta/);
assert.match(main, /oc\.style\.maxHeight/);

// endScreen wires sync + rAF (pause/tutorial pattern).
const endSlice = main.match(/function endScreen\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(endSlice.length > 200, 'endScreen body present');
assert.match(endSlice, /syncResultPanelBudget\(\)/);
assert.match(endSlice, /requestAnimationFrame\(\(\) => syncResultPanelBudget\(\)\)/);
assert.match(endSlice, /btn\.retryRun/);
assert.match(endSlice, /btn\.title/);
assert.match(endSlice, /result-deco/);
assert.match(endSlice, /result-score/);
assert.match(endSlice, /result-meta/);

// showOverlay / hideOverlay clear pad + maxHeight (tick127 hygiene + tick133).
assert.match(main, /content\.style\.paddingTop = ''/);
assert.match(main, /content\.style\.paddingBottom = ''/);

// CSS belt at ≤480 for decorative deco (JS ladder is source of truth).
assert.match(css, /TICK133 — result short-landscape panel floor/);
assert.match(
  css,
  /@media \(max-height:\s*480px\)\s*\{\s*\.lao-newui #overlay-content\.screen-result \.result-deco\s*\{\s*display:\s*none/,
);

// Prior result NewUI / tip densify retained.
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);

// Muddy input: retry/title CTA strings stay present across locales.
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('btn.retryRun')].length >= 4, `${loc} btn.retryRun kept`);
  assert.ok([...t('btn.title')].length >= 2, `${loc} btn.title kept`);
}
setLocale('ko');
assert.ok([...t('btn.retryRun')].length >= 2, 'ko retryRun kept');
assert.ok([...t('btn.title')].length >= 1, 'ko title kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

// No dens / CONTROLS churn inside result sync.
const syncSlice = main.match(/function syncResultPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncResultPanelBudget body present');
assert.ok(
  !/HOLD dens|emitRate|gridFull|fullNeed|opt-scroll|char-grid|tutorial-grid/.test(syncSlice),
  'no HOLD dens / options/select/tutorial churn inside result sync',
);
assert.match(syncSlice, /marginBottom = '8px'/);
assert.match(syncSlice, /paddingTop = '18px'/);
assert.match(syncSlice, /deco\.style\.display = 'none'/);

// Prior short-height panel budgets retained.
assert.match(main, /function syncPausePanelBudget/);
assert.match(main, /function syncTutorialPanelBudget/);
assert.match(main, /function syncTitleKeysPanelBudget/);
assert.match(main, /function syncOptionsPanelBudget/);
assert.match(main, /function syncSelectPanelBudget/);
assert.match(css, /TICK132 — tutorial short-landscape grid floor/);
assert.match(css, /TICK131 — pause short-landscape panel floor/);

console.log(
  'PASS qa-result-panel-i18n:',
  'syncResultPanelBudget reclaim ladder',
  'CSS ≤480 result-deco belt',
  'retry/title CTA strings retained',
  'tip38/62 + tick116–132 frozen',
);
