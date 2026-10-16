/**
 * Full Stage 1–5 clear smoke for base 5 + rare 3 characters.
 * Uses in-game debug turbo + autoPlay bot; records runMetrics.
 *
 * Usage: node tools/smoke-fullclear.mjs
 * Env: SMOKE_URL, SMOKE_TURBO (default 10), SMOKE_INVULN (default 0 — meaningful), SMOKE_CHARS
 * Opt-in god-mode: SMOKE_INVULN=1
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SPECIAL_ATTACKS,
  BOMB_LEADER_DAMAGE,
  volleyDamageTotal,
  assertSpecialBalance,
} from '../js/special-shots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const TURBO = Math.max(1, Number(process.env.SMOKE_TURBO || 10));
/** Default invuln:false — meaningful fullclear. Set SMOKE_INVULN=1 for god-mode. */
const INVULN = process.env.SMOKE_INVULN === '1' || process.env.SMOKE_INVULN === 'true';
const CHARS = (process.env.SMOKE_CHARS || 'hirume,constantia,lrl,merlin,fafnir,eternity,labiata,emily')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OUT = path.join(__dirname, 'fullclear-results.json');
/** Wall budget per char (no-invuln needs more room for deathbomb recoveries). */
const PER_CHAR_MS = Math.max(60_000, Number(process.env.SMOKE_TIMEOUT_MS || 8 * 60 * 1000));

function stagePlanSummary() {
  const src = fs.readFileSync(path.join(__dirname, '../js/stage-plan.js'), 'utf8');
  const blocks = [...src.matchAll(/makeStage\(\{([\s\S]*?)\n  \}\)/g)];
  return blocks.slice(0, 5).map((b, i) => {
    const body = b[1];
    const name = body.match(/name:\s*'([^']+)'/)?.[1];
    const waves = body.match(/waveTimes:\s*\[([^\]]+)\]/)?.[1]
      ?.split(',')
      .map((x) => Number(x.trim()));
    const midAt = Number(body.match(/midAt:\s*(\d+)/)?.[1]);
    const bossAt = Number(body.match(/bossAt:\s*(\d+)/)?.[1]);
    return { stage: i + 1, name, waveTimes: waves, midAt, bossAt };
  });
}

async function startSortie(page, charKey) {
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
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
      await page.waitForTimeout(400);
    } catch { /* */ }
  } else {
    const card = await page.$(`.char-card[data-key="${charKey}"]`);
    if (card) await card.click();
    await page.click('#btn-go');
  }

  try {
    const tut = await page.waitForSelector('#btn-tut-go', { timeout: 1200 });
    if (tut) await tut.click();
  } catch { /* */ }

  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), {
    timeout: 300000,
  });

  await page.evaluate(({ turbo, invuln }) => {
    const g = window.__LAO__?.getGame?.();
    if (!g) return;
    g.debug.turbo = 1;
    // Headless rAF is slow — pump fixed 1/30s slices each frame.
    g.debug.pumpSteps = Math.max(16, Math.min(40, (turbo | 0) * 3));
    g.debug.invuln = invuln;
    g.debug.autoPlay = true;
    try { g.audio?.setMuted?.(true); } catch { /* */ }
    g._keyInput.shoot = true;
    g._syncMergedInput?.();
  }, { turbo: TURBO, invuln: INVULN });
}

async function waitClearOrOver(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastLog = 0;
  while (Date.now() < deadline) {
    const snap = await page.evaluate(() => {
      const g = window.__LAO__?.getGame?.();
      if (!g) {
        const overlay = document.getElementById('overlay');
        const text = overlay?.innerText || '';
        return {
          gone: true,
          cleared: /ALL CLEAR|MISSION COMPLETE/.test(text),
          gameover: /GAME OVER|SYSTEM DOWN/.test(text),
          text: text.slice(0, 200),
          metrics: window.__LAO_LAST_METRICS__ || null,
        };
      }
      // Keep pump/auto alive if a transition recreated nothing — reassert.
      if (g.debug) {
        g.debug.autoPlay = true;
        if (!g.debug.pumpSteps || g.debug.pumpSteps < 16) g.debug.pumpSteps = 30;
      }
      return {
        gone: false,
        state: g.state,
        stage: g.stageIndex + 1,
        phase: g.stagePhase,
        clock: +g.stageClock.toFixed(1),
        lives: g.player?.lives,
        score: g.score,
        metrics: typeof g.getRunMetrics === 'function' ? g.getRunMetrics() : null,
      };
    });
    if (Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      console.error('[fullclear] tick', JSON.stringify({
        state: snap.state, stage: snap.stage, phase: snap.phase, clock: snap.clock, score: snap.score,
      }));
    }
    if (snap.gone) return snap;
    if (snap.state === 'cleared' || snap.state === 'gameover') return snap;
    await page.waitForTimeout(500);
  }
  return { timeout: true };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERR', e.message));

const results = {};
for (const key of CHARS) {
  const t0 = Date.now();
  console.error(`[fullclear] start ${key}`);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await startSortie(page, key);
    const end = await waitClearOrOver(page, PER_CHAR_MS);
    let metrics = end.metrics || null;
    if (!metrics) {
      metrics = await page.evaluate(() => {
        const g = window.__LAO__?.getGame?.();
        return g?.getRunMetrics?.() || null;
      }).catch(() => null);
    }
    // Result overlay may already have disposed the game — scrape console via evaluate storage
    if (!metrics) {
      metrics = await page.evaluate(() => window.__LAO_LAST_METRICS__ || null);
    }
    results[key] = {
      ok: !!(end.cleared || end.state === 'cleared'),
      state: end.state || (end.cleared ? 'cleared' : end.gameover ? 'gameover' : end.timeout ? 'timeout' : 'unknown'),
      wallMs: Date.now() - t0,
      turbo: TURBO,
      invuln: INVULN,
      metrics,
      end,
    };
  } catch (err) {
    results[key] = { ok: false, error: String(err.message || err), wallMs: Date.now() - t0 };
  }
  // Soft reset
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch { /* */ }
}

// Live SPECIAL_ATTACKS aggregation (regex previously under-counted .map() lanes).
const specialPower = (() => {
  const chars = {};
  for (const key of CHARS) {
    const levels = (SPECIAL_ATTACKS[key] || []).map((atk) => volleyDamageTotal(atk));
    chars[key] = { volleyTotals: levels, vsBombLeader: BOMB_LEADER_DAMAGE };
  }
  try {
    assertSpecialBalance(SPECIAL_ATTACKS);
    chars._balanceOk = true;
  } catch (err) {
    chars._balanceOk = false;
    chars._balanceError = String(err.message || err);
  }
  return chars;
})();

const report = {
  allOk: CHARS.every((k) => results[k]?.ok),
  turbo: TURBO,
  invuln: INVULN,
  stagePlan: stagePlanSummary(),
  specialPower,
  results,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.allOk ? 0 : 1);
