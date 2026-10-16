/**
 * Tick152 — letterbox residual scan outside exhausted tip/rim/HUD lists.
 * Focus: asset-error / loading (post-151) / rotate-card at ultra-narrow
 * short-landscape where #app letterboxes vs body.touch-ui 92vh.
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

const SIZES = [
  { width: 320, height: 180 },
  { width: 320, height: 200 },
  { width: 320, height: 210 },
  { width: 320, height: 240 },
  { width: 320, height: 280 },
  { width: 342, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 568, height: 320 },
];

const ASSET_H2 = [
  ['en', 'Stage 1 load failed'],
  ['pt', 'Falha ao carregar o estágio 1'],
  ['es', 'Fallo al cargar la etapa 1'],
  ['ru', 'Не удалось загрузить стадию 1'],
  ['ja', 'ステージ 1 読み込み失敗'],
  ['ko', '스테이지 1 로드 실패'],
  ['zh-TW', '關卡 1 載入失敗'],
];

const ASSET_MSG = 'ASSET LOAD FAILED: stage01/boss_core.png';
const RETRY = { en: 'Retry', pt: 'Tentar de novo', es: 'Reintentar', ru: 'Повторить', ja: '再試行', ko: '다시 시도', 'zh-TW': '重試' };
const SELECT = {
  en: 'To select',
  pt: 'À seleção',
  es: 'A selección',
  ru: 'К выбору',
  ja: '選択へ',
  ko: '선택으로',
  'zh-TW': '回選擇',
};

const LOAD_LABELS = [
  ['en', 'Loading all assets (eager)…'],
  ['pt', 'Carregando todos os recursos (eager)…'],
  ['es', 'Cargando todos los recursos (eager)…'],
  ['ru', 'Загрузка всех ресурсов (eager)…'],
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = { asset: [], load: [], rotate: [] };

try {
  // --- asset-error ---
  for (const size of SIZES) {
    for (const [loc, h2] of ASSET_H2) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t152ae-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate(
          ({ h2, msg, retry, select }) => {
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
              <div class="asset-error-msg"><p>${msg}</p></div>
              <span class="asset-error-deco" aria-hidden="true"></span>
              <button class="btn btn-primary" id="btn-asset-retry">${retry}</button>
              <button class="btn" id="btn-asset-select">${select}</button>
            `;
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const icon = content.querySelector('.asset-error-icon');
            const deco = content.querySelector('.asset-error-deco');
            const h2el = content.querySelector('h2');
            const msgEl = content.querySelector('.asset-error-msg');
            const retryBtn = document.getElementById('btn-asset-retry');
            const selectBtn = document.getElementById('btn-asset-select');
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const vis = (el) => {
              if (!el) return 0;
              const r = el.getBoundingClientRect();
              return Math.max(0, Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) - Math.max(r.top, Math.max(ocR.top, appR.top)));
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
              iconDisp: icon ? getComputedStyle(icon).display : 'none',
              decoDisp: deco ? getComputedStyle(deco).display : 'none',
              h2H: h2el ? +h2el.getBoundingClientRect().height.toFixed(2) : 0,
              msgH: msgEl ? +msgEl.getBoundingClientRect().height.toFixed(2) : 0,
              retryVis: +vis(retryBtn).toFixed(2),
              selectVis: +vis(selectBtn).toFixed(2),
              retryOut: out(retryBtn),
              selectOut: out(selectBtn),
              h2Vis: +vis(h2el).toFixed(2),
              msgVis: +vis(msgEl).toFixed(2),
            };
          },
          { h2, msg: ASSET_MSG, retry: RETRY[loc], select: SELECT[loc] },
        );
        const bad =
          m.panelOver > 1.5 ||
          m.retryOut ||
          m.selectOut ||
          m.retryVis < 20 ||
          m.selectVis < 20 ||
          (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
          (m.msgH > 0 && m.msgVis < m.msgH - 2);
        if (bad) hard.asset.push({ loc, ...size, ...m });
        if (bad || size.width <= 360 || size.height <= 240 || size.width === 568) {
          console.log(
            `${bad ? 'HARD' : 'ok'} AE ${loc}@${size.width}x${size.height}`,
            `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
            `maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH}`,
            `icon=${m.iconDisp} deco=${m.decoDisp}`,
            `h2=${m.h2Vis}/${m.h2H} msg=${m.msgVis}/${m.msgH}`,
            `retryOut=${m.retryOut} selOut=${m.selectOut} rVis=${m.retryVis} sVis=${m.selectVis}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }

  // --- loading residual (post-151) — 2-line wrap check ---
  for (const size of [
    { width: 320, height: 180 },
    { width: 320, height: 200 },
    { width: 320, height: 240 },
    { width: 342, height: 200 },
    { width: 360, height: 200 },
  ]) {
    for (const [loc, text] of LOAD_LABELS) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t152ld-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate((text) => {
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('show');
          overlay.classList.remove('hidden');
          overlay.style.display = 'flex';
          content.className = 'screen-loading';
          content.style.cssText = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">LAO MINI ACTION</span>
            <h2>LOADING</h2>
            <span class="loading-deco" aria-hidden="true"></span>
            <p id="loading-label">${text}</p>
            <div class="load-track" aria-hidden="true">
              <div class="load-fill" id="load-fill" style="width:55%"></div>
            </div>
            <div class="load-meta">
              <span id="load-count">12 / 22</span>
              <span id="load-pct">55%</span>
            </div>
          `;
          void content.offsetHeight;
          const appR = document.getElementById('app').getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const lab = document.getElementById('loading-label');
          const track = content.querySelector('.load-track');
          const meta = content.querySelector('.load-meta');
          const brand = content.querySelector('.brand-mark');
          const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
          const vis = (el) => {
            if (!el) return 0;
            const r = el.getBoundingClientRect();
            return Math.max(0, Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) - Math.max(r.top, Math.max(ocR.top, appR.top)));
          };
          return {
            panelOver: +panelOver.toFixed(2),
            headroom: +(appR.bottom - ocR.bottom).toFixed(2),
            ocH: +ocR.height.toFixed(2),
            appH: +appR.height.toFixed(2),
            labH: +lab.getBoundingClientRect().height.toFixed(2),
            labVis: +vis(lab).toFixed(2),
            trackVis: +vis(track).toFixed(2),
            trackH: +track.getBoundingClientRect().height.toFixed(2),
            metaVis: +vis(meta).toFixed(2),
            metaH: +meta.getBoundingClientRect().height.toFixed(2),
            brandDisp: getComputedStyle(brand).display,
            maxH: getComputedStyle(content).maxHeight,
            labelLines: Math.round(lab.getBoundingClientRect().height / parseFloat(getComputedStyle(lab).lineHeight || '16')),
          };
        }, text);
        const bad =
          m.panelOver > 1.5 ||
          m.labVis < m.labH - 1.5 ||
          m.trackVis < m.trackH - 1.5 ||
          m.metaVis < m.metaH - 1.5;
        if (bad) hard.load.push({ loc, ...size, ...m });
        console.log(
          `${bad ? 'HARD' : 'ok'} LD ${loc}@${size.width}x${size.height}`,
          `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
          `lab=${m.labVis}/${m.labH} lines≈${m.labelLines}`,
          `track=${m.trackVis}/${m.trackH} meta=${m.metaVis}/${m.metaH}`,
          `brand=${m.brandDisp} maxH=${m.maxH}`,
        );
      } finally {
        await page.close();
      }
    }
  }

  // --- rotate-card portrait narrow ---
  for (const size of [
    { width: 280, height: 560 },
    { width: 320, height: 568 },
    { width: 360, height: 640 },
  ]) {
    for (const [loc, body] of [
      ['en', 'Please rotate your device to landscape to play.'],
      ['ru', 'Пожалуйста, поверните устройство в альбомную ориентацию.'],
      ['pt', 'Gire o dispositivo para a horizontal para jogar.'],
    ]) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t152rt-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate((body) => {
          const hint = document.querySelector('.rotate-hint') || (() => {
            const el = document.createElement('div');
            el.className = 'rotate-hint is-on';
            el.innerHTML = `<div class="rotate-card"><span class="rotate-icon">↻</span><strong>ROTATE</strong><p>${body}</p></div>`;
            document.body.appendChild(el);
            return el;
          })();
          hint.classList.add('is-on');
          const card = hint.querySelector('.rotate-card');
          const strong = card.querySelector('strong');
          const p = card.querySelector('p');
          const icon = card.querySelector('.rotate-icon');
          const vr = { top: 0, left: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
          const cr = card.getBoundingClientRect();
          const over = Math.max(0, cr.bottom - vr.bottom, vr.top - cr.top, cr.right - vr.right, vr.left - cr.left);
          const vis = (el) => {
            if (!el) return 0;
            const r = el.getBoundingClientRect();
            return Math.max(0, Math.min(r.bottom, vr.bottom) - Math.max(r.top, vr.top));
          };
          return {
            over: +over.toFixed(2),
            cardH: +cr.height.toFixed(2),
            cardW: +cr.width.toFixed(2),
            vw: innerWidth,
            vh: innerHeight,
            strongVis: +vis(strong).toFixed(2),
            pVis: +vis(p).toFixed(2),
            iconDisp: icon ? getComputedStyle(icon).display : 'none',
            pH: p ? +p.getBoundingClientRect().height.toFixed(2) : 0,
          };
        }, body);
        const bad = m.over > 1.5 || m.strongVis < 10 || m.pVis < m.pH - 2;
        if (bad) hard.rotate.push({ loc, ...size, ...m });
        console.log(
          `${bad ? 'HARD' : 'ok'} RT ${loc}@${size.width}x${size.height}`,
          `over=${m.over} card=${m.cardW}x${m.cardH} vw=${m.vw}x${m.vh}`,
          `strongVis=${m.strongVis} pVis=${m.pVis}/${m.pH} icon=${m.iconDisp}`,
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

console.log('\n=== HARD asset-error ===', hard.asset.length);
for (const r of hard.asset) {
  console.log(
    `${r.loc}@${r.width}x${r.height} over=${r.panelOver} hr=${r.headroom}`,
    `ocH=${r.ocH}/${r.appH} brand=${r.brandDisp}:${r.brandH}`,
    `retryOut=${r.retryOut} selOut=${r.selectOut}`,
  );
}
console.log('=== HARD loading ===', hard.load.length);
for (const r of hard.load) {
  console.log(`${r.loc}@${r.width}x${r.height} over=${r.panelOver} lab=${r.labVis}/${r.labH}`);
}
console.log('=== HARD rotate ===', hard.rotate.length);
for (const r of hard.rotate) {
  console.log(`${r.loc}@${r.width}x${r.height} over=${r.over}`);
}
