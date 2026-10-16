/**
 * Tick138 candidates: thin-viewport residual after tick137 tutorial floor.
 * Prefer live panelOver / CTA OOB / clip / soft floors at short heights.
 * Covers pause/result extreme-short (not only @800), loading, title, select.
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

        await page.goto(`${url}?cb=r138-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(50);

        // ---- TITLE ----
        const title = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.keys-grid');
          const rules = oc.querySelector('.keys-rules');
          const hi = oc.querySelector('.keys-hiscore');
          const start = document.getElementById('btn-start');
          const brand = oc.querySelector('.brand-mark');
          const gR = grid?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            rulesDisplay: rules ? getComputedStyle(rules).display : 'none',
            hiInside: hi ? !boxOut(hi, ocR) : false,
            startOut: start ? boxOut(start, appR) : true,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'title', loc, w: size.width, h: size.height, ...title });

        // ---- LOADING stress ----
        const loading = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const stressMap = {
            ko: '스테이지 자원을 불러오는 중… 거의 완료 (98%) — 캐릭터 초상화와 이펙트 팩',
            en: 'Loading stage assets… nearly done (98%) — character portraits and effect packs',
            pt: 'Carregando recursos do estágio… quase pronto (98%) — retratos e pacotes de efeitos',
            es: 'Cargando recursos de etapa… casi listo (98%) — retratos y paquetes de efectos',
            ru: 'Загрузка ресурсов этапа… почти готово (98%) — портреты и пакеты эффектов',
          };
          const content = document.getElementById('overlay-content');
          const overlay = document.getElementById('overlay');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-loading';
          content.style.cssText = '';
          content.innerHTML = `
            <span class="brand-mark" aria-hidden="true"></span>
            <h2>LOADING</h2>
            <span class="loading-deco" aria-hidden="true"></span>
            <p id="loading-label">${stressMap[loc] || stressMap.en}</p>
            <div class="load-track"><div class="load-fill" style="width:72%"></div></div>
            <div class="load-meta"><span id="load-pct">72%</span></div>
          `;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const lab = document.getElementById('loading-label');
          const deco = content.querySelector('.loading-deco');
          const brand = content.querySelector('.brand-mark');
          const h2 = content.querySelector('h2');
          const meta = content.querySelector('.load-meta');
          const labR = lab?.getBoundingClientRect();
          const lh = lab ? parseFloat(getComputedStyle(lab).lineHeight) || 16 : 16;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            decoH: deco ? +deco.getBoundingClientRect().height.toFixed(1) : 0,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            labelH: labR ? +labR.height.toFixed(1) : 0,
            labelLines: labR ? Math.round(labR.height / lh) : 0,
            labelClipY: lab ? lab.scrollHeight > lab.clientHeight + 2 : false,
            labelClipX: lab ? lab.scrollWidth > lab.clientWidth + 2 : false,
            labelOut: lab ? boxOut(lab, appR) : true,
            metaOut: meta ? boxOut(meta, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'loading', loc, w: size.width, h: size.height, ...loading });

        // ---- PAUSE (unmute stress + reclaim ladder mirror) ----
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
            if (!app || !actions) return;
            oc.style.maxHeight = '';
            oc.style.paddingTop = '';
            oc.style.paddingBottom = '';
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
            if (over <= 1.5) return { steps: 0, over };
            if (deco) deco.style.display = 'none';
            over = panelOver();
            if (over <= 1.5) return { steps: 1, over };
            if (blurb) {
              blurb.style.border = 'none';
              blurb.style.backgroundImage = 'none';
              blurb.style.padding = '0';
              blurb.style.clipPath = 'none';
              blurb.style.marginTop = '2px';
            }
            over = panelOver();
            if (over <= 1.5) return { steps: 2, over };
            actions.style.padding = '6px';
            over = panelOver();
            if (over <= 1.5) return { steps: 3, over };
            oc.style.paddingTop = '22px';
            oc.style.paddingBottom = '16px';
            over = panelOver();
            if (over <= 1.5) return { steps: 4, over };
            const appH = app.clientHeight || window.innerHeight || 450;
            oc.style.maxHeight = `${Math.max(280, Math.floor(appH * 0.96))}px`;
            return { steps: 5, over: panelOver() };
          };
          const sync = runSync();
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const brand = content.querySelector('.brand-mark');
          const h2 = content.querySelector('h2');
          const blurb = content.querySelector('.pause-blurb');
          const actions = content.querySelector('.pause-actions');
          const quit = document.getElementById('btn-quit');
          const resume = document.getElementById('btn-resume');
          const mute = document.getElementById('btn-pause-mute');
          const bR = blurb?.getBoundingClientRect();
          const btns = [...(actions?.querySelectorAll('button') || [])];
          const btnClip = btns.some(
            (b) => b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2,
          );
          const btnWrap = actions
            ? actions.scrollHeight > actions.clientHeight + 4
            : false;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            syncSteps: sync?.steps ?? -1,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            blurbH: bR ? +bR.height.toFixed(1) : 0,
            blurbClip: blurb
              ? blurb.scrollHeight > blurb.clientHeight + 2 ||
                blurb.scrollWidth > blurb.clientWidth + 2
              : false,
            blurbOut: blurb ? boxOut(blurb, ocR) : true,
            quitOut: quit ? boxOut(quit, appR) : true,
            resumeOut: resume ? boxOut(resume, appR) : true,
            muteOut: mute ? boxOut(mute, appR) : true,
            btnClip,
            btnWrap,
            actionsH: actions ? +actions.getBoundingClientRect().height.toFixed(1) : 0,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            maxH: getComputedStyle(content).maxHeight,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'pause', loc, w: size.width, h: size.height, ...pause });

        // ---- RESULT (long locale labels + reclaim ladder mirror) ----
        const result = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tRetry = 'Retry';
          let tTitle = 'To title';
          let tScore = 'SCORE';
          let tHi = 'HI-SCORE';
          let tStage = 'STAGE';
          let tTime = 'TIME';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tRetry = mod.t('btn.retry') || tRetry;
              tTitle = mod.t('btn.toTitle') || tTitle;
              tScore = mod.t('result.score') || tScore;
              tHi = mod.t('result.hi') || tHi;
              tStage = mod.t('result.stage') || tStage;
              tTime = mod.t('result.time') || tTime;
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-result';
          content.style.cssText = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">MISSION COMPLETE</span>
            <h2>STAGE CLEAR</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="k">${tScore}</span><span class="v">12,345,678</span></div>
              <div class="cell"><span class="k">${tHi}</span><span class="v">98,765,432</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="k">${tStage}</span><span class="v">3</span></div>
              <div class="cell"><span class="k">${tTime}</span><span class="v">12:34</span></div>
            </div>
            <div class="result-actions">
              <button class="btn btn-primary btn-cta" id="btn-retry">${tRetry}</button>
              <button class="btn btn-ghost" id="btn-title">${tTitle}</button>
            </div>
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
            if (!app || !score || !meta || !retry) return;
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
            if (over <= 1.5) return { steps: 0, over };
            if (deco) deco.style.display = 'none';
            over = panelOver();
            if (over <= 1.5) return { steps: 1, over };
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
            if (over <= 1.5) return { steps: 2, over };
            for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
              cell.style.padding = '2px 4px';
              cell.style.border = 'none';
              cell.style.backgroundImage = 'none';
              cell.style.boxShadow = 'none';
              cell.style.clipPath = 'none';
            }
            over = panelOver();
            if (over <= 1.5) return { steps: 3, over };
            oc.style.paddingTop = '18px';
            oc.style.paddingBottom = '12px';
            over = panelOver();
            if (over <= 1.5) return { steps: 4, over };
            if (retry) retry.style.padding = '8px 20px';
            if (titleBtn) titleBtn.style.padding = '8px 20px';
            over = panelOver();
            if (over <= 1.5) return { steps: 5, over };
            const appH = app.clientHeight || window.innerHeight || 360;
            oc.style.maxHeight = `${Math.max(260, Math.floor(appH * 0.96))}px`;
            return { steps: 6, over: panelOver() };
          };
          const sync = runSync();
          void content.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const brand = content.querySelector(':scope > .brand-mark');
          const h2 = content.querySelector(':scope > h2');
          const score = content.querySelector('.result-score');
          const meta = content.querySelector('.result-meta');
          const retry = document.getElementById('btn-retry');
          const titleBtn = document.getElementById('btn-title');
          const cells = [...content.querySelectorAll('.result-score .cell, .result-meta .cell')];
          const cellClip = cells.some(
            (c) => c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2,
          );
          const vals = [...content.querySelectorAll('.result-score .v, .result-meta .v')];
          const valClip = vals.some(
            (v) => v.scrollWidth > v.clientWidth + 2 || v.scrollHeight > v.clientHeight + 2,
          );
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            syncSteps: sync?.steps ?? -1,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            scoreH: score ? +score.getBoundingClientRect().height.toFixed(1) : 0,
            metaH: meta ? +meta.getBoundingClientRect().height.toFixed(1) : 0,
            cellClip,
            valClip,
            retryOut: retry ? boxOut(retry, appR) : true,
            titleOut: titleBtn ? boxOut(titleBtn, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            maxH: getComputedStyle(content).maxHeight,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'result', loc, w: size.width, h: size.height, ...result });

        // ---- SELECT long-kit ----
        await page.goto(`${url}?cb=r138s-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForTimeout(240);
        await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.char-card, [data-char]')];
          const prefer = cards.find((c) =>
            /eternity|labiata|emily|merlin/i.test(c.dataset?.char || c.id || c.className),
          );
          (prefer || cards[cards.length - 1])?.click();
        });
        await page.waitForTimeout(100);
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
          const kit = oc.querySelector('.select-dossier-kit');
          const hint = oc.querySelector('.select-dossier-hint');
          const name = oc.querySelector('.select-dossier-name');
          const blurb = oc.querySelector('.select-dossier-blurb, .select-blurb');
          const cta =
            document.getElementById('btn-sortie') ||
            document.getElementById('btn-confirm') ||
            oc.querySelector('.select-actions .btn');
          const brand = oc.querySelector('.brand-mark, .opt-head .brand-mark');
          const gR = grid?.getBoundingClientRect();
          const kR = kit?.getBoundingClientRect();
          const kitCs = kit ? getComputedStyle(kit) : null;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            kitH: kR ? +kR.height.toFixed(1) : 0,
            kitClip: kit ? kit.scrollHeight > kit.clientHeight + 2 : false,
            kitWrapX: kit ? kit.scrollWidth > kit.clientWidth + 2 : false,
            kitLines: kit && kitCs
              ? Math.round((kR.height || 0) / (parseFloat(kitCs.lineHeight) || 14))
              : 0,
            nameClip: name ? name.scrollWidth > name.clientWidth + 2 : false,
            blurbClip: blurb
              ? blurb.scrollHeight > blurb.clientHeight + 2 ||
                blurb.scrollWidth > blurb.clientWidth + 2
              : false,
            hintDisplay: hint ? getComputedStyle(hint).display : 'none',
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            ctaOut: cta ? boxOut(cta, appR) : true,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...select });
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
  if (f.skipped) return false;
  if (f.screen === 'title') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.startOut ||
      !f.hiInside ||
      (f.h <= 400 && f.gridH > 0 && f.gridH < 36) ||
      (f.h <= 400 && f.rulesDisplay === 'none')
    );
  }
  if (f.screen === 'loading') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.labelOut ||
      f.metaOut ||
      f.labelClipY ||
      f.labelClipX
    );
  }
  if (f.screen === 'pause') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.quitOut ||
      f.resumeOut ||
      f.muteOut ||
      f.blurbClip ||
      f.blurbOut ||
      f.btnClip
    );
  }
  if (f.screen === 'result') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.retryOut ||
      f.titleOut ||
      f.cellClip ||
      f.valClip
    );
  }
  if (f.screen === 'select') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.ctaOut ||
      (f.gridH > 0 && f.gridH < 36) ||
      f.kitClip ||
      f.kitWrapX ||
      f.nameClip ||
      f.blurbClip
    );
  }
  return false;
});

const soft = findings.filter((f) => {
  if (muddy.includes(f) || f.skipped) return false;
  if (f.screen === 'loading') {
    if (f.h <= 480 && f.decoDisplay !== 'none' && f.headroom > 40) return true;
    if (f.labelLines >= 3 && f.headroom > 30) return true;
    if (f.h <= 400 && f.brandDisplay !== 'none' && f.headroom > 24) return true;
  }
  if (f.screen === 'title') {
    if (f.brandDisplay === 'none' && f.h >= 450 && f.headroom > 40) return true;
  }
  if (f.screen === 'pause') {
    if (f.h <= 400 && f.brandDisplay !== 'none' && f.headroom < 8 && f.syncSteps >= 2) return true;
    if (f.h <= 400 && f.blurbH > 0 && f.blurbH < 14) return true;
    if (f.h <= 400 && f.syncSteps >= 4) return true;
  }
  if (f.screen === 'result') {
    if (f.h <= 400 && f.brandDisplay !== 'none' && f.scoreH < 48) return true;
    if (f.h <= 400 && f.syncSteps >= 4) return true;
    if (f.h <= 400 && f.headroom < 4 && f.brandH >= 20) return true;
  }
  if (f.screen === 'select') {
    if (f.h <= 400 && f.kitH > 0 && f.kitH < 28) return true;
    if (f.h <= 400 && f.hintDisplay === 'none') return true;
    if (f.h <= 400 && f.kitLines >= 3) return true;
  }
  return false;
});

const out = {
  muddyCount: muddy.length,
  softCount: soft.length,
  muddy,
  soft,
  byScreen: {
    title: findings.filter((f) => f.screen === 'title'),
    loading: findings.filter((f) => f.screen === 'loading'),
    pause: findings.filter((f) => f.screen === 'pause'),
    result: findings.filter((f) => f.screen === 'result'),
    select: findings.filter((f) => f.screen === 'select'),
  },
};

const outPath = join(root, 'tools', 'probe-tick138-candidates-out.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      soft: out.soft.slice(0, 60),
      samples: {
        pause360: out.byScreen.pause.filter((r) => r.h === 360),
        result360: out.byScreen.result.filter((r) => r.h === 360),
        load360: out.byScreen.loading.filter((r) => r.h === 360 || r.h === 450),
        title360: out.byScreen.title.filter((r) => r.h === 360 || r.h === 450),
        sel360: out.byScreen.select.filter((r) => r.h === 360),
      },
    },
    null,
    2,
  ),
);
