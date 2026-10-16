/**
 * Tick171 B — NEW-size overlay peer CTAs + ja/zh rare overlay-host.
 * Tick167–170 grids skipped these sizes. dens FROZEN. No soft invent.
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
const ASIA = ['ja', 'zh-Hant'];
const PEER_SIZES = [
  { width: 390, height: 220 },
  { width: 412, height: 226 },
  { width: 428, height: 241 },
];
const RARE_SIZES = [
  { width: 320, height: 200 },
  { width: 340, height: 200 },
  { width: 390, height: 220 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

async function boot(browser, url, size, loc, tag) {
  const page = await browser.newPage({ viewport: size });
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
  await page.goto(`${url}?cb=t171b-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
}

function classifyPeer(m) {
  const unread =
    m.ctaOut ||
    (m.ctaH > 0 && m.ctaVis < Math.min(20, m.ctaH - 2)) ||
    m.secOut ||
    (m.secH > 0 && m.secVis < Math.min(16, m.secH - 2));
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

function classifyRare(m) {
  const unread = (vis, h, minVis, out) =>
    out || (h > 0 && vis < Math.min(minVis, h - 2));
  const hard =
    unread(m.hintVisOc, m.hintH, 10, m.hintOutOc) ||
    unread(m.nameVisOc, m.nameH, 14, m.nameOutOc) ||
    unread(m.tagVisOc, m.tagH, 12, m.tagOutOc);
  const soft = !hard && m.cardOverOc > 1.5;
  return hard ? 'HARD' : soft ? 'SOFT' : 'ok';
}

async function measurePeer(page, ctaSel, secSel, actionsSel) {
  return page.evaluate(({ ctaSel, secSel, actionsSel }) => {
    const app = document.getElementById('app');
    const oc = document.getElementById('overlay-content');
    void oc?.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const cta = oc.querySelector(ctaSel);
    const sec = secSel ? oc.querySelector(secSel) : null;
    const actions = actionsSel ? oc.querySelector(actionsSel) : null;
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
    const bh = (el) => (el ? +el.getBoundingClientRect().height.toFixed(1) : 0);
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: bh(cta),
      secOut: sec ? out(sec) : false,
      secVis: sec ? +vis(sec).toFixed(1) : 0,
      secH: bh(sec),
      actionsOut: actions ? out(actions) : false,
    };
  }, { ctaSel, secSel, actionsSel });
}

async function measureRareOnSelect(page, charKey) {
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 90000 });
  await page.waitForTimeout(60);
  return page.evaluate(async (key) => {
    const { playRareFanfare } = await import('/js/rare-fanfare.js');
    const oc = document.getElementById('overlay-content');
    const pending = playRareFanfare({ charKey: key, host: oc });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 520));
    const app = document.getElementById('app');
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const el = document.querySelector('.rare-fanfare');
    const card = el?.querySelector('.rare-fanfare-card');
    const name = el?.querySelector('.rare-fanfare-name');
    const tag = el?.querySelector('.rare-fanfare-tag');
    const hint = el?.querySelector('.rare-fanfare-hint');
    const vis = (node, clipR) => {
      if (!node) return 0;
      const r = node.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, clipR.bottom) - Math.max(r.top, clipR.top));
    };
    const out = (node, clipR) => {
      if (!node) return true;
      const r = node.getBoundingClientRect();
      return (
        r.bottom > clipR.bottom + 1.5 ||
        r.top < clipR.top - 1.5 ||
        r.right > clipR.right + 1.5 ||
        r.left < clipR.left - 1.5
      );
    };
    const bh = (node) => (node ? +node.getBoundingClientRect().height.toFixed(1) : 0);
    const cardR = card?.getBoundingClientRect();
    const m = {
      compact: !!el?.classList.contains('is-rare-compact'),
      ultra: !!el?.classList.contains('is-rare-ultra'),
      ocH: +ocR.height.toFixed(1),
      appH: +appR.height.toFixed(1),
      cardH: cardR ? +cardR.height.toFixed(1) : 0,
      cardOverOc: cardR
        ? +Math.max(0, cardR.bottom - ocR.bottom, ocR.top - cardR.top).toFixed(2)
        : 99,
      nameVisOc: +vis(name, ocR).toFixed(1),
      nameH: bh(name),
      nameOutOc: name ? out(name, ocR) : true,
      tagVisOc: +vis(tag, ocR).toFixed(1),
      tagH: bh(tag),
      tagOutOc: tag ? out(tag, ocR) : true,
      hintVisOc: +vis(hint, ocR).toFixed(1),
      hintH: bh(hint),
      hintOutOc: hint ? out(hint, ocR) : true,
    };
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await pending.catch(() => {});
    el?.remove();
    return m;
  }, charKey);
}

async function enterGameplay(page) {
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
  await page.waitForTimeout(180);
}

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
const hard = [];
const soft = [];
let ok = 0;

log('=== B1) ja/zh-Hant rare on select overlay-content ===');
for (const size of RARE_SIZES) {
  for (const loc of ASIA) {
    const page = await boot(browser, url, size, loc, 'rare-asia');
    try {
      const m = await measureRareOnSelect(page, 'eternity');
      const cls = classifyRare(m);
      const row = `RARE-ASIA ${loc}@${size.width}×${size.height} eternity → ${cls} hint=${m.hintVisOc}/${m.hintH} name=${m.nameVisOc}/${m.nameH} tag=${m.tagVisOc}/${m.tagH} overOc=${m.cardOverOc} compact=${m.compact} ultra=${m.ultra}`;
      log(row);
      if (cls === 'HARD') hard.push(row);
      else if (cls === 'SOFT') soft.push(row);
      else ok += 1;
    } finally {
      await page.close();
    }
  }
}

log('=== B2) overlay peer CTAs @ NEW short-landscape sizes ===');
for (const size of PEER_SIZES) {
  for (const loc of LONG) {
    {
      const page = await boot(browser, url, size, loc, 'opt');
      try {
        await page.click('#btn-options');
        await page.waitForSelector('#btn-opt-back', { timeout: 60000 });
        await page.waitForTimeout(80);
        const m = await measurePeer(page, '#btn-opt-back', null, '.opt-actions');
        const cls = classifyPeer(m);
        const row = `OPT ${loc}@${size.width}×${size.height} → ${cls} ctaVis=${m.ctaVis}/${m.ctaH} over=${m.panelOver}`;
        log(row);
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
        else ok += 1;
      } finally {
        await page.close();
      }
    }
    {
      const page = await boot(browser, url, size, loc, 'sel');
      try {
        await page.click('#btn-start');
        await page.waitForSelector('#btn-go', { timeout: 90000 });
        await page.waitForTimeout(80);
        const m = await measurePeer(page, '#btn-go', '#btn-back', '.select-actions');
        const cls = classifyPeer(m);
        const row = `SEL ${loc}@${size.width}×${size.height} → ${cls} ctaVis=${m.ctaVis}/${m.ctaH} secVis=${m.secVis}/${m.secH} over=${m.panelOver}`;
        log(row);
        if (cls === 'HARD') hard.push(row);
        else if (cls === 'SOFT') soft.push(row);
        else ok += 1;
      } finally {
        await page.close();
      }
    }
    {
      const page = await boot(browser, url, size, loc, 'pause');
      try {
        await enterGameplay(page);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(220);
        if (!(await page.$('#overlay-content.screen-pause'))) {
          log(`SKIP pause ${loc}@${size.width}×${size.height}`);
        } else {
          const m = await measurePeer(page, '#btn-resume', '#btn-quit', '.pause-actions');
          const cls = classifyPeer(m);
          const row = `PAUSE ${loc}@${size.width}×${size.height} → ${cls} ctaVis=${m.ctaVis}/${m.ctaH} secVis=${m.secVis}/${m.secH} over=${m.panelOver}`;
          log(row);
          if (cls === 'HARD') hard.push(row);
          else if (cls === 'SOFT') soft.push(row);
          else ok += 1;
        }
      } finally {
        await page.close();
      }
    }
  }
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}

const outPath = join(root, 'tools/probe-tick171-peers.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
