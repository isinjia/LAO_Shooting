/**
 * A/B load measurement: progressive (default) vs ?eager=1
 * Reports wall time, Resource Timing transfer bytes, and JS heap (Chromium).
 * Sheets: prefers packed sheet.json + sheet_XX.webp|png (see pack_sprite_sheets.py).
 *
 * Usage: node tools/measure-load.mjs
 * Requires: node tools/static-server.mjs (PORT 5188)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';

async function measure(page, url, label) {
  const net = { bytes: 0, requests: 0, audio404: 0 };
  page.removeAllListeners('response');
  page.on('response', async (res) => {
    try {
      const u = res.url();
      if (!u.includes('/assets/')) return;
      net.requests += 1;
      if (u.includes('/assets/audio/') && res.status() === 404) net.audio404 += 1;
      const headers = res.headers();
      const cl = Number(headers['content-length'] || 0);
      if (cl > 0) net.bytes += cl;
    } catch { /* */ }
  });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  const titleMs = Date.now() - t0;

  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  const selectMs = Date.now() - t0;

  await page.click('.char-card[data-key="hirume"]');
  await page.click('#btn-go');
  await page.waitForFunction(
    () => document.getElementById('overlay')?.classList.contains('hidden'),
    null,
    { timeout: 600000 },
  );
  const sortieMs = Date.now() - t0;

  const snap = await page.evaluate(() => {
    const m = window.__LAO__?.snapshotAssets?.() || null;
    const heap = performance.memory?.usedJSHeapSize || 0;
    let transfer = 0;
    for (const e of performance.getEntriesByType('resource')) {
      if (!(e.name || '').includes('/assets/')) continue;
      transfer += e.transferSize || e.encodedBodySize || 0;
    }
    return { metrics: m, heap, transfer, mode: m?.mode || null };
  });

  return {
    label,
    titleMs,
    selectMs,
    sortieMs,
    mode: snap.mode,
    transferBytes: snap.transfer || net.bytes,
    heapBytes: snap.heap,
    assetRequests: net.requests,
    audio404: net.audio404,
    clips: snap.metrics?.clipsLoaded ?? snap.metrics?.clipsResident ?? null,
    frames: snap.metrics?.framesLoaded ?? null,
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const [path, label] of [
  [BASE, 'progressive'],
  [`${BASE}${BASE.includes('?') ? '&' : '?'}eager=1`, 'eager'],
]) {
  // Fresh context with cache disabled so transfer bytes aren't polluted by prior runs.
  const context = await browser.newContext({ bypassCSP: true });
  await context.route('**/*', (route) => route.continue());
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const headers = { ...route.request().headers(), 'Cache-Control': 'no-cache' };
    await route.continue({ headers });
  });
  // CDP: disable HTTP cache for accurate transfer.
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  try {
    results.push(await measure(page, path, label));
  } catch (err) {
    results.push({ label, error: String(err.message || err) });
  }
  await context.close();
}

const progressive = results.find((r) => r.label === 'progressive');
const eager = results.find((r) => r.label === 'eager');
const cmp = (progressive && eager && !progressive.error && !eager.error)
  ? {
      sortieMsDelta: eager.sortieMs - progressive.sortieMs,
      transferDelta: (eager.transferBytes || 0) - (progressive.transferBytes || 0),
      heapDelta: (eager.heapBytes || 0) - (progressive.heapBytes || 0),
    }
  : null;

const report = {
  method: {
    env: 'Playwright Chromium + tools/static-server.mjs',
    progressive: 'title manifests+BG → select base roster → sortie stage1+pilot; later acts prefetch',
    eager: 'same title/select, then ?eager=1 loads ALL players+enemies before field opens',
    transfer: 'Performance Resource Timing transferSize (fallback encodedBodySize) for /assets/*',
    memory: 'performance.memory.usedJSHeapSize at sortie-ready (Chromium)',
    sheets: 'sd_baked/*/sheet.json + sheet_XX.webp|png (trim/shelf pack; per-frame PNG fallback)',
  },
  results,
  comparison: cmp,
};
const outName = process.env.MEASURE_OUT || 'measure-load-latest.json';
const outPath = path.join(__dirname, outName);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
// Keep a dated-friendly after snapshot when MEASURE_OUT unset.
if (!process.env.MEASURE_OUT) {
  fs.writeFileSync(path.join(__dirname, 'measure-load-after.json'), JSON.stringify(report, null, 2));
  const beforePath = path.join(__dirname, 'measure-load-before.json');
  if (fs.existsSync(beforePath) && progressive && !progressive.error) {
    const before = JSON.parse(fs.readFileSync(beforePath, 'utf8').replace(/^\uFEFF/, ''));
    const bProg = (before.results || []).find((r) => r.label === 'progressive');
    if (bProg && !bProg.error) {
      const cmpBefore = {
        progressiveTransferBefore: bProg.transferBytes || 0,
        progressiveTransferAfter: progressive.transferBytes || 0,
        transferSaved: (bProg.transferBytes || 0) - (progressive.transferBytes || 0),
        transferSavedRatio: bProg.transferBytes
          ? +(((bProg.transferBytes - progressive.transferBytes) / bProg.transferBytes) * 100).toFixed(1)
          : null,
        sortieMsBefore: bProg.sortieMs,
        sortieMsAfter: progressive.sortieMs,
      };
      fs.writeFileSync(
        path.join(__dirname, 'measure-load-comparison.json'),
        JSON.stringify({ after: report, vsBefore: cmpBefore }, null, 2),
      );
    }
  }
}
console.log(JSON.stringify(report, null, 2));

await browser.close();
process.exit(results.every((r) => !r.error) ? 0 : 1);
