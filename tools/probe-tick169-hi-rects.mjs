/**
 * Tick169 — dump title CONTROLS HI rects (reject false HARD vs tick135 floor).
 * CTA unread stays the title HARD bar (tick167). HI vis=0 may be keys
 * overflow:hidden after tick135 grid floor — confirm geometry.
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
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

const SIZES = [
  { width: 320, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 667, height: 375 },
  { width: 800, height: 450 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  for (const size of SIZES) {
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
      await page.goto(`${url}?cb=t169hi-${size.width}x${size.height}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            t: +r.top.toFixed(1),
            b: +r.bottom.toFixed(1),
            l: +r.left.toFixed(1),
            r: +r.right.toFixed(1),
            h: +r.height.toFixed(1),
            w: +r.width.toFixed(1),
            ov: cs.overflow,
            oy: cs.overflowY,
            maxH: cs.maxHeight,
            minH: el.style.minHeight || cs.minHeight,
            disp: cs.display,
          };
        };
        const app = document.getElementById('app');
        const oc = document.getElementById('overlay-content');
        const keys = oc.querySelector('.keys');
        const hi = oc.querySelector('.keys-hiscore');
        const grid = oc.querySelector('.keys-grid');
        const start = document.getElementById('btn-start');
        const vis = (el, clip) => {
          if (!el || !clip) return 0;
          const a = el.getBoundingClientRect();
          const c = clip.getBoundingClientRect();
          return +Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)).toFixed(1);
        };
        return {
          app: box(app),
          oc: box(oc),
          keys: box(keys),
          hi: box(hi),
          grid: box(grid),
          start: box(start),
          hiVisKeys: vis(hi, keys),
          hiVisOc: vis(hi, oc),
          hiVisApp: vis(hi, app),
          gridVisKeys: vis(grid, keys),
          gridVisOc: vis(grid, oc),
          startVisApp: vis(start, app),
        };
      });
      log(`--- ko@${size.width}x${size.height}`);
      log(
        `  app t/b=${m.app.t}/${m.app.b} oc t/b=${m.oc.t}/${m.oc.b}`,
        `keys t/b=${m.keys.t}/${m.keys.b} h=${m.keys.h} minH=${m.keys.minH} maxH=${m.keys.maxH} ov=${m.keys.ov}`,
      );
      log(
        `  hi t/b=${m.hi.t}/${m.hi.b} h=${m.hi.h} visK/Oc/App=${m.hiVisKeys}/${m.hiVisOc}/${m.hiVisApp}`,
      );
      log(
        `  grid t/b=${m.grid.t}/${m.grid.b} h=${m.grid.h} visK/Oc=${m.gridVisKeys}/${m.gridVisOc} minH=${m.grid.minH}`,
      );
      log(`  start t/b=${m.start.t}/${m.start.b} visApp=${m.startVisApp} h=${m.start.h}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

writeFileSync(join(root, 'tools', 'probe-tick169-hi-rects.out.txt'), lines.join('\n') + '\n', 'utf8');
console.log('wrote tools/probe-tick169-hi-rects.out.txt');
