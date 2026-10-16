/**
 * Tick129: measure select@800×450 pinned chrome and simulate
 * reclaiming .sortie-deco / .select-blurb for char-grid floor.
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
  { width: 800, height: 450 },
  { width: 960, height: 540 },
  { width: 1280, height: 720 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const rows = [];

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
        await page.goto(`${url}?cb=t129-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.waitForTimeout(160);

        const before = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const go = document.getElementById('btn-go');
          const grid = document.querySelector('.char-grid');
          const head = document.querySelector('.sortie-head');
          const deco = document.querySelector('.sortie-deco');
          const blurb = document.querySelector('.select-blurb');
          const brand = document.querySelector('.sortie-head .brand-mark');
          const h2 = document.querySelector('.sortie-head h2');
          const dossier = document.querySelector('.select-dossier');
          const actions = document.querySelector('.select-actions');
          const resource = document.querySelector('.lobby-resource-select');
          const card = document.querySelector('.char-card');
          const appR = app?.getBoundingClientRect();
          const ocR = oc?.getBoundingClientRect();
          const mh = (el) => {
            if (!el) return 0;
            const cs = getComputedStyle(el);
            if (cs.display === 'none') return 0;
            const r = el.getBoundingClientRect();
            const mt = parseFloat(cs.marginTop) || 0;
            const mb = parseFloat(cs.marginBottom) || 0;
            return Math.round(r.height + mt + mb);
          };
          return {
            goOut: !!(go && appR && boxOut(go, appR)),
            goOcOut: !!(go && ocR && boxOut(go, ocR)),
            gridH: grid ? Math.round(grid.getBoundingClientRect().height) : 0,
            gridMinH: grid ? grid.style.minHeight : '',
            cardH: card ? Math.round(card.getBoundingClientRect().height) : 0,
            canScroll: !!(grid && grid.scrollHeight > grid.clientHeight + 2),
            panelH: Math.round(ocR?.height || 0),
            appH: Math.round(appR?.height || 0),
            headH: mh(head),
            decoH: mh(deco),
            blurbH: mh(blurb),
            brandH: mh(brand),
            h2H: mh(h2),
            dossierH: mh(dossier),
            actionsH: mh(actions),
            resourceDisplay: resource ? getComputedStyle(resource).display : null,
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            blurbDisplay: blurb ? getComputedStyle(blurb).display : null,
          };
        }, boxOut.toString());

        // Simulate reclaim: hide deco + blurb, re-run budget if exposed
        const after = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const deco = document.querySelector('.sortie-deco');
          const blurb = document.querySelector('.select-blurb');
          if (deco) deco.style.display = 'none';
          if (blurb) blurb.style.display = 'none';
          // Re-trigger budget via resize path used by game
          window.dispatchEvent(new Event('resize'));
          // Also call sync if present
          if (typeof window.syncSelectPanelBudget === 'function') {
            window.syncSelectPanelBudget();
          }
          // Manual recompute mirroring syncSelectPanelBudget soft floor after hide
          const oc = document.getElementById('overlay-content');
          const grid = document.querySelector('.char-grid');
          const actions = document.querySelector('.select-actions');
          const head = document.querySelector('.sortie-head');
          const resource = document.querySelector('.lobby-resource-select');
          const dossier = document.querySelector('.select-dossier');
          const app = document.getElementById('app');
          const go = document.getElementById('btn-go');
          const card = document.querySelector('.char-card');
          const blockH = (el) => {
            if (!el) return 0;
            const cs = getComputedStyle(el);
            if (cs.display === 'none') return 0;
            const r = el.getBoundingClientRect();
            return r.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
          };
          const appH = app?.clientHeight || window.innerHeight || 540;
          let maxCap = Math.min(680, Math.max(320, Math.floor(appH * 0.92)));
          oc.style.maxHeight = `${maxCap}px`;
          if (resource && appH <= 560) resource.style.display = 'none';
          const padY =
            (parseFloat(getComputedStyle(oc).paddingTop) || 0) +
            (parseFloat(getComputedStyle(oc).paddingBottom) || 0);
          const pinned =
            blockH(head) + blockH(resource) + blockH(dossier) + blockH(actions) + padY;
          const SAFETY = 10;
          let avail = Math.floor(maxCap - pinned - SAFETY);
          const cardH = card ? Math.max(72, blockH(card)) : 110;
          const softFloor = Math.min(Math.ceil(cardH * 0.55), Math.max(0, avail));
          grid.style.minHeight = softFloor >= 40 ? `${softFloor}px` : `${Math.max(0, avail)}px`;
          // Health shave like sync
          for (let i = 0; i < 4; i += 1) {
            void oc.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            const actR = actions.getBoundingClientRect();
            const over = Math.max(
              0,
              actR.bottom - (appR.bottom + 1),
              (appR.top - 1) - actR.top,
              actR.bottom - (ocR.bottom + 1),
              (ocR.top - 1) - actR.top,
            );
            if (over <= 0.5) break;
            if (resource) resource.style.display = 'none';
            const cur = parseFloat(grid.style.minHeight) || 0;
            if (cur > 0) {
              grid.style.minHeight = `${Math.max(0, Math.floor(cur - over - 4))}px`;
              continue;
            }
            maxCap = Math.max(260, Math.floor(maxCap - over - 4));
            oc.style.maxHeight = `${maxCap}px`;
          }
          void oc.offsetHeight;
          const appR = app?.getBoundingClientRect();
          const ocR = oc?.getBoundingClientRect();
          return {
            goOut: !!(go && appR && boxOut(go, appR)),
            goOcOut: !!(go && ocR && boxOut(go, ocR)),
            gridH: grid ? Math.round(grid.getBoundingClientRect().height) : 0,
            gridMinH: grid ? grid.style.minHeight : '',
            cardH: card ? Math.round(card.getBoundingClientRect().height) : 0,
            canScroll: !!(grid && grid.scrollHeight > grid.clientHeight + 2),
            headH: Math.round(blockH(head)),
            decoH: Math.round(blockH(deco)),
            blurbH: Math.round(blockH(blurb)),
            avail: Math.floor(maxCap - pinned - SAFETY),
            softFloor,
            pinned: Math.round(pinned),
            maxCap,
          };
        }, boxOut.toString());

        rows.push({
          size: `${size.width}x${size.height}`,
          loc,
          before,
          after,
          gain: after.gridH - before.gridH,
        });
      } catch (err) {
        rows.push({
          size: `${size.width}x${size.height}`,
          loc,
          error: String(err.message || err).slice(0, 200),
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

const short = rows.filter((r) => r.size === '800x450');
console.log(JSON.stringify({ short, all: rows }, null, 2));
