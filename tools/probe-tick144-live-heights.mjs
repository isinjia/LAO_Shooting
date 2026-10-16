/**
 * Tick144: live show* paths across dense short heights for residual muddy.
 * Uses real title→select / pause / options / tutorial / result entry.
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

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
}

const LOCALES = ['ko', 'es', 'ru'];
const SIZES = [
  { width: 480, height: 288 },
  { width: 500, height: 300 },
  { width: 520, height: 304 },
  { width: 540, height: 310 },
  { width: 568, height: 320 },
  { width: 400, height: 280 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc) {
  const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
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
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    },
    { loc },
  );
  await page.goto(`${url}?cb=t144l-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function measureScreen(page, label) {
  return page.evaluate(({ boxOutSrc, label }) => {
    const boxOut = eval(`(${boxOutSrc})`);
    const app = document.getElementById('app');
    const content = document.getElementById('overlay-content');
    const overlay = document.getElementById('overlay');
    if (!content || !app) return { label, missing: true };
    void content.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = content.getBoundingClientRect();
    const cta =
      content.querySelector('#btn-resume') ||
      content.querySelector('#btn-begin') ||
      content.querySelector('#btn-confirm') ||
      content.querySelector('#btn-retry') ||
      content.querySelector('#btn-back') ||
      content.querySelector('.btn-cta') ||
      content.querySelector('.pause-actions .btn');
    const quit =
      content.querySelector('#btn-quit') ||
      content.querySelector('#btn-title') ||
      content.querySelector('#btn-to-title');
    const grid =
      content.querySelector('.tutorial-grid') ||
      content.querySelector('.char-grid') ||
      content.querySelector('.opt-scroll') ||
      content.querySelector('.keys-grid');
    const panelOverRaw = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
    const headroom = appR.bottom - ocR.bottom;
    const ctaOut = cta ? boxOut(cta, appR) : false;
    const quitOut = quit ? boxOut(quit, appR) : false;
    return {
      label,
      className: content.className,
      overlayOn: overlay?.classList.contains('show') || overlay?.classList.contains('is-on') || getComputedStyle(overlay).display !== 'none',
      panelOverRaw: +panelOverRaw.toFixed(2),
      headroom: +headroom.toFixed(2),
      maxH: +(parseFloat(content.style.maxHeight) || 0).toFixed(2),
      ctaOut,
      quitOut,
      gridH: grid ? +grid.getBoundingClientRect().height.toFixed(2) : null,
      appBox: +appR.height.toFixed(2),
      muddy: panelOverRaw > 1.5 || headroom < -1.5 || ctaOut || quitOut,
    };
  }, { boxOutSrc: boxOut.toString(), label });
}

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await boot(size, loc);
      try {
        // Title CONTROLS visible on title
        findings.push({
          loc,
          size: `${size.width}x${size.height}`,
          ...(await measureScreen(page, 'title')),
        });

        // OPTIONS from title
        const optBtn = page.locator('#btn-options, button:has-text("OPTIONS"), button:has-text("옵션")').first();
        if (await optBtn.count()) {
          await optBtn.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(80);
          findings.push({
            loc,
            size: `${size.width}x${size.height}`,
            ...(await measureScreen(page, 'options')),
          });
          // back
          const back = page.locator('#btn-back, #btn-options-back').first();
          if (await back.count()) await back.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(40);
        }

        // START → tutorial (seen=0) or select
        await page.click('#btn-start', { timeout: 5000 });
        await page.waitForTimeout(120);
        let screen = await measureScreen(page, 'after-start');
        findings.push({ loc, size: `${size.width}x${size.height}`, ...screen });

        // If tutorial, continue to select
        if ((screen.className || '').includes('tutorial')) {
          const begin = page.locator('#btn-begin, #btn-tut-go, .btn-cta').first();
          if (await begin.count()) {
            await begin.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(100);
            screen = await measureScreen(page, 'select');
            findings.push({ loc, size: `${size.width}x${size.height}`, ...screen });
          }
        }

        // Try open pause via Escape after starting a run if possible
        // From select, pick first char + sortie if present
        const confirm = page.locator('#btn-confirm, #btn-sortie').first();
        if (await confirm.count()) {
          const card = page.locator('.char-card, .char-btn, button.char').first();
          if (await card.count()) await card.click({ timeout: 3000 }).catch(() => {});
          await confirm.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(200);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(120);
          findings.push({
            loc,
            size: `${size.width}x${size.height}`,
            ...(await measureScreen(page, 'pause')),
          });
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

const muddy = findings.filter((f) => f.muddy);
console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      muddy,
      samples: findings.filter((f) => f.loc === 'es' || f.label === 'pause' || f.label === 'after-start'),
    },
    null,
    2,
  ),
);
