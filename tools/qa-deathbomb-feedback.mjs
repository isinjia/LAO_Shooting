/**
 * Tick25/52: deathbomb grace ring — soft bloom + arc grit tip-forward/cool-band.
 * moteN frozen (6 / teach 8) — no dens churn.
 * Tick90: grace prompt caption dual-stroke (title + teach/sub) — pulse wash parity.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Player } from '../js/player.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const playerSrc = readFileSync(join(__dirname, '../js/player.js'), 'utf8');
const gameSrc = readFileSync(join(__dirname, '../js/game.js'), 'utf8');

// --- Source: tip-forward + cool-band (moteN frozen) ---
assert.match(playerSrc, /const moteN = teach \? 8 : 6/, 'deathbomb moteN frozen 6/8');
assert.match(
  playerSrc,
  /stretch = fine \? 2\.65 \+ \(i % 3\) \* 0\.4 : 1\.78 \+ \(i % 2\) \* 0\.35/,
  'deathbomb tip-forward stretch',
);
assert.match(playerSrc, /const tipBias = fine \? 1 : 0\.28/, 'deathbomb tipBias cool-band');
assert.match(
  playerSrc,
  /tipBias > 0\.35 \? '#fffef8' : '#fff8e8'/,
  'deathbomb tip/cool cores',
);
assert.match(playerSrc, /rr \* 0\.38/, 'deathbomb tip-forward core offset');
assert.match(playerSrc, /rr = fine \? 0\.62 : 0\.98/, 'deathbomb fine grit chip sizes');

// --- Tick90: grace prompt caption dual-stroke (ceremony caption parity) ---
assert.match(
  gameSrc,
  /Caption dual-stroke: dark outer \+ amber\/rose rim so pulse bar never muddies title\/sub/,
  'deathbomb prompt caption dual-stroke comment',
);
assert.match(gameSrc, /const dbTitle = canBomb \? 'X · DEATHBOMB' : 'NO BOMB'/);
assert.match(gameSrc, /strokeText\(dbTitle/);
assert.match(gameSrc, /fillText\(dbTitle/);
assert.match(gameSrc, /const dbSub = canBomb/);
assert.match(gameSrc, /strokeText\(dbSub/);
assert.match(gameSrc, /fillText\(dbSub/);
assert.ok(
  (gameSrc.match(/strokeText\(dbTitle/g) || []).length >= 2,
  'deathbomb title dark outer + kind rim strokes',
);
assert.ok(
  (gameSrc.match(/strokeText\(dbSub/g) || []).length >= 2,
  'deathbomb sub dark outer + kind rim strokes',
);


function makeCtx() {
  const calls = {
    arc: 0, ellipse: 0, rotate: 0, scale: 0, translate: 0, save: 0, restore: 0,
    lighter: 0, whiteFill: 0, scaleStretch: 0, stroke: 0,
    goldStroke: 0, redStroke: 0,
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
  Object.defineProperty(ctx, 'strokeStyle', {
    get() { return this._stroke || '#000'; },
    set(v) {
      this._stroke = v;
      if (v === '#ffe08a' || v === '#fff4c8') calls.goldStroke += 1;
      if (v === '#ff7a6a' || v === '#ffc0b0') calls.redStroke += 1;
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
    deathBombTimer: 0.22,
    _deathBombWindowMax: 0.28,
    deathBombOpens: 2,
    deathFlash: 0.4,
    respawnTimer: 0,
    anim: {
      state: 'die',
      draw() {},
    },
    ...over,
  });
}

// Stocked grace — additive bloom + stretch grit + countdown strokes.
const stocked = basePlayer();
const stockedRun = makeCtx();
stocked.draw(stockedRun.ctx);
const s = stockedRun.calls;
assert(s.lighter >= 1, 'deathbomb should use additive lighter pass');
assert(s.ellipse >= 2, `soft under-bloom ellipses expected, got ${s.ellipse}`);
assert(s.scaleStretch >= 4, `arc tip stretch expected, got ${s.scaleStretch}`);
assert(s.rotate >= 4, `mote angle stagger expected, got ${s.rotate}`);
assert(s.whiteFill >= 4, `white tip cores expected, got ${s.whiteFill}`);
assert(s.stroke >= 3, `countdown + outer + halo strokes expected, got ${s.stroke}`);
assert(s.goldStroke >= 1, 'stocked grace should stroke gold');
assert(s.redStroke === 0, 'stocked grace must not use empty-red strokes');

// First-hit teaching window — denser mote count (8 vs 6).
const teach = basePlayer({
  deathBombOpens: 1,
  deathBombTimer: 0.3,
  _deathBombWindowMax: 0.34,
});
const teachRun = makeCtx();
teach.draw(teachRun.ctx);
assert(teachRun.calls.scaleStretch >= 6, `first-hit stretch grit denser, got ${teachRun.calls.scaleStretch}`);
assert(teachRun.calls.whiteFill >= 6, `first-hit white tips denser, got ${teachRun.calls.whiteFill}`);

// Empty bomb stock — red urgency, still soft-sprite (no geometry return).
const empty = basePlayer({ bombs: 0 });
const emptyRun = makeCtx();
empty.draw(emptyRun.ctx);
assert(emptyRun.calls.redStroke >= 1, 'empty stock should stroke red/hot');
assert(emptyRun.calls.lighter >= 1, 'empty stock keeps additive bloom');
assert(emptyRun.calls.scaleStretch >= 4, 'empty stock keeps stretch grit');

// Normal death flash (no grace) — must not emit deathbomb grit.
const plain = basePlayer({
  deathBombTimer: 0,
  respawnTimer: 0.3,
  deathFlash: 0.4,
});
const plainRun = makeCtx();
plain.draw(plainRun.ctx);
assert(plainRun.calls.lighter === 0, 'plain death flash must not use deathbomb lighter');
assert(plainRun.calls.scaleStretch === 0, 'plain death flash must not stretch grit');

console.log(JSON.stringify({
  ok: true,
  stocked: {
    lighter: s.lighter,
    ellipses: s.ellipse,
    scaleStretch: s.scaleStretch,
    rotate: s.rotate,
    whiteFill: s.whiteFill,
    strokes: s.stroke,
    goldStroke: s.goldStroke,
  },
  teach: {
    scaleStretch: teachRun.calls.scaleStretch,
    whiteFill: teachRun.calls.whiteFill,
  },
  empty: {
    redStroke: emptyRun.calls.redStroke,
    scaleStretch: emptyRun.calls.scaleStretch,
  },
}, null, 2));
