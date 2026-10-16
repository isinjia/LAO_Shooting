/**
 * Tick147: measure bomb/ring vs #charge-track / #sp-track before/after
 * short-landscape pad compact restore (fire/bomb sizes lost to later 84px punch).
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

const SIZES = [
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
  { width: 360, height: 240 },
  { width: 320, height: 200 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: size, hasTouch: true, isMobile: true });
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
      await page.goto(`${url}?cb=t147c-${Date.now()}-${size.width}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const m = await page.evaluate((overlapsSrc) => {
        const overlaps = eval(`(${overlapsSrc})`);
        document.body.classList.add('touch-ui', 'has-touch-pads');
        const tc = document.getElementById('touch-controls');
        tc.classList.add('is-on', 'tc-mode-fixed');
        tc.classList.remove('tc-mode-float');
        tc.setAttribute('aria-hidden', 'false');
        document.getElementById('overlay').style.display = 'none';
        const fire = document.querySelector('.tc-fire');
        fire?.style.setProperty('--tc-charge', '55');
        void tc.offsetHeight;
        const R = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: +r.left.toFixed(1),
            top: +r.top.toFixed(1),
            right: +r.right.toFixed(1),
            bottom: +r.bottom.toFixed(1),
            w: +r.width.toFixed(1),
            h: +r.height.toFixed(1),
          };
        };
        const bomb = R('.tc-bomb');
        const ring = R('.tc-charge-ring');
        const fireB = R('.tc-fire');
        const special = R('.tc-special');
        const focus = R('.tc-focus');
        const charge = R('#charge-track');
        const sp = R('#sp-track');
        const gauges = R('.hud-gauges');
        const stocks = R('.hud-stocks');
        const stick = R('.tc-stick-zone');
        const actions = R('.tc-actions');
        return {
          fireW: getComputedStyle(fire).width,
          bombW: getComputedStyle(document.querySelector('.tc-bomb')).width,
          specialW: getComputedStyle(document.querySelector('.tc-special')).width,
          focusW: getComputedStyle(document.querySelector('.tc-focus')).width,
          bombCharge: overlaps(bomb, charge, 2),
          bombSp: overlaps(bomb, sp, 2),
          bombGauges: overlaps(bomb, gauges, 2),
          ringCharge: overlaps(ring, charge, 2),
          ringSp: overlaps(ring, sp, 2),
          ringGauges: overlaps(ring, gauges, 2),
          specialGauges: overlaps(special, gauges, 2),
          focusGauges: overlaps(focus, gauges, 2),
          fireGauges: overlaps(fireB, gauges, 2),
          stickStocks: overlaps(stick, stocks, 2),
          actGauges: overlaps(actions, gauges, 2),
          gapBombCharge: bomb && charge ? +(bomb.left - charge.right).toFixed(1) : null,
          gapBombGauges: bomb && gauges ? +(bomb.left - gauges.right).toFixed(1) : null,
          gapStickStocks: stick && stocks ? +(stocks.left - stick.right).toFixed(1) : null,
          gapActGauges: actions && gauges ? +(actions.left - gauges.right).toFixed(1) : null,
          bomb,
          charge,
          gauges,
          fireB,
        };
      }, overlaps.toString());
      const bad =
        m.bombCharge ||
        m.bombSp ||
        m.bombGauges ||
        m.ringCharge ||
        m.ringSp ||
        m.ringGauges ||
        m.specialGauges ||
        m.focusGauges ||
        m.fireGauges ||
        m.stickStocks ||
        m.actGauges;
      console.log(
        `${bad ? 'MUDDY' : 'clear'} @${size.width}x${size.height}`,
        `fire=${m.fireW} bomb=${m.bombW}`,
        `bomb×charge=${m.bombCharge} gapBC=${m.gapBombCharge}`,
        `ring×charge=${m.ringCharge} ring×sp=${m.ringSp}`,
        `gapSS=${m.gapStickStocks} gapGA=${m.gapActGauges}`,
        `bomb=${JSON.stringify(m.bomb)} charge=${JSON.stringify(m.charge)}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
