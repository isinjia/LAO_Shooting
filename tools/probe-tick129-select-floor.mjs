/**
 * Tick129 live verify: select@800×450 char-grid floor after deco+blurb reclaim.
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

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
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
let muddy = 0;

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
        await page.goto(`${url}?cb=v129-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.waitForTimeout(180);
        const m = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const go = document.getElementById('btn-go');
          const grid = document.querySelector('.char-grid');
          const deco = document.querySelector('.sortie-deco');
          const blurb = document.querySelector('.select-blurb');
          const brand = document.querySelector('.sortie-head .brand-mark');
          const h2 = document.querySelector('.sortie-head h2');
          const appR = app?.getBoundingClientRect();
          const ocR = oc?.getBoundingClientRect();
          const card = document.querySelector('.char-card');
          return {
            goOut: !!(go && appR && boxOut(go, appR)),
            goOcOut: !!(go && ocR && boxOut(go, ocR)),
            gridH: grid ? Math.round(grid.getBoundingClientRect().height) : 0,
            cardH: card ? Math.round(card.getBoundingClientRect().height) : 0,
            canScroll: !!(grid && grid.scrollHeight > grid.clientHeight + 2),
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            blurbDisplay: blurb ? getComputedStyle(blurb).display : null,
            brandOk: !!(brand && brand.getBoundingClientRect().height > 8),
            h2Ok: !!(h2 && h2.getBoundingClientRect().height > 8),
            appH: Math.round(appR?.height || 0),
            panelMaxH: oc ? getComputedStyle(oc).maxHeight : null,
          };
        }, boxOut.toString());
        const short = size.height <= 480;
        const floorOk = !short || m.gridH >= 72;
        const chromeOk = !short || (m.decoDisplay === 'none' && m.blurbDisplay === 'none');
        const tallOk =
          size.height >= 720
            ? m.decoDisplay === 'block' && m.blurbDisplay === 'block'
            : true;
        const ctaOk = !m.goOut && !m.goOcOut;
        const ok = floorOk && chromeOk && tallOk && ctaOk && m.brandOk && m.h2Ok && m.canScroll;
        if (!ok) muddy += 1;
        rows.push({ size: `${size.width}x${size.height}`, loc, ok, ...m, floorOk, chromeOk, tallOk });
      } catch (err) {
        muddy += 1;
        rows.push({
          size: `${size.width}x${size.height}`,
          loc,
          ok: false,
          error: String(err.message || err).slice(0, 200),
        });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({ muddy, okCount: rows.length - muddy, rows }, null, 2));
if (muddy > 0) process.exitCode = 1;
