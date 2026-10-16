/**
 * Tick126 live probe: select desktop CTA / result meta / OPTIONS padNote
 * / select dossier hint crush across long locales.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja', 'zh-TW', 'zh-CN'];
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
  ja: '最終局面 · 深層要塞強襲',
  'zh-TW': '最終階段 · 深層要塞突襲',
  'zh-CN': '最终阶段 · 深层要塞突袭',
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];
const summary = {
  selectCtaOut: 0,
  selectKitOh: 0,
  selectHintOh: 0,
  resultMetaOh: 0,
  resultCtaOut: 0,
  optPadNoteOh: 0,
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
          // Force desktop non-touch path (body.touch-ui off) so max-height:none
          // muddy matches real mouse play; Playwright Chromium can otherwise
          // report maxTouchPoints>0 and take the whole-panel scroll path.
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        }, { loc });

        await page.goto(`${url}?cb=${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        // ---- SELECT ----
        await page.click('#btn-start');
        await page.waitForSelector('#select-dossier-kit', { timeout: 180000 });
        const card = page.locator('.char-card[data-key="constantia"]');
        if (await card.count()) await card.click();
        else await page.locator('.char-card').first().click();
        await page.waitForTimeout(60);
        // longest kit: lrl / merlin / fafnir often long in en/es/ru
        for (const key of ['lrl', 'merlin', 'fafnir', 'constantia']) {
          const c = page.locator(`.char-card[data-key="${key}"]`);
          if (await c.count()) {
            await c.click();
            await page.waitForTimeout(40);
          }
        }

        const selectSnap = await page.evaluate((boxOutSrc) => {
          // eslint-disable-next-line no-new-func
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const actions = document.querySelector('.select-actions');
          const kit = document.getElementById('select-dossier-kit');
          const hint = document.querySelector('.select-dossier-hint');
          const dossier = document.querySelector('.select-dossier');
          const appR = app?.getBoundingClientRect();
          const ocR = oc?.getBoundingClientRect();
          const actR = actions?.getBoundingClientRect();
          const kitCs = kit ? getComputedStyle(kit) : null;
          const hintCs = hint ? getComputedStyle(hint) : null;
          return {
            actionsOut: !!(actions && appR && boxOut(actions, appR)),
            actionsOcOut: !!(actions && ocR && boxOut(actions, ocR)),
            panel: oc
              ? {
                  sh: oc.scrollHeight,
                  ch: oc.clientHeight,
                  h: Math.round(ocR?.height || 0),
                  overflowY: getComputedStyle(oc).overflowY,
                  maxH: getComputedStyle(oc).maxHeight,
                }
              : null,
            actBottom: actR ? Math.round(actR.bottom) : null,
            appBottom: appR ? Math.round(appR.bottom) : null,
            kit: kit
              ? {
                  text: (kit.textContent || '').trim(),
                  sh: kit.scrollHeight,
                  ch: kit.clientHeight,
                  sw: kit.scrollWidth,
                  cw: kit.clientWidth,
                  ohY: kit.scrollHeight > kit.clientHeight + 1,
                  ohX: kit.scrollWidth > kit.clientWidth + 1,
                  whiteSpace: kitCs.whiteSpace,
                  overflow: kitCs.overflow,
                }
              : null,
            hint: hint
              ? {
                  text: (hint.textContent || '').trim(),
                  sh: hint.scrollHeight,
                  ch: hint.clientHeight,
                  sw: hint.scrollWidth,
                  cw: hint.clientWidth,
                  ohY: hint.scrollHeight > hint.clientHeight + 1,
                  ohX: hint.scrollWidth > hint.clientWidth + 1,
                  whiteSpace: hintCs.whiteSpace,
                  overflow: hintCs.overflow,
                }
              : null,
            dossier: dossier
              ? {
                  sh: dossier.scrollHeight,
                  ch: dossier.clientHeight,
                  ohY: dossier.scrollHeight > dossier.clientHeight + 1,
                }
              : null,
          };
        }, boxOut.toString());

        if (selectSnap.actionsOut || selectSnap.actionsOcOut) {
          summary.selectCtaOut += 1;
          findings.push({ screen: 'select-cta', loc, w: size.width, h: size.height, ...selectSnap });
        }
        if (selectSnap.kit?.ohY || selectSnap.kit?.ohX || selectSnap.dossier?.ohY) {
          summary.selectKitOh += 1;
          findings.push({ screen: 'select-kit', loc, w: size.width, h: size.height, ...selectSnap });
        }
        if (selectSnap.hint?.ohY || selectSnap.hint?.ohX) {
          summary.selectHintOh += 1;
          findings.push({ screen: 'select-hint', loc, w: size.width, h: size.height, hint: selectSnap.hint });
        }
        if (
          !selectSnap.actionsOut &&
          !selectSnap.kit?.ohY &&
          !selectSnap.kit?.ohX &&
          !selectSnap.hint?.ohY &&
          !selectSnap.hint?.ohX
        ) {
          findings.push({
            screen: 'select-ok',
            loc,
            w: size.width,
            h: size.height,
            kitLen: selectSnap.kit?.text?.length,
            kitSh: selectSnap.kit?.sh,
            kitCh: selectSnap.kit?.ch,
            hintLen: selectSnap.hint?.text?.length,
            panelH: selectSnap.panel?.h,
            actBottom: selectSnap.actBottom,
            appBottom: selectSnap.appBottom,
          });
        }

        // ---- OPTIONS (padNote) via select options button ----
        const optBtn = page.locator('#btn-options-select');
        if (await optBtn.count()) {
          await optBtn.click();
          await page.waitForTimeout(80);
          const optSnap = await page.evaluate(() => {
            const note = document.querySelector('.opt-mobile-note');
            if (!note) return null;
            const cs = getComputedStyle(note);
            return {
              text: (note.textContent || '').trim().slice(0, 140),
              sh: note.scrollHeight,
              ch: note.clientHeight,
              sw: note.scrollWidth,
              cw: note.clientWidth,
              ohY: note.scrollHeight > note.clientHeight + 1,
              ohX: note.scrollWidth > note.clientWidth + 1,
              overflow: cs.overflow,
              display: cs.display,
              maxH: cs.maxHeight,
            };
          });
          if (optSnap?.ohY || optSnap?.ohX) {
            summary.optPadNoteOh += 1;
            findings.push({ screen: 'opt-padNote', loc, w: size.width, h: size.height, ...optSnap });
          } else if (optSnap) {
            findings.push({
              screen: 'opt-padNote-ok',
              loc,
              w: size.width,
              h: size.height,
              sh: optSnap.sh,
              ch: optSnap.ch,
              len: optSnap.text.length,
            });
          }
          // back to select
          const back = page.locator('#btn-opt-back, #btn-options-back, .opt-actions .btn').first();
          if (await back.count()) await back.click();
          await page.waitForSelector('#select-dossier-kit', { timeout: 30000 }).catch(() => {});
        }

        // ---- RESULT (inject endScreen markup via evaluate of live DOM builder) ----
        const stageName = STAGE_LONG[loc] || STAGE_LONG.en;
        const resultSnap = await page.evaluate(
          ({ stageName, boxOutSrc }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            // Call endScreen through the module isn't available; rebuild overlay like endScreen.
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
                <div class="cell"><span class="lbl">PILOT</span><span class="val">Constantia Winchester</span></div>
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
            const cells = [...document.querySelectorAll('.result-meta .cell')].map((cell) => {
              const val = cell.querySelector('.val');
              const lbl = cell.querySelector('.lbl');
              const cs = val ? getComputedStyle(val) : null;
              return {
                lbl: (lbl?.textContent || '').trim(),
                text: (val?.textContent || '').trim(),
                sh: val?.scrollHeight,
                ch: val?.clientHeight,
                sw: val?.scrollWidth,
                cw: val?.clientWidth,
                cellSh: cell.scrollHeight,
                cellCh: cell.clientHeight,
                cellSw: cell.scrollWidth,
                cellCw: cell.clientWidth,
                ohY: !!(val && val.scrollHeight > val.clientHeight + 1),
                ohX: !!(val && val.scrollWidth > val.clientWidth + 1),
                cellOhY: cell.scrollHeight > cell.clientHeight + 1,
                cellOhX: cell.scrollWidth > cell.clientWidth + 1,
                whiteSpace: cs?.whiteSpace,
                overflow: cs?.overflow,
                fontSize: cs?.fontSize,
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
              titleOut: (() => {
                const t = document.getElementById('btn-title');
                return !!(t && appR && boxOut(t, appR));
              })(),
              cells,
            };
          },
          { stageName, boxOutSrc: boxOut.toString() },
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
            stage: resultSnap.cells?.[0]?.text,
            pilot: resultSnap.cells?.[1]?.text,
            stageSw: resultSnap.cells?.[0]?.sw,
            stageCw: resultSnap.cells?.[0]?.cw,
            panelH: resultSnap.panel?.h,
          });
        }
      } catch (err) {
        summary.errors += 1;
        findings.push({
          screen: 'error',
          loc,
          w: size.width,
          h: size.height,
          text: String(err.message || err).slice(0, 180),
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
  ['select-cta', 'select-kit', 'select-hint', 'result-meta', 'result-cta', 'opt-padNote', 'error'].includes(
    f.screen,
  ),
);
console.log(
  JSON.stringify(
    {
      summary,
      muddyCount: muddy.length,
      muddy,
      sampleOk: findings.filter((f) => f.screen.endsWith('-ok')).slice(0, 12),
    },
    null,
    2,
  ),
);
