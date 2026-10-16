/**
 * Tick104: bomb pickup orbit-ring readability —
 * dark under-rim + tip edge so soft cyan arc doesn't merge into
 * pale-cyan neon wash (no dens / drop / magnet / B-stamp churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const powerup = readFileSync(join(root, 'js/powerup.js'), 'utf8');

const bombBlock = powerup.match(
  /Orbit ring telegraph — dark under-rim \+ tip edge keep the B-pickup[\s\S]{0,900}?ctx\.restore\(\);/,
)?.[0] || '';

assert.ok(bombBlock.length > 200, 'bomb pickup orbit rim draw block present');

// Muddy evidence: soft cyan arc alone used to be the only orbit stroke.
assert.match(bombBlock, /rgba\(126, 200, 232/);
assert.match(bombBlock, /B-pickup cue/);

// Dark under-rim separates pale-cyan neon wash before accent stroke.
assert.match(bombBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(bombBlock, /ctx\.lineWidth = 3\.5/);

// Accent denser than old lw 1.25 soft blob; tip edge cool cream.
assert.match(bombBlock, /ctx\.lineWidth = 1\.75/);
assert.match(bombBlock, /0\.42 \+ 0\.28 \* pulse/);
assert.match(bombBlock, /strokeStyle = '#fffef8'/);
assert.match(bombBlock, /ctx\.globalAlpha = 0\.72/);
assert.match(bombBlock, /ctx\.lineWidth = 1\.1/);

// Old single-stroke stack must be gone.
assert.ok(
  !/Thin orbit ring/.test(powerup),
  'old Thin orbit ring comment must be gone',
);
assert.ok(
  !/lineWidth = 1\.25;\s*ctx\.beginPath\(\);\s*ctx\.arc\(x, y, r \+ 4\.5/.test(powerup),
  'old soft single-stroke lw1.25 cyan orbit must be gone',
);

// Fairness: orbit radius / sweep frozen (cue only — not larger magnet/hit).
assert.match(bombBlock, /r \+ 4\.5/);
assert.match(bombBlock, /Math\.PI \* 1\.35/);

// Opaque B stamp remains closed (no dual-stroke invent on stamp).
assert.match(powerup, /ctx\.fillText\('B', x, by \+ 0\.5\)/);
assert.ok(
  !(powerup.match(/strokeText\('B'/g) || []).length,
  'B stamp must stay opaque fill — no dual-stroke invent',
);

// Prior rim densify ships retained (enemy carrier / expose / phase paths untouched here).
assert.match(
  readFileSync(join(root, 'js/enemy.js'), 'utf8'),
  /dark under-rim \+ tip edge keep the power-carrier telegraph/,
);

console.log('qa-bomb-pickup-rim: PASS');
