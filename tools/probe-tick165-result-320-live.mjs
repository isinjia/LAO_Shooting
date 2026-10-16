/**
 * Tick165 — live @320×200 endScreen height dump + last-step trials.
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

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
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
await page.goto(`${url}?cb=t165-320live`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-start', { timeout: 60000 });
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 60000 });
await page.click('#btn-go');
await page.waitForFunction(() => !!window.__LAO__?.getGame?.(), { timeout: 60000 });
await page.waitForTimeout(200);
await page.evaluate(() => {
  window.__LAO__.getGame().state = 'gameover';
});
await page.waitForSelector('#btn-retry', { timeout: 60000 });
await page.waitForTimeout(300);

const dump = await page.evaluate(() => {
  const app = document.getElementById('app');
  const oc = document.getElementById('overlay-content');
  const bh = (sel) => {
    const el = typeof sel === 'string' ? oc.querySelector(sel) : sel;
    return el ? +el.getBoundingClientRect().height.toFixed(1) : 0;
  };
  const cs = getComputedStyle(oc);
  return {
    appH: +app.getBoundingClientRect().height.toFixed(1),
    ocH: +oc.getBoundingClientRect().height.toFixed(1),
    maxH: oc.style.maxHeight,
    pad: `${oc.style.paddingTop}/${oc.style.paddingBottom} cs=${cs.paddingTop}/${cs.paddingBottom}`,
    brand: bh(':scope > .brand-mark'),
    h2: bh(':scope > h2'),
    deco: bh('.result-deco'),
    score: bh('.result-score'),
    meta: bh('.result-meta'),
    retry: bh('#btn-retry'),
    title: bh('#btn-title'),
    retryMt: getComputedStyle(oc.querySelector('#btn-retry')).marginTop,
    titleMt: getComputedStyle(oc.querySelector('#btn-title')).marginTop,
    gap: cs.gap || cs.rowGap,
    html: oc.innerHTML.slice(0, 400),
  };
});
log('DUMP', JSON.stringify(dump, null, 2));

for (const trial of ['metaHide', 'ctaRow', 'meta2', 'scoreOnly']) {
  const m = await page.evaluate((trial) => {
    const oc = document.getElementById('overlay-content');
    const app = document.getElementById('app');
    const meta = oc.querySelector('.result-meta');
    const score = oc.querySelector('.result-score');
    const retry = oc.querySelector('#btn-retry');
    const titleBtn = oc.querySelector('#btn-title');
    // reset trial side-effects from prior
    if (meta) meta.style.display = '';
    for (const c of meta?.querySelectorAll('.cell') || []) c.style.display = '';
    if (score) score.style.display = '';
    // unwrap prior row wrap
    const wrap = oc.querySelector('.result-actions-trial');
    if (wrap) {
      while (wrap.firstChild) oc.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
    }

    if (trial === 'metaHide' && meta) meta.style.display = 'none';
    if (trial === 'scoreOnly') {
      if (meta) meta.style.display = 'none';
      if (score) {
        /* keep */
      }
    }
    if (trial === 'meta2' && meta) {
      const cells = [...meta.querySelectorAll('.cell')];
      cells.slice(2).forEach((c) => {
        c.style.display = 'none';
      });
    }
    if (trial === 'ctaRow') {
      const w = document.createElement('div');
      w.className = 'result-actions-trial';
      w.style.display = 'flex';
      w.style.flexWrap = 'wrap';
      w.style.justifyContent = 'center';
      w.style.gap = '4px';
      w.style.margin = '0';
      w.style.padding = '0';
      retry.parentNode.insertBefore(w, retry);
      w.appendChild(retry);
      w.appendChild(titleBtn);
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
      return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
    };
    return {
      trial,
      over: +Math.max(0, ocR.bottom - appR.bottom).toFixed(2),
      ocH: +ocR.height.toFixed(1),
      ctaOut: out(retry),
      ctaVis: +vis(retry).toFixed(1),
      ctaH: +retry.getBoundingClientRect().height.toFixed(1),
      secOut: out(titleBtn),
      secVis: +vis(titleBtn).toFixed(1),
      metaH: meta ? +meta.getBoundingClientRect().height.toFixed(1) : 0,
      scoreH: score ? +score.getBoundingClientRect().height.toFixed(1) : 0,
    };
  }, trial);
  const hard =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  log(
    `${hard ? 'HARD' : 'ok'} ${m.trial}`,
    `over=${m.over} ocH=${m.ocH}`,
    `cta=${m.ctaVis}/${m.ctaH} out=${m.ctaOut}`,
    `sec=${m.secVis} out=${m.secOut}`,
    `scoreH=${m.scoreH} metaH=${m.metaH}`,
  );
}

await browser.close();
server.close();
writeFileSync(join(root, 'tools', 'probe-tick165-result-320-live.out.txt'), lines.join('\n') + '\n');
