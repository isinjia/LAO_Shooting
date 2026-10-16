/**
 * Tick171 — residual HARD scan after tick170 compact/ultra (host=#app).
 * Production playRareFanfare uses host=#overlay-content on screen-select
 * (overflow:hidden + panel maxH). Measure clip vs overlay AND #app.
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

const LONG = ['pt', 'es', 'ru', 'en', 'ko'];
const RARE_KEYS = ['eternity', 'labiata', 'emily'];
const SIZES = [
  { width: 320, height: 200 },
  { width: 340, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

async function boot(browser, url, size, loc, tag) {
  const page = await browser.newPage({ viewport: size });
  await page.addInitScript(({ loc }) => {
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
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
  }, { loc });
  await page.goto(`${url}?cb=t171-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

function classify(m) {
  const unread = (vis, h, minVis, out) =>
    out || (h > 0 && vis < Math.min(minVis, h - 2));
  const hard =
    unread(m.hintVisOc, m.hintH, 10, m.hintOutOc) ||
    unread(m.nameVisOc, m.nameH, 14, m.nameOutOc) ||
    unread(m.tagVisOc, m.tagH, 12, m.tagOutOc) ||
    unread(m.hintVisApp, m.hintH, 10, m.hintOutApp) ||
    unread(m.nameVisApp, m.nameH, 14, m.nameOutApp) ||
    unread(m.tagVisApp, m.tagH, 12, m.tagOutApp);
  const soft =
    !hard &&
    (m.cardOverOc > 1.5 ||
      m.cardOverApp > 1.5 ||
      m.portraitOutOc);
  return hard ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function measureRareOnSelect(page, charKey) {
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 90000 });
  await page.waitForTimeout(80);
  return page.evaluate(async (key) => {
    const { playRareFanfare } = await import('/js/rare-fanfare.js');
    const oc = document.getElementById('overlay-content');
    const pending = playRareFanfare({ charKey: key, host: oc });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 520));
    const app = document.getElementById('app');
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const el = document.querySelector('.rare-fanfare');
    const card = el?.querySelector('.rare-fanfare-card');
    const title = el?.querySelector('.rare-fanfare-title');
    const name = el?.querySelector('.rare-fanfare-name');
    const tag = el?.querySelector('.rare-fanfare-tag');
    const hint = el?.querySelector('.rare-fanfare-hint');
    const portrait = el?.querySelector('.rare-fanfare-portrait');
    const vis = (node, clipR) => {
      if (!node) return 0;
      const r = node.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, clipR.bottom) - Math.max(r.top, clipR.top),
      );
    };
    const out = (node, clipR) => {
      if (!node) return true;
      const r = node.getBoundingClientRect();
      return (
        r.bottom > clipR.bottom + 1.5 ||
        r.top < clipR.top - 1.5 ||
        r.right > clipR.right + 1.5 ||
        r.left < clipR.left - 1.5
      );
    };
    const bh = (node) => (node ? +node.getBoundingClientRect().height.toFixed(1) : 0);
    const cardR = card?.getBoundingClientRect();
    const m = {
      on: !!el?.classList.contains('is-on'),
      compact: !!el?.classList.contains('is-rare-compact'),
      ultra: !!el?.classList.contains('is-rare-ultra'),
      ocW: +ocR.width.toFixed(1),
      ocH: +ocR.height.toFixed(1),
      appH: +appR.height.toFixed(1),
      cardH: cardR ? +cardR.height.toFixed(1) : 0,
      cardOverApp: cardR
        ? +Math.max(0, cardR.bottom - appR.bottom, appR.top - cardR.top).toFixed(2)
        : 99,
      cardOverOc: cardR
        ? +Math.max(0, cardR.bottom - ocR.bottom, ocR.top - cardR.top).toFixed(2)
        : 99,
      titleVisOc: +vis(title, ocR).toFixed(1),
      nameVisOc: +vis(name, ocR).toFixed(1),
      nameH: bh(name),
      nameOutOc: name ? out(name, ocR) : true,
      nameOutApp: name ? out(name, appR) : true,
      nameVisApp: +vis(name, appR).toFixed(1),
      tagVisOc: +vis(tag, ocR).toFixed(1),
      tagVisApp: +vis(tag, appR).toFixed(1),
      tagH: bh(tag),
      tagOutOc: tag ? out(tag, ocR) : true,
      tagOutApp: tag ? out(tag, appR) : true,
      hintVisOc: +vis(hint, ocR).toFixed(1),
      hintVisApp: +vis(hint, appR).toFixed(1),
      hintH: bh(hint),
      hintOutOc: hint ? out(hint, ocR) : true,
      hintOutApp: hint ? out(hint, appR) : true,
      portraitOutOc: portrait ? out(portrait, ocR) : false,
    };
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await pending.catch(() => {});
    el?.remove();
    return m;
  }, charKey);
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== A) Rare fanfare on select overlay-content (production host) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    for (const key of RARE_KEYS) {
      const page = await boot(browser, url, size, loc, `sel-${key}`);
      try {
        const m = await measureRareOnSelect(page, key);
        const cls = classify(m);
        const row = `RARE-OC ${loc}@${size.width}×${size.height} ${key} → ${cls} hintOc=${m.hintVisOc}/${m.hintH} nameOc=${m.nameVisOc}/${m.nameH} tagOc=${m.tagVisOc}/${m.tagH} cardH=${m.cardH} ocH=${m.ocH} appH=${m.appH} overOc=${m.cardOverOc} overApp=${m.cardOverApp} compact=${m.compact} ultra=${m.ultra}`;
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

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log(`SOFT sample (first 16 of ${soft.length}):`);
  for (const s of soft.slice(0, 16)) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick171-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
