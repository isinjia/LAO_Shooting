/**
 * Tick187 — residual HARD scan after tick186 pause OPTIONS/MUTE +0.
 * NEW axis (DIFFERENT play axis from ticks 173–186):
 *   Production combat HUD + FLOATING touch pads after live SORTIE
 *   @ mid-short 360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   Distinct from tick185 fixed padMode (same cluster, different padMode)
 *   and from tick146–149 HUD size set.
 * HARD bar = shown #lives / #bombs / .tc-fire / .tc-bomb vis-unread vs #app.
 * Floating stick idle-hidden (no is-stick-on) is intentional — NOT HARD.
 * REJECT: display:none / zero-rect / letterbox appTop naive OOB (tick173);
 * oc-out / app-out with vis full (tick174); title HI floor (tick135/176);
 * rare cardOver vis-full (tick177/182 SOFT); AE@404 oc-peek visApp full
 * (tick179 SOFT); OPTIONS ru@360 scrollH=71 BACK full (tick180 SOFT);
 * rotate #app overApp letterbox (tick168/181);
 * result-short brandNone CSS (tick183/184);
 * HUD/pause appTop letterbox vis full (tick185/186). dens FROZEN.
 * No HOLD uniqueness re-dump (tick174 stands).
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
/** NEW mid-short cluster — same viewport as ticks 173–186; DIFFERENT padMode. */
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

function classifyHudFloat(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, displayNone) => {
    if (hidden(h, displayNone)) return false;
    // vis-unread only. out with vis full is tick174-class false HARD.
    return h > 0 && vis < Math.min(minVis, Math.max(6, h - 2));
  };
  const unread =
    unreadEl(m.lifeVisApp, m.lifeH, 8, m.lifeNone) ||
    unreadEl(m.bombVisApp, m.bombH, 8, m.bombNone) ||
    unreadEl(m.fireVisApp, m.fireH, 12, m.fireNone) ||
    unreadEl(m.bombPadVisApp, m.bombPadH, 12, m.bombPadNone);
  const ocPeek =
    (m.lifeOutApp && !unreadEl(m.lifeVisApp, m.lifeH, 8, m.lifeNone)) ||
    (m.bombOutApp && !unreadEl(m.bombVisApp, m.bombH, 8, m.bombNone)) ||
    (m.fireOutApp && !unreadEl(m.fireVisApp, m.fireH, 12, m.fireNone)) ||
    (m.bombPadOutApp && !unreadEl(m.bombPadVisApp, m.bombPadH, 12, m.bombPadNone));
  // Stick idle-hidden in floating is intentional — never HARD from stickNone.
  const overlapSoft = !!m.padOverlap && !unread;
  const soft = !unread && (ocPeek || overlapSoft || m.stocksOverApp > 1.5);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function boot(browser, url, size, loc, tag) {
  const page = await browser.newPage({
    viewport: size,
    hasTouch: true,
    isMobile: true,
  });
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
          padMode: 'floating',
          fullscreen: false,
        }),
      );
      localStorage.setItem('lao_mini_tutorial_seen', '1');
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    },
    { loc },
  );
  await page.goto(`${url}?cb=t187-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function enterGameplay(page) {
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 90000 });
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
  await page.waitForTimeout(220);
}

async function measureHudFloat(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const hud = document.getElementById('hud');
    const tc = document.getElementById('touch-controls');
    const lives = document.getElementById('lives');
    const bombs = document.getElementById('bombs');
    const fire = document.querySelector('.tc-fire');
    const bombPad = document.querySelector('.tc-bomb');
    const stocks = document.querySelector('.hud-stocks');
    const stick = document.querySelector('.tc-stick-zone');
    const stickBase = document.querySelector('.tc-stick-base');
    void hud?.offsetHeight;
    void tc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const none = (node) => {
      if (!node) return true;
      const cs = getComputedStyle(node);
      return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
    };
    const vis = (node, clipR) => {
      if (!node || none(node)) return 0;
      const r = node.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, clipR.bottom) - Math.max(r.top, clipR.top));
    };
    const out = (node, clipR) => {
      if (!node || none(node)) return false;
      const r = node.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) return false;
      return (
        r.bottom > clipR.bottom + 1.5 ||
        r.top < clipR.top - 1.5 ||
        r.right > clipR.right + 1.5 ||
        r.left < clipR.left - 1.5
      );
    };
    const bh = (node) => (node && !none(node) ? +node.getBoundingClientRect().height.toFixed(1) : 0);
    const r = (node) => (node ? node.getBoundingClientRect() : null);
    const fireR = r(fire);
    const bombR = r(bombPad);
    const stickR = r(stick);
    const stocksR = r(stocks);
    const overlaps = (a, b) => {
      if (!a || !b || a.width < 0.5 || b.width < 0.5) return false;
      return !(a.right <= b.left + 2 || a.left >= b.right - 2 || a.bottom <= b.top + 2 || a.top >= b.bottom - 2);
    };
    // Stick idle-hidden: only count fire/bomb overlap (not stick) for SOFT.
    const padOverlap = overlaps(fireR, bombR);
    return {
      appH: +appR.height.toFixed(1),
      appTop: +appR.top.toFixed(2),
      hasPads: document.body.classList.contains('has-touch-pads'),
      touchUi: document.body.classList.contains('touch-ui'),
      tcOn: tc ? tc.classList.contains('is-on') : false,
      floatMode: tc ? tc.classList.contains('tc-mode-float') : false,
      fixedMode: tc ? tc.classList.contains('tc-mode-fixed') : false,
      stickOn: tc ? tc.classList.contains('is-stick-on') : false,
      stickBaseNone: none(stickBase),
      stickZoneNone: none(stick),
      stickVisApp: +vis(stick, appR).toFixed(1),
      stickH: bh(stick),
      overlayHidden: document.getElementById('overlay')?.classList.contains('hidden') ?? false,
      lifeNone: none(lives),
      lifeVisApp: +vis(lives, appR).toFixed(1),
      lifeH: bh(lives),
      lifeOutApp: lives ? out(lives, appR) : false,
      lifeText: (lives?.textContent || '').trim(),
      bombNone: none(bombs),
      bombVisApp: +vis(bombs, appR).toFixed(1),
      bombH: bh(bombs),
      bombOutApp: bombs ? out(bombs, appR) : false,
      bombText: (bombs?.textContent || '').trim(),
      fireNone: none(fire),
      fireVisApp: +vis(fire, appR).toFixed(1),
      fireH: bh(fire),
      fireW: fire && !none(fire) ? +fire.getBoundingClientRect().width.toFixed(1) : 0,
      fireOutApp: fire ? out(fire, appR) : false,
      bombPadNone: none(bombPad),
      bombPadVisApp: +vis(bombPad, appR).toFixed(1),
      bombPadH: bh(bombPad),
      bombPadW: bombPad && !none(bombPad) ? +bombPad.getBoundingClientRect().width.toFixed(1) : 0,
      bombPadOutApp: bombPad ? out(bombPad, appR) : false,
      padOverlap,
      stocksOverApp: stocksR
        ? +Math.max(0, stocksR.bottom - appR.bottom, appR.top - stocksR.top).toFixed(2)
        : 0,
      settingsPad: (() => {
        try {
          return JSON.parse(localStorage.getItem('lao_mini_settings_v1') || '{}').padMode || '';
        } catch {
          return '';
        }
      })(),
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let skip = 0;

log('=== A) combat HUD + FLOATING pads @ NEW mid-short (production SORTIE) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'hudf');
    try {
      await enterGameplay(page);
      const m = await measureHudFloat(page);
      if (!m.overlayHidden || !m.tcOn || !m.hasPads || !m.floatMode) {
        const row = [
          `SKIP HUDF ${loc}@${size.width}×${size.height}`,
          `overlayHidden=${m.overlayHidden}`,
          `tcOn=${m.tcOn}`,
          `hasPads=${m.hasPads}`,
          `floatMode=${m.floatMode}`,
          `fixedMode=${m.fixedMode}`,
          `settingsPad=${m.settingsPad}`,
          `touchUi=${m.touchUi}`,
        ].join(' ');
        log(row);
        skip += 1;
      } else {
        const cls = classifyHudFloat(m);
        const row = [
          `HUDF ${loc}@${size.width}×${size.height} → ${cls}`,
          `life=${m.lifeVisApp}/${m.lifeH} none=${m.lifeNone} out=${m.lifeOutApp} txt=${m.lifeText}`,
          `bomb=${m.bombVisApp}/${m.bombH} none=${m.bombNone} out=${m.bombOutApp} txt=${m.bombText}`,
          `fire=${m.fireVisApp}/${m.fireH} w=${m.fireW} none=${m.fireNone} out=${m.fireOutApp}`,
          `bombPad=${m.bombPadVisApp}/${m.bombPadH} w=${m.bombPadW} none=${m.bombPadNone} out=${m.bombPadOutApp}`,
          `overlap=${m.padOverlap}`,
          `stocksOver=${m.stocksOverApp}`,
          `stickOn=${m.stickOn} stickBaseNone=${m.stickBaseNone} stickVis=${m.stickVisApp}/${m.stickH}`,
          `appH=${m.appH}`,
          `appTop=${m.appTop}`,
          `floatMode=${m.floatMode}`,
          `touchUi=${m.touchUi}`,
        ].join(' ');
        log(row);
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
        else ok += 1;
      }
    } finally {
      await page.close();
    }
  }
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok} skip=${skip}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log('SOFT DETAIL (peek/overlap vis-full — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick187-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
