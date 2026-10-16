/**
 * Tick146: short-landscape touch HUD corridor — LIFE/BOMB/CHARGE must
 * sit between thumbs without overlapping fixed stick/actions pads.
 * Guards cascade restore (gauges min-width !important + right inset ≥150)
 * against later has-touch-pads punch undoing ≤420 landscape compact.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK146 — short-landscape touch HUD corridor restore/);
const idx = css.indexOf('TICK146 — short-landscape touch HUD corridor restore');
assert.ok(idx > css.indexOf('body.has-touch-pads .hud-gauges {\n  min-width: 180px !important'),
  'TICK146 block must follow gauges 180px !important punch');
const tick146 = css.slice(idx);
assert.match(tick146, /max-height:\s*420px/);
assert.match(tick146, /orientation:\s*landscape/);
assert.match(tick146, /min-width:\s*0\s*!important/);
assert.match(tick146, /right:\s*max\(150px/);
assert.match(tick146, /padding:\s*2px 6px\s*!important/);
assert.match(tick146, /max-width:\s*min\(118px,\s*calc\(100vw - 284px\)\)/);

// Prior short-landscape + punch markers retained.
assert.match(css, /Keep LIFE\/BOMB\/CHARGE between thumbs/);
assert.match(css, /body\.has-touch-pads \.hud-gauges \{\s*min-width:\s*180px !important/);
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK42 — portrait-rotate overlay/);

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
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const fails = [];

try {
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: size,
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
      await page.goto(`${url}?cb=qa146-${Date.now()}-${size.width}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const geo = await page.evaluate((overlapsSrc) => {
        const overlaps = eval(`(${overlapsSrc})`);
        document.body.classList.add('touch-ui', 'has-touch-pads');
        const tc = document.getElementById('touch-controls');
        tc.classList.add('is-on');
        tc.setAttribute('aria-hidden', 'false');
        const overlay = document.getElementById('overlay');
        overlay.classList.remove('show');
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        void tc.offsetHeight;
        const R = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
        };
        const stick = R('.tc-stick-zone');
        const actions = R('.tc-actions');
        const stocks = R('.hud-stocks');
        const gauges = R('.hud-gauges');
        const charge = R('#charge-track');
        const sp = R('#sp-track');
        return {
          stick,
          actions,
          stocks,
          gauges,
          charge,
          sp,
          overlapStickStocks: stick && stocks ? overlaps(stick, stocks, 2) : false,
          overlapActGauges: actions && gauges ? overlaps(actions, gauges, 2) : false,
          overlapStickGauges: stick && gauges ? overlaps(stick, gauges, 2) : false,
          overlapActStocks: actions && stocks ? overlaps(actions, stocks, 2) : false,
          gapStickStocks: stocks && stick ? +(stocks.left - stick.right).toFixed(1) : null,
          gapGaugesAct: gauges && actions ? +(actions.left - gauges.right).toFixed(1) : null,
          gaugesMin: getComputedStyle(document.querySelector('.hud-gauges')).minWidth,
          stocksMax: getComputedStyle(document.querySelector('.hud-stocks')).maxWidth,
          hudRight: getComputedStyle(document.querySelector('.hud-bottom')).right,
        };
      }, overlaps.toString());

      const bad =
        geo.overlapStickStocks ||
        geo.overlapActGauges ||
        geo.overlapStickGauges ||
        geo.overlapActStocks;
      console.log(
        `${bad ? 'FAIL' : 'PASS'} @${size.width}x${size.height}`,
        `gapSS=${geo.gapStickStocks} gapGA=${geo.gapGaugesAct}`,
        `gaugesMin=${geo.gaugesMin} stocksMax=${geo.stocksMax} hudR=${geo.hudRight}`,
      );
      if (bad) fails.push({ size, geo });
      if (size.height <= 420) {
        assert.notEqual(geo.gaugesMin, '180px', 'short-landscape must not keep 180px gauges min');
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

assert.equal(fails.length, 0, `pad/HUD overlap remains: ${JSON.stringify(fails, null, 2)}`);
console.log('qa-touch-hud-corridor: PASS');
