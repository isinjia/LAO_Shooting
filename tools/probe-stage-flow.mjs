// Stage flow probe: entry fly-in -> waves; boss kill -> tally -> exit -> fade -> next entry.
// usage: node tools/probe-stage-flow.mjs <outPrefix>
import { chromium } from 'playwright';
const out = process.argv[2] || 'flow';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=sf' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
const step = (sec, fn) => page.evaluate(([sec, fn]) => {
  const g = window.__LAO__.getGame(); const log = [];
  for (let i = 0; i < Math.round(sec * 60); i++) { g.update(1 / 60); if (fn && i % 15 === 0) log.push(`${g.stagePhase} x=${g.player.x | 0} fade=${(g._fadeValue?.() ?? 0).toFixed(2)}`); }
  g.draw(); return { ph: g.stagePhase, x: g.player.x | 0, fade: g._fadeValue?.() ?? 0, log };
}, [sec, fn]);
// wait out the asset gate
let r = { ph: '' };
for (let i = 0; i < 200 && r.ph !== 'entry' && r.ph !== 'waves'; i++) { r = await step(0.1); await page.waitForTimeout(30); }
console.log('first', r);
r = await step(0.4); await page.screenshot({ path: `${out}_entry.png` }); console.log('entry+0.4', r.ph, r.x, r.fade.toFixed(2));
r = await step(3.0, 1); console.log('after3', r.ph, r.x, r.log.join(' | '));
// jump to the boss and kill it
await page.evaluate(async () => {
  const g = window.__LAO__.getGame(); const st = g.stages[g.stageIndex];
  await g.assets.bank.ensureEnemy(st.boss);
  g.enemies.length = 0; g.stagePhase = 'boss';
  g._spawnStageLeader(st.boss, 'boss', 100, 0, 0);
  g.boss.hp = 0; g.boss.alive = false; g.boss.dying = false;
  g._resolveStageLeader();
});
for (const [t, name] of [[0.5, 'tally05'], [1.6, 'tally21'], [1.4, 'tally35'], [1.2, 'exit'], [1.0, 'exit2']]) {
  r = await step(t); await page.screenshot({ path: `${out}_${name}.png` }); console.log(name, r.ph, r.x, r.fade.toFixed(2));
}
for (let i = 0; i < 200 && r.ph !== 'entry'; i++) { r = await step(0.1); await page.waitForTimeout(30); }
r = await step(0.5); await page.screenshot({ path: `${out}_next.png` });
console.log('next', r.ph, r.x, r.fade.toFixed(2), await page.evaluate(() => window.__LAO__.getGame().stageIndex));
r = await step(2.2); console.log('next+', r.ph, r.x, r.fade.toFixed(2));
console.log('errs', errs.slice(0, 3));
await browser.close();
