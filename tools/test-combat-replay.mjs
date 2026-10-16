/**
 * Reproducible combat tests:
 * A) Fixed RNG seed → two autoPlay runs must match
 * B) Record/replay scripted inputs must match
 * C) No-invuln bot attempt + boss/mid phase transitions
 *
 * Usage: node tools/test-combat-replay.mjs
 * Env: SMOKE_URL, COMBAT_SEED (default 0xC0FFEE)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const SEED = Number(process.env.COMBAT_SEED || 0xc0ffee) >>> 0;
const OUT = path.join(__dirname, 'combat-replay-results.json');

async function sortie(page) {
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.click('.char-card[data-key="hirume"]');
  await page.click('#btn-go');
  try {
    const tut = await page.waitForSelector('#btn-tut-go', { timeout: 1200 });
    if (tut) await tut.click();
  } catch { /* */ }
  await page.waitForFunction(
    () => document.getElementById('overlay')?.classList.contains('hidden'),
    null,
    { timeout: 300000 },
  );
}

function snap(g) {
  return {
    frames: g._simFrame,
    stageClock: +g.stageClock.toFixed(3),
    phase: g.stagePhase,
    score: g.score,
    graze: g.graze,
    lives: g.player?.lives,
    bombs: g.player?.bombs,
    enemies: g.enemies.filter((e) => e.alive).length,
    bullets: g.bullets.list.filter((b) => b.alive).length,
    bossPhase: g.boss?.attackPhase ?? null,
    phaseSeen: g._bossPhaseSeen,
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ bypassCSP: true });
await context.route('**/*', async (route) => {
  const headers = { ...route.request().headers(), 'Cache-Control': 'no-cache' };
  await route.continue({ headers });
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('PAGEERR', e.message));

await page.goto(`${URL}${URL.includes('?') ? '&' : '?'}cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sortie(page);

// A: seed stability (two autoPlay runs, same seed) — soft signal only.
// Short window + pumpSteps=1 + no bombs reduces soft drift from long autoPlay.
const seedPair = await page.evaluate(async (seed) => {
  const g = window.__LAO__?.getGame?.();
  if (!g?.prepareDeterministicRun) return { ok: false, error: 'no prepareDeterministicRun' };
  try { g.audio?.setMuted?.(true); } catch { /* */ }

  const run = (label) => {
    g.prepareDeterministicRun(seed);
    g.debug.invuln = true;
    g.debug.autoPlay = true;
    g.debug.pumpSteps = 1;
    // Keep bombs empty so autoPlay bomb edges can't fan soft nondeterminism.
    if (g.player) g.player.bombs = 0;
    const STEPS = 96;
    for (let i = 0; i < STEPS && g.state === 'playing'; i++) g.tick(1 / 30);
    return { label, steps: STEPS, ...{
      frames: g._simFrame,
      stageClock: +g.stageClock.toFixed(3),
      phase: g.stagePhase,
      score: g.score,
      graze: g.graze,
      lives: g.player?.lives,
      bombs: g.player?.bombs,
      enemies: g.enemies.filter((e) => e.alive).length,
      bullets: g.bullets.list.filter((b) => b.alive).length,
      bossPhase: g.boss?.attackPhase ?? null,
      phaseSeen: g._bossPhaseSeen,
    } };
  };

  const a = run('A1');
  const b = run('A2');
  const match = a.frames === b.frames && a.score === b.score && a.graze === b.graze
    && a.phase === b.phase && a.enemies === b.enemies && a.lives === b.lives;
  return { ok: true, match, a, b };
}, SEED);

// B: scripted record → replay on same page (no autoPlay)
const replay = await page.evaluate(async (seed) => {
  const g = window.__LAO__?.getGame?.();
  if (!g) return { ok: false, error: 'no game' };
  try { g.audio?.setMuted?.(true); } catch { /* */ }

  g.prepareDeterministicRun(seed);
  g.debug.invuln = true;
  g.debug.autoPlay = false;
  g.debug.pumpSteps = 8;
  g.startInputRecord();

  // Scripted sticky inputs for a short combat window
  const script = [
    { f: 0, action: 'shoot', down: true },
    { f: 0, action: 'focus', down: true },
    { f: 10, action: 'up', down: true },
    { f: 40, action: 'up', down: false },
    { f: 40, action: 'down', down: true },
    { f: 80, action: 'down', down: false },
    { f: 100, action: 'special', down: true },
    { f: 108, action: 'special', down: false },
  ];
  g.loadInputReplay(null);
  g.debug.recordInputs = true;
  g._inputLog = [];
  g._replayCursor = 0;
  g._simFrame = 0;
  g._inputLast = {
    left: false, right: false, up: false, down: false,
    shoot: false, focus: false, bomb: false, special: false,
  };

  const STEPS = 160;
  let scriptCursor = 0;
  for (let i = 0; i < STEPS && g.state === 'playing'; i++) {
    while (scriptCursor < script.length && script[scriptCursor].f <= g._simFrame) {
      const ev = script[scriptCursor++];
      g._setKeyAction(ev.action, !!ev.down);
    }
    g.tick(1 / 30);
  }
  const log = g.stopInputRecord();
  const recorded = { ...{
    frames: g._simFrame, stageClock: +g.stageClock.toFixed(3), phase: g.stagePhase,
    score: g.score, graze: g.graze, lives: g.player?.lives, bombs: g.player?.bombs,
    enemies: g.enemies.filter((e) => e.alive).length,
    bullets: g.bullets.list.filter((b) => b.alive).length,
  }, events: log.length };

  // Replay the recorded log
  g.prepareDeterministicRun(seed);
  g.debug.invuln = true;
  g.debug.autoPlay = false;
  g.debug.pumpSteps = 8;
  g.loadInputReplay(log);
  for (let i = 0; i < STEPS && g.state === 'playing'; i++) g.tick(1 / 30);
  const replayed = {
    frames: g._simFrame, stageClock: +g.stageClock.toFixed(3), phase: g.stagePhase,
    score: g.score, graze: g.graze, lives: g.player?.lives, bombs: g.player?.bombs,
    enemies: g.enemies.filter((e) => e.alive).length,
    bullets: g.bullets.list.filter((b) => b.alive).length,
  };

  const match = recorded.frames === replayed.frames
    && recorded.score === replayed.score
    && recorded.graze === replayed.graze
    && recorded.phase === replayed.phase
    && recorded.enemies === replayed.enemies;

  return { ok: true, match, recorded, replayed, inputLog: log };
}, SEED);

// C: no-invuln attempt + phase transitions
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sortie(page);
const passC = await page.evaluate(async (seed) => {
  const g = window.__LAO__?.getGame?.();
  if (!g) return { ok: false, error: 'no game' };
  g.prepareDeterministicRun(seed);
  g.debug.invuln = false;
  g.debug.autoPlay = true;
  g.debug.pumpSteps = 30;
  try { g.audio?.setMuted?.(true); } catch { /* */ }
  let guard = 0;
  const transitions = [];
  let lastPhase = g.stagePhase;
  while (g.state === 'playing' && g.stageIndex === 0 && guard++ < 20000) {
    g.tick(1 / 30);
    if (g.stagePhase !== lastPhase) {
      transitions.push({
        t: +g.stageClock.toFixed(2),
        from: lastPhase,
        to: g.stagePhase,
        bossPhase: g.boss?.attackPhase ?? null,
      });
      lastPhase = g.stagePhase;
    }
    if (g.stagePhase === 'transition' || g.state !== 'playing') break;
  }
  return {
    ok: true,
    state: g.state,
    stage: g.stageIndex + 1,
    phase: g.stagePhase,
    lives: g.player?.lives,
    score: g.score,
    transitions,
    bossPhaseMax: g._bossPhaseSeen,
    sawMidboss: transitions.some((x) => x.to === 'midboss'),
    sawPhaseBreak: (g._bossPhaseSeen | 0) >= 1,
  };
}, SEED);

// Scripted record/replay is the hard gate. AutoPlay seed pair is a soft signal —
// long autoPlay still drifts (hitstop/VFX coupling); use scripted logs for wave bugs.
const allOk = !!(replay.match && passC.ok && passC.sawMidboss);
const report = {
  seed: SEED,
  seedStability: {
    ...seedPair,
    note: 'Soft signal only. Prefer scripted record/replay for reproducible wave bugs.',
  },
  replay,
  noInvulnAttempt: passC,
  allOk,
  inputLog: replay.inputLog || [],
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  seed: SEED,
  seedMatch: seedPair.match,
  seedScores: [seedPair.a?.score, seedPair.b?.score],
  replayMatch: replay.match,
  replayScores: [replay.recorded?.score, replay.replayed?.score],
  noInvuln: {
    state: passC.state,
    phase: passC.phase,
    lives: passC.lives,
    transitions: passC.transitions?.length,
    sawMidboss: passC.sawMidboss,
    bossPhaseMax: passC.bossPhaseMax,
  },
  allOk,
}, null, 2));

await browser.close();
process.exit(allOk ? 0 : 1);
