/** Post-fix title CONTROLS snapshot @800/960/1280 × locales. */
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
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
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
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 800, height: 450 },
  { width: 960, height: 540 },
  { width: 1280, height: 720 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const rows = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
      try {
        await page.addInitScript(({ loc }) => {
          localStorage.setItem(
            'lao_mini_settings_v1',
            JSON.stringify({
              lang: loc,
              muted: true,
              bgmVolume: 0,
              sfxVolume: 0,
              autoFire: true,
              padMode: 'fixed',
              fullscreen: false,
            }),
          );
          localStorage.setItem('lao_mini_tutorial_seen', '1');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=af130-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(120);
        const snap = await page.evaluate(() => {
          const disp = (el) => (el ? getComputedStyle(el).display : null);
          const oc = document.getElementById('overlay-content');
          const keys = oc.querySelector('.keys');
          const hi = oc.querySelector('.keys-hiscore');
          const grid = oc.querySelector('.keys-grid');
          const start = document.getElementById('btn-start');
          const ocR = oc.getBoundingClientRect();
          const hiR = hi.getBoundingClientRect();
          const gridR = grid.getBoundingClientRect();
          const keysR = keys.getBoundingClientRect();
          const appR = document.getElementById('app').getBoundingClientRect();
          const hiVis = Math.max(
            0,
            Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
          );
          const gridVis = Math.max(
            0,
            Math.min(gridR.bottom, ocR.bottom) - Math.max(gridR.top, ocR.top),
          );
          return {
            hiVis: +hiVis.toFixed(1),
            hiH: Math.round(hiR.height),
            gridVis: +gridVis.toFixed(1),
            gridH: Math.round(gridR.height),
            gridRows: grid.children.length,
            keysH: Math.round(keysR.height),
            keysMin: keys.style.minHeight,
            startOut: start.getBoundingClientRect().bottom > appR.bottom + 1.5,
            strip: disp(oc.querySelector('.lobby-resource-strip')),
            foot: disp(oc.querySelector('.lobby-foot')),
            status: disp(oc.querySelector('.lobby-status-bar')),
            tagline: disp(oc.querySelector('.tagline')),
            brand: disp(oc.querySelector('.brand-mark')),
            titleSub: disp(oc.querySelector('.title-sub')),
            h1fs: oc.querySelector('h1')?.style.fontSize || '',
            heroH: Math.round(oc.querySelector('.title-hero')?.getBoundingClientRect().height || 0),
          };
        });
        rows.push({ loc, w: size.width, h: size.height, ...snap });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const muddy = rows.filter(
  (r) => r.hiVis < r.hiH - 1.5 || r.startOut || r.gridVis < 12,
);
console.log(JSON.stringify({ muddyCount: muddy.length, muddy, all: rows }, null, 2));
