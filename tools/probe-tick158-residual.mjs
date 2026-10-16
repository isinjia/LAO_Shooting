/**
 * Tick158 — soft AE@260–280 escalate hunt + residual HARD scan.
 * Prefer live-measured HARD win only. dens FROZEN. No invent for soft.
 *
 * Axes:
 *  A) AE soft band @≥400×250–290 — escalate ONLY if CTA unread / over≫3
 *  B) AE mid band @≥400×224–249 — hunt NEW HARD past tick157 cliff clear
 *  C) Loading residual past 151/153 (short-wide + cliffs)
 *  D) Rotate viewport-grounded extremes
 *  E) Keep: tick152–157 sizes still clear
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

const LOCALES_AE = [
  ['en', 'Stage 1 load failed', 'Retry', 'To select'],
  ['pt', 'Falha ao carregar o estágio 1', 'Tentar de novo', 'À seleção'],
  ['es', 'Fallo al cargar la etapa 1', 'Reintentar', 'A selección'],
  ['ru', 'Не удалось загрузить стадию 1', 'Повторить', 'К выбору'],
  ['ja', 'ステージ 1 読み込み失敗', '再試行', '選択へ'],
  ['ko', '스테이지 1 로드 실패', '다시 시도', '선택으로'],
];

const LOAD_LABELS = [
  ['en', 'Loading all assets (eager)…'],
  ['pt', 'Carregando todos os recursos (eager)…'],
  ['es', 'Cargando todos los recursos (eager)…'],
  ['ru', 'Загрузка всех ресурсов (eager)…'],
  ['ja', 'すべてのアセットを読み込み中（eager）…'],
  ['ko', '모든 에셋 로딩 중 (eager)…'],
];

const ROTATE = [
  ['en', 'Rotate your device', 'Landscape mode is required to play.'],
  ['pt', 'Gire o dispositivo', 'É necessário o modo paisagem para jogar.'],
  ['es', 'Gira el dispositivo', 'Se requiere el modo horizontal para jugar.'],
  ['ru', 'Поверните устройство', 'Для игры нужен альбомный режим.'],
  ['ja', '端末を回転してください', 'プレイには横向きが必要です。'],
  ['ko', '기기를 회전하세요', '플레이하려면 가로 모드가 필요합니다.'],
];

// Dense soft band + mid reopen + keep cliffs
const AE_SIZES = [
  // soft escalate hunt (user focus)
  { width: 400, height: 250 },
  { width: 400, height: 255 },
  { width: 400, height: 260 },
  { width: 400, height: 265 },
  { width: 400, height: 270 },
  { width: 400, height: 275 },
  { width: 400, height: 280 },
  { width: 400, height: 285 },
  { width: 400, height: 290 },
  { width: 420, height: 260 },
  { width: 420, height: 270 },
  { width: 420, height: 280 },
  { width: 480, height: 260 },
  { width: 480, height: 270 },
  { width: 480, height: 280 },
  { width: 568, height: 260 },
  { width: 568, height: 270 },
  { width: 568, height: 280 },
  { width: 640, height: 260 },
  { width: 640, height: 280 },
  { width: 720, height: 260 },
  { width: 800, height: 260 },
  { width: 800, height: 280 },
  // mid reopen past tick157 clear (@224+)
  { width: 400, height: 224 },
  { width: 400, height: 230 },
  { width: 400, height: 235 },
  { width: 400, height: 240 },
  { width: 400, height: 245 },
  { width: 420, height: 230 },
  { width: 480, height: 230 },
  { width: 568, height: 230 },
  { width: 568, height: 240 },
  // tick157 cliff keep
  { width: 400, height: 221 },
  { width: 400, height: 222 },
  { width: 400, height: 223 },
  { width: 420, height: 221 },
  { width: 568, height: 221 },
  // tick156 keep
  { width: 400, height: 200 },
  { width: 400, height: 220 },
  { width: 568, height: 200 },
  // mid/near/ultra keep
  { width: 399, height: 200 },
  { width: 380, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
];

const LOAD_SIZES = [
  { width: 400, height: 180 },
  { width: 400, height: 200 },
  { width: 400, height: 220 },
  { width: 400, height: 240 },
  { width: 400, height: 260 },
  { width: 400, height: 280 },
  { width: 420, height: 180 },
  { width: 480, height: 180 },
  { width: 568, height: 180 },
  { width: 568, height: 200 },
  { width: 640, height: 180 },
  { width: 800, height: 180 },
  { width: 800, height: 200 },
  { width: 361, height: 180 },
  { width: 380, height: 180 },
  { width: 399, height: 200 },
  { width: 321, height: 201 },
  { width: 340, height: 210 },
  { width: 360, height: 180 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 320, height: 180 },
];

const ROTATE_SIZES = [
  { width: 200, height: 360 },
  { width: 180, height: 320 },
  { width: 220, height: 380 },
  { width: 240, height: 400 },
  { width: 280, height: 500 },
  { width: 320, height: 568 },
  { width: 360, height: 640 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
const softEscalate = []; // over≫3 OR CTA nearly unread while classified soft

function classify(tag, m, isHard, isSoft) {
  if (isHard) hard.push({ tag, ...m });
  else if (isSoft) soft.push({ tag, ...m });
}

try {
  console.log('\n=== AE soft escalate + mid reopen + keep ===');
  for (const size of AE_SIZES) {
    for (const [loc, h2, retry, select] of LOCALES_AE) {
      if (!['ja', 'pt', 'es', 'ru', 'en'].includes(loc)) continue;
      const softBand = size.height >= 250 && size.height <= 290;
      const midBand = size.height >= 224 && size.height <= 249;
      const keepBand = size.height <= 223 || size.width <= 399;
      // sample density: all locales on soft/mid/keep key; long+ja on wide soft
      if (!softBand && !midBand && !keepBand) continue;
      if (size.width >= 640 && loc !== 'ja' && loc !== 'pt' && loc !== 'ru') continue;
      if (midBand && size.width > 400 && loc !== 'pt' && loc !== 'ru' && loc !== 'ja') continue;

      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t158ae-${loc}-${size.width}x${size.height}`, {
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
            const h2Cs = h2el ? getComputedStyle(h2el) : null;
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
              h2Fs: h2Cs ? h2Cs.fontSize : '',
              msgH: msgEl ? +msgEl.getBoundingClientRect().height.toFixed(2) : 0,
              msgVis: +vis(msgEl).toFixed(2),
              retryVis: +vis(retryBtn).toFixed(2),
              selectVis: +vis(selectBtn).toFixed(2),
              retryOut: out(retryBtn),
              selectOut: out(selectBtn),
              rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
              sH: +selectBtn.getBoundingClientRect().height.toFixed(2),
            };
          },
          { h2, retry, select },
        );
        const tag = `AE ${loc}@${size.width}x${size.height}`;
        const isHard =
          m.retryOut ||
          m.selectOut ||
          m.retryVis < Math.min(20, m.rH - 2) ||
          m.selectVis < Math.min(20, m.sH - 2) ||
          (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
          (m.msgH > 0 && m.msgVis < m.msgH - 2);
        const isSoft = !isHard && m.panelOver > 1.5;
        classify(tag, m, isHard, isSoft);
        // escalate signal: soft but over≫3 OR CTA visibly compromised (<90% height)
        if (
          softBand &&
          !isHard &&
          (m.panelOver > 3.5 ||
            m.retryVis < m.rH * 0.9 ||
            m.selectVis < m.sH * 0.9)
        ) {
          softEscalate.push({ tag, ...m });
        }
        console.log(
          `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${tag}`,
          `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
          `maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH}`,
          `h2=${m.h2Vis}/${m.h2H} fs=${m.h2Fs} msg=${m.msgVis}/${m.msgH}`,
          `retryOut=${m.retryOut} selOut=${m.selectOut} rVis=${m.retryVis}/${m.rH} sVis=${m.selectVis}/${m.sH}`,
        );
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== LOADING residual ===');
  for (const size of LOAD_SIZES) {
    for (const [loc, label] of LOAD_LABELS) {
      if (!['ja', 'pt', 'ru', 'en'].includes(loc)) continue;
      const key =
        loc === 'ja' ||
        (size.width >= 400 && size.height <= 280) ||
        (size.width >= 361 && size.width < 400) ||
        size.width <= 360;
      if (!key) continue;
      if (size.width >= 640 && loc !== 'ja' && loc !== 'pt') continue;

      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t158ld-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate(
          ({ label }) => {
            document.body.classList.add('touch-ui', 'lao-newui');
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            overlay.classList.add('show');
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
            content.className = 'screen-loading';
            content.style.cssText = '';
            content.innerHTML = `
              <span class="brand-mark">LOADING</span>
              <p id="loading-label">${label}</p>
              <div class="load-track"><div class="load-fill" style="width:42%"></div></div>
              <div class="load-meta"><span id="load-pct">42%</span></div>
            `;
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const lab = document.getElementById('loading-label');
            const track = content.querySelector('.load-track');
            const meta = content.querySelector('.load-meta');
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
            const clip = (el) => {
              if (!el) return true;
              const r = el.getBoundingClientRect();
              const v = vis(el);
              return v < r.height - 1.5;
            };
            return {
              panelOver: +panelOver.toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              ocH: +ocR.height.toFixed(2),
              appH: +appR.height.toFixed(2),
              maxH: getComputedStyle(content).maxHeight,
              brandDisp: brand ? getComputedStyle(brand).display : 'none',
              brandH: brand ? +brand.getBoundingClientRect().height.toFixed(2) : 0,
              labH: lab ? +lab.getBoundingClientRect().height.toFixed(2) : 0,
              labVis: +vis(lab).toFixed(2),
              trackH: track ? +track.getBoundingClientRect().height.toFixed(2) : 0,
              trackVis: +vis(track).toFixed(2),
              metaH: meta ? +meta.getBoundingClientRect().height.toFixed(2) : 0,
              metaVis: +vis(meta).toFixed(2),
              labClip: clip(lab),
              trackClip: clip(track),
              metaClip: clip(meta),
            };
          },
          { label },
        );
        const tag = `LD ${loc}@${size.width}x${size.height}`;
        const isHard = m.labClip || m.trackClip || m.metaClip || m.metaVis < 8;
        const isSoft = !isHard && m.panelOver > 1.5;
        classify(tag, m, isHard, isSoft);
        console.log(
          `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${tag}`,
          `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
          `maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH}`,
          `lab=${m.labVis}/${m.labH} track=${m.trackVis}/${m.trackH} meta=${m.metaVis}/${m.metaH}`,
          `clips lab/track/meta=${m.labClip}/${m.trackClip}/${m.metaClip}`,
        );
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== ROTATE residual (viewport-grounded) ===');
  for (const size of ROTATE_SIZES) {
    for (const [loc, title, body] of ROTATE) {
      if (loc !== 'ja' && loc !== 'ru' && !(loc === 'pt' && size.width <= 240)) continue;
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t158rt-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate(
          ({ title, body }) => {
            document.body.classList.add('touch-ui', 'lao-newui');
            const hint = document.getElementById('rotate-hint');
            hint.classList.add('is-on');
            const strong = hint.querySelector('strong');
            const p = hint.querySelector('p');
            if (strong) strong.textContent = title;
            if (p) p.textContent = body;
            void hint.offsetHeight;
            const vv = {
              top: 0,
              left: 0,
              bottom: window.innerHeight,
              right: window.innerWidth,
              height: window.innerHeight,
              width: window.innerWidth,
            };
            const hintR = hint.getBoundingClientRect();
            const card = hint.querySelector('.rotate-card');
            const icon = hint.querySelector('.rotate-icon');
            const cardR = card.getBoundingClientRect();
            const panelOver = Math.max(0, cardR.bottom - vv.bottom, vv.top - cardR.top);
            const vis = (el) => {
              if (!el) return 0;
              const r = el.getBoundingClientRect();
              return Math.max(0, Math.min(r.bottom, vv.bottom) - Math.max(r.top, vv.top));
            };
            const out = (el) => {
              if (!el) return true;
              const r = el.getBoundingClientRect();
              return r.bottom > vv.bottom + 1.5 || r.top < vv.top - 1.5;
            };
            return {
              panelOver: +panelOver.toFixed(2),
              cardH: +cardR.height.toFixed(2),
              vvH: vv.height,
              hintH: +hintR.height.toFixed(2),
              strongVis: +vis(strong).toFixed(2),
              strongH: strong ? +strong.getBoundingClientRect().height.toFixed(2) : 0,
              pVis: +vis(p).toFixed(2),
              pH: p ? +p.getBoundingClientRect().height.toFixed(2) : 0,
              iconOut: out(icon),
              strongOut: out(strong),
              pOut: out(p),
            };
          },
          { title, body },
        );
        const tag = `RT ${loc}@${size.width}x${size.height}`;
        const isHard =
          m.strongOut ||
          m.pOut ||
          m.strongVis < m.strongH - 2 ||
          m.pVis < Math.min(12, m.pH - 2);
        const isSoft = !isHard && m.panelOver > 1.5;
        classify(tag, m, isHard, isSoft);
        console.log(
          `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${tag}`,
          `over=${m.panelOver} cardH=${m.cardH}/${m.vvH}`,
          `strong=${m.strongVis}/${m.strongH} p=${m.pVis}/${m.pH}`,
          `iconOut=${m.iconOut} strongOut=${m.strongOut} pOut=${m.pOut}`,
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

console.log('\n=== SUMMARY ===');
console.log(`HARD count=${hard.length}`);
for (const h of hard) console.log(' HARD', h.tag, JSON.stringify(h));
console.log(`SOFT count=${soft.length}`);
for (const s of soft.slice(0, 80)) {
  console.log(
    ' SOFT',
    s.tag,
    `over=${s.panelOver}`,
    s.retryOut != null ? `brand=${s.brandDisp} rOut=${s.retryOut} rVis=${s.retryVis}/${s.rH}` : '',
    s.metaVis != null ? `meta=${s.metaVis}/${s.metaH} brand=${s.brandDisp}` : '',
  );
}
console.log(`SOFT_ESCALATE count=${softEscalate.length} (over>3.5 or CTA vis<90%)`);
for (const s of softEscalate) {
  console.log(
    ' ESCALATE',
    s.tag,
    `over=${s.panelOver}`,
    `rVis=${s.retryVis}/${s.rH}`,
    `sVis=${s.selectVis}/${s.sH}`,
    `brand=${s.brandDisp}`,
  );
}
if (!hard.length) console.log('NO HARD muddy in scanned axes.');
if (!softEscalate.length) console.log('NO soft@250–290 escalate (CTA full, over≤3.5).');
