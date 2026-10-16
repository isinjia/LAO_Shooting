/**
 * Enemy bullets: unified red/white circular orbs (spawn color ignored for paint).
 * Pattern spawn colors stay (telegraph identity in data); draw path is shared orb.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bullet = readFileSync(join(root, 'js/bullet.js'), 'utf8');
const enemy = readFileSync(join(root, 'js/enemy.js'), 'utf8');
const stage = readFileSync(join(root, 'js/stage-plan.js'), 'utf8');

// Live muddy pair still present in spawn data (paint no longer uses color).
assert.match(stage, /color:\s*'#9cc7ff'[\s\S]{0,80}bossStyle:\s*'machine'/);
assert.match(enemy, /color:\s*'#9cc7ff'/);
assert.match(enemy, /color:\s*'#ffffff',\s*r:\s*3\.5/);

// Shared red/white orb helper + cached soft sprites.
assert.match(bullet, /function drawEnemyOrb/);
assert.match(bullet, /function ensureEnemyOrbSprite/);
assert.match(bullet, /ENEMY_ORB_PALETTE/);
assert.match(bullet, /core:\s*'#ffffff'/);
assert.match(bullet, /rim:\s*'#ff3a12'/);
assert.match(bullet, /drawEnemyOrb\(ctx, this\.x, this\.y, this\.r, opts\)/);
assert.ok(!/function hostileBodyColor/.test(bullet), 'per-color hostileBodyColor must be gone');
assert.ok(!/Rice\/pellet/.test(bullet), 'rice/pellet silhouette must be gone');
assert.ok(!/quadraticCurveTo/.test(bullet), 'oriented pellet path must be gone');

// Dense fields still switch to tight bake.
assert.match(bullet, /enemyLive > 110 \? \{ skipHalo: true \}/);
assert.match(bullet, /ensureEnemyOrbSprite\(skipHalo\)/);

// Fairness: patterns untouched (no delay invent / no ring count churn in this pass).
assert.match(enemy, /fireAimed\(bullets, this\.x, this\.y \+ 28, player\.x, player\.y, sp\(260\), \{ color: '#ffffff', r: 3\.5 \}\)/);
assert.match(enemy, /fireSpreadLeft\(bullets, this\.x, this\.y \+ 24, 4, speed, \{ color: '#9cc7ff', r: 4 \}\)/);

// Player path stays distinct.
assert.match(bullet, /_drawFriendly\(ctx\)/);
assert.match(bullet, /drawCharacterShot\(ctx, this\)/);

console.log('qa-enemy-bullet-telegraph: PASS');
