/**
 * Tick134: short-height residual scan — loading / options / select / title /
 * cleared-result. Prefer live panelOver / CTA OOB / deco belt (420 vs 480).
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

function boxOut(el, box) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5 || r.right > box.right + 1.5;
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
  { width: 854, height: 480 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({
        viewport: size,
        hasTouch: false,
        isMobile: false,
      });
      try {
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
        await page.goto(`${url}?cb=r134-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(50);

        // ---- TITLE residual (live lobby) ----
        const title = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const hi = document.querySelector('.keys-hi, #keys-hi, .hi-score');
          const start = document.getElementById('btn-start');
          const opts = document.getElementById('btn-options');
          const brand = oc.querySelector('.brand-mark');
          const tag = oc.querySelector('.title-tagline, .lobby-tagline, .title-sub');
          const status = oc.querySelector('.lobby-status, .title-status');
          const keys = oc.querySelector('.keys');
          const strip = oc.querySelector('.lobby-resource-strip');
          const foot = oc.querySelector('.lobby-foot');
          const cs = (el) => (el ? getComputedStyle(el).display : 'none');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            startOut: boxOut(start, appR),
            optsOut: boxOut(opts, appR),
            hiOut: hi ? boxOut(hi, appR) || boxOut(hi, ocR) : false,
            brandDisplay: cs(brand),
            tagDisplay: cs(tag),
            statusDisplay: cs(status),
            stripDisplay: cs(strip),
            footDisplay: cs(foot),
            keysH: keys ? +keys.getBoundingClientRect().height.toFixed(1) : 0,
            brandH: brand && cs(brand) !== 'none' ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'title', loc, w: size.width, h: size.height, ...title });

        // ---- LOADING inject ----
        const loading = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let label = 'Preparing sortie assets…';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) label = mod.t('load.preparing');
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-loading';
          content.style.maxHeight = '';
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">LAO MINI ACTION</span>
            <h2>LOADING</h2>
            <span class="loading-deco" aria-hidden="true"></span>
            <p id="loading-label">${label}</p>
            <div class="load-track" aria-hidden="true"><div class="load-fill" id="load-fill" style="width:67%"></div></div>
            <div class="load-meta"><span id="load-count">42 / 63</span><span id="load-pct">67%</span></div>
          `;
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const lab = document.getElementById('loading-label');
          const meta = content.querySelector('.load-meta');
          const deco = content.querySelector('.loading-deco');
          const brand = content.querySelector('.brand-mark');
          const oh = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              ohY: r.bottom > ocR.bottom + 1.5 || r.top < ocR.top - 1.5,
              ohX: r.right > ocR.right + 1.5 || r.left < ocR.left - 1.5,
              h: +r.height.toFixed(1),
            };
          };
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            decoH: deco && getComputedStyle(deco).display !== 'none' ? +deco.getBoundingClientRect().height.toFixed(1) : 0,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            labelOh: oh(lab),
            metaOh: oh(meta),
            labelText: lab?.textContent || '',
            padT: parseFloat(getComputedStyle(content).paddingTop) || 0,
            padB: parseFloat(getComputedStyle(content).paddingBottom) || 0,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'loading', loc, w: size.width, h: size.height, ...loading });

        // ---- CLEARED RESULT inject (ALL CLEAR longer stageLabel) ----
        const cleared = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tRetry = 'RETRY';
          let tTitle = 'TITLE';
          let clearedLbl = 'ALL CLEAR';
          let stageLbl = 'STAGE 3 — FINAL SORTIE';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tRetry = mod.t('btn.retry') || tRetry;
              tTitle = mod.t('btn.title') || tTitle;
              clearedLbl = mod.t('result.cleared') || mod.t('result.allClear') || clearedLbl;
              stageLbl = mod.t('stage.final') || stageLbl;
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-result is-cleared';
          content.style.maxHeight = '';
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">LAO MINI ACTION</span>
            <h2>${clearedLbl}</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="lbl">SCORE</span><span class="val">1,234,567</span></div>
              <div class="cell"><span class="lbl">HI</span><span class="val">9,999,999</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="lbl">STAGE</span><span class="val">${stageLbl}</span></div>
              <div class="cell"><span class="lbl">TIME</span><span class="val">12:34</span></div>
            </div>
            <div class="result-actions">
              <button class="btn" id="btn-retry">${tRetry}</button>
              <button class="btn" id="btn-title">${tTitle}</button>
            </div>
          `;
          // Prefer live sync if exposed via window / module side-effect already on page
          try {
            if (typeof window.syncResultPanelBudget === 'function') {
              window.syncResultPanelBudget();
            }
          } catch { /* */ }
          // Dispatch resize so main.js listener re-syncs if wired
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const retry = document.getElementById('btn-retry');
          const titleBtn = document.getElementById('btn-title');
          const deco = content.querySelector('.result-deco');
          const metaVal = content.querySelector('.result-meta .val');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            retryOut: boxOut(retry, appR),
            titleOut: boxOut(titleBtn, appR),
            retryOcOut: boxOut(retry, ocR),
            titleOcOut: boxOut(titleBtn, ocR),
            metaValH: metaVal ? +metaVal.getBoundingClientRect().height.toFixed(1) : 0,
            h2Text: content.querySelector('h2')?.textContent || '',
            maxH: content.style.maxHeight || '',
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'cleared', loc, w: size.width, h: size.height, ...cleared });

        // ---- OPTIONS via title button ----
        // Return to title first
        await page.evaluate(() => {
          const c = document.getElementById('overlay-content');
          if (c) {
            c.style.maxHeight = '';
            c.style.paddingTop = '';
            c.style.paddingBottom = '';
          }
        });
        await page.goto(`${url}?cb=r134o-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back, #btn-back, .opt-actions .btn', { timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(80);
        const opt = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          if (!oc?.classList.contains('screen-options')) {
            return { skipped: true, cls: oc?.className || '' };
          }
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const back =
            document.getElementById('btn-opt-back') ||
            document.getElementById('btn-back') ||
            oc.querySelector('.opt-actions .btn');
          const scroll = oc.querySelector('.opt-scroll');
          const nested = oc.querySelector('.opt-scroll .opt-keys');
          const nestedMax = nested ? getComputedStyle(nested).maxHeight : '';
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            backOut: boxOut(back, appR),
            backOcOut: boxOut(back, ocR),
            nested:
              nested &&
              nestedMax !== 'none' &&
              nestedMax !== '' &&
              parseFloat(nestedMax) > 0 &&
              nested.scrollHeight > nested.clientHeight + 2,
            nestedMax,
            scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(1) : 0,
            maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight || '',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'options', loc, w: size.width, h: size.height, ...opt });

        // ---- SELECT via start (tutorial seen) ----
        await page.goto(`${url}?cb=r134s-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForTimeout(200);
        const select = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          if (!oc?.classList.contains('screen-select')) {
            return { skipped: true, cls: oc?.className || '' };
          }
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.char-grid, .select-grid');
          const cta =
            document.getElementById('btn-sortie') ||
            document.getElementById('btn-confirm') ||
            oc.querySelector('.select-actions .btn');
          const deco = oc.querySelector('.sortie-deco');
          const blurb = oc.querySelector('.select-blurb');
          const gridR = grid?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            gridH: gridR ? +gridR.height.toFixed(1) : 0,
            ctaOut: boxOut(cta, appR),
            ctaOcOut: boxOut(cta, ocR),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            blurbDisplay: blurb ? getComputedStyle(blurb).display : 'none',
            maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight || '',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...select });
      } catch (err) {
        findings.push({
          screen: 'error',
          loc,
          w: size.width,
          h: size.height,
          error: String(err?.message || err),
        });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const muddy = findings.filter((f) => {
  if (f.screen === 'loading') {
    return f.panelOver > 1.5 || f.panelOverTop > 1.5 || f.labelOh?.ohY || f.labelOh?.ohX || f.metaOh?.ohY;
  }
  if (f.screen === 'cleared') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.retryOut ||
      f.titleOut ||
      f.retryOcOut ||
      f.titleOcOut
    );
  }
  if (f.screen === 'options') {
    if (f.skipped) return false;
    return f.backOut || f.backOcOut || f.nested || f.panelOver > 1.5 || f.panelOverTop > 1.5;
  }
  if (f.screen === 'select') {
    if (f.skipped) return false;
    return (
      f.ctaOut ||
      f.ctaOcOut ||
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      (f.gridH > 0 && f.gridH < 36)
    );
  }
  if (f.screen === 'title') {
    return f.startOut || f.optsOut || f.hiOut || f.panelOver > 1.5 || f.panelOverTop > 1.5;
  }
  return f.screen === 'error';
});

const soft = findings.filter((f) => {
  if (muddy.includes(f)) return false;
  if (f.screen === 'loading') {
    // deco still on at ≤480 while panel tight — belt gap vs pause/result/tutorial
    if (f.h <= 480 && f.decoDisplay === 'block' && f.panelOver > -12) return true;
    if (f.panelOver > 0 && f.panelOver <= 1.5) return true;
  }
  if (f.screen === 'cleared') {
    if (f.h <= 480 && f.decoDisplay === 'block' && f.panelOver > -12) return true;
    if (f.panelOver > 0 && f.panelOver <= 1.5) return true;
  }
  if (f.screen === 'select') {
    if (f.h <= 480 && (f.decoDisplay === 'block' || f.blurbDisplay === 'block') && f.gridH < 72) return true;
    if (f.gridH > 0 && f.gridH < 56) return true;
  }
  if (f.screen === 'title') {
    if (f.h <= 480 && f.brandH === 0 && f.keysH > 0) return true; // brand-less hero soft note
  }
  return false;
});

const out = {
  muddyCount: muddy.length,
  softCount: soft.length,
  muddy,
  soft,
  byScreen: {
    loading: findings.filter((f) => f.screen === 'loading'),
    cleared: findings.filter((f) => f.screen === 'cleared'),
    options: findings.filter((f) => f.screen === 'options'),
    select: findings.filter((f) => f.screen === 'select'),
    title: findings.filter((f) => f.screen === 'title'),
    error: findings.filter((f) => f.screen === 'error'),
  },
};
const outPath = join(root, 'tools', '_tick134-thin.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      softBrief: out.soft.map((f) => ({
        screen: f.screen,
        loc: f.loc,
        w: f.w,
        h: f.h,
        panelOver: f.panelOver,
        decoDisplay: f.decoDisplay,
        gridH: f.gridH,
        brandH: f.brandH,
        keysH: f.keysH,
      })),
      loadingSample: out.byScreen.loading.filter((r) => r.h === 450 || r.h === 360),
      clearedSample: out.byScreen.cleared.filter((r) => r.h === 360),
      selectSample: out.byScreen.select.filter((r) => r.h === 450 || r.w === 800),
      titleSample: out.byScreen.title.filter((r) => r.h === 450),
      optSample: out.byScreen.options.filter((r) => r.h === 360 || r.h === 450),
      errors: out.byScreen.error,
      wrote: outPath,
    },
    null,
    2,
  ),
);
process.exit(out.muddyCount === 0 && out.byScreen.error.length === 0 ? 0 : 1);
