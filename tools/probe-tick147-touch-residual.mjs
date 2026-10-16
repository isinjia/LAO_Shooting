/**
 * Tick147 preferred residual scan (after tick146 corridor):
 *   A) Float padMode HUD corridor @ short-landscape
 *   B) Charge ring vs pads / gauges / stocks / pause
 *   C) HUD cluster clip / out-of-app
 * Flags only live-measured muddy (overlap / clip / OOB).
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
      resolve({ server, url: `http://127.0.1:${port}/`.replace('127.0.1', '127.0.0.1') });
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
  { width: 667, height: 375 },
];
const MODES = ['fixed', 'floating'];
const CHARGE_PCTS = [0, 15, 45, 85, 100];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

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
        await page.goto(`${url}?cb=t147-${Date.now()}-${padMode}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const geo = await page.evaluate(
          ({ overlapsSrc, chargePcts, padMode }) => {
            const overlaps = eval(`(${overlapsSrc})`);
            document.body.classList.add('touch-ui', 'has-touch-pads');
            const tc = document.getElementById('touch-controls');
            tc.classList.add('is-on');
            tc.classList.toggle('tc-mode-float', padMode === 'floating');
            tc.classList.toggle('tc-mode-fixed', padMode !== 'floating');
            tc.setAttribute('aria-hidden', 'false');
            // Simulate float stick visible (default resting base).
            if (padMode === 'floating') tc.classList.add('is-stick-on');
            const overlay = document.getElementById('overlay');
            overlay.classList.remove('show');
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
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
            const app = document.getElementById('app')?.getBoundingClientRect();
            const stickZone = R('.tc-stick-zone');
            const stickBase = R('.tc-stick-base');
            const actions = R('.tc-actions');
            const fire = R('.tc-fire');
            const bomb = R('.tc-bomb');
            const special = R('.tc-special');
            const focus = R('.tc-focus');
            const pause = R('.tc-pause');
            const stocks = R('.hud-stocks');
            const gauges = R('.hud-gauges');
            const chargeHud = R('#charge-track');
            const sp = R('#sp-track');
            const hudBottom = R('.hud-bottom');
            const hudTop = R('.hud-top');

            // Physical thumb anchors: fixed uses zone; float uses resting base.
            const stickHit = padMode === 'floating' ? stickBase : stickZone;

            const padOverlaps = {
              stickStocks: stickHit && stocks ? overlaps(stickHit, stocks, 2) : false,
              stickGauges: stickHit && gauges ? overlaps(stickHit, gauges, 2) : false,
              actGauges: actions && gauges ? overlaps(actions, gauges, 2) : false,
              actStocks: actions && stocks ? overlaps(actions, stocks, 2) : false,
              fireGauges: fire && gauges ? overlaps(fire, gauges, 2) : false,
              bombGauges: bomb && gauges ? overlaps(bomb, gauges, 2) : false,
              specialGauges: special && gauges ? overlaps(special, gauges, 2) : false,
              focusGauges: focus && gauges ? overlaps(focus, gauges, 2) : false,
              pauseHudTop: pause && hudTop ? overlaps(pause, hudTop, 2) : false,
            };

            // Zone-vs-HUD for float (large half-screen zone may cover HUD by design —
            // only flag if stickBase OR action buttons collide with HUD chrome).
            const zoneOverStocks =
              padMode === 'floating' && stickZone && stocks
                ? overlaps(stickZone, stocks, 2)
                : false;

            const ringHits = [];
            const fireEl = document.querySelector('.tc-fire');
            const ringEl = document.querySelector('.tc-charge-ring');
            for (const pct of chargePcts) {
              if (fireEl) fireEl.style.setProperty('--tc-charge', String(pct));
              if (pct >= 100) fireEl?.classList.add('is-charge-ready');
              else fireEl?.classList.remove('is-charge-ready');
              void fireEl?.offsetHeight;
              const ring = R('.tc-charge-ring');
              const hit = {
                pct,
                ring,
                vsGauges: ring && gauges ? overlaps(ring, gauges, 1) : false,
                vsStocks: ring && stocks ? overlaps(ring, stocks, 1) : false,
                vsChargeHud: ring && chargeHud ? overlaps(ring, chargeHud, 1) : false,
                vsSp: ring && sp ? overlaps(ring, sp, 1) : false,
                vsPause: ring && pause ? overlaps(ring, pause, 1) : false,
                vsBomb: ring && bomb ? overlaps(ring, bomb, 1) : false,
                vsSpecial: ring && special ? overlaps(ring, special, 1) : false,
                vsFocus: ring && focus ? overlaps(ring, focus, 1) : false,
              };
              hit.any =
                hit.vsGauges ||
                hit.vsStocks ||
                hit.vsChargeHud ||
                hit.vsSp ||
                hit.vsPause ||
                hit.vsBomb ||
                hit.vsSpecial ||
                hit.vsFocus;
              ringHits.push(hit);
            }

            const clip = (el) => {
              if (!el || !app) return false;
              return (
                el.left < app.left - 1.5 ||
                el.right > app.right + 1.5 ||
                el.top < app.top - 1.5 ||
                el.bottom > app.bottom + 1.5
              );
            };

            const csG = getComputedStyle(document.querySelector('.hud-gauges'));
            const csB = getComputedStyle(document.querySelector('.hud-bottom'));
            const csS = getComputedStyle(document.querySelector('.hud-stocks'));
            const ringStyle = ringEl ? getComputedStyle(ringEl) : null;

            return {
              padMode,
              stickZone,
              stickBase,
              stickHit,
              actions,
              fire,
              bomb,
              special,
              focus,
              pause,
              stocks,
              gauges,
              chargeHud,
              sp,
              hudBottom,
              hudTop,
              padOverlaps,
              zoneOverStocks,
              anyPadHud:
                padOverlaps.stickStocks ||
                padOverlaps.stickGauges ||
                padOverlaps.actGauges ||
                padOverlaps.actStocks ||
                padOverlaps.fireGauges ||
                padOverlaps.bombGauges ||
                padOverlaps.specialGauges ||
                padOverlaps.focusGauges,
              pauseHudTop: padOverlaps.pauseHudTop,
              ringAny: ringHits.some((h) => h.any),
              ringHits: ringHits.filter((h) => h.any),
              hudBottomClip: clip(hudBottom),
              hudTopClip: clip(hudTop),
              stocksClip: clip(stocks),
              gaugesClip: clip(gauges),
              gapStickStocks:
                stocks && stickHit ? +(stocks.left - stickHit.right).toFixed(1) : null,
              gapGaugesAct:
                gauges && actions ? +(actions.left - gauges.right).toFixed(1) : null,
              gapGaugesFire:
                gauges && fire ? +(fire.left - gauges.right).toFixed(1) : null,
              gaugesMin: csG.minWidth,
              stocksMax: csS.maxWidth,
              hudRight: csB.right,
              hudLeft: csB.left,
              ringInset: ringStyle?.inset || null,
              fireOverflow: fireEl ? getComputedStyle(fireEl).overflow : null,
              fireClip: fireEl ? getComputedStyle(fireEl).clipPath : null,
            };
          },
          { overlapsSrc: overlaps.toString(), chargePcts: CHARGE_PCTS, padMode },
        );

        const muddy =
          geo.anyPadHud ||
          geo.pauseHudTop ||
          geo.ringAny ||
          geo.hudBottomClip ||
          geo.hudTopClip ||
          geo.stocksClip ||
          geo.gaugesClip;

        const line = [
          muddy ? 'MUDDY' : 'clear',
          `@${size.width}x${size.height}`,
          padMode,
          `gapSS=${geo.gapStickStocks}`,
          `gapGA=${geo.gapGaugesAct}`,
          `gapGF=${geo.gapGaugesFire}`,
          `padHud=${geo.anyPadHud}`,
          `pauseTop=${geo.pauseHudTop}`,
          `ring=${geo.ringAny}`,
          `hudClip=${geo.hudBottomClip || geo.stocksClip || geo.gaugesClip}`,
          `zoneStocks=${geo.zoneOverStocks}`,
          `gaugesMin=${geo.gaugesMin}`,
          `hudR=${geo.hudRight}`,
        ].join(' ');
        console.log(line);

        if (muddy || geo.zoneOverStocks) {
          findings.push({
            size,
            padMode,
            muddy,
            zoneOverStocks: geo.zoneOverStocks,
            padOverlaps: geo.padOverlaps,
            ringHits: geo.ringHits,
            gaps: {
              gapStickStocks: geo.gapStickStocks,
              gapGaugesAct: geo.gapGaugesAct,
              gapGaugesFire: geo.gapGaugesFire,
            },
            clip: {
              hudBottom: geo.hudBottomClip,
              stocks: geo.stocksClip,
              gauges: geo.gaugesClip,
              hudTop: geo.hudTopClip,
            },
            boxes: {
              stickHit: geo.stickHit,
              fire: geo.fire,
              bomb: geo.bomb,
              special: geo.special,
              focus: geo.focus,
              gauges: geo.gauges,
              stocks: geo.stocks,
              actions: geo.actions,
            },
          });
        }
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== FINDINGS ===');
console.log(JSON.stringify(findings, null, 2));
console.log(`totalFindings=${findings.length}`);
