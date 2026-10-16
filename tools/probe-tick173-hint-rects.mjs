/**
 * Tick173 — reject false HARD from display:none select-dossier-hint
 * (tick134 intentional hide) under letterboxed #app top offset.
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

const sizes = [
  { width: 360, height: 218 },
  { width: 375, height: 212 },
  { width: 404, height: 228 },
  { width: 430, height: 245 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

for (const size of sizes) {
  const page = await browser.newPage({ viewport: size });
  await page.addInitScript(() => {
    localStorage.setItem(
      'lao_mini_settings_v1',
      JSON.stringify({
        lang: 'pt',
        muted: true,
        bgmVolume: 0,
        sfxVolume: 0,
        autoFire: true,
        padMode: 'fixed',
        fullscreen: false,
      }),
    );
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await page.goto(`${url}?cb=t173-hint-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 90000 });
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    document.querySelector('.char-card[data-key="constantia"]')?.click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(160);
  const m = await page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    const hint = oc.querySelector('.select-dossier-hint');
    const name = oc.querySelector('#select-dossier-name');
    const kit = oc.querySelector('#select-dossier-kit');
    const cta = oc.querySelector('#btn-go');
    const appR = app.getBoundingClientRect();
    const hr = hint?.getBoundingClientRect();
    const cs = hint ? getComputedStyle(hint) : null;
    const out = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      // Naive out (false-positive prone for display:none zero rect)
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const outGrounded = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      const csEl = getComputedStyle(el);
      if (csEl.display === 'none' || csEl.visibility === 'hidden' || r.width < 0.5 || r.height < 0.5) {
        return false; // intentionally hidden / zero — not OOB unread
      }
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    return {
      appTop: +appR.top.toFixed(2),
      appH: +appR.height.toFixed(1),
      hintDisplay: cs?.display || 'missing',
      hintInline: hint?.style?.display || '',
      hintH: hr ? +hr.height.toFixed(2) : 0,
      hintTop: hr ? +hr.top.toFixed(2) : 0,
      hintOutNaive: hint ? out(hint) : null,
      hintOutGrounded: hint ? outGrounded(hint) : null,
      nameOutG: outGrounded(name),
      kitOutG: outGrounded(kit),
      ctaOutG: outGrounded(cta),
      nameH: +(name?.getBoundingClientRect().height || 0).toFixed(1),
      kitH: +(kit?.getBoundingClientRect().height || 0).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      nameVis: (() => {
        const r = name.getBoundingClientRect();
        return +Math.max(0, Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top)).toFixed(1);
      })(),
      kitVis: (() => {
        const r = kit.getBoundingClientRect();
        return +Math.max(0, Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top)).toFixed(1);
      })(),
      ctaVis: (() => {
        const r = cta.getBoundingClientRect();
        return +Math.max(0, Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top)).toFixed(1);
      })(),
    };
  });
  const falseHard = m.hintOutNaive && !m.hintOutGrounded && m.hintDisplay === 'none';
  log(
    `${size.width}×${size.height}`,
    `appTop=${m.appTop}`,
    `hintDisp=${m.hintDisplay}`,
    `inline=${m.hintInline || '(css)'}`,
    `naiveOut=${m.hintOutNaive}`,
    `groundedOut=${m.hintOutGrounded}`,
    `falseHard=${falseHard}`,
    `name=${m.nameVis}/${m.nameH}`,
    `kit=${m.kitVis}/${m.kitH}`,
    `cta=${m.ctaVis}/${m.ctaH}`,
  );
  await page.close();
}

const outPath = join(root, 'tools/probe-tick173-hint-rects.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
