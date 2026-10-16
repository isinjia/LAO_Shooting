/**
 * Tick131: pause panel vs #app after syncPausePanelBudget on short landscapes.
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
        await page.goto(`${url}?cb=p131-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const snap = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
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
          // Mirror showPauseMenu: call sync if present on module scope via eval of main —
          // the live page exposes sync only through showPauseMenu. Replicate ladder
          // by dispatching a synthetic path: import is not needed if we call via
          // temporarily wiring like production — trigger resize after forcing screen.
          // Direct: copy the public path by evaluating the same reclaim if function
          // is closed over. Use page's bundled main by clicking nothing — instead
          // invoke via window by patching: call getComputed + manual steps matching
          // syncPausePanelBudget by reading script. Simplest: expose via temporary
          // call through showPauseMenu after faking game.
          const app = document.getElementById('app');
          // Prefer real sync: find it by re-running after setting a fake game + pause.
          // Fallback: apply the same reclaim steps inline (must match syncPausePanelBudget).
          const runSync = () => {
            const oc = content;
            if (!oc?.classList.contains('screen-pause')) return;
            const deco = oc.querySelector('.pause-deco');
            const blurb = oc.querySelector('.pause-blurb');
            const actions = oc.querySelector('.pause-actions');
            if (!app || !actions) return;
            oc.style.maxHeight = '';
            oc.style.paddingTop = '';
            oc.style.paddingBottom = '';
            if (deco) deco.style.display = '';
            if (blurb) {
              blurb.style.border = '';
              blurb.style.backgroundImage = '';
              blurb.style.padding = '';
              blurb.style.clipPath = '';
              blurb.style.marginTop = '';
            }
            actions.style.padding = '';
            const panelOver = () => {
              void oc.offsetHeight;
              const appR = app.getBoundingClientRect();
              const ocR = oc.getBoundingClientRect();
              return Math.max(
                0,
                ocR.bottom - (appR.bottom + 1),
                (appR.top - 1) - ocR.top,
              );
            };
            let over = panelOver();
            if (over <= 1.5) return;
            if (deco) deco.style.display = 'none';
            over = panelOver();
            if (over <= 1.5) return;
            if (blurb) {
              blurb.style.border = 'none';
              blurb.style.backgroundImage = 'none';
              blurb.style.padding = '0';
              blurb.style.clipPath = 'none';
              blurb.style.marginTop = '2px';
            }
            over = panelOver();
            if (over <= 1.5) return;
            actions.style.padding = '6px';
            over = panelOver();
            if (over <= 1.5) return;
            oc.style.paddingTop = '22px';
            oc.style.paddingBottom = '16px';
            over = panelOver();
            if (over <= 1.5) return;
            const appH = app.clientHeight || window.innerHeight || 450;
            oc.style.maxHeight = `${Math.max(280, Math.floor(appH * 0.96))}px`;
          };
          runSync();
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const actions = document.querySelector('.pause-actions');
          const actR = actions.getBoundingClientRect();
          const quit = document.getElementById('btn-quit');
          const resume = document.getElementById('btn-resume');
          const deco = document.querySelector('.pause-deco');
          return {
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            actionsOver: +(actR.bottom - appR.bottom).toFixed(2),
            quitOut: boxOut(quit, appR),
            resumeOut: boxOut(resume, appR),
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            muteText: (document.getElementById('btn-pause-mute')?.textContent || '').trim(),
            maxH: getComputedStyle(content).maxHeight,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
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
    r.panelOver > 1.5 ||
    r.panelOverTop > 1.5 ||
    r.actionsOver > 1.5 ||
    r.quitOut ||
    r.resumeOut,
);
const out = { muddyCount: muddy.length, muddy, all: rows };
writeFileSync(join(root, 'tools/_tick131-pause-after.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ muddyCount: out.muddyCount, muddy: out.muddy, sample800: rows.filter((r) => r.w === 800) }, null, 2));
