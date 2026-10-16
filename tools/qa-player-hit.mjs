/**
 * Tick21/53: player-hit spark readability — tip-forward cool-white/rose shatter.
 * n / loadMul budget frozen — no dens churn.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fxSrc = readFileSync(path.join(__dirname, '../js/polish-fx.js'), 'utf8');

// --- Source: tip-forward stretch + cool tip (n formula frozen) ---
assert.match(
  fxSrc,
  /const n = Math\.max\(8, Math\.round\(18 \* scale \* loadMul\)\)/,
  'player-hit n budget frozen',
);
assert.match(
  fxSrc,
  /fine \? 2\.65 \+ Math\.random\(\) \* 2\.6 : 1\.85 \+ Math\.random\(\) \* 2\.0/,
  'player-hit tip-forward stretch',
);
assert.match(fxSrc, /rampHot: '#fffef8'/, 'player-hit tip rampHot');
assert.match(fxSrc, /rampCool: '#ff6b8a'/, 'player-hit rose rampCool');
assert.match(fxSrc, /i % 4 === 0 \? '#fffef8'/, 'player-hit cool-white tip chips');

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const OUT = path.join(__dirname, 'qa-player-hit.png');

async function main() {
  if (process.env.QA_SOURCE_ONLY === '1') {
    console.log(JSON.stringify({ ok: true, sourceOnly: true }, null, 2));
    return;
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.click('.char-card[data-key="hirume"]');
  await page.click('#btn-go');
  try {
    const tut = await page.waitForSelector('#btn-tut-go', { timeout: 1500 });
    if (tut) await tut.click();
  } catch { /* */ }
  await page.waitForFunction(
    () => document.getElementById('overlay')?.classList.contains('hidden'),
    null,
    { timeout: 300000 },
  );
  await page.waitForFunction(() => {
    const g = window.__LAO__?.getGame?.();
    return g && g.stageClock > 2;
  }, null, { timeout: 45000 }).catch(() => {});

  const dump = await page.evaluate(() => {
    const g = window.__LAO__?.getGame?.();
    if (!g?.fx || !g?.player) return { ok: false };
    try { g.audio?.setMuted?.(true); } catch { /* */ }
    g.debug.autoPlay = false;
    g.setPaused?.(false);
    g.fx.clear();
    const p = g.player;
    // Fire the dedicated player-hit path (not kit noteKill explosion).
    g.fx.notePlayerHit(p.x, p.y);
    for (let f = 0; f < 2; f++) g.fx.tick(1 / 60);
    const kinds = { spark: 0, flash: 0, smoke: 0 };
    let rose = 0;
    let white = 0;
    let maxStretch = 0;
    for (const part of g.fx.active) {
      kinds[part.kind] = (kinds[part.kind] || 0) + 1;
      const c = String(part.color || '');
      if (c.includes('ff6b8a') || c.includes('ff7a96') || c.includes('ffe8ee') || c.includes('b86880') || c.includes('c87890')) {
        rose += 1;
      }
      if (c === '#ffffff' || c === '#fff8f2' || c === '#fffef8') white += 1;
      if ((part.stretch || 1) > maxStretch) maxStretch = part.stretch || 1;
    }
    return {
      ok: true,
      active: g.fx.active.length,
      kinds,
      rose,
      white,
      maxStretch,
      hitstop: g.fx.hitstop,
      flash: g.fx.flash,
    };
  });

  await page.screenshot({ path: OUT, type: 'png' });
  await browser.close();
  console.log(JSON.stringify({ dump, out: OUT }, null, 2));
  if (!dump?.ok || dump.active < 8 || dump.rose < 2 || dump.maxStretch < 2) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
