/**
 * Tick139 candidates: thin-viewport residual after tick138 pause head reclaim.
 * Prefer live panelOver / CTA OOB / clip at short heights.
 * Uses REAL endScreen markup (3 score + 4 meta cells) — prior probes understated.
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

        await page.goto(`${url}?cb=r139-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.waitForTimeout(40);

        // ---- TITLE ----
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
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            rulesDisplay: rules ? getComputedStyle(rules).display : 'none',
            hiInside: hi ? !boxOut(hi, ocR) : false,
            startOut: start ? boxOut(start, appR) : true,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
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
          const brand = content.querySelector('.brand-mark');
          const h2 = content.querySelector('h2');
          const meta = content.querySelector('.load-meta');
          const labR = lab?.getBoundingClientRect();
          const lh = lab ? parseFloat(getComputedStyle(lab).lineHeight) || 16 : 16;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            decoH: deco ? +deco.getBoundingClientRect().height.toFixed(1) : 0,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            labelH: labR ? +labR.height.toFixed(1) : 0,
            labelLines: labR ? Math.round(labR.height / lh) : 0,
            labelClipY: lab ? lab.scrollHeight > lab.clientHeight + 2 : false,
            labelClipX: lab ? lab.scrollWidth > lab.clientWidth + 2 : false,
            labelOut: lab ? boxOut(lab, appR) : true,
            metaOut: meta ? boxOut(meta, appR) : true,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'loading', loc, w: size.width, h: size.height, ...loading });

        // ---- RESULT REAL endScreen markup (cleared + gameover) ----
        for (const mode of ['cleared', 'gameover']) {
          const result = await page.evaluate(async ({ loc, boxOutSrc, mode }) => {
            const boxOut = new Function(`return (${boxOutSrc})`)();
            let tRetry = 'Retry run';
            let tTitle = 'Title';
            try {
              const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
              if (mod?.setLocale) mod.setLocale(loc);
              if (mod?.t) {
                tRetry = mod.t('btn.retryRun') || tRetry;
                tTitle = mod.t('btn.title') || tTitle;
              }
            } catch { /* */ }
            const cleared = mode === 'cleared';
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            overlay.classList.add('is-on');
            overlay.style.display = 'flex';
            content.className = `screen-result ${mode}`;
            content.style.cssText = '';
            const stageLabel = cleared
              ? 'ALL 5 · FINAL GATE'
              : 'STAGE 3 · ORBITAL SPIRE';
            content.innerHTML = `
              <div class="panel-frame" aria-hidden="true"></div>
              <span class="brand-mark">${cleared ? 'MISSION COMPLETE' : 'SYSTEM DOWN'}</span>
              <h2>${cleared ? 'ALL CLEAR' : 'GAME OVER'}</h2>
              <span class="result-deco" aria-hidden="true"></span>
              <div class="result-score">
                <div class="cell"><span class="lbl">SCORE</span><span class="val">012345678</span></div>
                <div class="cell"><span class="lbl">HI-SCORE</span><span class="val">098765432</span></div>
                <div class="cell"><span class="lbl">GRAZE</span><span class="val">1234</span></div>
              </div>
              <div class="result-meta">
                <div class="cell"><span class="lbl">STAGE</span><span class="val">${stageLabel}</span></div>
                <div class="cell"><span class="lbl">PILOT</span><span class="val">CONSTANTIA</span></div>
                <div class="cell"><span class="lbl">MAX COMBO</span><span class="val">99</span></div>
                <div class="cell"><span class="lbl">NO MISS</span><span class="val">YES</span></div>
              </div>
              <button class="btn btn-primary" id="btn-retry">${tRetry}</button>
              <button class="btn" id="btn-title">${tTitle}</button>
            `;
            const app = document.getElementById('app');
            // Mirror syncResultPanelBudget ladder from main.js
            const runSync = () => {
              const oc = content;
              const deco = oc.querySelector('.result-deco');
              const score = oc.querySelector('.result-score');
              const meta = oc.querySelector('.result-meta');
              const brand = oc.querySelector(':scope > .brand-mark');
              const h2 = oc.querySelector(':scope > h2');
              const retry = oc.querySelector('#btn-retry');
              const titleBtn = oc.querySelector('#btn-title');
              if (!app || !score || !meta || !retry) return { steps: -1, over: 0 };
              oc.style.maxHeight = '';
              oc.style.paddingTop = '';
              oc.style.paddingBottom = '';
              if (deco) deco.style.display = '';
              if (brand) brand.style.marginBottom = '';
              if (h2) h2.style.marginBottom = '';
              if (score) {
                score.style.marginTop = '';
                score.style.marginBottom = '';
                score.style.gap = '';
              }
              if (meta) {
                meta.style.marginBottom = '';
                meta.style.gap = '';
              }
              for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
                cell.style.padding = '';
                cell.style.border = '';
                cell.style.backgroundImage = '';
                cell.style.boxShadow = '';
                cell.style.clipPath = '';
              }
              if (retry) retry.style.padding = '';
              if (titleBtn) titleBtn.style.padding = '';
              const panelOver = () => {
                void oc.offsetHeight;
                const appR = app.getBoundingClientRect();
                const ocR = oc.getBoundingClientRect();
                return Math.max(
                  0,
                  ocR.bottom - (appR.bottom + 1),
                  (appR.top - 1) - ocR.top,
                );
              };
              let over = panelOver();
              if (over <= 1.5) return { steps: 0, over };
              if (deco) deco.style.display = 'none';
              over = panelOver();
              if (over <= 1.5) return { steps: 1, over };
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
              if (over <= 1.5) return { steps: 2, over };
              for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
                cell.style.padding = '2px 4px';
                cell.style.border = 'none';
                cell.style.backgroundImage = 'none';
                cell.style.boxShadow = 'none';
                cell.style.clipPath = 'none';
              }
              over = panelOver();
              if (over <= 1.5) return { steps: 3, over };
              oc.style.paddingTop = '18px';
              oc.style.paddingBottom = '12px';
              over = panelOver();
              if (over <= 1.5) return { steps: 4, over };
              if (retry) retry.style.padding = '8px 20px';
              if (titleBtn) titleBtn.style.padding = '8px 20px';
              over = panelOver();
              if (over <= 1.5) return { steps: 5, over };
              const appH = app.clientHeight || window.innerHeight || 360;
              oc.style.maxHeight = `${Math.max(260, Math.floor(appH * 0.96))}px`;
              return { steps: 6, over: panelOver() };
            };
            const sync = runSync();
            void content.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const brand = content.querySelector(':scope > .brand-mark');
            const h2 = content.querySelector(':scope > h2');
            const score = content.querySelector('.result-score');
            const meta = content.querySelector('.result-meta');
            const retry = document.getElementById('btn-retry');
            const titleBtn = document.getElementById('btn-title');
            const cells = [...content.querySelectorAll('.result-score .cell, .result-meta .cell')];
            const cellClip = cells.some(
              (c) => c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2,
            );
            const vals = [...content.querySelectorAll('.result-score .val, .result-meta .val')];
            const valClip = vals.some(
              (v) => v.scrollWidth > v.clientWidth + 2 || v.scrollHeight > v.clientHeight + 2,
            );
            const lbls = [...content.querySelectorAll('.result-score .lbl, .result-meta .lbl')];
            const lblClip = lbls.some(
              (v) => v.scrollWidth > v.clientWidth + 2 || v.scrollHeight > v.clientHeight + 2,
            );
            return {
              mode,
              panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
              panelOverTop: +(appR.top - ocR.top).toFixed(2),
              syncSteps: sync?.steps ?? -1,
              syncOver: +(sync?.over ?? 0).toFixed(2),
              brandDisplay: brand ? getComputedStyle(brand).display : 'none',
              brandH: brand ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
              h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
              h2Fs: h2 ? getComputedStyle(h2).fontSize : '',
              scoreH: score ? +score.getBoundingClientRect().height.toFixed(1) : 0,
              metaH: meta ? +meta.getBoundingClientRect().height.toFixed(1) : 0,
              cellClip,
              valClip,
              lblClip,
              retryOut: retry ? boxOut(retry, appR) : true,
              titleOut: titleBtn ? boxOut(titleBtn, appR) : true,
              headroom: +(appR.bottom - ocR.bottom).toFixed(1),
              maxH: getComputedStyle(content).maxHeight,
              panelH: +ocR.height.toFixed(1),
              appH: +appR.height.toFixed(1),
            };
          }, { loc, boxOutSrc: boxOut.toString(), mode });
          findings.push({ screen: 'result', loc, w: size.width, h: size.height, ...result });
        }

        // ---- OPTIONS via title path ----
        await page.goto(`${url}?cb=r139o-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const optBtn = await page.$('#btn-options, #btn-opt, button:has-text("OPTIONS"), button:has-text("옵션")');
        if (optBtn) {
          await optBtn.click();
          await page.waitForTimeout(120);
        } else {
          // fallback: click any options-looking control on title
          await page.evaluate(() => {
            const b = [...document.querySelectorAll('button')].find((el) =>
              /option|옵션|opções|opciones|опци/i.test(el.textContent || ''),
            );
            b?.click();
          });
          await page.waitForTimeout(120);
        }
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
          const brand = oc.querySelector('.opt-head .brand-mark');
          const h2 = oc.querySelector('.opt-head h2');
          const sR = scroll?.getBoundingClientRect();
          const bgm = oc.querySelector('#opt-bgm')?.closest('label, .opt-slider');
          const nested = !!oc.querySelector('.opt-scroll .opt-keys');
          let nestedScroll = false;
          if (nested) {
            const keys = oc.querySelector('.opt-scroll .opt-keys');
            nestedScroll = keys
              ? keys.scrollHeight > keys.clientHeight + 4 &&
                getComputedStyle(keys).overflowY !== 'visible'
              : false;
          }
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            scrollH: sR ? +sR.height.toFixed(1) : 0,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            h2H: h2 ? +h2.getBoundingClientRect().height.toFixed(1) : 0,
            backOut: back ? boxOut(back, appR) : true,
            bgmInFirst: bgm ? !boxOut(bgm, {
              top: sR?.top ?? 0,
              bottom: (sR?.bottom ?? 0),
              left: sR?.left ?? 0,
              right: sR?.right ?? 0,
            }) : false,
            nestedScroll,
            headroom: +(appR.bottom - ocR.bottom).toFixed(1),
            isOptShort: oc.classList.contains('is-opt-short'),
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'options', loc, w: size.width, h: size.height, ...options });
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
      f.labelClipY ||
      f.labelClipX
    );
  }
  if (f.screen === 'result') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.retryOut ||
      f.titleOut ||
      f.cellClip ||
      f.valClip ||
      f.lblClip ||
      (f.syncSteps >= 6 && f.syncOver > 1.5)
    );
  }
  if (f.screen === 'options') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.backOut ||
      f.nestedScroll ||
      (f.h <= 400 && f.scrollH > 0 && f.scrollH < 130)
    );
  }
  return false;
});

const soft = findings.filter((f) => {
  if (muddy.includes(f) || f.skipped) return false;
  if (f.screen === 'loading') {
    if (f.h <= 480 && f.decoDisplay !== 'none' && f.headroom > 40) return true;
    if (f.labelLines >= 3 && f.headroom > 30) return true;
    if (f.h <= 400 && f.brandDisplay !== 'none' && f.headroom > 24) return true;
  }
  if (f.screen === 'title') {
    if (f.brandDisplay === 'none' && f.h >= 450 && f.headroom > 40) return true;
  }
  if (f.screen === 'result') {
    if (f.h <= 400 && f.brandDisplay !== 'none' && f.syncSteps >= 3) return true;
    if (f.h <= 400 && f.syncSteps >= 4) return true;
    if (f.h <= 400 && f.headroom < 6 && f.brandH >= 20) return true;
    if (f.h <= 400 && f.headroom < 4) return true;
  }
  if (f.screen === 'options') {
    if (f.h <= 400 && f.brandDisplay !== 'none') return true;
    if (f.h <= 400 && f.scrollH < 150) return true;
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
    result: findings.filter((f) => f.screen === 'result'),
    options: findings.filter((f) => f.screen === 'options'),
  },
};

const outPath = join(root, 'tools', 'probe-tick139-candidates-out.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      soft: out.soft.slice(0, 80),
      samples: {
        result360: out.byScreen.result.filter((r) => r.h === 360),
        result450: out.byScreen.result.filter((r) => r.h === 450),
        load360: out.byScreen.loading.filter((r) => r.h === 360 || r.h === 450),
        title360: out.byScreen.title.filter((r) => r.h === 360 || r.h === 450),
        opt360: out.byScreen.options.filter((r) => r.h === 360),
      },
    },
    null,
    2,
  ),
);
