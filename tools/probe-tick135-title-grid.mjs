/**
 * Tick135: title CONTROLS keys-grid crush @ extreme-short (640/720).
 * Measure head/rules/hi/grid budget + trial reclaim steps.
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

const LOCALES = ['ko', 'en', 'es', 'ru'];
const SIZES = [
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
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
        await page.goto(`${url}?cb=r135g-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(100);

        const before = await page.evaluate(() => {
          const oc = document.getElementById('overlay-content');
          const app = document.getElementById('app');
          const keys = oc.querySelector('.keys');
          const head = keys.querySelector('.keys-head');
          const grid = keys.querySelector('.keys-grid');
          const rules = keys.querySelector('.keys-rules');
          const hi = keys.querySelector('.keys-hiscore');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hiR = hi.getBoundingClientRect();
          const hiVis = Math.max(
            0,
            Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
          );
          const bh = (el) => {
            if (!el) return 0;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return +(
              r.height +
              (parseFloat(cs.marginTop) || 0) +
              (parseFloat(cs.marginBottom) || 0)
            ).toFixed(1);
          };
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            keysH: +keys.getBoundingClientRect().height.toFixed(1),
            keysMin: keys.style.minHeight || '',
            keysMax: keys.style.maxHeight || '',
            headH: bh(head),
            gridH: +grid.getBoundingClientRect().height.toFixed(1),
            gridMin: grid.style.minHeight || '',
            rulesH: bh(rules),
            hiH: bh(hi),
            hiVis: +hiVis.toFixed(1),
            hiInside: hiVis >= hiR.height - 1.5 && hiR.bottom <= ocR.bottom + 1.5,
            brand: getComputedStyle(oc.querySelector('.title-hero .brand-mark') || document.body)
              .display,
            padY:
              (parseFloat(getComputedStyle(keys).paddingTop) || 0) +
              (parseFloat(getComputedStyle(keys).paddingBottom) || 0),
          };
        });

        // Trial A: compact head + rules margins/font, keep text
        const trialA = await page.evaluate(() => {
          const oc = document.getElementById('overlay-content');
          const app = document.getElementById('app');
          const keys = oc.querySelector('.keys');
          const head = keys.querySelector('.keys-head');
          const grid = keys.querySelector('.keys-grid');
          const rules = keys.querySelector('.keys-rules');
          const hi = keys.querySelector('.keys-hiscore');
          // clear forced min so flex can redistribute after compact
          const prevKeysMin = keys.style.minHeight;
          const prevGridMin = grid.style.minHeight;
          keys.style.minHeight = '';
          grid.style.minHeight = '';
          if (head) {
            head.style.margin = '0 0 2px';
            head.style.fontSize = '11px';
            head.style.padding = '0';
          }
          if (rules) {
            rules.style.margin = '2px 0 0';
            rules.style.fontSize = '10px';
            rules.style.lineHeight = '1.25';
            rules.style.maxHeight = '28px';
            rules.style.overflow = 'hidden';
          }
          void oc.offsetHeight;
          // fund soft grid floor ~40
          const soft = 40;
          const headH = head.getBoundingClientRect().height;
          const rulesH = rules.getBoundingClientRect().height;
          const hiH = hi.getBoundingClientRect().height;
          const padY =
            (parseFloat(getComputedStyle(keys).paddingTop) || 0) +
            (parseFloat(getComputedStyle(keys).paddingBottom) || 0);
          const need = Math.ceil(headH + soft + rulesH + hiH + padY);
          keys.style.minHeight = `${need}px`;
          keys.style.maxHeight = `${need}px`;
          grid.style.minHeight = `${soft}px`;
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hiR = hi.getBoundingClientRect();
          const hiVis = Math.max(
            0,
            Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
          );
          const start = document.getElementById('btn-start');
          const sR = start.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            keysH: +keys.getBoundingClientRect().height.toFixed(1),
            gridH: +grid.getBoundingClientRect().height.toFixed(1),
            headH: +head.getBoundingClientRect().height.toFixed(1),
            rulesH: +rules.getBoundingClientRect().height.toFixed(1),
            hiH: +hi.getBoundingClientRect().height.toFixed(1),
            hiVis: +hiVis.toFixed(1),
            hiInside: hiVis >= hiR.height - 1.5 && hiR.bottom <= ocR.bottom + 1.5,
            startOut: sR.bottom > appR.bottom + 1.5 || sR.top < appR.top - 1.5,
            need,
            prevKeysMin,
            prevGridMin,
          };
        });

        // Reload for trial B: hide rules (display) last-resort, keep string
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(100);
        const trialB = await page.evaluate(() => {
          const oc = document.getElementById('overlay-content');
          const app = document.getElementById('app');
          const keys = oc.querySelector('.keys');
          const head = keys.querySelector('.keys-head');
          const grid = keys.querySelector('.keys-grid');
          const rules = keys.querySelector('.keys-rules');
          const hi = keys.querySelector('.keys-hiscore');
          keys.style.minHeight = '';
          grid.style.minHeight = '';
          if (head) {
            head.style.margin = '0 0 2px';
            head.style.fontSize = '11px';
          }
          if (rules) rules.style.display = 'none';
          void oc.offsetHeight;
          const soft = 40;
          const headH = head.getBoundingClientRect().height;
          const hiH = hi.getBoundingClientRect().height;
          const padY =
            (parseFloat(getComputedStyle(keys).paddingTop) || 0) +
            (parseFloat(getComputedStyle(keys).paddingBottom) || 0);
          const need = Math.ceil(headH + soft + hiH + padY);
          keys.style.minHeight = `${need}px`;
          keys.style.maxHeight = `${need}px`;
          grid.style.minHeight = `${soft}px`;
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hiR = hi.getBoundingClientRect();
          const hiVis = Math.max(
            0,
            Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
          );
          const start = document.getElementById('btn-start');
          const sR = start.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            keysH: +keys.getBoundingClientRect().height.toFixed(1),
            gridH: +grid.getBoundingClientRect().height.toFixed(1),
            headH: +head.getBoundingClientRect().height.toFixed(1),
            rulesDisplay: getComputedStyle(rules).display,
            hiInside: hiVis >= hiR.height - 1.5 && hiR.bottom <= ocR.bottom + 1.5,
            startOut: sR.bottom > appR.bottom + 1.5 || sR.top < appR.top - 1.5,
            need,
          };
        });

        // Reload trial C: keep rules, hide head label
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(100);
        const trialC = await page.evaluate(() => {
          const oc = document.getElementById('overlay-content');
          const app = document.getElementById('app');
          const keys = oc.querySelector('.keys');
          const head = keys.querySelector('.keys-head');
          const grid = keys.querySelector('.keys-grid');
          const rules = keys.querySelector('.keys-rules');
          const hi = keys.querySelector('.keys-hiscore');
          keys.style.minHeight = '';
          grid.style.minHeight = '';
          if (head) head.style.display = 'none';
          if (rules) {
            rules.style.margin = '0';
            rules.style.fontSize = '10px';
            rules.style.lineHeight = '1.25';
            rules.style.maxHeight = '32px';
            rules.style.overflow = 'hidden';
          }
          void oc.offsetHeight;
          const soft = 40;
          const rulesH = rules.getBoundingClientRect().height;
          const hiH = hi.getBoundingClientRect().height;
          const padY =
            (parseFloat(getComputedStyle(keys).paddingTop) || 0) +
            (parseFloat(getComputedStyle(keys).paddingBottom) || 0);
          const need = Math.ceil(soft + rulesH + hiH + padY);
          keys.style.minHeight = `${need}px`;
          keys.style.maxHeight = `${need}px`;
          grid.style.minHeight = `${soft}px`;
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hiR = hi.getBoundingClientRect();
          const hiVis = Math.max(
            0,
            Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
          );
          const start = document.getElementById('btn-start');
          const sR = start.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            keysH: +keys.getBoundingClientRect().height.toFixed(1),
            gridH: +grid.getBoundingClientRect().height.toFixed(1),
            rulesH: +rules.getBoundingClientRect().height.toFixed(1),
            headDisplay: getComputedStyle(head).display,
            hiInside: hiVis >= hiR.height - 1.5 && hiR.bottom <= ocR.bottom + 1.5,
            startOut: sR.bottom > appR.bottom + 1.5 || sR.top < appR.top - 1.5,
            need,
          };
        });

        rows.push({
          loc,
          w: size.width,
          h: size.height,
          before,
          trialA,
          trialB,
          trialC,
          muddy: before.gridH > 0 && before.gridH < 36,
          winA:
            before.gridH < 36 &&
            trialA.gridH >= 36 &&
            trialA.hiInside &&
            !trialA.startOut &&
            trialA.panelOver <= 1.5,
          winB:
            before.gridH < 36 &&
            trialB.gridH >= 36 &&
            trialB.hiInside &&
            !trialB.startOut &&
            trialB.panelOver <= 1.5,
          winC:
            before.gridH < 36 &&
            trialC.gridH >= 36 &&
            trialC.hiInside &&
            !trialC.startOut &&
            trialC.panelOver <= 1.5,
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

const out = {
  muddyCount: rows.filter((r) => r.muddy).length,
  winA: rows.filter((r) => r.winA).length,
  winB: rows.filter((r) => r.winB).length,
  winC: rows.filter((r) => r.winC).length,
  rows,
};
const outPath = join(root, 'tools', '_tick135-title-grid.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      winA: out.winA,
      winB: out.winB,
      winC: out.winC,
      brief: rows.map((r) => ({
        loc: r.loc,
        w: r.w,
        h: r.h,
        before: r.before && {
          gridH: r.before.gridH,
          headH: r.before.headH,
          rulesH: r.before.rulesH,
          hiH: r.before.hiH,
          keysH: r.before.keysH,
          over: r.before.panelOver,
        },
        A: r.trialA && {
          gridH: r.trialA.gridH,
          hi: r.trialA.hiInside,
          over: r.trialA.panelOver,
          startOut: r.trialA.startOut,
          win: r.winA,
        },
        B: r.trialB && {
          gridH: r.trialB.gridH,
          hi: r.trialB.hiInside,
          over: r.trialB.panelOver,
          startOut: r.trialB.startOut,
          win: r.winB,
        },
        C: r.trialC && {
          gridH: r.trialC.gridH,
          hi: r.trialC.hiInside,
          over: r.trialC.panelOver,
          startOut: r.trialC.startOut,
          win: r.winC,
        },
      })),
      wrote: outPath,
    },
    null,
    2,
  ),
);
process.exit(0);
