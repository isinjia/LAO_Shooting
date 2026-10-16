/**
 * Tick180 — residual HARD scan after tick179 asset-error overlay NEW mid-short +0.
 * NEW axis (DIFFERENT panel from ticks 173–179 select/pause/tut+result/
 * title START-OPTIONS/rare eternity/loading/AE):
 *   Production OPTIONS panel (h2 / BACK + opt-scroll) @ mid-short
 *   360×218 / 375×212 / 404×228 / 430×245 × pt/es/ru.
 * Tick171 OPTIONS peers were 390×220 / 412×226 / 428×241 — not this cluster.
 * Tick173 only counted Math.max(260) healthSteps as a side check.
 * HARD bar = BACK unread vs #app (historical OPTIONS QA tick127/141).
 * REJECT: display:none / zero-rect / letterbox appTop naive OOB (tick173);
 * oc-out with visApp full (tick174 analog); title HI floor (tick135/176);
 * rare ru@430 cardOver vis-full (tick177 SOFT); AE@404 oc-peek visApp full
 * (tick179 SOFT). Brand/status/resource display:none + is-opt-short KEEP
 * (tick136). scrollH<72 / <140 is soft floor pressure — not HARD.
 * Math.max(260) LATENT — log only; do not ship without inflate.
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
/** NEW mid-short cluster — not tick171 OPTIONS 390/412/428 set. */
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

function classifyOpt(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, out, displayNone) => {
    if (hidden(h, displayNone)) return false;
    return out || (h > 0 && vis < Math.min(minVis, Math.max(6, h - 2)));
  };
  // HARD = BACK unread vs #app. oc-out with visApp full is tick174-class
  // false HARD (letterbox / clip-path vs painted #app).
  const unread = unreadEl(m.backVisApp, m.backH, 12, m.backOutApp, m.backNone);
  const ocPeek = m.backOutOc || unreadEl(m.backVisOc, m.backH, 12, false, m.backNone);
  const inflated = m.healthSteps > 0;
  const softScroll = m.scrollH + 0.5 < 72;
  const soft =
    !unread && (m.panelOver > 1.5 || ocPeek || inflated || softScroll);
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
      window.__tick180Health = { options: 0, optionsCaps: [] };
    },
    { loc },
  );
  await page.goto(`${url}?cb=t180-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  await page.evaluate(() => {
    const orig = Math.max;
    Math.max = function (...args) {
      if (
        args.length >= 2 &&
        args[0] === 260 &&
        typeof args[1] === 'number' &&
        Number.isFinite(args[1])
      ) {
        const st = window.__tick180Health;
        const oc = document.getElementById('overlay-content');
        if (st && oc?.classList?.contains('screen-options')) {
          st.options += 1;
          st.optionsCaps.push(args[1]);
        }
      }
      return orig.apply(Math, args);
    };
  });
  return page;
}

async function measureOpt(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const brand = oc.querySelector('.opt-head .brand-mark');
    const h2 = oc.querySelector('.opt-head h2');
    const back = document.getElementById('btn-opt-back');
    const actions = oc.querySelector('.opt-actions');
    const scroll = oc.querySelector('.opt-scroll');
    const auto = oc.querySelector('#opt-autofire')?.closest('label');
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
    const st = window.__tick180Health || { options: 0, optionsCaps: [] };
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
      inlineMaxH: oc.style.maxHeight || '',
      ocOverflow: getComputedStyle(oc).overflow,
      ocOverflowY: getComputedStyle(oc).overflowY,
      ocClip: getComputedStyle(oc).clipPath,
      isShort: oc.classList.contains('is-opt-short'),
      brandNone: none(brand),
      brandDisp: brand ? getComputedStyle(brand).display : 'missing',
      brandVis: brand && !none(brand) ? +vis(brand, appR).toFixed(1) : 0,
      brandH: bh(brand),
      h2None: none(h2),
      h2VisApp: +vis(h2, appR).toFixed(1),
      h2VisOc: +vis(h2, ocR).toFixed(1),
      h2H: bh(h2),
      h2OutApp: h2 ? out(h2, appR) : false,
      h2OutOc: h2 ? out(h2, ocR) : false,
      h2Text: h2?.textContent || '',
      backNone: none(back),
      backVisApp: +vis(back, appR).toFixed(1),
      backVisOc: +vis(back, ocR).toFixed(1),
      backH: bh(back),
      backOutApp: back ? out(back, appR) : false,
      backOutOc: back ? out(back, ocR) : false,
      backText: back?.textContent || '',
      actionsOutApp: actions ? out(actions, appR) : false,
      scrollH: scroll ? +scroll.clientHeight.toFixed(1) : 0,
      scrollMin: scroll ? scroll.style.minHeight || '' : '',
      autoNone: none(auto),
      autoVisApp: auto ? +vis(auto, appR).toFixed(1) : 0,
      autoH: bh(auto),
      healthSteps: st.options | 0,
      healthCaps: (st.optionsCaps || []).slice(-4),
      backBox: back
        ? {
            t: +back.getBoundingClientRect().top.toFixed(1),
            b: +back.getBoundingClientRect().bottom.toFixed(1),
            l: +back.getBoundingClientRect().left.toFixed(1),
            r: +back.getBoundingClientRect().right.toFixed(1),
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
let healthLive = 0;

log('=== A) OPTIONS BACK @ NEW mid-short (not tick171 390/412/428) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'opt');
    try {
      await page.click('#btn-options');
      await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
      await page.waitForTimeout(120);
      const m = await measureOpt(page);
      healthLive += m.healthSteps | 0;
      const cls = classifyOpt(m);
      const row = [
        `OPT ${loc}@${size.width}×${size.height} → ${cls}`,
        `h2=${m.h2VisApp}/${m.h2H} oc=${m.h2VisOc}`,
        `back=${m.backVisApp}/${m.backH} oc=${m.backVisOc}`,
        `h2None=${m.h2None}`,
        `backNone=${m.backNone}`,
        `h2Out=${m.h2OutApp}/${m.h2OutOc}`,
        `backOut=${m.backOutApp}/${m.backOutOc}`,
        `actOut=${m.actionsOutApp}`,
        `ov=${m.ocOverflow}/${m.ocOverflowY}`,
        `brandNone=${m.brandNone}`,
        `brandDisp=${m.brandDisp}`,
        `short=${m.isShort}`,
        `scrollH=${m.scrollH}`,
        `scrollMin=${m.scrollMin}`,
        `auto=${m.autoVisApp}/${m.autoH} none=${m.autoNone}`,
        `health=${m.healthSteps}`,
        `ocH=${m.ocH}`,
        `appH=${m.appH}`,
        `over=${m.panelOver}`,
        `appTop=${m.appTop}`,
        `maxH=${m.maxH}`,
        `inlineMaxH=${m.inlineMaxH}`,
      ].join(' ');
      log(row);
      log(`  h2: ${m.h2Text} | back: ${m.backText} | caps=${JSON.stringify(m.healthCaps)}`);
      log(
        `  ocBox t=${m.ocTop} b=${m.ocBot} w=${m.ocW} clip=${m.ocClip} ov=${m.ocOverflow}/${m.ocOverflowY}`,
      );
      if (m.backBox) log(`  backBox ${JSON.stringify(m.backBox)}`);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok} optionsHealthLive=${healthLive}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log('SOFT DETAIL (panelOver / oc-out visApp-full / health inflate / scrollH<72 — invent CLOSED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick180-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
