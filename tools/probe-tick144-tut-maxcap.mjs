/**
 * Tick144: tutorial CTA-health maxCap re-inflate after tick142 fitH floor.
 * Suspect: `maxCap = Math.max(260, …)` can raise maxH above fitH @ultra-short
 * and push CTA OOB (live @400×280).
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

function _blockBudgetH(el) {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return (
    r.height +
    (parseFloat(cs.marginTop) || 0) +
    (parseFloat(cs.marginBottom) || 0)
  );
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
  { width: 640, height: 360 },
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc) {
  const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
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
      localStorage.setItem('lao_mini_tutorial_seen', '0');
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    },
    { loc },
  );
  await page.goto(`${url}?cb=t144t-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await boot(size, loc);
      try {
        const row = await page.evaluate(
          async ({ loc, boxOutSrc, trialFix }) => {
            const boxOut = eval(`(${boxOutSrc})`);
            const _blockBudgetH = (el) => {
              if (!el) return 0;
              const r = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              return (
                r.height +
                (parseFloat(cs.marginTop) || 0) +
                (parseFloat(cs.marginBottom) || 0)
              );
            };
            let tH = 'BRIEFING';
            let tNote = 'Note';
            let tSortie = 'SORTIE';
            let rowsHtml = '';
            try {
              const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
              if (mod?.setLocale) mod.setLocale(loc);
              if (mod?.t) {
                tH = mod.t('tut.h') || tH;
                tNote = mod.t('tut.note') || tNote;
                tSortie = mod.t('btn.sortie') || tSortie;
                // Prefer real tutorial rows if keys exist
                const keys = ['tut.move', 'tut.shot', 'tut.focus', 'tut.bomb', 'tut.sp', 'tut.hold'];
                rowsHtml = keys
                  .map((k, i) => {
                    const v = mod.t(k);
                    return `<div class="tut-row"><span class="tut-k">K${i}</span><span class="tut-v">${v && v !== k ? v : 'Action ' + i}</span></div>`;
                  })
                  .join('');
              }
            } catch { /* */ }
            if (!rowsHtml) {
              rowsHtml = Array.from({ length: 6 })
                .map(
                  (_, i) =>
                    `<div class="tut-row"><span class="tut-k">K${i}</span><span class="tut-v">Action ${i}</span></div>`,
                )
                .join('');
            }

            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            const app = document.getElementById('app');
            overlay.classList.add('show');
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
            content.className = 'screen-tutorial';
            content.style.cssText = '';
            content.innerHTML = `
              <div class="panel-frame" aria-hidden="true"></div>
              <div class="opt-head">
                <span class="brand-mark">LAO MINI</span>
                <h2>${tH}</h2>
              </div>
              <span class="tutorial-deco" aria-hidden="true"></span>
              <div class="tutorial-grid">${rowsHtml}</div>
              <p class="tutorial-note">${tNote}</p>
              <div class="pause-actions">
                <button class="btn btn-primary btn-cta" id="btn-begin">${tSortie}</button>
              </div>
            `;

            const run = (fixInflate) => {
              const oc = content;
              const grid = oc.querySelector('.tutorial-grid');
              const actions = oc.querySelector('.pause-actions');
              const note = oc.querySelector('.tutorial-note');
              const head = oc.querySelector('.opt-head');
              const deco = oc.querySelector('.tutorial-deco');
              const brand = head?.querySelector('.brand-mark');
              const h2 = head?.querySelector('h2');
              oc.style.maxHeight = '';
              grid.style.minHeight = '';
              oc.classList.remove('is-tut-short');
              if (brand) {
                brand.style.display = '';
                brand.style.marginBottom = '';
              }
              if (h2) {
                h2.style.fontSize = '';
                h2.style.margin = '';
                h2.style.letterSpacing = '';
              }
              if (head) head.style.marginBottom = '';
              if (deco) deco.style.display = '';
              if (note) {
                note.style.display = '';
                note.style.border = '';
                note.style.backgroundImage = '';
                note.style.padding = '';
                note.style.clipPath = '';
                note.style.boxShadow = '';
              }
              actions.style.padding = '';
              actions.style.border = '';
              actions.style.backgroundImage = '';
              actions.style.clipPath = '';

              const appH = app?.clientHeight || window.innerHeight || 540;
              const appBoxH = app?.getBoundingClientRect?.().height || appH;
              const fitH = Math.floor(Math.min(appH, appBoxH));
              const ratioCap = Math.floor(fitH * 0.92);
              const floorCap = Math.min(300, fitH);
              let maxCap = Math.min(560, Math.max(floorCap, ratioCap));
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
                _blockBudgetH(head) + _blockBudgetH(note) + _blockBudgetH(actions) + padY;
              let pinned = pinnedH();
              let avail = Math.floor(maxCap - pinned);
              if (avail < gridFloor && note) {
                note.style.border = 'none';
                note.style.backgroundImage = 'none';
                note.style.padding = '0';
                note.style.clipPath = 'none';
                note.style.boxShadow = 'none';
                pinned = pinnedH();
                avail = Math.floor(maxCap - pinned);
              }
              if (avail < gridFloor) {
                actions.style.border = 'none';
                actions.style.backgroundImage = 'none';
                actions.style.padding = '4px 0';
                actions.style.clipPath = 'none';
                pinned = pinnedH();
                avail = Math.floor(maxCap - pinned);
              }
              if (avail < softGridWant && note) {
                note.style.display = 'none';
                pinned = pinnedH();
                avail = Math.floor(maxCap - pinned);
              }
              if (avail < gridFloor) {
                oc.classList.add('is-tut-short');
                if (brand) brand.style.display = 'none';
                if (h2) {
                  h2.style.fontSize = '18px';
                  h2.style.margin = '0';
                  h2.style.letterSpacing = '0.12em';
                }
                if (head) head.style.marginBottom = '2px';
                pinned = pinnedH();
                avail = Math.floor(maxCap - pinned);
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
                  appR.top - 1 - actR.top,
                );
                const overOc = Math.max(
                  0,
                  actR.bottom - (ocR.bottom + 1),
                  ocR.top - 1 - actR.top,
                );
                return Math.max(overApp, overOc);
              };
              let healthSteps = 0;
              let inflated = false;
              for (let i = 0; i < 4; i += 1) {
                const over = ctaOverflow();
                if (over <= 0.5) break;
                healthSteps++;
                const cur = parseFloat(grid.style.minHeight) || 0;
                if (cur > softGridWant) {
                  grid.style.minHeight = `${Math.max(softGridWant, Math.floor(cur - over - 4))}px`;
                  continue;
                }
                const next = Math.floor(maxCap - over - 4);
                // CURRENT: Math.max(260, next) can re-inflate above fitH
                // TRIAL: floor to fitH-aware floorCap
                const floored = fixInflate
                  ? Math.max(floorCap, Math.min(fitH, next))
                  : Math.max(260, next);
                if (!fixInflate && floored > fitH + 0.5) inflated = true;
                if (fixInflate && floored > fitH + 0.5) inflated = true;
                maxCap = floored;
                oc.style.maxHeight = `${maxCap}px`;
                pinned = pinnedH();
                avail = Math.floor(maxCap - pinned);
                if (avail > 0) {
                  grid.style.minHeight = `${Math.min(
                    gridFloor,
                    Math.max(0, Math.min(softGridWant, avail)),
                  )}px`;
                }
              }
              void oc.offsetHeight;
              const appR = app.getBoundingClientRect();
              const ocR = oc.getBoundingClientRect();
              const begin = document.getElementById('btn-begin');
              return {
                fitH,
                floorCap,
                maxH: +(parseFloat(oc.style.maxHeight) || 0).toFixed(2),
                panelOverRaw: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
                headroom: +(appR.bottom - ocR.bottom).toFixed(2),
                ctaOut: begin ? boxOut(begin, appR) : true,
                gridH: +grid.getBoundingClientRect().height.toFixed(2),
                healthSteps,
                inflated,
                maxHFitsApp: !(parseFloat(oc.style.maxHeight) > 0) ||
                  parseFloat(oc.style.maxHeight) <= appR.height + 0.5,
              };
            };

            return { hard: run(false), soft: run(true) };
          },
          { loc, boxOutSrc: boxOut.toString(), trialFix: true },
        );
        findings.push({ loc, w: size.width, h: size.height, ...row });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const hardMuddy = findings.filter(
  (f) =>
    f.hard.panelOverRaw > 1.5 ||
    f.hard.headroom < -1.5 ||
    f.hard.ctaOut ||
    f.hard.maxHFitsApp === false ||
    f.hard.inflated,
);
const softMuddy = findings.filter(
  (f) =>
    f.soft.panelOverRaw > 1.5 ||
    f.soft.headroom < -1.5 ||
    f.soft.ctaOut ||
    f.soft.maxHFitsApp === false,
);
const win = findings.filter(
  (f) =>
    (f.hard.ctaOut || f.hard.inflated || f.hard.panelOverRaw > 1.5 || !f.hard.maxHFitsApp) &&
    !f.soft.ctaOut &&
    f.soft.panelOverRaw <= 1.5 &&
    f.soft.headroom >= -1.5 &&
    f.soft.maxHFitsApp,
);

console.log(
  JSON.stringify(
    {
      hardMuddyCount: hardMuddy.length,
      softMuddyCount: softMuddy.length,
      winCount: win.length,
      win: win.map((f) => ({
        loc: f.loc,
        size: `${f.w}x${f.h}`,
        hard: f.hard,
        soft: f.soft,
      })),
      hardMuddy: hardMuddy.map((f) => ({
        loc: f.loc,
        size: `${f.w}x${f.h}`,
        hard: f.hard,
      })),
      sample280: findings.filter((f) => f.h === 280).map((f) => ({ loc: f.loc, hard: f.hard, soft: f.soft })),
      sample288: findings.filter((f) => f.h === 288).map((f) => ({ loc: f.loc, hard: f.hard, soft: f.soft })),
      sample320: findings.filter((f) => f.h === 320).map((f) => ({ loc: f.loc, hard: f.hard, soft: f.soft })),
      sample450: findings.filter((f) => f.h === 450).map((f) => ({ loc: f.loc, hard: f.hard, soft: f.soft })),
    },
    null,
    2,
  ),
);
