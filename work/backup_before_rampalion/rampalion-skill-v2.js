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
const X_CLIP_END = 2.0167;
const X_HAND = 0.75; // clip time where the hand is out (held during the tornado / lion)
const X_TORNADO = 0.75; // run time the tornado fires
const X_LION = 1.45; // run time the lion bursts out
const X_FINISH = 2.45; // finish card
const X_HOLD_END = 2.7; // the clip resumes (hand back) here
const X_END = X_HOLD_END + (X_CLIP_END - X_HAND);
const LION_TIME = 1.0;
const TORNADO_HALF = 120; // px: catch radius around the lane
const CHANT = ['겜…', '기르…', '간…', '고…', '구포…!!'];

const ease = (k) => k * k * (3 - 2 * k);

export const RAMPALION_X = {
  clip: 'skill2', duration: X_END, y0: 0, path: [[0, 0, 0], [X_END, 0, 0]],
  // Rooted for the cast (bomb i-frames from startRun); the hand stays out while it fires.
  clipTime: (t) => (t < X_HAND ? t : t < X_HOLD_END ? X_HAND : Math.min(X_CLIP_END - 0.02, X_HAND + (t - X_HOLD_END))),
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
    L.size = 0.9 + 2.6 * Math.min(1, k * 2.2);
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
    if (t < X_FINISH) {
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
