import { chromium } from 'playwright';
import fs from 'fs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=b' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion')); await page.waitForTimeout(3000);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const shots = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const m = await import('./js/rampalion.js');
  const g = window.__LAO__.getGame(); const p = g.player; p.godMode = true;
  const out = [];
  for (const [st, t] of [['idle', 0], ['move', 0.3], ['move', 0.9]]) {
    p._ramp.slots = []; p.anim.locked = false; p.anim.play(st, { restart: true, lock: st === 'skill2' }); p.anim.time = t;
    const c = document.createElement('canvas'); c.width = 600; c.height = 600; const ctx = c.getContext('2d');
    ctx.fillStyle = '#3a4150'; ctx.fillRect(0, 0, 600, 600);
    const ox = p.x, oy = p.y; p.x = 75; p.y = 75; p.invuln = 0; p.focus = false;
    ctx.save(); ctx.scale(4, 4); p.draw(ctx);
    const cols = { body: '#ff0', chest: '#f0f', handB: '#080', wingB: '#f00', legF: '#0ff', legB: '#00f', shoulderF: '#f80' };
    const pts = {};
    for (const [b, col] of Object.entries(cols)) {
      const q = m.bonePoint(p, b); if (!q) continue; pts[b] = [Math.round(q.x - 75), Math.round(q.y - 75), +q.rot.toFixed(2)];
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, 1.6, 0, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 8 * Math.cos(q.rot), q.y + 8 * Math.sin(q.rot)); ctx.stroke();
    }
    ctx.restore();
    ctx.font = '13px sans-serif'; let yy = 16;
    for (const [b, col] of Object.entries(cols)) { ctx.fillStyle = col; ctx.fillText(b + ' ' + JSON.stringify(pts[b]), 6, yy); yy += 15; }
    p.x = ox; p.y = oy;
    out.push([st, c.toDataURL('image/png'), pts]);
  }
  return out;
});
for (const [st, url, pts] of shots) { fs.writeFileSync(`work/rampalion-parts/bones-${st}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(st, JSON.stringify(pts)); }
await browser.close();
