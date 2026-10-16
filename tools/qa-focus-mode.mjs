/**
 * Tick27/52: focus-mode hitbox — soft bloom + orbit grit tip-forward/cool-band.
 * moteN frozen 5 — no dens churn.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Player } from '../js/player.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const playerSrc = readFileSync(join(__dirname, '../js/player.js'), 'utf8');

// --- Source: tip-forward + cool-band (moteN frozen) ---
assert.match(playerSrc, /const moteN = 5;\s*\n\s*for \(let i = 0; i < moteN; i\+\+\) \{\s*\n\s*const a = this\._t \* 3\.4/, 'focus moteN frozen 5');
assert.match(
  playerSrc,
  /stretch = fine \? 2\.15 \+ \(i % 3\) \* 0\.28 : 1\.78 \+ \(i % 2\) \* 0\.22/,
  'focus tip-forward stretch',
);
assert.match(playerSrc, /const tipBias = fine \? 1 : 0\.28/, 'focus tipBias cool-band');
assert.match(playerSrc, /tipBias > 0\.35 \? '#fffef8' : '#fff8e8'/, 'focus tip/cool cores');
assert.match(playerSrc, /rr \* 0\.38/, 'focus tip-forward core offset');

function makeCtx() {
  const calls = {
    arc: 0, ellipse: 0, rotate: 0, scale: 0, translate: 0, save: 0, restore: 0,
    lighter: 0, whiteFill: 0, scaleStretch: 0, stroke: 0,
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
    stroke() { calls.stroke += 1; },
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
    shotLevel: 1,
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

// Focus ON, Lv1 — bloom + 5 orbit grit motes; no option trails.
const on = basePlayer({ focus: true, shotLevel: 1 });
const onRun = makeCtx();
on.draw(onRun.ctx);
const a = onRun.calls;
assert(a.lighter >= 1, 'focus bloom should use additive lighter pass');
assert(a.ellipse >= 2, `focus under-bloom ellipses expected ≥2, got ${a.ellipse}`);
assert(a.scaleStretch >= 5, `focus orbit grit stretch expected ≥5, got ${a.scaleStretch}`);
assert(a.rotate >= 5, `focus grit angle stagger expected ≥5, got ${a.rotate}`);
assert(a.whiteFill >= 5, `focus white tip cores expected ≥5, got ${a.whiteFill}`);
assert(a.stroke >= 1, 'solid focus core stroke must remain');
assert(a.arc >= 2, 'solid focus core fill+stroke arcs must remain');

// Focus OFF, Lv1 — silent (no bloom / grit).
const off = basePlayer({ focus: false, shotLevel: 1 });
const offRun = makeCtx();
off.draw(offRun.ctx);
const b = offRun.calls;
assert(b.lighter === 0, `unfocused must not emit focus lighter, got ${b.lighter}`);
assert(b.ellipse === 0, `unfocused must not emit focus bloom ellipses, got ${b.ellipse}`);
assert(b.scaleStretch === 0, `unfocused must not emit focus grit stretch, got ${b.scaleStretch}`);
assert(b.stroke === 0, `unfocused must not stroke focus core, got ${b.stroke}`);

console.log('qa-focus-mode PASS', {
  focusOn: {
    lighter: a.lighter,
    ellipse: a.ellipse,
    scaleStretch: a.scaleStretch,
    whiteFill: a.whiteFill,
    stroke: a.stroke,
  },
  focusOff: {
    lighter: b.lighter,
    ellipse: b.ellipse,
    scaleStretch: b.scaleStretch,
    stroke: b.stroke,
  },
});
