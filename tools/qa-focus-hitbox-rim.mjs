/**
 * Tick106: focus hitbox solid-core rim readability —
 * dark under-rim + tip edge so thin white ring doesn't merge into
 * pale-cyan neon wash (no dens / bloom / hitR churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const player = readFileSync(join(root, 'js/player.js'), 'utf8');

const focusBlock = player.match(
  /Solid core — dark under-rim \+ tip edge keep the focus hitbox[\s\S]{0,1400}?ctx\.fill\(\);\s*\n\s*\}/,
)?.[0] || '';

assert.ok(focusBlock.length > 200, 'focus hitbox rim draw block present');

// Muddy evidence: single soft white stroke used to be the only core ring.
assert.match(focusBlock, /rgba\(255,255,255,0\.95\)/);
assert.match(focusBlock, /focus hitbox/);

// Dark under-rim separates pale-cyan neon wash before accent stroke.
assert.match(focusBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(focusBlock, /ctx\.lineWidth = 3\.5/);

// Accent denser than old lw 1.5 soft white; tip edge cool cream.
assert.match(focusBlock, /ctx\.lineWidth = 2/);
assert.match(focusBlock, /strokeStyle = '#fffef8'/);
assert.match(focusBlock, /ctx\.globalAlpha = 0\.72 \* invulnA/);
assert.match(focusBlock, /ctx\.lineWidth = 1\.1/);

// Old single-stroke stack must be gone.
assert.ok(
  !/Solid core stays fully readable even while the body ghosts/.test(player),
  'old solid-core comment must be gone',
);
assert.ok(
  !/strokeStyle = 'rgba\(255,255,255,0\.9\)';\s*\n\s*ctx\.lineWidth = 1\.5;/.test(player),
  'old soft single-stroke lw1.5 white rim must be gone',
);

// Fairness: hitbox radius geometry frozen (cue only — not larger hitR).
assert.match(focusBlock, /hr \+ 1/);
assert.match(focusBlock, /ctx\.arc\(hx, hy, hr,/);

// dens / bloom path frozen (tick27/52).
assert.match(player, /const moteN = 5;/);
assert.match(player, /hr \+ 10/);
assert.match(player, /hr \+ 7\.5/);

// Prior rim densify ships retained.
assert.match(
  readFileSync(join(root, 'js/powerup.js'), 'utf8'),
  /Rotating dashed ring telegraph — dark under-rim \+ tip edge keep the/,
);
assert.match(
  readFileSync(join(root, 'js/enemy.js'), 'utf8'),
  /dark under-rim \+ tip edge keep the power-carrier telegraph/,
);

console.log('qa-focus-hitbox-rim: PASS');
