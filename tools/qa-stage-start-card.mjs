/**
 * Tick33: STAGE START card polish — cyan wash, soft-sprite grit,
 * dual stroke, START kind chip; ceremony set retained.
 * CLEAR brass/gold path retained; HOLD dens/side untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

// Ceremony set still WARNING + START + CLEAR only.
assert.match(game, /Ceremony cards: WARNING \+ stage START \+ stage CLEAR only/);
assert.match(game, /const isStageStart = this\.stagePhase === 'waves'/);
assert.match(game, /\^STAGE\\s\+\\d\+/);

// START cyan identity retained (not brass-forced).
assert.match(game, /: '#00e8c8'/);
assert.match(game, /STAGE START: soft cyan wash peek/);
assert.match(game, /rgba\(0, 232, 200,/);

// START card taller for kind-chip stack (parity with CLEAR title rhythm).
assert.match(game, /const cardH = isStageClear \? 148 : 118/);
assert.match(game, /isStageClear \? 62 : 52/);

// Soft grit + white tip cores, stretch ≥1.55, cyan tint, no geometry marks.
assert.match(game, /Soft-sprite grit inside START card/);
assert.match(game, /for \(let i = 0; i < 6; i\+\+\)/);
assert.match(game, /const stretch = 1\.55/);
assert.match(game, /rgba\(255, 252, 245/);

const startBlock = game.match(/Soft-sprite grit inside START card[\s\S]{0,900}/)?.[0] || '';
assert.ok(startBlock.length > 100, 'START grit block present');
assert.ok(!/clip-path:\s*polygon|zigzag|gear|slash|cross/i.test(startBlock),
  'START grit avoids geometry marks');
assert.ok(/ellipse\(/.test(startBlock), 'START grit uses soft ellipses');

// Dual stroke + START kind chip readability.
assert.match(game, /Dual stroke: dark outer \+ cyan rim/);
assert.match(game, /strokeStyle = 'rgba\(4, 16, 18, 0\.88\)'/);
assert.match(game, /strokeStyle = 'rgba\(0, 232, 200, 0\.5\)'/);
assert.match(game, /fillText\('START'/);
assert.match(game, /Kind chip — START read/);
// Tick89: caption dual-stroke (chip + subtitle) — title wash parity.
assert.match(game, /Caption dual-stroke: kind chip \+ subtitle/);
assert.match(game, /strokeText\('START'/);
assert.match(game, /const cardSub = isStageStart \? '' : \(this\.stageSubtitle \|\| ''\)/);
assert.match(game, /t\('hud\.stageN'/);
assert.match(game, /strokeText\(cardSub/);

// CLEAR polish retained (tick30) — brass/gold split + CLEAR grit count.
assert.match(game, /Soft-sprite grit inside CLEAR card/);
assert.match(game, /const chip = isFinaleClear \? 'ALL' : 'CLEAR'/);
assert.match(game, /Dual stroke: dark outer \+ brass\/gold rim/);

console.log(
  'PASS qa-stage-start-card:',
  'cyanWash+grit=6 stretch≥1.55 tips',
  'dualStroke+START chip',
  'cardH=118',
  'ceremony set retained',
  'CLEAR brass/gold kept'
);
