/**
 * Tick132 after: tutorial beginSortie short-landscape grid floor.
 * Expect: deco none @≤480, gridH≥56 (2-row soft floor), CTA clear, no panelOver.
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

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 800, height: 450 },
  { width: 720, height: 400 },
  { width: 854, height: 480 },
  { width: 960, height: 540 },
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
          localStorage.setItem('lao_mini_tutorial_seen', '0');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=t132-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go, .char-card', { timeout: 60000 });
        await page.waitForTimeout(80);
        const go = await page.$('#btn-go');
        if (go) await go.click();
        else {
          const card = await page.$('.char-card');
          if (card) await card.click();
          await page.waitForTimeout(40);
          const go2 = await page.$('#btn-go');
          if (go2) await go2.click();
        }
        await page.waitForSelector('#btn-tut-go', { timeout: 60000 });
        await page.waitForTimeout(140);
        const tut = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const goBtn = document.getElementById('btn-tut-go');
          const skip = document.getElementById('btn-tut-skip');
          const grid = document.querySelector('.tutorial-grid');
          const note = document.querySelector('.tutorial-note');
          const deco = document.querySelector('.tutorial-deco');
          const actions = document.querySelector('.pause-actions');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const actR = actions.getBoundingClientRect();
          const ocOverflowY = getComputedStyle(content).overflowY;
          // Content is overflow:hidden (tick125) — scrollHeight>clientHeight alone
          // is not a nested-scroll muddy; only flag if content can actually scroll.
          const contentCanScroll =
            (ocOverflowY === 'auto' || ocOverflowY === 'scroll') &&
            content.scrollHeight > content.clientHeight + 2;
          const gridCan = !!(grid && grid.scrollHeight > grid.clientHeight + 2);
          return {
            goOut: boxOut(goBtn, appR),
            skipOut: boxOut(skip, appR),
            goOcOut: boxOut(goBtn, ocR),
            actionsOver: +(actR.bottom - appR.bottom).toFixed(2),
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            nested: contentCanScroll && gridCan,
            contentCanScroll,
            ocOverflowY,
            gridCan,
            gridH: Math.round(grid.getBoundingClientRect().height),
            gridMinH: grid.style.minHeight || getComputedStyle(grid).minHeight,
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            noteDisplay: note ? getComputedStyle(note).display : null,
            notePad: note ? getComputedStyle(note).padding : null,
            maxH: getComputedStyle(content).maxHeight,
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
          };
        }, boxOut.toString());
        findings.push({ screen: 'tutorial', loc, w: size.width, h: size.height, ...tut });
      } catch (err) {
        findings.push({
          screen: 'error',
          loc,
          w: size.width,
          h: size.height,
          text: String(err.message || err).slice(0, 220),
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

const muddy = findings.filter((f) => {
  if (f.screen === 'error') return true;
  // Primary short landscape (450–480): require ~2-row floor (≥56).
  // Extreme ≤400: 1-row soft floor (≥36) after note/actions reclaim.
  const floorNeed = f.h <= 400 ? 36 : f.h <= 480 ? 56 : 36;
  return (
    f.goOut ||
    f.skipOut ||
    f.goOcOut ||
    f.actionsOver > 1.5 ||
    f.panelOver > 1.5 ||
    f.nested ||
    (f.h <= 480 && f.decoDisplay === 'block') ||
    f.gridH < floorNeed
  );
});

const out = { muddyCount: muddy.length, muddy, findings };
writeFileSync(join(root, 'tools', '_tick132-tutorial-floor.json'), JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      brief: out.findings.map((f) => ({
        loc: f.loc,
        w: f.w,
        h: f.h,
        gridH: f.gridH,
        gridMinH: f.gridMinH,
        deco: f.decoDisplay,
        panelOver: f.panelOver,
        actionsOver: f.actionsOver,
        nested: f.nested,
        goOut: f.goOut,
      })),
    },
    null,
    2,
  ),
);
