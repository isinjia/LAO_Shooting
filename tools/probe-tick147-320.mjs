import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      res.writeHead(404); res.end('missing'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}
const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 200 }, hasTouch: true, isMobile: true });
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'en', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: true, padMode: 'fixed', fullscreen: false }));
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-start', { timeout: 60000 });
const m = await page.evaluate(() => {
  document.body.classList.add('touch-ui', 'has-touch-pads');
  const tc = document.getElementById('touch-controls');
  tc.classList.add('is-on', 'tc-mode-fixed');
  document.getElementById('overlay').style.display = 'none';
  void tc.offsetHeight;
  const info = (sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { sel, left: +r.left.toFixed(1), right: +r.right.toFixed(1), w: +r.width.toFixed(1), minW: cs.minWidth, maxW: cs.maxWidth, flex: cs.flex };
  };
  return {
    bottom: info('.hud-bottom'),
    stocks: info('.hud-stocks'),
    gauges: info('.hud-gauges'),
    charge: info('#charge-track'),
    sp: info('#sp-track'),
    bomb: info('.tc-bomb'),
    fire: info('.tc-fire'),
    hudRight: getComputedStyle(document.querySelector('.hud-bottom')).right,
    hudLeft: getComputedStyle(document.querySelector('.hud-bottom')).left,
  };
});
console.log(JSON.stringify(m, null, 2));
await browser.close();
server.close();
