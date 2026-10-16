/**
 * Tick176 — residual HARD scan after tick175 tut/result NEW mid-short +0.
 * NEW axis (DIFFERENT panel from ticks 173–175 select/pause/tut/result):
 *   Title START/OPTIONS (+ CONTROLS HI soft-only) @ mid-short sizes
 *   360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   (not in tick167/169 title sets; not tick170 brand@800/1280).
 * HARD bar = START/OPTIONS unread only (tick167/170).
 * HI vis=0 @h≤288 is tick135 grid-floor — SOFT / not HARD (tick169 reject).
 * brandHidden under CONTROLS = soft playtest (tick130/170 KEEP).
 * dens FROZEN. No HOLD uniqueness re-dump (tick174 stands).
 * No display:none / zero-rect / letterbox appTop naive OOB (tick173).
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
/** NEW mid-short cluster for Title — not tick167/169 title size sets. */
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

function classifyTitle(m) {
  const hidden = (elH, displayNone) => displayNone || elH < 0.5;
  const unreadEl = (vis, h, minVis, out, displayNone) => {
    if (hidden(h, displayNone)) return false;
    return out || (h > 0 && vis < Math.min(minVis, Math.max(6, h - 2)));
  };
  // HARD = START/OPTIONS unread only. HI @h≤288 / brand under CONTROLS are
  // KEEP floors (tick135/169/170) — logged for playtest, not SOFT invent.
  const unread =
    unreadEl(m.startVis, m.startH, 20, m.startOut, m.startNone) ||
    unreadEl(m.optVis, m.optH, 20, m.optOut, m.optNone);
  const soft = !unread && m.panelOver > 1.5;
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
  await page.goto(`${url}?cb=t176-${tag}-${loc}-${size.width}x${size.height}`, {
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
    const start = document.getElementById('btn-start');
    const opt = document.getElementById('btn-options');
    const keys = oc.querySelector('.keys');
    const hi = oc.querySelector('.keys-hiscore');
    const grid = oc.querySelector('.keys-grid');
    const rules = oc.querySelector('.keys-rules');
    const brand = oc.querySelector('.brand-mark, .title-brand, .brand, .title-hero');
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
    // Grounded OOB: ignore zero-rect / display:none (tick173 letterbox reject).
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
    const hiCs = hi ? getComputedStyle(hi) : null;
    const hiShown = !!(
      hi &&
      hiCs.display !== 'none' &&
      hiCs.visibility !== 'hidden' &&
      Number(hiCs.opacity) > 0.05
    );
    const keysR = keys?.getBoundingClientRect();
    const hiVisKeys = (() => {
      if (!hiShown || !keysR) return 0;
      const r = hi.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, keysR.bottom) - Math.max(r.top, keysR.top));
    })();
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      appTop: +appR.top.toFixed(2),
      startNone: start ? none(start) : true,
      startOut: start ? out(start) : true,
      startVis: +vis(start).toFixed(1),
      startH: bh(start),
      optNone: opt ? none(opt) : true,
      optOut: opt ? out(opt) : true,
      optVis: +vis(opt).toFixed(1),
      optH: bh(opt),
      hiShown,
      hiH: hiShown ? bh(hi) : 0,
      hiVisKeys: +hiVisKeys.toFixed(1),
      hiVisApp: hiShown ? +vis(hi).toFixed(1) : 0,
      hiDisplay: hiCs?.display || '',
      gridH: grid ? bh(grid) : 0,
      gridVis: grid ? +vis(grid).toFixed(1) : 0,
      rulesH: rules ? bh(rules) : 0,
      brandHidden: brand ? none(brand) || getComputedStyle(brand).display === 'none' : false,
      brandVis: brand && !none(brand) ? +vis(brand).toFixed(1) : 0,
      ocClass: oc.className,
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== A) Title START/OPTIONS @ NEW mid-short sizes (HI soft-only) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'title');
    try {
      await page.waitForSelector('#overlay-content.screen-title, #btn-start', {
        timeout: 60000,
      });
      await page.waitForTimeout(220);
      const m = await measureTitle(page);
      const cls = classifyTitle(m);
      const row = [
        `TITLE ${loc}@${size.width}×${size.height} → ${cls}`,
        `start=${m.startVis}/${m.startH}`,
        `opt=${m.optVis}/${m.optH}`,
        `startOut=${m.startOut}`,
        `optOut=${m.optOut}`,
        `startNone=${m.startNone}`,
        `optNone=${m.optNone}`,
        `hiShown=${m.hiShown}`,
        `hiVis=${m.hiVisApp}/${m.hiH}`,
        `hiKeys=${m.hiVisKeys}`,
        `brandHide=${m.brandHidden}`,
        `brandVis=${m.brandVis}`,
        `gridH=${m.gridH}`,
        `over=${m.panelOver}`,
        `appTop=${m.appTop}`,
        `maxH=${m.maxH}`,
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

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log('SOFT DETAIL (panelOver only — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick176-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
