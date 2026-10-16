/**
 * Tick172 — residual HARD scan after tick171 overlay-host/peer +0.
 * NEW axis: tutorial + result CTAs @ 390×220 / 412×226 / 428×241
 * (tick171 peers only covered OPT/SEL/PAUSE). Also OPTIONS Math.max(260)
 * inflate reconfirm + canvas START ceremony clip vs CSS #app (logical
 * cardW=470 on 960×540 — do not invent canvas shrink unless unread).
 * dens FROZEN. No soft invent.
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
const SIZES = [
  { width: 390, height: 220 },
  { width: 412, height: 226 },
  { width: 428, height: 241 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classifyPeer(m) {
  const unread =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

function classifyOpt(m) {
  const unread =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2));
  const soft =
    !unread && (m.panelOver > 1.5 || m.actionsOut || (m.scrollSoft && m.scrollH < 72));
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

function classifyCanvas(m) {
  // HARD only if CSS-scaled ceremony card is unread vs #app letterbox.
  const unread = m.cardCssH > 8 && m.cardVis < Math.min(24, m.cardCssH * 0.35);
  const soft = !unread && m.canvasOver > 1.5;
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
      window.__tick172Health = { options: 0, optionsCaps: [] };
    },
    { loc, tutorialSeen },
  );
  await page.goto(`${url}?cb=t172-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  await page.evaluate(() => {
    const orig = Math.max;
    Math.max = function (...args) {
      if (
        args.length >= 2 &&
        args[0] === 260 &&
        typeof args[1] === 'number' &&
        Number.isFinite(args[1])
      ) {
        const st = window.__tick172Health;
        const oc = document.getElementById('overlay-content');
        if (st && oc?.classList?.contains('screen-options')) {
          st.options += 1;
          st.optionsCaps.push(args[1]);
        }
      }
      return orig.apply(Math, args);
    };
  });
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
    const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: bh(cta),
      secOut: sec ? out(sec) : false,
      secVis: sec ? +vis(sec).toFixed(1) : 0,
      secH: bh(sec),
      actionsOut: actions ? out(actions) : false,
    };
  }, { ctaSel, secSel, actionsSel });
}

async function measureOptions(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector('#btn-opt-back');
    const actions = oc.querySelector('.opt-actions');
    const scroll = oc.querySelector('.opt-scroll');
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
    const maxHpx = parseFloat(oc.style.maxHeight) || 0;
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const st = window.__tick172Health || {};
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxHpx,
      fitH,
      inflated: maxHpx > fitH + 0.5,
      healthSteps: st.options | 0,
      healthCaps: (st.optionsCaps || []).slice(-4),
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      actionsOut: actions ? out(actions) : false,
      scrollH: +(scroll?.getBoundingClientRect().height || 0).toFixed(1),
      scrollSoft: !!(scroll && scroll.getBoundingClientRect().height + 0.5 < 72),
    };
  });
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
let healthLive = 0;

log('=== A) tutorial + result CTAs @ NEW short-landscape sizes ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    {
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
        const row = `TUT ${loc}@${size.width}×${size.height} → ${cls} ctaVis=${m.ctaVis}/${m.ctaH} secVis=${m.secVis}/${m.secH} over=${m.panelOver} maxH=${m.maxH}`;
        log(row);
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
        else ok += 1;
      } finally {
        await page.close();
      }
    }
    {
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
        const row = `RES ${loc}@${size.width}×${size.height} → ${cls} ctaVis=${m.ctaVis}/${m.ctaH} secVis=${m.secVis}/${m.secH} over=${m.panelOver} maxH=${m.maxH}`;
        log(row);
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
        else ok += 1;
      } finally {
        await page.close();
      }
    }
  }
}

log('=== B) OPTIONS Math.max(260) LATENT @ NEW sizes ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'opt');
    try {
      await page.click('#btn-options');
      await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
      await page.waitForTimeout(80);
      const m = await measureOptions(page);
      if (m.healthSteps > 0) healthLive += 1;
      const cls = classifyOpt(m);
      const row = `OPT ${loc}@${size.width}×${size.height} → ${cls} inflated=${m.inflated} health=${m.healthSteps} maxH=${m.maxHpx} fitH=${m.fitH} ctaVis=${m.ctaVis}/${m.ctaH} scrollH=${m.scrollH} over=${m.panelOver}`;
      log(row);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== C) canvas START ceremony vs CSS #app (pt only) ===');
for (const size of SIZES) {
  const page = await boot(browser, url, size, 'pt', 'cv');
  try {
    await enterGameplay(page);
    await page.waitForTimeout(120);
    const m = await page.evaluate(() => {
      const app = document.getElementById('app');
      const canvas = document.querySelector('#game-canvas, canvas');
      const appR = app.getBoundingClientRect();
      const cR = canvas ? canvas.getBoundingClientRect() : appR;
      const g = window.__LAO__?.getGame?.();
      const W = canvas?.width || 960;
      const H = canvas?.height || 540;
      const sx = cR.width / W;
      const sy = cR.height / H;
      const cardW = 470;
      const cardH = 118;
      const cardX = W / 2 - cardW / 2;
      const cardY = H / 2 - 52;
      const css = {
        left: cR.left + cardX * sx,
        top: cR.top + cardY * sy,
        right: cR.left + (cardX + cardW) * sx,
        bottom: cR.top + (cardY + cardH) * sy,
      };
      const visH = Math.max(
        0,
        Math.min(css.bottom, appR.bottom) - Math.max(css.top, appR.top),
      );
      const visW = Math.max(
        0,
        Math.min(css.right, appR.right) - Math.max(css.left, appR.left),
      );
      return {
        intro: g ? !!g.stageIntro : null,
        canvasOver: +Math.max(0, cR.bottom - appR.bottom, appR.top - cR.top).toFixed(2),
        cardCssH: +(cardH * sy).toFixed(1),
        cardCssW: +(cardW * sx).toFixed(1),
        cardVis: +visH.toFixed(1),
        cardVisW: +visW.toFixed(1),
        scale: +sx.toFixed(3),
        canvasCss: `${cR.width.toFixed(1)}x${cR.height.toFixed(1)}`,
        appCss: `${appR.width.toFixed(1)}x${appR.height.toFixed(1)}`,
      };
    });
    const cls = classifyCanvas(m);
    const row = `CV pt@${size.width}×${size.height} → ${cls} intro=${m.intro} cardVis=${m.cardVis}/${m.cardCssH} visW=${m.cardVisW}/${m.cardCssW} scale=${m.scale} over=${m.canvasOver} canvas=${m.canvasCss} app=${m.appCss}`;
    log(row);
    if (cls === 'HARD') hard.push(row);
    else if (cls === 'SOFT') soft.push(row);
    else ok += 1;
  } finally {
    await page.close();
  }
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok} optionsHealthLive=${healthLive}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}

const outPath = join(root, 'tools/probe-tick172-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
