/**
 * Honest rAF FPS + CDP JS heap sampler (2026-10-04).
 * Title/select idle, SORTIE combat ~16s, pause overlay.
 * Viewports: 960×540 (dpr1) and 412×226 (hasTouch, dpr 2.5).
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
};

function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

function heapStats(heapsMb) {
  if (!heapsMb.length) return null;
  let drops = 0;
  let maxDrop = 0;
  for (let i = 1; i < heapsMb.length; i++) {
    const d = heapsMb[i - 1] - heapsMb[i];
    if (d >= 2) {
      drops += 1;
      if (d > maxDrop) maxDrop = d;
    }
  }
  return {
    n: heapsMb.length,
    firstMb: +heapsMb[0].toFixed(2),
    lastMb: +heapsMb[heapsMb.length - 1].toFixed(2),
    minMb: +Math.min(...heapsMb).toFixed(2),
    maxMb: +Math.max(...heapsMb).toFixed(2),
    climbMb: +(heapsMb[heapsMb.length - 1] - heapsMb[0]).toFixed(2),
    gcDropsGe2Mb: drops,
    maxGcDropMb: +maxDrop.toFixed(2),
  };
}

async function pollHeap(cdp, ms) {
  const series = [];
  const t0 = Date.now();
  while (Date.now() - t0 < Math.max(200, ms - 80)) {
    let used = null;
    let total = null;
    try {
      const usage = await cdp.send('Runtime.getHeapUsage');
      used = usage.usedSize;
      total = usage.totalSize;
    } catch {
      /* */
    }
    try {
      const { metrics } = await cdp.send('Performance.getMetrics');
      const map = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
      if (used == null) used = map.JSHeapUsedSize;
      if (total == null) total = map.JSHeapTotalSize;
      series.push({
        usedMb: used != null ? +(used / 1048576).toFixed(3) : null,
        totalMb: total != null ? +(total / 1048576).toFixed(3) : null,
        nodes: map.Nodes ?? null,
        listeners: map.JSEventListeners ?? null,
      });
    } catch {
      if (used != null) {
        series.push({
          usedMb: +(used / 1048576).toFixed(3),
          totalMb: total != null ? +(total / 1048576).toFixed(3) : null,
        });
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return series;
}

async function sampleWindow(page, cdp, ms) {
  const heapPoll = pollHeap(cdp, ms);
  const rAF = await page.evaluate(async (dur) => {
    const stamps = [];
    const heaps = [];
    const pools = [];
    const t0 = performance.now();
    let last = t0;
    await new Promise((resolve) => {
      function tick(now) {
        stamps.push(now - last);
        last = now;
        const mem = performance.memory;
        const heap = mem ? mem.usedJSHeapSize : null;
        if (heap != null) heaps.push(heap);
        const g = window.__LAO__?.getGame?.();
        if (g) {
          const list = g.bullets?.list || [];
          let liveB = 0;
          let liveF = 0;
          let liveE = 0;
          for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b?.alive) continue;
            liveB += 1;
            if (b.friendly) liveF += 1;
            else liveE += 1;
          }
          pools.push({
            t: now - t0,
            enemies: (g.enemies || []).filter((e) => e.alive).length,
            bulletsList: list.length,
            bulletsLive: liveB,
            bulletsFriendly: liveF,
            bulletsEnemy: liveE,
            bulletsFree: g.bullets?.free?.length || 0,
            particles: g.particles?.length || 0,
            polish: g.fx?.active?.length || 0,
            popups: g.fx?.popups?.length || 0,
            vfx: g.projectileVfx?.particles?.length || 0,
            bombCasts: g.bombVfx?.casts?.length || 0,
            powerUps: g.powerUps?.length || 0,
            paused: !!g.paused,
            phase: g.stagePhase,
            state: g.state,
          });
        }
        if (now - t0 >= dur) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    const dts = stamps.slice(1).filter((d) => d > 0 && d < 400);
    const fps = dts.map((d) => 1000 / d);
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const peak = (key) => pools.reduce((m, p) => Math.max(m, p[key] || 0), 0);
    return {
      durationMs: Math.round(performance.now() - t0),
      frames: dts.length,
      fpsAvg: +avg(fps).toFixed(2),
      fpsMin: fps.length ? +Math.min(...fps).toFixed(2) : null,
      fpsMax: fps.length ? +Math.max(...fps).toFixed(2) : null,
      dtAvgMs: +avg(dts).toFixed(3),
      dtMaxMs: dts.length ? +Math.max(...dts).toFixed(3) : null,
      dtP95Ms: dts.length
        ? +[...dts].sort((a, b) => a - b)[Math.floor(dts.length * 0.95)].toFixed(3)
        : null,
      hitches: {
        over33ms: dts.filter((d) => d > 33.4).length,
        over50ms: dts.filter((d) => d > 50).length,
        over100ms: dts.filter((d) => d > 100).length,
      },
      perfMemoryFrozen: heaps.length > 4 && heaps.every((b) => b === heaps[0]),
      perfMemoryMb: heaps.length ? +(heaps[heaps.length - 1] / 1048576).toFixed(2) : null,
      canvas: (() => {
        const c = document.getElementById('game');
        const r = c?.getBoundingClientRect();
        return {
          cssW: r ? +r.width.toFixed(1) : null,
          cssH: r ? +r.height.toFixed(1) : null,
          bufW: c?.width || null,
          bufH: c?.height || null,
          dpr: window.devicePixelRatio,
          inner: [window.innerWidth, window.innerHeight],
        };
      })(),
      peaks: pools.length
        ? {
            enemies: peak('enemies'),
            bulletsList: peak('bulletsList'),
            bulletsLive: peak('bulletsLive'),
            bulletsFriendly: peak('bulletsFriendly'),
            bulletsEnemy: peak('bulletsEnemy'),
            bulletsFree: peak('bulletsFree'),
            particles: peak('particles'),
            polish: peak('polish'),
            popups: peak('popups'),
            vfx: peak('vfx'),
            bombCasts: peak('bombCasts'),
            powerUps: peak('powerUps'),
          }
        : null,
      lastPool: pools.length ? pools[pools.length - 1] : null,
      firstPool: pools.length ? pools[0] : null,
    };
  }, ms);
  const cdpHeap = await heapPoll;
  const used = cdpHeap.map((h) => h.usedMb).filter((n) => n != null);
  return {
    ...rAF,
    heapStats: heapStats(used),
    cdpHeapFirst: cdpHeap[0] || null,
    cdpHeapLast: cdpHeap[cdpHeap.length - 1] || null,
  };
}

async function runViewport(browser, url, spec) {
  const page = await browser.newPage({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: spec.dpr,
    hasTouch: !!spec.hasTouch,
    isMobile: !!spec.hasTouch,
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'lao_mini_settings_v1',
      JSON.stringify({
        lang: 'ko',
        muted: true,
        bgmVolume: 0,
        sfxVolume: 0,
        autoFire: true,
        padMode: 'fixed',
        fullscreen: false,
      }),
    );
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await page.goto(`${url}?cb=perf-20261004-${spec.tag}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForSelector('#btn-start', { timeout: 90000 });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Performance.enable');
  } catch {
    /* */
  }
  await page.waitForTimeout(400);

  const title = await sampleWindow(page, cdp, 4000);

  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.waitForTimeout(300);
  const select = await sampleWindow(page, cdp, 4000);

  await page.click('.char-card[data-key="hirume"]');
  await page.click('#btn-go');
  await page.waitForFunction(
    () => document.getElementById('overlay')?.classList.contains('hidden'),
    null,
    { timeout: 300000 },
  );
  await page.evaluate(() => {
    const g = window.__LAO__?.getGame?.();
    if (!g) return;
    g.setRngSeed?.(0x51a9e);
    g.debug.invuln = true;
    g.debug.autoPlay = true;
    try {
      g.audio?.setMuted?.(true);
    } catch {
      /* */
    }
  });
  const combat = await sampleWindow(page, cdp, 16000);

  await page.evaluate(() => {
    window.__LAO__?.getGame?.()?.setPaused?.(true);
  });
  await page.waitForSelector('#overlay-content.screen-pause, .screen-pause', { timeout: 10000 });
  const pause = await sampleWindow(page, cdp, 4000);

  await page.close();
  return { tag: spec.tag, viewport: spec, title, select, combat, pause };
}

const { server, url } = await startServer();
const browser = await chromium.launch({
  headless: true,
  args: ['--mute-audio', '--enable-precise-memory-info'],
});

const report = {
  when: new Date().toISOString(),
  env: 'Playwright Chromium headless — rAF timestamps + CDP Runtime.getHeapUsage. Not a physical GPU.',
  disclaimer:
    'Headless vsync/SwiftShader can differ from a real PC/phone. Numbers are live in this env, not invented. Compare scenes in the same env.',
  viewports: [],
};

try {
  for (const spec of [
    { tag: 'pc-960', width: 960, height: 540, dpr: 1, hasTouch: false },
    { tag: 'mobile-412x226', width: 412, height: 226, dpr: 2.5, hasTouch: true },
  ]) {
    console.error('RUN', spec.tag);
    const row = await runViewport(browser, url, spec);
    report.viewports.push(row);
    console.log(JSON.stringify(row, null, 2));
  }
} finally {
  await browser.close();
  server.close();
}

const outPath = join(root, 'tools', 'perf-2026-10-04-raw.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.error('WROTE', outPath);
