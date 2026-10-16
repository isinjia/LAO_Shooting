/**
 * Tick137: select dossier kit wrap / clip under flattened Box2 @ short heights.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
];
const PREFER = ['eternity', 'labiata', 'emily', 'merlin', 'constantia'];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const rows = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      for (const prefer of PREFER) {
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
          await page.goto(`${url}?cb=r137sk-${Date.now()}-${loc}-${prefer}-${size.width}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 90000 });
          await page.waitForTimeout(160);
          const cardSel = `.char-card[data-key="${prefer}"]`;
          const card = await page.$(cardSel);
          if (card) await card.click();
          else {
            const fallback = await page.$('.char-card:not([data-key="random"])');
            if (fallback) await fallback.click();
          }
          await page.waitForTimeout(80);
          const m = await page.evaluate(() => {
            const app = document.getElementById('app');
            const oc = document.getElementById('overlay-content');
            const go = document.getElementById('btn-go');
            const grid = document.querySelector('.char-grid');
            const kit = document.getElementById('select-dossier-kit');
            const name = document.querySelector('.select-dossier-name');
            const hint = document.querySelector('.select-dossier-hint');
            const dossier = document.querySelector('.select-dossier');
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            const gR = grid?.getBoundingClientRect();
            const kR = kit?.getBoundingClientRect();
            const kitCs = kit ? getComputedStyle(kit) : null;
            const dCs = dossier ? getComputedStyle(dossier) : null;
            return {
              panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
              gridH: gR ? +gR.height.toFixed(1) : 0,
              goOut: go
                ? go.getBoundingClientRect().bottom > appR.bottom + 1.5 ||
                  go.getBoundingClientRect().top < appR.top - 1.5
                : true,
              kitH: kR ? +kR.height.toFixed(1) : 0,
              kitClip: kit ? kit.scrollHeight > kit.clientHeight + 2 : false,
              kitWrapX: kit ? kit.scrollWidth > kit.clientWidth + 2 : false,
              kitLines: kit && kitCs
                ? Math.round((kR.height || 0) / (parseFloat(kitCs.lineHeight) || 14))
                : 0,
              kitText: (kit?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
              nameClip: name ? name.scrollWidth > name.clientWidth + 2 : false,
              nameText: (name?.textContent || '').trim().slice(0, 40),
              hintDisplay: hint ? getComputedStyle(hint).display : 'none',
              dossierFlat: dCs
                ? dCs.backgroundImage === 'none' || dCs.backgroundImage === ''
                : false,
              dossierPad: dCs?.padding || '',
              selected: document.querySelector('.char-card.selected')?.dataset?.key || '',
            };
          });
          rows.push({ loc, prefer, w: size.width, h: size.height, ...m });
        } catch (err) {
          rows.push({
            loc,
            prefer,
            w: size.width,
            h: size.height,
            error: String(err.message || err),
          });
        } finally {
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const muddy = rows.filter(
  (r) =>
    !r.error &&
    (r.panelOver > 1.5 ||
      r.goOut ||
      (r.gridH > 0 && r.gridH < 36) ||
      r.kitClip ||
      r.kitWrapX ||
      r.nameClip),
);
const soft = rows.filter(
  (r) =>
    !r.error &&
    !muddy.includes(r) &&
    ((r.h <= 400 && r.kitH > 0 && r.kitH < 28) ||
      (r.h <= 400 && r.hintDisplay === 'none') ||
      (r.h <= 400 && r.dossierFlat && r.kitLines >= 3)),
);
const outPath = join(root, 'tools', 'probe-tick137-select-kit-out.json');
writeFileSync(outPath, JSON.stringify({ muddyCount: muddy.length, softCount: soft.length, muddy, soft, rows }, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      softCount: soft.length,
      muddy: muddy.slice(0, 30),
      soft: soft.slice(0, 30),
      sample360: rows.filter((r) => r.h === 360 && r.prefer === 'eternity'),
      errors: rows.filter((r) => r.error).slice(0, 10),
    },
    null,
    2,
  ),
);
process.exit(0);
