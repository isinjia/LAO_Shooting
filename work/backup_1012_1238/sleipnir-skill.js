// Sleipnir (P-49) skills as runs (skill-run.js), from Unity Char_BR_Sleipnir_N.
//
// C = Skil_1.anim body clip (wind-up + blink section) with a user-directed path: four
// dashes back and forth across a fixed zone in front of her, contact damage, invulnerable.
// X = Skil_2.anim "돌격" (9.5s): goggle/eye lighting, rocket up out of frame (1.98s,
// UP_fly_smoke, shake 1.5), then in plane form charge across the fixed centre line of
// the map (user direction) -- EventHit Sleipnir_skill2_attack on everything crossed,
// time-scale dip, oversized sonic booms / boost / smoke so it reads as piercing the
// whole field -- climb out and descend home (to 7.75s).
import { W, H, onScreen } from './canvas.js';
import { bloom, drawSheetAt, clamp01, sampleKeys } from './run-fx.js';
import { spawnFx, runPos, cameraEvent, cameraStop, sfxEvent } from './skill-run.js';

// C (user-directed redesign of Skil_1's blink section): a zone is fixed in front of her
// at cast; she dashes far / near / far / near across it at the original blink times
// (1.58 / 1.85 / 2.17 / 2.43s, each with Sleipnir_sonicboom), every enemy she passes
// through is hit, then she returns and the skill ends. Invulnerable throughout.
// Damage: the C budget (6/12/18) over the 4 passes, so a target caught by all four
// takes the full amount.
const ZONE_NEAR = 70; // px ahead of the ship
const ZONE_LEN = 330;
const DASH = 0.1; // seconds (run clock) per crossing
const DASHES = [1.58, 1.85, 2.17, 2.43]; // far, near, far, near
const RETURN_T = 2.67;
const C_END = 2.95;
const ease = (k) => k * k * (3 - 2 * k);

function zoneStops(run) {
  const near = run.homeX + ZONE_NEAR;
  const far = Math.min(W - 40, near + ZONE_LEN);
  return [run.homeX, far, near, far, near];
}

function cPos(p, run, t) {
  const stops = zoneStops(run);
  const y = run.homeY;
  if (t < DASHES[0]) return { x: run.homeX, y };
  for (let i = 0; i < DASHES.length; i++) {
    const t0 = DASHES[i];
    const next = i + 1 < DASHES.length ? DASHES[i + 1] : RETURN_T;
    if (t < t0 + DASH) return { x: stops[i] + (stops[i + 1] - stops[i]) * ease((t - t0) / DASH), y };
    if (t < next) return { x: stops[i + 1], y };
  }
  // Return to the (live) ship.
  const k = ease(clamp01((t - RETURN_T) / (C_END - 0.1 - RETURN_T)));
  const from = stops[stops.length - 1];
  return { x: from + (p.x - from) * k, y: y + (p.y - y) * k };
}

export const SLEIPNIR_C = {
  clip: 'skill1', duration: C_END, y0: 3.5, path: [[0, 0, 3.5], [C_END, 0, 3.5]],
  targeted: false, k: 10, pos: cPos,
  // No wind-up (user direction): start just before the first dash (1.58s).
  startAt: 1.5,
  travel: [[1.55, C_END]],
  start(p, run) {
    run.data.hits = DASHES.map(() => new Set());
    run.data.prev = { x: run.homeX, y: run.homeY };
  },
  timeline(run) {
    const list = [];
    list.push({ t: 1.5, do: (r) => spawnFx(r, { key: 'sleipnir-fx-startsmoke', x: r.homeX, y: r.homeY + 30,
      w: 150, h: 110, dur: 0.9, blend: 'source-over', alpha: 0.75, layer: 'under', fade: 0.4 }) });
    list.push(cameraEvent(1.5333, 0.1, 30));
    DASHES.forEach((t, i) => {
      list.push({ t, do: (r, p) => {
        const q = cPos(p, r, t);
        spawnFx(r, { key: 'sleipnir-fx-sonic', x: q.x, y: q.y, w: 150, h: 150, dur: 0.32, flip: i % 2 === 1, layer: 'under' });
        r.events.push({ type: 'sfx', stem: i % 2 ? 'common_swing_big_2' : 'common_jet_whoosh' });
      } });
    });
    list.push({ t: RETURN_T, do: (r, p) => {
      const q = cPos(p, r, RETURN_T);
      spawnFx(r, { key: 'sleipnir-fx-backsmoke', x: q.x + 20, y: q.y + 10, w: 170, h: 170, dur: 0.9,
        blend: 'source-over', alpha: 0.8, layer: 'under' });
    } });
    return list;
  },
  tick(p, run) {
    // Contact damage along the swept dash segment (once per enemy per crossing).
    const q = cPos(p, run, run.t);
    const prev = run.data.prev;
    run.data.prev = q;
    const i = DASHES.findIndex((t0) => run.t >= t0 && run.t <= t0 + DASH + 0.04);
    if (i < 0) return;
    const per = (run.level * 6) / DASHES.length;
    const ax = prev.x, ay = prev.y, bx = q.x, by = q.y;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (const e of run.enemies) {
      if (!e.alive || run.data.hits[i].has(e)) continue;
      const u = clamp01(((e.x - ax) * dx + (e.y - ay) * dy) / len2);
      const cx = ax + dx * u - e.x;
      const cy = ay + dy * u - e.y;
      const reach = 34 + (e.hitR || 18);
      if (cx * cx + cy * cy > reach * reach) continue;
      run.data.hits[i].add(e);
      run.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: per });
      spawnFx(run, { key: 'sleipnir-fx-hit', x: e.x, y: e.y, w: 110, h: 110, dur: 0.32 });
      spawnFx(run, { key: 'sleipnir-fx-ring', x: e.x, y: e.y, w: 90, h: 90, dur: 0.3 });
    }
  },
  drawUnder(ctx, p, run, size) {
    // Dash streak behind her while she crosses the zone.
    const t = run.t;
    if (t < DASHES[0] || t > C_END) return;
    const a = cPos(p, run, t);
    const b = cPos(p, run, Math.max(0, t - 0.05));
    if (Math.abs(a.x - b.x) < 20) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(b.x, 0, a.x, 0);
    g.addColorStop(0, 'rgba(255,140,40,0)');
    g.addColorStop(1, 'rgba(255,220,150,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(a.x, b.x), a.y - size * 0.16, Math.abs(a.x - b.x), size * 0.32);
    ctx.restore();
    bloom(ctx, a.x, a.y, size * 0.5, size * 0.35, 0.6);
  },
};

// Skil_2 rotation_root keys, rest y = 3.5.
const X_PATH = [
  [0, 0.1, 3.5], [0.5, 0.1, 3.3], [0.9, 0.1, 3.3], [1.88, 0.1, 3.7], [1.97, 0.1, 3.2],
  [2.0, 0.1, 81.7], [2.58, -94.2, 80.5], [3.22, -79.1, 11.8], [3.38, -79.1, 11.8],
  [3.47, 87.4, 13.9], [4.3, 42.2, 86.9], [4.73, 0.1, 68.1], [7.75, 0.1, 2.9],
  [8.42, 0.1, 2.5], [9.12, 0.1, 2.9], [9.5, 0.1, 3.5],
];
const SWEEP_T0 = 3.38;
const SWEEP_T1 = 3.47;
const OFF = 220; // px beyond the screen edge
const RISE_END = 4.73; // back on the root-motion path (above the frame)

/** Charge on the fixed centre line of the map (user direction); root motion elsewhere. */
function xPos(p, run, t) {
  const lane = run.data.lane;
  if (t < 2.58) return null;
  if (t < SWEEP_T0) return { x: -OFF, y: lane }; // swung round, off the left edge
  if (t < SWEEP_T1) {
    const k = (t - SWEEP_T0) / (SWEEP_T1 - SWEEP_T0);
    return { x: -OFF + (W + 2 * OFF) * k, y: lane };
  }
  if (t < RISE_END) {
    // Climb out past the right edge, back toward the root path above home.
    const [x, y] = sampleKeys(X_PATH, RISE_END);
    const ex = run.homeX + x * run.k;
    const ey = run.homeY - (y - 3.5) * run.k;
    const k = (t - SWEEP_T1) / (RISE_END - SWEEP_T1);
    return { x: W + OFF + (ex - W - OFF) * k, y: lane + (ey - lane) * k };
  }
  return null;
}

/** Oversized charge streak + lingering full-width piercing beam on the centre line. */
function drawPierce(ctx, run, size) {
  const t = run.t;
  if (t < SWEEP_T0 - 0.02 || t > SWEEP_T1 + 0.75) return;
  const lane = run.data.lane;
  const head = t < SWEEP_T1 ? -OFF + (W + 2 * OFF) * ((t - SWEEP_T0) / (SWEEP_T1 - SWEEP_T0)) : W + OFF;
  const after = Math.max(0, t - SWEEP_T1);
  const fade = after > 0 ? Math.max(0, 1 - after / 0.75) : 1;
  const x0 = -40;
  const x1 = Math.min(W + 40, head);
  if (x1 <= x0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Orange sheath, warm body, white-hot core: spans everything she has crossed.
  const layers = [[190, '255,110,20', 0.32], [110, '255,170,60', 0.55], [46, '255,236,190', 0.85], [16, '255,255,250', 1]];
  for (const [hh, col, a] of layers) {
    const g = ctx.createLinearGradient(0, lane - hh / 2, 0, lane + hh / 2);
    g.addColorStop(0, 'rgba(' + col + ',0)');
    g.addColorStop(0.5, 'rgba(' + col + ',' + (a * fade) + ')');
    g.addColorStop(1, 'rgba(' + col + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, lane - hh / 2, x1 - x0, hh);
  }
  ctx.restore();
  if (t < SWEEP_T1 + 0.05) bloom(ctx, Math.min(W, head), lane, size * 2.2, size * 1.3, 1);
  // Shimmer flares strung along the beam while it fades.
  for (let i = 0; i < 7; i++) {
    const fx = W * (0.07 + i * 0.145);
    if (fx > x1) break;
    bloom(ctx, fx, lane + Math.sin(i * 2.1 + t * 30) * 8, 70, 46, 0.55 * fade);
  }
}

export const SLEIPNIR_X = {
  clip: 'skill2', duration: 9.5, y0: 3.5, path: X_PATH, k: 10, landFrom: 7.0,
  speed: 1.35, // X 35% faster: bomb DPS stays >= Lv5 fire with the halved leader damage
  travel: [[1.97, 7.75]],
  pos: xPos,
  start(p, run) {
    run.data.hit = new Set();
    run.data.lane = H / 2; // fixed centre line of the map
  },
  timeline() {
    const list = [];
    // Skil_2 camera: close on her "0.4,0,0,13" (0s), release (1.9s), wide "0.25,15,0,35" (3.42s).
    list.push(cameraEvent(0, 0.4, 13), cameraStop(1.9), cameraEvent(3.4167, 0.25, 35));
    // char 50_skill2_FULL (0.05s) plays from the Skil_2 clip clock (js/voice-events.js).
    list.push(sfxEvent(1.9833, 'common_jet_whoosh'), sfxEvent(3.3667, 'common_smash_3'));
    // sleipnir_skill2_Up_smoke (0.18s~): thruster smoke under her while she powers up.
    list.push({ t: 0.18, do: (r) => spawnFx(r, { key: 'sleipnir-fx-upsmoke', x: r.homeX, y: r.homeY + 34,
      w: 150, h: 120, dur: 1.8, loop: 3, blend: 'source-over', alpha: 0.8, layer: 'under' }) });
    list.push({ t: 0.62, do: (r) => spawnFx(r, { key: 'sleipnir-fx-downsmoke', x: r.homeX, y: r.homeY + 36,
      w: 170, h: 120, dur: 0.6, blend: 'source-over', alpha: 0.85, layer: 'under' }) });
    // Sleipnir_gogle_lighting (1.07s) + Sleipnir_eyes_lighiting flash (1.58s).
    list.push({ t: 1.07, do: (r, p) => spawnFx(r, { key: 'sleipnir-fx-goggle', x: p.x + 4, y: p.y - 22,
      w: 90, h: 90, dur: 0.9, loop: 2 }) });
    list.push({ t: 1.58, do: (r, p) => spawnFx(r, { key: 'sleipnir-fx-eyes', x: p.x + 6, y: p.y - 22,
      w: 120, h: 120, dur: 0.3 }) });
    // Launch (1.98s): UP_fly_smoke blast + camera shake 1.5.
    list.push({ t: 1.9833, do: (r) => {
      r.events.push({ type: 'shake', mag: 1.5 });
      spawnFx(r, { key: 'sleipnir-fx-flyboom', x: r.homeX, y: r.homeY + 20, w: 230, h: 230, dur: 0.7, layer: 'under' });
      spawnFx(r, { key: 'sleipnir-fx-upsmoke', x: r.homeX, y: r.homeY + 30, w: 220, h: 180, dur: 0.8,
        blend: 'source-over', alpha: 0.85, layer: 'under' });
    } });
    // Sleipnir_line_boost + speed_line (3.40s): full-width streaks along the centre line.
    list.push({ t: 3.4, do: (r) => spawnFx(r, { dur: 0.6, draw: (ctx, k) => {
      for (const [dy, a, h] of [[-70, 0.45, 90], [-30, 0.8, 120], [0, 1, 150], [32, 0.8, 120], [72, 0.45, 90]]) {
        drawSheetAt(ctx, 'sleipnir-fx-line', Math.min(0.99, 0.35 + k * 0.65), W / 2, r.data.lane + dy,
          W * 1.4, h, { alpha: a * (1 - k) });
      }
    } }) });
    list.push({ t: 3.4333, do: (r) => {
      r.events.push({ type: 'hitstop', t: 0.12 });
      r.events.push({ type: 'shake', mag: 1.8 });
    } });
    // Sonic booms ripping along the line (3.47/3.53/3.60/3.67s + extras), oversized.
    [[3.47, 0.9], [3.5, 0.72], [3.53, 0.55], [3.57, 0.38], [3.6, 0.22], [3.67, 0.08]].forEach(([t, fx]) => {
      list.push({ t, do: (r) => spawnFx(r, { key: 'sleipnir-fx-sonic', x: W * fx, y: r.data.lane,
        w: 380, h: 380, dur: 0.42 }) });
    });
    list.push({ t: 3.5, do: (r) => spawnFx(r, { key: 'sleipnir-fx-boost', x: W - 80, y: r.data.lane,
      w: 340, h: 340, dur: 0.3 }) });
    // after_smoke / after_smoke3 (3.42s): ground-boost smoke along the line.
    list.push({ t: 3.42, do: (r) => {
      for (let i = 0; i < 7; i++) {
        spawnFx(r, { key: 'sleipnir-fx-groundsmoke', x: W * (0.04 + i * 0.155), y: r.data.lane + 40,
          w: 260, h: 200, dur: 1.0, delay: i * 0.015, blend: 'source-over', alpha: 0.8, layer: 'under' });
      }
    } });
    // after_smoke4 (3.98/4.12s) + after_smoke2 back smoke rising (4.08-4.48s).
    [[3.98, 0.3], [4.12, 0.7]].forEach(([t, fx]) => list.push({ t, do: (r) => spawnFx(r, {
      key: 'sleipnir-fx-aftersmoke', x: W * fx, y: r.data.lane + 10, w: 280, h: 220, dur: 0.9,
      blend: 'source-over', alpha: 0.75, layer: 'under' }) }));
    [[4.08, 0.15], [4.22, 0.38], [4.35, 0.62], [4.48, 0.86]].forEach(([t, fx]) => list.push({ t, do: (r) => spawnFx(r, {
      key: 'sleipnir-fx-backsmoke', x: W * fx, y: r.data.lane - 10, w: 260, h: 260, dur: 1.0,
      blend: 'source-over', alpha: 0.7, layer: 'under' }) }));
    list.push({ t: 7.75, do: (r, p) => spawnFx(r, { key: 'sleipnir-fx-downsmoke', x: p.x, y: p.y + 36,
      w: 180, h: 120, dur: 0.6, blend: 'source-over', alpha: 0.85, layer: 'under' }) });
    return list;
  },
  tick(p, run) {
    // EventHit Sleipnir_skill2_attack: the charge pierces the whole map; every enemy
    // it passes (by x, any height) takes the full blast.
    if (run.t < SWEEP_T0 - 0.02 || run.t > SWEEP_T1 + 0.25) return;
    const x = run.t >= SWEEP_T1 ? W + OFF : runPos(p, run).x;
    for (const e of run.enemies) {
      if (!e.alive || run.data.hit.has(e) || e.x > x || !onScreen(e)) continue;
      run.data.hit.add(e);
      run.events.push({ type: 'blastEnemy', enemy: e });
      spawnFx(run, { key: 'sleipnir-fx-lastfire', x: e.x, y: e.y, w: 270, h: 210, dur: 0.5 });
      spawnFx(run, { key: 'sleipnir-fx-ring', x: e.x, y: e.y, w: 220, h: 220, dur: 0.45 });
    }
  },
  drawUnder(ctx, p, run, size) {
    const t = run.t;
    const a = runPos(p, run, t);
    const b = runPos(p, run, Math.max(0, t - 1 / 30));
    const vx = (a.x - b.x) * 30;
    const vy = (a.y - b.y) * 30;
    const speed = Math.hypot(vx, vy);
    if (speed > 300 && t > 1.97 && t < 7.75 && (t < SWEEP_T0 || t > SWEEP_T1)) {
      // Jet exhaust (trail_fire) + glow behind the plane form.
      const ang = Math.atan2(vy, vx);
      bloom(ctx, a.x - Math.cos(ang) * size * 0.5, a.y - Math.sin(ang) * size * 0.5,
        size * 0.8, size * 0.5, Math.min(0.9, speed / 2500));
      drawSheetAt(ctx, 'sleipnir-fx-line', 0.55, a.x - Math.cos(ang) * size * 1.1,
        a.y - Math.sin(ang) * size * 1.1, size * 2.6, size * 1.0, { rot: ang, alpha: clamp01(speed / 1500) });
    }
  },
  drawOver(ctx, p, run, size) {
    drawPierce(ctx, run, size);
  },
};
