import { chromium } from 'playwright';
const [out, robot] = [process.argv[2], process.argv[3]];
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=am' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion')); await page.waitForTimeout(4000);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(async (robot) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); const p = g.player;
  g._updateStageFlow = () => {}; g.stagePhase = 'waves'; g.stageIntro = 0; p.godMode = true;
  const rnd = Math.random;
  for (const v of [0, robot === 'hestia' ? 0.99 : 0]) {
    Math.random = () => v; g._rampalionFuse(); Math.random = rnd;
    for (let i = 0; i < 400 && p._ramp.docks.length; i++) { p.x = 260; p.y = 330; g.update(1 / 60); }
  }
  for (let i = 0; i < 60; i++) { p.x = 260; p.y = 330; g.update(1 / 60); }
  g.draw();
  return { slots: p._ramp.slots.map((e) => e.robot), ...(() => { const c = document.getElementById('game').getBoundingClientRect(); const k = c.width / 960; return { sx: c.left + p.x * k, sy: c.top + p.y * k }; })() };
}, robot);
console.log(JSON.stringify(info));
await page.screenshot({ path: out + '_idle.png', clip: { x: info.sx - 100, y: info.sy - 110, width: 220, height: 190 } });
await page.evaluate(() => { const g = window.__LAO__.getGame(); const p = g.player; p.sp = 999; for (let i = 0; i < 300 && g.enemies.filter((e) => e.alive).length < 4; i++) { p.x = 260; p.y = 330; g.update(1 / 60); } p.trySpecial(g.bullets); });
for (const [n, sec] of [['a', 0.35], ['b', 0.35], ['c', 0.5]]) {
  await page.evaluate((sec) => { const g = window.__LAO__.getGame(); for (let i = 0; i < sec * 60; i++) { g.player.x = 260; g.player.y = 330; g.update(1 / 60); g.draw(); } }, sec);
  await page.screenshot({ path: `${out}_sp_${n}.png` });
}
console.log('errs', errs.slice(0, 3));
await browser.close();
