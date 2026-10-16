/**
 * Tick137 trial: tutorial @640 — measure head brand/h2 reclaim → gridH.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
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
          localStorage.removeItem('lao_mini_tutorial_seen');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=r137tt-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 90000 });
        await page.click('.char-card:not([data-key="random"])');
        await page.waitForTimeout(40);
        await page.click('#btn-go');
        await page.waitForSelector('.screen-tutorial', { timeout: 90000 });
        await page.waitForTimeout(180);

        const snap = await page.evaluate(async () => {
          const oc = document.getElementById('overlay-content');
          const app = document.getElementById('app');
          const grid = oc.querySelector('.tutorial-grid');
          const head = oc.querySelector('.opt-head');
          const brand = head?.querySelector('.brand-mark');
          const h2 = head?.querySelector('h2');
          const actions = oc.querySelector('.pause-actions');
          const cta = document.getElementById('btn-tut-go');
          const measure = () => {
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            const gR = grid.getBoundingClientRect();
            const actR = actions.getBoundingClientRect();
            return {
              gridH: +gR.height.toFixed(1),
              gridMin: grid.style.minHeight || '',
              panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
              ctaOut:
                actR.bottom > appR.bottom + 1.5 ||
                actR.top < appR.top - 1.5 ||
                (cta &&
                  (cta.getBoundingClientRect().bottom > appR.bottom + 1.5 ||
                    cta.getBoundingClientRect().top < appR.top - 1.5)),
              brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
              brandDisplay: brand ? getComputedStyle(brand).display : 'none',
              headH: head ? +head.getBoundingClientRect().height.toFixed(1) : 0,
              h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            };
          };
          const before = measure();

          // Trial A: hide brand only
          if (brand) brand.style.display = 'none';
          // trigger resize sync if present
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const afterBrand = measure();

          // Trial B: also compact h2
          if (h2) {
            h2.style.fontSize = '18px';
            h2.style.margin = '0';
            h2.style.letterSpacing = '0.12em';
          }
          if (head) head.style.marginBottom = '2px';
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const afterH2 = measure();

          // Trial C: force soft floor 40 after reclaim (manual, like title)
          const soft = 40;
          const appH = app.clientHeight || 360;
          let maxCap = Math.min(560, Math.max(300, Math.floor(appH * 0.92)));
          oc.style.maxHeight = `${maxCap}px`;
          const note = oc.querySelector('.tutorial-note');
          const deco = oc.querySelector('.tutorial-deco');
          if (deco) deco.style.display = 'none';
          if (note) note.style.display = 'none';
          actions.style.padding = '4px 0';
          actions.style.border = 'none';
          actions.style.backgroundImage = 'none';
          const pinned =
            (head?.getBoundingClientRect().height || 0) +
            (actions.getBoundingClientRect().height || 0) +
            (parseFloat(getComputedStyle(oc).paddingTop) || 0) +
            (parseFloat(getComputedStyle(oc).paddingBottom) || 0);
          const avail = Math.floor(maxCap - pinned);
          grid.style.minHeight = `${Math.min(soft, Math.max(0, avail))}px`;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const forced = measure();
          // if CTA out, shave carefully
          if (forced.ctaOut) {
            const cur = parseFloat(grid.style.minHeight) || 0;
            grid.style.minHeight = `${Math.max(soft, Math.floor(cur - 8))}px`;
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }
          const forced2 = measure();

          return { before, afterBrand, afterH2, forced, forced2, avail };
        });
        rows.push({ loc, w: size.width, h: size.height, ...snap });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

writeFileSync(
  join(root, 'tools', 'probe-tick137-tutorial-trial-out.json'),
  JSON.stringify(rows, null, 2),
);
console.log(
  JSON.stringify(
    rows.map((r) => ({
      loc: r.loc,
      w: r.w,
      h: r.h,
      before: r.before,
      afterBrand: r.afterBrand,
      afterH2: r.afterH2,
      forced2: r.forced2,
      avail: r.avail,
    })),
    null,
    2,
  ),
);
process.exit(0);
