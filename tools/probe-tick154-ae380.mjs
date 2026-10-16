/**
 * Tick154 — asset-error @380×240 CTA OOB live measure + reclaim modes.
 * Prefer mild maxH:100% + brand/h2/row CTA reclaim gated ≤380; leave @400.
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

const SIZES = [
  { width: 360, height: 240 }, // tick152 kept
  { width: 380, height: 200 },
  { width: 380, height: 220 },
  { width: 380, height: 240 },
  { width: 380, height: 260 },
  { width: 400, height: 240 },
  { width: 400, height: 260 },
  { width: 400, height: 280 },
];

const MODES = [
  'baseline',
  'maxH100',
  'maxH100+brand',
  'maxH100+brand+h2',
  'maxH100+brand+row',
  'maxH100+brand+h2+row',
  'maxH100+brand+h2+row+compact',
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  // Focus: ja@380×240 modes first, then all-locale baseline + winning mode
  for (const mode of MODES) {
    console.log(`\n=== MODE ${mode} (ja focus) ===`);
    for (const size of [
      { width: 380, height: 240 },
      { width: 380, height: 220 },
      { width: 380, height: 200 },
      { width: 400, height: 240 },
      { width: 400, height: 280 },
      { width: 360, height: 240 },
    ]) {
      const page = await browser.newPage({ viewport: size });
      try {
        const [loc, h2, retry, select] = LOCALES.find((l) => l[0] === 'ja');
        await page.goto(`${url}?cb=t154-${mode}-${size.width}x${size.height}`, {
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
            if (mode.includes('row')) {
              content.style.display = 'flex';
              content.style.flexWrap = 'wrap';
              content.style.justifyContent = 'center';
              content.style.alignItems = 'center';
              content.style.alignContent = 'center';
              content.style.gap = '6px';
              content.style.boxSizing = 'border-box';
              for (const el of content.querySelectorAll(':scope > :not(.btn)')) {
                el.style.flex = '1 0 100%';
              }
              for (const btn of content.querySelectorAll(':scope > .btn')) {
                btn.style.flex = '0 1 auto';
                btn.style.minHeight = '36px';
                btn.style.padding = '8px 12px';
                btn.style.margin = '0';
              }
            }
            if (mode.includes('compact')) {
              content.style.paddingTop = '10px';
              content.style.paddingBottom = '10px';
              const msgEl = content.querySelector('.asset-error-msg');
              if (msgEl) {
                msgEl.style.marginBottom = '4px';
                msgEl.style.padding = '4px 8px';
              }
            }
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const h2el = content.querySelector('h2');
            const msgEl = content.querySelector('.asset-error-msg');
            const retryBtn = document.getElementById('btn-asset-retry');
            const selectBtn = document.getElementById('btn-asset-select');
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const vis = (el) => {
              if (!el) return 0;
              const r = el.getBoundingClientRect();
              return Math.max(
                0,
                Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
                  Math.max(r.top, Math.max(ocR.top, appR.top)),
              );
            };
            const out = (el) => {
              if (!el) return true;
              const r = el.getBoundingClientRect();
              return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
            };
            return {
              panelOver: +panelOver.toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              ocH: +ocR.height.toFixed(2),
              appH: +appR.height.toFixed(2),
              maxH: getComputedStyle(content).maxHeight,
              brandDisp: brand ? getComputedStyle(brand).display : 'none',
              brandH: brand ? +brand.getBoundingClientRect().height.toFixed(2) : 0,
              h2H: h2el ? +h2el.getBoundingClientRect().height.toFixed(2) : 0,
              h2Vis: +vis(h2el).toFixed(2),
              msgH: msgEl ? +msgEl.getBoundingClientRect().height.toFixed(2) : 0,
              msgVis: +vis(msgEl).toFixed(2),
              retryVis: +vis(retryBtn).toFixed(2),
              selectVis: +vis(selectBtn).toFixed(2),
              retryOut: out(retryBtn),
              selectOut: out(selectBtn),
              rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
              sH: +selectBtn.getBoundingClientRect().height.toFixed(2),
              btnRow:
                retryBtn && selectBtn
                  ? Math.abs(
                      retryBtn.getBoundingClientRect().top - selectBtn.getBoundingClientRect().top,
                    ) < 4
                  : false,
            };
          },
          { h2, retry, select, mode },
        );
        const bad =
          m.panelOver > 1.5 ||
          m.retryOut ||
          m.selectOut ||
          m.retryVis < 20 ||
          m.selectVis < 20 ||
          (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
          (m.msgH > 0 && m.msgVis < m.msgH - 2);
        console.log(
          `${bad ? 'HARD' : m.panelOver > 0 ? 'SOFT' : 'ok'} ${loc}@${size.width}x${size.height}`,
          `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
          `maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH}`,
          `h2=${m.h2Vis}/${m.h2H} msg=${m.msgVis}/${m.msgH}`,
          `retryOut=${m.retryOut} selOut=${m.selectOut} rVis=${m.retryVis}/${m.rH} sVis=${m.selectVis}/${m.sH}`,
          `btnRow=${m.btnRow}`,
        );
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== ALL-LOCALE baseline @380×240 + @400×280 ===');
  for (const size of [
    { width: 380, height: 240 },
    { width: 400, height: 280 },
  ]) {
    for (const [loc, h2, retry, select] of LOCALES) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t154base-${loc}-${size.width}x${size.height}`, {
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
              return Math.max(0, Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top));
            };
            const out = (el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
            };
            return {
              panelOver: +panelOver.toFixed(2),
              brandDisp: getComputedStyle(brand).display,
              h2H: +h2el.getBoundingClientRect().height.toFixed(2),
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
          `retryOut=${m.retryOut} selOut=${m.selectOut} rVis=${m.rVis}/${m.rH} sVis=${m.sVis}/${m.sH}`,
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
