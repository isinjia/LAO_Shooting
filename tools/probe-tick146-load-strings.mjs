/**
 * Tick146: loading with hardcoded real i18n eager strings (longest).
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
];

const SIZES = [
  { width: 400, height: 280 },
  { width: 360, height: 240 },
  { width: 480, height: 288 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
let muddy = 0;
try {
  for (const size of SIZES) {
    for (const [loc, text] of STRINGS) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
            <div class="load-track"><div class="load-fill" style="width:55%"></div></div>
            <div class="load-meta"><span>12 / 22</span><span>55%</span></div>
          `;
          void content.offsetHeight;
          const appR = document.getElementById('app').getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
          const lab = document.getElementById('loading-label');
          return {
            panelOver: +panelOver.toFixed(2),
            headroom: +(appR.bottom - ocR.bottom).toFixed(2),
            ocH: +ocR.height.toFixed(2),
            labelH: +lab.getBoundingClientRect().height.toFixed(2),
            labelLines: Math.round(lab.getBoundingClientRect().height / 16),
          };
        }, text);
        const bad = m.panelOver > 1.5;
        if (bad) muddy++;
        console.log(
          `${bad ? 'MUDDY' : 'ok'} ${loc}@${size.width}x${size.height}`,
          `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH} labelH=${m.labelH}`,
          `| ${text}`,
        );
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log('muddy', muddy);
