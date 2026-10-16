/**
 * Tick141 verify: SE-class select/OPTIONS maxCap floor.
 * Expect @568×320: headroom≥0 / panelOver≤0 / CTA clear / floors kept;
 * @640×360 / @800×450 unchanged (CTA clear, floors ≥ prior soft).
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'ja'];
const SIZES = [
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 800, height: 450 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      const page = await browser.newPage({
        viewport: size,
        hasTouch: false,
        isMobile: false,
      });
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
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
          },
          { loc },
        );
        await page.goto(`${url}?cb=r141v-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        // OPTIONS
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
          const sR = scroll?.getBoundingClientRect();
          const bgm = oc.querySelector('#opt-bgm')?.closest('label, .opt-row, .opt-slider, div');
          const maxH = parseFloat(oc.style.maxHeight) || parseFloat(getComputedStyle(oc).maxHeight) || 0;
          return {
            screen: 'options',
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            scrollH: sR ? +sR.height.toFixed(1) : 0,
            backOut: back ? boxOut(back, appR) : true,
            bgmInFirst: bgm && sR
              ? bgm.getBoundingClientRect().bottom <= sR.bottom + 2
              : false,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            maxH: +maxH.toFixed(1),
            appH: +appR.height.toFixed(1),
            maxHFitsApp: maxH <= appR.height + 0.5,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ loc, w: size.width, h: size.height, ...options });

        await page.evaluate(() => {
          const b =
            document.getElementById('btn-opt-back') ||
            document.getElementById('btn-back') ||
            [...document.querySelectorAll('button')].find((el) =>
              /back|뒤로|voltar|atrás|назад|戻る|返回/i.test(el.textContent || ''),
            );
          b?.click();
        });
        await page.waitForTimeout(80);

        // SELECT
        await page.click('#btn-start');
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
          const sortie =
            document.getElementById('btn-confirm') ||
            document.getElementById('btn-sortie') ||
            oc.querySelector('.select-actions .btn-primary, .select-actions .btn');
          const gR = grid?.getBoundingClientRect();
          const maxH = parseFloat(oc.style.maxHeight) || parseFloat(getComputedStyle(oc).maxHeight) || 0;
          return {
            screen: 'select',
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            sortieOut: sortie ? boxOut(sortie, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            maxH: +maxH.toFixed(1),
            appH: +appR.height.toFixed(1),
            maxHFitsApp: maxH <= appR.height + 0.5,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ loc, w: size.width, h: size.height, ...select });
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

const muddy = findings.filter((f) => {
  if (f.skipped) return false;
  if (f.screen === 'options') {
    return (
      f.panelOver > 1.5 ||
      f.backOut ||
      !f.maxHFitsApp ||
      (f.h <= 320 && f.headroom < 0) ||
      (f.h <= 400 && f.scrollH < 120)
    );
  }
  if (f.screen === 'select') {
    return (
      f.panelOver > 1.5 ||
      f.sortieOut ||
      !f.maxHFitsApp ||
      (f.h <= 320 && f.headroom < 0) ||
      (f.h <= 400 && f.gridH < 36)
    );
  }
  return false;
});

const out = { muddyCount: muddy.length, muddy, findings };
writeFileSync(join(root, 'tools', 'probe-tick141-maxcap-floor-out.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      muddy: out.muddy,
      se320: findings.filter((f) => f.h === 320),
      sample360: findings.filter((f) => f.h === 360 && ['es', 'ru'].includes(f.loc)),
      sample450: findings.filter((f) => f.h === 450 && ['es', 'ru'].includes(f.loc)),
    },
    null,
    2,
  ),
);
