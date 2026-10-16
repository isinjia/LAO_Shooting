/**
 * Tick128 live verify: OPTIONS dual-scroll flattened @800×450.
 */
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
      const page = await browser.newPage({
        viewport: size,
        hasTouch: false,
        isMobile: false,
      });
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
        await page.goto(`${url}?cb=n128-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
        await page.waitForTimeout(100);
        const snap = await page.evaluate(() => {
          const app = document.getElementById('app');
          const back = document.getElementById('btn-opt-back');
          const scroll = document.querySelector('.opt-scroll');
          const keys = document.querySelector('.opt-keys');
          const appR = app.getBoundingClientRect();
          const br = back.getBoundingClientRect();
          const keysCs = getComputedStyle(keys);
          const nested =
            scroll.scrollHeight > scroll.clientHeight + 2 &&
            keys.scrollHeight > keys.clientHeight + 2;
          return {
            nested,
            backOut: br.bottom > appR.bottom + 1.5 || br.top < appR.top - 1.5,
            keysMaxH: keysCs.maxHeight,
            keysOverflowY: keysCs.overflowY,
            scrollCan: scroll.scrollHeight > scroll.clientHeight + 2,
            keysCan: keys.scrollHeight > keys.clientHeight + 2,
            scroll: { sh: scroll.scrollHeight, ch: scroll.clientHeight },
            keys: { sh: keys.scrollHeight, ch: keys.clientHeight },
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
  (r) => r.nested || r.backOut || r.keysMaxH !== 'none' || r.keysCan,
);
console.log(JSON.stringify({ muddyCount: muddy.length, muddy, rows }, null, 2));
