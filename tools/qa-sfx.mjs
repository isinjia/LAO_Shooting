// SFX QA: plays every pilot through the real stage flow (bot as in test-release) with the
// audio clock driven by sim time, and logs every sound request and its outcome (original
// clip / synth fallback / suppressed by cooldown or disabled), plus the game events that
// should carry a sound (kills, hits, pickups, warnings, leader area attacks, C / X, ...).
// Writes JSON for review: per-cue counts, peak rate per 1 s, suppression ratio, and events
// that happened with no sound at all.
// usage: node tools/qa-sfx.mjs out.json [pilots] [stages]
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2] || 'qa-sfx.json';
const PILOTS = (process.argv[3] || 'griffin,sleipnir,express76,constantia,labiata,lrl,peregrinus').split(',');
const STAGES = Number(process.argv[4] || 5);
const URL = 'http://localhost:5188/';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const report = { runs: [] };

for (const pilot of PILOTS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: false, autoFire: true, bgmVolume: 0.7, sfxVolume: 0.85 }));
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await page.goto(URL + '?cb=qs' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
  if (pilot === 'sleipnir' || pilot === 'express76') {
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => document.querySelector('.char-card.selected')?.dataset.key) === pilot) break;
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
    }
  } else if (pilot !== 'griffin') { await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot); await page.waitForTimeout(2500); }
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  const res = await page.evaluate(async (STAGES) => {
    window.requestAnimationFrame = () => 0;
    const g = window.__LAO__.getGame(); const p = g.player; const a = g.audio;
    p.godMode = true;
    let sim = 0;
    // Audio clock = sim clock, so cooldowns / voice caps behave as in real-time play.
    if (a.ctx) Object.defineProperty(a.ctx, 'currentTime', { get: () => sim, configurable: true });
    try { await a.ctx?.resume?.(); } catch { /* */ }
    const log = []; const ev = [];
    let cur = null;
    const wrap = (obj, name, tag) => {
      const f = obj[name]; if (typeof f !== 'function') return;
      obj[name] = function (...args) { const r = f.apply(this, args); if (cur && (tag !== 'file' || r)) cur.out.add(tag); return r; };
    };
    wrap(a, '_playSfx', 'file'); wrap(a, '_playBuffer', 'file');
    for (const n of ['tone', 'hiss', 'click']) wrap(a, n, 'synth');
    const play = a.play;
    a.play = function (kind, detail) {
      cur = { t: +sim.toFixed(3), kind, style: typeof detail === 'string' ? detail : detail?.style || '', out: new Set() };
      try { return play.call(this, kind, detail); } finally {
        log.push({ t: cur.t, kind: cur.kind, style: cur.style, out: [...cur.out].join('+') || 'suppressed' });
        cur = null;
      }
    };
    for (const n of ['playClip', 'playVoice']) {
      const f = a[n];
      a[n] = function (stem, ...rest) { log.push({ t: +sim.toFixed(3), kind: n, style: String(stem), out: 'clip' }); return f.call(this, stem, ...rest); };
    }
    // Game events that should carry a sound.
    const note = (type, extra = '') => ev.push({ t: +sim.toFixed(3), type, extra });
    const hz = g._hazardImpact.bind(g);
    g._hazardImpact = (h) => { note('hazard', h.kind + (h.style ? ':' + h.style : '')); return hz(h); };
    const nk = g.fx.noteKill.bind(g.fx);
    g.fx.noteKill = (...args) => { note('kill', args[3]?.boss ? 'boss' : ''); return nk(...args); };
    const bw = g._beginWarning.bind(g);
    g._beginWarning = (...args) => { note('warning', String(args[0])); return bw(...args); };
    const sp = g.bullets.spawn.bind(g.bullets);
    let lastEnemyShot = -1;
    g.bullets.spawn = (o) => { if (o && !o.friendly && sim - lastEnemyShot > 0.05) { note('enemyFire'); lastEnemyShot = sim; } return sp(o); };
    let stage = g.stageIndex; let cleared = 0;
    const MAX = 60 * 60 * 40;
    for (let i = 0; i < MAX; i++) {
      const tgt = g.boss?.alive ? g.boss : g.enemies.find((e) => e.alive && !e.dying && e.x < 960);
      const ty = tgt ? tgt.y : 270;
      p.y += Math.max(-4, Math.min(4, ty - p.y));
      p.x += Math.max(-3, Math.min(3, 170 - p.x));
      g._keyInput.shoot = true;
      if (i % 30 === 0) g._syncMergedInput();
      if (p.spReady && g.boss?.alive && i % 120 === 0) { g._keyInput.special = true; g._syncMergedInput(); note('special'); }
      else if (g._keyInput.special) { g._keyInput.special = false; g._syncMergedInput(); }
      if (g.boss?.alive && p.bombs > 0 && i % 1800 === 900) { g._keyInput.bomb = true; g._syncMergedInput(); note('bomb'); }
      else if (g._keyInput.bomb) { g._keyInput.bomb = false; g._syncMergedInput(); }
      // One real hit per stage (god mode off for a frame) so hit / death cues are exercised.
      if (i % 3600 === 2000 && p.alive && !p.isRespawning) { p.godMode = false; p.invuln = 0; if (p.hit?.()) g._onPlayerStruck(); note('playerHitForced'); p.godMode = true; p.lives = Math.max(p.lives, 3); }
      if (g.stagePhase === 'asset-gate') { await new Promise((r) => setTimeout(r, 50)); g.update(1 / 60); continue; }
      g.update(1 / 60);
      sim += 1 / 60;
      if (g.stageIndex > stage) { cleared += 1; stage = g.stageIndex; note('stageClear'); if (cleared >= STAGES) break; }
      if (g.state === 'cleared') { cleared = g.stages.length; note('allClear'); break; }
      if (g.state === 'gameover') break;
      if (i % 600 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { sim: +sim.toFixed(1), cleared, log, ev, disabled: [] };
  }, STAGES);
  report.runs.push({ pilot, errs, ...res });
  console.log(pilot, 'sim', res.sim, 'cleared', res.cleared, 'sounds', res.log.length, 'events', res.ev.length, 'errs', errs.length);
  await page.close();
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(report));
