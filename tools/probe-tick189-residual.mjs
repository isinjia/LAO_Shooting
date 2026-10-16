/**
 * Tick189 — residual HARD scan after tick188 pause OPTIONS/UNMUTE +0.
 * NEW axis (DIFFERENT play axis from ticks 173–188):
 *   Production floating stick AFTER touch (is-stick-on) vis vs #app
 *   @ mid-short 360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   Distinct from tick187 idle float stick hide (stickOn=false KEEP)
 *   and from tick185 fixed pads.
 * HARD bar = shown .tc-stick-base vis-unread vs #app AFTER pointerdown
 * on .tc-stick-zone (production _placeFloatStick). Center-of-zone contact
 * only — no corner-tap false OOB.
 * REJECT: idle hide (tick187); display:none / zero-rect / letterbox appTop
 * naive OOB (tick173); oc-out / app-out with vis full (tick174);
 * title HI floor (tick135/176); rare cardOver vis-full (tick177/182 SOFT);
 * AE@404 oc-peek visApp full (tick179 SOFT); OPTIONS ru@360 scrollH=71
 * BACK full (tick180 SOFT); rotate #app overApp letterbox (tick168/181);
 * result-short brandNone CSS (tick183/184);
 * HUD/pause @360 appTop letterbox vis full (tick185/186/187/188).
 * dens FROZEN. No HOLD uniqueness re-dump (tick174 stands).
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
/** NEW mid-short cluster — same viewport as ticks 173–188; AFTER-touch stick. */
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

function classifyStickOn(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, displayNone) => {
    if (hidden(h, displayNone)) return false;
    // vis-unread only. out with vis full is tick174-class false HARD.
    return h > 0 && vis < Math.min(minVis, Math.max(6, h - 2));
  };
  const unread = unreadEl(m.baseVisApp, m.baseH, 16, m.baseNone);
  const ocPeek = m.baseOutApp && !unread;
  const soft = !unread && (ocPeek || m.padOverlap);
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
  await page.goto(`${url}?cb=t189-${tag}-${loc}-${size.width}x${size.height}`, {
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

async function pointerDownStickCenter(page) {
  return page.evaluate(() => {
    const zone = document.querySelector('.tc-stick-zone');
    const app = document.getElementById('app');
    if (!zone || !app) return { ok: false, reason: 'missing-zone' };
    const zr = zone.getBoundingClientRect();
    const ar = app.getBoundingClientRect();
    if (zr.width < 8 || zr.height < 8) return { ok: false, reason: 'zero-zone' };
    // Center-of-zone contact (honest production thumb). Clamp inside #app
    // by a half-base inset so we do not invent corner-OOB muddy.
    const inset = 36;
    const x = Math.min(
      Math.max(zr.left + zr.width * 0.45, ar.left + inset),
      ar.right - inset,
    );
    const y = Math.min(
      Math.max(zr.top + zr.height * 0.58, ar.top + inset),
      ar.bottom - inset,
    );
    zone.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1,
        isPrimary: true,
      }),
    );
    return { ok: true, x: +x.toFixed(1), y: +y.toFixed(1) };
  });
}

async function measureStickOn(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const hud = document.getElementById('hud');
    const tc = document.getElementById('touch-controls');
    const fire = document.querySelector('.tc-fire');
    const bombPad = document.querySelector('.tc-bomb');
    const stick = document.querySelector('.tc-stick-zone');
    const stickBase = document.querySelector('.tc-stick-base');
    const knob = document.querySelector('.tc-stick-knob');
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
    const overlaps = (a, b) => {
      if (!a || !b || a.width < 0.5 || b.width < 0.5) return false;
      return !(a.right <= b.left + 2 || a.left >= b.right - 2 || a.bottom <= b.top + 2 || a.top >= b.bottom - 2);
    };
    const csBase = stickBase ? getComputedStyle(stickBase) : null;
    return {
      appH: +appR.height.toFixed(1),
      appTop: +appR.top.toFixed(2),
      hasPads: document.body.classList.contains('has-touch-pads'),
      touchUi: document.body.classList.contains('touch-ui'),
      tcOn: tc ? tc.classList.contains('is-on') : false,
      floatMode: tc ? tc.classList.contains('tc-mode-float') : false,
      fixedMode: tc ? tc.classList.contains('tc-mode-fixed') : false,
      stickOn: tc ? tc.classList.contains('is-stick-on') : false,
      overlayHidden: document.getElementById('overlay')?.classList.contains('hidden') ?? false,
      baseNone: none(stickBase),
      baseOpacity: csBase ? csBase.opacity : '',
      baseVisApp: +vis(stickBase, appR).toFixed(1),
      baseH: bh(stickBase),
      baseW: stickBase && !none(stickBase) ? +stickBase.getBoundingClientRect().width.toFixed(1) : 0,
      baseOutApp: stickBase ? out(stickBase, appR) : false,
      knobNone: none(knob),
      knobVisApp: +vis(knob, appR).toFixed(1),
      knobH: bh(knob),
      zoneNone: none(stick),
      zoneVisApp: +vis(stick, appR).toFixed(1),
      zoneH: bh(stick),
      fireVisApp: fire ? +vis(fire, appR).toFixed(1) : 0,
      fireH: bh(fire),
      bombPadVisApp: bombPad ? +vis(bombPad, appR).toFixed(1) : 0,
      bombPadH: bh(bombPad),
      padOverlap: overlaps(fireR, r(stickBase)),
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let skip = 0;

log('=== A) floating stick AFTER touch (is-stick-on) @ NEW mid-short ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'stickon');
    try {
      await enterGameplay(page);
      const down = await pointerDownStickCenter(page);
      await page.waitForTimeout(80);
      const m = await measureStickOn(page);
      if (!m.overlayHidden || !m.tcOn || !m.hasPads || !m.floatMode) {
        const row = [
          `SKIP STICKON ${loc}@${size.width}×${size.height}`,
          `overlayHidden=${m.overlayHidden}`,
          `tcOn=${m.tcOn}`,
          `hasPads=${m.hasPads}`,
          `floatMode=${m.floatMode}`,
          `fixedMode=${m.fixedMode}`,
          `touchUi=${m.touchUi}`,
          `down=${JSON.stringify(down)}`,
        ].join(' ');
        log(row);
        skip += 1;
      } else if (!m.stickOn) {
        const row = [
          `SKIP STICKON ${loc}@${size.width}×${size.height} (gesture did not set is-stick-on)`,
          `down=${JSON.stringify(down)}`,
          `baseNone=${m.baseNone}`,
          `baseOp=${m.baseOpacity}`,
        ].join(' ');
        log(row);
        skip += 1;
      } else {
        const cls = classifyStickOn(m);
        const row = [
          `STICKON ${loc}@${size.width}×${size.height} → ${cls}`,
          `stickOn=${m.stickOn}`,
          `base=${m.baseVisApp}/${m.baseH} w=${m.baseW} none=${m.baseNone} out=${m.baseOutApp} op=${m.baseOpacity}`,
          `knob=${m.knobVisApp}/${m.knobH} none=${m.knobNone}`,
          `zone=${m.zoneVisApp}/${m.zoneH}`,
          `fire=${m.fireVisApp}/${m.fireH}`,
          `bombPad=${m.bombPadVisApp}/${m.bombPadH}`,
          `overlapBaseFire=${m.padOverlap}`,
          `appH=${m.appH}`,
          `appTop=${m.appTop}`,
          `down=${JSON.stringify(down)}`,
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

const outPath = join(root, 'tools/probe-tick189-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
