/**
 * Tick138 trial: pause extreme-short — hide brand + compact h2 before pad steps.
 * Live: es/ru @640×360 syncSteps=4 / headroom≈0 with brandH≈24 + h2H≈34.
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
          localStorage.setItem('lao_mini_tutorial_seen', '1');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=p138t-${Date.now()}-${loc}-${size.width}`, {
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

          const mount = () => {
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
            return content;
          };

          const measure = (content, label, extra) => {
            const app = document.getElementById('app');
            void content.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const h2 = content.querySelector('h2');
            const blurb = content.querySelector('.pause-blurb');
            const quit = document.getElementById('btn-quit');
            const resume = document.getElementById('btn-resume');
            return {
              label,
              panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(1),
              brandDisplay: brand ? getComputedStyle(brand).display : 'none',
              brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
              h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
              blurbH: blurb ? +blurb.getBoundingClientRect().height.toFixed(1) : 0,
              quitOut: quit ? boxOut(quit, appR) : true,
              resumeOut: resume ? boxOut(resume, appR) : true,
              maxH: getComputedStyle(content).maxHeight,
              ...extra,
            };
          };

          const runLadder = (content, { headReclaim }) => {
            const app = document.getElementById('app');
            const oc = content;
            const deco = oc.querySelector('.pause-deco');
            const blurb = oc.querySelector('.pause-blurb');
            const actions = oc.querySelector('.pause-actions');
            const brand = oc.querySelector('.brand-mark');
            const h2 = oc.querySelector('h2');
            const stamp = oc.querySelector('.pause-stamp');
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
            if (brand) {
              brand.style.display = '';
              brand.style.marginBottom = '';
            }
            if (h2) {
              h2.style.fontSize = '';
              h2.style.margin = '';
              h2.style.letterSpacing = '';
            }
            if (stamp) stamp.style.marginBottom = '';

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

            let steps = 0;
            let over = panelOver();
            if (over <= 1.5) return { steps, over };

            if (deco) deco.style.display = 'none';
            steps = 1;
            over = panelOver();
            if (over <= 1.5) return { steps, over };

            if (blurb) {
              blurb.style.border = 'none';
              blurb.style.backgroundImage = 'none';
              blurb.style.padding = '0';
              blurb.style.clipPath = 'none';
              blurb.style.marginTop = '2px';
            }
            steps = 2;
            over = panelOver();
            if (over <= 1.5) return { steps, over };

            if (headReclaim) {
              if (brand) brand.style.display = 'none';
              if (h2) {
                h2.style.fontSize = '18px';
                h2.style.margin = '0';
                h2.style.letterSpacing = '0.12em';
              }
              if (stamp) stamp.style.marginBottom = '4px';
              steps = 2.5;
              over = panelOver();
              if (over <= 1.5) return { steps, over };
            }

            actions.style.padding = '6px';
            steps = 3;
            over = panelOver();
            if (over <= 1.5) return { steps, over };

            oc.style.paddingTop = '22px';
            oc.style.paddingBottom = '16px';
            steps = 4;
            over = panelOver();
            if (over <= 1.5) return { steps, over };

            const appH = app.clientHeight || window.innerHeight || 450;
            oc.style.maxHeight = `${Math.max(280, Math.floor(appH * 0.96))}px`;
            steps = 5;
            return { steps, over: panelOver() };
          };

          // Baseline (current tick131 ladder)
          let content = mount();
          let base = runLadder(content, { headReclaim: false });
          const before = measure(content, 'before', { syncSteps: base.steps });

          // Trial head reclaim inserted after blurb flatten
          content = mount();
          let trial = runLadder(content, { headReclaim: true });
          const after = measure(content, 'after-head', { syncSteps: trial.steps });

          // CSS-only ≤400 belt simulation (always hide brand + compact h2)
          content = mount();
          const brand = content.querySelector('.brand-mark');
          const h2 = content.querySelector('h2');
          if (brand) brand.style.display = 'none';
          if (h2) {
            h2.style.fontSize = '18px';
            h2.style.margin = '0';
            h2.style.letterSpacing = '0.12em';
          }
          let belt = runLadder(content, { headReclaim: false });
          // re-apply belt after clear in ladder — runLadder resets styles; apply belt after
          content = mount();
          const brand2 = content.querySelector('.brand-mark');
          const h2b = content.querySelector('h2');
          if (brand2) brand2.style.display = 'none';
          if (h2b) {
            h2b.style.fontSize = '18px';
            h2b.style.margin = '0';
            h2b.style.letterSpacing = '0.12em';
          }
          // Custom ladder that keeps belt (does not clear brand/h2)
          {
            const app = document.getElementById('app');
            const oc = content;
            const deco = oc.querySelector('.pause-deco');
            const blurb = oc.querySelector('.pause-blurb');
            const actions = oc.querySelector('.pause-actions');
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
            let steps = 0;
            let over = panelOver();
            if (over > 1.5) {
              if (deco) deco.style.display = 'none';
              steps = 1;
              over = panelOver();
            }
            if (over > 1.5) {
              if (blurb) {
                blurb.style.border = 'none';
                blurb.style.backgroundImage = 'none';
                blurb.style.padding = '0';
                blurb.style.clipPath = 'none';
                blurb.style.marginTop = '2px';
              }
              steps = 2;
              over = panelOver();
            }
            if (over > 1.5) {
              actions.style.padding = '6px';
              steps = 3;
              over = panelOver();
            }
            if (over > 1.5) {
              oc.style.paddingTop = '22px';
              oc.style.paddingBottom = '16px';
              steps = 4;
              over = panelOver();
            }
            if (over > 1.5) {
              const appH = app.clientHeight || window.innerHeight || 450;
              oc.style.maxHeight = `${Math.max(280, Math.floor(appH * 0.96))}px`;
              steps = 5;
              over = panelOver();
            }
            belt = { steps, over };
          }
          const afterBelt = measure(content, 'after-belt', { syncSteps: belt.steps });

          return { before, after, afterBelt };
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

const outPath = join(root, 'tools', 'probe-tick138-pause-trial-out.json');
writeFileSync(outPath, JSON.stringify({ rows }, null, 2));
console.log(
  JSON.stringify(
    {
      at360: rows
        .filter((r) => r.h === 360)
        .map((r) => ({
          loc: r.loc,
          before: {
            over: r.before.panelOver,
            head: r.before.headroom,
            steps: r.before.syncSteps,
            brandH: r.before.brandH,
            h2H: r.before.h2H,
          },
          after: {
            over: r.after.panelOver,
            head: r.after.headroom,
            steps: r.after.syncSteps,
            brandH: r.after.brandH,
            h2H: r.after.h2H,
          },
          belt: {
            over: r.afterBelt.panelOver,
            head: r.afterBelt.headroom,
            steps: r.afterBelt.syncSteps,
            brandH: r.afterBelt.brandH,
            h2H: r.afterBelt.h2H,
          },
        })),
      at450: rows
        .filter((r) => r.h === 450)
        .map((r) => ({
          loc: r.loc,
          beforeSteps: r.before.syncSteps,
          beltSteps: r.afterBelt.syncSteps,
          beforeHead: r.before.headroom,
          beltHead: r.afterBelt.headroom,
          beltBrand: r.afterBelt.brandDisplay,
        })),
    },
    null,
    2,
  ),
);
