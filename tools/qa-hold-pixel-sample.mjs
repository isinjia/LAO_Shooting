/**
 * Tick19: canvas pixel sample for muddy HOLD pairs (hue/spread).
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';

async function sortie(page) {
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.click('.char-card[data-key="hirume"]');
  await page.click('#btn-go');
  try {
    const t = await page.waitForSelector('#btn-tut-go', { timeout: 1500 });
    if (t) await t.click();
  } catch { /* */ }
  await page.waitForFunction(
    () => document.getElementById('overlay')?.classList.contains('hidden'),
    null,
    { timeout: 300000 },
  );
  await page.waitForFunction(
    () => window.__LAO__?.getGame?.()?.stageClock > 4.2,
    null,
    { timeout: 45000 },
  );
}

async function sample(page, key, mode) {
  return page.evaluate(async ({ key, mode }) => {
    const g = window.__LAO__?.getGame?.();
    if (!g?.player) return null;
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
    p.x = 150;
    p.y = 260;
    g.polishFx?.setKitPalette?.(p.meta.shot);
    g.bullets.clearAll();
    if (g.projectileVfx?.particles) g.projectileVfx.particles.length = 0;
    if (mode === 'hold') {
      p.fireCharge(g.bullets);
      p.y = 290;
      p.fireCharge(g.bullets);
      p.y = 260;
    } else {
      for (let i = 0; i < 5; i++) {
        p.x = 150 + i * 4;
        p.shoot(g.bullets);
      }
      p.x = 150;
    }
    for (let i = 0; i < 12; i++) g.tick(1 / 60);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = document.querySelector('canvas#game') || document.querySelector('canvas');
    const w = canvas.width;
    const h = canvas.height;
    const x0 = Math.floor(w * 0.18);
    const x1 = Math.floor(w * 0.72);
    const y0 = Math.floor(h * 0.22);
    const y1 = Math.floor(h * 0.72);
    let img;
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    } catch (e) {
      return {
        err: String(e),
        vfxActive: g.projectileVfx?.active,
        styles: g.bullets.list.filter((b) => b.alive && b.friendly).map((b) => b.style),
      };
    }
    const d = img.data;
    let n = 0;
    let rS = 0;
    let gS = 0;
    let bS = 0;
    let xS = 0;
    let yS = 0;
    let x2 = 0;
    let y2 = 0;
    const bins = {
      warm: 0, magenta: 0, red: 0, violet: 0, cyan: 0, white: 0, other: 0,
    };
    for (let y = 0; y < img.height; y += 2) {
      for (let x = 0; x < img.width; x += 2) {
        const i = (y * img.width + x) * 4;
        const R = d[i];
        const G = d[i + 1];
        const B = d[i + 2];
        const mx = Math.max(R, G, B);
        const mn = Math.min(R, G, B);
        if (mx < 175 || mx - mn < 20) continue;
        if (mx < 210 && B > R + 20 && B > G + 10) continue; // UI teal/grid
        n += 1;
        rS += R;
        gS += G;
        bS += B;
        xS += x;
        yS += y;
        x2 += x * x;
        y2 += y * y;
        if (R > 200 && G > 160 && B < 150) bins.warm += 1;
        else if (R > 175 && B > 155 && G < 165) bins.magenta += 1;
        else if (R > 185 && G < 145 && B < 145) bins.red += 1;
        else if (R > 130 && B > 175 && G < 175) bins.violet += 1;
        else if (B > 175 && G > 155 && R < 150) bins.cyan += 1;
        else if (R > 205 && G > 205 && B > 205) bins.white += 1;
        else bins.other += 1;
      }
    }
    const styles = g.bullets.list.filter((b) => b.alive && b.friendly).map((b) => b.style);
    return {
      key,
      mode,
      styleSet: [...new Set(styles)],
      bulletN: styles.length,
      vfxActive: !!g.projectileVfx?.active,
      particleN: g.projectileVfx?.particles?.length || 0,
      brightN: n,
      meanRGB: n ? [Math.round(rS / n), Math.round(gS / n), Math.round(bS / n)] : null,
      spreadX: n > 1 ? Math.round(Math.sqrt(x2 / n - (xS / n) ** 2)) : 0,
      spreadY: n > 1 ? Math.round(Math.sqrt(y2 / n - (yS / n) ** 2)) : 0,
      bins,
    };
  }, { key, mode });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${URL}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sortie(page);

const cases = [
  ['hirume', 'hold', 'fan'],
  ['labiata', 'hold', 'crescent'],
  ['lrl', 'hold', 'axe'],
  ['merlin', 'hold', 'arty'],
  ['eternity', 'tap', 'hmg'],
];
const out = [];
for (const [key, mode, tag] of cases) {
  const s = await sample(page, key, mode);
  out.push({ tag, ...s });
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
