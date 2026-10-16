/**
 * Tick165 — live verify result CTA chrome via real endScreen (force gameover).
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

const LOCALES = ['ko', 'en', 'ru', 'pt', 'es', 'zh-Hant', 'ja'];
const SIZES = [
  { width: 320, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classify(m) {
  const unread =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  const soft = !unread && m.panelOver > 1.5;
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
let hard = 0;
let soft = 0;
let ok = 0;
const hardRows = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
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
            localStorage.setItem('lao_mini_tutorial_seen', '1');
          },
          { loc },
        );
        await page.goto(`${url}?cb=t165v-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.waitForTimeout(80);
        await page.click('#btn-go');
        await page.waitForFunction(
          () => !!window.__LAO__?.getGame?.() || !!document.querySelector('#btn-tut-go'),
          { timeout: 60000 },
        );
        if (await page.$('#btn-tut-go')) {
          await page.click('#btn-tut-go');
        }
        await page.waitForFunction(() => !!window.__LAO__?.getGame?.(), { timeout: 60000 });
        await page.waitForTimeout(200);
        await page.evaluate(() => {
          const g = window.__LAO__.getGame();
          if (g) g.state = 'gameover';
        });
        await page.waitForSelector('#overlay-content.screen-result #btn-retry', {
          timeout: 60000,
        });
        await page.waitForTimeout(280);

        const m = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const cta = oc.querySelector('#btn-retry');
          const sec = oc.querySelector('#btn-title');
          const vis = (el) => {
            if (!el) return 0;
            const r = el.getBoundingClientRect();
            return Math.max(
              0,
              Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
                Math.max(r.top, Math.max(ocR.top, appR.top)),
            );
          };
          const out = (el) => {
            if (!el) return true;
            const r = el.getBoundingClientRect();
            return (
              r.bottom > appR.bottom + 1.5 ||
              r.top < appR.top - 1.5 ||
              r.right > appR.right + 1.5
            );
          };
          const maxHpx = parseFloat(oc.style.maxHeight) || 0;
          const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
          return {
            panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
            maxH: oc.style.maxHeight || '',
            fitH,
            inflated: maxHpx > fitH + 0.5,
            ctaOut: cta ? out(cta) : true,
            ctaVis: +vis(cta).toFixed(1),
            ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
            secOut: sec ? out(sec) : false,
            secVis: sec ? +vis(sec).toFixed(1) : 0,
            secH: +(sec?.getBoundingClientRect().height || 0).toFixed(1),
            short: oc.classList.contains('is-result-short'),
            brandHidden: (() => {
              const b = oc.querySelector(':scope > .brand-mark');
              return b ? getComputedStyle(b).display === 'none' : false;
            })(),
            btnMinH: cta ? cta.style.minHeight || '' : '',
            padT: oc.style.paddingTop || '',
          };
        });

        const cls = classify(m);
        const tag = `result ${loc}@${size.width}x${size.height}`;
        log(
          `${cls} ${tag}`,
          `over=${m.panelOver} maxH=${m.maxH} fitH=${m.fitH} inflated=${m.inflated}`,
          `ctaOut=${m.ctaOut} cta=${m.ctaVis}/${m.ctaH}`,
          `secOut=${m.secOut} sec=${m.secVis}/${m.secH}`,
          `short=${m.short} brandHidden=${m.brandHidden} btnMinH=${m.btnMinH} padT=${m.padT}`,
        );
        if (cls === 'HARD') {
          hard += 1;
          hardRows.push(tag);
        } else if (cls === 'SOFT') soft += 1;
        else ok += 1;
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('');
log(`SUMMARY hard=${hard} soft=${soft} ok=${ok}`);
if (hardRows.length) log('HARD:', hardRows.join(', '));

const primaryHard = hardRows.filter((t) => /@(320x200|360x200|360x240|400x240|400x280)\b/.test(t)).length;
log(`primaryHard@ultra=${primaryHard}`);

writeFileSync(join(root, 'tools', 'probe-tick165-result-verify.out.txt'), lines.join('\n') + '\n');
process.exit(hard || primaryHard ? 2 : 0);
