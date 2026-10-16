// Rampalion (CT66 Rampart, "램파리온 커스텀 팩") original skills as runs (skill-run.js).
//
// C = skill_1 (user): the wings fan out and fold forward into a giant blade-lance that drives
// straight ahead, hitting everything in its lane (several ticks). The sheet keeps the clip's
// window around its release (pack_sprite_sheets SKILL_PRE / SKILL_POST: 1.92-4.78s of the
// 7.4s clip), which is exactly the lance; times below are in that sheet clip.
// X = skill_2 as a "HELL AND HEAVEN" parody (user): see RAMPALION_X below.
import { W, H, onScreen } from './canvas.js';
import { bloom, drawSheetAt, clamp01 } from './run-fx.js';
import { spawnFx } from './skill-run.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';

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

// X: "HELL AND HEAVEN" parody (user, GaoGaiGar): power gathers in both hands (gold = hell,
// green = heaven) while the chant scrolls, the hand thrusts out and an electromagnetic
// tornado shoots down the lane, catching and rooting every enemy in it, the giant lion rides
// the tornado through them (bomb on each), then the finish card.
// Body: skill_1's lance pose (wings folded forward, hands out - user), held, then Rampalion
// itself charges down the tornado behind a lion-head aura, off the right edge, and flies
// back in from the left.
const X_POSE = 1.55; // sheet time of the held lance pose (skill_1 window, 'attack' state)
const X_TORNADO = 0.75; // run time the tornado fires
const X_LION = 1.45; // run time the charge starts
const LION_TIME = 1.0;
const X_FINISH = X_LION + LION_TIME; // finish card (it is off the right edge by then)
const X_BACK = 0.6; // fly back in from the left
const X_END = X_FINISH + X_BACK + 0.2;
const TORNADO_HALF = 120; // px: catch radius around the lane
const CHANT = ['겜…', '기르…', '간…', '고…', '구포…!!'];

const ease = (k) => k * k * (3 - 2 * k);

export const RAMPALION_X = {
  clip: 'attack', duration: X_END, y0: 0, path: [[0, 0, 0], [X_END, 0, 0]],
  // Bomb i-frames from startRun; the lance pose folds in, then holds for the whole charge.
  clipTime: (t) => Math.min(X_POSE, X_POSE - 0.7 + t),
  pos(p, run, t) {
    const L = run.data.lion;
    const s = p.drawSize || 100;
    if (L && L.t <= LION_TIME) return { x: Math.max(run.homeX, L.x - s * L.size * 0.55), y: run.homeY };
    if (t >= X_FINISH) {
      const k = Math.min(1, (t - X_FINISH) / X_BACK);
      const e = 1 - (1 - k) ** 3;
      return { x: -s + (p.x + s) * e, y: run.homeY + (p.y - run.homeY) * e };
    }
    return null;
  },
  start(p, run) {
    run.data.hit = new Set();
    run.data.caught = new Set();
    run.data.lion = null;
    run.data.lane = p.y - 4;
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
        r.data.lion = { x0: p.x + 40, y: r.data.lane, t: 0 };
        r.events.push({ type: 'flash', t: 0.1 });
        r.events.push({ type: 'shake', mag: 1.8 });
        r.events.push({ type: 'hitstop', t: 0.05 });
        r.events.push({ type: 'cue', key: 'leaderBlast' });
      } },
      { t: X_FINISH, do: (r) => {
        r.events.push({ type: 'clearBullets' });
        r.events.push({ type: 'flash', t: 0.22 });
        r.events.push({ type: 'shake', mag: 2.2 });
        r.events.push({ type: 'cue', key: 'missileBlast' });
      } },
    ];
  },
  tick(p, run, dt) {
    const lane = run.data.lane;
    // Tornado: catch every enemy within reach of the lane, root it and drag it onto the lane.
    if (run.t >= X_TORNADO && run.t < X_FINISH) {
      for (const e of run.enemies) {
        if (!e.alive || e.dying || !onScreen(e) || e.x < p.x) continue;
        const leader = e.kind === 'boss' || e.kind === 'midboss';
        if (Math.abs(e.y - lane) > TORNADO_HALF + (e.hitR || 18)) continue;
        run.data.caught.add(e);
        e.boriRootFor = Math.max(e.boriRootFor || 0, 1.2);
        if (!leader) e.y += (lane - e.y) * Math.min(1, dt * 5);
      }
    }
    const L = run.data.lion;
    if (!L) return;
    L.t += dt;
    const k = Math.min(1, L.t / LION_TIME);
    L.x = L.x0 + (W + 300 - L.x0) * (k * k * 0.6 + k * 0.4);
    L.size = 0.9 + 0.9 * Math.min(1, k * 2.2);
    const front = L.x + (p.drawSize || 100) * L.size * 0.3;
    const reachY = Math.max(TORNADO_HALF, (p.drawSize || 100) * L.size * 0.42);
    for (const e of run.enemies) {
      if (!e.alive || run.data.hit.has(e) || !onScreen(e)) continue;
      if (e.x > front || Math.abs(e.y - L.y) > reachY + (e.hitR || 18)) continue;
      run.data.hit.add(e);
      run.events.push({ type: 'blastEnemy', enemy: e });
      spawnFx(run, { key: 'lao-fx-fireball', x: e.x, y: e.y, w: 200, h: 200, dur: 0.55 });
      spawnFx(run, { key: 'lao-fx-shockring', x: e.x, y: e.y, w: 220, h: 220, dur: 0.4 });
    }
  },
  drawOver(ctx, p, run, size) {
    const t = run.t;
    const lane = run.data.lane;
    const hx = p.x + size * 0.45;
    const hy = lane;
    // 1) Hell (gold) and Heaven (green) gathering on the hand.
    if (t < X_LION) {
      const k = Math.min(1, t / X_TORNADO);
      const pulse = 0.8 + 0.2 * Math.sin(t * 30);
      bloom(ctx, hx, hy - 10, size * (0.25 + 0.35 * k), size * (0.2 + 0.25 * k), 0.75 * pulse);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [col, ph] of [['255,210,80', 0], ['90,255,160', Math.PI]]) {
        const a = t * 9 + ph;
        const r = size * (0.28 - 0.12 * k);
        const g = ctx.createRadialGradient(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.6, 0,
          hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.6, size * 0.22);
        g.addColorStop(0, `rgba(${col},0.95)`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.6, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // 2) The electromagnetic tornado down the lane.
    if (t >= X_TORNADO && t < X_FINISH + 0.25) {
      const grow = ease(Math.min(1, (t - X_TORNADO) / 0.35));
      const fade = t > X_FINISH ? Math.max(0, 1 - (t - X_FINISH) / 0.25) : 1;
      const x1 = hx + (W + 40 - hx) * grow;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const body = ctx.createLinearGradient(0, hy - TORNADO_HALF, 0, hy + TORNADO_HALF);
      body.addColorStop(0, 'rgba(60,255,150,0)');
      body.addColorStop(0.5, `rgba(120,255,190,${0.22 * fade})`);
      body.addColorStop(1, 'rgba(60,255,150,0)');
      ctx.fillStyle = body;
      ctx.fillRect(hx, hy - TORNADO_HALF, x1 - hx, TORNADO_HALF * 2);
      // Spiral strands: two counter-phased helices (green / gold) twisting toward the right.
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
      // Caught enemies spark inside it.
      for (const e of run.data.caught) {
        if (!e.alive) continue;
        bloom(ctx, e.x, e.y, 34, 34, 0.5 * fade * (0.6 + 0.4 * Math.sin(t * 40 + e.x)), 'cyan');
      }
    }
    // 3) The lion riding the tornado.
    const L = run.data.lion;
    if (L && L.t <= LION_TIME + 0.2) {
      const lion = p._ramp?.anims?.fx_ramp_lion;
      const s = (p.drawSize || 100) * L.size;
      const fade = L.t > LION_TIME ? Math.max(0, 1 - (L.t - LION_TIME) / 0.2) : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tailX = Math.max(p.x, L.x - s * 2.2);
      const g = ctx.createLinearGradient(tailX, 0, L.x, 0);
      g.addColorStop(0, 'rgba(255,90,20,0)');
      g.addColorStop(0.7, `rgba(255,140,40,${0.45 * fade})`);
      g.addColorStop(1, `rgba(255,220,150,${0.75 * fade})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse((tailX + L.x) / 2, L.y, (L.x - tailX) / 2 + 1, s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      bloom(ctx, L.x, L.y, s * 0.9, s * 0.6, 0.7 * fade);
      ctx.restore();
      if (lion?.draw) {
        ctx.save();
        ctx.globalAlpha = fade;
        lion.draw(ctx, L.x, L.y, s, { flipX: false });
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * fade;
        ctx.filter = 'brightness(1.6) sepia(1) saturate(6) hue-rotate(-15deg)';
        lion.draw(ctx, L.x, L.y, s, { flipX: false });
        ctx.restore();
      }
    }
    // 4) Captions: the chant while it charges, the name on the finish.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (t < X_LION) {
      const n = Math.min(CHANT.length, Math.floor(t / (X_TORNADO / CHANT.length)) + 1);
      const text = CHANT.slice(0, n).join(' ');
      ctx.font = '900 30px "Noto Sans KR", "Chakra Petch", sans-serif';
      ctx.globalAlpha = Math.min(1, (X_LION - t) / 0.2);
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(20,10,0,0.9)';
      ctx.strokeText(text, W / 2, H * 0.2);
      ctx.fillStyle = '#ffe28a';
      ctx.fillText(text, W / 2, H * 0.2);
    }
    if (t >= X_FINISH - 0.1 && t < X_END) {
      const k = Math.min(1, (t - (X_FINISH - 0.1)) / 0.15);
      const out = t > X_END - 0.4 ? Math.max(0, (X_END - t) / 0.4) : 1;
      const sc = 1.6 - 0.6 * k;
      ctx.translate(W / 2, H * 0.42);
      ctx.scale(sc, sc);
      ctx.globalAlpha = k * out;
      ctx.font = '900 54px "Chakra Petch", "Noto Sans KR", sans-serif';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(30,8,0,0.95)';
      ctx.strokeText('HELL AND HEAVEN!!', 0, 0);
      const fg = ctx.createLinearGradient(0, -30, 0, 30);
      fg.addColorStop(0, '#fff7c2');
      fg.addColorStop(0.5, '#ffb52e');
      fg.addColorStop(1, '#ff5a1f');
      ctx.fillStyle = fg;
      ctx.fillText('HELL AND HEAVEN!!', 0, 0);
      ctx.font = '800 22px "Noto Sans KR", sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeText('헬 앤드 헤븐!!', 0, 42);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('헬 앤드 헤븐!!', 0, 42);
    }
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
