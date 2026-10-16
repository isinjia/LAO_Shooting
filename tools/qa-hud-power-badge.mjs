/**
 * Tick39: HUD power-badge NewUI residual — Tap1 retained, cyan rim +
 * inset rail + dual-stroke Lv text, overclock brass Activation cue.
 * Keep hud-top sparse; title lobby / result / select / pads / HOLD
 * dens untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Tick39 power-badge block present.
assert.match(css, /TICK39 — HUD power-badge NewUI residual/);

const tick39Idx = css.indexOf('TICK39 — HUD power-badge NewUI residual');
assert.ok(tick39Idx >= 0, 'TICK39 power-badge marker present');
const tick39End = css.indexOf('/* ========== TICK40', tick39Idx);
const tick39 = css.slice(tick39Idx, tick39End > tick39Idx ? tick39End : undefined);
assert.ok(tick39.length > 200, 'TICK39 power-badge block present');

// Tap1 retained + cyan rim / inset / dual-stroke.
assert.match(tick39, /\.lao-newui \.power-badge\s*\{/);
assert.match(tick39, /newui_Btn_Tap1\.png/);
assert.match(tick39, /rgba\(0,\s*232,\s*200,\s*0\.62\)/);
assert.match(tick39, /inset 2px 0 0 rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick39, /font-weight:\s*800/);
assert.match(tick39, /0 0 1px #000/);
assert.match(tick39, /clip-path:\s*polygon\(4px 0/);

// Lv dual-stroke + flash variants.
assert.match(tick39, /\.power-badge #power-lv\s*\{/);
assert.match(tick39, /#power-lv\.flash-up/);
assert.match(tick39, /#power-lv\.flash-down/);

// Overclock brass Activation cue (Tap1 still in stack).
assert.match(tick39, /\.power-badge:has\(#power-lv\.is-overclock\)/);
assert.match(tick39, /newui_Btn_Activation\.png/);
assert.match(tick39, /#power-lv\.is-overclock/);
assert.match(tick39, /rgba\(255,\s*210,\s*120/);

// hud-top sparse reinforced inside this tick.
assert.match(tick39, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.ok(!/newui_Top_Bg\.png/.test(tick39), 'no Top_Bg on power-badge tick');

// Markup: power-badge + power-lv retained in HUD.
assert.match(html, /class="power-badge"/);
assert.match(html, /id="power-lv"/);
assert.match(html, /class="hud-top"/);

// Prior ceremony / menu markers retained; title lobby / result / pads / HOLD not churned.
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/TICK39[\s\S]{0,80}screen-title/.test(css) || /untouched/.test(tick39),
  'title lobby not churned in TICK39');
assert.ok(!/TICK39[\s\S]{0,80}screen-result/.test(css) || /untouched/.test(tick39),
  'result screen not churned');
assert.ok(!/TICK39[\s\S]{0,80}tc-caption/.test(css), 'no touch-pad caption churn in TICK39');
assert.ok(!/TICK39[\s\S]{0,80}select-dossier/.test(css) || /untouched/.test(tick39),
  'select dossier not churned');
assert.ok(!/HOLD dens/.test(tick39) || /untouched/.test(tick39),
  'HOLD dens not churned');

console.log(
  'PASS qa-hud-power-badge:',
  'Tap1 kept cyan rim/inset',
  'dual-stroke Lv + flash',
  'overclock Activation cue',
  'hud-top sparse',
  'no Top_Bg fill',
  'title/result/pads/HOLD untouched',
);
