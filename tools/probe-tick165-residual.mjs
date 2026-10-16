/**
 * Tick165 — residual HARD scan after tick164 tutorial skip/CTA chrome ladder.
 * Prefer: OPTIONS chrome ladder peer, result residual, or other live OOB.
 * dens FROZEN. Prefer live-measured HARD only.
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
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

const LOCALES = ['ko', 'en', 'ru', 'pt', 'es', 'zh-Hant', 'ja'];
const SIZES = [
  { width: 320, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classify(m) {
  const unread =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  const soft =
    !unread &&
    (m.panelOver > 1.5 || m.actionsOut || (m.scrollSoft && m.scrollH < 72));
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
      window.__tick165Health = { options: 0, optionsCaps: [] };
    },
    { loc },
  );
  await page.goto(`${url}?cb=t165-${tag}-${loc}-${size.width}x${size.height}`, {
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
        const st = window.__tick165Health;
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
    const brand = oc.querySelector('.opt-head .brand-mark');
    const h2 = oc.querySelector('.opt-head h2');
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
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const maxHpx = parseFloat(oc.style.maxHeight) || 0;
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const st = window.__tick165Health || {};
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      maxHpx,
      fitH,
      inflated: maxHpx > fitH + 0.5,
      healthSteps: st.options | 0,
      healthCaps: (st.optionsCaps || []).slice(-4),
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      secOut: false,
      secH: 0,
      secVis: 0,
      actionsOut: actions ? out(actions) : false,
      actionsH: +(actions?.getBoundingClientRect().height || 0).toFixed(1),
      scrollH: +(scroll?.getBoundingClientRect().height || 0).toFixed(1),
      scrollMin: scroll?.style.minHeight || '',
      scrollSoft: !!(scroll && scroll.getBoundingClientRect().height + 0.5 < 72),
      short: oc.classList.contains('is-opt-short'),
      brandHidden: brand ? getComputedStyle(brand).display === 'none' : false,
      h2Fs: h2 ? getComputedStyle(h2).fontSize : '',
      actGap: actions ? getComputedStyle(actions).gap || '' : '',
    };
  });
}

async function measureResult(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector('#btn-retry');
    const sec = oc.querySelector('#btn-title');
    const brand = oc.querySelector(':scope > .brand-mark');
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
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const maxHpx = parseFloat(oc.style.maxHeight) || 0;
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      maxHpx,
      fitH,
      inflated: maxHpx > fitH + 0.5,
      healthSteps: 0,
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      secOut: sec ? out(sec) : false,
      secVis: sec ? +vis(sec).toFixed(1) : 0,
      secH: +(sec?.getBoundingClientRect().height || 0).toFixed(1),
      actionsOut: false,
      scrollH: 0,
      scrollSoft: false,
      short: oc.classList.contains('is-result-short'),
      brandHidden: brand ? getComputedStyle(brand).display === 'none' : false,
      headroom: +(appR.bottom - ocR.bottom).toFixed(2),
    };
  });
}

async function openResult(page, loc) {
  await page.evaluate(async (loc) => {
    let tRetry = 'Retry run';
    let tTitle = 'Title';
    try {
      const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
      mod.setLocale?.(loc);
      if (mod.t) {
        tRetry = mod.t('btn.retryRun');
        tTitle = mod.t('btn.title');
      }
    } catch {
      /* */
    }
    const overlay = document.getElementById('overlay');
    const content = document.getElementById('overlay-content');
    overlay.classList.add('is-on', 'show');
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    content.className = 'screen-result gameover';
    content.style.cssText = '';
    content.innerHTML = `
      <div class="panel-frame" aria-hidden="true">
        <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
        <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
      </div>
      <span class="brand-mark">SYSTEM DOWN</span>
      <h2>GAME OVER</h2>
      <span class="result-deco" aria-hidden="true"></span>
      <div class="result-score">
        <div class="cell"><span class="lbl">SCORE</span><span class="val">00001234</span></div>
        <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">00005678</span></div>
        <div class="cell"><span class="lbl">GRAZE</span><span class="val">12</span></div>
      </div>
      <div class="result-meta">
        <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 2 · TEST</span></div>
        <div class="cell"><span class="lbl">PILOT</span><span class="val">HIRUME</span></div>
        <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">8</span></div>
        <div class="cell"><span class="lbl">NO MISS</span><span class="val">—</span></div>
      </div>
      <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
      <button class="btn" id="btn-title"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${tTitle}</button>
    `;
    window.dispatchEvent(new Event('resize'));
  }, loc);
  await page.waitForTimeout(220);
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // A) OPTIONS live from title
      {
        const page = await boot(browser, url, size, loc, 'opt');
        try {
          await page.click('#btn-options');
          await page.waitForSelector('#overlay-content.screen-options, #btn-opt-back', {
            timeout: 60000,
          });
          await page.waitForTimeout(260);
          const m = await measureOptions(page);
          const cls = classify(m);
          const tag = `options ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} maxH=${m.maxH} fitH=${m.fitH} inflated=${m.inflated}`,
            `health=${m.healthSteps} caps=${JSON.stringify(m.healthCaps)}`,
            `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `actionsOut=${m.actionsOut} scrollH=${m.scrollH} min=${m.scrollMin}`,
            `short=${m.short} brandHidden=${m.brandHidden}`,
          );
          const row = { tag, screen: 'options', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // B) RESULT inject + resize → syncResultPanelBudget (ultra-short focus)
      if (
        size.height <= 280 ||
        (size.width === 480 && size.height === 288) ||
        size.width === 320
      ) {
        const page = await boot(browser, url, size, loc, 'res');
        try {
          await openResult(page, loc);
          const m = await measureResult(page);
          const cls = classify(m);
          const tag = `result ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} maxH=${m.maxH} fitH=${m.fitH} inflated=${m.inflated}`,
            `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
            `headroom=${m.headroom} short=${m.short} brandHidden=${m.brandHidden}`,
          );
          const row = { tag, screen: 'result', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('');
log(`SUMMARY hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) {
    log(
      `  ${h.tag}`,
      `over=${h.panelOver} inflated=${h.inflated} ctaOut=${h.ctaOut}`,
      `ctaVis=${h.ctaVis}/${h.ctaH} secOut=${h.secOut} secVis=${h.secVis}/${h.secH}`,
      `health=${h.healthSteps || 0}`,
    );
  }
}
if (soft.length) {
  log('SOFT DETAIL (first 20):');
  for (const s of soft.slice(0, 20)) {
    log(`  ${s.tag} over=${s.panelOver} actionsOut=${s.actionsOut} scrollH=${s.scrollH}`);
  }
}

const outPath = join(root, 'tools', 'probe-tick165-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length ? 2 : 0);
