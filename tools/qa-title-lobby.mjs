/**
 * Tick40 + Tick64: title lobby NewUI residual — menubg+world2 wash, status
 * Box2+cyan rim/inset, chips Box2+rim, rail ico rim densify (icons kept),
 * brand Activation+Deco2, foot dual-stroke; tick64 chip/status dual-stroke
 * tip densify (typography only). No fake lobby apps; START / title-actions
 * untouched; CONTROLS pins kept. Combat HUD sparse; power-badge / result /
 * select tip63 / pads / HOLD / pause58 / SP60 / tip61 / tip62 untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick40 title-lobby block present.
assert.match(css, /TICK40 — title lobby NewUI residual/);

const tick40Idx = css.indexOf('TICK40 — title lobby NewUI residual');
assert.ok(tick40Idx >= 0, 'TICK40 title lobby marker present');
const tick40End = css.indexOf('/* ========== TICK41', tick40Idx);
const tick40 = css.slice(tick40Idx, tick40End > tick40Idx ? tick40End : undefined);
assert.ok(tick40.length > 200, 'TICK40 title lobby block present');

// menubg + world2 layered wash on screen-title.
assert.match(tick40, /#overlay-content\.screen-title/);
assert.match(tick40, /btn_newui_menubg\.png/);
assert.match(tick40, /btn_newui_world2\.png/);
assert.match(tick40, /background-blend-mode:\s*normal,\s*soft-light,\s*overlay/);

// Status Box2 + cyan rim/inset + mint dual-stroke.
assert.match(tick40, /\.lobby-status-bar\s*\{/);
assert.match(tick40, /newui_Popup_Bg_Box2\.png/);
assert.match(tick40, /rgba\(0,\s*232,\s*200,\s*0\.38\)/);
assert.match(tick40, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick40, /\.lobby-status-mint\s*\{/);
assert.match(tick40, /0 0 1px #000/);

// Chips Box2 + rim (gold/mint variants).
assert.match(tick40, /\.lobby-chip\s*\{/);
assert.match(tick40, /\.lobby-chip-gold\s*\{/);
assert.match(tick40, /\.lobby-chip-mint\s*\{/);
assert.ok(
  (tick40.match(/newui_Popup_Bg_Box2\.png/g) || []).length >= 3,
  'Box2 on status + chips + foot',
);

// Rail ico densify — border/shadow only (no bg-image wipe of Lobby_Icon).
assert.match(tick40, /\.lobby-rail-ico\s*\{/);
assert.match(tick40, /rgba\(0,\s*232,\s*200,\s*0\.55\)/);
assert.match(tick40, /\.lobby-rail-ico-brass\s*\{/);
assert.match(tick40, /keep Lobby_Icon PNG|no bg-image override/);
// Rail block must not assign background-image (would hide icons).
const railSlice = tick40.slice(
  tick40.indexOf('.lobby-rail-ico'),
  tick40.indexOf('.title-hero .brand-mark'),
);
assert.ok(!/background-image\s*:/.test(railSlice), 'rail ico keeps Lobby_Icon PNG');

// Brand Activation + Title_Deco2.
assert.match(tick40, /\.title-hero \.brand-mark\s*\{/);
assert.match(tick40, /newui_Btn_Activation\.png/);
assert.match(tick40, /newui_Popup_Bg_Title_Deco2\.png/);

// Foot dual-stroke + Box2 channel.
assert.match(tick40, /\.lobby-foot\s*\{/);
assert.match(tick40, /\.lobby-foot \.lobby-status-mint/);

// No START / title-actions clutter in this tick.
assert.ok(!/\.title-actions/.test(tick40), 'title-actions not churned');
assert.ok(!/\.btn-cta/.test(tick40), 'START btn-cta not cluttered');
assert.ok(!/onclick|pointer-events:\s*auto/.test(tick40), 'no fake lobby apps');

// hud-top sparse reinforced.
assert.match(tick40, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// Title markup: rails/chips/status/foot + START retained; rails decorative.
const titleStart = main.indexOf('function showTitle');
assert.ok(titleStart >= 0, 'showTitle present');
const titleSlice = main.slice(titleStart, titleStart + 5500);
assert.ok(titleSlice.includes('screen-title'), 'screen-title class');
assert.ok(titleSlice.includes('lobby-status-bar'), 'status bar retained');
assert.ok(titleSlice.includes('lobby-rail'), 'lobby rail retained');
assert.ok(titleSlice.includes('lobby-rail-right'), 'right rail retained');
assert.ok(titleSlice.includes('lobby-resource-strip'), 'resource strip retained');
assert.ok(titleSlice.includes('lobby-chip'), 'chips retained');
assert.ok(titleSlice.includes('lobby-foot'), 'foot retained');
assert.ok(titleSlice.includes('btn-start'), 'START retained');
assert.ok(titleSlice.includes('title-actions'), 'title-actions retained');
assert.ok(titleSlice.includes('keys-head'), 'CONTROLS retained');
assert.ok(
  /lobby-rail[\s\S]{0,120}aria-hidden="true"/.test(titleSlice),
  'rails stay decorative aria-hidden',
);
assert.ok(
  !/lobby-rail[\s\S]{0,400}onclick/.test(titleSlice),
  'no fake lobby rail destinations',
);

// Lobby icon PNG classes retained in CSS (not removed).
assert.match(css, /newui_Lobby_Icon_mission\.png/);
assert.match(css, /newui_Lobby_Icon_squad\.png/);

// Prior ceremony / menu markers retained; power-badge / result / pads / HOLD not churned.
assert.match(css, /TICK39 — HUD power-badge NewUI residual/);
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/TICK40[\s\S]{0,80}power-badge/.test(css) || /untouched/.test(tick40),
  'power-badge not churned');
assert.ok(!/TICK40[\s\S]{0,80}screen-result/.test(css) || /untouched/.test(tick40),
  'result not churned');
assert.ok(!/TICK40[\s\S]{0,80}select-dossier/.test(css) || /untouched/.test(tick40),
  'select dossier not churned');
assert.ok(!/TICK40[\s\S]{0,80}tc-caption/.test(css), 'no touch-pad caption churn');
assert.ok(!/HOLD dens/.test(tick40) || /untouched/.test(tick40),
  'HOLD dens not churned');

// Tick64 — title lobby chip/status tip densify (typography only; no plate churn).
// Slice bounded before TICK65 so tutorial note/row tip does not spill.
assert.match(css, /TICK64 — title lobby chip\/status NewUI tip residual/);
const tick64Idx = css.indexOf('TICK64 — title lobby chip/status NewUI tip residual');
assert.ok(tick64Idx >= 0, 'TICK64 title lobby tip marker present');
const tick64End = css.indexOf('/* ========== TICK65', tick64Idx);
const tick64 = css.slice(tick64Idx, tick64End > tick64Idx ? tick64End : undefined);
assert.ok(tick64.length > 150, 'TICK64 tip block present');
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(tick64, /\.lobby-status-mint\s*\{/);
assert.match(tick64, /\.lobby-chip\s*\{/);
assert.match(tick64, /\.lobby-chip-gold\s*\{/);
assert.match(tick64, /\.lobby-chip-mint\s*\{/);
assert.match(tick64, /\.lobby-foot \.lobby-status-mint/);
assert.match(tick64, /color:\s*#e8fff8/);
assert.match(tick64, /color:\s*#fff0c0/);
assert.match(tick64, /0 0 1px #000/);
assert.match(tick64, /0 0 8px rgba\(0,\s*232,\s*200,\s*0\.22\)/);
assert.match(tick64, /0 0 8px rgba\(255,\s*208,\s*112,\s*0\.22\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick64), 'no Box2 plate churn in tip densify');
assert.ok(!/newui_Btn_Activation\.png/.test(tick64), 'no Activation plate churn in tip densify');
assert.ok(!/btn_newui_menubg/.test(tick64), 'no menubg wash churn in tip densify');
assert.ok(!/HOLD dens/.test(tick64) || /untouched/.test(tick64),
  'HOLD dens not churned in tick64');
assert.ok(!/#sp-status|sp-track/.test(tick64) || /untouched|ready-line|SP ready/.test(tick64),
  'SP ready-line not churned');
assert.ok(!/pause-blurb|pause-stamp|pause-chip/.test(tick64) || /untouched|Pause tip/.test(tick64),
  'pause tip58 not churned');
assert.ok(!/opt-block-title|opt-keys-head|keys-hiscore/.test(tick64) || /untouched|tip61|CONTROLS/.test(tick64),
  'OPTIONS/CONTROLS tip61 not churned');
assert.ok(!/result-score|result-meta/.test(tick64) || /untouched|tip62|result lbl/.test(tick64),
  'result lbl tip62 not churned');
assert.ok(!/select-dossier-kit|select-dossier-hint/.test(tick64) || /untouched|tip63|select kit/.test(tick64),
  'select tip63 not churned');
assert.ok(!/tutorial-note|\.tut-row/.test(tick64) || /untouched|tutorial/.test(tick64),
  'tutorial tip65 not spilled into tick64');

// tip58 / SP60 / OPTIONS·CONTROLS tip61 / result tip62 / select tip63 / tip65 retained.
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(css, /TICK63 — select dossier kit\/hint NewUI tip residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(css, /TICK66 — loading status NewUI tip residual/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);

console.log(
  'PASS qa-title-lobby:',
  'menubg+world2',
  'status Box2 cyan rim/inset',
  'chips Box2+rim',
  'rail ico densify icons kept',
  'brand Activation+Deco2',
  'foot dual-stroke',
  'tick64 chip/status dual-stroke tip',
  'START/CONTROLS clear',
  'no fake lobby apps',
  'power-badge/result/pads/HOLD untouched',
  'pause58/SP60/tip61/tip62/tip63/tip65/tip66 kept',
);
