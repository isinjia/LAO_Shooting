/**
 * Tick128 focused: pause panel vs #app at short landscape × long unmute locales.
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
        await page.goto(`${url}?cb=p128-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const snap = await page.evaluate(async ({ loc }) => {
          let tPause = 'Operation on hold';
          let tResume = 'Resume';
          let tOpts = 'OPTIONS';
          let tMute = 'Unmute';
          let tTitle = 'To title';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tPause = mod.t('pause.p');
              tResume = mod.t('btn.resume');
              tOpts = mod.t('btn.options');
              tMute = mod.t('btn.unmute');
              tTitle = mod.t('btn.toTitle');
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-pause';
          content.style.maxHeight = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <div class="pause-stamp">
              <span class="brand-mark">SYSTEM HOLD</span>
              <h2>PAUSED</h2>
              <span class="pause-deco" aria-hidden="true"></span>
              <p class="pause-blurb">${tPause}</p>
            </div>
            <div class="pause-actions">
              <button class="btn btn-primary btn-cta" id="btn-resume">${tResume}</button>
              <button class="btn" id="btn-pause-options">${tOpts}</button>
              <button class="btn" id="btn-pause-mute">${tMute}</button>
              <button class="btn btn-ghost" id="btn-quit">${tTitle}</button>
            </div>
          `;
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const actions = document.querySelector('.pause-actions');
          const actR = actions.getBoundingClientRect();
          const quit = document.getElementById('btn-quit');
          const quitR = quit.getBoundingClientRect();
          const mute = document.getElementById('btn-pause-mute');
          const deco = document.querySelector('.pause-deco');
          const decoCs = deco ? getComputedStyle(deco) : null;
          return {
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
            panelTop: Math.round(ocR.top),
            panelBottom: Math.round(ocR.bottom),
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            actionsOver: +(actR.bottom - appR.bottom).toFixed(2),
            quitOver: +(quitR.bottom - appR.bottom).toFixed(2),
            quitText: (quit.textContent || '').trim(),
            muteText: (mute.textContent || '').trim(),
            muteH: Math.round(mute.getBoundingClientRect().height),
            muteLines: mute.scrollHeight > mute.clientHeight + 1 ? 'oh' : 'ok',
            muteSh: mute.scrollHeight,
            muteCh: mute.clientHeight,
            decoDisplay: decoCs?.display,
            overflowY: getComputedStyle(content).overflowY,
            maxH: getComputedStyle(content).maxHeight,
          };
        }, { loc });
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

const muddy = rows.filter((r) => r.panelOver > 1.5 || r.actionsOver > 1.5 || r.quitOver > 1.5);
console.log(JSON.stringify({ muddyCount: muddy.length, muddy, all: rows }, null, 2));
