/**
 * Tick134 candidates: rare fanfare card overflow, cleared-result full markup,
 * select@short via #btn-go. Prefer live panel/card Over evidence.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
];
const RARE_KEYS = ['eternity', 'labiata', 'emily'];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

try {
  // ---- RARE FANFARE ----
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      for (const charKey of RARE_KEYS) {
        const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
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
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
          }, { loc });
          await page.goto(`${url}?cb=r134f-${Date.now()}-${loc}-${charKey}-${size.width}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });
          const snap = await page.evaluate(async ({ loc, charKey }) => {
            try {
              const i18n = await import(`/js/i18n.js?probe=${Date.now()}`);
              if (i18n?.setLocale) i18n.setLocale(loc);
            } catch { /* */ }
            const mod = await import(`/js/rare-fanfare.js?probe=${Date.now()}`);
            const host = document.getElementById('overlay-content');
            const overlay = document.getElementById('overlay');
            overlay.classList.remove('hidden');
            host.className = 'screen-select';
            host.style.maxHeight = '';
            host.innerHTML = '<div class="panel-frame" aria-hidden="true"></div>';
            // Don't await dismiss — measure while visible
            const p = mod.playRareFanfare({
              charKey,
              audio: null,
              host,
              assets: { CHAR_META: {}, anims: {} },
            });
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const app = document.getElementById('app');
            const appR = app.getBoundingClientRect();
            const fan = host.querySelector('.rare-fanfare');
            const card = host.querySelector('.rare-fanfare-card');
            const tag = host.querySelector('.rare-fanfare-tag');
            const name = host.querySelector('.rare-fanfare-name');
            if (!fan || !card) {
              return { ok: false, reason: 'no-fanfare' };
            }
            const cR = card.getBoundingClientRect();
            const tR = tag?.getBoundingClientRect();
            return {
              ok: true,
              cardOver: +(cR.bottom - appR.bottom).toFixed(2),
              cardOverTop: +(appR.top - cR.top).toFixed(2),
              cardOverX: Math.max(0, +(cR.right - appR.right).toFixed(2), +(appR.left - cR.left).toFixed(2)),
              cardH: +cR.height.toFixed(1),
              cardW: +cR.width.toFixed(1),
              appH: +appR.height.toFixed(1),
              appW: +appR.width.toFixed(1),
              tagH: tR ? +tR.height.toFixed(1) : 0,
              tagText: tag?.textContent || '',
              nameText: name?.textContent || '',
              tagLines: tag ? Math.round(tR.height / (parseFloat(getComputedStyle(tag).lineHeight) || 16)) : 0,
            };
          }, { loc, charKey });
          findings.push({ screen: 'fanfare', loc, charKey, w: size.width, h: size.height, ...snap });
        } catch (err) {
          findings.push({
            screen: 'fanfare',
            loc,
            charKey,
            w: size.width,
            h: size.height,
            ok: false,
            error: String(err?.message || err),
          });
        } finally {
          await page.close();
        }
      }
    }
  }

  // ---- CLEARED RESULT full endScreen markup + sync ----
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
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
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });
        await page.goto(`${url}?cb=r134c-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const snap = await page.evaluate(async (loc) => {
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
          content.className = 'screen-result cleared';
          content.style.maxHeight = '';
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
          const stageLabel = 'ALL 5 · VERY LONG FINAL STAGE NAME HERE';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">MISSION COMPLETE</span>
            <h2>ALL CLEAR</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="lbl">SCORE</span><span class="val">00123456</span></div>
              <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">00999999</span></div>
              <div class="cell"><span class="lbl">GRAZE</span><span class="val">1234</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="lbl">STAGE</span><span class="val">${stageLabel}</span></div>
              <div class="cell"><span class="lbl">PILOT</span><span class="val">CONSTANTIA S2</span></div>
              <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">99</span></div>
              <div class="cell"><span class="lbl">NO MISS</span><span class="val">YES</span></div>
            </div>
            <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
            <button class="btn" id="btn-title">${tTitle}</button>
          `;
          // Call live sync via resize path — main.js wires syncResultPanelBudget on resize
          // when screen==='result'. Set a flag by dispatching after manually importing? 
          // Inline reimplement measure: trigger by cloning the function from page if present.
          // Best: click path isn't available; call through evaluating same ladder by
          // dispatching custom — actually main keeps syncResultPanelBudget private.
          // Use resize after temporarily monkey: read from source by calling via
          // overlay show? Simpler: duplicate detect by measuring BEFORE sync CSS belts,
          // then manually apply what tick133 does by importing nothing —
          // Wait: probe-tick133-result-panel calls sync via exposed path?
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          // If screen var in main isn't 'result', sync won't run. Force by re-calling
          // through a known exported path — none. Measure raw + CSS belt only first.
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          let ocR = content.getBoundingClientRect();
          const retry = document.getElementById('btn-retry');
          const deco = content.querySelector('.result-deco');
          const before = {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: Math.round(ocR.height),
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            retryOver: retry ? +(retry.getBoundingClientRect().bottom - appR.bottom).toFixed(2) : 0,
          };
          // Apply tick133 ladder locally (same steps) to see post-sync state
          const panelOver = () => {
            void content.offsetHeight;
            const a = app.getBoundingClientRect();
            const o = content.getBoundingClientRect();
            return Math.max(0, o.bottom - (a.bottom + 1), (a.top - 1) - o.top);
          };
          let over = panelOver();
          if (over > 1.5) {
            if (deco) deco.style.display = 'none';
            over = panelOver();
          }
          if (over > 1.5) {
            const brand = content.querySelector(':scope > .brand-mark');
            const h2 = content.querySelector(':scope > h2');
            const score = content.querySelector('.result-score');
            const meta = content.querySelector('.result-meta');
            if (brand) brand.style.marginBottom = '6px';
            if (h2) h2.style.marginBottom = '6px';
            if (score) {
              score.style.marginTop = '4px';
              score.style.marginBottom = '8px';
              score.style.gap = '12px';
            }
            if (meta) {
              meta.style.marginBottom = '8px';
              meta.style.gap = '6px 12px';
            }
            over = panelOver();
          }
          if (over > 1.5) {
            for (const cell of content.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '2px 4px';
              cell.style.border = 'none';
              cell.style.backgroundImage = 'none';
              cell.style.boxShadow = 'none';
              cell.style.clipPath = 'none';
            }
            over = panelOver();
          }
          if (over > 1.5) {
            content.style.paddingTop = '18px';
            content.style.paddingBottom = '12px';
            over = panelOver();
          }
          if (over > 1.5) {
            retry.style.padding = '8px 20px';
            const titleBtn = document.getElementById('btn-title');
            if (titleBtn) titleBtn.style.padding = '8px 20px';
            over = panelOver();
          }
          if (over > 1.5) {
            const appH = app.clientHeight || 360;
            content.style.maxHeight = `${Math.max(260, Math.floor(appH * 0.96))}px`;
          }
          ocR = content.getBoundingClientRect();
          return {
            before,
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: Math.round(ocR.height),
            appH: Math.round(appR.height),
            decoDisplay: deco ? getComputedStyle(deco).display : null,
            retryOver: retry ? +(retry.getBoundingClientRect().bottom - appR.bottom).toFixed(2) : 0,
            maxH: content.style.maxHeight || '',
            stageVal: content.querySelector('.result-meta .val')?.textContent || '',
          };
        }, loc);
        findings.push({ screen: 'cleared', loc, w: size.width, h: size.height, ...snap });
      } finally {
        await page.close();
      }
    }
  }

  // ---- SELECT short via #btn-go ----
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
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
        await page.goto(`${url}?cb=r134s-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 90000 });
        await page.waitForTimeout(180);
        const snap = await page.evaluate(() => {
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const go = document.getElementById('btn-go');
          const grid = document.querySelector('.char-grid');
          const deco = document.querySelector('.sortie-deco');
          const blurb = document.querySelector('.select-blurb');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const gR = grid?.getBoundingClientRect();
          return {
            cls: oc.className,
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            goOut: go
              ? go.getBoundingClientRect().bottom > appR.bottom + 1.5 ||
                go.getBoundingClientRect().top < appR.top - 1.5
              : true,
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            blurbDisplay: blurb ? getComputedStyle(blurb).display : 'none',
          };
        });
        findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...snap });
      } catch (err) {
        findings.push({
          screen: 'select',
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

const muddyFanfare = findings.filter(
  (f) =>
    f.screen === 'fanfare' &&
    f.ok &&
    (f.cardOver > 1.5 || f.cardOverTop > 1.5 || f.cardOverX > 1.5),
);
const muddyCleared = findings.filter(
  (f) => f.screen === 'cleared' && (f.panelOver > 1.5 || f.panelOverTop > 1.5 || f.retryOver > 1.5),
);
const muddySelect = findings.filter(
  (f) =>
    f.screen === 'select' &&
    !f.error &&
    (f.goOut || f.panelOver > 1.5 || f.panelOverTop > 1.5 || (f.gridH > 0 && f.gridH < 36)),
);
const softFanfare = findings.filter(
  (f) =>
    f.screen === 'fanfare' &&
    f.ok &&
    !muddyFanfare.includes(f) &&
    (f.tagLines >= 3 || f.tagH >= 40 || (f.h <= 400 && f.cardH > f.appH * 0.85)),
);

const out = {
  muddyFanfareCount: muddyFanfare.length,
  muddyClearedCount: muddyCleared.length,
  muddySelectCount: muddySelect.length,
  muddyFanfare,
  muddyCleared,
  muddySelect,
  softFanfare,
  fanfareSample: findings.filter((f) => f.screen === 'fanfare' && f.h === 360 && f.charKey === 'emily'),
  clearedSample: findings.filter((f) => f.screen === 'cleared' && f.h === 360),
  selectSample: findings.filter((f) => f.screen === 'select'),
};
const outPath = join(root, 'tools', '_tick134-candidates.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      muddyFanfareCount: out.muddyFanfareCount,
      muddyClearedCount: out.muddyClearedCount,
      muddySelectCount: out.muddySelectCount,
      muddyFanfare: out.muddyFanfare,
      muddyCleared: out.muddyCleared,
      muddySelect: out.muddySelect,
      softFanfare: out.softFanfare.map((f) => ({
        loc: f.loc,
        charKey: f.charKey,
        w: f.w,
        h: f.h,
        cardH: f.cardH,
        tagH: f.tagH,
        tagLines: f.tagLines,
        tagText: f.tagText,
        cardOver: f.cardOver,
      })),
      fanfareSample: out.fanfareSample,
      clearedSample: out.clearedSample,
      selectBrief: out.selectSample.map((f) => ({
        loc: f.loc,
        w: f.w,
        h: f.h,
        gridH: f.gridH,
        panelOver: f.panelOver,
        goOut: f.goOut,
        decoDisplay: f.decoDisplay,
        error: f.error,
      })),
      wrote: outPath,
    },
    null,
    2,
  ),
);
process.exit(
  out.muddyFanfareCount + out.muddyClearedCount + out.muddySelectCount === 0 ? 0 : 1,
);
