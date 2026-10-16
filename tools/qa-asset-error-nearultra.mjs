/**
 * Tick154: asset-error near-ultra letterbox CTA reclaim @361–380 —
 * CSS markers + live CTA visibility with real long i18n (ja HARD case).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK154 — asset-error near-ultra letterbox CTA reclaim/);
const idx = css.indexOf('TICK154 — asset-error near-ultra letterbox CTA reclaim');
const block = css.slice(idx, idx + 1800);
assert.match(
  block,
  /min-width:\s*361px\)\s*and\s*\(max-width:\s*380px\)\s*and\s*\(orientation:\s*landscape\)/,
);
assert.match(block, /screen-asset-error[\s\S]{0,160}?max-height:\s*100%/);
assert.match(
  block,
  /screen-asset-error > \.brand-mark\s*\{\s*display:\s*none/,
);
assert.match(block, /screen-asset-error > h2\s*\{/);
assert.match(block, /font-size:\s*14px/);
// Prior ships kept
assert.match(css, /TICK152 — asset-error ultra-narrow letterbox reclaim/);
assert.match(css, /TICK153 — loading near-ultra letterbox cliff reclaim/);
assert.match(css, /TICK43 — asset-error overlay NewUI residual/);

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
    size: { width: 380, height: 240 },
    h2: 'ステージ 1 読み込み失敗',
    retry: '再試行',
    select: '選択へ',
    expectBrand: 'none',
  },
  {
    size: { width: 380, height: 220 },
    h2: 'ステージ 1 読み込み失敗',
    retry: '再試行',
    select: '選択へ',
    expectBrand: 'none',
  },
  {
    size: { width: 380, height: 200 },
    h2: 'ステージ 1 読み込み失敗',
    retry: '再試行',
    select: '選択へ',
    expectBrand: 'none',
  },
  {
    size: { width: 380, height: 240 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'none',
  },
  {
    size: { width: 361, height: 240 },
    h2: 'Не удалось загрузить стадию 1',
    retry: 'Повторить',
    select: 'К выбору',
    expectBrand: 'none',
  },
  {
    size: { width: 360, height: 240 },
    h2: 'ステージ 1 読み込み失敗',
    retry: '再試行',
    select: '選択へ',
    expectBrand: 'none', // tick152
  },
  {
    size: { width: 400, height: 240 },
    h2: 'ステージ 1 読み込み失敗',
    retry: '再試行',
    select: '選択へ',
    expectBrand: 'keep',
  },
  {
    size: { width: 400, height: 280 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'keep',
  },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  for (const { size, h2, retry, select, expectBrand } of CASES) {
    const page = await browser.newPage({ viewport: size });
    try {
      await page.goto(`${url}?cb=qa154-${size.width}x${size.height}-${h2.slice(0, 6)}`, {
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

      if (expectBrand === 'none') {
        assert.equal(m.brandDisp, 'none', `brand reclaimed @${size.width}x${size.height}`);
        if (size.width >= 361 && size.width <= 380) {
          assert.ok(
            m.maxH === '100%' || parseFloat(m.maxH) >= m.appH - 1,
            `max-height prefers app box, got ${m.maxH}`,
          );
          assert.ok(m.panelOver <= 1.5, `@361–380 panelOver=${m.panelOver}`);
          assert.ok(m.h2H <= 28, `h2 should stay single-line-ish, got ${m.h2H}`);
        }
      } else {
        assert.notEqual(m.brandDisp, 'none', `brand kept @${size.width}`);
        // Soft panelOver≤3.5 tolerated when CTAs fully visible (pt @400×280).
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

console.log('qa-asset-error-nearultra: PASS');
