// Leader fight probe: Griffin (P Lv3, held fire) vs every stage's midboss and boss, flown
// by a dodge bot (danger field over predicted bullet positions). Measures time-to-kill,
// hits taken per minute, peak on-screen enemy bullets, bullets/s per HP phase, attack
// kinds used, and stage length (boss entry time + kill). Writes JSON for the scorers.
// usage: node tools/eval-bosses.mjs out.json [pilot]
import { chromium } from 'playwright';
import fs from 'fs';

const out = process.argv[2];
const pilot = process.argv[3] || 'griffin';
const only = (process.argv[4] || '').split(',').filter(Boolean).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: false, padMode: 'fixed', fullscreen: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=eb' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#btn-start', { timeout: 90000 });
await page.click('#btn-start');
await page.waitForSelector('.char-card', { timeout: 90000 });
if (pilot !== 'griffin') await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot);
await page.waitForTimeout(500);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });

const res = await page.evaluate(async (only) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame();
  const p = g.player;
  const { LeaderScript, LEADER_SCRIPTS } = await import('/js/leader-script.js');
  const { hazardCovers } = await import('/js/leader-hazards.js');
  const W = 960; const H = 540;
  const HAZARD_WEIGHT = 5;
  for (let i = 0; i < 60; i++) { g.update(1 / 60); p.invuln = 99; }
  // Isolate the fight: no stage director (waves / ceremonies / transitions).
  g._updateStageFlow = () => {};
  g._resolveStageLeader = () => {};
  g.stagePhase = 'boss';
  p.shotLevel = 3;
  g._keyInput.shoot = true; g._syncMergedInput();
  let hits = 0;
  let byAttack = {};
  p.hit = () => {
    hits += 1; p.invuln = 1.2;
    const sc = g.boss?.script; const def = sc?.def;
    const a = def?.phases[Math.max(0, sc.phase)]?.attacks[sc.i]?.type || '?';
    const key = `${Math.max(0, sc?.phase ?? 0)}:${sc?.mode === 'fire' ? a : 'after-' + a}`;
    byAttack[key] = (byAttack[key] || 0) + 1;
    return false;
  };
  // Human-like dodge bot: re-plans every 0.15 s (reaction), only sees bullets within
  // 160 px, misjudges positions by up to 8 px, and keeps trying to line up with the leader.
  let plan = null; let planT = 0;
  const dodge = (dt, boss) => {
    const speed = p.meta?.speed ?? 300;
    planT -= dt;
    if (planT <= 0 || !plan) {
      planT = 0.15;
      let best = null;
      for (let i = -1; i < 8; i++) {
        const ang = i < 0 ? 0 : (i / 8) * Math.PI * 2;
        const vx = i < 0 ? 0 : Math.cos(ang); const vy = i < 0 ? 0 : Math.sin(ang);
        let danger = 0;
        for (const b of g.bullets.list) {
          if (!b.alive || b.friendly) continue;
          if (Math.abs(b.x - p.hitX) > 160 || Math.abs(b.y - p.hitY) > 160) continue;
          const ex = (Math.random() - 0.5) * 16; const ey = (Math.random() - 0.5) * 16;
          for (const la of [0.1, 0.25]) {
            const hx = p.hitX + vx * speed * la; const hy = p.hitY + vy * speed * la;
            const d2 = (b.x + ex + b.vx * la - hx) ** 2 + (b.y + ey + b.vy * la - hy) ** 2;
            if (d2 < 55 * 55) danger += 1 / (d2 + 40);
          }
        }
        const ny = p.y + vy * speed * 0.15; const nx = p.x + vx * speed * 0.15;
        // Area attacks: a human reads the warning line / ring and steps out of it.
        // Mortar target rings are a telegraph too: stay out of the marked circle.
        for (const m of boss.marks || []) {
          const dx = p.hitX + vx * speed * 0.3 - m.x; const dy = p.hitY + vy * speed * 0.3 - m.y;
          if (dx * dx + dy * dy < (m.r + 24) ** 2) danger += 0.06;
        }
        const hz = boss.hazards || [];
        for (const h of hz) {
          for (const la of [0.15, 0.3]) {
            if (hazardCovers(h, p.hitX + vx * speed * la, p.hitY + vy * speed * la, p.hitR + 6)) danger += 0.06;
          }
        }
        danger += Math.abs(ny - boss.y) * 0.00008 + Math.abs(nx - 200) * 0.00003;
        if (nx < 60 || nx > 420 || ny < 30 || ny > H - 30) danger += 1;
        if (!best || danger < best.d) best = { d: danger, vx, vy };
      }
      plan = best;
    }
    p.x = Math.max(60, Math.min(420, p.x + plan.vx * speed * dt));
    p.y = Math.max(30, Math.min(H - 30, p.y + plan.vy * speed * dt));
  };
  let stageNo = 1;
  const fight = (key, hp, kind) => {
    const clips = window.__LAO__.getAssets().anims[key] || window.__LAO__.getAssets().anims.boss_hachiko;
    g.enemies.forEach((e) => { e.alive = false; e.dying = false; });
    g.bullets.list.forEach((b) => { b.alive = false; });
    // Spawn exactly like the game (size, hit radius, flip, script, phase bodies).
    g.stageIndex = stageNo - 1;
    g.boss = null;
    // Final boss: three bodies fought one after another, each with half the stage HP.
    const forms = window.__LAO__.getAssets().ENEMY_META[key]?.phaseBodies?.length || 0;
    g._spawnStageLeader(key, kind, forms ? Math.round(hp * 0.5) : hp, 0, 0);
    let e = g.boss;
    if (!e || !e.alive) e = g._spawnEnemy({ x: W + 80, y: H / 2, clips, hp, score: 0, size: 128, drawScale: 1.5, kind,
      pattern: kind, name: key, script: new LeaderScript(LEADER_SCRIPTS[key]) });
    e.scriptKey = key;
    g.boss = e; g.stagePhase = 'boss'; g.state = 'playing'; g.paused = false;
    hits = 0; byAttack = {}; p.x = 160; p.y = 270; p.invuln = 0;
    let t = 0; let peak = 0; const phaseShots = [0, 0, 0]; const phaseTime = [0, 0, 0];
    let prevCount = 0;
    const kinds = new Set();
    let form = 0;
    const seenHz = new WeakSet();
    for (;;) {
    while (e.alive && t < 240) {
      g.enemies.forEach((o) => { if (o !== e) { o.alive = false; } });
      dodge(1 / 60, e);
      const before = g.bullets.list.filter((b) => b.alive && !b.friendly).length;
      g.update(1 / 60);
      t += 1 / 60;
      const live = g.bullets.list.filter((b) => b.alive && !b.friendly).length;
      peak = Math.max(peak, live);
      const ph = forms ? form : Math.max(0, e.script?.phase ?? 0);
      phaseTime[ph] += 1 / 60;
      if (live > before) phaseShots[ph] += live - before;
      // Area attacks count as HAZARD_WEIGHT bullets each (pressure for the escalation score).
      for (const h of e.hazards || []) if (!seenHz.has(h)) { seenHz.add(h); phaseShots[ph] += HAZARD_WEIGHT; }
      if (e.script?.mode === 'fire') kinds.add(e.script.def.phases[Math.max(0, e.script.phase)].attacks[e.script.i]?.type);
      p.invuln = Math.max(0, p.invuln);
      prevCount = live;
    }
    if (!forms || form >= forms - 1 || t >= 240) break;
    form += 1;
    g.boss = null;
    g._spawnStageLeader(key, kind, Math.round(hp * 0.5), 0, form);
    e = g.boss; e.scriptKey = key; g.stagePhase = 'boss';
    }
    const def = LEADER_SCRIPTS[key];
    return { key, hp, kind, forms, moves: [...new Set(def.phases.map((q) => q.move?.kind || 'drift'))], telegraph: true, rest: true, ttk: +t.toFixed(1), hitsPerMin: +(hits / (t / 60)).toFixed(2), hits, byAttack, peak,
      rate: phaseShots.map((s, i) => +(s / Math.max(0.1, phaseTime[i])).toFixed(1)), kinds: [...kinds] };
  };
  // Load every leader's clips first (the game streams them per stage).
  for (const st of g.stages) {
    for (const k of [st.mid, st.boss, ...(window.__LAO__.getAssets().ENEMY_META[st.boss]?.phaseBodies || [])]) {
      try { await g.assets.bank.ensureEnemy(k); } catch (e) { /* fallback below */ }
    }
  }
  const stages = [];
  for (let i = 0; i < g.stages.length; i++) {
    const st = g.stages[i];
    if (only.length && !only.includes(i + 1)) continue;
    stageNo = i + 1;
    // 5 runs each (the bot is noisy): hits/min averaged, TTK averaged.
    const avg = (key, hp, kind) => {
      const runs = [0, 1, 2, 3, 4].map(() => fight(key, hp, kind));
      const r = runs[0];
      r.hitsPerMin = +(runs.reduce((a, x) => a + x.hitsPerMin, 0) / runs.length).toFixed(2);
      r.ttk = +(runs.reduce((a, x) => a + x.ttk, 0) / runs.length).toFixed(1);
      r.peak = Math.max(...runs.map((x) => x.peak));
      r.byAttack = runs.map((x) => x.byAttack);
      return r;
    };
    const mid = avg(st.mid, st.midHp, 'midboss');
    const boss = avg(st.boss, st.bossHp, 'boss');
    stages.push({ stage: i + 1, mid, boss, midTTK: mid.ttk, bossTTK: boss.ttk, length: st.bossAt + mid.ttk + boss.ttk });
  }
  return { pilot: p.charKey, stages };
}, only);
console.log(JSON.stringify(res.stages.map((s) => [s.stage, s.mid.key, s.midTTK, s.mid.hitsPerMin, s.mid.peak, s.boss.key, s.bossTTK, s.boss.hitsPerMin, s.boss.peak])));
fs.writeFileSync(out, JSON.stringify(res, null, 1));
if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 3)));
await browser.close();
