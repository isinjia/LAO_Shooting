// Spawned-damage budget per second (all friendly bullets, misses ignored): Rampalion Lv5
// base weapon vs. base + each full part build, against the other pilots at Lv5.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
async function sortie(pilot) {
  await page.goto('http://localhost:5188/?cb=d' + Date.now() + pilot);
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
  if (pilot !== 'griffin') { await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot); await page.waitForTimeout(3000); }
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
}
const measure = (build) => page.evaluate(async (build) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); const p = g.player; p.godMode = true;
  for (let k = 0; k < 60 * 6; k++) g.update(1 / 60);
  p.shotLevel = 5;
  if (p._ramp) {
    const m = await import('./js/rampalion.js');
    p._ramp.slots = [];
    if (build) build.forEach((oi, si) => { const slot = m.RAMPALION_SLOTS[si]; p._ramp.slots.push({ slot, opt: slot.options[oi], robot: slot.options[oi].robot, attached: true, cd: 0 }); });
  }
  let dmg = 0;
  // One real enemy pinned in front with near-infinite HP; sum what it actually takes.
  let tgt = null;
  for (let k = 0; k < 600 && !tgt; k++) { g.update(1 / 60); tgt = g.enemies.find((e) => e.alive && !e.dying); }
  for (const e of g.enemies) if (e !== tgt) e.alive = false;
  const origDamage = tgt.damage.bind(tgt);
  tgt.damage = (d) => { dmg += d; tgt.hp = 1e9; return false; };
  g._keyInput.shoot = true; g._syncMergedInput();
  for (let k = 0; k < 600; k++) {
    tgt.hp = 1e9; tgt.alive = true; tgt.x = 640; tgt.y = p.y; tgt.vx = 0; tgt.vy = 0; tgt.hitR = 55;
    for (const e of g.enemies) if (e !== tgt) e.alive = false;
    if (g.enemyBullets) g.enemyBullets.length = 0;
    g.update(1 / 60);
  }
  g._keyInput.shoot = false; g._syncMergedInput();
  return +(dmg / 10).toFixed(1);
}, build);
const out = {};
for (const pilot of ['griffin', 'sleipnir', 'express76', 'labiata', 'rampalion']) {
  await sortie(pilot);
  if (pilot === 'rampalion') {
    out['rampalion base'] = await measure(null);
    out['rampalion +A (wing,roc chest,boomer gun,cannon)'] = await measure([0, 0, 0, 0]);
    out['rampalion +B (booster,helmet,gatling,pods)'] = await measure([1, 1, 1, 1]);
    out['rampalion +C (cape,roc chest,gatling,cannon)'] = await measure([2, 0, 1, 0]);
  } else out[pilot] = await measure(null);
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
