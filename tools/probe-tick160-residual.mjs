/**
 * Tick160 — residual HARD re-scan with REAL lobby-ico markup.
 * Focus: AE/loading/rotate CTA cliffs outside closed tick151–159 paths,
 * especially AE gap band @≥400×225–239 (past tick159 gate 224, before @240 keep)
 * and any NEW unread with icon. dens FROZEN. Prefer live HARD only.
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
  ['ko', '스테이지 1 로드 실패', '다시 시도', '선택으로'],
  ['ja', 'ステージ 1 読み込み失敗', '再試行', '選択へ'],
  ['pt', 'Falha ao carregar o estágio 1', 'Tentar de novo', 'À seleção'],
  ['es', 'Fallo al cargar la etapa 1', 'Reintentar', 'A selección'],
  ['ru', 'Не удалось загрузить стадию 1', 'Повторить', 'К выбору'],
  ['zh-Hant', '關卡 1 載入失敗', '重試', '回選擇'],
  ['zh-Hans', '关卡 1 加载失败', '重试', '回选择'],
];

const LOAD_LABELS = [
  ['en', 'Loading all assets (eager)…'],
  ['ko', '모든 에셋 로딩 중 (eager)…'],
  ['ja', 'すべてのアセットを読み込み中（eager）…'],
  ['pt', 'Carregando todos os recursos (eager)…'],
  ['es', 'Cargando todos los recursos (eager)…'],
  ['ru', 'Загрузка всех ресурсов (eager)…'],
  ['zh-Hant', '正在載入全部資源（eager）…'],
  ['zh-Hans', '正在加载全部资源（eager）…'],
];

const ROTATE = [
  ['ko', '기기를 회전하세요', '플레이하려면 가로 모드가 필요합니다.'],
  ['zh-Hant', '請旋轉裝置', '必須使用橫向模式才能遊玩。'],
  ['zh-Hans', '请旋转设备', '必须以横屏模式游玩。'],
  ['ru', 'Поверните устройство', 'Для игры нужен альбомный режим.'],
  ['pt', 'Gire o dispositivo', 'É necessário o modo paisagem para jogar.'],
  ['es', 'Gira el dispositivo', 'Se necesita el modo horizontal para jugar.'],
  ['ja', '端末を回転してください', 'プレイするには横向きが必要です。'],
  ['en', 'Rotate your device', 'Landscape mode is required to play.'],
];

// AE: gap band 225–239 + keep verify + soft reopen + ultra/mid keep
const AE_SIZES = [
  // gap past tick159 (224) before brand-full keep (240)
  { width: 400, height: 225 },
  { width: 400, height: 226 },
  { width: 400, height: 228 },
  { width: 400, height: 230 },
  { width: 400, height: 232 },
  { width: 400, height: 235 },
  { width: 400, height: 238 },
  { width: 400, height: 239 },
  { width: 400, height: 240 },
  // keep / ship bands (icon verify)
  { width: 400, height: 200 },
  { width: 400, height: 220 },
  { width: 400, height: 221 },
  { width: 400, height: 223 },
  { width: 400, height: 224 },
  // soft
  { width: 400, height: 250 },
  { width: 400, height: 260 },
  { width: 400, height: 280 },
  { width: 400, height: 290 },
  // wider short
  { width: 420, height: 225 },
  { width: 480, height: 228 },
  { width: 568, height: 225 },
  { width: 568, height: 230 },
  { width: 568, height: 239 },
  { width: 568, height: 240 },
  { width: 568, height: 280 },
  // ultra / near / mid-narrow keep
  { width: 320, height: 180 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 380, height: 200 },
  { width: 380, height: 240 },
  { width: 399, height: 200 },
  { width: 399, height: 240 },
];

const LOAD_SIZES = [
  { width: 321, height: 201 },
  { width: 330, height: 205 },
  { width: 342, height: 210 },
  { width: 360, height: 201 },
  { width: 360, height: 210 },
  { width: 360, height: 215 },
  { width: 361, height: 180 },
  { width: 380, height: 180 },
  { width: 399, height: 180 },
  { width: 399, height: 200 },
  { width: 400, height: 180 },
  { width: 400, height: 200 },
  { width: 400, height: 220 },
  { width: 400, height: 225 },
  { width: 400, height: 240 },
  { width: 568, height: 180 },
  { width: 568, height: 200 },
  { width: 800, height: 180 },
  { width: 320, height: 180 },
  { width: 360, height: 180 },
  { width: 360, height: 200 },
];

const SELECT_SIZES = [
  { width: 400, height: 280 },
  { width: 400, height: 240 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
];

const ROTATE_SIZES = [
  { width: 200, height: 360 },
  { width: 240, height: 400 },
  { width: 280, height: 480 },
  { width: 320, height: 568 },
  { width: 360, height: 640 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
const softEscalate = [];
const notes = [];

function classify(tag, m, isHard, isSoft) {
  if (isHard) hard.push({ tag, ...m });
  else if (isSoft) soft.push({ tag, ...m });
}

try {
  console.log('\n=== A) AE real-icon markup — gap 225–239 + keep/soft ===');
  for (const size of AE_SIZES) {
    for (const [loc, h2, retry, select] of LOCALES_AE) {
      const isGap = size.height >= 225 && size.height <= 239;
      const isKeepShip = size.height <= 224 || size.height === 240;
      const isSoftBand = size.height >= 250 && size.height <= 290;
      const focus =
        ['pt', 'ru', 'es', 'ja', 'ko', 'zh-Hant', 'zh-Hans'].includes(loc) ||
        (loc === 'en' && (isGap || isKeepShip || isSoftBand));
      if (!focus) continue;
      // denser on gap + long locales; sample width>400 for pt/ru/ja/ko
      if (size.width > 400 && !['pt', 'ru', 'ja', 'ko', 'zh-Hant'].includes(loc)) continue;
      if (isSoftBand && !['pt', 'ru', 'es', 'ja', 'en'].includes(loc)) continue;

      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t160ae-${loc}-${size.width}x${size.height}`, {
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
            // REAL markup: select CTA includes lobby-ico-back
            content.innerHTML = `
              <span class="brand-mark">ASSET ERROR</span>
              <span class="asset-error-icon" aria-hidden="true"></span>
              <h2>${h2}</h2>
              <div class="asset-error-msg"><p>ASSET LOAD FAILED: stage01/boss_core.png</p></div>
              <span class="asset-error-deco" aria-hidden="true"></span>
              <button class="btn btn-primary" id="btn-asset-retry">${retry}</button>
              <button class="btn" id="btn-asset-select"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${select}</button>
            `;
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector('.brand-mark');
            const h2el = content.querySelector('h2');
            const msgEl = content.querySelector('.asset-error-msg');
            const retryBtn = document.getElementById('btn-asset-retry');
            const selectBtn = document.getElementById('btn-asset-select');
            const ico = selectBtn?.querySelector('.lobby-ico-back');
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
              icoH: ico ? +ico.getBoundingClientRect().height.toFixed(2) : 0,
              icoW: ico ? +ico.getBoundingClientRect().width.toFixed(2) : 0,
            };
          },
          { h2, retry, select },
        );
        const tag = `AE ${loc}@${size.width}x${size.height}${isGap ? ' [GAP]' : ''}`;
        const isHard =
          m.retryOut ||
          m.selectOut ||
          m.retryVis < Math.min(20, m.rH - 2) ||
          m.selectVis < Math.min(20, m.sH - 2) ||
          (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
          (m.msgH > 0 && m.msgVis < m.msgH - 2);
        const isSoft = !isHard && m.panelOver > 1.5;
        classify(tag, m, isHard, isSoft);
        if (
          isSoftBand &&
          !isHard &&
          (m.panelOver > 3.5 || m.retryVis < m.rH * 0.9 || m.selectVis < m.sH * 0.9)
        ) {
          softEscalate.push({ tag, ...m });
        }
        // always log gap + any HARD/SOFT; sample keep
        if (isHard || isSoft || isGap || size.height === 224 || size.height === 240 || size.height === 220) {
          console.log(
            `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${tag}`,
            `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
            `maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH}`,
            `h2=${m.h2Vis}/${m.h2H} fs=${m.h2Fs} msg=${m.msgVis}/${m.msgH}`,
            `retryOut=${m.retryOut} selOut=${m.selectOut} rVis=${m.retryVis}/${m.rH} sVis=${m.selectVis}/${m.sH}`,
            `ico=${m.icoW}x${m.icoH}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== B) LOADING residual (real markup) ===');
  for (const size of LOAD_SIZES) {
    for (const [loc, label] of LOAD_LABELS) {
      const key =
        ['ko', 'zh-Hant', 'zh-Hans', 'ja', 'pt', 'ru', 'es'].includes(loc) ||
        (loc === 'en' && (size.height <= 220 || size.width <= 360));
      if (!key) continue;
      if (size.width >= 568 && !['ko', 'zh-Hant', 'ja', 'pt', 'ru'].includes(loc)) continue;

      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t160ld-${loc}-${size.width}x${size.height}`, {
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
        if (isHard || isSoft || size.height >= 201 || size.width >= 400) {
          console.log(
            `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${tag}`,
            `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
            `maxH=${m.maxH} brand=${m.brandDisp}:${m.brandH}`,
            `lab=${m.labVis}/${m.labH} track=${m.trackVis}/${m.trackH} meta=${m.metaVis}/${m.metaH}`,
            `clips lab/track/meta=${m.labClip}/${m.trackClip}/${m.metaClip}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== C) Select CTA chrome @short (known tick144 residual) ===');
  for (const size of SELECT_SIZES) {
    for (const loc of ['ko', 'ru', 'pt', 'es', 'zh-Hant', 'ja']) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.addInitScript(({ loc }) => {
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
        }, { loc });
        await page.goto(`${url}?cb=t160se-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#overlay-content.screen-select, .char-card, #btn-confirm', {
          timeout: 60000,
        });
        await page.waitForTimeout(200);
        const m = await page.evaluate(() => {
          const content = document.getElementById('overlay-content');
          const appR = document.getElementById('app').getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const cta =
            content.querySelector('#btn-confirm') ||
            content.querySelector('.select-actions .btn-primary') ||
            content.querySelector('.select-actions .btn');
          const actions = content.querySelector('.select-actions');
          const back =
            content.querySelector('#btn-back') ||
            content.querySelector('.select-actions .lobby-ico-back')?.closest('.btn');
          const ico = back?.querySelector('.lobby-ico-back') || content.querySelector('.lobby-ico-back');
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
            return (
              r.bottom > appR.bottom + 1.5 ||
              r.top < appR.top - 1.5 ||
              r.right > appR.right + 1.5
            );
          };
          const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
          return {
            panelOver: +panelOver.toFixed(2),
            maxH: getComputedStyle(content).maxHeight,
            ctaOut: out(cta),
            ctaVis: +vis(cta).toFixed(2),
            ctaH: cta ? +cta.getBoundingClientRect().height.toFixed(2) : 0,
            actionsOut: out(actions),
            backOut: back ? out(back) : false,
            backVis: +vis(back).toFixed(2),
            icoH: ico ? +ico.getBoundingClientRect().height.toFixed(2) : 0,
            cls: content.className,
          };
        });
        const tag = `SE ${loc}@${size.width}x${size.height}`;
        const isHard =
          m.ctaOut || (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2));
        const isSoft = !isHard && (m.panelOver > 1.5 || m.actionsOut || m.backOut);
        classify(tag, m, isHard, isSoft);
        if (m.actionsOut && !isHard) notes.push(`${tag} actions chrome residual (soft/playtest)`);
        if (m.backOut && !isHard) notes.push(`${tag} back chrome residual (soft/playtest)`);
        console.log(
          `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${tag}`,
          `over=${m.panelOver} maxH=${m.maxH}`,
          `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
          `actionsOut=${m.actionsOut} backOut=${m.backOut} icoH=${m.icoH}`,
          `cls=${m.cls}`,
        );
      } finally {
        await page.close();
      }
    }
  }

  console.log('\n=== D) ROTATE viewport-grounded (incl. pt/es/ja/en) ===');
  for (const size of ROTATE_SIZES) {
    for (const [loc, title, body] of ROTATE) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t160rt-${loc}-${size.width}x${size.height}`, {
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
            const card = hint.querySelector('.rotate-card');
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
              strongVis: +vis(strong).toFixed(2),
              strongH: strong ? +strong.getBoundingClientRect().height.toFixed(2) : 0,
              pVis: +vis(p).toFixed(2),
              pH: p ? +p.getBoundingClientRect().height.toFixed(2) : 0,
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
        if (isHard || isSoft || size.width <= 240) {
          console.log(
            `${isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok'} ${tag}`,
            `over=${m.panelOver} cardH=${m.cardH}/${m.vvH}`,
            `strong=${m.strongVis}/${m.strongH} p=${m.pVis}/${m.pH}`,
            `strongOut=${m.strongOut} pOut=${m.pOut}`,
          );
        }
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
    s.ctaOut != null ? `ctaOut=${s.ctaOut}` : '',
  );
}
console.log(`SOFT_ESCALATE count=${softEscalate.length}`);
for (const s of softEscalate) {
  console.log(' ESCALATE', s.tag, `over=${s.panelOver}`, `rVis=${s.retryVis}/${s.rH}`, `sVis=${s.selectVis}/${s.sH}`);
}
console.log(`NOTES count=${notes.length}`);
for (const n of notes) console.log(' NOTE', n);
if (!hard.length) console.log('NO HARD muddy in scanned residual axes.');
if (!softEscalate.length) console.log('NO soft AE escalate (CTA full / over≤3.5).');
