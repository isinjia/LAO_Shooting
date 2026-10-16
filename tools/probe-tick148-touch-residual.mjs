/**
 * Tick148 residual scan after tick147 pad compact:
 *   A) button×HUD / bomb×charge (tick146–147 keep)
 *   B) charge/SP label clip / ellipsis / unreadability @ ultra-narrow
 *   C) ring×HUD (not sibling pads) + focus/special×HUD
 *   D) pause×hud-top / stocks×gauges / hud clip OOB
 *   E) portrait compact touch if muddy
 * Flags only live-measured muddy (overlap / clip / OOB / label unread).
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
  { width: 568, height: 320, tag: 'SE' },
  { width: 480, height: 288, tag: 'short' },
  { width: 400, height: 280, tag: 'short' },
  { width: 360, height: 240, tag: 'ultra' },
  { width: 320, height: 200, tag: 'ultra' },
  { width: 667, height: 375, tag: 'phoneL' },
  { width: 390, height: 280, tag: 'narrowL' },
  { width: 360, height: 640, tag: 'portrait' },
  { width: 320, height: 568, tag: 'portrait' },
];
const MODES = ['fixed', 'floating'];
const LOCALES = ['en', 'ru', 'es', 'pt'];

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
          await page.goto(`${url}?cb=t148-${Date.now()}-${padMode}-${lang}-${size.width}x${size.height}`, {
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
            // ring×HUD only (sibling pad cluster intentional tick114/147)
            check('ring×stocks', ring, hud.stocks, 1);
            check('ring×gauges', ring, hud.gauges, 1);
            check('ring×charge', ring, hud.charge, 1);
            check('ring×sp', ring, hud.sp, 1);
            check('stocks×gauges', hud.stocks, hud.gauges);

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
                whiteSpace: cs.whiteSpace,
                overflowX: cs.overflowX,
                fontSize: cs.fontSize,
                opacity: cs.opacity,
                color: cs.color,
                clippedByParent:
                  !hidden &&
                  parent &&
                  (r.left < parent.left - 0.5 ||
                    r.right > parent.right + 0.5 ||
                    r.top < parent.top - 0.5 ||
                    r.bottom > parent.bottom + 0.5),
                // Intentional display:none (tick148 ultra-narrow) is not muddy.
                zeroW: !hidden && r.width < 1,
                tinyW: !hidden && r.width > 0 && r.width < 12,
              };
            };

            const chargeLabel = labelInfo('#charge-row .sp-label');
            const spLabel = labelInfo('#sp-row .sp-label');
            const chargeTrack = document.querySelector('#charge-track');
            const spTrack = document.querySelector('#sp-track');
            const chargeTrackCs = chargeTrack ? getComputedStyle(chargeTrack) : null;
            const spTrackCs = spTrack ? getComputedStyle(spTrack) : null;
            const chargeTrackR = R('#charge-track');
            const spTrackR = R('#sp-track');
            const gaugesCs = getComputedStyle(document.querySelector('.hud-gauges'));
            const fireCs = getComputedStyle(document.querySelector('.tc-fire'));
            const bombCs = getComputedStyle(document.querySelector('.tc-bomb'));
            const focusCs = getComputedStyle(document.querySelector('.tc-focus'));
            const ringCs = document.querySelector('.tc-charge-ring')
              ? getComputedStyle(document.querySelector('.tc-charge-ring'))
              : null;

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

            // track inside gauges?
            const chargeOutsideGauges =
              chargeTrackR &&
              hud.gauges &&
              (chargeTrackR.left < hud.gauges.left - 1 ||
                chargeTrackR.right > hud.gauges.right + 1);
            const spOutsideGauges =
              spTrackR &&
              hud.gauges &&
              (spTrackR.left < hud.gauges.left - 1 || spTrackR.right > hud.gauges.right + 1);

            // power badge vs pads
            check('power×fire', hud.power, btns.fire);
            check('power×bomb', hud.power, btns.bomb);

            const labelMuddy =
              (chargeLabel && (chargeLabel.zeroW || chargeLabel.clippedByParent)) ||
              (spLabel && (spLabel.zeroW || spLabel.clippedByParent)) ||
              chargeOutsideGauges ||
              spOutsideGauges;

            return {
              hits,
              labelMuddy: !!labelMuddy,
              chargeLabel,
              spLabel,
              chargeOutsideGauges,
              spOutsideGauges,
              gapBtnGauges,
              gapBombCharge,
              gapStickStocks,
              fireW: fireCs.width,
              bombW: bombCs.width,
              focusW: focusCs.width,
              chargeTrackW: chargeTrackR?.w,
              spTrackW: spTrackR?.w,
              chargeMin: chargeTrackCs?.minWidth,
              gaugesMax: gaugesCs.maxWidth,
              gaugesOverflow: gaugesCs.overflow,
              ringInset: ringCs?.inset,
              clip: {
                bottom: clip(hud.bottom),
                stocks: clip(hud.stocks),
                gauges: clip(hud.gauges),
                top: clip(hud.top),
                fire: clip(btns.fire),
                bomb: clip(btns.bomb),
                focus: clip(btns.focus),
                pause: clip(btns.pause),
              },
              boxes: { stick, ring, ...btns, ...hud },
            };
          }, { overlapsSrc: overlaps.toString(), padMode });

          const clipAny = Object.values(geo.clip).some(Boolean);
          const muddy = geo.hits.length > 0 || geo.labelMuddy || clipAny;
          if (lang === 'en') {
            console.log(
              `${muddy ? 'MUDDY' : 'clear'} @${size.width}x${size.height}(${size.tag}) ${padMode}`,
              `hits=[${geo.hits}]`,
              `gapBG=${geo.gapBtnGauges} gapBC=${geo.gapBombCharge} gapSS=${geo.gapStickStocks}`,
              `fireW=${geo.fireW} bombW=${geo.bombW}`,
              `cW=${geo.chargeTrackW} spW=${geo.spTrackW} cMin=${geo.chargeMin}`,
              `cLbl=${geo.chargeLabel?.text}:${geo.chargeLabel?.w} ov=${geo.chargeLabel?.overflow} clipP=${geo.chargeLabel?.clippedByParent}`,
              `spLbl=${geo.spLabel?.text}:${geo.spLabel?.w} ov=${geo.spLabel?.overflow}`,
              `outG=${geo.chargeOutsideGauges}/${geo.spOutsideGauges}`,
              `clip=${JSON.stringify(geo.clip)}`,
            );
          }
          if (muddy) {
            findings.push({
              size,
              padMode,
              lang,
              hits: geo.hits,
              labelMuddy: geo.labelMuddy,
              chargeLabel: geo.chargeLabel,
              spLabel: geo.spLabel,
              chargeOutsideGauges: geo.chargeOutsideGauges,
              spOutsideGauges: geo.spOutsideGauges,
              gaps: {
                gapBtnGauges: geo.gapBtnGauges,
                gapBombCharge: geo.gapBombCharge,
                gapStickStocks: geo.gapStickStocks,
              },
              fireW: geo.fireW,
              bombW: geo.bombW,
              clip: geo.clip,
            });
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

console.log('\n=== TICK148 FINDINGS ===');
console.log(JSON.stringify(findings, null, 2));
console.log(`total=${findings.length}`);
