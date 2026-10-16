import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=bs' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const res = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); const p = g.player;
  const per = []; let cur;
  const newStage = () => { cur = { itemDrop: 0, itemPicked: 0, clear: 0, deathRefill: 0, deaths: 0, used: 0 }; per.push(cur); };
  newStage();
  const push = g.powerUps.push.bind(g.powerUps);
  g.powerUps.push = (...a) => { for (const u of a) if (u.type === 'bomb') cur.itemDrop += 1; return push(...a); };
  let prevBombs = p.bombs, prevLives = p.lives, prevResp = 0;
  let stage = g.stageIndex;
  for (let i = 0; i < 60 * 60 * 30; i++) {
    if (p.lives < 2) p.lives = 3; // keep the run going; deaths still count
    const tgt = g.boss?.alive ? g.boss : g.enemies.find((e) => e.alive && !e.dying && e.x < 960);
    const ty = tgt ? tgt.y : 270;
    p.y += Math.max(-4, Math.min(4, ty - p.y));
    p.x += Math.max(-3, Math.min(3, 170 - p.x));
    g._keyInput.shoot = true;
    // A player who bombs freely: once every 20s while stocked.
    g._keyInput.bomb = p.bombs > 0 && i % 1200 === 600;
    if (i % 30 === 0 || g._keyInput.bomb) g._syncMergedInput();
    if (g.stagePhase === 'asset-gate') { await new Promise((r) => setTimeout(r, 50)); g.update(1 / 60); continue; }
    const phase = g.stagePhase; const resp = p.respawnTimer || 0;
    g.update(1 / 60);
    const d = p.bombs - prevBombs;
    if (d < 0) cur.used += -d;
    if (d > 0) {
      if (prevResp > 0 && !(p.respawnTimer > 0)) cur.deathRefill += d;
      else if (phase === 'boss' && g.stagePhase === 'tally') cur.clear += d;
      else cur.itemPicked += d;
    }
    if (p.lives < prevLives) cur.deaths += 1;
    prevBombs = p.bombs; prevLives = p.lives; prevResp = p.respawnTimer || 0;
    if (g.stageIndex > stage) { stage = g.stageIndex; newStage(); }
    if (g.state !== 'playing') break;
    if (i % 600 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return per.slice(0, 5);
});
for (const [i, s] of res.entries()) console.log('S' + (i + 1), JSON.stringify(s));
await browser.close();
