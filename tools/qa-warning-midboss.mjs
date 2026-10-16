/**
 * Tick29: WARNING / midboss pulse readability — mid brass vs boss crimson,
 * soft-sprite band grit, dual stroke, kind chip; ceremony set retained.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

// Ceremony set still WARNING + START + CLEAR only.
assert.match(game, /Ceremony cards: WARNING \+ stage START \+ stage CLEAR only/);
assert.match(game, /stagePhase === 'mid-windup' \|\| this\.stagePhase === 'boss-windup'/);
assert.match(game, /MIDBOSS SIGNATURE/);
assert.match(game, /FINAL TARGET DETECTED/);

// Mid vs boss palette split on WARNING card.
assert.match(game, /const isBossWarn = this\.warningKind === 'boss'/);
assert.match(game, /pulseRate = isBossWarn \? 14 : 11/);
assert.match(game, /rgba\(22, 14, 6/); // mid band base
assert.match(game, /rgba\(28, 4, 10/); // boss band base
assert.match(game, /rgba\(255, 170, 60/); // mid wash
assert.match(game, /rgba\(255, 70, 80/); // boss wash
assert.match(game, /rgba\(212, 162, 74/); // mid edge (matches boss-bar.is-mid)

// Soft grit + white tip cores, stretch ≥1.55, no geometry marks.
assert.match(game, /globalCompositeOperation = 'screen'/);
assert.match(game, /for \(let i = 0; i < 8; i\+\+\)/);
assert.match(game, /const stretch = 1\.55/);
assert.match(game, /ctx\.ellipse\(/);
assert.match(game, /rgba\(255, 252, 245/); // tip core
assert.ok(!/clip-path:\s*polygon|zigzag|gear/i.test(game.match(/if \(warning\) \{[\s\S]{0,3500}/)?.[0] || ''),
  'WARNING block avoids geometry marks');

// Dual stroke + kind chip readability.
assert.match(game, /lineWidth = 8/);
assert.match(game, /lineWidth = 3/);
assert.match(game, /const chip = isBossWarn \? 'FINAL' : 'MID'/);
assert.match(game, /strokeText\('WARNING'/);
assert.match(game, /fillText\('WARNING'/);
// Tick89: caption dual-stroke (chip + subtitle) — title wash parity.
assert.match(game, /Caption dual-stroke: dark outer \+ kind rim/);
assert.match(game, /strokeText\(chip/);
assert.match(game, /const warnSub = this\.stageSubtitle/);
assert.match(game, /strokeText\(warnSub/);

// Midboss HP bar pulse (CSS) — brass frame readability during fight.
assert.match(css, /#boss-bar\.is-mid \.boss-frame/);
assert.match(css, /@keyframes midboss-frame-pulse/);
assert.match(css, /animation:\s*midboss-frame-pulse/);
assert.match(css, /rgba\(212, 162, 74/);

console.log(
  'PASS qa-warning-midboss:',
  'midBrass+bossCrimson',
  'grit=8 stretch≥1.55 tips',
  'dualStroke+kindChip',
  'midboss-frame-pulse',
  'ceremony set retained'
);
