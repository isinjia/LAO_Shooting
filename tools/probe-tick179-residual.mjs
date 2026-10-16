/**
 * Tick179 — residual HARD scan after tick178 loading overlay NEW mid-short +0.
 * NEW axis (DIFFERENT panel from ticks 173–178 select/pause/tut+result/title/rare/loading):
 *   Production asset-error overlay (h2 / msg / Retry / ToSelect + lobby-ico-back)
 *   @ mid-short 360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru
 *   Real markup (tick159 icon). Heights sit outside tick156 ≤220 / tick157–159
 *   221–224 ≥400 cliff; 360/375 still ride tick152/154 brand-none KEEP.
 * HARD bar = h2/msg/retry/select unread vs #app (historical AE vis/out).
 * REJECT: display:none / zero-rect / letterbox appTop naive OOB (tick173);
 * oc-out with visApp full (tick174 pause letterbox analog — 92vh maxH /
 * clip-path peek while CTAs still fully in #app).
 * Brand display:none KEEP on tick152 ≤360 / tick154 ≤380 / tick156 ≤220 —
 * brand-none is logged, not invent HARD / not a brand-restore ship.
 * Soft panelOver invent CLOSED (tick158/160 AE@250–290). dens FROZEN.
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
/** NEW mid-short cluster — not tick152/154/156/157/159 AE cliff sets. */
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

function classifyAe(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, out, displayNone) => {
    if (hidden(h, displayNone)) return false;
    return out || (h > 0 && vis < Math.min(minVis, Math.max(6, h - 2)));
  };
  // HARD = unread vs #app (historical AE QA). oc-out with visApp full is
  // tick174-class false HARD (92vh maxH / clip-path vs letterboxed app).
  const unread =
    unreadEl(m.h2VisApp, m.h2H, 12, m.h2OutApp, m.h2None) ||
    unreadEl(m.msgVisApp, m.msgH, 8, m.msgOutApp, m.msgNone) ||
    unreadEl(m.rVisApp, m.rH, 12, m.rOutApp, m.rNone) ||
    unreadEl(m.sVisApp, m.sH, 12, m.sOutApp, m.sNone);
  const ocPeek =
    m.rOutOc ||
    m.sOutOc ||
    unreadEl(m.rVisOc, m.rH, 12, false, m.rNone) ||
    unreadEl(m.sVisOc, m.sH, 12, false, m.sNone);
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
  await page.goto(`${url}?cb=t179-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

async function measureAe(page) {
  return page.evaluate(async () => {
    const { t } = await import('/js/i18n.js');
    const overlay = document.getElementById('overlay');
    const oc = document.getElementById('overlay-content');
    overlay.classList.remove('hidden');
    overlay.classList.add('show');
    overlay.style.display = 'flex';
    oc.className = 'screen-asset-error';
    oc.style.maxHeight = '';
    oc.style.paddingTop = '';
    oc.style.paddingBottom = '';
    oc.innerHTML = `
      <span class="brand-mark">ASSET ERROR</span>
      <span class="asset-error-icon" aria-hidden="true"></span>
      <h2>${t('err.stageLoad', { n: 1 })}</h2>
      <div class="asset-error-msg"><p>ASSET LOAD FAILED: stage01/boss_core.png</p></div>
      <span class="asset-error-deco" aria-hidden="true"></span>
      <button class="btn btn-primary" id="btn-asset-retry">${t('btn.retry')}</button>
      <button class="btn" id="btn-asset-select"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${t('btn.toSelect')}</button>
    `;
    void oc.offsetHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const app = document.getElementById('app');
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const brand = oc.querySelector('.brand-mark');
    const h2 = oc.querySelector('h2');
    const msg = oc.querySelector('.asset-error-msg');
    const retry = document.getElementById('btn-asset-retry');
    const sel = document.getElementById('btn-asset-select');
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
    const in152 = appR.width <= 360;
    const in154 = appR.width >= 361 && appR.width <= 380;
    const in156 = appR.width >= 400 && appR.height <= 220;
    const in159 = appR.width >= 400 && appR.height >= 221 && appR.height <= 224;
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      ocH: +ocR.height.toFixed(1),
      ocW: +ocR.width.toFixed(1),
      ocTop: +ocR.top.toFixed(2),
      ocBot: +ocR.bottom.toFixed(2),
      appH: +appR.height.toFixed(1),
      appW: +appR.width.toFixed(1),
      appTop: +appR.top.toFixed(2),
      maxH: getComputedStyle(oc).maxHeight,
      ocOverflow: getComputedStyle(oc).overflow,
      ocOverflowY: getComputedStyle(oc).overflowY,
      ocClip: getComputedStyle(oc).clipPath,
      brandNone: none(brand),
      brandDisp: brand ? getComputedStyle(brand).display : 'missing',
      brandVis: brand && !none(brand) ? +vis(brand, appR).toFixed(1) : 0,
      brandH: bh(brand),
      in152,
      in154,
      in156,
      in159,
      h2None: none(h2),
      h2VisApp: +vis(h2, appR).toFixed(1),
      h2VisOc: +vis(h2, ocR).toFixed(1),
      h2H: bh(h2),
      h2OutApp: h2 ? out(h2, appR) : false,
      h2OutOc: h2 ? out(h2, ocR) : false,
      h2Text: h2?.textContent || '',
      msgNone: none(msg),
      msgVisApp: +vis(msg, appR).toFixed(1),
      msgVisOc: +vis(msg, ocR).toFixed(1),
      msgH: bh(msg),
      msgOutApp: msg ? out(msg, appR) : false,
      msgOutOc: msg ? out(msg, ocR) : false,
      rNone: none(retry),
      rVisApp: +vis(retry, appR).toFixed(1),
      rVisOc: +vis(retry, ocR).toFixed(1),
      rH: bh(retry),
      rOutApp: retry ? out(retry, appR) : false,
      rOutOc: retry ? out(retry, ocR) : false,
      rText: retry?.textContent || '',
      sNone: none(sel),
      sVisApp: +vis(sel, appR).toFixed(1),
      sVisOc: +vis(sel, ocR).toFixed(1),
      sH: bh(sel),
      sOutApp: sel ? out(sel, appR) : false,
      sOutOc: sel ? out(sel, ocR) : false,
      sText: sel?.textContent || '',
      h2Box: h2
        ? {
            t: +h2.getBoundingClientRect().top.toFixed(1),
            b: +h2.getBoundingClientRect().bottom.toFixed(1),
            l: +h2.getBoundingClientRect().left.toFixed(1),
            r: +h2.getBoundingClientRect().right.toFixed(1),
          }
        : null,
      rBox: retry
        ? {
            t: +retry.getBoundingClientRect().top.toFixed(1),
            b: +retry.getBoundingClientRect().bottom.toFixed(1),
            l: +retry.getBoundingClientRect().left.toFixed(1),
            r: +retry.getBoundingClientRect().right.toFixed(1),
          }
        : null,
      sBox: sel
        ? {
            t: +sel.getBoundingClientRect().top.toFixed(1),
            b: +sel.getBoundingClientRect().bottom.toFixed(1),
            l: +sel.getBoundingClientRect().left.toFixed(1),
            r: +sel.getBoundingClientRect().right.toFixed(1),
          }
        : null,
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== A) Asset-error overlay @ NEW mid-short (outside tick156/157/159 cliff) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'ae');
    try {
      const m = await measureAe(page);
      const cls = classifyAe(m);
      const row = [
        `AE ${loc}@${size.width}×${size.height} → ${cls}`,
        `h2=${m.h2VisApp}/${m.h2H} oc=${m.h2VisOc}`,
        `msg=${m.msgVisApp}/${m.msgH} oc=${m.msgVisOc}`,
        `retry=${m.rVisApp}/${m.rH} oc=${m.rVisOc}`,
        `sel=${m.sVisApp}/${m.sH} oc=${m.sVisOc}`,
        `h2None=${m.h2None}`,
        `msgNone=${m.msgNone}`,
        `rNone=${m.rNone}`,
        `sNone=${m.sNone}`,
        `h2Out=${m.h2OutApp}/${m.h2OutOc}`,
        `msgOut=${m.msgOutApp}/${m.msgOutOc}`,
        `rOut=${m.rOutApp}/${m.rOutOc}`,
        `sOut=${m.sOutApp}/${m.sOutOc}`,
        `ov=${m.ocOverflow}/${m.ocOverflowY}`,
        `brandNone=${m.brandNone}`,
        `brandDisp=${m.brandDisp}`,
        `brandVis=${m.brandVis}`,
        `in152=${m.in152}`,
        `in154=${m.in154}`,
        `in156=${m.in156}`,
        `in159=${m.in159}`,
        `ocH=${m.ocH}`,
        `appH=${m.appH}`,
        `over=${m.panelOver}`,
        `appTop=${m.appTop}`,
        `maxH=${m.maxH}`,
      ].join(' ');
      log(row);
      log(`  h2: ${m.h2Text} | retry: ${m.rText} | sel: ${m.sText}`);
      log(
        `  ocBox t=${m.ocTop} b=${m.ocBot} w=${m.ocW} clip=${m.ocClip} ov=${m.ocOverflow}/${m.ocOverflowY}`,
      );
      if (m.h2Box) log(`  h2Box ${JSON.stringify(m.h2Box)}`);
      if (m.rBox) log(`  rBox ${JSON.stringify(m.rBox)}`);
      if (m.sBox) log(`  sBox ${JSON.stringify(m.sBox)}`);
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
  log('SOFT DETAIL (panelOver / oc-out with visApp full — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick179-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
