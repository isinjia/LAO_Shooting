/**
 * Tick38 + Tick62: result screen NewUI residual — brand Activation+Deco2,
 * score/meta Box2 cells + cyan rim/inset + chamfer, dual-stroke
 * score vals + h2, cleared cyan / gameover rose-cool wash;
 * tick62 result-score/meta .lbl dual-stroke tip densify (typography only).
 * Retains menubg2+world2 / Title_Deco1 / Top_Bg rails / result-deco.
 * Combat HUD sparse; HUD power-badge / title lobby / pads / HOLD untouched.
 * Pause tip58 / SP60 / OPTIONS·CONTROLS tip61 retained.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick38 result-screen block present.
assert.match(css, /TICK38 — result screen NewUI residual/);

const tick38Idx = css.indexOf('TICK38 — result screen NewUI residual');
assert.ok(tick38Idx >= 0, 'TICK38 result marker present');
const tick38End = css.indexOf('/* ========== TICK39', tick38Idx);
const tick38 = css.slice(tick38Idx, tick38End > tick38Idx ? tick38End : undefined);
assert.ok(tick38.length > 200, 'TICK38 result block present');

// menubg2 + world2 layered wash + cleared/gameover variants.
assert.match(tick38, /#overlay-content\.screen-result\s*\{/);
assert.match(tick38, /btn_newui_menubg2\.png/);
assert.match(tick38, /btn_newui_world2\.png/);
assert.match(tick38, /background-blend-mode:\s*normal,\s*soft-light,\s*overlay/);
assert.match(tick38, /\.screen-result\.cleared\s*\{/);
assert.match(tick38, /\.screen-result\.gameover\s*\{/);
assert.match(tick38, /rgba\(16,\s*40,\s*36/);
assert.match(tick38, /rgba\(36,\s*22,\s*26/);

// Brand Activation + Title_Deco2 cue (loading/pause/OPTIONS parity).
assert.match(tick38, /\.brand-mark\s*\{/);
assert.match(tick38, /newui_Btn_Activation\.png/);
assert.match(tick38, /newui_Popup_Bg_Title_Deco2\.png/);
assert.match(tick38, /\.gameover > \.brand-mark/);

// Dual-stroke h2 + score vals.
assert.match(tick38, /> h2\s*\{/);
assert.match(tick38, /font-weight:\s*800/);
assert.match(tick38, /0 0 1px #000/);
assert.match(tick38, /\.result-score \.val/);

// Box2 cells + cyan rim/inset + chamfer.
assert.match(tick38, /\.result-score \.cell,/);
assert.match(tick38, /\.result-meta \.cell/);
assert.match(tick38, /newui_Popup_Bg_Box2\.png/);
assert.match(tick38, /rgba\(0,\s*232,\s*200,\s*0\.22\)/);
assert.match(tick38, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.4\)/);
assert.match(tick38, /clip-path:\s*polygon\(6px 0/);

// Retained earlier result NewUI: Title_Deco1 deco + Top_Bg rails.
assert.match(css, /\.lao-newui \.result-deco/);
assert.match(css, /newui_Popup_Bg_Title_Deco1\.png/);
assert.match(
  css,
  /#overlay-content\.screen-result > \.panel-frame[\s\S]{0,420}?newui_Top_Bg\.png/,
);

// Combat HUD sparse — never Top_Bg full fill on hud-top; power-badge not churned.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.ok(!/TICK38[\s\S]{0,80}power-badge/.test(css) || /untouched/.test(tick38),
  'power-badge not churned in TICK38');

// Result markup retained: brand / score / meta / deco / retry+title.
const endStart = main.indexOf('function endScreen');
assert.ok(endStart >= 0, 'endScreen present');
const endSlice = main.slice(endStart, endStart + 2500);
assert.ok(endSlice.includes('screen-result'), 'screen-result class');
assert.ok(endSlice.includes('brand-mark'), 'brand-mark retained');
assert.ok(endSlice.includes('result-deco'), 'result-deco retained');
assert.ok(endSlice.includes('result-score'), 'result-score retained');
assert.ok(endSlice.includes('result-meta'), 'result-meta retained');
assert.ok(endSlice.includes('btn-retry'), 'retry retained');
assert.ok(endSlice.includes('btn-title'), 'title btn retained');
assert.ok(!/lobby-rail|lobby-status|lobby-resource|lobby-foot/.test(endSlice),
  'result has no fake lobby destinations');

// Prior ceremony / menu markers retained; pads/HOLD / select dossier not churned.
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/TICK38[\s\S]{0,80}tc-caption/.test(css), 'no touch-pad caption churn in TICK38');
assert.ok(!/TICK38[\s\S]{0,80}select-dossier/.test(css) || /untouched/.test(tick38),
  'select dossier not churned');
assert.ok(!/HOLD dens/.test(tick38) || /untouched/.test(tick38),
  'HOLD dens not churned');

// Tick62 — result label tip densify (typography only; no plate/wash churn).
// Slice bounded before TICK63 so select kit/hint tip does not spill.
assert.match(css, /TICK62 — result label NewUI tip residual/);
const tick62Idx = css.indexOf('TICK62 — result label NewUI tip residual');
assert.ok(tick62Idx >= 0, 'TICK62 result label tip marker present');
const tick62End = css.indexOf('/* ========== TICK63', tick62Idx);
const tick62 = css.slice(tick62Idx, tick62End > tick62Idx ? tick62End : undefined);
assert.ok(tick62.length > 150, 'TICK62 tip block present');
assert.match(css, /TICK63 — select dossier kit\/hint NewUI tip residual/);
assert.match(tick62, /\.result-score \.lbl\s*\{/);
assert.match(tick62, /\.result-meta \.lbl\s*\{/);
assert.match(tick62, /color:\s*#e8fff8/);
assert.match(tick62, /color:\s*#d8e8e4/);
assert.match(tick62, /0 0 1px #000/);
assert.match(tick62, /0 0 8px rgba\(0,\s*232,\s*200,\s*0\.22\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick62), 'no Box2 plate churn in tip densify');
assert.ok(!/btn_newui_menubg/.test(tick62), 'no menubg wash churn in tip densify');
assert.ok(!/HOLD dens/.test(tick62) || /untouched/.test(tick62),
  'HOLD dens not churned in tick62');
assert.ok(!/#sp-status|sp-track/.test(tick62) || /untouched|ready-line|SP ready/.test(tick62),
  'SP ready-line not churned');
assert.ok(!/pause-blurb|pause-stamp|pause-chip/.test(tick62) || /untouched|Pause tip/.test(tick62),
  'pause tip58 not churned');
assert.ok(!/opt-block-title|opt-keys-head|keys-hiscore/.test(tick62) || /untouched|tip61|CONTROLS/.test(tick62),
  'OPTIONS/CONTROLS tip61 not churned');

// tip58 / SP60 / OPTIONS·CONTROLS tip61 / select tip63 / title tip64 / tip65 retained.
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /TICK63 — select dossier kit\/hint NewUI tip residual/);
assert.match(css, /TICK64 — title lobby chip\/status NewUI tip residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(css, /TICK66 — loading status NewUI tip residual/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);

console.log(
  'PASS qa-result-screen:',
  'menubg2+world2',
  'cleared/gameover wash',
  'brand Activation+Deco2',
  'Box2 cells cyan rim',
  'dual-stroke vals+h2',
  'tick62 lbl dual-stroke tip',
  'Title_Deco1+Top_Bg kept',
  'hud-top sparse',
  'no fake lobby',
  'pads/HOLD untouched',
  'pause58/SP60/tip61/tip63/tip64/tip65/tip66 kept',
);
