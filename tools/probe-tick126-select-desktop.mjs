/**
 * Tick126 desktop non-touch probe: select SORTIE CTA must stay inside #app
 * across long locales × short landscapes after panel budget ship.
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

const LOCALES = ['en', 'es', 'ru', 'pt', 'ko'];
const SIZES = [
  { width: 1280, height: 720 },
  { width: 960, height: 540 },
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const rows = [];
let muddyCount = 0;
let okCount = 0;
let errors = 0;

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

        await page.goto(`${url}?cb=${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 90000,
        });
        await page.waitForSelector('#btn-start', { timeout: 45000 });
        await page.click('#btn-start');
        await page.waitForSelector('#select-dossier-kit', { timeout: 120000 });
        await page.evaluate(() => {
          const btn = document.querySelector('.char-card[data-key="constantia"]')
            || document.querySelector('.char-card');
          btn?.click();
        });
        // Allow double-rAF budget sync + preview layout settle.
        await page.waitForTimeout(200);

        const snap = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const actions = document.querySelector('.select-actions');
          const grid = document.querySelector('.char-grid');
          const kit = document.getElementById('select-dossier-kit');
          if (!app || !oc || !actions) return { error: 'missing' };
          const appR = app.getBoundingClientRect();
          const actR = actions.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const actionsOut =
            actR.bottom > appR.bottom + 1.5 || actR.top < appR.top - 1.5;
          const actionsOcOut =
            actR.bottom > ocR.bottom + 1.5 || actR.top < ocR.top - 1.5;
          return {
            touchUi: document.body.classList.contains('touch-ui'),
            actionsOut,
            actionsOcOut,
            panel: {
              sh: oc.scrollHeight,
              ch: oc.clientHeight,
              overflowY: getComputedStyle(oc).overflowY,
              maxH: getComputedStyle(oc).maxHeight,
              display: getComputedStyle(oc).display,
            },
            grid: grid
              ? {
                  overflowY: getComputedStyle(grid).overflowY,
                  minH: getComputedStyle(grid).minHeight,
                  sh: grid.scrollHeight,
                  ch: grid.clientHeight,
                }
              : null,
            kit: kit
              ? {
                  text: (kit.textContent || '').trim().slice(0, 90),
                  sh: kit.scrollHeight,
                  ch: kit.clientHeight,
                }
              : null,
            actBottom: Math.round(actR.bottom),
            appBottom: Math.round(appR.bottom),
            ocBottom: Math.round(ocR.bottom),
          };
        });

        const muddy = !!(snap.actionsOut || snap.actionsOcOut || snap.error);
        if (muddy) muddyCount += 1;
        else okCount += 1;
        rows.push({ loc, w: size.width, h: size.height, muddy, ...snap });
      } catch (err) {
        errors += 1;
        muddyCount += 1;
        rows.push({
          loc,
          w: size.width,
          h: size.height,
          muddy: true,
          error: String(err.message || err).slice(0, 160),
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

console.log(JSON.stringify({ muddyCount, okCount, errors, rows }, null, 2));
process.exit(muddyCount === 0 && errors === 0 ? 0 : 1);
