/**
 * Tick168 — residual HARD scan outside tick167 standard size grid.
 * Prefer: ONE live HARD muddy (cliff / AE / loading / OPTIONS LATENT);
 * else honest +0. dens FROZEN. No soft invent.
 *
 * NOTE: Section C rotate vs #app is a FALSE HARD trap (tick155 reject invent).
 * Authoritative rotate metric = viewport-grounded (probe-tick168-rotate-vv.mjs
 * / tick160 criteria). Corrected verdict this tick: HARD=0.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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

const LOCALES = ['ko', 'en', 'ru', 'pt', 'es', 'zh-Hant', 'ja'];
const LONG = ['ru', 'pt', 'es', 'ko', 'ja'];
// Cliff / gap sizes NOT in tick167 residual grid (outside exhausted lists)
const CLIFF = [
  { width: 340, height: 200 },
  { width: 342, height: 220 },
  { width: 380, height: 220 },
  { width: 390, height: 240 },
  { width: 400, height: 225 },
  { width: 400, height: 255 },
  { width: 420, height: 240 },
  { width: 667, height: 375 },
];
const ROTATE = [
  { width: 360, height: 640 },
  { width: 400, height: 700 },
];
const AE_LABELS = {
  ko: { h2: '에셋 로드 실패', retry: '다시 시도', select: '선택으로' },
  en: { h2: 'Asset load failed', retry: 'Retry', select: 'Select' },
  ru: { h2: 'Ошибка загрузки', retry: 'Повторить', select: 'К выбору' },
  pt: { h2: 'Falha ao carregar', retry: 'Tentar de novo', select: 'Seleção' },
  es: { h2: 'Error al cargar', retry: 'Reintentar', select: 'Selección' },
  'zh-Hant': { h2: '資源載入失敗', retry: '重試', select: '返回選擇' },
  ja: { h2: 'アセット読込失敗', retry: '再試行', select: '選択へ' },
};
const LOAD_LABELS = {
  ko: '스테이지 준비 중…',
  en: 'Preparing stage…',
  ru: 'Подготовка стадии…',
  pt: 'Preparando estágio…',
  es: 'Preparando etapa…',
  'zh-Hant': '關卡準備中…',
  ja: 'ステージ準備中…',
};

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classifyOpt(m) {
  const unread =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2));
  const soft =
    !unread && (m.panelOver > 1.5 || m.actionsOut || (m.scrollSoft && m.scrollH < 72));
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

function classifyPeer(m) {
  const unread =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2)) ||
    m.midOut === true ||
    m.mid2Out === true ||
    (typeof m.midVis === 'number' &&
      m.midH > 0 &&
      m.midVis < Math.min(16, m.midH - 2)) ||
    (typeof m.mid2Vis === 'number' &&
      m.mid2H > 0 &&
      m.mid2Vis < Math.min(16, m.mid2H - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut || m.backOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function boot(browser, url, size, loc, tag, tutorialSeen = '1') {
  const page = await browser.newPage({ viewport: size });
  await page.addInitScript(
    ({ loc, tutorialSeen }) => {
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
      localStorage.setItem('lao_mini_tutorial_seen', tutorialSeen);
      window.__tick168Health = { options: 0, optionsCaps: [] };
    },
    { loc, tutorialSeen },
  );
  await page.goto(`${url}?cb=t168-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  await page.evaluate(() => {
    const orig = Math.max;
    Math.max = function (...args) {
      if (
        args.length >= 2 &&
        args[0] === 260 &&
        typeof args[1] === 'number' &&
        Number.isFinite(args[1])
      ) {
        const st = window.__tick168Health;
        const oc = document.getElementById('overlay-content');
        if (st && oc?.classList?.contains('screen-options')) {
          st.options += 1;
          st.optionsCaps.push(args[1]);
        }
      }
      return orig.apply(Math, args);
    };
  });
  return page;
}

async function measureOptions(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector('#btn-opt-back');
    const actions = oc.querySelector('.opt-actions');
    const scroll = oc.querySelector('.opt-scroll');
    const brand = oc.querySelector('.opt-head .brand-mark');
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
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const maxHpx = parseFloat(oc.style.maxHeight) || 0;
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const st = window.__tick168Health || {};
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      maxHpx,
      fitH,
      inflated: maxHpx > fitH + 0.5,
      healthSteps: st.options | 0,
      healthCaps: (st.optionsCaps || []).slice(-4),
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      actionsOut: actions ? out(actions) : false,
      scrollH: +(scroll?.getBoundingClientRect().height || 0).toFixed(1),
      scrollMin: scroll?.style.minHeight || '',
      scrollSoft: !!(scroll && scroll.getBoundingClientRect().height + 0.5 < 72),
      short: oc.classList.contains('is-opt-short'),
      brandHidden: brand ? getComputedStyle(brand).display === 'none' : false,
    };
  });
}

const peerMeasure = `({ ctaSel, secSel, midSel, mid2Sel, actionsSel, backSel }) => {
  const app = document.getElementById('app');
  const oc = document.getElementById('overlay-content') || document.getElementById('app');
  void oc?.offsetHeight;
  const appR = app.getBoundingClientRect();
  const ocR = oc.getBoundingClientRect();
  const cta = oc.querySelector(ctaSel);
  const sec = secSel ? oc.querySelector(secSel) : null;
  const mid = midSel ? oc.querySelector(midSel) : null;
  const mid2 = mid2Sel ? oc.querySelector(mid2Sel) : null;
  const actions = actionsSel ? oc.querySelector(actionsSel) : null;
  const back = backSel ? oc.querySelector(backSel) : null;
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
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      r.bottom > appR.bottom + 1.5 ||
      r.top < appR.top - 1.5 ||
      r.right > appR.right + 1.5 ||
      r.left < appR.left - 1.5
    );
  };
  const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
  return {
    panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
    maxH: oc.style?.maxHeight || '',
    ctaOut: cta ? out(cta) : true,
    ctaVis: +vis(cta).toFixed(1),
    ctaH: bh(cta),
    secOut: sec ? out(sec) : false,
    secVis: sec ? +vis(sec).toFixed(1) : 0,
    secH: bh(sec),
    midOut: mid ? out(mid) : false,
    midVis: mid ? +vis(mid).toFixed(1) : 0,
    midH: bh(mid),
    mid2Out: mid2 ? out(mid2) : false,
    mid2Vis: mid2 ? +vis(mid2).toFixed(1) : 0,
    mid2H: bh(mid2),
    backOut: back ? out(back) : false,
    actionsOut: actions ? out(actions) : false,
    btnMinH: (() => {
      const b = actions?.querySelector('.btn');
      return b ? getComputedStyle(b).minHeight : '';
    })(),
    gap: actions ? getComputedStyle(actions).gap : '',
    brandHidden: (() => {
      const b = oc.querySelector('.brand-mark, .title-brand, .brand');
      return b ? getComputedStyle(b).display === 'none' : false;
    })(),
  };
}`;

async function enterGameplay(page) {
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 60000 });
  await page.waitForTimeout(80);
  await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
  await page.waitForTimeout(40);
  await page.click('#btn-go');
  await page.waitForFunction(
    () => !!window.__LAO__?.getGame?.() || !!document.querySelector('#btn-tut-go'),
    { timeout: 60000 },
  );
  if (await page.$('#btn-tut-go')) {
    await page.click('#btn-tut-go');
  }
  await page.waitForFunction(() => !!window.__LAO__?.getGame?.(), { timeout: 60000 });
  await page.waitForTimeout(220);
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let healthLive = 0;

try {
  log('=== A) OPTIONS LATENT + peer chrome @ cliff sizes ===');
  for (const size of CLIFF) {
    for (const loc of LOCALES) {
      // OPTIONS from title
      {
        const page = await boot(browser, url, size, loc, 'opt');
        try {
          await page.click('#btn-options');
          await page.waitForSelector('#overlay-content.screen-options, #btn-opt-back', {
            timeout: 60000,
          });
          await page.waitForTimeout(200);
          await page.evaluate(() => window.dispatchEvent(new Event('resize')));
          await page.waitForTimeout(100);
          const m = await measureOptions(page);
          const cls = classifyOpt(m);
          const tag = `options ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} maxH=${m.maxH} fitH=${m.fitH} inflated=${m.inflated}`,
            `health=${m.healthSteps} ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `scrollH=${m.scrollH} short=${m.short}`,
          );
          if (m.healthSteps > 0) healthLive += 1;
          const row = { tag, screen: 'options', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // Peer chrome only for LONG locales (speed)
      if (!LONG.includes(loc)) continue;

      // pause
      {
        const page = await boot(browser, url, size, loc, 'pause');
        try {
          await enterGameplay(page);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(260);
          if (await page.$('#overlay-content.screen-pause')) {
            const m = await page.evaluate(eval(`(${peerMeasure})`), {
              ctaSel: '#btn-resume',
              secSel: '#btn-quit',
              midSel: '#btn-pause-options',
              mid2Sel: '#btn-pause-mute',
              actionsSel: '.pause-actions',
              backSel: null,
            });
            const cls = classifyPeer(m);
            const tag = `pause ${loc}@${size.width}x${size.height}`;
            log(
              `${cls} ${tag}`,
              `over=${m.panelOver}`,
              `cta=${m.ctaVis}/${m.ctaH} quit=${m.secVis}/${m.secH}`,
              `opt=${m.midVis}/${m.midH} mute=${m.mid2Vis}/${m.mid2H}`,
              `gap=${m.gap} btnMinH=${m.btnMinH}`,
            );
            const row = { tag, screen: 'pause', loc, w: size.width, h: size.height, cls, ...m };
            if (cls === 'HARD') hard.push(row);
            else if (cls === 'SOFT') soft.push(row);
            else ok += 1;
          } else {
            log(`SKIP pause ${loc}@${size.width}x${size.height}`);
          }
        } finally {
          await page.close();
        }
      }

      // result
      if (size.height <= 280) {
        const page = await boot(browser, url, size, loc, 'res');
        try {
          await enterGameplay(page);
          await page.evaluate(() => {
            const g = window.__LAO__.getGame();
            if (g && typeof g.forceGameOver === 'function') g.forceGameOver();
            else if (typeof window.__LAO__.endScreen === 'function') {
              window.__LAO__.endScreen('gameover', {
                score: 1234,
                hiScore: 5678,
                graze: 12,
                stage: 2,
                pilot: 'HIRUME',
                maxCombo: 8,
                noMiss: false,
              });
            }
          });
          await page.waitForSelector('#overlay-content.screen-result, #btn-retry', {
            timeout: 60000,
          });
          await page.waitForTimeout(220);
          const m = await page.evaluate(eval(`(${peerMeasure})`), {
            ctaSel: '#btn-retry',
            secSel: '#btn-title',
            midSel: null,
            mid2Sel: null,
            actionsSel: '.result-actions, .pause-actions',
            backSel: null,
          });
          const cls = classifyPeer(m);
          const tag = `result ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} cta=${m.ctaVis}/${m.ctaH} title=${m.secVis}/${m.secH}`,
          );
          const row = { tag, screen: 'result', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // select
      if (size.height <= 280) {
        const page = await boot(browser, url, size, loc, 'sel');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#overlay-content.screen-select, #btn-go', {
            timeout: 60000,
          });
          await page.waitForTimeout(200);
          const m = await page.evaluate(eval(`(${peerMeasure})`), {
            ctaSel: '#btn-go',
            secSel: '#btn-options-select',
            midSel: null,
            mid2Sel: null,
            actionsSel: '.select-actions',
            backSel: '#btn-back',
          });
          const cls = classifyPeer(m);
          const tag = `select ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} cta=${m.ctaVis}/${m.ctaH}`,
            `opt=${m.secVis}/${m.secH} backOut=${m.backOut}`,
          );
          const row = { tag, screen: 'select', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // tutorial
      if (size.width <= 420 && size.height <= 255) {
        const page = await boot(browser, url, size, loc, 'tut', '0');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 60000 });
          await page.waitForTimeout(80);
          await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
          await page.waitForTimeout(40);
          await page.click('#btn-go');
          await page.waitForSelector('#overlay-content.screen-tutorial, #btn-tut-go', {
            timeout: 60000,
          });
          await page.waitForTimeout(200);
          const m = await page.evaluate(eval(`(${peerMeasure})`), {
            ctaSel: '#btn-tut-go',
            secSel: '#btn-tut-skip',
            midSel: null,
            mid2Sel: null,
            actionsSel: '.pause-actions, .tut-actions',
            backSel: '#btn-tut-skip',
          });
          const cls = classifyPeer(m);
          const tag = `tutorial ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} sortie=${m.ctaVis}/${m.ctaH} skip=${m.secVis}/${m.secH}`,
          );
          const row = { tag, screen: 'tutorial', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }
    }
  }

  log('');
  log('=== B) Asset-error + Loading @ cliff (real markup) ===');
  for (const size of CLIFF) {
    for (const loc of LONG) {
      // AE
      {
        const page = await browser.newPage({ viewport: size });
        try {
          await page.goto(`${url}?cb=t168ae-${loc}-${size.width}x${size.height}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });
          const labels = AE_LABELS[loc];
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
              <button class="btn" id="btn-asset-select"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${select}</button>
            `;
              void content.offsetHeight;
              const appR = document.getElementById('app').getBoundingClientRect();
              const ocR = content.getBoundingClientRect();
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
              };
            },
            labels,
          );
          const isHard =
            m.retryOut ||
            m.selectOut ||
            m.retryVis < Math.min(20, m.rH - 2) ||
            m.selectVis < Math.min(20, m.sH - 2) ||
            (m.h2H > 0 && m.h2Vis < m.h2H - 2) ||
            (m.msgH > 0 && m.msgVis < m.msgH - 2);
          const isSoft = !isHard && m.panelOver > 1.5;
          const cls = isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok';
          const tag = `AE ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} h2=${m.h2Vis}/${m.h2H} msg=${m.msgVis}/${m.msgH}`,
            `retry=${m.retryVis}/${m.rH} sel=${m.selectVis}/${m.sH}`,
          );
          const row = { tag, screen: 'ae', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // Loading
      {
        const page = await browser.newPage({ viewport: size });
        try {
          await page.goto(`${url}?cb=t168ld-${loc}-${size.width}x${size.height}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });
          const label = LOAD_LABELS[loc];
          const m = await page.evaluate(({ label }) => {
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
              return vis(el) < r.height - 1.5;
            };
            return {
              panelOver: +panelOver.toFixed(2),
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
          }, { label });
          const isHard = m.labClip || m.trackClip || m.metaClip || m.metaVis < 8;
          const isSoft = !isHard && m.panelOver > 1.5;
          const cls = isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok';
          const tag = `LD ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} lab=${m.labVis}/${m.labH}`,
            `track=${m.trackVis}/${m.trackH} meta=${m.metaVis}/${m.metaH}`,
            `clips=${m.labClip}/${m.trackClip}/${m.metaClip}`,
          );
          const row = { tag, screen: 'loading', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }
    }
  }

  log('');
  log('=== C) Rotate-card portrait extremes ===');
  for (const size of ROTATE) {
    for (const loc of ['ko', 'pt', 'ru', 'es', 'ja', 'en', 'zh-Hant']) {
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
        }, { loc });
        await page.goto(`${url}?cb=t168rot-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start, #rotate-hint, .rotate-card', {
          timeout: 60000,
        });
        await page.waitForTimeout(180);
        const m = await page.evaluate(() => {
          const app = document.getElementById('app');
          const card =
            document.querySelector('.rotate-card') ||
            document.querySelector('#rotate-hint') ||
            document.querySelector('.rotate-hint');
          const appR = app?.getBoundingClientRect();
          if (!card || !appR) {
            return { present: !!card, unread: false, panelOver: 0, vis: 0, h: 0 };
          }
          const r = card.getBoundingClientRect();
          const vis = Math.max(
            0,
            Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top),
          );
          const panelOver = Math.max(0, r.bottom - appR.bottom, appR.top - r.top);
          const unread =
            vis < Math.min(16, r.height - 2) ||
            r.bottom > appR.bottom + 2 ||
            r.top < appR.top - 2;
          return {
            present: true,
            unread,
            panelOver: +panelOver.toFixed(2),
            vis: +vis.toFixed(1),
            h: +r.height.toFixed(1),
            text: (card.textContent || '').trim().slice(0, 40),
          };
        });
        const cls = !m.present ? 'SKIP' : m.unread ? 'HARD' : m.panelOver > 1.5 ? 'SOFT' : 'ok';
        const tag = `rotate ${loc}@${size.width}x${size.height}`;
        log(`${cls} ${tag}`, `present=${m.present} over=${m.panelOver} vis=${m.vis}/${m.h}`);
        if (cls === 'HARD') hard.push({ tag, screen: 'rotate', loc, w: size.width, h: size.height, cls, ...m });
        else if (cls === 'SOFT') soft.push({ tag, screen: 'rotate', loc, w: size.width, h: size.height, cls, ...m });
        else if (cls === 'ok') ok += 1;
      } finally {
        await page.close();
      }
    }
  }

  // Spot-check OPTIONS from pause @ cliff 340×200 / 390×240 long locales
  log('');
  log('=== D) pause→OPTIONS LATENT spot ===');
  for (const size of [
    { width: 340, height: 200 },
    { width: 390, height: 240 },
    { width: 400, height: 255 },
  ]) {
    for (const loc of ['ru', 'pt', 'es']) {
      const page = await boot(browser, url, size, loc, 'popt');
      try {
        await enterGameplay(page);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(240);
        const optBtn = await page.$('#btn-pause-options');
        if (!optBtn) {
          log(`SKIP pause→opt ${loc}@${size.width}x${size.height}`);
          continue;
        }
        await optBtn.click();
        await page.waitForSelector('#overlay-content.screen-options, #btn-opt-back', {
          timeout: 60000,
        });
        await page.waitForTimeout(200);
        const m = await measureOptions(page);
        const cls = classifyOpt(m);
        const tag = `pause→opt ${loc}@${size.width}x${size.height}`;
        log(
          `${cls} ${tag}`,
          `inflated=${m.inflated} health=${m.healthSteps}`,
          `cta=${m.ctaVis}/${m.ctaH} scrollH=${m.scrollH}`,
        );
        if (m.healthSteps > 0) healthLive += 1;
        const row = { tag, screen: 'pause-opt', loc, w: size.width, h: size.height, cls, ...m };
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
        else ok += 1;
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('');
log(`SUMMARY hard=${hard.length} soft=${soft.length} ok=${ok} optionsHealthLive=${healthLive}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) {
    log(
      `  ${h.tag}`,
      `over=${h.panelOver ?? '-'} inflated=${h.inflated || false}`,
      `ctaOut=${h.ctaOut} ctaVis=${h.ctaVis}/${h.ctaH}`,
      `secOut=${h.secOut || false} health=${h.healthSteps || 0}`,
      `retryOut=${h.retryOut || false} selectOut=${h.selectOut || false}`,
      `labClip=${h.labClip || false} unread=${h.unread || false}`,
    );
  }
}
if (soft.length) {
  log('SOFT DETAIL (first 32):');
  for (const s of soft.slice(0, 32)) {
    log(
      `  ${s.tag}`,
      `over=${s.panelOver ?? '-'} scrollH=${s.scrollH || '-'}`,
      `health=${s.healthSteps || 0}`,
    );
  }
}

const outPath = join(root, 'tools', 'probe-tick168-residual-scan.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length ? 2 : 0);
