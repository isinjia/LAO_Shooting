/**
 * Tick184 — residual HARD scan after tick183 sortie-load fail NEW mid-short +0.
 * NEW axis (DIFFERENT panel from ticks 173–183 select/pause/tut+result/title/
 * rare eternity+labiata+emily/loading/AE/OPTIONS/rotate portrait/sortie-err):
 *   Production char-load fail overlay (showSelect catch):
 *   screen-result gameover + err.charLoad + #btn-load-back (toTitle)
 *   @ mid-short 360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   Distinct from tick183 sortie-load fail (err.sortieLoad + retry/toSelect)
 *   and tick175 result retry/title and tick179 asset-error.
 * HARD bar = shown h2 / toTitle vis-unread vs #app.
 * REJECT: display:none / zero-rect / letterbox appTop naive OOB (tick173);
 * oc-out / app-out with vis full (tick174); title HI floor (tick135/176);
 * rare cardOver vis-full (tick177/182 SOFT); AE@404 oc-peek visApp full
 * (tick179 SOFT); OPTIONS ru@360 scrollH=71 BACK full (tick180 SOFT);
 * rotate #app overApp letterbox (tick168/181);
 * sortie-load-fail brandNone result-short CSS (tick183). dens FROZEN.
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
/** NEW mid-short cluster — same viewport as ticks 173–183; DIFFERENT overlay. */
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

function classifyCharErr(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, displayNone) => {
    if (hidden(h, displayNone)) return false;
    // vis-unread only. out with vis full is tick174-class false HARD.
    return h > 0 && vis < Math.min(minVis, Math.max(6, h - 2));
  };
  const unread =
    unreadEl(m.h2VisApp, m.h2H, 12, m.h2None) ||
    unreadEl(m.bVisApp, m.bH, 12, m.bNone) ||
    unreadEl(m.h2VisOc, m.h2H, 12, m.h2None) ||
    unreadEl(m.bVisOc, m.bH, 12, m.bNone);
  const ocPeek =
    (m.h2OutApp && !unreadEl(m.h2VisApp, m.h2H, 12, m.h2None)) ||
    (m.bOutApp && !unreadEl(m.bVisApp, m.bH, 12, m.bNone)) ||
    (m.h2OutOc && !unreadEl(m.h2VisOc, m.h2H, 12, m.h2None)) ||
    (m.bOutOc && !unreadEl(m.bVisOc, m.bH, 12, m.bNone));
  const soft = !unread && (m.panelOver > 1.5 || ocPeek);
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
  await page.goto(`${url}?cb=t184-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function openCharLoadFail(page) {
  await page.waitForFunction(() => !!window.__LAO__?.getAssets?.()?.bank, { timeout: 60000 });
  await page.evaluate(() => {
    const bank = window.__LAO__.getAssets().bank;
    bank.loadSelect = async () => {
      throw new Error('PROBE CHAR GATE FAIL');
    };
  });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-load-back', { timeout: 60000 });
  await page.waitForTimeout(220);
}

async function measureCharErr(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const brand = oc.querySelector('.brand-mark');
    const h2 = oc.querySelector('h2');
    const msg = oc.querySelector('p');
    const back = document.getElementById('btn-load-back');
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
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      ocH: +ocR.height.toFixed(1),
      ocW: +ocR.width.toFixed(1),
      ocTop: +ocR.top.toFixed(2),
      ocBot: +ocR.bottom.toFixed(2),
      appH: +appR.height.toFixed(1),
      appTop: +appR.top.toFixed(2),
      maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight || '',
      ocClass: oc.className,
      ocOverflow: getComputedStyle(oc).overflow,
      ocOverflowY: getComputedStyle(oc).overflowY,
      brandNone: none(brand),
      brandVis: brand && !none(brand) ? +vis(brand, appR).toFixed(1) : 0,
      brandH: bh(brand),
      h2None: none(h2),
      h2VisApp: +vis(h2, appR).toFixed(1),
      h2VisOc: +vis(h2, ocR).toFixed(1),
      h2H: bh(h2),
      h2OutApp: h2 ? out(h2, appR) : false,
      h2OutOc: h2 ? out(h2, ocR) : false,
      h2Text: (h2?.textContent || '').trim(),
      msgNone: none(msg),
      msgVisApp: +vis(msg, appR).toFixed(1),
      msgH: bh(msg),
      msgOutApp: msg ? out(msg, appR) : false,
      msgText: (msg?.textContent || '').slice(0, 48),
      bNone: none(back),
      bVisApp: +vis(back, appR).toFixed(1),
      bVisOc: +vis(back, ocR).toFixed(1),
      bH: bh(back),
      bOutApp: back ? out(back, appR) : false,
      bOutOc: back ? out(back, ocR) : false,
      bText: (back?.textContent || '').trim(),
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== A) char-load fail overlay @ NEW mid-short (screen-result gameover) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'char-err');
    try {
      await openCharLoadFail(page);
      const m = await measureCharErr(page);
      const cls = classifyCharErr(m);
      const row = [
        `CHAR-ERR ${loc}@${size.width}×${size.height} → ${cls}`,
        `h2=${m.h2VisApp}/${m.h2H} oc=${m.h2VisOc}`,
        `back=${m.bVisApp}/${m.bH} oc=${m.bVisOc}`,
        `h2None=${m.h2None}`,
        `bNone=${m.bNone}`,
        `h2Out=${m.h2OutApp}/${m.h2OutOc}`,
        `bOut=${m.bOutApp}/${m.bOutOc}`,
        `msg=${m.msgVisApp}/${m.msgH} none=${m.msgNone} out=${m.msgOutApp}`,
        `brandNone=${m.brandNone}`,
        `brandVis=${m.brandVis}/${m.brandH}`,
        `ocClass=${m.ocClass}`,
        `ov=${m.ocOverflow}/${m.ocOverflowY}`,
        `ocH=${m.ocH}`,
        `appH=${m.appH}`,
        `over=${m.panelOver}`,
        `appTop=${m.appTop}`,
        `maxH=${m.maxH}`,
      ].join(' ');
      log(row);
      log(`  h2: ${m.h2Text} | back: ${m.bText} | msg: ${m.msgText}`);
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
if (soft.length) {
  log('SOFT DETAIL (over/oc-peek vis-full — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick184-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
