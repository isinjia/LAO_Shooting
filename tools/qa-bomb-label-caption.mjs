/**
 * Tick94: bomb cast identity label caption dual-stroke
 * — soft offset fillText muddy under fade alpha vs deathbomb/RARE stroke language.
 * Plate geometry / accent bar / fade / cast budget / HOLD dens / prior captions frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bomb = readFileSync(join(root, 'js/bomb-vfx.js'), 'utf8');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');
const enemy = readFileSync(join(root, 'js/enemy.js'), 'utf8');

assert.match(
  bomb,
  /Caption dual-stroke: dark outer \+ cool cream rim so fade alpha never muddies bomb identity/,
  'bomb label dual-stroke comment',
);

assert.match(bomb, /strokeText\(profile\.label/);
assert.match(bomb, /fillText\(profile\.label/);
assert.ok(
  (bomb.match(/strokeText\(profile\.label/g) || []).length >= 2,
  'bomb label dark outer + cool cream rim strokes',
);
assert.match(bomb, /fillStyle = '#fff6e8'/);
assert.match(bomb, /strokeStyle = 'rgba\(8, 10, 18, 0\.88\)'/);
assert.match(bomb, /strokeStyle = 'rgba\(255, 230, 180, 0\.4\)'/);

// Soft offset fill shadow removed (muddy under fade alpha).
assert.doesNotMatch(
  bomb,
  /fillStyle = 'rgba\(0,0,0,\.55\)'[\s\S]{0,80}fillText\(profile\.label/,
  'no soft offset fill shadow on bomb label',
);

// Plate + accent + fade retained (no structure churn).
assert.match(bomb, /drawLabel\(ctx, time\)/);
assert.match(bomb, /const y = 402/);
assert.match(bomb, /const x = 280/);
assert.match(bomb, /const w = 400/);
assert.match(bomb, /const h = 44/);
assert.match(bomb, /fillStyle = 'rgba\(6,10,18,\.94\)'/);
assert.match(bomb, /fillRect\(x, y, 5, h\)/);
assert.match(bomb, /clamp\(t \/ \.08\) \* clamp\(\(1\.1 - t\) \/ \.3\)/);
assert.match(bomb, /let budget = light \? 260 : 520/);

// Prior canvas caption dual-strokes stay.
assert.match(game, /Caption dual-stroke: dark outer \+ cool rim so pulse alpha never muddies RARE chip/);
assert.match(game, /Caption dual-stroke: dark outer \+ cyan rim so plate\/world never muddies stageLabel/);
assert.match(game, /Caption dual-stroke: dark outer \+ amber\/rose rim so pulse bar never muddies title\/sub/);
assert.match(
  enemy,
  /Caption dual-stroke: dark outer \+ amber rim so boss glow\/sprite never muddies CORE OPEN/,
);

console.log('qa-bomb-label-caption: PASS');
