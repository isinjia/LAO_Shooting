import { chromium } from 'playwright';
const [out, mode] = [process.argv[2], process.argv[3]];
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=hb' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion')); await page.waitForTimeout(4000);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(6000);
const bb = await page.evaluate(async (mode) => {
  window.requestAnimationFrame = () => 0;
  const rm = await import('/js/rampalion.js');
  const g = window.__LAO__.getGame(); const p = g.player;
  g._updateStageFlow = () => {}; g.stagePhase = 'waves'; g.stageIntro = 0; p.godMode = true;
  if (mode === 'hyper') { rm.rampHyperStart(p, { force: true }); for (let i = 0; i < 120; i++) { p.x = 300; p.y = 330; g.update(1 / 60); } }
  p.x = 300; p.y = 330; p.bombs = 3; g._bombQueued = true; g.update(1 / 60);
  const c = document.getElementById('game').getBoundingClientRect(); const k = c.width / 960;
  return { x: c.left + 300 * k, y: c.top + 330 * k, hyper: p._ramp.hyper, lv: p.shotLevel, slots: p._ramp.slots.length, spec: p.skillRun?.t };
}, mode);
console.log(JSON.stringify(bb));
const at = async (name, rt) => { const r = await page.evaluate((rt) => { const g = window.__LAO__.getGame(); const p = g.player; let n = 0; while (p.skillRun && p.skillRun.t < rt && n++ < 900) { p.x = 300; p.y = 330; g.update(1 / 60); } const r = p.skillRun; const b = r && r.spec.bodyAnim ? r.spec.bodyAnim(p, r) : null; const used = b || p.anim; const calls = []; const od = used.draw.bind(used); used.draw = (c, x, y, sz) => { calls.push([x | 0, y | 0, sz, c.globalAlpha, String(c.filter), used.state, used.time, !!used.image]); return od(c, x, y, sz); }; g.draw(); delete used.draw; return { t: r?.t, own: !!b, st: p.anim.state, tm: p.anim.time, calls, img: !!p.anim.image, n: p.anim.clips?.skill2?.length }; }, rt); console.log(name, JSON.stringify(r)); await page.screenshot({ path: `${out}_${name}.png`, clip: { x: bb.x - 150, y: bb.y - 170, width: 300, height: 250 } }); };
for (const [n, t] of (mode === 'hyper' ? [['a', 4.75], ['b', 4.95]] : [['a', -0.3], ['b', -0.1], ['d', 5.4]])) await at(n, t);
console.log('errs', errs.slice(0, 3));
await browser.close();
