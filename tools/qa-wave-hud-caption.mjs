/**
 * Tick91: in-run wave HUD caption dual-stroke
 * (stageLabel + route subtitle) — soft fillText muddy vs ceremony/HUD stroke language.
 * Plate geometry / route track / HOLD dens / ceremony captions frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

assert.match(
  game,
  /Caption dual-stroke: dark outer \+ cyan rim so plate\/world never muddies stageLabel/,
  'wave HUD stageLabel dual-stroke comment',
);
assert.match(
  game,
  /Caption dual-stroke: route subtitle floats above track with no plate/,
  'wave HUD route subtitle dual-stroke comment',
);

assert.match(game, /const stageLabel = t\('hud\.stageN'/);
assert.match(game, /strokeText\(stageLabel/);
assert.match(game, /fillText\(stageLabel/);
assert.ok(
  (game.match(/strokeText\(stageLabel/g) || []).length >= 2,
  'stageLabel dark outer + cyan rim strokes',
);

assert.match(game, /strokeText\(stage\.subtitle/);
assert.match(game, /fillText\(stage\.subtitle/);
assert.ok(
  (game.match(/strokeText\(stage\.subtitle/g) || []).length >= 2,
  'route subtitle dark outer + cyan rim strokes',
);

// Plate + route track retained (no structure churn).
assert.match(game, /ctx\.fillRect\(W \/ 2 - labelW \/ 2, 14, labelW, 22\)/);
assert.match(game, /Route strip shows real distance/);
assert.match(game, /ctx\.fillRect\(trackX - 2, H - 18, 294, 11\)/);

// Prior caption dual-strokes stay.
assert.match(game, /Caption dual-stroke: dark outer \+ amber\/rose rim so pulse bar never muddies title\/sub/);
assert.match(game, /Caption dual-stroke: kind chip \+ subtitle/);

console.log('qa-wave-hud-caption: PASS');
