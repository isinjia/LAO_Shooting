// Area-attack probe: spawns a leader at a given HP ratio (picks the phase) and screenshots
// each kind of area attack (laser / bolt / meteor / spike) while it is warning and live.
// usage: node tools/probe-leader-hazards.mjs <stage> <leaderKey> <hpRatio> <outPrefix> [form]
import { chromium } from 'playwright';
const [stage, key, ratio, outPrefix, form] = [Number(process.argv[2]), process.argv[3], Number(process.argv[4]), process.argv[5], Number(process.argv[6] || 0)];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=hz' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.evaluate(async ([stage, key, ratio, form]) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame();
  g._updateStageFlow = () => {}; g._resolveStageLeader = () => {};
  await g.assets.bank.ensureEnemy(key);
  for (const b of window.__LAO__.getAssets().ENEMY_META[key]?.phaseBodies || []) await g.assets.bank.ensureEnemy(b);
  g.enemies.length = 0; g.stageIndex = stage - 1;
  g._spawnStageLeader(key, key.startsWith('mid') ? 'midboss' : 'boss', 1e6, 0, form);
  g.boss.hp = g.boss.maxHp * ratio;
  window.__seen = new Set();
}, [stage, key, ratio, form]);
const shots = [];
for (let n = 0; n < 6; n++) {
  const got = await page.evaluate(() => {
    const g = window.__LAO__.getGame(); const e = g.boss; const p = g.player;
    for (let i = 0; i < 60 * 25; i++) {
      p.invuln = 9; p.x = 180; p.y = 270; g.update(1 / 60);
      for (const h of e.hazards || []) {
        const live = h.t >= h.warn + 0.04 && h.t < h.warn + h.life;
        const tag = `${h.kind}:${live ? 'live' : 'warn'}`;
        if (window.__seen.has(tag)) continue;
        if (!live && h.t < h.warn * 0.7) continue;
        window.__seen.add(tag);
        g.draw();
        return tag;
      }
    }
    return null;
  });
  if (!got) break;
  const f = `${outPrefix}_${got.replace(':', '_')}.png`;
  await page.screenshot({ path: f });
  shots.push(f.split(/[\/]/).pop());
}
console.log(JSON.stringify(shots), errs.slice(0, 2));
await browser.close();
