/**
 * Tick144: broad thin-viewport muddy scan across select/OPTIONS/tutorial/
 * pause/result + loading/asset-error at short/ultra-short heights.
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
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
}

const LOCALES = ['ko', 'en', 'es', 'ru'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc) {
  const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
  await page.addInitScript(
    ({ loc }) => {
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
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    },
    { loc },
  );
  await page.goto(`${url}?cb=t144s-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

function measure(kind) {
  return async ({ loc, boxOutSrc, kind }) => {
    const boxOut = eval(`(${boxOutSrc})`);
    const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
    if (mod?.setLocale) mod.setLocale(loc);
    const t = mod?.t || ((k) => k);
    const overlay = document.getElementById('overlay');
    const content = document.getElementById('overlay-content');
    const app = document.getElementById('app');
    overlay.classList.add('show');
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    content.style.cssText = '';

    // Mirror real markup closely enough for sync* clones / CSS belts.
    if (kind === 'select') {
      content.className = 'screen-select';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <div class="opt-head">
          <span class="brand-mark">LAO MINI</span>
          <h2>${t('select.h') || 'SELECT'}</h2>
          <span class="Title_Deco" aria-hidden="true"></span>
        </div>
        <p class="select-blurb">${t('select.p') || 'Pick a pilot.'}</p>
        <div class="char-grid">
          ${Array.from({ length: 8 })
            .map(
              (_, i) =>
                `<button class="char-card" type="button"><span class="char-name">Pilot ${i}</span></button>`,
            )
            .join('')}
        </div>
        <div class="select-dossier">
          <div class="dossier-kit">${t('select.kit') || 'Kit line wrap long locale text for dossier.'}</div>
        </div>
        <div class="select-actions pause-actions">
          <button class="btn btn-primary btn-cta" id="btn-confirm">${t('btn.sortie') || 'SORTIE'}</button>
        </div>
        <p class="select-hint">${t('select.hint') || 'hint'}</p>
      `;
      // Mirror select budget from main if not exposed
      const oc = content;
      const appH = app.clientHeight || window.innerHeight || 540;
      const appBoxH = app.getBoundingClientRect().height || appH;
      const fitH = Math.floor(Math.min(appH, appBoxH));
      const ratioCap = Math.floor(fitH * 0.92);
      const floorCap = Math.min(320, fitH);
      oc.style.maxHeight = `${Math.min(680, Math.max(floorCap, ratioCap))}px`;
    } else if (kind === 'options') {
      content.className = 'screen-options';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <div class="opt-head">
          <span class="brand-mark">LAO MINI</span>
          <h2>${t('opt.h') || 'OPTIONS'}</h2>
          <span class="Title_Deco" aria-hidden="true"></span>
        </div>
        <div class="opt-scroll">
          <label class="opt-row"><span>BGM</span><input type="range" /></label>
          <label class="opt-row"><span>SFX</span><input type="range" /></label>
          <label class="opt-row autofire-row"><span>${t('opt.autofire') || 'AUTOFIRE'}</span><input type="checkbox" checked /></label>
          <div class="opt-row mute-fs">
            <button class="btn" id="btn-mute">${t('btn.unmute') || 'Unmute'}</button>
            <button class="btn" id="btn-fs">${t('opt.fullscreen') || 'Fullscreen'}</button>
          </div>
          ${Array.from({ length: 6 })
            .map((_, i) => `<div class="opt-row"><span>Bind ${i}</span><button class="btn">KEY</button></div>`)
            .join('')}
        </div>
        <div class="pause-actions">
          <button class="btn btn-ghost" id="btn-back">${t('btn.back') || 'BACK'}</button>
        </div>
      `;
      const oc = content;
      const appH = app.clientHeight || window.innerHeight || 540;
      const appBoxH = app.getBoundingClientRect().height || appH;
      const fitH = Math.floor(Math.min(appH, appBoxH));
      const ratioCap = Math.floor(fitH * 0.92);
      const floorCap = Math.min(320, fitH);
      oc.style.maxHeight = `${Math.min(680, Math.max(floorCap, ratioCap))}px`;
    } else if (kind === 'tutorial') {
      content.className = 'screen-tutorial';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <div class="opt-head">
          <span class="brand-mark">LAO MINI</span>
          <h2>${t('tut.h') || 'BRIEFING'}</h2>
        </div>
        <span class="tutorial-deco" aria-hidden="true"></span>
        <div class="tutorial-grid">
          ${Array.from({ length: 8 })
            .map(
              (_, i) =>
                `<div class="tut-row"><span class="tut-k">K${i}</span><span class="tut-v">${t('tut.p') || 'Action description wrap'}</span></div>`,
            )
            .join('')}
        </div>
        <p class="tutorial-note">${t('tut.note') || 'Note'}</p>
        <div class="pause-actions">
          <button class="btn btn-primary btn-cta" id="btn-begin">${t('btn.sortie') || 'SORTIE'}</button>
        </div>
      `;
      // Mirror tutorial always-on fitH + short reclaim roughly
      const oc = content;
      const grid = oc.querySelector('.tutorial-grid');
      const deco = oc.querySelector('.tutorial-deco');
      const brand = oc.querySelector('.brand-mark');
      const h2 = oc.querySelector('h2');
      const appH = app.clientHeight || window.innerHeight || 540;
      const appBoxH = app.getBoundingClientRect().height || appH;
      const fitH = Math.floor(Math.min(appH, appBoxH));
      const ratioCap = Math.floor(fitH * 0.92);
      const floorCap = Math.min(300, fitH);
      oc.style.maxHeight = `${Math.min(560, Math.max(floorCap, ratioCap))}px`;
      if (appH <= 480 && deco) deco.style.display = 'none';
      if (appH <= 400) {
        oc.classList.add('is-tut-short');
        if (brand) brand.style.display = 'none';
        if (h2) {
          h2.style.fontSize = '18px';
          h2.style.margin = '0';
        }
      }
      // soft grid floor attempt
      if (grid) {
        const softGridWant = 40;
        const avail = Math.max(0, fitH - 160);
        grid.style.minHeight = `${Math.min(softGridWant, avail)}px`;
      }
    } else if (kind === 'loading') {
      content.className = 'screen-loading';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <span class="brand-mark">LAO MINI</span>
        <h2>${t('load.h') || 'LOADING'}</h2>
        <span class="load-deco" aria-hidden="true"></span>
        <div class="load-bar"><i style="width:55%"></i></div>
        <p class="load-label">${t('load.p') || 'Warming thrusters…'}</p>
      `;
    } else if (kind === 'asset-error') {
      content.className = 'screen-result';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <span class="brand-mark">LAO MINI</span>
        <h2>${t('err.asset') || 'ASSET ERROR'}</h2>
        <p class="pause-blurb">${t('err.asset.p') || 'Failed to load required assets.'}</p>
        <div class="pause-actions">
          <button class="btn btn-primary" id="btn-retry">RETRY</button>
          <button class="btn" id="btn-title">TITLE</button>
        </div>
      `;
    } else if (kind === 'result-midgate') {
      // Probe whether hard mid-ladder returns leave negative headroom before soft last gate
      const I18N = {
        ko: { clear: 'STAGE CLEAR', retry: '다시 도전', title: '타이틀로' },
        en: { clear: 'STAGE CLEAR', retry: 'RETRY', title: 'TITLE' },
        es: { clear: 'STAGE CLEAR', retry: 'REINTENTAR', title: 'TÍTULO' },
        ru: { clear: 'STAGE CLEAR', retry: 'ЕЩЁ РАЗ', title: 'В МЕНЮ' },
      };
      const tt = I18N[loc] || I18N.en;
      content.className = 'screen-result cleared';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <span class="brand-mark">LAO MINI</span>
        <h2>${tt.clear}</h2>
        <span class="result-deco" aria-hidden="true"></span>
        <div class="result-score">
          <div class="cell"><span class="k">SCORE</span><span class="v">999999</span></div>
          <div class="cell"><span class="k">HI</span><span class="v">999999</span></div>
          <div class="cell"><span class="k">RANK</span><span class="v">S</span></div>
        </div>
        <div class="result-meta">
          <div class="cell"><span class="k">TIME</span><span class="v">12:34</span></div>
          <div class="cell"><span class="k">GRAZE</span><span class="v">42</span></div>
          <div class="cell"><span class="k">BOMB</span><span class="v">3</span></div>
          <div class="cell"><span class="k">HIT</span><span class="v">0</span></div>
        </div>
        <div class="result-actions pause-actions">
          <button class="btn btn-primary btn-cta" id="btn-retry">${tt.retry}</button>
          <button class="btn btn-ghost" id="btn-title">${tt.title}</button>
        </div>
      `;
      const oc = content;
      const deco = oc.querySelector('.result-deco');
      const score = oc.querySelector('.result-score');
      const meta = oc.querySelector('.result-meta');
      const brand = oc.querySelector(':scope > .brand-mark');
      const h2 = oc.querySelector(':scope > h2');
      const retry = document.getElementById('btn-retry');
      const titleBtn = document.getElementById('btn-title');
      const panelOver = () => {
        void oc.offsetHeight;
        const appR = app.getBoundingClientRect();
        const ocR = oc.getBoundingClientRect();
        return Math.max(0, ocR.bottom - (appR.bottom + 1), appR.top - 1 - ocR.top);
      };
      const rawHeadroom = () => {
        void oc.offsetHeight;
        const appR = app.getBoundingClientRect();
        const ocR = oc.getBoundingClientRect();
        return appR.bottom - ocR.bottom;
      };
      const appH0 = app.clientHeight || window.innerHeight || 360;
      let stop = 'none';
      let over = panelOver();
      if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) stop = 'early0';
      else {
        if (deco) deco.style.display = 'none';
        over = panelOver();
        if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) stop = 'deco';
        else {
          if (brand) brand.style.marginBottom = '6px';
          if (h2) h2.style.marginBottom = '6px';
          if (score) {
            score.style.marginTop = '4px';
            score.style.marginBottom = '8px';
            score.style.gap = '12px';
          }
          if (meta) {
            meta.style.marginBottom = '8px';
            meta.style.gap = '6px 12px';
          }
          over = panelOver();
          if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) stop = 'margins';
          else {
            oc.classList.add('is-result-short');
            if (brand) brand.style.display = 'none';
            if (h2) {
              h2.style.fontSize = '18px';
              h2.style.margin = '0';
              h2.style.letterSpacing = '0.12em';
            }
            over = panelOver();
            // HARD mid gates as shipped
            if (over <= 1.5) stop = 'head-hard';
            else {
              for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
                cell.style.padding = '2px 4px';
                cell.style.border = 'none';
                cell.style.backgroundImage = 'none';
                cell.style.boxShadow = 'none';
                cell.style.clipPath = 'none';
              }
              over = panelOver();
              if (over <= 1.5) stop = 'cells-hard';
              else {
                oc.style.paddingTop = '18px';
                oc.style.paddingBottom = '12px';
                over = panelOver();
                if (over <= 1.5) stop = 'pad-hard';
                else {
                  if (retry) retry.style.padding = '8px 20px';
                  if (titleBtn) titleBtn.style.padding = '8px 20px';
                  over = panelOver();
                  if (over <= 1.5 && !(appH0 <= 340 && rawHeadroom() < 8)) stop = 'cta-soft-skip';
                  else {
                    const appBoxH = app.getBoundingClientRect().height || appH0;
                    const fitH = Math.floor(Math.min(appH0, appBoxH));
                    const ratioCap = Math.floor(fitH * 0.96);
                    const floorCap = Math.min(260, fitH);
                    oc.style.maxHeight = `${Math.max(floorCap, ratioCap)}px`;
                    stop = 'last-resort';
                  }
                }
              }
            }
          }
        }
      }
      void oc.offsetHeight;
      const appR = app.getBoundingClientRect();
      const ocR = oc.getBoundingClientRect();
      return {
        kind,
        loc,
        stop,
        panelOverRaw: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
        headroom: +(appR.bottom - ocR.bottom).toFixed(2),
        maxH: +(parseFloat(oc.style.maxHeight) || 0).toFixed(2),
        ctaOut: retry ? boxOut(retry, appR) : true,
        appBox: +appR.height.toFixed(2),
        softNeed: appH0 <= 340 && rawHeadroom() < 8,
      };
    }

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    void content.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = content.getBoundingClientRect();
    const cta =
      content.querySelector('#btn-confirm') ||
      content.querySelector('#btn-back') ||
      content.querySelector('#btn-begin') ||
      content.querySelector('#btn-retry') ||
      content.querySelector('.btn-cta') ||
      content.querySelector('.menu-btn') ||
      content.querySelector('button');
    const quit = content.querySelector('#btn-quit') || content.querySelector('#btn-title');
    const grid =
      content.querySelector('.char-grid') ||
      content.querySelector('.tutorial-grid') ||
      content.querySelector('.opt-scroll');
    const panelOverRaw = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
    const headroom = appR.bottom - ocR.bottom;
    const ctaOut = cta ? boxOut(cta, appR) : false;
    const quitOut = quit ? boxOut(quit, appR) : false;
    const label = content.querySelector('h2, .load-label, .pause-blurb');
    const labelOut = label ? boxOut(label, appR) : false;
    return {
      kind,
      loc,
      panelOverRaw: +panelOverRaw.toFixed(2),
      headroom: +headroom.toFixed(2),
      maxH: +(parseFloat(content.style.maxHeight) || 0).toFixed(2),
      ctaOut,
      quitOut,
      labelOut,
      gridH: grid ? +grid.getBoundingClientRect().height.toFixed(2) : null,
      appBox: +appR.height.toFixed(2),
      muddy: panelOverRaw > 1.5 || headroom < -1.5 || ctaOut || quitOut || labelOut,
    };
  };
}

try {
  for (const kind of ['select', 'options', 'tutorial', 'loading', 'asset-error', 'result-midgate']) {
    for (const size of SIZES) {
      for (const loc of LOCALES) {
        const page = await boot(size, loc);
        try {
          const row = await page.evaluate(measure(kind), {
            loc,
            boxOutSrc: boxOut.toString(),
            kind,
          });
          findings.push({ size: `${size.width}x${size.height}`, ...row });
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

const muddy = findings.filter((f) => f.muddy || (f.panelOverRaw > 1.5) || (f.headroom < -1.5) || f.ctaOut || f.quitOut || f.labelOut);
const midHardNeg = findings.filter(
  (f) =>
    f.kind === 'result-midgate' &&
    (f.stop === 'head-hard' || f.stop === 'cells-hard' || f.stop === 'pad-hard') &&
    (f.headroom < 0 || f.panelOverRaw > 0.15),
);

console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      muddy: muddy.slice(0, 40),
      midHardNeg,
      byKindSize: Object.fromEntries(
        [...new Set(findings.map((f) => `${f.kind}@${f.size}`))].map((key) => {
          const rows = findings.filter((f) => `${f.kind}@${f.size}` === key);
          const m = rows.filter(
            (f) => f.muddy || f.panelOverRaw > 1.5 || f.headroom < -1.5 || f.ctaOut || f.quitOut || f.labelOut,
          );
          const s = rows.find((r) => r.loc === 'ko') || rows[0];
          return [
            key,
            {
              muddy: m.length,
              sample: {
                loc: s.loc,
                headroom: s.headroom,
                panelOverRaw: s.panelOverRaw,
                maxH: s.maxH,
                ctaOut: s.ctaOut,
                quitOut: s.quitOut,
                labelOut: s.labelOut,
                gridH: s.gridH,
                stop: s.stop,
              },
            },
          ];
        }),
      ),
    },
    null,
    2,
  ),
);
