/**
 * Tick163: live verify tutorial CTA-health fitH clamp @360 / @320.
 * Expect: maxH ≤ fitH (no Math.max(260) re-inflate); skip CTA readable.
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
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

async function snap(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector('#btn-tut-go');
    const sec = oc.querySelector('#btn-tut-skip');
    const actions = oc.querySelector('.pause-actions');
    const out = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5
      );
    };
    const vis = (el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
    };
    const maxHpx = parseFloat(oc.style.maxHeight) || 0;
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      maxHpx,
      fitH,
      inflated: maxHpx > fitH + 0.5,
      ocH: +ocR.height.toFixed(1),
      appH: +appR.height.toFixed(1),
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      secOut: sec ? out(sec) : true,
      secVis: +vis(sec).toFixed(1),
      secH: +(sec?.getBoundingClientRect().height || 0).toFixed(1),
      actionsOut: actions ? out(actions) : false,
    };
  });
}

function classify(m) {
  const hard =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  return hard ? 'HARD' : m.panelOver > 1.5 || m.actionsOut ? 'SOFT' : 'ok';
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
let hard = 0;
let soft = 0;
let ok = 0;
let inflateFail = 0;
let primaryHard = 0; // @360×240/200 — this tick's ship target

try {
  for (const size of [
    { width: 360, height: 240 },
    { width: 360, height: 200 },
    { width: 400, height: 240 },
    { width: 320, height: 200 },
    { width: 480, height: 288 },
  ]) {
    for (const loc of ['ko', 'ru', 'pt', 'es', 'en']) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.addInitScript(
          ({ loc }) => {
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
          },
          { loc },
        );
        await page.goto(`${url}?cb=t163-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
        await page.click('#btn-go');
        await page.waitForSelector('#overlay-content.screen-tutorial', { timeout: 60000 });
        await page.waitForTimeout(250);
        const m = await snap(page);
        const tag = classify(m);
        if (tag === 'HARD') hard += 1;
        else if (tag === 'SOFT') soft += 1;
        else ok += 1;
        if (m.inflated) inflateFail += 1;
        if (size.width === 360 && tag === 'HARD') primaryHard += 1;
        log(
          `=== ${tag} tut ${loc}@${size.width}x${size.height} ===`,
          JSON.stringify(m),
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

log(
  `\nSUMMARY hard=${hard} soft=${soft} ok=${ok} inflateFail=${inflateFail} primaryHard@360=${primaryHard}`,
);
log('NOTE: @320×200 skip clip after fitH clamp alone is deferred chrome ladder (not this ship).');
writeFileSync(join(root, 'tools', 'probe-tick163-tut-health.out.txt'), lines.join('\n') + '\n');
log('Wrote probe-tick163-tut-health.out.txt');
// Ship gate: no Math.max(260) re-inflate; @360 primary HARD cleared.
if (inflateFail > 0 || primaryHard > 0) process.exitCode = 1;
