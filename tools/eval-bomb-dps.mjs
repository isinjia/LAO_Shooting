// Special / bomb DPS vs normal fire, per pilot. A stage-1 boss (HP padded, script frozen)
// sits ahead of the ship. Measures:
//   fire5    normal-fire DPS at P Lv5 (6 s held fire)
//   sp1..3   each special level: damage / active time (cast -> last damage tick)
//   bomb     one bomb: damage / bomb time (cast -> bomb end)
// A grunt pack is spawned around the boss too, so pack-clear effects still find targets.
// Peregrinus' special (human-form transform) is skipped; her human-form bomb is measured as
// "peregrinus*". Rule (user): every special level and the bomb >= Lv5 normal-fire DPS.
// "rampalion" is measured fully fused (4 parts), "rampalion*" as Hyper Rampalion.
// usage: node tools/eval-bomb-dps.mjs [out.json] [pilots]
import { chromium } from 'playwright';
import fs from 'fs';

const out = process.argv[2];
const PILOTS = (process.argv[3] || 'griffin,sleipnir,express76,constantia,lrl,labiata,peregrinus,peregrinus*').split(',');
const browser = await chromium.launch();
const rows = [];
for (const entry of PILOTS) {
  const pilot = entry.replace('*', '');
  // "rampalion" = fully fused (4 parts), "rampalion*" = Hyper Rampalion; "peregrinus*" = human form.
  const hyper = pilot === 'rampalion' && entry.endsWith('*');
  const human = entry.endsWith('*') && !hyper;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false }));
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await page.goto('http://localhost:5188/?cb=bd' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start');
  await page.waitForSelector('.char-card');
  if (['sleipnir', 'express76'].includes(pilot)) {
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => document.querySelector('.char-card.selected')?.dataset.key) === pilot) break;
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
    }
  } else if (pilot !== 'griffin') {
    await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot);
  }
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  const r = await page.evaluate(async ([human, pilot, hyper]) => {
    window.requestAnimationFrame = () => 0;
    const g = window.__LAO__.getGame();
    const p = g.player;
    g._updateStageFlow = () => {};
    g._resolveStageLeader = () => {};
    let boss = null;
    const pin = () => {
      if (!boss) return;
      boss.x = 640; boss.y = 270; boss.alive = true; boss.hp = Math.max(boss.hp, 5e6);
      if (boss.script) boss.script.tick = () => {};
      if (!p.skillRun && !p.bombRun && !p.hBomb) { p.x = 220; p.y = 270; }
    };
    const step = (n) => { for (let i = 0; i < n; i++) { g.bullets.clearEnemy(); p.invuln = Math.max(p.invuln, 1); g.update(1 / 60); pin(); } };
    step(60);
    g.enemies.length = 0;
    const st = g.stages[0];
    await g.assets.bank.ensureEnemy(st.boss); // stage 1's leaders load after the sortie
    g._spawnStageLeader(st.boss, 'boss', 1e7, 1);
    g.stagePhase = 'boss';
    boss = g.boss;
    step(120);
    if (human) { p.sp = p.spMax; g._keyInput.special = true; g._syncMergedInput(); step(2); g._keyInput.special = false; g._syncMergedInput(); for (let i = 0; i < 600 && !p.inHumanForm; i++) step(1); step(30); p.humanFor = 60; }
    p.shotLevel = 5;
    if (pilot === 'rampalion') {
      if (hyper) p._ramp.hyper = true;
      else { const m = await import('/js/rampalion.js'); for (let i = 0; i < 4; i++) m.rampFuse(p); step(90); }
    }
    const clean = () => { for (const b of g.bullets.list) if (b.friendly) b.alive = false; };
    // Normal fire at Lv5.
    let hp0 = boss.hp;
    g._keyInput.shoot = true; g._syncMergedInput();
    step(360);
    g._keyInput.shoot = false; g._syncMergedInput();
    const fire5 = (hp0 - boss.hp) / 6;
    step(90); clean();
    const busy = () => p.bombRun || p.skillRun || p.hBomb || p._bombAnimLock > 0;
    // One cast: damage and active time (to the last damage tick, or to the end of the bomb).
    const cast = (key, untilBusyEnds) => {
      hp0 = boss.hp;
      let last = 0; let prev = boss.hp; let f = 0;
      g._keyInput[key] = true; g._syncMergedInput(); step(2); f = 2;
      g._keyInput[key] = false; g._syncMergedInput();
      let quiet = 0;
      while (f < 60 * 16) {
        step(1); f += 1;
        if (boss.hp < prev) { last = f; quiet = 0; } else quiet += 1;
        prev = boss.hp;
        if (!busy() && quiet > 90) break;
      }
      const dmg = hp0 - boss.hp;
      const bombEnd = untilBusyEnds ? f - quiet : last;
      // Active time floored at 1 s: an instant burst can't inflate its DPS.
      const sec = Math.max(1, (untilBusyEnds ? bombEnd : last) / 60);
      step(60); clean();
      return { dmg: Math.round(dmg), sec: +sec.toFixed(2), dps: +(dmg / sec).toFixed(1) };
    };
    const res = { fire5: +fire5.toFixed(1) };
    if (!human && pilot !== 'peregrinus') {
      // (Rampalion's C levels are picked by SP: lv x spCost.)
      for (const lv of [1, 2, 3]) { p.sp = p.spCost * lv; res[`sp${lv}`] = cast('special', false); step(30); }
    }
    p.bombs = 3;
    res.bomb = cast('bomb', true);
    return res;
  }, [human, pilot, hyper]);
  const row = { pilot: entry, ...r, errors: errs.slice(0, 2) };
  rows.push(row);
  const f = (x) => (x ? `${String(x.dps).padStart(6)}/s (${x.dmg} in ${x.sec}s)` : '      -');
  const ok = (x) => (x ? (x.dps >= r.fire5 ? 'ok' : 'LOW') : '');
  console.log(`${entry.padEnd(12)} Lv5 fire ${String(r.fire5).padStart(6)}/s | sp1 ${f(r.sp1)} ${ok(r.sp1)} | sp2 ${f(r.sp2)} ${ok(r.sp2)} | sp3 ${f(r.sp3)} ${ok(r.sp3)} | bomb ${f(r.bomb)} ${ok(r.bomb)}${errs.length ? ' ERR ' + errs[0] : ''}`);
  await page.close();
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1));
