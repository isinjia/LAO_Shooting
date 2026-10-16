/**
 * Tick155 — asset-error @381–399 CTA reclaim mode matrix.
 * Extend tick154 mild recipe past width gate 380; leave @400 brand.
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

const LOCALES = [
  ['en', 'Stage 1 load failed', 'Retry', 'To select'],
  ['pt', 'Falha ao carregar o estágio 1', 'Tentar de novo', 'À seleção'],
  ['es', 'Fallo al cargar la etapa 1', 'Reintentar', 'A selección'],
  ['ru', 'Не удалось загрузить стадию 1', 'Повторить', 'К выбору'],
  ['ja', 'ステージ 1 読み込み失敗', '再試行', '選択へ'],
  ['ko', '스테이지 1 로드 실패', '다시 시도', '선택으로'],
];

const MODES = ['baseline', 'maxH100', 'maxH100+brand', 'maxH100+brand+h2'];

const FOCUS = [
  { width: 381, height: 200 },
  { width: 381, height: 220 },
  { width: 381, height: 240 },
  { width: 390, height: 200 },
  { width: 399, height: 200 },
  { width: 399, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 380, height: 240 }, // tick154 kept
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const mode of MODES) {
    console.log(`\n=== MODE ${mode} (ja focus) ===`);
    for (const size of FOCUS) {
      const page = await browser.newPage({ viewport: size });
      try {
        const [, h2, retry, select] = LOCALES.find((l) => l[0] === 'ja');
        await page.goto(`${url}?cb=t155m-${mode}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate(
          ({ h2, retry, select, mode }) => {
            document.body.classList.add('touch-ui', 'lao-newui');
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
            // Apply inline reclaim only outside existing CSS gates to simulate extension
            const w = window.innerWidth;
            const h = window.innerHeight;
            const inExisting = h <= 420 && w >= 361 && w <= 380 && matchMedia('(orientation: landscape)').matches;
            const inPropose = h <= 420 && w >= 381 && w <= 399 && matchMedia('(orientation: landscape)').matches;
            if (!inExisting && inPropose) {
              if (mode.includes('maxH100')) content.style.maxHeight = '100%';
              if (mode.includes('brand')) {
                const b = content.querySelector('.brand-mark');
                if (b) b.style.display = 'none';
              }
              if (mode.includes('h2')) {
                const h2el = content.querySelector('h2');
                if (h2el) {
                  h2el.style.fontSize = '14px';
                  h2el.style.letterSpacing = '0.06em';
                  h2el.style.margin = '0 0 2px';
                  h2el.style.lineHeight = '1.25';
                }
              }
            }
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const h2el = content.querySelector('h2');
            const retryBtn = document.getElementById('btn-asset-retry');
            const selectBtn = document.getElementById('btn-asset-select');
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const vis = (el) => {
              const r = el.getBoundingClientRect();
              return Math.max(
                0,
                Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
                  Math.max(r.top, Math.max(ocR.top, appR.top)),
              );
            };
            const out = (el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
            };
            return {
              panelOver: +panelOver.toFixed(2),
              maxH: getComputedStyle(content).maxHeight,
              brandDisp: getComputedStyle(brand).display,
              brandH: +brand.getBoundingClientRect().height.toFixed(2),
              h2H: +h2el.getBoundingClientRect().height.toFixed(2),
              retryOut: out(retryBtn),
              selectOut: out(selectBtn),
              rVis: +vis(retryBtn).toFixed(2),
              sVis: +vis(selectBtn).toFixed(2),
              rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
              sH: +selectBtn.getBoundingClientRect().height.toFixed(2),
            };
          },
          { h2, retry, select, mode },
        );
        const bad =
          m.retryOut || m.selectOut || m.rVis < m.rH - 2 || m.sVis < m.sH - 2 || m.panelOver > 1.5;
        console.log(
          `${bad ? 'HARD' : m.panelOver > 0 ? 'SOFT' : 'ok'} ja@${size.width}x${size.height}`,
          `over=${m.panelOver} maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH} h2=${m.h2H}`,
          `rOut=${m.retryOut} sOut=${m.selectOut} rVis=${m.rVis}/${m.rH} sVis=${m.sVis}/${m.sH}`,
        );
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== ALL-LOCALE proposed maxH100+brand+h2 @381×240 / @399×200 / @400×280 ===');
  for (const size of [
    { width: 381, height: 240 },
    { width: 399, height: 200 },
    { width: 400, height: 280 },
  ]) {
    for (const [loc, h2, retry, select] of LOCALES) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t155all-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate(
          ({ h2, retry, select }) => {
            document.body.classList.add('touch-ui', 'lao-newui');
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
            const w = window.innerWidth;
            const h = window.innerHeight;
            const inPropose =
              h <= 420 && w >= 381 && w <= 399 && matchMedia('(orientation: landscape)').matches;
            if (inPropose) {
              content.style.maxHeight = '100%';
              const b = content.querySelector('.brand-mark');
              if (b) b.style.display = 'none';
              const h2el = content.querySelector('h2');
              if (h2el) {
                h2el.style.fontSize = '14px';
                h2el.style.letterSpacing = '0.06em';
                h2el.style.margin = '0 0 2px';
                h2el.style.lineHeight = '1.25';
              }
            }
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const retryBtn = document.getElementById('btn-asset-retry');
            const selectBtn = document.getElementById('btn-asset-select');
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const vis = (el) => {
              const r = el.getBoundingClientRect();
              return Math.max(0, Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top));
            };
            const out = (el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
            };
            return {
              panelOver: +panelOver.toFixed(2),
              brandDisp: getComputedStyle(brand).display,
              h2H: +content.querySelector('h2').getBoundingClientRect().height.toFixed(2),
              retryOut: out(retryBtn),
              selectOut: out(selectBtn),
              rVis: +vis(retryBtn).toFixed(2),
              sVis: +vis(selectBtn).toFixed(2),
              rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
              sH: +selectBtn.getBoundingClientRect().height.toFixed(2),
            };
          },
          { h2, retry, select },
        );
        const bad = m.retryOut || m.selectOut || m.rVis < m.rH - 2 || m.sVis < m.sH - 2;
        console.log(
          `${bad ? 'HARD' : m.panelOver > 1.5 ? 'SOFT' : 'ok'} ${loc}@${size.width}x${size.height}`,
          `over=${m.panelOver} brand=${m.brandDisp} h2=${m.h2H}`,
          `rOut=${m.retryOut} sOut=${m.selectOut} rVis=${m.rVis}/${m.rH} sVis=${m.sVis}/${m.sH}`,
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
