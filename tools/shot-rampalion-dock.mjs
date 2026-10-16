// Docking sequence strip: a robot flies in and grafts its part (one strip per body location).
// usage: node tools/static-server.mjs (5188)  then  node tools/shot-rampalion-dock.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2] || 'work/rampalion-parts';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=dock' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion')); await page.waitForTimeout(3000);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const strips = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const m = await import('./js/rampalion.js');
  const g = window.__LAO__.getGame(); const p = g.player; p.godMode = true;
  const r = p._ramp;
  const out = [];
  const TIMES = [0.05, 0.3, 0.55, 0.75, 0.9, 1.05, 1.3];
  for (let level = 0; level < m.RAMPALION_SLOTS.length; level++) {
    const frames = [];
    // Dock the next location: pick a fixed option per level for a readable sheet.
    m.rampFuse(p, () => 0.01);
    const d = r.docks[r.docks.length - 1];
    for (const t of TIMES) {
      if (d) d.t = t;
      if (t >= 1.1 && d) { d.entry.attached = true; r.docks = r.docks.filter((x) => x !== d); r.lastGraft = d.entry; r.fuseFlash = 0.9 - (t - 1.1); }
      p.anim.play('idle', { restart: false }); p.anim.time = t;
      const c = document.createElement('canvas'); c.width = 520; c.height = 360;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3a4150'; ctx.fillRect(0, 0, 520, 360);
      const ox = p.x, oy = p.y; p.x = 95; p.y = 175; p.invuln = 0; p.focus = false;
      ctx.save(); ctx.scale(1.4, 1.4); p.draw(ctx); ctx.restore();
      p.x = ox; p.y = oy;
      frames.push(c.toDataURL('image/png'));
    }
    for (const e of r.slots) e.attached = true;
    r.docks = []; r.fuseFlash = 0;
    out.push(frames);
  }
  return out;
});
strips.forEach((frames, li) => frames.forEach((url, fi) => fs.writeFileSync(path.join(OUT, `dock-${li}-${fi}.png`), Buffer.from(url.split(',')[1], 'base64'))));
console.log('dock strips', strips.length);
await browser.close();
