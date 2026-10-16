// Leader skill-animation probe: spawns a leader, runs its routine and screenshots the frame
// each signature attack fires (its skill clip at the original release time).
// usage: node tools/probe-leader-skill.mjs <stage> <leaderKey> <outPrefix> [form]
import { chromium } from 'playwright';
const [stage, key, outPrefix, form] = [Number(process.argv[2]), process.argv[3], process.argv[4], Number(process.argv[5] || 0)];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=sk' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.evaluate(async ([stage, key, form]) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame();
  g._updateStageFlow = () => {}; g._resolveStageLeader = () => {};
  await g.assets.bank.ensureEnemy(key);
  for (const b of window.__LAO__.getAssets().ENEMY_META[key]?.phaseBodies || []) await g.assets.bank.ensureEnemy(b);
  g.enemies.length = 0; g.stageIndex = stage - 1;
  g._spawnStageLeader(key, key.startsWith('mid') ? 'midboss' : 'boss', 1e6, 0, form);
  window.__seen = new Set();
}, [stage, key, form]);
const shots = [];
for (let n = 0; n < 4; n++) {
  // Run to the next signature attack's release (+0.25 s so the first bullets show).
  const hit = await page.evaluate(() => {
    const g = window.__LAO__.getGame(); const e = g.boss; const p = g.player;
    let armed = null;
    for (let i = 0; i < 60 * 30; i++) {
      p.invuln = 9; p.x = 160; g.update(1 / 60);
      const sc = e.script; const st = e.anim.state;
      const type = sc.def.phases[Math.max(0, sc.phase)].attacks[sc.i]?.type;
      if (!armed && (st === 'attack' || st === 'skill2') && sc.mode === 'tele' && !window.__seen.has(type)) armed = { st, type, i };
      if (armed && sc.mode === 'fire' && sc.state.t > 0.25) {
        window.__seen.add(armed.type);
        g.draw();
        return { ...armed, clipT: +e.anim.time.toFixed(2), hit: e.anim.hitTime[armed.st] };
      }
    }
    return null;
  });
  if (!hit) break;
  const f = `${outPrefix}_${hit.type}.png`;
  await page.screenshot({ path: f });
  shots.push({ ...hit, f });
}
console.log(JSON.stringify(shots), errs.slice(0, 2));
await browser.close();
