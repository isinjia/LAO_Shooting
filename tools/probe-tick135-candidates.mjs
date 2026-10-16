/**
 * Tick135 candidates: thin-viewport residual outside closed tip/rim/charge /
 * select134 / title130 / pause131 / tutorial132 / result133 paths.
 * Prefer live panelOver / CTA OOB / kit crush / loading label / options scroll.
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

        // ---- TITLE live ----
        await page.goto(`${url}?cb=r135t-${Date.now()}-${loc}-${size.width}x${size.height}`, {
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
          const hi = document.querySelector('.keys-hi, #keys-hi, .hi-score');
          const start = document.getElementById('btn-start');
          const opts = document.getElementById('btn-options');
          const brand = oc.querySelector('.brand-mark');
          const tag = oc.querySelector('.title-tagline, .lobby-tagline, .title-sub');
          const status = oc.querySelector('.lobby-status-bar, .lobby-status, .title-status');
          const keys = oc.querySelector('.keys');
          const touchHelp = oc.querySelector('.touch-help, .title-touch-help, .lobby-touch');
          const cs = (el) => (el ? getComputedStyle(el).display : 'none');
          const oh = (el, box) => {
            if (!el || cs(el) === 'none') return { out: false, h: 0, lines: 0 };
            const r = el.getBoundingClientRect();
            const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
            return {
              out: boxOut(el, box),
              h: +r.height.toFixed(1),
              lines: Math.max(1, Math.round(r.height / lh)),
              clipY: r.bottom > box.bottom + 1.5 || r.top < box.top - 1.5,
              clipX: r.right > box.right + 1.5 || r.left < box.left - 1.5,
            };
          };
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            startOut: boxOut(start, appR),
            optsOut: boxOut(opts, appR),
            hiOut: hi ? boxOut(hi, appR) || boxOut(hi, ocR) : false,
            brandDisplay: cs(brand),
            brandH: brand && cs(brand) !== 'none' ? +brand.getBoundingClientRect().height.toFixed(1) : 0,
            tagDisplay: cs(tag),
            statusDisplay: cs(status),
            statusInfo: oh(status, ocR),
            keysH: keys ? +keys.getBoundingClientRect().height.toFixed(1) : 0,
            touchHelpDisplay: cs(touchHelp),
            touchHelp: oh(touchHelp, ocR),
            maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight || '',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'title', loc, w: size.width, h: size.height, ...title });

        // ---- LOADING — longest preparing + mid progress ----
        const loading = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let label = 'Preparing sortie assets…';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              label =
                mod.t('load.preparing') ||
                mod.t('load.decoding') ||
                mod.t('load.warming') ||
                label;
            }
          } catch { /* */ }
          // Stress: append mid-progress suffix used by live loader when verbose
          const stress = `${label} · ${loc.toUpperCase()} decode pack 42/63`;
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-loading';
          content.style.maxHeight = '';
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">LAO MINI ACTION</span>
            <h2>LOADING</h2>
            <span class="loading-deco" aria-hidden="true"></span>
            <p id="loading-label">${stress}</p>
            <div class="load-track" aria-hidden="true"><div class="load-fill" id="load-fill" style="width:67%"></div></div>
            <div class="load-meta"><span id="load-count">42 / 63</span><span id="load-pct">67%</span></div>
          `;
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const lab = document.getElementById('loading-label');
          const meta = content.querySelector('.load-meta');
          const deco = content.querySelector('.loading-deco');
          const brand = content.querySelector('.brand-mark');
          const oh = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              ohY: r.bottom > ocR.bottom + 1.5 || r.top < ocR.top - 1.5,
              ohX: r.right > ocR.right + 1.5 || r.left < ocR.left - 1.5,
              ohApp: boxOut(el, appR),
              h: +r.height.toFixed(1),
              lines: Math.max(1, Math.round(r.height / (parseFloat(getComputedStyle(el).lineHeight) || 16))),
            };
          };
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            decoH: deco && getComputedStyle(deco).display !== 'none' ? +deco.getBoundingClientRect().height.toFixed(1) : 0,
            brandDisplay: brand ? getComputedStyle(brand).display : 'none',
            labelOh: oh(lab),
            metaOh: oh(meta),
            labelText: lab?.textContent || '',
            padT: parseFloat(getComputedStyle(content).paddingTop) || 0,
            padB: parseFloat(getComputedStyle(content).paddingBottom) || 0,
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'loading', loc, w: size.width, h: size.height, ...loading });

        // ---- OPTIONS via button ----
        await page.goto(`${url}?cb=r135o-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-options', { timeout: 60000 });
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back, #btn-back, .opt-actions .btn', { timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(80);
        const opt = await page.evaluate(({ boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          const app = document.getElementById('app');
          const oc = document.getElementById('overlay-content');
          if (!oc?.classList.contains('screen-options')) {
            return { skipped: true, cls: oc?.className || '' };
          }
          const appR = app.getBoundingClientRect();
          const ocR = oc.getBoundingClientRect();
          const back =
            document.getElementById('btn-opt-back') ||
            document.getElementById('btn-back') ||
            oc.querySelector('.opt-actions .btn');
          const scroll = oc.querySelector('.opt-scroll');
          const nested = oc.querySelector('.opt-scroll .opt-keys');
          const nestedMax = nested ? getComputedStyle(nested).maxHeight : '';
          const rows = [...oc.querySelectorAll('.opt-row, .opt-item, .opt-toggle, label')];
          const cramped = rows
            .map((el) => {
              const r = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              return {
                h: +r.height.toFixed(1),
                fs: parseFloat(cs.fontSize) || 0,
                text: (el.textContent || '').trim().slice(0, 40),
                overflow: r.height > 0 && r.height < 14,
              };
            })
            .filter((x) => x.overflow);
          const labels = [...oc.querySelectorAll('.opt-label, .opt-row span, .opt-row label')];
          const labelClip = labels.some((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
          });
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            backOut: boxOut(back, appR),
            backOcOut: boxOut(back, ocR),
            nested:
              nested &&
              nestedMax !== 'none' &&
              nestedMax !== '' &&
              parseFloat(nestedMax) > 0 &&
              nested.scrollHeight > nested.clientHeight + 2,
            nestedMax,
            scrollH: scroll ? +scroll.getBoundingClientRect().height.toFixed(1) : 0,
            scrollScrollH: scroll ? scroll.scrollHeight : 0,
            scrollClientH: scroll ? scroll.clientHeight : 0,
            crampedCount: cramped.length,
            crampedSample: cramped.slice(0, 3),
            labelClip,
            maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight || '',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'options', loc, w: size.width, h: size.height, ...opt });

        // ---- SELECT via start — dossier kit crush focus ----
        await page.goto(`${url}?cb=r135s-${Date.now()}-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        await page.click('#btn-start');
        await page.waitForTimeout(220);
        // Prefer a long-kit rare if present (eternity / labiata / emily)
        await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.char-card, [data-char]')];
          const prefer = cards.find((c) => /eternity|labiata|emily/i.test(c.dataset?.char || c.id || c.className));
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
          const cta =
            document.getElementById('btn-sortie') ||
            document.getElementById('btn-confirm') ||
            oc.querySelector('.select-actions .btn');
          const deco = oc.querySelector('.sortie-deco');
          const blurb = oc.querySelector('.select-blurb');
          const dossier = oc.querySelector('.select-dossier');
          const kit = oc.querySelector('.select-dossier-kit');
          const hint = oc.querySelector('.select-dossier-hint');
          const name = oc.querySelector('.select-dossier-name');
          const actions = oc.querySelector('.select-actions');
          const gridR = grid?.getBoundingClientRect();
          const kitR = kit?.getBoundingClientRect();
          const kitCs = kit ? getComputedStyle(kit) : null;
          const kitLines = kitR
            ? Math.max(1, Math.round(kitR.height / (parseFloat(kitCs.lineHeight) || 14)))
            : 0;
          const kitClip =
            !!kit &&
            (kit.scrollWidth > kit.clientWidth + 2 ||
              kit.scrollHeight > kit.clientHeight + 2 ||
              (kitR && (kitR.right > ocR.right + 1.5 || kitR.left < ocR.left - 1.5)));
          const dossierCs = dossier ? getComputedStyle(dossier) : null;
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            appH: +appR.height.toFixed(1),
            gridH: gridR ? +gridR.height.toFixed(1) : 0,
            ctaOut: boxOut(cta, appR),
            ctaOcOut: boxOut(cta, ocR),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            blurbDisplay: blurb ? getComputedStyle(blurb).display : 'none',
            hintDisplay: hint ? getComputedStyle(hint).display : 'none',
            kitText: (kit?.textContent || '').trim().slice(0, 80),
            kitH: kitR ? +kitR.height.toFixed(1) : 0,
            kitLines,
            kitClip,
            kitFs: kitCs ? parseFloat(kitCs.fontSize) || 0 : 0,
            nameH: name ? +name.getBoundingClientRect().height.toFixed(1) : 0,
            dossierDisplay: dossier ? getComputedStyle(dossier).display : 'none',
            dossierBox: dossierCs?.boxShadow || '',
            dossierPad: dossierCs ? `${dossierCs.paddingTop} ${dossierCs.paddingRight}` : '',
            actionsH: actions ? +actions.getBoundingClientRect().height.toFixed(1) : 0,
            maxH: oc.style.maxHeight || getComputedStyle(oc).maxHeight || '',
          };
        }, { boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'select', loc, w: size.width, h: size.height, ...select });

        // ---- PAUSE inject via live show if possible ----
        const pause = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tResume = 'RESUME';
          let tTitle = 'TITLE';
          let tOpts = 'OPTIONS';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) {
              tResume = mod.t('btn.resume') || tResume;
              tTitle = mod.t('btn.title') || tTitle;
              tOpts = mod.t('btn.options') || tOpts;
            }
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-pause';
          content.style.maxHeight = '';
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">LAO MINI ACTION</span>
            <h2>PAUSED</h2>
            <span class="pause-deco" aria-hidden="true"></span>
            <p class="pause-note">Sortie suspended. Systems holding.</p>
            <div class="pause-actions">
              <button class="btn" id="btn-resume">${tResume}</button>
              <button class="btn" id="btn-pause-options">${tOpts}</button>
              <button class="btn" id="btn-pause-title">${tTitle}</button>
            </div>
          `;
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const resume = document.getElementById('btn-resume');
          const deco = content.querySelector('.pause-deco');
          const note = content.querySelector('.pause-note');
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            noteDisplay: note ? getComputedStyle(note).display : 'none',
            resumeOut: boxOut(resume, appR),
            resumeOcOut: boxOut(resume, ocR),
            maxH: content.style.maxHeight || '',
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'pause', loc, w: size.width, h: size.height, ...pause });

        // ---- TUTORIAL inject ----
        const tut = await page.evaluate(async ({ loc, boxOutSrc }) => {
          const boxOut = new Function(`return (${boxOutSrc})`)();
          let tGo = 'BEGIN SORTIE';
          try {
            const mod = await import(`/js/i18n.js?probe=${Date.now()}`);
            if (mod?.setLocale) mod.setLocale(loc);
            if (mod?.t) tGo = mod.t('btn.beginSortie') || mod.t('btn.confirm') || tGo;
          } catch { /* */ }
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
          overlay.classList.remove('hidden');
          content.className = 'screen-tutorial';
          content.style.maxHeight = '';
          content.style.paddingTop = '';
          content.style.paddingBottom = '';
          content.innerHTML = `
            <div class="panel-frame" aria-hidden="true"></div>
            <span class="brand-mark">LAO MINI ACTION</span>
            <h2>CONTROLS</h2>
            <span class="tutorial-deco" aria-hidden="true"></span>
            <div class="tut-grid">
              ${Array.from({ length: 6 })
                .map(
                  (_, i) =>
                    `<div class="tut-card"><span class="tut-k">KEY ${i + 1}</span><span class="tut-v">Long instructional line for locale stress ${i + 1}</span></div>`,
                )
                .join('')}
            </div>
            <p class="tut-note">Hold FIRE for character identity. Focus slows movement.</p>
            <div class="tut-actions"><button class="btn" id="btn-tut-go">${tGo}</button></div>
          `;
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const app = document.getElementById('app');
          const appR = app.getBoundingClientRect();
          const ocR = content.getBoundingClientRect();
          const grid = content.querySelector('.tut-grid');
          const go = document.getElementById('btn-tut-go');
          const deco = content.querySelector('.tutorial-deco');
          const note = content.querySelector('.tut-note');
          const gR = grid?.getBoundingClientRect();
          return {
            panelOver: +(ocR.bottom - appR.bottom).toFixed(2),
            panelOverTop: +(appR.top - ocR.top).toFixed(2),
            panelH: +ocR.height.toFixed(1),
            gridH: gR ? +gR.height.toFixed(1) : 0,
            decoDisplay: deco ? getComputedStyle(deco).display : 'none',
            noteDisplay: note ? getComputedStyle(note).display : 'none',
            goOut: boxOut(go, appR),
            goOcOut: boxOut(go, ocR),
            maxH: content.style.maxHeight || '',
          };
        }, { loc, boxOutSrc: boxOut.toString() });
        findings.push({ screen: 'tutorial', loc, w: size.width, h: size.height, ...tut });
      } catch (err) {
        findings.push({
          screen: 'error',
          loc,
          w: size.width,
          h: size.height,
          error: String(err?.message || err),
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
  if (f.screen === 'loading') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.labelOh?.ohY ||
      f.labelOh?.ohX ||
      f.labelOh?.ohApp ||
      f.metaOh?.ohY ||
      f.metaOh?.ohApp
    );
  }
  if (f.screen === 'options') {
    if (f.skipped) return false;
    return f.backOut || f.backOcOut || f.nested || f.panelOver > 1.5 || f.panelOverTop > 1.5;
  }
  if (f.screen === 'select') {
    if (f.skipped) return false;
    return (
      f.ctaOut ||
      f.ctaOcOut ||
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      (f.gridH > 0 && f.gridH < 36) ||
      (f.kitClip && f.kitH > 0 && f.kitH < 12)
    );
  }
  if (f.screen === 'title') {
    return (
      f.startOut ||
      f.optsOut ||
      f.hiOut ||
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.statusInfo?.clipY ||
      f.touchHelp?.clipY
    );
  }
  if (f.screen === 'pause') {
    return f.panelOver > 1.5 || f.panelOverTop > 1.5 || f.resumeOut || f.resumeOcOut;
  }
  if (f.screen === 'tutorial') {
    return (
      f.panelOver > 1.5 ||
      f.panelOverTop > 1.5 ||
      f.goOut ||
      f.goOcOut ||
      (f.gridH > 0 && f.gridH < 36)
    );
  }
  return f.screen === 'error';
});

const soft = findings.filter((f) => {
  if (muddy.includes(f)) return false;
  if (f.screen === 'loading') {
    if (f.h <= 480 && f.decoDisplay === 'block' && f.panelOver > -20) return true;
    if (f.labelOh?.lines >= 3 && f.panelOver > -30) return true;
    if (f.panelOver > 0 && f.panelOver <= 1.5) return true;
  }
  if (f.screen === 'options') {
    if (f.h <= 400 && f.scrollH > 0 && f.scrollH < 120) return true;
    if (f.labelClip || f.crampedCount > 0) return true;
  }
  if (f.screen === 'select') {
    if (f.kitClip) return true;
    if (f.kitH > 0 && f.kitH < 18) return true;
    if (f.h <= 400 && f.kitLines >= 3 && f.kitFs <= 11) return true;
  }
  if (f.screen === 'title') {
    if (f.h <= 480 && f.brandH === 0 && f.keysH > 0) return true;
    if (f.h === 560 && f.statusDisplay === 'none') return true;
  }
  if (f.screen === 'pause' || f.screen === 'tutorial') {
    if (f.panelOver > 0 && f.panelOver <= 1.5) return true;
  }
  return false;
});

const out = {
  muddyCount: muddy.length,
  softCount: soft.length,
  muddy,
  soft,
  byScreen: {
    loading: findings.filter((f) => f.screen === 'loading'),
    options: findings.filter((f) => f.screen === 'options'),
    select: findings.filter((f) => f.screen === 'select'),
    title: findings.filter((f) => f.screen === 'title'),
    pause: findings.filter((f) => f.screen === 'pause'),
    tutorial: findings.filter((f) => f.screen === 'tutorial'),
    error: findings.filter((f) => f.screen === 'error'),
  },
};
const outPath = join(root, 'tools', '_tick135-candidates.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(
  JSON.stringify(
    {
      muddyCount: out.muddyCount,
      softCount: out.softCount,
      muddy: out.muddy,
      softBrief: out.soft.map((f) => ({
        screen: f.screen,
        loc: f.loc,
        w: f.w,
        h: f.h,
        panelOver: f.panelOver,
        decoDisplay: f.decoDisplay,
        gridH: f.gridH,
        brandH: f.brandH,
        keysH: f.keysH,
        scrollH: f.scrollH,
        kitH: f.kitH,
        kitClip: f.kitClip,
        kitLines: f.kitLines,
        labelLines: f.labelOh?.lines,
        labelClip: f.labelClip,
        crampedCount: f.crampedCount,
        statusDisplay: f.statusDisplay,
      })),
      loading360: out.byScreen.loading.filter((r) => r.h === 360 || r.h === 450),
      select360: out.byScreen.select.filter((r) => r.h === 360 || r.h === 400),
      opt360: out.byScreen.options.filter((r) => r.h === 360 || r.h === 450),
      title450: out.byScreen.title.filter((r) => r.h === 450 || r.h === 560),
      errors: out.byScreen.error,
      wrote: outPath,
    },
    null,
    2,
  ),
);
process.exit(out.byScreen.error.length === 0 ? 0 : 1);
