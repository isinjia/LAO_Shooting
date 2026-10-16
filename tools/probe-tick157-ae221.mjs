/**
 * Tick157 detail — AE short-wide cliff @≥400 × 221–227 (brand-kept band).
 * Mode matrix for reclaim: maxH / brand / h2 (same mild recipe as tick156).
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
];

const HEIGHTS = [220, 221, 222, 223, 224, 225, 226, 227, 228, 240];
const WIDTHS = [400, 420, 568];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

async function measure(page, h2, retry, select, mode) {
  return page.evaluate(
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
      // Inline mode overrides to simulate reclaim recipes without editing CSS
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
        brandDisp: getComputedStyle(brand).display,
        brandH: +brand.getBoundingClientRect().height.toFixed(2),
        h2H: +h2el.getBoundingClientRect().height.toFixed(2),
        h2Vis: +vis(h2el).toFixed(2),
        msgH: +msgEl.getBoundingClientRect().height.toFixed(2),
        msgVis: +vis(msgEl).toFixed(2),
        retryOut: out(retryBtn),
        selectOut: out(selectBtn),
        rVis: +vis(retryBtn).toFixed(2),
        rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
        sVis: +vis(selectBtn).toFixed(2),
        sH: +selectBtn.getBoundingClientRect().height.toFixed(2),
        appH: +appR.height.toFixed(2),
      };
    },
    { h2, retry, select, mode },
  );
}

function isHard(m) {
  return (
    m.retryOut ||
    m.selectOut ||
    m.rVis < Math.min(20, m.rH - 2) ||
    m.sVis < Math.min(20, m.sH - 2) ||
    (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
    (m.msgH > 0 && m.msgVis < m.msgH - 2)
  );
}

try {
  console.log('\n=== BASELINE cliff map (live CSS) ===');
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      for (const [loc, h2, retry, select] of LOCALES) {
        if (loc !== 'pt' && loc !== 'ja' && !(loc === 'en' && h === 221)) continue;
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        try {
          await page.goto(`${url}?cb=t157b-${loc}-${w}x${h}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });
          const m = await measure(page, h2, retry, select, '');
          const hard = isHard(m);
          console.log(
            `${hard ? 'HARD' : 'ok'} BASE ${loc}@${w}x${h}`,
            `appH=${m.appH} brand=${m.brandDisp}:${m.brandH}`,
            `h2=${m.h2Vis}/${m.h2H} rVis=${m.rVis}/${m.rH} out=${m.retryOut}`,
          );
        } finally {
          await page.close();
        }
      }
    }
  }

  console.log('\n=== MODE MATRIX @400×221–223 long locales (maxH alone) ===');
  for (const h of [221, 222, 223]) {
    for (const [loc, h2, retry, select] of LOCALES) {
      if (!['pt', 'es', 'ru', 'ja', 'en'].includes(loc)) continue;
      const page = await browser.newPage({ viewport: { width: 400, height: h } });
      try {
        await page.goto(`${url}?cb=t157m-${loc}-${h}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await measure(page, h2, retry, select, 'maxH');
        const hard = isHard(m);
        console.log(
          `${hard ? 'HARD' : 'ok'} maxH ${loc}@400x${h}`,
          `brand=${m.brandDisp}:${m.brandH} h2=${m.h2Vis}/${m.h2H}`,
          `rVis=${m.rVis}/${m.rH} out=${m.retryOut} msg=${m.msgVis}/${m.msgH}`,
        );
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== MODE MATRIX @400×221 pt (full recipes) ===');
  const modes = ['maxH', 'maxH+brand', 'maxH+brand+h2', 'brand+h2'];
  for (const mode of modes) {
    const page = await browser.newPage({ viewport: { width: 400, height: 221 } });
    try {
      await page.goto(`${url}?cb=t157m-${mode}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const [, h2, retry, select] = LOCALES.find(([l]) => l === 'pt');
      const m = await measure(page, h2, retry, select, mode);
      const hard = isHard(m);
      console.log(
        `${hard ? 'HARD' : 'ok'} MODE ${mode}`,
        `brand=${m.brandDisp}:${m.brandH} h2=${m.h2Vis}/${m.h2H}`,
        `rVis=${m.rVis}/${m.rH} out=${m.retryOut} msg=${m.msgVis}/${m.msgH}`,
      );
    } finally {
      await page.close();
    }
  }

  console.log('\n=== BRAND KEEP @400×240 under raised gate sim (maxH+brand+h2 only if h≤227) ===');
  // Just report live brand at 240 — must stay brand-kept with real CSS (gate 221/227)
  const page = await browser.newPage({ viewport: { width: 400, height: 240 } });
  try {
    await page.goto(`${url}?cb=t157keep240`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#btn-start', { timeout: 60000 });
    const [, h2, retry, select] = LOCALES.find(([l]) => l === 'pt');
    const m = await measure(page, h2, retry, select, '');
    console.log(
      `${isHard(m) ? 'HARD' : 'ok'} KEEP pt@400x240`,
      `brand=${m.brandDisp}:${m.brandH} rVis=${m.rVis}/${m.rH} out=${m.retryOut}`,
    );
  } finally {
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
