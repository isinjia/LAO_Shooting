/**
 * Tick23/54/55: graze / pickup sparkle — tip-forward soft-sprite grit+needles, no diamond geometry.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PolishFx } from '../js/polish-fx.js';
import { PickupFeedback } from '../js/powerup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const polishFx = fs.readFileSync(path.join(root, 'js/polish-fx.js'), 'utf8');
const powerupSrc = fs.readFileSync(path.join(root, 'js/powerup.js'), 'utf8');

// --- Source: graze tip-forward + cool tip (n tiers frozen) ---
assert.match(
  polishFx,
  /let n = load > 0\.75 \? 1 : load > 0\.5 \? 3 : 6/,
  'graze n load tiers frozen',
);
assert.match(
  polishFx,
  /fine \? 2\.65 \+ Math\.random\(\) \* 2\.4 : 1\.85 \+ Math\.random\(\) \* 1\.6/,
  'graze tip-forward stretch',
);
assert.match(polishFx, /rampHot: '#fffef8'/, 'graze tip rampHot');
assert.match(
  polishFx,
  /i % 4 === 0 \? '#fffef8' : i % 2 === 0 \? cool : warm/,
  'graze cool-white tip chips',
);

// --- Source: pickup tip-forward + cool tip (n / POPUP_CAP frozen) ---
assert.match(powerupSrc, /const POPUP_CAP = 4/, 'pickup POPUP_CAP frozen');
assert.match(
  powerupSrc,
  /const baseN = kind === 'bomb' \? 16 : 18/,
  'pickup baseN frozen',
);
assert.match(
  powerupSrc,
  /Math\.max\(7, Math\.round\(baseN \* \(load > 0\.5 \? 0\.55 : 1\)\)\)/,
  'pickup n load tiers frozen',
);
assert.match(
  powerupSrc,
  /fine \? 2\.65 \+ Math\.random\(\) \* 2\.4 : 1\.85 \+ Math\.random\(\) \* 1\.6/,
  'pickup tip-forward stretch',
);
assert.match(
  powerupSrc,
  /i % 4 === 0 \? '#fffef8' : pal\.sparks\[i % pal\.sparks\.length\]/,
  'pickup cool-white tip chips',
);
assert.match(powerupSrc, /fillStyle = '#fffef8'/, 'pickup tip core #fffef8');
assert.match(powerupSrc, /rad \* 0\.28/, 'pickup tip-forward core offset');

const fx = new PolishFx();
fx.clear();
fx.grazeSpark(100, 200, null);
const graze = {
  active: fx.active.length,
  flash: fx.active.filter((p) => p.kind === 'flash').length,
  spark: fx.active.filter((p) => p.kind === 'spark').length,
  maxStretch: Math.max(0, ...fx.active.map((p) => p.stretch || 1)),
  hasRamp: fx.active.some((p) => p.rampHot && p.rampCool),
  tipHot: fx.active.filter((p) => p.rampHot === '#fffef8' || p.color === '#fffef8').length,
  fine: fx.active.filter((p) => p.kind === 'spark' && p.r < 1.3).length,
};
assert(graze.active >= 4, `graze should emit chips, got ${graze.active}`);
assert(graze.spark >= 4, `graze sparks expected, got ${graze.spark}`);
assert(graze.maxStretch >= 2.5, `graze tip stretch expected, got ${graze.maxStretch}`);
assert(graze.hasRamp, 'graze sparks should ramp hot→cool');
assert(graze.tipHot >= 1, `graze cool tip chips expected, got ${graze.tipHot}`);
assert(graze.fine >= 1, 'graze should include fine grit chips');

const pickup = new PickupFeedback();
pickup.spawn('power', 120, 240);
pickup.spawn('bomb', 140, 260);
const pops = pickup.popups;
assert.equal(pops.length, 2);
let stretchOk = 0;
let fineOk = 0;
let tipHot = 0;
let totalSparks = 0;
let maxStretch = 0;
for (const p of pops) {
  totalSparks += p.sparks.length;
  for (const s of p.sparks) {
    if ((s.stretch || 1) >= 1.5) stretchOk += 1;
    if ((s.stretch || 1) > maxStretch) maxStretch = s.stretch || 1;
    if (s.r < 1.5) fineOk += 1;
    if (s.color === '#fffef8') tipHot += 1;
  }
}
assert(totalSparks >= 14, `pickup sparks too sparse: ${totalSparks}`);
assert(stretchOk >= 6, `pickup tip stretch expected, got ${stretchOk}`);
assert(maxStretch >= 2.5, `pickup tip stretch expected, got ${maxStretch}`);
assert(fineOk >= 4, `pickup fine grit expected, got ${fineOk}`);
assert(tipHot >= 1, `pickup cool tip chips expected, got ${tipHot}`);

// Draw must not throw (soft arcs, not diamond path markers).
const calls = { arc: 0, moveTo: 0, tipFill: 0 };
const ctx = {
  save() {}, restore() {},
  beginPath() {}, closePath() {}, fill() {}, stroke() {},
  fillText() {}, strokeText() {}, fillRect() {},
  setLineDash() {}, translate() {}, rotate() {}, scale() {},
  createRadialGradient() {
    return { addColorStop() {} };
  },
  createLinearGradient() {
    return { addColorStop() {} };
  },
  arc() { calls.arc += 1; },
  moveTo() { calls.moveTo += 1; },
  lineTo() {},
  quadraticCurveTo() {},
  ellipse() { calls.arc += 1; },
  clip() {},
  set fillStyle(v) {
    if (v === '#fffef8') calls.tipFill += 1;
  },
  get fillStyle() { return ''; },
};
pickup.draw(ctx);
assert(calls.arc >= 20, `soft-sprite arcs expected in pickup draw, got ${calls.arc}`);
assert(calls.tipFill >= 1, `pickup tip #fffef8 draws expected, got ${calls.tipFill}`);

console.log(JSON.stringify({
  ok: true,
  graze,
  pickup: { totalSparks, stretchOk, fineOk, tipHot, maxStretch, drawArcs: calls.arc, tipFill: calls.tipFill },
}, null, 2));
