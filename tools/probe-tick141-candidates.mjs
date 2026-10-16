/**
 * Tick141 candidates: thin-viewport residual after tick140 pause soft-continue.
 * Prefer live panelOver / CTA OOB / clip at SE-class + short heights.
 * Axes: OPTIONS headroom soft, tutorial/select live, asset-error, title,
 * pause es/ru residual, result, loading.
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
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function bootPage(size, loc, tag) {
  const page = await browser.newPage({
    viewport: size,
    hasTouch: false,
    isMobile: false,
  });
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
  await page.goto(`${url}?cb=${tag}-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  await page.waitForTimeout(40);
  return page;
}

try {
  // ---- TITLE / ASSET / LOADING / PAUSE(live sync via showPause if possible) ----
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await bootPage(size, loc, 'r141');
      try {
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
          const rulesR = rules?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            rulesPeek: rulesR && gR ? +Math.max(0, gR.bottom - rulesR.top).toFixed(1) : 0,
            rulesDisplay: rules ? getComputedStyle(rules).display : 'none',
            hiInside: hi ? !boxOut(hi, ocR) : false,
            startOut: start ? boxOut(start, appR) : true,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'title', loc, w: size.width, h: size.height, ...title });

        // OPTIONS via live UI button
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((el) =>
            /option|옵션|opções|opciones|опци|オプション|選項|选项/i.test(el.textContent || ''),
          );
          b?.click();
        });
        await page.waitForTimeout(160);
        const options = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          if (!oc?.classList.contains('screen-options')) {
            return { skipped: true, cls: oc?.className || '' };
          }
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const scroll = oc.querySelector('.opt-scroll');
          const back =
            document.getElementById('btn-opt-back') ||
            document.getElementById('btn-back') ||
            oc.querySelector('.opt-actions .btn');
          const brand = oc.querySelector('.opt-head .brand-mark');
          const h2 = oc.querySelector('.opt-head h2');
          const sR = scroll?.getBoundingClientRect();
          const bgm = oc.querySelector('#opt-bgm')?.closest('label, .opt-row, .opt-slider, div');
          const padTop = parseFloat(getComputedStyle(oc).paddingTop) || 0;
          const padBot = parseFloat(getComputedStyle(oc).paddingBottom) || 0;
          const backR = back?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            scrollH: sR ? +sR.height.toFixed(1) : 0,
            backOut: back ? boxOut(back, appR) : true,
            backBottomGap: backR ? +(appR.bottom - backR.bottom).toFixed(1) : null,
            bgmInFirst: bgm && sR
              ? bgm.getBoundingClientRect().bottom <= sR.bottom + 2
              : false,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2Fs: h2 ? getComputedStyle(h2).fontSize : '',
            padTop: +padTop.toFixed(1),
            padBot: +padBot.toFixed(1),
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            isOptShort: oc.classList.contains('is-opt-short'),
            maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'options', loc, w: size.width, h: size.height, ...options });

        // Back
        await page.evaluate(() => {
          const b =
            document.getElementById('btn-opt-back') ||
            document.getElementById('btn-back') ||
            [...document.querySelectorAll('button')].find((el) =>
              /back|뒤로|voltar|atrás|назад|戻る|返回/i.test(el.textContent || ''),
            );
          b?.click();
        });
        await page.waitForTimeout(100);
      } finally {
        await page.close();
      }
    }
  }

  // ---- SELECT live (wait for screen-select past loading) ----
  for (const loc of ['ko', 'en', 'pt', 'es', 'ru', 'ja']) {
    for (const size of [
      { width: 568, height: 320 },
      { width: 640, height: 360 },
    ]) {
      const page = await bootPage(size, loc, 'r141sel');
      try {
        await page.click('#btn-start');
        // Wait through loading → select (progressive)
        try {
          await page.waitForFunction(
            () =>
              document.getElementById('overlay-content')?.classList.contains('screen-select'),
            { timeout: 45000 },
          );
        } catch {
          findings.push({
            screen: 'select',
            loc,
            w: size.width,
            h: size.height,
            skipped: true,
            cls: await page.evaluate(
              () => document.getElementById('overlay-content')?.className || '',
            ),
          });
          continue;
        }
        await page.waitForTimeout(80);
        const select = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.char-grid');
          const kit = oc.querySelector('.dossier-kit, .select-kit, .kit, .dossier-body');
          const hint = oc.querySelector('.select-hint, .dossier-hint, .hint-chip');
          const sortie =
            document.getElementById('btn-confirm') ||
            document.getElementById('btn-sortie') ||
            oc.querySelector('.select-actions .btn-primary, .select-actions .btn');
          const gR = grid?.getBoundingClientRect();
          const kitClip = kit
            ? kit.scrollHeight > kit.clientHeight + 2 || kit.scrollWidth > kit.clientWidth + 2
            : false;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            kitClip,
            hintDisplay: hint ? getComputedStyle(hint).display : 'n/a',
            sortieOut: sortie ? boxOut(sortie, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...select });
      } finally {
        await page.close();
      }
    }
  }

  // ---- TUTORIAL live HTML + mirror syncTutorialPanelBudget ----
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await bootPage(size, loc, 'r141tut');
      try {
        const tut = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let rows = [
            ['MOVE', 'Arrow / WASD'],
            ['FIRE', 'Z / J'],
            ['FOCUS', 'Shift'],
            ['BOMB', 'X / K'],
            ['SPECIAL', 'C / L'],
            ['PAUSE', 'Esc / P'],
          ];
          let note = 'Read controls before sortie.';
          let sortie = 'SORTIE';
          let h2 = 'SORTIE BRIEFING';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              note = mod.t('tut.note') || note;
              sortie = mod.t('btn.sortie') || sortie;
              h2 = mod.t('tut.h2') || h2;
              const labels = [
                ['tut.move', 'tut.moveKeys'],
                ['tut.fire', 'tut.fireKeys'],
                ['tut.focus', 'tut.focusKeys'],
                ['tut.bomb', 'tut.bombKeys'],
                ['tut.special', 'tut.specialKeys'],
                ['tut.pause', 'tut.pauseKeys'],
              ];
              const built = [];
              for (const [a, b] of labels) {
                const la = mod.t(a);
                const lb = mod.t(b);
                if (la && lb) built.push([la, lb]);
              }
              if (built.length) rows = built;
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-tutorial';
          content.style.cssText = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <div class="opt-head">
              <span class="brand-mark">SORTIE BRIEFING</span>
              <h2>${h2}</h2>
              <span class="tutorial-deco" aria-hidden="true"></span>
            </div>
            <div class="tutorial-grid">
              ${rows
                .map(
                  ([a, b]) =>
                    `<div class="tut-row"><span class="tut-pill">${a}</span><kbd>${b}</kbd></div>`,
                )
                .join('')}
            </div>
            <p class="tutorial-note">${note}</p>
            <div class="pause-actions">
              <button class="btn btn-primary btn-cta" id="btn-tut-go">${sortie}</button>
            </div>
          `;
          // Mirror syncTutorialPanelBudget (tick125/132/137)
          const oc = content;
          const grid = oc.querySelector('.tutorial-grid');
          const actions = oc.querySelector('.pause-actions');
          const noteEl = oc.querySelector('.tutorial-note');
          const head = oc.querySelector('.opt-head');
          const deco = oc.querySelector('.tutorial-deco');
          const brand = head?.querySelector('.brand-mark');
          const h2el = head?.querySelector('h2');
          const app = document.getElementById('app');
          const _blockBudgetH = (el) => {
            if (!el || getComputedStyle(el).display === 'none') return 0;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return (
              r.height +
              (parseFloat(cs.marginTop) || 0) +
              (parseFloat(cs.marginBottom) || 0)
            );
          };
          oc.style.maxHeight = '';
          grid.style.minHeight = '';
          oc.classList.remove('is-tut-short');
          if (brand) brand.style.display = '';
          if (h2el) {
            h2el.style.fontSize = '';
            h2el.style.margin = '';
            h2el.style.letterSpacing = '';
          }
          if (head) head.style.marginBottom = '';
          if (deco) deco.style.display = '';
          if (noteEl) {
            noteEl.style.display = '';
            noteEl.style.border = '';
            noteEl.style.backgroundImage = '';
            noteEl.style.padding = '';
            noteEl.style.clipPath = '';
            noteEl.style.boxShadow = '';
          }
          actions.style.padding = '';
          actions.style.border = '';
          actions.style.backgroundImage = '';
          actions.style.clipPath = '';
          const appH = app?.clientHeight || window.innerHeight || 540;
          let maxCap = Math.min(560, Math.max(300, Math.floor(appH * 0.92)));
          oc.style.maxHeight = `${maxCap}px`;
          if (appH <= 480 && deco) deco.style.display = 'none';
          const row = grid.querySelector('.tut-row');
          const rowH = row ? Math.max(28, _blockBudgetH(row)) : 40;
          const gap =
            parseFloat(getComputedStyle(grid).rowGap || getComputedStyle(grid).gap) || 8;
          const gridFloor = Math.ceil(rowH * 2 + gap);
          const softGridWant = 40;
          const csOc = getComputedStyle(oc);
          const padY =
            (parseFloat(csOc.paddingTop) || 0) + (parseFloat(csOc.paddingBottom) || 0);
          const pinnedH = () =>
            _blockBudgetH(head) + _blockBudgetH(noteEl) + _blockBudgetH(actions) + padY;
          let pinned = pinnedH();
          let avail = Math.floor(maxCap - pinned);
          let steps = 0;
          if (avail < gridFloor && noteEl) {
            noteEl.style.border = 'none';
            noteEl.style.backgroundImage = 'none';
            noteEl.style.padding = '0';
            noteEl.style.clipPath = 'none';
            noteEl.style.boxShadow = 'none';
            pinned = pinnedH();
            avail = Math.floor(maxCap - pinned);
            steps = 1;
          }
          if (avail < gridFloor) {
            actions.style.border = 'none';
            actions.style.backgroundImage = 'none';
            actions.style.padding = '4px 0';
            actions.style.clipPath = 'none';
            pinned = pinnedH();
            avail = Math.floor(maxCap - pinned);
            steps = 2;
          }
          if (avail < softGridWant && noteEl) {
            noteEl.style.display = 'none';
            pinned = pinnedH();
            avail = Math.floor(maxCap - pinned);
            steps = 3;
          }
          if (avail < gridFloor) {
            oc.classList.add('is-tut-short');
            if (brand) brand.style.display = 'none';
            if (h2el) {
              h2el.style.fontSize = '18px';
              h2el.style.margin = '0';
              h2el.style.letterSpacing = '0.12em';
            }
            if (head) head.style.marginBottom = '2px';
            pinned = pinnedH();
            avail = Math.floor(maxCap - pinned);
            steps = 4;
          }
          const gridBudget = Math.max(0, Math.min(gridFloor, avail));
          if (gridBudget >= softGridWant) grid.style.minHeight = `${gridBudget}px`;
          else if (avail >= softGridWant) grid.style.minHeight = `${softGridWant}px`;
          else grid.style.minHeight = `${Math.max(0, avail)}px`;
          const ctaOverflow = () => {
            void oc.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            const actR = actions.getBoundingClientRect();
            const overApp = Math.max(
              0,
              actR.bottom - (appR.bottom + 1),
              (appR.top - 1) - actR.top,
            );
            const overOc = Math.max(
              0,
              actR.bottom - (ocR.bottom + 1),
              (ocR.top - 1) - actR.top,
            );
            return Math.max(overApp, overOc);
          };
          for (let i = 0; i < 4; i += 1) {
            const over = ctaOverflow();
            if (over <= 0.5) break;
            const cur = parseFloat(grid.style.minHeight) || 0;
            if (cur > softGridWant) {
              grid.style.minHeight = `${Math.max(softGridWant, Math.floor(cur - over - 4))}px`;
              continue;
            }
            maxCap = Math.max(260, Math.floor(maxCap - over - 4));
            oc.style.maxHeight = `${maxCap}px`;
            pinned = pinnedH();
            avail = Math.floor(maxCap - pinned);
            if (avail > 0) {
              grid.style.minHeight = `${Math.min(
                gridFloor,
                Math.max(0, Math.min(softGridWant, avail)),
              )}px`;
            }
            steps = 5;
          }
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const gR = grid.getBoundingClientRect();
          const go = document.getElementById('btn-tut-go');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            gridH: +gR.height.toFixed(1),
            syncSteps: steps,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            noteDisplay: noteEl ? getComputedStyle(noteEl).display : 'none',
            sortieOut: go ? boxOut(go, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            isTutShort: oc.classList.contains('is-tut-short'),
            avail,
            softGridWant,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'tutorial', loc, w: size.width, h: size.height, ...tut });
      } finally {
        await page.close();
      }
    }
  }

  // ---- PAUSE live via showPauseMenu if available, else HTML+real soft ladder ----
  for (const loc of LOCALES) {
    const size = { width: 568, height: 320 };
    const page = await bootPage(size, loc, 'r141pause');
    try {
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
        const oc = content;
        const deco = oc.querySelector('.pause-deco');
        const blurb = oc.querySelector('.pause-blurb');
        const actions = oc.querySelector('.pause-actions');
        const brand = oc.querySelector('.pause-stamp .brand-mark');
        const h2 = oc.querySelector('.pause-stamp h2');
        oc.classList.remove('is-pause-short');
        oc.style.maxHeight = '';
        oc.style.paddingTop = '';
        oc.style.paddingBottom = '';
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
        const rawHeadroom = () => {
          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          return appR.bottom - ocR.bottom;
        };
        let over = panelOver();
        let steps = 0;
        const appH0 = app.clientHeight || window.innerHeight || 450;
        const soft = () => appH0 <= 340 && rawHeadroom() < 8;
        if (!(over <= 1.5 && !soft())) {
          if (deco) deco.style.display = 'none';
          steps = 1;
          over = panelOver();
          if (!(over <= 1.5 && !soft())) {
            if (blurb) {
              blurb.style.border = 'none';
              blurb.style.backgroundImage = 'none';
              blurb.style.padding = '0';
              blurb.style.clipPath = 'none';
              blurb.style.marginTop = '2px';
            }
            steps = 2;
            over = panelOver();
            if (!(over <= 1.5 && !soft())) {
              oc.classList.add('is-pause-short');
              if (brand) brand.style.display = 'none';
              if (h2) {
                h2.style.fontSize = '18px';
                h2.style.margin = '0';
                h2.style.letterSpacing = '0.12em';
              }
              steps = 3;
              over = panelOver();
              if (!(over <= 1.5 && !soft())) {
                actions.style.padding = '6px';
                steps = 4;
                over = panelOver();
                if (!(over <= 1.5 && !soft())) {
                  oc.style.paddingTop = '22px';
                  oc.style.paddingBottom = '16px';
                  steps = 5;
                  over = panelOver();
                  if (over > 1.5) {
                    oc.style.maxHeight = `${Math.max(280, Math.floor(appH0 * 0.96))}px`;
                    steps = 6;
                    over = panelOver();
                  }
                }
              }
            }
          }
        }
        void oc.offsetHeight;
        const appR = app.getBoundingClientRect();
        const ocR = oc.getBoundingClientRect();
        const quit = document.getElementById('btn-quit');
        const resume = document.getElementById('btn-resume');
        const mute = document.getElementById('btn-pause-mute');
        return {
          panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
          syncSteps: steps,
          syncOver: +over.toFixed(2),
          brandDisplay: brand ? getComputedStyle(brand).display : 'none',
          padTop: getComputedStyle(oc).paddingTop,
          quitOut: quit ? boxOut(quit, appR) : true,
          resumeOut: resume ? boxOut(resume, appR) : true,
          muteOut: mute ? boxOut(mute, appR) : true,
          headroom: +(appR.bottom - ocR.bottom).toFixed(1),
          isPauseShort: oc.classList.contains('is-pause-short'),
        };
      }, { loc, boxOutSrc: boxOut.toString() });
      findings.push({ screen: 'pause', loc, w: size.width, h: size.height, ...pause });
    } finally {
      await page.close();
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
      f.startOut ||
      !f.hiInside ||
      (f.h <= 400 && f.gridH > 0 && f.gridH < 36)
    );
  }
  if (f.screen === 'options') {
    return (
      f.panelOver > 1.5 ||
      f.backOut ||
      (f.h <= 400 && f.scrollH < 120) ||
      (f.h <= 340 && f.headroom < -1.5)
    );
  }
  if (f.screen === 'select') {
    return f.panelOver > 1.5 || f.sortieOut || f.kitClip || (f.h <= 400 && f.gridH < 36);
  }
  if (f.screen === 'tutorial') {
    return (
      f.panelOver > 1.5 ||
      f.sortieOut ||
      (f.h <= 400 && f.gridH < 36) ||
      (f.h <= 340 && f.headroom < 0)
    );
  }
  if (f.screen === 'pause') {
    return (
      f.panelOver > 1.5 ||
      f.quitOut ||
      f.resumeOut ||
      f.muteOut ||
      f.headroom < 0 ||
      (f.h <= 320 && ['ko', 'en', 'pt', 'zh-TW'].includes(f.loc) && f.syncSteps < 4)
    );
  }
  return false;
});

const soft = findings.filter((f) => {
  if (muddy.includes(f)) return false;
  if (f.screen === 'options' && f.h <= 320 && f.headroom < 2) return true;
  if (f.screen === 'options' && f.h <= 320 && f.backBottomGap != null && f.backBottomGap < 4)
    return true;
  if (f.screen === 'tutorial' && f.h <= 320 && (f.gridH < 48 || f.headroom < 4)) return true;
  if (f.screen === 'select' && f.h <= 320 && (f.gridH < 50 || f.headroom < 4)) return true;
  if (f.screen === 'pause' && f.h <= 320 && f.headroom < 4) return true;
  if (f.screen === 'title' && f.h <= 360 && f.brandDisplay === 'none' && f.headroom < 8)
    return true;
  return false;
});

const out = { muddyCount: muddy.length, softCount: soft.length, muddy, soft, findings };
writeFileSync(join(root, 'tools', 'probe-tick141-candidates-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      soft: out.soft.slice(0, 40),
      samples: {
        options320: findings.filter((f) => f.screen === 'options' && f.h === 320),
        tutorial320: findings.filter((f) => f.screen === 'tutorial' && f.h === 320),
        select320: findings.filter((f) => f.screen === 'select' && f.h === 320),
        pause320: findings.filter((f) => f.screen === 'pause' && f.h === 320),
        title320: findings.filter(
          (f) => f.screen === 'title' && f.h === 320 && ['es', 'ru', 'ko'].includes(f.loc),
        ),
      },
    },
    null,
    2,
  ),
);
