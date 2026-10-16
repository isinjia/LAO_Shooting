/**
 * Tick113: CHARGE windup label readability — NewUI #charge-row .sp-label
 * uses existing FIRE brass caption #ffe8b0 (not mint/ice SP-twin label).
 * Keep tick45 dual-stroke shadow / tick112 charge-tint fill /
 * .tc-charge-ring / is-charge-ready / HOLD dens untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const touch = readFileSync(join(root, 'js/touch-controls.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

assert.match(css, /TICK113 — CHARGE windup label readability/);
const tick113Idx = css.indexOf('TICK113 — CHARGE windup label readability');
assert.ok(tick113Idx >= 0, 'TICK113 marker present');
const tick113 = css.slice(tick113Idx);
assert.ok(tick113.length > 80, 'TICK113 block present');

// Label-only: brass FIRE caption color, not mint SP twin.
const labelRule = tick113.match(/\.lao-newui #charge-row \.sp-label\s*\{[^}]*\}/);
assert.ok(labelRule, 'CHARGE label rule present');
assert.match(labelRule[0], /color:\s*#ffe8b0/);
assert.ok(!/color:\s*#e8fff8/.test(labelRule[0]), 'no mint/ice SP-twin label color');

// Do not churn fill / track / pad ring / ready selectors in this tick.
assert.ok(!/\.lao-newui #charge-fill\s*\{/.test(tick113), 'tick113 label-only — no fill rule');
assert.ok(!/\.lao-newui #charge-track\s*\{/.test(tick113), 'tick113 label-only — no track rule');
assert.ok(!/\.tc-charge-ring\s*\{/.test(tick113), 'tick113 does not redefine .tc-charge-ring');
assert.ok(!/\.is-charge-ready\s*\{/.test(tick113) && !/\.tc-fire\.is-charge-ready/.test(tick113),
  'tick113 does not redefine is-charge-ready');

// FIRE pad already owns #ffe8b0 caption language (existing cue reuse).
assert.match(css, /\.tc-fire \.tc-caption\s*\{[^}]*color:\s*#ffe8b0/s);

// tick112 warm fill + tick45 charge label dual-stroke retained.
assert.match(css, /TICK112 — CHARGE windup fill readability/);
assert.match(css, /var\(--charge-tint/);
const tick45Idx = css.indexOf('TICK45 — HUD LIFE/BOMB/CHARGE cluster NewUI residual');
const tick45End = css.indexOf('/* ========== TICK46', tick45Idx);
const tick45 = css.slice(tick45Idx, tick45End > tick45Idx ? tick45End : undefined);
assert.match(tick45, /#charge-row \.sp-label/);
assert.match(tick45, /0 0 1px #000/);

// Pad charge ring + ready cue wiring frozen.
assert.match(css, /\.tc-charge-ring\s*\{/);
assert.match(touch, /is-charge-ready/);
assert.match(touch, /--tc-charge/);
assert.match(html, /class="tc-charge-ring"/);
assert.match(html, /id="charge-row"/);
assert.match(html, /class="sp-label">CHARGE</);

// HOLD dens not churned.
assert.ok(!/HOLD dens/.test(tick113) || /frozen|untouched/i.test(tick113),
  'HOLD dens not churned');

console.log(
  'PASS qa-charge-windup-label:',
  'CHARGE label brass #ffe8b0',
  'tick112 fill / tick45 dual-stroke kept',
  'tc-charge-ring / is-charge-ready kept',
  'HOLD dens frozen',
);
