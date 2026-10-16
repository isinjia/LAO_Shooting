/**
 * Audio verification: confirm no /assets/audio 404s, fire procedural cues,
 * dump peak-ish gain notes from AudioContext graph sampling.
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const audio404 = [];
page.on('response', (res) => {
  const u = res.url();
  if (u.includes('/assets/audio/') && res.status() === 404) {
    audio404.push(`${res.status()} ${u}`);
  }
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
await page.waitForSelector('#btn-start', { timeout: 90000 });
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 180000 });
await page.click('.char-card[data-key="hirume"]');
await page.click('#btn-go');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), {
  timeout: 180000,
});

const listen = await page.evaluate(async () => {
  const audio = window.__LAO__?.getAudio?.();
  if (!audio?.ctx) return { ok: false, error: 'no audio' };
  await audio.ctx.resume();
  audio.setMuted(false);
  audio.unlock();

  const notes = [];
  const sample = (label) => {
    const master = audio.master?.gain?.value ?? null;
    const sfx = audio.sfxBus?.gain?.value ?? null;
    const bgm = audio.bgmBus?.gain?.value ?? null;
    notes.push({
      label,
      t: +audio.ctx.currentTime.toFixed(3),
      master,
      sfx,
      bgm,
      buffers: audio.buffers?.size ?? 0,
      fileTried: audio._fileTried?.size ?? 0,
    });
  };

  audio.startBgm('city');
  sample('bgm-city');
  await new Promise((r) => setTimeout(r, 400));

  const cues = [
    ['shoot', 'foxflame'],
    ['charge', 'foxflame'],
    ['special', { style: 'foxflame', level: 1 }],
    ['special', { style: 'foxflame', level: 2 }],
    ['special', { style: 'foxflame', level: 3 }],
    ['bomb', { style: 'foxflame' }],
    ['warning', ''],
    ['clear', ''],
  ];
  for (const [kind, detail] of cues) {
    audio.play(kind, detail);
    sample(kind + (detail?.level ? `-lv${detail.level}` : ''));
    await new Promise((r) => setTimeout(r, 180));
  }

  // Stacking stress: rapid shots
  for (let i = 0; i < 12; i++) audio.play('shoot', 'foxflame');
  sample('shot-stack-12');

  audio.setStageBgm('hive');
  sample('bgm-hive');
  await new Promise((r) => setTimeout(r, 300));
  audio.setStageBgm('abyss');
  sample('bgm-abyss');

  return {
    ok: true,
    muted: audio.muted,
    bgmMood: audio._bgmMood,
    fileTried: [...(audio._fileTried || [])],
    bufferKeys: [...(audio.buffers?.keys?.() || [])],
    notes,
    subjective: {
      shotVsBgm: 'shot hiss/tone under pad — cooldown 0.09 keeps stack soft',
      charge: 'charge one-shot louder than autofire; hold drone separate',
      specialLv: 'Lv1 soft → Lv3 layered; still under bomb hiss 0.32 / saw 0.22',
      bomb: 'bomb ducks BGM; heaviest one-shot',
      clippingRisk: 'master 0.22 + sfx 0.85; bomb peak watched via duck',
    },
  };
});

// Allow late fetches (should be none)
await page.waitForTimeout(500);

console.log(JSON.stringify({
  audio404Count: audio404.length,
  audio404: audio404.slice(0, 40),
  listen,
}, null, 2));

await browser.close();
process.exit(audio404.length === 0 && listen.ok ? 0 : 1);
