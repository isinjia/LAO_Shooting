/**
 * Tick156 — asset-error @≥400 short letterbox CTA reclaim mode matrix.
 * Tick155 stopped at max-width:399; @400×200 keeps brand + 92vh → CTA OOB.
 * Find mildest recipe that clears HARD without invent / without stealing @400×240 brand.
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
  { width: 399, height: 200 }, // tick155 kept
  { width: 400, height: 200 },
  { width: 400, height: 220 },
  { width: 400, height: 240 }, // must KEEP brand if height gate ≤220
  { width: 400, height: 280 }, // soft keep
  { width: 420, height: 200 },
  { width: 420, height: 220 },
  { width: 480, height: 200 },
  { width: 568, height: 200 },
  { width: 568, height: 220 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const mode of MODES) {
    console.log(`\n=== MODE ${mode} ===`);
    for (const size of FOCUS) {
      for (const locEntry of LOCALES) {
        const [loc, h2, retry, select] = locEntry;
        // full matrix for ja; long locales at HARD sizes; en sanity at 400×200/240
        const key =
          loc === 'ja' ||
          (['pt', 'es', 'ru'].includes(loc) &&
            ((size.width === 400 && size.height <= 220) ||
              (size.width >= 420 && size.height === 200))) ||
          (loc === 'en' && size.width === 400 && [200, 240].includes(size.height));
        if (!key) continue;

        const page = await browser.newPage({ viewport: size });
        try {
          await page.goto(`${url}?cb=t156m-${mode}-${loc}-${size.width}x${size.height}`, {
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
              const w = window.innerWidth;
              const h = window.innerHeight;
              // Propose: min-width 400, max-height 220, landscape — leave ≤399 to tick155
              const inPropose =
                h <= 220 && w >= 400 && matchMedia('(orientation: landscape)').matches;
              if (inPropose) {
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
                applied: inPropose,
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
          const isSoft = !isHard && m.panelOver > 1.5;
          console.log(
            `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${loc}@${size.width}x${size.height}`,
            `applied=${m.applied}`,
            `over=${m.panelOver} brand=${m.brandDisp}:${m.brandH}`,
            `h2=${m.h2Vis}/${m.h2H} msg=${m.msgVis}/${m.msgH}`,
            `rVis=${m.retryVis}/${m.rH} sVis=${m.selectVis}/${m.sH}`,
            `rOut=${m.retryOut} sOut=${m.selectOut}`,
          );
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
