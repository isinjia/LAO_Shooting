// Constantia (3P_ConstantiaS2_N) skills as runs (skill-run.js).
//
// C = Attack_01.anim (2.67s, anim_skill1): three rifle shots (EventThrowProjectileFire1
// FX_bullet_Gun_ConstantiaS2 at 0.36 / 0.87 / 1.37s, near-hitscan 0.1s), muzzle flash
// Constantia_fire one frame later, Constantia_hit on the target. Fired in place, so she
// stays steerable (like Griffin's C).
// X = Attack_02.anim (2.82s, anim_skill2), with the bomb redesigned by request: a pack of
// Bori (the original fx_Hit_bori dog, baked frames) - one per on-screen enemy, at least 6 -
// streams in from off the left edge from 0.62s and homes onto its assigned enemy, bursting
// on contact (Constantia_bort_hit). Leaders soak the extras (mobs get one each); repeat
// bites on one enemy deal 100% / 50% / 25% ... of the bomb. She hops back and goes prone
// (time scale 0.1 at 1.38-1.45s); her snipe round is left out by request (no shot/flash/SFX).
// FX / Bori: original textures (tools/import-constantia-fx.py), SFX: original clips.
import { W, H } from './canvas.js';
import { bloom, drawSheetAt } from './run-fx.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { SKILL_ATLAS } from './skill-body-atlas.js';
import { spawnFx, spawnShot, cameraEvent, cameraStop, sfxEvent, runPos, liveTargets } from './skill-run.js';

/** Rifle muzzle in front of her body. */
function muzzleAt(p, r, dx = 0.5, dy = -0.04) {
  const q = runPos(p, r);
  return { x: q.x + dx * p.drawSize, y: q.y + dy * p.drawSize };
}

/** Thin stretched tracer (shot.png, Unity scale 1.39 x 0.046) from muzzle to impact. */
function tracer(r, sx, sy, tx, ty, width = 9) {
  spawnFx(r, { dur: 0.14, draw: (ctx, k) => {
    const img = getNativeWeaponImage('constantia-fx-tracer');
    const len = Math.hypot(tx - sx, ty - sy);
    const fade = 1 - k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(sx, sy);
    ctx.rotate(Math.atan2(ty - sy, tx - sx));
    ctx.globalAlpha = fade;
    if (img) ctx.drawImage(img, 0, -width / 2, len, width);
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.fillRect(len * 0.3, -1, len * 0.7, 2);
    ctx.restore();
  } });
}

function rifleHit(r, x, y, scale = 1) {
  spawnFx(r, { key: 'constantia-fx-hit', x, y, w: 110 * scale, h: 160 * scale, dur: 0.35 });
  spawnFx(r, { key: 'constantia-fx-hitsmoke', x: x + 6, y, w: 130 * scale, h: 130 * scale, dur: 0.5,
    blend: 'source-over', alpha: 0.7 });
  spawnFx(r, { key: 'constantia-fx-hitline', x, y, w: 150 * scale, h: 80 * scale, dur: 0.25 });
  spawnFx(r, { dur: 0.25, draw: (ctx, k) => bloom(ctx, x, y, 60 * scale, 46 * scale, 1 - k) });
}

function muzzleFlash(r, p, dx, dy) {
  spawnFx(r, { dur: 0.36, draw: (ctx, k) => {
    const m = muzzleAt(p, r, dx, dy);
    drawSheetAt(ctx, 'constantia-fx-muzzle', k, m.x + 18, m.y, 90, 90);
    drawSheetAt(ctx, 'constantia-fx-muzzlering', k, m.x + 6, m.y, 70, 70, { alpha: 0.7 });
    if (k < 0.5) bloom(ctx, m.x + 6, m.y, 44, 34, 1 - k * 2);
  } });
}

// ------------------------------------------------------------------ C (Attack_01)
const C_END = 2.1667; // baked Attack_01 body (53 frames @24fps)
const C_SHOTS = [0.36, 0.8667, 1.3667];

export const CONSTANTIA_C = {
  clip: 'skill1', duration: C_END, y0: 0, path: [[0, 0, 0], [C_END, 0, 0]],
  targeted: true, reachX: 30, landFrom: C_END,
  // Fires from where she stands: the ship stays steerable during the C.
  followShip: true,
  timeline(run) {
    const list = [];
    C_SHOTS.forEach((t) => {
      list.push(sfxEvent(t, 'common_rifle_1'));
      list.push({ t, do: (r, p) => {
        const m = muzzleAt(p, r);
        const tgt = r.target?.alive ? r.target : null;
        const tx = tgt ? tgt.x : m.x + 420;
        const ty = tgt ? tgt.y : m.y;
        r.events.push({ type: 'shake', mag: 0.25 });
        spawnShot(r, { sx: m.x, sy: m.y, tx, ty, target: tgt, flight: 0.1, draw: () => {},
          onHit: (rr, x, y) => {
            tracer(rr, m.x, m.y, x, y);
            rr.events.push({ type: 'damage', target: rr.target, x, y, amount: (rr.level * 6) / C_SHOTS.length });
            rr.events.push({ type: 'sfx', stem: 'common_hit_ice_4' });
            rifleHit(rr, x, y);
          } });
      } });
      // FX/skill1/Constantia_fire: one frame after the shot.
      list.push({ t: t + 0.0067, do: (r, p) => muzzleFlash(r, p, 0.5, -0.04) });
    });
    return list;
  },
};

// ------------------------------------------------------------------ X (Attack_02)
const X_END = 2.8167;
const BORI_FPS = 24.1304;
// game px per bake px: bake canvas = 16 units / 768 px; Constantia's sprite scale is
// ~7.4 px per model unit, so the ~14-unit dog is ~104 px like in the original.
const BORI_SCALE = 7.4 / 48;
// fx_Hit_bori clip times used for the pack (all fully materialised by LO_bori_hide):
// gallop loop 1.2333-1.3833s, pounce 1.3833-1.5167s, then the hexagon dissolve 1.55-1.85s.
const GALLOP = [1.2333, 1.3833];
const POUNCE = [1.3833, 1.5167];
const DISSOLVE = [1.55, 1.85];

/** Draw the baked Bori frame for fx_Hit_bori clip time `ct` centred at (x, y). */
function drawBoriFrame(ctx, ct, x, y, ang = 0) {
  const at = SKILL_ATLAS['constantia-bori'];
  const page = at && getNativeWeaponImage(at.pages[0]);
  if (!page) return;
  const f = at.frames[Math.min(at.frames.length - 1, Math.floor(ct * BORI_FPS))];
  if (!f) return;
  const [, sx, sy, w, h, ox, oy] = f;
  const s = BORI_SCALE;
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.drawImage(page, sx, sy, w, h, (ox - 384) * s, (oy - 384) * s, (w / at.k) * s, (h / at.k) * s);
  ctx.restore();
}

/**
 * Bomb targets (user rules): one Bori per on-screen enemy, at least 6. With a boss or
 * midboss on screen, every other enemy gets exactly one and all the rest go to the
 * leader(s); otherwise every enemy is hit at least once and the extras are random.
 * No enemies: the pack bursts on random spots across the field.
 */
function assignBori(enemies, fixed = 0) {
  const live = liveTargets(enemies);
  const n = fixed || Math.max(6, live.length);
  if (!live.length) return Array.from({ length: n }, () => null);
  const leaders = live.filter((e) => e.kind === 'boss' || e.kind === 'midboss');
  const mobs = live.filter((e) => !leaders.includes(e));
  const out = [];
  if (fixed) {
    // Special (fixed pack size): leaders first, then the nearest mobs, one each; wrap
    // around (leaders first) when there are more Bori than enemies.
    const order = [...leaders, ...mobs.sort((a, b) => a.x - b.x)];
    for (let i = 0; out.length < n; i++) out.push(order[i % order.length]);
  } else if (leaders.length) {
    out.push(...mobs);
    for (let i = 0; out.length < n; i++) out.push(leaders[i % leaders.length]);
  } else {
    out.push(...live);
    while (out.length < n) out.push(live[Math.floor(Math.random() * live.length)]);
  }
  // Shuffle the launch order so the hits interleave.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function launchBori(r, idx, target) {
  const sy = 70 + Math.random() * (H - 140);
  const sx = -80 - Math.random() * 60;
  const tx = target ? target.x : W * (0.35 + Math.random() * 0.55);
  const ty = target ? target.y : 70 + Math.random() * (H - 140);
  const dist = Math.hypot(tx - sx, ty - sy);
  const phase = Math.random();
  spawnShot(r, {
    sx, sy, tx, ty, target, flight: Math.max(0.45, dist / 780),
    arc: (Math.random() - 0.5) * 120,
    tick(rr, s) {
      // Homing: a Bori whose target died re-locks onto a live one (boss first).
      if (s.target && !s.target.alive) {
        const live = liveTargets(rr.enemies || []);
        const lead = live.filter((e) => e.kind === 'boss' || e.kind === 'midboss');
        const pool = lead.length ? lead : live;
        s.target = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      }
    },
    draw(ctx, s) {
      const u = Math.min(1, s.age / s.flight);
      // Gallop while closing in, pounce over the last stretch (original clip frames).
      const ct = u < 0.72
        ? GALLOP[0] + ((s.age * 1.0 + phase * (GALLOP[1] - GALLOP[0])) % (GALLOP[1] - GALLOP[0]))
        : POUNCE[0] + (POUNCE[1] - POUNCE[0]) * ((u - 0.72) / 0.28);
      drawBoriFrame(ctx, ct, s.x, s.y, Math.max(-0.6, Math.min(0.6, s.ang)));
    },
    onHit(rr, x, y, s) {
      const e = s.target?.alive ? s.target : null;
      if (e) {
        // Diminishing bites on the same enemy: 100%, 50%, 25%, ...
        const k = rr.data.bites.get(e) || 0;
        rr.data.bites.set(e, k + 1);
        if (rr.kind === 'special') {
          // Special: every bite deals its full share (the halving rule is the bomb's).
          rr.events.push({ type: 'damage', target: e, x, y, amount: rr.data.biteDmg });
        } else {
          rr.events.push({ type: 'blastEnemy', enemy: e, scale: 0.5 ** k });
        }
      }
      rr.events.push({ type: 'shake', mag: 0.35 });
      if (rr.t - (rr.data.lastSfx || 0) > 0.08) {
        rr.data.lastSfx = rr.t;
        rr.events.push({ type: 'sfx', stem: 'common_hit_ice_5' });
      }
      // Constantia_bort_hit (bite + DrM burst + boom glow) and Bori's hexagon dissolve.
      spawnFx(rr, { key: 'constantia-fx-bite', x, y, w: 150, h: 120, dur: 0.6 });
      spawnFx(rr, { key: 'constantia-fx-bitehit', x, y, w: 190, h: 165, dur: 0.54 });
      spawnFx(rr, { dur: 0.15, draw: (ctx, k) => bloom(ctx, x, y, 110, 80, 1 - k) });
      const ang = Math.max(-0.6, Math.min(0.6, s.ang));
      spawnFx(rr, { dur: DISSOLVE[1] - DISSOLVE[0], bori: true, draw: (ctx, k, fx0, fy0, f) =>
        drawBoriFrame(ctx, DISSOLVE[0] + (DISSOLVE[1] - DISSOLVE[0]) * k, f.bx ?? x + 30 * k, f.by ?? y, f.ba ?? ang) });
    },
  });
}

const C_BORI = [0, 2, 5, 10];

export const CONSTANTIA_X = {
  clip: 'skill2', duration: X_END, y0: 0, path: [[0, 0, 0], [X_END, 0, 0]],
  // Her hop back / prone snipe is in the baked frames (skillCamera places them in idle space).
  targeted: true, reachX: 30, landFrom: X_END,
  timeline(run) {
    // (timeline() runs before start(): assign the pack here.)
    run.data.bites = new Map();
    // Special: 2 / 5 / 10 Bori by C level, sharing the C budget (6 per level).
    const fixed = run.kind === 'special' ? C_BORI[Math.max(1, Math.min(3, run.level))] : 0;
    run.data.pack = assignBori(run.enemies || [], fixed);
    if (fixed) run.data.biteDmg = (run.level * 6) / fixed;
    const list = [];
    // The pack leaves from 0.62s (fx_Hit_bori mesh on), staggered so they stream in.
    run.data.pack.forEach((target, i) => {
      list.push({ t: 0.6167 + i * 0.07, do: (r) => launchBori(r, i, target) });
    });
    // (Her snipe round at 1.02s is left out by request: nothing leaves the rifle; the
    // Bori pack is the whole attack.)
    // EventTimeScale 0.1 (1.38-1.45s): brief slow-mo.
    list.push({ t: 1.3833, do: (r) => r.events.push({ type: 'hitstop', t: 0.07 }) });
    return list;
  },
};

// ------------------------------------------------------------------ C (snipe)
// By request the C is a snipe: Attack_02 body (hop back, prone) and its original single
// round at 1.02s. One shot from the rifle, Lv1 3 / Lv2 8 / Lv3 15 targets struck at once.
// Fewer enemies than shots: the extra shots stack on the targets (leaders first) with
// diminishing damage (1, 1/2, 1/3 ... of a snipe), shown as a "x2", "x3" lock-on and a
// bigger impact. Damage: SNIPE_DMG per snipe (x the pilot's specialMul in Game).
const SNIPE_T = 1.0167;
const SNIPE_COUNT = [0, 3, 8, 15];
const SNIPE_DMG = 2;
const SNIPE_RED = '#ff4d5e';

/** Spread `n` snipes over the live enemies: leaders / highest HP first, then stack. */
function assignSnipes(enemies, n) {
  const live = liveTargets(enemies).sort((a, b) => {
    const la = a.kind === 'boss' || a.kind === 'midboss' ? 1 : 0;
    const lb = b.kind === 'boss' || b.kind === 'midboss' ? 1 : 0;
    return lb - la || (b.hp || 0) - (a.hp || 0);
  });
  const stacks = new Map();
  if (!live.length) return stacks;
  for (let i = 0; i < n; i++) {
    const e = live[i % live.length];
    stacks.set(e, (stacks.get(e) || 0) + 1);
  }
  return stacks;
}

/** Lock-on reticle that closes onto its target until the shot; "xN" for stacked shots. */
function lockOn(r, e, k, delay) {
  spawnFx(r, { dur: SNIPE_T - delay, draw: (ctx, t) => {
    if (!e.alive) return;
    const rad = (e.hitR || 22) * (2.4 - 1.4 * Math.min(1, t * 1.25)) + 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = SNIPE_RED;
    ctx.globalAlpha = 0.35 + 0.55 * t;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(e.x, e.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 + t * 1.2;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * rad * 0.55, e.y + Math.sin(a) * rad * 0.55);
      ctx.lineTo(e.x + Math.cos(a) * rad * 1.25, e.y + Math.sin(a) * rad * 1.25);
      ctx.stroke();
    }
    if (k > 1) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '700 15px "Chakra Petch", sans-serif';
      ctx.textAlign = 'left';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,4,8,0.85)';
      ctx.strokeText(`x${k}`, e.x + rad * 0.8, e.y - rad * 0.8);
      ctx.fillStyle = '#ffd2d7';
      ctx.fillText(`x${k}`, e.x + rad * 0.8, e.y - rad * 0.8);
    }
    ctx.restore();
  } });
}

/**
 * Snipe impact: shattering glass, drawn as vector shapes (stays crisp at any size; the
 * stretched sprite hits broke up when stacked). Flash + shock ring, zig-zag cracks that
 * snap out and linger, and tumbling triangular shards that fly off and fall, glinting.
 * k = shots stacked on this target: longer / more cracks, more and bigger shards.
 */
function glassShatter(r, x, y, k = 1) {
  const s = 1 + 0.18 * (k - 1);
  const cracks = [];
  const nCrack = Math.min(14, 6 + 2 * k);
  for (let i = 0; i < nCrack; i++) {
    const a0 = (i / nCrack) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const len = (26 + Math.random() * 18) * s;
    const pts = [[0, 0]];
    let a = a0;
    const segs = 3;
    for (let j = 1; j <= segs; j++) {
      a += (Math.random() - 0.5) * 0.6;
      const d = len * (j / segs);
      pts.push([Math.cos(a) * d, Math.sin(a) * d]);
    }
    // A side branch on some cracks.
    const br = Math.random() < 0.5 ? pts[2] : null;
    const ba = a0 + (Math.random() < 0.5 ? 0.7 : -0.7);
    cracks.push({ pts, br, bx: br ? br[0] + Math.cos(ba) * len * 0.35 : 0, by: br ? br[1] + Math.sin(ba) * len * 0.35 : 0 });
  }
  const shards = [];
  const nShard = Math.min(30, 9 + 4 * k);
  for (let i = 0; i < nShard; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (110 + Math.random() * 170) * (0.85 + 0.15 * s);
    const size = (3.5 + Math.random() * 6.5) * s;
    shards.push({
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 18,
      p: [[size, 0], [-size * 0.6, size * (0.4 + Math.random() * 0.5)], [-size * 0.5, -size * (0.3 + Math.random() * 0.5)]],
      glint: Math.random() * 6.3,
    });
  }
  const dur = 0.62;
  spawnFx(r, { dur, draw: (ctx, t) => {
    const time = t * dur;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    // Impact flash + shock ring.
    if (time < 0.12) {
      const f = 1 - time / 0.12;
      ctx.globalAlpha = f * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, (10 + 16 * (1 - f)) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    if (time < 0.32) {
      const f = time / 0.32;
      ctx.globalAlpha = (1 - f) * 0.8;
      ctx.strokeStyle = GLASS_EDGE;
      ctx.lineWidth = 2.2 * (1 - f) + 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, (12 + 46 * f) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cracks: snap out in 0.06 s, hold, fade by 0.45 s.
    const grow = Math.min(1, time / 0.06);
    const crackA = time < 0.25 ? 1 : Math.max(0, 1 - (time - 0.25) / 0.2);
    if (crackA > 0) {
      ctx.lineJoin = 'miter';
      for (const pass of [[3.2, 0.25, GLASS_EDGE], [1.1, 0.95, '#ffffff']]) {
        ctx.lineWidth = pass[0];
        ctx.globalAlpha = crackA * pass[1];
        ctx.strokeStyle = pass[2];
        ctx.beginPath();
        for (const c of cracks) {
          ctx.moveTo(0, 0);
          for (let j = 1; j < c.pts.length; j++) {
            const q = Math.min(1, grow * c.pts.length - j + 1);
            if (q <= 0) break;
            const [px, py] = c.pts[j - 1];
            const [nx, ny] = c.pts[j];
            ctx.lineTo(px + (nx - px) * q, py + (ny - py) * q);
          }
          if (c.br && grow >= 1) {
            ctx.moveTo(c.br[0], c.br[1]);
            ctx.lineTo(c.bx, c.by);
          }
        }
        ctx.stroke();
      }
    }
    // Shards: tumble out, fall, glint, fade.
    const shardA = Math.max(0, 1 - Math.max(0, time - 0.2) / (dur - 0.2));
    for (const sh of shards) {
      const px = sh.vx * time;
      const py = sh.vy * time + 0.5 * 520 * time * time;
      const rot = sh.rot + sh.spin * time;
      const gl = 0.5 + 0.5 * Math.sin(sh.glint + time * 26);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.globalAlpha = shardA * (0.35 + 0.4 * gl);
      ctx.fillStyle = GLASS_FILL;
      ctx.beginPath();
      ctx.moveTo(sh.p[0][0], sh.p[0][1]);
      ctx.lineTo(sh.p[1][0], sh.p[1][1]);
      ctx.lineTo(sh.p[2][0], sh.p[2][1]);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = shardA * (0.55 + 0.45 * gl);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } });
}
const GLASS_EDGE = '#8fdcff';
const GLASS_FILL = 'rgba(200,236,255,0.9)';

export const CONSTANTIA_SP = {
  clip: 'skill2', duration: X_END, y0: 0, path: [[0, 0, 0], [X_END, 0, 0]],
  targeted: true, reachX: 30,
  // Fires from where she stands: the ship stays steerable and is not invulnerable.
  followShip: true,
  timeline(run) {
    const n = SNIPE_COUNT[Math.max(1, Math.min(3, run.level))];
    run.data.snipes = assignSnipes(run.enemies || [], n);
    const list = [];
    // Lock-ons appear one after another while she drops prone.
    [...run.data.snipes.entries()].forEach(([e, k], i) => {
      const delay = 0.15 + Math.min(0.5, i * 0.035);
      list.push({ t: delay, do: (r) => lockOn(r, e, k, delay) });
    });
    list.push(sfxEvent(SNIPE_T, 'common_rifle_1'));
    list.push({ t: SNIPE_T, do: (r, p) => {
      // Targets that died meanwhile hand their shots to the survivors (still stacking).
      let stacks = r.data.snipes;
      if ([...stacks.keys()].some((e) => !e.alive)) stacks = assignSnipes(r.enemies || [], n);
      const m = muzzleAt(p, r, 0.42, 0.1);
      r.events.push({ type: 'shake', mag: 0.6 });
      muzzleFlash(r, p, 0.42, 0.1);
      let first = true;
      for (const [e, k] of stacks) {
        if (first) tracer(r, m.x, m.y, e.x, e.y, 12);
        first = false;
        for (let j = 1; j <= k; j++) {
          r.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: SNIPE_DMG / j });
        }
        // Shattering glass, bigger with each stacked round.
        glassShatter(r, e.x, e.y, k);
      }
      r.events.push({ type: 'sfx', stem: 'common_hit_ice_4' });
    } });
    // EventTimeScale 0.1 (1.38-1.45s): brief slow-mo after the shot.
    list.push({ t: 1.3833, do: (r) => r.events.push({ type: 'hitstop', t: 0.07 }) });
    return list;
  },
};
