/**
 * Confirm minimal reclaim: maxH100+brand+row+h2 @≤360; leave @400 alone.
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
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

const CSS_PATCH = `
@media (max-height: 420px) and (max-width: 360px) and (orientation: landscape) {
  body.touch-ui #overlay-content.screen-asset-error,
  .lao-newui #overlay-content.screen-asset-error {
    max-height: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    align-content: center;
    gap: 6px;
    box-sizing: border-box;
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .lao-newui #overlay-content.screen-asset-error > .brand-mark {
    display: none;
  }
  .lao-newui #overlay-content.screen-asset-error > :not(.btn) {
    flex: 1 0 100%;
  }
  .lao-newui #overlay-content.screen-asset-error > h2 {
    font-size: 14px;
    letter-spacing: 0.06em;
    margin: 0 0 2px;
    line-height: 1.25;
  }
  .lao-newui #overlay-content.screen-asset-error .asset-error-msg {
    margin-bottom: 4px;
    padding: 4px 8px;
  }
  .lao-newui #overlay-content.screen-asset-error > .btn {
    flex: 0 1 auto;
    min-height: 36px;
    padding: 8px 12px;
    margin: 0;
  }
}
`;

const LOCALES = [
  ['en', 'Stage 1 load failed', 'Retry', 'To select'],
  ['pt', 'Falha ao carregar o estágio 1', 'Tentar de novo', 'À seleção'],
  ['ru', 'Не удалось загрузить стадию 1', 'Повторить', 'К выбору'],
  ['ja', 'ステージ 1 読み込み失敗', '再試行', '選択へ'],
];

const SIZES = [
  { width: 320, height: 180 },
  { width: 320, height: 200 },
  { width: 320, height: 240 },
  { width: 320, height: 280 },
  { width: 342, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 280 },
  { width: 568, height: 320 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];

try {
  for (const size of SIZES) {
    for (const [loc, h2, retry, select] of LOCALES) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t152min-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.addStyleTag({ content: CSS_PATCH });
        const m = await page.evaluate(
          ({ h2, retry, select }) => {
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            overlay.classList.add('show');
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
            content.className = 'screen-asset-error';
            content.style.cssText = '';
            content.innerHTML = `
              <span class="brand-mark">ASSET ERROR</span>
              <span class="asset-error-icon" aria-hidden="true"></span>
              <h2>${h2}</h2>
              <div class="asset-error-msg"><p>ASSET LOAD FAILED: stage01/boss_core.png</p></div>
              <span class="asset-error-deco" aria-hidden="true"></span>
              <button class="btn btn-primary" id="btn-asset-retry">${retry}</button>
              <button class="btn" id="btn-asset-select">${select}</button>
            `;
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const retryBtn = document.getElementById('btn-asset-retry');
            const selBtn = document.getElementById('btn-asset-select');
            const h2el = content.querySelector('h2');
            const msg = content.querySelector('.asset-error-msg');
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const out = (el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
            };
            const vis = (el) => {
              const r = el.getBoundingClientRect();
              return Math.max(0, Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top));
            };
            return {
              panelOver: +panelOver.toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              ocH: +ocR.height.toFixed(2),
              appH: +appR.height.toFixed(2),
              maxH: getComputedStyle(content).maxHeight,
              brandDisp: getComputedStyle(brand).display,
              h2H: +h2el.getBoundingClientRect().height.toFixed(2),
              msgH: +msg.getBoundingClientRect().height.toFixed(2),
              retryOut: out(retryBtn),
              selOut: out(selBtn),
              rVis: +vis(retryBtn).toFixed(2),
              sVis: +vis(selBtn).toFixed(2),
              rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
              sH: +selBtn.getBoundingClientRect().height.toFixed(2),
            };
          },
          { h2, retry, select },
        );
        const bad =
          m.panelOver > 1.5 ||
          m.retryOut ||
          m.selOut ||
          m.rVis < m.rH - 2 ||
          m.sVis < m.sH - 2;
        if (bad) hard.push({ loc, ...size, ...m });
        console.log(
          `${bad ? 'HARD' : 'ok'} ${loc}@${size.width}x${size.height}`,
          `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
          `maxH=${m.maxH} brand=${m.brandDisp} h2=${m.h2H} msg=${m.msgH}`,
          `rVis=${m.rVis}/${m.rH} sVis=${m.sVis}/${m.sH}`,
        );
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== HARD ===', hard.length);
for (const r of hard) {
  console.log(`${r.loc}@${r.width}x${r.height} over=${r.panelOver} rOut=${r.retryOut} sOut=${r.selOut}`);
}
