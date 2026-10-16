// Rampalion (CT66 Rampart, "램파리온 커스텀 팩") original skills as runs (skill-run.js).
//
// C = skill_1 (user): the wings fan out and fold forward into a giant blade-lance that drives
// straight ahead, hitting everything in its lane (several ticks). The sheet keeps the clip's
// window around its release (pack_sprite_sheets SKILL_PRE / SKILL_POST: 1.92-4.78s of the
// 7.4s clip), which is exactly the lance; times below are in that sheet clip.
// X = skill_2 (user): the hand thrusts forward and a GIANT LION (its own lion head, baked
// alone as fx_ramp_lion) bursts out of it and charges across the whole field, blasting every
// enemy it runs through, clearing bullets on the way.
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

const X_CLIP_END = 2.0167;
const X_LAUNCH = 0.62; // the hand is out
const X_END = 2.9; // lion is across the field by then
const LION_TIME = 1.4;

export const RAMPALION_X = {
  clip: 'skill2', duration: X_END, y0: 0, path: [[0, 0, 0], [X_END, 0, 0]],
  // Rooted for the cast (bomb i-frames from startRun).
  clipTime: (t) => Math.min(X_CLIP_END - 0.02, t),
  start(p, run) {
    run.data.hit = new Set();
    run.data.lion = null;
  },
  timeline() {
    return [
      { t: X_LAUNCH, do: (r, p) => {
        r.data.lion = { x0: p.x + 40, y: p.y - 6, t: 0 };
        r.events.push({ type: 'clearBullets' });
        r.events.push({ type: 'flash', t: 0.12 });
        r.events.push({ type: 'shake', mag: 1.6 });
        r.events.push({ type: 'hitstop', t: 0.05 });
        r.events.push({ type: 'cue', key: 'leaderBlast' });
        r.events.push({ type: 'cue', key: 'missileBlast' });
        spawnFx(r, { key: 'lao-fx-shockring', x: p.x + 60, y: p.y, w: 260, h: 260, dur: 0.45 });
      } },
    ];
  },
  tick(p, run, dt) {
    const L = run.data.lion;
    if (!L) return;
    L.t += dt;
    const k = clamp01(L.t / LION_TIME);
    // Bursts out, accelerating, growing to fill the lane.
    L.x = L.x0 + (W + 300 - L.x0) * (k * k * 0.6 + k * 0.4);
    L.size = 0.9 + 2.6 * Math.min(1, k * 2.2);
    // Everything the lion's head passes (its front edge) takes the bomb, once.
    const front = L.x + (p.drawSize || 100) * L.size * 0.3;
    const reachY = (p.drawSize || 100) * L.size * 0.42;
    for (const e of run.enemies) {
      if (!e.alive || run.data.hit.has(e) || !onScreen(e)) continue;
      if (e.x > front || Math.abs(e.y - L.y) > reachY + (e.hitR || 18)) continue;
      run.data.hit.add(e);
      run.events.push({ type: 'blastEnemy', enemy: e });
      spawnFx(run, { key: 'lao-fx-fireball', x: e.x, y: e.y, w: 180, h: 180, dur: 0.5 });
    }
    // Last stretch: whatever stands anywhere on the lion's row is caught by its wake.
    if (k >= 1 && !run.data.done) {
      run.data.done = true;
      run.events.push({ type: 'shake', mag: 1.0 });
    }
  },
  drawOver(ctx, p, run, size) {
    const L = run.data.lion;
    if (!L || L.t > LION_TIME + 0.2) return;
    const lion = p._ramp?.anims?.fx_ramp_lion;
    const s = (p.drawSize || 100) * L.size;
    const fade = L.t > LION_TIME ? Math.max(0, 1 - (L.t - LION_TIME) / 0.2) : 1;
    ctx.save();
    // Flame wake streaming behind it.
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
    for (let i = 0; i < 4; i++) {
      drawSheetAt(ctx, 'lao-fx-fireline', (L.t * 3 + i * 0.25) % 1, L.x - s * (0.5 + i * 0.35), L.y + (i - 1.5) * s * 0.14,
        s * 1.2, s * 0.3, { alpha: 0.6 * fade });
    }
    bloom(ctx, L.x, L.y, s * 0.9, s * 0.6, 0.7 * fade);
    ctx.restore();
    if (lion?.draw) {
      ctx.save();
      ctx.globalAlpha = fade;
      lion.draw(ctx, L.x, L.y, s, { flipX: false });
      // Hot rim so it reads as an energy beast, not a cut-out.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * fade;
      ctx.filter = 'brightness(1.6) sepia(1) saturate(6) hue-rotate(-15deg)';
      lion.draw(ctx, L.x, L.y, s, { flipX: false });
      ctx.restore();
    }
  },
};
