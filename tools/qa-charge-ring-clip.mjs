/**
 * Tick114: CHARGE pad ring clip restore — .tc-fire must not chamfer-clip
 * .tc-charge-ring (inset:-5px). Keep conic/--tc-charge/is-charge-ready /
 * tick112 fill / tick113 label / HOLD dens untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const touch = readFileSync(join(root, 'js/touch-controls.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

assert.match(css, /TICK114 — CHARGE pad ring clip restore/);
const tick114Idx = css.indexOf('TICK114 — CHARGE pad ring clip restore');
assert.ok(tick114Idx >= 0, 'TICK114 marker present');
const tick114 = css.slice(tick114Idx);
assert.ok(tick114.length > 80, 'TICK114 block present');

// Clip restore only — circular FIRE so inset:-5px ring is not chamfer-clipped.
const fireRule = tick114.match(/\.tc-fire\s*\{[^}]*\}/);
assert.ok(fireRule, '.tc-fire clip-restore rule present');
assert.match(fireRule[0], /overflow:\s*visible/);
assert.match(fireRule[0], /clip-path:\s*none/);
assert.match(fireRule[0], /border-radius:\s*50%/);

// Do not redefine ring conic / ready cue / fill / label in this tick.
assert.ok(!/\.tc-charge-ring\s*\{/.test(tick114), 'tick114 does not redefine .tc-charge-ring');
assert.ok(!/\.tc-fire\.is-charge-ready/.test(tick114), 'tick114 does not redefine is-charge-ready');
assert.ok(!/#charge-fill/.test(tick114), 'tick114 does not churn #charge-fill');
assert.ok(!/#charge-row \.sp-label/.test(tick114), 'tick114 does not churn CHARGE label');

// Earlier intentional ring-visibility rule still exists (pre-chrome pass).
assert.match(css, /\.tc-charge-ring\s*\{[\s\S]*?inset:\s*-5px/);
assert.match(css, /\.tc-charge-ring\s*\{[\s\S]*?conic-gradient/);

// Cascade proof: a later chrome pass re-applies chamfer before TICK114.
const chromeIdx = css.indexOf('/* Touch pad chrome */');
assert.ok(chromeIdx >= 0 && chromeIdx < tick114Idx, 'Touch pad chrome precedes TICK114');
const chromeSlice = css.slice(chromeIdx, tick114Idx);
assert.match(chromeSlice, /\.tc-fire\s*\{[\s\S]*?clip-path:\s*polygon/);

// Wiring frozen.
assert.match(touch, /is-charge-ready/);
assert.match(touch, /--tc-charge/);
assert.match(html, /class="tc-charge-ring"/);
assert.match(html, /id="charge-row"/);

// Prior charge windup ships kept.
assert.match(css, /TICK112 — CHARGE windup fill readability/);
assert.match(css, /TICK113 — CHARGE windup label readability/);
assert.match(css, /var\(--charge-tint/);
assert.match(css, /\.lao-newui #charge-row \.sp-label\s*\{[^}]*color:\s*#ffe8b0/s);

// HOLD dens not churned.
assert.ok(!/HOLD dens/.test(tick114) || /frozen|untouched/i.test(tick114),
  'HOLD dens not churned');

console.log(
  'PASS qa-charge-ring-clip:',
  '.tc-fire clip-path:none after chrome chamfer',
  'tc-charge-ring conic / is-charge-ready kept',
  'tick112 fill / tick113 label kept',
  'HOLD dens frozen',
);
