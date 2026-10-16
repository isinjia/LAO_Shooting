import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto('http://127.0.0.1:5188/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 180000 });
await page.click('.char-card[data-key="hirume"]');
await page.click('#btn-go');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(5000);
for (const key of ['lrl', 'merlin', 'fafnir', 'eternity', 'labiata', 'emily']) {
  await page.evaluate((name) => {
    const game = window.__LAO__.getGame();
    const player = game.player;
    game.bullets.clearAll();
    player.charKey = name;
    player.meta = game.assets.CHAR_META[name];
    player.sp = 300;
    player.alive = true;
    player.trySpecial(game.bullets);
  }, key);
  await page.waitForTimeout(85);
  await page.screenshot({ path: `work/special-${key}-in-game.png` });
}
console.log(JSON.stringify({ errors }));
await browser.close();
