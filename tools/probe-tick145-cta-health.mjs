/**
 * Tick145: OPTIONS / tutorial CTA-health Math.max(260) re-inflate past fitH.
 * Prefer live showOptions / showTutorialThen path (parity with tick144 select).
 * Flags: inflated (maxH > fitH), panelOver, ctaOut, healthSteps via monkey-patch.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
  { width: 360, height: 240 },
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
      localStorage.setItem('lao_mini_tutorial_seen', '1');
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
      window.__tick145Health = { options: 0, tutorial: 0, optionsCaps: [], tutorialCaps: [] };
    },
    { loc },
  );
  await page.goto(`${url}?cb=t145h-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  // Patch Math.max to count CTA-health re-inflate floor hits (260).
  await page.evaluate(() => {
    const orig = Math.max;
    Math.max = function (...args) {
      if (
        args.length >= 2 &&
        args[0] === 260 &&
        typeof args[1] === 'number' &&
        Number.isFinite(args[1])
      ) {
        const st = window.__tick145Health;
        if (st) {
          const screen = document
            .getElementById('overlay-content')
            ?.classList?.contains('screen-options')
            ? 'options'
            : document
                  .getElementById('overlay-content')
                  ?.classList?.contains('screen-tutorial')
              ? 'tutorial'
              : 'other';
          if (screen === 'options') {
            st.options += 1;
            st.optionsCaps.push(args[1]);
          } else if (screen === 'tutorial') {
            st.tutorial += 1;
            st.tutorialCaps.push(args[1]);
          }
        }
      }
      return orig.apply(Math, args);
    };
  });
  return page;
}

function measure(screen) {
  return ({ boxOutSrc, screen }) => {
    const boxOut = eval(`(${boxOutSrc})`);
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    const back =
      document.getElementById('btn-options-back') ||
      document.getElementById('btn-begin') ||
      oc?.querySelector('.opt-actions .btn, .pause-actions .btn, .btn-cta, .btn-primary');
    const scroll = oc?.querySelector('.opt-scroll, .tutorial-grid, .char-grid');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const maxH = parseFloat(oc.style.maxHeight) || 0;
    const st = window.__tick145Health || {};
    return {
      screen,
      fitH,
      maxH: +maxH.toFixed(2),
      panelOverRaw: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      headroom: +(appR.bottom - ocR.bottom).toFixed(2),
      ctaOut: back ? boxOut(back, appR) : true,
      scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(2) : null,
      inflated: maxH > 0 && maxH > fitH + 0.5,
      maxHFitsApp: !(maxH > 0) || maxH <= appR.height + 0.5,
      healthSteps: screen === 'options' ? st.options || 0 : st.tutorial || 0,
      healthCaps: screen === 'options' ? st.optionsCaps || [] : st.tutorialCaps || [],
    };
  };
}

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // OPTIONS live
      {
        const page = await boot(size, loc);
        try {
          await page.click('#btn-options');
          await page.waitForSelector('#overlay-content.screen-options', { timeout: 30000 });
          await page.waitForTimeout(180);
          const m = await page.evaluate(measure('options'), {
            boxOutSrc: boxOut.toString(),
            screen: 'options',
          });
          const muddy =
            m.inflated ||
            m.panelOverRaw > 1.5 ||
            (m.healthSteps > 0 && m.maxH > m.fitH + 0.5);
          findings.push({ kind: 'options', loc, ...size, ...m, muddy });
          if (muddy || m.healthSteps > 0 || size.height <= 288) {
            console.log(
              `OPT ${loc}@${size.width}x${size.height}`,
              `maxH=${m.maxH} fitH=${m.fitH} over=${m.panelOverRaw} hr=${m.headroom}`,
              `ctaOut=${m.ctaOut} health=${m.healthSteps} inflated=${m.inflated} muddy=${muddy}`,
              m.healthCaps.length ? `caps=${JSON.stringify(m.healthCaps)}` : '',
            );
          }
        } finally {
          await page.close();
        }
      }

      // Tutorial live via select → go (tutorial_seen=0)
      {
        const page = await boot(size, loc);
        try {
          await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '0'));
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 90000 });
          await page.click('#btn-go');
          await page.waitForSelector('#overlay-content.screen-tutorial', { timeout: 30000 });
          await page.waitForTimeout(180);
          const m = await page.evaluate(measure('tutorial'), {
            boxOutSrc: boxOut.toString(),
            screen: 'tutorial',
          });
          const muddy =
            m.inflated ||
            m.panelOverRaw > 1.5 ||
            (m.healthSteps > 0 && m.maxH > m.fitH + 0.5);
          findings.push({ kind: 'tutorial', loc, ...size, ...m, muddy });
          if (muddy || m.healthSteps > 0 || size.height <= 288) {
            console.log(
              `TUT ${loc}@${size.width}x${size.height}`,
              `maxH=${m.maxH} fitH=${m.fitH} over=${m.panelOverRaw} hr=${m.headroom}`,
              `ctaOut=${m.ctaOut} health=${m.healthSteps} inflated=${m.inflated} muddy=${muddy}`,
              m.healthCaps.length ? `caps=${JSON.stringify(m.healthCaps)}` : '',
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
const healthHits = findings.filter((f) => f.healthSteps > 0);
const inflateHits = findings.filter((f) => f.inflated);
console.log('\n=== SUMMARY ===');
console.log('total', findings.length);
console.log('muddyCount', muddy.length);
console.log('healthSteps>0', healthHits.length);
console.log('inflated', inflateHits.length);
if (muddy.length) {
  console.log('MUDDY rows:');
  for (const r of muddy) {
    console.log(
      `  ${r.kind} ${r.loc}@${r.width}x${r.height}`,
      `maxH=${r.maxH} fitH=${r.fitH} over=${r.panelOverRaw} hr=${r.headroom}`,
      `ctaOut=${r.ctaOut} health=${r.healthSteps}`,
    );
  }
}
if (!muddy.length && !healthHits.length) {
  console.log('NO live inflate / healthSteps — Math.max(260) latent only');
}
