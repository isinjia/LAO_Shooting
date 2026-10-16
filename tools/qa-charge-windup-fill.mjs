/**
 * Tick112: CHARGE windup fill readability — NewUI #charge-fill while
 * charging restores game.js --charge-tint warm language (not mint/cyan
 * SP-twin). Keep tick45 track cyan rim/Box2/Tap1 + .ready brass
 * Activation; .tc-charge-ring / is-charge-ready / HOLD dens untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');
const touch = readFileSync(join(root, 'js/touch-controls.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

assert.match(css, /TICK112 — CHARGE windup fill readability/);
const tick112Idx = css.indexOf('TICK112 — CHARGE windup fill readability');
assert.ok(tick112Idx >= 0, 'TICK112 marker present');
const tick112 = css.slice(tick112Idx);
assert.ok(tick112.length > 120, 'TICK112 block present');

// Windup fill uses --charge-tint (not mint/cyan SP-twin).
assert.match(tick112, /\.lao-newui #charge-fill\s*\{/);
assert.match(tick112, /var\(--charge-tint/);
assert.match(tick112, /color-mix\(in srgb,\s*var\(--charge-tint/);
assert.ok(!/#0a8a78/.test(tick112), 'no mint/cyan SP-twin fill in tick112');
assert.ok(!/#charge-track/.test(tick112) || /untouched|frozen|Keep|track cyan/i.test(tick112),
  'tick112 fill-only — track structure not churned in selectors');

// game.js still wires --charge-tint from shot color.
assert.match(game, /setProperty\('--charge-tint'/);

// tick45 CHARGE track + ready Activation retained (cyan rim / brass ready).
assert.match(css, /TICK45 — HUD LIFE\/BOMB\/CHARGE cluster NewUI residual/);
const tick45Idx = css.indexOf('TICK45 — HUD LIFE/BOMB/CHARGE cluster NewUI residual');
const tick45End = css.indexOf('/* ========== TICK46', tick45Idx);
const tick45 = css.slice(tick45Idx, tick45End > tick45Idx ? tick45End : undefined);
assert.match(tick45, /\.lao-newui #charge-track\s*\{/);
assert.match(tick45, /inset 2px 0 0 rgba\(0,\s*232,\s*200,\s*0\.36\)/);
assert.match(tick45, /#charge-track\.ready/);
assert.match(tick45, /rgba\(255,\s*210,\s*120/);
assert.match(tick45, /#charge-track\.ready #charge-fill/);

// Ready brass fill still wins after tick112 (later ready rule in tick45 block
// must remain; tick112 must NOT redefine .ready fill).
assert.ok(!/#charge-track\.ready/.test(tick112),
  'tick112 does not override ready Activation fill');

// Pad charge ring + ready cue wiring frozen.
assert.match(css, /\.tc-charge-ring\s*\{/);
assert.match(css, /--tc-charge/);
assert.match(touch, /is-charge-ready/);
assert.match(touch, /--tc-charge/);
assert.match(html, /class="tc-charge-ring"/);
assert.match(html, /id="charge-fill"/);

// HOLD dens not churned.
assert.ok(!/HOLD dens/.test(tick112) || /frozen|untouched/i.test(tick112),
  'HOLD dens not churned');

console.log(
  'PASS qa-charge-windup-fill:',
  'charge-tint windup fill',
  'tick45 track/ready kept',
  'tc-charge-ring / is-charge-ready kept',
  'HOLD dens frozen',
);
