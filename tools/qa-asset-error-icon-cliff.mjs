/**
 * Tick159: asset-error short-wide cliff icon reopen @≥400×221–224 —
 * real select CTA includes lobby-ico-back; brand KEPT + maxH100 + h2 compact.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK159 — asset-error short-wide cliff icon reopen/);
const idx = css.indexOf('TICK159 — asset-error short-wide cliff icon reopen');
const end = css.indexOf('/* ==========', idx + 10);
const block = css.slice(idx, end > idx ? end : idx + 1800);
assert.match(
  block,
  /max-height:\s*224px\)\s*and\s*\(min-height:\s*221px\)\s*and\s*\(min-width:\s*400px\)\s*and\s*\(orientation:\s*landscape\)/,
);
assert.match(block, /screen-asset-error[\s\S]{0,160}?max-height:\s*100%/);
assert.match(block, /font-size:\s*14px/);
// Brand KEPT in this band (not tick156 brand-none)
assert.doesNotMatch(block, /brand-mark\s*\{\s*display:\s*none/);
// Do not raise gate to 240
assert.doesNotMatch(block, /max-height:\s*240px/);
// Prior ships kept
assert.match(css, /TICK157 — asset-error short-wide letterbox CTA cliff reclaim/);
assert.match(css, /TICK156 — asset-error short-wide letterbox CTA reclaim/);

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
  // icon reopen band — brand KEPT + CTA full with real lobby-ico
  {
    size: { width: 400, height: 221 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'keep',
    expectH2Compact: true,
  },
  {
    size: { width: 400, height: 223 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'keep',
    expectH2Compact: true,
  },
  {
    size: { width: 400, height: 224 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'keep',
    expectH2Compact: true,
  },
  {
    size: { width: 400, height: 224 },
    h2: 'Fallo al cargar la etapa 1',
    retry: 'Reintentar',
    select: 'A selección',
    expectBrand: 'keep',
    expectH2Compact: true,
  },
  {
    size: { width: 400, height: 224 },
    h2: 'Не удалось загрузить стадию 1',
    retry: 'Повторить',
    select: 'К выбору',
    expectBrand: 'keep',
    expectH2Compact: true,
  },
  {
    size: { width: 568, height: 221 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'keep',
    expectH2Compact: true,
  },
  {
    size: { width: 568, height: 224 },
    h2: 'Не удалось загрузить стадию 1',
    retry: 'Повторить',
    select: 'К выбору',
    expectBrand: 'keep',
    expectH2Compact: true,
  },
  // tick156 keep — brand none @≤220
  {
    size: { width: 400, height: 220 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'none',
    expectH2Compact: true,
  },
  // above cliff — brand kept, full h2 OK
  {
    size: { width: 400, height: 240 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'keep',
    expectH2Compact: false,
  },
  {
    size: { width: 400, height: 280 },
    h2: 'Falha ao carregar o estágio 1',
    retry: 'Tentar de novo',
    select: 'À seleção',
    expectBrand: 'keep',
    expectH2Compact: false,
  },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  for (const { size, h2, retry, select, expectBrand, expectH2Compact } of CASES) {
    const page = await browser.newPage({ viewport: size });
    try {
      await page.goto(`${url}?cb=qa159-${size.width}x${size.height}-${h2.slice(0, 6)}`, {
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
          // REAL markup (icon) — root cause of tick157 understatement
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
          const retryBtn = document.getElementById('btn-asset-retry');
          const selBtn = document.getElementById('btn-asset-select');
          const msg = content.querySelector('.asset-error-msg');
          const h2el = content.querySelector('h2');
          const h2Cs = getComputedStyle(h2el);
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
            h2Fs: h2Cs.fontSize,
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
      } else {
        assert.notEqual(m.brandDisp, 'none', `brand kept @${size.width}x${size.height}`);
      }

      if (expectH2Compact) {
        assert.equal(m.h2Fs, '14px', `h2 compact @${size.width}x${size.height} got ${m.h2Fs}`);
      }

      if (size.width >= 400 && size.height >= 221 && size.height <= 224) {
        assert.ok(
          m.maxH === '100%' || parseFloat(m.maxH) >= m.appH - 1,
          `icon-cliff max-height prefers app box, got ${m.maxH}`,
        );
        assert.ok(m.panelOver <= 1.5, `icon-cliff panelOver=${m.panelOver}`);
      }

      // Soft @280: CTAs must stay full (no invent escalate)
      if (size.height >= 260 && size.height <= 290) {
        assert.ok(m.rVis >= m.rH * 0.9, `soft retry vis=${m.rVis}/${m.rH}`);
        assert.ok(m.sVis >= m.sH * 0.9, `soft select vis=${m.sVis}/${m.sH}`);
      }

      console.log(
        `PASS @${size.width}x${size.height}`,
        `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
        `brand=${m.brandDisp} maxH=${m.maxH} h2=${m.h2H} fs=${m.h2Fs}`,
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

console.log('qa-asset-error-icon-cliff: PASS');
