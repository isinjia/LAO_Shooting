/**
 * Tick19: HOLD muddy-pair screenshots + style/particle dump
 * fan(hirume hold) vs crescent(labiata hold) vs axe(lrl hold)
 * arty(merlin hold) vs hmg(eternity basic — HMG volley identity)
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const OUT = path.join(__dirname);

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
  // Wait past STAGE 1 ceremony banner
  await page.waitForFunction(() => {
    const g = window.__LAO__?.getGame?.();
    const banner = document.querySelector('.stage-banner, #stage-banner, .announce');
    const bannerHidden = !banner || banner.classList.contains('hidden')
      || getComputedStyle(banner).opacity === '0'
      || getComputedStyle(banner).display === 'none';
    return g && g.stageClock > 4.2 && bannerHidden;
  }, null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function prime(page, key, mode) {
  return page.evaluate(({ key, mode }) => {
    const g = window.__LAO__?.getGame?.();
    if (!g?.player) return null;
    try { g.audio?.setMuted?.(true); } catch { /* */ }
    g.debug.invuln = true;
    g.debug.autoPlay = false;
    g.setPaused?.(false);
    // Clear ceremony overlays if any remain
    document.querySelectorAll('.stage-banner, #stage-banner, .announce, .ceremony')
      .forEach((el) => { el.classList?.add?.('hidden'); el.style.display = 'none'; });
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
    for (let i = 0; i < 10; i++) g.tick(1 / 60);
    const live = (g.bullets.list || []).filter((b) => b.alive && b.friendly);
    const styles = live.map((b) => b.style);
    const parts = g.projectileVfx?.particles || [];
    const kindCounts = {};
    for (const pt of parts) {
      const k = pt.kind || 'unk';
      kindCounts[k] = (kindCounts[k] || 0) + 1;
    }
    return {
      key,
      mode,
      styles: [...new Set(styles)],
      styleCounts: styles.reduce((m, s) => { m[s] = (m[s] || 0) + 1; return m; }, {}),
      bulletN: live.length,
      particleN: parts.length,
      kindCounts,
      shotStyle: p.meta?.shot?.style,
    };
  }, { key, mode });
}

const cases = [
  ['hirume', 'hold', 'fan'],
  ['labiata', 'hold', 'crescent'],
  ['lrl', 'hold', 'axe'],
  ['merlin', 'hold', 'arty'],
  ['eternity', 'tap', 'hmg'],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(`${URL}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sortie(page, 'hirume');

const report = [];
for (const [key, mode, tag] of cases) {
  const info = await prime(page, key, mode);
  const name = `qa-hold-${tag}-${key}.png`;
  await page.screenshot({ path: path.join(OUT, name) });
  // Extra mid-flight frame
  await page.evaluate(() => {
    const g = window.__LAO__?.getGame?.();
    if (!g) return;
    for (let i = 0; i < 6; i++) g.tick(1 / 60);
  });
  const name2 = `qa-hold-${tag}-${key}-t2.png`;
  await page.screenshot({ path: path.join(OUT, name2) });
  report.push({ tag, key, mode, file: `tools/${name}`, file2: `tools/${name2}`, ...info });
}

await browser.close();
console.log(JSON.stringify({ ok: true, report }, null, 2));
