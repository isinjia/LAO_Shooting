/**
 * Tick152 — asset-error ultra-narrow detail: what reclaim clears CTAs @appH=180.
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

const MODES = [
  'baseline',
  'maxH100',
  'maxH100+brand',
  'maxH100+brand+rowBtns',
  'maxH100+brand+compactPad',
  'maxH100+brand+rowBtns+compactPad',
  'maxH100+brand+rowBtns+h2shrink',
];

const SIZES = [
  { width: 320, height: 180 },
  { width: 320, height: 200 },
  { width: 320, height: 240 },
  { width: 320, height: 280 },
  { width: 360, height: 240 },
  { width: 400, height: 280 },
];

const H2 = 'Falha ao carregar o estágio 1'; // long pt
const MSG = 'ASSET LOAD FAILED: stage01/boss_core.png';

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const mode of MODES) {
    console.log(`\n=== MODE ${mode} ===`);
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t152d-${mode}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate(
          ({ h2, msg, mode }) => {
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
              <button class="btn btn-primary" id="btn-asset-retry">Tentar de novo</button>
              <button class="btn" id="btn-asset-select">À seleção</button>
            `;
            // Simulated reclaim modes (inline, not persisted)
            if (mode.includes('maxH100')) {
              content.style.maxHeight = '100%';
            }
            if (mode.includes('brand')) {
              const b = content.querySelector('.brand-mark');
              if (b) b.style.display = 'none';
            }
            if (mode.includes('rowBtns')) {
              content.style.display = 'flex';
              content.style.flexWrap = 'wrap';
              content.style.justifyContent = 'center';
              content.style.alignItems = 'center';
              content.style.gap = '6px';
              const retry = document.getElementById('btn-asset-retry');
              const sel = document.getElementById('btn-asset-select');
              retry.style.minHeight = '36px';
              retry.style.padding = '8px 12px';
              retry.style.margin = '0';
              sel.style.minHeight = '36px';
              sel.style.padding = '8px 12px';
              sel.style.margin = '0';
              // force side-by-side: wrap after deco
              const wrap = document.createElement('div');
              wrap.style.cssText = 'display:flex;gap:6px;justify-content:center;width:100%;flex:1 0 100%';
              retry.parentNode.insertBefore(wrap, retry);
              wrap.appendChild(retry);
              wrap.appendChild(sel);
            }
            if (mode.includes('compactPad')) {
              content.style.paddingTop = '8px';
              content.style.paddingBottom = '8px';
              const msgEl = content.querySelector('.asset-error-msg');
              if (msgEl) {
                msgEl.style.padding = '4px 8px';
                msgEl.style.marginBottom = '6px';
              }
            }
            if (mode.includes('h2shrink')) {
              const h2el = content.querySelector('h2');
              if (h2el) {
                h2el.style.fontSize = '14px';
                h2el.style.margin = '0 0 4px';
                h2el.style.letterSpacing = '0.06em';
              }
            }
            void content.offsetHeight;
            const appR = document.getElementById('app').getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const retry = document.getElementById('btn-asset-retry');
            const sel = document.getElementById('btn-asset-select');
            const out = (el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
            };
            const vis = (el) => {
              const r = el.getBoundingClientRect();
              return Math.max(0, Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top));
            };
            return {
              panelOver: +panelOver.toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              ocH: +ocR.height.toFixed(2),
              appH: +appR.height.toFixed(2),
              retryOut: out(retry),
              selOut: out(sel),
              rVis: +vis(retry).toFixed(2),
              sVis: +vis(sel).toFixed(2),
              rH: +retry.getBoundingClientRect().height.toFixed(2),
              sH: +sel.getBoundingClientRect().height.toFixed(2),
              h2H: +content.querySelector('h2').getBoundingClientRect().height.toFixed(2),
              msgH: +content.querySelector('.asset-error-msg').getBoundingClientRect().height.toFixed(2),
            };
          },
          { h2: H2, msg: MSG, mode },
        );
        const bad = m.panelOver > 1.5 || m.retryOut || m.selOut || m.rVis < 28 || m.sVis < 28;
        console.log(
          `${bad ? 'HARD' : 'ok'} @${size.width}x${size.height}`,
          `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
          `h2=${m.h2H} msg=${m.msgH}`,
          `rOut=${m.retryOut} sOut=${m.selOut} rVis=${m.rVis}/${m.rH} sVis=${m.sVis}/${m.sH}`,
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
