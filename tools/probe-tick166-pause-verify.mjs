/**
 * Tick166 ship gate — pause Escape live quit chrome after ultra deepen.
 * Require hard=0 at *@320×200 and keep *@400×240·280 / *@480 clear.
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
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let primaryHard = 0;

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
        await page.goto(`${url}?cb=t166v-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.waitForTimeout(80);
        await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
        await page.waitForTimeout(40);
        await page.click('#btn-go');
        await page.waitForTimeout(900);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(280);
        const hasPause = await page.$('#overlay-content.screen-pause');
        if (!hasPause) {
          log(`SKIP pause ${loc}@${size.width}x${size.height}`);
          continue;
        }
        const m = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const actions = oc.querySelector('.pause-actions');
          const resume = oc.querySelector('#btn-resume');
          const quit = oc.querySelector('#btn-quit');
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
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
              r.right > appR.right + 1.5 ||
              r.left < appR.left - 1.5
            );
          };
          return {
            panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
            maxH: oc.style.maxHeight || '',
            ctaOut: resume ? out(resume) : true,
            ctaVis: +vis(resume).toFixed(1),
            ctaH: +(resume?.getBoundingClientRect().height || 0).toFixed(1),
            secOut: quit ? out(quit) : true,
            secVis: +vis(quit).toFixed(1),
            secH: +(quit?.getBoundingClientRect().height || 0).toFixed(1),
            actionsOut: actions ? out(actions) : false,
            btnMinH: resume ? resume.style.minHeight || '' : '',
            gap: actions ? actions.style.gap || '' : '',
            short: oc.classList.contains('is-pause-short'),
          };
        });
        const cls = classify(m);
        const tag = `pause ${loc}@${size.width}x${size.height}`;
        log(
          `${cls} ${tag}`,
          `over=${m.panelOver} maxH=${m.maxH}`,
          `ctaOut=${m.ctaOut} cta=${m.ctaVis}/${m.ctaH}`,
          `secOut=${m.secOut} sec=${m.secVis}/${m.secH}`,
          `actionsOut=${m.actionsOut} btnMinH=${m.btnMinH} gap=${m.gap} short=${m.short}`,
        );
        if (cls === 'HARD') {
          hard.push({ tag, ...m });
          if (size.width === 320 && size.height === 200) primaryHard += 1;
        } else if (cls === 'SOFT') soft.push({ tag, ...m });
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
log(`SUMMARY hard=${hard.length} soft=${soft.length} ok=${ok} primaryHard@320=${primaryHard}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log(`  ${h.tag} cta=${h.ctaVis}/${h.ctaH} quit=${h.secVis}/${h.secH}`);
}
const outPath = join(root, 'tools', 'probe-tick166-pause-verify.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length || primaryHard ? 2 : 0);
