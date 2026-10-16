/**
 * Tick144: scan thin-viewport residual muddy for one shippable fix.
 * Prefer pause/tutorial soft-continue / fitH parity gaps at short/ultra-short.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
  { width: 640, height: 360 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc, tag) {
  const page = await browser.newPage({
    viewport: size,
    hasTouch: false,
    isMobile: false,
  });
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
  await page.goto(`${url}?cb=${tag}-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

function measureOverlay(kind) {
  return ({ loc, boxOutSrc, kind }) => {
    const boxOut = eval(`(${boxOutSrc})`);
    const overlay = document.getElementById('overlay');
    const content = document.getElementById('overlay-content');
    const app = document.getElementById('app');
    overlay.classList.add('show');
    overlay.classList.remove('hidden');
    content.style.cssText = '';

    if (kind === 'pause') {
      content.className = 'screen-pause';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <div class="pause-stamp">
          <div class="brand-mark" aria-hidden="true">LAO MINI</div>
          <h2>SYSTEM HOLD</h2>
        </div>
        <div class="pause-deco" aria-hidden="true"></div>
        <p class="pause-blurb">Paused. Resume when ready.</p>
        <div class="pause-actions">
          <button type="button" class="menu-btn" id="btn-resume">RESUME</button>
          <button type="button" class="menu-btn" id="btn-retry-pause">RETRY</button>
          <button type="button" class="menu-btn" id="btn-options-pause">OPTIONS</button>
          <button type="button" class="menu-btn" id="btn-quit">QUIT</button>
        </div>`;
      if (typeof window.syncPausePanelBudget === 'function') window.syncPausePanelBudget();
      else {
        // fall through to exposed path via screen switch
      }
    } else if (kind === 'tutorial') {
      content.className = 'screen-tutorial';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <div class="opt-head">
          <div class="brand-mark" aria-hidden="true">LAO MINI</div>
          <h2>BRIEFING</h2>
        </div>
        <div class="tutorial-deco" aria-hidden="true"></div>
        <div class="tutorial-grid">
          ${Array.from({ length: 6 })
            .map(
              (_, i) =>
                `<div class="tut-row"><span class="tut-k">KEY${i}</span><span class="tut-v">Action ${i} long locale wrap text</span></div>`,
            )
            .join('')}
        </div>
        <p class="tutorial-note">Note line for locale wrap.</p>
        <div class="pause-actions">
          <button type="button" class="menu-btn" id="btn-tut-go">SORTIE</button>
        </div>`;
    } else if (kind === 'result') {
      const I18N = {
        ko: { clear: 'STAGE CLEAR', retry: '다시 도전', title: '타이틀로' },
        en: { clear: 'STAGE CLEAR', retry: 'RETRY', title: 'TITLE' },
        pt: { clear: 'STAGE CLEAR', retry: 'TENTAR DE NOVO', title: 'TÍTULO' },
        es: { clear: 'STAGE CLEAR', retry: 'REINTENTAR', title: 'TÍTULO' },
        ru: { clear: 'STAGE CLEAR', retry: 'ЕЩЁ РАЗ', title: 'В МЕНЮ' },
        ja: { clear: 'STAGE CLEAR', retry: 'リトライ', title: 'タイトルへ' },
      };
      const t = I18N[loc] || I18N.en;
      content.className = 'screen-result cleared';
      content.innerHTML = `
        <div class="panel-frame" aria-hidden="true"></div>
        <div class="brand-mark" aria-hidden="true">LAO MINI</div>
        <h2>${t.clear}</h2>
        <div class="result-deco" aria-hidden="true"></div>
        <div class="result-score">
          <div class="cell"><span class="k">SCORE</span><span class="v">999999</span></div>
          <div class="cell"><span class="k">HISCORE</span><span class="v">999999</span></div>
        </div>
        <div class="result-meta">
          <div class="cell"><span class="k">TIME</span><span class="v">99:99</span></div>
          <div class="cell"><span class="k">GRADE</span><span class="v">S</span></div>
        </div>
        <div class="pause-actions">
          <button type="button" class="menu-btn" id="btn-retry">${t.retry}</button>
          <button type="button" class="menu-btn" id="btn-title">${t.title}</button>
        </div>`;
    }

    // Trigger budget via public resize path if available
    const screen = kind === 'pause' ? 'pause' : kind === 'tutorial' ? 'tutorial' : 'result';
    if (typeof window.__laoSyncBudget === 'function') window.__laoSyncBudget(screen);
    else {
      window.dispatchEvent(new Event('resize'));
    }
    // Direct call if exported on window for probes
    const fn =
      kind === 'pause'
        ? window.syncPausePanelBudget
        : kind === 'tutorial'
          ? window.syncTutorialPanelBudget
          : window.syncResultPanelBudget;
    if (typeof fn === 'function') fn();

    void content.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = content.getBoundingClientRect();
    const panelOverRaw = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
    const panelOverTol = Math.max(
      0,
      ocR.bottom - (appR.bottom + 1),
      appR.top - 1 - ocR.top,
    );
    const headroom = appR.bottom - ocR.bottom;
    const maxH = parseFloat(content.style.maxHeight) || 0;
    const cta =
      content.querySelector('#btn-resume') ||
      content.querySelector('#btn-tut-go') ||
      content.querySelector('#btn-retry');
    const quit = content.querySelector('#btn-quit');
    const grid = content.querySelector('.tutorial-grid');
    const muddy =
      panelOverRaw > 1.5 ||
      headroom < -1.5 ||
      (cta && boxOut(cta, appR)) ||
      (quit && boxOut(quit, appR));

    return {
      kind,
      loc,
      appH: app.clientHeight,
      appBox: Math.round(appR.height * 100) / 100,
      clientH: document.documentElement.clientHeight,
      panelOverRaw: Math.round(panelOverRaw * 100) / 100,
      panelOverTol: Math.round(panelOverTol * 100) / 100,
      headroom: Math.round(headroom * 100) / 100,
      maxH,
      ctaOut: !!(cta && boxOut(cta, appR)),
      quitOut: !!(quit && boxOut(quit, appR)),
      gridH: grid ? Math.round(grid.getBoundingClientRect().height * 100) / 100 : null,
      shortClass: content.classList.contains('is-pause-short') || content.classList.contains('is-result-short') || content.classList.contains('is-tut-short'),
      muddy,
    };
  };
}

try {
  for (const kind of ['pause', 'result', 'tutorial']) {
    for (const size of SIZES) {
      for (const loc of LOCALES) {
        const page = await boot(size, loc, 't144');
        try {
          // Inject sync helpers onto window by evaluating from page scripts already loaded
          await page.evaluate(() => {
            // Try to reach sync* via overlay show path used by game
            if (!window.syncPausePanelBudget) {
              // no-op; probe will dispatch resize after mounting markup via show paths
            }
          });

          // Prefer real game APIs if present
          const result = await page.evaluate(async ({ loc, kind }) => {
            const boxOut = (el, box) => {
              if (!el || !box) return false;
              const r = el.getBoundingClientRect();
              return (
                r.bottom > box.bottom + 1.5 ||
                r.top < box.top - 1.5 ||
                r.right > box.right + 1.5
              );
            };
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            const app = document.getElementById('app');

            // Use real show paths when available
            if (kind === 'pause' && typeof window.showPause === 'function') {
              window.showPause();
            } else if (kind === 'tutorial' && typeof window.showTutorial === 'function') {
              window.showTutorial();
            } else if (kind === 'result' && typeof window.showResult === 'function') {
              window.showResult(true, { score: 999999, hiscore: 999999, time: '99:99', grade: 'S' });
            } else {
              // Fallback markup + resize (sync* are module-scoped; trigger via known buttons)
              overlay.classList.add('show');
              overlay.classList.remove('hidden');
              if (kind === 'pause') {
                // Click path: start then pause is heavy — mount via overlay helpers if any
                const start = document.getElementById('btn-start');
                // Force overlay content by calling game internals through custom event
                content.className = 'screen-pause';
                content.innerHTML = document.querySelector('#overlay-content')?.innerHTML || '';
              }
            }

            // Wait 2 frames for budget sync
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

            void content.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const panelOverRaw = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const panelOverTol = Math.max(
              0,
              ocR.bottom - (appR.bottom + 1),
              appR.top - 1 - ocR.top,
            );
            const headroom = appR.bottom - ocR.bottom;
            const maxH = parseFloat(content.style.maxHeight) || 0;
            const cta =
              content.querySelector('#btn-resume') ||
              content.querySelector('#btn-begin') ||
              content.querySelector('#btn-tut-go') ||
              content.querySelector('#btn-retry') ||
              content.querySelector('.pause-actions .menu-btn');
            const quit = content.querySelector('#btn-quit');
            const grid = content.querySelector('.tutorial-grid');
            const muddy =
              panelOverRaw > 1.5 ||
              headroom < -1.5 ||
              (cta && boxOut(cta, appR)) ||
              (quit && boxOut(quit, appR));

            return {
              kind,
              loc,
              screenClass: content.className,
              appH: app.clientHeight,
              appBox: Math.round(appR.height * 100) / 100,
              panelOverRaw: Math.round(panelOverRaw * 100) / 100,
              panelOverTol: Math.round(panelOverTol * 100) / 100,
              headroom: Math.round(headroom * 100) / 100,
              maxH,
              ctaOut: !!(cta && boxOut(cta, appR)),
              quitOut: !!(quit && boxOut(quit, appR)),
              gridH: grid ? Math.round(grid.getBoundingClientRect().height * 100) / 100 : null,
              shortClass:
                content.classList.contains('is-pause-short') ||
                content.classList.contains('is-result-short') ||
                content.classList.contains('is-tut-short'),
              muddy,
              htmlLen: content.innerHTML.length,
            };
          }, { loc, kind });

          findings.push({
            size: `${size.width}x${size.height}`,
            ...result,
          });
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

const muddy = findings.filter((f) => f.muddy);
const byKind = {};
for (const f of findings) {
  const key = `${f.kind}@${f.size}`;
  if (!byKind[key]) byKind[key] = [];
  byKind[key].push(f);
}

console.log('=== MUDDY ===');
console.log(JSON.stringify(muddy, null, 2));
console.log('\n=== SUMMARY (first locale sample per size/kind) ===');
for (const [key, rows] of Object.entries(byKind)) {
  const sample = rows.find((r) => r.loc === 'ko') || rows[0];
  const muddyCount = rows.filter((r) => r.muddy).length;
  console.log(
    `${key}: muddy=${muddyCount}/${rows.length} maxH=${sample.maxH} headroom=${sample.headroom} panelOverRaw=${sample.panelOverRaw} ctaOut=${sample.ctaOut} quitOut=${sample.quitOut} gridH=${sample.gridH} class=${sample.screenClass}`,
  );
}
