// Labiata (3P_Labiata_N) skills as runs (skill-run.js), from Unity Char_3P_Labiata_N.
//
// C = skill1.anim (6.17s, anim_skill1): EventMoveMotionStart 0.95-1.48s carries her to
// the target (the clip itself stays in place), then three strikes: battery-bag bash
// (EventHit Labiata_skill1_bag_hit 2.10s), first blade (hit_first 2.93s) and the big
// blade (Labiata_skill1_hit 4.02s, + blue battery sparks), MoveMotionBack 5.02-5.63s.
// X = skill2.anim (11.5s, anim_skill2): sword transformation (battery set, blade-in
// particles/aura, swing, up smoke, wind aura), jump out of frame (ch_root +38.6 units at
// 6.9-7.02s, jump_up_smoke, shake 0.6), MoveMotion while airborne, slam down
// (EventHit Labiata_skill2_hit 9.15s, shake 1.5) with skill2_ground_attack across the
// field (rocks, ground bomb, deco, smoke) and the final burst, then back home.
// FX: original textures (tools/import-labiata-fx.py) placed at the original FX objects'
// rig positions (js/labiata-fx-anchors.js); frames carry the clip's own root motion
// (skillCamera). SFX: original clips.
import { W, H } from './canvas.js';
import { bloom, drawSheetAt, clamp01, sampleKeys } from './run-fx.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { spawnFx, spawnShot, cameraEvent, cameraStop, sfxEvent, runPos, liveTargets } from './skill-run.js';
import { FX_ANCHORS } from './labiata-fx-anchors.js';

const ease = (k) => k * k * (3 - 2 * k);

/** Screen px per idle bake px for her sprite (ClipAnimator maps the contentBox to drawSize). */
function screenScale(p) {
  const b = p.anim._box;
  return b ? p.drawSize / Math.max(b.w, b.h) : 1;
}

/**
 * Where an original FX object sits on screen when her body is drawn at q: FX_ANCHORS holds
 * the FX transform's world position from the posed rig at that clip time, in idle bake px
 * (tools/skill-camera-and-fx.py), mapped exactly like ClipAnimator maps her frames.
 */
function anchorAt(p, q, clip, label) {
  const a = FX_ANCHORS[clip]?.[label];
  const b = p.anim._box;
  if (!a || !b) return { x: q.x, y: q.y };
  const sc = screenScale(p);
  return {
    x: q.x + p.drawOffsetX - (b.w * sc) / 2 + (a[0] - b.x) * sc,
    y: q.y + p.drawOffsetY - (b.h * sc) / 2 + (a[1] - b.y) * sc,
  };
}
const fxAt = (p, r, clip, label) => anchorAt(p, runPos(p, r), clip, label);

// ------------------------------------------------------------------ C (skill1)
// She attacks on the spot (no MoveMotion dash to the target): the run rides on the ship and
// the strikes land on the target. The level picks how many swings play: Lv3 starts at the
// end of the dash lead-in (all three), Lv2 just before the second swing, Lv1 just before the
// big one (start frames chosen closest to her settled pose).
const C_STARTS = [1.5, 1.5, 2.75, 3.3333];
const cStart = (level) => C_STARTS[Math.max(1, Math.min(3, 4 - level))];
// Ends at 5.0s: the clip's step back (5.02-5.63s) is skipped; her pose at 5.0s already
// matches the settled end pose.
const C_END = 5.0;
// The clip's three swings (EventHit times).
const C_HITS = [[2.1, 0.25, 'bag'], [2.9333, 0.25, 'blade'], [4.0167, 0.5, 'big']];
// Waves follow the swings that play, in order: Lv1 the fan only, Lv2 fan + big wave,
// Lv3 fan + big + giant. Damage share per played swing (same totals 6/12/18).
const C_SHARES = { 1: [1], 2: [1 / 3, 2 / 3], 3: [0.25, 0.25, 0.5] };

/**
 * Sword wave: the blade crescent (labiata-fx-blade frame 0) turned to face forward, flying
 * from (sx, sy) at angle `ang` until it leaves the screen. Hits each enemy once on contact.
 */
function swordWave(r, sx, sy, ang, { size, speed, dmg, big = false, delay = 0 }) {
  const dist = W + size - sx;
  const tx = sx + Math.cos(ang) * dist;
  const ty = sy + Math.sin(ang) * dist;
  spawnShot(r, {
    sx, sy, tx, ty, flight: dist / speed, hitSet: new Set(), wait: delay,
    tick(rr, s) {
      if (s.age < s.wait) return;
      // The crescent fills ~54% of the cell's width (its height on screen) and sits slightly
      // ahead of the centre; the hit box follows the art.
      const cx = s.x + size * 0.07;
      const reachX = size * 0.14;
      const reachY = size * 0.3;
      for (const e of liveTargets(rr.enemies)) {
        if (e.dying || s.hitSet.has(e)) continue;
        const er = e.hitR || 20;
        if (Math.abs(e.x - cx) > reachX + er || Math.abs(e.y - s.y) > reachY + er) continue;
        s.hitSet.add(e);
        rr.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: dmg });
        const fs = big ? 1.5 : 0.9;
        spawnFx(rr, { key: 'labiata-fx-hit', x: e.x, y: e.y, w: 170 * fs, h: 170 * fs, dur: 0.45 });
        if (big) spawnFx(rr, { dur: 0.12, draw: (ctx, k) => bloom(ctx, e.x, e.y, 120, 90, 1 - k, 'cyan') });
      }
      // The sword wave cuts enemy projectiles it passes through (user). Beams / lasers
      // (beamLength) and leader hazards (flame cones, laser lines: not bullets) stay.
      let sparks = 0;
      for (const b of rr.bullets?.list || []) {
        if (!b.alive || b.friendly || b.delay > 0 || b.beamLength > 0) continue;
        const br = b.r || 4;
        if (Math.abs(b.x - cx) > reachX + br || Math.abs(b.y - s.y) > reachY + br) continue;
        b.alive = false;
        if (sparks++ < 6) {
          const bx = b.x, by = b.y;
          spawnFx(rr, { dur: 0.22, draw: (ctx, k) => bloom(ctx, bx, by, 26, 26, 1 - k, 'cyan') });
        }
      }
    },
    draw(ctx, s) {
      if (s.age < s.wait) return;
      const fade = Math.min(1, (s.age - s.wait) / 0.06);
      const w = size * 0.62;
      // Rotated -90deg, so the cell's width spans the wave's height. Glow pass, then the
      // crisp crescent (convex side forward).
      drawSheetAt(ctx, 'labiata-fx-blade', 0, s.x - w * 0.18, s.y, size * 1.15, w * 1.25,
        { rot: ang - Math.PI / 2, alpha: 0.35 * fade });
      drawSheetAt(ctx, 'labiata-fx-blade', 0, s.x, s.y, size, w, { rot: ang - Math.PI / 2, alpha: fade });
      if (big) bloom(ctx, s.x + w * 0.1, s.y, size * 0.35, size * 0.5, 0.35 * fade, 'cyan');
    },
  });
}

export const LABIATA_C = {
  clip: 'skill1', duration: C_END, y0: 0, path: [[0, 0, 0], [C_END, 0, 0]],
  targeted: true, reachX: 30, defaultReach: 360, followShip: true, startAt: cStart,
  // Whole clip 1.5x faster (no i-frames: followShip runs keep her hittable).
  speed: 1.5,
  // The run ends with the clip; waves still in flight carry on while she shoots again.
  detachShots: true,
  timeline(run) {
    const list = [];
    // skill1 camera: "0.2,0,0,20" (1.5s), "0.05,0,0,21/26/28" on each strike, stop 5.0s.
    const zoomIn = cameraEvent(1.5, 0.2, 20);
    list.push(zoomIn, cameraEvent(2.0833, 0.05, 21), cameraEvent(2.9167, 0.05, 26),
      cameraEvent(3.95, 0.05, 28), cameraStop(4.85, 0.35));
    // char_10_skill1 shouts (2.02 / 2.93 / 3.98s) play from the skill1 clip clock (js/voice-events.js).
    const at = (t, label, fx) => list.push({ t, do: (r, p) => {
      const a = fxAt(p, r, 'skill1', label);
      spawnFx(r, { x: a.x, y: a.y, ...fx });
    } });
    // Battery bag lighting (Labiata_buff_lighting_FX 2.07 / 2.90 / 3.43 / 3.88s).
    [2.0667, 2.9, 3.4333, 3.8833].forEach((t, i) =>
      at(t, 'baglight' + (i + 1), { key: 'labiata-fx-baglight', w: 110, h: 110, dur: 0.6 }));
    // Blades: Labiata_skill1_blade1 (2.03s), skill2_blade2 (2.92s), skill1_blade3 (3.93s).
    const blade = (t, label, scale, rot) => list.push({ t, do: (r, p) => {
      const b = fxAt(p, r, 'skill1', label);
      spawnFx(r, { key: 'labiata-fx-blade', x: b.x, y: b.y, w: 210 * scale, h: 160 * scale, dur: 0.4, rot });
      spawnFx(r, { key: 'labiata-fx-bladedeco', x: b.x, y: b.y, w: 170 * scale, h: 170 * scale, dur: 0.25 });
    } });
    blade(2.0333, 'blade1', 0.8, -0.2);
    blade(2.9167, 'blade2', 1.15, 0.25);
    blade(3.9333, 'blade3', 1.5, -0.1);
    // Strikes: sword waves (검기) leave the blade and fly forward. The first played swing
    // throws a fan of three, the second one big wave, the third a giant one. Each wave hits
    // every enemy it passes once.
    const lv = Math.max(1, Math.min(3, run.level));
    const played = C_HITS.slice(3 - lv);
    played.forEach(([t, , kind], order) => list.push({ t, do: (r, p) => {
      const dmg = lv * 6 * C_SHARES[lv][order];
      const b = fxAt(p, r, 'skill1', kind === 'bag' ? 'blade1' : kind === 'blade' ? 'blade2' : 'blade3');
      const q = runPos(p, r);
      const sx = Math.max(q.x + 30, b.x);
      r.events.push({ type: 'hitstop', t: order === 2 ? 0.08 : 0.05 });
      if (order === 2) {
        // Last swing: a giant wave spanning (almost) the whole field height.
        swordWave(r, sx, H / 2, 0, { size: 960, speed: 640, dmg, big: true });
      } else if (order === 1) {
        swordWave(r, sx, q.y, 0, { size: 430, speed: 760, dmg, big: true });
      } else {
        [-0.16, 0, 0.16].forEach((a, n) =>
          swordWave(r, sx, q.y + (n - 1) * 62, a * 0.6, { size: 130, speed: 1050, dmg: dmg / 3, delay: n * 0.04 }));
      }
    } }));
    // EventCameraShake 0.4 (2.03s), 0.8 (2.97s), 1.0 (3.97s).
    [[2.0333, 0.4], [2.9667, 0.8], [3.9667, 1.0]].forEach(([t, mag]) =>
      list.push({ t, do: (r) => r.events.push({ type: 'shake', mag }) }));
    // smoke2 (3.05s) / smoke4 (4.12s) under the strikes.
    at(3.05, 'smoke2', { key: 'labiata-fx-smoke2', w: 160, h: 160, dur: 0.4, blend: 'source-over', alpha: 0.85,
      layer: 'under' });
    at(4.1167, 'smoke4', { key: 'labiata-fx-smoke4', w: 260, h: 200, dur: 0.4, blend: 'source-over', alpha: 0.85,
      layer: 'under' });
    // Labiata_buff_skill1_hit2 sparks on the gauntlet (4.18 / 4.37 / 4.57 / 4.78s).
    [4.1833, 4.3667, 4.5667, 4.7833].forEach((t, i) =>
      at(t, 'spark' + (i + 1), { key: 'labiata-fx-spark', w: 120, h: 120, dur: 0.2 }));
    // Swings before the level's start are skipped; the opening zoom moves to the start.
    const t0 = cStart(run.level);
    return list.filter((e) => e.t >= t0 || e === zoomIn).map((e) => (e === zoomIn ? { ...e, t: t0 } : e));
  },
};

// ------------------------------------------------------------------ X (skill2)
// ch_root jump (model units above 2.02): the baked frames already carry it (skillCamera);
// the game adds only what is needed to clear the top of the field from her lane.
const X_JUMP = [[6.88, 0], [6.9, 1.63], [7.02, 38.65], [9.07, 38.65], [9.08, 30.29], [9.17, 1.63], [9.18, 0]];
const X_MOVE = [7.1833, 8.95];
const X_BACK = [10.15, 10.7333];
const X_HIT = 9.15;
const X_END = 11.5;

function landSpot(run) {
  // Slam into the middle of the field (original MoveMotion carries her to the target
  // area while airborne); the ground attack then sweeps the whole screen.
  const live = liveTargets(run.enemies || []);
  const x = live.length ? live.reduce((s, e) => s + e.x, 0) / live.length : W * 0.55;
  return { x: Math.max(W * 0.35, Math.min(W * 0.7, x - 60)), y: H * 0.55 };
}

function xPos(p, run, t) {
  const s = run.data.land;
  let bx = run.homeX;
  let by = run.homeY;
  if (t >= X_MOVE[0] && t < X_BACK[0]) {
    const k = ease(clamp01((t - X_MOVE[0]) / (X_MOVE[1] - X_MOVE[0])));
    bx = run.homeX + (s.x - run.homeX) * k;
    by = run.homeY + (s.y - run.homeY) * k;
  } else if (t >= X_BACK[0]) {
    const k = ease(clamp01((t - X_BACK[0]) / (X_BACK[1] - X_BACK[0])));
    bx = s.x + (p.x - s.x) * k;
    by = s.y + (p.y - s.y) * k;
  }
  // The baked jump lifts her 38.65 units; add only what keeps the peak off-screen.
  let up = 0;
  if (t > 6.88 && t < 9.18) {
    const [u] = sampleKeys(X_JUMP, t, 1);
    const baked = u * FX_ANCHORS.fPx * screenScale(p);
    up = Math.max(0, (by + 160) * (u / 38.65) - baked);
  }
  return { x: bx, y: by - up };
}

// ---- X slam (user: "make it look great"): layered on top of the original hit FX.
// Sword-light pillar dropping onto the impact, a white-cyan flash, ground shock rings
// racing out, a light dome, cyan lightning crawling out, rock debris and a glowing fissure.
function slamFx(r, x, gy) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Light pillar: the blade's path from the top of the screen into the ground.
  spawnFx(r, { dur: 0.45, draw: (ctx, k) => {
    const a = 1 - k;
    const w = 150 * (1 - k * 0.7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [ww, col] of [[w, '80,200,255'], [w * 0.45, '190,240,255'], [w * 0.14, '255,255,255']]) {
      const g = ctx.createLinearGradient(x - ww / 2, 0, x + ww / 2, 0);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.5, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - ww / 2, -20, ww, gy + 20);
    }
    ctx.restore();
  } });
  // Light dome swelling over the impact.
  spawnFx(r, { dur: 0.7, draw: (ctx, k) => {
    const rad = 120 + 380 * (1 - (1 - k) ** 3);
    const a = (1 - k) ** 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, gy, 0, x, gy, rad);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.25, `rgba(170,235,255,${0.85 * a})`);
    g.addColorStop(0.6, `rgba(60,150,255,${0.4 * a})`);
    g.addColorStop(1, 'rgba(20,80,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, gy, rad, rad * 0.75, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(x, gy, rad, rad * 0.18, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  } });
  // Ground shock rings racing out across the field (flattened: they run along the floor).
  [0, 0.07, 0.17].forEach((delay, i) => spawnFx(r, { dur: 0.6, delay, draw: (ctx, k) => {
    const rx = 60 + (W * 0.95) * (1 - (1 - k) ** 2);
    const ry = rx * 0.2;
    const a = (1 - k) * (i === 0 ? 1 : 0.7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(90,200,255,${0.55 * a})`;
    ctx.lineWidth = 22 * (1 - k) + 4;
    ctx.beginPath();
    ctx.ellipse(x, gy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(240,252,255,${a})`;
    ctx.lineWidth = 4 * (1 - k) + 1.5;
    ctx.stroke();
    ctx.restore();
  } }));
  // Glowing fissure along the ground line.
  spawnFx(r, { dur: 1.1, layer: 'under', draw: (ctx, k) => {
    const a = k < 0.1 ? k / 0.1 : (1 - k) / 0.9;
    const half = W * (0.2 + 0.8 * Math.min(1, k / 0.25));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - half, 0, x + half, 0);
    g.addColorStop(0, 'rgba(60,170,255,0)');
    g.addColorStop(0.5, `rgba(200,245,255,${a})`);
    g.addColorStop(1, 'rgba(60,170,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - half, gy - 5, half * 2, 10);
    ctx.restore();
  } });
  // Lightning crawling out from the impact (re-jagged every few frames).
  const bolts = Array.from({ length: 9 }, (_, i) => ({
    ang: i < 6 ? (i % 2 ? 0 : Math.PI) + rnd(-0.35, 0.15) : -Math.PI / 2 + rnd(-0.9, 0.9),
    len: i < 6 ? rnd(260, 520) : rnd(160, 300),
  }));
  spawnFx(r, { dur: 0.5, draw: (ctx, k) => {
    const a = 1 - k;
    const seed = Math.floor(k * 18);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    bolts.forEach((b, bi) => {
      const pts = [[x, gy]];
      const n = 7;
      for (let j = 1; j <= n; j++) {
        const d = (b.len * j) / n * Math.min(1, k * 4 + 0.3);
        const h = Math.sin((seed + 1) * 12.9898 + bi * 78.233 + j * 37.719) * 43758.5453;
        const jit = ((h - Math.floor(h)) - 0.5) * 46;
        pts.push([x + Math.cos(b.ang) * d - Math.sin(b.ang) * jit, gy + Math.sin(b.ang) * d + Math.cos(b.ang) * jit]);
      }
      for (const [lw, col] of [[7, `rgba(70,170,255,${0.5 * a})`], [2.2, `rgba(235,250,255,${a})`]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
    });
    ctx.restore();
  } });
  // Eruption (user: "make the rising burst look great"): a central energy geyser shoots up
  // from the impact with streaks racing up it, smaller geysers burst out of the fissure one
  // after another going outward, and a column of sparks rises off the field.
  const geyser = (gx, height, width, delay, dur) => spawnFx(r, { dur, delay, draw: (ctx, k) => {
    const rise = 1 - (1 - Math.min(1, k / 0.22)) ** 3; // shoots up fast, then holds
    const a = k < 0.55 ? 1 : (1 - k) / 0.45;
    const top = gy - height * rise;
    const wob = Math.sin(k * 40 + gx) * width * 0.04;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [wm, col, al] of [[1, '60,150,255', 0.45], [0.55, '150,225,255', 0.75], [0.2, '255,255,255', 1]]) {
      const w = width * wm * (1 - k * 0.35);
      const g = ctx.createLinearGradient(0, gy, 0, top);
      g.addColorStop(0, `rgba(${col},${al * a})`);
      g.addColorStop(0.75, `rgba(${col},${al * a * 0.7})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      // Flame-like column: wide foot, waisted body, pointed crown.
      ctx.beginPath();
      ctx.moveTo(gx - w * 0.6, gy);
      ctx.quadraticCurveTo(gx - w * 0.25 + wob, gy - (gy - top) * 0.5, gx + wob * 2, top);
      ctx.quadraticCurveTo(gx + w * 0.25 + wob, gy - (gy - top) * 0.5, gx + w * 0.6, gy);
      ctx.closePath();
      ctx.fill();
    }
    // Streaks racing up the column.
    ctx.strokeStyle = `rgba(235,250,255,${0.8 * a})`;
    ctx.lineWidth = Math.max(1.5, width * 0.025);
    for (let i = 0; i < 6; i++) {
      const ph = (k * 3.2 + i / 6) % 1;
      const sx = gx + (((i * 37) % 11) / 11 - 0.5) * width * 0.5;
      const y0 = gy - (gy - top) * ph;
      ctx.beginPath();
      ctx.moveTo(sx, y0);
      ctx.lineTo(sx + wob, y0 - (gy - top) * 0.18);
      ctx.stroke();
    }
    // Crown flare.
    const cr = width * 0.55 * (1 - k * 0.5);
    const cg = ctx.createRadialGradient(gx, top, 0, gx, top, cr);
    cg.addColorStop(0, `rgba(255,255,255,${a})`);
    cg.addColorStop(0.4, `rgba(140,220,255,${0.6 * a})`);
    cg.addColorStop(1, 'rgba(40,120,255,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(gx, top, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } });
  geyser(x, gy + 40, 230, 0.03, 0.95); // the main one clears the top of the screen
  for (let i = 1; i <= 4; i++) {
    for (const side of [-1, 1]) {
      geyser(x + side * i * 175, rnd(170, 300) - i * 18, 110 - i * 10, 0.06 + i * 0.07, 0.6);
    }
  }
  // Sparks rising off the whole blast.
  const motes = Array.from({ length: 70 }, () => ({
    x: x + rnd(-1, 1) * rnd(0, W * 0.55), vy: rnd(260, 760), sway: rnd(-60, 60), s: rnd(1.5, 4.5),
    delay: rnd(0, 0.35), life: rnd(0.5, 1.0),
  }));
  spawnFx(r, { dur: 1.4, draw: (ctx, k) => {
    const t = k * 1.4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      const u = (t - m.delay) / m.life;
      if (u <= 0 || u >= 1) continue;
      const px = m.x + m.sway * u + Math.sin(u * 9 + m.s) * 6;
      const py = gy - m.vy * (t - m.delay) * (1 - u * 0.35);
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = u < 0.3 ? '#ffffff' : '#8fdcff';
      ctx.beginPath();
      ctx.ellipse(px, py, m.s * 0.6, m.s * 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } });
  // Rock debris thrown up and falling back.
  const rocks = Array.from({ length: 26 }, () => ({
    vx: rnd(-520, 520), vy: rnd(-760, -260), s: rnd(5, 15), rot: rnd(0, 6), spin: rnd(-12, 12),
    tone: Math.floor(rnd(70, 125)),
  }));
  spawnFx(r, { dur: 1.2, draw: (ctx, k) => {
    const t = k * 1.2;
    const a = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    for (const p of rocks) {
      const px = x + p.vx * t;
      const py = gy + p.vy * t + 900 * t * t;
      if (py > gy + 30) continue;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot + p.spin * t);
      ctx.fillStyle = `rgb(${p.tone},${p.tone - 12},${p.tone - 24})`;
      ctx.beginPath();
      ctx.moveTo(-p.s, -p.s * 0.4);
      ctx.lineTo(-p.s * 0.2, -p.s * 0.8);
      ctx.lineTo(p.s * 0.9, -p.s * 0.2);
      ctx.lineTo(p.s * 0.4, p.s * 0.7);
      ctx.lineTo(-p.s * 0.7, p.s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  } });
}

export const LABIATA_X = {
  clip: 'skill2', duration: X_END, y0: 2.02, path: [[0, 0, 2.02], [X_END, 0, 2.02]], k: 10,
  speed: 1.35, // X 35% faster: bomb DPS stays >= Lv5 fire with the halved leader damage
  pos: xPos,
  travel: [[6.88, 9.07], X_BACK],
  start(p, run, opts) {
    run.data.land = landSpot(run);
  },
  timeline() {
    const list = [];
    // skill2 camera: "0.45,12,0,23" (0s) ... "0.05,5,5,35" slam (9.07s), stop 10.12s.
    list.push(cameraEvent(0, 0.45, 23), cameraEvent(2.4167, 0.05, 25), cameraEvent(4.1, 0.25, 25),
      cameraEvent(5.5167, 0.05, 28), cameraEvent(5.7167, 0.05, 29), cameraStop(7.1833, 0.45),
      cameraStop(10.1167, 0.55));
    // char_10_skill2_01..08 play from the skill2 clip clock (js/voice-events.js).
    const atFx = (t, label, key, w, h, dur, extra = {}) => list.push({ t, do: (r, p) => {
      const b = fxAt(p, r, 'skill2', label);
      spawnFx(r, { key, x: b.x, y: b.y, w, h, dur, ...extra });
    } });
    // Transformation: blade_in_particle (2.33s), blade_in_aura (3.65s), swing (4.13s),
    // swing back smoke (4.28s), up smoke (4.95s), blade_in_particle2 (5.38s), wind aura (5.72s).
    atFx(2.3333, 'inparticle', 'labiata-fx-inparticle', 180, 180, 0.6, { loop: 2 });
    atFx(3.65, 'inaura', 'labiata-fx-inaura', 240, 240, 0.55);
    list.push({ t: 3.6, do: (r) => r.events.push({ type: 'shake', mag: 0.8 }) });
    atFx(4.1333, 'swing', 'labiata-fx-swing', 300, 300, 0.3);
    atFx(4.2833, 'swingsmoke', 'labiata-fx-swingsmoke', 240, 180, 0.4,
      { blend: 'source-over', alpha: 0.8, layer: 'under' });
    // Battery lighting on the transformed sword (4.83 / 5.33 / 5.82s) + glow from 4.92s.
    [4.8333, 5.3333, 5.8167].forEach((t, i) => atFx(t, 'light' + (i + 1), 'labiata-fx-baglight', 170, 170, 0.6));
    list.push({ t: 4.9167, do: (r, p) => spawnFx(r, { dur: 2.0, layer: 'under', draw: (ctx, k) => {
      const b = fxAt(p, r, 'skill2', 'glow');
      if (r.t > 6.95) return;
      bloom(ctx, b.x, b.y, 110, 90, 0.35 + 0.15 * Math.sin(k * 30));
    } }) });
    atFx(4.95, 'upsmoke', 'labiata-fx-upsmoke', 220, 220, 0.4, { blend: 'source-over', alpha: 0.85 });
    atFx(5.3833, 'inparticle2', 'labiata-fx-inparticle', 200, 200, 0.6, { loop: 2 });
    atFx(5.7167, 'windaura', 'labiata-fx-windaura', 280, 230, 0.9, { loop: 2 });
    atFx(5.9833, 'buffaura', 'labiata-fx-buffaura', 260, 260, 0.75);
    // Jump (6.9s): jump_up_smoke + shake 0.6.
    list.push({ t: 6.9, do: (r) => r.events.push({ type: 'shake', mag: 0.6 }) });
    atFx(6.9, 'jumpsmoke', 'labiata-fx-jumpsmoke', 280, 230, 0.45,
      { blend: 'source-over', alpha: 0.9, layer: 'under' });
    // Slam (9.15s): EventHit Labiata_skill2_hit -> full bomb on everything on screen.
    list.push({ t: X_HIT, do: (r, p) => {
      const s = fxAt(p, r, 'skill2', 'ground');
      r.events.push({ type: 'blast', share: 1 });
      // The slam wipes every enemy shot on screen (user), with a white-cyan flash.
      r.events.push({ type: 'clearBullets' });
      r.events.push({ type: 'flash', t: 0.16 });
      r.events.push({ type: 'shake', mag: 2.2 });
      // Short freeze only: the GPU explosion runs on the wall clock, a long freeze split it
      // from the sheet FX (user: "the explosion doesn't come out together").
      r.events.push({ type: 'hitstop', t: 0.04 });
      // Slam SFX (user): heavy impact + big blast + electric crackle, layered.
      r.events.push({ type: 'sfx', stem: 'common_smash_3' });
      r.events.push({ type: 'cue', key: 'leaderBlast' });
      r.events.push({ type: 'cue', key: 'hz:bolt' });
      // The eruption itself goes off with the original ground attack (9.18s) below.
      spawnFx(r, { key: 'labiata-fx-hit2', x: s.x, y: s.y - 30, w: 360, h: 360, dur: 0.58 });
      spawnFx(r, { dur: 0.18, draw: (ctx, k) => bloom(ctx, s.x, s.y - 20, 420, 260, 1 - k) });
    } });
    // skill2_ground_attack (9.18s): the ground splits across the whole field.
    // Centred on the original skill2_ground_attack object (in front of where she lands).
    list.push({ t: 9.1833, do: (r, p) => {
      const s = fxAt(p, r, 'skill2', 'ground');
      const gy = s.y;
      r.events.push({ type: 'gpuSlam', x: s.x, y: gy - 10, power: 1, fallback: () => slamFx(r, s.x, gy - 10) });
      spawnFx(r, { dur: 2.5, layer: 'under', draw: (ctx, k) => {
        const rocks = getNativeWeaponImage('labiata-fx-rocks');
        if (!rocks) return;
        const fade = Math.min(1, (1 - k) / 0.4);
        const rise = Math.min(1, k / 0.08);
        ctx.save();
        ctx.globalAlpha = fade;
        for (let i = -3; i <= 3; i++) {
          const w = 300 - Math.abs(i) * 30;
          const h = (w * rocks.height) / rocks.width * rise;
          const x = s.x + i * 230;
          ctx.drawImage(rocks, x - w / 2, gy - h + 18, w, h);
        }
        ctx.restore();
      } });
      for (let i = -3; i <= 3; i++) {
        const x = s.x + i * 230;
        const d = Math.abs(i) * 0.05;
        spawnFx(r, { key: 'labiata-fx-groundbomb', x, y: gy - 50, w: 300, h: 300, dur: 0.45, delay: d });
        spawnFx(r, { key: 'labiata-fx-grounddeco', x, y: gy - 30, w: 300, h: 260, dur: 0.5, delay: d });
        spawnFx(r, { key: 'labiata-fx-groundsmoke', x, y: gy - 10, w: 240, h: 190, dur: 0.6, delay: d + 0.05,
          blend: 'source-over', alpha: 0.4, layer: 'under' });
      }
      spawnFx(r, { key: 'labiata-fx-smoke4', x: s.x, y: gy - 40, w: 460, h: 340, dur: 0.4,
        blend: 'source-over', alpha: 0.85 });
    } });
    // Labiata_buff_skill2_hit (9.57s): the lingering burst.
    // The original sits it below the stage floor; there is no floor here, so it stays on the
    // ground-attack line (same x, ground anchor's height).
    list.push({ t: 9.5667, do: (r, p) => {
      const b = fxAt(p, r, 'skill2', 'finalhit');
      const g = fxAt(p, r, 'skill2', 'ground');
      // The sheet's pillar stands on the cell's bottom (~0.9 h): lift it so its foot sits on
      // the line and it rises above it, ~3.5x her height like the original.
      const sz = 560;
      spawnFx(r, { key: 'labiata-fx-finalhit', x: b.x, y: g.y - sz * 0.38, w: sz, h: sz, dur: 1.0 });
      // Second pulse rides the original final burst pillar.
      r.events.push({ type: 'gpuSlam', x: b.x, y: g.y - 10, power: 0.6 });
      r.events.push({ type: 'shake', mag: 1.0 });
    } });
    // Labiata_skill2_down_smoke (10.77s): landing back home.
    atFx(10.7667, 'downsmoke', 'labiata-fx-downsmoke', 180, 120, 0.35,
      { blend: 'source-over', alpha: 0.85, layer: 'under' });
    return list;
  },
};
