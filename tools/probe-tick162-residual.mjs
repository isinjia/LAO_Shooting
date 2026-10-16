/**
 * Tick162 — residual HARD scan after tick161 select CTA chrome ladder.
 * Prefer peers with similar flex-wrap + .btn-cta min-width wrap OOB, else
 * live-proven residual. dens FROZEN. Prefer live HARD only.
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

const LOCALES = ['ko', 'en', 'ru', 'pt', 'es', 'zh-Hant', 'ja'];
const SIZES = [
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 360, height: 240 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
];

function classify(m) {
  const unread =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  const soft =
    !unread &&
    (m.panelOver > 1.5 || m.actionsOut || m.backOut || (m.secOutSoft && m.panelOver > 0.5));
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

const measureSrc = `({ ctaSel, secSel, actionsSel, backSel }) => {
  const app = document.getElementById('app');
  const oc = document.getElementById('overlay-content');
  if (!app || !oc) return { missing: true };
  void oc.offsetHeight;
  const appR = app.getBoundingClientRect();
  const ocR = oc.getBoundingClientRect();
  const cta = oc.querySelector(ctaSel) || oc.querySelector('.btn-cta, .btn-primary');
  const sec = secSel ? oc.querySelector(secSel) : null;
  const actions = actionsSel ? oc.querySelector(actionsSel) : null;
  const back = backSel
    ? oc.querySelector(backSel)
    : oc.querySelector('#btn-back, #btn-opt-back, #btn-quit, #btn-title');
  const vis = (el) => {
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
        Math.max(r.top, Math.max(ocR.top, appR.top)),
    );
  };
  const out = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      r.bottom > appR.bottom + 1.5 ||
      r.top < appR.top - 1.5 ||
      r.right > appR.right + 1.5 ||
      r.left < appR.left - 1.5
    );
  };
  const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
  const bw = (el) => (el ? +el.getBoundingClientRect().width.toFixed(1) : 0);
  const ctaMin =
    cta ? parseFloat(getComputedStyle(cta).minWidth) || 0 : 0;
  const actionsWrap = actions
    ? getComputedStyle(actions).flexWrap + '/' + getComputedStyle(actions).flexDirection
    : '';
  const actR = actions?.getBoundingClientRect();
  const overAct = actR
    ? Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top)
    : 0;
  return {
    cls: oc.className,
    panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
    maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight,
    actionsH: bh(actions),
    actionsW: bw(actions),
    actionsWrap,
    ctaMin,
    ctaOut: cta ? out(cta) : true,
    ctaVis: +vis(cta).toFixed(1),
    ctaH: bh(cta),
    ctaW: bw(cta),
    secOut: sec ? out(sec) : false,
    secVis: sec ? +vis(sec).toFixed(1) : 0,
    secH: bh(sec),
    secOutSoft: !!(sec && !out(sec) && vis(sec) < Math.min(20, bh(sec) - 2)),
    backOut: back ? out(back) : false,
    backVis: back ? +vis(back).toFixed(1) : 0,
    actionsOut: actions ? out(actions) : false,
    ctaOver: +overAct.toFixed(2),
    brandDisp: (() => {
      const b = oc.querySelector('.brand-mark');
      return b ? getComputedStyle(b).display : '';
    })(),
  };
}`;

const lines = [];
function log(...args) {
  const s = args.join(' ');
  lines.push(s);
  console.log(s);
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];

async function boot(size, loc, tag, tutorialSeen = '1') {
  const page = await browser.newPage({ viewport: size });
  await page.addInitScript(
    ({ loc, tutorialSeen }) => {
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
      localStorage.setItem('lao_mini_tutorial_seen', tutorialSeen);
    },
    { loc, tutorialSeen },
  );
  await page.goto(`${url}?cb=t162-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

function record(screen, loc, size, m) {
  const tag = `${screen} ${loc}@${size.width}x${size.height}`;
  const cls = classify(m);
  const row = {
    tag,
    screen,
    loc,
    w: size.width,
    h: size.height,
    cls,
    ...m,
  };
  log(
    `${cls} ${tag}`,
    `over=${m.panelOver} maxH=${m.maxH}`,
    `actions=${m.actionsH} wrap=${m.actionsWrap} ctaMin=${m.ctaMin}`,
    `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH} ctaW=${m.ctaW}`,
    `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
    `backOut=${m.backOut} actionsOut=${m.actionsOut} brand=${m.brandDisp}`,
  );
  if (cls === 'HARD') hard.push(row);
  else if (cls === 'SOFT') soft.push(row);
  return row;
}

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // A) SELECT keep / reopen check (live showSelect)
      {
        const page = await boot(size, loc, 'sel', '1');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#overlay-content.screen-select, #btn-go', {
            timeout: 60000,
          });
          await page.waitForTimeout(220);
          const m = await page.evaluate(eval(`(${measureSrc})`), {
            ctaSel: '#btn-go',
            secSel: '#btn-options-select',
            actionsSel: '.select-actions',
            backSel: '#btn-back',
          });
          record('select', loc, size, m);
        } finally {
          await page.close();
        }
      }

      // B) TUTORIAL live (flex column + btn-cta min-width peer)
      if (size.width === 400 || size.width === 360) {
        const page = await boot(size, loc, 'tut', '0');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#overlay-content.screen-select, #btn-go', {
            timeout: 60000,
          });
          await page.waitForTimeout(120);
          await page.evaluate(() => {
            const card = document.querySelector('.char-card, [data-char]');
            card?.click();
          });
          await page.waitForTimeout(40);
          await page.click('#btn-go');
          await page.waitForSelector('#overlay-content.screen-tutorial, #btn-tut-go', {
            timeout: 60000,
          });
          await page.waitForTimeout(220);
          const m = await page.evaluate(eval(`(${measureSrc})`), {
            ctaSel: '#btn-tut-go',
            secSel: '#btn-tut-skip',
            actionsSel: '.pause-actions',
            backSel: '#btn-tut-skip',
          });
          record('tutorial', loc, size, m);
        } finally {
          await page.close();
        }
      }

      // C) OPTIONS live from select (BACK pin peer)
      if (size.width === 400 || size.width === 480) {
        const page = await boot(size, loc, 'opt', '1');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-options-select, #btn-go', { timeout: 60000 });
          await page.waitForTimeout(120);
          await page.click('#btn-options-select');
          await page.waitForSelector('#overlay-content.screen-options, #btn-opt-back', {
            timeout: 60000,
          });
          await page.waitForTimeout(220);
          const m = await page.evaluate(eval(`(${measureSrc})`), {
            ctaSel: '#btn-opt-back',
            secSel: null,
            actionsSel: '.opt-actions',
            backSel: '#btn-opt-back',
          });
          record('options', loc, size, m);
        } finally {
          await page.close();
        }
      }

      // D) TITLE (column actions — peer chrome)
      if (size.width === 400 || size.height === 320) {
        const page = await boot(size, loc, 'title', '1');
        try {
          await page.waitForTimeout(180);
          const m = await page.evaluate(eval(`(${measureSrc})`), {
            ctaSel: '#btn-start',
            secSel: '#btn-options, #btn-options-title, .title-actions .btn:not(.btn-primary)',
            actionsSel: '.title-actions',
            backSel: null,
          });
          record('title', loc, size, m);
        } finally {
          await page.close();
        }
      }

      // E) PAUSE injected with i18n + live-ish ladder via Escape after short run
      //    Prefer Escape path when game boots; fallback inject.
      if ((size.width === 400 && size.height === 280) || size.width === 568) {
        const page = await boot(size, loc, 'pause', '1');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 60000 });
          await page.waitForTimeout(80);
          await page.click('#btn-go');
          // may hit tutorial if somehow seen cleared — force seen already
          try {
            await page.waitForFunction(
              () => {
                const g = window.__LAO__?.getGame?.();
                return !!g || !!document.querySelector('#btn-tut-go');
              },
              { timeout: 45000 },
            );
          } catch {
            /* continue */
          }
          const hasTut = await page.$('#btn-tut-go');
          if (hasTut) {
            await page.click('#btn-tut-go');
            await page.waitForTimeout(600);
          } else {
            await page.waitForTimeout(700);
          }
          await page.keyboard.press('Escape');
          await page.waitForTimeout(250);
          let hasPause = await page.$('#overlay-content.screen-pause');
          if (!hasPause) {
            // inject with i18n + mirror syncPausePanelBudget via resize won't work;
            // use markup + call through page's own show path if game exists
            await page.evaluate(async (loc) => {
              let tPause = 'Operation on hold';
              let tResume = 'Resume';
              let tOpts = 'OPTIONS';
              let tMute = 'Unmute';
              let tTitle = 'To title';
              try {
                const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
                mod.setLocale?.(loc);
                if (mod.t) {
                  tPause = mod.t('pause.p');
                  tResume = mod.t('btn.resume');
                  tOpts = mod.t('btn.options');
                  tMute = mod.t('btn.unmute');
                  tTitle = mod.t('btn.toTitle');
                }
              } catch {
                /* */
              }
              const overlay = document.getElementById('overlay');
              const content = document.getElementById('overlay-content');
              overlay.classList.add('is-on', 'show');
              overlay.classList.remove('hidden');
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
              window.dispatchEvent(new Event('resize'));
            }, loc);
            await page.waitForTimeout(180);
            hasPause = await page.$('#overlay-content.screen-pause');
          }
          if (hasPause) {
            const m = await page.evaluate(eval(`(${measureSrc})`), {
              ctaSel: '#btn-resume',
              secSel: '#btn-quit',
              actionsSel: '.pause-actions',
              backSel: '#btn-quit',
            });
            record('pause', loc, size, m);
          } else {
            log(`SKIP pause ${loc}@${size.width}x${size.height}`);
          }
        } finally {
          await page.close();
        }
      }

      // F) RESULT inject with real score/meta + sync via resize (uses syncResultPanelBudget on screen)
      if (size.width === 400 || size.width === 480) {
        const page = await boot(size, loc, 'result', '1');
        try {
          await page.evaluate(async (loc) => {
            let tRetry = 'Retry run';
            let tTitle = 'Title';
            try {
              const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
              mod.setLocale?.(loc);
              if (mod.t) {
                tRetry = mod.t('btn.retryRun') || mod.t('btn.retry') || tRetry;
                tTitle = mod.t('btn.title') || mod.t('btn.toTitle') || tTitle;
              }
            } catch {
              /* */
            }
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            overlay.classList.add('is-on', 'show');
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
            content.className = 'screen-result gameover';
            content.style.cssText = '';
            content.innerHTML = `
              <div class="panel-frame" aria-hidden="true"></div>
              <span class="brand-mark">SYSTEM DOWN</span>
              <h2>GAME OVER</h2>
              <span class="result-deco" aria-hidden="true"></span>
              <div class="result-score">
                <div class="cell"><span class="lbl">SCORE</span><span class="val">0012345</span></div>
                <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">0099999</span></div>
                <div class="cell"><span class="lbl">GRAZE</span><span class="val">12</span></div>
              </div>
              <div class="result-meta">
                <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 1</span></div>
                <div class="cell"><span class="lbl">PILOT</span><span class="val">HIRUME</span></div>
                <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">3</span></div>
                <div class="cell"><span class="lbl">NO MISS</span><span class="val">—</span></div>
              </div>
              <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
              <button class="btn" id="btn-title">${tTitle}</button>
            `;
            window.dispatchEvent(new Event('resize'));
          }, loc);
          await page.waitForTimeout(220);
          const m = await page.evaluate(eval(`(${measureSrc})`), {
            ctaSel: '#btn-retry',
            secSel: '#btn-title',
            actionsSel: null,
            backSel: '#btn-title',
          });
          record('result', loc, size, m);
        } finally {
          await page.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('\n=== HARD SUMMARY ===');
log(`count=${hard.length}`);
for (const h of hard) {
  log(
    h.tag,
    `ctaOver=${h.ctaOver} ctaVis=${h.ctaVis}/${h.ctaH} ctaMin=${h.ctaMin}`,
    `secOut=${h.secOut} backOut=${h.backOut} actions=${h.actionsH} wrap=${h.actionsWrap}`,
  );
}
log('\n=== SOFT SUMMARY ===');
log(`count=${soft.length}`);
for (const s of soft.slice(0, 40)) {
  log(s.tag, `over=${s.panelOver} actionsOut=${s.actionsOut} backOut=${s.backOut}`);
}
if (soft.length > 40) log(`... +${soft.length - 40} more soft`);

const outPath = join(root, 'tools', 'probe-tick162-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`\nWrote ${outPath}`);
