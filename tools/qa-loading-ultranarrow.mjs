/**
 * Tick151: loading ultra-narrow letterbox reclaim — CSS markers + live
 * panelOver clear @320×(180–280) with real long eager strings.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK151 — loading ultra-narrow letterbox reclaim/);
const idx = css.indexOf('TICK151 — loading ultra-narrow letterbox reclaim');
const block = css.slice(idx, idx + 1200);
assert.match(
  block,
  /max-width:\s*320px\)\s*and\s*\(orientation:\s*landscape\)/,
);
assert.match(block, /screen-loading[\s\S]{0,120}?max-height:\s*100%/);
assert.match(
  block,
  /screen-loading \.brand-mark\s*\{\s*display:\s*none/,
);
// Do not invent h2/label/track compact — brand belt alone clears ≤180.
assert.doesNotMatch(block, /screen-loading h2\s*\{/);
// Prior loading chrome kept
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /\.lao-newui \.loading-deco\s*\{/);
assert.match(css, /#overlay-content\.screen-loading #loading-label/);

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
  { width: 360, height: 240 },
  { width: 400, height: 280 },
];
const TEXT = 'Carregando todos os recursos (eager)…';

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: size });
    try {
      await page.goto(`${url}?cb=qa151-${size.width}x${size.height}`, {
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
        const brand = content.querySelector('.brand-mark');
        const track = content.querySelector('.load-track');
        const lab = document.getElementById('loading-label');
        const meta = content.querySelector('.load-meta');
        const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
        const visH = (el) => {
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          return Math.max(0, Math.min(r.bottom, ocR.bottom) - Math.max(r.top, ocR.top));
        };
        return {
          panelOver: +panelOver.toFixed(2),
          headroom: +(appR.bottom - ocR.bottom).toFixed(2),
          ocH: +ocR.height.toFixed(2),
          appH: +appR.height.toFixed(2),
          brandDisp: getComputedStyle(brand).display,
          trackVis: +visH(track).toFixed(2),
          trackH: +track.getBoundingClientRect().height.toFixed(2),
          labVis: +visH(lab).toFixed(2),
          labH: +lab.getBoundingClientRect().height.toFixed(2),
          metaVis: +visH(meta).toFixed(2),
          metaH: +meta.getBoundingClientRect().height.toFixed(2),
          maxH: getComputedStyle(content).maxHeight,
        };
      }, TEXT);

      assert.ok(
        m.panelOver <= 1.5,
        `@${size.width}x${size.height} panelOver=${m.panelOver}`,
      );
      assert.ok(
        m.trackVis >= m.trackH - 1,
        `@${size.width}x${size.height} track clipped vis=${m.trackVis}/${m.trackH}`,
      );
      assert.ok(
        m.labVis >= m.labH - 1,
        `@${size.width}x${size.height} label clipped vis=${m.labVis}/${m.labH}`,
      );
      assert.ok(
        m.metaVis >= m.metaH - 1,
        `@${size.width}x${size.height} meta clipped vis=${m.metaVis}/${m.metaH}`,
      );
      if (size.width <= 320 && size.height <= 420) {
        assert.equal(m.brandDisp, 'none', 'brand reclaimed @≤320');
        assert.ok(
          m.maxH === '100%' || parseFloat(m.maxH) >= m.appH - 1,
          `max-height prefers app box, got ${m.maxH}`,
        );
      }
      if (size.width >= 360) {
        assert.notEqual(m.brandDisp, 'none', 'brand kept @≥360');
      }
      console.log(
        `PASS @${size.width}x${size.height}`,
        `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
        `brand=${m.brandDisp} maxH=${m.maxH}`,
        `track=${m.trackVis}/${m.trackH} lab=${m.labVis}/${m.labH} meta=${m.metaVis}/${m.metaH}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('qa-loading-ultranarrow: PASS');
