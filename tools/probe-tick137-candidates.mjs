/**
 * Tick137 candidates: thin-viewport residual outside closed tip/rim/charge /
 * title135 / pause131 / tutorial132 / result133 / select134 / OPTIONS136.
 * Prefer live panelOver / CTA OOB / kitClip / scroll soft floor / loading.
 * HI uses .keys-hiscore (not the tick136 false-positive .keys-hi).
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

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru'];
const SIZES = [
  { width: 640, height: 360 },
  { width: 720, height: 400 },
  { width: 800, height: 450 },
  { width: 1280, height: 560 },
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

        // ---- TITLE (correct HI) ----
        await page.goto(`${url}?cb=r137t-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(60);
        const title = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.keys-grid');
          const rules = oc.querySelector('.keys-rules');
          const hi = oc.querySelector('.keys-hiscore');
          const start = document.getElementById('btn-start');
          const brand = oc.querySelector('.brand-mark');
          const gR = grid?.getBoundingClientRect();
          const rR = rules?.getBoundingClientRect();
          const hiR = hi?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            rulesH: rR ? +rR.height.toFixed(1) : 0,
            rulesDisplay: rules ? getComputedStyle(rules).display : 'none',
            hiInside: hi ? !boxOut(hi, ocR) : false,
            hiH: hiR ? +hiR.height.toFixed(1) : 0,
            startOut: start ? boxOut(start, appR) : true,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'title', loc, w: size.width, h: size.height, ...title });

        // ---- LOADING stress ----
        const loading = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const stressMap = {
            ko: '스테이지 자원을 불러오는 중… 거의 완료 (98%) — 캐릭터 초상화와 이펙트 팩',
            en: 'Loading stage assets… nearly done (98%) — character portraits and effect packs',
            pt: 'Carregando recursos do estágio… quase pronto (98%) — retratos e pacotes de efeitos',
            es: 'Cargando recursos de etapa… casi listo (98%) — retratos y paquetes de efectos',
            ru: 'Загрузка ресурсов этапа… почти готово (98%) — портреты и пакеты эффектов',
          };
          const content = document.getElementById('overlay-content');
          const overlay = document.getElementById('overlay');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-loading';
          content.style.cssText = '';
          content.innerHTML = `
            <span class="brand-mark" aria-hidden="true"></span>
            <h2>LOADING</h2>
            <span class="loading-deco" aria-hidden="true"></span>
            <p id="loading-label">${stressMap[loc] || stressMap.en}</p>
            <div class="load-track"><div class="load-fill" style="width:72%"></div></div>
            <div class="load-meta"><span id="load-pct">72%</span></div>
          `;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const lab = document.getElementById('loading-label');
          const deco = content.querySelector('.loading-deco');
          const meta = content.querySelector('.load-meta');
          const labR = lab?.getBoundingClientRect();
          const oh = lab
            ? {
                h: +(labR.height || 0).toFixed(1),
                lines: Math.round((labR.height || 0) / (parseFloat(getComputedStyle(lab).lineHeight) || 16)),
                clipY: lab.scrollHeight > lab.clientHeight + 2,
                clipX: lab.scrollWidth > lab.clientWidth + 2,
              }
            : null;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            decoH: deco ? +deco.getBoundingClientRect().height.toFixed(1) : 0,
            labelOh: oh,
            labelOut: lab ? boxOut(lab, appR) : true,
            metaOut: meta ? boxOut(meta, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'loading', loc, w: size.width, h: size.height, ...loading });

        // ---- OPTIONS after tick136 ----
        await page.goto(`${url}?cb=r137o-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForTimeout(120);
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
          const keys = oc.querySelector('.opt-keys');
          const back = document.getElementById('btn-options-back') || oc.querySelector('.opt-actions .btn');
          const brand = oc.querySelector('.opt-head .brand-mark');
          const h2 = oc.querySelector('.opt-head h2');
          const rows = [...(scroll?.querySelectorAll('.opt-row, .opt-block, .opt-lang, .opt-slider') || [])];
          const bgm = rows.find((r) => /bgm|BGM|음악|Música|Música|Музык/i.test(r.textContent || ''));
          const sfx = rows.find((r) => /sfx|SFX|효과|Efeitos|Efectos|Звук/i.test(r.textContent || ''));
          const sR = scroll?.getBoundingClientRect();
          const bR = bgm?.getBoundingClientRect();
          const nested =
            keys &&
            getComputedStyle(keys).overflowY !== 'visible' &&
            keys.scrollHeight > keys.clientHeight + 2;
          const labels = [...(scroll?.querySelectorAll('label, .opt-label, .opt-row span') || [])];
          const labelClip = labels.some(
            (el) => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
          );
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            scrollH: sR ? +sR.height.toFixed(1) : 0,
            backOut: back ? boxOut(back, appR) : true,
            nested: !!nested,
            labelClip,
            isShort: oc.classList.contains('is-opt-short'),
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2Display: h2 ? getComputedStyle(h2).display : 'none',
            bgmFully: !!(bgm && bR && sR && bR.top >= sR.top - 1 && bR.bottom <= sR.bottom + 1),
            sfxInView: !!(sfx && sR && sfx.getBoundingClientRect().top < sR.bottom - 4),
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'options', loc, w: size.width, h: size.height, ...options });

        // ---- SELECT long-kit residual ----
        await page.goto(`${url}?cb=r137s-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForTimeout(240);
        await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.char-card, [data-char]')];
          const prefer = cards.find((c) =>
            /eternity|labiata|emily|merlin/i.test(c.dataset?.char || c.id || c.className),
          );
          (prefer || cards[cards.length - 1])?.click();
        });
        await page.waitForTimeout(100);
        const select = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          if (!oc?.classList.contains('screen-select')) {
            return { skipped: true, cls: oc?.className || '' };
          }
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.char-grid, .select-grid');
          const kit = oc.querySelector('.select-dossier-kit');
          const hint = oc.querySelector('.select-dossier-hint');
          const name = oc.querySelector('.select-dossier-name');
          const cta =
            document.getElementById('btn-sortie') ||
            document.getElementById('btn-confirm') ||
            oc.querySelector('.select-actions .btn');
          const dossier = oc.querySelector('.select-dossier');
          const gR = grid?.getBoundingClientRect();
          const kR = kit?.getBoundingClientRect();
          const kitCs = kit ? getComputedStyle(kit) : null;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            kitH: kR ? +kR.height.toFixed(1) : 0,
            kitClip: kit ? kit.scrollHeight > kit.clientHeight + 2 : false,
            kitWrap: kit ? kit.scrollWidth > kit.clientWidth + 2 : false,
            kitLines: kit && kitCs
              ? Math.round((kR.height || 0) / (parseFloat(kitCs.lineHeight) || 14))
              : 0,
            kitTextLen: kit ? (kit.textContent || '').trim().length : 0,
            nameClip: name ? name.scrollWidth > name.clientWidth + 2 : false,
            hintDisplay: hint ? getComputedStyle(hint).display : 'none',
            ctaOut: cta ? boxOut(cta, appR) : true,
            dossierFlat: dossier
              ? getComputedStyle(dossier).backgroundImage === 'none' ||
                getComputedStyle(dossier).backgroundImage === ''
              : false,
            dossierPad: dossier ? getComputedStyle(dossier).padding : '',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...select });

        // pause/result use closed-over sync* (not on window) — covered by
        // qa-pause-panel-i18n / qa-result-panel-i18n; skip synthetic markup here.
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
  if (f.screen === 'title') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.startOut ||
      !f.hiInside ||
      (f.h <= 400 && f.gridH > 0 && f.gridH < 36) ||
      (f.h <= 400 && f.rulesDisplay === 'none')
    );
  }
  if (f.screen === 'loading') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.labelOut ||
      f.metaOut ||
      f.labelOh?.clipY ||
      f.labelOh?.clipX
    );
  }
  if (f.screen === 'options') {
    return (
      f.backOut ||
      f.nested ||
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      (f.h <= 400 && f.scrollH > 0 && f.scrollH < 140) ||
      (f.h <= 400 && f.bgmFully === false)
    );
  }
  if (f.screen === 'select') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.ctaOut ||
      (f.gridH > 0 && f.gridH < 36) ||
      f.kitClip ||
      f.kitWrap ||
      f.nameClip
    );
  }
  return false;
});

const soft = findings.filter((f) => {
  if (muddy.includes(f) || f.skipped) return false;
  if (f.screen === 'loading') {
    if (f.h <= 480 && f.decoDisplay === 'block' && f.headroom > 40) return true;
    if (f.labelOh?.lines >= 3 && f.headroom > 30) return true;
  }
  if (f.screen === 'title') {
    if (f.brandDisplay === 'none' && f.h >= 450 && f.panelOver < -40) return true;
  }
  if (f.screen === 'select') {
    if (f.h <= 400 && f.kitH > 0 && f.kitH < 28) return true;
    if (f.h <= 400 && f.hintDisplay === 'none') return true;
    if (f.h <= 400 && f.dossierFlat && f.kitLines >= 3) return true;
  }
  if (f.screen === 'options') {
    if (f.h <= 450 && f.scrollH > 0 && f.scrollH < 150 && !f.sfxInView) return true;
  }
  return false;
});

const out = {
  muddyCount: muddy.length,
  softCount: soft.length,
  muddy,
  soft,
  byScreen: {
    title: findings.filter((f) => f.screen === 'title'),
    loading: findings.filter((f) => f.screen === 'loading'),
    options: findings.filter((f) => f.screen === 'options'),
    select: findings.filter((f) => f.screen === 'select'),
  },
};

const outPath = join(root, 'tools', 'probe-tick137-candidates-out.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      soft: out.soft.slice(0, 50),
      samples: {
        title360: out.byScreen.title.filter((r) => r.h === 360 || r.h === 560),
        opt360: out.byScreen.options.filter((r) => r.h === 360 || r.h === 400),
        sel360: out.byScreen.select.filter((r) => r.h === 360 || r.h === 400),
        load450: out.byScreen.loading.filter((r) => r.h === 450 || r.h === 360),
      },
    },
    null,
    2,
  ),
);
process.exit(0);
