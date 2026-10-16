// Voice timing check: for each roster pilot, fire the special (C) and the bomb (X), then a
// miss, stepping the game at 60 fps. Records every original voice clip with the animation
// state / clip time it started at, compares it with js/voice-events.js and checks that the
// clips decode. usage: node tools/test-voice-timing.mjs
import { chromium } from 'playwright';
import { VOICE_EVENTS, VOICE_ACTIONS } from '../js/voice-events.js';

const PILOTS = (process.env.PILOTS || 'griffin,sleipnir,express76,constantia,lrl,labiata,peregrinus').split(',');
const browser = await chromium.launch();
let bad = 0;
for (const pilot of PILOTS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: false, bgmVolume: 0, sfxVolume: 0.5, autoFire: false }));
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await page.goto('http://localhost:5188/?cb=vt' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start');
  await page.waitForSelector('.char-card');
  // Base roster: click its card; hidden kits: the select cheat.
  const card = page.locator(`.char-card[data-key="${pilot}"], .char-card[data-char="${pilot}"]`);
  if (await card.count()) await card.first().click();
  else await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot);
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  await page.evaluate(([lv, act]) => { globalThis.__LV__ = lv; window.__ACT__ = act; }, [Number(process.env.LV || 3), VOICE_ACTIONS[pilot] || {}]);
  const res = await page.evaluate(async () => {
    window.requestAnimationFrame = () => 0;
    const g = window.__LAO__.getGame(); const p = g.player;
    const log = [];
    // Clip time at the moment the animation clock fires the voice, and that it reaches audio.
    let played = 0;
    const orig = g.audio.playClip.bind(g.audio);
    // Action voices (C / X cast clock): seconds since the successful cast.
    // Death voices are timed from the miss (the respawn may cut the die clip short).
    let dieAt = 0;
    const hit0 = p.hit.bind(p);
    p.hit = (...a) => { const r = hit0(...a); if (r) dieAt = frame; return r; };
    const actionStems = new Set(Object.values(window.__ACT__ || {}).flat().map((e) => e[1]));
    let castAt = 0; let castKind = ''; let frame = 0; const actionLog = [];
    const sav = p.startActionVoice.bind(p);
    p.startActionVoice = (kind) => { castAt = frame; castKind = kind; return sav(kind); };
    g.audio.playClip = (stem, gain) => {
      if (stem.startsWith('vo_')) {
        played += 1;
        if (actionStems.has(stem)) actionLog.push({ stem, kind: castKind, dt: +((frame - castAt) / 60).toFixed(3), phase: log.phase, form: p.inHumanForm ? 'human' : '' });
      }
      return orig(stem, gain);
    };
    const hook = p.anim.onVoice;
    const wrap = (anim) => {
      const h = anim?.onVoice;
      // Logged only when the pilot actually queues it (form-swap repeats are dropped).
      if (h) anim.onVoice = (stem, state, ev) => { const n = (p.fxEvents || []).length; h(stem, state, ev); if ((p.fxEvents || []).length > n) log.push({ stem, state, t: +(state === 'die' ? (frame - dieAt) / 60 : anim.time).toFixed(3), phase: log.phase, frame }); };
    };
    wrap(p.anim); wrap(p._altAnim);
    // Quiet field: no stage spawns or enemy fire, so only the scripted miss kills.
    g._updateStageFlow = () => {};
    const step = (n) => { for (let i = 0; i < n; i++) { frame += 1; g.enemies.length = 0; g.bullets.clearEnemy(); g.update(1 / 60); } };
    const press = (k) => { g._keyInput[k] = true; g._syncMergedInput(); step(2); g._keyInput[k] = false; g._syncMergedInput(); };
    step(30);
    g.enemies.length = 0;
    log.phase = 'special'; p.sp = p.spCost * Number(globalThis.__LV__ || 3); press('special'); step(60 * 11);
    log.pilot = p.charKey;
    log.phase = 'bomb'; p.bombs = 3; p.invuln = 0; press('bomb'); step(60 * 12);
    // Miss once the bomb / skill clip is over (a running X keeps the ship invulnerable).
    const busy = () => p.bombRun || p.skillRun || p.hBomb || p._bombAnimLock > 0 || p.changing > 0 || p.reverting > 0;
    for (let i = 0; i < 60 * 15 && busy(); i++) step(1);
    log.phase = 'die'; log.dieForm = p.inHumanForm ? 'human' : 'base'; p.invuln = 0; p.bombs = 0; p.lives = 3;
    p.hit?.(); step(60 * 4);
    if (p.charKey === 'peregrinus') {
      // Second miss in the human form (alternate animator).
      for (let i = 0; i < 60 * 4 && p.isRespawning; i++) step(1);
      p.invuln = 0; p.sp = p.spMax; log.phase = 'special'; press('special');
      for (let i = 0; i < 60 * 6 && !p.inHumanForm; i++) step(1);
      step(30); p.invuln = 0; log.phase = 'die'; log.dieForm += '+' + (p.inHumanForm ? 'human' : 'base');
      p.hit?.(); step(60 * 4);
    }
    // Decode check of every voice clip this pilot uses.
    const stems = [...new Set([...log.map((l) => l.stem), ...actionLog.map((l) => l.stem)])];
    const decoded = await Promise.all(stems.map(async (s) => !!(await g.audio.preloadClip(s))));
    return { log, actionLog, stems, decoded, pilot: log.pilot, played, dieForm: log.dieForm };
  });
  const exp = VOICE_EVENTS[pilot] || {};
  if (res.pilot !== pilot) { bad += 1; console.log('  WRONG PILOT', res.pilot); }
  console.log(`== ${pilot}  ${errs.length ? 'ERR ' + errs[0] : ''}`);
  for (const l of res.log) {
    const list = exp[l.state] || [];
    // Fired on the frame that crossed the event: clip time within one frame (+ remap step).
    const m = list.find(([t, s]) => s === l.stem && l.t >= t - 1e-3 && l.t - t < 0.06);
    if (!m) bad += 1;
    console.log(`  ${l.phase.padEnd(7)} ${l.state.padEnd(6)} t=${l.t.toFixed(3)} ${l.stem}  ${m ? `ok (orig ${m[0]})` : 'MISMATCH'}`);
  }
  const acts = VOICE_ACTIONS[pilot] || {};
  for (const a of res.actionLog) {
    // Played on the drain after the cast frame: within one frame of the listed offset.
    const m = (acts[a.kind] || []).find(([t, s]) => s === a.stem && Math.abs(a.dt - t) <= 0.034);
    if (!m) bad += 1;
    console.log(`  ${a.phase.padEnd(7)} cast:${a.kind.padEnd(7)} +${a.dt.toFixed(3)}s ${a.stem}  ${m ? `ok (orig +${m[0]})` : 'MISMATCH'}`);
  }
  for (const [kind, list] of Object.entries(acts)) {
    for (const [, stem] of list) if (!res.actionLog.some((a) => a.stem === stem)) { bad += 1; console.log('  NOT PLAYED', kind, stem); }
  }
  for (const [state, list] of Object.entries(VOICE_EVENTS[pilot] || {})) {
    if (state === 'attack') continue;
    for (const [, stem] of list) if (!res.log.some((l) => l.stem === stem) && !(state === 'skill1' && pilot === 'lrl')) console.log('  (not flown this run)', state, stem);
  }
  console.log('  died in form:', res.dieForm);
  if (res.played !== res.log.length + res.actionLog.length) { bad += 1; console.log('  queued', res.log.length + res.actionLog.length, 'played', res.played); }
  res.stems.forEach((s, i) => { if (!res.decoded[i]) { bad += 1; console.log('  NOT DECODED', s); } });
  await page.close();
}
await browser.close();
console.log(bad ? `FAIL ${bad}` : 'PASS');
