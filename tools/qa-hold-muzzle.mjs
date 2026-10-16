/**
 * Tick51: hold muzzle fine grit + option trail tip/cool refine.
 * HOLD dens/side/emitRate frozen — no silhouette churn. 8 identities kept.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Player } from '../js/player.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const proj = fs.readFileSync(path.join(root, 'js/projectile-vfx.js'), 'utf8');
const playerSrc = fs.readFileSync(path.join(root, 'js/player.js'), 'utf8');

// --- Hold muzzle quality (emitRate / dens / side frozen) ---
assert.match(proj, /const emitRate = \(light \? 26 : 56\)/, 'hold muzzle emitRate frozen');
assert.match(proj, /Fine grit vs brighter chip — same emitRate/, 'hold muzzle fine grit comment');
assert.match(proj, /const fine = !smokeChip && \(streak \? Math\.random\(\) < 0\.58/, 'hold muzzle fine streak mix');
assert.match(proj, /fine && streak \? 1\.12 : 1/, 'hold muzzle fine speed bias');
assert.match(proj, /fine \? \(1\.1 \+ Math\.random\(\) \* 2\.8 \* k\)/, 'hold muzzle fine streak size');
assert.match(proj, /fine \? \(1\.6 \+ Math\.random\(\) \* 3\.2 \* k\)/, 'hold muzzle fine mote size');
assert.match(proj, /streak \? \(fine \? 7\.2 : 5\.8\)/, 'hold muzzle fine streak drag');
assert.match(proj, /rampHot: kit\.core, rampCool: kit\.smoke/, 'hold muzzle tip-hot→cool ramp');

// HOLD dens / side / 8 identities frozen
assert.match(proj, /sunbird: \{ hue: '#ff9420', core: '#fff8c8', smoke: '#ff5830', dens: 1\.76, stretch: 0\.58 \}/, 'fan dens');
assert.match(proj, /sightbeam: \{ hue: '#ffd86a', core: '#fffaf0', smoke: '#b88840', dens: 0\.72, stretch: 2\.48 \}/, 'lance dens');
assert.match(proj, /dragonaxe: \{ hue: '#ff3a62', core: '#ffe8f0', smoke: '#ff7090', dens: 1\.34, stretch: 0\.92 \}/, 'axe dens');
assert.match(proj, /shell: \{ hue: '#ffb45a', core: '#fff4d8', smoke: '#6a8098', dens: 0\.78, stretch: 0\.82 \}/, 'arty dens');
assert.match(proj, /jupiterorb: \{ hue: '#5ef0ff', core: '#ffffff', smoke: '#40c8ff', dens: 1\.82, stretch: 0\.58 \}/, 'cloud dens');
assert.match(proj, /coffinround: \{ hue: '#c89cff', core: '#f8f0ff', smoke: '#8a68c8', dens: 1\.34, stretch: 1\.12 \}/, 'hmg dens');
assert.match(proj, /plasmaslash: \{ hue: '#ff6ae0', core: '#fff0ff', smoke: '#c050ff', dens: 1\.06, stretch: 1\.86 \}/, 'crescent dens');
assert.match(proj, /railbolt: \{ hue: '#48b8ff', core: '#f6ffff', smoke: '#2468d8', dens: 0\.4, stretch: 2\.9 \}/, 'spike dens');
assert.match(proj, /return \{ kind: 'fan', side: 2\.42/, 'fan side');
assert.match(proj, /return \{ kind: 'lance', side: 0\.14/, 'lance side');
assert.match(proj, /return \{ kind: 'axe', side: 1\.34/, 'axe side');
assert.match(proj, /return \{ kind: 'arty', side: 1\.12/, 'arty side');
assert.match(proj, /return \{ kind: 'cloud', side: 2\.55/, 'cloud side');
assert.match(proj, /return \{ kind: 'hmg', side: 0\.54/, 'hmg side');
assert.match(proj, /return \{ kind: 'crescent', side: 2\.82/, 'crescent side');
assert.match(proj, /return \{ kind: 'spike', side: 0\.1/, 'spike side');
assert.match(proj, /dt \* dens \* \(light \? 34 : 72\)/, 'trail emit rate frozen');
assert.match(proj, /hirume: 'sunbird'/, 'hold hirume');
assert.match(proj, /constantia: 'sightbeam'/, 'hold constantia');
assert.match(proj, /lrl: 'dragonaxe'/, 'hold lrl');
assert.match(proj, /merlin: 'shell'/, 'hold merlin');
assert.match(proj, /fafnir: 'jupiterorb'/, 'hold fafnir');
assert.match(proj, /eternity: 'coffinround'/, 'hold eternity');
assert.match(proj, /labiata: 'plasmaslash'/, 'hold labiata');
assert.match(proj, /emily: 'railbolt'/, 'hold emily');

// --- Option trail tip-forward + cool-band (moteN frozen) ---
assert.match(playerSrc, /const moteN = rareOpt \? 5 : 4/, 'option trail moteN frozen');
assert.match(playerSrc, /const stretch = 1\.78 \+ m \* 0\.38/, 'option trail tip-forward stretch');
assert.match(playerSrc, /const tipBias = 1 - m \/ Math\.max\(1, moteN - 1\)/, 'option trail tipBias');
assert.match(playerSrc, /tipBias > 0\.45 \? color : coolTrail/, 'option trail cool-band rear');
assert.match(playerSrc, /tipBias > 0\.35 \? '#fffef8' : '#fff8e8'/, 'option trail tip/cool cores');
assert.match(playerSrc, /ctx\.arc\(r \* 0\.38, 0/, 'option trail tip-forward core offset');

function makeCtx() {
  const calls = {
    arc: 0, ellipse: 0, rotate: 0, scale: 0, lighter: 0, whiteFill: 0, scaleStretch: 0, diamond: 0,
  };
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    save() {},
    restore() {},
    beginPath() {},
    closePath() { calls.diamond += 1; },
    fill() {},
    stroke() {},
    setLineDash() {},
    translate() {},
    rotate() { calls.rotate += 1; },
    scale(sx, sy) {
      calls.scale += 1;
      if (sx >= 1.5 && sy === 1) calls.scaleStretch += 1;
    },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
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
    anim: { state: 'idle', draw() {} },
    ...over,
  });
}

const lv2 = basePlayer({ shotLevel: 2, meta: { shot: { glow: '#9ef0ff', color: '#6ad0ff' }, rare: false } });
const lv2Run = makeCtx();
lv2.draw(lv2Run.ctx);
const a = lv2Run.calls;
assert(a.lighter >= 1, 'option trails additive lighter');
assert(a.ellipse >= 1, `option bloom ellipse expected, got ${a.ellipse}`);
assert(a.scaleStretch >= 4, `option stretch motes ≥4, got ${a.scaleStretch}`);
assert(a.whiteFill >= 4, `option tip/cool cores ≥4, got ${a.whiteFill}`);

const rare = basePlayer({
  shotLevel: 2,
  meta: { shot: { glow: '#ffe08a', color: '#ff9a4a' }, rare: true },
});
const rareRun = makeCtx();
rare.draw(rareRun.ctx);
assert(rareRun.calls.scaleStretch >= 5, 'rare trail stretch ≥5');
assert(rareRun.calls.diamond >= 1, 'rare diamond chip retained');

const lv1 = basePlayer({ shotLevel: 1 });
const lv1Run = makeCtx();
lv1.draw(lv1Run.ctx);
assert(lv1Run.calls.scaleStretch === 0, 'Lv1 no option trails');

console.log(JSON.stringify({
  ok: true,
  holdMuzzle: { fineGrit: true, emitRateFrozen: true, densFrozen: true, identities: 8 },
  optionTrails: {
    lv2: { scaleStretch: a.scaleStretch, whiteFill: a.whiteFill },
    rare: { scaleStretch: rareRun.calls.scaleStretch, diamond: rareRun.calls.diamond },
    lv1: { scaleStretch: lv1Run.calls.scaleStretch },
  },
}, null, 2));
