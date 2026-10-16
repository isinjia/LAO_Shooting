// LRL bomb (X) as a run (skill-run.js), redesigned by request on her Skill2 body frames
// (lrl-skill2-clean, 36 frames of 192 px): she spins up (0-14), pulls the eyepatch off (15),
// the eye flash is held long on her beam pose (17; frame 16's baked yellow star is skipped)
// with a growing red star glint and a charge-in, then a red beam
// big enough to cover the field fires forward from her eye for 1.5s while she holds the
// pose (17-26), and she puts the patch back on (27-35).
// Damage: the bomb budget is split over the beam's ticks (everything on screen is inside it).
// SFX: Bling_Sound (flash), Energy_In_aura_sound (charge), atk_Beam1 (beam), original clips.
import { W, H } from './canvas.js';
import { bloom } from './run-fx.js';
import { spawnFx, cameraStop, sfxEvent, runPos } from './skill-run.js';

const FPS = 22;
// Run-time phases (s).
const SPIN = [0, 0.55]; // frames 0-14
const PATCH = [0.55, 0.75]; // frame 15
const FLASH = [0.75, 1.75]; // frame 17 held (16's yellow star skipped)
const BEAM = [1.75, 3.25]; // frames 17-26
const END = [3.25, 3.66]; // frames 27-35
const X_END = END[1];
const BEAM_TICKS = 12;

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Run time -> skill2 clip time (frame / FPS), remapped to the phases above. */
function clipTime(t) {
  let f;
  if (t < SPIN[1]) f = (t / SPIN[1]) * 15;
  else if (t < PATCH[1]) f = 15;
  else if (t < FLASH[1]) f = 17;
  else if (t < BEAM[1]) f = 17 + ((t - BEAM[0]) / (BEAM[1] - BEAM[0])) * 10;
  else f = 27 + clamp01((t - END[0]) / (END[1] - END[0])) * 8.99;
  return (Math.min(35.99, f) + 0.01) / FPS;
}

// Her glowing eye in the 192 px cell, measured on lrl-skill2-clean (red sparkle centre):
// the head turns between frames 19 and 20.
const eyeCell = (frame) => (frame < 20 ? [152, 67] : [133, 65]);

/** Her glowing eye on screen for the current body frame (cell -> drawn box, centred). */
function eyeAt(p, r) {
  const [cx, cy] = eyeCell(Math.floor(clipTime(r.t) * FPS));
  const q = runPos(p, r);
  const s = p.drawSize;
  return { x: q.x + p.drawOffsetX + ((cx - 96) / 192) * s, y: q.y + p.drawOffsetY + ((cy - 96) / 192) * s };
}

/** Four-point star glint (eye flash), additive. */
function star(ctx, x, y, size, rot, alpha) {
  if (alpha <= 0.01 || size <= 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (const [len, wid, col] of [[1, 0.09, 'rgba(255,60,50,0.85)'], [0.75, 0.05, 'rgba(255,230,200,1)']]) {
    ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -size * wid);
      ctx.lineTo(size * len, 0);
      ctx.lineTo(0, size * wid);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  bloom(ctx, x, y, size * 0.32, size * 0.32, alpha);
}

/** Field-filling red beam from (x, y) to past the right edge; `k` = 0..1 through the beam. */
function drawBeam(ctx, x, y, k, t) {
  const grow = ease(clamp01(k / 0.08));
  const fall = 1 - ease(clamp01((k - 0.86) / 0.14));
  const amp = grow * fall;
  if (amp <= 0.01) return;
  const half = (H * 0.62) * amp * (1 + 0.03 * Math.sin(t * 60));
  const len = W + 80 - x;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Body: layered vertical gradients, tapering into the eye.
  const layer = (hw, stops, a) => {
    const g = ctx.createLinearGradient(0, y - hw, 0, y + hw);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - hw * 0.12);
    ctx.quadraticCurveTo(x + 60, y - hw, x + 140, y - hw);
    ctx.lineTo(x + len, y - hw);
    ctx.lineTo(x + len, y + hw);
    ctx.lineTo(x + 140, y + hw);
    ctx.quadraticCurveTo(x + 60, y + hw, x, y + hw * 0.12);
    ctx.closePath();
    ctx.fill();
  };
  layer(half, [[0, 'rgba(120,0,10,0)'], [0.25, 'rgba(200,10,25,0.75)'], [0.5, 'rgba(255,40,40,0.95)'],
    [0.75, 'rgba(200,10,25,0.75)'], [1, 'rgba(120,0,10,0)']], 0.9);
  layer(half * 0.55, [[0, 'rgba(255,40,40,0)'], [0.3, 'rgba(255,90,70,0.9)'], [0.5, 'rgba(255,200,180,1)'],
    [0.7, 'rgba(255,90,70,0.9)'], [1, 'rgba(255,40,40,0)']], 0.85);
  layer(half * 0.22, [[0, 'rgba(255,220,210,0)'], [0.5, 'rgba(255,255,250,1)'], [1, 'rgba(255,220,210,0)']], 0.95);
  // Speed streaks running down the beam.
  ctx.globalAlpha = 0.55 * amp;
  ctx.fillStyle = 'rgba(255,235,225,1)';
  for (let i = 0; i < 22; i++) {
    const lane = ((i * 0.6180339) % 1) * 2 - 1;
    const sy = y + lane * half * 0.85;
    const sp = 900 + (i % 5) * 260;
    const sx = x + 120 + ((t * sp + i * 173) % (len + 300)) - 150;
    const sl = 80 + (i % 4) * 60;
    const sh = 2 + (i % 3) * 1.5 * (1 - Math.abs(lane));
    ctx.fillRect(sx, sy - sh / 2, sl, sh);
  }
  ctx.restore();
  // Muzzle flare at the eye.
  bloom(ctx, x + 30, y, 110 * amp, 90 * amp, 0.85 * amp);
  star(ctx, x, y, 60 * amp, t * 3, 0.9 * amp);
}

export const LRL_X = {
  clip: 'skill2', duration: X_END, y0: 0, path: [[0, 0, 0], [X_END, 0, 0]], k: 10,
  speed: 1.2, // X 20% faster: bomb DPS clearly above Lv5 fire with the halved leader damage
  clipTime,
  timeline(run) {
    const list = [];
    // Eyepatch off -> long eye flash with a charge-in, then the beam.
    list.push(sfxEvent(PATCH[0] + 0.15, 'common_bling'), sfxEvent(FLASH[0] + 0.1, 'common_energy_in_aura'),
      sfxEvent(BEAM[0], 'lrl_beam'));
    // Push in on her face for the flash, snap back out as the beam fires.
    list.push({ t: PATCH[0], do: (r) => r.events.push({ type: 'camera', zoom: 1.4, blend: 0.35, focus: 'self' }) },
      cameraStop(BEAM[0], 0.08));
    list.push({ t: FLASH[0], do: (r) => r.events.push({ type: 'hitstop', t: 0.12 }) });
    // The eye flash: a glint that swells over the hold, and red motes pulled into the eye.
    list.push({ t: FLASH[0], do: (r, p) => {
      spawnFx(r, { dur: FLASH[1] - FLASH[0] + 0.12, draw: (ctx, k) => {
        const e = eyeAt(p, r);
        const sw = ease(clamp01(k / 0.85));
        const pulse = 1 + 0.12 * Math.sin(k * 40);
        star(ctx, e.x, e.y, (14 + 46 * sw) * pulse, k * 1.2, Math.min(1, k * 6));
        // Charge-in motes.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26; i++) {
          const ph = (k * 2.2 + i * 0.137) % 1;
          const ang = i * 2.399;
          const dist = (1 - ph) * (70 + (i % 5) * 18);
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
          ctx.fillStyle = i % 3 ? 'rgba(255,50,40,1)' : 'rgba(255,220,200,1)';
          const sz = 2 + (i % 3);
          ctx.fillRect(e.x + Math.cos(ang) * dist - sz / 2, e.y + Math.sin(ang) * dist - sz / 2, sz, sz);
        }
        ctx.restore();
      } });
      // Dim the field so the eye reads.
      spawnFx(r, { dur: BEAM[1] - FLASH[0], layer: 'under', draw: (ctx, k) => {
        const tt = k * (BEAM[1] - FLASH[0]);
        const a = 0.45 * clamp01(tt / 0.3) * (1 - clamp01((tt - (BEAM[0] - FLASH[0])) / 0.25) * 0.6)
          * (1 - clamp01((k - 0.9) / 0.1));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#12020a';
        ctx.fillRect(-50, -50, W + 100, H + 100);
        ctx.restore();
      } });
    } });
    // The beam.
    list.push({ t: BEAM[0], do: (r, p) => {
      r.events.push({ type: 'hitstop', t: 0.08 });
      spawnFx(r, { dur: BEAM[1] - BEAM[0], draw: (ctx, k) => {
        const e = eyeAt(p, r);
        drawBeam(ctx, e.x, e.y, k, r.t);
      } });
      // White-out at ignition.
      spawnFx(r, { dur: 0.22, draw: (ctx, k) => {
        ctx.save();
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.fillStyle = '#ffd8d0';
        ctx.fillRect(-50, -50, W + 100, H + 100);
        ctx.restore();
      } });
    } });
    for (let i = 0; i < BEAM_TICKS; i++) {
      const t = BEAM[0] + 0.08 + (i / BEAM_TICKS) * (BEAM[1] - BEAM[0] - 0.2);
      list.push({ t, do: (r) => {
        r.events.push({ type: 'blast', share: 1 / BEAM_TICKS });
        r.events.push({ type: 'shake', mag: i === 0 ? 1.2 : 0.45 });
      } });
    }
    return list;
  },
};
