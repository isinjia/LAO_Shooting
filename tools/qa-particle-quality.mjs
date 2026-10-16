/**
 * Tick48 + tick59: soft-sprite particle quality — trail stretch / color ramp / hit grit.
 * Tick59: hitSpark tip-forward stretch + cool #fffef8 (graze/wipe parity; no dens churn).
 * HOLD dens/side/emit counts must stay frozen (no silhouette churn).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PolishFx } from '../js/polish-fx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const shotFx = fs.readFileSync(path.join(root, 'js/shot-fx.js'), 'utf8');
const polishFx = fs.readFileSync(path.join(root, 'js/polish-fx.js'), 'utf8');

// --- Source: trail color ramp + stretch language (soft-sprite only) ---
assert.match(shotFx, /function trailColor/, 'trailColor helper');
assert.match(shotFx, /if \(t < 0\.18\) return core/, 'tip-hot trail band');
assert.match(shotFx, /if \(t > 0\.78\) return glow/, 'cool trail band');
assert.match(shotFx, /len \* 1\.12/, 'softStreak stretch aspect');
assert.match(shotFx, /thick \* 0\.32/, 'softStreak tip-forward white core');
assert.match(shotFx, /streakBias/, 'near-tip streak bias in trailMotes');
assert.match(shotFx, /fine \? \(2\.35/, 'fine grit trail stretch mul');
assert.doesNotMatch(shotFx, /\bctx\.(lineTo|rect|strokeRect|fillRect)\s*\(/, 'no geometry path calls in shot-fx');

// HOLD dens/side/emit frozen — identity counts & spreads (tick48 must not churn).
assert.match(shotFx, /holdFan \? 14/, 'fan trailN');
assert.match(shotFx, /holdCrescent \? 9/, 'crescent trailN');
assert.match(shotFx, /holdAxe \? 7/, 'axe trailN');
assert.match(shotFx, /holdSpike \? 4/, 'spike trailN');
assert.match(shotFx, /holdHmg \? 12/, 'hmg trailN');
assert.match(shotFx, /holdArty \? 5/, 'arty trailN');
assert.match(shotFx, /holdFan \? 2\.42/, 'fan spread');
assert.match(shotFx, /holdCrescent \? 1\.48/, 'crescent spread');
assert.match(shotFx, /holdSpike \? 0\.12/, 'spike spread');
assert.match(shotFx, /for \(let i = 0; i < 5; i\+\+\) \{\s*const s = i % 2 \? 1 : -1;\s*softStreak\(ctx, -r \* \(0\.22/, 'hmg side grit dens');
assert.match(shotFx, /for \(let i = 0; i < 4; i\+\+\) \{\s*const s = i % 2 \? 1 : -1;\s*softStreak\(ctx, -r \* \(0\.48/, 'axe side grit dens');
assert.match(shotFx, /const n = b\.specialLevel >= 3 \? 7 : 5;/, 'hold tip cloud dens');

// Draw ramp + stretch in polish-fx
assert.match(polishFx, /a > 0\.78\) col = p\.rampHot/, 'draw hot ramp band');
assert.match(polishFx, /Math\.min\(2\.15, spd \* 0\.01\)/, 'velocity stretch boost');
assert.match(polishFx, /rad \* 0\.28/, 'spark tip-forward core');
assert.match(
  polishFx,
  /hitSpark\(x, y, n = 5\)[\s\S]*?stretch: smoke \? 1 : \(fine \? 2\.65 \+ Math\.random\(\) \* 2\.4 : 1\.85 \+ Math\.random\(\) \* 1\.6\)/,
  'hitSpark tip-forward stretch',
);
assert.match(
  polishFx,
  /hitSpark\(x, y, n = 5\)[\s\S]*?rampHot: '#fffef8'/,
  'hitSpark tip rampHot #fffef8',
);
assert.match(
  polishFx,
  /hitSpark\(x, y, n = 5\)[\s\S]*?count \/ fine \/ drag frozen — tip-forward stretch \+ cool #fffef8/,
  'hitSpark tip/cool comment',
);
assert.match(
  polishFx,
  /Math\.max\(4, Math\.round\(n \* 1\.65 \* scale/,
  'hitSpark count budget frozen',
);

// --- Runtime: hitSpark grit mix ---
const fx = new PolishFx();
fx.setKitPalette({ color: '#9ef0ff', glow: '#5ad0ff', style: 'orb' });
fx.clear();
fx.hitSpark(200, 240, 6);
const sparks = fx.active.filter((p) => p.kind === 'spark');
const fine = sparks.filter((p) => p.r < 1.3);
const stretchOk = sparks.filter((p) => (p.stretch || 1) >= 2);
const hasRamp = sparks.every((p) => p.rampHot === '#fffef8' && p.rampCool);
const tipHot = sparks.filter((p) => p.rampHot === '#fffef8' || p.color === '#fffef8');
const coolFlash = fx.active.some((p) => p.kind === 'flash' && p.color === '#fffef8' && p.r <= 6);
const maxStretch = Math.max(0, ...sparks.map((p) => p.stretch || 1));

assert(sparks.length >= 4, `hitSpark sparks expected, got ${sparks.length}`);
assert(fine.length >= 2, `hitSpark fine grit expected, got ${fine.length}`);
assert(stretchOk.length >= 2, `hitSpark stretch≥2 expected, got ${stretchOk.length}`);
assert(maxStretch >= 2.5, `hitSpark maxStretch≥2.5, got ${maxStretch}`);
assert(hasRamp, 'hitSpark sparks should ramp #fffef8→cool');
assert(tipHot.length >= 1, `hitSpark tipHot #fffef8 expected, got ${tipHot.length}`);
assert(coolFlash, 'hitSpark cool tip flash #fffef8 expected');

// Advance + draw must not throw (soft arcs only).
for (let i = 0; i < 4; i++) fx.tick(1 / 60);
const calls = { arc: 0, moveTo: 0, lineTo: 0 };
const ctx = {
  save() {}, restore() {},
  beginPath() {}, closePath() {}, fill() {}, stroke() {},
  fillText() {}, strokeText() {}, fillRect() {}, strokeRect() {},
  translate() {}, rotate() {}, scale() {},
  setLineDash() {},
  createRadialTemplate() {},
  createRadialGradient() { return { addColorStop() {} }; },
  createLinearGradient() { return { addColorStop() {} }; },
  arc() { calls.arc += 1; },
  moveTo() { calls.moveTo += 1; },
  lineTo() { calls.lineTo += 1; },
  quadraticCurveTo() {},
  ellipse() { calls.arc += 1; },
  clip() {},
};
fx.draw(ctx);
assert(calls.arc >= 8, `soft-sprite arcs expected in hit draw, got ${calls.arc}`);
assert.equal(calls.lineTo, 0, 'no line geometry in particle draw');

// --- Runtime: notePlayerHit tip-forward rose shatter (n budget frozen) ---
assert.match(
  polishFx,
  /fine \? 2\.65 \+ Math\.random\(\) \* 2\.6 : 1\.85 \+ Math\.random\(\) \* 2\.0/,
  'player-hit tip-forward stretch',
);
assert.match(polishFx, /rampHot: '#fffef8'/, 'player-hit tip rampHot');
assert.match(
  polishFx,
  /const n = Math\.max\(8, Math\.round\(18 \* scale \* loadMul\)\)/,
  'player-hit n budget frozen',
);

fx.clear();
fx.notePlayerHit(200, 240);
const phSparks = fx.active.filter((p) => p.kind === 'spark');
const phRose = fx.active.filter((p) => {
  const c = String(p.color || '');
  return c.includes('ff6b8a') || c.includes('ff7a96') || c.includes('ffe8ee')
    || c.includes('b86880') || c.includes('c87890');
});
const phWhite = fx.active.filter((p) => {
  const c = String(p.color || '');
  return c === '#ffffff' || c === '#fff8f2' || c === '#fffef8' || p.rampHot === '#fffef8';
});
const phMaxStretch = Math.max(0, ...phSparks.map((p) => p.stretch || 1));
assert(fx.active.length >= 8, `player-hit active expected, got ${fx.active.length}`);
assert(phRose.length >= 2, `player-hit rose expected, got ${phRose.length}`);
assert(phWhite.length >= 2, `player-hit cool-white tips expected, got ${phWhite.length}`);
assert(phMaxStretch >= 2.5, `player-hit maxStretch≥2.5, got ${phMaxStretch}`);

console.log(JSON.stringify({
  ok: true,
  hit: {
    sparks: sparks.length,
    fine: fine.length,
    stretchOk: stretchOk.length,
    maxStretch: Number(maxStretch.toFixed(2)),
    hasRamp,
    tipHot: tipHot.length,
    coolFlash,
    drawArcs: calls.arc,
  },
  playerHit: {
    active: fx.active.length,
    sparks: phSparks.length,
    rose: phRose.length,
    white: phWhite.length,
    maxStretch: Number(phMaxStretch.toFixed(2)),
  },
  holdDensFrozen: true,
}, null, 2));
