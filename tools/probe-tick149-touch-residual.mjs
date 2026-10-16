/**
 * Tick149 residual scan after tick148 ultra-narrow reclaim:
 *   Prefer short-landscape / ultra-narrow / float pads muddy not already CLOSED.
 *   Flags overlap / clip / OOB / unread labels (zeroW / clippedByParent /
 *   track outside gauges). Ellipsis alone = playtest (not ship invent).
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

function visW(a, clip) {
  if (!a || !clip) return 0;
  return Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
}

const SIZES = [
  { width: 568, height: 320, tag: 'SE' },
  { width: 480, height: 288, tag: 'short' },
  { width: 400, height: 280, tag: 'short' },
  { width: 390, height: 260, tag: 'narrowL' },
  { width: 360, height: 240, tag: 'mid' },
  { width: 350, height: 220, tag: 'mid' },
  { width: 342, height: 210, tag: 'edge' },
  { width: 340, height: 210, tag: 'edge340' },
  { width: 330, height: 200, tag: 'ultra' },
  { width: 320, height: 200, tag: 'ultra' },
  { width: 300, height: 200, tag: 'ultra' },
  { width: 667, height: 375, tag: 'phoneL' },
];
const MODES = ['fixed', 'floating'];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];
const detail = [];

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
        await page.goto(`${url}?cb=t149-${Date.now()}-${padMode}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const geo = await page.evaluate(
          ({ overlapsSrc, padMode }) => {
            const overlaps = eval(`(${overlapsSrc})`);
            const visW = (a, clip) => {
              if (!a || !clip) return 0;
              return Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
            };
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
            document.querySelector('.tc-fire')?.style.setProperty('--tc-charge', '55');
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
              chargeLabel: R('#charge-row .sp-label'),
              spLabel: R('#sp-row .sp-label'),
              top: R('.hud-top'),
              bottom: R('.hud-bottom'),
              power: R('.power-badge'),
              spPct: R('#sp-pct'),
            };

            const hits = [];
            const check = (name, a, b, pad = 2) => {
              if (a && b && overlaps(a, b, pad)) hits.push(name);
            };
            check('stick×stocks', stick, hud.stocks);
            check('stick×gauges', stick, hud.gauges);
            for (const [bn, br] of Object.entries(btns)) {
              if (bn === 'pause') continue;
              check(`${bn}×stocks`, br, hud.stocks);
              check(`${bn}×gauges`, br, hud.gauges);
              check(`${bn}×charge`, br, hud.charge);
              check(`${bn}×sp`, br, hud.sp);
            }
            check('pause×hudTop', btns.pause, hud.top);
            check('ring×stocks', ring, hud.stocks, 1);
            check('ring×gauges', ring, hud.gauges, 1);
            check('ring×charge', ring, hud.charge, 1);
            check('ring×sp', ring, hud.sp, 1);
            check('stocks×gauges', hud.stocks, hud.gauges);
            check('power×fire', hud.power, btns.fire);
            check('power×bomb', hud.power, btns.bomb);

            const labelInfo = (sel) => {
              const el = document.querySelector(sel);
              if (!el) return null;
              const cs = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              const parent = el.parentElement?.getBoundingClientRect();
              const scrollW = el.scrollWidth;
              const clientW = el.clientWidth;
              const hidden = cs.display === 'none' || cs.visibility === 'hidden';
              return {
                text: (el.textContent || '').trim(),
                w: +r.width.toFixed(1),
                scrollW,
                clientW,
                display: cs.display,
                hidden,
                overflow: !hidden && scrollW > clientW + 1,
                ellipsis: cs.textOverflow,
                zeroW: !hidden && r.width < 1,
                tinyW: !hidden && r.width > 0 && r.width < 12,
                clippedByParent:
                  !hidden &&
                  parent &&
                  (r.left < parent.left - 0.5 ||
                    r.right > parent.right + 0.5 ||
                    r.top < parent.top - 0.5 ||
                    r.bottom > parent.bottom + 0.5),
              };
            };

            const chargeLabel = labelInfo('#charge-row .sp-label');
            const spLabel = labelInfo('#sp-row .sp-label');
            const powerLbl = labelInfo('.stock-power .hud-lbl');
            const spPct = labelInfo('#sp-pct');
            const chargeTrackR = R('#charge-track');
            const spTrackR = R('#sp-track');
            const gaugesCs = getComputedStyle(document.querySelector('.hud-gauges'));
            const bottomCs = getComputedStyle(document.querySelector('.hud-bottom'));
            const stocksCs = getComputedStyle(document.querySelector('.hud-stocks'));
            const fireCs = getComputedStyle(document.querySelector('.tc-fire'));
            const bombCs = getComputedStyle(document.querySelector('.tc-bomb'));

            const clip = (el) => {
              if (!el || !app) return false;
              return (
                el.left < app.left - 1.5 ||
                el.right > app.right + 1.5 ||
                el.top < app.top - 1.5 ||
                el.bottom > app.bottom + 1.5
              );
            };

            const actionButtons = [btns.fire, btns.bomb, btns.special, btns.focus].filter(Boolean);
            const leftmostBtn = actionButtons.reduce(
              (min, b) => (b.left < min ? b.left : min),
              Infinity,
            );
            const gapBtnGauges =
              hud.gauges && Number.isFinite(leftmostBtn)
                ? +(leftmostBtn - hud.gauges.right).toFixed(1)
                : null;
            const gapBombCharge =
              btns.bomb && hud.charge ? +(btns.bomb.left - hud.charge.right).toFixed(1) : null;
            const gapStickStocks =
              stick && hud.stocks ? +(hud.stocks.left - stick.right).toFixed(1) : null;

            const chargeOutsideGauges =
              chargeTrackR &&
              hud.gauges &&
              (chargeTrackR.left < hud.gauges.left - 1 ||
                chargeTrackR.right > hud.gauges.right + 1);
            const spOutsideGauges =
              spTrackR &&
              hud.gauges &&
              (spTrackR.left < hud.gauges.left - 1 || spTrackR.right > hud.gauges.right + 1);

            const chargeIn = chargeTrackR && hud.gauges ? +visW(chargeTrackR, hud.gauges).toFixed(1) : 0;
            const spIn = spTrackR && hud.gauges ? +visW(spTrackR, hud.gauges).toFixed(1) : 0;
            const powerVis = hud.power && hud.stocks ? +visW(hud.power, hud.stocks).toFixed(1) : 0;

            // unread muddy: visible-but-useless labels / tracks
            const labelMuddy =
              (chargeLabel && (chargeLabel.zeroW || chargeLabel.clippedByParent || chargeLabel.tinyW)) ||
              (spLabel && (spLabel.zeroW || spLabel.clippedByParent || spLabel.tinyW)) ||
              chargeOutsideGauges ||
              spOutsideGauges ||
              (powerVis < 8 && hud.power && !powerLbl?.hidden);

            // track too crushed to read fill (even without overlap)
            const trackCrush =
              sizeHintIsShort() &&
              ((chargeIn > 0 && chargeIn < 16) || (spIn > 0 && spIn < 16));

            function sizeHintIsShort() {
              return window.innerHeight <= 420 && window.innerWidth <= 480;
            }

            return {
              hits,
              labelMuddy: !!labelMuddy,
              trackCrush: !!trackCrush,
              chargeLabel,
              spLabel,
              powerLbl,
              spPct,
              chargeOutsideGauges,
              spOutsideGauges,
              gapBtnGauges,
              gapBombCharge,
              gapStickStocks,
              fireW: fireCs.width,
              bombW: bombCs.width,
              chargeTrackW: chargeTrackR?.w,
              spTrackW: spTrackR?.w,
              chargeIn,
              spIn,
              powerVis,
              gaugesW: hud.gauges?.w,
              stocksW: hud.stocks?.w,
              gaugesMax: gaugesCs.maxWidth,
              stocksMax: stocksCs.maxWidth,
              hudRight: bottomCs.right,
              hudLeft: bottomCs.left,
              gaugesOverflow: gaugesCs.overflow,
              flexDir: gaugesCs.flexDirection,
              bottomFlex: getComputedStyle(document.querySelector('.hud-bottom')).flexWrap,
              clip: {
                bottom: clip(hud.bottom),
                stocks: clip(hud.stocks),
                gauges: clip(hud.gauges),
                top: clip(hud.top),
                fire: clip(btns.fire),
                bomb: clip(btns.bomb),
                focus: clip(btns.focus),
                pause: clip(btns.pause),
                charge: clip(hud.charge),
                sp: clip(hud.sp),
                power: clip(hud.power),
              },
              boxes: {
                stick,
                bomb: btns.bomb,
                fire: btns.fire,
                stocks: hud.stocks,
                gauges: hud.gauges,
                charge: hud.charge,
                power: hud.power,
              },
            };
          },
          { overlapsSrc: overlaps.toString(), padMode },
        );

        const clipAny = Object.values(geo.clip).some(Boolean);
        // parked stick×stocks under float is by-design (tick148 S) — strip that hit
        const hitsShip = geo.hits.filter((h) => {
          if (padMode === 'floating' && (h === 'stick×stocks' || h === 'stick×gauges')) {
            // only count if resting buttons also hit OR gap deeply negative beyond -2.5
            return geo.gapStickStocks != null && geo.gapStickStocks < -6;
          }
          return true;
        });
        const muddy = hitsShip.length > 0 || geo.labelMuddy || geo.trackCrush || clipAny;
        const row = {
          size,
          padMode,
          muddy,
          hits: hitsShip,
          allHits: geo.hits,
          labelMuddy: geo.labelMuddy,
          trackCrush: geo.trackCrush,
          gapBC: geo.gapBombCharge,
          gapBG: geo.gapBtnGauges,
          gapSS: geo.gapStickStocks,
          fireW: geo.fireW,
          bombW: geo.bombW,
          cIn: geo.chargeIn,
          spIn: geo.spIn,
          powerVis: geo.powerVis,
          gaugesW: geo.gaugesW,
          stocksW: geo.stocksW,
          hudR: geo.hudRight,
          hudL: geo.hudLeft,
          cLbl: geo.chargeLabel,
          spLbl: geo.spLabel,
          outG: [geo.chargeOutsideGauges, geo.spOutsideGauges],
          clip: geo.clip,
        };
        detail.push(row);
        console.log(
          `${muddy ? 'MUDDY' : 'clear'} @${size.width}x${size.height}(${size.tag}) ${padMode}`,
          `hits=[${hitsShip}]`,
          `gapBG=${geo.gapBtnGauges} gapBC=${geo.gapBombCharge} gapSS=${geo.gapStickStocks}`,
          `powerVis=${geo.powerVis} cIn=${geo.chargeIn} spIn=${geo.spIn}`,
          `gW=${geo.gaugesW} sW=${geo.stocksW} hudR=${geo.hudRight}`,
          `cLbl=${geo.chargeLabel?.display}:${geo.chargeLabel?.w} ov=${geo.chargeLabel?.overflow} tiny=${geo.chargeLabel?.tinyW}`,
          `spLbl=${geo.spLabel?.display}:${geo.spLabel?.w} ov=${geo.spLabel?.overflow}`,
          `crush=${geo.trackCrush} clipAny=${clipAny}`,
        );
        if (muddy) findings.push(row);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== TICK149 FINDINGS ===');
console.log(JSON.stringify(findings, null, 2));
console.log(`total=${findings.length}`);
