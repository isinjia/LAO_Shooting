/**
 * Tick127 desktop probe: OPTIONS BACK stays inside #app+panel after
 * maxCap + opt-scroll budget across long locales × short landscapes.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 1280, height: 720 },
  { width: 960, height: 540 },
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];
let muddyCount = 0;
let okCount = 0;

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({
        viewport: size,
        hasTouch: false,
        isMobile: false,
      });
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

        await page.goto(`${url}?cb=${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
        // Wait double rAF budget sync + paint.
        await page.waitForTimeout(120);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

        const snap = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const back = document.getElementById('btn-opt-back');
          const scroll = content?.querySelector('.opt-scroll');
          const appR = app?.getBoundingClientRect();
          const ocR = content?.getBoundingClientRect();
          return {
            backOut: !!(back && appR && boxOut(back, appR)),
            backOcOut: !!(back && ocR && boxOut(back, ocR)),
            hasScroll: !!scroll,
            scrollOverflow: scroll ? getComputedStyle(scroll).overflowY : null,
            maxH: content ? getComputedStyle(content).maxHeight : null,
            panelH: Math.round(ocR?.height || 0),
            panelSh: content?.scrollHeight,
            appH: Math.round(appR?.height || 0),
            autofire: (document.querySelector('#opt-autofire')?.closest('label')?.textContent || '').trim().slice(0, 80),
          };
        }, boxOut.toString());

        if (snap.backOut || snap.backOcOut || !snap.hasScroll) {
          muddyCount += 1;
          findings.push({ kind: 'muddy', loc, w: size.width, h: size.height, ...snap });
        } else {
          okCount += 1;
          findings.push({ kind: 'ok', loc, w: size.width, h: size.height, ...snap });
        }
      } catch (err) {
        muddyCount += 1;
        findings.push({
          kind: 'error',
          loc,
          w: size.width,
          h: size.height,
          text: String(err.message || err).slice(0, 200),
        });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify({ muddyCount, okCount, findings }, null, 2));
process.exit(muddyCount > 0 ? 1 : 0);
