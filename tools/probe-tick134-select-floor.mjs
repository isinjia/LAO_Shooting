/**
 * Tick134 verify: select extreme-short char-grid floor after dossier reclaim.
 * Expect: gridH≥56 @640×360 / @720×400, CTA clear, kit/sortie strings kept.
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
        await page.goto(`${url}?cb=v134-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 90000 });
        await page.waitForTimeout(200);
        const m = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const go = document.getElementById('btn-go');
          const grid = document.querySelector('.char-grid');
          const deco = document.querySelector('.sortie-deco');
          const blurb = document.querySelector('.select-blurb');
          const kit = document.getElementById('select-dossier-kit');
          const hint = document.querySelector('.select-dossier-hint');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const gR = grid?.getBoundingClientRect();
          const goR = go?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            minH: grid?.style.minHeight || '',
            goOut: goR
              ? goR.bottom > appR.bottom + 1.5 || goR.top < appR.top - 1.5
              : true,
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            blurbDisplay: blurb ? getComputedStyle(blurb).display : 'none',
            hintDisplay: hint ? getComputedStyle(hint).display : 'none',
            kitText: kit?.textContent || '',
            goText: go?.textContent || '',
            dossierPad: document.querySelector('.select-dossier')
              ? getComputedStyle(document.querySelector('.select-dossier')).padding
              : '',
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
    r.goOut ||
    r.panelOver > 1.5 ||
    r.panelOverTop > 1.5 ||
    r.gridH < 56 ||
    !r.kitText ||
    !r.goText,
);
const out = { muddyCount: muddy.length, muddy, all: rows };
writeFileSync(join(root, 'tools', '_tick134-select-floor.json'), JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      sample360: rows.filter((r) => r.h === 360),
      sample400: rows.filter((r) => r.h === 400),
      sample450: rows.filter((r) => r.h === 450),
    },
    null,
    2,
  ),
);
process.exit(muddy.length === 0 ? 0 : 1);
