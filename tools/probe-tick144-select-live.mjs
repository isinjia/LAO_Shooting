/**
 * Tick144: live select/OPTIONS/tutorial at ultra-short via real show paths.
 * Also detect CTA-health Math.max(260) re-inflate above fitH.
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

const LOCALES = ['ko', 'en', 'es', 'ru'];
const SIZES = [
  { width: 480, height: 288 },
  { width: 400, height: 280 },
  { width: 568, height: 320 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc, seen) {
  const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
  await page.addInitScript(
    ({ loc, seen }) => {
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
      localStorage.setItem('lao_mini_tutorial_seen', seen);
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    },
    { loc, seen },
  );
  await page.goto(`${url}?cb=t144sel-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function measure(page, label) {
  return page.evaluate(({ boxOutSrc, label }) => {
    const boxOut = eval(`(${boxOutSrc})`);
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta =
      oc.querySelector('#btn-go') ||
      oc.querySelector('#btn-begin') ||
      oc.querySelector('#btn-back') ||
      oc.querySelector('#btn-confirm') ||
      oc.querySelector('.btn-cta');
    const grid =
      oc.querySelector('.char-grid') ||
      oc.querySelector('.tutorial-grid') ||
      oc.querySelector('.opt-scroll');
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const maxH = parseFloat(oc.style.maxHeight) || 0;
    const panelOverRaw = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
    const headroom = appR.bottom - ocR.bottom;
    return {
      label,
      className: oc.className,
      fitH,
      maxH: +maxH.toFixed(2),
      panelOverRaw: +panelOverRaw.toFixed(2),
      headroom: +headroom.toFixed(2),
      ctaOut: cta ? boxOut(cta, appR) : true,
      gridH: grid ? +grid.getBoundingClientRect().height.toFixed(2) : null,
      inflated: maxH > 0 && maxH > fitH + 0.5,
      maxHFitsApp: !(maxH > 0) || maxH <= appR.height + 0.5,
      muddy:
        panelOverRaw > 1.5 ||
        headroom < -1.5 ||
        (cta ? boxOut(cta, appR) : false) ||
        (maxH > 0 && maxH > fitH + 0.5),
    };
  }, { boxOutSrc: boxOut.toString(), label });
}

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // SELECT live
      {
        const page = await boot(size, loc, '1');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 90000 });
          await page.waitForTimeout(200);
          findings.push({
            loc,
            size: `${size.width}x${size.height}`,
            kind: 'select',
            ...(await measure(page, 'select')),
          });
        } finally {
          await page.close();
        }
      }
      // TUTORIAL live
      {
        const page = await boot(size, loc, '0');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-begin, #btn-go', { timeout: 90000 });
          await page.waitForTimeout(200);
          const cls = await page.evaluate(
            () => document.getElementById('overlay-content')?.className || '',
          );
          if (cls.includes('tutorial')) {
            findings.push({
              loc,
              size: `${size.width}x${size.height}`,
              kind: 'tutorial',
              ...(await measure(page, 'tutorial')),
            });
          }
        } finally {
          await page.close();
        }
      }
      // OPTIONS live from title
      {
        const page = await boot(size, loc, '1');
        try {
          const opt = page.locator('#btn-options').first();
          if (await opt.count()) {
            await opt.click();
            await page.waitForSelector('#btn-back, .opt-scroll', { timeout: 15000 });
            await page.waitForTimeout(200);
            findings.push({
              loc,
              size: `${size.width}x${size.height}`,
              kind: 'options',
              ...(await measure(page, 'options')),
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

const muddy = findings.filter((f) => f.muddy);
console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      muddy,
      all: findings,
    },
    null,
    2,
  ),
);
