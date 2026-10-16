// Wave-section probe (everything but the leader fights). For each stage the real stage
// director runs from the stage start to the boss windup; the midboss is removed on arrival.
// Griffin starts at the expected P level for that stage (Lv1, 3, 4, 5, 5) and a dodge bot
// flies: reacts every 0.15 s, sees bullets within 160 px with +-8 px error, lines up with
// the nearest enemy ahead and picks up items when it is safe. Runs N times per stage.
// usage: node tools/eval-waves.mjs out.json [runs] [stages e.g. 1,3]
import { chromium } from 'playwright';
import fs from 'fs';

const out = process.argv[2];
const RUNS = Number(process.argv[3] || 3);
const only = (process.argv[4] || '').split(',').filter(Boolean).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: false, padMode: 'fixed', fullscreen: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=ew' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#btn-start', { timeout: 300000 });
await page.click('#btn-start');
await page.waitForSelector('.char-card', { timeout: 300000 });
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });

const res = await page.evaluate(async ([RUNS, only]) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame();
  const p = g.player;
  const H = 540;
  for (let i = 0; i < g.stages.length; i++) { try { await g.assets.bank.ensureStage(i); } catch (e) { /* skip */ } }
  const START_LV = [1, 3, 4, 5, 5];
  let hits = 0;
  p.hit = () => { hits += 1; p.invuln = 1.2; return false; };
  g._keyInput.shoot = true; g._syncMergedInput();
  let plan = null; let planT = 0;
  const bot = (dt) => {
    const speed = p.meta?.speed ?? 300;
    planT -= dt;
    if (planT <= 0 || !plan) {
      planT = 0.15;
      const ahead = g.enemies.filter((e) => e.alive && !e.dying && e.x > p.x + 40 && e.x < 960);
      ahead.sort((a, b) => a.x - b.x);
      const target = ahead[0];
      const item = g.powerUps.filter((u) => u.alive !== false).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
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
        for (const e of g.enemies) {
          if (!e.alive || e.dying) continue;
          const d2 = (e.x - (p.x + vx * speed * 0.2)) ** 2 + (e.y - (p.y + vy * speed * 0.2)) ** 2;
          if (d2 < 70 * 70) danger += 0.6 / (d2 + 60);
        }
        const ny = p.y + vy * speed * 0.15; const nx = p.x + vx * speed * 0.15;
        if (danger < 0.002 && item) danger += Math.hypot(nx - item.x, ny - item.y) * 0.00004;
        else if (target) danger += Math.abs(ny - target.y) * 0.00008;
        danger += Math.abs(nx - 200) * 0.00003;
        if (nx < 60 || nx > 460 || ny < 30 || ny > H - 30) danger += 1;
        if (!best || danger < best.d) best = { d: danger, vx, vy };
      }
      plan = best;
    }
    p.x = Math.max(60, Math.min(460, p.x + plan.vx * speed * dt));
    p.y = Math.max(30, Math.min(H - 30, p.y + plan.vy * speed * dt));
  };
  const runStage = (si) => {
    // Re-enter the stage like a transition does.
    g.enemies.length = 0; g.bullets.clearEnemy(); g.powerUps.length = 0; g.boss = null;
    g.stageIndex = si; g.stageClock = 0; g.stageWaveIndex = 0; g.midDone = false;
    g._lastPowerRecoveryAt = 0; g._powerRecoveryDueAt = Infinity;
    g._beginStageSegment(si);
    g.stagePhase = 'waves'; g.state = 'playing'; g.paused = false;
    p.shotLevel = START_LV[si]; p.alive = true; p.invuln = 0; p.x = 160; p.y = 270; p.lives = 9;
    hits = 0;
    const seen = new Map();
    const origSpawn = g._spawnEnemy.bind(g);
    g._spawnEnemy = (o) => { const e = origSpawn(o); if (e.kind !== 'boss' && e.kind !== 'midboss') seen.set(e, { t: tWave, onAt: null, kind: e.maxHp >= g.stages[si].eliteHp * 0.6 ? 'elite' : 'grunt' }); return e; };
    let tWave = 0; let busy = 0; let peak = 0; let lvAtMid = 0; let tSim = 0;
    const firstHalf = []; const pats = new Set(); const moves = new Set();
    while (tSim < 400) {
      if (g.stagePhase === 'midboss' && g.boss?.alive) { g.boss.alive = false; g.boss.dying = false; lvAtMid = p.shotLevel; }
      if (g.stagePhase === 'boss-windup' || g.stagePhase === 'boss') break;
      const inWaves = g.stagePhase === 'waves';
      if (inWaves) bot(1 / 60);
      g.update(1 / 60);
      tSim += 1 / 60;
      if (!inWaves) continue;
      tWave += 1 / 60;
      let on = 0;
      for (const e of g.enemies) {
        if (!e.alive || e.kind === 'boss' || e.kind === 'midboss') continue;
        if (e.x < 960 && e.x > 0) { on += 1; const r = seen.get(e); if (r && r.onAt === null) r.onAt = tWave; }
        pats.add(e.pattern); if (e.moveFn?.name) moves.add(e.moveFn.name);
      }
      for (const [e, r] of seen) if (r.deadAt === undefined && e.hp <= 0) r.deadAt = tWave;
      if (on > 0) busy += 1 / 60;
      peak = Math.max(peak, g.bullets.list.filter((b) => b.alive && !b.friendly).length);
    }
    g._spawnEnemy = origSpawn;
    const recs = [...seen.entries()];
    const killed = recs.filter(([e]) => e.hp <= 0);
    const ttk = (kind) => {
      const xs = killed.filter(([, r]) => r.kind === kind && r.onAt !== null && r.deadAt !== undefined).map(([, r]) => r.deadAt - r.onAt);
      return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null;
    };
    const half = tWave / 2;
    const s1 = recs.filter(([, r]) => r.t < half).length; const s2 = recs.length - s1;
    return { stage: si + 1, waveTime: +tWave.toFixed(1), hitsPerMin: +(hits / (tWave / 60)).toFixed(2), busy: +(busy / tWave).toFixed(2),
      spawned: recs.length, killRatio: +(killed.length / Math.max(1, recs.length)).toFixed(2), peak,
      patterns: [...pats], moves: [...moves], firstHalf: s1, secondHalf: s2, lvAtMid, lvAtBoss: p.shotLevel,
      gruntTTK: ttk('grunt'), eliteTTK: ttk('elite'),
      gruntHp: g.stages[si].gruntHp, eliteHp: g.stages[si].eliteHp };
  };
  const stages = [];
  for (let si = 0; si < g.stages.length; si++) {
    if (only.length && !only.includes(si + 1)) continue;
    const runs = [];
    for (let r = 0; r < RUNS; r++) runs.push(runStage(si));
    const avg = (k) => +(runs.reduce((a, x) => a + x[k], 0) / runs.length).toFixed(2);
    stages.push({ ...runs[0], hitsPerMin: avg('hitsPerMin'), busy: avg('busy'), killRatio: avg('killRatio'), waveTime: avg('waveTime'),
      lvAtMid: avg('lvAtMid'), lvAtBoss: avg('lvAtBoss'), peak: Math.max(...runs.map((x) => x.peak)), runs: runs.length });
  }
  return { stages };
}, [RUNS, only]);
console.log(JSON.stringify(res.stages.map((s) => [s.stage, s.waveTime, s.hitsPerMin, s.busy, s.killRatio, s.peak, s.lvAtMid, s.lvAtBoss, s.patterns.length, s.moves.length])));
fs.writeFileSync(out, JSON.stringify(res, null, 1));
if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 3)));
await browser.close();
