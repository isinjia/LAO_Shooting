/**
 * Performance regression harness (relative / headless signal only).
 * Collects per-wave max enemies/bullets/FX and frame dt peaks.
 *
 * DO NOT treat headless FPS as real-device FPS — compare before/after in same env.
 *
 * Usage: node tools/measure-perf.mjs
 * Env: SMOKE_URL, PERF_SECONDS (sim seconds, default 90), PERF_LABEL
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const SIM_SEC = Math.max(20, Number(process.env.PERF_SECONDS || 90));
const LABEL = process.env.PERF_LABEL || 'run';
const OUT = path.join(__dirname, `perf-${LABEL}.json`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
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

const result = await page.evaluate(async (simSec) => {
  const g = window.__LAO__?.getGame?.();
  if (!g) return { ok: false, error: 'no game' };
  g.setRngSeed?.(0x51a9e);
  g.debug.invuln = true;
  g.debug.autoPlay = true;
  g.debug.pumpSteps = 1;
  try { g.audio?.setMuted?.(true); } catch { /* */ }

  const wall0 = performance.now();
  let sim = 0;
  let frames = 0;
  let maxDt = 0;
  let dtSum = 0;
  while (sim < simSec && g.state === 'playing') {
    const t0 = performance.now();
    g.update(1 / 60);
    const wallDt = (performance.now() - t0) / 1000;
    frames += 1;
    sim += 1 / 60;
    dtSum += wallDt;
    if (wallDt > maxDt) maxDt = wallDt;
  }
  const wallMs = performance.now() - wall0;
  const waves = typeof g.getPerfLog === 'function' ? g.getPerfLog() : [];
  return {
    ok: true,
    disclaimer: 'Headless frame times are a relative regression signal only — not device FPS.',
    simSec: +sim.toFixed(2),
    wallMs: Math.round(wallMs),
    frames,
    avgFrameMs: frames ? +((dtSum / frames) * 1000).toFixed(3) : null,
    maxFrameMs: +(maxDt * 1000).toFixed(3),
    stage: g.stageIndex + 1,
    phase: g.stagePhase,
    waves,
  };
}, SIM_SEC);

const report = {
  label: LABEL,
  env: 'Playwright Chromium + tools/static-server.mjs',
  ...result,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
