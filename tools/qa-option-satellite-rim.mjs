/**
 * Tick110: option satellite / wing-tip chip readability —
 * dark under-rim + tip edge so soft kit-colored discs/diamonds don't merge
 * into pale-cyan neon wash + additive trails (no dens / orbit / moteN churn).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Player } from '../js/player.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const playerSrc = readFileSync(join(root, 'js/player.js'), 'utf8');

const chipBlock = playerSrc.match(
  /Satellite chip — dark under-rim \+ tip edge keep the option wing tip[\s\S]{0,1200}?ctx\.lineJoin = prevJoin;/,
)?.[0] || '';

assert.ok(chipBlock.length > 200, 'option satellite rim draw block present');

// Muddy evidence: soft kit fill alone used to be the only chip silhouette.
assert.match(chipBlock, /option wing tip/);
assert.match(chipBlock, /rgba\(12, 8, 18, 0\.82\)/);
assert.match(chipBlock, /ctx\.lineWidth = 3\.2/);

// Kit accent + cool cream tip edge (focus-hitbox peer language).
assert.match(chipBlock, /ctx\.lineWidth = 1\.8/);
assert.match(chipBlock, /strokeStyle = '#fffef8'/);
assert.match(chipBlock, /ctx\.globalAlpha = 0\.72 \* invulnA/);
assert.match(chipBlock, /ctx\.lineWidth = 1\.0/);

// Fairness: body / halo / tip / orbit / trail dens frozen (cue only).
assert.match(playerSrc, /ctx\.arc\(ox, oy, 5\.5, 0, Math\.PI \* 2\)/);
assert.match(playerSrc, /ctx\.arc\(ox, oy, 10, 0, Math\.PI \* 2\)/);
assert.match(playerSrc, /ctx\.arc\(ox, oy, 1\.8, 0, Math\.PI \* 2\)/);
assert.match(playerSrc, /const orbitY = 22 \* \(this\.focus \? 0\.55 : 1\)/);
assert.match(playerSrc, /const orbitX = 28/);
assert.match(playerSrc, /const moteN = rareOpt \? 5 : 4/);
assert.match(playerSrc, /const stretch = 1\.78 \+ m \* 0\.38/);

// Rare diamond chip path retained (no geometry invent / no return to new polygons).
assert.match(chipBlock, /oy - 6\.5/);
assert.match(chipBlock, /ox \+ 5\.5/);

// Runtime: Lv2 common + rare emit under-rim stack; Lv1 stays clean.
function makeCtx() {
  const calls = {
    stroke: 0,
    underRim: 0,
    tipEdge: 0,
    diamond: 0,
    scaleStretch: 0,
    ellipse: 0,
  };
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineJoin: 'miter',
    save() {},
    restore() {},
    beginPath() {},
    closePath() { calls.diamond += 1; },
    fill() {},
    stroke() {
      calls.stroke += 1;
      if (this.strokeStyle === 'rgba(12, 8, 18, 0.82)') calls.underRim += 1;
      if (this.strokeStyle === '#fffef8') calls.tipEdge += 1;
    },
    setLineDash() {},
    translate() {},
    rotate() {},
    scale(sx, sy) {
      if (sx >= 1.5 && sy === 1) calls.scaleStretch += 1;
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    arc() {},
    ellipse() { calls.ellipse += 1; },
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    clip() {},
  };
  return { ctx, calls };
}

function basePlayer(over = {}) {
  return Object.assign(Object.create(Player.prototype), {
    charKey: 'hirume',
    meta: { shot: { style: 'foxflame', color: '#ff9a4a', glow: '#9ef0ff' }, rare: false },
    alive: true,
    x: 120,
    y: 240,
    drawSize: 78,
    drawOffsetX: 0,
    drawOffsetY: 0,
    facing: 1,
    hitR: 4,
    focus: false,
    invuln: 0,
    shotLevel: 2,
    specialFlash: 0,
    lastSpecialLevel: 1,
    _t: 1.25,
    bombs: 2,
    deathBombMax: 0.28,
    deathBombFirstMax: 0.34,
    deathBombTimer: 0,
    _deathBombWindowMax: 0.28,
    deathBombOpens: 0,
    deathFlash: 0,
    respawnTimer: 0,
    anim: { state: 'idle', draw() {} },
    ...over,
  });
}

const lv2 = basePlayer({ shotLevel: 2 });
const lv2Run = makeCtx();
lv2.draw(lv2Run.ctx);
assert(lv2Run.calls.underRim >= 1, `Lv2 under-rim expected ≥1, got ${lv2Run.calls.underRim}`);
assert(lv2Run.calls.tipEdge >= 1, `Lv2 tip edge expected ≥1, got ${lv2Run.calls.tipEdge}`);
assert(lv2Run.calls.scaleStretch >= 4, 'trail moteN budget retained');

const rare = basePlayer({
  shotLevel: 2,
  meta: { shot: { glow: '#ffe08a', color: '#ff9a4a' }, rare: true },
});
const rareRun = makeCtx();
rare.draw(rareRun.ctx);
assert(rareRun.calls.underRim >= 1, 'rare under-rim present');
assert(rareRun.calls.tipEdge >= 1, 'rare tip edge present');
assert(rareRun.calls.diamond >= 1, 'rare diamond chip retained');

const lv1 = basePlayer({ shotLevel: 1 });
const lv1Run = makeCtx();
lv1.draw(lv1Run.ctx);
assert(lv1Run.calls.underRim === 0, 'Lv1 must not emit option rim');
assert(lv1Run.calls.scaleStretch === 0, 'Lv1 must not emit option trails');
assert(lv1Run.calls.ellipse === 0, 'Lv1 must not emit option bloom');

// Prior rim densify ships retained.
assert.match(
  readFileSync(join(root, 'js/player.js'), 'utf8'),
  /Solid core — dark under-rim \+ tip edge keep the focus hitbox/,
);
assert.match(
  readFileSync(join(root, 'js/powerup.js'), 'utf8'),
  /Rotating dashed ring telegraph — dark under-rim \+ tip edge keep the/,
);

console.log('qa-option-satellite-rim: PASS', {
  lv2: { underRim: lv2Run.calls.underRim, tipEdge: lv2Run.calls.tipEdge },
  rare: { underRim: rareRun.calls.underRim, tipEdge: rareRun.calls.tipEdge, diamond: rareRun.calls.diamond },
  lv1: { underRim: lv1Run.calls.underRim },
});
