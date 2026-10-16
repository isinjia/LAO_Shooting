/**
 * Tick131: pause panel stays inside #app on short landscapes after long
 * unmute / toTitle wrap. syncPausePanelBudget reclaim ladder + CSS ≤480
 * pause-deco belt. tip31/58 / dens / tick116–130 frozen.
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
assert.match(main, /Tick131:/);
assert.match(main, /syncPausePanelBudget\(\)/);
assert.match(main, /screen === 'pause'\) syncPausePanelBudget/);
assert.match(main, /pause-deco/);
assert.match(main, /deco\.style\.display = 'none'/);
assert.match(main, /oc\.style\.maxHeight/);

// showPauseMenu wires sync + rAF (tutorial/options pattern).
const pauseSlice = main.match(/function showPauseMenu\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(pauseSlice.length > 200, 'showPauseMenu body present');
assert.match(pauseSlice, /syncPausePanelBudget\(\)/);
assert.match(pauseSlice, /requestAnimationFrame\(\(\) => syncPausePanelBudget\(\)\)/);

// CSS belt at ≤480 for decorative deco (JS ladder is source of truth).
assert.match(css, /TICK131 — pause short-landscape panel floor/);
assert.match(
  css,
  /@media \(max-height:\s*480px\)\s*\{\s*\.lao-newui #overlay-content\.screen-pause \.pause-deco\s*\{\s*display:\s*none/,
);

// Prior pause NewUI / tip densify retained.
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(main, /function showPauseMenu/);
assert.match(main, /pause\.p/);
assert.match(main, /btn\.unmute/);

// Muddy input: long unmute / toTitle / pause blurb locales stay long.
for (const loc of ['en', 'pt', 'es', 'ru']) {
  setLocale(loc);
  assert.ok([...t('btn.unmute')].length >= 4, `${loc} btn.unmute kept (${[...t('btn.unmute')].length})`);
  assert.ok([...t('btn.toTitle')].length >= 4, `${loc} btn.toTitle kept`);
  assert.ok([...t('pause.p')].length >= 8, `${loc} pause.p kept`);
}
setLocale('ko');
assert.ok([...t('btn.unmute')].length >= 2, 'ko unmute kept');
assert.ok([...t('pause.p')].length >= 6, 'ko pause.p kept');
assert.equal(LOCALES.length, 8, '8 locales retained');

// No dens / CONTROLS churn inside pause sync.
const syncSlice = main.match(/function syncPausePanelBudget\([\s\S]*?\n\}/)?.[0] || '';
assert.ok(syncSlice.length > 200, 'syncPausePanelBudget body present');
assert.ok(
  !/HOLD dens|emitRate|gridFull|fullNeed|opt-scroll|char-grid/.test(syncSlice),
  'no HOLD dens / options/select churn inside pause sync',
);

// Prior short-height panel budgets retained.
assert.match(main, /function syncTitleKeysPanelBudget/);
assert.match(main, /function syncOptionsPanelBudget/);
assert.match(main, /function syncTutorialPanelBudget/);
assert.match(main, /function syncSelectPanelBudget/);
assert.match(css, /TICK130 — title short-landscape CONTROLS floor/);

console.log(
  'PASS qa-pause-panel-i18n:',
  'syncPausePanelBudget reclaim ladder',
  'CSS ≤480 pause-deco belt',
  'long unmute/toTitle/pause.p retained',
  'tip31/58 + tick116–130 frozen',
);
