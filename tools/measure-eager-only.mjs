import { chromium } from 'playwright';

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const url = `${BASE}${BASE.includes('?') ? '&' : '?'}eager=1`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const client = await context.newCDPSession(page);
await client.send('Network.enable');
await client.send('Network.setCacheDisabled', { cacheDisabled: true });

let transferFromNet = 0;
let assetRequests = 0;
page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('/assets/')) return;
  assetRequests += 1;
  const cl = Number(res.headers()['content-length'] || 0);
  if (cl > 0) transferFromNet += cl;
});

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
await page.waitForSelector('#btn-start', { timeout: 180000 });
const titleMs = Date.now() - t0;
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 300000 });
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
  let transfer = 0;
  for (const e of performance.getEntriesByType('resource')) {
    if (!(e.name || '').includes('/assets/')) continue;
    transfer += e.transferSize || e.encodedBodySize || 0;
  }
  return {
    mode: m?.mode,
    clips: m?.clipsLoaded ?? m?.clipsResident,
    frames: m?.framesLoaded,
    heap: performance.memory?.usedJSHeapSize || 0,
    transfer,
  };
});

console.log(JSON.stringify({
  label: 'eager',
  titleMs, selectMs, sortieMs,
  ...snap,
  transferFromNet,
  assetRequests,
}, null, 2));

await browser.close();
