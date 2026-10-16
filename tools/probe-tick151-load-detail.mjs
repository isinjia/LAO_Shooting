import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
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
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('x');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

const sizes = [
  [320, 180],
  [320, 190],
  [320, 200],
  [320, 210],
  [320, 220],
  [320, 240],
  [320, 280],
  [330, 200],
  [335, 200],
  [340, 200],
  [360, 200],
];
const text = 'Carregando todos os recursos (eager)…';
const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#btn-start', { timeout: 60000 });
    const m = await page.evaluate((label) => {
      const overlay = document.getElementById('overlay');
      const content = document.getElementById('overlay-content');
      overlay.classList.add('show');
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
      content.className = 'screen-loading';
      content.style.cssText = '';
      content.innerHTML = `
        <div class="panel-frame"></div>
        <span class="brand-mark">LAO MINI ACTION</span>
        <h2>LOADING</h2>
        <span class="loading-deco"></span>
        <p id="loading-label">${label}</p>
        <div class="load-track"><div class="load-fill" style="width:55%"></div></div>
        <div class="load-meta"><span>12 / 22</span><span>55%</span></div>
      `;
      void content.offsetHeight;
      const appR = document.getElementById('app').getBoundingClientRect();
      const ocR = content.getBoundingClientRect();
      const cs = getComputedStyle(content);
      const brand = content.querySelector('.brand-mark');
      const h2 = content.querySelector('h2');
      const p = content.querySelector('#loading-label');
      const track = content.querySelector('.load-track');
      return {
        app: `${appR.width.toFixed(1)}x${appR.height.toFixed(1)}`,
        ocH: +ocR.height.toFixed(2),
        over: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
        hr: +(appR.bottom - ocR.bottom).toFixed(2),
        pad: `${cs.paddingTop}/${cs.paddingBottom}`,
        brandH: brand.getBoundingClientRect().height.toFixed(1),
        brandMB: getComputedStyle(brand).marginBottom,
        h2H: h2.getBoundingClientRect().height.toFixed(1),
        h2MB: getComputedStyle(h2).marginBottom,
        h2FS: getComputedStyle(h2).fontSize,
        pH: p.getBoundingClientRect().height.toFixed(1),
        pMB: getComputedStyle(p).marginBottom,
        trackM: getComputedStyle(track).margin,
        body: document.body.className,
        land: window.matchMedia('(orientation: landscape)').matches,
        mh420: window.matchMedia('(max-height: 420px)').matches,
      };
    }, text);
    console.log(
      `${w}x${h}`,
      `app=${m.app} ocH=${m.ocH} over=${m.over} hr=${m.hr}`,
      `pad=${m.pad} brand=${m.brandH}/${m.brandMB} h2=${m.h2H}/${m.h2FS}/${m.h2MB}`,
      `p=${m.pH}/${m.pMB} trackM=${m.trackM}`,
      `land=${m.land} body=${m.body || '(none)'}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
