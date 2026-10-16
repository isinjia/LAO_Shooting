/**
 * Tick35 + Tick61: OPTIONS NewUI residual —
 * menubg2+world2 wash, brand Activation+Deco2 cue, Box2 plates on
 * opt-block / opt-keys / opt-actions; tick61 label tip densify
 * (opt-block-title / opt-keys-head dual-stroke, brand tip, h2 dual-stroke).
 * Retains Title_Deco under head + Top_Bg rails + lobby chips.
 * Combat HUD sparse; touch-pad captions / HOLD dens / pause tip58 /
 * SP ready-line tick60 untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick35 OPTIONS block present.
assert.match(css, /TICK35 — OPTIONS NewUI residual/);

const tick35Idx = css.indexOf('TICK35 — OPTIONS NewUI residual');
assert.ok(tick35Idx >= 0, 'TICK35 OPTIONS marker present');
const tick35End = css.indexOf('/* ========== TICK36', tick35Idx);
const tick35 = css.slice(tick35Idx, tick35End > tick35Idx ? tick35End : undefined);
assert.ok(tick35.length > 200, 'TICK35 OPTIONS block present');

// menubg2 + world2 layered wash on screen-options.
assert.match(tick35, /#overlay-content\.screen-options\s*\{/);
assert.match(tick35, /btn_newui_menubg2\.png/);
assert.match(tick35, /btn_newui_world2\.png/);
assert.match(tick35, /background-blend-mode:\s*normal,\s*soft-light,\s*overlay/);

// Brand Activation + Title_Deco2 cue (pause-stamp parity).
assert.match(tick35, /\.opt-head \.brand-mark/);
assert.match(tick35, /newui_Btn_Activation\.png/);
assert.match(tick35, /newui_Popup_Bg_Title_Deco2\.png/);

// Box2 plates on opt-block + opt-keys + opt-actions (chamfer clip).
assert.match(tick35, /\.opt-block,/);
assert.match(tick35, /\.opt-keys\s*\{/);
assert.match(tick35, /\.opt-actions\s*\{/);
assert.equal(
  (tick35.match(/newui_Popup_Bg_Box2\.png/g) || []).length,
  2,
  'Box2 on block/keys plate + actions plate',
);
assert.match(tick35, /\.opt-block,\s*\n\.lao-newui #overlay-content\.screen-options \.opt-keys/);
assert.match(tick35, /clip-path:\s*polygon\(8px 0/);
assert.match(tick35, /rgba\(0,\s*232,\s*200,\s*0\.2\)/);

// Retained earlier OPTIONS NewUI: Title_Deco under head + Top_Bg rails.
assert.match(
  css,
  /#overlay-content\.screen-options \.opt-head::after[\s\S]{0,200}?newui_Popup_Bg_Title_Deco\.png/,
);
assert.match(
  css,
  /#overlay-content\.screen-options > \.panel-frame[\s\S]{0,180}?newui_Top_Bg\.png/,
);

// Combat HUD sparse — never Top_Bg full fill on hud-top.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// OPTIONS markup retained: head/block/keys/actions + lobby chips; no rails.
const optStart = main.indexOf('function showOptions(');
assert.ok(optStart >= 0, 'showOptions present');
// Tick127 wraps SYSTEM+keys in `.opt-scroll` + panel budget sync — keep a
// wide enough window to still see `screen-options` / lobby chips / actions.
const optEnd = main.indexOf('\nfunction beginRebind(', optStart);
const optSlice = main.slice(
  optStart,
  optEnd > optStart ? optEnd : optStart + 9000,
);
assert.ok(optSlice.includes('screen-options'), 'screen-options class');
assert.ok(optSlice.includes('opt-head'), 'opt-head retained');
assert.ok(optSlice.includes('opt-block'), 'opt-block retained');
assert.ok(optSlice.includes('opt-block-title'), 'opt-block-title retained');
assert.ok(optSlice.includes('opt-keys'), 'opt-keys retained');
assert.ok(optSlice.includes('opt-keys-head'), 'opt-keys-head retained');
assert.ok(optSlice.includes('opt-actions'), 'opt-actions retained');
assert.ok(optSlice.includes('opt-scroll'), 'opt-scroll body retained (tick127)');
assert.ok(optSlice.includes('lobby-status-options'), 'status chip strip retained');
assert.ok(optSlice.includes('lobby-resource-options'), 'resource chip strip retained');
assert.ok(!/lobby-rail/.test(optSlice), 'options has no fake lobby rail');

// Tick61 — OPTIONS label tip densify (typography only; no plate churn).
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
const tick61Idx = css.indexOf('TICK61 — OPTIONS / CONTROLS label NewUI tip residual');
assert.ok(tick61Idx >= 0, 'TICK61 OPTIONS/CONTROLS tip marker present');
// Slice bounded before TICK62 so result label tip does not spill.
const tick61End = css.indexOf('/* ========== TICK62', tick61Idx);
const tick61 = css.slice(tick61Idx, tick61End > tick61Idx ? tick61End : undefined);
assert.ok(tick61.length > 200, 'TICK61 tip block present');
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(tick61, /\.opt-head \.brand-mark/);
assert.match(tick61, /border-color:\s*rgba\(0,\s*232,\s*200,\s*0\.45\)/);
assert.match(tick61, /\.opt-head h2/);
assert.match(tick61, /color:\s*#f4fffc/);
assert.match(tick61, /\.opt-block-title,/);
assert.match(tick61, /\.opt-keys-head/);
assert.match(tick61, /color:\s*#e8fff8/);
assert.match(tick61, /0 0 1px #000/);
assert.match(tick61, /0 0 8px rgba\(0,\s*232,\s*200,\s*0\.22\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick61), 'no Box2 plate churn in tip densify');
assert.ok(!/btn_newui_menubg/.test(tick61), 'no menubg wash churn in tip densify');
assert.ok(!/HOLD dens/.test(tick61) || /untouched/.test(tick61),
  'HOLD dens not churned in tick61');
assert.ok(!/#sp-status|sp-track/.test(tick61) || /untouched|ready-line/.test(tick61),
  'SP ready-line not churned');
assert.ok(!/pause-blurb|pause-stamp|pause-chip/.test(tick61) || /untouched|Pause tip/.test(tick61),
  'pause tip58 not churned');

// Prior ceremony / pause / CONTROLS / loading / tip markers retained.
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);

// Touch-pad caption clarity + HOLD dens left untouched this tick.
assert.ok(!/TICK35[\s\S]{0,80}tc-caption/.test(css), 'no touch-pad caption churn in TICK35');
assert.ok(!/HOLD dens/.test(tick35) || /untouched|left for/.test(tick35),
  'HOLD dens not churned');

console.log(
  'PASS qa-options-newui:',
  'menubg2+world2',
  'brand Activation+Deco2',
  'Box2 block/keys+actions',
  'tick61 label dual-stroke tip',
  'brand tip + h2 dual-stroke',
  'Title_Deco+Top_Bg retained',
  'lobby chips kept',
  'hud-top sparse',
  'no fake lobby rail',
  'pads/HOLD/pause58/SP60 untouched',
);
