/**
 * Tick162 verify: pause quit/toTitle clear after actions chrome compact.
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

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];

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
        await page.goto(`${url}?cb=v162-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.click('#btn-go');
        await page.waitForTimeout(900);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(280);
        if (!(await page.$('#overlay-content.screen-pause'))) {
          log(`SKIP ${loc}@${size.width}x${size.height}`);
          continue;
        }
        const m = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const resume = document.getElementById('btn-resume');
          const quit = document.getElementById('btn-quit');
          const actions = oc.querySelector('.pause-actions');
          const brand = oc.querySelector('.brand-mark');
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
          const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
          return {
            panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
            maxH: oc.style.maxHeight || '',
            brand: brand ? getComputedStyle(brand).display : '',
            actionsH: bh(actions),
            ctaOut: out(resume),
            ctaVis: +vis(resume).toFixed(1),
            ctaH: bh(resume),
            quitOut: out(quit),
            quitVis: +vis(quit).toFixed(1),
            quitH: bh(quit),
            actionsOut: out(actions),
            compact: !!(resume && getComputedStyle(resume).minHeight === '0px'),
          };
        });
        const hardHit =
          m.ctaOut ||
          m.quitOut ||
          (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
          (m.quitH > 0 && m.quitVis < Math.min(16, m.quitH - 2));
        const tag = `${loc}@${size.width}x${size.height}`;
        const cls = hardHit ? 'HARD' : m.panelOver > 1.5 || m.actionsOut ? 'SOFT' : 'ok';
        log(
          `${cls} ${tag}`,
          `over=${m.panelOver} maxH=${m.maxH || '-'} brand=${m.brand}`,
          `actions=${m.actionsH} compact=${m.compact}`,
          `cta=${m.ctaVis}/${m.ctaH} quit=${m.quitVis}/${m.quitH}`,
          `ctaOut=${m.ctaOut} quitOut=${m.quitOut} actionsOut=${m.actionsOut}`,
        );
        if (hardHit) hard.push({ tag, ...m });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('\n=== HARD SUMMARY ===');
log(`count=${hard.length}`);
for (const h of hard) log(h.tag, `quitVis=${h.quitVis}/${h.quitH}`);
writeFileSync(join(root, 'tools', 'probe-tick162-pause-verify.out.txt'), lines.join('\n') + '\n');
if (hard.length) process.exitCode = 1;
