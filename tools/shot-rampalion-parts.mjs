// Rampalion part-graft review: for each fusion part (and full Lv5 builds) capture the body
// across idle / move / skill2 frames so fit and motion can be judged side by side.
// usage: node tools/static-server.mjs (5188)  then  node tools/shot-rampalion-parts.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = 'http://localhost:5188/';
const OUT = process.argv[2] || 'work/rampalion-parts';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto(URL + '?cb=parts' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start');
await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion'));
await page.waitForTimeout(3000);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(1500);
const combos = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); g.player.godMode = true;
  for (let k = 0; k < 60 * 8; k++) g.update(1 / 60); // stage banner gone
  const m = await import('./js/rampalion.js');
  const out = [];
  // One part at a time (its own slot only), then full builds.
  m.RAMPALION_SLOTS.forEach((slot, si) => slot.options.forEach((o, oi) => out.push({ name: `${slot.id}-${o.robot}`, pick: { [si]: oi } })));
  out.push({ name: 'full-A', pick: { 0: 0, 1: 0, 2: 0, 3: 0 } });
  out.push({ name: 'full-D', pick: { 0: 2, 1: 0, 2: 2, 3: 1 } });
  out.push({ name: 'full-B', pick: { 0: 2, 1: 0, 2: 0, 3: 1 } });
  out.push({ name: 'full-C', pick: { 0: 1, 1: 0, 2: 1, 3: 0 } });
  return out;
});
const FRAMES = [['idle', 0], ['idle', 0.5], ['idle', 1.0], ['idle', 1.5], ['move', 0], ['move', 0.3], ['move', 0.6]];
for (const combo of combos) {
  let i = 0;
  for (const [state, time] of FRAMES) {
    const data = await page.evaluate(async ({ combo, state, time }) => {
      const m = await import('./js/rampalion.js');
      const g = window.__LAO__.getGame(); const p = g.player;
      const r = p._ramp;
      r.slots = []; r.docks = []; r.ejects = []; r.fuseFlash = 0; r.breakFlash = 0;
      const picks = Object.entries(combo.pick).map(([si, oi]) => [+si, +oi]).sort((a, b) => a[0] - b[0]);
      for (const [si, oi] of picks) {
        const slot = m.RAMPALION_SLOTS[si];
        r.slots.push({ slot, opt: slot.options[oi], robot: slot.options[oi].robot, attached: true, cd: 0 });
      }
      p.shotLevel = 1 + r.slots.length;
      p.invuln = 0; p.facing = 1; p.bombDx = 0; p.bombDy = 0; p.focus = false;
      p.anim.locked = false;
      p.anim.play(state, { restart: true, lock: state === 'skill2' || state === 'attack' });
      p.anim.time = time;
      r.flyBlend = state === 'move' ? 1 : 0;
      // Clean stage: only the ship, 2.5x, on a neutral backdrop.
      const c = document.createElement('canvas'); c.width = 400; c.height = 400;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a4150'; ctx.fillRect(0, 0, 400, 400);
      const ox = p.x, oy = p.y; p.x = 80; p.y = 80;
      ctx.scale(2.5, 2.5);
      p.draw(ctx);
      p.x = ox; p.y = oy;
      return c.toDataURL('image/png');
    }, { combo, state, time });
    fs.writeFileSync(path.join(OUT, `${combo.name}_${i}.png`), Buffer.from(data.split(',')[1], 'base64'));
    i += 1;
  }
  console.log('captured', combo.name);
}
fs.writeFileSync(path.join(OUT, 'combos.json'), JSON.stringify({ combos: combos.map((c) => c.name), frames: FRAMES, errs }, null, 1));
console.log('errors', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
