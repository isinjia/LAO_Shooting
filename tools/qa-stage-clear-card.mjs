/**
 * Tick30: STAGE CLEAR card polish — stage brass vs finale gold,
 * soft-sprite card grit, dual stroke, kind chip; ceremony set retained.
 * START cyan identity retained (tick33 adds START grit/chip separately);
 * HOLD dens/side untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

// Ceremony set still WARNING + START + CLEAR only.
assert.match(game, /Ceremony cards: WARNING \+ stage START \+ stage CLEAR only/);
assert.match(game, /const isStageClear = this\.stagePhase === 'transition'/);
assert.match(game, /STAGE CLEAR' \|\| this\.stageTitle === 'ALL CLEAR'/);

// Stage vs finale palette split on CLEAR card.
assert.match(game, /const isFinaleClear = isStageClear && !!this\._clearIsFinale/);
assert.match(game, /pulseRate = isFinaleClear \? 12 : 9/);
assert.match(game, /rgba\(18, 12, 6/); // finale panel base
assert.match(game, /rgba\(12, 10, 8/); // stage panel base
assert.match(game, /rgba\(255, 210, 100/); // finale wash
assert.match(game, /rgba\(255, 200, 120/); // stage wash
assert.match(game, /rgba\(212, 162, 74/); // stage brass rim (matches midboss brass)

// Soft grit + white tip cores, stretch ≥1.55, no geometry marks in CLEAR grit.
assert.match(game, /Soft-sprite grit inside CLEAR card/);
assert.match(game, /globalCompositeOperation = 'screen'/);
assert.match(game, /for \(let i = 0; i < 8; i\+\+\)/);
assert.match(game, /const stretch = 1\.55/);
assert.match(game, /ctx\.ellipse\(/);
assert.match(game, /rgba\(255, 252, 245/); // tip core

const clearBlock = game.match(/Soft-sprite grit inside CLEAR card[\s\S]{0,1200}/)?.[0] || '';
assert.ok(clearBlock.length > 100, 'CLEAR grit block present');
assert.ok(!/clip-path:\s*polygon|zigzag|gear|slash|cross/i.test(clearBlock),
  'CLEAR grit avoids geometry marks');

// Dual stroke + kind chip readability.
assert.match(game, /Dual stroke: dark outer \+ brass\/gold rim/);
assert.match(game, /lineWidth = 7/);
assert.match(game, /lineWidth = 2\.5/);
assert.match(game, /const chip = isFinaleClear \? 'ALL' : 'CLEAR'/);
assert.match(game, /strokeText\(clearTitle/);
assert.match(game, /fillText\(clearTitle/);
// Tick89: caption dual-stroke (chip + subtitle + bonus) — title wash parity.
assert.match(game, /Caption dual-stroke: kind chip \+ subtitle/);
assert.match(game, /strokeText\(chip/);
assert.match(game, /const cardSub = this\.stageSubtitle \|\| stage\.name/);
assert.match(game, /strokeText\(cardSub/);
assert.match(game, /const bonusLine = `BONUS \+/);
assert.match(game, /strokeText\(bonusLine/);

// START cyan accent retained (not brass-forced).
assert.match(game, /: '#00e8c8'/);

console.log(
  'PASS qa-stage-clear-card:',
  'stageBrass+finaleGold',
  'grit=8 stretch≥1.55 tips',
  'dualStroke+kindChip',
  'ceremony set retained',
  'START cyan kept'
);
