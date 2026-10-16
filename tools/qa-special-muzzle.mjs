/**
 * Tick24/53: C specialFlash muzzle — tip-forward/cool-band grit + tip cores.
 * moteN frozen (7 / lightning|foxflame 9) — no dens churn.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Player } from '../js/player.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const playerSrc = readFileSync(join(__dirname, '../js/player.js'), 'utf8');

// --- Source: tip-forward + cool-band (moteN frozen) ---
assert.match(
  playerSrc,
  /const moteN = style === 'lightning' \|\| style === 'foxflame' \? 9 : 7/,
  'specialFlash moteN frozen 7/9',
);
assert.match(
  playerSrc,
  /2\.65 \+ \(i % 3\) \* 0\.4 \+ level \* 0\.18/,
  'specialFlash tip-forward fine stretch',
);
assert.match(
  playerSrc,
  /1\.78 \+ \(i % 2\) \* 0\.35 \+ level \* 0\.1/,
  'specialFlash soft rear stretch',
);
assert.match(playerSrc, /const tipBias = fine \? 1 : 0\.28/, 'specialFlash tipBias cool-band');
assert.match(
  playerSrc,
  /tipBias > 0\.35 \? '#fffef8' : '#fff8e8'/,
  'specialFlash tip/cool cores',
);
assert.match(playerSrc, /r \* 0\.38/, 'specialFlash tip-forward core offset');

function makeCtx() {
  const calls = {
    arc: 0, ellipse: 0, rotate: 0, scale: 0, translate: 0, save: 0, restore: 0,
    lighter: 0, whiteFill: 0, scaleStretch: 0, tipAccent: 0, coolKit: 0,
  };
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    save() { calls.save += 1; },
    restore() { calls.restore += 1; },
    beginPath() {},
    closePath() {},
    fill() {},
    stroke() {},
    setLineDash() {},
    translate() { calls.translate += 1; },
    rotate() { calls.rotate += 1; },
    scale(sx, sy) {
      calls.scale += 1;
      if (sx >= 1.5 && sy === 1) calls.scaleStretch += 1;
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    arc() { calls.arc += 1; },
    ellipse() { calls.ellipse += 1; },
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    clip() {},
  };
  Object.defineProperty(ctx, 'globalCompositeOperation', {
    get() { return this._comp || 'source-over'; },
    set(v) {
      this._comp = v;
      if (v === 'lighter') calls.lighter += 1;
    },
  });
  Object.defineProperty(ctx, 'fillStyle', {
    get() { return this._fill || '#000'; },
    set(v) {
      this._fill = v;
      if (v === '#ffffff' || v === '#fff' || v === '#fffef8' || v === '#fff8e8') {
        calls.whiteFill += 1;
      }
      if (v === '#ffe08a') calls.tipAccent += 1;
      if (v === '#ff9a4a') calls.coolKit += 1;
    },
  });
  return { ctx, calls };
}

const player = Object.assign(Object.create(Player.prototype), {
  charKey: 'hirume',
  meta: { shot: { style: 'foxflame', color: '#ff9a4a', glow: '#ffe08a' }, rare: false },
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
  shotLevel: 1,
  specialFlash: 0.34,
  lastSpecialLevel: 2,
  _t: 1.25,
  deathBombTimer: 0,
  respawnTimer: 0,
  anim: {
    state: 'idle',
    draw() {},
  },
});

const { ctx, calls } = makeCtx();
player.draw(ctx);

assert(calls.ellipse >= 3, `bloom ellipses expected, got ${calls.ellipse}`);
assert(calls.lighter >= 1, 'special muzzle should use additive lighter pass');
assert(calls.scaleStretch >= 9, `forward tip stretch expected, got ${calls.scaleStretch}`);
assert(calls.rotate >= 9, `mote angle stagger expected, got ${calls.rotate}`);
assert(calls.arc >= 20, `soft-sprite arcs expected, got ${calls.arc}`);
assert(calls.whiteFill >= 9, `white tip cores expected, got ${calls.whiteFill}`);
assert(calls.tipAccent >= 1, 'cool-band tip accent expected');
assert(calls.coolKit >= 1, 'cool-band rear kit mid expected');

// Lightning kit still keeps soft radial wash (no zigzag geometry).
const bolt = Object.assign(Object.create(Player.prototype), {
  ...player,
  meta: { shot: { style: 'lightning', color: '#7ad7ff', glow: '#d8f6ff' }, rare: false },
  specialFlash: 0.4,
  lastSpecialLevel: 3,
  anim: { state: 'idle', draw() {} },
});
const boltRun = makeCtx();
bolt.draw(boltRun.ctx);
assert(boltRun.calls.scaleStretch >= 9, `lightning mote stretch expected, got ${boltRun.calls.scaleStretch}`);
assert(boltRun.calls.ellipse >= 3, 'lightning keeps bloom ellipses');
assert(boltRun.calls.whiteFill >= 9, `lightning tip cores expected, got ${boltRun.calls.whiteFill}`);

// Silent when specialFlash is off.
const silent = Object.assign(Object.create(Player.prototype), {
  ...player,
  specialFlash: 0,
  anim: { state: 'idle', draw() {} },
});
const silentRun = makeCtx();
silent.draw(silentRun.ctx);
assert.equal(silentRun.calls.scaleStretch, 0, 'specialFlash off stays silent on grit');

console.log(JSON.stringify({
  ok: true,
  foxflame: {
    ellipses: calls.ellipse,
    lighter: calls.lighter,
    scaleStretch: calls.scaleStretch,
    rotate: calls.rotate,
    arcs: calls.arc,
    whiteFill: calls.whiteFill,
    tipAccent: calls.tipAccent,
    coolKit: calls.coolKit,
  },
  lightning: {
    scaleStretch: boltRun.calls.scaleStretch,
    arcs: boltRun.calls.arc,
    whiteFill: boltRun.calls.whiteFill,
  },
  silent: { scaleStretch: silentRun.calls.scaleStretch },
}, null, 2));
