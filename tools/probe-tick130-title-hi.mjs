/**
 * Tick130 focused: title CONTROLS HI-SCORE pin vs keys / overlay-content / #app
 * at short landscape × locales.
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
        await page.goto(`${url}?cb=hi130-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(120);
        const snap = await page.evaluate(() => {
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const keys = document.querySelector('.keys');
          const head = document.querySelector('.keys-head');
          const grid = document.querySelector('.keys-grid');
          const rules = document.querySelector('.keys-rules');
          const hi = document.querySelector('.keys-hiscore');
          const start = document.getElementById('btn-start');
          const foot = document.querySelector('.lobby-foot');
          const strip = document.querySelector('.lobby-resource-strip');
          const hero = document.querySelector('.title-hero');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const keysR = keys.getBoundingClientRect();
          const hiR = hi.getBoundingClientRect();
          const gridR = grid.getBoundingClientRect();
          const rulesR = rules?.getBoundingClientRect();
          const headR = head.getBoundingClientRect();
          const startR = start.getBoundingClientRect();
          const hiCs = getComputedStyle(hi);
          const keysCs = getComputedStyle(keys);
          // Visible HI height inside keys clip (overflow:hidden)
          const hiVisibleInKeys = Math.max(
            0,
            Math.min(hiR.bottom, keysR.bottom) - Math.max(hiR.top, keysR.top),
          );
          const hiVisibleInOc = Math.max(
            0,
            Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
          );
          return {
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
            keysH: Math.round(keysR.height),
            keysMinH: keys.style.minHeight || '',
            keysMaxHInline: keys.style.maxHeight || '',
            keysMaxHCss: keysCs.maxHeight,
            keysOverflow: keysCs.overflow,
            ocOverflow: getComputedStyle(content).overflow,
            headH: Math.round(headR.height),
            gridH: Math.round(gridR.height),
            gridCh: grid.clientHeight,
            gridSh: grid.scrollHeight,
            gridMinH: grid.style.minHeight || '',
            rulesH: rulesR ? Math.round(rulesR.height) : 0,
            rulesMaxH: rules ? rules.style.maxHeight || getComputedStyle(rules).maxHeight : null,
            hiH: Math.round(hiR.height),
            hiTop: +hiR.top.toFixed(2),
            hiBottom: +hiR.bottom.toFixed(2),
            keysBottom: +keysR.bottom.toFixed(2),
            ocBottom: +ocR.bottom.toFixed(2),
            appBottom: +appR.bottom.toFixed(2),
            hiOverKeys: +(hiR.bottom - keysR.bottom).toFixed(2),
            hiOverOc: +(hiR.bottom - ocR.bottom).toFixed(2),
            hiOverApp: +(hiR.bottom - appR.bottom).toFixed(2),
            hiVisibleInKeys: +hiVisibleInKeys.toFixed(2),
            hiVisibleInOc: +hiVisibleInOc.toFixed(2),
            hiOpacity: hiCs.opacity,
            hiDisplay: hiCs.display,
            startBottom: +startR.bottom.toFixed(2),
            startOverApp: +(startR.bottom - appR.bottom).toFixed(2),
            footDisplay: foot ? getComputedStyle(foot).display : null,
            stripDisplay: strip ? getComputedStyle(strip).display : null,
            heroH: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
            pinnedSum: Math.round(
              headR.height +
                (rulesR?.height || 0) +
                hiR.height +
                gridR.height,
            ),
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
  (r) =>
    r.hiVisibleInKeys < r.hiH - 1.5 ||
    r.hiVisibleInOc < r.hiH - 1.5 ||
    r.hiOverKeys > 1.5 ||
    r.hiOverOc > 1.5 ||
    r.hiOverApp > 1.5 ||
    r.startOverApp > 1.5,
);

console.log(JSON.stringify({ muddyCount: muddy.length, muddy, all: rows }, null, 2));
