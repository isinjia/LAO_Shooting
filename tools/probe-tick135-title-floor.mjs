/**
 * Tick135 verify: title CONTROLS keys-grid soft floor after ship.
 * Expect muddyCount=0 on ko/en/pt/es/ru × 640×360 / 720×400 / 800×450.
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
          localStorage.setItem('lao_mini_tutorial_seen', '1');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=v135-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(120);
        const m = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const keys = oc.querySelector('.keys');
          const grid = keys?.querySelector('.keys-grid');
          const rules = keys?.querySelector('.keys-rules');
          const hi = keys?.querySelector('.keys-hiscore');
          const start = document.getElementById('btn-start');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hiR = hi?.getBoundingClientRect();
          const hiVis = hiR
            ? Math.max(0, Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top))
            : 0;
          const sR = start?.getBoundingClientRect();
          const rulesCs = rules ? getComputedStyle(rules) : null;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: grid ? +grid.getBoundingClientRect().height.toFixed(1) : 0,
            gridMin: grid?.style.minHeight || '',
            keysH: keys ? +keys.getBoundingClientRect().height.toFixed(1) : 0,
            rulesH: rules ? +rules.getBoundingClientRect().height.toFixed(1) : 0,
            rulesDisplay: rulesCs?.display || 'none',
            rulesText: (rules?.textContent || '').trim().slice(0, 40),
            hiInside: !!hiR && hiVis >= hiR.height - 1.5 && hiR.bottom <= ocR.bottom + 1.5,
            startOut: !sR || sR.bottom > appR.bottom + 1.5 || sR.top < appR.top - 1.5,
          };
        });
        rows.push({ loc, w: size.width, h: size.height, ...m });
      } catch (err) {
        rows.push({
          loc,
          w: size.width,
          h: size.height,
          error: String(err?.message || err),
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

const muddy = rows.filter(
  (r) =>
    r.error ||
    r.startOut ||
    !r.hiInside ||
    r.panelOver > 1.5 ||
    r.panelOverTop > 1.5 ||
    r.gridH < 36 ||
    !r.rulesText ||
    r.rulesDisplay === 'none' ||
    (r.h <= 400 && r.rulesH < 14),
);
const out = { muddyCount: muddy.length, muddy, all: rows };
const outPath = join(root, 'tools', '_tick135-title-floor.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      sample: rows.filter((r) => r.loc === 'es' || r.h === 360),
      wrote: outPath,
    },
    null,
    2,
  ),
);
process.exit(muddy.length === 0 ? 0 : 1);
