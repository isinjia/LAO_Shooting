/** Probe .tc-actions zone vs gauges across cliff widths @h=240. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
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

function overlaps(a, b, pad = 2) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

const WIDTHS = [320, 340, 342, 344, 348, 350, 352, 355, 358, 360, 368];
const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width, height: 240 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      await page.addInitScript(() => {
        localStorage.setItem(
          'lao_mini_settings_v1',
          JSON.stringify({
            lang: 'en',
            muted: true,
            bgmVolume: 0,
            sfxVolume: 0,
            autoFire: true,
            padMode: 'fixed',
            fullscreen: false,
          }),
        );
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      });
      await page.goto(`${url}?cb=zone-${width}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const geo = await page.evaluate((overlapsSrc) => {
        const overlaps = eval(`(${overlapsSrc})`);
        document.body.classList.add('touch-ui', 'has-touch-pads');
        const tc = document.getElementById('touch-controls');
        tc.classList.add('is-on', 'tc-mode-fixed');
        tc.setAttribute('aria-hidden', 'false');
        document.getElementById('overlay').style.display = 'none';
        void tc.offsetHeight;
        const R = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: +r.left.toFixed(1),
            right: +r.right.toFixed(1),
            top: +r.top.toFixed(1),
            bottom: +r.bottom.toFixed(1),
            w: +r.width.toFixed(1),
          };
        };
        const visW = (a, clip) =>
          !a || !clip
            ? 0
            : Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
        const actions = R('.tc-actions');
        const stocks = R('.hud-stocks');
        const gauges = R('.hud-gauges');
        const power = R('.power-badge');
        const bomb = R('.tc-bomb');
        const charge = R('#charge-track');
        return {
          hudR: getComputedStyle(document.querySelector('.hud-bottom')).right,
          actL: actions?.left,
          actW: actions?.w,
          gR: gauges?.right,
          sR: stocks?.right,
          gapGA: actions && gauges ? +(actions.left - gauges.right).toFixed(1) : null,
          ovAG: overlaps(actions, gauges, 2),
          ovAS: overlaps(actions, stocks, 2),
          ovBC: overlaps(bomb, charge, 2),
          powerVis: +visW(power, stocks).toFixed(1),
          lbl: getComputedStyle(document.querySelector('#charge-row .sp-label')).display,
          gW: gauges?.w,
        };
      }, overlaps.toString());
      console.log(
        `@${width}x240`,
        `hudR=${geo.hudR} gW=${geo.gW}`,
        `actL=${geo.actL} gR=${geo.gR} gapGA=${geo.gapGA}`,
        `ovAG=${geo.ovAG} ovAS=${geo.ovAS} ovBC=${geo.ovBC}`,
        `powerVis=${geo.powerVis} lbl=${geo.lbl}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
