/**
 * Tick43 + Tick67: asset-error overlay NewUI residual — dedicated
 * screen-asset-error, menubg+world2 cool-amber wash, brand
 * Activation+Deco2, Info icon plate, msg Box2+cyan rim/inset+chamfer,
 * dual-stroke h2, Title_Deco1 deco; tick67 asset-error-msg p quieter
 * dual-stroke tip densify (typography only). Retry / toSelect recovery
 * wiring retained. HOLD dens / tip58–66 / rotate plates not churned.
 * Combat HUD sparse.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Tick43 asset-error block present.
assert.match(css, /TICK43 — asset-error overlay NewUI residual/);

const tick43Idx = css.indexOf('TICK43 — asset-error overlay NewUI residual');
assert.ok(tick43Idx >= 0, 'TICK43 asset-error marker present');
const tick43End = css.indexOf('/* ========== TICK44', tick43Idx);
const tick43 = css.slice(tick43Idx, tick43End > tick43Idx ? tick43End : undefined);
assert.ok(tick43.length > 200, 'TICK43 asset-error block present');

// Dedicated screen + menubg+world2 cool-amber wash.
assert.match(tick43, /#overlay-content\.screen-asset-error\s*\{/);
assert.match(tick43, /btn_newui_menubg\.png/);
assert.match(tick43, /btn_newui_world2\.png/);
assert.match(tick43, /background-blend-mode:\s*normal,\s*soft-light,\s*overlay/);
assert.match(tick43, /rgba\(40,\s*30,\s*22/);

// Brand Activation + Title_Deco2 cue.
assert.match(tick43, /\.brand-mark\s*\{/);
assert.match(tick43, /newui_Btn_Activation\.png/);
assert.match(tick43, /newui_Popup_Bg_Title_Deco2\.png/);
assert.match(tick43, /rgba\(255,\s*200,\s*90/);

// Info icon plate.
assert.match(tick43, /\.asset-error-icon\s*\{/);
assert.match(tick43, /newui_Icon_Info\.png/);
assert.match(tick43, /rgba\(0,\s*232,\s*200,\s*0\.5\)/);

// Dual-stroke h2.
assert.match(tick43, /> h2\s*\{/);
assert.match(tick43, /font-weight:\s*800/);
assert.match(tick43, /0 0 1px #000/);

// Msg Box2 + cyan rim/inset + chamfer.
assert.match(tick43, /\.asset-error-msg\s*\{/);
assert.match(tick43, /newui_Popup_Bg_Box2\.png/);
assert.match(tick43, /rgba\(0,\s*232,\s*200,\s*0\.28\)/);
assert.match(tick43, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick43, /clip-path:\s*polygon\(6px 0/);

// Title_Deco1 footer deco.
assert.match(tick43, /\.asset-error-deco/);
assert.match(tick43, /newui_Popup_Bg_Title_Deco1\.png/);

// Combat HUD sparse.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// Markup + recovery wiring retained; dedicated class (not gameover piggyback).
const fnStart = main.indexOf('function showAssetErrorRecovery');
assert.ok(fnStart >= 0, 'showAssetErrorRecovery present');
const fnSlice = main.slice(fnStart, fnStart + 1800);
assert.ok(fnSlice.includes('screen-asset-error'), 'screen-asset-error class');
assert.ok(!/screen-result\s+gameover/.test(fnSlice), 'no longer piggybacks gameover');
assert.ok(fnSlice.includes('brand-mark'), 'brand-mark retained');
assert.ok(fnSlice.includes('asset-error-icon'), 'info icon markup');
assert.ok(fnSlice.includes('asset-error-msg'), 'msg plate markup');
assert.ok(fnSlice.includes('asset-error-deco'), 'deco markup');
assert.ok(fnSlice.includes('btn-asset-retry'), 'retry retained');
assert.ok(fnSlice.includes('btn-asset-select'), 'toSelect retained');
assert.ok(fnSlice.includes('retryStageAssets'), 'retryStageAssets wiring kept');
assert.ok(fnSlice.includes("t('err.stageLoad'"), 'err.stageLoad i18n kept');
assert.ok(fnSlice.includes("t('btn.retry')"), 'btn.retry i18n kept');
assert.ok(fnSlice.includes("t('btn.toSelect')"), 'btn.toSelect i18n kept');

// Prior ceremony / menu markers retained; rotate / result / HOLD not churned.
assert.match(css, /TICK42 — portrait-rotate overlay NewUI residual/);
assert.match(css, /TICK41 — tutorial NewUI residual/);
assert.match(css, /TICK40 — title lobby NewUI residual/);
assert.match(css, /TICK39 — HUD power-badge NewUI residual/);
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/HOLD dens/.test(tick43) || /untouched/.test(tick43),
  'HOLD dens not churned');
assert.ok(!/rotate-hint|rotate-card/.test(tick43) || /untouched/.test(tick43),
  'rotate overlay not churned');
assert.ok(!/screen-result\.|result-score|result-meta/.test(tick43),
  'result screen CSS not churned');

// Tick67 — asset-error-msg p tip densify (typography only; no plate churn).
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);
const tick67Idx = css.indexOf('TICK67 — rotate / asset-error body NewUI tip residual');
assert.ok(tick67Idx >= 0, 'TICK67 rotate/asset-error tip marker present');
const tick67End = css.indexOf('/* ========== TICK95', tick67Idx);
const tick67 = css.slice(tick67Idx, tick67End > tick67Idx ? tick67End : undefined);
assert.ok(tick67.length > 120, 'TICK67 tip block present');
assert.match(tick67, /\.rotate-card p\s*\{/);
assert.match(tick67, /\.asset-error-msg p\s*\{/);
assert.match(tick67, /color:\s*#d8e8e4/);
assert.match(tick67, /0 0 1px #000/);
assert.match(tick67, /0 1px 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick67, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.4\)/);
assert.match(tick67, /-1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.4\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick67), 'no Box2 plate churn in tip densify');
assert.ok(!/newui_Btn_Activation\.png/.test(tick67), 'no Activation plate churn in tip densify');
assert.ok(!/btn_newui_menubg/.test(tick67), 'no menubg wash churn in tip densify');
assert.ok(!/HOLD dens/.test(tick67) || /untouched/.test(tick67),
  'HOLD dens not churned in tick67');
assert.ok(!/#loading-label|load-pct/.test(tick67) || /untouched|loading|tip66/.test(tick67),
  'loading tip66 not churned');
assert.ok(!/tutorial-note|\.tut-row/.test(tick67) || /untouched|tutorial|tip65/.test(tick67),
  'tutorial tip65 not churned');

// tip58 / SP60 / tip61–66 retained.
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /TICK62 — result label NewUI tip residual/);
assert.match(css, /TICK63 — select dossier kit\/hint NewUI tip residual/);
assert.match(css, /TICK64 — title lobby chip\/status NewUI tip residual/);
assert.match(css, /TICK65 — tutorial note\/row NewUI tip residual/);
assert.match(css, /TICK66 — loading status NewUI tip residual/);

console.log(
  'PASS qa-asset-error-overlay:',
  'screen-asset-error',
  'menubg+world2 cool-amber',
  'brand Activation+Deco2',
  'Info icon plate',
  'msg Box2 cyan rim/inset',
  'dual-stroke h2',
  'Title_Deco1 deco',
  'tick67 asset-error-msg p quieter dual-stroke tip',
  'retry/toSelect kept',
  'hud-top sparse',
  'HOLD/tip58-66 untouched',
);
