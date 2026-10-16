/**
 * Tick02 combat-only rAF FPS (after bg pre-scale + grade overlay bake).
 * pc-960 ~16s + mobile-412 short window. Same SORTIE hooks as tick01.
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

async function sampleCombat(page, ms) {
  return page.evaluate(async (dur) => {
    const stamps = [];
    const pools = [];
    const t0 = performance.now();
    let last = t0;
    await new Promise((resolve) => {
      function tick(now) {
        stamps.push(now - last);
        last = now;
        const g = window.__LAO__?.getGame?.();
        if (g) {
          const list = g.bullets?.list || [];
          let liveB = 0;
          for (let i = 0; i < list.length; i++) if (list[i]?.alive) liveB += 1;
          pools.push({
            t: now - t0,
            enemies: (g.enemies || []).filter((e) => e.alive).length,
            bulletsLive: liveB,
            particles: g.particles?.length || 0,
            polish: g.fx?.active?.length || 0,
            vfx: g.projectileVfx?.particles?.length || 0,
            phase: g.stagePhase,
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
    const split = window.__LAO_SPLIT__;
    const n = split?.n || 0;
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
      splitMs: n
        ? {
          n,
          updateAvg: +(split.update / n).toFixed(3),
          drawAvg: +(split.draw / n).toFixed(3),
          bgAvg: +(split.bg / n).toFixed(3),
          vfxAvg: +(split.vfx / n).toFixed(3),
        }
        : null,
      canvas: (() => {
        const c = document.getElementById('game');
        const r = c?.getBoundingClientRect();
        return {
          cssW: r ? +r.width.toFixed(1) : null,
          cssH: r ? +r.height.toFixed(1) : null,
          bufW: c?.width || null,
          bufH: c?.height || null,
          dpr: window.devicePixelRatio,
        };
      })(),
      peaks: {
        enemies: peak('enemies'),
        bulletsLive: peak('bulletsLive'),
        particles: peak('particles'),
        polish: peak('polish'),
        vfx: peak('vfx'),
      },
    };
  }, ms);
}

async function runCombat(browser, url, spec, combatMs) {
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
  await page.goto(`${url}?cb=frame-opt-tick02-${spec.tag}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForSelector('#btn-start', { timeout: 90000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
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
    const acc = { update: 0, draw: 0, bg: 0, vfx: 0, n: 0 };
    const u = g.update.bind(g);
    const d = g.draw.bind(g);
    const vfx = g.projectileVfx;
    const vfxRender = vfx?.render?.bind(vfx);
    g.update = (dt) => {
      const t = performance.now();
      u(dt);
      acc.update += performance.now() - t;
    };
    g.draw = () => {
      const t = performance.now();
      d();
      acc.draw += performance.now() - t;
      acc.n += 1;
    };
    if (vfx && vfxRender) {
      vfx.render = (...args) => {
        const t = performance.now();
        const r = vfxRender(...args);
        acc.vfx += performance.now() - t;
        return r;
      };
    }
    window.__LAO_SPLIT__ = acc;
  });
  const combat = await sampleCombat(page, combatMs);
  await page.close();
  return { tag: spec.tag, viewport: spec, combatMs, combat };
}

const { server, url } = await startServer();
const browser = await chromium.launch({
  headless: true,
  args: ['--mute-audio', '--enable-precise-memory-info'],
});

const report = {
  when: new Date().toISOString(),
  env: 'Playwright Chromium headless — combat rAF only (tick02). Not a physical GPU.',
  baseline: {
    pc960_combat_avg: [30.83, 43.09, 30.23],
    mobile412_combat_avg: [39.84, 56.54, 50.64],
  },
  viewports: [],
};

try {
  const specs = [
    { spec: { tag: 'pc-960', width: 960, height: 540, dpr: 1, hasTouch: false }, ms: 16000 },
    { spec: { tag: 'mobile-412x226', width: 412, height: 226, dpr: 2.5, hasTouch: true }, ms: 8000 },
  ];
  for (const { spec, ms } of specs) {
    console.error('RUN', spec.tag, ms);
    const row = await runCombat(browser, url, spec, ms);
    report.viewports.push(row);
    console.log(JSON.stringify({
      tag: row.tag,
      fpsAvg: row.combat.fpsAvg,
      fpsMin: row.combat.fpsMin,
      dtP95Ms: row.combat.dtP95Ms,
      dtMaxMs: row.combat.dtMaxMs,
      hitches: row.combat.hitches,
      frames: row.combat.frames,
      peaks: row.combat.peaks,
      splitMs: row.combat.splitMs,
      canvas: row.combat.canvas,
    }, null, 2));
  }
} finally {
  await browser.close();
  server.close();
}

const outPath = join(root, 'tools', 'frame-opt-tick02-raw.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.error('WROTE', outPath);
