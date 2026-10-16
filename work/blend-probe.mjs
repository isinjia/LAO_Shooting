import { chromium } from 'playwright';
import fs from 'fs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=bl' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion')); await page.waitForTimeout(3000);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const urls = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const m = await import('./js/rampalion.js');
  const g = window.__LAO__.getGame(); const p = g.player; const r = p._ramp;
  const slot = m.RAMPALION_SLOTS[1];
  r.slots = [{ slot, opt: slot.options[2], robot: slot.options[2].robot, attached: true, cd: 0 }];
  const out = [];
  for (const fb of [0, 0.25, 0.5, 0.75, 1]) {
    p.anim.locked = false; p.anim.play(fb > 0 ? 'move' : 'idle', { restart: true }); p.anim.time = 0.3; r.flyBlend = fb;
    const c = document.createElement('canvas'); c.width = 300; c.height = 300; const ctx = c.getContext('2d');
    ctx.fillStyle = '#3a4150'; ctx.fillRect(0, 0, 300, 300);
    const ox = p.x, oy = p.y; p.x = 60; p.y = 60; p.invuln = 0; p.focus = false;
    ctx.save(); ctx.scale(2.5, 2.5); p.draw(ctx); ctx.restore(); p.x = ox; p.y = oy;
    out.push(c.toDataURL('image/png'));
  }
  return out;
});
urls.forEach((u, i) => fs.writeFileSync(`work/rampalion-parts/blend-${i}.png`, Buffer.from(u.split(',')[1], 'base64')));
await browser.close();
