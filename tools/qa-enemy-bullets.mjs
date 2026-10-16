/**
 * Tick20: enemy-bullet readability — dark rim + dense-mode outline stay on.
 * Spawns pale/cyan/white pellets over a bright wash and samples pixels.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const OUT = path.join(__dirname, 'qa-enemy-bullets.png');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.click('.char-card[data-key="hirume"]');
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
    return g && g.stageClock > 3.5;
  }, null, { timeout: 45000 }).catch(() => {});

  const dump = await page.evaluate(() => {
    const g = window.__LAO__?.getGame?.();
    if (!g?.bullets) return { ok: false };
    try { g.audio?.setMuted?.(true); } catch { /* */ }
    g.debug.invuln = true;
    g.debug.autoPlay = false;
    g.setPaused?.(false);
    g.bullets.clearAll?.();
    // Bright wash so pale pellets must rim-separate from the field.
    const canvas = document.getElementById('game') || document.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // one-frame wash is overwritten by game loop; instead stamp via debug clear color
      g._qaBrightWash = true;
    }
    const samples = [
      { x: 420, y: 220, vx: -90, vy: 0, r: 5, color: '#ffffff' },
      { x: 480, y: 280, vx: -80, vy: 20, r: 4.5, color: '#8fe5ff' },
      { x: 540, y: 340, vx: -70, vy: -10, r: 4, color: '#ffe9a0' },
      { x: 600, y: 400, vx: -85, vy: 15, r: 5, color: '#ff6b6b' },
      { x: 660, y: 250, vx: -75, vy: 30, r: 4.5, color: '#feca57' },
    ];
    // Dense field → trip skipHalo path (>110) while keeping a rim on each pellet.
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      g.bullets.spawn({
        x: 700 + Math.cos(a) * (40 + (i % 5) * 18),
        y: 360 + Math.sin(a) * (40 + (i % 5) * 18),
        vx: Math.cos(a + 1.2) * 40,
        vy: Math.sin(a + 1.2) * 40,
        r: 4,
        color: i % 3 === 0 ? '#8fe5ff' : i % 3 === 1 ? '#ffffff' : '#ff9f43',
        friendly: false,
      });
    }
    for (const s of samples) g.bullets.spawn({ ...s, friendly: false });
    // Pump a few frames so draw runs with skipHalo
    for (let f = 0; f < 3; f++) g.update?.(1 / 60);
    const enemyLive = g.bullets.list.filter((b) => b.alive && !b.friendly).length;
    return { ok: true, enemyLive, skipHalo: enemyLive > 110 };
  });

  // Force a bright underlay by painting behind via CSS if possible
  await page.evaluate(() => {
    const wrap = document.getElementById('game-wrap') || document.body;
    wrap.style.background = 'linear-gradient(120deg,#c8f4ff,#fff6d8,#ffe0f0)';
  });
  await page.waitForTimeout(180);
  await page.screenshot({ path: OUT, fullPage: false });

  // Sample a few bullet centers via canvas readback
  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas#game') || document.querySelector('canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const g = window.__LAO__?.getGame?.();
    const picks = (g?.bullets?.list || [])
      .filter((b) => b.alive && !b.friendly)
      .slice(0, 8)
      .map((b) => {
        const x = Math.round(b.x);
        const y = Math.round(b.y);
        const c = ctx.getImageData(x, y, 1, 1).data;
        // Offset to rim (behind tip)
        const bx = Math.round(b.x - Math.cos(Math.atan2(b.vy, b.vx)) * b.r * 0.9);
        const by = Math.round(b.y - Math.sin(Math.atan2(b.vy, b.vx)) * b.r * 0.9);
        const rim = ctx.getImageData(
          Math.max(0, Math.min(canvas.width - 1, bx)),
          Math.max(0, Math.min(canvas.height - 1, by)),
          1, 1,
        ).data;
        return {
          color: b.color,
          core: [c[0], c[1], c[2], c[3]],
          rimSample: [rim[0], rim[1], rim[2], rim[3]],
        };
      });
    return picks;
  });

  fs.writeFileSync(
    path.join(__dirname, 'qa-enemy-bullets.json'),
    JSON.stringify({ dump, pixels, out: OUT }, null, 2),
  );
  console.log(JSON.stringify({ dump, pixelN: pixels?.length || 0, out: OUT }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
