/**
 * Tick166 follow-up — pause Escape + CONTROLS live HARD check.
 * Only ship if unread proven; else support honest +0.
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
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
  { width: 800, height: 450 },
  { width: 1280, height: 560 },
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

const measureSrc = `({ ctaSel, secSel, actionsSel }) => {
  const app = document.getElementById('app');
  const oc = document.getElementById('overlay-content');
  if (!app || !oc) return { missing: true };
  void oc.offsetHeight;
  const appR = app.getBoundingClientRect();
  const ocR = oc.getBoundingClientRect();
  const cta = oc.querySelector(ctaSel);
  const sec = secSel ? oc.querySelector(secSel) : null;
  const actions = actionsSel ? oc.querySelector(actionsSel) : null;
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
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      r.bottom > appR.bottom + 1.5 ||
      r.top < appR.top - 1.5 ||
      r.right > appR.right + 1.5 ||
      r.left < appR.left - 1.5
    );
  };
  const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
  return {
    cls: oc.className,
    panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
    maxH: oc.style.maxHeight || '',
    ctaOut: cta ? out(cta) : true,
    ctaVis: +vis(cta).toFixed(1),
    ctaH: bh(cta),
    secOut: sec ? out(sec) : false,
    secVis: sec ? +vis(sec).toFixed(1) : 0,
    secH: bh(sec),
    actionsOut: actions ? out(actions) : false,
    brandHidden: (() => {
      const b = oc.querySelector('.brand-mark');
      return b ? getComputedStyle(b).display === 'none' : false;
    })(),
  };
}`;

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // PAUSE via Escape after short sortie
      {
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
          await page.goto(`${url}?cb=t166p-${loc}-${size.width}x${size.height}`, {
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
          } else {
            const m = await page.evaluate(eval(`(${measureSrc})`), {
              ctaSel: '#btn-resume',
              secSel: '#btn-quit',
              actionsSel: '.pause-actions',
            });
            const cls = classify(m);
            const tag = `pause ${loc}@${size.width}x${size.height}`;
            log(
              `${cls} ${tag}`,
              `over=${m.panelOver} maxH=${m.maxH}`,
              `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
              `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
              `actionsOut=${m.actionsOut} brandHidden=${m.brandHidden}`,
            );
            if (cls === 'HARD') hard.push({ tag, ...m });
            else if (cls === 'SOFT') soft.push({ tag, ...m });
            else ok += 1;
          }
        } finally {
          await page.close();
        }
      }

      // CONTROLS / keys from title (wide sizes)
      if (size.width >= 800 || size.width === 400) {
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
          await page.goto(`${url}?cb=t166k-${loc}-${size.width}x${size.height}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });
          await page.waitForTimeout(160);
          const opened = await page.evaluate(() => {
            const candidates = [
              '#btn-keys',
              '#btn-controls',
              '#btn-how',
              '#btn-help',
              '[data-open="keys"]',
              '.title-actions #btn-keys',
            ];
            for (const sel of candidates) {
              const b = document.querySelector(sel);
              if (b) {
                b.click();
                return sel;
              }
            }
            // scan buttons by text
            for (const b of document.querySelectorAll('button, a')) {
              const t = (b.textContent || '').toLowerCase();
              if (/control|조작|ключ|controles|操作|控制/.test(t)) {
                b.click();
                return 'text:' + t.slice(0, 24);
              }
            }
            return '';
          });
          await page.waitForTimeout(240);
          const hasKeys = await page.$('#overlay-content.screen-keys, #overlay-content.screen-controls');
          if (!opened || !hasKeys) {
            log(`SKIP keys ${loc}@${size.width}x${size.height} opened=${opened || 'none'}`);
          } else {
            const m = await page.evaluate(eval(`(${measureSrc})`), {
              ctaSel: '#btn-keys-back, #btn-back, .keys-actions .btn',
              secSel: null,
              actionsSel: '.keys-actions, .controls-actions',
            });
            const cls = classify(m);
            const tag = `keys ${loc}@${size.width}x${size.height}`;
            log(
              `${cls} ${tag}`,
              `over=${m.panelOver} maxH=${m.maxH}`,
              `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
              `actionsOut=${m.actionsOut} brandHidden=${m.brandHidden} via=${opened}`,
            );
            if (cls === 'HARD') hard.push({ tag, ...m });
            else if (cls === 'SOFT') soft.push({ tag, ...m });
            else ok += 1;
          }
        } finally {
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('');
log(`SUMMARY hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log(`  ${h.tag} ctaVis=${h.ctaVis}/${h.ctaH} secVis=${h.secVis}/${h.secH}`);
}
const outPath = join(root, 'tools', 'probe-tick166-pause-keys.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length ? 2 : 0);
