/**
 * Tick130 residuals: thin-viewport panel floor / nested scroll / CTA clip /
 * i18n crush on tutorial · options · pause · result · title @ short heights.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
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
  { width: 960, height: 540 },
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
          // Force tutorial path for first START click when needed
          localStorage.setItem('lao_mini_tutorial_seen', '0');
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=r130-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(80);

        // ---- TITLE ----
        const title = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const start = document.getElementById('btn-start');
          const opts = document.getElementById('btn-options');
          const keys = document.querySelector('.keys');
          const grid = document.querySelector('.keys-grid');
          const rules = document.querySelector('.keys-rules');
          const hi = document.querySelector('.keys-hiscore');
          const appR = app?.getBoundingClientRect();
          const ocR = content?.getBoundingClientRect();
          const nested =
            !!(keys && grid) &&
            keys.scrollHeight > keys.clientHeight + 2 &&
            grid.scrollHeight > grid.clientHeight + 2;
          return {
            startOut: !!(start && appR && boxOut(start, appR)),
            optsOut: !!(opts && appR && boxOut(opts, appR)),
            hiOut: !!(hi && ocR && boxOut(hi, ocR)),
            panelOver: ocR && appR ? +(ocR.bottom - appR.bottom).toFixed(2) : 0,
            nested,
            gridCan: !!(grid && grid.scrollHeight > grid.clientHeight + 2),
            keysCan: !!(keys && keys.scrollHeight > keys.clientHeight + 2),
            rulesOh: !!(rules && rules.scrollHeight > rules.clientHeight + 1),
            gridRows: grid ? grid.children.length : 0,
            gridVisibleApprox: (() => {
              if (!grid || !grid.firstElementChild) return 0;
              const rowH = grid.firstElementChild.getBoundingClientRect().height || 1;
              return Math.max(0, Math.floor((grid.clientHeight + 2) / rowH));
            })(),
            panelMaxH: content ? getComputedStyle(content).maxHeight : null,
            keysMaxH: keys ? getComputedStyle(keys).maxHeight : null,
            appH: Math.round(appR?.height || 0),
            panelH: Math.round(ocR?.height || 0),
          };
        }, boxOut.toString());
        findings.push({ screen: 'title', loc, w: size.width, h: size.height, ...title });

        // ---- OPTIONS ----
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
        await page.waitForTimeout(100);
        const opt = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const back = document.getElementById('btn-opt-back');
          const scroll = document.querySelector('.opt-scroll');
          const keys = document.querySelector('.opt-keys');
          const autofire = document.querySelector('.opt-autofire, label[for="opt-autofire"], #opt-autofire')?.closest?.('label')
            || document.querySelector('#opt-autofire')?.parentElement;
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
            scrollCan: !!(scroll && scroll.scrollHeight > scroll.clientHeight + 2),
            keysCan: !!(keys && keys.scrollHeight > keys.clientHeight + 2),
            keysMaxH: keys ? getComputedStyle(keys).maxHeight : null,
            autofireOh: (() => {
              if (!autofire) return null;
              const el = autofire;
              return {
                ohX: el.scrollWidth > el.clientWidth + 1,
                ohY: el.scrollHeight > el.clientHeight + 1,
                text: (el.textContent || '').trim().slice(0, 80),
              };
            })(),
            panelOver: ocR && appR ? +(ocR.bottom - appR.bottom).toFixed(2) : 0,
            panelMaxH: content ? getComputedStyle(content).maxHeight : null,
            appH: Math.round(appR?.height || 0),
            panelH: Math.round(ocR?.height || 0),
          };
        }, boxOut.toString());
        findings.push({ screen: 'opt', loc, w: size.width, h: size.height, ...opt });
        await page.click('#btn-opt-back');
        await page.waitForSelector('#btn-start', { timeout: 30000 });

        // ---- TUTORIAL (tutorial_seen=0) ----
        await page.click('#btn-start');
        await page.waitForSelector('#btn-tut-go, #btn-go', { timeout: 60000 });
        await page.waitForTimeout(140);
        const isTut = await page.evaluate(() =>
          document.getElementById('overlay-content')?.classList.contains('screen-tutorial'),
        );
        if (isTut) {
          const tut = await page.evaluate((boxOutSrc) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            const app = document.getElementById('app');
            const content = document.getElementById('overlay-content');
            const go = document.getElementById('btn-tut-go') || document.querySelector('.tut-actions .btn-primary, .tut-actions .btn-cta');
            const grid = document.querySelector('.tut-grid, .tut-rows, .tut-list');
            const note = document.querySelector('.tut-note');
            const appR = app?.getBoundingClientRect();
            const ocR = content?.getBoundingClientRect();
            const rows = [...document.querySelectorAll('.tut-row')];
            const rowHs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
            const minRow = rowHs.length ? Math.min(...rowHs) : 0;
            return {
              goOut: !!(go && appR && boxOut(go, appR)),
              goOcOut: !!(go && ocR && boxOut(go, ocR)),
              nested: !!(
                content &&
                grid &&
                content.scrollHeight > content.clientHeight + 2 &&
                grid.scrollHeight > grid.clientHeight + 2
              ),
              gridCan: !!(grid && grid.scrollHeight > grid.clientHeight + 2),
              gridH: grid ? Math.round(grid.getBoundingClientRect().height) : 0,
              minRow,
              rowCount: rows.length,
              noteOh: note
                ? {
                    ohY: note.scrollHeight > note.clientHeight + 1,
                    ohX: note.scrollWidth > note.clientWidth + 1,
                    text: (note.textContent || '').trim().slice(0, 60),
                  }
                : null,
              panelOver: ocR && appR ? +(ocR.bottom - appR.bottom).toFixed(2) : 0,
              panelMaxH: content ? getComputedStyle(content).maxHeight : null,
              appH: Math.round(appR?.height || 0),
              panelH: Math.round(ocR?.height || 0),
            };
          }, boxOut.toString());
          findings.push({ screen: 'tutorial', loc, w: size.width, h: size.height, ...tut });
          // dismiss tutorial toward select if possible
          const skip = await page.$('#btn-tut-skip, #btn-tut-go');
          if (skip) {
            await skip.click();
            await page.waitForTimeout(120);
          }
        } else {
          findings.push({ screen: 'tutorial', loc, w: size.width, h: size.height, skipped: true, reason: 'landed-select' });
        }

        // ensure select then back for pause/result injects
        const onSelect = await page.evaluate(() =>
          document.getElementById('overlay-content')?.classList.contains('screen-select'),
        );
        if (!onSelect) {
          // force title again
          await page.evaluate(() => {
            localStorage.setItem('lao_mini_tutorial_seen', '1');
          });
        }

        // ---- PAUSE (inject like prior probes; unmute labels for crush) ----
        const pause = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tPause = 'Operation on hold';
          let tResume = 'Resume';
          let tOpts = 'OPTIONS';
          let tMute = 'Unmute';
          let tTitle = 'To title';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tPause = mod.t('pause.p');
              tResume = mod.t('btn.resume');
              tOpts = mod.t('btn.options');
              tMute = mod.t('btn.unmute');
              tTitle = mod.t('btn.toTitle');
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-pause';
          content.style.maxHeight = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <div class="pause-stamp">
              <span class="brand-mark">SYSTEM HOLD</span>
              <h2>PAUSED</h2>
              <span class="pause-deco" aria-hidden="true"></span>
              <p class="pause-blurb">${tPause}</p>
            </div>
            <div class="pause-actions">
              <button class="btn btn-primary btn-cta" id="btn-resume">${tResume}</button>
              <button class="btn" id="btn-pause-options">${tOpts}</button>
              <button class="btn" id="btn-pause-mute">${tMute}</button>
              <button class="btn btn-ghost" id="btn-quit">${tTitle}</button>
            </div>
          `;
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const actions = document.querySelector('.pause-actions');
          const actR = actions.getBoundingClientRect();
          const quit = document.getElementById('btn-quit');
          const quitR = quit.getBoundingClientRect();
          const mute = document.getElementById('btn-pause-mute');
          const deco = document.querySelector('.pause-deco');
          const blurb = document.querySelector('.pause-blurb');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            actionsOver: +(actR.bottom - appR.bottom).toFixed(2),
            quitOver: +(quitR.bottom - appR.bottom).toFixed(2),
            quitOut: boxOut(quit, appR),
            resumeOut: boxOut(document.getElementById('btn-resume'), appR),
            muteLines: mute.scrollHeight > mute.clientHeight + 1 ? 'oh' : 'ok',
            muteText: (mute.textContent || '').trim(),
            quitText: (quit.textContent || '').trim(),
            blurbOh: blurb
              ? {
                  ohY: blurb.scrollHeight > blurb.clientHeight + 1,
                  sh: blurb.scrollHeight,
                  ch: blurb.clientHeight,
                  text: (blurb.textContent || '').trim().slice(0, 80),
                }
              : null,
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            overflowY: getComputedStyle(content).overflowY,
            maxH: getComputedStyle(content).maxHeight,
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'pause', loc, w: size.width, h: size.height, ...pause });

        // ---- RESULT (inject gameover + long retry i18n) ----
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
              <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 3 · LONG NAME</span></div>
              <div class="cell"><span class="lbl">PILOT</span><span class="val">CONSTANTIA</span></div>
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
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            retryOut: !!(retry && boxOut(retry, appR)),
            titleOut: !!(titleBtn && boxOut(titleBtn, appR)),
            retryOcOut: !!(retry && boxOut(retry, ocR)),
            titleOcOut: !!(titleBtn && boxOut(titleBtn, ocR)),
            retryText: (retry?.textContent || '').trim(),
            titleText: (titleBtn?.textContent || '').trim(),
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            metaOh: meta
              ? {
                  ohY: meta.scrollHeight > meta.clientHeight + 1,
                  sh: meta.scrollHeight,
                  ch: meta.clientHeight,
                }
              : null,
            overflowY: getComputedStyle(content).overflowY,
            maxH: getComputedStyle(content).maxHeight,
            appH: Math.round(appR.height),
            panelH: Math.round(ocR.height),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'result', loc, w: size.width, h: size.height, ...result });
      } catch (err) {
        findings.push({
          screen: 'error',
          loc,
          w: size.width,
          h: size.height,
          text: String(err.message || err).slice(0, 220),
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
  if (f.screen === 'title') {
    return f.startOut || f.optsOut || f.hiOut || f.nested || f.rulesOh || f.panelOver > 1.5;
  }
  if (f.screen === 'opt') {
    return f.backOut || f.backOcOut || f.nested || f.autofireOh?.ohX || f.autofireOh?.ohY || f.panelOver > 1.5;
  }
  if (f.screen === 'tutorial') {
    if (f.skipped) return false;
    return f.goOut || f.goOcOut || f.nested || f.noteOh?.ohY || f.noteOh?.ohX || f.panelOver > 1.5 || (f.minRow > 0 && f.minRow < 28);
  }
  if (f.screen === 'pause') {
    return (
      f.panelOver > 1.5 ||
      f.actionsOver > 1.5 ||
      f.quitOver > 1.5 ||
      f.quitOut ||
      f.resumeOut ||
      f.muteLines === 'oh' ||
      f.blurbOh?.ohY
    );
  }
  if (f.screen === 'result') {
    return f.panelOver > 1.5 || f.retryOut || f.titleOut || f.retryOcOut || f.titleOcOut || f.metaOh?.ohY;
  }
  return f.screen === 'error';
});

const byScreen = (name) => findings.filter((f) => f.screen === name);

console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      muddy,
      summary: {
        title: byScreen('title'),
        opt: byScreen('opt'),
        tutorial: byScreen('tutorial'),
        pause: byScreen('pause'),
        result: byScreen('result'),
        error: byScreen('error'),
      },
    },
    null,
    2,
  ),
);
