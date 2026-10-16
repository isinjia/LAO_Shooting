// Low-end phone performance probe. Emulates a mid/low Android phone in landscape
// (915x412 CSS, DPR 2.625, touch, Android UA) with the CPU throttled (default 6x) and
// runs the real rAF loop through the heaviest moments of the game:
//   waves   stage 4 dense waves (Griffin P5, auto fire)
//   boss    final boss phase 3 (Roc body + face, bullet patterns)
//   bomb    LRL bomb (giant red beam) + Labiata special
//   human   Peregrinus human form: spiral laser + missiles + giant beam bomb
// Per scene: rAF frame times (avg fps, p95, hitches), JS update / draw ms.
// Also: time to title / to playable, bytes downloaded before play, JS heap,
// decoded image memory held by the asset bank, low-end path flags, page errors.
// usage: node tools/perf-mobile.mjs out.json [cpuRate=6] [secondsPerScene=6]   (GPU=sw, SHEET=scale env)
import { chromium } from 'playwright';
import fs from 'fs';

const out = process.argv[2] || 'perf-mobile.json';
const RATE = Number(process.argv[3] || 6);
const SECS = Number(process.argv[4] || 6);
const URL = 'http://localhost:5188/';
// Hardware GPU (phones raster on a GPU); GPU=sw falls back to headless SwiftShader.
const browser = await chromium.launch({ args: process.env.GPU === 'sw' ? [] : ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });

async function openGame(pilot) {
  const ctx = await browser.newContext({
    viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-A325F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  let bytes = 0;
  page.on('response', async (r) => {
    try { const len = Number(r.headers()['content-length'] || 0); bytes += len; } catch { /* */ }
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  if (process.env.NOGL) await page.addInitScript(() => { window.__PM_NOGL__ = 1; });
  // Default = a typical mid/low phone (4 cores, 4 GB) so the low-end quality path is what
  // gets measured; TIER=high keeps the host values (6+ cores, 8 GB) = the high-end path.
  if (process.env.TIER !== 'high') {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
    });
  }
  await page.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: true, padMode: 'fixed', fullscreen: false }));
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  const t0 = Date.now();
  await page.goto(URL + '?cb=pm' + Date.now() + (process.env.SHEET ? '&sheetScale=' + process.env.SHEET : ''), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  const tTitle = (Date.now() - t0) / 1000;
  await page.click('#btn-start');
  await page.waitForSelector('.char-card', { timeout: 300000 });
  if (pilot !== 'griffin') await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot);
  await page.waitForTimeout(300);
  const t1 = Date.now();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  const tPlay = (Date.now() - t1) / 1000 + tTitle;
  // Encoded bytes of every resource fetched so far (headers may lack content-length).
  const bytesAtPlay = Math.max(bytes, await page.evaluate(() => performance.getEntriesByType('resource')
    .reduce((a, e) => a + (e.encodedBodySize || e.transferSize || 0), 0)));
  // Per-frame JS cost: wrap update / draw of the live game.
  await page.evaluate(() => {
    const g = window.__LAO__.getGame();
    const st = window.__PM__ = { up: [], dr: [] };
    const u = g.update.bind(g); const d = g.draw.bind(g);
    g.update = (dt) => { const a = performance.now(); u(dt); st.up.push(performance.now() - a); };
    g.draw = () => { const a = performance.now(); d(); st.dr.push(performance.now() - a); };
    g.player.hit = () => false;
    if (window.__PM_NOGL__) { g.projectileVfx.active = false; }
  });
  CDP = cdp;
  return { ctx, page, cdp, errs, tTitle, tPlay, bytesAtPlay };
}

let CDP = null;
const profiles = {};
async function sample(page, secs, label, prep) {
  await page.evaluate(prep);
  await page.waitForTimeout(400);
  const prof = process.env.PROFILE && process.env.PROFILE.split(',').includes(label) && CDP;
  if (prof) { await CDP.send('Profiler.enable'); await CDP.send('Profiler.setSamplingInterval', { interval: 200 }); await CDP.send('Profiler.start'); }
  const tr = process.env.TRACE && process.env.TRACE.split(',').includes(label) && CDP;
  const events = [];
  if (tr) {
    CDP.on('Tracing.dataCollected', (e) => events.push(...e.value));
    await CDP.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  }
  const r = await sample0(page, secs, label);
  if (tr) {
    const done = new Promise((res) => CDP.once('Tracing.tracingComplete', res));
    await CDP.send('Tracing.end'); await done;
    const main = events.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
    const agg = {};
    for (const e of events) {
      if (e.ph !== 'X' || !e.dur || (main && (e.pid !== main.pid || e.tid !== main.tid))) continue;
      agg[e.name] = (agg[e.name] || 0) + e.dur / 1000;
    }
    profiles['trace:' + label] = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => `${(v / r.frames).toFixed(2)}ms/f ${k}`);
  }
  if (prof) {
    const { profile } = await CDP.send('Profiler.stop');
    const self = {}; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const dt = {}; profile.samples.forEach((id, i) => { dt[id] = (dt[id] || 0) + (profile.timeDeltas[i] || 0); });
    for (const [id, t] of Object.entries(dt)) { const n = byId.get(+id); const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`; self[k] = (self[k] || 0) + t; }
    const tot = Object.values(self).reduce((a, b) => a + b, 0);
    profiles[label] = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / tot * 100).toFixed(1)}% ${k}`);
  }
  return r;
}
async function sample0(page, secs, label) {
  return page.evaluate(async ([secs, label]) => {
    const st = window.__PM__; st.up.length = 0; st.dr.length = 0;
    const dts = []; let last = performance.now(); const t0 = last;
    let peakB = 0; let peakE = 0;
    await new Promise((res) => {
      const f = (now) => {
        dts.push(now - last); last = now;
        const g = window.__LAO__.getGame();
        if (g) {
          let b = 0; for (const x of g.bullets.list) if (x.alive) b += 1;
          peakB = Math.max(peakB, b); peakE = Math.max(peakE, g.enemies.filter((e) => e.alive).length);
          g.player.invuln = Math.max(g.player.invuln, 0.5);
        }
        if (now - t0 < secs * 1000) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    const x = dts.slice(2).filter((d) => d > 0);
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const sorted = [...x].sort((a, b) => a - b);
    return {
      label, frames: x.length, fps: +(1000 / avg(x)).toFixed(1),
      p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
      hitch50: +(x.filter((d) => d > 50).length / Math.max(1, x.length)).toFixed(3),
      updateMs: +avg(st.up).toFixed(2), drawMs: +avg(st.dr).toFixed(2), peakBullets: peakB, peakEnemies: peakE,
      jsP95: (() => { const js = st.up.map((u, i) => u + (st.dr[i] || 0)).sort((a, b) => a - b); return js.length ? +js[Math.floor(js.length * 0.95)].toFixed(1) : 0; })(),
      jsMax: +Math.max(0, ...st.up.map((u, i) => u + (st.dr[i] || 0))).toFixed(1),
    };
  }, [secs, label]);
}

async function memory(page, cdp) {
  const heap = await cdp.send('Runtime.getHeapUsage');
  const img = await page.evaluate(() => {
    const seen = new Set(); let px = 0; let n = 0;
    const visit = (o, depth, path = '') => {
      if (!o || typeof o !== 'object' || depth > 6 || seen.has(o)) return;
      seen.add(o);
      if (o instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && o instanceof ImageBitmap) || o instanceof HTMLCanvasElement
        || (typeof OffscreenCanvas !== 'undefined' && o instanceof OffscreenCanvas)) {
        const w = o.naturalWidth || o.width || 0; const h = o.naturalHeight || o.height || 0;
        if (w * h > 0) { px += w * h; n += 1; (window.__PM_TOP__ ||= []).push([path, w, h]); }
        return;
      }
      if (o instanceof Node || o instanceof Window) return;
      if (Array.isArray(o)) { o.forEach((v, i) => visit(v, depth + 1, path + '[' + i + ']')); return; }
      if (o instanceof Map) { for (const [k, v] of o) visit(v, depth + 1, path + '{' + k + '}'); return; }
      for (const k of Object.keys(o)) { try { visit(o[k], depth + 1, path + '.' + k); } catch { /* */ } }
    };
    window.__PM_TOP__ = []; visit(window.__LAO__.getAssets(), 0, 'A');
    const g = window.__LAO__.getGame(); visit(g, 0, 'G');
    const c = document.getElementById('game'); const r = c.getBoundingClientRect();
    const html = document.documentElement;
    return {
      imageMB: +(px * 4 / 1048576).toFixed(1), images: n, top: window.__PM_TOP__,
      canvas: { cssW: Math.round(r.width), cssH: Math.round(r.height), bufW: c.width, bufH: c.height },
      lowend: html.classList.contains('is-lowend-gfx'),
      pads: !!document.querySelector('#touch-pads:not([hidden]), .touch-pad, .tpad, [data-pad]'),
    };
  });
  return { heapMB: +(heap.usedSize / 1048576).toFixed(1), ...img };
}

const scenes = [];
let boot = null; let mem = null; const errors = [];

// 1) Griffin: dense stage 4 waves, then the final boss phase 3.
{
  const s = await openGame('griffin');
  boot = { tTitle: s.tTitle, tPlay: s.tPlay, mbAtPlay: +(s.bytesAtPlay / 1048576).toFixed(1) };
  await s.page.evaluate(async () => {
    const g = window.__LAO__.getGame();
    // What the game itself keeps late in a run: stage 4 + 5 (unloadDistantStages).
    for (const i of [3, 4]) { try { await g.assets.bank.ensureStage(i); } catch { /* */ } }
    g.assets.bank.unloadDistantStages?.(3);
  });
  scenes.push(await sample(s.page, SECS, 'waves', () => {
    const g = window.__LAO__.getGame();
    g.enemies.length = 0; g.bullets.clearEnemy(); g.boss = null;
    g.stageIndex = 3; g.stageClock = 0; g.stageWaveIndex = 0; g.midDone = true;
    g._beginStageSegment(3);
    g.stagePhase = 'waves'; g.state = 'playing';
    g.stageClock = 74; g.stageWaveIndex = g.stages[3].waves.findIndex((w) => w.at >= 74);
    g.player.shotLevel = 5;
  }));
  scenes.push(await sample(s.page, SECS, 'boss', () => {
    const g = window.__LAO__.getGame();
    g.enemies.length = 0; g.bullets.clearEnemy();
    g.stageIndex = 4; g._beginStageSegment(4);
    g._updateStageFlow = () => {}; g._resolveStageLeader = () => {};
    const st = g.stages[4];
    g._spawnStageLeader(st.boss, 'boss', st.bossHp, st.bossScore);
    g.stagePhase = 'boss';
    const b = g.boss; b.x = 760; b.hp = b.maxHp * 0.3;
  }));
  mem = await memory(s.page, s.cdp);
  errors.push(...s.errs);
  await s.ctx.close();
}

// 2) LRL bomb (giant beam) over waves.
{
  const s = await openGame('lrl');
  scenes.push(await sample(s.page, SECS, 'bomb', () => {
    const g = window.__LAO__.getGame();
    g.stageClock = 20; g.stageWaveIndex = g.stages[0].waves.findIndex((w) => w.at >= 20);
    g.player.shotLevel = 5; g.player.bombs = 3;
    g._keyInput.bomb = true; g._syncMergedInput();
    setTimeout(() => { g._keyInput.bomb = false; g._syncMergedInput(); }, 150);
  }));
  errors.push(...s.errs);
  await s.ctx.close();
}

// 3) Peregrinus human form: spiral laser + missiles, then the giant beam bomb.
{
  const s = await openGame('peregrinus');
  scenes.push(await sample(s.page, SECS, 'human', () => {
    const g = window.__LAO__.getGame();
    const p = g.player;
    g.stageClock = 20; g.stageWaveIndex = g.stages[0].waves.findIndex((w) => w.at >= 20);
    p.shotLevel = 5; p.sp = p.spMax; p.bombs = 3;
    g._keyInput.special = true; g._syncMergedInput();
    setTimeout(() => { g._keyInput.special = false; g._syncMergedInput(); }, 150);
    setTimeout(() => { g._keyInput.bomb = true; g._syncMergedInput(); }, 2500);
    setTimeout(() => { g._keyInput.bomb = false; g._syncMergedInput(); }, 2650);
  }));
  errors.push(...s.errs);
  await s.ctx.close();
}

await browser.close();
const res = { cpuRate: RATE, boot, mem, scenes, errors: errors.slice(0, 5), profiles };
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
