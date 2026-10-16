/**
 * Tick133 baseline: result panel vs #app BEFORE syncResultPanelBudget.
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

const SIZES = [
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
];
const LOCALES = ['ko', 'ru', 'es'];

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
        await page.goto(`${url}?cb=r133b-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const snap = await page.evaluate(async (loc) => {
          let tRetry = 'Retry run';
          let tTitle = 'Title';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tRetry = mod.t('btn.retryRun');
              tTitle = mod.t('btn.title');
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-result gameover';
          content.style.maxHeight = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">SYSTEM DOWN</span>
            <h2>GAME OVER</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="lbl">SCORE</span><span class="val">00123456</span></div>
              <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">00999999</span></div>
              <div class="cell"><span class="lbl">GRAZE</span><span class="val">1234</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 5 · VERY LONG STAGE NAME HERE</span></div>
              <div class="cell"><span class="lbl">PILOT</span><span class="val">CONSTANTIA S2</span></div>
              <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">99</span></div>
              <div class="cell"><span class="lbl">NO MISS</span><span class="val">—</span></div>
            </div>
            <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
            <button class="btn" id="btn-title">${tTitle}</button>
          `;
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const retry = document.getElementById('btn-retry');
          const deco = document.querySelector('.result-deco');
          const cell = content.querySelector('.result-score .cell');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: Math.round(ocR.height),
            appH: Math.round(appR.height),
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            retryOver: retry ? +(retry.getBoundingClientRect().bottom - appR.bottom).toFixed(2) : 0,
            ocPad: `${getComputedStyle(content).paddingTop}/${getComputedStyle(content).paddingBottom}`,
            cellPad: cell ? getComputedStyle(cell).padding : null,
            scoreMB: getComputedStyle(content.querySelector('.result-score')).marginBottom,
            metaMB: getComputedStyle(content.querySelector('.result-meta')).marginBottom,
            h2MB: getComputedStyle(content.querySelector('h2')).marginBottom,
          };
        }, loc);
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

console.log(JSON.stringify(rows, null, 2));
const muddy = rows.filter((r) => r.panelOver > 1.5 || r.panelOverTop > 1.5);
console.log('muddyCount=', muddy.length);
