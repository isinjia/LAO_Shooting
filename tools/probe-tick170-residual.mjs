/**
 * Tick170 — residual HARD scan on axes NOT covered by tick167–169 layout
 * grids (standard overlays / cliff AE·LD·OPTIONS / title-HI+HUD devices).
 * dens FROZEN. No soft invent.
 *
 * A) Rare fanfare live DOM (title/name/tag/hint) @ ultra-short + cliff
 * B) OPTIONS Math.max(260) LATENT reconfirm (healthSteps / inflated)
 * C) Title brand @800×450 / @1280×560 under CONTROLS — brand soft only;
 *    HARD bar remains START/OPTIONS unread (tick167/169).
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
const LONG = ['ru', 'pt', 'es', 'en', 'ko'];
const RARE_KEYS = ['eternity', 'labiata', 'emily'];
const FANFARE_SIZES = [
  { width: 320, height: 200 },
  { width: 340, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
];
const OPT_SIZES = [
  { width: 320, height: 200 },
  { width: 340, height: 200 },
  { width: 342, height: 220 },
  { width: 360, height: 240 },
  { width: 400, height: 280 },
  { width: 667, height: 375 },
];
const BRAND_SIZES = [
  { width: 800, height: 450 },
  { width: 1280, height: 560 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

async function boot(browser, url, size, loc, tag, { touch = false } = {}) {
  const page = await browser.newPage({
    viewport: size,
    hasTouch: touch,
    isMobile: touch,
  });
  await page.addInitScript(
    ({ loc, touch }) => {
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
      window.__tick170Health = { options: 0, optionsCaps: [] };
      if (touch) {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      } else {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
      }
    },
    { loc, touch },
  );
  await page.goto(`${url}?cb=t170-${tag}-${loc}-${size.width}x${size.height}`, {
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
        const st = window.__tick170Health;
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

function classifyRare(m) {
  const unread =
    m.tagOut ||
    m.hintOut ||
    m.nameOut ||
    (m.tagH > 0 && m.tagVis < Math.min(12, m.tagH - 2)) ||
    (m.hintH > 0 && m.hintVis < Math.min(10, m.hintH - 2)) ||
    (m.nameH > 0 && m.nameVis < Math.min(14, m.nameH - 2));
  const soft =
    !unread &&
    (m.cardOver > 1.5 ||
      (m.titleH > 0 && m.titleVis < m.titleH - 1) ||
      m.portraitOut);
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

function classifyTitle(m) {
  const unread =
    m.startOut ||
    m.optOut ||
    (m.startH > 0 && m.startVis < Math.min(20, m.startH - 2)) ||
    (m.optH > 0 && m.optVis < Math.min(20, m.optH - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.brandHidden || m.hiVisApp < 8);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function measureRare(page, charKey) {
  return page.evaluate(async (key) => {
    const { playRareFanfare } = await import('/js/rare-fanfare.js');
    const host = document.getElementById('app');
    const pending = playRareFanfare({ charKey: key, host });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Wait for tick170 post-pop re-fit (480ms) before measuring unread.
    await new Promise((r) => setTimeout(r, 520));
    const app = document.getElementById('app');
    const appR = app.getBoundingClientRect();
    const el = document.querySelector('.rare-fanfare');
    const card = el?.querySelector('.rare-fanfare-card');
    const title = el?.querySelector('.rare-fanfare-title');
    const name = el?.querySelector('.rare-fanfare-name');
    const tag = el?.querySelector('.rare-fanfare-tag');
    const hint = el?.querySelector('.rare-fanfare-hint');
    const portrait = el?.querySelector('.rare-fanfare-portrait');
    const vis = (node) => {
      if (!node) return 0;
      const r = node.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top),
      );
    };
    const out = (node) => {
      if (!node) return true;
      const r = node.getBoundingClientRect();
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const bh = (node) => (node ? +node.getBoundingClientRect().height.toFixed(1) : 0);
    const cardR = card?.getBoundingClientRect();
    const m = {
      on: !!el?.classList.contains('is-on'),
      compact: !!el?.classList.contains('is-rare-compact'),
      ultra: !!el?.classList.contains('is-rare-ultra'),
      cardOver: cardR
        ? +Math.max(0, cardR.bottom - appR.bottom, appR.top - cardR.top).toFixed(2)
        : 99,
      titleOut: title ? out(title) : true,
      titleVis: +vis(title).toFixed(1),
      titleH: bh(title),
      nameOut: name ? out(name) : true,
      nameVis: +vis(name).toFixed(1),
      nameH: bh(name),
      tagOut: tag ? out(tag) : true,
      tagVis: +vis(tag).toFixed(1),
      tagH: bh(tag),
      hintOut: hint ? out(hint) : true,
      hintVis: +vis(hint).toFixed(1),
      hintH: bh(hint),
      portraitOut: portrait ? out(portrait) : false,
    };
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await pending.catch(() => {});
    el?.remove();
    return m;
  }, charKey);
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
    const st = window.__tick170Health || {};
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
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

async function measureTitle(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content') || app;
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const start = document.getElementById('btn-start');
    const opt = document.getElementById('btn-options');
    const brand = oc.querySelector('.title-brand, .brand-mark, .brand');
    const hi = oc.querySelector('.keys-hiscore, .title-hiscore, #title-hi');
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
      startOut: start ? out(start) : true,
      startVis: +vis(start).toFixed(1),
      startH: bh(start),
      optOut: opt ? out(opt) : true,
      optVis: +vis(opt).toFixed(1),
      optH: bh(opt),
      brandHidden: brand ? getComputedStyle(brand).display === 'none' : false,
      brandVis: brand ? +vis(brand).toFixed(1) : 0,
      hiVisApp: hi ? +vis(hi).toFixed(1) : 0,
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let healthLive = 0;

log('=== A) Rare fanfare live DOM ===');
for (const size of FANFARE_SIZES) {
  for (const loc of LONG) {
    for (const key of RARE_KEYS) {
      const page = await boot(browser, url, size, loc, `rare-${key}`);
      try {
        const m = await measureRare(page, key);
        const cls = classifyRare(m);
        const row = `RARE ${loc}@${size.width}×${size.height} ${key} → ${cls} tagVis=${m.tagVis}/${m.tagH} hintVis=${m.hintVis}/${m.hintH} nameVis=${m.nameVis}/${m.nameH} cardOver=${m.cardOver} compact=${m.compact} ultra=${m.ultra} on=${m.on}`;
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

log('=== B) OPTIONS Math.max(260) LATENT ===');
for (const size of OPT_SIZES) {
  for (const loc of LOCALES) {
    const page = await boot(browser, url, size, loc, 'opt');
    try {
      await page.click('#btn-options');
      await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
      await page.waitForTimeout(80);
      const m = await measureOptions(page);
      healthLive += m.healthSteps | 0;
      const cls = classifyOpt(m);
      const row = `OPT ${loc}@${size.width}×${size.height} → ${cls} inflated=${m.inflated} health=${m.healthSteps} maxH=${m.maxH} fitH=${m.fitH} ctaVis=${m.ctaVis}/${m.ctaH} panelOver=${m.panelOver} scrollH=${m.scrollH}`;
      log(row);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== C) Title brand @800 / @1280 (HARD=CTA unread only) ===');
for (const size of BRAND_SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'brand');
    try {
      await page.waitForTimeout(60);
      const m = await measureTitle(page);
      const cls = classifyTitle(m);
      const row = `TITLE ${loc}@${size.width}×${size.height} → ${cls} startVis=${m.startVis}/${m.startH} optVis=${m.optVis}/${m.optH} brandHidden=${m.brandHidden} brandVis=${m.brandVis} hiVis=${m.hiVisApp} panelOver=${m.panelOver}`;
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
log(`hard=${hard.length} soft=${soft.length} ok=${ok} optionsHealthLive=${healthLive}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log(`SOFT sample (first 12 of ${soft.length}):`);
  for (const s of soft.slice(0, 12)) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick170-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
