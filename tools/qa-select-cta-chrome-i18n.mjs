/**
 * Tick161: select ultra-short CTA chrome ladder.
 * After tick144 fitH CTA-health, ru/pt/es@400×240·280 still HARD ctaOut/
 * backOut with panelOver=0 / maxH=fitH — actions wrap under .btn-cta
 * min-width:180. Measure-then-reclaim: actions compact → brand → h2 → pad.
 * tip63 / tick126/129/134/141/144 / dens frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, kitText, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /function syncSelectPanelBudget/);
assert.match(main, /Tick161/);

const start = main.indexOf('function syncSelectPanelBudget');
const next = main.indexOf('\nfunction ', start + 1);
const syncSlice = main.slice(start, next > start ? next : start + 8000);
assert.ok(syncSlice.length > 800, 'syncSelectPanelBudget body present');

// Tick161 chrome ladder present.
assert.match(syncSlice, /Tick161/);
assert.match(syncSlice, /is-select-short/);
assert.match(syncSlice, /btn-cta/);
assert.match(syncSlice, /minWidth = '0'/);
assert.match(syncSlice, /actions\.style\.gap = '4px'/);
assert.match(syncSlice, /brand\.style\.display = 'none'/);
assert.match(syncSlice, /fontSize = '16px'/);
assert.match(syncSlice, /paddingTop = '8px'/);

// Prior select fitH / floor / reclaim retained.
assert.match(syncSlice, /Tick144/);
assert.match(syncSlice, /Tick141/);
assert.match(syncSlice, /Tick134/);
assert.match(syncSlice, /Math\.min\(320,\s*fitH\)/);
assert.match(
  syncSlice,
  /Math\.max\(floorCap,\s*Math\.min\(fitH,\s*Math\.floor\(maxCap - over - 4\)\)\)/,
);
assert.ok(
  !/Math\.max\(260,\s*Math\.floor\(maxCap - over - 4\)\)/.test(syncSlice),
  'legacy Math.max(260) inflate stays removed',
);

// No dens / HOLD churn inside sync body.
assert.ok(
  !/HOLD dens|emitRate|HOLD_STYLE/.test(syncSlice),
  'no HOLD dens churn inside select sync',
);

assert.match(
  css,
  /TICK161 — select ultra-short CTA chrome ladder/,
);
assert.match(
  css,
  /\.screen-select\.is-select-short .sortie-head .brand-mark/,
);
assert.match(css, /TICK144 — select ultra-short CTA-health fitH clamp/);
assert.match(css, /TICK141 — SE-class select\/OPTIONS maxCap floor/);
assert.match(css, /TICK134 — select extreme-short grid floor/);
assert.match(css, /TICK129 — select short-landscape head reclaim/);
assert.match(css, /TICK126 — select i18n panel budget/);
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK63 — select/);

for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('select.blurb')].length >= 12, `${loc} select.blurb kept`);
  assert.ok([...t('btn.sortie')].length >= 4, `${loc} btn.sortie kept`);
  assert.ok([...t('btn.back')].length >= 2, `${loc} btn.back kept`);
  assert.ok([...t('btn.options')].length >= 2, `${loc} btn.options kept`);
  const charge = kitText('merlin', 'charge') || '';
  assert.ok([...charge].length >= 18, `${loc} merlin charge stays long`);
}
setLocale('ko');
assert.ok([...t('select.blurb')].length >= 8, 'ko select.blurb kept');
assert.ok([...t('btn.sortie')].length >= 2, 'ko btn.sortie kept');
assert.ok([...t('btn.back')].length >= 2, 'ko btn.back kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log('qa-select-cta-chrome-i18n: PASS');
