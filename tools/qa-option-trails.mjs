/**
 * Tick26: Lv2+ option satellite soft motion streaks (orbit tangent grit).
 */
import assert from 'node:assert/strict';
import { Player } from '../js/player.js';

function makeCtx() {
  const calls = {
    arc: 0, ellipse: 0, rotate: 0, scale: 0, translate: 0, save: 0, restore: 0,
    lighter: 0, whiteFill: 0, scaleStretch: 0, diamond: 0,
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
    closePath() { calls.diamond += 1; },
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
    },
  });
  return { ctx, calls };
}

function basePlayer(over = {}) {
  return Object.assign(Object.create(Player.prototype), {
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
    anim: {
      state: 'idle',
      draw() {},
    },
    ...over,
  });
}

// Lv2 common — one satellite + soft tangent trail (4 stretch motes).
const lv2 = basePlayer({ shotLevel: 2, meta: { shot: { glow: '#9ef0ff', color: '#6ad0ff' }, rare: false } });
const lv2Run = makeCtx();
lv2.draw(lv2Run.ctx);
const a = lv2Run.calls;
assert(a.lighter >= 1, 'option trails should use additive lighter pass');
assert(a.ellipse >= 1, `soft under-bloom ellipse expected, got ${a.ellipse}`);
assert(a.scaleStretch >= 4, `trail stretch motes expected ≥4, got ${a.scaleStretch}`);
assert(a.rotate >= 4, `trail angle stagger expected ≥4, got ${a.rotate}`);
assert(a.whiteFill >= 4, `white tip cores expected ≥4, got ${a.whiteFill}`);

// Lv3 — two satellites → denser trail budget.
const lv3 = basePlayer({ shotLevel: 3 });
const lv3Run = makeCtx();
lv3.draw(lv3Run.ctx);
const b = lv3Run.calls;
assert(b.scaleStretch >= 8, `Lv3 dual satellites stretch expected ≥8, got ${b.scaleStretch}`);
assert(b.ellipse >= 2, `Lv3 bloom ellipses expected ≥2, got ${b.ellipse}`);
assert(b.whiteFill >= 8, `Lv3 white tips expected ≥8, got ${b.whiteFill}`);

// Rare — denser trail (5 motes) + diamond chip retained.
const rare = basePlayer({
  shotLevel: 2,
  meta: { shot: { glow: '#ffe08a', color: '#ff9a4a' }, rare: true },
});
const rareRun = makeCtx();
rare.draw(rareRun.ctx);
const c = rareRun.calls;
assert(c.scaleStretch >= 5, `rare trail stretch expected ≥5, got ${c.scaleStretch}`);
assert(c.diamond >= 1, 'rare option diamond chip must remain');
assert(c.whiteFill >= 5, `rare white tips expected ≥5, got ${c.whiteFill}`);

// Lv1 — no option satellites / trails.
const lv1 = basePlayer({ shotLevel: 1 });
const lv1Run = makeCtx();
lv1.draw(lv1Run.ctx);
const d = lv1Run.calls;
assert(d.scaleStretch === 0, `Lv1 must not emit option trail stretch, got ${d.scaleStretch}`);
assert(d.ellipse === 0, `Lv1 must not emit option bloom ellipses, got ${d.ellipse}`);

console.log('qa-option-trails PASS', {
  lv2: { scaleStretch: a.scaleStretch, whiteFill: a.whiteFill, ellipse: a.ellipse },
  lv3: { scaleStretch: b.scaleStretch, whiteFill: b.whiteFill, ellipse: b.ellipse },
  rare: { scaleStretch: c.scaleStretch, diamond: c.diamond, whiteFill: c.whiteFill },
  lv1: { scaleStretch: d.scaleStretch, ellipse: d.ellipse },
});
