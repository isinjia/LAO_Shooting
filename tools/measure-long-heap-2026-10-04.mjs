/** Extra: 40s SORTIE combat heap/FPS on 960 only — is the 16s climb a warmup or leak? */
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
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
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
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({
  headless: true,
  args: ['--mute-audio', '--enable-precise-memory-info'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  localStorage.setItem(
    'lao_mini_settings_v1',
    JSON.stringify({ lang: 'ko', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: true, padMode: 'fixed', fullscreen: false }),
  );
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#btn-start', { timeout: 90000 });
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 180000 });
await page.click('.char-card[data-key="hirume"]');
await page.click('#btn-go');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.evaluate(() => {
  const g = window.__LAO__.getGame();
  g.setRngSeed?.(0x51a9e);
  g.debug.invuln = true;
  g.debug.autoPlay = true;
  g.audio?.setMuted?.(true);
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');

const series = [];
const t0 = Date.now();
while (Date.now() - t0 < 40000) {
  const usage = await cdp.send('Runtime.getHeapUsage');
  const snap = await page.evaluate(() => {
    const g = window.__LAO__.getGame();
    const list = g.bullets.list;
    let live = 0;
    for (const b of list) if (b.alive) live += 1;
    return {
      enemies: g.enemies.filter((e) => e.alive).length,
      bullets: live,
      vfx: g.projectileVfx.particles.length,
      polish: g.fx.active.length,
      particles: g.particles.length,
      phase: g.stagePhase,
    };
  });
  series.push({
    t: Date.now() - t0,
    usedMb: +(usage.usedSize / 1048576).toFixed(3),
    totalMb: +(usage.totalSize / 1048576).toFixed(3),
    ...snap,
  });
  await new Promise((r) => setTimeout(r, 1000));
}

writeFileSync(join(root, 'tools', 'perf-2026-10-04-long-heap.json'), JSON.stringify(series, null, 2));
console.log(JSON.stringify(series, null, 2));
await browser.close();
server.close();
