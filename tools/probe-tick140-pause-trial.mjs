/**
 * Tick140 pause SE-class soft-continue trial.
 * Live: @568×320 short locales panelOver raw≈1.83 / headroom≈−1.8 while
 * syncStops under +1.5 (over≈0.83) after CSS ≤400 brand/h2 belt — CTA clear.
 * Trial: result-tick139 parity — continue ladder when appH≤340 && rawHeadroom<8.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 640, height: 360 },
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
        await page.addInitScript(
          ({ loc }) => {
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
          },
          { loc },
        );
        await page.goto(`${url}?cb=r140p-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const measure = await page.evaluate(async ({ loc, boxOutSrc, trial }) => {
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
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-pause';
          content.style.cssText = '';
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
          const run = (useSoft) => {
            const oc = content;
            const deco = oc.querySelector('.pause-deco');
            const blurb = oc.querySelector('.pause-blurb');
            const actions = oc.querySelector('.pause-actions');
            const brand = oc.querySelector('.pause-stamp .brand-mark');
            const h2 = oc.querySelector('.pause-stamp h2');
            oc.classList.remove('is-pause-short');
            oc.style.maxHeight = '';
            oc.style.paddingTop = '';
            oc.style.paddingBottom = '';
            if (brand) brand.style.display = '';
            if (h2) {
              h2.style.fontSize = '';
              h2.style.margin = '';
              h2.style.letterSpacing = '';
            }
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
            const rawHeadroom = () => {
              void oc.offsetHeight;
              const appR = app.getBoundingClientRect();
              const ocR = oc.getBoundingClientRect();
              return appR.bottom - ocR.bottom;
            };
            const appH0 = app.clientHeight || window.innerHeight || 450;
            const softGate = () => useSoft && appH0 <= 340 && rawHeadroom() < 8;
            let over = panelOver();
            let steps = 0;
            if (over <= 1.5 && !softGate()) {
              return { steps, over, head: rawHeadroom() };
            }
            if (deco) deco.style.display = 'none';
            steps = 1; over = panelOver();
            if (over <= 1.5 && !softGate()) return { steps, over, head: rawHeadroom() };
            if (blurb) {
              blurb.style.border = 'none';
              blurb.style.backgroundImage = 'none';
              blurb.style.padding = '0';
              blurb.style.clipPath = 'none';
              blurb.style.marginTop = '2px';
            }
            steps = 2; over = panelOver();
            if (over <= 1.5 && !softGate()) return { steps, over, head: rawHeadroom() };
            oc.classList.add('is-pause-short');
            if (brand) brand.style.display = 'none';
            if (h2) {
              h2.style.fontSize = '18px';
              h2.style.margin = '0';
              h2.style.letterSpacing = '0.12em';
            }
            steps = 3; over = panelOver();
            if (over <= 1.5 && !softGate()) return { steps, over, head: rawHeadroom() };
            actions.style.padding = '6px';
            steps = 4; over = panelOver();
            if (over <= 1.5 && !softGate()) return { steps, over, head: rawHeadroom() };
            oc.style.paddingTop = '22px';
            oc.style.paddingBottom = '16px';
            steps = 5; over = panelOver();
            if (over <= 1.5) return { steps, over, head: rawHeadroom() };
            oc.style.maxHeight = `${Math.max(280, Math.floor(appH0 * 0.96))}px`;
            return { steps: 6, over: panelOver(), head: rawHeadroom() };
          };

          const before = run(false);
          // reset then trial
          const after = run(!!trial);
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const brand = content.querySelector('.brand-mark');
          const h2 = content.querySelector('h2');
          const quit = document.getElementById('btn-quit');
          const resume = document.getElementById('btn-resume');
          const mute = document.getElementById('btn-pause-mute');
          const actions = content.querySelector('.pause-actions');
          return {
            before,
            after,
            panelOverRaw: +(ocR.bottom - appR.bottom).toFixed(2),
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2Fs: h2 ? getComputedStyle(h2).fontSize : '',
            actionsPad: actions ? getComputedStyle(actions).padding : '',
            padTop: getComputedStyle(content).paddingTop,
            padBot: getComputedStyle(content).paddingBottom,
            quitOut: quit ? boxOut(quit, appR) : true,
            resumeOut: resume ? boxOut(resume, appR) : true,
            muteOut: mute ? boxOut(mute, appR) : true,
            isPauseShort: content.classList.contains('is-pause-short'),
            muteText: tMute,
          };
        }, { loc, boxOutSrc: boxOut.toString(), trial: true });

        rows.push({
          loc,
          w: size.width,
          h: size.height,
          beforeSteps: measure.before.steps,
          beforeOver: +measure.before.over.toFixed(2),
          beforeHead: +measure.before.head.toFixed(1),
          afterSteps: measure.after.steps,
          afterOver: +measure.after.over.toFixed(2),
          afterHead: +measure.after.head.toFixed(1),
          panelOverRaw: measure.panelOverRaw,
          headroom: measure.headroom,
          brandDisplay: measure.brandDisplay,
          h2Fs: measure.h2Fs,
          actionsPad: measure.actionsPad,
          padTop: measure.padTop,
          padBot: measure.padBot,
          quitOut: measure.quitOut,
          resumeOut: measure.resumeOut,
          muteOut: measure.muteOut,
          isPauseShort: measure.isPauseShort,
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

const muddyBefore = rows.filter(
  (r) => r.beforeHead < 0 || r.beforeOver > 1.5 || r.quitOut || r.resumeOut,
);
const muddyAfter = rows.filter(
  (r) => r.afterHead < 0 || r.afterOver > 1.5 || r.quitOut || r.resumeOut || r.headroom < 0,
);
const softBefore = rows.filter((r) => r.h <= 320 && r.beforeHead < 8);
const softAfter = rows.filter((r) => r.h <= 320 && r.afterHead < 8);

const out = { muddyBefore: muddyBefore.length, muddyAfter: muddyAfter.length, softBefore, softAfter, rows };
writeFileSync(join(root, 'tools', 'probe-tick140-pause-trial-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyBefore: out.muddyBefore,
      muddyAfter: out.muddyAfter,
      softBefore320: softBefore,
      softAfter320: softAfter,
      se: rows.filter((r) => r.h === 320),
      at360: rows.filter((r) => r.h === 360 && ['es', 'ru', 'ko'].includes(r.loc)),
      at450: rows.filter((r) => r.h === 450 && ['es', 'ru'].includes(r.loc)),
    },
    null,
    2,
  ),
);
