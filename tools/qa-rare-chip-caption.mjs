/**
 * Tick93: in-run RARE sortie chip caption dual-stroke
 * — soft fillText muddy under pulse alpha vs deathbomb/wave HUD stroke language.
 * Plate geometry / accent bar / pulse / HOLD dens / prior captions frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');
const enemy = readFileSync(join(root, 'js/enemy.js'), 'utf8');

assert.match(
  game,
  /Caption dual-stroke: dark outer \+ cool rim so pulse alpha never muddies RARE chip/,
  'RARE chip dual-stroke comment',
);

assert.match(game, /strokeText\('RARE'/);
assert.match(game, /fillText\('RARE'/);
assert.ok(
  (game.match(/strokeText\('RARE'/g) || []).length >= 2,
  'RARE dark outer + cool rim strokes',
);
assert.match(game, /strokeText\(label, 50, 52\)/);
assert.match(game, /fillText\(label, 50, 52\)/);
assert.ok(
  (game.match(/strokeText\(label, 50, 52\)/g) || []).length >= 2,
  'RARE name dark outer + cool rim strokes',
);
assert.match(game, /fillStyle = '#f4f0ff'/);
assert.match(game, /strokeStyle = 'rgba\(8, 10, 20, 0\.88\)'/);
assert.match(game, /strokeStyle = 'rgba\(200, 180, 255, 0\.4\)'/);

// Plate + accent bar + pulse retained (no structure churn).
assert.match(game, /Rare sortie chip — small in-run identity cue/);
assert.match(game, /ctx\.fillRect\(12, 42, 128, 20\)/);
assert.match(game, /ctx\.fillRect\(12, 42, 3, 20\)/);
assert.match(game, /0\.78 \+ 0\.22 \* Math\.abs\(Math\.sin\(performance\.now\(\) \* 0\.0035\)\)/);
assert.match(game, /globalAlpha = 0\.88 \* pulse/);

// Prior canvas caption dual-strokes stay.
assert.match(game, /Caption dual-stroke: dark outer \+ cyan rim so plate\/world never muddies stageLabel/);
assert.match(game, /Caption dual-stroke: dark outer \+ amber\/rose rim so pulse bar never muddies title\/sub/);
assert.match(game, /Caption dual-stroke: kind chip \+ subtitle/);
assert.match(
  enemy,
  /Caption dual-stroke: dark outer \+ amber rim so boss glow\/sprite never muddies CORE OPEN/,
);

console.log('qa-rare-chip-caption: PASS');
