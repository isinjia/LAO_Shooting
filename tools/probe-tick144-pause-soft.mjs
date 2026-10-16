/**
 * Tick144: pause ultra-short last-resort soft-continue candidate.
 * Hypothesis: after pad step, hard `over ≤ 1.5` return skips fitH last-resort
 * while raw headroom stays negative (result tick143 parity gap).
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

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc) {
  const page = await browser.newPage({
    viewport: size,
    hasTouch: false,
    isMobile: false,
  });
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
  await page.goto(`${url}?cb=t144p-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await boot(size, loc);
      try {
        const result = await page.evaluate(
          async ({ loc, boxOutSrc }) => {
            const boxOut = eval(`(${boxOutSrc})`);
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
            overlay.classList.add('show');
            overlay.classList.remove('hidden');
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
            const run = (softLast) => {
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
              if (deco) deco.style.display = '';
              if (brand) {
                brand.style.display = '';
                brand.style.marginBottom = '';
              }
              if (h2) {
                h2.style.fontSize = '';
                h2.style.margin = '';
                h2.style.letterSpacing = '';
              }
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
              const appH0 = app.clientHeight || window.innerHeight || 450;
              const rawHeadroom = () => {
                void oc.offsetHeight;
                const appR = app.getBoundingClientRect();
                const ocR = oc.getBoundingClientRect();
                return appR.bottom - ocR.bottom;
              };

              let syncSteps = 0;
              let over = panelOver();
              if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) {
                return { syncSteps, stopped: 'early0', over, raw: rawHeadroom() };
              }
              if (deco) deco.style.display = 'none';
              syncSteps++;
              over = panelOver();
              if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) {
                return { syncSteps, stopped: 'deco', over, raw: rawHeadroom() };
              }
              if (blurb) {
                blurb.style.border = 'none';
                blurb.style.backgroundImage = 'none';
                blurb.style.padding = '0';
                blurb.style.clipPath = 'none';
                blurb.style.marginTop = '2px';
              }
              syncSteps++;
              over = panelOver();
              if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) {
                return { syncSteps, stopped: 'blurb', over, raw: rawHeadroom() };
              }
              oc.classList.add('is-pause-short');
              if (brand) brand.style.display = 'none';
              if (h2) {
                h2.style.fontSize = '18px';
                h2.style.margin = '0';
                h2.style.letterSpacing = '0.12em';
              }
              syncSteps++;
              over = panelOver();
              if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) {
                return { syncSteps, stopped: 'head', over, raw: rawHeadroom() };
              }
              actions.style.padding = '6px';
              syncSteps++;
              over = panelOver();
              if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) {
                return { syncSteps, stopped: 'actions', over, raw: rawHeadroom() };
              }
              oc.style.paddingTop = '22px';
              oc.style.paddingBottom = '16px';
              syncSteps++;
              over = panelOver();
              // CURRENT shipped: hard return (no soft)
              // TRIAL softLast: soft-continue like result tick143
              const softNeed = appH0 <= 340 && rawHeadroom() < 8;
              if (softLast) {
                if (over <= 1.5 && !softNeed) {
                  return { syncSteps, stopped: 'pad-soft-skip', over, raw: rawHeadroom(), softNeed };
                }
              } else if (over <= 1.5) {
                return { syncSteps, stopped: 'pad-hard', over, raw: rawHeadroom(), softNeed };
              }
              const appH = app.clientHeight || window.innerHeight || 450;
              const appBoxH = app.getBoundingClientRect().height || appH;
              const fitH = Math.floor(Math.min(appH, appBoxH));
              const ratioCap = Math.floor(fitH * 0.96);
              const floorCap = Math.min(280, fitH);
              oc.style.maxHeight = `${Math.max(floorCap, ratioCap)}px`;
              syncSteps++;
              return {
                syncSteps,
                stopped: 'last-resort',
                over: panelOver(),
                raw: rawHeadroom(),
                softNeed,
                fitH,
              };
            };

            const hard = run(false);
            void content.offsetHeight;
            let appR = app.getBoundingClientRect();
            let ocR = content.getBoundingClientRect();
            const resume = document.getElementById('btn-resume');
            const quit = document.getElementById('btn-quit');
            const hardMeas = {
              panelOverRaw: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              maxH: +(parseFloat(content.style.maxHeight) || 0).toFixed(2),
              ctaOut: resume ? boxOut(resume, appR) : true,
              quitOut: quit ? boxOut(quit, appR) : true,
              appBox: +appR.height.toFixed(2),
              clientH: app.clientHeight || 0,
              ...hard,
            };

            const soft = run(true);
            void content.offsetHeight;
            appR = app.getBoundingClientRect();
            ocR = content.getBoundingClientRect();
            const softMeas = {
              panelOverRaw: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              maxH: +(parseFloat(content.style.maxHeight) || 0).toFixed(2),
              ctaOut: resume ? boxOut(resume, appR) : true,
              quitOut: quit ? boxOut(quit, appR) : true,
              appBox: +appR.height.toFixed(2),
              ...soft,
            };

            return { hard: hardMeas, soft: softMeas };
          },
          { loc, boxOutSrc: boxOut.toString() },
        );
        findings.push({ loc, w: size.width, h: size.height, ...result });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const winHardMuddy = findings.filter(
  (f) =>
    f.hard.panelOverRaw > 1.5 ||
    f.hard.headroom < -1.5 ||
    f.hard.ctaOut ||
    f.hard.quitOut,
);
const winSoftMuddy = findings.filter(
  (f) =>
    f.soft.panelOverRaw > 1.5 ||
    f.soft.headroom < -1.5 ||
    f.soft.ctaOut ||
    f.soft.quitOut,
);
const softHelps = findings.filter(
  (f) =>
    f.hard.stopped === 'pad-hard' &&
    f.hard.softNeed &&
    f.soft.stopped === 'last-resort',
);

console.log(
  JSON.stringify(
    {
      hardMuddyCount: winHardMuddy.length,
      softMuddyCount: winSoftMuddy.length,
      softHelpsCount: softHelps.length,
      softHelps: softHelps.map((f) => ({
        loc: f.loc,
        size: `${f.w}x${f.h}`,
        hard: {
          stopped: f.hard.stopped,
          over: f.hard.over,
          raw: f.hard.raw,
          headroom: f.hard.headroom,
          panelOverRaw: f.hard.panelOverRaw,
          maxH: f.hard.maxH,
          ctaOut: f.hard.ctaOut,
          quitOut: f.hard.quitOut,
        },
        soft: {
          stopped: f.soft.stopped,
          headroom: f.soft.headroom,
          panelOverRaw: f.soft.panelOverRaw,
          maxH: f.soft.maxH,
          ctaOut: f.soft.ctaOut,
          quitOut: f.soft.quitOut,
        },
      })),
      sample288hard: findings
        .filter((f) => f.h === 288)
        .map((f) => ({ loc: f.loc, ...f.hard })),
      sample288soft: findings
        .filter((f) => f.h === 288)
        .map((f) => ({ loc: f.loc, ...f.soft })),
      sample320hard: findings
        .filter((f) => f.h === 320)
        .map((f) => ({ loc: f.loc, hardStop: f.hard.stopped, softStop: f.soft.stopped, hH: f.hard.headroom, sH: f.soft.headroom, hMax: f.hard.maxH, sMax: f.soft.maxH })),
      sample280: findings
        .filter((f) => f.h === 280)
        .map((f) => ({
          loc: f.loc,
          hardStop: f.hard.stopped,
          softStop: f.soft.stopped,
          hOver: f.hard.panelOverRaw,
          sOver: f.soft.panelOverRaw,
          hCta: f.hard.ctaOut,
          sCta: f.soft.ctaOut,
          hQuit: f.hard.quitOut,
          sQuit: f.soft.quitOut,
          hMax: f.hard.maxH,
          sMax: f.soft.maxH,
        })),
    },
    null,
    2,
  ),
);
