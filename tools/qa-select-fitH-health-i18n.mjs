/**
 * Tick144: select ultra-short CTA-health fitH clamp.
 * Root muddy: after tick141 fitH floor, syncSelectPanelBudget CTA-health
 * still used Math.max(260, …) and re-inflated maxH to 260 while fitH≈225
 * @400×280 (live panelOver≈17.5 / headroom≈−17.5 / maxHFitsApp=false).
 * Clamp shave to fitH / floorCap (tick141/142 parity). tip63 /
 * tick126/129/134/141 / dens frozen.
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
assert.match(main, /Tick144/);

const syncSlice =
  main.match(/function syncSelectPanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 400, 'syncSelectPanelBudget body present');

// Tick144 fitH-aware CTA-health shave (no legacy 260 re-inflate).
assert.match(syncSlice, /Tick144/);
assert.match(
  syncSlice,
  /Math\.max\(floorCap,\s*Math\.min\(fitH,\s*Math\.floor\(maxCap - over - 4\)\)\)/,
);
assert.ok(
  !/Math\.max\(260,\s*Math\.floor\(maxCap - over - 4\)\)/.test(syncSlice),
  'legacy Math.max(260, …) CTA-health inflate removed from select sync',
);

// Tick141 fitH floor retained.
assert.match(syncSlice, /Tick141/);
assert.match(syncSlice, /Math\.min\(320,\s*fitH\)/);
assert.match(syncSlice, /Math\.floor\(fitH \* 0\.92\)/);

// Prior select ladder retained (tick129 comment is lowercase in body).
assert.match(syncSlice, /Tick134/);
assert.match(syncSlice, /tick129/);
assert.match(syncSlice, /softFloorWant/);
assert.match(syncSlice, /dossier\.style\.padding/);
assert.match(syncSlice, /hint\.style\.display = 'none'/);
assert.match(main, /Tick129:/);

assert.ok(
  !/HOLD dens|emitRate|softGridWant|is-pause-short|is-result-short/.test(
    syncSlice,
  ),
  'no HOLD dens / tutorial/pause/result soft-grid churn inside select sync',
);

assert.match(
  css,
  /TICK144 — select ultra-short CTA-health fitH clamp/,
);
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
  const charge = kitText('merlin', 'charge') || '';
  assert.ok([...charge].length >= 18, `${loc} merlin charge stays long`);
}
setLocale('ko');
assert.ok([...t('select.blurb')].length >= 8, 'ko select.blurb kept');
assert.ok([...t('btn.sortie')].length >= 2, 'ko btn.sortie kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-select-fitH-health-i18n:',
  'CTA-health clamp fitH/floorCap @ultra-short',
  'tick141 fitH floor + tick129/134 ladder retained',
);
