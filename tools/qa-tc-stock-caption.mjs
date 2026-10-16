/**
 * Tick95: touch-pad .tc-stock NewUI tip residual — bomb pad stock
 * micro-count soft single-shadow → dual-stroke tip densify (tick36
 * caption language parity on the same BOMB pad). Typography only;
 * keep position/size/#ffe8b0 / empty rose. HOLD dens / tip58–67 /
 * canvas captions tick89–94 untouched. Combat HUD sparse.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

assert.match(css, /TICK95 — touch-pad \.tc-stock NewUI tip residual/);

const tick95Idx = css.indexOf('TICK95 — touch-pad .tc-stock NewUI tip residual');
assert.ok(tick95Idx >= 0, 'TICK95 tc-stock tip marker present');
const tick95End = css.indexOf('/* ========== TICK96', tick95Idx);
const tick95 = css.slice(tick95Idx, tick95End > tick95Idx ? tick95End : undefined);
assert.ok(tick95.length > 120, 'TICK95 tip block present');
assert.match(css, /TICK96 — touch-pad \.tc-ready NewUI tip residual/);

// Dual-stroke tip densify on stock + empty rose state.
assert.match(tick95, /\.lao-newui \.tc-stock\s*\{/);
assert.match(tick95, /font-weight:\s*800/);
assert.match(tick95, /#ffe8b0/);
assert.match(tick95, /0 0 1px #000/);
assert.match(tick95, /0 1px 0 rgba\(0,\s*0,\s*0,\s*0\.95\)/);
assert.match(tick95, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick95, /-1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.match(tick95, /\.tc-bomb\.is-empty \.tc-stock\s*\{/);
assert.match(tick95, /rgba\(255,\s*160,\s*140/);

// Soft single-shadow base retained (non-newui / pre-tip fallback).
assert.match(css, /\.tc-stock\s*\{[\s\S]*?text-shadow:\s*0 1px 2px rgba\(0,\s*0,\s*0,\s*0\.8\)/);

// Markup: stock span on bomb pad retained.
assert.match(html, /class="tc-stock"\s+id="tc-bomb-stock"/);
assert.match(html, /tc-caption">BOMB</);

// No Tap1 / Box2 plate clutter; HOLD dens not churned.
assert.ok(!/newui_Btn_Tap1\.png/.test(tick95), 'no Tap1 on stock tip densify');
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick95), 'no Box2 on stock tip densify');
assert.ok(!/HOLD dens/.test(tick95) || /untouched/.test(tick95),
  'HOLD dens not churned');

// Prior touch-pad + tip densify + canvas caption markers retained.
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK67 — rotate \/ asset-error body NewUI tip residual/);
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

console.log(
  'PASS qa-tc-stock-caption:',
  'dual-stroke stock tip densify',
  'empty rose state',
  'base soft shadow retained',
  'bomb pad markup kept',
  'no Tap1/Box2',
  'HOLD untouched',
  'tick36/tip67/hud-top sparse kept',
);
