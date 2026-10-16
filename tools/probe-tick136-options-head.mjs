/**
 * Tick136: OPTIONS extreme-short head vs scroll slice — measure reclaim trials.
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
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const rows = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
      try {
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
        await page.goto(`${url}?cb=r136oh-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForTimeout(180);

        const before = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const head = oc.querySelector('.opt-head');
          const brand = head?.querySelector('.brand-mark');
          const h2 = head?.querySelector('h2');
          const scroll = oc.querySelector('.opt-scroll');
          const back = document.getElementById('btn-opt-back');
          const firstRow = oc.querySelector('.opt-pad-row, .opt-slider, .opt-check');
          const after = getComputedStyle(head || oc, '::after');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            headH: head ? +head.getBoundingClientRect().height.toFixed(1) : 0,
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            h2Fs: h2 ? parseFloat(getComputedStyle(h2).fontSize) : 0,
            scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(1) : 0,
            scrollNeed: scroll ? scroll.scrollHeight - scroll.clientHeight : 0,
            backOut: boxOut(back, appR),
            firstVisible: firstRow ? firstRow.getBoundingClientRect().height > 8 : false,
            headAfterH: after?.height || '',
            headAfterDisplay: after?.display || '',
            headAfterContent: (after?.content || '').slice(0, 40),
          };
        }, { boxOutSrc: boxOut.toString() });

        // Trial A: hide brand-mark only
        const trialA = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const head = oc.querySelector('.opt-head');
          const brand = head?.querySelector('.brand-mark');
          const scroll = oc.querySelector('.opt-scroll');
          const back = document.getElementById('btn-opt-back');
          if (brand) brand.style.display = 'none';
          // Re-run budget if exposed
          if (typeof window !== 'undefined') {
            // force layout
            void oc.offsetHeight;
          }
          // Grow scroll by clearing minHeight then letting flex fill
          if (scroll) {
            scroll.style.minHeight = '0';
            scroll.style.flex = '1 1 auto';
          }
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            headH: head ? +head.getBoundingClientRect().height.toFixed(1) : 0,
            scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(1) : 0,
            backOut: boxOut(back, appR),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
          };
        }, { boxOutSrc: boxOut.toString() });

        // Trial B: also compact h2 + head margins
        const trialB = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const head = oc.querySelector('.opt-head');
          const h2 = head?.querySelector('h2');
          const scroll = oc.querySelector('.opt-scroll');
          const back = document.getElementById('btn-opt-back');
          if (head) {
            head.style.marginBottom = '2px';
            head.style.paddingBottom = '0';
          }
          if (h2) {
            h2.style.fontSize = '18px';
            h2.style.margin = '0';
            h2.style.letterSpacing = '0.12em';
          }
          // kill ::after deco via class hack — zero height by hiding pseudo via font-size 0 on head after content
          if (head) head.style.setProperty('--tick136', '1');
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          return {
            panelOver: +(oc.getBoundingClientRect().bottom - appR.bottom).toFixed(2),
            headH: head ? +head.getBoundingClientRect().height.toFixed(1) : 0,
            scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(1) : 0,
            backOut: boxOut(back, appR),
          };
        }, { boxOutSrc: boxOut.toString() });

        // Trial C: hide entire decorative ::after by setting head overflow + max height on head
        const trialC = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const head = oc.querySelector('.opt-head');
          const h2 = head?.querySelector('h2');
          const scroll = oc.querySelector('.opt-scroll');
          const back = document.getElementById('btn-opt-back');
          // Keep h2 only — collapse head to h2 height
          if (head && h2) {
            head.style.display = 'block';
            head.style.minHeight = '0';
            head.style.height = 'auto';
            head.style.padding = '0';
            head.style.margin = '0 0 4px';
          }
          void oc.offsetHeight;
          // Manually expand scroll by reducing pinned: set scroll minHeight from remaining
          const appH = app.clientHeight;
          const maxCap = Math.min(680, Math.floor(appH * 0.92));
          const actions = oc.querySelector('.opt-actions');
          const padY =
            (parseFloat(getComputedStyle(oc).paddingTop) || 0) +
            (parseFloat(getComputedStyle(oc).paddingBottom) || 0);
          const pinned =
            (head?.getBoundingClientRect().height || 0) +
            (actions?.getBoundingClientRect().height || 0) +
            padY;
          const avail = Math.max(0, Math.floor(maxCap - pinned - 10));
          if (scroll) scroll.style.minHeight = `${avail}px`;
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          return {
            panelOver: +(oc.getBoundingClientRect().bottom - appR.bottom).toFixed(2),
            headH: head ? +head.getBoundingClientRect().height.toFixed(1) : 0,
            scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(1) : 0,
            avail,
            backOut: boxOut(back, appR),
            firstVisible: !!oc.querySelector('.opt-pad-row, .opt-slider'),
          };
        }, { boxOutSrc: boxOut.toString() });

        rows.push({ loc, w: size.width, h: size.height, before, trialA, trialB, trialC });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const outPath = join(root, 'tools', 'probe-tick136-options-head-out.json');
writeFileSync(outPath, JSON.stringify(rows, null, 2));
console.log(
  JSON.stringify(
    rows.map((r) => ({
      loc: r.loc,
      size: `${r.w}x${r.h}`,
      before: {
        headH: r.before.headH,
        brandH: r.before.brandH,
        h2H: r.before.h2H,
        scrollH: r.before.scrollH,
        need: r.before.scrollNeed,
        backOut: r.before.backOut,
        after: r.before.headAfterContent,
        afterH: r.before.headAfterH,
      },
      A: { headH: r.trialA.headH, scrollH: r.trialA.scrollH, backOut: r.trialA.backOut },
      B: { headH: r.trialB.headH, scrollH: r.trialB.scrollH, backOut: r.trialB.backOut },
      C: {
        headH: r.trialC.headH,
        scrollH: r.trialC.scrollH,
        avail: r.trialC.avail,
        backOut: r.trialC.backOut,
      },
      gainC: +(r.trialC.scrollH - r.before.scrollH).toFixed(1),
    })),
    null,
    2,
  ),
);
