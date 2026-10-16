/**
 * Multi-character sortie smoke + stage-plan sanity.
 * Runs each base/rare for a short combat window and reports HUD/input state.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Lightweight parse — avoid Node ESM package-type issues with game modules.
function analyzeStagesFromSource() {
  const src = fs.readFileSync(path.join(__dirname, '../js/stage-plan.js'), 'utf8');
  const names = [...src.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
  const scenes = [...src.matchAll(/scene:\s*'([^']+)'/g)].map((m) => m[1]);
  const midHp = [...src.matchAll(/midHp:\s*(\d+)/g)].map((m) => +m[1]);
  const bossHp = [...src.matchAll(/bossHp:\s*(\d+)/g)].map((m) => +m[1]);
  const ambush = [...src.matchAll(/ambushWaves:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
  const breath = [...src.matchAll(/breathWaves:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
  return names.slice(0, 5).map((name, i) => ({
    stage: i + 1,
    name,
    scene: scenes[i],
    midHp: midHp[i],
    bossHp: bossHp[i],
    ambushWaves: ambush[i],
    breathWaves: breath[i],
  }));
}

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5173/';
const CHARS = ['hirume', 'constantia', 'lrl', 'merlin', 'fafnir', 'eternity', 'labiata', 'emily'];

async function sortie(page, charKey) {
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  const hasStart = await page.$('#btn-start');
  if (hasStart) await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });

  const rare = ['eternity', 'labiata', 'emily'].includes(charKey);
  if (rare) {
    await page.evaluate((key) => {
      const map = { eternity: 0.01, labiata: 0.04, emily: 0.07 };
      const r = map[key] ?? 0.5;
      const orig = Math.random;
      let uses = 0;
      Math.random = () => {
        uses += 1;
        // First roll resolves the rare; restore afterward so gameplay RNG stays sane.
        if (uses === 1) return r;
        Math.random = orig;
        return orig();
      };
    }, charKey);
    await page.click('.char-card[data-key="random"], .char-card.is-random');
    await page.click('#btn-go');
    try {
      await page.waitForSelector('.rare-fanfare', { timeout: 8000 });
      await page.keyboard.press('Space');
      await page.waitForTimeout(450);
    } catch { /* */ }
  } else {
    const card = await page.$(`.char-card[data-key="${charKey}"]`);
    if (card) await card.click();
    await page.click('#btn-go');
  }

  try {
    const tut = await page.waitForSelector('#btn-tut-go', { timeout: 1500 });
    if (tut) await tut.click();
  } catch { /* */ }

  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), {
    timeout: 180000,
  });
  await page.waitForTimeout(600);

  // Combat sample: move + shoot + charge + special deny/bomb
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  await page.waitForTimeout(1200);
  await page.keyboard.up('Space');
  await page.waitForTimeout(200);
  await page.keyboard.down('Space');
  await page.waitForTimeout(900); // charge
  await page.keyboard.up('Space');
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyX');
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);

  return page.evaluate(() => ({
    stage: document.querySelector('#stage-num')?.textContent,
    lives: document.querySelector('#lives')?.textContent,
    bombs: document.querySelector('#bombs')?.textContent,
    power: document.querySelector('#power-lv')?.textContent,
    score: document.querySelector('#score')?.textContent,
    sp: document.querySelector('#sp-pct')?.textContent,
    playing: document.getElementById('overlay')?.classList.contains('hidden'),
  }));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERR', e.message));

const results = {};
for (const key of CHARS) {
  const t0 = Date.now();
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#btn-start', { timeout: 90000 });
    const hud = await sortie(page, key);
    results[key] = { ok: !!hud.playing && hud.stage === '1', ms: Date.now() - t0, hud };
  } catch (err) {
    results[key] = { ok: false, ms: Date.now() - t0, error: String(err.message || err) };
  }
  // Quit to title for next
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const quit = await page.$('#btn-quit');
    if (quit) await quit.click();
    else await page.goto(URL, { waitUntil: 'domcontentloaded' });
  } catch {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
  }
}

const stages = analyzeStagesFromSource();
const allOk = CHARS.every((k) => results[k]?.ok);
console.log(JSON.stringify({ allOk, results, stages }, null, 2));
await browser.close();
process.exit(allOk ? 0 : 1);
