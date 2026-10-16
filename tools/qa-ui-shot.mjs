import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'tools/qa-title.png' });
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'tools/qa-select.png' });
await page.click('#btn-go');
await page.waitForTimeout(500);
const tut = await page.$('#btn-tut-go');
if (tut) {
  await tut.click();
  await page.waitForTimeout(400);
}
for (let i = 0; i < 80; i++) {
  const hidden = await page.evaluate(() =>
    document.getElementById('overlay')?.classList.contains('hidden'),
  );
  if (hidden) break;
  await page.waitForTimeout(250);
}
await page.waitForTimeout(600);
await page.screenshot({ path: 'tools/qa-hud.png' });
await page.keyboard.down('Space');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'tools/qa-charge.png' });
await page.keyboard.up('Space');
await page.waitForTimeout(300);
await page.keyboard.press('KeyX');
await page.waitForTimeout(450);
await page.screenshot({ path: 'tools/qa-bomb.png' });
await browser.close();
console.log('ok');
