/**
 * Title layout geometry: where does .keys sit vs overlay-content / CTA / foot.
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

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 450 }, hasTouch: false });
await page.addInitScript(() => {
  localStorage.setItem(
    'lao_mini_settings_v1',
    JSON.stringify({
      lang: 'es',
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
});
await page.goto(`${url}?cb=lay130-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-start', { timeout: 60000 });
await page.waitForTimeout(150);

const snap = await page.evaluate(() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      t: +r.top.toFixed(1),
      b: +r.bottom.toFixed(1),
      h: +r.height.toFixed(1),
      display: cs.display,
      position: cs.position,
      overflow: cs.overflow + '/' + cs.overflowY,
      maxH: cs.maxHeight,
      minH: cs.minHeight,
      flex: cs.flex,
      order: cs.order,
      z: cs.zIndex,
      margin: `${cs.marginTop} ${cs.marginBottom}`,
    };
  };
  const oc = document.getElementById('overlay-content');
  const kids = [...oc.children].map((el) => ({
    tag: el.tagName,
    cls: el.className,
    id: el.id,
    ...rect(el),
  }));
  return {
    app: rect(document.getElementById('app')),
    oc: rect(oc),
    kids,
    keysInline: {
      minH: oc.querySelector('.keys')?.style.minHeight,
      maxH: oc.querySelector('.keys')?.style.maxHeight,
      gridMin: oc.querySelector('.keys-grid')?.style.minHeight,
      rulesMax: oc.querySelector('.keys-rules')?.style.maxHeight,
    },
  };
});

console.log(JSON.stringify(snap, null, 2));
await browser.close();
server.close();
