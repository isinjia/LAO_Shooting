import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGE ' + String(e.stack || e).slice(0, 600)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
await page.addInitScript(() => { localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: true })); localStorage.setItem('lao_mini_tutorial_seen', '1'); });
await page.goto('http://localhost:5188/?cb=f' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion')); await page.waitForTimeout(2500);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const r = await page.evaluate(async () => {
  const mod = await import('./js/rampalion.js');
  const g = window.__LAO__.getGame(); const p = g.player; p.godMode = true; p.shotLevel = 3;
  const i = mod.RAMPALION_FORMS.findIndex((f) => f.id === 'fire');
  mod.rampFuse(p, () => (i + 0.5) / mod.RAMPALION_FORMS.length);
  const out = { form: p._ramp.form?.id, pattern: p.meta.shot.pattern, style: p.meta.shot.style };
  try { for (let k = 0; k < 120; k++) { g.update(1 / 60); } g.draw(); out.ok = true; } catch (e) { out.err = String(e.stack).slice(0, 800); }
  out.state = g.state; out.paused = g.paused;
  return out;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'work/rampalion-shots/probe-fire.png' });
console.log(JSON.stringify(r, null, 1)); console.log(errs.slice(0, 10).join('\n'));
await browser.close();
