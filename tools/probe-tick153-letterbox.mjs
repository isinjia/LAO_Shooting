/**
 * Tick153 — letterbox residual scan after tick151/152.
 * Axes: loading @321–400 (beyond tick151 ≤320), asset-error soft @400,
 * rotate-card extremes, other 92vh overlays without %/fitH reclaim.
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

const LOAD_SIZES = [
  { width: 320, height: 180 },
  { width: 320, height: 200 },
  { width: 321, height: 180 },
  { width: 330, height: 186 },
  { width: 342, height: 180 },
  { width: 342, height: 192 },
  { width: 342, height: 200 },
  { width: 360, height: 180 },
  { width: 360, height: 200 },
  { width: 360, height: 203 },
  { width: 360, height: 220 },
  { width: 380, height: 200 },
  { width: 400, height: 200 },
  { width: 400, height: 225 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
];

const LOAD_LABELS = [
  ['en', 'Loading all assets (eager)…'],
  ['pt', 'Carregando todos os recursos (eager)…'],
  ['es', 'Cargando todos los recursos (eager)…'],
  ['ru', 'Загрузка всех ресурсов (eager)…'],
  ['ja', 'すべてのアセットを読み込み中（eager）…'],
  ['ko', '모든 에셋 로딩 중 (eager)…'],
];

const AE_SIZES = [
  { width: 360, height: 240 },
  { width: 380, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 260 },
  { width: 400, height: 280 },
  { width: 420, height: 280 },
  { width: 568, height: 320 },
];

const ASSET_H2 = [
  ['en', 'Stage 1 load failed'],
  ['pt', 'Falha ao carregar o estágio 1'],
  ['es', 'Fallo al cargar la etapa 1'],
  ['ru', 'Не удалось загрузить стадию 1'],
  ['ja', 'ステージ 1 読み込み失敗'],
  ['ko', '스테이지 1 로드 실패'],
];

const RETRY = { en: 'Retry', pt: 'Tentar de novo', es: 'Reintentar', ru: 'Повторить', ja: '再試行', ko: '다시 시도' };
const SELECT = {
  en: 'To select',
  pt: 'À seleção',
  es: 'A selección',
  ru: 'К выбору',
  ja: '選択へ',
  ko: '선택으로',
};

const ROTATE_SIZES = [
  { width: 240, height: 480 },
  { width: 260, height: 520 },
  { width: 280, height: 400 },
  { width: 280, height: 480 },
  { width: 280, height: 560 },
  { width: 300, height: 500 },
  { width: 320, height: 480 },
  { width: 320, height: 568 },
  { width: 360, height: 480 },
  { width: 360, height: 640 },
];

const ROTATE_BODY = [
  ['en', 'Please rotate your device to landscape to play.'],
  ['ru', 'Пожалуйста, поверните устройство в альбомную ориентацию.'],
  ['pt', 'Gire o dispositivo para a horizontal para jogar.'],
  ['es', 'Gira el dispositivo a horizontal para jugar.'],
  ['ja', 'プレイするには端末を横向きにしてください。'],
  ['ko', '플레이하려면 기기를 가로로 돌려 주세요.'],
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = { load: [], asset: [], rotate: [], generic: [] };

try {
  // --- loading residual beyond tick151 ≤320 ---
  for (const size of LOAD_SIZES) {
    for (const [loc, text] of LOAD_LABELS) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t153ld-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate((text) => {
          document.body.classList.add('touch-ui', 'lao-newui');
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
          const h2 = content.querySelector('h2');
          const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
          const vis = (el) => {
            if (!el) return 0;
            const r = el.getBoundingClientRect();
            return Math.max(0, Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) - Math.max(r.top, Math.max(ocR.top, appR.top)));
          };
          const lh = parseFloat(getComputedStyle(lab).lineHeight) || 16;
          return {
            panelOver: +panelOver.toFixed(2),
            headroom: +(appR.bottom - ocR.bottom).toFixed(2),
            ocH: +ocR.height.toFixed(2),
            appH: +appR.height.toFixed(2),
            appW: +appR.width.toFixed(2),
            labH: +lab.getBoundingClientRect().height.toFixed(2),
            labVis: +vis(lab).toFixed(2),
            trackVis: +vis(track).toFixed(2),
            trackH: +track.getBoundingClientRect().height.toFixed(2),
            metaVis: +vis(meta).toFixed(2),
            metaH: +meta.getBoundingClientRect().height.toFixed(2),
            h2Vis: +vis(h2).toFixed(2),
            h2H: +h2.getBoundingClientRect().height.toFixed(2),
            brandDisp: getComputedStyle(brand).display,
            brandH: +brand.getBoundingClientRect().height.toFixed(2),
            maxH: getComputedStyle(content).maxHeight,
            labelLines: Math.round(lab.getBoundingClientRect().height / lh),
            vh92: +(innerHeight * 0.92).toFixed(2),
          };
        }, text);
        const bad =
          m.panelOver > 1.5 ||
          m.labVis < m.labH - 1.5 ||
          m.trackVis < m.trackH - 1.5 ||
          m.metaVis < m.metaH - 1.5 ||
          (m.h2H > 0 && m.h2Vis < m.h2H - 1.5);
        if (bad) hard.load.push({ loc, ...size, ...m });
        if (bad || size.width <= 360 || size.height <= 200 || loc === 'ru' || loc === 'pt') {
          console.log(
            `${bad ? 'HARD' : 'ok'} LD ${loc}@${size.width}x${size.height}`,
            `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
            `appW=${m.appW} vh92=${m.vh92}`,
            `lab=${m.labVis}/${m.labH} lines≈${m.labelLines}`,
            `track=${m.trackVis}/${m.trackH} meta=${m.metaVis}/${m.metaH}`,
            `h2=${m.h2Vis}/${m.h2H} brand=${m.brandDisp}:${m.brandH} maxH=${m.maxH}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }

  // --- asset-error soft band past tick152 ≤360 ---
  for (const size of AE_SIZES) {
    for (const [loc, h2] of ASSET_H2) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t153ae-${loc}-${size.width}x${size.height}`, {
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
              h2H: h2el ? +h2el.getBoundingClientRect().height.toFixed(2) : 0,
              h2Vis: +vis(h2el).toFixed(2),
              msgH: msgEl ? +msgEl.getBoundingClientRect().height.toFixed(2) : 0,
              msgVis: +vis(msgEl).toFixed(2),
              retryVis: +vis(retryBtn).toFixed(2),
              selectVis: +vis(selectBtn).toFixed(2),
              retryOut: out(retryBtn),
              selectOut: out(selectBtn),
              btnRow: retryBtn && selectBtn
                ? Math.abs(retryBtn.getBoundingClientRect().top - selectBtn.getBoundingClientRect().top) < 4
                : false,
            };
          },
          { h2, retry: RETRY[loc], select: SELECT[loc] },
        );
        const bad =
          m.panelOver > 1.5 ||
          m.retryOut ||
          m.selectOut ||
          m.retryVis < 20 ||
          m.selectVis < 20 ||
          (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
          (m.msgH > 0 && m.msgVis < m.msgH - 2);
        const soft = !bad && m.panelOver > 0;
        if (bad) hard.asset.push({ loc, ...size, ...m });
        if (bad || soft || size.width === 400 || size.width === 568) {
          console.log(
            `${bad ? 'HARD' : soft ? 'SOFT' : 'ok'} AE ${loc}@${size.width}x${size.height}`,
            `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
            `maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH}`,
            `h2=${m.h2Vis}/${m.h2H} msg=${m.msgVis}/${m.msgH}`,
            `retryOut=${m.retryOut} selOut=${m.selectOut} rVis=${m.retryVis} sVis=${m.selectVis}`,
            `btnRow=${m.btnRow}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }

  // --- rotate-card extremes ---
  for (const size of ROTATE_SIZES) {
    for (const [loc, body] of ROTATE_BODY) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t153rt-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate((body) => {
          document.body.classList.add('touch-ui', 'lao-newui', 'is-portrait');
          let hint = document.getElementById('rotate-hint') || document.querySelector('.rotate-hint');
          if (!hint) {
            hint = document.createElement('div');
            hint.id = 'rotate-hint';
            hint.className = 'rotate-hint';
            hint.innerHTML = `<div class="rotate-card"><span class="rotate-icon" aria-hidden="true"></span><strong data-i18n="rotate.title">ROTATE</strong><p data-i18n-html="rotate.body">${body}</p></div>`;
            document.body.appendChild(hint);
          } else {
            const p = hint.querySelector('p');
            if (p) p.textContent = body;
          }
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
            padT: getComputedStyle(hint).paddingTop,
            padB: getComputedStyle(hint).paddingBottom,
            strongVis: +vis(strong).toFixed(2),
            strongH: strong ? +strong.getBoundingClientRect().height.toFixed(2) : 0,
            pVis: +vis(p).toFixed(2),
            pH: p ? +p.getBoundingClientRect().height.toFixed(2) : 0,
            iconDisp: icon ? getComputedStyle(icon).display : 'none',
            iconH: icon ? +icon.getBoundingClientRect().height.toFixed(2) : 0,
            cardPad: getComputedStyle(card).padding,
          };
        }, body);
        const bad = m.over > 1.5 || m.strongVis < 10 || (m.pH > 0 && m.pVis < m.pH - 2);
        if (bad) hard.rotate.push({ loc, ...size, ...m });
        if (bad || size.width <= 280 || size.height <= 480 || loc === 'ru') {
          console.log(
            `${bad ? 'HARD' : 'ok'} RT ${loc}@${size.width}x${size.height}`,
            `over=${m.over} card=${m.cardW}x${m.cardH}`,
            `strong=${m.strongVis}/${m.strongH} p=${m.pVis}/${m.pH}`,
            `icon=${m.iconDisp}:${m.iconH} pad=${m.cardPad}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }

  // --- generic: screens still on 92vh (no % / no tick151-152 reclaim) at short letterbox ---
  // Probe a minimal "bare" overlay that only has touch-ui 92vh — and also
  // confirm select/options use % so they track #app.
  for (const size of [
    { width: 320, height: 180 },
    { width: 360, height: 200 },
    { width: 400, height: 225 },
  ]) {
    const page = await browser.newPage({ viewport: size });
    try {
      await page.goto(`${url}?cb=t153gen-${size.width}x${size.height}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const m = await page.evaluate(() => {
        document.body.classList.add('touch-ui', 'lao-newui');
        const content = document.getElementById('overlay-content');
        const appR = document.getElementById('app').getBoundingClientRect();
        const classes = [
          'screen-loading',
          'screen-asset-error',
          'screen-title',
          'screen-select',
          'screen-options',
          'screen-pause',
          'screen-tutorial',
          'screen-result',
        ];
        const rows = [];
        for (const cls of classes) {
          content.className = cls;
          content.style.cssText = '';
          void content.offsetHeight;
          const cs = getComputedStyle(content);
          rows.push({
            cls,
            maxH: cs.maxHeight,
            overflow: cs.overflowY,
            appH: +appR.height.toFixed(2),
            vh92: +(innerHeight * 0.92).toFixed(2),
          });
        }
        return { appH: +appR.height.toFixed(2), appW: +appR.width.toFixed(2), rows };
      });
      console.log(`GEN @${size.width}x${size.height} app=${m.appW}x${m.appH}`);
      for (const r of m.rows) {
        const usesVh = /vh|dvh/i.test(r.maxH);
        const usesPct = /%/.test(r.maxH) || r.maxH === '100%';
        console.log(`  ${r.cls} maxH=${r.maxH} overflow=${r.overflow} vh?= ${usesVh} pct?= ${usesPct}`);
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== HARD loading ===', hard.load.length);
for (const r of hard.load) {
  console.log(`${r.loc}@${r.width}x${r.height} over=${r.panelOver} lab=${r.labVis}/${r.labH} brand=${r.brandDisp} maxH=${r.maxH}`);
}
console.log('=== HARD asset-error ===', hard.asset.length);
for (const r of hard.asset) {
  console.log(`${r.loc}@${r.width}x${r.height} over=${r.panelOver} retryOut=${r.retryOut} selOut=${r.selectOut}`);
}
console.log('=== HARD rotate ===', hard.rotate.length);
for (const r of hard.rotate) {
  console.log(`${r.loc}@${r.width}x${r.height} over=${r.over} p=${r.pVis}/${r.pH}`);
}
