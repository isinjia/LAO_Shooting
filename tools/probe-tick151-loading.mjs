/**
 * Tick151 — loading ultra-short detail with REAL hardcoded i18n strings.
 * Measure panelOver + brand/h2/label/track/meta at ≤240 heights.
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

const STRINGS = [
  ['en', 'Loading all assets (eager)…'],
  ['pt', 'Carregando todos os recursos (eager)…'],
  ['es', 'Cargando todos los recursos (eager)…'],
  ['ru', 'Загрузка всех ресурсов (eager)…'],
  ['ja', '全アセット読み込み (eager)…'],
  ['ko', '전체 에셋 로드 (eager)…'],
  ['zh-TW', '正在載入全部資源 (eager)…'],
];

const SIZES = [
  { width: 320, height: 180 },
  { width: 320, height: 200 },
  { width: 320, height: 210 },
  { width: 342, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 220 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const muddy = [];

try {
  for (const size of SIZES) {
    for (const [loc, text] of STRINGS) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t151L-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate((text) => {
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('show');
          overlay.classList.remove('hidden');
          overlay.style.display = 'flex';
          content.className = 'screen-loading';
          content.style.cssText = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">LAO MINI ACTION</span>
            <h2>LOADING</h2>
            <span class="loading-deco" aria-hidden="true"></span>
            <p id="loading-label">${text}</p>
            <div class="load-track" aria-hidden="true">
              <div class="load-fill" id="load-fill" style="width:55%"></div>
            </div>
            <div class="load-meta">
              <span id="load-count">12 / 22</span>
              <span id="load-pct">55%</span>
            </div>
          `;
          void content.offsetHeight;
          const appR = document.getElementById('app').getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const brand = content.querySelector('.brand-mark');
          const h2 = content.querySelector('h2');
          const deco = content.querySelector('.loading-deco');
          const lab = document.getElementById('loading-label');
          const track = content.querySelector('.load-track');
          const meta = content.querySelector('.load-meta');
          const cs = getComputedStyle(content);
          const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
          const R = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              h: +r.height.toFixed(2),
              w: +r.width.toFixed(2),
              t: +r.top.toFixed(2),
              b: +r.bottom.toFixed(2),
              disp: getComputedStyle(el).display,
            };
          };
          return {
            panelOver: +panelOver.toFixed(2),
            headroom: +(appR.bottom - ocR.bottom).toFixed(2),
            ocH: +ocR.height.toFixed(2),
            appH: +appR.height.toFixed(2),
            padT: cs.paddingTop,
            padB: cs.paddingBottom,
            brand: R(brand),
            h2: R(h2),
            deco: R(deco),
            lab: R(lab),
            track: R(track),
            meta: R(meta),
            labelText: lab.textContent,
            labelSw: lab.scrollWidth,
          };
        }, text);
        const bad = m.panelOver > 1.5;
        if (bad) muddy.push({ loc, ...size, ...m });
        if (bad || size.height <= 210 || (size.width <= 360 && size.height <= 240)) {
          console.log(
            `${bad ? 'HARD' : 'ok'} ${loc}@${size.width}x${size.height}`,
            `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}/${m.appH}`,
            `brand=${m.brand?.disp}:${m.brand?.h} h2=${m.h2?.h} deco=${m.deco?.disp}`,
            `lab=${m.lab?.h}x${m.lab?.w} track=${m.track?.h} meta=${m.meta?.h}`,
            `pad=${m.padT}/${m.padB}`,
            `| ${text}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== LOAD HARD ===', muddy.length);
for (const r of muddy) {
  console.log(
    `${r.loc}@${r.width}x${r.height} over=${r.panelOver} hr=${r.headroom}`,
    `brandH=${r.brand?.h} h2=${r.h2?.h} labH=${r.lab?.h} track=${r.track?.h} meta=${r.meta?.h}`,
  );
}
