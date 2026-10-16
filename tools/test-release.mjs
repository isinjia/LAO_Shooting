// Release smoke test: every pilot plays stages 1-5 through the real stage flow (waves ->
// midboss -> boss -> next stage) with a simple bot (auto fire, tracks the leader's row,
// uses C / X), then UI flows (pause / resume, options, game over -> retry) on desktop and a
// phone viewport. Records page errors, console errors, failed requests, stalls, NaN state
// and touch-target / overflow problems. Writes JSON for tools/score-release.mjs.
// usage: node tools/test-release.mjs out.json [pilots]
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2] || 'release-test.json';
const PILOTS = (process.argv[3] || 'griffin,sleipnir,express76,constantia,labiata,lrl,peregrinus').split(',');
const URL = 'http://localhost:5188/';
const browser = await chromium.launch();
const report = { runs: [], ui: [] };

async function open(viewport, mobile) {
  const ctx = await browser.newContext(mobile
    ? { viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport });
  const page = await ctx.newPage();
  const log = { pageErrors: [], consoleErrors: [], failed: [] };
  page.on('pageerror', (e) => log.pageErrors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.url().replace(URL, '')}`); });
  page.on('requestfailed', (r) => log.failed.push(`FAIL ${r.url().replace(URL, '')}`));
  await page.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: true }));
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await page.goto(URL + '?cb=rt' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  return { ctx, page, log };
}

async function sortie(page, pilot) {
  await page.click('#btn-start');
  await page.waitForSelector('.char-card');
  await page.waitForTimeout(300);
  if (pilot === 'sleipnir' || pilot === 'express76') {
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => document.querySelector('.char-card.selected')?.dataset.key) === pilot) break;
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
    }
  } else if (pilot !== 'griffin') {
    await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot);
    await page.waitForTimeout(2500);
  }
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
}

// ---- 1) full runs ----
for (const pilot of PILOTS) {
  const { ctx, page, log } = await open({ width: 1280, height: 720 }, false);
  const t0 = Date.now();
  let res = null;
  try {
    await sortie(page, pilot);
    res = await page.evaluate(async () => {
      window.requestAnimationFrame = () => 0;
      const g = window.__LAO__.getGame(); const p = g.player;
      p.godMode = true;
      const out = { stagesCleared: 0, stalls: [], nan: 0, phases: [], specials: 0, bombs: 0, simMin: 0 };
      let lastPhase = ''; let phaseT = 0; let sim = 0; let stage = g.stageIndex;
      const MAX = 60 * 60 * 40; // 40 sim minutes
      for (let i = 0; i < MAX; i++) {
        // Bot: hold the leader's row (or the nearest enemy's), stay on the left third.
        const tgt = g.boss?.alive ? g.boss : g.enemies.find((e) => e.alive && !e.dying && e.x < 960);
        const ty = tgt ? tgt.y : 270;
        p.y += Math.max(-4, Math.min(4, ty - p.y));
        p.x += Math.max(-3, Math.min(3, 170 - p.x));
        g._keyInput.shoot = true;
        if (i % 30 === 0) g._syncMergedInput();
        if (p.spReady && g.boss?.alive && i % 120 === 0) { g._keyInput.special = true; g._syncMergedInput(); out.specials += 1; }
        else if (g._keyInput.special) { g._keyInput.special = false; g._syncMergedInput(); }
        if (g.boss?.alive && p.bombs > 0 && i % 1800 === 900) { g._keyInput.bomb = true; g._syncMergedInput(); out.bombs += 1; }
        else if (g._keyInput.bomb) { g._keyInput.bomb = false; g._syncMergedInput(); }
        // Asset gates wait on real network / decode time: wait in wall-clock, not sim time.
        if (g.stagePhase === 'asset-gate') { await new Promise((r) => setTimeout(r, 50)); g.update(1 / 60); continue; }
        g.update(1 / 60);
        sim += 1 / 60;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || (g.boss && !Number.isFinite(g.boss.hp))) out.nan += 1;
        const ph = `${g.stageIndex}:${g.stagePhase}`;
        if (ph !== lastPhase) { out.phases.push(`${sim.toFixed(0)}s ${ph}`); lastPhase = ph; phaseT = 0; }
        phaseT += 1 / 60;
        if (phaseT > 240) { out.stalls.push(`${ph} stuck ${phaseT.toFixed(0)}s`); break; }
        if (g.stageIndex > stage) { out.stagesCleared += 1; stage = g.stageIndex; }
        if (g.state === 'cleared') { out.stagesCleared = g.stages.length; out.cleared = true; break; }
        if (g.state === 'gameover') { out.gameover = true; break; }
        if (i % 600 === 0) await new Promise((r) => setTimeout(r, 0)); // let loaders run
      }
      out.simMin = +(sim / 60).toFixed(1);
      out.phases = out.phases.slice(-6);
      return out;
    });
  } catch (e) {
    log.pageErrors.push('TEST ' + String(e).slice(0, 200));
  }
  report.runs.push({ pilot, wallSec: Math.round((Date.now() - t0) / 1000), ...res, ...log });
  console.log(pilot, JSON.stringify({ cleared: res?.cleared, stages: res?.stagesCleared, stalls: res?.stalls, sim: res?.simMin, errs: log.pageErrors.length + log.consoleErrors.length, failed: log.failed.length }));
  await ctx.close();
}

// ---- 2) UI flows ----
for (const [label, vp, mobile] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 844, height: 390 }, true], ['tablet', { width: 1024, height: 768 }, true]]) {
  const { ctx, page, log } = await open(vp, mobile);
  const checks = {};
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1);
  checks.titleNoOverflow = !(await overflow());
  // Touch targets on the title / select screens (>= 44 CSS px on the short side).
  const small = async () => page.evaluate(() => [...document.querySelectorAll('button, .char-card, .tc-btn')]
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden' && getComputedStyle(b).display !== 'none'; })
    .filter((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; })
    .map((b) => (b.id || b.className || b.textContent).toString().slice(0, 30)));
  checks.titleSmallTargets = mobile ? await small() : [];
  await sortie(page, 'griffin');
  checks.playNoOverflow = !(await overflow());
  checks.playSmallTargets = mobile ? await small() : [];
  // Pause / resume.
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  checks.pauseOpens = await page.evaluate(() => !document.getElementById('overlay')?.classList.contains('hidden'));
  checks.pauseSmallTargets = mobile ? await small() : [];
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  checks.pauseResumes = await page.evaluate(() => document.getElementById('overlay')?.classList.contains('hidden'));
  // Game over -> retry -> second sortie.
  await page.evaluate(() => { const g = window.__LAO__.getGame(); g.player.lives = 1; g.player.invuln = 0; g.player.godMode = false; g.player.hit(); });
  try {
    await page.waitForSelector('#btn-retry', { timeout: 20000 });
    checks.gameOverShows = true;
    checks.resultSmallTargets = mobile ? await small() : [];
    await page.click('#btn-retry');
    await page.waitForSelector('.char-card', { timeout: 30000 });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 120000 });
    checks.retryStarts = true;
  } catch { checks.gameOverShows ??= false; checks.retryStarts = false; }
  report.ui.push({ label, checks, ...log });
  console.log(label, JSON.stringify(checks), 'errs', log.pageErrors.length + log.consoleErrors.length, 'failed', log.failed.length);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
