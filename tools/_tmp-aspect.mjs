import { chromium } from 'playwright';
const SP = process.argv[2];
const browser = await chromium.launch();
for (const [tag, vp, mob, pilot] of [['tab', { width: 1024, height: 768 }, true, 'lrl'], ['phone', { width: 844, height: 390 }, true, 'labiata']]) {
  const ctx = await browser.newContext(mob ? { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
  await page.goto('http://localhost:5188/?cb=as' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(800);
  await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot);
  await page.waitForTimeout(2500);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${SP}/as2_${tag}.png` });
  const r = await page.evaluate(() => { const a = document.getElementById('app').getBoundingClientRect(); return { W: getComputedStyle(document.documentElement).getPropertyValue('--game-w'), H: getComputedStyle(document.documentElement).getPropertyValue('--game-h'), app: [Math.round(a.width), Math.round(a.height)], vp: [innerWidth, innerHeight] }; });
  console.log(tag, JSON.stringify(r), errs.slice(0, 2));
  await ctx.close();
}
await browser.close();
