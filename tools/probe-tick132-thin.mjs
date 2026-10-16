/**
 * Tick132: short-height residual scan — result / tutorial / options / loading.
 * Prefer live panelOver / CTA OOB / deco belt gaps (420 vs 450).
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
  { width: 800, height: 450 },
  { width: 720, height: 400 },
  { width: 854, height: 480 },
  { width: 640, height: 360 },
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
          localStorage.setItem('lao_mini_tutorial_seen', '0');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=r132-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(60);

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
          const deco = document.querySelector('.loading-deco');
          const meta = document.querySelector('.load-meta');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            labelOh: lab
              ? { ohY: lab.scrollHeight > lab.clientHeight + 1, ohX: lab.scrollWidth > lab.clientWidth + 1, text: (lab.textContent || '').trim().slice(0, 80), sh: lab.scrollHeight, ch: lab.clientHeight }
              : null,
            metaOh: meta ? { ohY: meta.scrollHeight > meta.clientHeight + 1, sh: meta.scrollHeight, ch: meta.clientHeight } : null,
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            decoH: deco ? Math.round(deco.getBoundingClientRect().height) : 0,
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
            overflowY: getComputedStyle(content).overflowY,
            maxH: getComputedStyle(content).maxHeight,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'loading', loc, w: size.width, h: size.height, ...loading });

        // ---- RESULT inject (long stage + pilot) ----
        const result = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tRetry = 'Retry run';
          let tTitle = 'Title';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tRetry = mod.t('btn.retryRun');
              tTitle = mod.t('btn.title');
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-result gameover';
          content.style.maxHeight = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">SYSTEM DOWN</span>
            <h2>GAME OVER</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="lbl">SCORE</span><span class="val">00123456</span></div>
              <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">00999999</span></div>
              <div class="cell"><span class="lbl">GRAZE</span><span class="val">1234</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 5 · VERY LONG STAGE NAME HERE</span></div>
              <div class="cell"><span class="lbl">PILOT</span><span class="val">CONSTANTIA S2</span></div>
              <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">99</span></div>
              <div class="cell"><span class="lbl">NO MISS</span><span class="val">—</span></div>
            </div>
            <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
            <button class="btn" id="btn-title">${tTitle}</button>
          `;
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const retry = document.getElementById('btn-retry');
          const titleBtn = document.getElementById('btn-title');
          const deco = document.querySelector('.result-deco');
          const meta = document.querySelector('.result-meta');
          const score = document.querySelector('.result-score');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            retryOut: !!(retry && boxOut(retry, appR)),
            titleOut: !!(titleBtn && boxOut(titleBtn, appR)),
            retryOcOut: !!(retry && boxOut(retry, ocR)),
            titleOcOut: !!(titleBtn && boxOut(titleBtn, ocR)),
            retryOver: retry ? +(retry.getBoundingClientRect().bottom - appR.bottom).toFixed(2) : 0,
            titleOver: titleBtn ? +(titleBtn.getBoundingClientRect().bottom - appR.bottom).toFixed(2) : 0,
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            decoH: deco ? Math.round(deco.getBoundingClientRect().height) : 0,
            metaOh: meta ? { ohY: meta.scrollHeight > meta.clientHeight + 1, sh: meta.scrollHeight, ch: meta.clientHeight } : null,
            scoreOh: score ? { ohY: score.scrollHeight > score.clientHeight + 1, sh: score.scrollHeight, ch: score.clientHeight } : null,
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
            overflowY: getComputedStyle(content).overflowY,
            maxH: getComputedStyle(content).maxHeight,
            retryText: (retry?.textContent || '').trim(),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'result', loc, w: size.width, h: size.height, ...result });

        // ---- OPTIONS live ----
        await page.evaluate(() => {
          document.getElementById('overlay')?.classList.add('hidden');
        });
        // restore title path
        await page.goto(`${url}?cb=r132o-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
        await page.waitForTimeout(120);
        const opt = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const back = document.getElementById('btn-opt-back');
          const scroll = document.querySelector('.opt-scroll');
          const keys = document.querySelector('.opt-keys');
          const appR = app?.getBoundingClientRect();
          const ocR = content?.getBoundingClientRect();
          const nested =
            !!(scroll && keys) &&
            scroll.scrollHeight > scroll.clientHeight + 2 &&
            keys.scrollHeight > keys.clientHeight + 2;
          return {
            backOut: !!(back && appR && boxOut(back, appR)),
            backOcOut: !!(back && ocR && boxOut(back, ocR)),
            nested,
            panelOver: ocR && appR ? +(ocR.bottom - appR.bottom).toFixed(2) : 0,
            scrollCan: !!(scroll && scroll.scrollHeight > scroll.clientHeight + 2),
            keysMaxH: keys ? getComputedStyle(keys).maxHeight : null,
            appH: Math.round(appR?.height || 0),
            panelH: Math.round(ocR?.height || 0),
            maxH: content ? getComputedStyle(content).maxHeight : null,
          };
        }, boxOut.toString());
        findings.push({ screen: 'opt', loc, w: size.width, h: size.height, ...opt });
        await page.click('#btn-opt-back');
        await page.waitForSelector('#btn-start', { timeout: 30000 });

        // ---- TUTORIAL via beginSortie (select → SORTIE) ----
        await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '0'));
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go, #btn-sortie, .char-card, #btn-tut-go', { timeout: 60000 });
        await page.waitForTimeout(100);
        let landed = await page.evaluate(() => {
          const c = document.getElementById('overlay-content');
          return {
            tut: c?.classList.contains('screen-tutorial'),
            sel: c?.classList.contains('screen-select'),
            cls: c?.className || '',
          };
        });
        if (landed.sel) {
          // pick first char + sortie
          const go = await page.$('#btn-go');
          if (go) {
            await go.click();
          } else {
            const card = await page.$('.char-card');
            if (card) await card.click();
            await page.waitForTimeout(40);
            const go2 = await page.$('#btn-go');
            if (go2) await go2.click();
          }
          await page.waitForTimeout(200);
          landed = await page.evaluate(() => {
            const c = document.getElementById('overlay-content');
            return {
              tut: c?.classList.contains('screen-tutorial'),
              sel: c?.classList.contains('screen-select'),
              load: c?.classList.contains('screen-loading'),
              cls: c?.className || '',
            };
          });
        }
        if (landed.tut) {
          const tut = await page.evaluate((boxOutSrc) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            const app = document.getElementById('app');
            const content = document.getElementById('overlay-content');
            const go = document.getElementById('btn-tut-go');
            const skip = document.getElementById('btn-tut-skip');
            const grid = document.querySelector('.tutorial-grid');
            const note = document.querySelector('.tutorial-note');
            const deco = document.querySelector('.tutorial-deco');
            const actions = document.querySelector('.pause-actions');
            const appR = app?.getBoundingClientRect();
            const ocR = content?.getBoundingClientRect();
            const actR = actions?.getBoundingClientRect();
            const rows = [...document.querySelectorAll('.tut-row')];
            const rowHs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
            return {
              goOut: !!(go && appR && boxOut(go, appR)),
              skipOut: !!(skip && appR && boxOut(skip, appR)),
              goOcOut: !!(go && ocR && boxOut(go, ocR)),
              actionsOver: actR && appR ? +(actR.bottom - appR.bottom).toFixed(2) : 0,
              panelOver: ocR && appR ? +(ocR.bottom - appR.bottom).toFixed(2) : 0,
              nested: !!(
                content &&
                grid &&
                content.scrollHeight > content.clientHeight + 2 &&
                grid.scrollHeight > grid.clientHeight + 2
              ),
              gridCan: !!(grid && grid.scrollHeight > grid.clientHeight + 2),
              gridH: grid ? Math.round(grid.getBoundingClientRect().height) : 0,
              minRow: rowHs.length ? Math.min(...rowHs) : 0,
              rowCount: rows.length,
              noteOh: note
                ? { ohY: note.scrollHeight > note.clientHeight + 1, ohX: note.scrollWidth > note.clientWidth + 1, text: (note.textContent || '').trim().slice(0, 60), sh: note.scrollHeight, ch: note.clientHeight }
                : null,
              decoDisplay: deco ? getComputedStyle(deco).display : null,
              decoH: deco ? Math.round(deco.getBoundingClientRect().height) : 0,
              maxH: content ? getComputedStyle(content).maxHeight : null,
              appH: Math.round(appR?.height || 0),
              panelH: Math.round(ocR?.height || 0),
            };
          }, boxOut.toString());
          findings.push({ screen: 'tutorial', loc, w: size.width, h: size.height, via: 'beginSortie', ...tut });
        } else {
          findings.push({
            screen: 'tutorial',
            loc,
            w: size.width,
            h: size.height,
            skipped: true,
            reason: landed.load ? 'went-loading' : landed.cls,
          });
        }
      } catch (err) {
        findings.push({
          screen: 'error',
          loc,
          w: size.width,
          h: size.height,
          text: String(err.message || err).slice(0, 240),
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
    return f.panelOver > 1.5 || f.labelOh?.ohY || f.labelOh?.ohX || f.metaOh?.ohY;
  }
  if (f.screen === 'result') {
    return (
      f.panelOver > 1.5 ||
      f.retryOut ||
      f.titleOut ||
      f.retryOcOut ||
      f.titleOcOut ||
      f.metaOh?.ohY ||
      f.scoreOh?.ohY
    );
  }
  if (f.screen === 'opt') {
    return f.backOut || f.backOcOut || f.nested || f.panelOver > 1.5;
  }
  if (f.screen === 'tutorial') {
    if (f.skipped) return false;
    return (
      f.goOut ||
      f.skipOut ||
      f.goOcOut ||
      f.actionsOver > 1.5 ||
      f.nested ||
      f.noteOh?.ohY ||
      f.noteOh?.ohX ||
      f.panelOver > 1.5 ||
      (f.minRow > 0 && f.minRow < 28) ||
      (f.gridH > 0 && f.gridH < 36)
    );
  }
  return f.screen === 'error';
});

const soft = findings.filter((f) => {
  if (muddy.includes(f)) return false;
  // Near-miss / deco still on at ≤480 while panel tight
  if (f.screen === 'loading' || f.screen === 'result' || f.screen === 'tutorial') {
    if (f.h <= 480 && f.decoDisplay === 'block' && f.panelOver > -12) return true;
    if (f.screen === 'tutorial' && f.gridH > 0 && f.gridH < 56) return true;
    if (f.panelOver > 0 && f.panelOver <= 1.5) return true;
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
    result: findings.filter((f) => f.screen === 'result'),
    opt: findings.filter((f) => f.screen === 'opt'),
    tutorial: findings.filter((f) => f.screen === 'tutorial'),
    error: findings.filter((f) => f.screen === 'error'),
  },
};
const outPath = join(root, 'tools', '_tick132-thin.json');
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
        goOut: f.goOut,
        retryOut: f.retryOut,
      })),
      errors: out.byScreen.error.length,
      tutLive: out.byScreen.tutorial.filter((t) => !t.skipped).length,
      tutSkip: out.byScreen.tutorial.filter((t) => t.skipped).length,
      wrote: outPath,
    },
    null,
    2,
  ),
);
