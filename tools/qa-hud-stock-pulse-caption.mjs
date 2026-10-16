/**
 * Tick97: HUD stock pulse lbl NewUI tip residual — LIFE/BOMB pulse
 * labels (critical / extend / deathbomb) dropped lateral dual-stroke
 * → glow-forward soft rim, muddy vs idle tick45 LIFE/BOMB dual-stroke
 * on the same stock plate. Restore dual-stroke + keep pulse
 * Activation/danger glow. Typography only; keep pulse colors / pip
 * animations / life-warn / CHARGE. HOLD dens / tip58–67 / .tc-stock
 * tip95 / .tc-ready tip96 / canvas captions tick89–94 untouched.
 * Combat HUD sparse.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

assert.match(css, /TICK97 — HUD stock pulse lbl NewUI tip residual/);

const tick97Idx = css.indexOf('TICK97 — HUD stock pulse lbl NewUI tip residual');
assert.ok(tick97Idx >= 0, 'TICK97 stock pulse tip marker present');
const tick97 = css.slice(tick97Idx);
assert.ok(tick97.length > 200, 'TICK97 tip block present');

// Dual-stroke tip densify + keep pulse glows on critical / extend / deathbomb.
assert.match(tick97, /\.lao-newui #life-stock\.is-critical \.hud-lbl\s*\{/);
assert.match(tick97, /\.lao-newui #life-stock\.is-extend \.hud-lbl\s*\{/);
assert.match(tick97, /\.lao-newui #bomb-stock\.is-deathbomb \.hud-lbl\s*\{/);
assert.match(tick97, /font-weight:\s*800/);
assert.match(tick97, /0 0 1px #000/);
assert.match(tick97, /0 1px 0 rgba\(0,\s*0,\s*0,\s*0\.95\)/);
assert.match(tick97, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick97, /-1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick97, /0 0 8px rgba\(255,\s*80,\s*60,\s*0\.5\)/);
assert.match(tick97, /0 0 8px rgba\(255,\s*200,\s*80,\s*0\.55\)/);
assert.match(tick97, /#ff8a7a/);
assert.match(tick97, /#ffe08a/);

// Tick45 idle dual-stroke + pulse pip animations retained (not structure-churned).
assert.match(css, /TICK45 — HUD LIFE\/BOMB\/CHARGE cluster NewUI residual/);
assert.match(css, /\.lao-newui \.hud-stocks \.hud-lbl\s*\{/);
assert.match(css, /#life-stock\.is-critical #lives-pips \.pip\.on/);
assert.match(css, /#life-stock\.is-extend #lives-pips \.pip\.on/);
assert.match(css, /#bomb-stock\.is-deathbomb #bombs-pips \.pip\.on/);
assert.match(css, /@keyframes life-critical-pulse/);
assert.match(css, /\.lao-newui \.life-warn-chip/);

// Markup retained.
assert.match(html, /id="life-stock"/);
assert.match(html, /id="bomb-stock"/);
assert.match(html, /id="life-warn"/);

// No Tap1 / Box2 plate clutter in this tip; HOLD dens not churned.
assert.ok(!/newui_Btn_Tap1\.png/.test(tick97), 'no Tap1 on stock pulse tip densify');
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick97), 'no Box2 on stock pulse tip densify');
assert.ok(!/HOLD dens/.test(tick97) || /untouched/.test(tick97),
  'HOLD dens not churned');
assert.ok(!/\.lao-newui \.tc-(ready|stock|caption)\s*\{/.test(tick97),
  'no touch-pad caption/stock/ready rule churn');

// Prior tip densify + canvas caption markers retained.
assert.match(css, /TICK96 — touch-pad \.tc-ready NewUI tip residual/);
assert.match(css, /TICK95 — touch-pad \.tc-stock NewUI tip residual/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

console.log(
  'PASS qa-hud-stock-pulse-caption:',
  'dual-stroke critical/extend/deathbomb lbl tip densify',
  'pulse Activation/danger glow kept',
  'tick45 idle + pip pulse kept',
  'no Tap1/Box2 / touch-pad churn',
  'HOLD untouched',
  'tick95/96/60/tip67/hud-top sparse kept',
);
