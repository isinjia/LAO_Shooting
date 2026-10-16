/**
 * Tick102: boss CORE OPEN expose ellipse rim readability —
 * dark under-rim + tip edge so soft gold ring doesn't merge into
 * brass/neon wash + boss glow (no dens / expose-window churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const enemy = readFileSync(join(root, 'js/enemy.js'), 'utf8');

const exposeBlock = enemy.match(
  /this\.alive && this\.kind === 'boss' && this\.exposedFor > 0[\s\S]{0,1200}/,
)?.[0] || '';

assert.ok(exposeBlock.length > 200, 'expose draw block present');

// Muddy evidence: soft gold accent alone used to be the only ring stroke.
assert.match(exposeBlock, /strokeStyle = '#ffe28a'/);
assert.match(exposeBlock, /dark under-rim \+ tip edge/);

// Dark under-rim separates brass/neon wash before accent stroke.
assert.match(exposeBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(exposeBlock, /ctx\.lineWidth = 7/);

// Accent slightly denser than old lw 4 soft blob; tip edge cool cream.
assert.match(exposeBlock, /ctx\.lineWidth = 4\.5/);
assert.match(exposeBlock, /strokeStyle = '#fffef8'/);
assert.match(exposeBlock, /ctx\.lineWidth = 1\.6/);
assert.match(exposeBlock, /ctx\.globalAlpha = a \* 0\.78/);

// Old single-stroke stack must be gone (no bare lw4-only gold ring).
assert.ok(
  !/strokeStyle = '#ffe28a';\s*ctx\.lineWidth = 4;/.test(exposeBlock),
  'old soft single-stroke lw4 gold ring must be gone',
);

// Fairness: ellipse geometry + fade + expose windows unchanged (cue only).
assert.match(enemy, /this\.drawSize \* 0\.32/);
assert.match(enemy, /this\.drawSize \* 0\.36/);
assert.match(enemy, /Math\.min\(1, this\.exposedFor \* 1\.8\)/);
assert.match(enemy, /this\.exposedFor = 1\.25/);
assert.match(enemy, /this\.exposedFor = 1\.15/);

// Caption dual-stroke (tick92) retained — this tick is rim-only.
assert.match(
  enemy,
  /Caption dual-stroke: dark outer \+ amber rim so boss glow\/sprite never muddies CORE OPEN/,
);
assert.ok(
  (enemy.match(/strokeText\('CORE OPEN'/g) || []).length >= 2,
  'CORE OPEN dark outer + amber rim strokes',
);

console.log('qa-core-open-rim: PASS');
