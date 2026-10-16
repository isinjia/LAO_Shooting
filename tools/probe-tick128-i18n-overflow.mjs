/**
 * Tick128 live probe: pause/result recheck + loading / rotate / asset-error
 * / select@800 thin grid / OPTIONS nested scroll discoverability.
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
  { width: 1280, height: 720 },
  { width: 960, height: 540 },
  { width: 800, height: 450 },
];
const PORTRAIT_SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];

const STAGE_LONG = {
  ko: '최종 국면 · 심층 요새',
  en: 'FINAL PHASE · DEEP CITADEL ASSAULT',
  pt: 'FASE FINAL · ASSALTO À CITADELA PROFUNDA',
  es: 'FASE FINAL · ASALTO A LA CIUDADELA PROFUNDA',
  ru: 'ФИНАЛЬНАЯ ФАЗА · ШТУРМ ГЛУБИННОЙ ЦИТАДЕЛИ',
};
const PILOT_LONG = {
  ko: '콘스탄티아 윈체스터',
  en: 'Constantia Winchester',
  pt: 'Constantia Winchester',
  es: 'Constantia Winchester',
  ru: 'Константия Винчестер',
};
const ASSET_ERR_LONG = {
  ko: '필수 텍스처 번들 로드 실패: stage05_deep_citadel_bg_layer_atlas.webp (HTTP 404)',
  en: 'Required texture bundle failed: stage05_deep_citadel_bg_layer_atlas.webp (HTTP 404)',
  pt: 'Falha ao carregar o pacote de texturas: stage05_deep_citadel_bg_layer_atlas.webp (HTTP 404)',
  es: 'Fallo al cargar el paquete de texturas: stage05_deep_citadel_bg_layer_atlas.webp (HTTP 404)',
  ru: 'Не удалось загрузить пакет текстур: stage05_deep_citadel_bg_layer_atlas.webp (HTTP 404)',
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];
const summary = {
  pauseCtaOut: 0,
  pauseBtnOh: 0,
  pauseBlurbOh: 0,
  resultCtaOut: 0,
  resultMetaOh: 0,
  loadLabelOh: 0,
  loadPanelOut: 0,
  loadMetaOh: 0,
  assetCtaOut: 0,
  assetMsgOh: 0,
  assetH2Oh: 0,
  rotateCardOut: 0,
  rotateTextOh: 0,
  selectCtaOut: 0,
  selectGridThin: 0,
  optNestedScroll: 0,
  optBackOut: 0,
  runs: 0,
  errors: 0,
};

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      summary.runs += 1;
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

        await page.goto(`${url}?cb=${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        // ---- LOADING inject with longest eager label ----
        const loadSnap = await page.evaluate(
          async ({ boxOutSrc, loc }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            let label = 'Loading all assets (eager)…';
            try {
              const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
              if (mod?.setLocale) mod.setLocale(loc);
              if (mod?.t) label = mod.t('load.eager');
            } catch { /* keep */ }
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            if (!overlay || !content) return { error: 'no overlay' };
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
            const appR = app?.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const lab = document.getElementById('loading-label');
            const meta = document.querySelector('.load-meta');
            const labCs = lab ? getComputedStyle(lab) : null;
            return {
              panel: {
                sh: content.scrollHeight,
                ch: content.clientHeight,
                h: Math.round(ocR.height),
                overflowY: getComputedStyle(content).overflowY,
                maxH: getComputedStyle(content).maxHeight,
                outApp: !!(appR && (ocR.bottom > appR.bottom + 1.5 || ocR.top < appR.top - 1.5)),
              },
              label: lab
                ? {
                    text: (lab.textContent || '').trim(),
                    ohY: lab.scrollHeight > lab.clientHeight + 1,
                    ohX: lab.scrollWidth > lab.clientWidth + 1,
                    sh: lab.scrollHeight,
                    ch: lab.clientHeight,
                    sw: lab.scrollWidth,
                    cw: lab.clientWidth,
                    whiteSpace: labCs?.whiteSpace,
                    overflow: labCs?.overflow,
                    outApp: !!(appR && boxOut(lab, appR)),
                    outOc: boxOut(lab, ocR),
                  }
                : null,
              meta: meta
                ? {
                    ohY: meta.scrollHeight > meta.clientHeight + 1,
                    ohX: meta.scrollWidth > meta.clientWidth + 1,
                    outApp: !!(appR && boxOut(meta, appR)),
                    outOc: boxOut(meta, ocR),
                  }
                : null,
            };
          },
          { boxOutSrc: boxOut.toString(), loc },
        );

        if (loadSnap.panel?.outApp || loadSnap.label?.outApp || loadSnap.meta?.outApp) {
          summary.loadPanelOut += 1;
          findings.push({ screen: 'load-panel', loc, w: size.width, h: size.height, snap: loadSnap });
        }
        if (loadSnap.label?.ohY || loadSnap.label?.ohX) {
          summary.loadLabelOh += 1;
          findings.push({ screen: 'load-label', loc, w: size.width, h: size.height, label: loadSnap.label });
        }
        if (loadSnap.meta?.ohY || loadSnap.meta?.ohX) {
          summary.loadMetaOh += 1;
          findings.push({ screen: 'load-meta', loc, w: size.width, h: size.height, meta: loadSnap.meta });
        }
        if (
          !loadSnap.panel?.outApp &&
          !loadSnap.label?.ohY &&
          !loadSnap.label?.ohX &&
          !loadSnap.label?.outApp &&
          !loadSnap.meta?.ohY
        ) {
          findings.push({
            screen: 'load-ok',
            loc,
            w: size.width,
            h: size.height,
            panelH: loadSnap.panel?.h,
            label: loadSnap.label?.text,
            labelCw: loadSnap.label?.cw,
            labelSw: loadSnap.label?.sw,
          });
        }

        // ---- ASSET ERROR inject ----
        const errMsg = ASSET_ERR_LONG[loc] || ASSET_ERR_LONG.en;
        const assetSnap = await page.evaluate(
          async ({ boxOutSrc, loc, errMsg }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            let h2 = 'Stage 5 load failed';
            let retry = 'Retry';
            let toSelect = 'To select';
            try {
              const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
              if (mod?.setLocale) mod.setLocale(loc);
              if (mod?.t) {
                h2 = mod.t('err.stageLoad', { n: 5 });
                retry = mod.t('btn.retry');
                toSelect = mod.t('btn.toSelect');
              }
            } catch { /* keep */ }
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            if (!overlay || !content) return { error: 'no overlay' };
            overlay.classList.remove('hidden');
            content.className = 'screen-asset-error';
            content.style.maxHeight = '';
            content.innerHTML = `
              <span class="brand-mark">ASSET ERROR</span>
              <span class="asset-error-icon" aria-hidden="true"></span>
              <h2>${h2}</h2>
              <div class="asset-error-msg"><p>${errMsg}</p></div>
              <span class="asset-error-deco" aria-hidden="true"></span>
              <button class="btn btn-primary" id="btn-asset-retry">${retry}</button>
              <button class="btn" id="btn-asset-select">${toSelect}</button>
            `;
            const app = document.getElementById('app');
            const appR = app?.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const h2El = content.querySelector('h2');
            const msgP = content.querySelector('.asset-error-msg p');
            const retryBtn = document.getElementById('btn-asset-retry');
            const selectBtn = document.getElementById('btn-asset-select');
            const btns = [retryBtn, selectBtn].filter(Boolean).map((btn) => ({
              id: btn.id,
              text: (btn.textContent || '').trim(),
              ohX: btn.scrollWidth > btn.clientWidth + 1,
              ohY: btn.scrollHeight > btn.clientHeight + 1,
              outApp: !!(appR && boxOut(btn, appR)),
              outOc: boxOut(btn, ocR),
            }));
            return {
              panel: {
                sh: content.scrollHeight,
                ch: content.clientHeight,
                h: Math.round(ocR.height),
                overflowY: getComputedStyle(content).overflowY,
                maxH: getComputedStyle(content).maxHeight,
                outApp: !!(appR && (ocR.bottom > appR.bottom + 1.5 || ocR.top < appR.top - 1.5)),
              },
              h2: h2El
                ? {
                    text: (h2El.textContent || '').trim(),
                    ohY: h2El.scrollHeight > h2El.clientHeight + 1,
                    ohX: h2El.scrollWidth > h2El.clientWidth + 1,
                    sh: h2El.scrollHeight,
                    ch: h2El.clientHeight,
                    sw: h2El.scrollWidth,
                    cw: h2El.clientWidth,
                  }
                : null,
              msg: msgP
                ? {
                    text: (msgP.textContent || '').trim().slice(0, 80),
                    ohY: msgP.scrollHeight > msgP.clientHeight + 1,
                    ohX: msgP.scrollWidth > msgP.clientWidth + 1,
                    sh: msgP.scrollHeight,
                    ch: msgP.clientHeight,
                    sw: msgP.scrollWidth,
                    cw: msgP.clientWidth,
                    outApp: !!(appR && boxOut(msgP, appR)),
                    outOc: boxOut(msgP, ocR),
                  }
                : null,
              btns,
              ctaOut: btns.some((b) => b.outApp),
              btnOh: btns.filter((b) => b.ohX || b.ohY),
            };
          },
          { boxOutSrc: boxOut.toString(), loc, errMsg },
        );

        if (assetSnap.ctaOut || assetSnap.panel?.outApp) {
          summary.assetCtaOut += 1;
          findings.push({ screen: 'asset-cta', loc, w: size.width, h: size.height, snap: assetSnap });
        }
        if (assetSnap.h2?.ohY || assetSnap.h2?.ohX) {
          summary.assetH2Oh += 1;
          findings.push({ screen: 'asset-h2', loc, w: size.width, h: size.height, h2: assetSnap.h2 });
        }
        if (assetSnap.msg?.ohY || assetSnap.msg?.ohX || assetSnap.msg?.outApp) {
          summary.assetMsgOh += 1;
          findings.push({ screen: 'asset-msg', loc, w: size.width, h: size.height, msg: assetSnap.msg });
        }
        if (
          !assetSnap.ctaOut &&
          !assetSnap.panel?.outApp &&
          !assetSnap.h2?.ohY &&
          !assetSnap.h2?.ohX &&
          !assetSnap.msg?.ohY &&
          !assetSnap.msg?.ohX &&
          !assetSnap.btnOh?.length
        ) {
          findings.push({
            screen: 'asset-ok',
            loc,
            w: size.width,
            h: size.height,
            panelH: assetSnap.panel?.h,
            h2: assetSnap.h2?.text,
            msgSh: assetSnap.msg?.sh,
            msgCh: assetSnap.msg?.ch,
          });
        }

        // ---- RESULT inject ----
        const stageName = STAGE_LONG[loc] || STAGE_LONG.en;
        const pilotName = PILOT_LONG[loc] || PILOT_LONG.en;
        const resultSnap = await page.evaluate(
          ({ stageName, pilotName, boxOutSrc }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            overlay.classList.remove('hidden');
            content.className = 'screen-result cleared';
            content.style.maxHeight = '';
            content.innerHTML = `
              <div class="panel-frame" aria-hidden="true"></div>
              <span class="brand-mark">MISSION COMPLETE</span>
              <h2>ALL CLEAR</h2>
              <span class="result-deco" aria-hidden="true"></span>
              <div class="result-score">
                <div class="cell"><span class="lbl">SCORE</span><span class="val">00123456</span></div>
                <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">00999999</span></div>
                <div class="cell"><span class="lbl">GRAZE</span><span class="val">88</span></div>
              </div>
              <div class="result-meta">
                <div class="cell"><span class="lbl">STAGE</span><span class="val">ALL 5 · ${stageName}</span></div>
                <div class="cell"><span class="lbl">PILOT</span><span class="val">${pilotName}</span></div>
                <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">42</span></div>
                <div class="cell"><span class="lbl">NO MISS</span><span class="val">YES</span></div>
              </div>
              <button class="btn btn-primary" id="btn-retry">RETRY</button>
              <button class="btn" id="btn-title">TITLE</button>
            `;
            const app = document.getElementById('app');
            const appR = app?.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const retry = document.getElementById('btn-retry');
            const title = document.getElementById('btn-title');
            const cells = [...document.querySelectorAll('.result-meta .cell')].map((cell) => {
              const val = cell.querySelector('.val');
              return {
                text: (val?.textContent || '').trim(),
                ohY: !!(val && val.scrollHeight > val.clientHeight + 1),
                ohX: !!(val && val.scrollWidth > val.clientWidth + 1),
                cellOhY: cell.scrollHeight > cell.clientHeight + 1,
                cellOhX: cell.scrollWidth > cell.clientWidth + 1,
                sw: val?.scrollWidth,
                cw: val?.clientWidth,
              };
            });
            return {
              panel: {
                sh: content.scrollHeight,
                ch: content.clientHeight,
                h: Math.round(ocR.height),
                overflowY: getComputedStyle(content).overflowY,
                maxH: getComputedStyle(content).maxHeight,
                outApp: !!(appR && (ocR.bottom > appR.bottom + 1.5 || ocR.top < appR.top - 1.5)),
              },
              retryOut: !!(retry && appR && boxOut(retry, appR)),
              titleOut: !!(title && appR && boxOut(title, appR)),
              cells,
            };
          },
          { stageName, pilotName, boxOutSrc: boxOut.toString() },
        );
        const metaMuddy = (resultSnap.cells || []).filter(
          (c) => c.ohY || c.ohX || c.cellOhY || c.cellOhX,
        );
        if (metaMuddy.length) {
          summary.resultMetaOh += 1;
          findings.push({ screen: 'result-meta', loc, w: size.width, h: size.height, muddy: metaMuddy });
        }
        if (resultSnap.retryOut || resultSnap.titleOut || resultSnap.panel?.outApp) {
          summary.resultCtaOut += 1;
          findings.push({
            screen: 'result-cta',
            loc,
            w: size.width,
            h: size.height,
            retryOut: resultSnap.retryOut,
            titleOut: resultSnap.titleOut,
            panel: resultSnap.panel,
          });
        }
        if (!metaMuddy.length && !resultSnap.retryOut && !resultSnap.titleOut && !resultSnap.panel?.outApp) {
          findings.push({
            screen: 'result-ok',
            loc,
            w: size.width,
            h: size.height,
            panelH: resultSnap.panel?.h,
            stageSw: resultSnap.cells?.[0]?.sw,
            stageCw: resultSnap.cells?.[0]?.cw,
          });
        }

        // ---- PAUSE inject ----
        const pauseSnap = await page.evaluate(
          async ({ boxOutSrc, loc }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            let tPause = 'Operation on hold';
            let tResume = 'Resume';
            let tOpts = 'OPTIONS';
            let tMute = 'Mute';
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
            } catch { /* keep */ }
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
            const appR = app?.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const actions = document.querySelector('.pause-actions');
            const blurb = document.querySelector('.pause-blurb');
            const btns = [...document.querySelectorAll('.pause-actions .btn')].map((btn) => ({
              id: btn.id,
              text: (btn.textContent || '').trim(),
              ohX: btn.scrollWidth > btn.clientWidth + 1,
              ohY: btn.scrollHeight > btn.clientHeight + 1,
              outApp: !!(appR && boxOut(btn, appR)),
              outOc: boxOut(btn, ocR),
            }));
            return {
              panel: {
                sh: content.scrollHeight,
                ch: content.clientHeight,
                h: Math.round(ocR.height),
                overflowY: getComputedStyle(content).overflowY,
                maxH: getComputedStyle(content).maxHeight,
                outApp: !!(appR && (ocR.bottom > appR.bottom + 1.5 || ocR.top < appR.top - 1.5)),
              },
              actionsOut: !!(actions && appR && boxOut(actions, appR)),
              blurb: blurb
                ? {
                    text: (blurb.textContent || '').trim(),
                    ohY: blurb.scrollHeight > blurb.clientHeight + 1,
                    ohX: blurb.scrollWidth > blurb.clientWidth + 1,
                  }
                : null,
              btns,
              btnMuddy: btns.filter((b) => b.ohX || b.ohY || b.outApp),
            };
          },
          { boxOutSrc: boxOut.toString(), loc },
        );
        if (pauseSnap.actionsOut || pauseSnap.panel?.outApp || pauseSnap.btnMuddy?.some((b) => b.outApp)) {
          summary.pauseCtaOut += 1;
          findings.push({ screen: 'pause-cta', loc, w: size.width, h: size.height, snap: pauseSnap });
        }
        if (pauseSnap.blurb?.ohY || pauseSnap.blurb?.ohX) {
          summary.pauseBlurbOh += 1;
          findings.push({ screen: 'pause-blurb', loc, w: size.width, h: size.height, blurb: pauseSnap.blurb });
        }
        const pauseBtnOh = (pauseSnap.btnMuddy || []).filter((b) => b.ohX || b.ohY);
        if (pauseBtnOh.length) {
          summary.pauseBtnOh += 1;
          findings.push({ screen: 'pause-btn', loc, w: size.width, h: size.height, muddy: pauseBtnOh });
        }
        if (
          !pauseSnap.actionsOut &&
          !pauseSnap.panel?.outApp &&
          !pauseSnap.blurb?.ohY &&
          !pauseBtnOh.length
        ) {
          findings.push({
            screen: 'pause-ok',
            loc,
            w: size.width,
            h: size.height,
            panelH: pauseSnap.panel?.h,
            blurb: pauseSnap.blurb?.text,
          });
        }

        // hide overlay
        await page.evaluate(() => {
          document.getElementById('overlay')?.classList.add('hidden');
          const c = document.getElementById('overlay-content');
          if (c) c.style.maxHeight = '';
        });

        // ---- OPTIONS nested scroll + BACK (live showOptions) ----
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
        await page.waitForTimeout(100);
        const optSnap = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const back = document.getElementById('btn-opt-back');
          const scroll = document.querySelector('.opt-scroll');
          const keys = document.querySelector('.opt-keys');
          const appR = app?.getBoundingClientRect();
          const ocR = content?.getBoundingClientRect();
          const scrollCs = scroll ? getComputedStyle(scroll) : null;
          const keysCs = keys ? getComputedStyle(keys) : null;
          return {
            backOut: !!(back && appR && boxOut(back, appR)),
            backOcOut: !!(back && ocR && boxOut(back, ocR)),
            nested: !!(
              scroll &&
              keys &&
              scroll.scrollHeight > scroll.clientHeight + 2 &&
              keys.scrollHeight > keys.clientHeight + 2
            ),
            scroll: scroll
              ? {
                  sh: scroll.scrollHeight,
                  ch: scroll.clientHeight,
                  overflowY: scrollCs?.overflowY,
                }
              : null,
            keys: keys
              ? {
                  sh: keys.scrollHeight,
                  ch: keys.clientHeight,
                  maxH: keysCs?.maxHeight,
                  overflowY: keysCs?.overflowY,
                }
              : null,
            panelMaxH: content ? getComputedStyle(content).maxHeight : null,
          };
        }, boxOut.toString());
        if (optSnap.backOut || optSnap.backOcOut) {
          summary.optBackOut += 1;
          findings.push({ screen: 'opt-cta', loc, w: size.width, h: size.height, opt: optSnap });
        }
        if (optSnap.nested) {
          summary.optNestedScroll += 1;
          findings.push({
            screen: 'opt-nested',
            loc,
            w: size.width,
            h: size.height,
            scroll: optSnap.scroll,
            keys: optSnap.keys,
            panelMaxH: optSnap.panelMaxH,
          });
        } else {
          findings.push({
            screen: 'opt-scroll-ok',
            loc,
            w: size.width,
            h: size.height,
            nested: false,
            scroll: optSnap.scroll,
            keys: optSnap.keys,
          });
        }
        await page.click('#btn-opt-back');
        await page.waitForSelector('#btn-start', { timeout: 30000 });

        // ---- SELECT @800×450 thin grid (only on 800×450) ----
        if (size.width === 800 && size.height === 450) {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 60000 });
          await page.waitForTimeout(120);
          const selSnap = await page.evaluate((boxOutSrc) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            const app = document.getElementById('app');
            const content = document.getElementById('overlay-content');
            const go = document.getElementById('btn-go');
            const grid = document.querySelector('.char-grid');
            const appR = app?.getBoundingClientRect();
            const ocR = content?.getBoundingClientRect();
            const cards = [...document.querySelectorAll('.char-card')];
            const cardHs = cards.map((c) => Math.round(c.getBoundingClientRect().height));
            const minCard = cardHs.length ? Math.min(...cardHs) : 0;
            return {
              goOut: !!(go && appR && boxOut(go, appR)),
              goOcOut: !!(go && ocR && boxOut(go, ocR)),
              gridH: grid ? Math.round(grid.getBoundingClientRect().height) : 0,
              gridCh: grid?.clientHeight || 0,
              gridSh: grid?.scrollHeight || 0,
              minCard,
              cardHs,
              panelMaxH: content ? getComputedStyle(content).maxHeight : null,
            };
          }, boxOut.toString());
          if (selSnap.goOut || selSnap.goOcOut) {
            summary.selectCtaOut += 1;
            findings.push({ screen: 'select-cta', loc, w: size.width, h: size.height, sel: selSnap });
          }
          // "thin" = min visible card height under ~56px (half-row soft floor concern)
          if (selSnap.minCard > 0 && selSnap.minCard < 56) {
            summary.selectGridThin += 1;
            findings.push({
              screen: 'select-thin',
              loc,
              w: size.width,
              h: size.height,
              minCard: selSnap.minCard,
              gridH: selSnap.gridH,
              gridCh: selSnap.gridCh,
              gridSh: selSnap.gridSh,
              panelMaxH: selSnap.panelMaxH,
            });
          } else {
            findings.push({
              screen: 'select-ok',
              loc,
              w: size.width,
              h: size.height,
              minCard: selSnap.minCard,
              gridH: selSnap.gridH,
            });
          }
        }
      } catch (err) {
        summary.errors += 1;
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

  // ---- ROTATE portrait sizes × locales ----
  for (const size of PORTRAIT_SIZES) {
    for (const loc of LOCALES) {
      summary.runs += 1;
      const page = await browser.newPage({
        viewport: size,
        hasTouch: true,
        isMobile: true,
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
        }, { loc });
        await page.goto(`${url}?cb=rot-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });
        await page.waitForTimeout(200);
        // Force portrait hint on if detection hasn't fired yet
        const rotSnap = await page.evaluate(
          async ({ boxOutSrc, loc }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            const hint = document.getElementById('rotate-hint');
            if (!hint) return { error: 'no rotate-hint' };
            // Ensure i18n strings applied
            try {
              const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
              if (mod?.setLocale) mod.setLocale(loc);
              const strong = hint.querySelector('strong');
              const p = hint.querySelector('p');
              if (strong && mod?.t) strong.textContent = mod.t('rotate.title');
              if (p && mod?.t) p.innerHTML = mod.t('rotate.body');
            } catch { /* keep existing */ }
            hint.classList.add('is-on');
            const card = hint.querySelector('.rotate-card');
            const strong = hint.querySelector('strong');
            const p = hint.querySelector('p');
            const vr = { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
            const cardR = card?.getBoundingClientRect();
            return {
              on: hint.classList.contains('is-on'),
              cardOut: !!(card && boxOut(card, vr)),
              card: cardR
                ? {
                    top: Math.round(cardR.top),
                    bottom: Math.round(cardR.bottom),
                    h: Math.round(cardR.height),
                    w: Math.round(cardR.width),
                  }
                : null,
              strong: strong
                ? {
                    text: (strong.textContent || '').trim(),
                    ohY: strong.scrollHeight > strong.clientHeight + 1,
                    ohX: strong.scrollWidth > strong.clientWidth + 1,
                    sw: strong.scrollWidth,
                    cw: strong.clientWidth,
                  }
                : null,
              body: p
                ? {
                    text: (p.textContent || '').trim().slice(0, 90),
                    ohY: p.scrollHeight > p.clientHeight + 1,
                    ohX: p.scrollWidth > p.clientWidth + 1,
                    sh: p.scrollHeight,
                    ch: p.clientHeight,
                    sw: p.scrollWidth,
                    cw: p.clientWidth,
                  }
                : null,
              vh: innerHeight,
              vw: innerWidth,
            };
          },
          { boxOutSrc: boxOut.toString(), loc },
        );
        if (rotSnap.cardOut) {
          summary.rotateCardOut += 1;
          findings.push({ screen: 'rotate-card', loc, w: size.width, h: size.height, snap: rotSnap });
        }
        if (rotSnap.strong?.ohY || rotSnap.strong?.ohX || rotSnap.body?.ohY || rotSnap.body?.ohX) {
          summary.rotateTextOh += 1;
          findings.push({
            screen: 'rotate-text',
            loc,
            w: size.width,
            h: size.height,
            strong: rotSnap.strong,
            body: rotSnap.body,
          });
        }
        if (
          !rotSnap.cardOut &&
          !rotSnap.strong?.ohY &&
          !rotSnap.strong?.ohX &&
          !rotSnap.body?.ohY &&
          !rotSnap.body?.ohX
        ) {
          findings.push({
            screen: 'rotate-ok',
            loc,
            w: size.width,
            h: size.height,
            cardH: rotSnap.card?.h,
            title: rotSnap.strong?.text,
          });
        }
      } catch (err) {
        summary.errors += 1;
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

const muddy = findings.filter((f) =>
  [
    'pause-cta',
    'pause-btn',
    'pause-blurb',
    'result-meta',
    'result-cta',
    'load-panel',
    'load-label',
    'load-meta',
    'asset-cta',
    'asset-h2',
    'asset-msg',
    'rotate-card',
    'rotate-text',
    'select-cta',
    'select-thin',
    'opt-cta',
    'opt-nested',
    'error',
  ].includes(f.screen),
);

console.log(
  JSON.stringify(
    {
      summary,
      muddyCount: muddy.length,
      muddy,
      sampleOk: findings.filter((f) => f.screen.endsWith('-ok')).slice(0, 24),
    },
    null,
    2,
  ),
);
