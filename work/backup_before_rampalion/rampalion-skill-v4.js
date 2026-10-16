// Rampalion (CT66 Rampart, "램파리온 커스텀 팩") original skills as runs (skill-run.js).
//
// C = skill_1 (user): the wings fan out and fold forward into a giant blade-lance that drives
// straight ahead, hitting everything in its lane (several ticks). The sheet keeps the clip's
// window around its release (pack_sprite_sheets SKILL_PRE / SKILL_POST: 1.92-4.78s of the
// 7.4s clip), which is exactly the lance; times below are in that sheet clip.
// X = skill_2 as a "HELL AND HEAVEN" parody (user): see RAMPALION_X below.
import { W, H, onScreen } from './canvas.js';
import { bloom, drawSheetAt, drawCell, clamp01 } from './run-fx.js';
import { spawnFx } from './skill-run.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { HYPER_GOLD } from './rampalion.js';

const C_END = 2.9; // sheet clip length (35 frames @ 12 fps)
const C_LANCE = [1.08, 2.75]; // the lance drives forward (clip 3.0-4.67s)
const C_TICKS = 9;

export const RAMPALION_C = {
  // skill_1 is loaded as the 'attack' state (clip-anim.js).
  clip: 'attack', duration: C_END, y0: 0, path: [[0, 0, 0], [C_END, 0, 0]],
  // Steerable while it fights, no i-frames (C without i-frames fills its gauge faster).
  followShip: true,
  speed: 1.2,
  start(p, run) {
    run.data.tick = 0;
    run.data.nextTick = C_LANCE[0];
  },
  timeline() {
    return [
      { t: C_LANCE[0] - 0.05, do: (r) => { r.events.push({ type: 'shake', mag: 0.8 }); r.events.push({ type: 'cue', key: 'missileLaunch' }); } },
    ];
  },
  tick(p, run) {
    // Lance: every enemy in the lane ahead takes a share per tick (C budget 6/12/18 total).
    if (run.t < C_LANCE[0] || run.t > C_LANCE[1] || run.data.tick >= C_TICKS) return;
    if (run.t < run.data.nextTick) return;
    run.data.tick += 1;
    run.data.nextTick += (C_LANCE[1] - C_LANCE[0]) / C_TICKS;
    const per = (run.level * 6) / C_TICKS;
    const ly = p.y + 4;
    for (const e of run.enemies) {
      if (!e.alive || e.dying || !onScreen(e) || e.x < p.x + 10) continue;
      if (Math.abs(e.y - ly) > 46 + (e.hitR || 18)) continue;
      run.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: per });
      spawnFx(run, { key: 'lao-fx-airboom', x: e.x - 10, y: e.y, w: 90, h: 90, dur: 0.3 });
    }
    if (run.data.tick % 3 === 1) run.events.push({ type: 'cue', key: 'missileBlast' });
  },
  drawOver(ctx, p, run, size) {
    // The lance's energy along its lane while it drives forward.
    const t = run.t;
    if (t < C_LANCE[0] - 0.1 || t > C_LANCE[1] + 0.15) return;
    const k = clamp01((t - (C_LANCE[0] - 0.1)) / 0.2) * clamp01((C_LANCE[1] + 0.15 - t) / 0.2);
    const ly = p.y + 4;
    const x0 = p.x + size * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [hh, col, a] of [[70, '255,120,40', 0.28], [34, '255,190,110', 0.6], [10, '255,250,230', 0.95]]) {
      const g = ctx.createLinearGradient(0, ly - hh / 2, 0, ly + hh / 2);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.5, `rgba(${col},${a * k})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x0, ly - hh / 2, W + 40 - x0, hh);
    }
    ctx.restore();
    bloom(ctx, x0, ly, size * 0.5, size * 0.35, 0.8 * k);
  },
};

// X: "HELL AND HEAVEN" parody (user): skill_2 thrusts the hand out and holds it; an
// electromagnetic tornado shoots down the lane, catching and rooting what is in it; the giant
// lion flies off the hand down the tornado; Rampalion then turns Hyper (gold) and glows white while
// two lights (gold = hell, green = heaven) circle in and merge inside it; it bursts forward
// like a flash of light through everything, shouting HELL AND HEAVEN, and flies back in.
const X_HAND = 0.75; // skill_2 sheet time with the hand out (held)
/**
 * Original skill2 lion (Lion_Rampart_lion_main_aura, 3 x 3: mouth shut -> roaring), white
 * art tinted like its particle start colour (orange 1,0.24,0.04 .. 1,0.61,0.25). Cached.
 */
const _lionTint = {};
function lionSheet(key, col) {
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
const X_LION = 1.15; // the lion leaves the hand, riding the tornado
const LION_TIME = 0.9;
const X_GLOW = 1.75; // turns Hyper, starts glowing; the two lights circle in
const X_MERGE = 2.65; // the lights become one
const X_DASH = 2.8; // bursts forward
const DASH_TIME = 0.32;
const X_BACK = X_DASH + DASH_TIME + 0.45; // flies back in from the left
const BACK_TIME = 0.55;
const X_END = X_BACK + BACK_TIME + 0.1;
const DASH_HALF = 130; // px: what the charge runs through around its row
const CHANT = ['겜…', '기르…', '간…', '고…', '구포…!!'];

const easeIn = (k) => k * k;
const easeOut = (k) => 1 - (1 - k) ** 3;

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
  bodyFilter(p, run) {
    const t = run.t;
    if (t < X_GLOW || t >= X_BACK + BACK_TIME) return null;
    const ramp = Math.min(1, (t - X_GLOW) / (X_MERGE - X_GLOW));
    const out = t > X_DASH + DASH_TIME ? Math.max(0, 1 - (t - X_DASH - DASH_TIME) / 0.4) : 1;
    return { filter: HYPER_GOLD, glow: (0.25 + 0.6 * ramp + (t >= X_MERGE && t < X_DASH + 0.1 ? 0.3 : 0)) * out };
  },
  start(p, run) {
    run.data.caught = new Set();
    run.data.lane = p.y - 4;
    run.data.lionHit = new Set();
    run.data.dashHit = new Set();
    run.data.lion = null;
  },
  timeline() {
    return [
      { t: 0, do: (r) => r.events.push({ type: 'cue', key: 'charge' }) },
      { t: X_TORNADO, do: (r, p) => {
        r.data.lane = p.y - 4;
        r.events.push({ type: 'clearBullets' });
        r.events.push({ type: 'shake', mag: 1.2 });
        r.events.push({ type: 'cue', key: 'laserFire' });
        r.events.push({ type: 'cue', key: 'hz:bolt' });
        spawnFx(r, { key: 'lao-fx-shockring', x: p.x + 60, y: r.data.lane, w: 240, h: 240, dur: 0.4 });
      } },
      { t: X_LION, do: (r, p) => {
        r.data.lion = { x0: p.x + (p.drawSize || 100) * 0.45, y: r.data.lane, t: 0 };
        r.events.push({ type: 'shake', mag: 1.4 });
        r.events.push({ type: 'hitstop', t: 0.05 });
        r.events.push({ type: 'cue', key: 'leaderBlast' });
        spawnFx(r, { key: 'lao-fx-shockring', x: p.x + 60, y: p.y, w: 240, h: 240, dur: 0.4 });
      } },
      { t: X_GLOW, do: (r) => { r.events.push({ type: 'cue', key: 'laserFire' }); } },
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
    // Tornado: catch every enemy within reach of the lane, root it and drag it onto the lane.
    if (run.t >= X_TORNADO && run.t < X_DASH) {
      const lane = run.data.lane;
      for (const e of run.enemies) {
        if (!e.alive || e.dying || !onScreen(e) || e.x < run.homeX) continue;
        if (Math.abs(e.y - lane) > TORNADO_HALF + (e.hitR || 18)) continue;
        run.data.caught.add(e);
        e.boriRootFor = Math.max(e.boriRootFor || 0, 1.2);
        if (e.kind !== 'boss' && e.kind !== 'midboss') e.y += (lane - e.y) * Math.min(1, dt * 5);
      }
    }
    // The lion: half the bomb on everything it runs through.
    const L = run.data.lion;
    if (L && L.t <= LION_TIME) {
      L.t += dt;
      const k = Math.min(1, L.t / LION_TIME);
      L.x = L.x0 + (W + 300 - L.x0) * (k * k * 0.6 + k * 0.4);
      L.size = 0.9 + 1.7 * Math.min(1, k * 2.2);
      const front = L.x + (p.drawSize || 100) * L.size * 0.3;
      const reachY = (p.drawSize || 100) * L.size * 0.42;
      for (const e of run.enemies) {
        if (!e.alive || run.data.lionHit.has(e) || !onScreen(e)) continue;
        if (e.x > front || Math.abs(e.y - L.y) > reachY + (e.hitR || 18)) continue;
        run.data.lionHit.add(e);
        run.events.push({ type: 'blastEnemy', enemy: e, scale: 0.5 });
        spawnFx(run, { key: 'lao-fx-fireball', x: e.x, y: e.y, w: 180, h: 180, dur: 0.5 });
      }
    }
    // The charge of light: the other half on everything it passes.
    if (run.t >= X_DASH && run.t < X_DASH + DASH_TIME + 0.05) {
      const k = easeIn(Math.min(1, (run.t - X_DASH) / DASH_TIME));
      const front = run.homeX + (W + 200 - run.homeX) * k + (p.drawSize || 100) * 0.5;
      for (const e of run.enemies) {
        if (!e.alive || run.data.dashHit.has(e) || !onScreen(e)) continue;
        if (e.x > front || Math.abs(e.y - run.homeY) > DASH_HALF + (e.hitR || 18)) continue;
        run.data.dashHit.add(e);
        run.events.push({ type: 'blastEnemy', enemy: e, scale: 0.5 });
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
    // Hand charging before the lion leaves it.
    if (t < X_LION) {
      const k = t / X_LION;
      bloom(ctx, home.x + size * 0.45, home.y - 4, size * (0.2 + 0.3 * k), size * (0.16 + 0.22 * k), 0.8);
    }
    // The electromagnetic tornado down the lane (until it charges).
    if (t >= X_TORNADO && t < X_DASH + 0.25) {
      const hx = home.x + size * 0.45;
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
      for (const [col, ph, w] of [['140,255,200', 0, 3], ['255,220,110', Math.PI, 2.5], ['220,255,240', Math.PI / 2, 1.5]]) {
        ctx.strokeStyle = `rgba(${col},${0.85 * fade})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        for (let x = hx; x <= x1; x += 6) {
          const u = (x - hx) / 60;
          const amp = TORNADO_HALF * (0.25 + 0.75 * Math.min(1, (x - hx) / 260));
          const y = hy + Math.sin(u - t * 14 + ph) * amp;
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
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tailX = Math.max(home.x, L.x - s * 2.2);
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
      const frame = Math.min(8, Math.floor((L.t / LION_TIME) * 9));
      const body = lionSheet('ramp-fx-lion', '#e8420e');
      const glow = lionSheet('ramp-fx-lion', '#ffb04a');
      const ring = lionSheet('ramp-fx-lioncenter', '#ffb24a');
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
    }
    // Captions: the chant while the hand charges, the shout as it charges out.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (t < X_LION + 0.4) {
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
    // The shout in two beats (user): "HELL AND…" as the lights merge, "HEAVEN!!" on the very
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
    shout('HELL AND…', '헬 앤드…', X_MERGE - 0.35, X_DASH, false);
    shout('HEAVEN!!', '헤븐!!', X_DASH, X_BACK + 0.3, true);
    ctx.restore();
  },
};

// ---------------------------------------------------------------- C swaps by arm part (user)
// With an arm-slot part on, C becomes that robot's own move (Rampalion still plays it):
// Hestia's hands -> the right hand thrust out, a flamethrower (Hestia skill 2);
// Goltarion's arms -> the sword it holds comes down overhead, the ground splits forward
// (Goltarion skill 2). Body: skill_2's hand-out pose (sheet clip), held.
const HAND_OUT = 0.75; // skill_2 sheet time with the hand out
const handPoint = (p, size) => ({ x: p.x + size * 0.42, y: p.y - 4 });

const FLAME_ON = 0.45;
const FLAME_OFF = 2.35;
const FLAME_LEN = 470;
const FLAME_TICKS = 16;

export const RAMPALION_HESTIA_C = {
  clip: 'skill2', duration: FLAME_OFF + 0.45, y0: 0, path: [[0, 0, 0], [FLAME_OFF + 0.45, 0, 0]],
  followShip: true,
  clipTime: (t) => Math.min(HAND_OUT, t * 1.6),
  start(p, run) {
    run.data.tick = 0;
    run.data.next = FLAME_ON;
    run.data.puff = 0;
  },
  timeline() {
    return [{ t: FLAME_ON, do: (r) => { r.events.push({ type: 'cue', key: 'hz:cone' }); r.events.push({ type: 'shake', mag: 0.5 }); } }];
  },
  tick(p, run, dt) {
    if (run.t < FLAME_ON || run.t > FLAME_OFF) return;
    const size = p.drawSize || 100;
    const h = handPoint(p, size);
    // Flame stream (GPU particles; canvas fallback draws in drawOver).
    run.data.puff -= dt;
    if (run.data.puff <= 0) {
      run.data.puff = 1 / 40;
      run.events.push({ type: 'gpuFlame', x: h.x, y: h.y, len: FLAME_LEN, dir: 0 });
    }
    if (run.data.tick >= FLAME_TICKS || run.t < run.data.next) return;
    run.data.tick += 1;
    run.data.next += (FLAME_OFF - FLAME_ON) / FLAME_TICKS;
    // Cone: everything within the widening flame ahead of the hand.
    const per = (run.level * 6) / FLAME_TICKS;
    for (const e of run.enemies) {
      if (!e.alive || e.dying || !onScreen(e)) continue;
      const dx = e.x - h.x;
      if (dx < -10 || dx > FLAME_LEN + 40) continue;
      const half = 26 + dx * 0.22 + (e.hitR || 18);
      if (Math.abs(e.y - h.y) > half) continue;
      run.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount: per, hitStyle: 'heatmissile' });
    }
  },
  drawOver(ctx, p, run, size) {
    const t = run.t;
    if (t < FLAME_ON - 0.1 || t > FLAME_OFF + 0.2) return;
    const h = handPoint(p, size);
    const k = Math.min(1, (t - FLAME_ON + 0.1) / 0.15) * Math.min(1, (FLAME_OFF + 0.2 - t) / 0.2);
    // Muzzle glow + a soft cone body under the particles (also the no-WebGL look).
    bloom(ctx, h.x, h.y, size * 0.4, size * 0.3, 0.9 * k);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(h.x, 0, h.x + FLAME_LEN, 0);
    // Faint heat haze only: the particles carry the flame (a strong fill read as a flat wedge).
    g.addColorStop(0, `rgba(255,220,150,${0.22 * k})`);
    g.addColorStop(0.45, `rgba(255,120,40,${0.1 * k})`);
    g.addColorStop(1, 'rgba(200,40,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y - 10);
    ctx.lineTo(h.x + FLAME_LEN, h.y - 26 - FLAME_LEN * 0.22);
    ctx.lineTo(h.x + FLAME_LEN, h.y + 26 + FLAME_LEN * 0.22);
    ctx.lineTo(h.x, h.y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
};

const SWING_UP = 0.35; // sword raised overhead
const SWING_HIT = 0.55; // comes down
const QUAKE_TIME = 0.9; // the ground split runs to the right edge
const GOLT_END = SWING_HIT + QUAKE_TIME + 0.35;

export const RAMPALION_GOLT_C = {
  clip: 'skill2', duration: GOLT_END, y0: 0, path: [[0, 0, 0], [GOLT_END, 0, 0]],
  followShip: true,
  clipTime: (t) => Math.min(HAND_OUT, t * 2),
  start(p, run) {
    run.data.hit = new Set();
    run.data.quakeX = null;
  },
  timeline() {
    return [
      { t: SWING_HIT, do: (r, p) => {
        const size = p.drawSize || 100;
        const gx = p.x + size * 0.9;
        const gy = p.y + size * 0.3;
        r.data.quakeX = gx;
        r.data.gy = gy;
        r.events.push({ type: 'shake', mag: 1.6 });
        r.events.push({ type: 'hitstop', t: 0.06 });
        r.events.push({ type: 'cue', key: 'missileBlast' });
        r.events.push({ type: 'cue', key: 'hz:fall' });
        spawnFx(r, { key: 'lao-fx-shockring', x: gx, y: gy, w: 260, h: 120, dur: 0.45 });
        spawnFx(r, { key: 'lao-fx-airboom', x: gx, y: gy - 30, w: 200, h: 200, dur: 0.4 });
      } },
    ];
  },
  tick(p, run, dt) {
    if (run.data.quakeX == null) return;
    // The split races right; pillars of rock burst up along it, hitting what stands on its row.
    const prev = run.data.quakeX;
    run.data.quakeX = Math.min(W + 60, prev + (W / QUAKE_TIME) * dt);
    const gy = run.data.gy;
    if (Math.floor(run.data.quakeX / 70) !== Math.floor(prev / 70) && run.data.quakeX < W + 40) {
      const rx = run.data.quakeX;
      spawnFx(run, { dur: 0.6, draw: (ctx, k) => {
        // Rock pillar bursting up out of the split, then sinking back.
        const img = getNativeWeaponImage('lao-fx-rocks');
        if (!img) return;
        const rise = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75 * 0.6;
        const w = 120;
        const hh = (w * img.height) / img.width * 1.4 * rise;
        ctx.save();
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.drawImage(img, rx - w / 2, gy - hh, w, hh);
        ctx.restore();
      } });
      spawnFx(run, { key: 'lao-fx-groundsmoke', x: run.data.quakeX, y: gy - 10, w: 150, h: 110, dur: 0.6,
        blend: 'source-over', alpha: 0.7, layer: 'under' });
    }
    const amount = run.level * 6;
    for (const e of run.enemies) {
      if (!e.alive || run.data.hit.has(e) || !onScreen(e)) continue;
      if (e.x > run.data.quakeX || e.x < p.x) continue;
      if (Math.abs(e.y - p.y) > 120 + (e.hitR || 18)) continue;
      run.data.hit.add(e);
      run.events.push({ type: 'damage', target: e, x: e.x, y: e.y, amount });
      spawnFx(run, { key: 'lao-fx-airboom', x: e.x, y: e.y, w: 150, h: 150, dur: 0.4 });
    }
  },
  drawOver(ctx, p, run, size) {
    // The held sword sweeps from overhead down in front (drawn from the fused part's image).
    const sword = p._ramp?.anims?.fw_golt_sword;
    if (!sword?.draw) return;
    const t = run.t;
    const h = handPoint(p, size);
    // ang = canvas rotation of the image (its blade points +y, down). Blade direction =
    // ang + 90 deg: rest up-forward -> back over the head (up-left) -> chop to down-forward.
    let ang;
    if (t < SWING_UP) ang = -2.62 - 1.05 * (t / SWING_UP);
    else if (t < SWING_HIT) {
      const k = (t - SWING_UP) / (SWING_HIT - SWING_UP);
      ang = -3.67 + 2.62 * k * k;
    } else ang = -1.05; // planted, point down-forward
    const len = size * 1.15;
    ctx.save();
    if (t >= SWING_UP && t < SWING_HIT + 0.1) {
      // Swing arc trail.
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(200,140,255,0.55)';
      ctx.lineWidth = size * 0.18;
      ctx.beginPath();
      ctx.arc(h.x, h.y, len * 0.6, -3.67 + Math.PI / 2, ang + Math.PI / 2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // The sword image points down (blade +y): rotate so the blade follows ang.
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    sword.draw(ctx, 0, len * 0.32, len, { flipX: false });
    ctx.restore();
  },
};

/** C for Rampalion right now: the arm part's move if one is fused, else its own skill_1. */
export function rampalionSpecialSpec(p) {
  const arm = p?._ramp?.slots?.find((e) => e.attached && e.slot.id === 'arm');
  if (arm?.opt.special === 'hestia') return RAMPALION_HESTIA_C;
  if (arm?.opt.special === 'goltarion') return RAMPALION_GOLT_C;
  return RAMPALION_C;
}
