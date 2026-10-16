/**
 * Tick108: pickup burst expanding-ring readability —
 * dark under-rim + tip edge so cyan/brass confirm rings don't merge into
 * same-hue neon wash (no dens / POPUP_CAP / magnet / drop churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const powerup = readFileSync(join(root, 'js/powerup.js'), 'utf8');

const burstBlock = powerup.match(
  /Expanding ring burst — dark under-rim \+ tip edge keep the pickup confirm[\s\S]{0,2400}?Soft glow under label/,
)?.[0] || '';

assert.ok(burstBlock.length > 300, 'pickup burst rim draw block present');

// Muddy evidence: palette ring alone used to be the only burst stroke.
assert.match(burstBlock, /pal\.ring/);
assert.match(powerup, /ring: 'rgba\(126, 200, 232, 0\.75\)'/);
assert.match(powerup, /ring: 'rgba\(255, 224, 138, 0\.7\)'/);

// Dark under-rim separates cyan/brass neon wash before accent stroke.
assert.match(burstBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(burstBlock, /outerA \* 0\.9/);
assert.match(burstBlock, /outerLw \+ 2/);
assert.match(burstBlock, /innerLw \+ 1\.6/);

// Accent dens stays at prior outer/inner widths; tip edge cool cream.
assert.match(burstBlock, /const outerLw = 4\.5 \* \(1 - t\)/);
assert.match(burstBlock, /const innerLw = 1\.6 \* \(1 - t\)/);
assert.match(burstBlock, /const outerA = fade \* 0\.4/);
assert.match(burstBlock, /strokeStyle = '#fffef8'/);
assert.match(burstBlock, /outerA \* 0\.72/);
assert.match(burstBlock, /fade \* 0\.72/);
assert.match(burstBlock, /Math\.max\(0\.85, outerLw \* 0\.32\)/);
assert.match(burstBlock, /Math\.max\(0\.7, innerLw \* 0\.55\)/);

// Old single-stroke stack must be gone.
assert.ok(
  !/\/\/ Expanding ring burst\n\s*const ringR = 10 \+ t \* 42;\n\s*ctx\.strokeStyle = pal\.ring;/.test(powerup),
  'old single-stroke Expanding ring burst stack must be gone',
);

// Fairness: geometry / dens / magnet / drop frozen (cue only).
assert.match(burstBlock, /ringR = 10 \+ t \* 42/);
assert.match(burstBlock, /ringR \* 0\.86/);
assert.match(powerup, /const POPUP_CAP = 4/);
assert.match(powerup, /const baseN = kind === 'bomb' \? 16 : 18/);

// Prior orbit / gem rim densify ships retained.
assert.match(powerup, /Orbit ring telegraph — dark under-rim \+ tip edge keep the B-pickup/);
assert.match(powerup, /Rotating dashed ring telegraph — dark under-rim \+ tip edge keep the/);

// Label dual-stroke stays; gem P soft outline frozen; B stamp opaque (no invent).
assert.match(powerup, /strokeStyle = 'rgba\(8, 12, 20, 0\.85\)'/);
assert.match(powerup, /strokeText\('P', x, y \+ 0\.5\)/);
assert.match(powerup, /ctx\.fillText\('B', x, by \+ 0\.5\)/);
assert.ok(
  !(powerup.match(/strokeText\('B'/g) || []).length,
  'B stamp must stay opaque fill — no dual-stroke invent',
);

console.log('qa-pickup-burst-rim: PASS');
