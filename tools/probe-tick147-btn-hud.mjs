/**
 * Tick147 refined: button/HUD chrome only (ignore pointer-events:none
 * .tc-actions container and sibling ring↔pad cluster geometry).
 * Also measure float resting stickBase + bomb/special/focus vs stocks/gauges,
 * and HUD wrap / vertical stack headroom.
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
  { width: 667, height: 375 },
  { width: 800, height: 450 },
];
const MODES = ['fixed', 'floating'];
const LOCALES = ['en', 'ru', 'es'];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

try {
  for (const size of SIZES) {
    for (const padMode of MODES) {
      for (const lang of LOCALES) {
        const page = await browser.newPage({
          viewport: size,
          hasTouch: true,
          isMobile: true,
        });
        try {
          await page.addInitScript(({ padMode, lang }) => {
            localStorage.setItem(
              'lao_mini_settings_v1',
              JSON.stringify({
                lang,
                muted: true,
                bgmVolume: 0,
                sfxVolume: 0,
                autoFire: true,
                padMode,
                fullscreen: false,
              }),
            );
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
          }, { padMode, lang });
          await page.goto(`${url}?cb=t147b-${Date.now()}-${padMode}-${lang}-${size.width}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });

          const geo = await page.evaluate(({ overlapsSrc, padMode }) => {
            const overlaps = eval(`(${overlapsSrc})`);
            document.body.classList.add('touch-ui', 'has-touch-pads');
            const tc = document.getElementById('touch-controls');
            tc.classList.add('is-on');
            tc.classList.toggle('tc-mode-float', padMode === 'floating');
            tc.classList.toggle('tc-mode-fixed', padMode !== 'floating');
            if (padMode === 'floating') tc.classList.add('is-stick-on');
            tc.setAttribute('aria-hidden', 'false');
            const overlay = document.getElementById('overlay');
            overlay.classList.remove('show');
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
            // Force mid charge for ring visual
            const fireEl = document.querySelector('.tc-fire');
            fireEl?.style.setProperty('--tc-charge', '55');
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
            const stick = padMode === 'floating' ? R('.tc-stick-base') : R('.tc-stick-zone');
            const ring = R('.tc-charge-ring');
            const btns = {
              fire: R('.tc-fire'),
              bomb: R('.tc-bomb'),
              special: R('.tc-special'),
              focus: R('.tc-focus'),
              pause: R('.tc-pause'),
            };
            const hud = {
              stocks: R('.hud-stocks'),
              gauges: R('.hud-gauges'),
              charge: R('#charge-track'),
              sp: R('#sp-track'),
              top: R('.hud-top'),
              bottom: R('.hud-bottom'),
              score: R('.hud-stat-score') || R('.hud-top .hud-cluster'),
            };
            const hits = [];
            const check = (name, a, b) => {
              if (a && b && overlaps(a, b, 2)) hits.push(name);
            };
            check('stick×stocks', stick, hud.stocks);
            check('stick×gauges', stick, hud.gauges);
            for (const [bn, br] of Object.entries(btns)) {
              check(`${bn}×stocks`, br, hud.stocks);
              check(`${bn}×gauges`, br, hud.gauges);
              check(`${bn}×charge`, br, hud.charge);
              check(`${bn}×sp`, br, hud.sp);
            }
            check('pause×hudTop', btns.pause, hud.top);
            check('ring×stocks', ring, hud.stocks);
            check('ring×gauges', ring, hud.gauges);
            check('ring×charge', ring, hud.charge);
            check('ring×sp', ring, hud.sp);
            check('stocks×gauges', hud.stocks, hud.gauges);

            // Float stick parked under HUD: move base to right edge of zone
            let floatParkHits = [];
            if (padMode === 'floating') {
              const zone = document.querySelector('.tc-stick-zone');
              const base = document.querySelector('.tc-stick-base');
              if (zone && base) {
                const zr = zone.getBoundingClientRect();
                // Park stick near stocks corridor (right of float zone, bottom)
                base.style.left = `${Math.max(8, zr.width - 90)}px`;
                base.style.bottom = '8px';
                base.style.top = 'auto';
                void base.offsetHeight;
                const parked = R('.tc-stick-base');
                if (parked && hud.stocks && overlaps(parked, hud.stocks, 2)) {
                  floatParkHits.push('parkedStick×stocks');
                }
                if (parked && hud.gauges && overlaps(parked, hud.gauges, 2)) {
                  floatParkHits.push('parkedStick×gauges');
                }
                // restore resting for sizes log
                base.style.left = '';
                base.style.bottom = '';
              }
            }

            const fireCs = getComputedStyle(document.querySelector('.tc-fire'));
            const bombCs = getComputedStyle(document.querySelector('.tc-bomb'));
            const actCs = getComputedStyle(document.querySelector('.tc-actions'));
            const hudB = getComputedStyle(document.querySelector('.hud-bottom'));
            const gaugesCs = getComputedStyle(document.querySelector('.hud-gauges'));

            // Leftmost action button edge vs gauges right
            const actionButtons = [btns.fire, btns.bomb, btns.special, btns.focus].filter(Boolean);
            const leftmostBtn = actionButtons.reduce(
              (min, b) => (b.left < min ? b.left : min),
              Infinity,
            );
            const gapBtnGauges =
              hud.gauges && Number.isFinite(leftmostBtn)
                ? +(leftmostBtn - hud.gauges.right).toFixed(1)
                : null;
            const gapStickStocks =
              stick && hud.stocks ? +(hud.stocks.left - stick.right).toFixed(1) : null;

            // HUD cluster wrap: bottom cluster taller than ~1 row?
            const wrapTall = hud.bottom && hud.bottom.h > 72;

            return {
              hits,
              floatParkHits,
              gapBtnGauges,
              gapStickStocks,
              wrapTall,
              bottomH: hud.bottom?.h,
              fireW: fireCs.width,
              bombW: bombCs.width,
              actW: actCs.width,
              hudR: hudB.right,
              gaugesMin: gaugesCs.minWidth,
              boxes: { stick, ring, ...btns, ...hud, leftmostBtn },
            };
          }, { overlapsSrc: overlaps.toString(), padMode });

          const muddy = geo.hits.length > 0 || geo.floatParkHits.length > 0;
          if (lang === 'en') {
            console.log(
              `${muddy ? 'MUDDY' : 'clear'} @${size.width}x${size.height} ${padMode}`,
              `hits=[${geo.hits}] park=[${geo.floatParkHits}]`,
              `gapBG=${geo.gapBtnGauges} gapSS=${geo.gapStickStocks}`,
              `fireW=${geo.fireW} bombW=${geo.bombW} actW=${geo.actW} hudR=${geo.hudR}`,
              `wrapTall=${geo.wrapTall} bottomH=${geo.bottomH}`,
            );
          }
          if (muddy) {
            findings.push({ size, padMode, lang, hits: geo.hits, park: geo.floatParkHits, gaps: { gapBtnGauges: geo.gapBtnGauges, gapStickStocks: geo.gapStickStocks }, fireW: geo.fireW, actW: geo.actW, hudR: geo.hudR });
          }
        } finally {
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== REAL BUTTON/HUD FINDINGS ===');
console.log(JSON.stringify(findings, null, 2));
console.log(`total=${findings.length}`);
