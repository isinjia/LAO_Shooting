/**
 * Tick175 — residual HARD scan after tick174 pause NEW mid-short + HOLD dump.
 * NEW axis: tutorial GO/SKIP + result retry/title @ mid-short sizes
 * tick172 did not cover (360×218 / 375×212 / 404×228 / 430×245) × pt/es/ru.
 * HOLD uniqueness already verified tick174 — dump not re-shipped.
 * dens FROZEN. No canvas CSS false-positive coords. No hint display:none
 * / letterbox appTop naive OOB. No pause letterbox false HARD.
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

const LONG = ['pt', 'es', 'ru'];
/** NEW mid-short cluster — not tick172 tut/result 390/412/428 set. */
const SIZES = [
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

function classifyPeer(m) {
  const hidden = (elH, displayNone) => displayNone || elH < 0.5;
  const unreadEl = (vis, h, minVis, out, displayNone) => {
    if (hidden(h, displayNone)) return false;
    return out || (h > 0 && vis < Math.min(minVis, Math.max(6, h - 2)));
  };
  const unread =
    unreadEl(m.ctaVis, m.ctaH, 20, m.ctaOut, m.ctaNone) ||
    unreadEl(m.secVis, m.secH, 16, m.secOut, m.secNone);
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function boot(browser, url, size, loc, tag, tutorialSeen = '1') {
  const page = await browser.newPage({ viewport: size });
  await page.addInitScript(
    ({ loc, tutorialSeen }) => {
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
      localStorage.setItem('lao_mini_tutorial_seen', tutorialSeen);
    },
    { loc, tutorialSeen },
  );
  await page.goto(`${url}?cb=t175-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function measurePeer(page, ctaSel, secSel, actionsSel) {
  return page.evaluate(({ ctaSel, secSel, actionsSel }) => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector(ctaSel);
    const sec = secSel ? oc.querySelector(secSel) : null;
    const actions = actionsSel ? oc.querySelector(actionsSel) : null;
    const none = (el) => {
      if (!el) return true;
      const cs = getComputedStyle(el);
      return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
    };
    const vis = (el) => {
      if (!el || none(el)) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
    };
    // Grounded OOB: ignore zero-rect / display:none (tick173 letterbox reject).
    const out = (el) => {
      if (!el || none(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) return false;
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const bh = (el) => (el && !none(el) ? +el.getBoundingClientRect().height.toFixed(1) : 0);
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      appTop: +appR.top.toFixed(2),
      ctaNone: cta ? none(cta) : true,
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: bh(cta),
      secNone: sec ? none(sec) : false,
      secOut: sec ? out(sec) : false,
      secVis: sec ? +vis(sec).toFixed(1) : 0,
      secH: bh(sec),
      actionsOut: actions ? out(actions) : false,
    };
  }, { ctaSel, secSel, actionsSel });
}

async function enterGameplay(page) {
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 60000 });
  await page.waitForTimeout(60);
  await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
  await page.waitForTimeout(30);
  await page.click('#btn-go');
  await page.waitForFunction(
    () => !!window.__LAO__?.getGame?.() || !!document.querySelector('#btn-tut-go'),
    { timeout: 60000 },
  );
  if (await page.$('#btn-tut-go')) await page.click('#btn-tut-go');
  await page.waitForFunction(() => !!window.__LAO__?.getGame?.(), { timeout: 60000 });
  await page.waitForTimeout(180);
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== A) tutorial GO/SKIP @ NEW mid-short sizes ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'tut', '0');
    try {
      await page.click('#btn-start');
      await page.waitForSelector('#btn-go', { timeout: 90000 });
      await page.waitForTimeout(80);
      await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
      await page.waitForTimeout(40);
      await page.click('#btn-go');
      await page.waitForSelector('#overlay-content.screen-tutorial, #btn-tut-go', {
        timeout: 60000,
      });
      await page.waitForTimeout(220);
      const m = await measurePeer(page, '#btn-tut-go', '#btn-tut-skip', '.pause-actions, .tut-actions');
      const cls = classifyPeer(m);
      const row = [
        `TUT ${loc}@${size.width}×${size.height} → ${cls}`,
        `cta=${m.ctaVis}/${m.ctaH}`,
        `sec=${m.secVis}/${m.secH}`,
        `ctaOut=${m.ctaOut}`,
        `secOut=${m.secOut}`,
        `ctaNone=${m.ctaNone}`,
        `secNone=${m.secNone}`,
        `over=${m.panelOver}`,
        `appTop=${m.appTop}`,
        `maxH=${m.maxH}`,
      ].join(' ');
      log(row);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== B) result retry/title @ NEW mid-short sizes ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'res');
    try {
      await enterGameplay(page);
      await page.evaluate(() => {
        const g = window.__LAO__.getGame();
        if (g && typeof g.forceGameOver === 'function') g.forceGameOver();
        else if (typeof window.__LAO__.endScreen === 'function') {
          window.__LAO__.endScreen('gameover', {
            score: 1234,
            hiScore: 5678,
            graze: 12,
            stage: 2,
            pilot: 'HIRUME',
            maxCombo: 8,
            noMiss: false,
          });
        }
      });
      await page.waitForSelector('#overlay-content.screen-result, #btn-retry', {
        timeout: 60000,
      });
      await page.waitForTimeout(260);
      const m = await measurePeer(
        page,
        '#btn-retry',
        '#btn-title',
        '.result-actions, .pause-actions',
      );
      const cls = classifyPeer(m);
      const row = [
        `RES ${loc}@${size.width}×${size.height} → ${cls}`,
        `cta=${m.ctaVis}/${m.ctaH}`,
        `sec=${m.secVis}/${m.secH}`,
        `ctaOut=${m.ctaOut}`,
        `secOut=${m.secOut}`,
        `ctaNone=${m.ctaNone}`,
        `secNone=${m.secNone}`,
        `over=${m.panelOver}`,
        `appTop=${m.appTop}`,
        `maxH=${m.maxH}`,
      ].join(' ');
      log(row);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}

const outPath = join(root, 'tools/probe-tick175-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
