/**
 * Tick139 trial: result extreme-short head reclaim (brand hide + h2 compact)
 * and pause residual pad at ≤320 after CSS brand belt.
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
        await page.goto(`${url}?cb=r139tr-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const measured = await page.evaluate(async ({ loc, boxOutSrc }) => {
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

          const mount = () => {
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            overlay.classList.add('is-on');
            overlay.style.display = 'flex';
            content.className = 'screen-result gameover';
            content.style.cssText = '';
            content.classList.remove('is-result-short');
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
            return content;
          };

          const measure = (content, label) => {
            const app = document.getElementById('app');
            void content.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector(':scope > .brand-mark');
            const h2 = content.querySelector(':scope > h2');
            const retry = document.getElementById('btn-retry');
            const titleBtn = document.getElementById('btn-title');
            const cells = [...content.querySelectorAll('.result-score .cell, .result-meta .cell')];
            const cellFlat = cells.some((c) => getComputedStyle(c).borderStyle === 'none' && c.style.border === 'none');
            return {
              label,
              panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(1),
              brandDisplay: brand ? getComputedStyle(brand).display : 'none',
              brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
              h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
              h2Fs: h2 ? getComputedStyle(h2).fontSize : '',
              retryOut: retry ? boxOut(retry, appR) : true,
              titleOut: titleBtn ? boxOut(titleBtn, appR) : true,
              cellFlat,
              panelH: +ocR.height.toFixed(1),
            };
          };

          const runLadder = (content, { headReclaim }) => {
            const app = document.getElementById('app');
            const deco = content.querySelector('.result-deco');
            const score = content.querySelector('.result-score');
            const meta = content.querySelector('.result-meta');
            const brand = content.querySelector(':scope > .brand-mark');
            const h2 = content.querySelector(':scope > h2');
            const retry = content.querySelector('#btn-retry');
            const titleBtn = content.querySelector('#btn-title');
            content.style.maxHeight = '';
            content.style.paddingTop = '';
            content.style.paddingBottom = '';
            content.classList.remove('is-result-short');
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
            for (const cell of content.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '';
              cell.style.border = '';
              cell.style.backgroundImage = '';
              cell.style.boxShadow = '';
              cell.style.clipPath = '';
            }
            if (retry) retry.style.padding = '';
            if (titleBtn) titleBtn.style.padding = '';

            const panelOver = () => {
              void content.offsetHeight;
              const appR = app.getBoundingClientRect();
              const ocR = content.getBoundingClientRect();
              return Math.max(
                0,
                ocR.bottom - (appR.bottom + 1),
                (appR.top - 1) - ocR.top,
              );
            };
            let over = panelOver();
            let steps = 0;
            if (over <= 1.5) return { steps, over };
            if (deco) deco.style.display = 'none';
            steps = 1; over = panelOver();
            if (over <= 1.5) return { steps, over };
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
            steps = 2; over = panelOver();
            if (over <= 1.5) return { steps, over };

            if (headReclaim) {
              content.classList.add('is-result-short');
              if (brand) brand.style.display = 'none';
              if (h2) {
                h2.style.fontSize = '18px';
                h2.style.margin = '0';
                h2.style.letterSpacing = '0.12em';
              }
              steps = 2.5; over = panelOver();
              if (over <= 1.5) return { steps, over };
            }

            for (const cell of content.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '2px 4px';
              cell.style.border = 'none';
              cell.style.backgroundImage = 'none';
              cell.style.boxShadow = 'none';
              cell.style.clipPath = 'none';
            }
            steps = 3; over = panelOver();
            if (over <= 1.5) return { steps, over };
            content.style.paddingTop = '18px';
            content.style.paddingBottom = '12px';
            steps = 4; over = panelOver();
            if (over <= 1.5) return { steps, over };
            if (retry) retry.style.padding = '8px 20px';
            if (titleBtn) titleBtn.style.padding = '8px 20px';
            steps = 5; over = panelOver();
            if (over <= 1.5) return { steps, over };
            const appH = app.clientHeight || window.innerHeight || 360;
            content.style.maxHeight = `${Math.max(260, Math.floor(appH * 0.96))}px`;
            return { steps: 6, over: panelOver() };
          };

          // Baseline current ladder
          let content = mount();
          let sync = runLadder(content, { headReclaim: false });
          const before = { ...measure(content, 'before'), syncSteps: sync.steps, syncOver: +sync.over.toFixed(2) };

          // Trial with head reclaim
          content = mount();
          // Simulate CSS ≤400 belt
          const brandEl = content.querySelector(':scope > .brand-mark');
          const h2El = content.querySelector(':scope > h2');
          const cssBelt = window.innerHeight <= 400;
          if (cssBelt) {
            if (brandEl) brandEl.style.display = 'none';
            if (h2El) {
              h2El.style.fontSize = '18px';
              h2El.style.margin = '0';
              h2El.style.letterSpacing = '0.12em';
            }
          }
          sync = runLadder(content, { headReclaim: true });
          const after = { ...measure(content, 'after'), syncSteps: sync.steps, syncOver: +sync.over.toFixed(2), cssBelt };

          return { before, after };
        }, { loc, boxOutSrc: boxOut.toString() });

        rows.push({ loc, w: size.width, h: size.height, ...measured });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const improved = rows.filter((r) => {
  const b = r.before;
  const a = r.after;
  return (
    (b.syncSteps >= 3 && a.syncSteps < b.syncSteps) ||
    (b.headroom < 4 && a.headroom > b.headroom + 2) ||
    (b.cellFlat && !a.cellFlat) ||
    (b.panelOver > 0 && a.panelOver <= 0)
  );
});

const stillTight = rows.filter((r) => r.after.headroom < 4 || r.after.panelOver > 1.5 || r.after.retryOut);

const out = { improvedCount: improved.length, stillTightCount: stillTight.length, improved, stillTight, rows };
writeFileSync(join(root, 'tools', 'probe-tick139-result-trial-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      improvedCount: out.improvedCount,
      stillTightCount: out.stillTightCount,
      improved: improved.map((r) => ({
        loc: r.loc,
        wh: `${r.w}x${r.h}`,
        before: {
          steps: r.before.syncSteps,
          hr: r.before.headroom,
          over: r.before.panelOver,
          brand: r.before.brandDisplay,
          cellFlat: r.before.cellFlat,
        },
        after: {
          steps: r.after.syncSteps,
          hr: r.after.headroom,
          over: r.after.panelOver,
          brand: r.after.brandDisplay,
          h2Fs: r.after.h2Fs,
          cellFlat: r.after.cellFlat,
        },
      })),
      samples320: rows
        .filter((r) => r.h === 320)
        .map((r) => ({
          loc: r.loc,
          before: { steps: r.before.syncSteps, hr: r.before.headroom, brand: r.before.brandDisplay, cellFlat: r.before.cellFlat },
          after: { steps: r.after.syncSteps, hr: r.after.headroom, brand: r.after.brandDisplay, h2Fs: r.after.h2Fs, cellFlat: r.after.cellFlat },
        })),
      samples360: rows
        .filter((r) => r.h === 360 && (r.loc === 'ko' || r.loc === 'es' || r.loc === 'zh-CN'))
        .map((r) => ({
          loc: r.loc,
          before: { steps: r.before.syncSteps, hr: r.before.headroom, brand: r.before.brandDisplay },
          after: { steps: r.after.syncSteps, hr: r.after.headroom, brand: r.after.brandDisplay, h2Fs: r.after.h2Fs },
        })),
      samples450: rows
        .filter((r) => r.h === 450 && r.loc === 'ko')
        .map((r) => ({
          loc: r.loc,
          before: { steps: r.before.syncSteps, hr: r.before.headroom, brand: r.before.brandDisplay },
          after: { steps: r.after.syncSteps, hr: r.after.headroom, brand: r.after.brandDisplay },
        })),
      stillTight,
    },
    null,
    2,
  ),
);
