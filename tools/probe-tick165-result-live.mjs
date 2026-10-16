/**
 * Tick165 — result residual with mirrored syncResultPanelBudget (live ladder).
 * Inject alone is NOT proof (screen≠result → resize skips sync). dens FROZEN.
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
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

const LOCALES = ['ko', 'en', 'ru', 'pt', 'es', 'zh-Hant', 'ja'];
const SIZES = [
  { width: 320, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
  { width: 640, height: 360 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classify(m) {
  const unread =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.headroom < -1);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({ viewport: size });
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
          },
          { loc },
        );
        await page.goto(`${url}?cb=t165r-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const m = await page.evaluate(async (loc) => {
          let tRetry = 'Retry run';
          let tTitle = 'Title';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            mod.setLocale?.(loc);
            if (mod.t) {
              tRetry = mod.t('btn.retryRun');
              tTitle = mod.t('btn.title');
            }
          } catch {
            /* */
          }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.add('is-on', 'show');
          overlay.classList.remove('hidden');
          overlay.style.display = 'flex';
          // Match endScreen markup (no .result-actions wrapper).
          content.className = 'screen-result gameover';
          content.style.cssText = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true">
              <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
              <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
            </div>
            <span class="brand-mark">SYSTEM DOWN</span>
            <h2>GAME OVER</h2>
            <span class="result-deco" aria-hidden="true"></span>
            <div class="result-score">
              <div class="cell"><span class="lbl">SCORE</span><span class="val">00001234</span></div>
              <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">00005678</span></div>
              <div class="cell"><span class="lbl">GRAZE</span><span class="val">12</span></div>
            </div>
            <div class="result-meta">
              <div class="cell"><span class="lbl">STAGE</span><span class="val">STAGE 2 · TEST</span></div>
              <div class="cell"><span class="lbl">PILOT</span><span class="val">HIRUME</span></div>
              <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">8</span></div>
              <div class="cell"><span class="lbl">NO MISS</span><span class="val">—</span></div>
            </div>
            <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
            <button class="btn" id="btn-title"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${tTitle}</button>
          `;

          // Mirror syncResultPanelBudget from main.js (tick133–143).
          const oc = content;
          const deco = oc.querySelector('.result-deco');
          const score = oc.querySelector('.result-score');
          const meta = oc.querySelector('.result-meta');
          const brand = oc.querySelector(':scope > .brand-mark');
          const h2 = oc.querySelector(':scope > h2');
          const retry = oc.querySelector('#btn-retry');
          const titleBtn = oc.querySelector('#btn-title');
          const app = document.getElementById('app');
          oc.classList.remove('is-result-short');
          oc.style.maxHeight = '';
          oc.style.paddingTop = '';
          oc.style.paddingBottom = '';
          if (deco) deco.style.display = '';
          if (brand) {
            brand.style.display = '';
            brand.style.marginBottom = '';
          }
          if (h2) {
            h2.style.fontSize = '';
            h2.style.margin = '';
            h2.style.marginBottom = '';
            h2.style.letterSpacing = '';
          }
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
            return Math.max(0, ocR.bottom - (appR.bottom + 1), (appR.top - 1) - ocR.top);
          };
          const rawHeadroom = () => {
            void oc.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            return appR.bottom - ocR.bottom;
          };
          let steps = 0;
          let over = panelOver();
          const appH0 = app.clientHeight || window.innerHeight || 360;
          const softGate = () => appH0 <= 340 && rawHeadroom() < 8;
          if (!(over <= 1.5 && !softGate())) {
            if (deco) deco.style.display = 'none';
            steps = 1;
            over = panelOver();
            if (!(over <= 1.5 && !softGate())) {
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
              steps = 2;
              over = panelOver();
              if (!(over <= 1.5 && !softGate())) {
                oc.classList.add('is-result-short');
                if (brand) brand.style.display = 'none';
                if (h2) {
                  h2.style.fontSize = '18px';
                  h2.style.margin = '0';
                  h2.style.letterSpacing = '0.12em';
                }
                steps = 3;
                over = panelOver();
                if (over > 1.5) {
                  for (const cell of oc.querySelectorAll(
                    '.result-score .cell, .result-meta .cell',
                  )) {
                    cell.style.padding = '2px 4px';
                    cell.style.border = 'none';
                    cell.style.backgroundImage = 'none';
                    cell.style.boxShadow = 'none';
                    cell.style.clipPath = 'none';
                  }
                  steps = 4;
                  over = panelOver();
                  if (over > 1.5) {
                    oc.style.paddingTop = '18px';
                    oc.style.paddingBottom = '12px';
                    steps = 5;
                    over = panelOver();
                    if (over > 1.5) {
                      if (retry) retry.style.padding = '8px 20px';
                      if (titleBtn) titleBtn.style.padding = '8px 20px';
                      steps = 6;
                      over = panelOver();
                      if (!(over <= 1.5 && !softGate())) {
                        const appH = app.clientHeight || window.innerHeight || 360;
                        const appBoxH = app.getBoundingClientRect().height || appH;
                        const fitH = Math.floor(Math.min(appH, appBoxH));
                        const ratioCap = Math.floor(fitH * 0.96);
                        const floorCap = Math.min(260, fitH);
                        oc.style.maxHeight = `${Math.max(floorCap, ratioCap)}px`;
                        steps = 7;
                      }
                    }
                  }
                }
              }
            }
          }

          void oc.offsetHeight;
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
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
            if (!el) return true;
            const r = el.getBoundingClientRect();
            return (
              r.bottom > appR.bottom + 1.5 ||
              r.top < appR.top - 1.5 ||
              r.right > appR.right + 1.5 ||
              r.left < appR.left - 1.5
            );
          };
          const maxHpx = parseFloat(oc.style.maxHeight) || 0;
          const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
          return {
            panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
            maxH: oc.style.maxHeight || '',
            maxHpx,
            fitH,
            inflated: maxHpx > fitH + 0.5,
            steps,
            ctaOut: retry ? out(retry) : true,
            ctaVis: +vis(retry).toFixed(1),
            ctaH: +(retry?.getBoundingClientRect().height || 0).toFixed(1),
            secOut: titleBtn ? out(titleBtn) : false,
            secVis: titleBtn ? +vis(titleBtn).toFixed(1) : 0,
            secH: +(titleBtn?.getBoundingClientRect().height || 0).toFixed(1),
            headroom: +(appR.bottom - ocR.bottom).toFixed(2),
            short: oc.classList.contains('is-result-short'),
            brandHidden: brand ? getComputedStyle(brand).display === 'none' : false,
            ocH: +ocR.height.toFixed(1),
            padT: oc.style.paddingTop || '',
            retryPad: retry?.style.padding || '',
          };
        }, loc);

        const cls = classify(m);
        const tag = `result ${loc}@${size.width}x${size.height}`;
        log(
          `${cls} ${tag}`,
          `over=${m.panelOver} maxH=${m.maxH} fitH=${m.fitH} inflated=${m.inflated}`,
          `steps=${m.steps} short=${m.short} brandHidden=${m.brandHidden}`,
          `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
          `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
          `headroom=${m.headroom} ocH=${m.ocH}`,
        );
        if (cls === 'HARD') hard.push({ tag, ...m });
        else if (cls === 'SOFT') soft.push({ tag, ...m });
        else ok += 1;
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('');
log(`SUMMARY hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) {
    log(
      `  ${h.tag} over=${h.panelOver} steps=${h.steps} maxH=${h.maxH}`,
      `cta=${h.ctaVis}/${h.ctaH} sec=${h.secVis}/${h.secH} headroom=${h.headroom}`,
    );
  }
}
if (soft.length) {
  log('SOFT DETAIL:');
  for (const s of soft) {
    log(`  ${s.tag} over=${s.panelOver} headroom=${s.headroom} steps=${s.steps}`);
  }
}

const outPath = join(root, 'tools', 'probe-tick165-result-live.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length ? 2 : 0);
