/**
 * Tick92: boss CORE OPEN expose caption dual-stroke
 * — soft fillText muddy over gold ellipse glow / sprite.
 * Ellipse geometry / expose window / HOLD dens / prior captions frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const enemy = readFileSync(join(root, 'js/enemy.js'), 'utf8');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

assert.match(
  enemy,
  /Caption dual-stroke: dark outer \+ amber rim so boss glow\/sprite never muddies CORE OPEN/,
  'CORE OPEN dual-stroke comment',
);

assert.match(enemy, /strokeText\('CORE OPEN'/);
assert.match(enemy, /fillText\('CORE OPEN'/);
assert.ok(
  (enemy.match(/strokeText\('CORE OPEN'/g) || []).length >= 2,
  'CORE OPEN dark outer + amber rim strokes',
);
assert.match(enemy, /fillStyle = '#fff2b8'/);
assert.match(enemy, /strokeStyle = 'rgba\(18, 12, 4, 0\.88\)'/);
assert.match(enemy, /strokeStyle = 'rgba\(255, 214, 120, 0\.42\)'/);

// Expose ellipse + window retained (no structure churn).
// Tick102: rim stack uses rx/ry locals — geometry multipliers stay 0.32 / 0.36.
assert.match(enemy, /this\.drawSize \* 0\.32/);
assert.match(enemy, /this\.drawSize \* 0\.36/);
assert.match(enemy, /strokeStyle = '#ffe28a'/);
assert.match(enemy, /this\.exposedFor > 0/);
assert.match(enemy, /this\.exposedFor = 1\.25/);

// Prior canvas caption dual-strokes stay.
assert.match(game, /Caption dual-stroke: dark outer \+ cyan rim so plate\/world never muddies stageLabel/);
assert.match(game, /Caption dual-stroke: dark outer \+ amber\/rose rim so pulse bar never muddies title\/sub/);
assert.match(game, /Caption dual-stroke: kind chip \+ subtitle/);

console.log('qa-core-open-caption: PASS');
