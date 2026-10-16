/**
 * Tick22/54: bomb particle density + afterglow tip-forward grit
 * inside cast budget (260 light / 520 full). No HOLD dens churn.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bombSrc = fs.readFileSync(path.join(__dirname, '../js/bomb-vfx.js'), 'utf8');
assert.match(bombSrc, /let budget = light \? 260 : 520/, 'cast budget 260/520');
assert.match(bombSrc, /const gritN = dense \? \(light \? 2 : 4\) : \(light \? 3 : 6\)/, 'afterglow gritN frozen');
assert.match(
  bombSrc,
  /const len = \(\(fine \? 18 : 24\) \+ \(j % 3\) \* \(fine \? 8 : 9\) \+ \(j % 2\) \* 3\) \* scale/,
  'afterglow tip-forward len',
);
assert.match(bombSrc, /j % 2 \? color : '#fffef8'/, 'afterglow cool tip');

// Stub browser globals before bomb-vfx → mobile prefersLightFx.
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

function countCast(vfx, key, targetN, t) {
  vfx.casts = [{
    key,
    x: 200,
    y: 300,
    start: 0,
    targets: Array.from({ length: targetN }, (_, i) => ({
      x: 280 + (i % 5) * 90,
      y: 120 + Math.floor(i / 5) * 110,
    })),
  }];
  let budgetUsed = 0;
  const types = {};
  vfx.emit((_x, _y, _angle, _w, _h, type) => {
    budgetUsed += 1;
    types[type] = (types[type] || 0) + 1;
  }, t);
  return { budgetUsed, types };
}

function countRemap(vfx, key, targetN, t) {
  vfx.casts = [{
    key,
    x: 200,
    y: 300,
    start: 0,
    targets: Array.from({ length: targetN }, (_, i) => ({
      x: 280 + (i % 5) * 90,
      y: 120 + Math.floor(i / 5) * 110,
    })),
  }];
  let puts = 0;
  let streaks = 0;
  const fake = {
    put(_x, _y, _a, w, h, type) {
      puts += 1;
      if (type === 1 || w > h * 1.3) streaks += 1;
    },
  };
  vfx.drawGpu(fake, t);
  return { puts, streaks };
}

const vfx = new BombVfx();
const samples = [];
for (const key of ['hirume', 'merlin', 'fafnir', 'emily']) {
  for (const t of [0.12, 0.35, 0.55]) {
    const cast = countCast(vfx, key, 8, t);
    const remap = countRemap(vfx, key, 8, t);
    samples.push({ key, t, ...cast, ...remap });
  }
}

const peakBudget = Math.max(...samples.map((s) => s.budgetUsed));
const peakPuts = Math.max(...samples.map((s) => s.puts));
const avgStreaks = samples.reduce((a, s) => a + s.streaks, 0) / samples.length;

const report = {
  ok: true,
  castBudgetCap: { light: 260, full: 520 },
  peakBudget,
  peakPuts,
  avgStreaks: Math.round(avgStreaks * 10) / 10,
  samples: samples.slice(0, 6),
};

if (peakBudget > 520) {
  report.ok = false;
  report.fail = `cast budget exceeded: ${peakBudget} > 520`;
}
if (peakPuts < 40) {
  report.ok = false;
  report.fail = `remap too sparse: peakPuts=${peakPuts}`;
}
if (avgStreaks < 8) {
  report.ok = false;
  report.fail = `streak grit too low: avgStreaks=${avgStreaks}`;
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
