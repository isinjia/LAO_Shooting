// Measures each enemy's on-screen visible body (alpha bbox of its idle frame as drawn), in
// logical game px, next to its HP class (oneHit grunt / multi-hit). Used to size small fry
// and to keep "takes more than one hit" = visibly bigger.
// usage: node tools/measure-enemy-size.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const out = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); const A = window.__LAO__.getAssets();
  const res = [];
  const keys = Object.keys(A.ENEMY_META).filter((k) => !k.startsWith('mid_') && !k.startsWith('boss_') && !k.startsWith('final_') && k !== 'predator' && k !== 'doomeater');
  const c = document.createElement("canvas"); c.width = 400; c.height = 400;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  for (const key of keys) {
    try { await g.assets.bank.ensureEnemy(key); } catch { continue; }
    const clips = g._clipsFor(key);
    if (!clips) continue;
    const m = A.ENEMY_META[key];
    const e = g._spawnEnemy({ x: 200, y: 200, clips, hp: 10, score: 1, size: m.size, drawScale: m.drawScale, name: key });
    e.alive = true;
    // Sample the flying clip over time (move if baked, else idle): median visible size.
    if (e.anim.clips?.move?.length) e.anim.play?.('move');
    const ws = [], hs = [];
    for (let k = 0; k < 10; k++) {
      ctx.clearRect(0, 0, 400, 400);
      ctx.save(); e.draw(ctx); ctx.restore();
      const d = ctx.getImageData(0, 0, 400, 400).data;
      let x0 = 400, y0 = 400, x1 = -1, y1 = -1;
      for (let y = 0; y < 400; y += 2) for (let x = 0; x < 400; x += 2) if (d[(y * 400 + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      ws.push(x1 - x0 + 2); hs.push(y1 - y0 + 2);
      e.anim.update?.(0.07);
    }
    ws.sort((a, b) => a - b); hs.sort((a, b) => a - b);
    e.alive = false; g.enemies.splice(g.enemies.indexOf(e), 1);
    res.push({ key, oneHit: !!m.oneHit, named: !!m.named, size: m.size, drawScale: m.drawScale || 1, w: ws[5], h: hs[5] });
  }
  return res;
});
for (const r of out) console.log(`${r.key.padEnd(15)} ${r.named ? 'NAMED ' : r.oneHit ? 'oneHit' : 'multi '} size ${r.size} x${r.drawScale}  visible ${r.w}x${r.h}  (max ${Math.max(r.w, r.h)})`);
await browser.close();
