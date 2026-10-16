/**
 * Tick144 verify: select CTA-health fitH clamp after ship.
 * Before: @400×280 maxH=260 / panelOver≈17.5 / headroom≈−17.5 / inflated.
 * After: maxH≤fitH / panelOver=0 / headroom≥0 / maxHFitsApp.
 * @280 ctaOut may remain (extreme chrome — playtest; not inflate muddy).
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

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({
        viewport: size,
        hasTouch: false,
        isMobile: false,
      });
      try {
        await page.addInitScript(
          ({ loc }) => {
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
          },
          { loc },
        );
        await page.goto(
          `${url}?cb=v144-${Date.now()}-${loc}-${size.width}x${size.height}`,
          { waitUntil: 'domcontentloaded', timeout: 60000 },
        );
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 90000 });
        await page.waitForTimeout(200);
        const m = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = eval(`(${boxOutSrc})`);
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const go = document.getElementById('btn-go');
          const grid = document.querySelector('.char-grid');
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
          const maxH = parseFloat(oc.style.maxHeight) || 0;
          return {
            fitH,
            maxH: +maxH.toFixed(2),
            panelOverRaw: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
            headroom: +(appR.bottom - ocR.bottom).toFixed(2),
            ctaOut: go ? boxOut(go, appR) : true,
            gridH: grid ? +grid.getBoundingClientRect().height.toFixed(2) : null,
            inflated: maxH > 0 && maxH > fitH + 0.5,
            maxHFitsApp: !(maxH > 0) || maxH <= appR.height + 0.5,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ loc, w: size.width, h: size.height, ...m });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const inflateMuddy = findings.filter(
  (f) =>
    f.inflated ||
    f.maxHFitsApp === false ||
    f.panelOverRaw > 1.5 ||
    f.headroom < -1.5,
);
const chrome280 = findings.filter((f) => f.h === 280 && f.ctaOut);

const out = {
  inflateMuddyCount: inflateMuddy.length,
  chrome280Count: chrome280.length,
  inflateMuddy,
  sample280: findings.filter((f) => f.h === 280),
  sample288: findings.filter((f) => f.h === 288),
  sample320: findings.filter((f) => f.h === 320),
};
console.log(JSON.stringify(out, null, 2));
if (inflateMuddy.length) {
  process.exitCode = 1;
}
