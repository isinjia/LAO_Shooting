/**
 * Tick103: dropsPower P-drop red ellipse rim readability —
 * dark under-rim + tip edge so soft red ring + glow doesn't merge into
 * rose/neon wash + sprite clutter (no dens / geometry / P-stamp churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const enemy = readFileSync(join(root, 'js/enemy.js'), 'utf8');

const dropBlock = enemy.match(
  /dark under-rim \+ tip edge keep the power-carrier telegraph[\s\S]{0,900}?ctx\.restore\(\);/,
)?.[0] || '';

assert.ok(dropBlock.length > 200, 'dropsPower rim draw block present');

// Muddy evidence: soft red accent alone used to be the only ring stroke.
assert.match(dropBlock, /strokeStyle = '#ff5959'/);
assert.match(dropBlock, /power-carrier telegraph readable/);

// Dark under-rim separates rose/neon wash before accent stroke.
assert.match(dropBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(dropBlock, /ctx\.lineWidth = 6/);

// Accent slightly denser than old lw 3 soft blob; tip edge cool cream.
assert.match(dropBlock, /ctx\.lineWidth = 3\.5/);
assert.match(dropBlock, /strokeStyle = '#fffef8'/);
assert.match(dropBlock, /ctx\.lineWidth = 1\.4/);
assert.match(dropBlock, /ctx\.globalAlpha = 0\.78/);

// Old single-stroke stack must be gone (no bare lw3-only red ring).
assert.ok(
  !/strokeStyle = '#ff5959';\s*ctx\.lineWidth = 3;/.test(dropBlock),
  'old soft single-stroke lw3 red ring must be gone',
);

// Fairness: ellipse geometry frozen (cue only — not larger hit/spawn).
assert.match(dropBlock, /this\.drawSize \* 0\.38/);
assert.match(dropBlock, /this\.drawSize \* 0\.42/);

// Opaque P stamp remains closed (no dual-stroke invent on stamp).
assert.match(enemy, /ctx\.fillText\('P', this\.x, y \+ 1\)/);
assert.ok(
  !(enemy.match(/strokeText\('P'/g) || []).length,
  'P stamp must stay opaque fill — no dual-stroke invent',
);

// Prior rim densify ships retained.
assert.match(enemy, /dark under-rim \+ tip edge keep the expose telegraph/);
assert.match(
  enemy,
  /Caption dual-stroke: dark outer \+ amber rim so boss glow\/sprite never muddies CORE OPEN/,
);

console.log('qa-power-drop-rim: PASS');
