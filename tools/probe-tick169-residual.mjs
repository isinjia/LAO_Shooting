/**
 * Tick169 — residual HARD scan on axes NOT covered as TITLE/HUD in
 * tick167 (standard overlay grid) or tick168 (cliff OPTIONS/peers/AE/LD
 * + rotate #app false HARD). dens FROZEN. No soft invent.
 *
 * Title HARD bar = START/OPTIONS unread (tick167). CONTROLS HI vis=0 at
 * h≤288 is tick135 grid-floor overflow:hidden (HI laid out below keys
 * clip while CTA full) — REJECT as shippable HARD. See
 * probe-tick169-hi-rects.mjs. HI is full at tick135 targets ≥640×360.
 *
 * Rotate remains viewport-grounded (tick168-vv). Do NOT flag #app
 * letterbox overApp as HARD.
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
const LONG = ['ru', 'pt', 'es', 'ko'];

// Title sizes NOT in tick167 F) title set (320 / 400 / 568×320 / ≥800).
const TITLE_SIZES = [
  { width: 340, height: 200 },
  { width: 342, height: 220 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 380, height: 220 },
  { width: 390, height: 240 },
  { width: 420, height: 240 },
  { width: 480, height: 288 },
  { width: 667, height: 375 },
  { width: 812, height: 375 },
];

// HUD sizes outside tick151 HUD_CASES (those already documented AA).
const HUD_CASES = [
  { width: 340, height: 200, touch: true },
  { width: 390, height: 240, touch: true },
  { width: 420, height: 240, touch: true },
  { width: 736, height: 414, touch: true },
  { width: 812, height: 375, touch: true },
  { width: 896, height: 414, touch: true },
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
      if (touch) {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      } else {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
      }
    },
    { loc, touch },
  );
  await page.goto(`${url}?cb=t169-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function measureTitle(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const vvH = window.innerHeight;
    const start = document.getElementById('btn-start');
    const opt = document.getElementById('btn-options');
    const keys = oc.querySelector('.keys');
    const hi = oc.querySelector('.keys-hiscore');
    const grid = oc.querySelector('.keys-grid');
    const rules = oc.querySelector('.keys-rules');
    const visBox = (el, clip) => {
      if (!el || !clip) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, clip.bottom) - Math.max(r.top, clip.top));
    };
    const visAppOc = (el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
    };
    const outApp = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const outVv = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return r.bottom > vvH + 1.5 || r.top < -1.5;
    };
    const startH = start ? start.getBoundingClientRect().height : 0;
    const optH = opt ? opt.getBoundingClientRect().height : 0;
    const hiR = hi?.getBoundingClientRect();
    const keysR = keys?.getBoundingClientRect();
    const hiCs = hi ? getComputedStyle(hi) : null;
    const hiShown = !!(hi && hiCs.display !== 'none' && hiCs.visibility !== 'hidden' && Number(hiCs.opacity) > 0.05);
    const hiH = hiR ? hiR.height : 0;
    const hiVisKeys = hiShown && keysR ? visBox(hi, keysR) : 0;
    const hiVisOc = hiShown ? visBox(hi, ocR) : 0;
    const hiVisApp = hiShown ? visBox(hi, appR) : 0;
    const brand = oc.querySelector('.brand-mark, .title-brand, .brand, .title-hero');
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      startOut: start ? outApp(start) : true,
      startOutVv: start ? outVv(start) : true,
      startVis: +visAppOc(start).toFixed(1),
      startH: +startH.toFixed(1),
      optOut: opt ? outApp(opt) : true,
      optVis: +visAppOc(opt).toFixed(1),
      optH: +optH.toFixed(1),
      hiShown,
      hiH: +hiH.toFixed(1),
      hiVisKeys: +hiVisKeys.toFixed(1),
      hiVisOc: +hiVisOc.toFixed(1),
      hiVisApp: +hiVisApp.toFixed(1),
      hiDisplay: hiCs?.display || '',
      gridH: grid ? +grid.getBoundingClientRect().height.toFixed(1) : 0,
      gridVis: grid ? +visAppOc(grid).toFixed(1) : 0,
      rulesH: rules ? +rules.getBoundingClientRect().height.toFixed(1) : 0,
      brandHidden: brand ? getComputedStyle(brand).display === 'none' : false,
      ocClass: oc.className,
    };
  });
}

function classifyTitle(m) {
  const ctaUnread =
    m.startOut ||
    m.optOut ||
    (m.startH > 0 && m.startVis < Math.min(20, m.startH - 2)) ||
    (m.optH > 0 && m.optVis < Math.min(20, m.optH - 2));
  // HI pin is a CONTROLS floor invariant (tick118–135). Hidden HI is not HARD.
  const hiUnread =
    m.hiShown &&
    m.hiH > 8 &&
    (m.hiVisKeys < m.hiH - 1.5 || m.hiVisOc < m.hiH - 1.5 || m.hiVisApp < m.hiH - 1.5);
  // Viewport-grounded CTA (reject letterbox-only). startOutVv alone is not
  // enough if startOut is false; both must fail to count as rotate-style trap.
  const unread = ctaUnread || hiUnread;
  const soft = !unread && m.panelOver > 1.5;
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function enterGameplay(page) {
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 60000 });
  await page.waitForTimeout(80);
  await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
  await page.waitForTimeout(40);
  await page.click('#btn-go');
  await page.waitForFunction(
    () => !!window.__LAO__?.getGame?.() || !!document.querySelector('#btn-tut-go'),
    { timeout: 60000 },
  );
  if (await page.$('#btn-tut-go')) {
    await page.click('#btn-tut-go');
  }
  await page.waitForFunction(() => !!window.__LAO__?.getGame?.(), { timeout: 60000 });
  await page.waitForTimeout(220);
}

async function measureHud(page) {
  return page.evaluate(() => {
    const R = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { el, left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
    };
    const visW = (a, clip) => {
      if (!a || !clip) return 0;
      return Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
    };
    const visH = (a, clip) => {
      if (!a || !clip) return 0;
      return Math.max(0, Math.min(a.bottom, clip.bottom) - Math.max(a.top, clip.top));
    };
    const score = document.getElementById('score');
    if (score) score.textContent = '9999999';
    const hi = document.getElementById('hi-score');
    if (hi) hi.textContent = '9999999';
    const app = R('#app');
    const scores = R('.hud-scores');
    const meta = R('.hud-meta');
    const scoreVal = R('#score');
    const hiVal = R('#hi-score');
    const lives = R('#lives');
    const bombs = R('#bombs');
    const scoreVis = visW(scoreVal, scores) && visH(scoreVal, app);
    const hiVisW = visW(hiVal, scores);
    const hiVisH = visH(hiVal, app);
    const scoreClip = scoreVal && scores ? scoreVal.w > 0 && visW(scoreVal, scores) < scoreVal.w * 0.55 : false;
    const hiClip = hiVal && scores ? hiVal.w > 0 && hiVisW < hiVal.w * 0.55 : false;
    const scoreUnread = scoreVal && visW(scoreVal, scores) > 0 && visW(scoreVal, scores) < 28;
    const hiUnread = hiVal && hiVisW > 0 && hiVisW < 28;
    const scoresOut =
      scores && app
        ? scores.right > app.right + 2 || scores.left < app.left - 2 || scores.top < app.top - 2
        : false;
    const metaOut =
      meta && app ? meta.right > app.right + 2 || meta.top < app.top - 2 : false;
    const livesVis = visH(lives, app);
    const bombsVis = visH(bombs, app);
    return {
      scoreVis: +visW(scoreVal, scores).toFixed(1),
      scoreW: scoreVal ? +scoreVal.w.toFixed(1) : 0,
      hiVis: +hiVisW.toFixed(1),
      hiW: hiVal ? +hiVal.w.toFixed(1) : 0,
      scoreClip,
      hiClip,
      scoreUnread,
      hiUnread,
      scoresOut,
      metaOut,
      livesVis: +livesVis.toFixed(1),
      bombsVis: +bombsVis.toFixed(1),
      livesH: lives ? +lives.h.toFixed(1) : 0,
      bombsH: bombs ? +bombs.h.toFixed(1) : 0,
      scoreVisH: scoreVal ? +visH(scoreVal, app).toFixed(1) : 0,
      hiVisH: +hiVisH.toFixed(1),
    };
  });
}

function classifyHud(m) {
  const unread =
    m.scoreUnread ||
    m.hiUnread ||
    m.scoreClip ||
    m.hiClip ||
    m.scoresOut ||
    (m.livesH > 0 && m.livesVis < m.livesH - 2) ||
    (m.bombsH > 0 && m.bombsVis < m.bombsH - 2);
  const soft = !unread && m.metaOut;
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

try {
  log('=== A) TITLE START/OPTIONS + CONTROLS HI @ sizes outside tick167 F) ===');
  for (const size of TITLE_SIZES) {
    for (const loc of LOCALES) {
      const page = await boot(browser, url, size, loc, 'title');
      try {
        await page.waitForTimeout(180);
        const m = await measureTitle(page);
        const cls = classifyTitle(m);
        const tag = `title ${loc}@${size.width}x${size.height}`;
        log(
          `${cls} ${tag}`,
          `over=${m.panelOver}`,
          `start=${m.startVis}/${m.startH} out=${m.startOut}`,
          `opt=${m.optVis}/${m.optH} out=${m.optOut}`,
          `hiShown=${m.hiShown} hi=${m.hiVisKeys}/${m.hiVisOc}/${m.hiVisApp}/${m.hiH}`,
          `grid=${m.gridVis}/${m.gridH} brandHidden=${m.brandHidden}`,
        );
        const row = { tag, screen: 'title', loc, w: size.width, h: size.height, cls, ...m };
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
        else ok += 1;
      } finally {
        await page.close();
      }
    }
  }

  log('');
  log('=== B) Gameplay TOP HUD @ sizes outside tick151 HUD_CASES ===');
  for (const size of HUD_CASES) {
    for (const loc of LONG) {
      const page = await boot(browser, url, size, loc, 'hud', { touch: size.touch });
      try {
        if (size.touch) {
          await page.evaluate(() => document.body.classList.add('touch-ui'));
        }
        await enterGameplay(page);
        const m = await measureHud(page);
        const cls = classifyHud(m);
        const tag = `hud ${loc}@${size.width}x${size.height}${size.touch ? 'T' : ''}`;
        log(
          `${cls} ${tag}`,
          `score=${m.scoreVis}/${m.scoreW} clip=${m.scoreClip} unread=${m.scoreUnread}`,
          `hi=${m.hiVis}/${m.hiW} clip=${m.hiClip} unread=${m.hiUnread}`,
          `scoresOut=${m.scoresOut} metaOut=${m.metaOut}`,
          `lives=${m.livesVis}/${m.livesH} bombs=${m.bombsVis}/${m.bombsH}`,
        );
        const row = { tag, screen: 'hud', loc, w: size.width, h: size.height, cls, ...m };
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
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
log(`SUMMARY hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) {
    log(
      `  ${h.tag}`,
      `startOut=${h.startOut} optOut=${h.optOut}`,
      `hiShown=${h.hiShown} hiVisKeys=${h.hiVisKeys} hiH=${h.hiH}`,
      `scoreUnread=${h.scoreUnread} hiUnread=${h.hiUnread} scoresOut=${h.scoresOut}`,
    );
  }
}
if (soft.length) {
  log('SOFT DETAIL:');
  for (const s of soft) {
    log(`  ${s.tag} over=${s.panelOver} metaOut=${s.metaOut}`);
  }
}

const outPath = join(root, 'tools', 'probe-tick169-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length ? 2 : 0);
