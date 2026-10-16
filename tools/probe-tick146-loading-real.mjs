/**
 * Tick146: re-check loading panelOver with REAL i18n load.* strings
 * (not invent long labels). Also measure touch-hud pad/HUD geometry @400×280.
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

function overlaps(a, b, pad = 1) {
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

const LOCALES = ['ko', 'en', 'ja', 'pt', 'es', 'ru', 'zh-TW', 'zh-CN'];
const LOAD_KEYS = [
  'load.preparing',
  'load.bg',
  'load.titleReady',
  'load.selectReady',
  'load.sortieReady',
  'load.eager',
  'load.sortieReadyEager',
];
const SIZES = [
  { width: 800, height: 450 },
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
  { width: 360, height: 240 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const muddyLoad = [];
const padFindings = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
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
        await page.goto(`${url}?cb=t146r-${Date.now()}-${loc}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const rows = await page.evaluate(({ loadKeys }) => {
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
            <p id="loading-label"></p>
            <div class="load-track" aria-hidden="true">
              <div class="load-fill" id="load-fill" style="width:55%"></div>
            </div>
            <div class="load-meta">
              <span id="load-count">12 / 22</span>
              <span id="load-pct">55%</span>
            </div>
          `;
          const dict = window.__i18n || null;
          // Pull strings from DOM-applied i18n via data attributes isn't available;
          // read from visible t() if exported, else from document lang packs via meta.
          const t = window.t || ((k) => k);
          const app = document.getElementById('app');
          const out = [];
          for (const key of loadKeys) {
            const lab = document.getElementById('loading-label');
            lab.textContent = typeof t === 'function' ? t(key) : key;
            void content.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            out.push({
              key,
              text: lab.textContent,
              ocH: +ocR.height.toFixed(2),
              panelOver: +panelOver.toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              labelH: +lab.getBoundingClientRect().height.toFixed(2),
              brandH: +(content.querySelector('.brand-mark')?.getBoundingClientRect().height || 0).toFixed(2),
              decoDisplay: getComputedStyle(content.querySelector('.loading-deco')).display,
            });
          }
          return out;
        }, { loadKeys: LOAD_KEYS });

        for (const r of rows) {
          if (r.panelOver > 1.5) {
            muddyLoad.push({ loc, ...size, ...r });
            console.log(
              `LOAD-MUDDY ${loc}@${size.width}x${size.height} ${r.key}`,
              `over=${r.panelOver} hr=${r.headroom} ocH=${r.ocH} labelH=${r.labelH}`,
              `| ${r.text}`,
            );
          } else if (size.height <= 280) {
            console.log(
              `LOAD-ok ${loc}@${size.width}x${size.height} ${r.key}`,
              `over=${r.panelOver} hr=${r.headroom} ocH=${r.ocH}`,
              `| ${r.text}`,
            );
          }
        }
      } finally {
        await page.close();
      }
    }
  }

  // Touch pad geometry detail @400×280 / @480×288 / @360×240
  for (const size of [
    { width: 568, height: 320 },
    { width: 480, height: 288 },
    { width: 400, height: 280 },
    { width: 360, height: 240 },
  ]) {
    const page = await browser.newPage({
      viewport: size,
      hasTouch: true,
      isMobile: true,
    });
    try {
      await page.addInitScript(() => {
        localStorage.setItem(
          'lao_mini_settings_v1',
          JSON.stringify({
            lang: 'en',
            muted: true,
            bgmVolume: 0,
            sfxVolume: 0,
            autoFire: true,
            padMode: 'fixed',
            fullscreen: false,
          }),
        );
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      });
      await page.goto(`${url}?cb=t146p-${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const geo = await page.evaluate((overlapsSrc) => {
        const overlaps = eval(`(${overlapsSrc})`);
        document.body.classList.add('touch-ui', 'has-touch-pads');
        const tc = document.getElementById('touch-controls');
        tc.classList.add('is-on');
        tc.setAttribute('aria-hidden', 'false');
        const overlay = document.getElementById('overlay');
        overlay.classList.remove('show');
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        void tc.offsetHeight;
        const app = document.getElementById('app').getBoundingClientRect();
        const R = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            l: +r.left.toFixed(1),
            t: +r.top.toFixed(1),
            r: +r.right.toFixed(1),
            b: +r.bottom.toFixed(1),
            w: +r.width.toFixed(1),
            h: +r.height.toFixed(1),
          };
        };
        const stick = R('.tc-stick-zone');
        const actions = R('.tc-actions');
        const bottom = R('.hud-bottom');
        const stocks = R('.hud-stocks');
        const gauges = R('.hud-gauges');
        const cs = getComputedStyle(document.querySelector('.hud-bottom'));
        const overlapStickStocks =
          stick && stocks
            ? overlaps(
                { left: stick.l, top: stick.t, right: stick.r, bottom: stick.b },
                { left: stocks.l, top: stocks.t, right: stocks.r, bottom: stocks.b },
                2,
              )
            : false;
        const overlapActGauges =
          actions && gauges
            ? overlaps(
                { left: actions.l, top: actions.t, right: actions.r, bottom: actions.b },
                { left: gauges.l, top: gauges.t, right: gauges.r, bottom: gauges.b },
                2,
              )
            : false;
        const gapStickStocks = stocks && stick ? +(stocks.l - stick.r).toFixed(1) : null;
        const gapGaugesAct = gauges && actions ? +(actions.l - gauges.r).toFixed(1) : null;
        return {
          appW: +app.width.toFixed(1),
          appH: +app.height.toFixed(1),
          stick,
          actions,
          bottom,
          stocks,
          gauges,
          hudLeft: cs.left,
          hudRight: cs.right,
          hudBottom: cs.bottom,
          overlapStickStocks,
          overlapActGauges,
          gapStickStocks,
          gapGaugesAct,
        };
      }, overlaps.toString());
      padFindings.push({ ...size, ...geo });
      console.log(
        `PAD-GEO @${size.width}x${size.height}`,
        `hudL=${geo.hudLeft} hudR=${geo.hudRight}`,
        `gapStickStocks=${geo.gapStickStocks} gapGaugesAct=${geo.gapGaugesAct}`,
        `ovStickStocks=${geo.overlapStickStocks} ovActGauges=${geo.overlapActGauges}`,
        `stocks=${JSON.stringify(geo.stocks)} gauges=${JSON.stringify(geo.gauges)}`,
        `stick=${JSON.stringify(geo.stick)} actions=${JSON.stringify(geo.actions)}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== LOAD muddy with REAL i18n ===', muddyLoad.length);
for (const r of muddyLoad) {
  console.log(
    `${r.loc}@${r.width}x${r.height} ${r.key} over=${r.panelOver} | ${r.text}`,
  );
}
console.log(
  'PAD overlap sizes:',
  padFindings.filter((p) => p.overlapStickStocks || p.overlapActGauges).map((p) => `${p.width}x${p.height}`),
);
