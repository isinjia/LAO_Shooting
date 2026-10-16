/**
 * Tick173 — residual HARD scan after tick172 tut/result/OPTIONS/canvas +0.
 * NEW axis: select dossier name/kit/hint unread + horizontal kit clip
 * @ sizes outside tick171 CTA-only peer set (incl. 360×218 / 375×212 /
 * 404×228 / 430×245) × pt/es/ru with long-kit CONSTANTIA.
 * Also OPTIONS Math.max(260) LATENT reconfirm at those sizes.
 * dens FROZEN. No soft invent. No canvas CSS false-positive coords.
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
/** NEW mid-short cluster — not tick171 CTA-only 390/412/428 set. */
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

function classifyDossier(m) {
  const unreadEl = (vis, h, minVis, out) =>
    out || (h > 0 && vis < Math.min(minVis, Math.max(6, h - 2)));
  // Hint with h≈0 / display:none is tick134 intentional reclaim — not HARD.
  const hintUnread =
    m.hintH > 0.5 && unreadEl(m.hintVis, m.hintH, 10, m.hintOut);
  const unread =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    unreadEl(m.nameVis, m.nameH, 12, m.nameOut) ||
    unreadEl(m.kitVis, m.kitH, 10, m.kitOut) ||
    hintUnread ||
    m.kitHClip;
  const soft =
    !unread &&
    (m.panelOver > 1.5 ||
      m.actionsOut ||
      m.kitWrapSoft ||
      (m.gridH > 0 && m.gridH < 36) ||
      m.hintHidden);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

function classifyOpt(m) {
  const unread =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2));
  const soft =
    !unread && (m.panelOver > 1.5 || m.actionsOut || (m.scrollSoft && m.scrollH < 72));
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
      window.__tick173Health = { options: 0, optionsCaps: [] };
    },
    { loc },
  );
  await page.goto(`${url}?cb=t173-${tag}-${loc}-${size.width}x${size.height}`, {
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
        const st = window.__tick173Health;
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

async function measureSelectDossier(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const name = oc.querySelector('#select-dossier-name, .select-dossier-name');
    const kit = oc.querySelector('#select-dossier-kit, .select-dossier-kit');
    const hint = oc.querySelector('.select-dossier-hint');
    const cta = oc.querySelector('#btn-go');
    const actions = oc.querySelector('.select-actions');
    const grid = oc.querySelector('.char-grid');
    const vis = (el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
    };
    const out = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // display:none / zero-rect (tick134 hint hide) is NOT OOB unread —
      // naive top<appTop false-positives under letterboxed #app (tick173).
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 0.5 || r.height < 0.5) {
        return false;
      }
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
    const kitClip =
      !!kit &&
      kit.scrollWidth > kit.clientWidth + 2.5 &&
      getComputedStyle(kit).overflowX !== 'visible';
    // Soft wrap pressure: multi-line kit taller than a single compact line.
    const kitWrapSoft = !!kit && kit.getBoundingClientRect().height > 28;
    const hintCs = hint ? getComputedStyle(hint) : null;
    const hintHidden = !!(hint && (hintCs.display === 'none' || hint.style.display === 'none'));
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      nameOut: name ? out(name) : true,
      nameVis: +vis(name).toFixed(1),
      nameH: bh(name),
      kitOut: kit ? out(kit) : true,
      kitVis: +vis(kit).toFixed(1),
      kitH: bh(kit),
      kitHClip: kitClip,
      kitWrapSoft,
      kitText: (kit?.textContent || '').slice(0, 72),
      hintOut: hint ? out(hint) : true,
      hintVis: +vis(hint).toFixed(1),
      hintH: bh(hint),
      hintHidden,
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: bh(cta),
      actionsOut: actions ? out(actions) : false,
      gridH: grid ? +grid.getBoundingClientRect().height.toFixed(1) : 0,
      selected: oc.querySelector('.char-card.selected')?.dataset?.key || '',
    };
  });
}

async function measureOptions(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector('#btn-opt-back');
    const actions = oc.querySelector('.opt-actions');
    const scroll = oc.querySelector('.opt-scroll');
    const vis = (el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
    };
    const out = (el) => {
      if (!el) return true;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // display:none / zero-rect (tick134 hint hide) is NOT OOB unread —
      // naive top<appTop false-positives under letterboxed #app (tick173).
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 0.5 || r.height < 0.5) {
        return false;
      }
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const maxHpx = parseFloat(oc.style.maxHeight) || 0;
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const st = window.__tick173Health || {};
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxHpx,
      fitH,
      inflated: maxHpx > fitH + 0.5,
      healthSteps: st.options | 0,
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      actionsOut: actions ? out(actions) : false,
      scrollH: +(scroll?.getBoundingClientRect().height || 0).toFixed(1),
      scrollSoft: !!(scroll && scroll.getBoundingClientRect().height + 0.5 < 72),
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let healthLive = 0;

log('=== A) select dossier name/kit/hint @ NEW mid-short sizes (CONSTANTIA) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'sel');
    try {
      await page.click('#btn-start');
      await page.waitForSelector('#btn-go', { timeout: 90000 });
      await page.waitForTimeout(80);
      // Prefer long-kit CONSTANTIA; fall back to first char-card.
      const clicked = await page.evaluate(() => {
        const card =
          document.querySelector('.char-card[data-key="constantia"]') ||
          document.querySelector('.char-card[data-char="constantia"]') ||
          document.querySelector('.char-card:not([data-key="random"])');
        card?.click();
        return card?.dataset?.key || card?.dataset?.char || '';
      });
      await page.waitForTimeout(120);
      // Remeasure after syncSelectPanelBudget settles.
      await page.evaluate(() => {
        window.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(160);
      const m = await measureSelectDossier(page);
      const cls = classifyDossier(m);
      const row = [
        `SEL ${loc}@${size.width}×${size.height} → ${cls}`,
        `sel=${m.selected || clicked}`,
        `name=${m.nameVis}/${m.nameH}`,
        `kit=${m.kitVis}/${m.kitH}`,
        `hint=${m.hintVis}/${m.hintH}`,
        `hintHide=${m.hintHidden}`,
        `cta=${m.ctaVis}/${m.ctaH}`,
        `kitHClip=${m.kitHClip}`,
        `wrapSoft=${m.kitWrapSoft}`,
        `gridH=${m.gridH}`,
        `over=${m.panelOver}`,
        `maxH=${m.maxH}`,
      ].join(' ');
      log(row);
      if (m.kitText) log(`  kitText: ${m.kitText}`);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== B) OPTIONS Math.max(260) LATENT @ NEW mid-short sizes ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'opt');
    try {
      await page.click('#btn-options');
      await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
      await page.waitForTimeout(80);
      const m = await measureOptions(page);
      if (m.healthSteps > 0) healthLive += 1;
      const cls = classifyOpt(m);
      const row = `OPT ${loc}@${size.width}×${size.height} → ${cls} inflated=${m.inflated} health=${m.healthSteps} maxH=${m.maxHpx} fitH=${m.fitH} ctaVis=${m.ctaVis}/${m.ctaH} scrollH=${m.scrollH} over=${m.panelOver}`;
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
log(`hard=${hard.length} soft=${soft.length} ok=${ok} optionsHealthLive=${healthLive}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log('SOFT DETAIL:');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick173-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
