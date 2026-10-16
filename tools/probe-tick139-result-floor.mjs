/**
 * Tick139 verify: result extreme-short head reclaim after brand/h2 belt.
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
const findings = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
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
        await page.goto(`${url}?cb=r139f-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const row = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tRetry = 'Play again';
          let tTitle = 'Title';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tRetry = mod.t('btn.retryRun') || tRetry;
              tTitle = mod.t('btn.title') || tTitle;
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-result gameover';
          content.style.cssText = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">SYSTEM DOWN</span>
            <h2>GAME OVER</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="lbl">SCORE</span><span class="val">012345678</span></div>
              <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">098765432</span></div>
              <div class="cell"><span class="lbl">GRAZE</span><span class="val">1234</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 3 · ORBITAL SPIRE</span></div>
              <div class="cell"><span class="lbl">PILOT</span><span class="val">CONSTANTIA</span></div>
              <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">99</span></div>
              <div class="cell"><span class="lbl">NO MISS</span><span class="val">YES</span></div>
            </div>
            <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
            <button class="btn" id="btn-title">${tTitle}</button>
          `;
          // Mirror live syncResultPanelBudget (tick133 + tick139)
          const app = document.getElementById('app');
          const oc = content;
          const deco = oc.querySelector('.result-deco');
          const score = oc.querySelector('.result-score');
          const meta = oc.querySelector('.result-meta');
          const brand = oc.querySelector(':scope > .brand-mark');
          const h2 = oc.querySelector(':scope > h2');
          const retry = oc.querySelector('#btn-retry');
          const titleBtn = oc.querySelector('#btn-title');
          oc.classList.remove('is-result-short');
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
            h2.style.marginBottom = '';
            h2.style.letterSpacing = '';
          }
          if (score) {
            score.style.marginTop = '';
            score.style.marginBottom = '';
            score.style.gap = '';
          }
          if (meta) {
            meta.style.marginBottom = '';
            meta.style.gap = '';
          }
          for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
            cell.style.padding = '';
            cell.style.border = '';
            cell.style.backgroundImage = '';
            cell.style.boxShadow = '';
            cell.style.clipPath = '';
          }
          if (retry) retry.style.padding = '';
          if (titleBtn) titleBtn.style.padding = '';
          const panelOverFn = () => {
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
          const appH0 = app.clientHeight || window.innerHeight || 360;
          const needShortFund = () => appH0 <= 340 && rawHeadroom() < 8;
          let over = panelOverFn();
          let steps = 0;
          if (over > 1.5 || needShortFund()) {
            if (deco) deco.style.display = 'none';
            steps = 1; over = panelOverFn();
          }
          if (over > 1.5 || needShortFund()) {
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
            steps = 2; over = panelOverFn();
          }
          if (over > 1.5 || needShortFund()) {
            oc.classList.add('is-result-short');
            if (brand) brand.style.display = 'none';
            if (h2) {
              h2.style.fontSize = '18px';
              h2.style.margin = '0';
              h2.style.letterSpacing = '0.12em';
            }
            steps = 2.5; over = panelOverFn();
          }
          if (over > 1.5) {
            for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '2px 4px';
              cell.style.border = 'none';
              cell.style.backgroundImage = 'none';
              cell.style.boxShadow = 'none';
              cell.style.clipPath = 'none';
            }
            steps = 3; over = panelOverFn();
          }
          if (over > 1.5) {
            oc.style.paddingTop = '18px';
            oc.style.paddingBottom = '12px';
            steps = 4; over = panelOverFn();
          }
          if (over > 1.5) {
            if (retry) retry.style.padding = '8px 20px';
            if (titleBtn) titleBtn.style.padding = '8px 20px';
            steps = 5; over = panelOverFn();
          }
          if (over > 1.5) {
            const appH = app.clientHeight || window.innerHeight || 360;
            oc.style.maxHeight = `${Math.max(260, Math.floor(appH * 0.96))}px`;
            steps = 6; over = panelOverFn();
          }
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const cells = [...oc.querySelectorAll('.result-score .cell, .result-meta .cell')];
          const jsFlat = cells.some((c) => c.style.border === 'none');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            syncSteps: steps,
            syncOver: +over.toFixed(2),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2Fs: h2 ? getComputedStyle(h2).fontSize : '',
            h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            retryOut: retry ? boxOut(retry, appR) : true,
            titleOut: titleBtn ? boxOut(titleBtn, appR) : true,
            jsFlat,
            isResultShort: oc.classList.contains('is-result-short'),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
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
    f.retryOut ||
    f.titleOut ||
    (f.h <= 340 && f.headroom < 6) ||
    (f.h <= 340 && f.jsFlat) ||
    (f.h <= 340 && f.syncSteps >= 3) ||
    (f.h === 360 && f.brandDisplay === 'none') ||
    (f.h >= 450 && f.brandDisplay === 'none'),
);

const out = { muddyCount: muddy.length, muddy, findings };
writeFileSync(join(root, 'tools', 'probe-tick139-result-floor-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      samples: {
        h320: findings.filter((f) => f.h === 320),
        h360: findings.filter((f) => f.h === 360 && ['ko', 'es', 'zh-CN'].includes(f.loc)),
        h450: findings.filter((f) => f.h === 450 && f.loc === 'ko'),
      },
    },
    null,
    2,
  ),
);
