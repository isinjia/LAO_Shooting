/**
 * Tick96: touch-pad .tc-ready NewUI tip residual — SP pad READY
 * micro-label glow-only → dual-stroke + Activation glow (tick60
 * #sp-status ready-line parity + tick36 SP caption language on the
 * same SP pad). Typography only; keep position/size/#ffe08a /
 * is-ready display wiring. HOLD dens / tip58–67 / .tc-stock tip95 /
 * canvas captions tick89–94 untouched. Combat HUD sparse.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

assert.match(css, /TICK96 — touch-pad \.tc-ready NewUI tip residual/);

const tick96Idx = css.indexOf('TICK96 — touch-pad .tc-ready NewUI tip residual');
assert.ok(tick96Idx >= 0, 'TICK96 tc-ready tip marker present');
const tick96End = css.indexOf('/* ========== TICK97', tick96Idx);
const tick96 = css.slice(tick96Idx, tick96End > tick96Idx ? tick96End : undefined);
assert.ok(tick96.length > 120, 'TICK96 tip block present');
assert.match(css, /TICK97 — HUD stock pulse lbl NewUI tip residual/);

// Dual-stroke tip densify + keep Activation glow on READY.
assert.match(tick96, /\.lao-newui \.tc-ready\s*\{/);
assert.match(tick96, /font-weight:\s*800/);
assert.match(tick96, /#ffe08a/);
assert.match(tick96, /0 0 1px #000/);
assert.match(tick96, /0 1px 0 rgba\(0,\s*0,\s*0,\s*0\.95\)/);
assert.match(tick96, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick96, /-1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick96, /0 0 8px rgba\(255,\s*200,\s*80,\s*0\.55\)/);

// Glow-only base retained (non-newui / pre-tip fallback).
assert.match(css, /\.tc-ready\s*\{[\s\S]*?text-shadow:\s*0 0 8px rgba\(255,\s*200,\s*80,\s*0\.55\)/);

// is-ready display wiring frozen; markup READY span on SP pad retained.
assert.match(css, /\.tc-special\.is-ready \.tc-ready\s*\{\s*display:\s*block/);
assert.match(html, /class="tc-ready"[^>]*>READY</);
assert.match(html, /tc-caption">SP</);

// No Tap1 / Box2 plate clutter; HOLD dens not churned.
assert.ok(!/newui_Btn_Tap1\.png/.test(tick96), 'no Tap1 on ready tip densify');
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick96), 'no Box2 on ready tip densify');
assert.ok(!/HOLD dens/.test(tick96) || /untouched/.test(tick96),
  'HOLD dens not churned');

// Prior touch-pad + tip densify + canvas caption markers retained.
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(css, /TICK95 — touch-pad \.tc-stock NewUI tip residual/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

console.log(
  'PASS qa-tc-ready-caption:',
  'dual-stroke ready tip densify',
  'Activation glow kept',
  'base glow-only retained',
  'is-ready wiring + SP markup kept',
  'no Tap1/Box2',
  'HOLD untouched',
  'tick36/60/95/tip67/hud-top sparse kept',
);
