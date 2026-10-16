import { chromium } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
await page.addInitScript((fly) => { window.__FLYARG__ = fly; localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 2, muted: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); }, process.argv[4] === 'fly');
await page.goto('http://localhost:5188/?cb=rp' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion')); await page.waitForTimeout(4000);
await page.evaluate(async () => { window.__rampMod = await import('/js/rampalion.js'); });
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(4000);
const fuses = Number(process.argv[3] || 1);
const rands = (process.argv[5] || '').split(',').filter(Boolean).map(Number);
const r = await page.evaluate(([fuses, rands]) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); const p = g.player;
  if (!p._ramp) return { err: 'not rampalion', key: g.charKey };
  p.godMode = true; g._updateStageFlow = () => {}; g.stagePhase = 'waves'; g.stageIntro = 0; g.enemies.length = 0; g.bullets.clearEnemy();
  p.x = 300; p.y = 330;
  const rnd = Math.random; Math.random = () => 0;
  for (let f = 0; f < fuses; f++) {
    const v = rands[f] ?? 0; Math.random = () => v;
    g._rampalionFuse();
    let n = 0;
    while (n++ < 600) { g.enemies.length = 0; p.x = 300; p.y = 330; g.update(1 / 60); if (p._ramp.slots[f]?.attached && p._ramp.docks.length === 0) break; }
  }
  Math.random = rnd;
  const fly = (window.__FLY__ = !!window.__FLYARG__);
  for (let i = 0; i < 90; i++) { g.enemies.length = 0; if (fly) { g._keyInput.right = true; g._syncMergedInput(); } p.x = 300; p.y = 330; g.update(1 / 60); }
  const mod = window.__rampMod;
  const rows = [];
  for (let i = 0; i < 40; i++) {
    g.enemies.length = 0; if (fly) { g._keyInput.right = true; g._syncMergedInput(); } p.x = 300; p.y = 330; g.update(1 / 60);
    if (i % 2 === 0 && mod && p._ramp.slots[1]) {
      const m = p._ramp.slots[1].opt.mounts[1];
      const e = mod.bonePoint(p, 'armFd1'); const h = mod.bonePoint(p, 'handFs');
      rows.push([p.anim.state, (p.anim.time).toFixed(2), 'elbow', e.x.toFixed(1), e.y.toFixed(1), 'hand', h.x.toFixed(1), h.y.toFixed(1), 'segAng', (Math.atan2(h.y - e.y, h.x - e.x) * 57.3).toFixed(0)].join(' '));
    }
  }
  window.__rows = rows;
  g.draw();
  const s = p._ramp.slots[0];
  return { state: p.anim.state, fb: p._ramp.flyBlend, slots: p._ramp.slots.map((e) => e.robot + ':' + e.attached), key: g.charKey, robot: s?.robot, attached: s?.attached, part: s?.opt.mounts[0].part, hasAnim: !!p._ramp.anims[s?.opt.mounts[0].part] };
}, [fuses, rands]);
console.log(JSON.stringify(r), errs.slice(0, 3));
console.log((await page.evaluate(() => window.__rows)).join(String.fromCharCode(10)));
const bb = await page.evaluate(() => { const g = window.__LAO__.getGame(); const c = document.getElementById('game').getBoundingClientRect(); const k = c.width / 960; return { x: c.left + g.player.x * k, y: c.top + g.player.y * k }; }); await page.screenshot({ path: out, clip: { x: bb.x - 70, y: bb.y - 95, width: 210, height: 150 } }); console.log(JSON.stringify(bb));
await browser.close();
