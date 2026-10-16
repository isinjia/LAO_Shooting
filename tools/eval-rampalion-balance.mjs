// Rampalion level balance probe (same dummy method as eval-balance.mjs: one parked leader
// with huge HP, held fire, 8 s per sample). Measures:
//   base       plain Rampalion's gun (no parts) - it never grows with power
//   parts      the DPS each part option ADDS on its own (forced attached, nothing else)
//   levels     Lv1..Lv5 expected / min / max DPS over the random part draws (Lv N = N-1 parts,
//              one per body slot, each slot's options equally likely)
//   hyper      Hyper Rampalion (no parts, Lv5 gun)
//   pack       the same per part vs a 5-grunt pack (homing / piercing / spread pay off here)
// usage: node tools/eval-rampalion-balance.mjs [out.json]
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: false, padMode: 'fixed', fullscreen: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=rb' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#btn-start', { timeout: 90000 });
await page.click('#btn-start');
await page.waitForSelector('.char-card', { timeout: 90000 });
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion'));
await page.waitForTimeout(500);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });

const res = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const { RAMPALION_SLOTS, PART_LV_MUL } = await import('/js/rampalion.js');
  const g = window.__LAO__.getGame(); const p = g.player; const r = p._ramp;
  for (let i = 0; i < 120; i++) { g.update(1 / 60); p.invuln = 99; }
  let dummy = g.enemies.find((e) => e.alive);
  for (let i = 0; i < 1200 && !dummy; i++) { g.update(1 / 60); p.invuln = 99; dummy = g.enemies.find((e) => e.alive); }
  // Stage flow frozen: no new waves / leaders while measuring.
  g._updateStageFlow = () => {};
  let dealt = 0;
  const hook = (e) => { if (e._evHooked) return; e._evHooked = true; const o = e.damage.bind(e); e.damage = (a, ...rest) => { dealt += a; return o(a, ...rest); }; };
  hook(dummy);
  // Pack: five spare enemies parked in a column ahead (reused each sample).
  const pack = [];
  const park = (withPack) => {
    // The game drops dead enemies from its list: put the parked ones back.
    for (const e of [dummy, ...pack]) if (!g.enemies.includes(e)) g.enemies.push(e);
    g.enemies.forEach((e) => { if (e !== dummy && !pack.includes(e)) { e.alive = false; e.dying = false; } });
    if (withPack) {
      pack.forEach((e, i) => { e.alive = true; e.dying = false; e.x = 560 + (i % 2) * 90; e.y = 110 + i * 80; e.hp = e.maxHp = 1e9; e.fireTimer = 99; e.script = null; });
      dummy.alive = false;
    } else {
      pack.forEach((e) => { e.alive = false; });
      dummy.alive = true; dummy.dying = false; dummy.x = 620; dummy.y = p.hitY; dummy.hp = dummy.maxHp = 1e9;
      dummy.fireTimer = 99; dummy.script = null;
    }
    g.bullets.list.forEach((b) => { if (!b.friendly) b.alive = false; });
    p.x = 160; p.y = 270; p.invuln = 99;
  };
  const sample = (withPack = false) => {
    g._keyInput.shoot = true; g._syncMergedInput();
    g.bullets.list.forEach((b) => { if (b.friendly) b.alive = false; });
    p._subBeam = null;
    for (const e of r.slots) e.cd = 0.3;
    for (let i = 0; i < 60; i++) { park(withPack); g.update(1 / 60); }
    dealt = 0;
    for (let i = 0; i < 480; i++) { park(withPack); g.update(1 / 60); }
    return +(dealt / 8).toFixed(2);
  };
  const setParts = (list) => {
    r.slots.length = 0; r.docks.length = 0; r.ejects.length = 0;
    for (const [slot, opt] of list) r.slots.push({ slot, opt, robot: opt.robot, attached: true, cd: 0.3 });
  };
  // Grunts for the pack test (clones of the dummy's class via the game's own spawner).
  const C = dummy.constructor;
  for (let i = 0; i < 5; i++) {
    const e = Object.create(C.prototype); Object.assign(e, dummy); e._evHooked = false; hook(e); pack.push(e); g.enemies.push(e);
  }

  const out = { base: {}, parts: [], hyper: {}, shotDamage: p.meta.shotDamage,
    // parts are measured at Lv2; their power at Lv N = that x lvMul[N] / lvMul[2]
    lvMul: [0, 1, 2, 3, 4, 5].map((lv) => PART_LV_MUL(lv)) };
  r.hyper = false; r.hyperFly = null; setParts([]);
  p.shotLevel = 1; out.base.single = sample(); out.base.pack = sample(true);
  for (const slot of RAMPALION_SLOTS) {
    for (const opt of slot.options) {
      setParts([[slot, opt]]);
      p.shotLevel = 2;
      const single = +(sample() - out.base.single).toFixed(2);
      const packD = +(sample(true) - out.base.pack).toFixed(2);
      out.parts.push({ slot: slot.id, robot: opt.robot, kind: opt.gun?.kind, single, pack: packD });
    }
  }
  setParts([]);
  r.hyper = true; p.shotLevel = 5;
  out.hyper.single = sample(); out.hyper.pack = sample(true);
  r.hyper = false;
  return out;
});

// Levels: expected / min / max over the random slot order and options (Lv N has N-1 parts).
const slots = [...new Set(res.parts.map((x) => x.slot))];
const bySlot = Object.fromEntries(slots.map((s) => [s, res.parts.filter((x) => x.slot === s)]));
const combos = (arr, k) => (k === 0 ? [[]] : arr.flatMap((v, i) => combos(arr.slice(i + 1), k - 1).map((c) => [v, ...c])));
res.levels = {};
for (const metric of ['single', 'pack']) {
  res.levels[metric] = {};
  for (let lv = 1; lv <= 5; lv++) {
    const sets = combos(slots, lv - 1);
    let sum = 0; let n = 0; let lo = Infinity; let hi = -Infinity;
    for (const set of sets) {
      // every option combination of these slots
      const opts = set.reduce((acc, s) => acc.flatMap((a) => bySlot[s].map((o) => [...a, o])), [[]]);
      for (const o of opts) {
        const v = res.base[metric] + o.reduce((a, x) => a + x[metric], 0) * res.lvMul[lv] / res.lvMul[2];
        // weight: each slot set is equally likely, options within a set equally likely
        const w = 1 / (sets.length * opts.length);
        sum += v * w; n += w; lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    }
    res.levels[metric][lv] = { avg: +(sum / n).toFixed(2), min: +lo.toFixed(2), max: +hi.toFixed(2) };
  }
}
console.log(JSON.stringify(res, null, 1));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 3)));
await browser.close();
