/**
 * Tick161: verify select CTA/back OOB clear at ru/pt/es@400×240·280
 * after syncSelectPanelBudget chrome ladder (actions→brand→h2→pad).
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

const LOCALES = ['ko', 'en', 'ru', 'pt', 'es', 'zh-Hant', 'ja'];
const SIZES = [
  { width: 400, height: 280 },
  { width: 400, height: 240 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });

function classify(m) {
  const isHard = m.ctaOut || (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2));
  const isSoft = !isHard && (m.panelOver > 1.5 || m.actionsOut || m.backOut);
  return isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok';
}

async function measureAt(page, trial) {
  return page.evaluate((trial) => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    const head = oc.querySelector('.sortie-head');
    const brand = head?.querySelector('.brand-mark');
    const h2 = head?.querySelector('h2');
    const dossier = oc.querySelector('.select-dossier');
    const hint = oc.querySelector('.select-dossier-hint');
    const grid = oc.querySelector('.char-grid');
    const actions = oc.querySelector('.select-actions');
    const cta =
      oc.querySelector('#btn-confirm') ||
      oc.querySelector('.select-actions .btn-primary') ||
      oc.querySelector('.select-actions .btn');
    const back =
      oc.querySelector('#btn-back') ||
      oc.querySelector('.select-actions .lobby-ico-back')?.closest('.btn');
    const kit = oc.querySelector('#select-dossier-kit');

    const apply = (fn) => {
      fn();
      void oc.offsetHeight;
    };

    if (trial === 'hint') {
      apply(() => {
        if (hint) hint.style.display = 'none';
      });
    } else if (trial === 'brand') {
      apply(() => {
        if (hint) hint.style.display = 'none';
        if (brand) brand.style.display = 'none';
      });
    } else if (trial === 'h2') {
      apply(() => {
        if (hint) hint.style.display = 'none';
        if (brand) brand.style.display = 'none';
        if (h2) {
          h2.style.fontSize = '16px';
          h2.style.margin = '0';
          h2.style.letterSpacing = '0.1em';
        }
      });
    } else if (trial === 'pad') {
      apply(() => {
        if (hint) hint.style.display = 'none';
        if (brand) brand.style.display = 'none';
        if (h2) {
          h2.style.fontSize = '16px';
          h2.style.margin = '0';
          h2.style.letterSpacing = '0.1em';
        }
        if (dossier) {
          dossier.style.padding = '2px 4px';
          dossier.style.marginBottom = '2px';
        }
        actions.style.padding = '2px 0';
        oc.style.paddingTop = '10px';
        oc.style.paddingBottom = '8px';
      });
    } else if (trial === 'reset') {
      apply(() => {
        if (hint) hint.style.display = '';
        if (brand) brand.style.display = '';
        if (h2) {
          h2.style.fontSize = '';
          h2.style.margin = '';
          h2.style.letterSpacing = '';
        }
        if (dossier) {
          dossier.style.padding = '';
          dossier.style.marginBottom = '';
        }
        actions.style.padding = '';
        oc.style.paddingTop = '';
        oc.style.paddingBottom = '';
        // re-run budget if available
        if (typeof window.syncSelectPanelBudget === 'function') {
          window.syncSelectPanelBudget();
        }
      });
    }

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
    const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
    const actR = actions.getBoundingClientRect();
    const overApp = Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top);
    const overOc = Math.max(0, actR.bottom - (ocR.bottom + 1), (ocR.top - 1) - actR.top);
    return {
      trial,
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: getComputedStyle(oc).maxHeight,
      gridMin: grid?.style.minHeight || '',
      gridH: bh(grid),
      headH: bh(head),
      brandH: bh(brand),
      brandDisp: brand ? getComputedStyle(brand).display : '',
      h2H: bh(h2),
      dossierH: bh(dossier),
      hintH: bh(hint),
      hintDisp: hint ? getComputedStyle(hint).display : '',
      actionsH: bh(actions),
      ctaOut: out(cta),
      ctaVis: +vis(cta).toFixed(1),
      ctaH: bh(cta),
      backOut: back ? out(back) : false,
      backVis: +vis(back).toFixed(1),
      actionsOut: out(actions),
      ctaOver: +Math.max(overApp, overOc).toFixed(2),
      kitText: kit?.textContent?.slice(0, 40) || '',
      kitVis: +vis(kit).toFixed(1),
      padY:
        (parseFloat(getComputedStyle(oc).paddingTop) || 0) +
        (parseFloat(getComputedStyle(oc).paddingBottom) || 0),
    };
  }, trial);
}

const hard = [];
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
        await page.goto(`${url}?cb=t161-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForSelector('#overlay-content.screen-select, .char-card, #btn-confirm', {
          timeout: 60000,
        });
        await page.waitForTimeout(250);

        const base = await measureAt(page, 'base');
        const tag = `${loc}@${size.width}x${size.height}`;
        const cls = classify(base);
        console.log(
          `\n=== ${cls} ${tag} BASE ===`,
          `over=${base.panelOver} maxH=${base.maxH} gridMin=${base.gridMin} gridH=${base.gridH}`,
          `head=${base.headH} brand=${base.brandH}/${base.brandDisp} h2=${base.h2H}`,
          `dossier=${base.dossierH} hint=${base.hintH}/${base.hintDisp}`,
          `actions=${base.actionsH} padY=${base.padY}`,
          `ctaOut=${base.ctaOut} ctaVis=${base.ctaVis}/${base.ctaH} ctaOver=${base.ctaOver}`,
          `backOut=${base.backOut} actionsOut=${base.actionsOut}`,
        );
        if (cls === 'HARD' || base.ctaOver > 0.5) {
          hard.push({ tag, ...base });
          for (const trial of ['hint', 'brand', 'h2', 'pad']) {
            const m = await measureAt(page, trial);
            const tcls = classify(m);
            console.log(
              `  trial=${trial} ${tcls}`,
              `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH} ctaOver=${m.ctaOver}`,
              `backOut=${m.backOut} actionsOut=${m.actionsOut}`,
              `head=${m.headH} brand=${m.brandH} h2=${m.h2H} dossier=${m.dossierH} hint=${m.hintDisp}`,
              `actions=${m.actionsH} padY=${m.padY} kitVis=${m.kitVis}`,
            );
          }
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

console.log('\n=== HARD SUMMARY ===');
console.log(`count=${hard.length}`);
for (const h of hard) {
  console.log(
    h.tag,
    `ctaOver=${h.ctaOver} ctaVis=${h.ctaVis}/${h.ctaH}`,
    `head=${h.headH} brand=${h.brandH} dossier=${h.dossierH} hint=${h.hintH} actions=${h.actionsH} grid=${h.gridH}`,
  );
}
