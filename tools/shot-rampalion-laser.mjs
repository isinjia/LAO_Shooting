// Rampalion Roc wing lasers: attach the back part, fire its weapon, capture the game canvas.
// usage: node tools/static-server.mjs (5188)  then  node tools/shot-rampalion-laser.mjs [outDir]
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
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: true }));
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
// Real-time run (the GPU projectile layer draws on its own frame loop).
await page.evaluate(async () => {
  const g = window.__LAO__.getGame(); const p = g.player; p.godMode = true;
  const m = await import('./js/rampalion.js');
  const slot = m.RAMPALION_SLOTS.find((x) => x.id === 'back');
  const r = p._ramp;
  r.slots = [{ slot, opt: slot.options.find((o) => o.robot === 'roc'), robot: 'roc', attached: true, cd: 0 }];
  r.docks = []; r.ejects = []; r.fuseFlash = 0;
  p.shotLevel = 2;
  window.__beams = 0; window.__heat = 0;
  const spawn = g.bullets.spawn;
  g.bullets.spawn = (o) => { if (o.style === 'heatmissile') window.__heat += 1; return spawn(o); };
  setInterval(() => { if (p._subBeam && p._subBeam.t < 0.02) window.__beams += 1; }, 10);
});
await page.waitForTimeout(5000);
await page.waitForFunction(() => { const p = window.__LAO__.getGame().player; return p._subBeam && p._subBeam.t > 0.08; }, null, { timeout: 20000 });
await page.screenshot({ path: path.join(OUT, 'laser-idle.png') });
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(200);
await page.waitForFunction(() => { const p = window.__LAO__.getGame().player; return p._subBeam && p._subBeam.t > 0.08; }, null, { timeout: 20000 });
await page.screenshot({ path: path.join(OUT, 'laser-move.png') });
await page.keyboard.up('ArrowUp');
console.log('beams', await page.evaluate(() => window.__beams), 'heat missiles', await page.evaluate(() => window.__heat), 'pts', await page.evaluate(() => JSON.stringify(window.__LAO__.getGame().player.subBeamPoints?.())));
console.log('errors', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
