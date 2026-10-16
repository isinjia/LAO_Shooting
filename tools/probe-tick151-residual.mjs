/**
 * Tick151 residual scan — outside exhausted tip/rim/charge/thin-panel/
 * touch-HUD axes. Prefer gameplay TOP HUD clip + loading real i18n.
 * HARD only: unread score/HI clip, scores×meta overlap, loading panelOver,
 * lives/bomb unread under landscape gameplay (not portrait rotate-lock).
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

function overlaps(a, b, pad = 2) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

const HUD_CASES = [
  { w: 320, h: 200, touch: true, tag: 'touch320' },
  { w: 342, h: 210, touch: true, tag: 'touch342' },
  { w: 360, h: 240, touch: true, tag: 'touch360' },
  { w: 361, h: 210, touch: true, tag: 'touch361' },
  { w: 375, h: 240, touch: true, tag: 'touch375' },
  { w: 400, h: 280, touch: true, tag: 'touch400' },
  { w: 568, h: 320, touch: true, tag: 'touchSE' },
  { w: 667, h: 375, touch: true, tag: 'touchPhoneL' },
  { w: 800, h: 450, touch: false, tag: 'desk800' },
  { w: 1280, h: 560, touch: false, tag: 'desk1280' },
  { w: 400, h: 280, touch: false, tag: 'desk400' },
  { w: 360, h: 240, touch: false, tag: 'desk360' },
];

const LOAD_LOCALES = ['ko', 'en', 'ja', 'pt', 'es', 'ru', 'zh-TW', 'zh-CN'];
const LOAD_KEYS = [
  'load.preparing',
  'load.bg',
  'load.titleReady',
  'load.selectReady',
  'load.sortieReady',
  'load.eager',
  'load.sortieReadyEager',
];
const LOAD_SIZES = [
  { width: 400, height: 280 },
  { width: 360, height: 240 },
  { width: 320, height: 200 },
  { width: 480, height: 288 },
  { width: 568, height: 320 },
];

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];

try {
  // ---- A) Gameplay TOP HUD clip / cluster collision ----
  for (const c of HUD_CASES) {
    const page = await browser.newPage({
      viewport: { width: c.w, height: c.h },
      hasTouch: !!c.touch,
      isMobile: !!c.touch,
    });
    try {
      await page.addInitScript(({ touch }) => {
        localStorage.setItem(
          'lao_mini_settings_v1',
          JSON.stringify({
            lang: 'en',
            muted: true,
            bgmVolume: 0,
            sfxVolume: 0,
            autoFire: true,
            padMode: 'fixed',
            fullscreen: false,
          }),
        );
        if (touch) {
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        }
      }, { touch: !!c.touch });
      await page.goto(`${url}?cb=t151hud-${c.tag}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });

      const geo = await page.evaluate(
        ({ touch, overlapsSrc }) => {
          const overlapsFn = eval(`(${overlapsSrc})`);
          if (touch) {
            document.body.classList.add('touch-ui', 'has-touch-pads');
            const tc = document.getElementById('touch-controls');
            tc.classList.add('is-on', 'tc-mode-fixed');
            tc.setAttribute('aria-hidden', 'false');
          }
          document.getElementById('overlay').style.display = 'none';
          // Big score / HI to stress digit width
          const score = document.getElementById('score');
          const hi = document.getElementById('hi-score');
          if (score) score.textContent = '9999999';
          if (hi) hi.textContent = '9999999';
          const graze = document.getElementById('graze');
          if (graze) graze.textContent = '9999';
          const combo = document.getElementById('combo-val');
          if (combo) combo.textContent = '999';
          void document.body.offsetHeight;

          const R = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              w: r.width,
              h: r.height,
            };
          };
          const visW = (a, clip) =>
            !a || !clip
              ? 0
              : Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
          const visH = (a, clip) =>
            !a || !clip
              ? 0
              : Math.max(0, Math.min(a.bottom, clip.bottom) - Math.max(a.top, clip.top));

          const top = R('.hud-top');
          const scores = R('.hud-scores');
          const meta = R('.hud-meta');
          const scoreVal = R('#score');
          const hiVal = R('#hi-score');
          const stageVal = R('#stage-num');
          const lives = R('#lives');
          const bombs = R('#bombs');
          const power = R('.power-badge');
          const stocks = R('.hud-stocks');
          const gauges = R('.hud-gauges');
          const spStatus = R('#sp-status');
          const boss = R('#boss-bar');
          const app = R('#app');
          const pause = R('#pause-flag');

          const scoreVis = visW(scoreVal, scores);
          const hiVis = visW(hiVal, scores);
          const scoreClip =
            scoreVal && scores
              ? scoreVal.w > 0 && scoreVis < scoreVal.w * 0.55
              : false;
          const hiClip =
            hiVal && scores ? hiVal.w > 0 && hiVis < hiVal.w * 0.55 : false;
          // digit unread if visible width < ~28px for 7-digit
          const scoreUnread = scoreVal && scoreVis > 0 && scoreVis < 28;
          const hiUnread = hiVal && hiVis > 0 && hiVis < 28;

          const scoresMeta = scores && meta && overlapsFn(scores, meta, 1);
          const gapSM =
            scores && meta ? +(meta.left - scores.right).toFixed(1) : null;

          // meta stats overflow their cluster?
          const metaStats = [...document.querySelectorAll('.hud-meta .hud-stat')].map(
            (el) => {
              const r = el.getBoundingClientRect();
              const lbl = el.querySelector('.hud-lbl');
              const val = el.querySelector('.hud-val');
              const disp = getComputedStyle(el).display;
              return {
                disp,
                w: +r.width.toFixed(1),
                lblW: lbl ? +lbl.getBoundingClientRect().width.toFixed(1) : 0,
                valW: val ? +val.getBoundingClientRect().width.toFixed(1) : 0,
                valScroll: val ? val.scrollWidth : 0,
                valOv:
                  val &&
                  getComputedStyle(val).display !== 'none' &&
                  val.scrollWidth > val.getBoundingClientRect().width + 1,
              };
            },
          );

          const scoreScroll = score
            ? { sw: score.scrollWidth, w: score.getBoundingClientRect().width }
            : null;
          const hiScroll = hi
            ? { sw: hi.scrollWidth, w: hi.getBoundingClientRect().width }
            : null;

          const topOut =
            top && app
              ? top.right > app.right + 2 || top.left < app.left - 2
              : false;
          const scoresOut =
            scores && app
              ? scores.right > app.right + 2 || scores.left < app.left - 2
              : false;
          const metaOut =
            meta && app
              ? meta.right > app.right + 2 || meta.left < app.left - 2
              : false;

          // SP status line clip vs gauges / viewport
          const spDisp = spStatus
            ? getComputedStyle(document.getElementById('sp-status')).display
            : 'none';
          const spVisH =
            spStatus && gauges ? visH(spStatus, gauges) : 0;
          const spClip =
            spDisp !== 'none' &&
            spStatus &&
            spStatus.h > 2 &&
            spVisH < spStatus.h * 0.5;

          // life/bomb number visibility in stocks
          const livesVis = visW(lives, stocks);
          const bombsVis = visW(bombs, stocks);
          const powerVis = visW(power, stocks);

          const bossDisp = boss
            ? getComputedStyle(document.getElementById('boss-bar')).display
            : 'none';

          return {
            topW: top ? +top.w.toFixed(1) : 0,
            scoresW: scores ? +scores.w.toFixed(1) : 0,
            metaW: meta ? +meta.w.toFixed(1) : 0,
            scoreVis: +scoreVis.toFixed(1),
            hiVis: +hiVis.toFixed(1),
            scoreW: scoreVal ? +scoreVal.w.toFixed(1) : 0,
            hiW: hiVal ? +hiVal.w.toFixed(1) : 0,
            scoreClip,
            hiClip,
            scoreUnread,
            hiUnread,
            scoreSw: scoreScroll ? scoreScroll.sw : 0,
            hiSw: hiScroll ? hiScroll.sw : 0,
            scoresMeta,
            gapSM,
            metaStats,
            topOut,
            scoresOut,
            metaOut,
            stageW: stageVal ? +stageVal.w.toFixed(1) : 0,
            livesVis: +livesVis.toFixed(1),
            bombsVis: +bombsVis.toFixed(1),
            powerVis: +powerVis.toFixed(1),
            spDisp,
            spH: spStatus ? +spStatus.h.toFixed(1) : 0,
            spVisH: +spVisH.toFixed(1),
            spClip,
            bossDisp,
            pauseDisp: pause
              ? getComputedStyle(document.getElementById('pause-flag')).opacity
              : '0',
            landscape: window.matchMedia('(orientation: landscape)').matches,
          };
        },
        { touch: !!c.touch, overlapsSrc: overlaps.toString() },
      );

      const flags = [];
      const softFlags = [];
      if (geo.landscape) {
        if (geo.scoreUnread || geo.scoreClip) flags.push(`scoreClip=${geo.scoreVis}/${geo.scoreW}`);
        if (geo.hiUnread || geo.hiClip) flags.push(`hiClip=${geo.hiVis}/${geo.hiW}`);
        if (geo.scoresMeta && geo.gapSM != null && geo.gapSM < -4) {
          flags.push(`scores×meta gap=${geo.gapSM}`);
        } else if (geo.scoresMeta) {
          softFlags.push(`scores×meta soft gap=${geo.gapSM}`);
        }
        if (geo.topOut || geo.scoresOut || geo.metaOut) {
          flags.push(
            `hudTopOOB top=${geo.topOut} sc=${geo.scoresOut} meta=${geo.metaOut}`,
          );
        }
        if (geo.spClip) flags.push(`spStatusClip h=${geo.spH} vis=${geo.spVisH}`);
        // lives/bombs unread only if nearly invisible while stocks present
        if (geo.livesVis > 0 && geo.livesVis < 6) flags.push(`livesVis=${geo.livesVis}`);
        if (geo.bombsVis > 0 && geo.bombsVis < 6) flags.push(`bombsVis=${geo.bombsVis}`);
        // meta val overflow with tiny width
        for (const m of geo.metaStats || []) {
          if (m.disp === 'none') continue;
          if (m.valOv && m.valW < 12) flags.push(`metaValClip=${m.valW}/${m.valScroll}`);
          else if (m.valOv && m.valW < 18) softFlags.push(`metaValOv=${m.valW}/${m.valScroll}`);
        }
        // digit soft: scrollWidth > client but still mostly visible
        if (
          geo.scoreSw > geo.scoreW + 2 &&
          geo.scoreVis >= 28 &&
          !geo.scoreClip
        ) {
          softFlags.push(`scoreEllip ${geo.scoreW}/${geo.scoreSw}`);
        }
      }

      const line = [
        `HUD ${c.tag}@${c.w}x${c.h}`,
        `scW=${geo.scoresW} metaW=${geo.metaW} gapSM=${geo.gapSM}`,
        `scoreVis=${geo.scoreVis}/${geo.scoreW} hiVis=${geo.hiVis}/${geo.hiW}`,
        `lives=${geo.livesVis} bombs=${geo.bombsVis} power=${geo.powerVis}`,
        `sp=${geo.spDisp}:${geo.spH}/${geo.spVisH}`,
        flags.length ? `HARD:${flags.join(',')}` : softFlags.length ? `soft:${softFlags.join(',')}` : 'ok',
      ].join(' ');
      console.log(line);
      if (flags.length) hard.push({ kind: 'hud', tag: c.tag, w: c.w, h: c.h, flags, geo });
      else if (softFlags.length) soft.push({ kind: 'hud', tag: c.tag, w: c.w, h: c.h, softFlags });
    } finally {
      await page.close();
    }
  }

  // ---- B) Loading real i18n panelOver ----
  for (const size of LOAD_SIZES) {
    for (const loc of LOAD_LOCALES) {
      const page = await browser.newPage({ viewport: size });
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
        }, { loc });
        await page.goto(`${url}?cb=t151load-${loc}-${size.width}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });

        const rows = await page.evaluate(({ loadKeys }) => {
          const overlay = document.getElementById('overlay');
          const content = document.getElementById('overlay-content');
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
            <p id="loading-label"></p>
            <div class="load-track" aria-hidden="true">
              <div class="load-fill" id="load-fill" style="width:55%"></div>
            </div>
            <div class="load-meta">
              <span id="load-count">12 / 22</span>
              <span id="load-pct">55%</span>
            </div>
          `;
          const t = window.t || ((k) => k);
          const app = document.getElementById('app');
          const out = [];
          for (const key of loadKeys) {
            const lab = document.getElementById('loading-label');
            lab.textContent = typeof t === 'function' ? t(key) : key;
            void content.offsetHeight;
            const appR = app.getBoundingClientRect();
            const ocR = content.getBoundingClientRect();
            const labR = lab.getBoundingClientRect();
            const panelOver = Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top);
            const labelClip =
              labR.width > 2 &&
              (lab.scrollWidth > labR.width + 2 ||
                labR.right > ocR.right + 2 ||
                labR.left < ocR.left - 2);
            out.push({
              key,
              text: lab.textContent,
              panelOver: +panelOver.toFixed(2),
              headroom: +(appR.bottom - ocR.bottom).toFixed(2),
              ocH: +ocR.height.toFixed(2),
              labelH: +labR.height.toFixed(2),
              labelW: +labR.width.toFixed(1),
              labelSw: lab.scrollWidth,
              labelClip,
              brandH: +(
                content.querySelector('.brand-mark')?.getBoundingClientRect().height || 0
              ).toFixed(2),
            });
          }
          return out;
        }, { loadKeys: LOAD_KEYS });

        for (const r of rows) {
          if (r.panelOver > 1.5) {
            hard.push({
              kind: 'load',
              loc,
              w: size.width,
              h: size.height,
              flags: [`panelOver=${r.panelOver}`],
              r,
            });
            console.log(
              `LOAD-HARD ${loc}@${size.width}x${size.height} ${r.key}`,
              `over=${r.panelOver} hr=${r.headroom}`,
              `| ${r.text}`,
            );
          } else if (r.labelClip && r.labelW < 40) {
            hard.push({
              kind: 'load',
              loc,
              w: size.width,
              h: size.height,
              flags: [`labelClip=${r.labelW}/${r.labelSw}`],
              r,
            });
            console.log(
              `LOAD-HARD-CLIP ${loc}@${size.width}x${size.height} ${r.key}`,
              `w=${r.labelW}/${r.labelSw}`,
              `| ${r.text}`,
            );
          } else if (r.labelClip) {
            soft.push({
              kind: 'load',
              loc,
              w: size.width,
              h: size.height,
              softFlags: [`labelEllip=${r.labelW}/${r.labelSw}`],
            });
            if (size.height <= 240) {
              console.log(
                `LOAD-soft ${loc}@${size.width}x${size.height} ${r.key}`,
                `w=${r.labelW}/${r.labelSw} over=${r.panelOver}`,
                `| ${r.text}`,
              );
            }
          }
        }
      } finally {
        await page.close();
      }
    }
  }

  // ---- C) Bottom HUD quick HARD recheck @361 cliff (confirm tick150) ----
  for (const c of [
    { w: 361, h: 210, tag: 'bot361' },
    { w: 363, h: 220, tag: 'bot363' },
    { w: 364, h: 220, tag: 'bot364' },
  ]) {
    const page = await browser.newPage({
      viewport: { width: c.w, height: c.h },
      hasTouch: true,
      isMobile: true,
    });
    try {
      await page.addInitScript(() => {
        localStorage.setItem(
          'lao_mini_settings_v1',
          JSON.stringify({
            lang: 'en',
            muted: true,
            bgmVolume: 0,
            sfxVolume: 0,
            autoFire: true,
            padMode: 'fixed',
            fullscreen: false,
          }),
        );
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      });
      await page.goto(`${url}?cb=t151bot-${c.tag}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('#btn-start', { timeout: 60000 });
      const geo = await page.evaluate((overlapsSrc) => {
        const overlapsFn = eval(`(${overlapsSrc})`);
        document.body.classList.add('touch-ui', 'has-touch-pads');
        const tc = document.getElementById('touch-controls');
        tc.classList.add('is-on', 'tc-mode-fixed');
        tc.setAttribute('aria-hidden', 'false');
        document.getElementById('overlay').style.display = 'none';
        void tc.offsetHeight;
        const R = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
        };
        const visW = (a, clip) =>
          !a || !clip
            ? 0
            : Math.max(0, Math.min(a.right, clip.right) - Math.max(a.left, clip.left));
        const stocks = R('.hud-stocks');
        const gauges = R('.hud-gauges');
        const power = R('.power-badge');
        const charge = R('#charge-track');
        const bomb = R('.tc-bomb');
        const lbl = document.querySelector('#charge-row .sp-label');
        const lblRect = lbl ? lbl.getBoundingClientRect() : null;
        const lblOverflow =
          lbl &&
          getComputedStyle(lbl).display !== 'none' &&
          lbl.scrollWidth > lblRect.width + 1;
        return {
          powerVis: +visW(power, stocks).toFixed(1),
          powerW: power ? +power.w.toFixed(1) : 0,
          cIn: +visW(charge, gauges).toFixed(1),
          cLblW: lblRect ? +lblRect.width.toFixed(1) : 0,
          cLblScroll: lbl ? lbl.scrollWidth : 0,
          cLblDisp: lbl ? getComputedStyle(lbl).display : null,
          lblOverflow,
          bombCharge: bomb && charge && overlapsFn(bomb, charge, 2),
        };
      }, overlaps.toString());
      const flags = [];
      if (geo.powerVis < 12 && geo.powerW > 0) flags.push(`powerVis=${geo.powerVis}`);
      if (
        geo.cLblDisp !== 'none' &&
        geo.lblOverflow &&
        geo.cLblW < 20
      ) {
        flags.push(`cLblClip=${geo.cLblW}/${geo.cLblScroll}`);
      }
      if (geo.cIn < 20) flags.push(`cIn=${geo.cIn}`);
      if (geo.bombCharge) flags.push('bomb×charge');
      console.log(
        `BOT ${c.tag}@${c.w}x${c.h}`,
        `powerVis=${geo.powerVis}/${geo.powerW} cIn=${geo.cIn}`,
        `cLbl=${geo.cLblDisp}:${geo.cLblW}/${geo.cLblScroll}${geo.lblOverflow ? '!ov' : ''}`,
        flags.length ? `HARD:${flags.join(',')}` : 'ok/soft',
      );
      if (flags.length) hard.push({ kind: 'bot', tag: c.tag, w: c.w, h: c.h, flags, geo });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== HARD SUMMARY ===', hard.length);
for (const m of hard) {
  console.log(JSON.stringify({ kind: m.kind, tag: m.tag || m.loc, w: m.w, h: m.h, flags: m.flags }));
}
console.log('=== SOFT count ===', soft.length);
for (const m of soft.slice(0, 24)) {
  console.log(JSON.stringify({ kind: m.kind, tag: m.tag || m.loc, w: m.w, h: m.h, soft: m.softFlags }));
}
if (soft.length > 24) console.log(`... +${soft.length - 24} more soft`);
