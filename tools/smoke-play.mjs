/**
 * Headless smoke: title → select → sortie → brief combat input.
 * Requires: npx playwright (downloads chromium on first run).
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`ERR: ${e.message}`));

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#btn-start', { timeout: 90000 });
const titleMs = Date.now() - t0;
const titleText = (await page.textContent('h1')) || '';

await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 180000 });
const selectReady = Date.now() - t0;

await page.click('#btn-go');
// Tutorial may appear on first run
try {
  const tut = await page.waitForSelector('#btn-tut-go', { timeout: 2500 });
  if (tut) await tut.click();
} catch {
  /* already seen */
}

await page.waitForFunction(() => !document.querySelector('.screen-loading'), { timeout: 180000 });
await page.waitForTimeout(1200);
const afterSortie = Date.now() - t0;

const state = await page.evaluate(() => ({
  stage: document.querySelector('#stage-num')?.textContent,
  lives: document.querySelector('#lives')?.textContent,
  bombs: document.querySelector('#bombs')?.textContent,
  power: document.querySelector('#power-lv')?.textContent,
  hudDimmed: document.getElementById('hud')?.classList.contains('is-dimmed'),
  overlayHidden: document.getElementById('overlay')?.classList.contains('hidden'),
}));

await page.keyboard.down('Space');
await page.waitForTimeout(500);
await page.keyboard.up('Space');
await page.keyboard.press('KeyC');
await page.waitForTimeout(80);
await page.keyboard.press('KeyX');
await page.waitForTimeout(900);

const afterCombat = await page.evaluate(() => ({
  score: document.querySelector('#score')?.textContent,
  sp: document.querySelector('#sp-pct')?.textContent,
  bombs: document.querySelector('#bombs')?.textContent,
  stage: document.querySelector('#stage-num')?.textContent,
}));

const assetLog = logs.find((l) => l.includes('[assets] load metrics'));

console.log(JSON.stringify({
  ok: state.overlayHidden && state.stage === '1' && !state.hudDimmed,
  titleMs,
  selectReady,
  afterSortie,
  titleText: titleText.trim(),
  state,
  afterCombat,
  assetLog: assetLog || null,
  errors: logs.filter((l) => l.startsWith('ERR:') || l.startsWith('error:')),
  logs: logs.slice(0, 40),
}, null, 2));

await browser.close();
if (!(state.overlayHidden && state.stage === '1')) process.exit(1);
