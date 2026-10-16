/**
 * Tick149: find max-width ceiling where stacked reclaim keeps actions×gauges clear.
 */
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

const WIDTHS = [320, 330, 340, 342, 344, 348, 350, 352, 355, 360];
const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const width of WIDTHS) {
    const height = width <= 340 ? 200 : 210;
    const page = await browser.newPage({
      viewport: { width, height },
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
      await page.goto(`${url}?cb=act-${width}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
        const stick = R('.tc-stick-zone');
        const actions = R('.tc-actions') || {
          left: Math.min(
            ...['.tc-fire', '.tc-bomb', '.tc-special', '.tc-focus']
              .map((s) => document.querySelector(s)?.getBoundingClientRect().left)
              .filter((n) => n != null),
          ),
        };
        // synthesize actions from buttons if zone missing
        const btns = ['.tc-fire', '.tc-bomb', '.tc-special', '.tc-focus'].map((s) => R(s)).filter(Boolean);
        const act = {
          left: Math.min(...btns.map((b) => b.left)),
          right: Math.max(...btns.map((b) => b.right)),
          top: Math.min(...btns.map((b) => b.top)),
          bottom: Math.max(...btns.map((b) => b.bottom)),
        };
        const stocks = R('.hud-stocks');
        const gauges = R('.hud-gauges');
        const charge = R('#charge-track');
        const bomb = R('.tc-bomb');
        const power = R('.power-badge');
        return {
          hudR: getComputedStyle(document.querySelector('.hud-bottom')).right,
          stocks,
          gauges,
          act,
          powerVis: +visW(power, stocks).toFixed(1),
          gapGA: +(act.left - gauges.right).toFixed(1),
          gapAS: +(act.left - stocks.right).toFixed(1),
          gapBC: bomb && charge ? +(bomb.left - charge.right).toFixed(1) : null,
          gapSS: stick && stocks ? +(stocks.left - stick.right).toFixed(1) : null,
          ovAG: overlaps(act, gauges, 2),
          ovAS: overlaps(act, stocks, 2),
          ovBC: overlaps(bomb, charge, 2),
          lbl: getComputedStyle(document.querySelector('#charge-row .sp-label')).display,
        };
      }, overlaps.toString());
      console.log(
        `@${width}x${height}`,
        `hudR=${geo.hudR}`,
        `gR=${geo.gauges?.right} actL=${geo.act.left}`,
        `gapGA=${geo.gapGA} gapAS=${geo.gapAS} gapBC=${geo.gapBC} gapSS=${geo.gapSS}`,
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
