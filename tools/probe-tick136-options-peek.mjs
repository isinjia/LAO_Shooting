/**
 * Tick136: what fits in OPTIONS .opt-scroll first viewport @ extreme short.
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

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.addInitScript(() => {
  localStorage.setItem(
    'lao_mini_settings_v1',
    JSON.stringify({
      lang: 'es',
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
});
await page.goto(`${url}?cb=r136peek`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-options');
await page.click('#btn-options');
await page.waitForTimeout(200);
const peek = await page.evaluate(() => {
  const oc = document.getElementById('overlay-content');
  const scroll = oc.querySelector('.opt-scroll');
  const sR = scroll.getBoundingClientRect();
  const kids = [...scroll.querySelectorAll('.opt-block-title, .opt-pad-row, .opt-slider, .opt-check, .opt-keys-head, .opt-key-row, .opt-mobile-note')];
  const visible = kids
    .map((el) => {
      const r = el.getBoundingClientRect();
      const fully = r.top >= sR.top - 1 && r.bottom <= sR.bottom + 1;
      const partial = r.bottom > sR.top + 2 && r.top < sR.bottom - 2;
      return {
        text: (el.textContent || '').trim().slice(0, 42),
        h: +r.height.toFixed(1),
        fully,
        partial,
        top: +(r.top - sR.top).toFixed(1),
      };
    })
    .filter((x) => x.partial);
  return {
    scrollH: +sR.height.toFixed(1),
    visibleCount: visible.length,
    visible,
  };
});
console.log(JSON.stringify(peek, null, 2));
await browser.close();
server.close();
