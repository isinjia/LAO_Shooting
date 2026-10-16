/**
 * Tick178 — residual HARD scan after tick177 rare eternity NEW mid-short +0.
 * NEW axis (DIFFERENT panel from ticks 173–177 select/pause/tut+result/title/rare):
 *   Production loading overlay (h2 / eager label / track / meta)
 *   @ mid-short 360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   Heights sit ABOVE tick153 cliff (321–360 × ≤200) and are not the
 *   tick151 @360×240 brand-keep contract size.
 * HARD bar = h2/label/track/meta unread after letterbox.
 * REJECT: display:none / zero-rect / letterbox appTop naive OOB (tick173).
 * Brand display:none is KEEP only inside the ≤200 cliff — at these heights
 * brand-none is logged, not invent HARD / not a brand-restore ship.
 * Soft panelOver invent CLOSED (tick151–160). dens FROZEN.
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
/** NEW mid-short cluster — not tick151/153 loading 180/200/240 sets. */
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

function classifyLoad(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, out, displayNone) => {
    if (hidden(h, displayNone)) return false;
    return out || (h > 0 && vis < Math.min(minVis, Math.max(6, h - 2)));
  };
  const unread =
    unreadEl(m.h2VisApp, m.h2H, 12, m.h2OutApp, m.h2None) ||
    unreadEl(m.labVisApp, m.labH, 10, m.labOutApp, m.labNone) ||
    unreadEl(m.trackVisApp, m.trackH, 6, m.trackOutApp, m.trackNone) ||
    unreadEl(m.metaVisApp, m.metaH, 8, m.metaOutApp, m.metaNone) ||
    unreadEl(m.h2VisOc, m.h2H, 12, m.h2OutOc, m.h2None) ||
    unreadEl(m.labVisOc, m.labH, 10, m.labOutOc, m.labNone) ||
    unreadEl(m.trackVisOc, m.trackH, 6, m.trackOutOc, m.trackNone) ||
    unreadEl(m.metaVisOc, m.metaH, 8, m.metaOutOc, m.metaNone);
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
  await page.goto(`${url}?cb=t178-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function measureLoading(page) {
  return page.evaluate(async () => {
    const { t } = await import('/js/i18n.js');
    const overlay = document.getElementById('overlay');
    const oc = document.getElementById('overlay-content');
    overlay.classList.remove('hidden');
    overlay.classList.add('show');
    overlay.style.display = 'flex';
    oc.className = 'screen-loading';
    oc.style.maxHeight = '';
    oc.style.paddingTop = '';
    oc.style.paddingBottom = '';
    oc.innerHTML = `
      <div class="panel-frame" aria-hidden="true"></div>
      <span class="brand-mark">LAO MINI ACTION</span>
      <h2>LOADING</h2>
      <span class="loading-deco" aria-hidden="true"></span>
      <p id="loading-label">${t('load.eager')}</p>
      <div class="load-track" aria-hidden="true">
        <div class="load-fill" id="load-fill" style="width:55%"></div>
      </div>
      <div class="load-meta">
        <span id="load-count">12 / 22</span>
        <span id="load-pct">55%</span>
      </div>
    `;
    void oc.offsetHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const app = document.getElementById('app');
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const brand = oc.querySelector('.brand-mark');
    const h2 = oc.querySelector('h2');
    const lab = document.getElementById('loading-label');
    const track = oc.querySelector('.load-track');
    const meta = oc.querySelector('.load-meta');
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
    const inCliff =
      appR.width >= 321 && appR.width <= 360 && appR.height <= 200;
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      ocH: +ocR.height.toFixed(1),
      appH: +appR.height.toFixed(1),
      appW: +appR.width.toFixed(1),
      appTop: +appR.top.toFixed(2),
      maxH: getComputedStyle(oc).maxHeight,
      brandNone: none(brand),
      brandDisp: brand ? getComputedStyle(brand).display : 'missing',
      brandVis: brand && !none(brand) ? +vis(brand, appR).toFixed(1) : 0,
      brandH: bh(brand),
      inCliff,
      h2None: none(h2),
      h2VisApp: +vis(h2, appR).toFixed(1),
      h2VisOc: +vis(h2, ocR).toFixed(1),
      h2H: bh(h2),
      h2OutApp: h2 ? out(h2, appR) : false,
      h2OutOc: h2 ? out(h2, ocR) : false,
      labNone: none(lab),
      labVisApp: +vis(lab, appR).toFixed(1),
      labVisOc: +vis(lab, ocR).toFixed(1),
      labH: bh(lab),
      labOutApp: lab ? out(lab, appR) : false,
      labOutOc: lab ? out(lab, ocR) : false,
      labText: lab?.textContent || '',
      trackNone: none(track),
      trackVisApp: +vis(track, appR).toFixed(1),
      trackVisOc: +vis(track, ocR).toFixed(1),
      trackH: bh(track),
      trackOutApp: track ? out(track, appR) : false,
      trackOutOc: track ? out(track, ocR) : false,
      metaNone: none(meta),
      metaVisApp: +vis(meta, appR).toFixed(1),
      metaVisOc: +vis(meta, ocR).toFixed(1),
      metaH: bh(meta),
      metaOutApp: meta ? out(meta, appR) : false,
      metaOutOc: meta ? out(meta, ocR) : false,
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== A) Loading overlay @ NEW mid-short (above tick153 ≤200 cliff) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'load');
    try {
      const m = await measureLoading(page);
      const cls = classifyLoad(m);
      const row = [
        `LOAD ${loc}@${size.width}×${size.height} → ${cls}`,
        `h2=${m.h2VisApp}/${m.h2H}`,
        `lab=${m.labVisApp}/${m.labH}`,
        `track=${m.trackVisApp}/${m.trackH}`,
        `meta=${m.metaVisApp}/${m.metaH}`,
        `h2None=${m.h2None}`,
        `labNone=${m.labNone}`,
        `trackNone=${m.trackNone}`,
        `metaNone=${m.metaNone}`,
        `h2Out=${m.h2OutApp}`,
        `labOut=${m.labOutApp}`,
        `trackOut=${m.trackOutApp}`,
        `metaOut=${m.metaOutApp}`,
        `brandNone=${m.brandNone}`,
        `brandDisp=${m.brandDisp}`,
        `brandVis=${m.brandVis}`,
        `inCliff=${m.inCliff}`,
        `ocH=${m.ocH}`,
        `appH=${m.appH}`,
        `over=${m.panelOver}`,
        `appTop=${m.appTop}`,
        `maxH=${m.maxH}`,
      ].join(' ');
      log(row);
      if (m.labText) log(`  labText: ${m.labText}`);
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

const outPath = join(root, 'tools/probe-tick178-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
