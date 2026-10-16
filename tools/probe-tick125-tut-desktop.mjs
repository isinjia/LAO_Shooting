/**
 * Prove desktop (non-touch-ui) tutorial clip: body/app overflow:hidden
 * with no panel scroll when content taller than short landscape.
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
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

try {
  for (const size of [
    { width: 1280, height: 720 },
    { width: 960, height: 540 },
    { width: 800, height: 450 },
  ]) {
    for (const loc of ['en', 'es', 'ru', 'pt', 'ko']) {
      const page = await browser.newPage({
        viewport: size,
        hasTouch: false,
        isMobile: false,
      });
      await page.addInitScript(({ loc }) => {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        localStorage.setItem(
          'lao_mini_settings_v1',
          JSON.stringify({
            lang: loc,
            muted: true,
            bgmVolume: 0,
            sfxVolume: 0,
            autoFire: false,
            padMode: 'fixed',
            fullscreen: false,
          }),
        );
        localStorage.removeItem('lao_mini_tutorial_seen');
      }, { loc });

      await page.goto(`${url}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const touchUi = await page.evaluate(() => document.body.classList.contains('touch-ui'));
      await page.click('#btn-start');
      await page.waitForSelector('#btn-go', { timeout: 180000 });
      await page.evaluate(() => localStorage.removeItem('lao_mini_tutorial_seen'));
      await page.click('#btn-go');
      await page.waitForTimeout(250);
      const meta = await page.evaluate(() => {
        const oc = document.getElementById('overlay-content');
        const app = document.getElementById('app');
        const note = document.querySelector('.tutorial-note');
        const actions = document.querySelector('.screen-tutorial .pause-actions, .pause-actions');
        const rows = [...document.querySelectorAll('.tut-row')];
        if (!oc || !oc.classList.contains('screen-tutorial')) {
          return { miss: true };
        }
        const ocR = oc.getBoundingClientRect();
        const appR = app.getBoundingClientRect();
        const cs = getComputedStyle(oc);
        const clippedRows = rows.filter((r) => {
          const rr = r.getBoundingClientRect();
          return rr.bottom > appR.bottom + 1 || rr.bottom > ocR.bottom + 1;
        }).length;
        const noteR = note?.getBoundingClientRect();
        const actR = actions?.getBoundingClientRect();
        return {
          touchUi: document.body.classList.contains('touch-ui'),
          overflowY: cs.overflowY,
          maxH: cs.maxHeight,
          oc: { sh: oc.scrollHeight, ch: oc.clientHeight, top: ocR.top, bottom: ocR.bottom, h: ocR.height },
          app: { h: appR.height, bottom: appR.bottom, overflow: getComputedStyle(app).overflow },
          bodyOverflow: getComputedStyle(document.body).overflow,
          clippedRows,
          rowCount: rows.length,
          noteOut: noteR ? noteR.bottom > appR.bottom + 1 : false,
          actionsOut: actR ? actR.bottom > appR.bottom + 1 || actR.top > appR.bottom : false,
          noteText: (note?.textContent || '').trim().slice(0, 80),
        };
      });
      findings.push({ loc, w: size.width, h: size.height, bootTouchUi: touchUi, ...meta });
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

// Rows scrolled inside .tutorial-grid are expected; only CTA/note outside #app is muddy.
const muddy = findings.filter((f) => f.noteOut || f.actionsOut);
const ok = findings.filter((f) => !f.noteOut && !f.actionsOut && !f.miss);
console.log(JSON.stringify({
  muddyCount: muddy.length,
  okCount: ok.length,
  muddy,
  sampleOk: ok.slice(0, 3),
  all: findings,
}, null, 2));
