// Balance probe: real DPS per pilot (main + 보조무기, held fire) at P Lv1/3/5 against a big
// stationary target, plus move speed. Prints JSON. Requires the static server (port 5188).
// usage: node tools/eval-balance.mjs [out.json]
import { chromium } from 'playwright';
import fs from 'fs';

const KEYS = ['griffin', 'sleipnir', 'express76', 'constantia', 'lrl', 'peregrinus', 'peregrinus*'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: false, padMode: 'fixed', fullscreen: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
const res = {};
for (const k0 of KEYS) {
  const key = k0.replace('*', '');
  await page.goto('http://localhost:5188/?cb=ev' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-start', { timeout: 90000 });
  await page.click('#btn-start');
  await page.waitForSelector('.char-card', { timeout: 90000 });
  if (!['griffin'].includes(key)) {
    if (['sleipnir', 'express76'].includes(key)) {
      await page.evaluate((key) => { const c = [...document.querySelectorAll('.char-card')].find((el) => el.dataset.key === key || el.dataset.char === key); c?.click(); }, key);
    } else await page.evaluate((key) => window.__LAO__.applySelectCheat(key), key);
  }
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  res[k0] = await page.evaluate(async ([human]) => {
    window.requestAnimationFrame = () => 0;
    const g = window.__LAO__.getGame(); const p = g.player;
    for (let i = 0; i < 120; i++) { g.update(1 / 60); p.invuln = 99; }
    const out = { key: p.charKey, speed: p.meta.speed ?? p.speed };
    if (human) {
      p.sp = p.spCost; g._keyInput.special = true; g._syncMergedInput(); g.update(1 / 60);
      g._keyInput.special = false; g._syncMergedInput();
      while (p.changing > 0) { g.update(1 / 60); p.invuln = 99; }
      out.speed = p.meta.speed ?? p.speed;
    }
    // Dummy: one enemy, huge HP, big body, parked ahead in her lane.
    let dummy = g.enemies.find((e) => e.alive);
    for (let i = 0; i < 1200 && !dummy; i++) { g.update(1 / 60); p.invuln = 99; dummy = g.enemies.find((e) => e.alive); }
    const park = () => {
      g.enemies.forEach((e) => { if (e !== dummy) { e.alive = false; e.dying = false; } });
      dummy.alive = true; dummy.dying = false; dummy.x = 620; dummy.y = p.hitY; dummy.hp = dummy.maxHp = 1e9;
      dummy.fireTimer = 99; dummy.script = null;
      g.bullets.list.forEach((b) => { if (!b.friendly) b.alive = false; });
      p.x = 160; p.y = 270; p.invuln = 99; if (human) p.humanFor = 99;
    };
    let dealt = 0;
    const orig = dummy.damage.bind(dummy);
    dummy.damage = (a) => { dealt += a; return orig(a); };
    const dps = {};
    for (const lv of [1, 3, 5]) {
      p.shotLevel = lv; g._keyInput.shoot = true; g._syncMergedInput();
      for (let i = 0; i < 60; i++) { park(); g.update(1 / 60); }
      dealt = 0;
      for (let i = 0; i < 480; i++) { park(); g.update(1 / 60); }
      dps[lv] = +(dealt / 8).toFixed(2);
    }
    out.dps = dps;
    return out;
  }, [k0.endsWith('*')]);
}
console.log(JSON.stringify(res));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 3)));
await browser.close();
