/**
 * Sound technical checks (not subjective quality):
 * - No /assets/audio 404 (PRESENT_AUDIO_STEMS empty → no probes)
 * - Capture procedural SFX peaks / clipping / autofire stack
 *
 * Usage: node tools/check-audio.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const OUT = path.join(__dirname, 'audio-check-results.json');
const CAP_DIR = path.join(__dirname, 'audio-captures');

fs.mkdirSync(CAP_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const audio404 = [];
page.on('response', (res) => {
  const u = res.url();
  if (u.includes('/assets/audio/') && res.status() === 404) {
    audio404.push(u);
  }
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
await page.waitForSelector('#btn-start', { timeout: 90000 });
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 180000 });
await page.click('.char-card[data-key="hirume"]');
await page.click('#btn-go');
await page.waitForFunction(
  () => document.getElementById('overlay')?.classList.contains('hidden'),
  null,
  { timeout: 180000 },
);

const listen = await page.evaluate(async () => {
  const audio = window.__LAO__?.getAudio?.();
  if (!audio?.ctx) return { ok: false, error: 'no audio' };
  await audio.ctx.resume();
  audio.setMuted(false);
  audio.unlock();

  const measures = [];
  const run = async (label, fire, ms = 280) => {
    const peak = await audio.measurePeak(ms, fire);
    let cap = null;
    if (typeof audio.captureBlob === 'function') {
      try {
        const blob = await audio.captureBlob(Math.min(ms, 350), fire);
        let b64 = null;
        if (blob.buffer && blob.buffer.byteLength) {
          const u8 = new Uint8Array(blob.buffer);
          const chunk = 0x8000;
          let s = '';
          for (let i = 0; i < u8.length; i += chunk) {
            s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
          }
          b64 = btoa(s);
        }
        cap = {
          ok: blob.ok,
          bytes: blob.bytes || 0,
          mime: blob.mime || null,
          peak: blob.peak,
          clipped: blob.clipped,
          b64,
        };
      } catch (err) {
        cap = { ok: false, error: String(err.message || err) };
      }
    }
    measures.push({ label, ...peak, capture: cap });
  };

  audio.startBgm('city');
  await run('bgm-city', null, 350);

  await run('shoot-single', () => audio.play('shoot', 'foxflame'));
  await run('shoot-stack-12', () => {
    for (let i = 0; i < 12; i++) audio.play('shoot', 'foxflame');
  }, 400);
  await run('special-lv3', () => audio.play('special', { style: 'foxflame', level: 3 }));
  await run('bomb', () => audio.play('bomb', { style: 'foxflame' }), 450);

  const stack = measures.find((m) => m.label === 'shoot-stack-12');
  const single = measures.find((m) => m.label === 'shoot-single');
  const stackRatio = single?.peak > 0 ? stack.peak / single.peak : null;

  return {
    ok: true,
    master: audio._masterVol,
    sfx: audio._sfxVol,
    measures,
    autofireStackRatio: stackRatio,
    // Soft technical budgets (not subjective)
    budgets: {
      peakSoft: 0.95,
      stackRatioSoft: 3.5,
    },
    peakOk: measures.every((m) => !m.clipped && m.peak < 0.99),
    stackOk: stackRatio == null || stackRatio < 3.5,
  };
});

// Write captures
if (listen.measures) {
  for (const m of listen.measures) {
    const b64 = m.capture?.b64;
    if (!b64) continue;
    const buf = Buffer.from(b64, 'base64');
    const ext = (m.capture.mime || '').includes('webm') ? 'webm' : 'bin';
    fs.writeFileSync(path.join(CAP_DIR, `${m.label}.${ext}`), buf);
    delete m.capture.b64;
  }
}

await page.waitForTimeout(400);

const report = {
  audio404Count: audio404.length,
  audio404: audio404.slice(0, 20),
  listen,
  allOk: audio404.length === 0 && !!listen.ok && !!listen.peakOk && !!listen.stackOk,
  note: 'Subjective quality left to user; this report is peak/clip/404 only.',
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.allOk ? 0 : 1);
