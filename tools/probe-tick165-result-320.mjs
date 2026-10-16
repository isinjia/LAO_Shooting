/**
 * Tick165 — drill @320×200 result CTA chrome after full ladder residual.
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

const TRIALS = ['full', 'full+row', 'full+metaHide', 'full+ultra', 'full+row+ultra'];
const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const size = { width: 320, height: 200 };
const loc = 'ko';

try {
  for (const trial of TRIALS) {
    const page = await browser.newPage({ viewport: size });
    try {
      await page.addInitScript(() => {
        localStorage.setItem(
          'lao_mini_settings_v1',
          JSON.stringify({
            lang: 'ko',
            muted: true,
            bgmVolume: 0,
            sfxVolume: 0,
            autoFire: true,
            padMode: 'fixed',
            fullscreen: false,
          }),
        );
        localStorage.setItem('lao_mini_tutorial_seen', '1');
      });
      await page.goto(`${url}?cb=t165-320-${trial}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const m = await page.evaluate(async (trial) => {
        const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
        mod.setLocale?.('ko');
        const tRetry = mod.t?.('btn.retryRun') || '다시 도전';
        const tTitle = mod.t?.('btn.title') || '타이틀로';
        const overlay = document.getElementById('overlay');
        const content = document.getElementById('overlay-content');
        overlay.classList.add('is-on', 'show');
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        content.className = 'screen-result gameover';
        content.style.cssText = '';
        content.innerHTML = `
          <div class="panel-frame" aria-hidden="true"></div>
          <span class="brand-mark">SYSTEM DOWN</span>
          <h2>GAME OVER</h2>
          <span class="result-deco" aria-hidden="true"></span>
          <div class="result-score">
            <div class="cell"><span class="lbl">SCORE</span><span class="val">00001234</span></div>
            <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">00005678</span></div>
            <div class="cell"><span class="lbl">GRAZE</span><span class="val">12</span></div>
          </div>
          <div class="result-meta">
            <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 2 · TEST</span></div>
            <div class="cell"><span class="lbl">PILOT</span><span class="val">HIRUME</span></div>
            <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">8</span></div>
            <div class="cell"><span class="lbl">NO MISS</span><span class="val">—</span></div>
          </div>
          <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
          <button class="btn" id="btn-title">${tTitle}</button>
        `;
        const oc = content;
        const deco = oc.querySelector('.result-deco');
        const score = oc.querySelector('.result-score');
        const meta = oc.querySelector('.result-meta');
        const brand = oc.querySelector(':scope > .brand-mark');
        const h2 = oc.querySelector(':scope > h2');
        const retry = oc.querySelector('#btn-retry');
        const titleBtn = oc.querySelector('#btn-title');
        const app = document.getElementById('app');
        // Run full ladder from prior trial
        if (deco) deco.style.display = 'none';
        oc.classList.add('is-result-short');
        if (brand) brand.style.display = 'none';
        if (h2) {
          h2.style.fontSize = '14px';
          h2.style.margin = '0';
          h2.style.letterSpacing = '0.1em';
        }
        if (score) {
          score.style.marginTop = '2px';
          score.style.marginBottom = '2px';
          score.style.gap = '4px';
        }
        if (meta) {
          meta.style.marginBottom = '2px';
          meta.style.gap = '2px 6px';
        }
        for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
          cell.style.padding = '1px 3px';
          cell.style.border = 'none';
          cell.style.backgroundImage = 'none';
          cell.style.boxShadow = 'none';
          cell.style.clipPath = 'none';
        }
        oc.style.paddingTop = '10px';
        oc.style.paddingBottom = '8px';
        if (retry) {
          retry.style.padding = '4px 10px';
          retry.style.minHeight = '28px';
          retry.style.fontSize = '12px';
          retry.style.minWidth = '0';
        }
        if (titleBtn) {
          titleBtn.style.padding = '4px 10px';
          titleBtn.style.minHeight = '28px';
          titleBtn.style.fontSize = '12px';
          titleBtn.style.minWidth = '0';
        }
        const fitH = Math.floor(
          Math.min(app.clientHeight || 0, app.getBoundingClientRect().height),
        );
        oc.style.maxHeight = `${fitH}px`;

        if (trial.includes('row')) {
          // Wrap CTAs into a flex row peer (select/pause actions).
          const wrap = document.createElement('div');
          wrap.className = 'result-actions pause-actions';
          wrap.style.display = 'flex';
          wrap.style.flexWrap = 'wrap';
          wrap.style.justifyContent = 'center';
          wrap.style.gap = '4px';
          wrap.style.padding = '0';
          wrap.style.margin = '0';
          retry.parentNode.insertBefore(wrap, retry);
          wrap.appendChild(retry);
          wrap.appendChild(titleBtn);
        }
        if (trial.includes('metaHide')) {
          if (meta) meta.style.display = 'none';
        }
        if (trial.includes('ultra')) {
          oc.style.paddingTop = '6px';
          oc.style.paddingBottom = '4px';
          if (h2) h2.style.fontSize = '13px';
          if (score) {
            score.style.marginTop = '0';
            score.style.marginBottom = '0';
            score.style.gap = '2px';
          }
          if (meta && getComputedStyle(meta).display !== 'none') {
            meta.style.marginBottom = '0';
            meta.style.gap = '1px 4px';
          }
          if (retry) {
            retry.style.padding = '2px 8px';
            retry.style.minHeight = '24px';
            retry.style.fontSize = '11px';
          }
          if (titleBtn) {
            titleBtn.style.padding = '2px 8px';
            titleBtn.style.minHeight = '24px';
            titleBtn.style.fontSize = '11px';
          }
        }

        void oc.offsetHeight;
        const appR = app.getBoundingClientRect();
        const ocR = oc.getBoundingClientRect();
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          return Math.max(
            0,
            Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
              Math.max(r.top, Math.max(ocR.top, appR.top)),
          );
        };
        const out = (el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5 || r.right > appR.right + 1.5;
        };
        return {
          trial,
          panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
          maxH: oc.style.maxHeight || '',
          fitH,
          ctaOut: out(retry),
          ctaVis: +vis(retry).toFixed(1),
          ctaH: +retry.getBoundingClientRect().height.toFixed(1),
          secOut: out(titleBtn),
          secVis: +vis(titleBtn).toFixed(1),
          secH: +titleBtn.getBoundingClientRect().height.toFixed(1),
          ocH: +ocR.height.toFixed(1),
          scoreH: score ? +score.getBoundingClientRect().height.toFixed(1) : 0,
          metaH: meta ? +meta.getBoundingClientRect().height.toFixed(1) : 0,
          metaDisp: meta ? getComputedStyle(meta).display : '',
        };
      }, trial);
      const hard =
        m.ctaOut ||
        (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
        m.secOut ||
        (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
      log(
        `${hard ? 'HARD' : 'ok'} ${m.trial}`,
        `over=${m.panelOver} maxH=${m.maxH} ocH=${m.ocH}`,
        `ctaOut=${m.ctaOut} cta=${m.ctaVis}/${m.ctaH}`,
        `secOut=${m.secOut} sec=${m.secVis}/${m.secH}`,
        `scoreH=${m.scoreH} metaH=${m.metaH} metaDisp=${m.metaDisp}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

writeFileSync(join(root, 'tools', 'probe-tick165-result-320.out.txt'), lines.join('\n') + '\n');
