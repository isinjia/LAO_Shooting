/**
 * Tick140 verify: pause SE-class soft-continue after ship.
 * Expect @568×320: headroom≥8 (or es/ru already-funded ≥2), CTA clear,
 * syncSteps≥4 when soft-continue fires; @640×360 brand/h2 belt retained.
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

// Mirror shipped syncPausePanelBudget (tick131/138/140)
const SYNC_SRC = `
function runSync(oc, app) {
  const deco = oc.querySelector('.pause-deco');
  const blurb = oc.querySelector('.pause-blurb');
  const actions = oc.querySelector('.pause-actions');
  const stamp = oc.querySelector('.pause-stamp');
  const brand = stamp?.querySelector('.brand-mark');
  const h2 = stamp?.querySelector('h2');
  if (!app || !actions) return { steps: -1, over: 0 };
  oc.classList.remove('is-pause-short');
  oc.style.maxHeight = '';
  oc.style.paddingTop = '';
  oc.style.paddingBottom = '';
  if (deco) deco.style.display = '';
  if (brand) { brand.style.display = ''; brand.style.marginBottom = ''; }
  if (h2) { h2.style.fontSize = ''; h2.style.margin = ''; h2.style.letterSpacing = ''; }
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
  const appH0 = app.clientHeight || window.innerHeight || 450;
  const rawHeadroom = () => {
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    return appR.bottom - ocR.bottom;
  };
  let over = panelOver();
  let steps = 0;
  if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) return { steps, over };
  if (deco) deco.style.display = 'none';
  steps = 1; over = panelOver();
  if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) return { steps, over };
  if (blurb) {
    blurb.style.border = 'none';
    blurb.style.backgroundImage = 'none';
    blurb.style.padding = '0';
    blurb.style.clipPath = 'none';
    blurb.style.marginTop = '2px';
  }
  steps = 2; over = panelOver();
  if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) return { steps, over };
  oc.classList.add('is-pause-short');
  if (brand) brand.style.display = 'none';
  if (h2) { h2.style.fontSize = '18px'; h2.style.margin = '0'; h2.style.letterSpacing = '0.12em'; }
  steps = 3; over = panelOver();
  if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) return { steps, over };
  actions.style.padding = '6px';
  steps = 4; over = panelOver();
  if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) return { steps, over };
  oc.style.paddingTop = '22px';
  oc.style.paddingBottom = '16px';
  steps = 5; over = panelOver();
  if (over <= 1.5) return { steps, over };
  oc.style.maxHeight = Math.max(280, Math.floor(appH0 * 0.96)) + 'px';
  return { steps: 6, over: panelOver() };
}
`;

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

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
        await page.goto(`${url}?cb=r140f-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const row = await page.evaluate(async ({ loc, boxOutSrc, syncSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const runSync = new Function(`${syncSrc}; return runSync;`)();
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
          const sync = runSync(content, app);
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const brand = content.querySelector('.brand-mark');
          const h2 = content.querySelector('h2');
          const quit = document.getElementById('btn-quit');
          const resume = document.getElementById('btn-resume');
          const mute = document.getElementById('btn-pause-mute');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            syncSteps: sync?.steps ?? -1,
            syncOver: +(sync?.over ?? 0).toFixed(2),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2Fs: h2 ? getComputedStyle(h2).fontSize : '',
            quitOut: quit ? boxOut(quit, appR) : true,
            resumeOut: resume ? boxOut(resume, appR) : true,
            muteOut: mute ? boxOut(mute, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            isPauseShort: content.classList.contains('is-pause-short'),
            padTop: getComputedStyle(content).paddingTop,
          };
        }, { loc, boxOutSrc: boxOut.toString(), syncSrc: SYNC_SRC });

        findings.push({ loc, w: size.width, h: size.height, ...row });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const muddy = findings.filter(
  (f) =>
    f.panelOver > 1.5 ||
    f.quitOut ||
    f.resumeOut ||
    f.muteOut ||
    f.headroom < 0 ||
    (f.h <= 320 && f.headroom < 2) ||
    (f.h === 320 && ['ko', 'en', 'pt', 'zh-TW'].includes(f.loc) && f.syncSteps < 4),
);

const out = { muddyCount: muddy.length, muddy, findings };
writeFileSync(join(root, 'tools', 'probe-tick140-pause-floor-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      se320: findings.filter((f) => f.h === 320),
      at360: findings.filter((f) => f.h === 360 && ['ko', 'es', 'ru'].includes(f.loc)),
    },
    null,
    2,
  ),
);
