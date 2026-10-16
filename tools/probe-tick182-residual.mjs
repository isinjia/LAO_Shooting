/**
 * Tick182 — residual HARD scan after tick181 rotate PORTRAIT swap +0.
 * NEW axis (DIFFERENT panel/key from ticks 173–181):
 *   Production rare fanfare on select overlay-host (hint/name/tag)
 *   @ mid-short 360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   × labiata + emily (eternity CLOSED tick177; these keys unprobed at
 *   this NEW mid-short cluster).
 * HARD bar = hint/name/tag unread after fitRareFanfareCard (tick170).
 * REJECT: display:none / zero-rect / letterbox appTop naive OOB (tick173);
 * oc-out / app-out with vis full (tick174); title HI floor (tick135/176);
 * rare eternity ru@430 cardOver vis-full (tick177 SOFT); AE@404 oc-peek
 * visApp full (tick179 SOFT); OPTIONS ru@360 scrollH=71 BACK full (tick180
 * SOFT); rotate #app overApp letterbox (tick168/181). Soft cardOver invent
 * CLOSED (tick170/171/177). dens FROZEN. No HOLD uniqueness re-dump.
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
/** NEW mid-short cluster — same viewport as tick177 eternity; DIFFERENT rare keys. */
const SIZES = [
  { width: 360, height: 218 },
  { width: 375, height: 212 },
  { width: 404, height: 228 },
  { width: 430, height: 245 },
];
/** Tick177 closed eternity; AQ left labiata/emily unprobed at these sizes. */
const RARE_KEYS = ['labiata', 'emily'];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classifyRare(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, displayNone) => {
    if (hidden(h, displayNone)) return false;
    // vis-unread only. out with vis full is tick174-class false HARD.
    return h > 0 && vis < Math.min(minVis, Math.max(6, h - 2));
  };
  const unread =
    unreadEl(m.hintVisApp, m.hintH, 10, m.hintNone) ||
    unreadEl(m.nameVisApp, m.nameH, 14, m.nameNone) ||
    unreadEl(m.tagVisApp, m.tagH, 12, m.tagNone) ||
    unreadEl(m.hintVisOc, m.hintH, 10, m.hintNone) ||
    unreadEl(m.nameVisOc, m.nameH, 14, m.nameNone) ||
    unreadEl(m.tagVisOc, m.tagH, 12, m.tagNone);
  const ocPeek =
    (m.hintOutApp && !unreadEl(m.hintVisApp, m.hintH, 10, m.hintNone)) ||
    (m.nameOutApp && !unreadEl(m.nameVisApp, m.nameH, 14, m.nameNone)) ||
    (m.tagOutApp && !unreadEl(m.tagVisApp, m.tagH, 12, m.tagNone)) ||
    (m.hintOutOc && !unreadEl(m.hintVisOc, m.hintH, 10, m.hintNone)) ||
    (m.nameOutOc && !unreadEl(m.nameVisOc, m.nameH, 14, m.nameNone)) ||
    (m.tagOutOc && !unreadEl(m.tagVisOc, m.tagH, 12, m.tagNone));
  // cardOver / ultra portrait hide / oc-peek with vis full = playtest — not invent HARD.
  const soft = !unread && (m.cardOverApp > 1.5 || m.cardOverOc > 1.5 || ocPeek);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function boot(browser, url, size, loc, tag) {
  const page = await browser.newPage({ viewport: size });
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
  await page.goto(`${url}?cb=t182-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
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
    const name = el?.querySelector('.rare-fanfare-name');
    const tag = el?.querySelector('.rare-fanfare-tag');
    const hint = el?.querySelector('.rare-fanfare-hint');
    const portrait = el?.querySelector('.rare-fanfare-portrait');
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
    // Grounded OOB: ignore zero-rect / display:none (tick173 letterbox reject).
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
    const cardR = card?.getBoundingClientRect();
    const m = {
      on: !!el?.classList.contains('is-on'),
      compact: !!el?.classList.contains('is-rare-compact'),
      ultra: !!el?.classList.contains('is-rare-ultra'),
      ocW: +ocR.width.toFixed(1),
      ocH: +ocR.height.toFixed(1),
      appH: +appR.height.toFixed(1),
      appTop: +appR.top.toFixed(2),
      cardH: cardR ? +cardR.height.toFixed(1) : 0,
      cardOverApp: cardR
        ? +Math.max(0, cardR.bottom - appR.bottom, appR.top - cardR.top).toFixed(2)
        : 99,
      cardOverOc: cardR
        ? +Math.max(0, cardR.bottom - ocR.bottom, ocR.top - cardR.top).toFixed(2)
        : 99,
      nameNone: none(name),
      nameVisOc: +vis(name, ocR).toFixed(1),
      nameVisApp: +vis(name, appR).toFixed(1),
      nameH: bh(name),
      nameOutOc: name ? out(name, ocR) : false,
      nameOutApp: name ? out(name, appR) : false,
      tagNone: none(tag),
      tagVisOc: +vis(tag, ocR).toFixed(1),
      tagVisApp: +vis(tag, appR).toFixed(1),
      tagH: bh(tag),
      tagOutOc: tag ? out(tag, ocR) : false,
      tagOutApp: tag ? out(tag, appR) : false,
      hintNone: none(hint),
      hintVisOc: +vis(hint, ocR).toFixed(1),
      hintVisApp: +vis(hint, appR).toFixed(1),
      hintH: bh(hint),
      hintOutOc: hint ? out(hint, ocR) : false,
      hintOutApp: hint ? out(hint, appR) : false,
      portraitNone: none(portrait),
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

log('=== A) Rare fanfare overlay-host @ NEW mid-short (labiata + emily) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    for (const rareKey of RARE_KEYS) {
      const page = await boot(browser, url, size, loc, `rare-${rareKey}`);
      try {
        const m = await measureRareOnSelect(page, rareKey);
        const cls = classifyRare(m);
        const row = [
          `RARE ${loc}@${size.width}×${size.height} ${rareKey} → ${cls}`,
          `hint=${m.hintVisApp}/${m.hintH}`,
          `name=${m.nameVisApp}/${m.nameH}`,
          `tag=${m.tagVisApp}/${m.tagH}`,
          `hintNone=${m.hintNone}`,
          `nameNone=${m.nameNone}`,
          `tagNone=${m.tagNone}`,
          `hintOut=${m.hintOutApp}`,
          `nameOut=${m.nameOutApp}`,
          `tagOut=${m.tagOutApp}`,
          `cardH=${m.cardH}`,
          `ocH=${m.ocH}`,
          `appH=${m.appH}`,
          `overApp=${m.cardOverApp}`,
          `overOc=${m.cardOverOc}`,
          `compact=${m.compact}`,
          `ultra=${m.ultra}`,
          `portNone=${m.portraitNone}`,
          `appTop=${m.appTop}`,
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
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log('SOFT DETAIL (cardOver / oc-peek with vis full — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick182-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
