/**
 * Tick128 residuals: select@800 thin grid, OPTIONS nested scroll,
 * rotate portrait card, title lobby CTA.
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

try {
  // ---- SELECT + OPTIONS @800×450 ----
  for (const loc of LOCALES) {
    const page = await browser.newPage({
      viewport: { width: 800, height: 450 },
      hasTouch: false,
      isMobile: false,
    });
    try {
      await page.addInitScript(({ loc }) => {
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
      }, { loc });
      await page.goto(`${url}?cb=r128-${Date.now()}-${loc}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-options', { timeout: 60000 });

      // OPTIONS nested
      await page.click('#btn-options');
      await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
      await page.waitForTimeout(100);
      const opt = await page.evaluate((boxOutSrc) => {
        const boxOut = new Function(`return (${boxOutSrc})`)();
        const app = document.getElementById('app');
        const content = document.getElementById('overlay-content');
        const back = document.getElementById('btn-opt-back');
        const scroll = document.querySelector('.opt-scroll');
        const keys = document.querySelector('.opt-keys');
        const appR = app?.getBoundingClientRect();
        const ocR = content?.getBoundingClientRect();
        return {
          backOut: !!(back && appR && boxOut(back, appR)),
          nested: !!(
            scroll &&
            keys &&
            scroll.scrollHeight > scroll.clientHeight + 2 &&
            keys.scrollHeight > keys.clientHeight + 2
          ),
          scrollCan: !!(scroll && scroll.scrollHeight > scroll.clientHeight + 2),
          keysCan: !!(keys && keys.scrollHeight > keys.clientHeight + 2),
          scroll: scroll
            ? { sh: scroll.scrollHeight, ch: scroll.clientHeight }
            : null,
          keys: keys
            ? {
                sh: keys.scrollHeight,
                ch: keys.clientHeight,
                maxH: getComputedStyle(keys).maxHeight,
              }
            : null,
          panelMaxH: content ? getComputedStyle(content).maxHeight : null,
          panelH: Math.round(ocR?.height || 0),
          appH: Math.round(appR?.height || 0),
        };
      }, boxOut.toString());
      findings.push({ screen: 'opt', loc, ...opt });
      await page.click('#btn-opt-back');
      await page.waitForSelector('#btn-start', { timeout: 30000 });

      // SELECT
      await page.click('#btn-start');
      await page.waitForSelector('#btn-go', { timeout: 60000 });
      await page.waitForTimeout(140);
      const sel = await page.evaluate((boxOutSrc) => {
        const boxOut = new Function(`return (${boxOutSrc})`)();
        const app = document.getElementById('app');
        const content = document.getElementById('overlay-content');
        const go = document.getElementById('btn-go');
        const grid = document.querySelector('.char-grid');
        const blurb = document.querySelector('.select-blurb, .dossier-blurb, .char-blurb, .select-hint');
        const deco = document.querySelector('.sortie-deco, .select-deco');
        const appR = app?.getBoundingClientRect();
        const ocR = content?.getBoundingClientRect();
        const cards = [...document.querySelectorAll('.char-card')];
        const cardHs = cards.map((c) => Math.round(c.getBoundingClientRect().height));
        const minCard = cardHs.length ? Math.min(...cardHs) : 0;
        const visibleRows = grid
          ? Math.max(1, Math.floor((grid.clientHeight + 4) / Math.max(1, minCard || 1)))
          : 0;
        return {
          goOut: !!(go && appR && boxOut(go, appR)),
          goOcOut: !!(go && ocR && boxOut(go, ocR)),
          gridH: grid ? Math.round(grid.getBoundingClientRect().height) : 0,
          gridCh: grid?.clientHeight || 0,
          gridSh: grid?.scrollHeight || 0,
          minCard,
          maxCard: cardHs.length ? Math.max(...cardHs) : 0,
          cardCount: cards.length,
          visibleRowsApprox: visibleRows,
          canScroll: !!(grid && grid.scrollHeight > grid.clientHeight + 2),
          panelMaxH: content ? getComputedStyle(content).maxHeight : null,
          panelH: Math.round(ocR?.height || 0),
          blurbH: blurb ? Math.round(blurb.getBoundingClientRect().height) : null,
          decoDisplay: deco ? getComputedStyle(deco).display : null,
          kitOh: (() => {
            const kit = document.querySelector('.char-kit, .dossier-kit, .kit-line');
            if (!kit) return null;
            return {
              ohY: kit.scrollHeight > kit.clientHeight + 1,
              ohX: kit.scrollWidth > kit.clientWidth + 1,
              text: (kit.textContent || '').trim().slice(0, 60),
            };
          })(),
        };
      }, boxOut.toString());
      findings.push({ screen: 'select', loc, ...sel });
    } catch (err) {
      findings.push({ screen: 'error', loc, text: String(err.message || err).slice(0, 200) });
    } finally {
      await page.close();
    }
  }

  // ---- ROTATE portrait ----
  for (const size of [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 320, height: 568 },
  ]) {
    for (const loc of ['es', 'ru', 'en', 'pt']) {
      const page = await browser.newPage({
        viewport: size,
        hasTouch: true,
        isMobile: true,
      });
      try {
        await page.addInitScript(({ loc }) => {
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
        }, { loc });
        await page.goto(`${url}?cb=rot128-${Date.now()}-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForTimeout(250);
        const rot = await page.evaluate(async ({ loc }) => {
          const hint = document.getElementById('rotate-hint');
          if (!hint) return { error: 'no hint' };
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            const strong = hint.querySelector('strong');
            const p = hint.querySelector('p');
            if (strong && mod?.t) strong.textContent = mod.t('rotate.title');
            if (p && mod?.t) p.innerHTML = mod.t('rotate.body');
          } catch { /* */ }
          hint.classList.add('is-on');
          const card = hint.querySelector('.rotate-card');
          const strong = hint.querySelector('strong');
          const p = hint.querySelector('p');
          const cardR = card?.getBoundingClientRect();
          const overBottom = cardR ? cardR.bottom - innerHeight : 0;
          const overTop = cardR ? -cardR.top : 0;
          return {
            title: (strong?.textContent || '').trim(),
            body: (p?.textContent || '').trim().slice(0, 100),
            cardH: Math.round(cardR?.height || 0),
            cardW: Math.round(cardR?.width || 0),
            overBottom: +overBottom.toFixed(2),
            overTop: +overTop.toFixed(2),
            strongOhX: !!(strong && strong.scrollWidth > strong.clientWidth + 1),
            strongOhY: !!(strong && strong.scrollHeight > strong.clientHeight + 1),
            bodyOhX: !!(p && p.scrollWidth > p.clientWidth + 1),
            bodyOhY: !!(p && p.scrollHeight > p.clientHeight + 1),
            bodySh: p?.scrollHeight,
            bodyCh: p?.clientHeight,
            vh: innerHeight,
            vw: innerWidth,
          };
        }, { loc });
        findings.push({ screen: 'rotate', loc, w: size.width, h: size.height, ...rot });
      } catch (err) {
        findings.push({
          screen: 'error-rot',
          loc,
          w: size.width,
          h: size.height,
          text: String(err.message || err).slice(0, 200),
        });
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
  if (f.screen === 'opt') return f.backOut || f.nested;
  if (f.screen === 'select') {
    return f.goOut || f.goOcOut || (f.minCard > 0 && f.minCard < 48) || f.kitOh?.ohY || f.kitOh?.ohX;
  }
  if (f.screen === 'rotate') {
    return f.overBottom > 1.5 || f.overTop > 1.5 || f.strongOhX || f.strongOhY || f.bodyOhX || f.bodyOhY;
  }
  return f.screen.startsWith('error');
});

console.log(
  JSON.stringify(
    {
      muddyCount: muddy.length,
      muddy,
      opt: findings.filter((f) => f.screen === 'opt'),
      select: findings.filter((f) => f.screen === 'select'),
      rotate: findings.filter((f) => f.screen === 'rotate'),
    },
    null,
    2,
  ),
);
