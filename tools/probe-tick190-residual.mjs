/**
 * Tick190 — residual HARD scan after tick189 floating stick AFTER touch +0.
 * NEW axis (DIFFERENT from ticks 173–189 overlay/HUD/stick NEW mid-short):
 *   Production deathbomb grace plate in logical 960×540 space (canvas W/H)
 *   after setTransform. Viewport 960×540 so CSS box matches logical stage.
 *   HARD bar = 960-space unread: title/sub wider than grown plate, or plate
 *   outside 0..W. First-teach + bombs>0 (longest i18n sub) × pt/es/ru.
 * REJECT: CSS viewport shrink / mid-short unread invent (AJ KEEP);
 * display:none / letterbox appTop naive OOB (173); pause letterbox (174);
 * title HI floor (135/176); rare cardOver vis-full (177/182 SOFT);
 * AE@404 oc-peek visApp full (179 SOFT); OPTIONS ru@360 scrollH=71 BACK full
 * (180 SOFT); rotate #app overApp letterbox (168/181);
 * result-short brandNone CSS (183/184);
 * HUD/pause @360 appTop letterbox vis full (185–188);
 * floating idle stick hide (187); stick fade opacity vis full (189).
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

/** Long first-teach locales (tick116 grow proof). Not NEW mid-short. */
const LONG = ['pt', 'es', 'ru'];
const SIZES = [{ width: 960, height: 540 }];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classifyDeathbomb960(m) {
  if (!m.windowOn || !m.alive) return 'SKIP';
  // vis-unread in LOGICAL 960 space only. CSS canvas cssW<960 is AJ KEEP,
  // not HARD (do not invent canvas shrink from CSS viewport).
  const pad = 12;
  const titleUnread = m.boxW > 0 && m.titleW > m.boxW - pad;
  const subUnread = m.boxW > 0 && m.subW > m.boxW - pad;
  const plateOob = m.plateL < -0.5 || m.plateR > m.W + 0.5;
  const unread = titleUnread || subUnread || plateOob;
  return unread ? 'HARD' : 'ok';
}

async function boot(browser, url, size, loc, tag) {
  const page = await browser.newPage({
    viewport: size,
    hasTouch: false,
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
          padMode: 'fixed',
          fullscreen: false,
        }),
      );
      localStorage.setItem('lao_mini_tutorial_seen', '1');
    },
    { loc },
  );
  await page.goto(`${url}?cb=t190-${tag}-${loc}-${size.width}x${size.height}`, {
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

async function openFirstTeachWindow(page) {
  return page.evaluate(() => {
    const g = window.__LAO__?.getGame?.();
    const p = g?.player;
    if (!g || !p) return { ok: false, reason: 'no-game' };
    p.alive = true;
    p.bombs = Math.max(1, p.bombs || 0);
    p.invuln = 30;
    p.deathBombOpens = 1;
    p._deathBombWindowMax = 20;
    p.deathBombTimer = 20;
    p.deathFlash = 0.4;
    if (typeof g.setPaused === 'function') g.setPaused(true);
    else g.paused = true;
    return { ok: true, bombs: p.bombs, timer: p.deathBombTimer };
  });
}

async function measureDeathbomb960(page) {
  return page.evaluate(async () => {
    const g = window.__LAO__?.getGame?.();
    const p = g?.player;
    const ctx = g?.ctx;
    const canvas = g?.canvas;
    const W = 960;
    const H = 540;
    if (!g || !p || !ctx) {
      return { windowOn: false, alive: false, W, H };
    }
    const loc = JSON.parse(localStorage.getItem('lao_mini_settings_v1') || '{}').lang;
    const { t, setLocale } = await import('/js/i18n.js');
    setLocale(loc);
    const canBomb = p.bombs > 0;
    const first = !!p.isFirstDeathBomb;
    const dbTitle = canBomb ? 'X · DEATHBOMB' : 'NO BOMB';
    const dbSub = canBomb
      ? (first ? t('deathbomb.first') : t('deathbomb.ok'))
      : t('deathbomb.needDrop');
    ctx.save();
    ctx.font = '11px "Noto Sans KR", "Malgun Gothic", sans-serif';
    const subW = ctx.measureText(dbSub).width;
    ctx.font = `bold ${first ? 20 : 18}px "Chakra Petch", "Malgun Gothic", sans-serif`;
    const titleW = ctx.measureText(dbTitle).width;
    const baseW = first ? 268 : 236;
    const boxW = Math.min(W - 48, Math.max(baseW, Math.ceil(Math.max(subW, titleW) + 28)));
    const boxH = first ? 52 : 44;
    const plateL = W / 2 - boxW / 2;
    const plateR = plateL + boxW;
    const plateT = H * 0.28 - 20;
    ctx.restore();
    const cr = canvas.getBoundingClientRect();
    return {
      windowOn: !!p.inDeathBombWindow,
      alive: !!p.alive,
      first,
      canBomb,
      loc,
      dbTitle,
      dbSub: dbSub.slice(0, 72),
      subChars: [...dbSub].length,
      titleW: +titleW.toFixed(1),
      subW: +subW.toFixed(1),
      boxW,
      boxH,
      plateL: +plateL.toFixed(1),
      plateR: +plateR.toFixed(1),
      plateT: +plateT.toFixed(1),
      W,
      H,
      cssW: +cr.width.toFixed(1),
      cssH: +cr.height.toFixed(1),
      paused: !!g.paused,
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let skip = 0;

log('=== A) deathbomb first-teach plate @ logical 960×540 (not CSS mid-short) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'db960');
    try {
      await enterGameplay(page);
      await page.evaluate(() => document.fonts?.ready?.catch?.(() => null));
      const opened = await openFirstTeachWindow(page);
      if (!opened.ok) {
        const row = `SKIP db960 ${loc}@${size.width}×${size.height} (${opened.reason})`;
        log(row);
        skip += 1;
      } else {
        await page.waitForTimeout(80);
        const plate = await measureDeathbomb960(page);
        const cls = classifyDeathbomb960(plate);
        const row = [
          `DB960 ${loc}@${size.width}×${size.height} → ${cls}`,
          `first=${plate.first}`,
          `canBomb=${plate.canBomb}`,
          `window=${plate.windowOn}`,
          `titleW=${plate.titleW}`,
          `subW=${plate.subW}`,
          `boxW=${plate.boxW}`,
          `plate=${plate.plateL}..${plate.plateR}`,
          `subChars=${plate.subChars}`,
          `css=${plate.cssW}x${plate.cssH}`,
          `paused=${plate.paused}`,
          `txt="${plate.dbSub}"`,
        ].join(' ');
        log(row);
        if (cls === 'SKIP') skip += 1;
        else if (cls === 'HARD') hard.push(row);
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
  log('SOFT DETAIL (CSS shrink KEEP — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick190-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
