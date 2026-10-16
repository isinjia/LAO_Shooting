/**
 * Tick149 cliff dump: widths just above tick148 max-width:340.
 * Measure POWER visible, label width, track-in-gauges, gaps.
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

const WIDTHS = [336, 340, 342, 344, 348, 350, 352, 355, 360, 368, 380];
const HEIGHT = 210;

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width, height: HEIGHT },
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
      await page.goto(`${url}?cb=cliff-${width}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const geo = await page.evaluate(() => {
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
          return { left: r.left, right: r.right, w: r.width, top: r.top, bottom: r.bottom };
        };
        const visW = (a, clip) =>
          !a || !clip
            ? 0
            : Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
        const stocks = R('.hud-stocks');
        const gauges = R('.hud-gauges');
        const power = R('.power-badge');
        const charge = R('#charge-track');
        const bomb = R('.tc-bomb');
        const stick = R('.tc-stick-zone');
        const lbl = document.querySelector('#charge-row .sp-label');
        const powerLbl = document.querySelector('.stock-power .hud-lbl');
        return {
          hudR: getComputedStyle(document.querySelector('.hud-bottom')).right,
          stocksW: +stocks.w.toFixed(1),
          gaugesW: +gauges.w.toFixed(1),
          powerVis: +visW(power, stocks).toFixed(1),
          powerW: power ? +power.w.toFixed(1) : 0,
          powerLblDisp: powerLbl ? getComputedStyle(powerLbl).display : null,
          cIn: +visW(charge, gauges).toFixed(1),
          cLblW: lbl ? +lbl.getBoundingClientRect().width.toFixed(1) : 0,
          cLblDisp: lbl ? getComputedStyle(lbl).display : null,
          cLblScroll: lbl ? lbl.scrollWidth : 0,
          gapBC: bomb && charge ? +(bomb.left - charge.right).toFixed(1) : null,
          gapSS: stick && stocks ? +(stocks.left - stick.right).toFixed(1) : null,
          stocksTop: +stocks.top.toFixed(1),
          gaugesTop: +gauges.top.toFixed(1),
          stacked: Math.abs(stocks.top - gauges.top) > 4,
        };
      });
      console.log(
        `@${width}x${HEIGHT}`,
        `hudR=${geo.hudR}`,
        `sW=${geo.stocksW} gW=${geo.gaugesW} stacked=${geo.stacked}`,
        `powerVis=${geo.powerVis}/${geo.powerW} pLbl=${geo.powerLblDisp}`,
        `cIn=${geo.cIn} cLbl=${geo.cLblDisp}:${geo.cLblW}/${geo.cLblScroll}`,
        `gapBC=${geo.gapBC} gapSS=${geo.gapSS}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
