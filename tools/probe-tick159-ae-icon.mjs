/**
 * Tick159 — AE real-markup (lobby-ico-back) mode matrix @≥400×220–240.
 * Prior tick157 probe omitted select icon → understated sH / stack.
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
  { width: 400, height: 220 },
  { width: 400, height: 221 },
  { width: 400, height: 223 },
  { width: 400, height: 224 },
  { width: 400, height: 230 },
  { width: 400, height: 235 },
  { width: 400, height: 240 },
  { width: 568, height: 221 },
  { width: 568, height: 224 },
  { width: 568, height: 240 },
];

const MODES = ['live', 'maxH', 'maxH+h2', 'maxH+brand', 'maxH+brand+h2', 'maxH+row', 'maxH+brand+h2+row'];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hardBy = {};

try {
  for (const size of SIZES) {
    for (const [loc, h2, retry, select] of LOCALES) {
      if (!['pt', 'ru', 'es', 'ja', 'en'].includes(loc)) continue;
      // sample density
      if (size.width > 400 && !['pt', 'ru', 'ja'].includes(loc)) continue;

      for (const mode of MODES) {
        const page = await browser.newPage({ viewport: size });
        try {
          await page.goto(`${url}?cb=t159m-${loc}-${size.width}x${size.height}-${mode}`, {
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
                <button class="btn" id="btn-asset-select"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${select}</button>
              `;
              if (mode.includes('maxH')) content.style.maxHeight = '100%';
              const brand = content.querySelector('.brand-mark');
              const h2el = content.querySelector('h2');
              if (mode.includes('brand')) brand.style.display = 'none';
              if (mode.includes('h2')) {
                h2el.style.fontSize = '14px';
                h2el.style.letterSpacing = '0.06em';
                h2el.style.margin = '0 0 2px';
                h2el.style.lineHeight = '1.25';
              }
              if (mode.includes('row')) {
                content.style.display = 'flex';
                content.style.flexWrap = 'wrap';
                content.style.justifyContent = 'center';
                content.style.alignItems = 'center';
                content.style.alignContent = 'center';
                content.style.gap = '6px';
                content.style.boxSizing = 'border-box';
                content.style.paddingTop = '10px';
                content.style.paddingBottom = '10px';
                for (const el of content.children) {
                  if (!el.classList.contains('btn')) {
                    el.style.flex = '1 0 100%';
                  } else {
                    el.style.flex = '0 1 auto';
                    el.style.minHeight = '36px';
                    el.style.padding = '8px 12px';
                    el.style.margin = '0';
                  }
                }
              }
              void content.offsetHeight;
              const appR = document.getElementById('app').getBoundingClientRect();
              const ocR = content.getBoundingClientRect();
              const retryBtn = document.getElementById('btn-asset-retry');
              const selectBtn = document.getElementById('btn-asset-select');
              const msgEl = content.querySelector('.asset-error-msg');
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
                ocH: +ocR.height.toFixed(2),
                appH: +appR.height.toFixed(2),
                maxH: getComputedStyle(content).maxHeight,
                brandDisp: getComputedStyle(brand).display,
                brandH: +brand.getBoundingClientRect().height.toFixed(2),
                h2H: +h2el.getBoundingClientRect().height.toFixed(2),
                h2Vis: +vis(h2el).toFixed(2),
                msgH: +msgEl.getBoundingClientRect().height.toFixed(2),
                msgVis: +vis(msgEl).toFixed(2),
                retryVis: +vis(retryBtn).toFixed(2),
                selectVis: +vis(selectBtn).toFixed(2),
                retryOut: out(retryBtn),
                selectOut: out(selectBtn),
                rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
                sH: +selectBtn.getBoundingClientRect().height.toFixed(2),
              };
            },
            { h2, retry, select, mode },
          );
          const isHard =
            m.retryOut ||
            m.selectOut ||
            m.retryVis < Math.min(20, m.rH - 2) ||
            m.selectVis < Math.min(20, m.sH - 2) ||
            (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
            (m.msgH > 0 && m.msgVis < m.msgH - 2);
          const key = `${mode}`;
          if (!hardBy[key]) hardBy[key] = [];
          if (isHard) hardBy[key].push(`${loc}@${size.width}x${size.height}`);
          if (isHard || mode === 'live' || mode === 'maxH' || mode === 'maxH+h2' || mode === 'maxH+brand+h2') {
            console.log(
              `${isHard ? 'HARD' : 'ok'} ${mode} ${loc}@${size.width}x${size.height}`,
              `over=${m.panelOver} ocH=${m.ocH}/${m.appH} maxH=${m.maxH}`,
              `brand=${m.brandDisp}:${m.brandH} h2=${m.h2Vis}/${m.h2H}`,
              `r=${m.retryVis}/${m.rH} s=${m.selectVis}/${m.sH} rOut=${m.retryOut} sOut=${m.selectOut}`,
            );
          }
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

console.log('\n=== HARD BY MODE ===');
for (const mode of MODES) {
  const arr = hardBy[mode] || [];
  console.log(`${mode}: HARD=${arr.length}`, arr.slice(0, 40).join(', '));
}
