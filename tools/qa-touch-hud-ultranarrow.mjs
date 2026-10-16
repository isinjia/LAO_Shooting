/**
 * Tick148: ultra-narrow short-landscape HUD reclaim (@≤340×≤420 landscape).
 * POWER badge must stay visibly inside stocks; charge/sp tracks inside gauges;
 * bomb must not overlap charge; pad compact (tick147) retained.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK148 — ultra-narrow short-landscape HUD reclaim/);
const idx148 = css.indexOf('TICK148 — ultra-narrow short-landscape HUD reclaim');
assert.ok(
  idx148 > css.indexOf('TICK147 — short-landscape touch pad compact restore'),
  'TICK148 must follow TICK147',
);
const tick148 = css.slice(idx148);
assert.match(tick148, /max-width:\s*340px/);
assert.match(tick148, /max-height:\s*420px/);
assert.match(tick148, /orientation:\s*landscape/);
assert.match(tick148, /right:\s*max\(128px/);
assert.match(tick148, /calc\(100vw - 254px\)/);
assert.match(tick148, /\.sp-label\s*\{[\s\S]*?display:\s*none/);
assert.match(tick148, /\.power-badge\s*\{[\s\S]*?font-size:\s*9px/);

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

function visW(a, clip) {
  if (!a || !clip) return 0;
  return Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
}

const SIZES = [
  { width: 320, height: 200, ultra: true },
  { width: 360, height: 240, ultra: false },
  { width: 400, height: 280, ultra: false },
  { width: 568, height: 320, ultra: false },
];
const MODES = ['fixed', 'floating'];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const fails = [];

try {
  for (const size of SIZES) {
    for (const padMode of MODES) {
      const page = await browser.newPage({
        viewport: size,
        hasTouch: true,
        isMobile: true,
      });
      try {
        await page.addInitScript(({ padMode }) => {
          localStorage.setItem(
            'lao_mini_settings_v1',
            JSON.stringify({
              lang: 'en',
              muted: true,
              bgmVolume: 0,
              sfxVolume: 0,
              autoFire: true,
              padMode,
              fullscreen: false,
            }),
          );
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        }, { padMode });
        await page.goto(`${url}?cb=qa148-${Date.now()}-${padMode}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const geo = await page.evaluate(
          ({ overlapsSrc, padMode }) => {
            const overlaps = eval(`(${overlapsSrc})`);
            document.body.classList.add('touch-ui', 'has-touch-pads');
            const tc = document.getElementById('touch-controls');
            tc.classList.add('is-on');
            tc.classList.toggle('tc-mode-float', padMode === 'floating');
            tc.classList.toggle('tc-mode-fixed', padMode !== 'floating');
            if (padMode === 'floating') tc.classList.add('is-stick-on');
            tc.setAttribute('aria-hidden', 'false');
            document.getElementById('overlay').style.display = 'none';
            void tc.offsetHeight;
            const R = (sel) => {
              const el = document.querySelector(sel);
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return {
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                w: r.width,
                h: r.height,
              };
            };
            const visW = (a, clip) => {
              if (!a || !clip) return 0;
              return Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
            };
            const bomb = R('.tc-bomb');
            const fire = R('.tc-fire');
            const charge = R('#charge-track');
            const sp = R('#sp-track');
            const gauges = R('.hud-gauges');
            const stocks = R('.hud-stocks');
            const power = R('.power-badge');
            const stick =
              padMode === 'floating' ? R('.tc-stick-base') : R('.tc-stick-zone');
            const label = document.querySelector('#charge-row .sp-label');
            const labelDisplay = label ? getComputedStyle(label).display : null;
            return {
              fireW: getComputedStyle(document.querySelector('.tc-fire')).width,
              bombW: getComputedStyle(document.querySelector('.tc-bomb')).width,
              hudRight: getComputedStyle(document.querySelector('.hud-bottom')).right,
              gaugesW: gauges ? +gauges.w.toFixed(1) : null,
              stocksW: stocks ? +stocks.w.toFixed(1) : null,
              chargeW: charge ? +charge.w.toFixed(1) : null,
              chargeInGauges: charge && gauges ? +(visW(charge, gauges)).toFixed(1) : null,
              powerVisW: power && stocks ? +(visW(power, stocks)).toFixed(1) : null,
              bombCharge: overlaps(bomb, charge, 2),
              bombGauges: overlaps(bomb, gauges, 2),
              stickStocks: overlaps(stick, stocks, 2),
              stickGauges: overlaps(stick, gauges, 2),
              fireGauges: overlaps(fire, gauges, 2),
              gapBombCharge: bomb && charge ? +(bomb.left - charge.right).toFixed(1) : null,
              gapStickStocks: stick && stocks ? +(stocks.left - stick.right).toFixed(1) : null,
              labelDisplay,
            };
          },
          { overlapsSrc: overlaps.toString(), padMode },
        );

        if (size.height <= 420) {
          assert.equal(geo.fireW, '56px', `fire 56 @${size.width} ${padMode}`);
          assert.equal(geo.bombW, '40px', `bomb 40 @${size.width} ${padMode}`);
        }

        const bad =
          geo.bombCharge ||
          geo.bombGauges ||
          geo.stickStocks ||
          geo.stickGauges ||
          geo.fireGauges;

        if (size.ultra) {
          assert.ok(geo.powerVisW >= 12, `POWER visible ≥12px, got ${geo.powerVisW}`);
          assert.ok(geo.chargeInGauges >= 20, `charge visible in gauges ≥20, got ${geo.chargeInGauges}`);
          assert.ok(geo.chargeW >= 20, `charge track ≥20, got ${geo.chargeW}`);
          assert.equal(geo.labelDisplay, 'none', 'sp-label hidden @ultra');
          assert.ok(
            String(geo.hudRight).includes('128') || parseFloat(geo.hudRight) <= 128.5,
            `hud right softened toward 128, got ${geo.hudRight}`,
          );
          assert.ok(geo.gapBombCharge == null || geo.gapBombCharge >= 4, `gapBC ${geo.gapBombCharge}`);
          /* Fixed gapSS≈0; float resting base may sit ~2px into stocks edge
             (still clear under overlaps pad=2; not a corridor invent). */
          assert.ok(geo.gapStickStocks == null || geo.gapStickStocks >= -2.5, `gapSS ${geo.gapStickStocks}`);
        }

        console.log(
          `${bad ? 'FAIL' : 'PASS'} @${size.width}x${size.height} ${padMode}`,
          `powerVis=${geo.powerVisW} chargeIn=${geo.chargeInGauges}`,
          `gapBC=${geo.gapBombCharge} gapSS=${geo.gapStickStocks}`,
          `gaugesW=${geo.gaugesW} hudR=${geo.hudRight} lbl=${geo.labelDisplay}`,
        );
        if (bad) fails.push({ size, padMode, geo });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

assert.equal(fails.length, 0, `HUD/pad overlap remains: ${JSON.stringify(fails, null, 2)}`);
console.log('qa-touch-hud-ultranarrow: PASS');
