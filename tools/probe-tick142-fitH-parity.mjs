/**
 * Tick142: check whether tutorial / pause / result / title need the same
 * SE-class fitH clamp tick141 shipped for select+OPTIONS.
 * Root pattern: JS Math.max(floor, clientHeight*ratio) can exceed painted
 * #app box (fractional) → panelOver / negative headroom.
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

async function boot(size, loc, tag) {
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
  await page.goto(`${url}?cb=${tag}-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

const metricsSrc = `
  (ctaId) => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    if (!app || !oc) return { skipped: true };
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = ctaId
      ? document.getElementById(ctaId) || oc.querySelector(ctaId)
      : null;
    const maxH =
      parseFloat(oc.style.maxHeight) ||
      parseFloat(getComputedStyle(oc).maxHeight) ||
      0;
    const clientH = app.clientHeight || 0;
    return {
      panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
      headroom: +(appR.bottom - ocR.bottom).toFixed(2),
      maxH: +maxH.toFixed(2),
      appBoxH: +appR.height.toFixed(2),
      clientH,
      maxHFitsApp: !(maxH > 0) || maxH <= appR.height + 0.5,
      maxHGtClient: maxH > 0 && maxH > clientH + 0.5,
      panelH: +ocR.height.toFixed(2),
      ctaOut: cta
        ? (cta.getBoundingClientRect().bottom > appR.bottom + 1.5 ||
           cta.getBoundingClientRect().top < appR.top - 1.5)
        : false,
      cls: oc.className,
    };
  }
`;

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // ---- TITLE ----
      {
        const page = await boot(size, loc, 'r142title');
        try {
          await page.waitForTimeout(120);
          // open CONTROLS if present so keys budget runs
          await page.evaluate(() => {
            const b = [...document.querySelectorAll('button')].find((el) =>
              /control|조작|controles|управление|コントロール|控制/i.test(el.textContent || ''),
            );
            b?.click();
          });
          await page.waitForTimeout(100);
          const title = await page.evaluate((src) => {
            const fn = new Function(`return (${src})`)();
            const base = fn('#btn-start') || fn('button.btn-primary');
            const app = document.getElementById('app');
            const keys = document.querySelector('.keys-grid, .controls-keys');
            const hi = document.querySelector('.keys-hiscore, .hi-score, #hi-score');
            const appR = app?.getBoundingClientRect();
            const kR = keys?.getBoundingClientRect();
            const hiInside = !!(hi && appR && keys
              ? (() => {
                  const r = hi.getBoundingClientRect();
                  const kr = keys.getBoundingClientRect();
                  return r.bottom <= kr.bottom + 2 && r.top >= kr.top - 2;
                })()
              : true);
            return {
              screen: 'title',
              ...base,
              gridH: kR ? +kR.height.toFixed(1) : 0,
              hiInside,
            };
          }, metricsSrc);
          findings.push({ loc, w: size.width, h: size.height, ...title });
        } finally {
          await page.close();
        }
      }

      // ---- TUTORIAL via beginSortie ----
      {
        const page = await boot(size, loc, 'r142tut');
        try {
          await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '0'));
          await page.click('#btn-start');
          try {
            await page.waitForFunction(
              () => {
                const c = document.getElementById('overlay-content');
                return (
                  c?.classList.contains('screen-select') ||
                  c?.classList.contains('screen-tutorial')
                );
              },
              { timeout: 45000 },
            );
          } catch {
            findings.push({
              screen: 'tutorial',
              loc,
              w: size.width,
              h: size.height,
              skipped: true,
              reason: 'no-select',
            });
            continue;
          }
          await page.waitForTimeout(80);
          let landed = await page.evaluate(() =>
            document.getElementById('overlay-content')?.classList.contains('screen-tutorial'),
          );
          if (!landed) {
            await page.evaluate(() => {
              const card = document.querySelector('.char-card, .char-grid button, [data-char]');
              card?.click();
            });
            await page.waitForTimeout(40);
            await page.evaluate(() => {
              const b =
                document.getElementById('btn-confirm') ||
                document.getElementById('btn-go') ||
                document.getElementById('btn-sortie') ||
                [...document.querySelectorAll('button')].find((el) =>
                  /sortie|출격|confirm|확인|begin/i.test(el.textContent || ''),
                );
              b?.click();
            });
            await page.waitForTimeout(220);
            landed = await page.evaluate(() =>
              document.getElementById('overlay-content')?.classList.contains('screen-tutorial'),
            );
          }
          if (!landed) {
            findings.push({
              screen: 'tutorial',
              loc,
              w: size.width,
              h: size.height,
              skipped: true,
              reason: 'no-tutorial',
            });
          } else {
            const tut = await page.evaluate((src) => {
              const fn = new Function(`return (${src})`)();
              const base = fn('btn-tut-go');
              const grid = document.querySelector('.tutorial-grid');
              const gR = grid?.getBoundingClientRect();
              return {
                screen: 'tutorial',
                ...base,
                gridH: gR ? +gR.height.toFixed(1) : 0,
                softFloorOk: !gR || gR.height >= 36 || (window.innerHeight > 400),
              };
            }, metricsSrc);
            findings.push({ loc, w: size.width, h: size.height, ...tut });
          }
        } finally {
          await page.close();
        }
      }

      // ---- PAUSE (live markup + syncPausePanelBudget via window if exposed,
      // else mirror ladder with CURRENT last-resort formula from page source) ----
      {
        const page = await boot(size, loc, 'r142pause');
        try {
          const pause = await page.evaluate(async ({ loc, boxOutSrc }) => {
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
            // Prefer live sync if bound on window (usually not) — call via
            // re-dispatch by evaluating the same budget path through a
            // temporary script injection of the page's own function name.
            // Fallback: replicate ladder reading CURRENT formula from main
            // by calling getComputed then applying the same steps as main.js.
            const app = document.getElementById('app');
            const oc = content;
            const deco = oc.querySelector('.pause-deco');
            const blurb = oc.querySelector('.pause-blurb');
            const actions = oc.querySelector('.pause-actions');
            const brand = oc.querySelector('.pause-stamp .brand-mark');
            const h2 = oc.querySelector('.pause-stamp h2');
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
            let over = panelOver();
            let steps = 0;
            const appH0 = app.clientHeight || window.innerHeight || 450;
            const soft = () => appH0 <= 340 && rawHeadroom() < 8;
            if (!(over <= 1.5 && !soft())) {
              if (deco) deco.style.display = 'none';
              steps = 1;
              over = panelOver();
              if (!(over <= 1.5 && !soft())) {
                if (blurb) {
                  blurb.style.border = 'none';
                  blurb.style.backgroundImage = 'none';
                  blurb.style.padding = '0';
                  blurb.style.clipPath = 'none';
                  blurb.style.marginTop = '2px';
                }
                steps = 2;
                over = panelOver();
                if (!(over <= 1.5 && !soft())) {
                  oc.classList.add('is-pause-short');
                  if (brand) brand.style.display = 'none';
                  if (h2) {
                    h2.style.fontSize = '18px';
                    h2.style.margin = '0';
                    h2.style.letterSpacing = '0.12em';
                  }
                  steps = 3;
                  over = panelOver();
                  if (!(over <= 1.5 && !soft())) {
                    actions.style.padding = '6px';
                    steps = 4;
                    over = panelOver();
                    if (!(over <= 1.5 && !soft())) {
                      oc.style.paddingTop = '22px';
                      oc.style.paddingBottom = '16px';
                      steps = 5;
                      over = panelOver();
                      if (over > 1.5) {
                        // Tick142 last-resort — fitH floor (mirrors main.js)
                        const appBoxH = app.getBoundingClientRect().height || appH0;
                        const fitH = Math.floor(Math.min(appH0, appBoxH));
                        const ratioCap = Math.floor(fitH * 0.96);
                        const floorCap = Math.min(280, fitH);
                        oc.style.maxHeight = `${Math.max(floorCap, ratioCap)}px`;
                        steps = 6;
                        over = panelOver();
                      }
                    }
                  }
                }
              }
            }
            void oc.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            const maxH =
              parseFloat(oc.style.maxHeight) ||
              parseFloat(getComputedStyle(oc).maxHeight) ||
              0;
            const resume = document.getElementById('btn-resume');
            const quit = document.getElementById('btn-quit');
            return {
              screen: 'pause',
              panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              maxH: +maxH.toFixed(2),
              appBoxH: +appR.height.toFixed(2),
              clientH: app.clientHeight || 0,
              maxHFitsApp: !(maxH > 0) || maxH <= appR.height + 0.5,
              syncSteps: steps,
              ctaOut: resume ? boxOut(resume, appR) : true,
              quitOut: quit ? boxOut(quit, appR) : true,
            };
          }, { loc, boxOutSrc: boxOut.toString() });
          findings.push({ loc, w: size.width, h: size.height, ...pause });
        } finally {
          await page.close();
        }
      }

      // ---- RESULT (real endScreen-ish markup + sync ladder) ----
      {
        const page = await boot(size, loc, 'r142result');
        try {
          const result = await page.evaluate(async ({ loc, boxOutSrc }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            let tRetry = 'Retry';
            let tTitle = 'To title';
            let tClear = 'STAGE CLEAR';
            try {
              const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
              if (mod?.setLocale) mod.setLocale(loc);
              if (mod?.t) {
                tRetry = mod.t('btn.retry');
                tTitle = mod.t('btn.toTitle');
                tClear = mod.t('result.clear') || mod.t('result.cleared') || tClear;
              }
            } catch { /* */ }
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            overlay.classList.add('is-on');
            overlay.style.display = 'flex';
            content.className = 'screen-result cleared';
            content.style.cssText = '';
            content.innerHTML = `
              <div class="panel-frame" aria-hidden="true"></div>
              <span class="brand-mark">LAO MINI</span>
              <h2>${tClear}</h2>
              <span class="result-deco" aria-hidden="true"></span>
              <div class="result-score">
                <div class="cell"><span class="k">SCORE</span><span class="v">999999</span></div>
                <div class="cell"><span class="k">HI</span><span class="v">999999</span></div>
                <div class="cell"><span class="k">RANK</span><span class="v">S</span></div>
              </div>
              <div class="result-meta">
                <div class="cell"><span class="k">TIME</span><span class="v">12:34</span></div>
                <div class="cell"><span class="k">GRAZE</span><span class="v">42</span></div>
                <div class="cell"><span class="k">BOMB</span><span class="v">3</span></div>
                <div class="cell"><span class="k">HIT</span><span class="v">0</span></div>
              </div>
              <div class="result-actions pause-actions">
                <button class="btn btn-primary btn-cta" id="btn-retry">${tRetry}</button>
                <button class="btn btn-ghost" id="btn-title">${tTitle}</button>
              </div>
            `;
            const app = document.getElementById('app');
            const oc = content;
            const deco = oc.querySelector('.result-deco');
            const score = oc.querySelector('.result-score');
            const meta = oc.querySelector('.result-meta');
            const brand = oc.querySelector(':scope > .brand-mark');
            const h2 = oc.querySelector(':scope > h2');
            const retry = document.getElementById('btn-retry');
            const titleBtn = document.getElementById('btn-title');
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
            let over = panelOver();
            let steps = 0;
            const appH0 = app.clientHeight || window.innerHeight || 360;
            const soft = () => appH0 <= 340 && rawHeadroom() < 8;
            if (!(over <= 1.5 && !soft())) {
              if (deco) deco.style.display = 'none';
              steps = 1;
              over = panelOver();
              if (!(over <= 1.5 && !soft())) {
                if (brand) brand.style.marginBottom = '6px';
                if (h2) h2.style.marginBottom = '6px';
                if (score) {
                  score.style.marginTop = '4px';
                  score.style.marginBottom = '8px';
                  score.style.gap = '12px';
                }
                if (meta) {
                  meta.style.marginBottom = '8px';
                  meta.style.gap = '6px 12px';
                }
                steps = 2;
                over = panelOver();
                if (!(over <= 1.5 && !soft())) {
                  oc.classList.add('is-result-short');
                  if (brand) brand.style.display = 'none';
                  if (h2) {
                    h2.style.fontSize = '18px';
                    h2.style.margin = '0';
                    h2.style.letterSpacing = '0.12em';
                  }
                  steps = 3;
                  over = panelOver();
                  if (over > 1.5) {
                    for (const cell of oc.querySelectorAll(
                      '.result-score .cell, .result-meta .cell',
                    )) {
                      cell.style.padding = '2px 4px';
                      cell.style.border = 'none';
                      cell.style.backgroundImage = 'none';
                      cell.style.boxShadow = 'none';
                      cell.style.clipPath = 'none';
                    }
                    steps = 4;
                    over = panelOver();
                    if (over > 1.5) {
                      oc.style.paddingTop = '18px';
                      oc.style.paddingBottom = '12px';
                      steps = 5;
                      over = panelOver();
                      if (over > 1.5) {
                        if (retry) retry.style.padding = '8px 20px';
                        if (titleBtn) titleBtn.style.padding = '8px 20px';
                        steps = 6;
                        over = panelOver();
                        if (over > 1.5) {
                          // Tick142 last-resort — fitH floor (mirrors main.js)
                          const appBoxH = app.getBoundingClientRect().height || appH0;
                          const fitH = Math.floor(Math.min(appH0, appBoxH));
                          const ratioCap = Math.floor(fitH * 0.96);
                          const floorCap = Math.min(260, fitH);
                          oc.style.maxHeight = `${Math.max(floorCap, ratioCap)}px`;
                          steps = 7;
                          over = panelOver();
                        }
                      }
                    }
                  }
                }
              }
            }
            void oc.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            const maxH =
              parseFloat(oc.style.maxHeight) ||
              parseFloat(getComputedStyle(oc).maxHeight) ||
              0;
            return {
              screen: 'result',
              panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              maxH: +maxH.toFixed(2),
              appBoxH: +appR.height.toFixed(2),
              clientH: app.clientHeight || 0,
              maxHFitsApp: !(maxH > 0) || maxH <= appR.height + 0.5,
              syncSteps: steps,
              ctaOut: retry ? boxOut(retry, appR) : true,
            };
          }, { loc, boxOutSrc: boxOut.toString() });
          findings.push({ loc, w: size.width, h: size.height, ...result });
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

const muddy = findings.filter((f) => {
  if (f.skipped) return false;
  if (f.screen === 'title') {
    return f.panelOver > 1.5 || f.ctaOut || (f.h <= 400 && f.gridH > 0 && f.gridH < 36);
  }
  if (f.screen === 'tutorial') {
    return (
      f.panelOver > 0.15 ||
      f.ctaOut ||
      f.headroom < -0.15 ||
      f.maxHFitsApp === false ||
      (f.h <= 400 && f.gridH < 36)
    );
  }
  if (f.screen === 'pause' || f.screen === 'result') {
    return (
      f.panelOver > 0.15 ||
      f.ctaOut ||
      f.headroom < -0.15 ||
      f.maxHFitsApp === false ||
      (f.quitOut === true && f.screen === 'pause')
    );
  }
  return false;
});

// Flag specifically the floor>appBox pattern (tick141 class)
const floorOverflow = findings.filter(
  (f) =>
    !f.skipped &&
    f.maxH > 0 &&
    f.appBoxH > 0 &&
    f.maxH > f.appBoxH + 0.05,
);

const out = {
  muddyCount: muddy.length,
  floorOverflowCount: floorOverflow.length,
  muddy: muddy.slice(0, 40),
  floorOverflow: floorOverflow.slice(0, 40),
  sample: findings.filter((f) => f.h === 320 || f.h === 288 || f.h === 280).slice(0, 48),
  byScreen: ['title', 'tutorial', 'pause', 'result'].map((screen) => {
    const rows = findings.filter((f) => f.screen === screen && !f.skipped);
    const m = muddy.filter((f) => f.screen === screen);
    const fo = floorOverflow.filter((f) => f.screen === screen);
    const se = rows.filter((f) => f.h === 320);
    return {
      screen,
      n: rows.length,
      muddy: m.length,
      floorOverflow: fo.length,
      seHeadroomMin: se.length
        ? Math.min(...se.map((f) => f.headroom ?? 99))
        : null,
      sePanelOverMax: se.length
        ? Math.max(...se.map((f) => f.panelOver ?? 0))
        : null,
      seMaxH: se[0]?.maxH,
      seAppBox: se[0]?.appBoxH,
      seClientH: se[0]?.clientH,
    };
  }),
};

writeFileSync(join(root, 'tools/probe-tick142-fitH-parity.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
