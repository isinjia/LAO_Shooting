/**
 * Tick166 — pause @320×200 quit HARD trial (live Escape).
 * Measure current + proposed ultra ladder after tick162 compact.
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
const size = { width: 320, height: 200 };
const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

const measureAndTrial = async (page) =>
  page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    const actions = oc.querySelector('.pause-actions');
    const blurb = oc.querySelector('.pause-blurb');
    const brand = oc.querySelector('.pause-stamp .brand-mark');
    const h2 = oc.querySelector('.pause-stamp h2');
    const resume = oc.querySelector('#btn-resume');
    const quit = oc.querySelector('#btn-quit');
    const snap = (label) => {
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
      return {
        label,
        panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
        maxH: oc.style.maxHeight || '',
        fitH: Math.floor(Math.min(app.clientHeight || 0, appR.height)),
        ctaOut: resume ? out(resume) : true,
        ctaVis: +vis(resume).toFixed(1),
        ctaH: +(resume?.getBoundingClientRect().height || 0).toFixed(1),
        secOut: quit ? out(quit) : true,
        secVis: +vis(quit).toFixed(1),
        secH: +(quit?.getBoundingClientRect().height || 0).toFixed(1),
        actionsOut: actions ? out(actions) : false,
        btnMinH: resume ? resume.style.minHeight || getComputedStyle(resume).minHeight : '',
        gap: actions ? actions.style.gap || getComputedStyle(actions).gap : '',
        padT: oc.style.paddingTop || '',
        blurbDisp: blurb ? getComputedStyle(blurb).display : '',
        brandDisp: brand ? getComputedStyle(brand).display : '',
        h2Fs: h2 ? h2.style.fontSize || getComputedStyle(h2).fontSize : '',
      };
    };

    const quitUnread = () => {
      void oc.offsetHeight;
      const appR = app.getBoundingClientRect();
      const ocR = oc.getBoundingClientRect();
      const actR = actions.getBoundingClientRect();
      const overApp = Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top);
      const overOc = Math.max(0, actR.bottom - (ocR.bottom + 1), (ocR.top - 1) - actR.top);
      let unread = 0;
      if (quit) {
        const r = quit.getBoundingClientRect();
        const vis = Math.max(
          0,
          Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
            Math.max(r.top, Math.max(ocR.top, appR.top)),
        );
        const need = Math.min(20, Math.max(0, r.height - 2));
        if (vis + 0.5 < need) unread = need - vis;
        if (r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5) {
          unread = Math.max(unread, r.bottom - (appR.bottom + 1));
        }
      }
      return Math.max(overApp, overOc, unread);
    };

    const steps = [snap('before')];
    // Trial ultra ladder (tick164/165 peer) — only if still muddy
    if (quitUnread() > 0.5) {
      // ultra compact
      actions.style.padding = '1px';
      actions.style.gap = '2px';
      for (const b of actions.querySelectorAll('.btn')) {
        b.style.padding = '4px 6px';
        b.style.minHeight = '24px';
        b.style.fontSize = '11px';
      }
      const cta = actions.querySelector('.btn-cta');
      if (cta) cta.style.minWidth = '0';
      steps.push(snap('ultraCompact'));
    }
    if (quitUnread() > 0.5 && blurb) {
      blurb.style.display = 'none';
      steps.push(snap('blurbHide'));
    }
    if (quitUnread() > 0.5) {
      oc.classList.add('is-pause-short');
      if (brand) brand.style.display = 'none';
      if (h2) {
        h2.style.fontSize = '16px';
        h2.style.margin = '0';
        h2.style.letterSpacing = '0.1em';
      }
      steps.push(snap('headCompact'));
    }
    if (quitUnread() > 0.5) {
      oc.style.paddingTop = '8px';
      oc.style.paddingBottom = '6px';
      steps.push(snap('padUltra'));
    }
    if (quitUnread() > 0.5) {
      const appH = app.clientHeight || window.innerHeight || 200;
      const appBoxH = app.getBoundingClientRect().height || appH;
      const fitH = Math.floor(Math.min(appH, appBoxH));
      const floorCap = Math.min(280, fitH);
      const ratioCap = Math.floor(fitH * 0.96);
      oc.style.maxHeight = `${Math.max(floorCap, Math.min(fitH, ratioCap))}px`;
      steps.push(snap('fitH'));
    }
    return { unreadFinal: quitUnread(), steps };
  });

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
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
      await page.goto(`${url}?cb=t166trial-${loc}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      await page.click('#btn-start');
      await page.waitForSelector('#btn-go', { timeout: 60000 });
      await page.waitForTimeout(80);
      await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
      await page.waitForTimeout(40);
      await page.click('#btn-go');
      await page.waitForTimeout(900);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(280);
      const hasPause = await page.$('#overlay-content.screen-pause');
      if (!hasPause) {
        log(`SKIP ${loc}`);
        continue;
      }
      const r = await measureAndTrial(page);
      log(`=== ${loc}@320x200 unreadFinal=${r.unreadFinal.toFixed(2)}`);
      for (const s of r.steps) {
        log(
          `  ${s.label}`,
          `over=${s.panelOver} maxH=${s.maxH} fitH=${s.fitH}`,
          `cta=${s.ctaVis}/${s.ctaH} out=${s.ctaOut}`,
          `quit=${s.secVis}/${s.secH} out=${s.secOut}`,
          `actOut=${s.actionsOut} btnMinH=${s.btnMinH} gap=${s.gap}`,
          `padT=${s.padT} blurb=${s.blurbDisp} brand=${s.brandDisp} h2=${s.h2Fs}`,
        );
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const outPath = join(root, 'tools', 'probe-tick166-pause-320-trial.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
