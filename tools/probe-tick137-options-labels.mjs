/**
 * Tick137: OPTIONS @short — which labels truly clip, and BGM/SFX viewport fit.
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
          localStorage.setItem('lao_mini_tutorial_seen', '1');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=r137ol-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForSelector('.opt-scroll', { timeout: 60000 });
        await page.waitForTimeout(120);
        const snap = await page.evaluate(() => {
          const oc = document.getElementById('overlay-content');
          const scroll = oc.querySelector('.opt-scroll');
          const sR = scroll.getBoundingClientRect();
          const sliders = [...scroll.querySelectorAll('label.opt-slider')];
          const sliderInfo = sliders.map((el, i) => {
            const r = el.getBoundingClientRect();
            return {
              i,
              text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48),
              fully: r.top >= sR.top - 1 && r.bottom <= sR.bottom + 1,
              partial: r.bottom > sR.top + 2 && r.top < sR.bottom - 2,
              top: +(r.top - sR.top).toFixed(1),
              bottom: +(r.bottom - sR.top).toFixed(1),
              h: +r.height.toFixed(1),
            };
          });
          const textEls = [
            ...scroll.querySelectorAll(
              '.opt-pad-label, .opt-key-label, .opt-block-title, .opt-mobile-note, .opt-keys-head, .opt-check',
            ),
          ];
          const clips = textEls
            .map((el) => {
              const cs = getComputedStyle(el);
              const clipX = el.scrollWidth > el.clientWidth + 2;
              const clipY = el.scrollHeight > el.clientHeight + 2;
              const overflowHidden =
                cs.overflow === 'hidden' ||
                cs.overflowX === 'hidden' ||
                cs.textOverflow === 'ellipsis' ||
                cs.webkitLineClamp !== 'none';
              return {
                cls: el.className,
                text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 56),
                clipX,
                clipY,
                overflowHidden,
                sw: el.scrollWidth,
                cw: el.clientWidth,
                sh: el.scrollHeight,
                ch: el.clientHeight,
                whiteSpace: cs.whiteSpace,
              };
            })
            .filter((x) => x.clipX || x.clipY);
          const kids = [
            ...scroll.querySelectorAll(
              '.opt-block-title, .opt-pad-row, .opt-slider, .opt-check, .opt-keys-head, .opt-key-row, .opt-mobile-note',
            ),
          ];
          const visible = kids
            .map((el) => {
              const r = el.getBoundingClientRect();
              const fully = r.top >= sR.top - 1 && r.bottom <= sR.bottom + 1;
              const partial = r.bottom > sR.top + 2 && r.top < sR.bottom - 2;
              return {
                text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
                fully,
                partial,
                top: +(r.top - sR.top).toFixed(1),
              };
            })
            .filter((x) => x.partial);
          return {
            scrollH: +sR.height.toFixed(1),
            isShort: oc.classList.contains('is-opt-short'),
            brandDisplay: (() => {
              const b = oc.querySelector('.opt-head .brand-mark');
              return b ? getComputedStyle(b).display : 'none';
            })(),
            sliders: sliderInfo,
            clips,
            visible,
          };
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

const outPath = join(root, 'tools', 'probe-tick137-options-labels-out.json');
writeFileSync(outPath, JSON.stringify(rows, null, 2));
const summary = rows.map((r) => ({
  loc: r.loc,
  w: r.w,
  h: r.h,
  scrollH: r.scrollH,
  isShort: r.isShort,
  brandDisplay: r.brandDisplay,
  bgmFully: r.sliders?.[0]?.fully ?? null,
  sfxFully: r.sliders?.[1]?.fully ?? null,
  clipCount: r.clips?.length || 0,
  clips: (r.clips || []).slice(0, 6),
  visibleFully: (r.visible || []).filter((v) => v.fully).map((v) => v.text),
  visiblePartialOnly: (r.visible || []).filter((v) => v.partial && !v.fully).map((v) => v.text),
}));
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
