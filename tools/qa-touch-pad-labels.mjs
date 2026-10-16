/**
 * Tick36: touch-pad label clarity — FIRE/BOMB/SP/FOCUS/MOVE dual-stroke
 * captions + role tint on fixed+float pads. Float MOVE via stick-zone hint.
 * NewUI text only (no Tap1/Box2 clutter on pads). HOLD dens untouched;
 * combat HUD sparse; prior OPTIONS/pause/CONTROLS/loading markers retained.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Tick36 block present.
assert.match(css, /TICK36 — touch-pad label clarity/);

const tick36Idx = css.indexOf('TICK36 — touch-pad label clarity');
assert.ok(tick36Idx >= 0, 'TICK36 pad-label marker present');
const tick36End = css.indexOf('/* ========== TICK37', tick36Idx);
const tick36 = css.slice(tick36Idx, tick36End > tick36Idx ? tick36End : undefined);
assert.ok(tick36.length > 200, 'TICK36 pad-label block present');

// Caption dual-stroke + role tints (FIRE / BOMB / SP / FOCUS).
assert.match(tick36, /\.lao-newui \.tc-caption\s*\{/);
assert.match(tick36, /font-weight:\s*800/);
assert.match(tick36, /0 0 1px #000/);
assert.match(tick36, /\.tc-fire \.tc-caption/);
assert.match(tick36, /#ffe9b4/);
assert.match(tick36, /\.tc-bomb \.tc-caption/);
assert.match(tick36, /#ffd4dc/);
assert.match(tick36, /\.tc-special \.tc-caption/);
assert.match(tick36, /#c8fff4/);
assert.match(tick36, /\.tc-focus \.tc-caption/);
assert.match(tick36, /#e0eaf2/);

// Fixed MOVE dual-stroke on stick-base::after.
assert.match(tick36, /\.tc-stick-base::after\s*\{/);
assert.match(tick36, /#d8f4ee/);
assert.match(tick36, /letter-spacing:\s*0\.18em/);

// Float MOVE via stick-zone hint; base::after remains off (pre-existing).
assert.match(tick36, /tc-mode-float \.tc-stick-zone::after/);
assert.match(tick36, /content:\s*"MOVE"/);
assert.match(tick36, /is-stick-on \.tc-stick-zone::after/);
assert.match(css, /\.touch-controls\.tc-mode-float \.tc-stick-base::after\s*\{\s*display:\s*none/);

// Float caption size bumps present.
assert.match(tick36, /tc-mode-float \.tc-caption/);
assert.match(tick36, /tc-mode-float \.tc-fire \.tc-caption/);
assert.match(tick36, /tc-mode-float \.tc-focus \.tc-caption/);

// No Tap1 / Box2 clutter on pad labels this tick.
assert.ok(!/newui_Btn_Tap1\.png/.test(tick36), 'no Tap1 on pad labels');
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick36), 'no Box2 on pad labels');

// Markup: captions + MOVE stick retained; no HOLD churn.
assert.match(html, /tc-caption">FIRE</);
assert.match(html, /tc-caption">BOMB</);
assert.match(html, /tc-caption">SP</);
assert.match(html, /tc-caption">FOCUS</);
assert.match(html, /class="tc-stick-base"/);
assert.match(css, /content:\s*"MOVE"/);

// HOLD dens not touched in this block.
assert.ok(!/HOLD dens/.test(tick36) || /untouched/.test(tick36),
  'HOLD dens not churned');

// Combat HUD sparse + prior NewUI markers retained.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);

// Tick95 — .tc-stock tip densify (typography only; caption block frozen).
assert.match(css, /TICK95 — touch-pad \.tc-stock NewUI tip residual/);
const tick95Idx = css.indexOf('TICK95 — touch-pad .tc-stock NewUI tip residual');
assert.ok(tick95Idx >= 0, 'TICK95 tc-stock tip marker present');
const tick95End = css.indexOf('/* ========== TICK96', tick95Idx);
const tick95 = css.slice(tick95Idx, tick95End > tick95Idx ? tick95End : undefined);
assert.match(tick95, /\.lao-newui \.tc-stock\s*\{/);
assert.match(tick95, /0 0 1px #000/);
assert.match(tick95, /#ffe8b0/);
assert.ok(!/\.tc-caption/.test(tick95), 'no caption churn in tick95 stock tip');

// Tick96 — .tc-ready tip densify (typography only; caption/stock frozen).
assert.match(css, /TICK96 — touch-pad \.tc-ready NewUI tip residual/);
const tick96Idx = css.indexOf('TICK96 — touch-pad .tc-ready NewUI tip residual');
assert.ok(tick96Idx >= 0, 'TICK96 tc-ready tip marker present');
const tick96End = css.indexOf('/* ========== TICK97', tick96Idx);
const tick96 = css.slice(tick96Idx, tick96End > tick96Idx ? tick96End : undefined);
assert.match(tick96, /\.lao-newui \.tc-ready\s*\{/);
assert.match(tick96, /0 0 1px #000/);
assert.match(tick96, /#ffe08a/);
assert.match(tick96, /0 0 8px rgba\(255,\s*200,\s*80,\s*0\.55\)/);
assert.ok(!/\.lao-newui \.tc-caption/.test(tick96), 'no caption churn in tick96 ready tip');
assert.ok(!/\.lao-newui \.tc-stock/.test(tick96), 'no stock rule churn in tick96 ready tip');

// Tick97 — HUD stock pulse lbl tip densify (bounded; no touch-pad churn).
assert.match(css, /TICK97 — HUD stock pulse lbl NewUI tip residual/);
const tick97Idx = css.indexOf('TICK97 — HUD stock pulse lbl NewUI tip residual');
assert.ok(tick97Idx >= 0, 'TICK97 stock pulse tip marker present');
const tick97 = css.slice(tick97Idx);
assert.match(tick97, /#life-stock\.is-critical \.hud-lbl/);
assert.match(tick97, /#life-stock\.is-extend \.hud-lbl/);
assert.match(tick97, /#bomb-stock\.is-deathbomb \.hud-lbl/);
assert.ok(!/\.lao-newui \.tc-(ready|stock|caption)\s*\{/.test(tick97),
  'no touch-pad rule churn in tick97 stock pulse tip');

console.log(
  'PASS qa-touch-pad-labels:',
  'dual-stroke captions',
  'FIRE/BOMB/SP/FOCUS tints',
  'fixed MOVE stroke',
  'float MOVE zone hint',
  'no Tap1/Box2 clutter',
  'HOLD untouched',
  'hud-top sparse',
  'OPTIONS/pause/CONTROLS/loading kept',
  'tick95 tc-stock tip densify',
  'tick96 tc-ready tip densify',
  'tick97 stock pulse tip densify',
);
