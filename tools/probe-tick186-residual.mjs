/**
 * Tick186 — residual HARD scan after tick185 combat HUD + fixed pads +0.
 * NEW axis (DIFFERENT play axis from ticks 173–185):
 *   Production pause OPTIONS / MUTE (unmute when muted:false) CTAs
 *   @ mid-short 360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   Distinct from tick174 pause resume/quit (same cluster, different buttons)
 *   and from tick167 pause-opt sizes (320×200 / 360×200 / 360×240 / 400×240 /
 *   400×280).
 * HARD bar = shown #btn-pause-options / #btn-pause-mute vis-unread vs #app.
 * REJECT: display:none / zero-rect / letterbox appTop naive OOB (tick173);
 * oc-out / app-out with vis full (tick174); title HI floor (tick135/176);
 * rare cardOver vis-full (tick177/182 SOFT); AE@404 oc-peek visApp full
 * (tick179 SOFT); OPTIONS ru@360 scrollH=71 BACK full (tick180 SOFT);
 * rotate #app overApp letterbox (tick168/181);
 * result-short brandNone CSS (tick183/184);
 * HUD appTop letterbox vis full (tick185). dens FROZEN.
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
/** NEW mid-short cluster — same viewport as ticks 173–185; DIFFERENT pause CTAs. */
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

function classifyPauseMid(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, displayNone) => {
    if (hidden(h, displayNone)) return false;
    // vis-unread only. out with vis full is tick174-class false HARD.
    return h > 0 && vis < Math.min(minVis, Math.max(6, h - 2));
  };
  const unread =
    unreadEl(m.optVisApp, m.optH, 16, m.optNone) ||
    unreadEl(m.muteVisApp, m.muteH, 16, m.muteNone);
  const ocPeek =
    (m.optOutApp && !unreadEl(m.optVisApp, m.optH, 16, m.optNone)) ||
    (m.muteOutApp && !unreadEl(m.muteVisApp, m.muteH, 16, m.muteNone));
  const soft = !unread && (ocPeek || m.panelOver > 1.5 || m.actionsOut);
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
          muted: false,
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
  await page.goto(`${url}?cb=t186-${tag}-${loc}-${size.width}x${size.height}`, {
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

async function measurePauseMid(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const opt = oc?.querySelector('#btn-pause-options');
    const mute = oc?.querySelector('#btn-pause-mute');
    const resume = oc?.querySelector('#btn-resume');
    const quit = oc?.querySelector('#btn-quit');
    const actions = oc?.querySelector('.pause-actions');
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
      maxH: oc?.style.maxHeight || '',
      appH: +appR.height.toFixed(1),
      appTop: +appR.top.toFixed(2),
      ocClass: oc?.className || '',
      muteText: (mute?.textContent || '').trim().slice(0, 40),
      optText: (opt?.textContent || '').trim().slice(0, 40),
      optNone: opt ? none(opt) : true,
      optOutApp: opt ? out(opt) : false,
      optVisApp: +vis(opt).toFixed(1),
      optH: bh(opt),
      muteNone: mute ? none(mute) : true,
      muteOutApp: mute ? out(mute) : false,
      muteVisApp: +vis(mute).toFixed(1),
      muteH: bh(mute),
      resumeVis: +vis(resume).toFixed(1),
      resumeH: bh(resume),
      quitVis: +vis(quit).toFixed(1),
      quitH: bh(quit),
      actionsOut: actions ? out(actions) : false,
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let skip = 0;

log('=== A) pause OPTIONS/MUTE (unmute) @ NEW mid-short (not tick174 resume/quit) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'pause-mid');
    try {
      await enterGameplay(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(260);
      if (!(await page.$('#overlay-content.screen-pause'))) {
        const row = `SKIP pause-mid ${loc}@${size.width}×${size.height} (no screen-pause)`;
        log(row);
        skip += 1;
      } else {
        const m = await measurePauseMid(page);
        const cls = classifyPauseMid(m);
        const row = [
          `PAUSE-MID ${loc}@${size.width}×${size.height} → ${cls}`,
          `opt=${m.optVisApp}/${m.optH} none=${m.optNone} out=${m.optOutApp} txt="${m.optText}"`,
          `mute=${m.muteVisApp}/${m.muteH} none=${m.muteNone} out=${m.muteOutApp} txt="${m.muteText}"`,
          `resume=${m.resumeVis}/${m.resumeH}`,
          `quit=${m.quitVis}/${m.quitH}`,
          `actionsOut=${m.actionsOut}`,
          `over=${m.panelOver}`,
          `appH=${m.appH}`,
          `appTop=${m.appTop}`,
          `maxH=${m.maxH}`,
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
  log('SOFT DETAIL (peek/over vis-full — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick186-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
