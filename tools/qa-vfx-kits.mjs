/**
 * Headless VFX screenshots: Fafnir tap/hold + Hirume / Emily comparison.
 * Usage: node tools/qa-vfx-kits.mjs  (needs tools/static-server.mjs)
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const OUT = path.join(__dirname, '..', 'tools');

async function sortie(page, key) {
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.click(`.char-card[data-key="${key}"]`);
  await page.click('#btn-go');
  try {
    const tut = await page.waitForSelector('#btn-tut-go', { timeout: 1500 });
    if (tut) await tut.click();
  } catch { /* */ }
  await page.waitForFunction(
    () => document.getElementById('overlay')?.classList.contains('hidden'),
    null,
    { timeout: 300000 },
  );
  await page.waitForFunction(() => {
    const g = window.__LAO__?.getGame?.();
    return g && g.stageClock > 2.6;
  }, null, { timeout: 30000 });
}

async function prime(page, key, { charge = false, special = false } = {}) {
  await page.evaluate(({ key, charge, special }) => {
    const g = window.__LAO__?.getGame?.();
    if (!g?.player) return;
    try { g.audio?.setMuted?.(true); } catch { /* */ }
    g.debug.invuln = true;
    g.debug.autoPlay = false;
    g.setPaused?.(false);
    const p = g.player;
    p.charKey = key;
    p.meta = g.assets.CHAR_META[key] || p.meta;
    p.shotLevel = 5;
    p.alive = true;
    p.sp = 99;
    p.x = 180;
    p.y = 270;
    g.polishFx?.setKitPalette?.(p.meta.shot);
    g.bullets.clearAll();
    if (special) p.trySpecial(g.bullets);
    else if (charge) p.fireCharge(g.bullets);
    else {
      p.shoot(g.bullets);
      p.x = 220;
      p.shoot(g.bullets);
      p.x = 180;
    }
    for (let i = 0; i < 2; i++) g.tick(1 / 60);
  }, { key, charge, special });
  await page.waitForTimeout(80);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(`${URL}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sortie(page, 'fafnir');

await prime(page, 'fafnir', {});
await page.screenshot({ path: path.join(OUT, 'qa-vfx-fafnir-tap.png') });

await prime(page, 'fafnir', { charge: true });
await page.screenshot({ path: path.join(OUT, 'qa-vfx-fafnir-hold.png') });

await prime(page, 'hirume', {});
await page.screenshot({ path: path.join(OUT, 'qa-vfx-hirume-tap.png') });

await prime(page, 'emily', {});
await page.screenshot({ path: path.join(OUT, 'qa-vfx-emily-tap.png') });

await browser.close();
console.log(JSON.stringify({
  ok: true,
  shots: [
    'tools/qa-vfx-fafnir-tap.png',
    'tools/qa-vfx-fafnir-hold.png',
    'tools/qa-vfx-hirume-tap.png',
    'tools/qa-vfx-emily-tap.png',
  ],
}, null, 2));
