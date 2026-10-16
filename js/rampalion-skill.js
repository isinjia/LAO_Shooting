// Rampalion (CT66 Rampart, "램파리온 커스텀 팩") original skills as runs (skill-run.js).
//
// C by level (user):
// Lv1 = skill_1: the wings fan out and fold forward into a blade-lance in front of the fist;
// the lance flies off ahead, strikes what it passes and comes back (user: no laser). The sheet
// keeps the clip's window around its release (pack_sprite_sheets SKILL_PRE / SKILL_POST:
// 1.92-4.78s of the 7.4s clip); times below are in that sheet clip.
// Lv2 a mid-size fire lion, Lv3 Shining Hand (briefly gold, grabs the target, it burns white
// and blows up with a big blast around it). See RAMPALION_C2 / C3 at the end.
// X = skill_2 as a "HEAVEN AND HELL" parody (user): see RAMPALION_X below.
import { W, H, onScreen } from './canvas.js';
import { bloom, drawSheetAt, drawCell, clamp01, SHEETS } from './run-fx.js';
import { spawnFx, runOffset, pickTarget } from './skill-run.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { HYPER_GOLD, rampRestBody, bonePoint, rampSkillBody } from './rampalion.js';

// The lance at its hold frame (sheet t 1.1 = clip frame 72), screen rect from the body's draw
// centre in drawSize units: x 0.116..0.421, y -0.162..0.023 (bake idle space 480..708 x 270..408).
const C_HOLD = 1.1; // the lance is formed in front of the fist: the clip holds here
const C_OUT = 1.2; // it shoots off
const C_FAR = 1.65; // farthest point
const C_BACK = 2.15; // back on the wrist
const C_END = 2.45;
const LANCE = { x0: 0.116, x1: 0.421, y0: -0.162, y1: 0.023 };
const LANCE_RANGE = 460; // px

function lanceDx(t) {
  if (t < C_OUT || t >= C_BACK) return 0;
  if (t < C_FAR) return LANCE_RANGE * easeOut((t - C_OUT) / (C_FAR - C_OUT));
  return LANCE_RANGE * (1 - easeIn((t - C_FAR) / (C_BACK - C_FAR)));
}
/** The lance's screen rect on the body (dx = 0) or out in flight. */
function lanceRect(p, run, dx = 0) {
  const s = p.drawSize || 100;
  const o = runOffset(p, run);
  const cx = p.x + o.dx + (p.drawOffsetX || 0);
  const cy = p.y + o.dy + (p.drawOffsetY || 0);
  return { x: cx + LANCE.x0 * s + dx, y: cy + LANCE.y0 * s, w: (LANCE.x1 - LANCE.x0) * s, h: (LANCE.y1 - LANCE.y0) * s };
}

/** Whirlwind round the spinning fist (user): swirl rings around its axis, trailing behind. */
function drawFistVortex(ctx, L, size, t) {
  const cx = L.x + L.w * 0.55;
  const cy = L.y + L.h / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const x = cx - i * size * 0.11;
    const ry = L.h * (0.75 - i * 0.08);
    const rx = size * (0.06 - i * 0.006);
    const ph = t * Math.PI * 2 * 4 + i * 0.9;
    const a = 0.85 - i * 0.15;
    for (const [col, w, off] of [['255,214,140', 4, 0], ['255,255,240', 1.6, 0.25]]) {
      ctx.strokeStyle = `rgba(${col},${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, ph + off, ph + off + Math.PI * 1.15);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const RAMPALION_C1 = {
  // skill_1 is loaded as the 'attack' state (clip-anim.js), played up to the lance and held.
  clip: 'attack', duration: C_END, y0: 0, path: [[0, 0, 0], [C_END, 0, 0]],
  // Steerable while it fights, no i-frames (C without i-frames fills its gauge faster).
  followShip: true,
  speed: 1.2,
  clipTime: (t) => Math.min(t, C_HOLD),
  // While the lance is off, the body is drawn without it (rampalion.js drawRampalionSkill).
  bodyCut: (p, run) => (lanceDx(run.t) > 1 ? lanceRect(p, run) : null),
  start(p, run) {
    run.data.out = new Set();
    run.data.back = new Set();
  },
  timeline() {
    return [
      // Original skill_1 sounds (tools/import-rampalion-sfx.py): the sheet starts at clip 1.917 s,
      // where robot_03_skill1_NS1 plays; the lance / arm takes off with enemy_06_skill1_01.
      { t: 0, do: (r) => r.events.push({ type: 'sfx', stem: 'rampalion_skill1' }) },
      { t: C_OUT, do: (r) => { r.events.push({ type: 'shake', mag: 0.8 }); r.events.push({ type: 'sfx', stem: 'rampalion_launch' }); } },
      { t: C_FAR, do: (r) => r.events.push({ type: 'sfx', stem: 'rampalion_swing' }) },
      { t: C_BACK, do: (r) => { r.events.push({ type: 'shake', mag: 0.5 }); r.events.push({ type: 'cue', key: 'hz:fall' }); } },
    ];
  },
  tick(p, run) {
    // The flying lance strikes everything it passes, once out and once on the way back
    // (C budget 6/12/18 per level on a target hit both ways).
    const dx = lanceDx(run.t);
    if (dx <= 1) return;
    const L = lanceRect(p, run, dx);
    const out = run.t < C_FAR;
    const done = out ? run.data.out : run.data.back;
    for (const e of run.enemies) {
      if (!e.alive || e.dying || done.has(e) || !onScreen(e)) continue;
      const r = e.hitR || 18;
      if (e.x < L.x - r || e.x > L.x + L.w + r || e.y < L.y - r || e.y > L.y + L.h + r) continue;
      done.add(e);
      run.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: run.level * (out ? 4 : 2) });
      run.events.push({ type: 'cue', key: 'missileBlast' });
      spawnFx(run, { key: 'lao-fx-airboom', x: e.x - 10, y: e.y, w: 110, h: 110, dur: 0.35 });
    }
  },
  drawOver(ctx, p, run, size) {
    const dx = lanceDx(run.t);
    if (dx <= 1) return;
    const L = lanceRect(p, run, dx);
    const ly = L.y + L.h / 2;
    // Exhaust streak behind it.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tail = Math.min(dx, size * 1.2);
    const g = ctx.createLinearGradient(L.x, 0, L.x - tail, 0);
    g.addColorStop(0, 'rgba(255,220,150,0.7)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(L.x - tail / 2, ly, tail / 2, L.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    bloom(ctx, L.x, ly, size * 0.25, size * 0.18, 0.7);
    // The lance (Hyper) / the arm (plain) itself: the body frame clipped to its rect, carried
    // forward. Plain Rampalion's fist spins as it flies (user): flipped up and down over and
    // over about its middle.
    const o = runOffset(p, run);
    // The whirlwind goes behind the fist so the arm itself reads (user: only the whirlwind showed).
    if (!p._ramp?.hyper) drawFistVortex(ctx, L, size, run.t);
    ctx.save();
    if (!p._ramp?.hyper) {
      // The fist flies 1.5x its size, spinning (flipped over and over, never flatter than 40%).
      const cx = L.x + L.w / 2;
      const cy = L.y + L.h / 2;
      const c = Math.cos(run.t * Math.PI * 2 * 4);
      ctx.translate(cx, cy);
      ctx.scale(1.5, 1.5 * (c < 0 ? Math.min(-0.4, c) : Math.max(0.4, c)));
      ctx.translate(-cx, -cy);
    }
    ctx.beginPath();
    ctx.rect(L.x, L.y, L.w, L.h);
    ctx.clip();
    // A fused arm part swaps the body for a variant without Rampalion's own arm, which left
    // only the whirlwind flying (user): the arm then comes from the full body clip.
    const armOff = p._ramp?.slots?.some((e) => e.attached && e.slot.replaces === 'arm');
    (armOff ? p.anim : rampSkillBody(p)).draw(ctx, p.x + o.dx + (p.drawOffsetX || 0) + dx, p.y + o.dy + (p.drawOffsetY || 0), size, { flipX: p.facing < 0 });
    ctx.restore();
  },
};

// X: "HEAVEN AND HELL" parody (user): skill_2 thrusts the hand out and holds it; an
// electromagnetic tornado shoots down the lane, catching and rooting what is in it; the giant
// lion flies off the hand down the tornado; Rampalion then turns Hyper (gold) and glows white while
// two lights (gold = hell, green = heaven) circle in and merge inside it; it bursts forward
// like a flash of light through everything, shouting HEAVEN AND HELL, and flies back in.
const X_HAND = 0.75; // skill_2 sheet time with the hand out (held)
// While it glows (user): skill_1 from the start of the sheet clip (full-clip frame 46) to the
// crouch with the wings folded in front (frame 60) = sheet frames 0..7 @ 12 fps, then held.
const GLOW_POSE_TIME = 7 / 12;
/**
 * Original skill2 lion (Lion_Rampart_lion_main_aura, 3 x 3: mouth shut -> roaring), white
 * art tinted like its particle start colour (orange 1,0.24,0.04 .. 1,0.61,0.25). Cached.
 */
const _lionTint = {};
function tintedSheet(key, col) {
  const id = key + col;
  if (_lionTint[id]) return _lionTint[id];
  const img = getNativeWeaponImage(key);
  if (!img || !(img.naturalWidth || img.width)) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.9;
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  _lionTint[id] = c;
  return c;
}

const X_TORNADO = 0.75; // the electromagnetic tornado shoots down the lane (user: keep it)
const TORNADO_HALF = 120; // px: catch radius around the lane
const PALM_X = 0.38; // palm of the skill_2 hand-out pose, x drawSize units ahead of the body
const PALM_Y = -12; // px
const VORTEX_X = 0.72; // where the tornado gathers the field (screen fraction)
const X_LION = 2.15; // the lion leaves the hand, riding the tornado (1 s later - user)
const LION_TIME = 0.9;
const X_GLOW = 2.75; // turns Hyper, starts glowing; the two lights circle in
const X_MERGE = 3.65; // the lights become one
const X_DASH = 3.8; // bursts forward
const DASH_TIME = 0.32;
const X_BACK = X_DASH + DASH_TIME + 0.45; // flies back in from the left
const BACK_TIME = 0.55;
const X_END = X_BACK + BACK_TIME + 0.1;
const DASH_HALF = 130; // px: what the charge runs through around its row
const CHANT = ['겜…', '기르…', '간…', '고…', '구포…!!'];

const easeIn = (k) => k * k;
const easeOut = (k) => 1 - (1 - k) ** 3;

/**
 * Light rays round (x, y): n soft tapered beams of length len, turned by rot. width = beam
 * half-angle (rad) at the root; with t, each beam flickers on its own phase.
 */
function sunRays(ctx, x, y, len, n, rot, rgb, alpha, width, t = null) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2 + (i % 2 ? 0.13 : 0);
    const f = t === null ? 1 : 0.55 + 0.45 * Math.sin(t * (13 + (i % 5) * 3) + i * 1.9) ** 2;
    const L = len * (i % 2 ? 0.7 : 1) * (t === null ? 1 : 0.75 + 0.25 * f);
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    g.addColorStop(0, `rgba(${rgb},${alpha * f})`);
    g.addColorStop(0.35, `rgba(${rgb},${alpha * 0.55 * f})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - width) * L * 0.15, Math.sin(a - width) * L * 0.15);
    ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
    ctx.lineTo(Math.cos(a + width) * L * 0.15, Math.sin(a + width) * L * 0.15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** One cell of an original FX sheet (run-fx SHEETS grid), optionally tinted, centred + rotated. */
function fxCell(ctx, key, frame, x, y, w, h, { tint = null, rot = 0, alpha = 1, blend = 'lighter' } = {}) {
  const img = tint ? tintedSheet(key, tint) : getNativeWeaponImage(key);
  const sh = SHEETS[key];
  if (!img || !sh || alpha <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  drawCell(ctx, img, sh.cols, sh.cell, sh.cell, ((frame % sh.n) + sh.n) % sh.n, 0, 0, w, h);
  ctx.restore();
}

/**
 * The fire lion (bomb / C Lv2): a soft flame wake back to startX, the skill2 lion sheet
 * (mouth shut -> roaring over k 0..1) and a light glow. L = { x, y }, s = its size in px.
 */
function drawFireLion(ctx, L, s, fade, k, startX) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const tailX = Math.max(startX, L.x - s * 2.2);
  // Flame wake: soft on every edge (a horizontal-only gradient cut a hard line - user).
  const tcx = (tailX + L.x) / 2;
  const trx = Math.max(1, (L.x - tailX) / 2 + 1);
  const tr = s * 0.34;
  ctx.save();
  ctx.translate(tcx, L.y);
  ctx.scale(trx / tr, 1);
  const g = ctx.createRadialGradient(tr * 0.35, 0, 0, 0, 0, tr);
  g.addColorStop(0, `rgba(255,150,60,${0.35 * fade})`);
  g.addColorStop(0.6, `rgba(255,110,30,${0.18 * fade})`);
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, tr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  bloom(ctx, L.x - s * 0.6, L.y, s * 0.5, s * 0.35, 0.35 * fade);
  ctx.restore();
  // Skill2 fire lion (9 cells, mouth shut -> roaring as it runs): the body drawn normally
  // in deep orange so the face reads (additive washed it to white), a light glow on top.
  const frame = Math.min(8, Math.floor(k * 9));
  const body = tintedSheet('ramp-fx-lion', '#e8420e');
  const glow = tintedSheet('ramp-fx-lion', '#ffb04a');
  const ring = tintedSheet('ramp-fx-lioncenter', '#ffb24a');
  const ls = s * 1.5;
  ctx.save();
  ctx.globalAlpha = fade;
  // The face is negative space in the art (eyes / fangs / mane lines are holes in the
  // flame): a dark ember backing behind the head makes it read instead of showing the
  // tornado / bloom through it.
  const back = ctx.createRadialGradient(L.x + ls * 0.08, L.y + ls * 0.05, 0, L.x + ls * 0.08, L.y + ls * 0.05, ls * 0.3);
  back.addColorStop(0, 'rgba(90,14,4,0.95)');
  back.addColorStop(0.7, 'rgba(120,24,6,0.85)');
  back.addColorStop(1, 'rgba(120,24,6,0)');
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.arc(L.x + ls * 0.08, L.y + ls * 0.05, ls * 0.3, 0, Math.PI * 2);
  ctx.fill();
  if (body) drawCell(ctx, body, 3, 384, 384, frame, L.x, L.y, ls, ls);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.28 * fade;
  if (glow) drawCell(ctx, glow, 3, 384, 384, frame, L.x, L.y, ls, ls);
  ctx.globalAlpha = 0.8 * fade;
  if (ring) drawCell(ctx, ring, 3, 384, 384, frame, L.x - ls * 0.15, L.y, ls * 0.9, ls * 0.9);
  ctx.restore();
}

export const RAMPALION_X = {
  clip: 'skill2', duration: X_END, y0: 0, path: [[0, 0, 0], [X_END, 0, 0]],
  // Bomb i-frames from startRun; the hand stays out for the whole move.
  clipTime: (t) => Math.min(X_HAND, t),
  pos(p, run, t) {
    const s = p.drawSize || 100;
    if (t >= X_DASH && t < X_DASH + DASH_TIME) {
      const k = easeIn((t - X_DASH) / DASH_TIME);
      return { x: run.homeX + (W + s * 2 - run.homeX) * k, y: run.homeY };
    }
    if (t >= X_DASH + DASH_TIME && t < X_BACK) return { x: W + s * 2, y: run.homeY };
    if (t >= X_BACK) {
      const e = easeOut(Math.min(1, (t - X_BACK) / BACK_TIME));
      return { x: -s + (p.x + s) * e, y: run.homeY + (p.y - run.homeY) * e };
    }
    return null;
  },
  // The charge: skill_1's lance-punch pose with the lance kept on the wrist (user: in the
  // original it flies off the arm), held until it is back home.
  bodyAnim(p, run) {
    if (run.t >= X_GLOW && run.t < X_DASH && p.anim.hasAttack) {
      // A view of the body clips playing skill_1 (the run's own skill2 clock stays as is).
      const s1 = (run.data.s1 ||= Object.create(p.anim));
      s1.state = 'attack';
      s1.locked = true;
      s1.keepWing = true; // the wings dropped on for the bomb stay on
      s1.time = GLOW_POSE_TIME * Math.min(1, (run.t - X_GLOW) / (X_MERGE - X_GLOW));
      return s1;
    }
    if (run.t < X_DASH) return null;
    const a = p._ramp?.anims?.fx_ramp_dashpose;
    if (a) { a.state = 'idle'; a.time = 0; }
    return a || null;
  },
  bodyFilter(p, run) {
    const t = run.t;
    if (t < X_GLOW || t >= X_BACK + BACK_TIME) return null;
    const ramp = Math.min(1, (t - X_GLOW) / (X_MERGE - X_GLOW));
    const out = t > X_DASH + DASH_TIME ? Math.max(0, 1 - (t - X_DASH - DASH_TIME) / 0.4) : 1;
    return { filter: HYPER_GOLD, glow: (0.25 + 0.6 * ramp + (t >= X_MERGE && t < X_DASH + 0.1 ? 0.3 : 0)) * out };
  },

  start(p, run) {
    run.data.caught = new Set();
    run.data.lane = p.y + PALM_Y;
    run.data.lionHit = new Set();
    run.data.dashHit = new Set();
    run.data.lion = null;
  },
  timeline() {
    return [
      { t: 0, do: (r) => { r.events.push({ type: 'cue', key: 'charge' }); r.events.push({ type: 'sfx', stem: 'rampalion_charge' }); } },
      { t: X_TORNADO - 0.1, do: (r) => r.events.push({ type: 'sfx', stem: 'rampalion_skill2' }) },
      { t: X_TORNADO, do: (r, p) => {
        r.data.lane = p.y + PALM_Y;
        r.events.push({ type: 'clearBullets' });
        r.events.push({ type: 'shake', mag: 1.2 });
        r.events.push({ type: 'cue', key: 'laserFire' });
        r.events.push({ type: 'cue', key: 'hz:bolt' });
        spawnFx(r, { key: 'lao-fx-shockring', x: p.x + 60, y: r.data.lane, w: 240, h: 240, dur: 0.4 });
      } },
      { t: X_LION - 0.05, do: (r) => r.events.push({ type: 'sfx', stem: 'rampalion_launch' }) },
      { t: X_LION, do: (r, p) => {
        r.data.lion = { x0: p.x + (p.drawSize || 100) * PALM_X, y: r.data.lane, t: 0 };
        r.events.push({ type: 'shake', mag: 1.4 });
        r.events.push({ type: 'hitstop', t: 0.05 });
        r.events.push({ type: 'cue', key: 'leaderBlast' });
        spawnFx(r, { key: 'lao-fx-shockring', x: p.x + 60, y: p.y, w: 240, h: 240, dur: 0.4 });
      } },
      { t: X_GLOW, do: (r) => { r.events.push({ type: 'cue', key: 'laserFire' }); r.events.push({ type: 'sfx', stem: 'rampalion_light' }); } },
      { t: X_MERGE, do: (r, p) => {
        r.events.push({ type: 'flash', t: 0.12 });
        r.events.push({ type: 'cue', key: 'hz:bolt' });
        spawnFx(r, { key: 'lao-fx-shockring', x: p.x, y: p.y, w: 300, h: 300, dur: 0.35 });
      } },
      { t: X_DASH, do: (r) => {
        r.events.push({ type: 'clearBullets' });
        r.events.push({ type: 'flash', t: 0.22 });
        r.events.push({ type: 'shake', mag: 2.2 });
        r.events.push({ type: 'hitstop', t: 0.06 });
        r.events.push({ type: 'cue', key: 'leaderBlast' });
        r.events.push({ type: 'cue', key: 'missileBlast' });
      } },
    ];
  },
  tick(p, run, dt) {
    // Tornado (user): sucks EVERY enemy on screen into one point on the right of the lane.
    // Leaders are rooted where they stand (their routines own their position).
    const vx = W * VORTEX_X;
    const vy = run.data.lane;
    if (run.t >= X_TORNADO && run.t < X_DASH + DASH_TIME) {
      for (const e of run.enemies) {
        if (!e.alive || e.dying || !onScreen(e)) continue;
        run.data.caught.add(e);
        e.boriRootFor = Math.max(e.boriRootFor || 0, 0.5);
        if (e.kind === 'boss' || e.kind === 'midboss') continue;
        const f = Math.min(1, dt * 3.2);
        // Spiral in: pull + a swirl around the point.
        const dx = vx - e.x;
        const dy = vy - e.y;
        e.x += dx * f - dy * f * 0.35;
        e.y += dy * f + dx * f * 0.35 * 0.4;
      }
    }
    // The lion: no damage - everything it touches is frozen solid until the charge lands.
    const L = run.data.lion;
    if (L && L.t <= LION_TIME) {
      L.t += dt;
      const k = Math.min(1, L.t / LION_TIME);
      L.x = L.x0 + (W + 300 - L.x0) * (k * k * 0.6 + k * 0.4);
      L.size = 0.9 + 1.7 * Math.min(1, k * 2.2);
      const front = L.x + (p.drawSize || 100) * L.size * 0.3;
      const reachY = (p.drawSize || 100) * L.size * 0.42;
      const hold = X_DASH + DASH_TIME + 0.4 - run.t;
      for (const e of run.enemies) {
        if (!e.alive || run.data.lionHit.has(e) || !onScreen(e)) continue;
        const leader = e.kind === 'boss' || e.kind === 'midboss';
        if (e.x > front || (!leader && Math.abs(e.y - L.y) > reachY + (e.hitR || 18))) continue;
        run.data.lionHit.add(e);
        e.stunFor = Math.max(e.stunFor || 0, hold);
        spawnFx(run, { key: 'lao-fx-shockring', x: e.x, y: e.y, w: 150, h: 150, dur: 0.35 });
      }
    }
    // The charge: the full bomb on everything it runs into (the frozen pack first of all).
    if (run.t >= X_DASH && run.t < X_DASH + DASH_TIME + 0.05) {
      const k = easeIn(Math.min(1, (run.t - X_DASH) / DASH_TIME));
      const front = run.homeX + (W + 200 - run.homeX) * k + (p.drawSize || 100) * 0.5;
      for (const e of run.enemies) {
        if (!e.alive || run.data.dashHit.has(e) || !onScreen(e)) continue;
        const struck = run.data.lionHit.has(e) || Math.abs(e.y - run.homeY) <= DASH_HALF + (e.hitR || 18);
        if (e.x > front || !struck) continue;
        run.data.dashHit.add(e);
        e.stunFor = 0;
        run.events.push({ type: 'blastEnemy', enemy: e, scale: 1 });
        spawnFx(run, { key: 'lao-fx-shockring', x: e.x, y: e.y, w: 220, h: 220, dur: 0.4 });
        spawnFx(run, { key: 'lao-fx-airboom', x: e.x, y: e.y, w: 200, h: 200, dur: 0.45 });
      }
    }
  },
  drawUnder(ctx, p, run, size) {
    // White-gold aura while it glows.
    const t = run.t;
    if (t < X_GLOW || t >= X_DASH) return;
    const ramp = Math.min(1, (t - X_GLOW) / (X_MERGE - X_GLOW));
    const q = { x: run.homeX, y: run.homeY };
    bloom(ctx, q.x, q.y, size * (0.6 + 0.4 * ramp), size * (0.55 + 0.35 * ramp), 0.4 + 0.5 * ramp);
  },
  drawOver(ctx, p, run, size) {
    const t = run.t;
    const home = { x: run.homeX, y: run.homeY };
    // Hand charging before the lion leaves it: lights up once the hand is out (user).
    const HAND_GLOW = X_HAND - 0.1;
    if (t >= HAND_GLOW && t < X_LION) {
      const k = (t - HAND_GLOW) / (X_LION - HAND_GLOW);
      const a = clamp01((t - HAND_GLOW) / 0.25);
      bloom(ctx, home.x + size * PALM_X, home.y + PALM_Y, size * (0.2 + 0.3 * k) * (0.4 + 0.6 * a), size * (0.16 + 0.22 * k) * (0.4 + 0.6 * a), 0.8 * a);
    }
    // The electromagnetic tornado down the lane (until it charges).
    if (t >= X_TORNADO && t < X_DASH + 0.25) {
      const hx = home.x + size * PALM_X; // the open palm of the skill_2 pose
      const hy = run.data.lane;
      const grow = Math.min(1, (t - X_TORNADO) / 0.35);
      const fade = t > X_DASH ? Math.max(0, 1 - (t - X_DASH) / 0.25) : 1;
      const x1 = hx + (W + 40 - hx) * (grow * grow * (3 - 2 * grow));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Body haze as a soft ellipse (a rect left a hard vertical edge at the hand - user).
      const cx = (hx + x1) / 2;
      const rx = Math.max(1, (x1 - hx) / 2 + 40);
      ctx.save();
      ctx.translate(cx, hy);
      ctx.scale(rx / TORNADO_HALF, 1);
      const body = ctx.createRadialGradient(0, 0, 0, 0, 0, TORNADO_HALF);
      body.addColorStop(0, `rgba(120,255,190,${0.22 * fade})`);
      body.addColorStop(0.6, `rgba(100,255,180,${0.12 * fade})`);
      body.addColorStop(1, 'rgba(60,255,150,0)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, TORNADO_HALF, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Spiral strands: counter-phased helices (green / gold / white) twisting right.
      // Strands start as one point in the palm (zero swing, faded in) and open up as they go.
      for (const [col, ph, w] of [['140,255,200', 0, 3], ['255,220,110', Math.PI, 2.5], ['220,255,240', Math.PI / 2, 1.5]]) {
        const sg = ctx.createLinearGradient(hx, 0, hx + 110, 0);
        sg.addColorStop(0, `rgba(${col},0)`);
        sg.addColorStop(1, `rgba(${col},${0.85 * fade})`);
        ctx.strokeStyle = sg;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let x = hx; x <= x1; x += 6) {
          // Keeps widening all the way to the screen edge (user), spinning fast.
          const u = (x - hx) / 60;
          const open = Math.min(1, (x - hx) / Math.max(1, W + 40 - hx));
          const amp = TORNADO_HALF * 1.5 * Math.pow(open, 0.8);
          const y = hy + Math.sin(u - t * 26 + ph) * amp;
          if (x === hx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      for (const e of run.data.caught) {
        if (!e.alive) continue;
        bloom(ctx, e.x, e.y, 34, 34, 0.5 * fade * (0.6 + 0.4 * Math.sin(t * 40 + e.x)), 'cyan');
      }
    }
    // The lion.
    const L = run.data.lion;
    if (L && L.t <= LION_TIME + 0.2) {
      const s = (p.drawSize || 100) * L.size;
      const fade = L.t > LION_TIME ? Math.max(0, 1 - (L.t - LION_TIME) / 0.2) : 1;
      drawFireLion(ctx, L, s, fade, L.t / LION_TIME, home.x);
    }
    // Two lights (gold = hell, green = heaven) spiral in and merge inside it.
    if (t >= X_GLOW && t < X_DASH) {
      const k = Math.min(1, (t - X_GLOW) / (X_MERGE - X_GLOW));
      const r = size * 1.1 * (1 - easeIn(k));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [col, ph] of [['255,205,70', 0], ['90,255,170', Math.PI]]) {
        for (let i = 0; i < 6; i++) {
          // Comet: head + fading trail along the spiral.
          const a = t * (7 + 6 * k) + ph - i * 0.18;
          const rr = r * (1 + i * 0.05);
          const x = home.x + Math.cos(a) * rr;
          const y = home.y + Math.sin(a) * rr * 0.75;
          const s2 = size * (0.2 - i * 0.025);
          const g = ctx.createRadialGradient(x, y, 0, x, y, s2);
          g.addColorStop(0, `rgba(${col},${0.95 - i * 0.14})`);
          g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, s2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (t >= X_MERGE) bloom(ctx, home.x, home.y, size * 1.2, size * 1.0, 1);
      ctx.restore();
    }
    // The charge: a white-gold light streak from where it stood to the body.
    if (t >= X_DASH && t < X_DASH + DASH_TIME + 0.35) {
      const k = easeIn(Math.min(1, (t - X_DASH) / DASH_TIME));
      const fade = t > X_DASH + DASH_TIME ? Math.max(0, 1 - (t - X_DASH - DASH_TIME) / 0.35) : 1;
      const head = home.x + (W + 200 - home.x) * k;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Streak layers as long soft ellipses, brightest toward the head and fading out on
      // every edge (a rect with a vertical-only gradient cut a hard line on the left - user).
      const x0 = home.x - size * 0.6;
      const x1 = Math.max(x0 + 2, head + size * 0.2);
      const cx = (x0 + x1) / 2;
      const rx = (x1 - x0) / 2;
      for (const [hh, col, a] of [[DASH_HALF * 1.6, '255,200,90', 0.3], [DASH_HALF * 0.8, '255,240,190', 0.6], [24, '255,255,255', 1]]) {
        const ry = hh / 2;
        ctx.save();
        ctx.translate(cx, home.y);
        ctx.scale(rx / ry, 1);
        const g = ctx.createRadialGradient(ry * 0.55, 0, 0, 0, 0, ry);
        g.addColorStop(0, `rgba(${col},${a * fade})`);
        g.addColorStop(0.55, `rgba(${col},${a * 0.75 * fade})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, ry, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (t < X_DASH + DASH_TIME) bloom(ctx, Math.min(W, head), home.y, size * 1.6, size * 1.1, 1);
      ctx.restore();
      // Rampalion itself shows faintly inside the light (user).
      const body = run.spec.bodyAnim?.(p, run);
      if (body?.draw) {
        const o = runOffset(p, run);
        ctx.save();
        ctx.globalAlpha = 0.5 * fade;
        ctx.filter = HYPER_GOLD;
        body.draw(ctx, p.x + o.dx + (p.drawOffsetX || 0), p.y + o.dy + (p.drawOffsetY || 0), p.drawSize || 100, { flipX: p.facing < 0 });
        ctx.restore();
      }
    }
    // Captions: the chant while the hand charges, the shout as it charges out.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // Not before the run's own start: the wing drop (t < 0) gave a negative count and
    // slice(0, n) then showed most of the chant for a moment (user).
    if (t >= 0 && t < X_LION + 0.4) {
      const n = Math.min(CHANT.length, Math.floor(t / (X_LION / CHANT.length)) + 1);
      const text = CHANT.slice(0, n).join(' ');
      ctx.font = '900 30px "Noto Sans KR", "Chakra Petch", sans-serif';
      ctx.globalAlpha = Math.min(1, (X_LION + 0.4 - t) / 0.2);
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(20,10,0,0.9)';
      ctx.strokeText(text, W / 2, H * 0.2);
      ctx.fillStyle = '#ffe28a';
      ctx.fillText(text, W / 2, H * 0.2);
    }
    // The shout in two beats (user): "HEAVEN AND…" as the lights merge, "HELL!!" on the very
    // frame it bursts forward.
    const shout = (text, sub, t0, until, big) => {
      if (t < t0 || t >= until) return;
      const k = Math.min(1, (t - t0) / 0.12);
      const out = t > until - 0.3 ? Math.max(0, (until - t) / 0.3) : 1;
      const sc = (big ? 1.8 : 1.4) - (big ? 0.8 : 0.4) * k;
      ctx.save();
      ctx.translate(W / 2, H * (big ? 0.3 : 0.22));
      ctx.scale(sc, sc);
      ctx.globalAlpha = k * out;
      ctx.font = `900 ${big ? 64 : 40}px "Chakra Petch", "Noto Sans KR", sans-serif`;
      ctx.lineWidth = big ? 11 : 8;
      ctx.strokeStyle = 'rgba(30,8,0,0.95)';
      ctx.strokeText(text, 0, 0);
      const fg = ctx.createLinearGradient(0, -32, 0, 32);
      fg.addColorStop(0, '#fff7c2');
      fg.addColorStop(0.5, big ? '#ffb52e' : '#9dffcf');
      fg.addColorStop(1, big ? '#ff5a1f' : '#ffd24a');
      ctx.fillStyle = fg;
      ctx.fillText(text, 0, 0);
      ctx.font = `800 ${big ? 24 : 20}px "Noto Sans KR", sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeText(sub, 0, big ? 46 : 34);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sub, 0, big ? 46 : 34);
      ctx.restore();
    };
    shout('HEAVEN AND…', '헤븐 앤드…', X_MERGE - 0.35, X_DASH, false);
    shout('HELL!!', '헬!!', X_DASH, X_BACK + 0.3, true);
    ctx.restore();
  },
};

// ---------------------------------------------------------------- bomb when not Hyper (user)
// The wing blades drop straight down onto its back with a clank first (it borrows the Hyper
// form for the bomb), and fly straight up off it when the bomb is over. Hyper: already on.
const WING_PRE = 0.6; // run starts at -WING_PRE: the drop
const WING_DROP = 0.4;
const WING_POST = 0.55; // after X_END: they fly off
const wingT = (run) => run.t;

function drawWings(ctx, p, run, dy, alpha) {
  const w = p._ramp?.anims?.fx_ramp_wings;
  if (!w?.draw) return;
  w.state = 'idle';
  w.time = 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Same anchor as the body during the run (its cast spot).
  w.draw(ctx, run.homeX + (p.drawOffsetX || 0), run.homeY + (p.drawOffsetY || 0) + dy, p.drawSize || 100, { flipX: p.facing < 0 });
  ctx.restore();
}

export const RAMPALION_X_WINGS = {
  ...RAMPALION_X,
  startAt: -WING_PRE,
  duration: X_END + WING_POST,
  clipTime: (t) => Math.max(0, RAMPALION_X.clipTime(t)),
  start(p, run) {
    RAMPALION_X.start(p, run);
    p.invuln = Math.max(p.invuln, X_END + WING_PRE + WING_POST + 0.4);
  },
  timeline(run) {
    return [
      { t: -WING_PRE + WING_DROP, do: (r, p) => {
        // Clank: it locks on.
        r.events.push({ type: 'shake', mag: 1.0 });
        r.events.push({ type: 'hitstop', t: 0.04 });
        r.events.push({ type: 'cue', key: 'hz:fall' });
        spawnFx(r, { key: 'lao-fx-spark', x: p.x - 10, y: p.y - (p.drawSize || 100) * 0.25, w: 90, h: 120, dur: 0.25 });
        spawnFx(r, { dur: 0.2, draw: (ctx, k) => bloom(ctx, p.x - 6, p.y - (p.drawSize || 100) * 0.2, 70, 50, 1 - k) });
      } },
      { t: X_END, do: (r) => r.events.push({ type: 'cue', key: 'missileLaunch' }) },
      ...RAMPALION_X.timeline(run),
    ];
  },
  bodyAnim(p, run) {
    // Wingless rest body until the wings lock on, and again once they have flown off.
    if (run.t < -WING_PRE + WING_DROP || run.t >= X_END) return rampRestBody(p);
    return RAMPALION_X.bodyAnim(p, run);
  },
  drawUnder(ctx, p, run, size) {
    const t = wingT(run);
    if (t < 0) {
      // Dropping straight down from above the screen, accelerating.
      const k = Math.min(1, (t + WING_PRE) / WING_DROP);
      const dy = -(run.homeY + size) * (1 - k * k);
      drawWings(ctx, p, run, dy, 1);
      return;
    }
    if (t >= X_END) {
      // Flying straight up and away.
      const k = Math.min(1, (t - X_END) / WING_POST);
      drawWings(ctx, p, run, -(run.homeY + size) * k * k, 1 - k * 0.3);
      return;
    }
    RAMPALION_X.drawUnder?.(ctx, p, run, size);
  },
};

/** X for Rampalion right now: Hyper has its wings already; otherwise they drop on first. */
export function rampalionBombSpec(p) {
  return p?._ramp?.hyper ? RAMPALION_X : RAMPALION_X_WINGS;
}

// ---------------------------------------------------------------- C by level (user)
const easeInOut = (k) => k * k * (3 - 2 * k);

// Lv2 "Breast Lion" (user, a Mazinger "Breast Fire" parody): the chest heats up through the
// chant, then a mid-size fire lion leaps off it and runs ahead through everything in its lane.
// Charge (user: it needs time to gather): light rays and particles close in on a point just in
// front of the chest lion, the ball there grows, squeezes white for the last 0.2 s, then fires.
const LION2_OUT = 1.8; // chant: "가슴의 사자여 불타올라라!", then the lion and "브레스트 라이언!!"
const LION2_SQUEEZE = 0.2;
const LION2_AHEAD = 0.32; // gather point ahead of the chest bone, x drawSize
const LION2_SHOUT = 0.8; // s the shout stays up after the launch
const LION2_TIME = 0.85;
const LION2_END = LION2_OUT + LION2_TIME + 0.25;

export const RAMPALION_C2 = {
  clip: 'idle', duration: LION2_END, y0: 0, path: [[0, 0, 0], [LION2_END, 0, 0]],
  followShip: true,
  clipTime: (t) => t,
  start(p, run) {
    run.data.hit = new Set();
    run.data.lion = null;
  },
  timeline() {
    return [
      { t: 0, do: (r) => { r.events.push({ type: 'cue', key: 'charge' }); r.events.push({ type: 'sfx', stem: 'rampalion_charge' }); } },
      { t: LION2_OUT * 0.45, do: (r) => r.events.push({ type: 'sfx', stem: 'rampalion_elec' }) },
      { t: LION2_OUT * 0.75, do: (r) => r.events.push({ type: 'cue', key: 'charge' }) },
      { t: LION2_OUT - LION2_SQUEEZE, do: (r) => { r.events.push({ type: 'sfx', stem: 'rampalion_light' }); r.events.push({ type: 'shake', mag: 0.5 }); } },
      { t: LION2_OUT, do: (r) => r.events.push({ type: 'sfx', stem: 'rampalion_skill2' }) },
      { t: LION2_OUT, do: (r, p) => {
        const c0 = bonePoint(p, 'chest') || { x: p.x, y: p.y };
        const c = { x: c0.x + (p.drawSize || 100) * LION2_AHEAD, y: c0.y };
        r.data.lion = { x0: c.x, x: c.x, y: c.y, t: 0, size: 1.2 };
        // Fired off the chest: recoil shake, a blast ring and a flash at the muzzle.
        r.events.push({ type: 'shake', mag: 1.8 });
        r.events.push({ type: 'hitstop', t: 0.05 });
        r.events.push({ type: 'flash', t: 0.1 });
        r.events.push({ type: 'cue', key: 'leaderBlast' });
        r.events.push({ type: 'cue', key: 'missileBlast' });
        spawnFx(r, { key: 'lao-fx-shockring', x: c.x + 30, y: c.y, w: 300, h: 300, dur: 0.4 });
        spawnFx(r, { key: 'lao-fx-airboom', x: c.x + 40, y: c.y, w: 220, h: 220, dur: 0.35 });
      } },
    ];
  },
  tick(p, run, dt) {
    // Charge: light particles rushing in on the gather point (GPU; canvas rays stand in).
    if (run.t < LION2_OUT - LION2_SQUEEZE * 0.5) {
      const c0 = bonePoint(p, 'chest');
      if (c0) {
        const s = p.drawSize || 100;
        run.events.push({ type: 'gpuGather', x: c0.x + s * LION2_AHEAD, y: c0.y, r: s * 1.4, k: Math.min(1, run.t / LION2_OUT) });
      }
    }
    const L = run.data.lion;
    if (!L || L.t > LION2_TIME) return;
    L.t += dt;
    const k = Math.min(1, L.t / LION2_TIME);
    L.x = L.x0 + (W + 260 - L.x0) * (k * k * 0.6 + k * 0.4);
    L.size = 1.2 + 1.3 * Math.min(1, k * 2.5); // twice the old mid-size (user)
    const size = (p.drawSize || 100) * L.size;
    const front = L.x + size * 0.35;
    for (const e of run.enemies) {
      if (!e.alive || e.dying || run.data.hit.has(e) || !onScreen(e)) continue;
      if (e.x > front || e.x < L.x0 || Math.abs(e.y - L.y) > size * 0.45 + (e.hitR || 18)) continue;
      run.data.hit.add(e);
      run.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: run.level * 4, hitStyle: 'heatmissile' });
      spawnFx(run, { key: 'lao-fx-airboom', x: e.x, y: e.y, w: 140, h: 140, dur: 0.35 });
    }
  },
  drawOver(ctx, p, run, size) {
    const t = run.t;
    // Ki gathering in front of the chest lion while it chants (user), with the custom-pack
    // Rampart's own FX textures (tools/import-rampalion-fx.py): light rays and gold crescent
    // rings closing in, spark bursts and particles sucked in on a spiral, a fire ball growing on
    // the point - squeezed white for the last LION2_SQUEEZE s - then the lion fires off it.
    const c0 = t < LION2_OUT + 0.1 ? bonePoint(p, 'chest') : null;
    if (c0) {
      const F = { x: c0.x + size * LION2_AHEAD, y: c0.y };
      const k = Math.min(1, t / LION2_OUT);
      const sq = Math.max(0, Math.min(1, (t - (LION2_OUT - LION2_SQUEEZE)) / LION2_SQUEEZE));
      const fade = t > LION2_OUT ? Math.max(0, 1 - (t - LION2_OUT) / 0.1) : 1;
      // The chest lion's face lights up first.
      bloom(ctx, c0.x, c0.y, size * 0.3, size * 0.26, (0.3 + 0.5 * k) * fade);
      // Light rays closing in on the point: long and faint at first, shorter and brighter.
      if (!run.gpu) sunRays(ctx, F.x, F.y, size * (2.6 - 1.7 * k), 14, -t * 1.4, '255,214,140', (0.2 + 0.45 * k) * fade, 0.06, t);
      // Rings: three crescents shrinking onto the point, each turned its own way.
      for (let i = 0; i < 3; i++) {
        const u = (t * 1.3 + i / 3) % 1;
        const d = size * (2.6 * (1 - u) + 0.25);
        fxCell(ctx, 'ramp-fx-ring', i % 3, F.x, F.y, d, d, { tint: '#ffcf6a', rot: i * 2.1 + t * 2, alpha: Math.min(1, u * 2.5) * (1 - u) * 1.6 * (0.35 + 0.65 * k) * fade });
      }
      // Particles spiralling in.
      for (let i = 0; i < 16; i++) {
        const u = (t * 0.9 + i / 16) % 1; // 0 = far, 1 = on the point
        const a = i * 2.399 + u * 3.2;
        const r = size * 1.8 * (1 - u) ** 1.4;
        const px = F.x + Math.cos(a) * r;
        const py = F.y + Math.sin(a) * r * 0.75;
        bloom(ctx, px, py, size * (0.05 + 0.04 * u), size * (0.05 + 0.04 * u), Math.min(1, u * 4) * (0.5 + 0.5 * k) * fade);
      }
      // Spark bursts played backwards: lines sucked in to the point.
      for (let i = 0; i < 2; i++) {
        const u = (t * 1.1 + i * 0.5) % 1;
        const d = size * (2.0 * (1 - u) + 0.4);
        fxCell(ctx, 'ramp-fx-sparks', 3 - Math.floor(u * 4), F.x, F.y, d, d, { tint: '#ffe2a0', rot: i * 1.3, alpha: (0.4 + 0.6 * k) * Math.min(1, u * 3) * fade });
      }
      // The ball: the lion's fire swirling on the point, growing; squeezed small and white at the end.
      const grow = size * (0.25 + 0.75 * k) * (1 - 0.5 * sq);
      fxCell(ctx, 'ramp-fx-fire', Math.floor(t * 14), F.x, F.y - grow * 0.1, grow, grow, { alpha: (0.45 + 0.5 * k) * fade });
      fxCell(ctx, 'ramp-fx-fire', Math.floor(t * 14) + 4, F.x, F.y - grow * 0.06, grow * 0.8, grow * 0.8, { rot: Math.PI, alpha: (0.3 + 0.4 * k) * fade });
      fxCell(ctx, 'ramp-fx-cloud', 0, F.x, F.y, grow * 0.9, grow * 0.9, { tint: sq > 0 ? '#ffffff' : '#ffb85a', rot: t * 2, alpha: (0.3 + 0.4 * k + 0.4 * sq) * fade });
      bloom(ctx, F.x, F.y, size * (0.15 + 0.3 * k), size * (0.13 + 0.26 * k), (0.5 + 0.5 * k) * fade);
      if (sq > 0) bloom(ctx, F.x, F.y, size * (0.5 + 0.6 * sq), size * (0.45 + 0.5 * sq), sq * fade, 'cyan');
    }
    const L = run.data.lion;
    if (L && L.t <= LION2_TIME + 0.2) {
      const fade = L.t > LION2_TIME ? Math.max(0, 1 - (L.t - LION2_TIME) / 0.2) : 1;
      drawFireLion(ctx, L, size * L.size, fade, Math.min(1, L.t / LION2_TIME), L.x0);
    }
    // The chant above the field, then the name shouted as the lion leaps.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (t < LION2_OUT + 0.3) {
      ctx.globalAlpha = Math.min(1, t / 0.15) * Math.min(1, (LION2_OUT + 0.3 - t) / 0.2);
      ctx.font = '900 30px "Noto Sans KR", "Chakra Petch", sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(20,10,0,0.9)';
      ctx.strokeText('가슴의 사자여 불타올라라!', W / 2, H * 0.16);
      ctx.fillStyle = '#ffe28a';
      ctx.fillText('가슴의 사자여 불타올라라!', W / 2, H * 0.16);
    }
    if (t >= LION2_OUT && t < LION2_OUT + LION2_SHOUT) {
      const k = Math.min(1, (t - LION2_OUT) / 0.12);
      const out = Math.min(1, (LION2_OUT + LION2_SHOUT - t) / 0.25);
      const sc = 1.6 - 0.6 * k;
      ctx.globalAlpha = k * out;
      ctx.translate(W / 2, H * 0.24);
      ctx.scale(sc, sc);
      ctx.font = '900 50px "Chakra Petch", "Noto Sans KR", sans-serif';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(30,8,0,0.95)';
      ctx.strokeText('BREAST LION!!', 0, 0);
      const fg = ctx.createLinearGradient(0, -26, 0, 26);
      fg.addColorStop(0, '#fff3c2');
      fg.addColorStop(0.5, '#ffb52e');
      fg.addColorStop(1, '#ff4a1a');
      ctx.fillStyle = fg;
      ctx.fillText('BREAST LION!!', 0, 0);
      ctx.font = '800 22px "Noto Sans KR", sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeText('브레스트 라이언!!', 0, 40);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('브레스트 라이언!!', 0, 40);
    }
    ctx.restore();
  },
};

// Lv3 Shining Hand (user): turns Hyper gold and raises the glowing hand (skill_2's pose) through
// its chant, flies at the target in the bomb's charge pose, grabs it - it burns white - then it
// blows up with a big blast around it, and flies back.
const SF_GOLD = 0.35; // turns gold, the hand lights up
const SF_CHANT = 1.9; // chant over: takes off
const SF_DASH = SF_CHANT + 0.25; // reaches the target
const SF_BOOM = SF_DASH + 1.0; // grip held until it bursts
const SF_BACK = SF_BOOM + 0.4; // back on the ship
const SF_END = SF_BACK + 0.15;
// The chant (user), line by line: [start time, text, big].
const SF_LINES = [
  [0.1, '내 이 손이 빛나며 울부짖고 있다!'],
  [0.75, '너를 쓰러뜨리라고 번쩍이며 외치고 있다!'],
];
// Then the lines clear and "필살" is stamped one syllable at a time (user, one word), then
// "샤이닝" as it takes off and "핸드!!" bursting out at the grip.
const SF_PIL = 1.4;
const SF_SAL = 1.68;
const SF_BLAST = 230; // px: the big blast around the target
const SF_HAND = 0.75; // skill_2 sheet time with the hand thrust out

function sfTargetPoint(run) {
  const e = run.data.target;
  if (e?.alive && !e.dying) { run.data.tx = e.x; run.data.ty = e.y; }
  return { x: run.data.tx, y: run.data.ty };
}

/** A shout word stamped in: slams down from `from`x to 1x over k 0..1, gold gradient, outline. */
function stampWord(ctx, text, x, y, px, k, alpha = 1, from = 2.2) {
  const sc = from - (from - 1) * easeOut(k);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = Math.min(1, k * 1.5) * alpha;
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  ctx.font = `900 ${px}px "Noto Sans KR", "Chakra Petch", sans-serif`;
  ctx.lineWidth = px * 0.16;
  ctx.strokeStyle = 'rgba(30,8,0,0.95)';
  ctx.strokeText(text, 0, 0);
  const fg = ctx.createLinearGradient(0, -px / 2, 0, px / 2);
  fg.addColorStop(0, '#fff7c2');
  fg.addColorStop(0.5, '#ffd24a');
  fg.addColorStop(1, '#ff7a1f');
  ctx.fillStyle = fg;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export const RAMPALION_C3 = {
  clip: 'idle', duration: SF_END, y0: 0, path: [[0, 0, 0], [SF_END, 0, 0]],
  clipTime: (t) => t,
  start(p, run) {
    const on = (run.enemies || []).filter((e) => e.alive && !e.dying && onScreen(e));
    const leader = on.find((e) => e.kind === 'boss' || e.kind === 'midboss');
    run.data.target = leader || pickTarget(p, on) || null;
    run.data.tx = run.data.target ? run.data.target.x : Math.min(W - 80, p.x + 320);
    run.data.ty = run.data.target ? run.data.target.y : p.y;
  },
  pos(p, run, t) {
    const s = p.drawSize || 100;
    const T = sfTargetPoint(run);
    const grab = { x: T.x - s * 0.5, y: T.y + 12 };
    const home = { x: run.homeX, y: run.homeY };
    if (t < SF_CHANT) return home;
    if (t < SF_DASH) {
      const k = easeIn((t - SF_CHANT) / (SF_DASH - SF_CHANT));
      return { x: home.x + (grab.x - home.x) * k, y: home.y + (grab.y - home.y) * k };
    }
    if (t < SF_BOOM) return grab;
    const k = easeInOut(Math.min(1, (t - SF_BOOM) / (SF_BACK - SF_BOOM)));
    return { x: grab.x + (p.x - grab.x) * k, y: grab.y + (p.y - grab.y) * k };
  },
  bodyAnim(p, run) {
    const t = run.t;
    // In flight (out and back): the bomb's charge pose (user).
    if ((t >= SF_CHANT && t < SF_DASH) || (t >= SF_BOOM + 0.15 && t < SF_BACK)) return p._ramp?.anims?.fx_ramp_dashpose || null;
    // Hand thrust out while it chants and while it grips.
    if (t < SF_GOLD - 0.05 || t >= SF_BACK || !p.anim.hasSkill2) return null;
    const a = (run.data.hand ||= Object.create(p.anim));
    a.state = 'skill2';
    a.time = SF_HAND;
    a.locked = true;
    a.dropWing = true;
    return a;
  },
  bodyFilter(p, run) {
    const t = run.t;
    const up = Math.min(1, t / SF_GOLD);
    const out = t > SF_BACK ? Math.max(0, 1 - (t - SF_BACK) / 0.15) : 1;
    const pulse = t >= SF_DASH && t < SF_BOOM ? 0.15 * Math.sin(t * 40) : 0;
    return { filter: HYPER_GOLD, glow: (0.15 + 0.35 * up + pulse) * out };
  },
  timeline() {
    return [
      { t: 0, do: (r) => { r.events.push({ type: 'cue', key: 'charge' }); r.events.push({ type: 'sfx', stem: 'rampalion_charge' }); } },
      { t: SF_GOLD, do: (r) => r.events.push({ type: 'sfx', stem: 'rampalion_light' }) },
      { t: SF_GOLD, do: (r) => r.events.push({ type: 'shake', mag: 0.6 }) },
      { t: SF_PIL, do: (r) => { r.events.push({ type: 'shake', mag: 1.0 }); r.events.push({ type: 'cue', key: 'hz:fall' }); } },
      { t: SF_SAL, do: (r) => { r.events.push({ type: 'shake', mag: 1.4 }); r.events.push({ type: 'cue', key: 'hz:fall' }); } },
      { t: SF_CHANT, do: (r) => { r.events.push({ type: 'sfx', stem: 'rampalion_launch' }); r.events.push({ type: 'shake', mag: 0.8 }); } },
      { t: SF_DASH, do: (r) => {
        r.events.push({ type: 'hitstop', t: 0.05 });
        r.events.push({ type: 'shake', mag: 1.4 });
        r.events.push({ type: 'cue', key: 'hz:bolt' });
        r.events.push({ type: 'sfx', stem: 'rampalion_elec' });
        const T = sfTargetPoint(r);
        spawnFx(r, { key: 'lao-fx-shockring', x: T.x, y: T.y, w: 200, h: 200, dur: 0.35 });
      } },
      { t: SF_BOOM, do: (r) => {
        const T = sfTargetPoint(r);
        const e = r.data.target;
        if (e?.alive && !e.dying) {
          e.stunFor = 0;
          r.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: r.level * 5 });
        }
        for (const o of r.enemies) {
          if (!o.alive || o.dying || o === e || !onScreen(o)) continue;
          if ((o.x - T.x) ** 2 + (o.y - T.y) ** 2 > (SF_BLAST + (o.hitR || 18)) ** 2) continue;
          r.events.push({ type: 'damage', target: o, x: o.x, y: o.y, amount: r.level * 3 });
        }
        r.events.push({ type: 'clearBullets' });
        r.events.push({ type: 'flash', t: 0.2 });
        r.events.push({ type: 'hitstop', t: 0.08 });
        r.events.push({ type: 'shake', mag: 2.4 });
        r.events.push({ type: 'cue', key: 'leaderBlast' });
        r.events.push({ type: 'cue', key: 'missileBlast' });
        r.events.push({ type: 'sfx', stem: 'rampalion_laser' });
        spawnFx(r, { key: 'lao-fx-airboom', x: T.x, y: T.y, w: SF_BLAST * 2.2, h: SF_BLAST * 2.2, dur: 0.6 });
        spawnFx(r, { key: 'lao-fx-shockring', x: T.x, y: T.y, w: SF_BLAST * 2.4, h: SF_BLAST * 2.4, dur: 0.5 });
      } },
    ];
  },
  tick(p, run) {
    // Light bursting out of the gripped target (GPU particles; canvas rays stand in).
    if (run.t >= SF_DASH && run.t < SF_BOOM) {
      const T = sfTargetPoint(run);
      const k = (run.t - SF_DASH) / (SF_BOOM - SF_DASH);
      run.events.push({ type: 'gpuRays', x: T.x, y: T.y, len: (p.drawSize || 100) * (1.6 + 2.4 * k), k });
    }
    // Held fast while it is gripped.
    const e = run.data.target;
    if (e?.alive && run.t >= SF_DASH && run.t < SF_BOOM) {
      e.stunFor = Math.max(e.stunFor || 0, 0.2);
      e.boriRootFor = Math.max(e.boriRootFor || 0, 0.2);
    }
  },
  drawUnder(ctx, p, run, size) {
    // Gold aura behind the body while it is Hyper.
    const t = run.t;
    if (t >= SF_BACK) return;
    const q = runOffset(p, run);
    bloom(ctx, p.x + q.dx, p.y + q.dy, size * 0.75, size * 0.65, 0.35 + 0.25 * Math.min(1, t / SF_GOLD));
  },
  // Halo behind the target while it is gripped (user): slow sun rays and gold crescent rings,
  // drawn before the enemies (game.js draw) so the target stands in front of it.
  drawBehindEnemies(ctx, p, run, size) {
    const t = run.t;
    if (t < SF_DASH - 0.05 || t >= SF_BOOM + 0.3) return;
    const T = sfTargetPoint(run);
    const k = Math.min(1, (t - SF_DASH + 0.05) / 0.2) * (t > SF_BOOM ? Math.max(0, 1 - (t - SF_BOOM) / 0.3) : 1);
    sunRays(ctx, T.x, T.y, size * 1.3, 12, t * 0.6, '255,226,140', 0.5 * k, 0.07);
    fxCell(ctx, 'ramp-fx-ring', 1, T.x, T.y, size * 1.7, size * 1.7, { tint: '#ffd76a', rot: t * 0.8, alpha: 0.85 * k });
    fxCell(ctx, 'ramp-fx-ring', 0, T.x, T.y, size * 1.35, size * 1.35, { tint: '#fff2c0', rot: -t * 1.1, alpha: 0.6 * k });
    bloom(ctx, T.x, T.y, size * 1.0, size * 0.95, 0.4 * k);
  },
  drawOver(ctx, p, run, size) {
    const t = run.t;
    const q = runOffset(p, run);
    const bx = p.x + q.dx;
    const by = p.y + q.dy;
    // The hand: gold-green light in the open palm while it is thrust out (chant, grip).
    if ((t >= SF_GOLD - 0.1 && t < SF_CHANT) || (t >= SF_DASH && t < SF_BOOM + 0.1)) {
      const k = Math.min(1, (t - SF_GOLD + 0.1) / 0.25);
      const hx = bx + size * PALM_X;
      const hy = by + PALM_Y;
      bloom(ctx, hx, hy, size * (0.3 + 0.15 * k), size * (0.24 + 0.1 * k), 0.9 * k);
      bloom(ctx, hx, hy, size * 0.18, size * 0.14, 0.7 * k, 'cyan');
    }
    // The target burns white in the grip, brighter until it bursts (user: no drawn shapes): the
    // Rampart burst cloud and skill2 fire tinted white, electric after-lighting crackling round it
    // and a white crescent ring pulsing off it.
    const T = sfTargetPoint(run);
    if (t >= SF_DASH && t < SF_BOOM + 0.2) {
      const k = Math.min(1, (t - SF_DASH) / (SF_BOOM - SF_DASH));
      const out = t > SF_BOOM ? Math.max(0, 1 - (t - SF_BOOM) / 0.2) : 1;
      const flick = 0.85 + 0.15 * Math.sin(t * 47);
      const R = size * (0.7 + 1.0 * k);
      // Light bursting out of it (user): long beams shooting out in every direction, more and
      // longer as it burns, flickering one by one.
      if (!run.gpu) sunRays(ctx, T.x, T.y, R * (1.3 + 1.6 * k), 10 + Math.round(8 * k), t * 0.35 + 0.4, '255,252,235', (0.35 + 0.55 * k) * out, 0.05, t);
      fxCell(ctx, 'ramp-fx-cloud', 0, T.x, T.y, R, R, { tint: '#fffaf0', rot: t * 1.7, alpha: (0.45 + 0.5 * k) * flick * out });
      fxCell(ctx, 'ramp-fx-cloud', 0, T.x, T.y, R * 0.75, R * 0.75, { tint: '#ffffff', rot: -t * 2.3, alpha: (0.35 + 0.55 * k) * out });
      // White fire licking up off it.
      fxCell(ctx, 'ramp-fx-fire', Math.floor(t * 16), T.x, T.y - R * 0.18, R * 1.05, R * 1.05, { tint: '#fff6dc', alpha: (0.3 + 0.6 * k) * out });
      fxCell(ctx, 'ramp-fx-fire', Math.floor(t * 16) + 4, T.x, T.y - R * 0.1, R * 0.8, R * 0.8, { tint: '#ffffff', rot: 0.4, alpha: (0.2 + 0.5 * k) * out });
      // Electric crackle at four points round it, each on its own cycle.
      for (let i = 0; i < 4; i++) {
        const a = i * 1.57 + 0.6 + Math.sin(t * 3 + i) * 0.3;
        const bx = T.x + Math.cos(a) * R * 0.38;
        const by = T.y + Math.sin(a) * R * 0.32;
        fxCell(ctx, 'ramp-fx-bolts', Math.floor(t * 20 + i * 4), bx, by, R * 0.45, R * 0.45, { tint: '#eaf6ff', rot: a, alpha: (0.4 + 0.6 * k) * out });
      }
      // A white crescent ring pulsing off it.
      const ru = (t * 2.6) % 1;
      fxCell(ctx, 'ramp-fx-ring', Math.floor(ru * 9), T.x, T.y, R * (0.6 + 0.9 * ru), R * (0.6 + 0.9 * ru), { tint: '#ffffff', rot: t, alpha: (1 - ru) * (0.4 + 0.5 * k) * out });
      bloom(ctx, T.x, T.y, R * 0.45, R * 0.4, (0.5 + 0.5 * k) * out);
    }
    // The chant, line by line, above the field; gone as it takes off.
    if (t < SF_DASH) {
      const out = t > SF_CHANT ? Math.max(0, 1 - (t - SF_CHANT) / (SF_DASH - SF_CHANT)) : 1;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      // The two lines, gone the moment "필" lands.
      if (t < SF_PIL) {
        SF_LINES.forEach(([t0, text], i) => {
          if (t < t0) return;
          ctx.globalAlpha = Math.min(1, (t - t0) / 0.15);
          ctx.font = '900 28px "Noto Sans KR", "Chakra Petch", sans-serif';
          ctx.lineWidth = 7;
          ctx.strokeStyle = 'rgba(20,10,0,0.9)';
          const y = H * 0.16 + i * 40;
          ctx.strokeText(text, W / 2, y);
          ctx.fillStyle = '#ffe28a';
          ctx.fillText(text, W / 2, y);
        });
      }
      // "필" then "살", each stamped in (slams down from 2x), reading as one word "필살".
      // Gone the moment it takes off (the name "샤이닝" lands where it stood).
      for (const [t0, text, dx] of [[SF_PIL, '필', -36], [SF_SAL, '살', 36]]) {
        if (t >= t0 && t < SF_CHANT) stampWord(ctx, text, W / 2 + dx, H * 0.22, 76, Math.min(1, (t - t0) / 0.1));
      }
      ctx.restore();
    }
    // The name: "샤이닝" as it takes off, "핸드!!" bursting out on the grip (user).
    if (t >= SF_CHANT && t < SF_BOOM + 0.4) {
      const out = t > SF_BOOM + 0.1 ? Math.max(0, 1 - (t - SF_BOOM - 0.1) / 0.3) : 1;
      ctx.save();
      stampWord(ctx, '샤이닝', W / 2 - 95, H * 0.22, 66, Math.min(1, (t - SF_CHANT) / 0.1), out);
      if (t >= SF_DASH) {
        const k = Math.min(1, (t - SF_DASH) / 0.08);
        bloom(ctx, W / 2 + 120, H * 0.22, 150 * (1.4 - 0.4 * k), 70 * (1.4 - 0.4 * k), (1 - k * 0.6) * out);
        stampWord(ctx, '핸드!!', W / 2 + 120, H * 0.22, 84, k, out, 2.8);
      }
      ctx.restore();
    }
  },
};

/** C for Rampalion by level (user): Lv1 skill_1's flying lance, Lv2 fire lion, Lv3 Shining Hand. */
export function rampalionSpecialSpec(p, level = 1) {
  return [RAMPALION_C1, RAMPALION_C2, RAMPALION_C3][Math.max(1, Math.min(3, level | 0)) - 1];
}
