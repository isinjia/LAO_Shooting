/**
 * Tick42 + Tick67: portrait-rotate overlay NewUI residual — menubg+world2
 * wash, rotate-card Box2+cyan rim/inset+chamfer, rotate-icon
 * Activation+Info cue, strong dual-stroke; tick67 rotate-card p quieter
 * dual-stroke tip densify (typography only). Mobile detection untouched
 * (.is-on / isPortrait / syncPortraitHint). HOLD dens / tip58–66 /
 * asset-error tip not churned. Combat HUD sparse.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const mobile = readFileSync(join(root, 'js/mobile.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Tick42 rotate block present.
assert.match(css, /TICK42 — portrait-rotate overlay NewUI residual/);

const tick42Idx = css.indexOf('TICK42 — portrait-rotate overlay NewUI residual');
assert.ok(tick42Idx >= 0, 'TICK42 rotate marker present');
const tick42End = css.indexOf('/* ========== TICK43', tick42Idx);
const tick42 = css.slice(tick42Idx, tick42End > tick42Idx ? tick42End : undefined);
assert.ok(tick42.length > 200, 'TICK42 rotate block present');

// menubg + world2 layered wash on rotate-hint.
assert.match(tick42, /\.rotate-hint\s*\{/);
assert.match(tick42, /btn_newui_menubg\.png/);
assert.match(tick42, /btn_newui_world2\.png/);
assert.match(tick42, /background-blend-mode:\s*normal,\s*soft-light,\s*overlay/);

// rotate-card Box2 + cyan rim/inset + chamfer.
assert.match(tick42, /\.rotate-card\s*\{/);
assert.match(tick42, /newui_Popup_Bg_Box2\.png/);
assert.match(tick42, /rgba\(0,\s*232,\s*200,\s*0\.28\)/);
assert.match(tick42, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick42, /clip-path:\s*polygon\(8px 0/);

// Title_Deco1 footer strip retained as card ::after.
assert.match(tick42, /\.rotate-card::after/);
assert.match(tick42, /newui_Popup_Bg_Title_Deco1\.png/);

// rotate-icon Activation plate + Info cue; spin keyframes retained.
assert.match(tick42, /\.rotate-icon\s*\{/);
assert.match(tick42, /newui_Btn_Activation\.png/);
assert.match(tick42, /rgba\(0,\s*232,\s*200,\s*0\.55\)/);
assert.match(tick42, /animation:\s*rotate-hint-spin/);
assert.match(tick42, /\.rotate-icon::before/);
assert.match(tick42, /newui_Icon_Info\.png/);

// Typography: strong dual-stroke + cyan-muted body.
assert.match(tick42, /\.rotate-card strong\s*\{/);
assert.match(tick42, /font-weight:\s*800/);
assert.match(tick42, /0 0 1px #000/);
assert.match(tick42, /\.rotate-card p\s*\{/);
assert.match(tick42, /rgba\(200,\s*220,\s*214,\s*0\.92\)/);

// Base detection wiring untouched — .is-on display toggle + spin keyframes.
assert.match(css, /\.rotate-hint\.is-on\s*\{\s*display:\s*flex;/);
assert.match(css, /@keyframes rotate-hint-spin/);

// Markup: rotate-hint / rotate-card / rotate-icon / i18n keys retained.
assert.match(html, /id="rotate-hint"/);
assert.match(html, /class="rotate-card"/);
assert.match(html, /class="rotate-icon"/);
assert.match(html, /data-i18n="rotate\.title"/);
assert.match(html, /data-i18n-html="rotate\.body"/);

// JS detection: isPortrait + syncPortraitHint + is-on toggle unchanged.
assert.match(mobile, /export function isPortrait\(\)/);
assert.match(mobile, /return h > w/);
assert.match(main, /function syncPortraitHint\(\)/);
assert.match(main, /rotateHint\.classList\.toggle\('is-on',\s*portrait\)/);
assert.match(main, /orientationchange/);

// Combat HUD sparse.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// Prior ceremony / menu markers retained; HOLD / tutorial not churned this tick.
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
assert.ok(!/HOLD dens/.test(tick42) || /untouched/.test(tick42),
  'HOLD dens not churned');
assert.ok(!/screen-tutorial/.test(tick42), 'tutorial CSS not churned');
assert.ok(!/lobby-status-bar|lobby-rail/.test(tick42), 'title lobby not churned');

// Tick67 — rotate-card p tip densify (typography only; no plate churn).
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
  'PASS qa-rotate-overlay:',
  'menubg+world2',
  'card Box2 cyan rim/inset',
  'Title_Deco1 footer',
  'icon Activation+Info',
  'strong dual-stroke',
  'tick67 rotate-card p quieter dual-stroke tip',
  'is-on+isPortrait kept',
  'hud-top sparse',
  'HOLD/tip58-66 untouched',
);
