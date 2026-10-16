import { chromium } from 'playwright';
const PILOTS = ['griffin', 'sleipnir', 'express76', 'constantia', 'labiata', 'lrl', 'peregrinus'];
const browser = await chromium.launch();
const rows = [];
for (const pilot of PILOTS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
  await page.goto('http://localhost:5188/?cb=sp' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
  if (pilot === 'sleipnir' || pilot === 'express76') {
    for (let i = 0; i < 6; i++) { if (await page.evaluate(() => document.querySelector('.char-card.selected')?.dataset.key) === pilot) break; await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100); }
  } else if (pilot !== 'griffin') { await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot); await page.waitForTimeout(2500); }
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  const r = await page.evaluate(async () => {
    window.requestAnimationFrame = () => 0;
    const g = window.__LAO__.getGame(); const p = g.player;
    p.godMode = true;
    // Wait for the battle to open.
    for (let i = 0; i < 4000 && g.stagePhase !== 'waves'; i++) { if (g.stagePhase === 'asset-gate') await new Promise((r) => setTimeout(r, 50)); g.update(1 / 60); }
    p.sp = 0;
    const at = {}; let sim = 0;
    for (let lv = 1; lv <= 3; lv++) at[lv] = null;
    for (let i = 0; i < 60 * 60 * 4; i++) {
      const tgt = g.boss?.alive ? g.boss : g.enemies.find((e) => e.alive && !e.dying && e.x < 960);
      const ty = tgt ? tgt.y : 270;
      p.y += Math.max(-4, Math.min(4, ty - p.y));
      p.x += Math.max(-3, Math.min(3, 170 - p.x));
      g._keyInput.shoot = true;
      if (i % 30 === 0) g._syncMergedInput();
      if (g.stagePhase === 'asset-gate') { await new Promise((r) => setTimeout(r, 50)); g.update(1 / 60); continue; }
      g.update(1 / 60); sim += 1 / 60;
      for (let lv = 1; lv <= 3; lv++) if (at[lv] == null && p.sp >= lv * p.spCost - 0.01) at[lv] = +sim.toFixed(1);
      if (at[3] != null) break;
      if (i % 600 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { at, power: p.shotLevel };
  });
  rows.push({ pilot, ...r });
  console.log(pilot, JSON.stringify(r));
  await page.close();
}
await browser.close();
