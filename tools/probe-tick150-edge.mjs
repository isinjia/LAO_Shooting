/**
 * Tick150 fine edge: 361–364 and variable heights — is POWER/label
 * still hard-unread after tick149 ends at max-width:360?
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

const CASES = [];
for (const w of [358, 360, 361, 362, 363, 364, 365, 366]) {
  for (const h of [200, 210, 220, 240, 280]) {
    CASES.push({ w, h });
  }
}
// Also SE-class short and float park
CASES.push({ w: 568, h: 320 });
CASES.push({ w: 667, h: 375 });
CASES.push({ w: 361, h: 210, mode: 'floating' });
CASES.push({ w: 400, h: 240, mode: 'floating' });

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const c of CASES) {
    const mode = c.mode || 'fixed';
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
      }, { padMode: mode });
      await page.goto(`${url}?cb=t150e-${c.w}x${c.h}-${mode}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const geo = await page.evaluate(({ mode }) => {
        document.body.classList.add('touch-ui', 'has-touch-pads');
        const tc = document.getElementById('touch-controls');
        tc.classList.add('is-on');
        tc.classList.toggle('tc-mode-float', mode === 'floating');
        tc.classList.toggle('tc-mode-fixed', mode !== 'floating');
        if (mode === 'floating') tc.classList.add('is-stick-on');
        tc.setAttribute('aria-hidden', 'false');
        document.getElementById('overlay').style.display = 'none';
        void tc.offsetHeight;
        const R = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width };
        };
        const visW = (a, clip) =>
          !a || !clip
            ? 0
            : Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
        const stocks = R('.hud-stocks');
        const gauges = R('.hud-gauges');
        const power = R('.power-badge');
        const charge = R('#charge-track');
        const bomb = R('.tc-bomb');
        const stick = mode === 'floating' ? R('.tc-stick-base') : R('.tc-stick-zone');
        const actions = R('.tc-actions');
        const cLbl = document.querySelector('#charge-row .sp-label');
        const sLbl = document.querySelector('#sp-row .sp-label');
        const pct = document.querySelector('#sp-pct');
        const powerLbl = document.querySelector('.stock-power .hud-lbl');
        const info = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            disp: cs.display,
            w: +r.width.toFixed(1),
            scroll: el.scrollWidth,
            ov: el.scrollWidth > r.width + 1,
            ell: cs.textOverflow,
            vis: +Math.max(0, Math.min(r.right, gauges.right) - Math.max(r.left, gauges.left)).toFixed(1),
          };
        };
        return {
          hudR: getComputedStyle(document.querySelector('.hud-bottom')).right,
          sW: +stocks.w.toFixed(1),
          gW: +gauges.w.toFixed(1),
          stacked: Math.abs(stocks.top - gauges.top) > 4,
          powerVis: +visW(power, stocks).toFixed(1),
          powerW: power ? +power.w.toFixed(1) : 0,
          powerSpill: power ? +(power.w - visW(power, stocks)).toFixed(1) : 0,
          pLbl: powerLbl ? getComputedStyle(powerLbl).display : null,
          cIn: +visW(charge, gauges).toFixed(1),
          cLbl: info(cLbl),
          sLbl: info(sLbl),
          pct: info(pct),
          gapBC: bomb && charge ? +(bomb.left - charge.right).toFixed(1) : null,
          gapGA: gauges && actions ? +(actions.left - gauges.right).toFixed(1) : null,
          gapSS: stick && stocks ? +(stocks.left - stick.right).toFixed(1) : null,
        };
      }, { mode });

      const hard =
        (geo.powerVis < 12 && geo.powerW > 0) ||
        (geo.cLbl && geo.cLbl.disp !== 'none' && geo.cLbl.ov && geo.cLbl.w < 20 && geo.cLbl.ell === 'clip') ||
        (geo.sLbl && geo.sLbl.disp !== 'none' && geo.sLbl.ov && geo.sLbl.w < 20 && geo.sLbl.ell === 'clip') ||
        geo.cIn < 20 ||
        (geo.gapBC != null && geo.gapBC < -2);

      const soft =
        geo.powerSpill > 4 ||
        (geo.cLbl && geo.cLbl.ov) ||
        (geo.sLbl && geo.sLbl.ov) ||
        (geo.pct && geo.pct.ov && geo.pct.disp !== 'none');

      console.log(
        `@${c.w}x${c.h}/${mode}`,
        `hudR=${geo.hudR} sW=${geo.sW} gW=${geo.gW} st=${geo.stacked}`,
        `pVis=${geo.powerVis}/${geo.powerW} spill=${geo.powerSpill}`,
        `cIn=${geo.cIn}`,
        `cLbl=${geo.cLbl?.disp}:${geo.cLbl?.w}/${geo.cLbl?.scroll}${geo.cLbl?.ov ? '!ov' : ''}`,
        `sLbl=${geo.sLbl?.disp}:${geo.sLbl?.w}/${geo.sLbl?.scroll}${geo.sLbl?.ov ? '!ov' : ''}`,
        `pct=${geo.pct?.disp}:${geo.pct?.w}/${geo.pct?.scroll}${geo.pct?.ov ? '!ov' : ''}`,
        `gapBC=${geo.gapBC} gapGA=${geo.gapGA} gapSS=${geo.gapSS}`,
        hard ? 'HARD' : soft ? 'soft' : 'ok',
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
