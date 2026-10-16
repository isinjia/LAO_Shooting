/**
 * Tick181 — residual HARD scan after tick180 OPTIONS panel NEW mid-short +0.
 * NEW axis (DIFFERENT panel/viewport from ticks 173–180 landscape mid-short
 * select/pause/tut+result/title START-OPTIONS/rare eternity/loading/AE/OPTIONS):
 *   Production rotate overlay (rotate-hint.is-on / .rotate-card strong+p)
 *   @ PORTRAIT swap of NEW mid-short:
 *   218×360 / 212×375 / 228×404 / 245×430 × pt/es/ru.
 * Distinct from tick168 rotate-vv 360×640 / 400×700 / 320×568 / 240×320.
 * HARD bar = strong/p unread vs window viewport (tick168 rotate-vv).
 * REJECT: display:none / zero-rect / letterbox #app naive OOB (tick173);
 * #app overApp false HARD (tick168 KEEP); oc-out with visVv full (tick174);
 * title HI floor (tick135/176); rare ru@430 cardOver vis-full (tick177 SOFT);
 * AE@404 oc-peek visApp full (tick179 SOFT); OPTIONS ru@360 scrollH=71 with
 * BACK vis 46/46 (tick180 SOFT). cardOverVv with text vis full = SOFT invent CLOSED.
 * dens FROZEN. No HOLD uniqueness re-dump (tick174 stands).
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

const LONG = ['pt', 'es', 'ru'];
/** Portrait swap of NEW mid-short 360×218 / 375×212 / 404×228 / 430×245. */
const SIZES = [
  { width: 218, height: 360 },
  { width: 212, height: 375 },
  { width: 228, height: 404 },
  { width: 245, height: 430 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classifyRotate(m) {
  const hidden = (h, displayNone) => displayNone || h < 0.5;
  const unreadEl = (vis, h, minVis, out, displayNone) => {
    if (hidden(h, displayNone)) return false;
    // vis-unread only. out with vis full is tick174-class false HARD.
    return h > 0 && vis < Math.min(minVis, Math.max(6, h - 2));
  };
  const unread =
    unreadEl(m.strongVisVv, m.strongH, 12, m.strongOutVv, m.strongNone) ||
    unreadEl(m.pVisVv, m.pH, 12, m.pOutVv, m.pNone);
  const ocPeek =
    (m.strongOutVv && !unreadEl(m.strongVisVv, m.strongH, 12, false, m.strongNone)) ||
    (m.pOutVv && !unreadEl(m.pVisVv, m.pH, 12, false, m.pNone));
  const soft = !unread && (m.panelOverVv > 1.5 || ocPeek);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function boot(browser, url, size, loc, tag) {
  const page = await browser.newPage({ viewport: size });
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
    },
    { loc },
  );
  await page.goto(`${url}?cb=t181-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#rotate-hint, #btn-start', { timeout: 60000 });
  return page;
}

async function measureRotate(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const hint = document.getElementById('rotate-hint');
    const card = hint?.querySelector('.rotate-card');
    const icon = hint?.querySelector('.rotate-icon');
    const strong = hint?.querySelector('strong');
    const p = hint?.querySelector('p');
    void hint?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const cardR = card?.getBoundingClientRect();
    const hintR = hint?.getBoundingClientRect();
    const vv = {
      top: 0,
      left: 0,
      bottom: window.innerHeight,
      right: window.innerWidth,
      height: window.innerHeight,
      width: window.innerWidth,
    };
    const none = (node) => {
      if (!node) return true;
      const cs = getComputedStyle(node);
      return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
    };
    const vis = (node, clipR) => {
      if (!node || none(node)) return 0;
      const r = node.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, clipR.bottom) - Math.max(r.top, clipR.top));
    };
    const out = (node, clipR) => {
      if (!node || none(node)) return false;
      const r = node.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) return false;
      return (
        r.bottom > clipR.bottom + 1.5 ||
        r.top < clipR.top - 1.5 ||
        r.right > clipR.right + 1.5 ||
        r.left < clipR.left - 1.5
      );
    };
    const bh = (node) => (node && !none(node) ? +node.getBoundingClientRect().height.toFixed(1) : 0);
    const hintCs = hint ? getComputedStyle(hint) : null;
    return {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      isOn: !!hint?.classList.contains('is-on'),
      hintDisp: hintCs?.display || 'missing',
      hintNone: none(hint),
      panelOverVv: cardR
        ? +Math.max(0, cardR.bottom - vv.bottom, vv.top - cardR.top).toFixed(2)
        : 0,
      panelOverApp: cardR
        ? +Math.max(0, cardR.bottom - appR.bottom, appR.top - cardR.top).toFixed(2)
        : 0,
      cardH: cardR ? +cardR.height.toFixed(1) : 0,
      cardW: cardR ? +cardR.width.toFixed(1) : 0,
      cardTop: cardR ? +cardR.top.toFixed(2) : 0,
      cardBot: cardR ? +cardR.bottom.toFixed(2) : 0,
      hintH: hintR ? +hintR.height.toFixed(1) : 0,
      appH: +appR.height.toFixed(1),
      appW: +appR.width.toFixed(1),
      appTop: +appR.top.toFixed(2),
      iconNone: none(icon),
      iconH: bh(icon),
      iconVisVv: +vis(icon, vv).toFixed(1),
      strongNone: none(strong),
      strongVisVv: +vis(strong, vv).toFixed(1),
      strongVisApp: +vis(strong, appR).toFixed(1),
      strongH: bh(strong),
      strongOutVv: strong ? out(strong, vv) : false,
      strongOutApp: strong ? out(strong, appR) : false,
      pNone: none(p),
      pVisVv: +vis(p, vv).toFixed(1),
      pVisApp: +vis(p, appR).toFixed(1),
      pH: bh(p),
      pOutVv: p ? out(p, vv) : false,
      pOutApp: p ? out(p, appR) : false,
      strongText: (strong?.textContent || '').trim(),
      pText: (p?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      cardBox: cardR
        ? {
            t: +cardR.top.toFixed(1),
            b: +cardR.bottom.toFixed(1),
            l: +cardR.left.toFixed(1),
            r: +cardR.right.toFixed(1),
          }
        : null,
    };
  });
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== A) Rotate overlay @ PORTRAIT swap of NEW mid-short (not tick168 360×640 set) ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'rt');
    try {
      await page.waitForTimeout(180);
      const m = await measureRotate(page);
      const cls = classifyRotate(m);
      const row = [
        `RT ${loc}@${size.width}×${size.height} → ${cls}`,
        `isOn=${m.isOn}`,
        `hintDisp=${m.hintDisp}`,
        `hintNone=${m.hintNone}`,
        `strong=${m.strongVisVv}/${m.strongH} app=${m.strongVisApp}`,
        `p=${m.pVisVv}/${m.pH} app=${m.pVisApp}`,
        `strongNone=${m.strongNone}`,
        `pNone=${m.pNone}`,
        `strongOutVv=${m.strongOutVv}`,
        `pOutVv=${m.pOutVv}`,
        `strongOutApp=${m.strongOutApp}`,
        `pOutApp=${m.pOutApp}`,
        `icon=${m.iconVisVv}/${m.iconH} none=${m.iconNone}`,
        `overVv=${m.panelOverVv}`,
        `overApp=${m.panelOverApp}`,
        `cardH=${m.cardH}`,
        `inner=${m.innerW}x${m.innerH}`,
        `appH=${m.appH}`,
        `appTop=${m.appTop}`,
      ].join(' ');
      log(row);
      log(`  strong: ${m.strongText}`);
      log(`  p: ${m.pText}`);
      if (m.cardBox) log(`  cardBox ${JSON.stringify(m.cardBox)}`);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}
if (soft.length) {
  log('SOFT DETAIL (panelOverVv / vv-out vis-full — invent CLOSED; #app overApp REJECTED):');
  for (const s of soft) log('  ' + s);
}

const outPath = join(root, 'tools/probe-tick181-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
