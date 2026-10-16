/**
 * Tick107: deathbomb grace timer rim readability —
 * dark under-rim + tip edge so brass/rose arcs don't merge into
 * same-hue additive bloom / neon wash (no dens / timer / geometry churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const player = readFileSync(join(root, 'js/player.js'), 'utf8');

const graceStart = player.indexOf(
  'Countdown + presence rings — dark under-rim + tip edge keep the X-window',
);
assert.ok(graceStart >= 0, 'deathbomb grace rim comment present');
const graceBlock = player.slice(graceStart, graceStart + 3200);
assert.ok(graceBlock.includes('haloA * 0.72'), 'deathbomb grace rim draw block present');

// Dark under-rim separates same-hue bloom before accent strokes.
assert.match(graceBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(graceBlock, /const arcA = 0\.4 \+ urg \* 0\.5/);
assert.match(graceBlock, /const ringA = 0\.28 \+ urg \* 0\.35/);
assert.match(graceBlock, /const haloA = \(0\.18 \+ urg \* 0\.22\) \* ratio/);

// Accent widths frozen (teach 3.5 / 3, outer 2.5, halo 1.5).
assert.match(graceBlock, /ctx\.lineWidth = teach \? 3\.5 : 3/);
assert.match(graceBlock, /ctx\.lineWidth = 2\.5/);
assert.match(graceBlock, /ctx\.lineWidth = 1\.5/);

// Tip edge cool cream on countdown / presence / halo.
assert.ok(
  (graceBlock.match(/strokeStyle = '#fffef8'/g) || []).length >= 3,
  'tip edge on countdown + presence + halo',
);
assert.match(graceBlock, /arcA \* 0\.72/);
assert.match(graceBlock, /ringA \* 0\.72/);
assert.match(graceBlock, /haloA \* 0\.72/);

// Geometry radii frozen (cue only — not larger hit / longer grace).
assert.match(graceBlock, /rInner/);
assert.match(graceBlock, /this\.x, this\.y, 38/);
assert.match(graceBlock, /this\.x, this\.y, 44/);

// Old single-stroke stack must be gone (no under-rim before accent).
assert.ok(
  !/ctx\.globalAlpha = 0\.4 \+ urg \* 0\.5;\s*\n\s*ctx\.strokeStyle = accent;\s*\n\s*ctx\.lineWidth = teach \? 3\.5 : 3;/.test(player),
  'old single-stroke countdown stack must be gone',
);

// dens / tip grit path frozen (tick25/52).
assert.match(player, /const moteN = teach \? 8 : 6/);
assert.match(
  player,
  /stretch = fine \? 2\.65 \+ \(i % 3\) \* 0\.4 : 1\.78 \+ \(i % 2\) \* 0\.35/,
);

// Prior rim densify ships retained.
assert.match(
  readFileSync(join(root, 'js/player.js'), 'utf8'),
  /Solid core — dark under-rim \+ tip edge keep the focus hitbox/,
);
assert.match(
  readFileSync(join(root, 'js/powerup.js'), 'utf8'),
  /Rotating dashed ring telegraph — dark under-rim \+ tip edge keep the/,
);

console.log('qa-deathbomb-rim: PASS');
