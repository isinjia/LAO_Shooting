// Hazard sequence probe: spawns a leader, waits for a hazard of <kind>, screenshots it at
// warn fractions (<= 1) or seconds past impact (1 + s). MARKS env = comma list.
// usage: node tools/probe-hazard-seq.mjs <outPrefix> <stage> <leaderKey> <hpRatio> <kind>
import { chromium } from 'playwright';
const [out, stage, key, ratio, kind] = [process.argv[2], Number(process.argv[3] || 1), process.argv[4] || 'mid_triton', Number(process.argv[5] || 0.5), process.argv[6] || 'meteor'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=mt' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(3000);
await page.evaluate(async ([stage, key, ratio, kind]) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame();
  g._updateStageFlow = () => {}; g._resolveStageLeader = () => {};
  await g.assets.bank.ensureEnemy(key);
  g.enemies.length = 0; g.stageIndex = stage - 1;
  g._spawnStageLeader(key, key.startsWith('mid') ? 'midboss' : 'boss', 1e6, 0, 0);
  g.boss.hp = g.boss.maxHp * ratio;
  const p = g.player;
  for (let i = 0; i < 60 * 30; i++) {
    p.invuln = 9; p.x = 260; p.y = 330; g.update(1 / 60);
    const m = (g.boss.hazards || []).find((h) => h.kind === kind && h.t < 0.05);
    if (m) { window.__m = m; break; }
  }
}, [stage, key, ratio, kind]);
const marks = (process.env.MARKS || '0.45,0.8,0.98,1.06,1.18,1.35,1.6').split(',').map(Number);
for (const at of marks) {
  await page.evaluate((at) => {
    const g = window.__LAO__.getGame(); const m = window.__m; const p = g.player;
    const target = at <= 1 ? m.warn * at : m.warn + (at - 1);
    let n = 0;
    while (m.t < target && n++ < 600) { p.invuln = 9; p.x = 260; p.y = 330; g.update(1 / 60); }
    if (m.t < target) { const left = Math.round((target - m.t) * 60); for (let i = 0; i < left; i++) { p.invuln = 9; g.update(1 / 60); } }
    g.draw();
  }, at);
  await page.screenshot({ path: `${out}_${String(at).replace('.', '')}.png` });
}
console.log('errs', errs.slice(0, 3));
await browser.close();
