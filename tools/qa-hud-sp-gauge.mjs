/**
 * Tick46 + Tick60: SP gauge NewUI residual — SPECIAL track Box2 + cyan
 * rim/inset/chamfer + Tap1, Lv segment notches, dual-stroke label + Lv chip,
 * ready / is-ready-flash brass Activation cue; tick60 #sp-status ready-line
 * dual-stroke + brass cue (max-height hide/show wiring kept).
 * Keep hud-top sparse; stocks / CHARGE / boss / power / HOLD dens untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

// Tick46 SP gauge block present.
assert.match(css, /TICK46 — SP gauge NewUI residual/);

const tick46Idx = css.indexOf('TICK46 — SP gauge NewUI residual');
assert.ok(tick46Idx >= 0, 'TICK46 SP gauge marker present');
const tick46End = css.indexOf('/* ========== TICK47', tick46Idx);
const tick46 = css.slice(tick46Idx, tick46End > tick46Idx ? tick46End : undefined);
assert.ok(tick46.length > 200, 'TICK46 SP gauge block present');

// SP track Box2 + cyan rim / inset / chamfer + Lv segment notches.
assert.match(tick46, /\.lao-newui #sp-track\s*\{/);
assert.match(tick46, /newui_Popup_Bg_Box2\.png/);
assert.match(tick46, /rgba\(0,\s*232,\s*200,\s*0\.55\)/);
assert.match(tick46, /inset 2px 0 0 rgba\(0,\s*232,\s*200,\s*0\.36\)/);
assert.match(tick46, /clip-path:\s*polygon\(3px 0/);
assert.match(tick46, /transparent 32\.5%/);
assert.match(tick46, /transparent 66%/);

// Tap1 end cue kept on ::after (segments live in background stack).
assert.match(tick46, /#sp-track::after/);
assert.match(tick46, /newui_Btn_Tap1\.png/);

// Brass fill + dual-stroke SPECIAL label + Lv chip.
assert.match(tick46, /\.lao-newui #sp-fill\s*\{/);
assert.match(tick46, /var\(--brass-hot\)/);
assert.match(tick46, /#sp-row \.sp-label/);
assert.match(tick46, /0 0 1px #000/);
assert.match(tick46, /font-weight:\s*800/);
assert.match(tick46, /\.lao-newui #sp-pct\s*\{/);

// ready / is-ready-flash brass Activation rim cue.
assert.match(tick46, /#sp-track\.ready/);
assert.match(tick46, /#sp-track\.is-ready-flash/);
assert.match(tick46, /rgba\(255,\s*210,\s*120/);
assert.match(tick46, /animation:\s*life-critical-pulse/);
assert.match(tick46, /#sp-track\.ready #sp-fill/);

// Combat HUD sparse — no Top_Bg on hud-top / this tick.
assert.match(tick46, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.ok(!/newui_Top_Bg\.png/.test(tick46), 'no Top_Bg on SP gauge tick');

// Markup + wiring retained.
assert.match(html, /id="sp-row"/);
assert.match(html, /id="sp-track"/);
assert.match(html, /id="sp-fill"/);
assert.match(html, /id="sp-pct"/);
assert.match(html, /id="sp-status"/);
assert.match(game, /is-ready-flash/);
assert.match(game, /spReady/);
assert.match(css, /#sp-row:has\(#sp-track\.ready\) \+ #sp-status/);

// max-height hide/show wiring frozen (reveal only when ready / flash).
assert.match(css, /#sp-status\s*\{[\s\S]*?max-height:\s*0/);
assert.match(
  css,
  /#sp-row:has\(#sp-track\.ready\) \+ #sp-status,[\s\S]*?#sp-row:has\(#sp-track\.is-ready-flash\) \+ #sp-status\s*\{[\s\S]*?max-height:\s*1\.4em/,
);

// Tick60 — ready-line dual-stroke + brass cue (typography only; no plate churn).
// Slice bounded before TICK61 so OPTIONS/CONTROLS label tip does not spill.
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
const tick60Idx = css.indexOf('TICK60 — SP status ready-line NewUI tip residual');
assert.ok(tick60Idx >= 0, 'TICK60 SP status marker present');
const tick60End = css.indexOf('/* ========== TICK61', tick60Idx);
const tick60 = css.slice(tick60Idx, tick60End > tick60Idx ? tick60End : undefined);
assert.ok(tick60.length > 120, 'TICK60 SP status block present');
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(tick60, /\.lao-newui #sp-row:has\(#sp-track\.ready\) \+ #sp-status/);
assert.match(tick60, /\.lao-newui #sp-row:has\(#sp-track\.is-ready-flash\) \+ #sp-status/);
assert.match(tick60, /color:\s*#ffe08a/);
assert.match(tick60, /color:\s*#fff4c8/);
assert.match(tick60, /0 0 1px #000/);
assert.match(tick60, /0 0 8px rgba\(255,\s*200,\s*90/);
assert.match(tick60, /max-height hide\/show/);
assert.ok(!/newui_Top_Bg\.png/.test(tick60), 'no Top_Bg on SP status tick');
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick60), 'no Box2 plate churn on ready-line');
assert.ok(!/HOLD dens/.test(tick60) || /untouched/.test(tick60),
  'HOLD dens not churned in tick60');
assert.ok(!/#sp-track\s*\{/.test(tick60), 'SP track block not churned in tick60');

// Prior markers retained; stocks / CHARGE / boss / power / HOLD not churned.
assert.match(css, /TICK45 — HUD LIFE\/BOMB\/CHARGE cluster NewUI residual/);
assert.match(css, /TICK44 — boss HP bar NewUI residual/);
assert.match(css, /TICK39 — HUD power-badge NewUI residual/);
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.ok(!/HOLD dens/.test(tick46) || /untouched/.test(tick46),
  'HOLD dens not churned');
assert.ok(!/hud-stocks|lives-pips|bombs-pips/.test(tick46) || /untouched/.test(tick46),
  'stocks not churned');
assert.ok(!/#charge-track/.test(tick46) || /untouched/.test(tick46),
  'CHARGE not churned');
assert.ok(!/boss-frame|boss-hp-track|boss-tag/.test(tick46) || /untouched/.test(tick46),
  'boss HP not churned');
assert.ok(!/\.power-badge/.test(tick46) || /untouched/.test(tick46),
  'power-badge not churned');

console.log(
  'PASS qa-hud-sp-gauge:',
  'SP Box2 cyan rim/inset/chamfer',
  'Lv notches + Tap1',
  'dual-stroke label/Lv chip',
  'ready/is-ready-flash kept',
  'tick60 ready-line dual-stroke/brass',
  'max-height wiring frozen',
  'hud-top sparse',
  'stocks/CHARGE/boss/power/HOLD untouched',
);
