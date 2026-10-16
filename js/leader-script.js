// Scripted midboss / boss fights (1945 II style): each leader runs a looping routine of
// attacks per HP phase. Every attack is telegraphed (charge glow / aim line), the routine
// ends in a short breather (no fire), and later phases add attacks, speed and
// movement. Attacks emit into the enemy BulletPool; all numbers are per-leader params.
import { W, H } from './canvas.js';
import { addHazard } from './leader-hazards.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shot(pool, x, y, ang, speed, o = {}) {
  return pool.spawn({
    x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    r: o.r ?? 5, color: o.color ?? '#ff6b6b', damage: 1, tint: o.color ?? null,
    accel: o.accel ?? 0, maxSpeed: o.maxSpeed ?? 0, delay: o.delay ?? 0,
  });
}
const aim = (e, p, oy = 0) => Math.atan2(p.hitY - (e.y + oy), p.hitX - e.x);

/**
 * Attack kinds. Each gets (e, s, dt, p, pool, k) where s is the attack's own state
 * (s.t = time in attack, s.n = emit counter) and k = phase intensity (1, 1.15, 1.3).
 */
const ATTACKS = {
  // N volleys of an aimed w-way fan.
  aimed(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const base = aim(e, p);
    const w = a.ways || 1;
    for (let i = 0; i < w; i++) {
      const off = w === 1 ? 0 : (i / (w - 1) - 0.5) * (a.spread || 0.3);
      shot(pool, e.x - 20, e.y, base + off, a.speed * k, { color: a.color, r: a.r });
    }
  },
  // Rotating arms (spiral) - optional counter-rotating second set.
  spiral(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    s.ang = (s.ang ?? Math.PI) + dt * a.turn * (a.dir || 1);
    if (s.cd > 0) return;
    s.cd = a.every / k;
    for (let i = 0; i < a.arms; i++) {
      shot(pool, e.x, e.y, s.ang + (TAU * i) / a.arms, a.speed * k, { color: a.color, r: a.r });
      if (a.twin) shot(pool, e.x, e.y, -s.ang + (TAU * i) / a.arms, a.speed * k * 0.85, { color: a.color2 || a.color, r: a.r });
    }
  },
  // Full ring bursts.
  ring(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    s.n = (s.n || 0) + 1;
    const off = (s.n % 2) * (Math.PI / a.count);
    for (let i = 0; i < a.count; i++) shot(pool, e.x, e.y, off + (TAU * i) / a.count, a.speed * k, { color: a.color, r: a.r });
  },
  // A wall of bullets across the field with a gap that drifts toward the player.
  curtain(e, s, dt, p, pool, k, a) {
    s.gap ??= clamp(p.hitY, 70, H - 70);
    s.gap += clamp(p.hitY - s.gap, -a.gapDrift * dt, a.gapDrift * dt);
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const step = a.step || 34;
    for (let y = 20; y < H - 10; y += step) {
      if (Math.abs(y - s.gap) < a.gap / 2) continue;
      shot(pool, e.x - 10, y, Math.PI, a.speed * k, { color: a.color, r: a.r });
    }
  },
  // Fan that sweeps up and down (a hose).
  sweep(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const ph = (s.t / a.period) * TAU;
    const ang = Math.PI + Math.sin(ph) * a.arc;
    for (let i = 0; i < (a.ways || 1); i++) {
      shot(pool, e.x - 18, e.y, ang + (i - ((a.ways || 1) - 1) / 2) * 0.12, a.speed * k, { color: a.color, r: a.r });
    }
  },
  // Grenades: slow shells that burst into a ring after a fuse.
  grenade(e, s, dt, p, pool, k, a) {
    s.live ??= [];
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd <= 0 && s.t < a.dur - a.fuse) {
      s.cd = a.every / k;
      const ang = aim(e, p) + (Math.random() - 0.5) * a.scatter;
      const b = shot(pool, e.x - 20, e.y, ang, a.speed, { color: a.color, r: 9 });
      // Bursts ~55% of the way to the player (never on top of her), so the ring is readable.
      const dist = Math.hypot(p.hitX - e.x, p.hitY - e.y);
      s.live.push({ b, t: 0, fuse: clamp((dist * 0.55) / a.speed, 0.45, a.fuse) });
    }
    for (const g of s.live) {
      g.t += dt;
      if (g.t >= g.fuse && g.b.alive && !g.done) {
        g.done = true;
        g.b.alive = false;
        for (let i = 0; i < a.burst; i++) {
          shot(pool, g.b.x, g.b.y, (TAU * i) / a.burst + g.t, a.burstSpeed * k, { color: a.color2 || a.color, r: 4.5 });
        }
      }
    }
  },
  // Lance: an aim line is shown (telegraph), then a fast straight stream down it.
  lance(e, s, dt, p, pool, k, a) {
    if (s.t < a.warn) {
      if (!s.locked) { s.ang = aim(e, p); s.locked = true; }
      e.lanceLine = { x: e.x, y: e.y, ang: s.ang, k: s.t / a.warn, color: a.color };
      return;
    }
    e.lanceLine = null;
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = 0.045;
    shot(pool, e.x - 20, e.y, s.ang, a.speed * k, { color: a.color, r: a.r ?? 6 });
    if (a.side) {
      shot(pool, e.x - 20, e.y, s.ang + a.side, a.speed * k * 0.8, { color: a.color, r: 4 });
      shot(pool, e.x - 20, e.y, s.ang - a.side, a.speed * k * 0.8, { color: a.color, r: 4 });
    }
  },
  // Ice: wide slow shards that hang, then speed up toward the left.
  freeze(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    s.n = (s.n || 0) + 1;
    for (let i = 0; i < a.ways; i++) {
      const ang = Math.PI + (i / (a.ways - 1) - 0.5) * a.spread + (s.n % 2) * 0.05;
      shot(pool, e.x - 16, e.y, ang, 40, { color: a.color, r: a.r, accel: a.accel * k, maxSpeed: a.speed * k });
    }
  },
  // Rain: bullets drop in from the top edge across the player's half, drifting left.
  rain(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const x = 60 + Math.random() * (W * 0.75);
    const top = Math.random() < 0.5;
    shot(pool, x, top ? -6 : H + 6, top ? Math.PI * 0.62 : -Math.PI * 0.62, a.speed * k, { color: a.color, r: a.r });
  },
  // ---- concept attacks (per-boss signatures). Bullets that keep changing after they are
  // fired are steered by controllers on the leader (e._ctl, ticked every frame). ----

  // Siege mortar (Hachiko / Yimir): a target mark lands on the player, then a shell bursts
  // there after `warn` s (ring + a slow centre puff). Move off the mark.
  mortar(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - a.warn) return;
    s.cd = a.every / k;
    const m = { x: clamp(p.hitX + (Math.random() - 0.5) * (a.jitter ?? 40), 40, W - 40),
      y: clamp(p.hitY + (Math.random() - 0.5) * (a.jitter ?? 40), 30, H - 30), t: 0, warn: a.warn,
      r: a.radius ?? 46, color: a.color };
    (e.marks ||= []).push(m);
    ctl(e, (c, cdt) => {
      m.t += cdt;
      if (m.t < m.warn) return false;
      e.marks = e.marks.filter((x) => x !== m);
      for (let i = 0; i < a.burst; i++) {
        shot(pool, m.x, m.y, (TAU * i) / a.burst + Math.random() * 0.3, a.burstSpeed * k, { color: a.color2 || a.color, r: 4.5 });
      }
      for (let i = 0; i < 4; i++) shot(pool, m.x, m.y, (TAU * i) / 4 + 0.4, a.burstSpeed * 0.45, { color: a.color, r: 7 });
      return true;
    });
  },
  // Rampart wall (Hachiko / Yimir): a two-row wall marches in; its door opens on the far
  // side from the player, so she has to cross the field.
  wall(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const door = p.hitY < H / 2 ? H * (0.62 + Math.random() * 0.2) : H * (0.18 + Math.random() * 0.2);
    const step = a.step || 30;
    for (let row = 0; row < 2; row++) {
      for (let y = 18; y < H - 8; y += step) {
        if (Math.abs(y - door) < a.gap / 2) continue;
        shot(pool, W + 10 + row * 22, y + row * step * 0.5, Math.PI, a.speed * k, { color: a.color, r: a.r ?? 5.5 });
      }
    }
  },
  // Blooming flower (CS Perrault): a ring whose speed follows a rose curve, so it opens as
  // a flower with `petals` petals; each bloom turns a little.
  bloom(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    s.rot = (s.rot ?? 0) + (a.turn ?? 0.35);
    for (let i = 0; i < a.count; i++) {
      const th = (TAU * i) / a.count + s.rot;
      const v = a.speed * (0.45 + 0.55 * Math.abs(Math.cos((a.petals * th) / 2)));
      shot(pool, e.x - 10, e.y, th, v * k, { color: i % 2 ? (a.color2 || a.color) : a.color, r: a.r ?? 4.5 });
    }
  },
  // Magic circle (CS Perrault): bullets gather in a spinning circle around her, then all
  // fly at the player at once.
  orbit(e, s, dt, p, pool, k, a) {
    if (s.spawned) return;
    s.spawned = true;
    const list = [];
    for (let i = 0; i < a.count; i++) {
      const b = shot(pool, e.x, e.y, 0, 0, { color: i % 2 ? (a.color2 || a.color) : a.color, r: a.r ?? 5 });
      list.push({ b, a0: (TAU * i) / a.count });
    }
    let t = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      const rad = Math.min(1, t / 0.4) * a.radius;
      const spin = t * (a.spin ?? 3);
      if (t < a.hold) {
        for (const o of list) {
          if (!o.b.alive) continue;
          o.b.x = e.x + Math.cos(o.a0 + spin) * rad;
          o.b.y = e.y + Math.sin(o.a0 + spin) * rad;
          o.b.vx = 0;
          o.b.vy = 0;
        }
        return false;
      }
      for (const o of list) {
        if (!o.b.alive) continue;
        const ang = Math.atan2(p.hitY - o.b.y, p.hitX - o.b.x) + (Math.random() - 0.5) * (a.scatter ?? 0.25);
        o.b.vx = Math.cos(ang) * a.speed * k;
        o.b.vy = Math.sin(ang) * a.speed * k;
      }
      return true;
    });
  },
  // Snowfall (Snow Feather): flakes drift down from the top edge, swaying side to side and
  // blown slowly to the left.
  snowfall(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const b = shot(pool, 40 + Math.random() * (W - 80), -8, Math.PI / 2, a.speed * k, { color: a.color, r: a.r ?? 4.5 });
    const ph = Math.random() * TAU;
    let t = 0;
    ctl(e, (c, cdt) => {
      if (!b.alive || b.y > H + 20) return true;
      t += cdt;
      b.vx = -(a.drift ?? 40) + Math.sin(t * (a.freq ?? 2.4) + ph) * (a.sway ?? 70);
      b.vy = a.speed * k;
      return false;
    });
  },
  // Icicles (Snow Feather): a burst flies out, slows to a halt and hangs, then every shard
  // re-aims at the player and shoots.
  stall(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    s.n = (s.n || 0) + 1;
    const list = [];
    for (let i = 0; i < a.count; i++) {
      const ang = Math.PI + (i / Math.max(1, a.count - 1) - 0.5) * (a.spread ?? TAU) + (s.n % 2) * 0.12;
      list.push(shot(pool, e.x - 10, e.y, ang, a.speed, { color: a.color, r: a.r ?? 5 }));
    }
    let t = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      if (t < a.stop) {
        const f = Math.max(0, 1 - cdt * (3 / a.stop));
        for (const b of list) { b.vx *= f; b.vy *= f; }
        return false;
      }
      if (t < a.stop + a.hold) {
        for (const b of list) { b.vx = 0; b.vy = 0; }
        return false;
      }
      for (const b of list) {
        if (!b.alive) continue;
        const ang = Math.atan2(p.hitY - b.y, p.hitX - b.x);
        b.vx = Math.cos(ang) * a.speed2 * k;
        b.vy = Math.sin(ang) * a.speed2 * k;
        if (a.color2) b.color = a.color2;
      }
      return true;
    });
  },
  // Dark homing orbs (Black Lilith): slow orbs that turn toward the player for `home` s,
  // then fly straight on.
  homing(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    for (let i = 0; i < (a.ways || 1); i++) {
      const ang = aim(e, p) + (i - ((a.ways || 1) - 1) / 2) * 0.8;
      const b = shot(pool, e.x - 16, e.y, ang, a.speed * k, { color: a.color, r: a.r ?? 7 });
      let t = 0;
      ctl(e, (c, cdt) => {
        t += cdt;
        if (!b.alive || t > a.home) return true;
        const cur = Math.atan2(b.vy, b.vx);
        let want = Math.atan2(p.hitY - b.y, p.hitX - b.x) - cur;
        while (want > Math.PI) want -= TAU;
        while (want < -Math.PI) want += TAU;
        const turn = clamp(want, -a.turn * cdt, a.turn * cdt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur + turn) * sp;
        b.vy = Math.sin(cur + turn) * sp;
        return false;
      });
    }
  },
  // Pincer (Black Lilith): streams pour in from the top and bottom edges ahead of the
  // player, aimed at her, closing like a mirror.
  pincer(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const x = clamp(p.hitX + 120 + Math.random() * 260, 80, W - 40);
    for (const y of [-6, H + 6]) {
      const ang = Math.atan2(p.hitY - y, p.hitX - x);
      for (let i = 0; i < (a.chain || 3); i++) shot(pool, x, y, ang, a.speed * k, { color: a.color, r: a.r ?? 5, delay: i * 0.08 });
    }
  },
  // Spider web (Arachne): strands and rings of bullets are laid around her and hang, then
  // the whole web expands outward.
  web(e, s, dt, p, pool, k, a) {
    if (s.spawned) return;
    s.spawned = true;
    const ox = e.x - 20;
    const oy = e.y;
    const list = [];
    for (let i = 0; i < a.strands; i++) {
      const ang = Math.PI + (i / (a.strands - 1) - 0.5) * a.spread;
      for (let d = 40; d <= a.length; d += a.spacing) {
        list.push(shot(pool, ox + Math.cos(ang) * d, oy + Math.sin(ang) * d, ang, 0, { color: a.color, r: 4 }));
      }
    }
    for (const rr of a.rings || []) {
      const n = Math.max(2, Math.round((rr * a.spread) / 26));
      for (let i = 0; i <= n; i++) {
        const ang = Math.PI + (i / n - 0.5) * a.spread;
        list.push(shot(pool, ox + Math.cos(ang) * rr, oy + Math.sin(ang) * rr, ang, 0, { color: a.color2 || a.color, r: 4 }));
      }
    }
    let t = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      if (t < a.hold) {
        for (const b of list) { b.vx = 0; b.vy = 0; }
        return false;
      }
      for (const b of list) {
        if (!b.alive) continue;
        const ang = Math.atan2(b.y - oy, b.x - ox);
        b.vx = Math.cos(ang) * a.speed * k;
        b.vy = Math.sin(ang) * a.speed * k;
      }
      return true;
    });
  },
  // Feather crescents (Roc): both wings throw a crescent of feathers toward the player;
  // feathers start slow and accelerate.
  feather(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    for (const side of [-1, 1]) {
      const wx = e.x + 6;
      const wy = e.y + side * (a.wing ?? 60);
      const base = Math.atan2(p.hitY - wy, p.hitX - wx);
      for (let i = 0; i < a.ways; i++) {
        const off = (i / (a.ways - 1) - 0.5) * a.spread;
        shot(pool, wx, wy, base + off, 50, { color: i % 2 ? (a.color2 || a.color) : a.color, r: 4.5,
          accel: a.accel * k, maxSpeed: a.speed * k, delay: Math.abs(off) * 0.25 });
      }
    }
  },
  // ---- area attacks (leader-hazards.js): warn, then a live area, no bullets ----

  // Laser: `count` beams from the leader, aimed at the player (fanned over `spread`), warn
  // then fire for `life` s; `spin` turns them while live (alternating sides). `cross`:
  // instead, field-wide lines through points near the player (slashes / web strands).
  laser(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - (a.warn ?? 0.6) * 0.5) return;
    s.cd = (a.every ?? a.dur) / k;
    s.n = (s.n || 0) + 1;
    const n = a.count || 1;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i / (n - 1) - 0.5) * (a.spread ?? 0.6) : 0;
      if (a.cross) {
        const ang = Math.random() * Math.PI;
        const cx = p.hitX + (Math.random() - 0.5) * (a.jitter ?? 120);
        const cy = p.hitY + (Math.random() - 0.5) * (a.jitter ?? 120);
        addHazard(e, { kind: 'beam', x: cx - Math.cos(ang) * 900, y: cy - Math.sin(ang) * 900, ang, len: 1800,
          width: a.width ?? 16, warn: a.warn ?? 0.7, life: a.life ?? 0.25, color: a.color });
        continue;
      }
      addHazard(e, { kind: 'beam', x: e.x - 20, y: e.y, ang: aim(e, p) + off, follow: true,
        width: a.width ?? 22, warn: a.warn ?? 0.7, life: a.life ?? 0.6,
        // Fanned beams sweep outward; a single beam alternates direction per volley.
        spin: (a.spin ?? 0) * (off < 0 ? -1 : 1) * (n > 1 ? 1 : (s.n % 2 ? 1 : -1)),
        color: a.color });
    }
  },
  // Lightning: bolts strike down the screen near the player (vertical), or across it
  // (`horizontal`), `count` per volley spaced `spacing` px apart.
  lightning(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - (a.warn ?? 0.6) * 0.5) return;
    s.cd = a.every / k;
    s.n = (s.n || 0) + 1;
    const n = a.count || 1;
    const hor = a.horizontal === true || (a.horizontal === 'alt' && s.n % 2 === 0);
    const c = hor ? p.hitY : p.hitX;
    const sp = a.spacing ?? 90;
    const shift = (Math.random() - 0.5) * sp;
    for (let i = 0; i < n; i++) {
      const v = c + shift + (i - (n - 1) / 2) * sp;
      if (hor) {
        if (v < 10 || v > H - 10) continue;
        addHazard(e, { kind: 'bolt', x0: -10, y0: v, x1: W + 10, y1: v, width: a.width ?? 20,
          warn: a.warn ?? 0.7, life: a.life ?? 0.22, color: a.color });
      } else {
        if (v < 10 || v > W - 10) continue;
        addHazard(e, { kind: 'bolt', x0: v, y0: -10, x1: v, y1: H + 10, width: a.width ?? 20,
          warn: a.warn ?? 0.7, life: a.life ?? 0.22, color: a.color });
      }
    }
  },
  // Meteors / shells: `count` impacts land near the player (and `scatter` random spots);
  // each falls in from the upper right during `warn`, then blasts radius `r`.
  meteor(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - (a.warn ?? 0.9) * 0.5) return;
    s.cd = a.every / k;
    const n = a.count || 1;
    for (let i = 0; i < n; i++) {
      const near = i === 0 || Math.random() > (a.scatter ?? 0.4);
      const x = near ? clamp(p.hitX + (Math.random() - 0.5) * (a.jitter ?? 80), 30, W - 30) : 40 + Math.random() * (W * 0.6);
      const y = near ? clamp(p.hitY + (Math.random() - 0.5) * (a.jitter ?? 80), 30, H - 30) : 40 + Math.random() * (H - 80);
      const warn = (a.warn ?? 0.9) + i * (a.stagger ?? 0.12);
      const h = addHazard(e, { kind: 'meteor', x, y, r: a.r ?? 40, warn, life: a.life ?? 0.2,
        fx: x + 260 + Math.random() * 120, fy: -80, color: a.color, color2: a.color2, core: a.core });
      if (a.shards) {
        // Debris: a small ring of bullets from the impact.
        ctl(e, () => {
          if (h.t < h.warn) return false;
          for (let j = 0; j < a.shards; j++) shot(pool, h.x, h.y, (TAU * j) / a.shards + Math.random() * 0.4, (a.shardSpeed ?? 120) * k, { color: a.color2 || a.color, r: 4 });
          return true;
        });
      }
    }
  },
  // Ground spikes (ice / rock): a row erupts from the leader toward the player's position,
  // one spike every `gap` s, `step` px apart; `rows` fans extra rows around the aim.
  spike(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.6) return;
    s.cd = a.every / k;
    const rows = a.rows || 1;
    const base = aim(e, p);
    for (let r = 0; r < rows; r++) {
      const ang = base + (rows > 1 ? (r / (rows - 1) - 0.5) * (a.fan ?? 0.6) : 0);
      const n = a.count ?? 9;
      for (let i = 0; i < n; i++) {
        const d = 70 + i * (a.step ?? 64);
        const x = e.x + Math.cos(ang) * d;
        const y = e.y + Math.sin(ang) * d;
        if (x < -20 || y < -20 || y > H + 20) break;
        addHazard(e, { kind: 'spike', x, y, r: a.r ?? 26, warn: (a.warn ?? 0.5) + i * (a.gap ?? 0.07),
          life: a.life ?? 0.35, color: a.color, color2: a.color2 });
      }
    }
  },
  // ---- one-owner signature attacks (every leader's patterns are its own) ----

  // Nidhogg - flamethrower: a fire cone from the jaws, aimed where the player was (the
  // warning shows exactly the area that burns; `sweep` > 0 swings it).
  breath(e, s, dt, p, pool, k, a) {
    if (s.spawned) return;
    s.spawned = true;
    addHazard(e, { kind: 'cone', x: e.x - 30, y: e.y, ang: aim(e, p) - (a.sweep ?? 0) / 2,
      half: a.half ?? 0.22, len: a.len ?? 760, warn: a.warn ?? 0.8, life: a.life ?? 1.1,
      spin: (a.sweep ?? 0) / (a.life ?? 1.1), follow: true, color: a.color, color2: a.color2 });
  },
  // Glacias - crystal shatter: big slow crystals drift at the player, then split into shards.
  shatter(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.8) return;
    s.cd = a.every / k;
    const n = a.count || 2;
    for (let i = 0; i < n; i++) {
      const ang = aim(e, p) + (i - (n - 1) / 2) * 0.35;
      const b = shot(pool, e.x - 20, e.y, ang, a.speed * k, { color: a.color, r: a.r ?? 11 });
      let t = 0;
      ctl(e, (c, cdt) => {
        t += cdt;
        if (!b.alive) return true;
        if (t < (a.fuse ?? 0.9)) return false;
        b.alive = false;
        for (let j = 0; j < a.shards; j++) {
          shot(pool, b.x, b.y, (TAU * j) / a.shards + t, a.shardSpeed * k, { color: a.color2 || a.color, r: 4 });
        }
        return true;
      });
    }
  },
  // Goltarion - chain whip: a chain of bullets swings round him in an arc, then flies loose.
  chainwhip(e, s, dt, p, pool, k, a) {
    if (s.spawned) return;
    s.spawned = true;
    const links = [];
    for (let i = 0; i < a.links; i++) links.push(shot(pool, e.x, e.y, 0, 0, { color: i % 3 ? a.color : (a.color2 || a.color), r: a.r ?? 5.5 }));
    const start = aim(e, p) - a.arc / 2 * (Math.random() < 0.5 ? 1 : -1);
    const dir = start < aim(e, p) ? 1 : -1;
    let t = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      const u = Math.min(1, t / a.swing);
      const ang = start + dir * a.arc * u;
      for (let i = 0; i < links.length; i++) {
        const b = links[i];
        if (!b.alive) continue;
        const d = 40 + i * a.spacing;
        b.x = e.x + Math.cos(ang) * d;
        b.y = e.y + Math.sin(ang) * d;
        // Release: fly off tangentially (the far end fastest).
        if (u >= 1) {
          const sp = (a.speed * (0.5 + i / links.length)) * k;
          b.vx = Math.cos(ang + dir * Math.PI / 2) * sp * 0.5 + Math.cos(ang) * sp;
          b.vy = Math.sin(ang + dir * Math.PI / 2) * sp * 0.5 + Math.sin(ang) * sp;
        } else { b.vx = 0; b.vy = 0; }
      }
      return u >= 1;
    });
  },
  // Goltarion - quake: rock columns burst up from the ground, marching toward the player.
  quake(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.8) return;
    s.cd = a.every / k;
    const n = a.count ?? 8;
    for (let i = 0; i < n; i++) {
      const x = e.x - 90 - i * (a.step ?? 80);
      if (x < 10) break;
      addHazard(e, { kind: 'column', x, w: a.w ?? 46, top: a.top ?? H * 0.35, warn: (a.warn ?? 0.55) + i * (a.gap ?? 0.09),
        life: a.life ?? 0.35, color: a.color, color2: a.color2 });
    }
  },
  // Satgat - sword slashes: thin lines cut across the whole field through the player.
  slash(e, s, dt, p, pool, k, a) {
    ATTACKS.laser(e, s, dt, p, pool, k, { ...a, cross: true });
  },
  // Hachiko - buckshot: a short-range cannon shotgun, pellets of mixed speed.
  buckshot(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    const base = aim(e, p);
    for (let i = 0; i < a.pellets; i++) {
      const ang = base + (Math.random() - 0.5) * a.spread;
      shot(pool, e.x - 30, e.y + 6, ang, a.speed * (0.65 + Math.random() * 0.5) * k, { color: i % 2 ? a.color : (a.color2 || a.color), r: 4 });
    }
  },
  // CS Perrault - cat claws: three parallel claw marks rake across the player.
  claw(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.6) return;
    s.cd = a.every / k;
    const ang = (Math.random() < 0.5 ? 0.85 : 2.29) + (Math.random() - 0.5) * 0.3;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const len = a.len ?? 360;
    for (let i = -1; i <= 1; i++) {
      const cx = p.hitX + nx * i * (a.gapPx ?? 34);
      const cy = p.hitY + ny * i * (a.gapPx ?? 34);
      addHazard(e, { kind: 'beam', x: cx - Math.cos(ang) * len / 2, y: cy - Math.sin(ang) * len / 2, ang, len,
        width: a.width ?? 10, warn: (a.warn ?? 0.6) + (i + 1) * 0.06, life: 0.16, color: a.color });
    }
  },
  // Snow Feather - blizzard gusts: snow streams in from the right edge in wavy lanes.
  gust(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    s.lane = (s.lane ?? Math.random() * H);
    s.lane = (s.lane + 137) % (H - 60) + 30;
    const b = shot(pool, W + 10, s.lane, Math.PI, a.speed * k, { color: a.color, r: a.r ?? 4 });
    const y0 = s.lane;
    const ph = Math.random() * TAU;
    let t = 0;
    ctl(e, (c, cdt) => {
      if (!b.alive || b.x < -20) return true;
      t += cdt;
      b.y = y0 + Math.sin(t * (a.freq ?? 3) + ph) * (a.amp ?? 40);
      b.vy = 0;
      return false;
    });
  },
  // Snow Feather - aurora: a slow ribbon of light (a sine band of bullets) drifts left.
  aurora(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0) return;
    s.cd = a.every / k;
    s.ph = (s.ph ?? 0) + (a.shift ?? 0.55);
    for (let y = 26; y < H - 20; y += a.step ?? 30) {
      const off = Math.sin(y / 70 + s.ph) * 60;
      shot(pool, e.x - 40 + off, y, Math.PI, a.speed * k, { color: (y / (a.step ?? 30)) % 2 < 1 ? a.color : (a.color2 || a.color), r: 4 });
    }
  },
  // Black Lilith - curse sigils: rune circles open under the player, then erupt.
  sigil(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - (a.warn ?? 0.9) * 0.6) return;
    s.cd = a.every / k;
    for (let i = 0; i < (a.count || 1); i++) {
      const x = clamp(p.hitX + (i ? (Math.random() - 0.5) * 260 : 0), 40, W - 40);
      const y = clamp(p.hitY + (i ? (Math.random() - 0.5) * 200 : 0), 40, H - 40);
      addHazard(e, { kind: 'sigil', x, y, r: a.r ?? 54, warn: (a.warn ?? 0.9) + i * 0.15, life: a.life ?? 0.35, color: a.color, color2: a.color2 });
    }
  },
  // Yimir - girders: steel beams drop from the top in columns across the field.
  girder(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.8) return;
    s.cd = a.every / k;
    const n = a.count || 3;
    const shift = (Math.random() - 0.5) * (a.spacing ?? 150);
    for (let i = 0; i < n; i++) {
      const x = clamp(p.hitX + shift + (i - (n - 1) / 2) * (a.spacing ?? 150), 20, W - 20);
      addHazard(e, { kind: 'bolt', style: 'girder', x0: x, y0: -10, x1: x, y1: H + 10, width: a.width ?? 30,
        warn: (a.warn ?? 0.75) + i * 0.08, life: a.life ?? 0.3, color: a.color });
    }
  },
  // Yimir - drill: a drill bit flies out, stops, and spins out rings while it grinds.
  drill(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 1.0) return;
    s.cd = a.every / k;
    const b = shot(pool, e.x - 30, e.y, aim(e, p), a.speed * k, { color: a.color, r: 12 });
    let t = 0;
    let n = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      if (!b.alive) return true;
      if (t < (a.travel ?? 0.6)) return false;
      b.vx *= 0.8; b.vy *= 0.8;
      const step = Math.floor((t - (a.travel ?? 0.6)) / 0.16);
      while (n <= step && n < (a.rings ?? 5)) {
        for (let j = 0; j < a.count; j++) shot(pool, b.x, b.y, (TAU * j) / a.count + n * 0.21, a.ringSpeed * k, { color: a.color2 || a.color, r: 4 });
        n += 1;
      }
      if (n >= (a.rings ?? 5)) { b.alive = false; return true; }
      return false;
    });
  },
  // Yimir - barricade tape: two or three hazard lines snap across the field; one lane is open.
  barricade(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.8) return;
    s.cd = a.every / k;
    const lanes = a.lanes ?? 5;
    const h = H / lanes;
    const open = clamp(Math.floor(p.hitY / h) + (Math.random() < 0.5 ? -1 : 1), 0, lanes - 1);
    for (let i = 0; i < lanes; i++) {
      if (i === open) continue;
      const y = h * (i + 0.5);
      addHazard(e, { kind: 'bolt', style: 'tape', x0: -10, y0: y, x1: W + 10, y1: y, width: a.width ?? 22,
        warn: a.warn ?? 0.85, life: a.life ?? 0.3, color: a.color });
    }
  },
  // Arachne - cocoon: a ring of silk bullets closes in on where the player stands.
  cocoon(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.8) return;
    s.cd = a.every / k;
    const cx = p.hitX;
    const cy = p.hitY;
    const list = [];
    for (let i = 0; i < a.count; i++) {
      const ang = (TAU * i) / a.count;
      list.push({ b: shot(pool, cx + Math.cos(ang) * a.radius, cy + Math.sin(ang) * a.radius, 0, 0, { color: a.color, r: 4.5 }), ang });
    }
    let t = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      if (t < (a.hold ?? 0.8)) { for (const o of list) { o.b.vx = 0; o.b.vy = 0; } return false; }
      for (const o of list) {
        if (!o.b.alive) continue;
        o.b.vx = -Math.cos(o.ang) * a.speed * k;
        o.b.vy = -Math.sin(o.ang) * a.speed * k;
      }
      return true;
    });
  },
  // Arachne - spider eggs: eggs are laid in a row across the field, then hatch one by one.
  eggs(e, s, dt, p, pool, k, a) {
    if (s.spawned) return;
    s.spawned = true;
    const eggs = [];
    const n = a.count ?? 6;
    for (let i = 0; i < n; i++) {
      const x = e.x - 120 - i * ((e.x - 160) / n);
      const y = clamp(p.hitY + Math.sin(i * 1.7) * 120, 50, H - 50);
      eggs.push({ b: shot(pool, x, y, 0, 0, { color: a.color, r: 10 }), at: (a.hatch ?? 1.0) + i * (a.gap ?? 0.18) });
    }
    let t = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      let left = 0;
      for (const g of eggs) {
        if (g.done) continue;
        if (!g.b.alive) { g.done = true; continue; }
        g.b.vx = 0; g.b.vy = 0;
        if (t < g.at) { left += 1; continue; }
        g.done = true;
        g.b.alive = false;
        for (let j = 0; j < a.brood; j++) shot(pool, g.b.x, g.b.y, (TAU * j) / a.brood + t, a.speed * k, { color: a.color2 || a.color, r: 4 });
      }
      return left === 0;
    });
  },
  // Roc - tornado: a whirlwind (bullets orbiting a moving eye) crosses the field.
  tornado(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.5) return;
    s.cd = a.every / k;
    const eye = { x: e.x - 40, y: e.y };
    const target = aim(e, p);
    const list = [];
    for (let i = 0; i < a.count; i++) list.push(shot(pool, eye.x, eye.y, 0, 0, { color: i % 2 ? a.color : (a.color2 || a.color), r: 4.5 }));
    let t = 0;
    ctl(e, (c, cdt) => {
      t += cdt;
      eye.x += Math.cos(target) * a.speed * k * cdt;
      eye.y += Math.sin(target) * a.speed * k * cdt;
      const rad = Math.min(1, t / 0.4) * a.radius;
      let alive = 0;
      list.forEach((b, i) => {
        if (!b.alive) return;
        alive += 1;
        const ang = (TAU * i) / list.length + t * (a.spin ?? 6);
        b.x = eye.x + Math.cos(ang) * rad;
        b.y = eye.y + Math.sin(ang) * rad * 1.3;
        b.vx = 0; b.vy = 0;
      });
      if (eye.x < -80 || eye.y < -80 || eye.y > H + 80 || !alive) { for (const b of list) b.alive = false; return true; }
      return false;
    });
  },
  // Roc - dive: a huge swooping shadow sweeps across the player's row.
  dive(e, s, dt, p, pool, k, a) {
    s.cd = (s.cd ?? 0) - dt;
    if (s.cd > 0 || s.t > a.dur - 0.8) return;
    s.cd = a.every / k;
    const y = clamp(p.hitY, 40, H - 40);
    addHazard(e, { kind: 'bolt', style: 'swoop', x0: -10, y0: y, x1: W + 10, y1: y, width: a.width ?? 62,
      warn: a.warn ?? 0.8, life: a.life ?? 0.32, color: a.color, color2: a.color2 });
  },
};

/** Leader-owned bullet controllers (steered bullets): fn(c, dt) returns true when done. */
function ctl(e, fn) {
  (e._ctl ||= []).push({ fn });
}

/** Movement styles while attacking. */
const MOVES = {
  hold(e, dt) {},
  drift(e, dt, p, m) {
    e._mv = (e._mv || 0) + dt;
    const ty = H * 0.5 + Math.sin(e._mv * (m.speed || 0.8)) * (m.amp || 120);
    e.y += (ty - e.y) * Math.min(1, dt * 2);
  },
  track(e, dt, p, m) {
    const ty = clamp(p.hitY, 70, H - 70);
    e.y += clamp(ty - e.y, -(m.speed || 90) * dt, (m.speed || 90) * dt);
  },
  swoop(e, dt, p, m) {
    // Big figure-eight across the right third (x and y).
    e._mv = (e._mv || 0) + dt * (m.speed || 0.6);
    const ty = H * 0.5 + Math.sin(e._mv * 2) * (m.amp || 150);
    const tx = W - 210 + Math.cos(e._mv) * (m.ampX || 90);
    e.y += (ty - e.y) * Math.min(1, dt * 2.5);
    e.x += (tx - e.x) * Math.min(1, dt * 2.5);
  },
  // Roc: hovers tracking the player, then every `period` s rushes left across the field and
  // swoops back.
  rush(e, dt, p, m) {
    e._rush = (e._rush || 0) + dt;
    const period = m.period || 5;
    const t = e._rush % period;
    const home = W - 200;
    const go = m.go || 0.7;
    const back = m.back || 1.0;
    const t0 = period - go - back;
    let tx = home;
    if (t > t0 && t <= t0 + go) tx = home + (m.reach - home) * Math.sin(((t - t0) / go) * Math.PI / 2);
    else if (t > t0 + go) tx = m.reach + (home - m.reach) * Math.sin(((t - t0 - go) / back) * Math.PI / 2);
    e.x += (tx - e.x) * Math.min(1, dt * 6);
    const ty = clamp(p.hitY, 70, H - 70);
    e.y += clamp(ty - e.y, -(m.speed || 110) * dt, (m.speed || 110) * dt);
  },
};

/** Longest skill-animation wind-up before a signature attack fires (s). */
const SKILL_WIND = 1.0;

export class LeaderScript {
  /** def = { phases: [{ hp, move, attacks: [...] }], rest, telegraph } */
  constructor(def) {
    this.def = def;
    this.phase = -1;
    this.i = 0;
    this.state = null;
    this.mode = 'enter';
    this.t = 0;
  }

  /** Play the attack's skill clip (if the leader has it); returns the wind-up length. */
  _startSkillAnim(e, A, tele) {
    const clip = A.anim || this.def.phases[Math.max(0, this.phase)]?.skills?.[A.type] || this.def.skills?.[A.type];
    const anim = e.anim;
    if (!clip || !anim?.clips?.[clip]?.length || (clip === 'attack' && !anim.hasAttack)
      || (clip === 'skill2' && !anim.hasSkill2)) return tele;
    const hit = anim.hitTime?.[clip] ?? 0.5;
    // Long wind-ups are cut from the front of the clip (max SKILL_WIND s before release).
    const wind = Math.max(tele, Math.min(hit, SKILL_WIND));
    anim.locked = false;
    anim.play(clip, { lock: true });
    anim.time = Math.max(0, hit - wind);
    return wind;
  }

  _phaseFor(e) {
    const r = e.hp / e.maxHp;
    let ph = 0;
    this.def.phases.forEach((d, i) => { if (r <= d.hp) ph = i; });
    return ph;
  }

  tick(e, dt, p, pool) {
    const def = this.def;
    // Steered bullets keep running through rests / phase breaks.
    if (e._ctl?.length) e._ctl = e._ctl.filter((c) => !c.fn(c, dt));
    // Entry: glide in from the right before the routine starts.
    const homeX = def.homeX ?? (e.kind === 'boss' ? W - 200 : W - 175);
    if (this.mode === 'enter') {
      e.x += (homeX - e.x) * Math.min(1, dt * 1.6);
      e.y += (H * 0.5 - e.y) * Math.min(1, dt * 1.6);
      if (Math.abs(e.x - homeX) < 8) { this.mode = 'tele'; this.t = 0; this.phase = this._phaseFor(e); }
      return;
    }
    const ph = this._phaseFor(e);
    if (ph !== this.phase) {
      // Phase break: short invulnerable-looking flash and a breather, then new routine.
      this.phase = ph;
      this.i = 0;
      this.mode = 'break';
      this._wind = null;
      this.t = 0;
      e.hitFlash = 0.6;
      e.lanceLine = null;
    }
    const P = def.phases[this.phase];
    const k = 1 + this.phase * 0.14;
    (MOVES[P.move?.kind || 'drift'])(e, dt, p, P.move || {});
    if (e.kind !== 'boss') e.x += (homeX - e.x) * Math.min(1, dt * 0.8) * (P.move?.kind === 'swoop' ? 0 : 1);
    this.t += dt;
    if (this.mode === 'break') {
      e.telegraph = 0;
      if (this.t >= 1.1) { this.mode = 'tele'; this.t = 0; }
      return;
    }
    if (this.mode === 'rest') {
      // Short breather after a full routine (no fire).
      e.telegraph = 0;
      if (this.t >= (def.rest ?? 1.3)) { this.mode = 'tele'; this.t = 0; }
      return;
    }
    const A = P.attacks[this.i];
    if (this.mode === 'tele') {
      // Charge glow before every attack. Signature attacks play the leader's own skill
      // animation (def.skills: attack type -> 'attack' (skill1) / 'skill2'); the wind-up
      // lasts until the clip's original release frame, so the pattern fires on it.
      if (this._wind == null) this._wind = this._startSkillAnim(e, A, def.telegraph ?? 0.5);
      e.telegraph = this.t / this._wind;
      e.telegraphColor = A.color;
      if (this.t >= this._wind) { this.mode = 'fire'; this.t = 0; this.state = { t: 0 }; e.telegraph = 0; this._wind = null; }
      return;
    }
    // fire
    this.state.t += dt;
    ATTACKS[A.type](e, this.state, dt, p, pool, k, A);
    if (this.state.t >= A.dur) {
      e.lanceLine = null;
      this.i += 1;
      this.t = 0;
      if (this.i >= P.attacks.length) { this.i = 0; this.mode = 'rest'; } else this.mode = 'tele';
    }
  }
}

// Leader routines live in leader-routines.js.
export { LEADER_SCRIPTS } from './leader-routines.js';
