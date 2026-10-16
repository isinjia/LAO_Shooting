// One pilot's in-game SFX mix probe, in the format of tools/eval-sfx-mix.mjs (for score-sfx.mjs):
// the pilot is picked on the select screen, every cue of its set (eval-pilot-sfx-files.py) must
// play a decoded original clip, its own clips / voice lines must decode, and the same 6 s
// stress mix and master-meter balance run with the pilot's shot style.
// usage: node tools/eval-pilot-sfx-mix.mjs files.json out.json [pilot]      (static server :5188)
import { chromium } from 'playwright';
import fs from 'fs';

const files = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const PILOT = process.argv[4] || files.pilot || 'rampalion';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 4, lang: 'ko', muted: false, autoFire: false, bgmVolume: 0.7, sfxVolume: 0.8 }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=psx' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.mouse.click(4, 4);
await page.click('#btn-start');
await page.waitForSelector('.char-card');
await page.waitForTimeout(300);
if (PILOT !== 'griffin') { await page.evaluate((k) => window.__LAO__.applySelectCheat(k), PILOT); await page.waitForTimeout(2500); }
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(2500);
const keys = Object.keys(files.cues);
const res = await page.evaluate(async (keys) => {
  const a = window.__LAO__.getAudio();
  const g = window.__LAO__.getGame();
  g.player.hit = () => false;
  await a.ctx.resume();
  const style = g.player.meta?.shot?.style || 'shindenshot';
  const cover = {};
  for (const k of keys) {
    if (k.startsWith('clip:')) cover[k] = !!(await a.preloadClip(k.slice(5)));
    else if (k.startsWith('voice:')) {
      const r = await fetch(`assets/audio/voice/${k.slice(6)}.ogg`);
      cover[k] = r.ok && !!(await a.ctx.decodeAudioData(await r.arrayBuffer()).catch(() => null));
    } else {
      const [cue, st] = k.split(':');
      cover[k] = cue === 'shoot' ? a._playSfx('shoot', st) : a._playSfx(k);
    }
  }
  for (const v of a._sfxActive.values()) for (const x of v) { try { x.src.stop(); } catch { /* */ } }
  await new Promise((r) => setTimeout(r, 600));
  let live = 0;
  let maxLive = 0;
  const mk = a.ctx.createBufferSource.bind(a.ctx);
  a.ctx.createBufferSource = () => {
    const s = mk();
    live += 1;
    maxLive = Math.max(maxLive, live);
    s.addEventListener('ended', () => { live -= 1; });
    return s;
  };
  // Stress: autofire with the pilot's style + its C / X clips and lines over the stage BGM.
  const own = keys.filter((k) => k.startsWith('clip:')).map((k) => k.slice(5));
  let peak = 0;
  const t0 = performance.now();
  let k = 0;
  while (performance.now() - t0 < 6000) {
    a.play('shoot', style);
    if (k === 20) { a.play('bomb'); a.playVoice(`${g.charKey}_bomb`); }
    if (k % 15 === 5 && own.length) a.playClip(own[(k / 15 | 0) % own.length]);
    if (k === 40) a.play('warning');
    if (k === 55) a.play('playerHit');
    if (k === 70) { a.play('pickupP'); a.playVoice(`${g.charKey}_special3`); }
    peak = Math.max(peak, a.samplePeak());
    k += 1;
    await new Promise((r) => setTimeout(r, 50));
  }
  const an = a._analyser;
  const buf = new Float32Array(an.fftSize);
  const rmsOver = async (ms, fire) => {
    const t1 = performance.now(); let acc = 0; let n = 0; let j = 0;
    while (performance.now() - t1 < ms) {
      if (fire) fire(j++);
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += v * v;
      acc += sum / buf.length; n += 1;
      await new Promise((r) => setTimeout(r, 40));
    }
    return +(10 * Math.log10(acc / n + 1e-12)).toFixed(1);
  };
  await new Promise((r) => setTimeout(r, 1500));
  const level = { bgm: await rmsOver(2500) };
  a._track?.el.pause();
  await new Promise((r) => setTimeout(r, 400));
  level.kills = await rmsOver(2000, (j) => { if (j % 12 === 0) a._playSfx('playerHit'); });
  await new Promise((r) => setTimeout(r, 800));
  level.shots = await rmsOver(2000, (j) => { if (j % 2 === 0) a._playSfx('shoot', style); });
  await new Promise((r) => setTimeout(r, 600));
  level.bomb = await rmsOver(1500, (j) => { if (j === 0) a._playSfx('bomb'); });
  a._track?.el.play();
  return { pilot: g.charKey, cover, peak, maxLive, bgm: a.bgmTrack, level };
}, keys);
res.errors = errs.slice(0, 3);
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ pilot: res.pilot, covered: Object.values(res.cover).filter(Boolean).length, of: keys.length, peak: res.peak, maxLive: res.maxLive, level: res.level, errors: res.errors }));
await browser.close();
