/**
 * Tick145 thin scan: pause/result/title/loading/asset-error ultra-short muddy
 * after OPTIONS/tutorial CTA-health proved latent (healthSteps=0).
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

const LOCALES = ['ko', 'en', 'es', 'ru'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc, tutorialSeen = '1') {
  const page = await browser.newPage({ viewport: size, hasTouch: false, isMobile: false });
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
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    },
    { loc, tutorialSeen },
  );
  await page.goto(`${url}?cb=t145s-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

function snap(kind) {
  return ({ boxOutSrc, kind }) => {
    const boxOut = eval(`(${boxOutSrc})`);
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    if (!app || !oc) return { kind, missing: true };
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const maxH = parseFloat(oc.style.maxHeight) || 0;
    const cta =
      oc.querySelector(
        '#btn-resume, #btn-retry, #btn-begin, #btn-go, #btn-start, #btn-options-back, .btn-cta, .btn-primary',
      ) || oc.querySelector('.btn');
    const quit = oc.querySelector('#btn-quit, #btn-to-title, #btn-title');
    return {
      kind,
      cls: oc.className,
      fitH,
      maxH: +maxH.toFixed(2),
      panelOverRaw: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      headroom: +(appR.bottom - ocR.bottom).toFixed(2),
      ctaOut: cta ? boxOut(cta, appR) : null,
      quitOut: quit ? boxOut(quit, appR) : null,
      inflated: maxH > 0 && maxH > fitH + 0.5,
      maxHFitsApp: !(maxH > 0) || maxH <= appR.height + 0.5,
    };
  };
}

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // Title
      {
        const page = await boot(size, loc);
        try {
          await page.waitForTimeout(120);
          const m = await page.evaluate(snap('title'), {
            boxOutSrc: boxOut.toString(),
            kind: 'title',
          });
          const muddy = m.inflated || m.panelOverRaw > 1.5 || m.ctaOut === true;
          findings.push({ loc, ...size, ...m, muddy });
          if (muddy || size.height <= 288) {
            console.log(
              `TITLE ${loc}@${size.width}x${size.height}`,
              `maxH=${m.maxH} fitH=${m.fitH} over=${m.panelOverRaw} hr=${m.headroom}`,
              `ctaOut=${m.ctaOut} inflated=${m.inflated}`,
            );
          }
        } finally {
          await page.close();
        }
      }

      // Pause via evaluate showPause if available, else inject class via overlay path
      {
        const page = await boot(size, loc);
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 90000 });
          // Force pause overlay through in-page API if present
          const opened = await page.evaluate(async () => {
            if (typeof window.showPause === 'function') {
              window.showPause();
              return 'showPause';
            }
            // Fallback: open overlay as pause-like by clicking if mid-game later
            return null;
          });
          if (!opened) {
            // Start game quickly then pause via Escape
            await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
            await page.click('#btn-go');
            await page.waitForTimeout(800);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
          } else {
            await page.waitForTimeout(180);
          }
          const hasPause = await page.$('#overlay-content.screen-pause');
          if (hasPause) {
            const m = await page.evaluate(snap('pause'), {
              boxOutSrc: boxOut.toString(),
              kind: 'pause',
            });
            const muddy =
              m.inflated ||
              m.panelOverRaw > 1.5 ||
              m.ctaOut === true ||
              m.quitOut === true;
            findings.push({ loc, ...size, ...m, muddy });
            if (muddy || size.height <= 320) {
              console.log(
                `PAUSE ${loc}@${size.width}x${size.height}`,
                `maxH=${m.maxH} fitH=${m.fitH} over=${m.panelOverRaw} hr=${m.headroom}`,
                `ctaOut=${m.ctaOut} quitOut=${m.quitOut} inflated=${m.inflated}`,
              );
            }
          } else {
            console.log(`PAUSE skip ${loc}@${size.width}x${size.height} (no screen)`);
          }
        } finally {
          await page.close();
        }
      }

      // Result via force gameover overlay markup path if showResult exists
      {
        const page = await boot(size, loc);
        try {
          const ok = await page.evaluate(async () => {
            if (typeof window.showResult === 'function') {
              window.showResult({ score: 12345, cleared: false });
              return true;
            }
            // Try importing nothing — use overlay injection similar to prior probes
            return false;
          });
          if (!ok) {
            // Minimal: navigate select then use known test hook if any
            await page.evaluate(() => {
              const overlay = document.getElementById('overlay');
              const content = document.getElementById('overlay-content');
              if (!overlay || !content) return;
              overlay.classList.add('show');
              overlay.classList.remove('hidden');
              overlay.style.display = 'flex';
              content.className = 'screen-result gameover';
              content.style.cssText = '';
              content.innerHTML = `
                <div class="panel-frame" aria-hidden="true"></div>
                <span class="result-deco" aria-hidden="true"></span>
                <div class="result-stamp">
                  <span class="brand-mark">LAO MINI</span>
                  <h2>MISSION FAILED</h2>
                </div>
                <div class="result-score">SCORE 0012345</div>
                <div class="result-meta">STAGE 1 · TIME 01:23</div>
                <div class="result-cells">
                  <div class="result-cell">A</div>
                  <div class="result-cell">B</div>
                </div>
                <div class="pause-actions">
                  <button class="btn btn-primary" id="btn-retry">RETRY</button>
                  <button class="btn" id="btn-to-title">TITLE</button>
                </div>
              `;
              if (typeof window.syncResultPanelBudget === 'function') {
                window.syncResultPanelBudget();
              }
            });
            // Call sync via keyboard resize to trigger budget if not exported
            await page.evaluate(() => {
              window.dispatchEvent(new Event('resize'));
            });
            await page.waitForTimeout(120);
          } else {
            await page.waitForTimeout(180);
          }
          const m = await page.evaluate(snap('result'), {
            boxOutSrc: boxOut.toString(),
            kind: 'result',
          });
          // If syncResultPanelBudget is not global, maxH may be 0 — still check panelOver
          const muddy =
            m.inflated ||
            m.panelOverRaw > 1.5 ||
            m.ctaOut === true ||
            m.quitOut === true;
          findings.push({ loc, ...size, ...m, muddy });
          if (muddy || size.height <= 320) {
            console.log(
              `RESULT ${loc}@${size.width}x${size.height}`,
              `maxH=${m.maxH} fitH=${m.fitH} over=${m.panelOverRaw} hr=${m.headroom}`,
              `ctaOut=${m.ctaOut} quitOut=${m.quitOut} inflated=${m.inflated} cls=${m.cls}`,
            );
          }
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

const muddy = findings.filter((f) => f.muddy);
console.log('\n=== SUMMARY ===');
console.log('total', findings.length, 'muddy', muddy.length);
for (const r of muddy) {
  console.log(
    `MUDDY ${r.kind} ${r.loc}@${r.width}x${r.height}`,
    `maxH=${r.maxH} fitH=${r.fitH} over=${r.panelOverRaw} hr=${r.headroom}`,
    `ctaOut=${r.ctaOut} quitOut=${r.quitOut} inflated=${r.inflated}`,
  );
}
if (!muddy.length) console.log('No new live muddy outside latent Math.max(260)');
