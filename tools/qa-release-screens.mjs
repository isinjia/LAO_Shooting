// Release design review: screenshots of every main screen on a phone and a desktop viewport.
// usage: node tools/qa-release-screens.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [tag, vp, mob] of [['phone', { width: 844, height: 390 }, true], ['desk', { width: 1280, height: 720 }, false]]) {
  const ctx = await browser.newContext(mob ? { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
  await page.goto('http://localhost:5188/?cb=rs' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${tag}_1title.png` });
  const opt = await page.$('#btn-options, #btn-opt, [id*=option]');
  if (opt) { await opt.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${tag}_2options.png` }); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  await page.goto('http://localhost:5188/?cb=rs2' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${tag}_3select.png` });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${OUT}/${tag}_4play.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}_5pause.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = window.__LAO__.getGame(); g.player.lives = 1; g.player.invuln = 0; g.player.hit(); });
  await page.waitForSelector('#btn-retry', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${tag}_6result.png` });
  await ctx.close();
}
await browser.close();
