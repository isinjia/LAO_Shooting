// Griffin (P/A-00) Skill2 bombing run, rebuilt from Unity Char_BR_PA00EL_N
// attack_hand_missile_skill.anim (10.85s) and the in-game skill video:
//   pelvis position curve -> her flight path (up and off screen, hover, dash right,
//   sweep left, return home); EventThrowProjectileFire1-4 -> FX_bullet_hand_Missile
//   (3.23-3.95s) and FX_PA00EL_Framebullet (6.48-6.63s); EventCameraShake 0.5/1/0.5/1.8;
//   EventHit fire_Hit (7.72s) = the big finisher over the whole group.
// Look follows the video: projectiles read as yellow-orange fire comets with dark
// dotted smoke chains; hand-missile hits bloom yellow-white then burst into fire
// balls; flame bullets drop from above into one giant flare -> smoke cloud -> fire
// pillar. Art is the original FX (handmissile plume, fire_smoke_sqns_2, fire_Hit,
// PA00EL_skill_2_hit, up_line/up_smoke, roket_fire). Game applies the bomb damage
// as shares of each landed projectile; the instant bullet clear stays at the press.
import { W, H, onScreen } from './canvas.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';

export const RUN_DURATION = 10.85;
const GRIFFIN_X_SPEED = 1.35;
// Travel legs play 1.5x faster (user tuning); crouch and the hover/firing stretch
// keep the original pace. The run clock drives both path and body animation.
const TRAVEL_SPEED = 1.5;
const runRate = (t) => ((t >= 0.43 && t < 2.0) || t >= 5.27 ? TRAVEL_SPEED : 1);

// pelvis (t, x, y) in model units; rest pose is (0, 3.2).
const PATH = [
  [0, 0.06, 3.2], [0.133, 0, 2.496], [0.183, -0.015, 2.246], [0.383, -0.015, 2.246],
  [0.483, 0, 6.245], [0.583, 0, 25.817], [0.667, -11, 38.445], [0.767, -24.89, 35.18],
  [0.85, -24.476, 28.513], [0.867, -24.402, 27.682], [1.4, -11.339, 14.145],
  [2.017, 3.066, 9.269], [2.65, 3.106, 10.139], [2.95, 2.667, 10.14], [3.483, 2.554, 10.329],
  [3.983, 2.656, 10.14], [4.533, 1.124, 10.939], [5.267, 3.164, 8.715], [5.75, 33.94, 11.975],
  [6.317, 54.88, 24.273], [6.35, 51.82, 24.716], [6.567, 19.96, 19.464], [6.733, -0.278, 15.537],
  [6.783, -4.63, 15.531], [7.1, -22.183, 17.309], [7.133, -23.293, 17.842], [7.367, -26.59, 20.44],
  [7.667, -22.06, 16.843], [7.717, -20.757, 15.315], [7.983, -12.244, 9.529], [9.167, 1.784, 5.136],
  [10.083, -0.777, 3.825], [10.1, -0.779, 3.825], [10.85, 0, 3.2],
];
// EventThrowProjectileFire1-4 (launcher slot, time, kind). The video shows two
// falling comets per flame-bullet event, so each flame event spawns a pair.
// Carpet bombing (user direction): instead of aiming at enemies, each volley is
// scattered over random screen points across the original firing windows.
const MISSILE_COUNT = 10; // hand missiles, 3.23-3.95s
const FLAME_COUNT = 15; // flame bullets, 6.48-6.70s
const SHOTS = MISSILE_COUNT + FLAME_COUNT;

function buildSchedule() {
  const list = [];
  const add = (kind, n, t0, t1, xr, yr) => {
    for (let i = 0; i < n; i++) {
      list.push({
        kind, slot: i % 4,
        t: t0 + (t1 - t0) * (n > 1 ? i / (n - 1) : 0),
        tx: (xr[0] + Math.random() * (xr[1] - xr[0])) * W,
        ty: (yr[0] + Math.random() * (yr[1] - yr[0])) * H,
        lane: Math.random() * 2 - 1,
      });
    }
  };
  add('missile', MISSILE_COUNT, 3.2333, 3.95, [0.38, 0.95], [0.1, 0.88]);
  add('flame', FLAME_COUNT, 6.4833, 6.7, [0.1, 0.95], [0.15, 0.9]);
  return list.sort((a, b) => a.t - b.t);
}
const SHAKES = [[0.5, 0.5], [4.3333, 1], [6.4667, 0.5], [7.4667, 1.8]];
const SLOT_Y = [-16, -6, 6, 16];
// Projectile script animationCurve: 1s flight, hangs at launch then accelerates.
const PROGRESS = [[0, 0], [0.2633, 0.0143], [0.8502, 0.577], [1, 1]];
const FLIGHT = 1.0;

function sample(keys, t, cols = 2) {
  if (t <= keys[0][0]) return keys[0].slice(1, 1 + cols);
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b[0]) {
      const a = keys[i - 1];
      const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return a.slice(1, 1 + cols).map((v, j) => v + (b[1 + j] - v) * k);
    }
  }
  return keys[keys.length - 1].slice(1, 1 + cols);
}

// Absolute screen keyframes (t, x/W, y/H) traced from the in-game skill video:
// enters top-left, hovers to fire, dashes up-right and out, streaks back along the
// top edge and out top-left, re-enters from the left edge, glides home.
// Off-screen jumps happen while she is outside the frame.
const SCREEN = [
  [1.4, 0.1, -0.16], [2.0, 0.27, 0.2], [5.27, 0.29, 0.22], [5.75, 0.59, 0.14],
  [6.32, 0.9, 0.07], [6.55, 1.0, -0.2], [6.6, 1.1, 0.12], [6.75, 0.72, 0.12],
  [7.0, 0.28, 0.1], [7.3, -0.12, 0.1], [7.95, -0.12, 0.2], [8.15, 0.07, 0.2],
  [9.0, 0.26, 0.27],
];
const LIFT_END = 0.75; // up and out of the top edge
const OFF_TOP = -0.2;
const LAND_FROM = 9.0;

const smooth = (k) => k * k * (3 - 2 * k);

/** Griffin's body position on screen at run time t (home = where she took off / lands). */
function runPos(p, t) {
  const r = p.bombRun;
  const hx = r.launched ? r.homeX : p.x;
  const hy = r.launched ? r.homeY : p.y;
  if (t < 0.43) return { x: p.x, y: p.y };
  if (t < 1.4) {
    // Rocket straight up from the take-off spot and leave through the top edge.
    const k = Math.min(1, (t - 0.43) / (LIFT_END - 0.43));
    return { x: hx, y: hy + (OFF_TOP * H - hy) * k * k };
  }
  if (t < LAND_FROM) {
    const [nx, ny] = sample(SCREEN, t);
    let x = nx * W;
    let y = ny * H;
    if (t > 2.0 && t < 5.27) {
      // Hover drift: the original pelvis wobble around her firing spot.
      const [px, py] = sample(PATH, t);
      x += (px - 2.8) * 3;
      y -= (py - 10) * 3;
    }
    return { x, y };
  }
  // Glide back to wherever the ship (home) is now.
  const k = smooth(Math.min(1, (t - LAND_FROM) / (RUN_DURATION - LAND_FROM)));
  const ax = SCREEN[SCREEN.length - 1][1] * W;
  const ay = SCREEN[SCREEN.length - 1][2] * H;
  return { x: ax + (p.x - ax) * k, y: ay + (p.y - ay) * k };
}

/** Screen offset of Griffin's body from the ship position at run time t. */
export function runOffset(p, t) {
  const q = runPos(p, t);
  return { dx: q.x - p.x, dy: q.y - p.y };
}

export function startGriffinRun(p) {
  p.bombRun = {
    t: 0, fired: 0, shakes: 0, launched: false,
    homeX: p.x, homeY: p.y,
    schedule: buildSchedule(),
    missiles: [], impacts: [], puffs: [], muzzles: [],
    events: [], // char_05_skill2 (@0s) plays from the skill2 clip clock (js/voice-events.js)
    flameLanded: 0, finisher: null,
  };
  p.invuln = Math.max(p.invuln, RUN_DURATION + 0.3);
  p.anim.locked = false;
  p.anim.play('skill2', { lock: true });
}

function liveTargets(enemies) {
  return (enemies || []).filter((e) => e.alive && onScreen(e));
}

export function tickGriffinRun(p, dt, bullets) {
  const r = p.bombRun;
  if (!r) return;
  // X plays 35% faster (same damage in less time: bomb DPS >= Lv5 fire with the halved
  // leader damage).
  r.t += dt * runRate(r.t) * GRIFFIN_X_SPEED;
  const t = r.t;
  // Keep the skill2 body clip on the (warped) run clock.
  if (p.anim.state === 'skill2') p.anim.time = Math.min(t, RUN_DURATION);
  if (!r.launched && t >= 0.43) {
    r.launched = true;
    r.homeX = p.x;
    r.homeY = p.y;
  }
  while (r.shakes < SHAKES.length && t >= SHAKES[r.shakes][0]) {
    r.events.push({ type: 'shake', mag: SHAKES[r.shakes][1] });
    r.shakes += 1;
  }
  while (r.fired < r.schedule.length && t >= r.schedule[r.fired].t) {
    const shot = r.schedule[r.fired];
    const o = runOffset(p, t);
    const sx = p.x + o.dx + 20;
    const sy = p.y + o.dy + SLOT_Y[shot.slot];
    if (shot.kind === 'missile' || r.fired % 3 === 0) r.muzzles.push({ x: sx, y: sy, age: 0, kind: shot.kind });
    r.missiles.push({
      kind: shot.kind, age: 0, sx, sy, x: sx, y: sy, tx: shot.tx, ty: shot.ty,
      lane: shot.lane, ang: 0, puffT: 0,
    });
    r.fired += 1;
  }
  for (let i = r.missiles.length - 1; i >= 0; i--) {
    const m = r.missiles[i];
    m.age += dt;
    const k = sample(PROGRESS, Math.min(1, m.age / FLIGHT), 1)[0];
    let nx;
    let ny;
    if (m.kind === 'flame') {
      // Video: flame bullets plunge almost straight down onto the group.
      // Fired from above the top edge (she is off-screen top-right at 6.5s), the arc
      // bends just above the frame so the comets plunge onto the group in view.
      const cx = m.tx + m.lane * 26;
      const cy = -30;
      const u = 1 - k;
      nx = u * u * m.sx + 2 * u * k * cx + k * k * (m.tx + m.lane * 10);
      ny = u * u * m.sy + 2 * u * k * cy + k * k * m.ty;
    } else {
      nx = m.sx + (m.tx - m.sx) * k;
      ny = m.sy + (m.ty - m.sy) * k + Math.sin(k * Math.PI) * m.lane * 10;
    }
    if (Math.hypot(nx - m.x, ny - m.y) > 0.05) m.ang = Math.atan2(ny - m.y, nx - m.x);
    else if (m.age < dt * 2) m.ang = m.kind === 'flame' ? -Math.PI / 2 : Math.atan2(m.ty - m.sy, m.tx - m.sx);
    m.x = nx;
    m.y = ny;
    m.puffT -= dt;
    if (m.puffT <= 0 && k > 0.004) {
      m.puffT = 0.022;
      r.puffs.push({ x: m.x - Math.cos(m.ang) * 12, y: m.y - Math.sin(m.ang) * 12, age: 0,
        s: (m.kind === 'flame' ? 1.6 : 1.1) * (0.8 + Math.random() * 0.5) });
    }
    if (m.age >= FLIGHT) {
      r.impacts.push({ kind: m.kind, x: m.x, y: m.y, age: 0 });
      r.events.push({ type: 'impact', share: 1 / SHOTS, x: m.x, y: m.y });
      if (m.kind === 'flame') {
        r.flameLanded += 1;
        if (!r.finisher) {
          // EventHit fire_Hit: the big finisher lands on the enemy group (or mid-field).
          const live = liveTargets(bullets?.targets);
          const cx = live.length ? live.reduce((a, e) => a + e.x, 0) / live.length : 0.66 * W;
          const cy = live.length ? live.reduce((a, e) => a + e.y, 0) / live.length : 0.5 * H;
          r.finisher = { x: cx, y: cy, age: -0.12 };
        }
      }
      r.missiles.splice(i, 1);
    }
  }
  if (r.finisher) r.finisher.age += dt;
  for (const list of [r.impacts, r.puffs, r.muzzles]) {
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].age += dt;
      if (list[i].age > 0.9) list.splice(i, 1);
    }
  }
  const finDone = !r.finisher || r.finisher.age > 1.6;
  if (t >= RUN_DURATION && !r.missiles.length && finDone) {
    p.bombRun = null;
    // Bomb: 2s of invulnerability from the moment the clip ends.
    p.invuln = 2;
  }
}

function cell(ctx, img, cols, cellW, cellH, frame, x, y, w, h) {
  ctx.drawImage(img, (frame % cols) * cellW, Math.floor(frame / cols) * cellH, cellW, cellH,
    x - w / 2, y - h / 2, w, h);
}

/** Additive radial bloom (white-hot core -> yellow -> orange -> clear). */
function bloom(ctx, x, y, rx, ry, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(255,252,230,1)');
  g.addColorStop(0.35, 'rgba(255,224,90,0.85)');
  g.addColorStop(0.7, 'rgba(255,128,24,0.45)');
  g.addColorStop(1, 'rgba(255,90,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Flight FX behind her body (liftoff pillar, jet glow, rocket exhaust, speed lines). */
export function drawGriffinRunUnder(ctx, p, size) {
  const r = p.bombRun;
  if (!r) return;
  const t = r.t;
  ctx.save();
  // Liftoff (PA00EL_up_line + up_smoke): thin golden flame pillar + side puffs.
  const la = t - 0.43;
  const hx = r.launched ? r.homeX : p.x;
  const hy = r.launched ? r.homeY : p.y;
  if (la >= 0 && la < 0.9) {
    const line = getNativeWeaponImage('griffin-fx-linegold');
    const fade = Math.min(1, (0.9 - la) / 0.4);
    bloom(ctx, hx, hy + size * 0.25, 34, 20, 0.7 * fade);
    // Golden flame column rising from the launch spot (video 0.55-0.8s).
    bloom(ctx, hx, hy - size * 1.4, 18, size * 1.7, 0.55 * fade);
    if (line) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.translate(hx, hy + size * 0.3);
      ctx.rotate(-Math.PI / 2);
      for (const [w, a] of [[size * 3.4, 0.9], [size * 2.6, 0.6]]) {
        ctx.globalAlpha = fade * a;
        cell(ctx, line, 4, 256, 256, 3, w / 2 - 6, 0, w, w * 0.5);
      }
      ctx.restore();
    }
    const jet = getNativeWeaponImage('griffin-fx-jet');
    if (jet && la < 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(hx, hy);
      ctx.rotate(-Math.PI / 2);
      cell(ctx, jet, 4, 128, 128, Math.min(11, Math.floor(la / 0.5 * 12)), size * 0.7, 0, size * 1.8, size * 1.2);
      ctx.restore();
    }
    const puff = getNativeWeaponImage('griffin-fx-booster');
    if (puff) {
      ctx.globalCompositeOperation = 'source-over';
      for (const side of [-1, 1]) {
        for (let j = 0; j < 3; j++) {
          const a = la - j * 0.06;
          if (a < 0) continue;
          ctx.globalAlpha = 0.55 * Math.max(0, 1 - a / 0.9);
          const s = size * (0.35 + a * 0.5);
          cell(ctx, puff, 3, 128, 128, Math.min(8, Math.floor(a / 0.9 * 9)),
            hx + side * (size * 0.3 + a * 80 + j * 14), hy + size * 0.38 - j * 4, s, s * 0.7);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  const o = runOffset(p, t);
  const o2 = runOffset(p, Math.max(0, t - 1 / 30));
  const vx = (o.dx - o2.dx) * 30;
  const vy = (o.dy - o2.dy) * 30;
  const speed = Math.hypot(vx, vy);
  const bx = p.x + o.dx;
  const by = p.y + o.dy;
  // Booster glow on her back the whole time she is airborne (video: orange orb).
  if (t > 0.45 && t < RUN_DURATION - 0.3) {
    const flick = 0.8 + 0.2 * Math.sin(t * 40);
    bloom(ctx, bx - size * 0.28, by + size * 0.05, size * 0.3 * flick, size * 0.26 * flick, 0.75);
  }
  if (speed > 120) {
    const ang = Math.atan2(vy, vx);
    // Dash flare (video 5.6-5.75s / 6.75s): big yellow light behind her.
    bloom(ctx, bx - Math.cos(ang) * size * 0.5, by - Math.sin(ang) * size * 0.5,
      size * 0.9, size * 0.7, Math.min(0.9, speed / 1400));
    const jet = getNativeWeaponImage('griffin-fx-jet');
    ctx.globalCompositeOperation = 'lighter';
    if (jet) {
      ctx.save();
      ctx.translate(bx - Math.cos(ang) * size * 0.35, by - Math.sin(ang) * size * 0.35 + size * 0.1);
      ctx.rotate(ang);
      cell(ctx, jet, 4, 128, 128, Math.floor(t * 24) % 8, -size * 0.25, 0, size * 1.1, size * 1.1);
      ctx.restore();
    }
    const line = getNativeWeaponImage('griffin-fx-line');
    if (line) {
      ctx.globalAlpha = Math.min(1, speed / 900);
      for (const off of [-0.35, 0.05, 0.4]) {
        ctx.save();
        ctx.translate(bx - Math.cos(ang) * size * 0.9, by - Math.sin(ang) * size * 0.9 + off * size);
        ctx.rotate(ang);
        cell(ctx, line, 4, 256, 256, 3 + (Math.floor(t * 20) % 3), 0, 0, size * 2.2, size * 2.2);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/** Projectiles, muzzle flares and explosions (drawn above enemies). */
export function drawGriffinRunOver(ctx, p) {
  const r = p.bombRun;
  if (!r) return;
  ctx.save();
  // Muzzle flare at her launchers (video 3.85-4.25s): yellow burst toward the target.
  const jet = getNativeWeaponImage('griffin-fx-jet');
  for (const m of r.muzzles) {
    if (m.age > 0.22) continue;
    bloom(ctx, m.x + 10, m.y, 72, 52, 1 - m.age / 0.22);
    if (jet) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(m.x, m.y);
      if (m.kind === 'flame') ctx.rotate(-0.6);
      ctx.scale(-1, 1); // pani_fire points left; flip to blast forward
      cell(ctx, jet, 4, 128, 128, Math.min(11, Math.floor(m.age / 0.22 * 12)), -40, 0, 110, 80);
      ctx.restore();
    }
  }
  // Dark dotted smoke chains (fire_smoke_sqns_2) behind every comet.
  const booster = getNativeWeaponImage('griffin-fx-booster');
  if (booster) {
    ctx.globalCompositeOperation = 'source-over';
    for (const q of r.puffs) {
      if (q.age >= 0.6) continue;
      ctx.globalAlpha = 0.95 * (1 - q.age / 0.6);
      const s = (9 + q.age * 16) * q.s;
      cell(ctx, booster, 3, 128, 128, Math.min(5, Math.floor(q.age / 0.6 * 6)), q.x, q.y, s, s);
    }
    ctx.globalAlpha = 1;
  }
  // Fire comet: plume (handmissile sprite 1) + white-hot head; the tiny missile body
  // is lost in the flare in the video, so it stays a faint silhouette.
  const body = getNativeWeaponImage('griffin-fx-missile');
  const plume = getNativeWeaponImage('griffin-fx-plume');
  for (const m of r.missiles) {
    const big = m.kind === 'flame' ? 1.8 : 1.45;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.ang);
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.85 + 0.15 * Math.sin(m.age * 70 + m.lane);
    if (plume) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(plume, -40 * big, -10 * big * flick, 40 * big, 20 * big * flick);
    }
    ctx.restore();
    bloom(ctx, m.x, m.y, 15 * big * flick, 10 * big * flick, 1);
    if (body) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.ang);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(body, -10, -5, 20, 10);
      ctx.restore();
    }
  }
  // Hand-missile hit (fire_Hit): yellow-white bloom, then orange fire ball + ground fire.
  const fh = getNativeWeaponImage('griffin-fx-firehit');
  const gf = getNativeWeaponImage('griffin-fx-groundfire');
  const sh = getNativeWeaponImage('griffin-fx-skill2hit');
  for (const h of r.impacts) {
    if (h.kind === 'missile') {
      bloom(ctx, h.x, h.y, 135, 175, h.age < 0.16 ? 1 - h.age / 0.16 * 0.6 : Math.max(0, 0.4 - (h.age - 0.16) * 1.2));
      if (gf && h.age < 0.7) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        cell(ctx, gf, 4, 160, 160, Math.min(7, Math.floor(h.age / 0.7 * 8)), h.x, h.y + 10, 120, 120);
      }
      if (fh && h.age < 0.7) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        cell(ctx, fh, 4, 160, 160, Math.min(15, Math.floor(h.age / 0.7 * 16)), h.x, h.y, 150, 150);
      }
    } else if (sh && h.age < 0.4) {
      // Individual flame-bullet splash (PA00EL_skill_2_hit) under the finisher.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      cell(ctx, sh, 4, 192, 192, Math.min(11, Math.floor(h.age / 0.4 * 12)), h.x, h.y, 110, 110);
    }
  }
  drawFinisher(ctx, r);
  ctx.restore();
}

// EventHit fire_Hit (7.72s): one giant vertical flare over the group, then a black/
// orange smoke cloud, then a burning fire pillar (video 7.72-8.9s).
function drawFinisher(ctx, r) {
  const f = r.finisher;
  if (!f || f.age < 0) return;
  const a = f.age;
  const { x, y } = f;
  if (a < 0.55) {
    const grow = Math.min(1, a / 0.1);
    bloom(ctx, x, y - 50, 215 * grow, 275 * grow, a < 0.25 ? 1 : 1 - (a - 0.25) / 0.3);
  }
  const sh = getNativeWeaponImage('griffin-fx-skill2hit');
  if (sh && a < 0.6) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    cell(ctx, sh, 4, 192, 192, Math.min(11, Math.floor(a / 0.6 * 12)), x, y + 20, 260, 260);
  }
  const sm = getNativeWeaponImage('griffin-fx-smog');
  if (sm && a > 0.12 && a < 1.1) {
    const s = a - 0.12;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, (1.0 - s) / 0.3);
    cell(ctx, sm, 4, 192, 192, Math.min(11, Math.floor(s / 1.0 * 12)), x, y - 10, 300, 330);
  }
  const gf = getNativeWeaponImage('griffin-fx-groundfire');
  const fh = getNativeWeaponImage('griffin-fx-firehit');
  if (gf && a > 0.3 && a < 1.5) {
    const s = a - 0.3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (1.2 - s) / 0.35);
    // Fire pillar: stacked ground-fire loops (frames 0-3 are the full flames).
    [[60, 220], [-30, 190], [-120, 150]].forEach(([dy, w], i) => {
      cell(ctx, gf, 4, 160, 160, (Math.floor(s * 14) + i) % 4, x, y + dy, w, w * 1.15);
    });
    if (fh) cell(ctx, fh, 4, 160, 160, 4 + (Math.floor(s * 16) % 4), x, y - 20, 200, 200);
    ctx.globalAlpha = 1;
  }
}

// --- C: attack_hand_missile.anim (controller anim_skill1), 1.47s --------------------
// EventThrowProjectileFire1/2 at 0.5 / 0.65s launch one FX_bullet_hand_Missile each at
// the target (same comet + fire_Hit as the bombing run), camera shakes 0.3/0.3/0.5.
// Volley (user): Lv1 5 / Lv2 12 / Lv3 20 missiles from both hands across the original
// 0.5-0.65s fire window (stretched to 1.0s), alternating hands. Damage: the C budget
// (Lv1 6, Lv2 12 x1.2, Lv3 18 x1.3) split evenly across the volley.
import { spawnFx as runFx, spawnShot as runShot, runPos as runPosOf } from './skill-run.js';

function drawHandMissile(ctx, s) {
  const plume = getNativeWeaponImage('griffin-fx-plume');
  const body = getNativeWeaponImage('griffin-fx-missile');
  const flick = 0.85 + 0.15 * Math.sin(s.age * 70);
  const big = 1.45;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.ang);
  ctx.globalCompositeOperation = 'lighter';
  if (plume) ctx.drawImage(plume, -40 * big, -10 * big * flick, 40 * big, 20 * big * flick);
  ctx.restore();
  bloom(ctx, s.x, s.y, 15 * big * flick, 10 * big * flick, 1);
  if (body) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.ang);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(body, -10, -5, 20, 10);
    ctx.restore();
  }
}

/** C volley per level [-, Lv1, Lv2, Lv3] and damage boost vs the old 2-missile budget. */
const C_MISSILES = [0, 5, 12, 20];
const C_DMG_MUL = [0, 1, 1.2, 1.3];
/** Salvo (user): every missile pops out within C_POP, fans up / down to a staging point
 *  (C_SPREAD px at the edge), then they leave one after another C_GAP apart. */
const C_POP = [0, 0.06, 0.16, 0.24];
const C_SPREAD = [0, 80, 120, 150];
const C_GAP = [0, 0.07, 0.045, 0.03];
const C_DEPLOY = 0.28;
const C_FLIGHT = 0.75;

export const GRIFFIN_C = {
  clip: 'skill1', duration: 1.4667, y0: 0, path: [[0, 0, 0], [1.4667, 0, 0]],
  targeted: true, reachX: 30, landFrom: 1.4667,
  // She fires from where she stands: the ship stays steerable during the C.
  followShip: true,
  timeline(run) {
    const lv = Math.max(1, Math.min(3, run.level | 0));
    const count = C_MISSILES[lv];
    const per = (lv * 6 * C_DMG_MUL[lv]) / count;
    const fire = (slot, k) => (r, p) => {
      const q = runPosOf(p, r);
      const sx = q.x + 22;
      // Fan the volley a little so the missiles read as a salvo, not one stacked line.
      const sy = q.y + SLOT_Y[slot] + ((k % 4) - 1.5) * 4;
      if (k % 4 === 0) r.events.push({ type: 'shake', mag: 0.2 });
      if (k === 0) r.events.push({ type: 'cue', key: 'missileLaunch' });
      // Staging point: alternate up / down, pairs further out; departures in pop order.
      const pairs = Math.ceil(count / 2);
      const side = k % 2 ? 1 : -1;
      const rank = Math.floor(k / 2) + 1;
      const y1 = Math.max(40, Math.min(H - 40, sy + side * C_SPREAD[lv] * (rank / pairs)));
      const x1 = sx + 26 + ((k * 37) % 30);
      const popAt = popT(k);
      const goAt = popT(count - 1) + C_DEPLOY + 0.08 + k * C_GAP[lv];
      // FX/skill_1/skill_1_fire (0.50 / 0.65s): PA00EL_skill_1_fire cannon flame.
      runFx(r, { dur: 0.22, draw: (ctx, k) => {
        bloom(ctx, sx + 10, sy, 72, 52, 1 - k);
        const jet = getNativeWeaponImage('griffin-fx-jet');
        if (!jet) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(sx, sy);
        ctx.scale(-1, 1); // pani_fire points left; flip to blast forward
        cell(ctx, jet, 4, 128, 128, Math.min(11, Math.floor(k * 12)), -40, 0, 110, 80);
        ctx.restore();
      } });
      runShot(r, {
        sx, sy, target: r.target, tx: r.tx, ty: r.ty, flight: C_FLIGHT, curve: PROGRESS,
        arc: (slot === 1 ? 14 : -10) * (1 + (k % 3) * 0.6),
        prelude: { x1, y1, dur: C_DEPLOY, wait: Math.max(0, goAt - popAt - C_DEPLOY) },
        onGo: (rr) => rr.events.push({ type: 'cue', key: 'missileLaunch' }),
        draw: drawHandMissile,
        tick: (rr, s, dt) => {
          s.puffT = (s.puffT || 0) - dt;
          if (s.puffT <= 0 && s.age > 0.05) {
            // Big volleys thin the smoke per missile (same total puffs as ~4 missiles).
            s.puffT = 0.022 * Math.max(1, count / 4);
            const bx = s.x - Math.cos(s.ang) * 12;
            const by = s.y - Math.sin(s.ang) * 12;
            const sz = 1.1 * (0.8 + Math.random() * 0.5);
            runFx(rr, { dur: 0.6, draw: (ctx, k) => {
              const img = getNativeWeaponImage('griffin-fx-booster');
              if (!img) return;
              ctx.save();
              ctx.globalAlpha = 0.95 * (1 - k);
              const w = (9 + k * 0.6 * 16) * sz;
              cell(ctx, img, 3, 128, 128, Math.min(5, Math.floor(k * 6)), bx, by, w, w);
              ctx.restore();
            } });
          }
        },
        onHit: (rr, x, y) => {
          rr.events.push({ type: 'damage', target: rr.target, x, y, amount: per, sfx: 'p38missile', quiet: true });
          rr.events.push({ type: 'cue', key: 'missileBlast' });
          runFx(rr, { dur: 0.7, draw: (ctx, k) => {
            bloom(ctx, x, y, 135, 175, k < 0.23 ? 1 - k / 0.23 * 0.6 : Math.max(0, 0.4 - (k - 0.23) * 0.9));
            const gf = getNativeWeaponImage('griffin-fx-groundfire');
            const fh = getNativeWeaponImage('griffin-fx-firehit');
            if (gf) { ctx.save(); cell(ctx, gf, 4, 160, 160, Math.min(7, Math.floor(k * 8)), x, y + 10, 120, 120); ctx.restore(); }
            if (fh) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; cell(ctx, fh, 4, 160, 160, Math.min(15, Math.floor(k * 16)), x, y, 150, 150); ctx.restore(); }
          } });
        },
      });
    };
    const popT = (k) => 0.45 + (count > 1 ? (k / (count - 1)) * C_POP[lv] : 0);
    const steps = [];
    for (let k = 0; k < count; k++) steps.push({ t: popT(k), do: fire(k % 2 ? 2 : 1, k) });
    steps.push({ t: 1.4667, do: (r) => r.events.push({ type: 'shake', mag: 0.5 }) });
    return steps;
  },
};
