// Effect-quality capture: spawns each visual effect in isolation on a flat backdrop
// (window.__FX_FLATBG__), steps the game and screenshots the effect's region over its life.
// Writes <outDir>/manifest.json + frame PNGs for tools/score-fx.py.
// usage: node tools/eval-fx.mjs <outDir> [group,...]   groups: common, hazards, <pilot keys>
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = process.argv[2];
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

// cat: burst (explosions / hits), beam (area hazards), projectile (shots in flight),
// skill (C / X runs, full field), ui (popups / pickups).
// region: [cx, cy, w, h] in logical game px; dur: seconds sampled; setup runs in the page with
// g (game), p (player), A (assets), H (hazard module), boss (a frozen stage-1 boss) in scope.
const COMMON = [
  { name: 'hit_spark', cat: 'burst', region: [480, 270, 160, 160], dur: 0.3, setup: 'g.fx.hitSpark(480, 270, 6); g.fx.noteHit(480, 270);' },
  { name: 'enemy_explosion', cat: 'burst', region: [480, 270, 240, 240], dur: 0.7, setup: 'g.fx.explosion(480, 270, 1);' },
  { name: 'boss_explosion', cat: 'burst', region: [480, 270, 400, 400], dur: 0.9, setup: 'g.fx.explosion(480, 270, 2.2);' },
  { name: 'player_hit', cat: 'burst', region: [480, 270, 260, 260], dur: 0.5, setup: 'g.fx.notePlayerHit(480, 270);' },
  { name: 'graze_spark', cat: 'burst', region: [480, 270, 110, 110], dur: 0.35, setup: 'g.fx.grazeSpark(480, 270);' },
  { name: 'wipe_sparks', cat: 'burst', region: [480, 270, 160, 120], dur: 0.35, setup: 'for (let i = 0; i < 6; i++) g.fx.wipeSpark(450 + i * 12, 260 + (i % 3) * 10);' },
  { name: 'missile_airboom', cat: 'burst', region: [480, 270, 200, 200], dur: 0.5, setup: "g._spawnSheetFx('lao-fx-airboom', 480, 270, 120, 0.42);" },
  { name: 'legacy_burst', cat: 'burst', region: [480, 270, 220, 220], dur: 0.7, setup: 'g._spawnBurst(480, 270, 12);' },
  { name: 'score_popup', cat: 'ui', region: [480, 250, 220, 120], dur: 1.0, setup: 'g.fx.scorePopup(480, 270, 1200, { combo: 3 });' },
  { name: 'pickup_power', cat: 'ui', region: [480, 260, 260, 220], dur: 0.9, player: [480, 270], setup: "g.pickupFx.spawn('power', 480, 270);" },
  { name: 'pickup_bomb', cat: 'ui', region: [480, 260, 260, 220], dur: 0.9, player: [480, 270], setup: "g.pickupFx.spawn('bomb', 480, 270);" },
  { name: 'enemy_orb', cat: 'projectile', region: [480, 270, 300, 90], dur: 0.3, setup: 'for (let i = 0; i < 5; i++) g.bullets.spawn({ x: 400 + i * 40, y: 270, vx: 0, vy: 0, r: 6, friendly: false });' },
  { name: 'enemy_orb_tinted', cat: 'projectile', region: [480, 270, 300, 90], dur: 0.3, setup: "for (let i = 0; i < 5; i++) g.bullets.spawn({ x: 400 + i * 40, y: 270, vx: 0, vy: 0, r: 6, friendly: false, tint: '#b88cff', color: '#b88cff' });" },
  { name: 'leader_death', cat: 'skill', region: [480, 270, 960, 540], dur: 2.6, frames: 16, leader: true, setup: 'boss.x = 700; boss.y = 270; boss.damage(1e9);' },
];
const hz = (o) => `H.addHazard(boss, ${JSON.stringify(o)});`;
const HAZARDS = [
  { name: 'hz_beam', cat: 'beam', region: [480, 270, 960, 180], dur: 1.4, setup: hz({ kind: 'beam', x: 860, y: 270, ang: Math.PI, len: 900, width: 26, warn: 0.6, life: 0.5, color: '#ff7ad9' }) },
  { name: 'hz_bolt', cat: 'beam', region: [480, 270, 220, 540], dur: 1.1, setup: hz({ kind: 'bolt', x0: 480, y0: -10, x1: 480, y1: 550, width: 20, warn: 0.6, life: 0.22, color: '#b88cff' }) },
  { name: 'hz_meteor', cat: 'beam', region: [560, 230, 560, 460], dur: 1.4, setup: hz({ kind: 'meteor', x: 480, y: 300, r: 44, warn: 0.9, life: 0.2, fx: 740, fy: -80, color: '#ff9a3c', color2: '#ff5a5a' }) },
  { name: 'hz_spike', cat: 'beam', region: [480, 270, 200, 220], dur: 1.1, setup: hz({ kind: 'spike', x: 480, y: 300, r: 26, warn: 0.5, life: 0.35, color: '#7fe7ff', color2: '#ffffff' }) },
  { name: 'hz_cone', cat: 'beam', region: [480, 270, 960, 400], dur: 2.4, setup: hz({ kind: 'cone', x: 860, y: 270, ang: Math.PI, half: 0.17, len: 760, warn: 0.9, life: 1.0, color: '#ff9a3c', color2: '#ffd24a' }) },
  { name: 'hz_column', cat: 'beam', region: [480, 330, 140, 420], dur: 1.1, setup: hz({ kind: 'column', x: 480, w: 48, top: 180, warn: 0.6, life: 0.35, color: '#c98b4a', color2: '#ffd24a' }) },
  { name: 'hz_sigil', cat: 'beam', region: [480, 260, 220, 300], dur: 1.4, setup: hz({ kind: 'sigil', x: 480, y: 290, r: 54, warn: 0.9, life: 0.35, color: '#b88cff', color2: '#ff5a5a' }) },
  { name: 'hz_girder', cat: 'beam', region: [480, 270, 160, 540], dur: 1.2, setup: hz({ kind: 'bolt', style: 'girder', x0: 480, y0: -10, x1: 480, y1: 550, width: 30, warn: 0.75, life: 0.3, color: '#ffd24a' }) },
  { name: 'hz_tape', cat: 'beam', region: [480, 270, 960, 120], dur: 1.3, setup: hz({ kind: 'bolt', style: 'tape', x0: -10, y0: 270, x1: 970, y1: 270, width: 22, warn: 0.85, life: 0.3, color: '#ffd24a' }) },
  { name: 'hz_swoop', cat: 'beam', region: [480, 270, 960, 160], dur: 1.3, setup: hz({ kind: 'bolt', style: 'swoop', x0: -10, y0: 270, x1: 970, y1: 270, width: 62, warn: 0.8, life: 0.32, color: '#ffd24a', color2: '#fff4c8' }) },
  { name: 'mortar_mark', cat: 'beam', region: [480, 270, 160, 160], dur: 0.9, setup: "(boss.marks ||= []).push({ x: 480, y: 270, r: 46, t: 0, warn: 0.9, color: '#ff9a3c' }); boss.__markTick = true;" },
];
// Per pilot: basic shot (Lv5), sub weapon, special (C Lv3), bomb (X).
const pilotSpecs = (pk) => [
  { name: `${pk}_shot`, cat: 'projectile', region: [440, 270, 600, 220], dur: 0.6, player: [140, 270], fire: 'shoot', setup: 'p.shotLevel = 5;' },
  { name: `${pk}_sub`, cat: 'projectile', region: [460, 270, 680, 320], dur: 0.9, player: [140, 270], fire: 'sub', setup: 'p.shotLevel = 5;' },
  { name: `${pk}_special`, cat: 'skill', region: [480, 270, 960, 540], dur: 3.0, frames: 14, player: [200, 270], targets: true, setup: 'p.sp = p.spCost * 3; if (p.trySpecial(g.bullets)) g._onSpecialFired();' },
  { name: `${pk}_bomb`, cat: 'skill', region: [480, 270, 960, 540], dur: 4.0, frames: 16, player: [200, 270], targets: true, setup: 'p.bombs = 9; if (p.tryBomb(g.bullets)) g._onBombFired();' },
];
// Rampalion (hidden pilot): fully fused (all four part slots, `pre`: before the baseline shot, so
// the parts are not counted as the effect) so the part guns fire with the shot; C is captured at
// every level (Lv1 skill_1 lance / arm, Lv2 Breast Lion, Lv3 Shining Hand).
// RAMP_RAND=0..1 picks a fixed part combination (default: random).
const RAMP_RAND = process.env.RAMP_RAND ? `() => ${Number(process.env.RAMP_RAND)}` : 'Math.random';
const RAMP_FUSE = `const R = window.__RM; while (R.rampFuse(p, ${RAMP_RAND})) {} ` + 'p._ramp.slots.forEach((e) => { e.attached = true; e.cd = 0; }); p._ramp.docks.length = 0; p._ramp.fuseFlash = 0;';
const rampalionSpecs = () => [
  // fire 'both': the main shot plus fireSubWeapon (the part guns), as in play.
  { name: 'rampalion_shot', cat: 'projectile', region: [440, 270, 600, 220], dur: 0.6, player: [140, 270], fire: 'both', pre: RAMP_FUSE, setup: 'p.shotLevel = 5;' },
  ...[1, 2, 3].map((lv) => ({ name: lv === 3 ? 'rampalion_special' : `rampalion_special${lv}`, cat: 'skill', region: [480, 270, 960, 540],
    dur: lv === 3 ? 4.0 : 2.8, frames: 14, player: [200, 270], targets: true,
    pre: RAMP_FUSE, setup: `p.sp = p.spCost * ${lv} + 0.01; if (p.trySpecial(g.bullets)) g._onSpecialFired();` })),
  { name: 'rampalion_bomb', cat: 'skill', region: [480, 270, 960, 540], dur: 5.0, frames: 16, player: [200, 270], targets: true, pre: RAMP_FUSE, setup: 'p.bombs = 9; if (p.tryBomb(g.bullets)) g._onBombFired();' },
];
const GROUPS = { common: COMMON, hazards: HAZARDS, rampalion: rampalionSpecs() };
for (const pk of ['griffin', 'sleipnir', 'express76', 'constantia', 'labiata', 'lrl', 'peregrinus']) {
  // LRL has no sub weapon (her charge axe is the C kit); skip that capture.
  GROUPS[pk] = pilotSpecs(pk).filter((sp) => !(pk === 'lrl' && sp.fire === 'sub'));
}

const browser = await chromium.launch();
const manifest = { effects: [] };
const groups = ONLY.length ? ONLY : Object.keys(GROUPS);
for (const grp of groups) {
  const pilot = GROUPS.common === GROUPS[grp] || grp === 'hazards' ? 'griffin' : grp;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ v: 4, muted: true, autoFire: false })); // auto-fire is on by default now (v: skip the touch-device migration)
    localStorage.setItem('lao_mini_tutorial_seen', '1');
    window.__FX_FLATBG__ = true;
  });
  await page.goto('http://localhost:5188/?cb=fx' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  await page.click('#btn-start'); await page.waitForSelector('.char-card'); await page.waitForTimeout(300);
  if (pilot === 'sleipnir' || pilot === 'express76') {
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => document.querySelector('.char-card.selected')?.dataset.key) === pilot) break;
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
    }
  } else if (pilot !== 'griffin') {
    await page.evaluate((k) => window.__LAO__.applySelectCheat(k), pilot);
    await page.waitForTimeout(2500);
  }
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  await page.addStyleTag({ content: '#hud, #boss-bar, #touch-controls { display: none !important; }' });
  await page.evaluate(async () => {
    window.requestAnimationFrame = () => 0;
    const g = window.__LAO__.getGame();
    g._updateStageFlow = () => {}; g._resolveStageLeader = () => {};
    g.stageIntro = 0;
    for (let i = 0; i < 30; i++) g.update(1 / 60);
    window.__H = await import('/js/leader-hazards.js');
    window.__RM = await import('/js/rampalion.js');
  });
  for (const spec of GROUPS[grp]) {
    const frames = spec.frames || 12;
    // Reset the field and park the ship.
    await page.evaluate(async (spec) => {
      const g = window.__LAO__.getGame(); const p = g.player;
      g.enemies.length = 0; g.bullets.list.forEach((b) => { b.alive = false; });
      g.boss = null; g.stageIntro = 0;
      p.godMode = true; p.invuln = 99;
      const [px, py] = spec.player || [-200, -200];
      p.x = px; p.y = py;
      window.__boss = null;
      if (spec.leader || spec.name.startsWith('hz_') || spec.name === 'mortar_mark') {
        await g.assets.bank.ensureEnemy('boss_hachiko');
        g._spawnStageLeader('boss_hachiko', 'boss', 1e7, 0);
        const b = g.boss;
        b.x = spec.leader ? 700 : 1400; b.y = 270; b.script.tick = () => {};
        if (spec.name === 'mortar_mark') b.x = 1400;
        window.__boss = b;
      }
      if (spec.targets) {
        await g.assets.bank.ensureEnemy('boss_hachiko');
        g._spawnStageLeader('boss_hachiko', 'boss', 1e7, 0);
        g.boss.x = 760; g.boss.y = 270; g.boss.script.tick = () => {};
      }
      // spec.pre: state that belongs in the baseline (e.g. Rampalion's fused parts).
      // eslint-disable-next-line no-new-func
      if (spec.pre) new Function('g', 'p', spec.pre)(g, p);
      for (let i = 0; i < 20; i++) g.update(1 / 60);
      g.fx.clear?.(); g.pickupFx?.clear?.();
      g.draw();
    }, spec);
    const clip = await page.evaluate((r) => {
      const c = document.getElementById('game').getBoundingClientRect();
      const W = Number(getComputedStyle(document.documentElement).getPropertyValue('--game-w')) || 960;
      const s = c.width / W;
      const x = Math.max(0, c.left + (r[0] - r[2] / 2) * s); const y = Math.max(0, c.top + (r[1] - r[3] / 2) * s);
      return { x, y, width: Math.min(r[2] * s, c.right - x), height: Math.min(r[3] * s, c.bottom - y) };
    }, spec.region);
    const files = [];
    const base = path.join(OUT, `${spec.name}_base.png`);
    await page.screenshot({ path: base, clip });
    await page.evaluate((spec) => {
      const g = window.__LAO__.getGame(); const p = g.player; const A = window.__LAO__.getAssets();
      const H = window.__H; const boss = window.__boss;
      // eslint-disable-next-line no-new-func
      new Function('g', 'p', 'A', 'H', 'boss', spec.setup)(g, p, A, H, boss);
    }, spec);
    const stepFrames = Math.max(1, Math.round((spec.dur / frames) * 60));
    for (let k = 0; k < frames; k++) {
      await page.evaluate(([spec, n]) => {
        const g = window.__LAO__.getGame(); const p = g.player; const boss = window.__boss;
        for (let i = 0; i < n; i++) {
          p.invuln = 99;
          if ((spec.fire === 'shoot' || spec.fire === 'both') && i % 6 === 0) { p.fireCooldown = 0; p.shoot(g.bullets); }
          if (spec.fire === 'sub' && i % 10 === 0) { p._subCd = 0; p.fireSubWeapon(g.bullets); }
          if (spec.fire === 'both' && i % 6 === 0) p.fireSubWeapon(g.bullets);
          // Mortar marks: the shell lands at warn (the mortar attack's controller removes it).
          if (boss?.__markTick) {
            for (const m of boss.marks || []) m.t += 1 / 60;
            if (boss.marks?.length && boss.marks[0].t >= boss.marks[0].warn) { const m = boss.marks.shift(); g.fx.explosion(m.x, m.y, 0.9); }
          }
          g.update(1 / 60);
        }
        g.draw();
      }, [spec, stepFrames]);
      const f = path.join(OUT, `${spec.name}_${String(k).padStart(2, '0')}.png`);
      await page.screenshot({ path: f, clip });
      files.push(path.basename(f));
    }
    manifest.effects.push({ name: spec.name, cat: spec.cat, dt: stepFrames / 60, base: path.basename(base), frames: files });
    console.log('captured', spec.name, errs.length ? 'ERR ' + errs[errs.length - 1] : '');
  }
  await page.close();
}
await browser.close();
const mp = path.join(OUT, 'manifest.json');
const prev = fs.existsSync(mp) && ONLY.length ? JSON.parse(fs.readFileSync(mp, 'utf8')).effects.filter((e) => !manifest.effects.some((n) => n.name === e.name)) : [];
manifest.effects = [...prev, ...manifest.effects];
fs.writeFileSync(mp, JSON.stringify(manifest, null, 1));
