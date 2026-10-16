/**
 * Tick165 — trial result CTA chrome ladder recipes after tick133–143 panelOver path.
 * Live HARD: *@360×240 / *@400×280 maxH=fitH panelOver=0 CTA unread;
 * *@400×240 / *@320×200 ladder stop with ctaOut; *@360×200 early return ctaOut.
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

const LOCALES = ['ko', 'en', 'ru', 'pt'];
const SIZES = [
  { width: 320, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
];
const TRIALS = ['baseline', 'ctaCompact', 'cta+score', 'cta+score+pad', 'full'];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const trial of TRIALS) {
    let hard = 0;
    let soft = 0;
    let ok = 0;
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
          await page.goto(`${url}?cb=t165t-${trial}-${loc}-${size.width}x${size.height}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.waitForSelector('#btn-start', { timeout: 60000 });
          const m = await page.evaluate(
            async ({ loc, trial }) => {
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
              content.className = 'screen-result gameover';
              content.style.cssText = '';
              content.innerHTML = `
                <div class="panel-frame" aria-hidden="true"></div>
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
                <button class="btn" id="btn-title">${tTitle}</button>
              `;

              const oc = content;
              const deco = oc.querySelector('.result-deco');
              const score = oc.querySelector('.result-score');
              const meta = oc.querySelector('.result-meta');
              const brand = oc.querySelector(':scope > .brand-mark');
              const h2 = oc.querySelector(':scope > h2');
              const retry = oc.querySelector('#btn-retry');
              const titleBtn = oc.querySelector('#btn-title');
              const app = document.getElementById('app');

              // Existing tick133–143 ladder (abbreviated via panelOver soft gate).
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
              const appH0 = app.clientHeight || 360;
              const softGate = () => appH0 <= 340 && rawHeadroom() < 8;
              let over = panelOver();
              if (!(over <= 1.5 && !softGate())) {
                if (deco) deco.style.display = 'none';
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
                  over = panelOver();
                  if (!(over <= 1.5 && !softGate())) {
                    oc.classList.add('is-result-short');
                    if (brand) brand.style.display = 'none';
                    if (h2) {
                      h2.style.fontSize = '18px';
                      h2.style.margin = '0';
                      h2.style.letterSpacing = '0.12em';
                    }
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
                      over = panelOver();
                      if (over > 1.5) {
                        oc.style.paddingTop = '18px';
                        oc.style.paddingBottom = '12px';
                        over = panelOver();
                        if (over > 1.5) {
                          if (retry) retry.style.padding = '8px 20px';
                          if (titleBtn) titleBtn.style.padding = '8px 20px';
                          over = panelOver();
                          if (!(over <= 1.5 && !softGate())) {
                            const appBoxH = app.getBoundingClientRect().height || appH0;
                            const fitH = Math.floor(Math.min(appH0, appBoxH));
                            oc.style.maxHeight = `${Math.max(
                              Math.min(260, fitH),
                              Math.floor(fitH * 0.96),
                            )}px`;
                          }
                        }
                      }
                    }
                  }
                }
              }

              const ctaChromeOverflow = () => {
                void oc.offsetHeight;
                const appR = app.getBoundingClientRect();
                const ocR = oc.getBoundingClientRect();
                let worst = 0;
                for (const el of [retry, titleBtn]) {
                  if (!el) continue;
                  const r = el.getBoundingClientRect();
                  const vis = Math.max(
                    0,
                    Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
                      Math.max(r.top, Math.max(ocR.top, appR.top)),
                  );
                  const need = Math.min(20, Math.max(0, r.height - 2));
                  if (vis + 0.5 < need) worst = Math.max(worst, need - vis);
                  if (r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5) {
                    worst = Math.max(worst, r.bottom - (appR.bottom + 1));
                  }
                  if (r.bottom > ocR.bottom + 1.5) {
                    worst = Math.max(worst, r.bottom - (ocR.bottom + 1));
                  }
                }
                return worst;
              };

              if (trial !== 'baseline' && ctaChromeOverflow() > 0.5) {
                // ctaCompact
                if (retry) {
                  retry.style.padding = '4px 10px';
                  retry.style.minHeight = '28px';
                  retry.style.fontSize = '12px';
                  retry.style.minWidth = '0';
                }
                if (titleBtn) {
                  titleBtn.style.padding = '4px 10px';
                  titleBtn.style.minHeight = '28px';
                  titleBtn.style.fontSize = '12px';
                  titleBtn.style.minWidth = '0';
                }
              }
              if (
                (trial === 'cta+score' || trial === 'cta+score+pad' || trial === 'full') &&
                ctaChromeOverflow() > 0.5
              ) {
                oc.classList.add('is-result-short');
                if (brand) brand.style.display = 'none';
                if (h2) {
                  h2.style.fontSize = '16px';
                  h2.style.margin = '0';
                  h2.style.letterSpacing = '0.1em';
                }
                if (score) {
                  score.style.marginTop = '2px';
                  score.style.marginBottom = '4px';
                  score.style.gap = '6px';
                }
                if (meta) {
                  meta.style.marginBottom = '4px';
                  meta.style.gap = '4px 8px';
                }
                for (const cell of oc.querySelectorAll(
                  '.result-score .cell, .result-meta .cell',
                )) {
                  cell.style.padding = '1px 3px';
                  cell.style.border = 'none';
                  cell.style.backgroundImage = 'none';
                  cell.style.boxShadow = 'none';
                  cell.style.clipPath = 'none';
                }
              }
              if (
                (trial === 'cta+score+pad' || trial === 'full') &&
                ctaChromeOverflow() > 0.5
              ) {
                oc.style.paddingTop = '10px';
                oc.style.paddingBottom = '8px';
              }
              if (trial === 'full' && ctaChromeOverflow() > 0.5) {
                const appBoxH = app.getBoundingClientRect().height || appH0;
                const fitH = Math.floor(Math.min(appH0, appBoxH));
                oc.style.maxHeight = `${fitH}px`;
                // last: collapse meta to 2-col denser / hide no-miss cell? keep strings — shrink h2 more
                if (h2) h2.style.fontSize = '14px';
                if (score) {
                  score.style.marginBottom = '2px';
                  score.style.gap = '4px';
                }
                if (meta) {
                  meta.style.marginBottom = '2px';
                  meta.style.gap = '2px 6px';
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
                  r.right > appR.right + 1.5
                );
              };
              const maxHpx = parseFloat(oc.style.maxHeight) || 0;
              const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
              return {
                panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
                maxH: oc.style.maxHeight || '',
                fitH,
                inflated: maxHpx > fitH + 0.5,
                ctaOut: retry ? out(retry) : true,
                ctaVis: +vis(retry).toFixed(1),
                ctaH: +(retry?.getBoundingClientRect().height || 0).toFixed(1),
                secOut: titleBtn ? out(titleBtn) : false,
                secVis: titleBtn ? +vis(titleBtn).toFixed(1) : 0,
                secH: +(titleBtn?.getBoundingClientRect().height || 0).toFixed(1),
                chrome: +ctaChromeOverflow().toFixed(2),
              };
            },
            { loc, trial },
          );
          const hardHit =
            m.inflated ||
            m.ctaOut ||
            (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
            m.secOut ||
            (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
          const softHit = !hardHit && m.panelOver > 1.5;
          const cls = hardHit ? 'HARD' : softHit ? 'SOFT' : 'ok';
          if (hardHit) hard += 1;
          else if (softHit) soft += 1;
          else ok += 1;
          if (hardHit || (size.width <= 400 && size.height <= 280)) {
            log(
              `${cls} ${trial} ${loc}@${size.width}x${size.height}`,
              `over=${m.panelOver} maxH=${m.maxH} chrome=${m.chrome}`,
              `cta=${m.ctaVis}/${m.ctaH} sec=${m.secVis}/${m.secH}`,
            );
          }
        } finally {
          await page.close();
        }
      }
    }
    log(`TRIAL ${trial}: hard=${hard} soft=${soft} ok=${ok}`);
    log('');
  }
} finally {
  await browser.close();
  server.close();
}

const outPath = join(root, 'tools', 'probe-tick165-result-trial.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
