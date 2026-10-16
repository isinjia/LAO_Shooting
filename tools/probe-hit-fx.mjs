// Per-pilot hit-effect probe: real shots against a pinned, unkillable enemy; screenshots the
// impact area over a few frames for each pilot (basic shot at Lv1 and Lv5).
// usage: node tools/probe-hit-fx.mjs <outPrefix> [pilots]
import { chromium } from 'playwright';
const out = process.argv[2];
const PILOTS = (process.argv[3] || 'griffin,sleipnir,express76,constantia,labiata,lrl,peregrinus').split(',');
const browser = await chromium.launch();
for (const pilot of PILOTS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true, autoFire: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
  if (process.env.HUMAN) await page.addInitScript(() => { window.__HUMAN__ = 1; });
  if (process.env.BULLETS) await page.addInitScript(() => { window.__BULLETS__ = 1; });
  await page.goto('http://localhost:5188/?cb=hf' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
  if (pilot === 'sleipnir' || pilot === 'express76') {
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => document.querySelector('.char-card.selected')?.dataset.key) === pilot) break;
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
    }
  } else if (pilot !== 'griffin') { await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot); await page.waitForTimeout(2500); }
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  for (const lv of [1, 5]) {
    await page.evaluate(async (lv) => {
      window.requestAnimationFrame = () => 0;
      const g = window.__LAO__.getGame(); const p = g.player;
      p.shotLevel = lv; p.godMode = true;
      if (window.__HUMAN__ && p._enterHumanForm) { p._enterHumanForm(3); p.humanFor = 99; }
      // Wait for a wave enemy, keep one pinned in front of the ship.
      let e = null;
      for (let i = 0; i < 60 * 20 && !e; i++) { g.update(1 / 60); e = g.enemies.find((q) => q.alive && q.kind !== 'boss' && q.kind !== 'midboss'); }
      g._updateStageFlow = () => {}; g._paceKeeper = () => {};
      window.__pin = e;
      for (const q of g.enemies) if (q !== e) q.alive = false;
      e.hp = e.maxHp = 1e9; e.fireTimer = 1e9;
      g.bullets.clearEnemy?.();
      window.__step = (n) => { for (let i = 0; i < n; i++) { e.x = 760; e.y = 330; e.vx = 0; e.vy = 0; e.fireTimer = 1e9; p.x = 300; p.y = 330; p.invuln = 9; g.update(1 / 60); g.bullets.clearEnemy?.(); }
        if (window.__BULLETS__) for (let i = 0; i < 7; i++) g.bullets.spawn({ x: 560 + i * 40, y: 330 + (i % 3 - 1) * 14, vx: -60, vy: 0, r: 6, friendly: false, color: ['#ff5a6e', '#b88cff', '#ffd24a'][i % 3], tint: ['#ff5a6e', '#b88cff', '#ffd24a'][i % 3] });
        g.draw(); };
      window.__step(50);
    }, lv);
    const NF = Number(process.env.FRAMES || 3), GAP = Number(process.env.GAP || 3);
    for (let f = 0; f < NF; f++) {
      await page.evaluate(([f, GAP]) => window.__step(f === 0 ? 1 : GAP), [f, GAP]);
      await page.screenshot({ path: `${out}_${pilot}_lv${lv}_${f}.png`, clip: { x: 760 * 1280 / 960 - 260, y: 330 * 720 / 540 - 150, width: 400, height: 300 } });
    }
  }
  console.log(pilot, errs.slice(0, 2));
  await page.close();
}
await browser.close();
