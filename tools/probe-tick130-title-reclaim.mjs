/**
 * What-if reclaim for title CONTROLS visibility @800×450.
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

const STEPS = [
  'baseline',
  'hide-strip-foot',
  'hide-strip-foot-status',
  'hide-strip-foot-status-tagline',
  'hide-chrome+compact-hero',
  'hide-chrome+compact-hero+cap-keys',
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const rows = [];

for (const loc of ['es', 'ru', 'en', 'ko']) {
  for (const step of STEPS) {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 }, hasTouch: false });
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
      await page.goto(`${url}?cb=rc130-${Date.now()}-${loc}-${step}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      await page.waitForTimeout(100);
      const snap = await page.evaluate((step) => {
        const oc = document.getElementById('overlay-content');
        const keys = oc.querySelector('.keys');
        const hi = oc.querySelector('.keys-hiscore');
        const grid = oc.querySelector('.keys-grid');
        const start = document.getElementById('btn-start');
        const strip = oc.querySelector('.lobby-resource-strip');
        const foot = oc.querySelector('.lobby-foot');
        const status = oc.querySelector('.lobby-status-bar');
        const tagline = oc.querySelector('.tagline');
        const hero = oc.querySelector('.title-hero');
        const actions = oc.querySelector('.title-actions');

        if (step !== 'baseline') {
          if (strip) strip.style.display = 'none';
          if (foot) foot.style.display = 'none';
        }
        if (step.includes('status') || step.includes('chrome')) {
          if (status) status.style.display = 'none';
        }
        if (step.includes('tagline') || step.includes('chrome')) {
          if (tagline) tagline.style.display = 'none';
        }
        if (step.includes('compact-hero') && hero) {
          const h1 = hero.querySelector('h1');
          const brand = hero.querySelector('.brand-mark');
          const sub = hero.querySelector('.title-sub');
          if (h1) h1.style.fontSize = '22px';
          if (h1) h1.style.marginBottom = '2px';
          if (brand) brand.style.display = 'none';
          if (sub) sub.style.display = 'none';
          hero.style.marginBottom = '0';
        }
        if (step.includes('cap-keys') && keys) {
          // Clear forced min so flex can shrink into remaining space
          keys.style.minHeight = '0px';
          keys.style.maxHeight = '';
          if (grid) grid.style.minHeight = '0px';
          // Then set a parent-aware floor
          void oc.offsetHeight;
          let used = 0;
          for (const child of oc.children) {
            if (child === keys) continue;
            const cs = getComputedStyle(child);
            if (cs.position === 'absolute' || cs.display === 'none') continue;
            const m =
              child.offsetHeight +
              (parseFloat(cs.marginTop) || 0) +
              (parseFloat(cs.marginBottom) || 0);
            used += m;
          }
          const avail = Math.max(0, oc.clientHeight - used);
          const floor = Math.min(avail, 160);
          keys.style.minHeight = `${floor}px`;
          keys.style.maxHeight = `${avail}px`;
          if (actions) {
            actions.style.margin = '4px auto 6px';
            actions.style.gap = '6px';
            const cta = actions.querySelector('.btn-cta');
            if (cta) cta.style.padding = '10px 16px';
          }
        }

        void oc.offsetHeight;
        const ocR = oc.getBoundingClientRect();
        const keysR = keys.getBoundingClientRect();
        const hiR = hi.getBoundingClientRect();
        const gridR = grid.getBoundingClientRect();
        const startR = start.getBoundingClientRect();
        const appR = document.getElementById('app').getBoundingClientRect();
        const hiVis = Math.max(
          0,
          Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
        );
        const keysVis = Math.max(
          0,
          Math.min(keysR.bottom, ocR.bottom) - Math.max(keysR.top, ocR.top),
        );
        return {
          keysTop: +keysR.top.toFixed(1),
          keysH: Math.round(keysR.height),
          keysVis: +keysVis.toFixed(1),
          hiVis: +hiVis.toFixed(1),
          hiH: Math.round(hiR.height),
          gridH: Math.round(gridR.height),
          gridVis: +Math.max(
            0,
            Math.min(gridR.bottom, ocR.bottom) - Math.max(gridR.top, ocR.top),
          ).toFixed(1),
          startOut: startR.bottom > appR.bottom + 1.5,
          heroH: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
          ocH: Math.round(ocR.height),
          keysMin: keys.style.minHeight,
          keysMax: keys.style.maxHeight,
        };
      }, step);
      rows.push({ loc, step, ...snap });
    } finally {
      await page.close();
    }
  }
}

await browser.close();
server.close();
console.log(JSON.stringify(rows, null, 2));
