/**
 * Tick136 verify: OPTIONS extreme-short scroll soft floor after head reclaim.
 * Expect muddyCount=0 on ko/en/pt/es/ru × 640×360 / 720×400 / 800×450.
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

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
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
        await page.goto(`${url}?cb=r136f-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForTimeout(200);
        const row = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const scroll = oc.querySelector('.opt-scroll');
          const back = document.getElementById('btn-opt-back');
          const brand = oc.querySelector('.opt-head .brand-mark');
          const h2 = oc.querySelector('.opt-head h2');
          const nested = oc.querySelector('.opt-keys');
          const nestedMax = nested ? getComputedStyle(nested).maxHeight : '';
          const sR = scroll.getBoundingClientRect();
          const bgm = [...scroll.querySelectorAll('.opt-slider')].find((el) =>
            /BGM/i.test(el.textContent || ''),
          );
          const bgmR = bgm?.getBoundingClientRect();
          const bgmFully =
            !!bgm && bgmR.top >= sR.top - 1 && bgmR.bottom <= sR.bottom + 1;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            scrollH: +sR.height.toFixed(1),
            backOut: boxOut(back, appR),
            backOcOut: boxOut(back, ocR),
            nested:
              nested &&
              nestedMax !== 'none' &&
              nestedMax !== '' &&
              parseFloat(nestedMax) > 0 &&
              nested.scrollHeight > nested.clientHeight + 2,
            isShort: oc.classList.contains('is-opt-short'),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2Display: h2 ? getComputedStyle(h2).display : 'none',
            h2Text: h2 ? (h2.textContent || '').trim().slice(0, 40) : '',
            bgmFully,
          };
        }, { boxOutSrc: boxOut.toString() });
        rows.push({ loc, w: size.width, h: size.height, ...row });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const muddy = rows.filter(
  (r) =>
    r.panelOver > 1.5 ||
    r.panelOverTop > 1.5 ||
    r.backOut ||
    r.backOcOut ||
    r.nested ||
    r.scrollH + 0.5 < 140 ||
    r.h2Display === 'none' ||
    !r.h2Text ||
    (r.h <= 400 && !r.bgmFully),
);

const out = { muddyCount: muddy.length, muddy, all: rows };
writeFileSync(join(root, 'tools', 'probe-tick136-options-floor-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      sample: rows.filter((r) => r.h === 360 || r.loc === 'es'),
    },
    null,
    2,
  ),
);
process.exit(muddy.length === 0 ? 0 : 1);
