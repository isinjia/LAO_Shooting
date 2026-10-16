/**
 * Tick167 focused — pause→OPTIONS + pause unmute-label chrome OOB.
 * Ship only if HARD unread proven; else support honest +0.
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

function classifyPause(m) {
  const unread =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2)) ||
    m.midOut ||
    (m.midH > 0 && m.midVis < Math.min(16, m.midH - 2)) ||
    m.mid2Out ||
    (m.mid2H > 0 && m.mid2Vis < Math.min(16, m.mid2H - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

const measurePause = `() => {
  const app = document.getElementById('app');
  const oc = document.getElementById('overlay-content');
  void oc?.offsetHeight;
  const appR = app.getBoundingClientRect();
  const ocR = oc.getBoundingClientRect();
  const pick = (sel) => oc.querySelector(sel);
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
  const cta = pick('#btn-resume');
  const sec = pick('#btn-quit');
  const mid = pick('#btn-pause-options');
  const mid2 = pick('#btn-pause-mute');
  const actions = pick('.pause-actions');
  return {
    panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
    maxH: oc.style.maxHeight || '',
    muteText: (mid2?.textContent || '').trim().slice(0, 32),
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
    actionsOut: actions ? out(actions) : false,
  };
}`;

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;
let healthLive = 0;

try {
  for (const size of SIZES) {
    for (const loc of LOCALES) {
      // A) Pause with muted:false → long unmute label
      {
        const page = await browser.newPage({ viewport: size });
        try {
          await page.addInitScript(
            ({ loc }) => {
              localStorage.setItem(
                'lao_mini_settings_v1',
                JSON.stringify({
                  lang: loc,
                  muted: false,
                  bgmVolume: 0,
                  sfxVolume: 0,
                  autoFire: true,
                  padMode: 'fixed',
                  fullscreen: false,
                }),
              );
              localStorage.setItem('lao_mini_tutorial_seen', '1');
              window.__tick167Health = { options: 0, optionsCaps: [] };
            },
            { loc },
          );
          await page.goto(`${url}?cb=t167u-${loc}-${size.width}x${size.height}`, {
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
          await page.click('#btn-start');
          await page.waitForSelector('#btn-go', { timeout: 60000 });
          await page.waitForTimeout(60);
          await page.evaluate(() => document.querySelector('.char-card, [data-char]')?.click());
          await page.waitForTimeout(30);
          await page.click('#btn-go');
          await page.waitForFunction(
            () => !!window.__LAO__?.getGame?.() || !!document.querySelector('#btn-tut-go'),
            { timeout: 60000 },
          );
          if (await page.$('#btn-tut-go')) await page.click('#btn-tut-go');
          await page.waitForFunction(() => !!window.__LAO__?.getGame?.(), { timeout: 60000 });
          await page.waitForTimeout(200);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(260);
          if (!(await page.$('#overlay-content.screen-pause'))) {
            log(`SKIP pause-unmute ${loc}@${size.width}x${size.height}`);
          } else {
            const m = await page.evaluate(eval(`(${measurePause})`));
            const cls = classifyPause(m);
            const tag = `pause-unmute ${loc}@${size.width}x${size.height}`;
            log(
              `${cls} ${tag}`,
              `over=${m.panelOver} mute="${m.muteText}"`,
              `cta=${m.ctaVis}/${m.ctaH} quit=${m.secVis}/${m.secH}`,
              `opt=${m.midVis}/${m.midH} muteBtn=${m.mid2Vis}/${m.mid2H}`,
            );
            if (cls === 'HARD') hard.push({ tag, ...m });
            else if (cls === 'SOFT') soft.push({ tag, ...m });
            else ok += 1;

            // B) Open OPTIONS from pause — LATENT health + BACK CTA
            await page.click('#btn-pause-options');
            await page.waitForSelector('#overlay-content.screen-options, #btn-opt-back', {
              timeout: 60000,
            });
            await page.waitForTimeout(220);
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
            await page.waitForTimeout(100);
            const om = await page.evaluate(() => {
              const app = document.getElementById('app');
              const oc = document.getElementById('overlay-content');
              void oc?.offsetHeight;
              const appR = app.getBoundingClientRect();
              const ocR = oc.getBoundingClientRect();
              const cta = oc.querySelector('#btn-opt-back');
              const actions = oc.querySelector('.opt-actions');
              const scroll = oc.querySelector('.opt-scroll');
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
                scrollSoft: !!(scroll && scroll.getBoundingClientRect().height + 0.5 < 72),
              };
            });
            const ocls = classifyOpt(om);
            const otag = `options-from-pause ${loc}@${size.width}x${size.height}`;
            log(
              `${ocls} ${otag}`,
              `over=${om.panelOver} maxH=${om.maxH} fitH=${om.fitH} inflated=${om.inflated}`,
              `health=${om.healthSteps} caps=${JSON.stringify(om.healthCaps)}`,
              `ctaOut=${om.ctaOut} ctaVis=${om.ctaVis}/${om.ctaH}`,
              `scrollH=${om.scrollH}`,
            );
            if (om.healthSteps > 0) healthLive += 1;
            if (ocls === 'HARD') hard.push({ tag: otag, ...om });
            else if (ocls === 'SOFT') soft.push({ tag: otag, ...om });
            else ok += 1;
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
      `ctaVis=${h.ctaVis}/${h.ctaH} secVis=${h.secVis || 0}/${h.secH || 0}`,
      `mid2Vis=${h.mid2Vis || 0}/${h.mid2H || 0} inflated=${h.inflated || false}`,
      `health=${h.healthSteps || 0}`,
    );
  }
}

const outPath = join(root, 'tools', 'probe-tick167-pause-opt.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard.length ? 2 : 0);
