/**
 * Tick136 candidates: thin-viewport residual outside closed tip/rim/charge /
 * title135 / pause131 / tutorial132 / result133 / select134 paths.
 * Prefer live panelOver / CTA OOB / kit crush / loading / options / asset-error /
 * rare fanfare / rotate.
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
  { width: 854, height: 480 },
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

        // ---- TITLE verify tick135 floor ----
        await page.goto(`${url}?cb=r136t-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(50);
        const title = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const grid = oc.querySelector('.keys-grid');
          const rules = oc.querySelector('.keys-rules');
          const hi = oc.querySelector('.keys-hi, #keys-hi, .hi-score');
          const start = document.getElementById('btn-start');
          const brand = oc.querySelector('.brand-mark');
          const gR = grid?.getBoundingClientRect();
          const rR = rules?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            rulesH: rR ? +rR.height.toFixed(1) : 0,
            rulesDisplay: rules ? getComputedStyle(rules).display : 'none',
            hiInside: hi ? !boxOut(hi, ocR) : false,
            startOut: start ? boxOut(start, appR) : true,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'title', loc, w: size.width, h: size.height, ...title });

        // ---- LOADING stress mid-progress ----
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
          const track = content.querySelector('.load-track');
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
            metaH: meta ? +meta.getBoundingClientRect().height.toFixed(1) : 0,
            trackH: track ? +track.getBoundingClientRect().height.toFixed(1) : 0,
            labelOut: lab ? boxOut(lab, appR) : true,
            metaOut: meta ? boxOut(meta, appR) : true,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'loading', loc, w: size.width, h: size.height, ...loading });

        // ---- OPTIONS via button ----
        await page.goto(`${url}?cb=r136o-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForTimeout(160);
        const opt = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          if (!oc?.classList.contains('screen-options')) {
            return { skipped: true, cls: oc?.className || '' };
          }
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const back = document.getElementById('btn-opt-back') || oc.querySelector('.opt-actions .btn');
          const scroll = oc.querySelector('.opt-scroll');
          const nested = oc.querySelector('.opt-keys');
          const nestedMax = nested ? getComputedStyle(nested).maxHeight : '';
          const rows = [...oc.querySelectorAll('.opt-row, .opt-block, .opt-toggle, .opt-keys li')];
          const cramped = rows
            .map((el) => {
              const r = el.getBoundingClientRect();
              return { h: +r.height.toFixed(1), text: (el.textContent || '').trim().slice(0, 36) };
            })
            .filter((x) => x.h > 0 && x.h < 14);
          const labels = [...oc.querySelectorAll('.opt-label, .opt-row span, .opt-row label, .opt-keys li')];
          const labelClip = labels.some((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
          });
          const head = oc.querySelector('.opt-head');
          const resource = oc.querySelector('.lobby-resource-strip, .lobby-resource-options');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            backOut: boxOut(back, appR),
            backOcOut: boxOut(back, ocR),
            nested:
              nested &&
              nestedMax !== 'none' &&
              nestedMax !== '' &&
              parseFloat(nestedMax) > 0 &&
              nested.scrollHeight > nested.clientHeight + 2,
            scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(1) : 0,
            scrollNeed: scroll ? scroll.scrollHeight - scroll.clientHeight : 0,
            crampedCount: cramped.length,
            crampedSample: cramped.slice(0, 3),
            labelClip,
            headH: head ? +head.getBoundingClientRect().height.toFixed(1) : 0,
            resourceDisplay: resource ? getComputedStyle(resource).display : 'none',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'options', loc, w: size.width, h: size.height, ...opt });

        // ---- ASSET ERROR ----
        const asset = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const stress = {
            ko: '일부 스테이지 자산을 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.',
            en: 'Some stage assets failed to load. Check your network, then try again.',
            pt: 'Alguns recursos do estágio falharam ao carregar. Verifique a rede e tente novamente.',
            es: 'Algunos recursos de etapa no se cargaron. Comprueba la red e inténtalo de nuevo.',
            ru: 'Не удалось загрузить часть ресурсов этапа. Проверьте сеть и повторите попытку.',
          };
          const loc = localStorage.getItem('lao_mini_settings_v1');
          let lang = 'en';
          try {
            lang = JSON.parse(loc || '{}').lang || 'en';
          } catch {}
          const content = document.getElementById('overlay-content');
          const overlay = document.getElementById('overlay');
          overlay.classList.add('is-on');
          overlay.style.display = 'flex';
          content.className = 'screen-asset-error';
          content.style.cssText = '';
          content.innerHTML = `
            <span class="brand-mark" aria-hidden="true"></span>
            <span class="asset-error-icon" aria-hidden="true"></span>
            <h2>ASSET ERROR</h2>
            <div class="asset-error-msg"><p>${stress[lang] || stress.en}</p></div>
            <span class="asset-error-deco" aria-hidden="true"></span>
            <div class="asset-error-actions"><button type="button" class="btn" id="btn-asset-retry">RETRY</button></div>
          `;
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const msg = content.querySelector('.asset-error-msg p');
          const retry = document.getElementById('btn-asset-retry');
          const icon = content.querySelector('.asset-error-icon');
          const deco = content.querySelector('.asset-error-deco');
          const msgR = msg?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            msgH: msgR ? +msgR.height.toFixed(1) : 0,
            msgClip: msg ? msg.scrollHeight > msg.clientHeight + 2 : false,
            msgOut: msg ? boxOut(msg, appR) : true,
            retryOut: retry ? boxOut(retry, appR) : true,
            iconDisplay: icon ? getComputedStyle(icon).display : 'none',
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            iconH: icon ? +icon.getBoundingClientRect().height.toFixed(1) : 0,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'asset-error', loc, w: size.width, h: size.height, ...asset });

        // ---- RARE FANFARE ----
        const rare = await page.evaluate(async ({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const tags = {
            ko: '귀환 도끼 · 근접 베기 · 희귀 파일럿 — 긴 태그라인 스트레스',
            en: 'Returning axe · close cleave · rare pilot — long tagline stress sample',
            pt: 'Machado de retorno · corte próximo · piloto raro — amostra longa',
            es: 'Hacha de retorno · tajo cercano · piloto raro — etiqueta larga de estrés',
            ru: 'Возвращающийся топор · ближний удар · редкий пилот — длинный тег',
          };
          const loc = JSON.parse(localStorage.getItem('lao_mini_settings_v1') || '{}').lang || 'en';
          const host = document.getElementById('overlay-content') || document.body;
          const el = document.createElement('div');
          el.className = 'rare-fanfare is-on';
          el.innerHTML = `
            <div class="rare-fanfare-burst" aria-hidden="true"></div>
            <div class="rare-fanfare-card">
              <span class="rare-fanfare-title">RARE PILOT</span>
              <div class="rare-fanfare-portrait is-fallback" aria-hidden="true">★</div>
              <strong class="rare-fanfare-name">LABIATA</strong>
              <p class="rare-fanfare-tag">${tags[loc] || tags.en}</p>
              <span class="rare-fanfare-hint">HOLD FIRE</span>
            </div>
          `;
          host.appendChild(el);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const card = el.querySelector('.rare-fanfare-card');
          const tag = el.querySelector('.rare-fanfare-tag');
          const hint = el.querySelector('.rare-fanfare-hint');
          const name = el.querySelector('.rare-fanfare-name');
          const cR = card.getBoundingClientRect();
          return {
            panelOver: +(cR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - cR.top).toFixed(2),
            cardH: +cR.height.toFixed(1),
            cardOut: boxOut(card, appR),
            tagH: tag ? +tag.getBoundingClientRect().height.toFixed(1) : 0,
            tagClip: tag ? tag.scrollHeight > tag.clientHeight + 2 : false,
            hintOut: hint ? boxOut(hint, appR) : true,
            nameOut: name ? boxOut(name, appR) : true,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'rare', loc, w: size.width, h: size.height, ...rare });

        // ---- ROTATE HINT ----
        const rotate = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const el = document.getElementById('rotate-hint');
          if (!el) return { skipped: true };
          el.classList.add('is-on');
          el.style.display = 'flex';
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const card = el.querySelector('.rotate-card') || el;
          const p = el.querySelector('p');
          const strong = el.querySelector('strong');
          const cR = card.getBoundingClientRect();
          return {
            panelOver: +(cR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - cR.top).toFixed(2),
            cardH: +cR.height.toFixed(1),
            cardOut: boxOut(card, appR),
            pH: p ? +p.getBoundingClientRect().height.toFixed(1) : 0,
            pClip: p ? p.scrollHeight > p.clientHeight + 2 : false,
            strongOut: strong ? boxOut(strong, appR) : false,
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'rotate', loc, w: size.width, h: size.height, ...rotate });

        // ---- SELECT residual kit ----
        await page.goto(`${url}?cb=r136s-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForTimeout(220);
        await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.char-card, [data-char]')];
          const prefer = cards.find((c) =>
            /eternity|labiata|emily/i.test(c.dataset?.char || c.id || c.className),
          );
          (prefer || cards[cards.length - 1])?.click();
        });
        await page.waitForTimeout(80);
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
          const cta =
            document.getElementById('btn-sortie') ||
            document.getElementById('btn-confirm') ||
            oc.querySelector('.select-actions .btn');
          const dossier = oc.querySelector('.select-dossier');
          const gR = grid?.getBoundingClientRect();
          const kR = kit?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            kitH: kR ? +kR.height.toFixed(1) : 0,
            kitClip: kit ? kit.scrollHeight > kit.clientHeight + 2 : false,
            hintDisplay: hint ? getComputedStyle(hint).display : 'none',
            ctaOut: cta ? boxOut(cta, appR) : true,
            dossierBox: dossier
              ? getComputedStyle(dossier).backgroundImage.includes('Box2') ||
                getComputedStyle(dossier).backgroundImage !== 'none'
              : false,
            dossierPad: dossier ? getComputedStyle(dossier).padding : '',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...select });
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
    return f.backOut || f.backOcOut || f.nested || f.panelOver > 1.5 || f.panelOverTop > 1.5;
  }
  if (f.screen === 'asset-error') {
    return f.panelOver > 1.5 || f.panelOverTop > 1.5 || f.msgOut || f.retryOut || f.msgClip;
  }
  if (f.screen === 'rare') {
    return f.cardOut || f.hintOut || f.nameOut || f.tagClip || f.panelOver > 1.5 || f.panelOverTop > 1.5;
  }
  if (f.screen === 'rotate') {
    return f.cardOut || f.pClip || f.panelOver > 1.5 || f.panelOverTop > 1.5;
  }
  if (f.screen === 'select') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.ctaOut ||
      (f.gridH > 0 && f.gridH < 36) ||
      f.kitClip
    );
  }
  return false;
});

const soft = findings.filter((f) => {
  if (muddy.includes(f) || f.skipped) return false;
  if (f.screen === 'loading') {
    if (f.h <= 480 && f.decoDisplay === 'block' && f.panelOver > -20) return true;
    if (f.labelOh?.lines >= 3 && f.panelOver > -30) return true;
    if (f.panelOver > 0 && f.panelOver <= 1.5) return true;
  }
  if (f.screen === 'options') {
    if (f.scrollH > 0 && f.scrollH < 90 && f.h <= 400) return true;
    if (f.crampedCount > 0) return true;
    if (f.labelClip) return true;
    if (f.scrollNeed > 180 && f.h <= 450) return true;
  }
  if (f.screen === 'asset-error') {
    if (f.h <= 420 && f.iconDisplay === 'block' && f.panelOver > -30) return true;
    if (f.msgH > 0 && f.msgH < 28) return true;
  }
  if (f.screen === 'rare') {
    if (f.tagH > 0 && f.tagH < 18) return true;
    if (f.cardH > 0 && f.h <= 400 && f.cardH > f.h * 0.92) return true;
  }
  if (f.screen === 'title') {
    if (f.brandDisplay === 'none' && f.h >= 450 && f.panelOver < -40) return true;
  }
  if (f.screen === 'select') {
    if (f.h <= 400 && f.kitH > 0 && f.kitH < 28) return true;
    if (f.h <= 400 && f.hintDisplay === 'none') return true;
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
    asset: findings.filter((f) => f.screen === 'asset-error'),
    rare: findings.filter((f) => f.screen === 'rare'),
    rotate: findings.filter((f) => f.screen === 'rotate'),
    select: findings.filter((f) => f.screen === 'select'),
  },
};

const outPath = join(root, 'tools', 'probe-tick136-candidates-out.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      soft: out.soft.slice(0, 40),
      samples: {
        opt360: out.byScreen.options.filter((r) => r.h === 360),
        load360: out.byScreen.loading.filter((r) => r.h === 360 || r.h === 450),
        asset360: out.byScreen.asset.filter((r) => r.h === 360 || r.h === 400),
        rare360: out.byScreen.rare.filter((r) => r.h === 360 || r.h === 400),
        title360: out.byScreen.title.filter((r) => r.h === 360 || r.h === 400),
        sel360: out.byScreen.select.filter((r) => r.h === 360 || r.h === 400),
      },
    },
    null,
    2,
  ),
);
process.exit(0);
