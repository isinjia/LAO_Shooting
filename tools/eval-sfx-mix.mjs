// In-game SFX mix probe: every cue / roster shot style must play a decoded original clip
// (not the synth), and a 6 s stress mix (autofire + kill chains + hits + graze + bomb +
// WARNING over the stage BGM) must not clip the master bus or pile up voices.
// usage: node tools/eval-sfx-mix.mjs out.json
import { chromium } from 'playwright';
import fs from 'fs';

const out = process.argv[2];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: false, bgmVolume: 0.7, sfxVolume: 0.8 }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=sx' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
await page.mouse.click(4, 4);
await page.click('#btn-start');
await page.waitForSelector('.char-card');
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(2500);
const res = await page.evaluate(async () => {
  const a = window.__LAO__.getAudio();
  const g = window.__LAO__.getGame();
  g.player.hit = () => false;
  await a.ctx.resume();
  const cues = ['playerHit', 'playerDeath', 'powerDown', 'bomb', 'special', 'charge',
    'pickupP', 'pickupB', 'deny', 'phase', 'warning', 'clear', 'fanfare'];
  const styles = ['p38shot', 'shindenshot', 'pancakeshot', 'marionshot', 'cleave', 'falconshot', 'spiral', 'hayateshot'];
  const cover = {};
  for (const c of cues) cover[c] = a._playSfx(c);
  for (const st of styles) cover[`shoot:${st}`] = a._playSfx('shoot', st);
  a.setChargeHold(true, 0.5);
  cover.chargeHold = !!a._chargeHold?.sample;
  a.stopChargeHold();
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
  let peak = 0;
  const t0 = performance.now();
  let k = 0;
  while (performance.now() - t0 < 6000) {
    a.play('shoot', 'p38shot');
    if (k === 20) a.play('bomb');
    if (k === 40) a.play('warning');
    if (k === 55) a.play('playerHit');
    if (k === 70) a.play('pickupP');
    peak = Math.max(peak, a.samplePeak());
    k += 1;
    await new Promise((r) => setTimeout(r, 50));
  }
  // Balance: master-meter RMS of the BGM alone, then kill chains / autofire / a bomb alone.
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
  // Enemy hit / death are switched off: the impact reference is the player-hit sting.
  level.kills = await rmsOver(2000, (j) => { if (j % 12 === 0) a._playSfx('playerHit'); });
  await new Promise((r) => setTimeout(r, 800));
  level.shots = await rmsOver(2000, (j) => { if (j % 2 === 0) a._playSfx('shoot', 'p38shot'); });
  await new Promise((r) => setTimeout(r, 600));
  level.bomb = await rmsOver(1500, (j) => { if (j === 0) a._playSfx('bomb'); });
  a._track?.el.play();
  return { cover, peak, maxLive, bgm: a.bgmTrack, level };
});
res.errors = errs.slice(0, 3);
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
await browser.close();
