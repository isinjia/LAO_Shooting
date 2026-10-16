/**
 * Tick32 + Tick61: title CONTROLS NewUI leftover — opaque pin plates for
 * CONTROLS head + HI-SCORE (no scroll bleed/overlap), chamfer safe-zone,
 * scroll only .keys-grid; tick61 keys-head + HI-SCORE dual-stroke tip.
 * Pause NewUI retained; HOLD dens / OPTIONS plates / SP ready-line untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick32 CONTROLS block present (bounded before TICK34 so EOF tip spill is avoided).
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);

const tick32Idx = css.indexOf('TICK32 — title CONTROLS NewUI leftover');
assert.ok(tick32Idx >= 0, 'TICK32 CONTROLS marker present');
const tick32End = css.indexOf('/* ========== TICK34', tick32Idx);
const tick32 = css.slice(tick32Idx, tick32End > tick32Idx ? tick32End : undefined);
assert.ok(tick32.length > 200, 'TICK32 CONTROLS block present');

// Opaque pin plates + isolation on .keys.
assert.match(tick32, /\.keys\s*\{/);
assert.match(tick32, /isolation:\s*isolate/);
assert.match(tick32, /\.keys-head\s*\{/);
assert.match(tick32, /rgba\(36,\s*40,\s*48,\s*0\.99\)/);
assert.match(tick32, /newui_Popup_Bg_Text_Deco\.png/);
assert.match(tick32, /\.keys-hiscore\s*\{/);
assert.match(tick32, /rgba\(14,\s*18,\s*24,\s*0\.99\)/);
assert.match(tick32, /padding:\s*6px 10px 4px 4px/);

// Scroll only keys-grid (z-index under pins).
assert.match(tick32, /\.keys-grid\s*\{/);
assert.match(tick32, /overflow-y:\s*auto/);
assert.match(tick32, /z-index:\s*0/);
assert.match(tick32, /z-index:\s*2/);

// Chamfer safe-zone comment + short-viewport retention.
assert.match(tick32, /chamfer/);
assert.match(tick32, /max-height:\s*420px/);

// Pre-existing title flex: scroll only .keys-grid comment retained.
assert.match(css, /Scroll only \.keys-grid/);
assert.match(css, /#overlay-content\.screen-title \.keys-grid/);

// Box2 chamfer on CONTROLS panel retained (earlier NewUI).
assert.match(
  css,
  /\.lao-newui #overlay-content\.screen-title \.keys[\s\S]{0,280}?newui_Popup_Bg_Box2\.png/,
);
assert.match(
  css,
  /\.lao-newui #overlay-content\.screen-title \.keys[\s\S]{0,400}?clip-path:\s*polygon\(8px 0/,
);

// Title markup: CONTROLS head + keys-grid + HI-SCORE present.
assert.match(main, /class="keys-head">CONTROLS/);
assert.match(main, /class="keys-grid"/);
assert.match(main, /class="keys-hiscore".*HI-SCORE/);

// Tick61 — CONTROLS keys-head + HI-SCORE dual-stroke tip densify.
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
const tick61Idx = css.indexOf('TICK61 — OPTIONS / CONTROLS label NewUI tip residual');
assert.ok(tick61Idx >= 0, 'TICK61 tip marker present');
// Slice bounded before TICK62 so result label tip does not spill.
const tick61End = css.indexOf('/* ========== TICK62', tick61Idx);
const tick61 = css.slice(tick61Idx, tick61End > tick61Idx ? tick61End : undefined);
assert.ok(tick61.length > 200, 'TICK61 tip block present');
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(tick61, /#overlay-content\.screen-title \.keys-head/);
assert.match(tick61, /#overlay-content\.screen-title \.keys-hiscore/);
assert.match(tick61, /color:\s*#e8fff8/);
assert.match(tick61, /color:\s*#d8e8e4/);
assert.match(tick61, /0 0 1px #000/);
assert.match(tick61, /0 0 8px rgba\(0,\s*232,\s*200,\s*0\.22\)/);
assert.ok(!/overflow-y:\s*auto/.test(tick61), 'keys-grid scroll wiring not churned');
assert.ok(!/isolation:\s*isolate/.test(tick61), 'opaque pin isolation not churned');
assert.ok(!/HOLD dens/.test(tick61) || /untouched/.test(tick61),
  'HOLD dens not churned');

// Pause NewUI from tick31 + tip58 / SP60 retained (not reverted).
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /btn_newui_menubg\.png/);
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

console.log(
  'PASS qa-controls-newui:',
  'opaque head+HI-SCORE pins',
  'chamfer safe-zone',
  'keys-grid scroll only',
  'Box2 chamfer retained',
  'tick61 keys-head/HI dual-stroke tip',
  'pause NewUI + tip58/SP60 kept',
  'hud-top sparse',
);
