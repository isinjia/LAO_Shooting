/** Longer Stage-1 wave combat: confirm score rises and no page errors. */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
await page.waitForSelector('#btn-start', { timeout: 90000 });
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 180000 });
await page.click('.char-card[data-key="hirume"]');
await page.click('#btn-go');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), {
  timeout: 180000,
});

// Hold fire and weave for ~25s of stage clock
await page.keyboard.down('Space');
for (let i = 0; i < 50; i++) {
  if (i % 2 === 0) {
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowUp');
  } else {
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowDown');
  }
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(120);
  await page.keyboard.up('ArrowRight');
}
await page.keyboard.up('Space');
await page.keyboard.press('KeyX');
await page.waitForTimeout(400);

const snap = await page.evaluate(() => ({
  stage: document.querySelector('#stage-num')?.textContent,
  score: Number(document.querySelector('#score')?.textContent || 0),
  lives: document.querySelector('#lives')?.textContent,
  bombs: document.querySelector('#bombs')?.textContent,
  power: document.querySelector('#power-lv')?.textContent,
  graze: document.querySelector('#graze')?.textContent,
  cue: document.body.innerText.includes('기습') || document.body.innerText.includes('패킷'),
}));

console.log(JSON.stringify({
  ok: snap.stage === '1' && snap.score > 0 && errors.length === 0,
  snap,
  errors,
}, null, 2));
await browser.close();
process.exit(snap.stage === '1' && snap.score > 0 && errors.length === 0 ? 0 : 1);
