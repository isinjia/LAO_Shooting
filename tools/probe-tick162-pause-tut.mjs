/**
 * Tick162 focused: pause quit unread @400×280 + tutorial skip @360×240
 * after live showPauseMenu / showTutorialThen. Trial compact recipes.
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

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

async function snap(page, ctaSel, secSel, actionsSel) {
  return page.evaluate(
    ({ ctaSel, secSel, actionsSel }) => {
      const app = document.getElementById('app');
      const oc = document.getElementById('overlay-content');
      void oc.offsetHeight;
      const appR = app.getBoundingClientRect();
      const ocR = oc.getBoundingClientRect();
      const cta = oc.querySelector(ctaSel);
      const sec = oc.querySelector(secSel);
      const actions = oc.querySelector(actionsSel);
      const brand = oc.querySelector('.brand-mark');
      const out = (el) => {
        if (!el) return true;
        const r = el.getBoundingClientRect();
        return (
          r.bottom > appR.bottom + 1.5 ||
          r.top < appR.top - 1.5 ||
          r.right > appR.right + 1.5
        );
      };
      const vis = (el) => {
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return Math.max(
          0,
          Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
            Math.max(r.top, Math.max(ocR.top, appR.top)),
        );
      };
      const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
      const actR = actions?.getBoundingClientRect();
      return {
        cls: oc.className,
        display: actions ? getComputedStyle(actions).display : '',
        panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
        headroom: +(appR.bottom - ocR.bottom).toFixed(2),
        maxH: oc.style.maxHeight || '',
        ocH: +ocR.height.toFixed(1),
        appH: +appR.height.toFixed(1),
        brand: brand ? getComputedStyle(brand).display : '',
        actionsH: bh(actions),
        actionsOut: actions ? out(actions) : false,
        ctaOut: cta ? out(cta) : true,
        ctaVis: +vis(cta).toFixed(1),
        ctaH: bh(cta),
        secOut: sec ? out(sec) : false,
        secVis: +vis(sec).toFixed(1),
        secH: bh(sec),
        actBottomGap: actR ? +(appR.bottom - actR.bottom).toFixed(2) : null,
        padY:
          (parseFloat(getComputedStyle(oc).paddingTop) || 0) +
          (parseFloat(getComputedStyle(oc).paddingBottom) || 0),
        btnPads: [...(actions?.querySelectorAll('.btn') || [])].map((b) => ({
          t: (b.textContent || '').trim().slice(0, 18),
          h: +b.getBoundingClientRect().height.toFixed(1),
          vis: +vis(b).toFixed(1),
          out: out(b),
          minH: getComputedStyle(b).minHeight,
          pad: getComputedStyle(b).padding,
          fs: getComputedStyle(b).fontSize,
        })),
      };
    },
    { ctaSel, secSel, actionsSel },
  );
}

function classify(m) {
  const hard =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  return hard ? 'HARD' : m.panelOver > 1.5 || m.actionsOut ? 'SOFT' : 'ok';
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

const LOCALES = ['ko', 'en', 'ru', 'pt', 'es'];

try {
  // ---- PAUSE live Escape ----
  for (const size of [
    { width: 400, height: 280 },
    { width: 400, height: 240 },
    { width: 480, height: 288 },
    { width: 568, height: 320 },
  ]) {
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
        await page.goto(`${url}?cb=p162-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.click('#btn-go');
        await page.waitForTimeout(900);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(280);
        const has = await page.$('#overlay-content.screen-pause');
        if (!has) {
          log(`SKIP pause ${loc}@${size.width}x${size.height}`);
          continue;
        }
        let m = await snap(page, '#btn-resume', '#btn-quit', '.pause-actions');
        log(`\n=== ${classify(m)} pause BASE ${loc}@${size.width}x${size.height} ===`, JSON.stringify(m));

        if (classify(m) === 'HARD' || m.secVis < 20) {
          // Trial A: actions compact (gap/pad/btn pad/minH/font) — select tick161 peer
          await page.evaluate(() => {
            const oc = document.getElementById('overlay-content');
            const actions = oc.querySelector('.pause-actions');
            if (!actions) return;
            actions.style.gap = '4px';
            actions.style.padding = '2px';
            for (const b of actions.querySelectorAll('.btn')) {
              b.style.padding = '6px 8px';
              b.style.minHeight = '0';
              b.style.fontSize = '12px';
            }
          });
          m = await snap(page, '#btn-resume', '#btn-quit', '.pause-actions');
          log(`  trial=actionsCompact ${classify(m)}`, JSON.stringify({
            panelOver: m.panelOver,
            actionsH: m.actionsH,
            ctaVis: m.ctaVis,
            secVis: m.secVis,
            secOut: m.secOut,
            actionsOut: m.actionsOut,
            btnPads: m.btnPads,
          }));

          // Trial B: also shrink oc pad
          await page.evaluate(() => {
            const oc = document.getElementById('overlay-content');
            oc.style.paddingTop = '12px';
            oc.style.paddingBottom = '10px';
          });
          m = await snap(page, '#btn-resume', '#btn-quit', '.pause-actions');
          log(`  trial=pad ${classify(m)}`, JSON.stringify({
            panelOver: m.panelOver,
            actionsH: m.actionsH,
            ctaVis: m.ctaVis,
            secVis: m.secVis,
            secOut: m.secOut,
            actionsOut: m.actionsOut,
            padY: m.padY,
          }));
        }
      } finally {
        await page.close();
      }
    }
  }

  // ---- TUTORIAL live @360 / @400 ----
  for (const size of [
    { width: 360, height: 240 },
    { width: 360, height: 200 },
    { width: 400, height: 240 },
    { width: 320, height: 200 },
  ]) {
    for (const loc of ['ko', 'ru', 'pt', 'es', 'en']) {
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
            localStorage.setItem('lao_mini_tutorial_seen', '0');
          },
          { loc },
        );
        await page.goto(`${url}?cb=t162t-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 60000 });
        await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
        await page.click('#btn-go');
        await page.waitForSelector('#overlay-content.screen-tutorial', { timeout: 60000 });
        await page.waitForTimeout(250);
        let m = await snap(page, '#btn-tut-go', '#btn-tut-skip', '.pause-actions');
        log(`\n=== ${classify(m)} tut BASE ${loc}@${size.width}x${size.height} ===`, JSON.stringify({
          panelOver: m.panelOver,
          maxH: m.maxH,
          ocH: m.ocH,
          appH: m.appH,
          brand: m.brand,
          actionsH: m.actionsH,
          ctaVis: `${m.ctaVis}/${m.ctaH}`,
          secVis: `${m.secVis}/${m.secH}`,
          secOut: m.secOut,
          actionsOut: m.actionsOut,
          actBottomGap: m.actBottomGap,
          btnPads: m.btnPads,
        }));

        if (classify(m) === 'HARD' || m.secOut || m.secVis < 20) {
          await page.evaluate(() => {
            const oc = document.getElementById('overlay-content');
            const actions = oc.querySelector('.pause-actions');
            const grid = oc.querySelector('.tutorial-grid');
            if (actions) {
              actions.style.gap = '4px';
              actions.style.padding = '2px 0';
              for (const b of actions.querySelectorAll('.btn')) {
                b.style.padding = '6px 8px';
                b.style.minHeight = '0';
                b.style.fontSize = '12px';
              }
              const cta = actions.querySelector('.btn-cta');
              if (cta) cta.style.minWidth = '0';
            }
            if (grid) {
              const cur = parseFloat(grid.style.minHeight) || 0;
              if (cur > 0) grid.style.minHeight = `${Math.max(0, cur - 24)}px`;
            }
          });
          m = await snap(page, '#btn-tut-go', '#btn-tut-skip', '.pause-actions');
          log(`  trial=actionsCompact ${classify(m)}`, JSON.stringify({
            panelOver: m.panelOver,
            actionsH: m.actionsH,
            ctaVis: `${m.ctaVis}/${m.ctaH}`,
            secVis: `${m.secVis}/${m.secH}`,
            secOut: m.secOut,
            actionsOut: m.actionsOut,
            actBottomGap: m.actBottomGap,
          }));
        }
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

writeFileSync(join(root, 'tools', 'probe-tick162-pause-tut.out.txt'), lines.join('\n') + '\n');
log('\nWrote probe-tick162-pause-tut.out.txt');
