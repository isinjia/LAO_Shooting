// Original-skill run engine (Griffin format) for C specials and X bombs.
//
// A run replays one Unity skill clip on its own clock:
//  - body: the full baked clip (state `spec.clip`) is kept in sync with run time;
//  - path: the clip's root-motion keyframes (model units) mapped to screen offsets
//    from the ship's take-off spot; the landing leg blends back to the live ship;
//  - travel legs (`spec.travel`) play 1.5x faster, like Griffin's bomb run;
//  - timeline: `spec.timeline(run)` returns [{ t, do(run) }] entries fired once each,
//    built from the clip's animation events and FX m_IsActive windows;
//  - fx / shots: generic timed sheet effects and projectiles (original textures);
//  - events: damage / blast / shake / hitstop, consumed by Game each frame.
// The ship's hitbox stays home and is invulnerable while the courier is out
// (original EventEvadeCheck); gun/charge are paused until the run lands.
import { W, H, onScreen } from './canvas.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { sampleKeys, bloom, drawSheetAt, clamp01, smooth } from './run-fx.js';

const TRAVEL_SPEED = 1.5;

export function liveTargets(enemies) {
  return (enemies || []).filter((e) => e.alive && onScreen(e));
}

/** Highest-HP enemy ahead of the ship (same pick as the other target-based C skills). */
export function pickTarget(p, enemies) {
  const ahead = liveTargets(enemies).filter((e) => e.x > p.x + 50);
  return ahead.sort((a, b) => (b.hp || 0) - (a.hp || 0))[0] || null;
}

export function startRun(p, spec, opts = {}) {
  const enemies = opts.enemies || [];
  const target = spec.targeted ? pickTarget(p, enemies) : null;
  const tx = target ? target.x : p.x + (spec.defaultReach || 360);
  const ty = target ? target.y : p.y;
  // Model units -> px. Targeted runs land on the target at `spec.reachX` units.
  const k = spec.targeted
    ? Math.max(spec.kMin || 8, Math.min(spec.kMax || 18, (tx - p.x) / spec.reachX))
    : spec.k || 10;
  const run = {
    spec, kind: opts.kind || 'bomb', level: opts.level || 1,
    // spec.startAt skips the clip's lead-in (e.g. Sleipnir's C goes straight to the dashes);
    // a function gets the run level (Labiata's C swings once / twice / three times).
    t: (typeof spec.startAt === 'function' ? spec.startAt(opts.level || 1) : spec.startAt) || 0, real: 0, k, homeX: p.x, homeY: p.y, target, tx, ty,
    fired: 0, timeline: [], fx: [], shots: [], events: [], data: {}, enemies,
  };
  run.timeline = spec.timeline(run).sort((a, b) => a.t - b.t);
  p.skillRun = run;
  // Runs that leave the ship are untouchable while away (EventEvadeCheck); bombs keep
  // i-frames until 2s after the clip ends (set on finish).
  if (!spec.followShip) p.invuln = Math.max(p.invuln, spec.duration + 0.4);
  p.anim.locked = false;
  p.anim.play(spec.clip, { lock: true, restart: true });
  p.anim.time = spec.clipTime ? spec.clipTime(run.t) : run.t; // begin the body clip at the run's offset
  spec.start?.(p, run);
  return run;
}

function rate(spec, t) {
  // travel entries: [start, end] at the default 1.5x, or [start, end, speed];
  // spec.speed scales the whole run (e.g. Express C at 1.5x overall).
  const all = spec.speed || 1;
  for (const [a, b, speed] of spec.travel || []) if (t >= a && t < b) return (speed || TRAVEL_SPEED) * all;
  return all;
}

/** Root-motion position (screen) of the courier at run time t. */
export function runPos(p, run, t = run.t) {
  const spec = run.spec;
  if (spec.pos) {
    // Scripted path (e.g. Sleipnir's zone dashes / centre-line charge); null = root motion.
    const q = spec.pos(p, run, t);
    if (q) return q;
  }
  const [x, y] = sampleKeys(spec.path, t);
  const k = run.k;
  // followShip: the body rides on the (still steerable) ship instead of a fixed take-off spot.
  const baseX = spec.followShip ? p.x : run.homeX;
  const baseY = spec.followShip ? p.y : run.homeY;
  let px = baseX + x * k;
  let py = baseY - (y - spec.y0) * k * (spec.yScale ?? 1);
  if (spec.laneToTarget && run.target !== undefined) {
    // Drift toward the target's lane as she closes in (battle rows are side-on).
    const f = clamp01(x / spec.reachX);
    py += (run.ty - run.homeY) * f;
  }
  // C runs keep the courier framed (the original battle camera follows her).
  if (spec.clampX) px = Math.max(spec.clampX, Math.min(W - spec.clampX, px));
  // Landing: blend from the take-off anchor to the live ship position.
  const land = spec.landFrom ?? spec.duration;
  if (!spec.followShip && t > land) {
    const f = smooth(clamp01((t - land) / Math.max(1e-6, spec.duration - land)));
    px += (p.x - run.homeX) * f;
    py += (p.y - run.homeY) * f;
  }
  return { x: px, y: py };
}

export function runOffset(p, run, t = run.t) {
  const q = runPos(p, run, t);
  return { dx: q.x - p.x, dy: q.y - p.y };
}

/**
 * EventCameraControlSelfMultiParam "blend,offX,offY,fov": the battle camera eases to
 * `fov` over `blend` s. Mapped to a gentle zoom-in (FOV 30 = default framing; never
 * zooms out so the playfield edge stays covered). EventCameraControlStop* -> release.
 */
export function cameraEvent(t, blend, fov, focus = 'self') {
  const zoom = Math.max(1, 1 + ((30 - fov) / 30) * 0.12);
  return { t, do: (r) => r.events.push({ type: 'camera', zoom, blend, focus }) };
}
/** EventSoundPlaySFXPrefab -> original clip (assets/audio/skill/<stem>.ogg). */
export function sfxEvent(t, stem) {
  return { t, do: (r) => r.events.push({ type: 'sfx', stem }) };
}
/** Clips each character's runs use (preloaded at sortie so events play on time). */
export const SKILL_SFX = {
  // Character voice / shout clips are listed in js/voice-events.js (preloaded too).
  griffin: [],
  sleipnir: ['common_jet_whoosh', 'common_smash_3', 'common_swing_big_2'],
  lrl: ['common_bling', 'common_energy_in_aura', 'lrl_beam'],
  peregrinus: ['peregrinus_skill2_01', 'peregrinus_skill2_02', 'peregrinus_skill2_03',
    'peregrinus_bird_skill2_01', 'peregrinus_bird_skill2_02', 'peregrinus_bird_skill2_03'],
  constantia: ['common_rifle_1', 'common_hit_ice_4', 'common_hit_ice_5'],
  labiata: ['common_swing_mid', 'common_land_small'],
  express76: ['common_jet_whoosh', 'common_swing_big_2', 'common_atk_light'],
};
export function cameraStop(t, blend = 0.25) {
  return { t, do: (r) => r.events.push({ type: 'camera', zoom: 1, blend, focus: 'self' }) };
}

/** Timed sheet FX (original texture keys from run-fx SHEETS). */
export function spawnFx(run, fx) {
  run.fx.push({ age: 0, dur: 0.5, w: 120, h: 120, blend: 'lighter', ...fx });
}

/**
 * Projectile: flies from (sx,sy) to a target (enemy tracked live) or point over
 * `flight` s along an optional progress curve, then calls onHit(run, x, y).
 */
export function spawnShot(run, shot) {
  const target = shot.target ?? null;
  run.shots.push({
    age: 0, flight: 0.1, curve: null, arc: 0, ...shot, target,
    x: shot.sx, y: shot.sy,
    tx: target ? target.x : shot.tx, ty: target ? target.y : shot.ty, ang: 0,
  });
}

export function tickRun(p, dt, bullets) {
  const run = p.skillRun;
  if (!run) return;
  const spec = run.spec;
  run.t += dt * rate(spec, run.t);
  run.real += dt;
  // spec.clipTime remaps run time to clip time (holds / slow-mo on the body frames).
  if (p.anim.state === spec.clip) p.anim.time = spec.clipTime ? spec.clipTime(run.t) : Math.min(run.t, spec.duration);
  run.enemies = bullets?.targets || [];
  if (run.target && !run.target.alive) {
    // Re-acquire so late hits still land on something in front.
    run.target = pickTarget(p, run.enemies) || null;
  }
  if (run.target?.alive) {
    run.tx = run.target.x;
    run.ty = run.target.y;
  }
  while (run.fired < run.timeline.length && run.t >= run.timeline[run.fired].t) {
    run.timeline[run.fired].do(run, p);
    run.fired += 1;
  }
  tickShotsFx(run, dt);
  spec.tick?.(p, run, dt);
  // spec.detachShots: the run (body, gun lock) ends with the clip; projectiles still in
  // flight carry on as p.skillRunLeft (ticked/drawn on their own, events to Game).
  const shotsDone = spec.detachShots || !run.shots.length;
  if (run.t >= spec.duration && shotsDone && !run.fx.some((f) => f.blocking)) {
    spec.finish?.(p, run);
    // Hand the last frame's events (e.g. the final projectile hit) to Game.
    if (run.events.length) p.skillRunTail = run;
    // Explosions still playing when the clip ends (e.g. Griffin's C: the last missile lands
    // at the end, its 0.7s blast used to vanish with the run) finish as leftovers too.
    if ((spec.detachShots && run.shots.length) || run.fx.length) {
      const prev = p.skillRunLeft;
      if (!spec.detachShots) run.shots.length = 0;
      if (prev && prev !== run) {
        run.shots.push(...prev.shots);
        run.fx.push(...prev.fx);
        run.events.push(...prev.events);
      }
      run.fx = run.fx.filter((f) => !f.follow);
      p.skillRunLeft = run;
    }
    p.skillRun = null;
    // Bomb: 2s of invulnerability from the moment the clip ends.
    if (run.kind === 'bomb') p.invuln = 2;
    else if (!spec.followShip) p.invuln = Math.min(p.invuln, 0.6);
    if (p.anim.state === spec.clip) {
      p.anim.locked = false;
      p.anim.play('idle', { restart: true });
    }
  }
}

/** Detached leftovers of a finished run (spec.detachShots): shots and FX only. */
export function tickRunLeft(p, dt, bullets) {
  const run = p.skillRunLeft;
  if (!run) return;
  run.enemies = bullets?.targets || [];
  tickShotsFx(run, dt);
  if (!run.shots.length && !run.fx.length) p.skillRunLeft = null;
}

export function drawRunLeft(ctx, p) {
  const run = p.skillRunLeft;
  if (!run) return;
  drawFx(ctx, run, 'under');
  drawFx(ctx, run, 'over');
  drawShots(ctx, run);
}

function tickShotsFx(run, dt) {
  for (let i = run.shots.length - 1; i >= 0; i--) {
    const s = run.shots[i];
    if (s.prelude) {
      // Deploy first (shot.prelude {x1, y1, dur, wait}): ease out to a staging point, hover
      // nosing toward the target, then the real flight starts from there.
      const P = s.prelude;
      P.t = (P.t || 0) + dt;
      if (s.target?.alive) { s.tx = s.target.x; s.ty = s.target.y; }
      const k = Math.min(1, P.t / P.dur);
      const e = 1 - (1 - k) ** 3;
      const nx = s.sx + (P.x1 - s.sx) * e;
      const ny = s.sy + (P.y1 - s.sy) * e + (k >= 1 ? Math.sin((P.t - P.dur) * 18 + i) * 1.2 : 0);
      if (k < 0.7 && Math.hypot(nx - s.x, ny - s.y) > 0.05) s.ang = Math.atan2(ny - s.y, nx - s.x);
      else {
        const want = Math.atan2(s.ty - ny, s.tx - nx);
        const d = Math.atan2(Math.sin(want - s.ang), Math.cos(want - s.ang));
        s.ang += d * Math.min(1, dt * 12);
      }
      s.x = nx;
      s.y = ny;
      s.age = P.t;
      s.tick?.(run, s, dt);
      if (P.t >= P.dur + P.wait) {
        s.sx = s.x;
        s.sy = s.y;
        s.age = 0;
        s.prelude = null;
        s.onGo?.(run, s);
      }
      continue;
    }
    s.age += dt;
    if (s.target?.alive) {
      s.tx = s.target.x;
      s.ty = s.target.y;
    }
    const u = Math.min(1, s.age / s.flight);
    const k = s.curve ? sampleKeys(s.curve, u, 1)[0] : u;
    const nx = s.sx + (s.tx - s.sx) * k;
    const ny = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * s.arc;
    if (Math.hypot(nx - s.x, ny - s.y) > 0.05) s.ang = Math.atan2(ny - s.y, nx - s.x);
    else if (s.age <= dt) s.ang = Math.atan2(s.ty - s.sy, s.tx - s.sx);
    s.x = nx;
    s.y = ny;
    s.tick?.(run, s, dt);
    if (u >= 1) {
      s.onHit?.(run, s.x, s.y, s);
      run.shots.splice(i, 1);
    }
  }
  for (let i = run.fx.length - 1; i >= 0; i--) {
    const f = run.fx[i];
    f.age += dt;
    if (f.age >= f.dur + (f.delay || 0)) run.fx.splice(i, 1);
  }
}

function drawFx(ctx, run, layer) {
  for (const f of run.fx) {
    if ((f.layer || 'over') !== layer) continue;
    const a = f.age - (f.delay || 0);
    if (a < 0) continue;
    const k = a / f.dur;
    const x = f.follow ? f.follow.x + (f.ox || 0) : f.x;
    const y = f.follow ? f.follow.y + (f.oy || 0) : f.y;
    if (f.draw) {
      f.draw(ctx, k, x, y, f);
      continue;
    }
    const fade = f.fade ? Math.min(1, (1 - k) / f.fade) : 1;
    const grow = f.grow ? 1 + f.grow * k : 1;
    drawSheetAt(ctx, f.key, f.loop ? (k * f.loop) % 1 : k, x, y, f.w * grow, f.h * grow,
      { blend: f.blend, alpha: (f.alpha ?? 1) * fade, rot: f.rot, flip: f.flip });
  }
}

/** Layer under the body (smoke, launch blasts, exhaust). */
export function drawRunUnder(ctx, p, size) {
  const run = p.skillRun;
  if (!run) return;
  run.spec.drawUnder?.(ctx, p, run, size);
  drawFx(ctx, run, 'under');
}

/** Layer over enemies (projectiles, hits, flashes). */
export function drawRunOver(ctx, p, size) {
  const run = p.skillRun;
  if (!run) return;
  drawFx(ctx, run, 'over');
  drawShots(ctx, run);
  run.spec.drawOver?.(ctx, p, run, size);
}

function drawShots(ctx, run) {
  for (const s of run.shots) {
    if (s.draw) s.draw(ctx, s, run);
    else if (s.sprite) {
      const img = getNativeWeaponImage(s.sprite);
      if (!img) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.ang);
      ctx.globalCompositeOperation = s.blend || 'lighter';
      const w = s.w || 60;
      const h = s.h || (w * img.height) / img.width;
      ctx.drawImage(img, -w * (s.anchor ?? 0.75), -h / 2, w, h);
      ctx.restore();
      if (s.glow) bloom(ctx, s.x, s.y, s.glow, s.glow * 0.7, 0.8, s.hue);
    }
  }
}

export { bloom, drawSheetAt };
