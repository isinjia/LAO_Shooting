/**
 * Tick34 + Tick66: loading bar NewUI residual — brand Activation cue,
 * track cyan rim + chamfer + Tap1 end cue, load-meta Box2 plate;
 * tick66 loading status tip densify (typography only). Retains
 * menubg2+world2 / Title_Deco1 / Top_Bg rails / Box2 track.
 * Combat HUD sparse; no fake lobby; OPTIONS / pads / HOLD /
 * tip58–65 untouched; tip67 rotate/asset-error body tip retained.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick34 loading-bar block present.
assert.match(css, /TICK34 — loading bar NewUI residual/);

const tick34Idx = css.indexOf('TICK34 — loading bar NewUI residual');
assert.ok(tick34Idx >= 0, 'TICK34 loading marker present');
const tick34End = css.indexOf('/* ========== TICK35', tick34Idx);
const tick34 = css.slice(tick34Idx, tick34End > tick34Idx ? tick34End : undefined);
assert.ok(tick34.length > 200, 'TICK34 loading block present');

// Brand Activation + Title_Deco2 cue (pause-stamp parity).
assert.match(tick34, /\.brand-mark\s*\{/);
assert.match(tick34, /newui_Btn_Activation\.png/);
assert.match(tick34, /newui_Popup_Bg_Title_Deco2\.png/);

// Track: cyan rim + chamfer + Box2 + Tap1 end cue.
assert.match(tick34, /\.load-track\s*\{/);
assert.match(tick34, /rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick34, /clip-path:\s*polygon\(4px 0/);
assert.match(tick34, /newui_Popup_Bg_Box2\.png/);
assert.match(tick34, /\.load-track::after/);
assert.match(tick34, /newui_Btn_Tap1\.png/);

// Fill stays solid/readable (z-index under Tap1 cue).
assert.match(tick34, /\.load-fill\s*\{/);
assert.match(tick34, /z-index:\s*1/);

// Meta Box2 plate + chamfer.
assert.match(tick34, /\.load-meta\s*\{/);
assert.equal(
  (tick34.match(/newui_Popup_Bg_Box2\.png/g) || []).length,
  2,
  'Box2 on track + meta',
);
assert.match(tick34, /clip-path:\s*polygon\(6px 0/);

// Retained earlier loading NewUI: menubg2+world2 wash, deco, Top_Bg rails.
assert.match(css, /#overlay-content\.screen-loading/);
assert.match(css, /btn_newui_menubg2\.png/);
assert.match(css, /btn_newui_world2\.png/);
assert.match(css, /\.lao-newui \.loading-deco\s*\{/);
assert.match(css, /newui_Popup_Bg_Title_Deco1\.png/);
assert.match(
  css,
  /#overlay-content\.screen-loading > \.panel-frame[\s\S]{0,180}?newui_Top_Bg\.png/,
);

// Combat HUD sparse — never Top_Bg full fill on hud-top.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// Loading markup retained: track + fill + meta; no fake lobby destinations.
const loadFn = main.match(/function showLoading\(\)[\s\S]*?\n\}/)?.[0] || '';
assert.ok(loadFn.includes('screen-loading'), 'showLoading present');
assert.ok(loadFn.includes('load-track'), 'load-track retained');
assert.ok(loadFn.includes('load-fill'), 'load-fill retained');
assert.ok(loadFn.includes('load-meta'), 'load-meta retained');
assert.ok(loadFn.includes('loading-deco'), 'loading-deco retained');
assert.ok(loadFn.includes('loading-label'), 'loading-label retained');
assert.ok(loadFn.includes('load-pct'), 'load-pct retained');
assert.ok(!/lobby-rail|lobby-status|lobby-resource|lobby-foot/.test(loadFn),
  'loading has no fake lobby destinations');

// Prior ceremony / pause / CONTROLS markers retained (not reverted).
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);

// Tick66 — loading status tip densify (typography only; no plate churn).
// Slice bounded before TICK67 so rotate/asset-error tip does not spill.
assert.match(css, /TICK66 — loading status NewUI tip residual/);
const tick66Idx = css.indexOf('TICK66 — loading status NewUI tip residual');
assert.ok(tick66Idx >= 0, 'TICK66 loading tip marker present');
const tick66End = css.indexOf('/* ========== TICK67', tick66Idx);
const tick66 = css.slice(tick66Idx, tick66End > tick66Idx ? tick66End : undefined);
assert.ok(tick66.length > 150, 'TICK66 tip block present');
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);
assert.match(tick66, /#loading-label\s*\{/);
assert.match(tick66, /\.load-meta\s*\{/);
assert.match(tick66, /\.load-meta #load-pct\s*\{/);
assert.match(tick66, /color:\s*#d8e8e4/);
assert.match(tick66, /color:\s*#e8fff8/);
assert.match(tick66, /0 0 1px #000/);
assert.match(tick66, /0 1px 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick66, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.4\)/);
assert.match(tick66, /-1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.4\)/);
assert.match(tick66, /0 0 8px rgba\(0,\s*232,\s*200,\s*0\.22\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick66), 'no Box2 plate churn in tip densify');
assert.ok(!/newui_Btn_Activation\.png/.test(tick66), 'no Activation plate churn in tip densify');
assert.ok(!/newui_Btn_Tap1\.png/.test(tick66), 'no Tap1 track churn in tip densify');
assert.ok(!/btn_newui_menubg/.test(tick66), 'no menubg wash churn in tip densify');
assert.ok(!/HOLD dens/.test(tick66) || /untouched/.test(tick66),
  'HOLD dens not churned in tick66');
assert.ok(!/#sp-status|sp-track/.test(tick66) || /untouched|ready-line|SP ready/.test(tick66),
  'SP ready-line not churned');
assert.ok(!/pause-blurb|pause-stamp|pause-chip/.test(tick66) || /untouched|Pause tip/.test(tick66),
  'pause tip58 not churned');
assert.ok(!/opt-block-title|opt-keys-head|keys-hiscore/.test(tick66) || /untouched|tip61|CONTROLS/.test(tick66),
  'OPTIONS/CONTROLS tip61 not churned');
assert.ok(!/result-score|result-meta/.test(tick66) || /untouched|tip62|result lbl/.test(tick66),
  'result lbl tip62 not churned');
assert.ok(!/select-dossier-kit|select-dossier-hint/.test(tick66) || /untouched|tip63|select kit/.test(tick66),
  'select tip63 not churned');
assert.ok(!/lobby-chip|lobby-status-mint/.test(tick66) || /untouched|title lobby|tip64/.test(tick66),
  'title lobby tip64 not churned');
assert.ok(!/tutorial-note|\.tut-row/.test(tick66) || /untouched|tutorial|tip65/.test(tick66),
  'tutorial tip65 not churned');
assert.ok(!/rotate-card|\.asset-error-msg/.test(tick66) || /untouched|rotate|asset-error/.test(tick66),
  'rotate/asset-error tip67 not spilled into tick66');

// tip58 / SP60 / tip61–65 / tip67 retained.
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(css, /TICK63 — select dossier kit\/hint NewUI tip residual/);
assert.match(css, /TICK64 — title lobby chip\/status NewUI tip residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);

console.log(
  'PASS qa-loading-bar-newui:',
  'brand Activation+Deco2',
  'track cyan rim+chamfer+Box2',
  'Tap1 end cue',
  'meta Box2 plate',
  'tick66 loading status quieter dual-stroke tip',
  'load-pct cyan tip',
  'menubg2+world2+deco+Top_Bg retained',
  'hud-top sparse',
  'no fake lobby',
  'pause58/SP60/tip61-65/tip67 kept',
);
