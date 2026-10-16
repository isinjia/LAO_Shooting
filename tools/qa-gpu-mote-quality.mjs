/**
 * Tick49: GPU projectile-vfx mote/streak quality + bomb grit tip-core.
 * HOLD dens/side/emit and bomb cast budget must stay frozen.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const proj = fs.readFileSync(path.join(root, 'js/projectile-vfx.js'), 'utf8');
const bomb = fs.readFileSync(path.join(root, 'js/bomb-vfx.js'), 'utf8');

// --- GPU soft mote / streak shader language ---
assert.match(proj, /tipBias=pow\(clamp\(1\.0-d\*0\.92/, 'soft mote tipBias');
assert.match(proj, /coolBand=smoothstep\(0\.58,0\.92,t\)/, 'soft mote coolBand');
assert.match(proj, /vec2 q=p\*vec2\(0\.34,1\.78\)/, 'streak longer aspect');
assert.match(proj, /tipCore=pow\(tip,1\.55\)/, 'streak tipCore');
assert.match(proj, /1\.48 \+ Math\.min\(2\.55, spd \* 0\.015\)/, 'sim velocity stretch');
assert.match(proj, /if \(k < 0\.18\) col = p\.rampHot/, 'sim tip-hot ramp');
assert.match(proj, /else if \(k > 0\.78\) col = p\.rampCool/, 'sim cool ramp');
assert.match(proj, /fine \? \(0\.12 \+ Math\.random\(\) \* 0\.38\)/, '_spray fine grit size');
assert.match(proj, /w \* 0\.42, Math\.max\(1\.2, h \* 0\.55\), 3/, 'streak tip-forward white core put');
assert.doesNotMatch(proj, /\bctx\.(lineTo|rect|strokeRect|fillRect)\s*\(/, 'no canvas geometry in projectile-vfx');

// HOLD dens / identity frozen (kit dens + emit rates + side biases).
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
assert.match(proj, /dt \* dens \* \(light \? 34 : 72\)/, 'trail emit rate');
assert.match(proj, /b\._crescentAcc \|\| 0\) \+ dt \* 34/, 'crescent emit');
assert.match(proj, /b\._artyAcc \|\| 0\) \+ dt \* 28/, 'arty emit');
assert.match(proj, /b\._spikeAcc \|\| 0\) \+ dt \* 11/, 'spike emit');
assert.match(proj, /b\._hmgAcc \|\| 0\) \+ dt \* 40/, 'hmg emit');
assert.match(proj, /const emitRate = \(light \? 26 : 56\)/, 'hold muzzle emitRate');
assert.match(proj, /hirume: 'sunbird'/, 'hold hirume');
assert.match(proj, /constantia: 'sightbeam'/, 'hold constantia');
assert.match(proj, /lrl: 'dragonaxe'/, 'hold lrl');
assert.match(proj, /merlin: 'shell'/, 'hold merlin');
assert.match(proj, /fafnir: 'jupiterorb'/, 'hold fafnir');
assert.match(proj, /eternity: 'coffinround'/, 'hold eternity');
assert.match(proj, /labiata: 'plasmaslash'/, 'hold labiata');
assert.match(proj, /emily: 'railbolt'/, 'hold emily');

// --- Bomb grit quality (budget / n frozen) ---
assert.match(bomb, /let budget = light \? 260 : 520/, 'cast budget 260/520');
assert.match(bomb, /const n = light \? \(type === 9 \? 7 : 10\) : \(type === 9 \? 11 : 16\)/, 'ring grit n');
assert.match(bomb, /const sparkN = dense \? \(light \? 4 : 8\) : \(light \? 5 : 11\)/, 'detonate sparkN');
assert.match(bomb, /const gritN = dense \? \(light \? 2 : 4\) : \(light \? 3 : 6\)/, 'residual gritN');
assert.match(
  bomb,
  /const len = \(\(fine \? 18 : 24\) \+ \(j % 3\) \* \(fine \? 8 : 9\) \+ \(j % 2\) \* 3\) \* scale/,
  'afterglow tip-forward len',
);
assert.match(
  bomb,
  /const thick = \(\(fine \? 2\.55 : 3\.6\) \+ \(j % 3\) \* 0\.75\) \* scale/,
  'afterglow tip-thin aspect',
);
assert.match(bomb, /j % 2 \? color : '#fffef8'/, 'afterglow cool tip chips');
assert.match(bomb, /const stretch = streak \? \(1\.62 \+ \(i % 4\) \* 0\.28\)/, 'ring grit stretch');
assert.match(bomb, /if \(streak && i % 2 === 0\)/, 'ring tip-forward core');
assert.match(bomb, /if \(type === 7\) \{\s*put\(x, y, angle, w \* 1\.12/, 'type7 tip-weighted remap');
assert.match(bomb, /w \* 0\.42, Math\.max\(1\.6, h \* 0\.28\), 3/, 'type7 white tip core');
assert.match(bomb, /const drips = light \? 6 : \(type === 13 \? 12 : 8\)/, 'beam drip dens frozen');
assert.doesNotMatch(bomb, /ctx\.(lineTo|moveTo).*zigzag|gear|polygon/i, 'no geometric bomb language');

// Runtime: budget still respected (reuse bomb-density harness lightly).
if (!globalThis.window || typeof globalThis.window.innerWidth !== 'number') {
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {}, removeEventListener() {} }),
    navigator: { hardwareConcurrency: 8 },
  };
}
if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: globalThis.window.navigator || { hardwareConcurrency: 8 },
    configurable: true,
  });
}

const { BombVfx } = await import('../js/bomb-vfx.js');
const vfx = new BombVfx();
vfx.casts = [{
  key: 'merlin', x: 200, y: 300, start: 0,
  targets: Array.from({ length: 8 }, (_, i) => ({ x: 280 + (i % 5) * 90, y: 120 + Math.floor(i / 5) * 110 })),
}];
let budgetUsed = 0;
vfx.emit(() => { budgetUsed += 1; }, 0.35);
assert(budgetUsed <= 520, `cast budget exceeded: ${budgetUsed}`);

let tipCores = 0;
let streaks = 0;
const fake = {
  put(_x, _y, _a, w, h, type) {
    if (type === 1 || w > h * 1.3) streaks += 1;
    if (type === 3) tipCores += 1;
  },
};
vfx.drawGpu(fake, 0.35);
assert(streaks >= 8, `streak grit expected, got ${streaks}`);
assert(tipCores >= 4, `tip cores expected in bomb remap, got ${tipCores}`);

console.log(JSON.stringify({
  ok: true,
  gpu: { tipBias: true, streakAspect: true, simRamp: true, fineGrit: true },
  holdDensFrozen: true,
  bomb: { budgetUsed, streaks, tipCores, budgetCap: 520 },
}, null, 2));
