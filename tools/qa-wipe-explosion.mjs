/**
 * Tick50 + tick56/57: polish-fx wipeSpark tip/cool + explosion tip/cool stretch+ramp.
 * HOLD dens/side/emit counts must stay frozen (no silhouette churn).
 * wipeSpark stays single-emit (PARTICLE_CAP-safe) — tip/cool only, no dens churn.
 * explosion n/fine/drag frozen — tip-forward stretch + tipChip + cool flash only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PolishFx } from '../js/polish-fx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const polishFx = fs.readFileSync(path.join(root, 'js/polish-fx.js'), 'utf8');
const shotFx = fs.readFileSync(path.join(root, 'js/shot-fx.js'), 'utf8');
const proj = fs.readFileSync(path.join(root, 'js/projectile-vfx.js'), 'utf8');

// --- Source: wipeSpark tip-forward / cool tip (single emit frozen) ---
assert.match(polishFx, /wipeSpark\(x, y, tint = null\)/, 'wipeSpark present');
assert.match(polishFx, /Soft elongated chip \+ tip-hot ramp/, 'wipeSpark quality comment');
assert.match(polishFx, /Single-emit frozen — tip-forward stretch \+ cool #fffef8/, 'wipeSpark tip/cool comment');
assert.match(polishFx, /const fine = Math\.random\(\) < 0\.62/, 'wipeSpark fine variance');
assert.match(polishFx, /const tipChip = Math\.random\(\) < 0\.28/, 'wipeSpark tip chip chance');
assert.match(
  polishFx,
  /stretch: fine \? 2\.65 \+ Math\.random\(\) \* 2\.4 : 1\.85 \+ Math\.random\(\) \* 1\.6/,
  'wipeSpark tip-forward stretch',
);
assert.match(polishFx, /color: tipChip \? '#fffef8' : cool/, 'wipeSpark cool tip chips');
assert.match(polishFx, /rampHot: '#fffef8',\s*rampCool: cool/, 'wipeSpark hot→cool #fffef8 ramp');

// --- Source: explosion tip-forward / cool tip (same n budget, no dens churn) ---
assert.match(polishFx, /Fine grit \+ brighter chips \(same n budget/, 'explosion grit comment');
assert.match(polishFx, /n \/ fine \/ drag frozen — tip-forward stretch \+ cool #fffef8/, 'explosion tip/cool comment');
assert.match(polishFx, /const fine = !smoke && i % 3 !== 0/, 'explosion fine grit mix');
assert.match(polishFx, /const tipChip = !smoke && Math\.random\(\) < 0\.28/, 'explosion tip chip chance');
assert.match(
  polishFx,
  /stretch: smoke \? 1 : \(fine \? 2\.65 \+ Math\.random\(\) \* 2\.4 : 1\.85 \+ Math\.random\(\) \* 1\.6\)/,
  'explosion tip-forward stretch',
);
assert.match(polishFx, /color: tipChip \|\| i % 3 === 0 \? '#fffef8'/, 'explosion cool tip chips');
assert.match(polishFx, /Cool tip flash \(was pure #ffffff/, 'explosion cool tip flash comment');
assert.match(polishFx, /r: 5 \+ scale \* 3,\s*\/\/ Cool tip flash[\s\S]*?color: '#fffef8'/, 'explosion cool tip flash color');
assert.match(polishFx, /drag: smoke \? 0\.9 : \(fine \? 0\.74 : 0\.78\)/, 'explosion fine drag');
assert.match(polishFx, /const n = Math\.max\(6, Math\.round\(\(12 \+ scale \* 10\)/, 'explosion n budget formula frozen');

// Draw tip-forward core language kept (tick48).
assert.match(polishFx, /rad \* 0\.28/, 'spark tip-forward core');
assert.match(polishFx, /Math\.min\(2\.15, spd \* 0\.01\)/, 'velocity stretch boost');

// HOLD dens/side/emit frozen across shot-fx + projectile-vfx (no silhouette churn).
assert.match(shotFx, /holdFan \? 14/, 'fan trailN');
assert.match(shotFx, /holdCrescent \? 9/, 'crescent trailN');
assert.match(shotFx, /holdAxe \? 7/, 'axe trailN');
assert.match(shotFx, /holdSpike \? 4/, 'spike trailN');
assert.match(shotFx, /holdHmg \? 12/, 'hmg trailN');
assert.match(shotFx, /holdArty \? 5/, 'arty trailN');
assert.match(proj, /dt \* dens \* \(light \? 34 : 72\)/, 'trail emit rate');
assert.match(proj, /const emitRate = \(light \? 26 : 56\)/, 'hold muzzle emitRate');
assert.match(proj, /return \{ kind: 'fan', side: 2\.42/, 'fan side');
assert.match(proj, /return \{ kind: 'lance', side: 0\.14/, 'lance side');
assert.match(proj, /return \{ kind: 'axe', side: 1\.34/, 'axe side');
assert.match(proj, /return \{ kind: 'arty', side: 1\.12/, 'arty side');
assert.match(proj, /return \{ kind: 'cloud', side: 2\.55/, 'cloud side');
assert.match(proj, /return \{ kind: 'hmg', side: 0\.54/, 'hmg side');
assert.match(proj, /return \{ kind: 'crescent', side: 2\.82/, 'crescent side');
assert.match(proj, /return \{ kind: 'spike', side: 0\.1/, 'spike side');
assert.match(proj, /hirume: 'sunbird'/, 'hold hirume');
assert.match(proj, /constantia: 'sightbeam'/, 'hold constantia');
assert.match(proj, /lrl: 'dragonaxe'/, 'hold lrl');
assert.match(proj, /merlin: 'shell'/, 'hold merlin');
assert.match(proj, /fafnir: 'jupiterorb'/, 'hold fafnir');
assert.match(proj, /eternity: 'coffinround'/, 'hold eternity');
assert.match(proj, /labiata: 'plasmaslash'/, 'hold labiata');
assert.match(proj, /emily: 'railbolt'/, 'hold emily');

// --- Runtime: wipeSpark single chip tip/cool quality ---
const fx = new PolishFx();
fx.setKitPalette({ color: '#9ef0ff', glow: '#5ad0ff', style: 'orb' });
fx.clear();
const wipeSamples = [];
for (let i = 0; i < 40; i++) {
  fx.clear();
  fx.wipeSpark(120, 180, i % 2 ? '#e8f6ff' : null);
  const sparks = fx.active.filter((p) => p.kind === 'spark');
  assert.equal(sparks.length, 1, `wipeSpark must stay single-emit, got ${sparks.length}`);
  // Snapshot fields — pool reuse mutates the live particle after clear().
  const p = sparks[0];
  wipeSamples.push({
    r: p.r,
    stretch: p.stretch,
    color: p.color,
    rampHot: p.rampHot,
    rampCool: p.rampCool,
  });
}
const wipeStretchOk = wipeSamples.filter((p) => (p.stretch || 1) >= 1.8);
const wipeRamp = wipeSamples.every((p) => p.rampHot === '#fffef8' && p.rampCool);
const wipeMaxStretch = Math.max(0, ...wipeSamples.map((p) => p.stretch || 1));
const wipeFine = wipeSamples.filter((p) => p.r < 1.35 && (p.stretch || 1) >= 2.5);
const wipeTipHot = wipeSamples.filter((p) => p.rampHot === '#fffef8' || p.color === '#fffef8');
assert(wipeStretchOk.length >= 30, `wipeSpark stretch≥1.8 expected, got ${wipeStretchOk.length}`);
assert(wipeMaxStretch >= 2.5, `wipeSpark maxStretch≥2.5, got ${wipeMaxStretch}`);
assert(wipeRamp, 'wipeSpark chips should ramp #fffef8→cool');
assert(wipeFine.length >= 8, `wipeSpark fine tip chips expected, got ${wipeFine.length}`);
assert(wipeTipHot.length >= 8, `wipeSpark tipHot #fffef8 expected, got ${wipeTipHot.length}`);

// --- Runtime: explosion tip-forward / cool tip (n frozen) ---
fx.clear();
fx.explosion(200, 240, 1);
const flashes = fx.active.filter((p) => p.kind === 'flash');
const coolFlash = flashes.some((p) => p.color === '#fffef8' && p.r <= 8);
const sparks = fx.active.filter((p) => p.kind === 'spark');
const fine = sparks.filter((p) => p.r < 1.3);
const stretchOk = sparks.filter((p) => (p.stretch || 1) >= 1.8);
const tipHot = sparks.filter((p) => p.rampHot === '#fffef8' || p.color === '#fffef8');
const hasRamp = sparks.every((p) => p.rampHot === '#fffef8' && p.rampCool);
const maxStretch = Math.max(0, ...sparks.map((p) => p.stretch || 1));
const fineTip = sparks.filter((p) => p.r < 1.35 && (p.stretch || 1) >= 2.5);
assert(sparks.length >= 6, `explosion sparks expected, got ${sparks.length}`);
assert(coolFlash, 'explosion cool tip flash #fffef8 expected');
assert(fine.length >= 2, `explosion fine grit expected, got ${fine.length}`);
assert(stretchOk.length >= 3, `explosion stretch≥1.8 expected, got ${stretchOk.length}`);
assert(maxStretch >= 2.5, `explosion maxStretch≥2.5, got ${maxStretch}`);
assert(fineTip.length >= 2, `explosion fine tip stretch≥2.5 expected, got ${fineTip.length}`);
assert(tipHot.length >= 2, `explosion tipHot #fffef8 expected, got ${tipHot.length}`);
assert(hasRamp, 'explosion sparks should ramp #fffef8→cool');

// Draw soft arcs only — no line geometry.
for (let i = 0; i < 3; i++) fx.tick(1 / 60);
const calls = { arc: 0, lineTo: 0 };
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
  moveTo() {},
  lineTo() { calls.lineTo += 1; },
  quadraticCurveTo() {},
  ellipse() { calls.arc += 1; },
  clip() {},
};
fx.draw(ctx);
assert(calls.arc >= 8, `soft-sprite arcs expected, got ${calls.arc}`);
assert.equal(calls.lineTo, 0, 'no line geometry in particle draw');

console.log(JSON.stringify({
  ok: true,
  wipe: {
    samples: wipeSamples.length,
    stretchOk: wipeStretchOk.length,
    maxStretch: Number(wipeMaxStretch.toFixed(2)),
    fine: wipeFine.length,
    tipHot: wipeTipHot.length,
    hasRamp: wipeRamp,
    singleEmit: true,
  },
  explosion: {
    sparks: sparks.length,
    fine: fine.length,
    stretchOk: stretchOk.length,
    maxStretch: Number(maxStretch.toFixed(2)),
    fineTip: fineTip.length,
    tipHot: tipHot.length,
    coolFlash,
    hasRamp,
    drawArcs: calls.arc,
  },
  holdDensFrozen: true,
}, null, 2));
