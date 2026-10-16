import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const out = 'E:/Test_Ban/2_LAO_MINI_ACTION/tools/_lao_ui_ref';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForSelector('#overlay-content.screen-title', { timeout: 120000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, 'verify-title.png') });
console.log('title ok');

await page.click('#btn-options');
await page.waitForSelector('#overlay-content.screen-options', { timeout: 10000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, 'verify-options.png') });
console.log('options ok');

await page.click('#btn-opt-back');
await page.waitForSelector('#overlay-content.screen-title', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForSelector('#overlay-content.screen-select, #overlay-content.screen-tutorial', {
  timeout: 30000,
});
let cls = await page.getAttribute('#overlay-content', 'class');
console.log('after start class', cls);
if (cls?.includes('tutorial')) {
  await page.screenshot({ path: path.join(out, 'verify-tutorial.png') });
  const go = page.locator('#btn-tut-go, button.btn-primary').first();
  await go.click();
  await page.waitForSelector('#overlay-content.screen-select', { timeout: 30000 });
}
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, 'verify-select.png') });
console.log('select ok');

const goBtn = page.locator('#btn-go');
if (await goBtn.count()) {
  await goBtn.click();
  await page.waitForTimeout(2500);
  cls = await page.getAttribute('#overlay-content', 'class');
  const hidden = await page.evaluate(() =>
    document.getElementById('overlay')?.classList.contains('hidden'),
  );
  console.log('after go', { cls, hidden });
  if (!hidden && cls?.includes('tutorial')) {
    await page.locator('#btn-tut-go, button.btn-primary').first().click();
    await page.waitForTimeout(2000);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  if (await page.locator('#overlay-content.screen-pause').count()) {
    await page.screenshot({ path: path.join(out, 'verify-pause.png') });
    console.log('pause ok');
    await page.click('#btn-resume');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, 'verify-hud.png') });
    console.log('hud ok');
  } else {
    await page.screenshot({ path: path.join(out, 'verify-play.png') });
    console.log('play shot');
  }
}

await browser.close();
console.log('DONE');
