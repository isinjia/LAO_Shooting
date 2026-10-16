/**
 * Tick41 + Tick65: tutorial NewUI residual — brand Activation+Deco2, tut-row
 * Box2+cyan rim/inset densify, tut-pill Activation rim, tutorial-note
 * Box2 plate, pause-actions Box2 plate, h2 dual-stroke; tick65 note/row
 * quieter dual-stroke tip densify (typography only). Retains
 * menubg+world2, Title_Deco1, Top_Bg rails. Combat HUD sparse;
 * title lobby tip64 / power-badge / result tip62 / select tip63 / pads /
 * HOLD / pause58 / SP60 / tip61 / rotate untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick41 tutorial block present.
assert.match(css, /TICK41 — tutorial NewUI residual/);

const tick41Idx = css.indexOf('TICK41 — tutorial NewUI residual');
assert.ok(tick41Idx >= 0, 'TICK41 tutorial marker present');
const tick41End = css.indexOf('/* ========== TICK42', tick41Idx);
const tick41 = css.slice(tick41Idx, tick41End > tick41Idx ? tick41End : undefined);
assert.ok(tick41.length > 200, 'TICK41 tutorial block present');

// menubg + world2 layered wash retained/reinforced on screen-tutorial.
assert.match(tick41, /#overlay-content\.screen-tutorial\s*\{/);
assert.match(tick41, /btn_newui_menubg\.png/);
assert.match(tick41, /btn_newui_world2\.png/);
assert.match(tick41, /background-blend-mode:\s*normal,\s*soft-light,\s*overlay/);

// Brand Activation + Title_Deco2 cue (OPTIONS/pause parity).
assert.match(tick41, /\.opt-head \.brand-mark/);
assert.match(tick41, /newui_Btn_Activation\.png/);
assert.match(tick41, /newui_Popup_Bg_Title_Deco2\.png/);

// h2 dual-stroke.
assert.match(tick41, /\.opt-head h2\s*\{/);
assert.match(tick41, /0 0 1px #000/);
assert.match(tick41, /font-weight:\s*800/);

// tut-row Box2 + cyan rim/inset densify.
assert.match(tick41, /\.tut-row\s*\{/);
assert.match(tick41, /newui_Popup_Bg_Box2\.png/);
assert.match(tick41, /rgba\(0,\s*232,\s*200,\s*0\.24\)/);
assert.match(tick41, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick41, /clip-path:\s*polygon\(6px 0/);

// tut-pill Activation rim reinforce.
assert.match(tick41, /\.tut-pill\s*\{/);
assert.match(tick41, /newui_Btn_Activation\.png/);
assert.match(tick41, /rgba\(0,\s*232,\s*200,\s*0\.55\)/);

// kbd cyan rim (keyboard briefing path).
assert.match(tick41, /\.tut-row kbd\s*\{/);
assert.match(tick41, /rgba\(0,\s*232,\s*200,\s*0\.45\)/);

// tutorial-note Box2 plate + pause-actions Box2 plate.
assert.match(tick41, /\.tutorial-note\s*\{/);
assert.match(tick41, /\.pause-actions\s*\{/);
assert.ok(
  (tick41.match(/newui_Popup_Bg_Box2\.png/g) || []).length >= 3,
  'Box2 on tut-row + note + actions',
);

// Retained earlier tutorial NewUI: Title_Deco1 strip + Top_Bg rails.
assert.match(
  css,
  /\.lao-newui \.tutorial-deco[\s\S]{0,220}?newui_Popup_Bg_Title_Deco1\.png/,
);
assert.match(
  css,
  /#overlay-content\.screen-tutorial > \.panel-frame[\s\S]{0,180}?newui_Top_Bg\.png/,
);

// Combat HUD sparse — never Top_Bg full fill on hud-top.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// Markup: briefing structure + sortie CTA retained; no fake lobby rails.
const tutStart = main.indexOf('function showTutorialThen');
assert.ok(tutStart >= 0, 'showTutorialThen present');
const tutSlice = main.slice(tutStart, tutStart + 2500);
assert.ok(tutSlice.includes('screen-tutorial'), 'screen-tutorial class');
assert.ok(tutSlice.includes('opt-head'), 'opt-head retained');
assert.ok(tutSlice.includes('brand-mark'), 'brand-mark retained');
assert.ok(tutSlice.includes('tutorial-deco'), 'tutorial-deco retained');
assert.ok(tutSlice.includes('tutorial-grid'), 'tutorial-grid retained');
assert.ok(tutSlice.includes('tut-row'), 'tut-row retained');
assert.ok(tutSlice.includes('tut-pill'), 'tut-pill retained');
assert.ok(tutSlice.includes('tutorial-note'), 'tutorial-note retained');
assert.ok(tutSlice.includes('pause-actions'), 'pause-actions retained');
assert.ok(tutSlice.includes('btn-tut-go'), 'sortie CTA retained');
assert.ok(tutSlice.includes('btn-tut-skip'), 'skip retained');
assert.ok(!/lobby-rail/.test(tutSlice), 'tutorial has no fake lobby rail');

// Prior ceremony / menu markers retained; title lobby / rotate / pads / HOLD not churned.
assert.match(css, /TICK40 — title lobby NewUI residual/);
assert.match(css, /TICK39 — HUD power-badge NewUI residual/);
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/TICK41[\s\S]{0,80}lobby-status-bar/.test(css) || /untouched/.test(tick41),
  'title lobby not churned');
assert.ok(!/TICK41[\s\S]{0,80}power-badge/.test(css) || /untouched/.test(tick41),
  'power-badge not churned');
assert.ok(!/TICK41[\s\S]{0,80}rotate-hint|rotate-card/.test(css) || /untouched/.test(tick41),
  'rotate overlay not churned');
assert.ok(!/TICK41[\s\S]{0,80}tc-caption/.test(css), 'no touch-pad caption churn');
assert.ok(!/HOLD dens/.test(tick41) || /untouched/.test(tick41),
  'HOLD dens not churned');

// Tick65 — tutorial note/row tip densify (typography only; no plate churn).
// Slice bounded before TICK66 so loading status tip does not spill.
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
const tick65Idx = css.indexOf('TICK65 — tutorial note/row NewUI tip residual');
assert.ok(tick65Idx >= 0, 'TICK65 tutorial tip marker present');
const tick65End = css.indexOf('/* ========== TICK66', tick65Idx);
const tick65 = css.slice(tick65Idx, tick65End > tick65Idx ? tick65End : undefined);
assert.ok(tick65.length > 120, 'TICK65 tip block present');
assert.match(css, /TICK66 — loading status NewUI tip residual/);
assert.match(tick65, /\.tut-row\s*\{/);
assert.match(tick65, /\.tutorial-note\s*\{/);
assert.match(tick65, /color:\s*#d8e8e4/);
assert.match(tick65, /0 0 1px #000/);
assert.match(tick65, /0 1px 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick65, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.4\)/);
assert.match(tick65, /-1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.4\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick65), 'no Box2 plate churn in tip densify');
assert.ok(!/newui_Btn_Activation\.png/.test(tick65), 'no Activation plate churn in tip densify');
assert.ok(!/btn_newui_menubg/.test(tick65), 'no menubg wash churn in tip densify');
assert.ok(!/HOLD dens/.test(tick65) || /untouched/.test(tick65),
  'HOLD dens not churned in tick65');
assert.ok(!/#sp-status|sp-track/.test(tick65) || /untouched|ready-line|SP ready/.test(tick65),
  'SP ready-line not churned');
assert.ok(!/pause-blurb|pause-stamp|pause-chip/.test(tick65) || /untouched|Pause tip/.test(tick65),
  'pause tip58 not churned');
assert.ok(!/opt-block-title|opt-keys-head|keys-hiscore/.test(tick65) || /untouched|tip61|CONTROLS/.test(tick65),
  'OPTIONS/CONTROLS tip61 not churned');
assert.ok(!/result-score|result-meta/.test(tick65) || /untouched|tip62|result lbl/.test(tick65),
  'result lbl tip62 not churned');
assert.ok(!/select-dossier-kit|select-dossier-hint/.test(tick65) || /untouched|tip63|select kit/.test(tick65),
  'select tip63 not churned');
assert.ok(!/lobby-chip|lobby-status-mint/.test(tick65) || /untouched|title lobby|tip64/.test(tick65),
  'title lobby tip64 not churned');
assert.ok(!/#loading-label|load-pct/.test(tick65) || /untouched|loading/.test(tick65),
  'loading tip66 not spilled into tick65');

// tip58 / SP60 / OPTIONS·CONTROLS tip61 / result tip62 / select tip63 / title tip64 / tip66 retained.
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(css, /TICK63 — select dossier kit\/hint NewUI tip residual/);
assert.match(css, /TICK64 — title lobby chip\/status NewUI tip residual/);
assert.match(css, /TICK66 — loading status NewUI tip residual/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);

console.log(
  'PASS qa-tutorial-newui:',
  'menubg+world2',
  'brand Activation+Deco2',
  'h2 dual-stroke',
  'tut-row Box2 cyan rim/inset',
  'tut-pill Activation',
  'note+actions Box2',
  'tick65 note/row quieter dual-stroke tip',
  'Title_Deco1+Top_Bg kept',
  'hud-top sparse',
  'no fake lobby rail',
  'title/pads/HOLD/rotate untouched',
  'pause58/SP60/tip61/tip62/tip63/tip64/tip66 kept',
);
