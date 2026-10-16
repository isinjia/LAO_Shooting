/**
 * Tick37 + Tick63: select dossier NewUI residual — Box2 plate + cyan
 * rim/inset, name dual-stroke, hint Activation cue, select-actions Box2
 * plate; tick63 kit quieter dual-stroke + hint dual-stroke/cyan tip
 * densify (typography only). Retains Text_Deco strip, sortie-head
 * Activation+Deco2, lobby rail/resource, menubg+world2.
 * Combat HUD sparse; pads/HOLD / pause58 / SP60 / tip61 / tip62 untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick37 select-dossier block present.
assert.match(css, /TICK37 — select dossier NewUI residual/);

const tick37Idx = css.indexOf('TICK37 — select dossier NewUI residual');
assert.ok(tick37Idx >= 0, 'TICK37 dossier marker present');
const tick37End = css.indexOf('/* ========== TICK38', tick37Idx);
const tick37 = css.slice(tick37Idx, tick37End > tick37Idx ? tick37End : undefined);
assert.ok(tick37.length > 200, 'TICK37 dossier block present');

// Dossier Box2 plate + cyan rim + inset rail + chamfer.
assert.match(tick37, /\.lao-newui \.select-dossier\s*\{/);
assert.match(tick37, /newui_Popup_Bg_Box2\.png/);
assert.match(tick37, /rgba\(0,\s*232,\s*200,\s*0\.28\)/);
assert.match(tick37, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.45\)/);
assert.match(tick37, /clip-path:\s*polygon\(8px 0/);

// Name dual-stroke + kit readability.
assert.match(tick37, /\.select-dossier-name\s*\{/);
assert.match(tick37, /font-weight:\s*800/);
assert.match(tick37, /0 0 1px #000/);
assert.match(tick37, /\.select-dossier-kit\s*\{/);

// Hint Activation cue.
assert.match(tick37, /\.select-dossier-hint\s*\{/);
assert.match(tick37, /newui_Btn_Activation\.png/);
assert.match(tick37, /rgba\(0,\s*232,\s*200,\s*0\.5\)/);

// select-actions Box2 plate (OPTIONS action parity).
assert.match(tick37, /\.select-actions\s*\{/);
assert.equal(
  (tick37.match(/newui_Popup_Bg_Box2\.png/g) || []).length,
  2,
  'Box2 on dossier plate + select-actions plate',
);

// Retained earlier select NewUI: Text_Deco strip + sortie Activation+Deco2.
assert.match(
  css,
  /\.lao-newui \.select-dossier::before[\s\S]{0,220}?newui_Popup_Bg_Text_Deco\.png/,
);
assert.match(
  css,
  /\.lao-newui \.sortie-head \.brand-mark[\s\S]{0,260}?newui_Btn_Activation\.png[\s\S]{0,180}?newui_Popup_Bg_Title_Deco2\.png/,
);

// screen-select menubg + world2 wash retained.
assert.match(
  css,
  /#overlay-content\.screen-select\s*\{[\s\S]{0,280}?btn_newui_menubg\.png[\s\S]{0,120}?btn_newui_world2\.png/,
);

// Markup: dossier + hint + actions + lobby chips/rail retained.
const selStart = main.indexOf('function showSelect');
assert.ok(selStart >= 0, 'showSelect present');
const selSlice = main.slice(selStart, selStart + 5500);
assert.ok(selSlice.includes('screen-select'), 'screen-select class');
assert.ok(selSlice.includes('select-dossier'), 'select-dossier retained');
assert.ok(selSlice.includes('select-dossier-name'), 'dossier name retained');
assert.ok(selSlice.includes('select-dossier-kit'), 'dossier kit retained');
assert.ok(selSlice.includes('select-dossier-hint'), 'dossier hint retained');
assert.ok(selSlice.includes('select-actions'), 'select-actions retained');
assert.ok(selSlice.includes('lobby-resource-select'), 'resource strip retained');
assert.ok(selSlice.includes('lobby-rail-select'), 'select rail retained');

// Combat HUD sparse — never Top_Bg full fill on hud-top.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// Prior ceremony / menu markers retained; pads/HOLD not churned this tick.
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/TICK37[\s\S]{0,80}tc-caption/.test(css), 'no touch-pad caption churn in TICK37');
assert.ok(!/HOLD dens/.test(tick37) || /untouched/.test(tick37),
  'HOLD dens not churned');

// Tick63 — select dossier kit/hint tip densify (typography only; no plate churn).
// Slice bounded before TICK64 so title lobby tip does not spill.
assert.match(css, /TICK63 — select dossier kit\/hint NewUI tip residual/);
const tick63Idx = css.indexOf('TICK63 — select dossier kit/hint NewUI tip residual');
assert.ok(tick63Idx >= 0, 'TICK63 select kit/hint tip marker present');
const tick63End = css.indexOf('/* ========== TICK64', tick63Idx);
const tick63 = css.slice(tick63Idx, tick63End > tick63Idx ? tick63End : undefined);
assert.ok(tick63.length > 150, 'TICK63 tip block present');
assert.match(css, /TICK64 — title lobby chip\/status NewUI tip residual/);
assert.match(tick63, /\.select-dossier-kit\s*\{/);
assert.match(tick63, /\.select-dossier-hint\s*\{/);
assert.match(tick63, /color:\s*#d8e8e4/);
assert.match(tick63, /color:\s*#e8fff8/);
assert.match(tick63, /0 0 1px #000/);
assert.match(tick63, /0 0 8px rgba\(0,\s*232,\s*200,\s*0\.22\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick63), 'no Box2 plate churn in tip densify');
assert.ok(!/newui_Btn_Activation\.png/.test(tick63), 'no Activation plate churn in tip densify');
assert.ok(!/btn_newui_menubg/.test(tick63), 'no menubg wash churn in tip densify');
assert.ok(!/HOLD dens/.test(tick63) || /untouched/.test(tick63),
  'HOLD dens not churned in tick63');
assert.ok(!/#sp-status|sp-track/.test(tick63) || /untouched|ready-line|SP ready/.test(tick63),
  'SP ready-line not churned');
assert.ok(!/pause-blurb|pause-stamp|pause-chip/.test(tick63) || /untouched|Pause tip/.test(tick63),
  'pause tip58 not churned');
assert.ok(!/opt-block-title|opt-keys-head|keys-hiscore/.test(tick63) || /untouched|tip61|CONTROLS/.test(tick63),
  'OPTIONS/CONTROLS tip61 not churned');
assert.ok(!/result-score|result-meta/.test(tick63) || /untouched|tip62|result lbl/.test(tick63),
  'result lbl tip62 not churned');
assert.ok(!/lobby-chip|lobby-status-mint/.test(tick63) || /untouched|title lobby/.test(tick63),
  'title lobby tip64 not spilled into tick63');

// tip58 / SP60 / OPTIONS·CONTROLS tip61 / result tip62 / title tip64 / tip65 retained.
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(css, /TICK64 — title lobby chip\/status NewUI tip residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(css, /TICK66 — loading status NewUI tip residual/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);

console.log(
  'PASS qa-select-dossier:',
  'Box2 cyan rim/inset',
  'name dual-stroke',
  'hint Activation',
  'select-actions Box2',
  'tick63 kit/hint dual-stroke tip',
  'Text_Deco+sortie brand kept',
  'menubg+world2 kept',
  'lobby rail/chips kept',
  'hud-top sparse',
  'pads/HOLD untouched',
  'pause58/SP60/tip61/tip62/tip64/tip65/tip66 kept',
);
