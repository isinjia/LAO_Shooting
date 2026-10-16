/**
 * Tick146 preferred-axis live scan (outside tip/rim/charge/panel-budget closed lists):
 *   A) Loading screen clip / panelOver / label overflow @ thin heights
 *   B) Rotate-card portrait overflow (narrow + tall) × long locales
 *   C) Touch-pad + gameplay HUD clip/overlap when has-touch-pads forced
 * Flags clear muddy only (panelOver / cardOut / hudOut / pad overlap on stocks/gauges).
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

function overlaps(a, b, pad = 1) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

function outOf(el, box, tol = 1.5) {
  if (!el || !box) return false;
  const r = el.getBoundingClientRect();
  return (
    r.bottom > box.bottom + tol ||
    r.top < box.top - tol ||
    r.right > box.right + tol ||
    r.left < box.left - tol
  );
}

const LOCALES = ['ko', 'en', 'pt', 'es', 'ru', 'zh-TW'];
const LANDSCAPE = [
  { width: 800, height: 450 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
  { width: 480, height: 288 },
  { width: 400, height: 280 },
];
const PORTRAIT = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
  { width: 280, height: 480 },
];

const LONG_LABELS = [
  'Preparing character sprites and stage banks…',
  'Подготовка ресурсов персонажа и сцены…',
  'Preparando recursos do personagem e do estágio…',
  'Preparando recursos del personaje y la etapa…',
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const findings = [];

async function boot(size, loc, { touch = false, tutorialSeen = '1' } = {}) {
  const page = await browser.newPage({
    viewport: size,
    hasTouch: touch,
    isMobile: touch,
  });
  await page.addInitScript(
    ({ loc, tutorialSeen, touch }) => {
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
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => (touch ? 5 : 0),
      });
    },
    { loc, tutorialSeen, touch },
  );
  await page.goto(`${url}?cb=t146-${Date.now()}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start, #rotate-hint', { timeout: 60000 });
  return page;
}

try {
  // ========== A) LOADING ==========
  for (const size of LANDSCAPE) {
    for (const loc of LOCALES) {
      const page = await boot(size, loc);
      try {
        const m = await page.evaluate(
          ({ outOfSrc, longLabels }) => {
            const outOf = eval(`(${outOfSrc})`);
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('overlay-content');
            if (!overlay || !content) return { kind: 'loading', missing: true };
            if (typeof window.showLoading === 'function') {
              window.showLoading();
            } else {
              overlay.classList.add('show');
              overlay.classList.remove('hidden');
              overlay.style.display = 'flex';
              content.className = 'screen-loading';
              content.style.cssText = '';
              content.innerHTML = `
                <div class="panel-frame" aria-hidden="true"></div>
                <span class="brand-mark">LAO MINI ACTION</span>
                <h2>LOADING</h2>
                <span class="loading-deco" aria-hidden="true"></span>
                <p id="loading-label">Preparing assets…</p>
                <div class="load-track" aria-hidden="true">
                  <div class="load-fill" id="load-fill" style="width:55%"></div>
                </div>
                <div class="load-meta">
                  <span id="load-count">12 / 22</span>
                  <span id="load-pct">55%</span>
                </div>
              `;
            }
            const lab = document.getElementById('loading-label');
            if (lab) lab.textContent = longLabels[2] || longLabels[0];
            const fill = document.getElementById('load-fill');
            if (fill) fill.style.width = '62%';
            void content.offsetHeight;
            const app = document.getElementById('app');
            const oc = document.getElementById('overlay-content');
            const appR = app.getBoundingClientRect();
            const ocR = oc.getBoundingClientRect();
            const label = document.getElementById('loading-label');
            const meta = document.querySelector('.load-meta');
            const track = document.querySelector('.load-track');
            const brand = oc.querySelector('.brand-mark');
            const h2 = oc.querySelector('h2');
            const deco = oc.querySelector('.loading-deco');
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const labelClip =
              label &&
              (label.scrollWidth > label.clientWidth + 1 ||
                label.scrollHeight > label.clientHeight + 2);
            return {
              kind: 'loading',
              fitH: Math.floor(Math.min(app.clientHeight || 0, appR.height)),
              ocH: +ocR.height.toFixed(2),
              panelOver: +panelOver.toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              brandOut: brand ? outOf(brand, appR) : null,
              h2Out: h2 ? outOf(h2, appR) : null,
              labelOut: label ? outOf(label, appR) : null,
              metaOut: meta ? outOf(meta, appR) : null,
              trackOut: track ? outOf(track, appR) : null,
              decoOut: deco ? outOf(deco, appR) : null,
              labelClip: !!labelClip,
              labelText: label?.textContent?.slice(0, 48) || '',
            };
          },
          { outOfSrc: outOf.toString(), longLabels: LONG_LABELS },
        );
        // Also try __LAO path if loading wasn't real showLoading
        if (m.missing) {
          console.log(`LOAD miss ${loc}@${size.width}x${size.height}`);
        } else {
          const muddy =
            m.panelOver > 1.5 ||
            m.labelOut === true ||
            m.metaOut === true ||
            m.trackOut === true ||
            m.h2Out === true ||
            m.labelClip === true;
          findings.push({ loc, ...size, ...m, muddy });
          if (muddy || size.height <= 320) {
            console.log(
              `LOAD ${loc}@${size.width}x${size.height}`,
              `over=${m.panelOver} hr=${m.headroom} ocH=${m.ocH}`,
              `labelOut=${m.labelOut} metaOut=${m.metaOut} clip=${m.labelClip}`,
              `muddy=${muddy}`,
            );
          }
        }
      } finally {
        await page.close();
      }
    }
  }

  // ========== B) ROTATE-CARD (portrait) ==========
  for (const size of PORTRAIT) {
    for (const loc of LOCALES) {
      const page = await boot(size, loc, { touch: true });
      try {
        await page.waitForTimeout(160);
        const m = await page.evaluate((outOfSrc) => {
          const outOf = eval(`(${outOfSrc})`);
          const hint = document.getElementById('rotate-hint');
          const card = document.querySelector('.rotate-card');
          const strong = card?.querySelector('strong');
          const p = card?.querySelector('p');
          const icon = card?.querySelector('.rotate-icon');
          if (!hint || !card) return { kind: 'rotate', missing: true };
          // Force on if detection lag
          hint.classList.add('is-on');
          document.body.classList.add('is-portrait');
          void card.offsetHeight;
          const vr = {
            top: 0,
            left: 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
            width: window.innerWidth,
            height: window.innerHeight,
          };
          const cardR = card.getBoundingClientRect();
          const cardOut =
            cardR.bottom > vr.bottom + 1.5 ||
            cardR.top < vr.top - 1.5 ||
            cardR.right > vr.right + 1.5 ||
            cardR.left < vr.left - 1.5;
          const strongClip =
            strong &&
            (strong.scrollWidth > strong.clientWidth + 1 ||
              strong.scrollHeight > strong.clientHeight + 2);
          const pClip =
            p && (p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 4);
          return {
            kind: 'rotate',
            isOn: hint.classList.contains('is-on'),
            cardW: +cardR.width.toFixed(2),
            cardH: +cardR.height.toFixed(2),
            cardOut,
            strongOut: strong ? outOf(strong, vr) : null,
            pOut: p ? outOf(p, vr) : null,
            iconOut: icon ? outOf(icon, vr) : null,
            strongClip: !!strongClip,
            pClip: !!pClip,
            strongText: strong?.textContent?.slice(0, 56) || '',
            pad: getComputedStyle(hint).padding,
          };
        }, outOf.toString());
        const muddy =
          !m.missing &&
          (m.cardOut === true ||
            m.strongOut === true ||
            m.pOut === true ||
            m.strongClip === true);
        // pClip alone is softer — only muddy if also cardOut/strongClip
        findings.push({ loc, ...size, ...m, muddy: !!muddy });
        if (muddy || size.width <= 320 || loc === 'ru') {
          console.log(
            `ROT ${loc}@${size.width}x${size.height}`,
            `card=${m.cardW}x${m.cardH} out=${m.cardOut}`,
            `strongClip=${m.strongClip} pClip=${m.pClip} muddy=${muddy}`,
            `| ${m.strongText}`,
          );
        }
      } finally {
        await page.close();
      }
    }
  }

  // ========== C) TOUCH PAD + HUD ==========
  for (const size of LANDSCAPE) {
    for (const loc of ['en', 'ru', 'es']) {
      const page = await boot(size, loc, { touch: true });
      try {
        // Enter select → go into play path enough to show pads, or force pads
        await page.evaluate(() => {
          document.body.classList.add('touch-ui', 'has-touch-pads');
          const tc = document.getElementById('touch-controls');
          if (tc) {
            tc.classList.add('is-on');
            tc.setAttribute('aria-hidden', 'false');
            tc.style.display = 'block';
            tc.style.visibility = 'visible';
            tc.style.pointerEvents = 'auto';
            tc.style.opacity = '1';
          }
          // Ensure HUD visible (hide overlay)
          const overlay = document.getElementById('overlay');
          if (overlay) {
            overlay.classList.remove('show');
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
          }
          document.getElementById('hud')?.classList.remove('hidden');
        });
        await page.waitForTimeout(80);
        const m = await page.evaluate(
          ({ outOfSrc, overlapsSrc }) => {
            const outOf = eval(`(${outOfSrc})`);
            const overlaps = eval(`(${overlapsSrc})`);
            const app = document.getElementById('app');
            const appR = app.getBoundingClientRect();
            const rect = (sel) => {
              const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
              if (!el) return null;
              const r = el.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) return null;
              return {
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
              };
            };
            const stick = rect('.tc-stick-zone');
            const actions = rect('.tc-actions');
            const fire = rect('.tc-fire');
            const bomb = rect('.tc-bomb');
            const special = rect('.tc-special');
            const focus = rect('.tc-focus');
            const pause = rect('.tc-pause');
            const bottom = rect('.hud-bottom');
            const stocks = rect('.hud-stocks');
            const gauges = rect('.hud-gauges');
            const top = rect('.hud-top');
            const charge = rect('#charge-track');
            const sp = rect('#sp-track');
            const score = rect('.hud-stat-score') || rect('#score');
            const boss = rect('#boss-bar:not(.hidden)');

            const padRects = [stick, actions, fire, bomb, special, focus, pause].filter(Boolean);
            const hudRects = {
              stocks,
              gauges,
              charge,
              sp,
              top,
              score,
            };

            const overlapsHud = {};
            for (const [name, hr] of Object.entries(hudRects)) {
              if (!hr) continue;
              overlapsHud[name] = padRects.some((pr) => overlaps(pr, hr, 2));
            }

            const boxOutR = (r, box, tol = 1.5) => {
              if (!r || !box) return false;
              return (
                r.bottom > box.bottom + tol ||
                r.top < box.top - tol ||
                r.right > box.right + tol ||
                r.left < box.left - tol
              );
            };
            const padOut = {
              stick: stick ? boxOutR(stick, appR) : null,
              actions: actions ? boxOutR(actions, appR) : null,
              fire: fire ? boxOutR(fire, appR) : null,
              pause: pause ? boxOutR(pause, appR) : null,
            };
            const hudOut = {
              bottom: bottom ? boxOutR(bottom, appR) : null,
              stocks: stocks ? boxOutR(stocks, appR) : null,
              gauges: gauges ? boxOutR(gauges, appR) : null,
              top: top ? boxOutR(top, appR) : null,
              charge: charge ? boxOutR(charge, appR) : null,
            };

            // Caption readability: FIRE caption fully inside fire btn?
            const fireCap = document.querySelector('.tc-fire .tc-caption');
            let fireCapClip = false;
            if (fireCap && fire) {
              const cr = fireCap.getBoundingClientRect();
              fireCapClip =
                cr.bottom > fire.bottom + 2 ||
                cr.top < fire.top - 6 ||
                cr.right > fire.right + 4 ||
                cr.left < fire.left - 4;
            }

            const anyPadHudOverlap = Object.values(overlapsHud).some(Boolean);
            const anyPadOut = Object.values(padOut).some((v) => v === true);
            const anyHudOut = Object.values(hudOut).some((v) => v === true);

            return {
              kind: 'touch-hud',
              stick,
              actions,
              bottom,
              stocks,
              gauges,
              overlapsHud,
              padOut,
              hudOut,
              fireCapClip,
              hasPadsClass: document.body.classList.contains('has-touch-pads'),
              tcVisible: !!stick || !!actions,
              anyPadHudOverlap,
              anyPadOut,
              anyHudOut,
              bossPresent: !!boss,
            };
          },
          { outOfSrc: outOf.toString(), overlapsSrc: overlaps.toString() },
        );
        // Fix padOut using proper geometry (evaluate already did)
        const muddy =
          m.tcVisible &&
          (m.anyPadHudOverlap === true ||
            m.anyPadOut === true ||
            m.anyHudOut === true ||
            m.fireCapClip === true);
        findings.push({ loc, ...size, ...m, muddy: !!muddy });
        if (muddy || size.height <= 320) {
          console.log(
            `PAD ${loc}@${size.width}x${size.height}`,
            `overlap=${JSON.stringify(m.overlapsHud)}`,
            `padOut=${JSON.stringify(m.padOut)}`,
            `hudOut=${JSON.stringify(m.hudOut)}`,
            `fireCapClip=${m.fireCapClip} muddy=${muddy}`,
          );
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

const muddy = findings.filter((f) => f.muddy);
console.log('\n=== TICK146 SUMMARY ===');
console.log('total', findings.length, 'muddy', muddy.length);
const byKind = {};
for (const r of findings) {
  byKind[r.kind] = byKind[r.kind] || { total: 0, muddy: 0 };
  byKind[r.kind].total++;
  if (r.muddy) byKind[r.kind].muddy++;
}
console.log('byKind', byKind);
for (const r of muddy) {
  console.log(
    `MUDDY ${r.kind} ${r.loc}@${r.width}x${r.height}`,
    r.panelOver != null ? `over=${r.panelOver}` : '',
    r.cardOut != null ? `cardOut=${r.cardOut}` : '',
    r.anyPadHudOverlap != null ? `padHud=${r.anyPadHudOverlap}` : '',
    r.labelClip != null ? `labelClip=${r.labelClip}` : '',
    r.strongClip != null ? `strongClip=${r.strongClip}` : '',
    r.fireCapClip != null ? `fireCap=${r.fireCapClip}` : '',
  );
}
if (!muddy.length) console.log('No clear live muddy on preferred axes (loading/rotate/touch-hud).');
