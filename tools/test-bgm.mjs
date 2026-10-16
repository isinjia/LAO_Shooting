// BGM routing check: title, select (per pilot), stage waves / midboss / boss per stage and
// the result screen. Hooks ArcadeAudio.playBgmTrack and checks every stem against
// js/bgm-tracks.js, that the file streams (HTMLAudioElement can play it) and that the
// active track changes with the stage phase. usage: node tools/test-bgm.mjs
import { chromium } from 'playwright';
import { BGM_TABLE, BGM_SOURCES } from '../js/bgm-tracks.js';

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: false, bgmVolume: 0.5, sfxVolume: 0.5 }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=bg' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
let bad = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) bad += 1;
  console.log(`${label.padEnd(28)} ${String(got).padEnd(18)} ${ok ? 'ok' : `MISMATCH (want ${want})`}`);
};
const cur = () => page.evaluate(() => window.__LAO__.getAudio().bgmTrack);
await page.mouse.click(5, 5);
await page.waitForTimeout(300);
check('title', await cur(), BGM_TABLE.title);
await page.click('#btn-start');
await page.waitForSelector('.char-card');
// Move the highlight with the arrow keys (a click launches the sortie).
const highlight = async (key) => {
  for (let i = 0; i < 8; i++) {
    if (await page.evaluate(() => document.querySelector('.char-card.selected')?.dataset.key) === key) return;
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
  }
};
for (const key of ['griffin', 'sleipnir', 'express76']) {
  await highlight(key);
  await page.waitForTimeout(150);
  check(`select ${key}`, await cur(), BGM_TABLE.select);
}
for (const key of ['labiata', 'lrl', 'constantia', 'peregrinus']) {
  await page.evaluate((k) => window.__LAO__.applySelectCheat(k), key);
  await page.waitForTimeout(400);
  check(`select ${key} (cheat)`, await cur(), BGM_TABLE.select);
}
await page.evaluate(() => window.__LAO__.applySelectCheat('lrl'));
await page.waitForTimeout(300);
check('select lrl before sortie', await cur(), BGM_TABLE.select);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const res = await page.evaluate(async (BGM_T) => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame(); const out = [];
  for (let i = 0; i < g.stages.length; i++) { try { await g.assets.bank.ensureStage(i); } catch { /* */ } }
  const st = () => g.audio.bgmTrack;
  for (let s = 0; s < g.stages.length; s++) {
    g.enemies.length = 0; g.bullets.clearEnemy(); g.boss = null;
    g.stageIndex = s; g._beginStageSegment(s); g.stagePhase = 'waves'; g.update(1 / 60);
    out.push([`stage ${s + 1} waves`, st(), 'stage', s]);
    g.stagePhase = 'mid-windup'; g.update(1 / 60); out.push([`stage ${s + 1} midboss`, st(), 'mid', s]);
    g.stagePhase = 'mid-recover'; g.update(1 / 60); out.push([`stage ${s + 1} after midboss`, st(), 'stage', s]);
    g.stagePhase = 'boss-windup'; g.update(1 / 60); out.push([`stage ${s + 1} boss`, st(), 'boss', s]);
  }
  // Streamability of every table stem (canPlayType + metadata load).
  const stems = [...new Set([BGM_T.title, BGM_T.select, BGM_T.gameover, ...BGM_T.stages, ...Object.values(BGM_T.leaders), ...Object.values(BGM_T.pilots)])];
  const loads = await Promise.all(stems.map((s) => new Promise((res) => {
    const a = new Audio(`assets/audio/bgm/${s}.ogg`);
    a.addEventListener('loadedmetadata', () => res([s, +a.duration.toFixed(1)]), { once: true });
    a.addEventListener('error', () => res([s, 0]), { once: true });
  })));
  return { out, loads, stages: g.stages.map((x) => [x.mid, x.boss]) };
}, BGM_TABLE).catch((e) => ({ err: String(e) }));
if (res.err) { console.log(res.err); process.exit(1); }
for (const [label, got, kind, s] of res.out) {
  const [mid, boss] = res.stages[s];
  const want = kind === 'stage' ? BGM_TABLE.stages[s] : BGM_TABLE.leaders[kind === 'mid' ? mid : boss];
  check(`${label} (${kind === 'stage' ? 'battle' : kind === 'mid' ? mid : boss})`, got, want);
}
for (const [s, dur] of res.loads) {
  if (!(dur > 10)) { bad += 1; console.log('NOT STREAMABLE', s); } else console.log(`stream ${s.padEnd(18)} ${dur}s  <- ${BGM_SOURCES[s]}`);
}
if (errs.length) { bad += 1; console.log('ERR', errs[0]); }
await browser.close();
console.log(bad ? `FAIL ${bad}` : 'PASS');
