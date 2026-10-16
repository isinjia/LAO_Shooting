/**
 * Tick137 verify: tutorial extreme-short grid floor after brand/h2 reclaim.
 * Expect: gridH≥40 @640×360 / @720×400, CTA clear, h2 kept, brand none ≤400.
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
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
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
          localStorage.removeItem('lao_mini_tutorial_seen');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=v137t-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 90000 });
        await page.click('.char-card:not([data-key="random"])');
        await page.waitForTimeout(40);
        await page.click('#btn-go');
        await page.waitForSelector('.screen-tutorial', { timeout: 90000 });
        await page.waitForTimeout(180);
        const m = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.tutorial-grid');
          const cta = document.getElementById('btn-tut-go');
          const brand = oc.querySelector('.opt-head .brand-mark');
          const h2 = oc.querySelector('.opt-head h2');
          const note = oc.querySelector('.tutorial-note');
          const gR = grid?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            gridMin: grid?.style.minHeight || '',
            ctaOut: cta ? boxOut(cta, appR) : true,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2Display: h2 ? getComputedStyle(h2).display : 'none',
            h2Text: (h2?.textContent || '').trim().slice(0, 40),
            noteDisplay: note ? getComputedStyle(note).display : 'none',
            isShort: oc.classList.contains('is-tut-short'),
          };
        }, { boxOutSrc: boxOut.toString() });
        rows.push({ loc, w: size.width, h: size.height, ...m });
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
  (r) =>
    r.panelOver > 1.5 ||
    r.panelOverTop > 1.5 ||
    r.ctaOut ||
    r.gridH + 0.5 < 40 ||
    r.h2Display === 'none' ||
    !r.h2Text,
);

writeFileSync(
  join(root, 'tools', 'probe-tick137-tutorial-floor-out.json'),
  JSON.stringify({ muddyCount: muddy.length, muddy, rows }, null, 2),
);
console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      muddy,
      rows,
    },
    null,
    2,
  ),
);
process.exit(muddy.length ? 1 : 0);
