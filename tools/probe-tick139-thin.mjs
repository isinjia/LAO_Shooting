/**
 * Tick139 deep thin probe: ja/zh + shorter heights + asset-error + pause/tutorial/select live.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 720, height: 400 },
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
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
          },
          { loc },
        );

        await page.goto(`${url}?cb=r139t-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        // PAUSE — live ladder including tick138 head reclaim
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
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-pause';
          content.style.cssText = '';
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
          const runSync = () => {
            const oc = content;
            const deco = oc.querySelector('.pause-deco');
            const blurb = oc.querySelector('.pause-blurb');
            const actions = oc.querySelector('.pause-actions');
            const brand = oc.querySelector('.pause-stamp .brand-mark');
            const h2 = oc.querySelector('.pause-stamp h2');
            if (!app || !actions) return { steps: -1 };
            oc.style.maxHeight = '';
            oc.style.paddingTop = '';
            oc.style.paddingBottom = '';
            oc.classList.remove('is-pause-short');
            if (brand) brand.style.display = '';
            if (h2) {
              h2.style.fontSize = '';
              h2.style.margin = '';
              h2.style.letterSpacing = '';
            }
            if (deco) deco.style.display = '';
            if (blurb) {
              blurb.style.border = '';
              blurb.style.backgroundImage = '';
              blurb.style.padding = '';
              blurb.style.clipPath = '';
              blurb.style.marginTop = '';
            }
            actions.style.padding = '';
            const panelOver = () => {
              void oc.offsetHeight;
              const appR = app.getBoundingClientRect();
              const ocR = oc.getBoundingClientRect();
              return Math.max(
                0,
                ocR.bottom - (appR.bottom + 1),
                (appR.top - 1) - ocR.top,
              );
            };
            let over = panelOver();
            let steps = 0;
            if (over <= 1.5) return { steps, over };
            if (deco) deco.style.display = 'none';
            steps = 1;
            over = panelOver();
            if (over <= 1.5) return { steps, over };
            if (blurb) {
              blurb.style.border = 'none';
              blurb.style.backgroundImage = 'none';
              blurb.style.padding = '0';
              blurb.style.clipPath = 'none';
              blurb.style.marginTop = '2px';
            }
            steps = 2;
            over = panelOver();
            if (over <= 1.5) return { steps, over };
            // tick138 head reclaim
            oc.classList.add('is-pause-short');
            if (brand) brand.style.display = 'none';
            if (h2) {
              h2.style.fontSize = '18px';
              h2.style.margin = '0';
              h2.style.letterSpacing = '0.04em';
            }
            steps = 3;
            over = panelOver();
            if (over <= 1.5) return { steps, over };
            actions.style.padding = '6px';
            steps = 4;
            over = panelOver();
            if (over <= 1.5) return { steps, over };
            oc.style.paddingTop = '22px';
            oc.style.paddingBottom = '16px';
            steps = 5;
            over = panelOver();
            if (over <= 1.5) return { steps, over };
            const appH = app.clientHeight || window.innerHeight || 450;
            oc.style.maxHeight = `${Math.max(280, Math.floor(appH * 0.96))}px`;
            return { steps: 6, over: panelOver() };
          };
          const sync = runSync();
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const brand = content.querySelector('.brand-mark');
          const quit = document.getElementById('btn-quit');
          const resume = document.getElementById('btn-resume');
          const mute = document.getElementById('btn-pause-mute');
          const btns = [...(content.querySelectorAll('.pause-actions button') || [])];
          const btnClip = btns.some(
            (b) => b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2,
          );
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            syncSteps: sync?.steps ?? -1,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            quitOut: quit ? boxOut(quit, appR) : true,
            resumeOut: resume ? boxOut(resume, appR) : true,
            muteOut: mute ? boxOut(mute, appR) : true,
            btnClip,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            isPauseShort: content.classList.contains('is-pause-short'),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'pause', loc, w: size.width, h: size.height, ...pause });

        // RESULT real markup + long i18n CTA
        const result = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tRetry = 'Play again';
          let tTitle = 'Title';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tRetry = mod.t('btn.retryRun') || tRetry;
              tTitle = mod.t('btn.title') || tTitle;
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-result gameover';
          content.style.cssText = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">SYSTEM DOWN</span>
            <h2>GAME OVER</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="lbl">SCORE</span><span class="val">012345678</span></div>
              <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">098765432</span></div>
              <div class="cell"><span class="lbl">GRAZE</span><span class="val">1234</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 3 · ORBITAL SPIRE</span></div>
              <div class="cell"><span class="lbl">PILOT</span><span class="val">CONSTANTIA</span></div>
              <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">99</span></div>
              <div class="cell"><span class="lbl">NO MISS</span><span class="val">YES</span></div>
            </div>
            <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
            <button class="btn" id="btn-title">${tTitle}</button>
          `;
          const app = document.getElementById('app');
          const runSync = () => {
            const oc = content;
            const deco = oc.querySelector('.result-deco');
            const score = oc.querySelector('.result-score');
            const meta = oc.querySelector('.result-meta');
            const brand = oc.querySelector(':scope > .brand-mark');
            const h2 = oc.querySelector(':scope > h2');
            const retry = oc.querySelector('#btn-retry');
            const titleBtn = oc.querySelector('#btn-title');
            if (!app || !score || !meta || !retry) return { steps: -1, over: 0 };
            oc.style.maxHeight = '';
            oc.style.paddingTop = '';
            oc.style.paddingBottom = '';
            if (deco) deco.style.display = '';
            if (brand) brand.style.marginBottom = '';
            if (h2) h2.style.marginBottom = '';
            if (score) {
              score.style.marginTop = '';
              score.style.marginBottom = '';
              score.style.gap = '';
            }
            if (meta) {
              meta.style.marginBottom = '';
              meta.style.gap = '';
            }
            for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '';
              cell.style.border = '';
              cell.style.backgroundImage = '';
              cell.style.boxShadow = '';
              cell.style.clipPath = '';
            }
            if (retry) retry.style.padding = '';
            if (titleBtn) titleBtn.style.padding = '';
            const panelOver = () => {
              void oc.offsetHeight;
              const appR = app.getBoundingClientRect();
              const ocR = oc.getBoundingClientRect();
              return Math.max(
                0,
                ocR.bottom - (appR.bottom + 1),
                (appR.top - 1) - ocR.top,
              );
            };
            let over = panelOver();
            let steps = 0;
            if (over <= 1.5) return { steps, over };
            if (deco) deco.style.display = 'none';
            steps = 1; over = panelOver();
            if (over <= 1.5) return { steps, over };
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
            steps = 2; over = panelOver();
            if (over <= 1.5) return { steps, over };
            for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '2px 4px';
              cell.style.border = 'none';
              cell.style.backgroundImage = 'none';
              cell.style.boxShadow = 'none';
              cell.style.clipPath = 'none';
            }
            steps = 3; over = panelOver();
            if (over <= 1.5) return { steps, over };
            oc.style.paddingTop = '18px';
            oc.style.paddingBottom = '12px';
            steps = 4; over = panelOver();
            if (over <= 1.5) return { steps, over };
            if (retry) retry.style.padding = '8px 20px';
            if (titleBtn) titleBtn.style.padding = '8px 20px';
            steps = 5; over = panelOver();
            if (over <= 1.5) return { steps, over };
            const appH = app.clientHeight || window.innerHeight || 360;
            oc.style.maxHeight = `${Math.max(260, Math.floor(appH * 0.96))}px`;
            return { steps: 6, over: panelOver() };
          };
          const sync = runSync();
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const brand = content.querySelector(':scope > .brand-mark');
          const retry = document.getElementById('btn-retry');
          const titleBtn = document.getElementById('btn-title');
          const cells = [...content.querySelectorAll('.result-score .cell, .result-meta .cell')];
          const cellClip = cells.some(
            (c) => c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2,
          );
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            syncSteps: sync?.steps ?? -1,
            syncOver: +(sync?.over ?? 0).toFixed(2),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            h2H: content.querySelector('h2')?.getBoundingClientRect().height.toFixed(1),
            cellClip,
            retryOut: retry ? boxOut(retry, appR) : true,
            titleOut: titleBtn ? boxOut(titleBtn, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            retryText: tRetry,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'result', loc, w: size.width, h: size.height, ...result });

        // ASSET ERROR long message
        const asset = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tRetry = 'Retry';
          let tSelect = 'To select';
          let tH2 = 'Stage 3 assets failed to load';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tRetry = mod.t('btn.retry') || tRetry;
              tSelect = mod.t('btn.toSelect') || tSelect;
              tH2 = mod.t('err.stageLoad', { n: 3 }) || tH2;
            }
          } catch { /* */ }
          const msg =
            'Failed to decode texture atlas stage03_fx_pack_v2.webp (HTTP 404) — missing character portraits / effect packs / bullet sheets for orbital spire';
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-asset-error';
          content.style.cssText = '';
          content.innerHTML = `
            <span class="brand-mark">ASSET ERROR</span>
            <span class="asset-error-icon" aria-hidden="true"></span>
            <h2>${tH2}</h2>
            <div class="asset-error-msg"><p>${msg}</p></div>
            <span class="asset-error-deco" aria-hidden="true"></span>
            <button class="btn btn-primary" id="btn-asset-retry">${tRetry}</button>
            <button class="btn" id="btn-asset-select">${tSelect}</button>
          `;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const retry = document.getElementById('btn-asset-retry');
          const sel = document.getElementById('btn-asset-select');
          const msgEl = content.querySelector('.asset-error-msg p');
          const brand = content.querySelector('.brand-mark');
          const icon = content.querySelector('.asset-error-icon');
          const deco = content.querySelector('.asset-error-deco');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            iconDisplay: icon ? getComputedStyle(icon).display : 'none',
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            msgClip: msgEl
              ? msgEl.scrollHeight > msgEl.clientHeight + 2 ||
                msgEl.scrollWidth > msgEl.clientWidth + 2
              : false,
            msgOut: msgEl ? boxOut(msgEl, appR) : true,
            retryOut: retry ? boxOut(retry, appR) : true,
            selectOut: sel ? boxOut(sel, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            h2H: content.querySelector('h2')?.getBoundingClientRect().height.toFixed(1),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'asset', loc, w: size.width, h: size.height, ...asset });
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
  if (f.screen === 'pause') {
    return (
      f.panelOver > 1.5 ||
      f.quitOut ||
      f.resumeOut ||
      f.muteOut ||
      f.btnClip ||
      (f.syncSteps >= 6 && f.headroom < 0)
    );
  }
  if (f.screen === 'result') {
    return (
      f.panelOver > 1.5 ||
      f.retryOut ||
      f.titleOut ||
      f.cellClip ||
      (f.syncSteps >= 6 && f.syncOver > 1.5)
    );
  }
  if (f.screen === 'asset') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.retryOut ||
      f.selectOut ||
      f.msgOut
    );
  }
  return false;
});

const soft = findings.filter((f) => {
  if (muddy.includes(f)) return false;
  if (f.screen === 'result' && f.h <= 360 && f.syncSteps >= 3) return true;
  if (f.screen === 'result' && f.h <= 320 && f.brandDisplay !== 'none' && f.headroom < 8) return true;
  if (f.screen === 'pause' && f.h <= 320 && f.syncSteps >= 4) return true;
  if (f.screen === 'asset' && f.h <= 360 && f.msgClip) return true;
  if (f.screen === 'asset' && f.h <= 360 && f.brandDisplay !== 'none' && f.headroom < 6) return true;
  if (f.screen === 'asset' && f.h <= 360 && f.panelOver > -4) return true;
  return false;
});

const out = { muddyCount: muddy.length, softCount: soft.length, muddy, soft, findings };
writeFileSync(join(root, 'tools', 'probe-tick139-thin-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      soft: out.soft.slice(0, 40),
      samples: {
        pause320: findings.filter((f) => f.screen === 'pause' && f.h === 320),
        result320: findings.filter((f) => f.screen === 'result' && f.h === 320),
        asset320: findings.filter((f) => f.screen === 'asset' && f.h === 320),
        asset360: findings.filter((f) => f.screen === 'asset' && f.h === 360 && (f.loc === 'es' || f.loc === 'ja' || f.loc === 'ru')),
        result360ja: findings.filter((f) => f.screen === 'result' && f.h === 360 && (f.loc === 'ja' || f.loc === 'zh-TW' || f.loc === 'es')),
      },
    },
    null,
    2,
  ),
);
