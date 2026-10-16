/**
 * Tick105: power gem brass dashed-ring readability —
 * dark under-rim + tip edge so soft brass dash doesn't merge into
 * brass/neon wash (no dens / drop / magnet / P-stamp churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const powerup = readFileSync(join(root, 'js/powerup.js'), 'utf8');

const powerBlock = powerup.match(
  /Rotating dashed ring telegraph — dark under-rim \+ tip edge keep the[\s\S]{0,900}?ctx\.restore\(\);/,
)?.[0] || '';

assert.ok(powerBlock.length > 200, 'power gem dashed-ring rim draw block present');

// Muddy evidence: soft brass dash alone used to be the only ring stroke.
assert.match(powerBlock, /rgba\(255, 224, 138/);
assert.match(powerBlock, /P-pickup brass cue/);

// Dark under-rim separates brass/neon wash before accent stroke.
assert.match(powerBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(powerBlock, /ctx\.lineWidth = 3\.5/);

// Accent denser than old lw 1.5 soft dash; tip edge cool cream.
assert.match(powerBlock, /ctx\.lineWidth = 2/);
assert.match(powerBlock, /0\.48 \+ 0\.32 \* pulse/);
assert.match(powerBlock, /strokeStyle = '#fffef8'/);
assert.match(powerBlock, /ctx\.globalAlpha = 0\.72/);
assert.match(powerBlock, /ctx\.lineWidth = 1\.1/);

// Old single-stroke stack must be gone.
assert.ok(
  !/Rotating dashed ring \(arcade pickup cue\)/.test(powerup),
  'old arcade-cue comment must be gone',
);
assert.ok(
  !/rgba\(255, 224, 138, \$\{0\.35 \+ 0\.25 \* pulse\}\)[\s\S]{0,80}?lineWidth = 1\.5/.test(powerup),
  'old soft single-stroke lw1.5 brass dash must be gone',
);

// Fairness: ring radius / dash pattern frozen (cue only — not larger magnet/hit).
assert.match(powerBlock, /r \+ 5\.5/);
assert.match(powerBlock, /setLineDash\(\[4\.5, 3\.5\]\)/);

// P stamp remains closed (no NEW dual-stroke invent beyond existing soft outline).
assert.match(powerup, /ctx\.fillText\('P', x, y \+ 0\.5\)/);

// Prior rim densify ships retained (bomb orbit / enemy carrier paths).
assert.match(powerup, /Orbit ring telegraph — dark under-rim \+ tip edge keep the B-pickup/);
assert.match(
  readFileSync(join(root, 'js/enemy.js'), 'utf8'),
  /dark under-rim \+ tip edge keep the power-carrier telegraph/,
);

console.log('qa-power-pickup-rim: PASS');
