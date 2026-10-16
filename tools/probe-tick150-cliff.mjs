/**
 * Tick150 cliff / residual dump after tick149 (≤360 soft reclaim).
 * Scan remaining short-landscape widths above 360 + float/ring/portrait
 * for live muddy: powerVis clip, unread CHARGE labels, bomb×charge,
 * ring×HUD, float stick×stocks (note parked float is by-design).
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

const CASES = [
  // Remaining cliff band after tick149 max-width:360
  { w: 361, h: 210, mode: 'fixed', tag: 'cliff361' },
  { w: 365, h: 220, mode: 'fixed', tag: 'cliff365' },
  { w: 368, h: 210, mode: 'fixed', tag: 'cliff368' },
  { w: 370, h: 220, mode: 'fixed', tag: 'cliff370' },
  { w: 375, h: 240, mode: 'fixed', tag: 'cliff375' },
  { w: 380, h: 220, mode: 'fixed', tag: 'cliff380' },
  { w: 390, h: 260, mode: 'fixed', tag: 'cliff390' },
  { w: 400, h: 280, mode: 'fixed', tag: 'short400' },
  // Control points already shipped
  { w: 360, h: 240, mode: 'fixed', tag: 'tick149' },
  { w: 342, h: 210, mode: 'fixed', tag: 'tick149e' },
  { w: 320, h: 200, mode: 'fixed', tag: 'tick148' },
  // Float
  { w: 361, h: 210, mode: 'floating', tag: 'float361' },
  { w: 370, h: 220, mode: 'floating', tag: 'float370' },
  { w: 400, h: 280, mode: 'floating', tag: 'float400' },
  { w: 360, h: 240, mode: 'floating', tag: 'float360' },
  { w: 320, h: 200, mode: 'floating', tag: 'float320' },
  // Portrait (rotate-lock expected)
  { w: 360, h: 640, mode: 'fixed', tag: 'port360', portrait: true },
  { w: 320, h: 568, mode: 'fixed', tag: 'port320', portrait: true },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const muddy = [];

try {
  for (const c of CASES) {
    const page = await browser.newPage({
      viewport: { width: c.w, height: c.h },
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
      }, { padMode: c.mode });
      await page.goto(`${url}?cb=t150-${c.tag}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#btn-start', { timeout: 60000 });

      const geo = await page.evaluate(
        ({ mode, overlapsSrc, portrait }) => {
          const overlapsFn = eval(`(${overlapsSrc})`);
          document.body.classList.add('touch-ui', 'has-touch-pads');
          if (portrait) document.body.classList.add('is-portrait');
          const tc = document.getElementById('touch-controls');
          tc.classList.add('is-on');
          tc.classList.toggle('tc-mode-float', mode === 'floating');
          tc.classList.toggle('tc-mode-fixed', mode !== 'floating');
          if (mode === 'floating') tc.classList.add('is-stick-on');
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
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              w: r.width,
              h: r.height,
            };
          };
          const visW = (a, clip) =>
            !a || !clip
              ? 0
              : Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));

          const stick =
            mode === 'floating' ? R('.tc-stick-base') : R('.tc-stick-zone');
          const stocks = R('.hud-stocks');
          const gauges = R('.hud-gauges');
          const power = R('.power-badge');
          const charge = R('#charge-track');
          const bomb = R('.tc-bomb');
          const fire = R('.tc-fire');
          const ring = R('.tc-charge-ring');
          const actions = R('.tc-actions');
          const lbl = document.querySelector('#charge-row .sp-label');
          const powerLbl = document.querySelector('.stock-power .hud-lbl');
          const lblRect = lbl ? lbl.getBoundingClientRect() : null;
          const lblOverflow =
            lbl &&
            getComputedStyle(lbl).display !== 'none' &&
            lbl.scrollWidth > lblRect.width + 1;
          const lblEllipsis = lbl ? getComputedStyle(lbl).textOverflow : null;
          const powerVis = visW(power, stocks);
          const cIn = visW(charge, gauges);
          const gapBC = bomb && charge ? bomb.left - charge.right : null;
          const gapGA = gauges && actions ? actions.left - gauges.right : null;
          const gapSS = stick && stocks ? stocks.left - stick.right : null;
          const bombCharge = bomb && charge && overlapsFn(bomb, charge, 2);
          const ringGauges = ring && gauges && overlapsFn(ring, gauges, 1);
          const ringCharge = ring && charge && overlapsFn(ring, charge, 1);
          const stickStocks = stick && stocks && overlapsFn(stick, stocks, 2);
          const fireW = fire ? fire.w : 0;
          const bombW = bomb ? bomb.w : 0;
          const rotateHint = document.querySelector('.rotate-hint');
          const rotateOn =
            rotateHint &&
            getComputedStyle(rotateHint).display !== 'none' &&
            getComputedStyle(rotateHint).visibility !== 'hidden' &&
            +getComputedStyle(rotateHint).opacity > 0.05;

          return {
            hudR: getComputedStyle(document.querySelector('.hud-bottom')).right,
            stocksW: +stocks.w.toFixed(1),
            gaugesW: +gauges.w.toFixed(1),
            powerVis: +powerVis.toFixed(1),
            powerW: power ? +power.w.toFixed(1) : 0,
            powerLblDisp: powerLbl ? getComputedStyle(powerLbl).display : null,
            cIn: +cIn.toFixed(1),
            cLblDisp: lbl ? getComputedStyle(lbl).display : null,
            cLblW: lblRect ? +lblRect.width.toFixed(1) : 0,
            cLblScroll: lbl ? lbl.scrollWidth : 0,
            lblOverflow,
            lblEllipsis,
            gapBC: gapBC != null ? +gapBC.toFixed(1) : null,
            gapGA: gapGA != null ? +gapGA.toFixed(1) : null,
            gapSS: gapSS != null ? +gapSS.toFixed(1) : null,
            bombCharge,
            ringGauges,
            ringCharge,
            stickStocks,
            fireW: +fireW.toFixed(1),
            bombW: +bombW.toFixed(1),
            stacked: Math.abs(stocks.top - gauges.top) > 4,
            rotateOn: !!rotateOn,
            landscape: window.matchMedia('(orientation: landscape)').matches,
          };
        },
        { mode: c.mode, overlapsSrc: overlaps.toString(), portrait: !!c.portrait },
      );

      // Muddy heuristics (ship-worthy, not playtest invent)
      const flags = [];
      if (!c.portrait && geo.landscape) {
        if (geo.powerVis < 12 && geo.powerW > 0) flags.push(`powerVis=${geo.powerVis}`);
        if (
          geo.cLblDisp !== 'none' &&
          geo.lblOverflow &&
          geo.lblEllipsis === 'clip' &&
          geo.cLblW < 20
        ) {
          flags.push(`cLblClip=${geo.cLblW}/${geo.cLblScroll}`);
        }
        if (geo.cIn < 20) flags.push(`cIn=${geo.cIn}`);
        if (geo.bombCharge) flags.push('bomb×charge');
        if (geo.ringGauges) flags.push('ring×gauges');
        if (geo.ringCharge) flags.push('ring×charge');
        // float parked stick×stocks is by-design — only flag if FIXED stick×stocks
        if (c.mode === 'fixed' && geo.stickStocks) flags.push('stick×stocks');
        // gapGA negative at ≤340 is known zone feel — only flag >340
        if (c.w > 340 && geo.gapGA != null && geo.gapGA < -2) flags.push(`gapGA=${geo.gapGA}`);
      }
      if (c.portrait && !geo.rotateOn) {
        // only if rotate hint off AND pad×HUD muddy
        if (geo.bombCharge || (geo.powerVis < 12 && geo.powerW > 0)) {
          flags.push('portraitMuddy+noRotate');
        }
      }

      const line = [
        `${c.tag}@${c.w}x${c.h}/${c.mode}`,
        `hudR=${geo.hudR}`,
        `sW=${geo.stocksW} gW=${geo.gaugesW} stacked=${geo.stacked}`,
        `powerVis=${geo.powerVis}/${geo.powerW}`,
        `cIn=${geo.cIn} cLbl=${geo.cLblDisp}:${geo.cLblW}/${geo.cLblScroll}${geo.lblOverflow ? '!ov' : ''}`,
        `gapBC=${geo.gapBC} gapGA=${geo.gapGA} gapSS=${geo.gapSS}`,
        `fire=${geo.fireW} bomb=${geo.bombW}`,
        `ringG=${geo.ringGauges} ringC=${geo.ringCharge} stickS=${geo.stickStocks}`,
        c.portrait ? `rotate=${geo.rotateOn}` : '',
        flags.length ? `FLAGS:${flags.join(',')}` : 'ok',
      ]
        .filter(Boolean)
        .join(' ');
      console.log(line);
      if (flags.length) muddy.push({ tag: c.tag, w: c.w, h: c.h, mode: c.mode, flags, geo });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== MUDDY SUMMARY ===');
if (!muddy.length) {
  console.log('none — no ship-worthy live muddy in scanned band');
} else {
  for (const m of muddy) {
    console.log(JSON.stringify(m, null, 0));
  }
}
