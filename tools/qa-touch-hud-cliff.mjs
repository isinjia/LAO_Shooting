/**
 * Tick149: near-ultra short-landscape HUD cliff reclaim (341–360 × ≤420 landscape).
 * Soft reclaim keeps tick146 right:150; stacks clusters; hides unread labels;
 * POWER visible inside stocks; charge inside gauges; actions corridor clear.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(css, /TICK149 — near-ultra short-landscape HUD cliff reclaim/);
const idx149 = css.indexOf('TICK149 — near-ultra short-landscape HUD cliff reclaim');
assert.ok(
  idx149 > css.indexOf('TICK148 — ultra-narrow short-landscape HUD reclaim'),
  'TICK149 must follow TICK148',
);
const tick149 = css.slice(idx149);
assert.match(tick149, /min-width:\s*341px/);
assert.match(tick149, /max-width:\s*360px/);
assert.match(tick149, /max-height:\s*420px/);
assert.match(tick149, /orientation:\s*landscape/);
assert.match(tick149, /calc\(100vw - 284px\)/);
assert.match(tick149, /\.sp-label\s*\{[\s\S]*?display:\s*none/);
assert.match(tick149, /\.power-badge\s*\{[\s\S]*?font-size:\s*9px/);
/* Must NOT soften right to 128 in this band (actions corridor). */
assert.doesNotMatch(tick149, /right:\s*max\(128px/);
/* tick148 ≤340 KEEP */
assert.match(css, /TICK148 — ultra-narrow short-landscape HUD reclaim/);
assert.match(
  css.slice(
    css.indexOf('TICK148 — ultra-narrow short-landscape HUD reclaim'),
    idx149,
  ),
  /max-width:\s*340px/,
);

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
  { width: 320, height: 200, band: 'ultra148' }, // tick148 only
  { width: 342, height: 210, band: 'cliff' },
  { width: 350, height: 220, band: 'cliff' },
  { width: 360, height: 240, band: 'cliff' }, // upper edge — keep right:150
  { width: 400, height: 280, band: 'above' },
  { width: 568, height: 320, band: 'above' },
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
        await page.goto(`${url}?cb=qa149-${Date.now()}-${padMode}-${size.width}`, {
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
            const gauges = R('.hud-gauges');
            const stocks = R('.hud-stocks');
            const power = R('.power-badge');
            const actions = R('.tc-actions');
            const stick =
              padMode === 'floating' ? R('.tc-stick-base') : R('.tc-stick-zone');
            const label = document.querySelector('#charge-row .sp-label');
            const labelDisplay = label ? getComputedStyle(label).display : null;
            return {
              fireW: getComputedStyle(document.querySelector('.tc-fire')).width,
              bombW: getComputedStyle(document.querySelector('.tc-bomb')).width,
              hudRight: getComputedStyle(document.querySelector('.hud-bottom')).right,
              gaugesW: gauges ? +gauges.w.toFixed(1) : null,
              chargeW: charge ? +charge.w.toFixed(1) : null,
              chargeInGauges: charge && gauges ? +visW(charge, gauges).toFixed(1) : null,
              powerVisW: power && stocks ? +visW(power, stocks).toFixed(1) : null,
              bombCharge: overlaps(bomb, charge, 2),
              bombGauges: overlaps(bomb, gauges, 2),
              stickStocks: overlaps(stick, stocks, 2),
              stickGauges: overlaps(stick, gauges, 2),
              fireGauges: overlaps(fire, gauges, 2),
              actGauges: overlaps(actions, gauges, 2),
              actStocks: overlaps(actions, stocks, 2),
              gapBombCharge: bomb && charge ? +(bomb.left - charge.right).toFixed(1) : null,
              gapStickStocks: stick && stocks ? +(stocks.left - stick.right).toFixed(1) : null,
              gapGaugesAct: actions && gauges ? +(actions.left - gauges.right).toFixed(1) : null,
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
          geo.fireGauges ||
          (size.band === 'cliff' && (geo.actGauges || geo.actStocks));

        if (size.band === 'cliff') {
          assert.ok(geo.powerVisW >= 12, `POWER visible ≥12px @${size.width}, got ${geo.powerVisW}`);
          assert.ok(
            geo.chargeInGauges >= 20,
            `charge visible in gauges ≥20 @${size.width}, got ${geo.chargeInGauges}`,
          );
          assert.ok(geo.chargeW >= 20, `charge track ≥20 @${size.width}, got ${geo.chargeW}`);
          assert.equal(geo.labelDisplay, 'none', `sp-label hidden @${size.width}`);
          /* Keep tick146 right:150 — do not soften to 128 in this band. */
          assert.ok(
            String(geo.hudRight).includes('150') || parseFloat(geo.hudRight) >= 149,
            `hud right stays tick146 150 @${size.width}, got ${geo.hudRight}`,
          );
          assert.ok(
            geo.gapBombCharge == null || geo.gapBombCharge >= 4,
            `gapBC ${geo.gapBombCharge} @${size.width}`,
          );
          assert.ok(
            geo.gapGaugesAct == null || geo.gapGaugesAct >= 0,
            `gapGA ${geo.gapGaugesAct} @${size.width}`,
          );
          assert.ok(
            geo.gapStickStocks == null || geo.gapStickStocks >= -2.5,
            `gapSS ${geo.gapStickStocks} @${size.width}`,
          );
        }

        if (size.band === 'ultra148') {
          assert.ok(geo.powerVisW >= 12, `POWER @320 kept, got ${geo.powerVisW}`);
          assert.equal(geo.labelDisplay, 'none', 'tick148 label hide kept');
          assert.ok(
            String(geo.hudRight).includes('128') || parseFloat(geo.hudRight) <= 128.5,
            `tick148 right 128 kept, got ${geo.hudRight}`,
          );
        }

        if (size.band === 'above') {
          assert.notEqual(geo.labelDisplay, 'none', `labels remain @${size.width}`);
          assert.ok(
            String(geo.hudRight).includes('150') || parseFloat(geo.hudRight) >= 149,
            `hud right tick146 @${size.width}, got ${geo.hudRight}`,
          );
        }

        console.log(
          `${bad ? 'FAIL' : 'PASS'} @${size.width}x${size.height} ${padMode} (${size.band})`,
          `powerVis=${geo.powerVisW} chargeIn=${geo.chargeInGauges}`,
          `gapBC=${geo.gapBombCharge} gapGA=${geo.gapGaugesAct} gapSS=${geo.gapStickStocks}`,
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
console.log('qa-touch-hud-cliff: PASS');
