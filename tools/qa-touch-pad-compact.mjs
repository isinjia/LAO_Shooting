/**
 * Tick147: short-landscape touch pad compact restore — fire/bomb sizes must
 * beat later chrome punch (84/58) under max-height≤420 landscape so bomb
 * does not overlap #charge-track (@360×240 proven before fix).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK147 — short-landscape touch pad compact restore/);
const idx147 = css.indexOf('TICK147 — short-landscape touch pad compact restore');
const punchMatch = css.match(/\.tc-fire\s*\{\r?\n\s*width:\s*84px/);
assert.ok(punchMatch, 'chrome punch .tc-fire 84px must exist');
const idxPunch = punchMatch.index;
assert.ok(idx147 > idxPunch, 'TICK147 block must follow .tc-fire 84px punch');
assert.ok(
  idx147 > css.indexOf('TICK146 — short-landscape touch HUD corridor restore'),
  'TICK147 must follow TICK146',
);
const tick147 = css.slice(idx147);
assert.match(tick147, /max-height:\s*420px/);
assert.match(tick147, /orientation:\s*landscape/);
assert.match(tick147, /\.tc-fire\s*\{\s*width:\s*56px/);
assert.match(tick147, /\.tc-bomb,\s*\r?\n\s*\.tc-special\s*\{\s*width:\s*40px/);
assert.match(tick147, /tc-mode-float \.tc-fire\s*\{\s*width:\s*56px/);
assert.match(tick147, /#charge-track\s*\{\s*min-width:\s*28px/);
assert.match(tick147, /\.sp-label\s*\{\s*min-width:\s*0/);
assert.match(tick147, /\.hud-gauges\s*\{\s*overflow:\s*hidden/);

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
        await page.goto(`${url}?cb=qa147-${Date.now()}-${padMode}-${size.width}`, {
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
            tc.setAttribute('aria-hidden', 'false');
            document.getElementById('overlay').style.display = 'none';
            document.querySelector('.tc-fire')?.style.setProperty('--tc-charge', '55');
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
            const bomb = R('.tc-bomb');
            const ring = R('.tc-charge-ring');
            const fire = R('.tc-fire');
            const special = R('.tc-special');
            const focus = R('.tc-focus');
            const charge = R('#charge-track');
            const sp = R('#sp-track');
            const gauges = R('.hud-gauges');
            const stocks = R('.hud-stocks');
            const stick =
              padMode === 'floating' ? R('.tc-stick-base') : R('.tc-stick-zone');
            return {
              fireW: getComputedStyle(document.querySelector('.tc-fire')).width,
              bombW: getComputedStyle(document.querySelector('.tc-bomb')).width,
              chargeW: charge ? +charge.w.toFixed(1) : null,
              bombCharge: overlaps(bomb, charge, 2),
              bombSp: overlaps(bomb, sp, 2),
              bombGauges: overlaps(bomb, gauges, 2),
              ringCharge: overlaps(ring, charge, 2),
              ringSp: overlaps(ring, sp, 2),
              ringGauges: overlaps(ring, gauges, 2),
              fireGauges: overlaps(fire, gauges, 2),
              specialGauges: overlaps(special, gauges, 2),
              focusGauges: overlaps(focus, gauges, 2),
              stickStocks: overlaps(stick, stocks, 2),
              stickGauges: overlaps(stick, gauges, 2),
              gapBombCharge: bomb && charge ? +(bomb.left - charge.right).toFixed(1) : null,
            };
          },
          { overlapsSrc: overlaps.toString(), padMode },
        );

        if (size.height <= 420) {
          assert.equal(geo.fireW, '56px', `fire must be 56px @${size.width}x${size.height} ${padMode}`);
          assert.equal(geo.bombW, '40px', `bomb must be 40px @${size.width}x${size.height} ${padMode}`);
          assert.ok(
            geo.chargeW == null || geo.chargeW >= 20,
            `charge track must stay readable (≥20px), got ${geo.chargeW} @${size.width}x${size.height}`,
          );
        }

        const bad =
          geo.bombCharge ||
          geo.bombSp ||
          geo.bombGauges ||
          geo.ringCharge ||
          geo.ringSp ||
          geo.ringGauges ||
          geo.fireGauges ||
          geo.specialGauges ||
          geo.focusGauges ||
          geo.stickStocks ||
          geo.stickGauges;

        console.log(
          `${bad ? 'FAIL' : 'PASS'} @${size.width}x${size.height} ${padMode}`,
          `fire=${geo.fireW} bomb=${geo.bombW} gapBC=${geo.gapBombCharge}`,
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

assert.equal(fails.length, 0, `pad/HUD overlap remains: ${JSON.stringify(fails, null, 2)}`);
console.log('qa-touch-pad-compact: PASS');
