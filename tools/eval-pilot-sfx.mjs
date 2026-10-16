// Per-pilot SFX probe (in-game): plays the pilot through every moment that should carry a
// sound and logs what actually played - pilot voice lines (playVoice), original skill clips
// (playClip) and table cues (play) - with decode results, the master peak and live voices.
// Moments: stage start, C Lv1 / Lv2 / Lv3, X, WARNING, a hit, stage clear, the sortie line,
// plus Rampalion's own: part dock / fused, Hyper, leg dash / barrier, a shot eaten by the
// barrier, Tyrant shield break, armor hit (part knocked off), death.
// usage: node tools/eval-pilot-sfx.mjs out.json [pilot]     (static server on :5188)
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2];
const PILOT = process.argv[3] || 'rampalion';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 4, lang: 'ko', muted: false, autoFire: false, bgmVolume: 0.7, sfxVolume: 0.85 }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=ps' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.mouse.click(4, 4);
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
if (PILOT !== 'griffin') { await page.evaluate((k) => window.__LAO__.applySelectCheat(k), PILOT); await page.waitForTimeout(2500); }
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(500);

const res = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); const p = g.player; const a = g.audio;
  await a.ctx.resume();
  const R = await import('/js/rampalion.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // --- sound log
  const log = [];
  let moment = 'boot';
  const now = () => a.ctx.currentTime;
  const origPlay = a.play.bind(a);
  a.play = (key, style) => { const ok = origPlay(key, style); log.push({ m: moment, t: now(), kind: 'cue', key: style ? `${key}:${style}` : key, ok: ok !== false }); return ok; };
  const origClip = a.playClip.bind(a);
  a.playClip = (stem, gain) => { log.push({ m: moment, t: now(), kind: 'clip', key: stem, job: a.preloadClip(stem) }); return origClip(stem, gain); };
  const origVoice = a.playVoice.bind(a);
  a.playVoice = (stem, gain) => { if (stem) log.push({ m: moment, t: now(), kind: 'voice', key: stem }); return origVoice(stem, gain); };
  // --- live sources + master peak
  let live = 0; let maxLive = 0; let peak = 0; const peaks = {};
  const mk = a.ctx.createBufferSource.bind(a.ctx);
  a.ctx.createBufferSource = () => {
    const s = mk(); live += 1; maxLive = Math.max(maxLive, live);
    s.addEventListener('ended', () => { live -= 1; });
    return s;
  };
  // Real-time stepping so audio clock and sim agree (60 fps sim, 16 ms sleeps).
  const run = async (sec, each) => {
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) {
      each?.(i);
      g.update(1 / 60);
      const pk = a.samplePeak();
      peak = Math.max(peak, pk);
      peaks[moment] = Math.max(peaks[moment] || 0, pk);
      await sleep(16);
    }
  };
  const clearField = () => { for (const e of g.enemies) e.alive = false; g.enemies.length = 0; g.bullets.list.forEach((b) => { b.alive = false; }); g.powerUps.length = 0; };
  p.godMode = false; p.invuln = 0;
  const hitOff = p.hit.bind(p);
  p.hit = () => false; // no stray deaths between moments
  const moments = [];
  const at = async (name, fn, sec = 2.6) => {
    moment = name; moments.push(name);
    clearField();
    await fn();
    await run(sec, () => clearField());
  };
  await run(1.5);
  const stageVoice = log.some((l) => l.kind === 'voice' && l.key.endsWith('_stageStart'));
  // Sortie line (fired by the select screen on confirm, before this page state).
  await at('sortie', () => g._voice('sortie'), 1.6);
  const fuseAll = () => { while (R.rampFuse(p)) { /* */ } p._ramp.slots.forEach((e) => { e.attached = true; }); p._ramp.docks.length = 0; };
  // Docking: power-up -> robot flies in and fuses.
  await at('dock', () => g._rampalionFuse?.(), 1.6);
  for (const lv of [1, 2, 3]) {
    await at(`special${lv}`, () => { p.sp = p.spCost * lv + 0.01; g._specialQueued = true; }, lv === 3 ? 4.2 : 2.8);
  }
  await at('bomb', () => { p.bombs = 9; g._bombQueued = true; }, 6.2);
  // Leg skills.
  fuseAll();
  const leg = p._ramp.slots.find((e) => e.slot.id === 'leg');
  const setLeg = (robot) => { leg.opt = leg.slot.options.find((o) => o.robot === robot); leg.robot = robot; leg.attached = true; p._ramp.legCd = 0; };
  await at('legDash', () => { setLeg('shade'); g._legQueued = true; }, 1.0);
  await at('legBarrier', () => { setLeg('alfred'); g._legQueued = true; }, 0.4);
  moment = 'barrierAbsorb'; moments.push(moment);
  for (let i = 0; i < 3; i++) g.bullets.spawn({ x: p.x + 160, y: p.y - 20 + i * 20, vx: -500, vy: 0, r: 6, friendly: false });
  await run(1.2);
  p._ramp.barrier = null;
  // Tyrant shield break / armor hit (a part knocked off) through the real hit path.
  p.hit = hitOff;
  await at('shieldBreak', () => { p.invuln = 0; p._ramp.shieldUp = true; const s = p.hit(); if (s === 'shield') g._onRampalionShieldHit(); }, 1.2);
  await at('armorHit', () => { p.invuln = 0; p._ramp.shieldUp = false; p.shotLevel = 3; const s = p.hit(); if (s === 'armor') g._onRampalionArmorHit(); }, 1.6);
  p.hit = () => false;
  await at('warning', () => g._voice('warning'), 1.6);
  await at('clear', () => g._voice('clear'), 2.2);
  // Hyper Rampalion: the wing blades fly in.
  await at('hyper', () => { R.rampBreak(p, { eject: false, silent: true, all: true }); p._ramp.ejects = []; R.rampHyperStart(p, { force: true }); }, 2.4);
  // Death (life lost).
  p.hit = hitOff;
  await at('death', () => { p.invuln = 0; p._ramp.shieldUp = false; p.shotLevel = 1; p.godMode = false; const s = p.hit(); if (s === true) g._onPlayerStruck(); }, 2.0);
  // Resolve decodes.
  const clipOk = {};
  for (const l of log) if (l.kind === 'clip') clipOk[l.key] = !!(await l.job);
  const voiceOk = {};
  for (const l of log) {
    if (l.kind !== 'voice' || l.key in voiceOk) continue;
    const r = await fetch(`assets/audio/voice/${l.key}.ogg`);
    voiceOk[l.key] = r.ok && !!(await a.ctx.decodeAudioData(await r.arrayBuffer()).catch(() => null));
  }
  const out = log.map((l) => ({ m: l.m, t: +l.t.toFixed(3), kind: l.kind, key: l.key,
    ok: l.kind === 'clip' ? clipOk[l.key] : l.kind === 'voice' ? voiceOk[l.key] : l.ok }));
  return { pilot: g.charKey, moments, stageVoice, log: out, peak, peaks, maxLive };
});
res.errors = errs.slice(0, 5);
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log('moments', res.moments.length, 'sounds', res.log.length, 'peak', res.peak.toFixed(3), 'maxLive', res.maxLive, 'errors', res.errors.length);
await browser.close();
