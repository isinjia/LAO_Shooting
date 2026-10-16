/**
 * Tick133: result panel vs #app after syncResultPanelBudget on short landscapes.
 * Expect: panelOver≤1.5, CTA clear, deco none @≤480, strings kept.
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
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
  { width: 854, height: 480 },
  { width: 960, height: 540 },
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
        await page.goto(`${url}?cb=r133-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const snap = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
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
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
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
          // Mirror endScreen: apply the same reclaim ladder as syncResultPanelBudget.
          const runSync = () => {
            const oc = content;
            if (!oc?.classList.contains('screen-result')) return;
            const deco = oc.querySelector('.result-deco');
            const score = oc.querySelector('.result-score');
            const meta = oc.querySelector('.result-meta');
            const brand = oc.querySelector(':scope > .brand-mark');
            const h2 = oc.querySelector(':scope > h2');
            const retryEl = oc.querySelector('#btn-retry');
            const titleEl = oc.querySelector('#btn-title');
            if (!app || !score || !meta || !retryEl) return;
            oc.style.maxHeight = '';
            oc.style.paddingTop = '';
            oc.style.paddingBottom = '';
            if (deco) deco.style.display = '';
            if (brand) brand.style.marginBottom = '';
            if (h2) h2.style.marginBottom = '';
            score.style.marginTop = '';
            score.style.marginBottom = '';
            score.style.gap = '';
            meta.style.marginBottom = '';
            meta.style.gap = '';
            for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '';
              cell.style.border = '';
              cell.style.backgroundImage = '';
              cell.style.boxShadow = '';
              cell.style.clipPath = '';
            }
            retryEl.style.padding = '';
            if (titleEl) titleEl.style.padding = '';
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
            if (brand) brand.style.marginBottom = '6px';
            if (h2) h2.style.marginBottom = '6px';
            score.style.marginTop = '4px';
            score.style.marginBottom = '8px';
            score.style.gap = '12px';
            meta.style.marginBottom = '8px';
            meta.style.gap = '6px 12px';
            over = panelOver();
            if (over <= 1.5) return;
            for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '2px 4px';
              cell.style.border = 'none';
              cell.style.backgroundImage = 'none';
              cell.style.boxShadow = 'none';
              cell.style.clipPath = 'none';
            }
            over = panelOver();
            if (over <= 1.5) return;
            oc.style.paddingTop = '18px';
            oc.style.paddingBottom = '12px';
            over = panelOver();
            if (over <= 1.5) return;
            retryEl.style.padding = '8px 20px';
            if (titleEl) titleEl.style.padding = '8px 20px';
            over = panelOver();
            if (over <= 1.5) return;
            const appH = app.clientHeight || window.innerHeight || 360;
            oc.style.maxHeight = `${Math.max(260, Math.floor(appH * 0.96))}px`;
          };
          runSync();
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const retry = document.getElementById('btn-retry');
          const titleBtn = document.getElementById('btn-title');
          const deco = document.querySelector('.result-deco');
          return {
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            retryOut: boxOut(retry, appR),
            titleOut: boxOut(titleBtn, appR),
            retryOcOut: boxOut(retry, ocR),
            titleOcOut: boxOut(titleBtn, ocR),
            retryOver: retry ? +(retry.getBoundingClientRect().bottom - appR.bottom).toFixed(2) : 0,
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            scoreMB: getComputedStyle(content.querySelector('.result-score')).marginBottom,
            maxH: content.style.maxHeight || getComputedStyle(content).maxHeight,
            retryText: (retry?.textContent || '').trim(),
            titleText: (titleBtn?.textContent || '').trim(),
            brandText: (content.querySelector('.brand-mark')?.textContent || '').trim(),
            h2Text: (content.querySelector('h2')?.textContent || '').trim(),
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
    r.retryOut ||
    r.titleOut ||
    r.retryOcOut ||
    r.titleOcOut ||
    !r.retryText ||
    !r.titleText ||
    !r.brandText ||
    !r.h2Text,
);
const out = { muddyCount: muddy.length, muddy, sample360: rows.filter((r) => r.h === 360), all: rows };
writeFileSync(join(root, 'tools/_tick133-result-after.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      sample360: out.sample360,
    },
    null,
    2,
  ),
);
console.log(
  muddy.length === 0
    ? 'PASS probe-tick133-result-panel: no muddy short-viewport result overflow'
    : `FAIL probe-tick133-result-panel: muddyCount=${muddy.length}`,
);
process.exit(muddy.length === 0 ? 0 : 1);
