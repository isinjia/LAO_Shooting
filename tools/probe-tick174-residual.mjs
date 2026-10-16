/**
 * Tick174 — residual HARD scan after tick173 select-dossier +0.
 * NEW axis: pause resume/quit CTAs @ mid-short sizes tick171 did not
 * cover (360×218 / 375×212 / 404×228 / 430×245) × pt/es/ru.
 * HOLD uniqueness live dump (user complaint) — HARD only if charge kits
 * collapse to shared homing-OR-laser templates / duplicate primary style.
 * dens FROZEN. No canvas CSS false-positive coords. No hint display:none
 * / letterbox appTop naive OOB. No HOLD dens/side/emit ship unless HARD.
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
/** NEW mid-short cluster — not tick171 pause 390/412/428 set. */
const SIZES = [
  { width: 360, height: 218 },
  { width: 375, height: 212 },
  { width: 404, height: 228 },
  { width: 430, height: 245 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

function classifyPeer(m) {
  const hidden = (elH, displayNone) => displayNone || elH < 0.5;
  const unreadEl = (vis, h, minVis, out, displayNone) => {
    if (hidden(h, displayNone)) return false;
    return out || (h > 0 && vis < Math.min(minVis, Math.max(6, h - 2)));
  };
  const unread =
    unreadEl(m.ctaVis, m.ctaH, 20, m.ctaOut, m.ctaNone) ||
    unreadEl(m.secVis, m.secH, 16, m.secOut, m.secNone);
  const soft = !unread && (m.panelOver > 1.5 || m.actionsOut);
  return unread ? 'HARD' : soft ? 'SOFT' : 'ok';
}

function classifyHold(dump) {
  if (!dump || dump.err) return 'HARD';
  const kits = dump.kits || [];
  const charge = kits.filter((k) => k.mode === 'hold');
  const styles = charge.map((k) => k.primaryStyle).filter(Boolean);
  const unique = new Set(styles);
  const failed = charge.filter((k) => k.identityOk === false);
  const homingOnly = charge.filter(
    (k) => k.homing > 0 && !(k.blastRadius > 0 || k.returnOwner || k.chainCount > 0 || k.waveAmplitude > 0),
  );
  const laserOnly = charge.filter(
    (k) => k.beamLength > 0 && k.vx === 0 && !(k.clearRadius > 0 || k.pierce),
  );
  const collapsedDuality =
    charge.length >= 5 &&
    (homingOnly.length === charge.length || laserOnly.length === charge.length);
  const unread =
    failed.length > 0 || unique.size !== styles.length || collapsedDuality;
  return unread ? 'HARD' : 'ok';
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
  await page.goto(`${url}?cb=t174-${tag}-${loc}-${size.width}x${size.height}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('#btn-start', { timeout: 60000 });
  return page;
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
    const none = (el) => {
      if (!el) return true;
      const cs = getComputedStyle(el);
      return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
    };
    const vis = (el) => {
      if (!el || none(el)) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
    };
    // Grounded OOB: ignore zero-rect / display:none (tick173 letterbox reject).
    const out = (el) => {
      if (!el || none(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) return false;
      return (
        r.bottom > appR.bottom + 1.5 ||
        r.top < appR.top - 1.5 ||
        r.right > appR.right + 1.5 ||
        r.left < appR.left - 1.5
      );
    };
    const bh = (el) => (el && !none(el) ? +el.getBoundingClientRect().height.toFixed(1) : 0);
    return {
      panelOver: +Math.max(0, ocR.bottom - appR.bottom, appR.top - ocR.top).toFixed(2),
      maxH: oc.style.maxHeight || '',
      appTop: +appR.top.toFixed(2),
      ctaNone: cta ? none(cta) : true,
      ctaOut: cta ? out(cta) : true,
      ctaVis: +vis(cta).toFixed(1),
      ctaH: bh(cta),
      secNone: sec ? none(sec) : false,
      secOut: sec ? out(sec) : false,
      secVis: sec ? +vis(sec).toFixed(1) : 0,
      secH: bh(sec),
      actionsOut: actions ? out(actions) : false,
    };
  }, { ctaSel, secSel, actionsSel });
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

log('=== A) pause resume/quit @ NEW mid-short sizes ===');
for (const size of SIZES) {
  for (const loc of LONG) {
    const page = await boot(browser, url, size, loc, 'pause');
    try {
      await enterGameplay(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(220);
      if (!(await page.$('#overlay-content.screen-pause'))) {
        log(`SKIP pause ${loc}@${size.width}×${size.height} (no screen-pause)`);
      } else {
        const m = await measurePeer(page, '#btn-resume', '#btn-quit', '.pause-actions');
        const cls = classifyPeer(m);
        const row = [
          `PAUSE ${loc}@${size.width}×${size.height} → ${cls}`,
          `cta=${m.ctaVis}/${m.ctaH}`,
          `sec=${m.secVis}/${m.secH}`,
          `ctaOut=${m.ctaOut}`,
          `secOut=${m.secOut}`,
          `ctaNone=${m.ctaNone}`,
          `secNone=${m.secNone}`,
          `over=${m.panelOver}`,
          `appTop=${m.appTop}`,
          `maxH=${m.maxH}`,
        ].join(' ');
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

log('=== B) HOLD uniqueness live dump (960×540 logical; no CSS canvas invent) ===');
{
  const page = await boot(browser, url, { width: 960, height: 540 }, 'en', 'hold');
  try {
    await enterGameplay(page);
    await page.waitForFunction(
      () => {
        const g = window.__LAO__?.getGame?.();
        return g && g.player && g.stageClock > 2.4;
      },
      { timeout: 45000 },
    ).catch(() => {});
    const dump = await page.evaluate(() => {
      const g = window.__LAO__?.getGame?.();
      if (!g?.player) return { err: 'no-game' };
      try { g.audio?.setMuted?.(true); } catch { /* */ }
      g.debug.invuln = true;
      g.debug.autoPlay = false;
      g.setPaused?.(false);
      const identity = {
        hirume: (c) => c.homing > 0 && c.blastRadius > 0 && c.style === 'sunbird',
        constantia: (c) => c.beamLength > 0 && c.vx === 0 && c.vy > 0 && c.style === 'sightbeam',
        lrl: (c) => c.returnOwner && c.homing === 0 && c.style === 'dragonaxe',
        merlin: (c) => c.blastRadius > 0 && c.vx > 0 && c.vy === 0 && c.style === 'shell',
        fafnir: (c) => c.style === 'jupiterorb' && c.chainCount > 0 && c.clearRadius > 0,
        eternity: (c) => c.pierce && c.clearRadius > 0 && c.style === 'coffinwall' && c.beamLength === 0,
        labiata: (c) => c.waveAmplitude > 0 && c.style === 'plasmaslash' && c.beamLength === 0,
      };
      const keys = Object.keys(identity);
      const kits = [];
      for (const key of keys) {
        const p = g.player;
        p.charKey = key;
        p.meta = g.assets.CHAR_META[key] || p.meta;
        p.shotLevel = 5;
        p.alive = true;
        p.sp = 99;
        p.x = 150;
        p.y = 260;
        g.polishFx?.setKitPalette?.(p.meta.shot);
        g.bullets.clearAll();
        p.fireCharge(g.bullets);
        const live = (g.bullets.list || []).filter((b) => b.alive && b.friendly && b.charge);
        const c0 = live[0];
        const snap = c0
          ? {
              style: c0.style,
              homing: c0.homing || 0,
              beamLength: c0.beamLength || 0,
              vx: c0.vx,
              vy: c0.vy,
              chainCount: c0.chainCount || 0,
              chainRadius: c0.chainRadius || 0,
              blastRadius: c0.blastRadius || 0,
              clearRadius: c0.clearRadius || 0,
              waveAmplitude: c0.waveAmplitude || 0,
              pierce: !!c0.pierce,
              returnOwner: !!c0.returnOwner,
            }
          : null;
        kits.push({
          key,
          mode: 'hold',
          n: live.length,
          styles: [...new Set(live.map((b) => b.style))],
          primaryStyle: snap?.style || '',
          ...snap,
          identityOk: snap ? !!identity[key](snap) : false,
          chargeEnabled: p.meta?.chargeEnabled !== false,
        });
      }
      const emily = g.assets.CHAR_META.emily;
      kits.push({
        key: 'emily',
        mode: 'basic-rail',
        chargeEnabled: emily?.chargeEnabled !== false,
        shotStyle: emily?.shot?.style || '',
        identityNote: 'chargeEnabled=false; basic railbeam is kit laser',
      });
      return { kits };
    });
    const cls = classifyHold(dump);
    log(`HOLD dump → ${cls}`);
    if (dump.err) log(`  err=${dump.err}`);
    for (const k of dump.kits || []) {
      log(
        `  ${k.key} mode=${k.mode} n=${k.n ?? '-'} styles=${(k.styles || [k.shotStyle]).join(',')}` +
          ` homing=${k.homing ?? '-'} beam=${k.beamLength ?? '-'} vx=${k.vx ?? '-'} vy=${k.vy ?? '-'}` +
          ` ret=${k.returnOwner ?? '-'} blast=${k.blastRadius ?? '-'} chain=${k.chainCount ?? '-'}` +
          ` wave=${k.waveAmplitude ?? '-'} pierce=${k.pierce ?? '-'} clear=${k.clearRadius ?? '-'}` +
          ` ok=${k.identityOk ?? '-'} chargeOn=${k.chargeEnabled}`,
      );
    }
    const row = `HOLD uniqueness @960×540 → ${cls}`;
    if (cls === 'HARD') hard.push(row);
    else ok += 1;
  } finally {
    await page.close();
  }
}

log('=== SUMMARY ===');
log(`hard=${hard.length} soft=${soft.length} ok=${ok}`);
if (hard.length) {
  log('HARD DETAIL:');
  for (const h of hard) log('  ' + h);
}

const outPath = join(root, 'tools/probe-tick174-residual.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
log(`wrote ${outPath}`);

await browser.close();
server.close();
process.exit(hard.length ? 2 : 0);
