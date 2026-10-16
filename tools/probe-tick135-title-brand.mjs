/**
 * Tick135: title brand/title-sub over-reclaim after tick130 CONTROLS floor.
 * Live-measure whether brand can return while HI + keys floor stay healthy.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
  { width: 854, height: 480 },
  { width: 960, height: 540 },
  { width: 1280, height: 560 },
  { width: 1280, height: 720 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const rows = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
      try {
        await page.addInitScript(({ loc }) => {
          localStorage.setItem(
            'lao_mini_settings_v1',
            JSON.stringify({
              lang: loc,
              muted: true,
              bgmVolume: 0,
              sfxVolume: 0,
              autoFire: true,
              padMode: 'fixed',
              fullscreen: false,
            }),
          );
          localStorage.setItem('lao_mini_tutorial_seen', '1');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=r135b-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(80);
        const before = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const keys = oc.querySelector('.keys');
          const grid = keys?.querySelector('.keys-grid');
          const hi = keys?.querySelector('.keys-hiscore');
          const hero = oc.querySelector('.title-hero');
          const brand = hero?.querySelector('.brand-mark');
          const sub = hero?.querySelector('.title-sub');
          const status = oc.querySelector('.lobby-status-bar');
          const tagline = oc.querySelector('.tagline');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hiR = hi?.getBoundingClientRect();
          const hiVis = hiR
            ? Math.max(0, Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top))
            : 0;
          const cs = (el) => (el ? getComputedStyle(el).display : 'none');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            brandDisplay: cs(brand),
            brandInline: brand?.style?.display || '',
            subDisplay: cs(sub),
            statusDisplay: cs(status),
            tagDisplay: cs(tagline),
            keysH: keys ? +keys.getBoundingClientRect().height.toFixed(1) : 0,
            gridH: grid ? +grid.getBoundingClientRect().height.toFixed(1) : 0,
            hiH: hiR ? +hiR.height.toFixed(1) : 0,
            hiVis: +hiVis.toFixed(1),
            hiInside: !!hiR && hiVis >= hiR.height - 1.5 && hiR.bottom <= ocR.bottom + 1.5,
            brandH: brand && cs(brand) !== 'none' ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
          };
        });

        // Trial: restore brand+title-sub only; keep status/tagline as-is
        const trial = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const keys = oc.querySelector('.keys');
          const grid = keys?.querySelector('.keys-grid');
          const hi = keys?.querySelector('.keys-hiscore');
          const hero = oc.querySelector('.title-hero');
          const brand = hero?.querySelector('.brand-mark');
          const sub = hero?.querySelector('.title-sub');
          const h1 = hero?.querySelector('h1');
          if (brand) brand.style.display = '';
          if (sub) sub.style.display = '';
          if (h1) {
            h1.style.fontSize = '';
            h1.style.marginBottom = '';
          }
          if (hero) hero.style.marginBottom = '';
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hiR = hi?.getBoundingClientRect();
          const hiVis = hiR
            ? Math.max(0, Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top))
            : 0;
          const cs = (el) => (el ? getComputedStyle(el).display : 'none');
          const brandR = brand?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            brandDisplay: cs(brand),
            subDisplay: cs(sub),
            brandH: brand && cs(brand) !== 'none' ? +brandR.height.toFixed(1) : 0,
            brandOut:
              !!brandR &&
              (brandR.bottom > ocR.bottom + 1.5 ||
                brandR.top < ocR.top - 1.5 ||
                brandR.right > ocR.right + 1.5),
            keysH: keys ? +keys.getBoundingClientRect().height.toFixed(1) : 0,
            gridH: grid ? +grid.getBoundingClientRect().height.toFixed(1) : 0,
            hiH: hiR ? +hiR.height.toFixed(1) : 0,
            hiVis: +hiVis.toFixed(1),
            hiInside: !!hiR && hiVis >= hiR.height - 1.5 && hiR.bottom <= ocR.bottom + 1.5,
            hiOver: hiR ? +(hiR.bottom - (ocR.bottom + 1)).toFixed(2) : 0,
            startOut: (() => {
              const b = document.getElementById('btn-start');
              if (!b) return true;
              const r = b.getBoundingClientRect();
              return r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5;
            })(),
          };
        });

        const win =
          before.brandDisplay === 'none' &&
          trial.brandDisplay !== 'none' &&
          trial.brandH >= 10 &&
          !trial.brandOut &&
          trial.hiInside &&
          !trial.startOut &&
          trial.panelOver <= 1.5 &&
          trial.gridH >= 36;

        rows.push({
          loc,
          w: size.width,
          h: size.height,
          before,
          trial,
          win,
          softMuddy: before.brandDisplay === 'none' && before.hiInside && before.panelOver < -20,
        });
      } catch (err) {
        rows.push({ loc, w: size.width, h: size.height, error: String(err?.message || err) });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const wins = rows.filter((r) => r.win);
const soft = rows.filter((r) => r.softMuddy);
const out = { winCount: wins.length, softCount: soft.length, wins, soft, all: rows };
const outPath = join(root, 'tools', '_tick135-title-brand.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      winCount: out.winCount,
      softCount: out.softCount,
      wins: wins.map((r) => ({
        loc: r.loc,
        w: r.w,
        h: r.h,
        beforeOver: r.before.panelOver,
        trialOver: r.trial.panelOver,
        brandH: r.trial.brandH,
        hiInside: r.trial.hiInside,
        gridH: r.trial.gridH,
        keysH: r.trial.keysH,
      })),
      softBrief: soft.map((r) => ({
        loc: r.loc,
        w: r.w,
        h: r.h,
        beforeOver: r.before.panelOver,
        trialWin: r.win,
        trialOver: r.trial?.panelOver,
        trialHi: r.trial?.hiInside,
        trialBrandH: r.trial?.brandH,
      })),
      sample800: rows.filter((r) => r.h === 450 && r.loc === 'es'),
      sample560: rows.filter((r) => r.h === 560 && (r.loc === 'ko' || r.loc === 'es')),
      sample720: rows.filter((r) => r.h === 720 && r.loc === 'ko'),
      wrote: outPath,
    },
    null,
    2,
  ),
);
process.exit(0);
