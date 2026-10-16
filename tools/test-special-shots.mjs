/**
 * Special-shot numeric automation (all 8 chars × Lv1–3).
 * 1) Static: offensive totals are 6/12/18; Hirume's defensive ward deals 0.
 * 2) Runtime: spawn actual bullets via trySpecial and verify count/damage/gauge.
 *
 * Usage: node tools/test-special-shots.mjs
 * Requires: node tools/static-server.mjs (PORT 5188)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SPECIAL_ATTACKS,
  SPECIAL_VOLLEY_TARGETS,
  BOMB_LEADER_DAMAGE,
  analyzeSpecialAttacks,
  assertSpecialBalance,
  volleyDamageTotal,
  volleyBulletCount,
} from '../js/special-shots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const CHARS = Object.keys(SPECIAL_ATTACKS);
const OUT = path.join(__dirname, 'special-shots-results.json');

const staticRows = assertSpecialBalance(SPECIAL_ATTACKS);
const staticReport = {
  ok: true,
  targets: SPECIAL_VOLLEY_TARGETS,
  bombLeader: BOMB_LEADER_DAMAGE,
  rows: staticRows,
};

async function runtimeCheck() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('PAGEERR', e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.click('.char-card[data-key="hirume"]');
  await page.click('#btn-go');
  await page.waitForFunction(
    () => document.getElementById('overlay')?.classList.contains('hidden'),
    null,
    { timeout: 300000 },
  );

  const runtime = await page.evaluate(async (chars) => {
    const g = window.__LAO__?.getGame?.();
    if (!g?.player || !g.bullets) return { ok: false, error: 'no game' };
    const mod = await import('./js/special-shots.js');
    const attacks = mod.SPECIAL_ATTACKS;
    const expectedSpecialDamage = mod.expectedSpecialDamage;
    const bomb = mod.BOMB_LEADER_DAMAGE;
    const rows = [];
    const p = g.player;
    const cost = p.spCost;

    for (const key of chars) {
      p.charKey = key;
      p.meta = g.assets.CHAR_META[key] || p.meta;
      for (let level = 1; level <= 3; level++) {
        g.bullets.clearAll();
        p.sp = level * cost;
        p.alive = true;
        p.invuln = 0;
        const ok = p.trySpecial(g.bullets);
        const use = g.bullets.list.filter((b) => b.alive && b.friendly && b.special);
        const damage = +use.reduce((s, b) => s + (b.damage || 0), 0).toFixed(4);
        const expected = expectedSpecialDamage(key, level);
        const attack = attacks[key][level - 1];
        const expectBullets = attack.shots.length;
        const gaugeLeft = p.sp;
        const gaugeOk = Math.abs(gaugeLeft - 0) < 1e-6;
        rows.push({
          key,
          level,
          fired: ok,
          bullets: use.length,
          expectBullets,
          damage,
          expectedDamage: expected,
          gaugeCost: level,
          gaugeLeft,
          gaugeOk,
          belowBomb: damage < bomb,
          ok: ok
            && use.length === expectBullets
            && Math.abs(damage - expected) < 1e-6
            && gaugeOk
            && (level < 3 || damage < bomb),
        });
      }
    }
    return { ok: rows.every((r) => r.ok), rows };
  }, CHARS);

  await browser.close();
  return runtime;
}

let runtime = { ok: false, skipped: true };
try {
  runtime = await runtimeCheck();
} catch (err) {
  runtime = { ok: false, error: String(err.message || err) };
}

const report = {
  static: staticReport,
  runtime,
  allOk: staticReport.ok && !!runtime.ok,
  expected: Object.fromEntries(
    CHARS.map((key) => [
      key,
      [1, 2, 3].map((lv) => ({
        bullets: volleyBulletCount(SPECIAL_ATTACKS[key][lv - 1]),
        damage: volleyDamageTotal(SPECIAL_ATTACKS[key][lv - 1]),
      })),
    ]),
  ),
  analysis: analyzeSpecialAttacks(),
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.allOk ? 0 : 1);
