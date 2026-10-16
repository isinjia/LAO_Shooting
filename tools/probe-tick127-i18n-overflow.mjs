/**
 * Tick127 live probe: pause / result / OPTIONS i18n panel CTA overflow
 * on desktop non-touch (body overflow:hidden — no whole-panel scroll).
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

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];
const summary = {
  pauseCtaOut: 0,
  pauseBtnOh: 0,
  pauseBlurbOh: 0,
  optCtaOut: 0,
  optPadNoteOh: 0,
  optKeyLabelOh: 0,
  resultCtaOut: 0,
  resultMetaOh: 0,
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

        // ---- OPTIONS from title ----
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
        await page.waitForTimeout(80);

        const optSnap = await page.evaluate((boxOutSrc) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const content = document.getElementById('overlay-content');
          const back = document.getElementById('btn-opt-back');
          const note = document.querySelector('.opt-mobile-note');
          const appR = app?.getBoundingClientRect();
          const ocR = content?.getBoundingClientRect();
          const keyRows = [...document.querySelectorAll('.opt-key-row')].map((row) => {
            const label = row.querySelector('.opt-key-label');
            const cs = label ? getComputedStyle(label) : null;
            return {
              text: (label?.textContent || '').trim(),
              sh: label?.scrollHeight,
              ch: label?.clientHeight,
              sw: label?.scrollWidth,
              cw: label?.clientWidth,
              ohY: !!(label && label.scrollHeight > label.clientHeight + 1),
              ohX: !!(label && label.scrollWidth > label.clientWidth + 1),
              whiteSpace: cs?.whiteSpace,
              overflow: cs?.overflow,
            };
          });
          const noteCs = note ? getComputedStyle(note) : null;
          return {
            panel: {
              sh: content?.scrollHeight,
              ch: content?.clientHeight,
              h: Math.round(ocR?.height || 0),
              top: Math.round(ocR?.top || 0),
              bottom: Math.round(ocR?.bottom || 0),
              overflowY: content ? getComputedStyle(content).overflowY : null,
              maxH: content ? getComputedStyle(content).maxHeight : null,
              display: content ? getComputedStyle(content).display : null,
            },
            appH: Math.round(appR?.height || 0),
            backOut: !!(back && appR && boxOut(back, appR)),
            backOcOut: !!(back && ocR && boxOut(back, ocR)),
            note: note
              ? {
                  text: (note.textContent || '').trim(),
                  sh: note.scrollHeight,
                  ch: note.clientHeight,
                  sw: note.scrollWidth,
                  cw: note.clientWidth,
                  ohY: note.scrollHeight > note.clientHeight + 1,
                  ohX: note.scrollWidth > note.clientWidth + 1,
                  whiteSpace: noteCs?.whiteSpace,
                  overflow: noteCs?.overflow,
                }
              : null,
            keyMuddy: keyRows.filter((k) => k.ohY || k.ohX),
            keySample: keyRows.slice(0, 3),
          };
        }, boxOut.toString());

        if (optSnap.backOut || optSnap.backOcOut) {
          summary.optCtaOut += 1;
          findings.push({
            screen: 'opt-cta',
            loc,
            w: size.width,
            h: size.height,
            backOut: optSnap.backOut,
            backOcOut: optSnap.backOcOut,
            panel: optSnap.panel,
            appH: optSnap.appH,
          });
        }
        if (optSnap.note?.ohY || optSnap.note?.ohX) {
          summary.optPadNoteOh += 1;
          findings.push({ screen: 'opt-padNote', loc, w: size.width, h: size.height, note: optSnap.note });
        }
        if (optSnap.keyMuddy?.length) {
          summary.optKeyLabelOh += 1;
          findings.push({
            screen: 'opt-key-label',
            loc,
            w: size.width,
            h: size.height,
            muddy: optSnap.keyMuddy,
          });
        }
        if (!optSnap.backOut && !optSnap.backOcOut && !optSnap.note?.ohY && !optSnap.keyMuddy?.length) {
          findings.push({
            screen: 'opt-ok',
            loc,
            w: size.width,
            h: size.height,
            panelH: optSnap.panel.h,
            panelSh: optSnap.panel.sh,
            maxH: optSnap.panel.maxH,
            overflowY: optSnap.panel.overflowY,
            noteLen: optSnap.note?.text?.length,
          });
        }

        await page.click('#btn-opt-back');
        await page.waitForSelector('#btn-start', { timeout: 30000 });

        // ---- RESULT inject ----
        const stageName = STAGE_LONG[loc] || STAGE_LONG.en;
        const pilotName = PILOT_LONG[loc] || PILOT_LONG.en;
        const resultSnap = await page.evaluate(
          ({ stageName, pilotName, boxOutSrc }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            if (!overlay || !content) return { error: 'no overlay' };
            overlay.classList.remove('hidden');
            content.className = 'screen-result cleared';
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
                sh: val?.scrollHeight,
                ch: val?.clientHeight,
              };
            });
            return {
              panel: {
                sh: content.scrollHeight,
                ch: content.clientHeight,
                h: Math.round(ocR.height),
                overflowY: getComputedStyle(content).overflowY,
                maxH: getComputedStyle(content).maxHeight,
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
          findings.push({
            screen: 'result-meta',
            loc,
            w: size.width,
            h: size.height,
            muddy: metaMuddy,
            panel: resultSnap.panel,
          });
        }
        if (resultSnap.retryOut || resultSnap.titleOut) {
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
        if (!metaMuddy.length && !resultSnap.retryOut && !resultSnap.titleOut) {
          findings.push({
            screen: 'result-ok',
            loc,
            w: size.width,
            h: size.height,
            panelH: resultSnap.panel?.h,
            maxH: resultSnap.panel?.maxH,
            stageSw: resultSnap.cells?.[0]?.sw,
            stageCw: resultSnap.cells?.[0]?.cw,
          });
        }

        // hide overlay before pause inject
        await page.evaluate(() => {
          document.getElementById('overlay')?.classList.add('hidden');
        });

        // ---- PAUSE inject (mirror showPauseMenu markup + live i18n via DOM text from options path) ----
        // Navigate back to title and use evaluate to build pause with document lang strings.
        // We inject strings from i18n by reading option labels already in memory via a small
        // dictionary passed from node.
        const pauseStrings = await page.evaluate(() => {
          // Pull from a temporary options open is heavy; instead read from a data store
          // if window exposes t — it may not. Return null and use injected dict from node.
          return typeof window.__laoT === 'function' ? null : null;
        });
        void pauseStrings;

        // Use showOptions→back then inject pause via evaluate with page-locale strings
        // from a second evaluate that loads i18n through the live settings lang.
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
                tMute = mod.t('btn.unmute'); // muted=true in init → unmute label path
                tTitle = mod.t('btn.toTitle');
              }
            } catch {
              /* keep defaults */
            }

            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            if (!overlay || !content) return { error: 'no overlay' };
            overlay.classList.remove('hidden');
            content.className = 'screen-pause';
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
            const btns = [...document.querySelectorAll('.pause-actions .btn')].map((btn) => {
              const spanW = btn.scrollWidth;
              const clientW = btn.clientWidth;
              return {
                id: btn.id,
                text: (btn.textContent || '').trim(),
                ohX: btn.scrollWidth > btn.clientWidth + 1,
                ohY: btn.scrollHeight > btn.clientHeight + 1,
                sw: spanW,
                cw: clientW,
                outApp: !!(appR && boxOut(btn, appR)),
                outOc: boxOut(btn, ocR),
              };
            });
            return {
              panel: {
                sh: content.scrollHeight,
                ch: content.clientHeight,
                h: Math.round(ocR.height),
                overflowY: getComputedStyle(content).overflowY,
                maxH: getComputedStyle(content).maxHeight,
              },
              appH: Math.round(appR?.height || 0),
              actionsOut: !!(actions && appR && boxOut(actions, appR)),
              actionsOcOut: !!(actions && boxOut(actions, ocR)),
              blurb: blurb
                ? {
                    text: (blurb.textContent || '').trim(),
                    ohY: blurb.scrollHeight > blurb.clientHeight + 1,
                    ohX: blurb.scrollWidth > blurb.clientWidth + 1,
                    sh: blurb.scrollHeight,
                    ch: blurb.clientHeight,
                  }
                : null,
              btns,
              btnMuddy: btns.filter((b) => b.ohX || b.ohY || b.outApp || b.outOc),
            };
          },
          { boxOutSrc: boxOut.toString(), loc },
        );

        if (pauseSnap.actionsOut || pauseSnap.actionsOcOut || pauseSnap.btnMuddy?.some((b) => b.outApp)) {
          summary.pauseCtaOut += 1;
          findings.push({
            screen: 'pause-cta',
            loc,
            w: size.width,
            h: size.height,
            actionsOut: pauseSnap.actionsOut,
            actionsOcOut: pauseSnap.actionsOcOut,
            panel: pauseSnap.panel,
            appH: pauseSnap.appH,
            btns: pauseSnap.btns,
          });
        }
        if (pauseSnap.blurb?.ohY || pauseSnap.blurb?.ohX) {
          summary.pauseBlurbOh += 1;
          findings.push({
            screen: 'pause-blurb',
            loc,
            w: size.width,
            h: size.height,
            blurb: pauseSnap.blurb,
          });
        }
        const pauseBtnOh = (pauseSnap.btnMuddy || []).filter((b) => b.ohX || b.ohY);
        if (pauseBtnOh.length) {
          summary.pauseBtnOh += 1;
          findings.push({
            screen: 'pause-btn',
            loc,
            w: size.width,
            h: size.height,
            muddy: pauseBtnOh,
          });
        }
        if (
          !pauseSnap.actionsOut &&
          !pauseSnap.actionsOcOut &&
          !pauseSnap.blurb?.ohY &&
          !pauseBtnOh.length &&
          !(pauseSnap.btnMuddy || []).some((b) => b.outApp)
        ) {
          findings.push({
            screen: 'pause-ok',
            loc,
            w: size.width,
            h: size.height,
            panelH: pauseSnap.panel?.h,
            maxH: pauseSnap.panel?.maxH,
            blurb: pauseSnap.blurb?.text,
            quit: pauseSnap.btns?.find((b) => b.id === 'btn-quit')?.text,
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
    'opt-cta',
    'opt-padNote',
    'opt-key-label',
    'result-meta',
    'result-cta',
    'error',
  ].includes(f.screen),
);

console.log(
  JSON.stringify(
    {
      summary,
      muddyCount: muddy.length,
      muddy,
      sampleOk: findings.filter((f) => f.screen.endsWith('-ok')).slice(0, 18),
    },
    null,
    2,
  ),
);
