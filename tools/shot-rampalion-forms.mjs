// Close-up captures of every Rampalion fusion form (part placement check).
// usage: node tools/static-server.mjs (5188)  then  node tools/shot-rampalion-forms.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = 'http://localhost:5188/';
const OUT = process.argv[2] || 'work/rampalion-shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto(URL + '?cb=forms' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start');
await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion'));
await page.waitForTimeout(2500);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(1500);
const forms = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const g0 = window.__LAO__.getGame(); g0.player.godMode = true;
  for (let k = 0; k < 60 * 8; k++) g0.update(1 / 60); // stage banner gone
  const mod = await import('./js/rampalion.js');
  return mod.RAMPALION_FORMS.map((f) => f.id);
});
for (const id of ['base', ...forms]) {
  const box = await page.evaluate(async (id) => {
    const mod = await import('./js/rampalion.js');
    const g = window.__LAO__.getGame(); const p = g.player;
    p.godMode = true; p.invuln = 0;
    for (const e of g.enemies) e.alive = false;
    g.enemies.length = 0; if (g.enemyBullets) g.enemyBullets.length = 0; if (g.bullets) g.bullets.length = 0; p.shotLevel = id === 'base' ? 1 : 3;
    mod.rampBreak(p, { eject: false, silent: true });
    p._ramp.eject = null;
    if (id !== 'base') {
      p._ramp.lastFormId = null;
      const form = mod.RAMPALION_FORMS.find((f) => f.id === id);
      const i = mod.RAMPALION_FORMS.indexOf(form);
      p._ramp.form = null;
      // Force this form: rand picks index among forms != current/last.
      const pool = mod.RAMPALION_FORMS;
      mod.rampFuse(p, () => (i + 0.5) / pool.length);
    }
    p._ramp.fuseFlash = 0; p._ramp.breakFlash = 0;
    p.x = 400; p.y = 380;
    for (let k = 0; k < 20; k++) g.update(1 / 60);
    p.x = 400; p.y = 380; p._ramp.fuseFlash = 0;
    g.draw();
    const c = document.getElementById('game').getBoundingClientRect();
    const sx = c.width / 960, sy = c.height / 540;
    return { x: c.left + (400 - 110) * sx, y: c.top + (380 - 110) * sy, width: 220 * sx, height: 220 * sy, form: p._ramp.form?.name || '기본' };
  }, id);
  await page.screenshot({ path: path.join(OUT, `form-${id}.png`), clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  console.log(id, box.form);
}
await browser.close();
