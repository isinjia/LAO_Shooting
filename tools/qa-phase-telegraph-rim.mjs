/**
 * Tick101: boss phase telegraph rim readability — dark under-rim + tip edge
 * so pale stage accents don't merge into neon wash (no dens / pattern churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');
const stage = readFileSync(join(root, 'js/stage-plan.js'), 'utf8');

// Live muddy pair: pale stage accents feed the telegraph strokeStyle.
assert.match(stage, /color:\s*'#9cc7ff'[\s\S]{0,80}bossStyle:\s*'machine'/);
assert.match(stage, /color:\s*'#74d4ff'[\s\S]{0,80}bossStyle:\s*'program'/);
assert.match(game, /const col = stage\.color \|\| '#ffe08a'/);

// Dark under-rim separates same-hue stage wash before accent stroke.
assert.match(game, /rgba\(12, 8, 18, 0\.78\)/);
assert.match(game, /ctx\.lineWidth = 22/);
assert.match(game, /ctx\.strokeRect\(2, 2, W - 4, H - 4\)/);

// Accent wash slightly stronger than old soft 0.22 blob; mid + tip densified.
assert.match(game, /ctx\.globalAlpha = a \* 0\.34/);
assert.match(game, /ctx\.lineWidth = 3\.5/);
assert.match(game, /ctx\.strokeStyle = '#fffef8'/);
assert.match(game, /ctx\.globalAlpha = a \* 0\.72/);
assert.match(game, /ctx\.lineWidth = 1\.55/);
assert.ok(!/ctx\.globalAlpha = a \* 0\.22/.test(game.match(/_phaseTelegraph > 0 && this\.boss\?\.alive[\s\S]{0,600}/)?.[0] || ''),
  'old soft outer alpha 0.22 must be gone from phase telegraph');
assert.ok(!/strokeStyle = '#fff4d8'/.test(game.match(/_phaseTelegraph > 0 && this\.boss\?\.alive[\s\S]{0,600}/)?.[0] || ''),
  'old soft tip #fff4d8 must be gone from phase telegraph');

// Fairness: duration / trigger unchanged (pattern swap cue only — no difficulty).
assert.match(game, /this\._phaseTelegraph = 0\.55/);
assert.match(game, /Math\.min\(1, this\._phaseTelegraph \/ 0\.25\) \* 0\.55/);

console.log('qa-phase-telegraph-rim: PASS');
