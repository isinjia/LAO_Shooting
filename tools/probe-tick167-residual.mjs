/**
 * Tick167 — residual HARD scan after tick166 pause ultra quit deepen.
 * Prefer: OPTIONS Math.max(260) live inflate → fitH clamp; else next clear
 * HARD muddy at ultra-short / chrome OOB. dens FROZEN. Prefer live-measured
 * HARD only — do NOT invent soft reclaim / defensive clamp while LATENT.
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
const SIZES = [
  { width: 320, height: 200 },
  { width: 360, height: 200 },
  { width: 360, height: 240 },
  { width: 400, height: 240 },
  { width: 400, height: 280 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
  { width: 800, height: 450 },
  { width: 1280, height: 560 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classifyOpt(m) {
  const unread =
    m.inflated ||
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2));
  const soft =
    !unread && (m.panelOver > 1.5 || m.actionsOut || (m.scrollSoft && m.scrollH < 72));
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

function classifyPeer(m) {
  const unread =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2)) ||
    (m.midOut === true) ||
    (m.mid2Out === true) ||
    (typeof m.midVis === 'number' &&
      m.midH > 0 &&
      m.midVis < Math.min(16, m.midH - 2)) ||
    (typeof m.mid2Vis === 'number' &&
      m.mid2H > 0 &&
      m.mid2Vis < Math.min(16, m.mid2H - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut || m.backOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function boot(browser, url, size, loc, tag, tutorialSeen = '1') {
  const page = await browser.newPage({ viewport: size });
  await page.addInitScript(
    ({ loc, tutorialSeen }) => {
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
      localStorage.setItem('lao_mini_tutorial_seen', tutorialSeen);
      window.__tick167Health = { options: 0, optionsCaps: [] };
    },
    { loc, tutorialSeen },
  );
  await page.goto(`${url}?cb=t167-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  await page.evaluate(() => {
    const orig = Math.max;
    Math.max = function (...args) {
      if (
        args.length >= 2 &&
        args[0] === 260 &&
        typeof args[1] === 'number' &&
        Number.isFinite(args[1])
      ) {
        const st = window.__tick167Health;
        const oc = document.getElementById('overlay-content');
        if (st && oc?.classList?.contains('screen-options')) {
          st.options += 1;
          st.optionsCaps.push(args[1]);
        }
      }
      return orig.apply(Math, args);
    };
  });
  return page;
}

async function measureOptions(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector('#btn-opt-back');
    const actions = oc.querySelector('.opt-actions');
    const scroll = oc.querySelector('.opt-scroll');
    const brand = oc.querySelector('.opt-head .brand-mark');
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
    const maxHpx = parseFloat(oc.style.maxHeight) || 0;
    const fitH = Math.floor(Math.min(app.clientHeight || 0, appR.height));
    const st = window.__tick167Health || {};
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      maxHpx,
      fitH,
      inflated: maxHpx > fitH + 0.5,
      healthSteps: st.options | 0,
      healthCaps: (st.optionsCaps || []).slice(-4),
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: +(cta?.getBoundingClientRect().height || 0).toFixed(1),
      actionsOut: actions ? out(actions) : false,
      scrollH: +(scroll?.getBoundingClientRect().height || 0).toFixed(1),
      scrollMin: scroll?.style.minHeight || '',
      scrollSoft: !!(scroll && scroll.getBoundingClientRect().height + 0.5 < 72),
      short: oc.classList.contains('is-opt-short'),
      brandHidden: brand ? getComputedStyle(brand).display === 'none' : false,
    };
  });
}

const peerMeasure = `({ ctaSel, secSel, midSel, mid2Sel, actionsSel, backSel }) => {
  const app = document.getElementById('app');
  const oc = document.getElementById('overlay-content') || document.getElementById('app');
  void oc?.offsetHeight;
  const appR = app.getBoundingClientRect();
  const ocR = oc.getBoundingClientRect();
  const cta = oc.querySelector(ctaSel);
  const sec = secSel ? oc.querySelector(secSel) : null;
  const mid = midSel ? oc.querySelector(midSel) : null;
  const mid2 = mid2Sel ? oc.querySelector(mid2Sel) : null;
  const actions = actionsSel ? oc.querySelector(actionsSel) : null;
  const back = backSel ? oc.querySelector(backSel) : null;
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
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return (
      r.bottom > appR.bottom + 1.5 ||
      r.top < appR.top - 1.5 ||
      r.right > appR.right + 1.5 ||
      r.left < appR.left - 1.5
    );
  };
  const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
  return {
    panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
    maxH: oc.style?.maxHeight || '',
    ctaOut: cta ? out(cta) : true,
    ctaVis: +vis(cta).toFixed(1),
    ctaH: bh(cta),
    secOut: sec ? out(sec) : false,
    secVis: sec ? +vis(sec).toFixed(1) : 0,
    secH: bh(sec),
    midOut: mid ? out(mid) : false,
    midVis: mid ? +vis(mid).toFixed(1) : 0,
    midH: bh(mid),
    mid2Out: mid2 ? out(mid2) : false,
    mid2Vis: mid2 ? +vis(mid2).toFixed(1) : 0,
    mid2H: bh(mid2),
    backOut: back ? out(back) : false,
    actionsOut: actions ? out(actions) : false,
    btnMinH: (() => {
      const b = actions?.querySelector('.btn');
      return b ? getComputedStyle(b).minHeight : '';
    })(),
    gap: actions ? getComputedStyle(actions).gap : '',
    brandHidden: (() => {
      const b = oc.querySelector('.brand-mark, .title-brand, .brand');
      return b ? getComputedStyle(b).display === 'none' : false;
    })(),
  };
}`;

async function enterGameplay(page) {
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 60000 });
  await page.waitForTimeout(80);
  await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
  await page.waitForTimeout(40);
  await page.click('#btn-go');
  await page.waitForFunction(
    () => !!window.__LAO__?.getGame?.() || !!document.querySelector('#btn-tut-go'),
    { timeout: 60000 },
  );
  if (await page.$('#btn-tut-go')) {
    await page.click('#btn-tut-go');
  }
  await page.waitForFunction(() => !!window.__LAO__?.getGame?.(), { timeout: 60000 });
  await page.waitForTimeout(220);
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let healthLive = 0;

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // A) OPTIONS live from title — LATENT health check
      {
        const page = await boot(browser, url, size, loc, 'opt');
        try {
          await page.click('#btn-options');
          await page.waitForSelector('#overlay-content.screen-options, #btn-opt-back', {
            timeout: 60000,
          });
          await page.waitForTimeout(240);
          await page.evaluate(() => window.dispatchEvent(new Event('resize')));
          await page.waitForTimeout(120);
          const m = await measureOptions(page);
          const cls = classifyOpt(m);
          const tag = `options ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} maxH=${m.maxH} fitH=${m.fitH} inflated=${m.inflated}`,
            `health=${m.healthSteps} caps=${JSON.stringify(m.healthCaps)}`,
            `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `actionsOut=${m.actionsOut} scrollH=${m.scrollH} min=${m.scrollMin}`,
            `short=${m.short} brandHidden=${m.brandHidden}`,
          );
          if (m.healthSteps > 0) healthLive += 1;
          const row = { tag, screen: 'options', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // B) PAUSE Escape — all 4 chrome buttons (resume/options/mute/quit)
      if (
        size.height <= 320 ||
        size.width === 320 ||
        size.width === 400 ||
        size.width === 480
      ) {
        const page = await boot(browser, url, size, loc, 'pause');
        try {
          await enterGameplay(page);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(280);
          const hasPause = await page.$('#overlay-content.screen-pause');
          if (!hasPause) {
            log(`SKIP pause ${loc}@${size.width}x${size.height}`);
          } else {
            const m = await page.evaluate(eval(`(${peerMeasure})`), {
              ctaSel: '#btn-resume',
              secSel: '#btn-quit',
              midSel: '#btn-pause-options',
              mid2Sel: '#btn-pause-mute',
              actionsSel: '.pause-actions',
              backSel: null,
            });
            const cls = classifyPeer(m);
            const tag = `pause ${loc}@${size.width}x${size.height}`;
            log(
              `${cls} ${tag}`,
              `over=${m.panelOver} maxH=${m.maxH}`,
              `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
              `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
              `midOut=${m.midOut} midVis=${m.midVis}/${m.midH}`,
              `mid2Out=${m.mid2Out} mid2Vis=${m.mid2Vis}/${m.mid2H}`,
              `actionsOut=${m.actionsOut} gap=${m.gap} btnMinH=${m.btnMinH}`,
            );
            const row = { tag, screen: 'pause', loc, w: size.width, h: size.height, cls, ...m };
            if (cls === 'HARD') hard.push(row);
            else if (cls === 'SOFT') soft.push(row);
            else ok += 1;
          }
        } finally {
          await page.close();
        }
      }

      // C) RESULT ultra/short keep
      if (size.height <= 320 && size.width <= 568) {
        const page = await boot(browser, url, size, loc, 'res');
        try {
          await enterGameplay(page);
          await page.evaluate(() => {
            const g = window.__LAO__.getGame();
            if (g && typeof g.forceGameOver === 'function') g.forceGameOver();
            else if (typeof window.__LAO__.endScreen === 'function') {
              window.__LAO__.endScreen('gameover', {
                score: 1234,
                hiScore: 5678,
                graze: 12,
                stage: 2,
                pilot: 'HIRUME',
                maxCombo: 8,
                noMiss: false,
              });
            }
          });
          await page.waitForSelector('#overlay-content.screen-result, #btn-retry', {
            timeout: 60000,
          });
          await page.waitForTimeout(260);
          const m = await page.evaluate(eval(`(${peerMeasure})`), {
            ctaSel: '#btn-retry',
            secSel: '#btn-title',
            midSel: null,
            mid2Sel: null,
            actionsSel: '.result-actions, .pause-actions',
            backSel: null,
          });
          const cls = classifyPeer(m);
          const tag = `result ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} maxH=${m.maxH}`,
            `ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
          );
          const row = { tag, screen: 'result', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // D) SELECT keep @ ultra / short
      if (size.height <= 280 || size.width === 320 || size.width === 480) {
        const page = await boot(browser, url, size, loc, 'sel');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#overlay-content.screen-select, #btn-go', {
            timeout: 60000,
          });
          await page.waitForTimeout(220);
          const m = await page.evaluate(eval(`(${peerMeasure})`), {
            ctaSel: '#btn-go',
            secSel: '#btn-options-select',
            midSel: null,
            mid2Sel: null,
            actionsSel: '.select-actions',
            backSel: '#btn-back',
          });
          const cls = classifyPeer(m);
          const tag = `select ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `secOut=${m.secOut} secVis=${m.secVis}/${m.secH} backOut=${m.backOut}`,
          );
          const row = { tag, screen: 'select', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // E) TUTORIAL keep @≤400
      if (size.width <= 400 && size.height <= 280) {
        const page = await boot(browser, url, size, loc, 'tut', '0');
        try {
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 60000 });
          await page.waitForTimeout(100);
          await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
          await page.waitForTimeout(40);
          await page.click('#btn-go');
          await page.waitForSelector('#overlay-content.screen-tutorial, #btn-tut-go', {
            timeout: 60000,
          });
          await page.waitForTimeout(220);
          const m = await page.evaluate(eval(`(${peerMeasure})`), {
            ctaSel: '#btn-tut-go',
            secSel: '#btn-tut-skip',
            midSel: null,
            mid2Sel: null,
            actionsSel: '.pause-actions, .tut-actions',
            backSel: '#btn-tut-skip',
          });
          const cls = classifyPeer(m);
          const tag = `tutorial ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
          );
          const row = { tag, screen: 'tutorial', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        } finally {
          await page.close();
        }
      }

      // F) TITLE CTAs + CONTROLS @ key sizes
      if (
        size.width >= 800 ||
        size.width === 400 ||
        size.width === 320 ||
        (size.width === 568 && size.height === 320)
      ) {
        const page = await boot(browser, url, size, loc, 'title');
        try {
          await page.waitForTimeout(200);
          const m = await page.evaluate(eval(`(${peerMeasure})`), {
            ctaSel: '#btn-start',
            secSel: '#btn-options',
            midSel: null,
            mid2Sel: null,
            actionsSel: '.title-actions',
            backSel: null,
          });
          const cls = classifyPeer(m);
          const tag = `title ${loc}@${size.width}x${size.height}`;
          log(
            `${cls} ${tag}`,
            `over=${m.panelOver} ctaOut=${m.ctaOut} ctaVis=${m.ctaVis}/${m.ctaH}`,
            `secOut=${m.secOut} secVis=${m.secVis}/${m.secH}`,
            `brandHidden=${m.brandHidden}`,
          );
          const row = { tag, screen: 'title', loc, w: size.width, h: size.height, cls, ...m };
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;

          const opened = await page.evaluate(() => {
            const candidates = [
              '#btn-keys',
              '#btn-controls',
              '#btn-how',
              '#btn-help',
              '[data-open="keys"]',
            ];
            for (const sel of candidates) {
              const b = document.querySelector(sel);
              if (b) {
                b.click();
                return sel;
              }
            }
            for (const b of document.querySelectorAll('button, a')) {
              const t = (b.textContent || '').toLowerCase();
              if (/control|조작|ключ|controles|操作|控制/.test(t)) {
                b.click();
                return 'text:' + t.slice(0, 24);
              }
            }
            return '';
          });
          if (opened) {
            await page.waitForTimeout(240);
            const hasKeys = await page.$(
              '#overlay-content.screen-keys, #overlay-content.screen-controls',
            );
            if (hasKeys) {
              const km = await page.evaluate(eval(`(${peerMeasure})`), {
                ctaSel: '#btn-keys-back, #btn-back, .keys-actions .btn',
                secSel: null,
                midSel: null,
                mid2Sel: null,
                actionsSel: '.keys-actions, .controls-actions',
                backSel: '#btn-keys-back, #btn-back',
              });
              const kcls = classifyPeer(km);
              const ktag = `keys ${loc}@${size.width}x${size.height}`;
              log(
                `${kcls} ${ktag}`,
                `over=${km.panelOver} ctaOut=${km.ctaOut} ctaVis=${km.ctaVis}/${km.ctaH}`,
                `backOut=${km.backOut} via=${opened}`,
              );
              const krow = {
                tag: ktag,
                screen: 'keys',
                loc,
                w: size.width,
                h: size.height,
                cls: kcls,
                ...km,
              };
              if (kcls === 'HARD') hard.push(krow);
              else if (kcls === 'SOFT') soft.push(krow);
              else ok += 1;
            } else {
              log(`SKIP keys ${loc}@${size.width}x${size.height} opened=${opened}`);
            }
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

log('');
log(`SUMMARY hard=${hard.length} soft=${soft.length} ok=${ok} optionsHealthLive=${healthLive}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) {
    log(
      `  ${h.tag}`,
      `over=${h.panelOver} inflated=${h.inflated || false}`,
      `ctaOut=${h.ctaOut} ctaVis=${h.ctaVis}/${h.ctaH}`,
      `secOut=${h.secOut || false} secVis=${h.secVis || 0}/${h.secH || 0}`,
      `midOut=${h.midOut || false} midVis=${h.midVis || 0}/${h.midH || 0}`,
      `mid2Out=${h.mid2Out || false} mid2Vis=${h.mid2Vis || 0}/${h.mid2H || 0}`,
      `health=${h.healthSteps || 0}`,
    );
  }
}
if (soft.length) {
  log('SOFT DETAIL (first 28):');
  for (const s of soft.slice(0, 28)) {
    log(
      `  ${s.tag}`,
      `over=${s.panelOver} scrollH=${s.scrollH || '-'}`,
      `actionsOut=${s.actionsOut} health=${s.healthSteps || 0}`,
    );
  }
}

const outPath = join(root, 'tools', 'probe-tick167-residual-scan.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length ? 2 : 0);
