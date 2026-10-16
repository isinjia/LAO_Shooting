/**
 * Tick137: tutorial @640 + pause @640 residual (tick132/131 were @800-heavy).
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
          // Force tutorial path
          localStorage.removeItem('lao_mini_tutorial_seen');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=r137tp-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        // select → go → tutorial
        await page.waitForSelector('#btn-go', { timeout: 90000 });
        await page.click('.char-card:not([data-key="random"])');
        await page.waitForTimeout(60);
        await page.click('#btn-go');
        await page.waitForSelector('.screen-tutorial, #btn-tut-go, .tutorial-grid', {
          timeout: 90000,
        });
        await page.waitForTimeout(160);
        const tut = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.tutorial-grid');
          const cta =
            document.getElementById('btn-tut-go') ||
            document.getElementById('btn-tut-start') ||
            oc.querySelector('.tutorial-actions .btn');
          const deco = oc.querySelector('.tutorial-deco');
          const note = oc.querySelector('.tutorial-note');
          const gR = grid?.getBoundingClientRect();
          const nested =
            grid &&
            getComputedStyle(grid).overflowY !== 'visible' &&
            grid.scrollHeight > grid.clientHeight + 2;
          return {
            screen: 'tutorial',
            cls: oc.className,
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            gridMin: grid?.style.minHeight || '',
            ctaOut: cta ? boxOut(cta, appR) : true,
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            noteDisplay: note ? getComputedStyle(note).display : 'none',
            nested: !!nested,
          };
        }, { boxOutSrc: boxOut.toString() });
        rows.push({ loc, w: size.width, h: size.height, ...tut });

        // Pause with long unmute strings (mirror tick131 markup + sync ladder)
        const pause = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tPause = 'Operation on hold';
          let tResume = 'Resume';
          let tOpts = 'OPTIONS';
          let tMute = 'Unmute audio and restore prior mix levels now';
          let tTitle = 'Return to title screen';
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
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-pause';
          content.style.maxHeight = '';
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
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
          const runSync = () => {
            const oc = content;
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
              return Math.max(0, ocR.bottom - (appR.bottom + 1), (appR.top - 1) - ocR.top);
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
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          runSync();
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const resume = document.getElementById('btn-resume');
          const quit = document.getElementById('btn-quit');
          const deco = content.querySelector('.pause-deco');
          return {
            screen: 'pause',
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            resumeOut: resume ? boxOut(resume, appR) : true,
            quitOut: quit ? boxOut(quit, appR) : true,
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            panelH: +ocR.height.toFixed(1),
            muteText: tMute,
            titleText: tTitle,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        rows.push({ loc, w: size.width, h: size.height, ...pause });
      } catch (err) {
        rows.push({
          loc,
          w: size.width,
          h: size.height,
          error: String(err.message || err),
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

const muddy = rows.filter((r) => {
  if (r.error) return false;
  if (r.screen === 'tutorial') {
    return (
      r.panelOver > 1.5 ||
      r.panelOverTop > 1.5 ||
      r.ctaOut ||
      (r.gridH > 0 && r.gridH < 36) ||
      r.nested
    );
  }
  if (r.screen === 'pause') {
    return r.panelOver > 1.5 || r.panelOverTop > 1.5 || r.resumeOut || r.quitOut;
  }
  return false;
});

const outPath = join(root, 'tools', 'probe-tick137-tutorial-pause-out.json');
writeFileSync(outPath, JSON.stringify({ muddyCount: muddy.length, muddy, rows }, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      muddy,
      tut360: rows.filter((r) => r.screen === 'tutorial' && r.h === 360),
      pause360: rows.filter((r) => r.screen === 'pause' && (r.h === 360 || r.h === 450)),
      errors: rows.filter((r) => r.error),
    },
    null,
    2,
  ),
);
process.exit(0);
