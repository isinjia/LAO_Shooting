/**
 * Tick152: asset-error ultra-narrow letterbox reclaim — CSS markers + live
 * CTA visibility @≤360 short-landscape with real long i18n h2/buttons.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK152 — asset-error ultra-narrow letterbox reclaim/);
const idx = css.indexOf('TICK152 — asset-error ultra-narrow letterbox reclaim');
const block = css.slice(idx, idx + 2200);
assert.match(
  block,
  /max-width:\s*360px\)\s*and\s*\(orientation:\s*landscape\)/,
);
assert.match(block, /screen-asset-error[\s\S]{0,160}?max-height:\s*100%/);
assert.match(
  block,
  /screen-asset-error > \.brand-mark\s*\{\s*display:\s*none/,
);
assert.match(block, /screen-asset-error > h2\s*\{/);
assert.match(block, /font-size:\s*14px/);
assert.match(block, /screen-asset-error > \.btn\s*\{/);
assert.match(block, /flex:\s*0 1 auto/);
// Prior asset-error chrome kept
assert.match(css, /TICK43 — asset-error overlay NewUI residual/);
assert.match(css, /TICK151 — loading ultra-narrow letterbox reclaim/);
assert.match(css, /\.lao-newui #overlay-content\.screen-asset-error \.asset-error-msg/);

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

const CASES = [
  {
    size: { width: 320, height: 180 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
  },
  {
    size: { width: 320, height: 240 },
    h2: 'Не удалось загрузить стадию 1',
    retry: 'Повторить',
    select: 'К выбору',
  },
  {
    size: { width: 320, height: 280 },
    h2: 'ステージ 1 読み込み失敗',
    retry: '再試行',
    select: '選択へ',
  },
  {
    size: { width: 342, height: 200 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
  },
  {
    size: { width: 360, height: 200 },
    h2: 'Не удалось загрузить стадию 1',
    retry: 'Повторить',
    select: 'К выбору',
  },
  {
    size: { width: 360, height: 240 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
  },
  {
    size: { width: 400, height: 280 },
    h2: 'Stage 1 load failed',
    retry: 'Retry',
    select: 'To select',
  },
  {
    size: { width: 568, height: 320 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
  },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  for (const { size, h2, retry, select } of CASES) {
    const page = await browser.newPage({ viewport: size });
    try {
      await page.goto(`${url}?cb=qa152-${size.width}x${size.height}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const m = await page.evaluate(
        ({ h2, retry, select }) => {
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
          const retryBtn = document.getElementById('btn-asset-retry');
          const selBtn = document.getElementById('btn-asset-select');
          const msg = content.querySelector('.asset-error-msg');
          const h2el = content.querySelector('h2');
          const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
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
            maxH: getComputedStyle(content).maxHeight,
            brandDisp: getComputedStyle(brand).display,
            h2H: +h2el.getBoundingClientRect().height.toFixed(2),
            msgVis: +vis(msg).toFixed(2),
            msgH: +msg.getBoundingClientRect().height.toFixed(2),
            retryOut: out(retryBtn),
            selOut: out(selBtn),
            rVis: +vis(retryBtn).toFixed(2),
            sVis: +vis(selBtn).toFixed(2),
            rH: +retryBtn.getBoundingClientRect().height.toFixed(2),
            sH: +selBtn.getBoundingClientRect().height.toFixed(2),
          };
        },
        { h2, retry, select },
      );

      assert.equal(m.retryOut, false, `@${size.width}x${size.height} retry OOB`);
      assert.equal(m.selOut, false, `@${size.width}x${size.height} select OOB`);
      assert.ok(
        m.rVis >= m.rH - 2,
        `@${size.width}x${size.height} retry clipped vis=${m.rVis}/${m.rH}`,
      );
      assert.ok(
        m.sVis >= m.sH - 2,
        `@${size.width}x${size.height} select clipped vis=${m.sVis}/${m.sH}`,
      );
      assert.ok(
        m.msgVis >= m.msgH - 2,
        `@${size.width}x${size.height} msg clipped vis=${m.msgVis}/${m.msgH}`,
      );

      if (size.width <= 360 && size.height <= 420) {
        assert.equal(m.brandDisp, 'none', 'brand reclaimed @≤360');
        assert.ok(
          m.maxH === '100%' || parseFloat(m.maxH) >= m.appH - 1,
          `max-height prefers app box, got ${m.maxH}`,
        );
        assert.ok(m.panelOver <= 1.5, `@≤360 panelOver=${m.panelOver}`);
        assert.ok(m.h2H <= 28, `h2 should stay single-line-ish, got ${m.h2H}`);
      }
      if (size.width >= 400) {
        assert.notEqual(m.brandDisp, 'none', 'brand kept @≥400');
        // Soft panelOver≤3 tolerated when CTAs fully visible (pt/ru @400×280).
        assert.ok(
          m.panelOver <= 3.5,
          `@≥400 panelOver=${m.panelOver} beyond soft band`,
        );
      }

      console.log(
        `PASS @${size.width}x${size.height}`,
        `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
        `brand=${m.brandDisp} maxH=${m.maxH} h2=${m.h2H}`,
        `rVis=${m.rVis}/${m.rH} sVis=${m.sVis}/${m.sH} msg=${m.msgVis}/${m.msgH}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('qa-asset-error-ultranarrow: PASS');
