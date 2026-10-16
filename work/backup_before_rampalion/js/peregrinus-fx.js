// Peregrinus transformation FX (bird <-> human), after the original particle prefabs
// Peregrinus_N_Change / Peregrinus_N_CH_Change. The clip switches them on at 0.67s
// (bird_change_motion) / 0.5s (change_motion); every emitter is a one-shot burst at its
// own start delay. Textures (assets/native-shots/peregrinus-fx-*): Peregrinus_dust2 (wind,
// 2x8), Hirume_ink1 (ink burst, 4x4), 256_light_texture (glow) tinted the prefab's
// green #00FFA2; NickyTracy_N_attack (sparks, 4x1) and NickyTracy_N_line (streaks) as is;
// 128_dust_texture brown dust. Times and lifetimes are divided by the clip's play speed.
import { drawCell } from './run-fx.js';
import { W } from './canvas.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';

/** Unity units -> screen px for Peregrinus at drawSize 156 (shared 22.4-unit box). */
const UNIT = 7;
/**
 * FX root (her feet, Unity origin) relative to the drawn sprite centre, in screen px:
 * shared bake camera [-15, -6.5, 18.5, 24.2] units on 768 px, contentBox centre
 * (382.5, 373.5), draw scale 156 / 513.
 */
const ROOT_X = -11.7;
const ROOT_Y = 54.9;

// [delay s, kind, x units, y units (up), size units, life s, count] - emitter positions,
// sizes, lifetimes and burst counts from the prefabs. Kinds: ink = Hirume_ink1 sheet
// (ready / line), wind = Peregrinus_dust2 sheet (ground), glow = 256_light_texture,
// spark = NickyTracy_N_attack, streak = NickyTracy_N_line burst, mote = lightdust,
// dust = 128_dust_texture, eye = the closing glint at her eye.
/** Piecewise-linear [t, v] keys (Unity curve, linear approximation). */
function pw(keys, k) {
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (k <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return v0 + (v1 - v0) * ((k - t0) / Math.max(1e-6, t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}
// Size-over-lifetime Y of the three beam layers and their alpha keys.
const BEAM_Y = {
  beam: [[0.05, 1], [0.2, 0.17], [0.23, 0.27], [0.27, 0.18], [0.31, 0.26], [0.36, 0.18], [0.4, 0.26],
    [0.44, 0.18], [0.47, 0.26], [0.5, 0.19], [0.55, 0.26], [0.57, 0.18], [0.76, 0.48], [0.79, 0.48], [1, 0.03]],
  beam1: [[0.05, 1], [0.2, 0.44], [0.23, 0.54], [0.27, 0.45], [0.31, 0.54], [0.36, 0.46], [0.4, 0.54],
    [0.44, 0.46], [0.47, 0.54], [0.5, 0.47], [0.55, 0.54], [0.57, 0.46], [0.76, 0.76], [0.79, 0.75], [1, 0.03]],
  beamlight: [[0.05, 1], [0.17, 0.44], [0.19, 0.54], [0.23, 0.45], [0.26, 0.54], [0.3, 0.46], [0.33, 0.54],
    [0.36, 0.46], [0.39, 0.54], [0.41, 0.47], [0.45, 0.54], [0.47, 0.46], [0.57, 0.76], [0.6, 0.75], [1, 0.03]],
};
const BEAM_A = {
  beam: [[0, 1], [0.85, 1], [1, 0]],
  beam1: [[0, 1], [0.85, 1], [1, 0]],
  beamlight: [[0, 0.31], [0.6, 0.31], [0.7, 0.17], [0.85, 0.04], [1, 0]],
};
// light (1): the 100-unit muzzle bloom (uniform size curve, flickering), alpha keys.
const BLOOM_S = [[0.05, 1], [0.17, 0.35], [0.19, 0.46], [0.23, 0.36], [0.26, 0.45], [0.3, 0.37], [0.33, 0.45],
  [0.36, 0.37], [0.39, 0.45], [0.41, 0.38], [0.45, 0.45], [0.47, 0.37], [0.57, 0.67], [0.6, 0.66], [1, 0.03]];
const BLOOM_A = [[0, 1], [0.6, 1], [0.7, 0.55], [0.85, 0.12], [1, 0]];
// eye (Skill2_A): 50 x 10 flare, x 0.37 -> 1, y 1 -> 0.2 -> 0, fading after 0.65.
const FLARE_X = [[0.1, 0.37], [0.5, 0.94], [1, 1]];
const FLARE_Y = [[0.25, 1], [0.55, 0.2], [1, 0]];
const FLARE_A = [[0, 1], [0.65, 1], [0.7, 0.55], [0.8, 0.24], [0.9, 0.1], [1, 0]];

const TIMELINES = {
  change: [ // Peregrinus_N_Change
    [0.0, 'ink', 0.73, 7.0, 12, 0.6, 3],
    [0.1, 'dust', 0.49, 0.0, 8, 1.0, 27],
    [0.1, 'wind', -0.21, 1.16, 19, 3.5, 1, { half: 0, anim: 0.1, h: 0.225 }],
    [0.1, 'wind', 0.49, -0.09, 20, 3.5, 1, { half: 1, anim: 0.1, h: 0.225 }],
    [0.1, 'ink', 0.49, 2.0, 12, 0.6, 1],
    [0.85, 'ellipse', 1.69, 9.6, 20, 0.8, 1, { h: 0.4 }],
    [1.367, 'spark', 0.76, 6.21, 4, 0.2, 1],
    [1.367, 'spark', 2.96, 5.09, 2, 0.2, 1],
    [1.367, 'streak', 0.12, 8.92, 11, 0.4, 4],
    [1.367, 'streak', 2.32, 8.41, 10, 0.4, 4],
    [1.783, 'mote', 0.4, 11.01, 0.8, 0.6, 6],
    [1.783, 'streak', -0.19, 11.16, 6, 0.4, 4],
    [2.483, 'ellipse', 1.57, 13.25, 7, 0.25, 1, { h: 1.7142857142857142 }],
    [2.72, 'spark', -0.2, 9.66, 5, 0.2, 1],
    [2.72, 'spark', -3.7, 11.16, 3, 0.2, 1],
    [2.72, 'spark', 4.39, 10.63, 4, 0.2, 1],
    [3.5, 'dust', 0.49, 0.0, 8, 1.0, 35],
    [3.5, 'wind', -0.21, 1.16, 38, 0.55, 1, { half: 0, anim: 0.7, h: 0.23 }],
    [3.5, 'wind', 0.49, -0.09, 40, 0.55, 1, { half: 1, anim: 0.7, h: 0.23 }],
    [3.5, 'ink', 0.73, 7.0, 20, 0.7, 3],
    [3.633, 'mote', 0.73, 9.48, 0.8, 0.8, 10],
    [3.633, 'streak', 0.75, 11.81, 10, 0.4, 3],
    [3.633, 'streak', 0.97, 11.53, 10, 0.4, 2],
    [4.016, 'flare', 0.93, 12.0, 40, 0.4, 1],
  ],
  revert: [ // Peregrinus_N_CH_Change
    [0.0, 'ink', 1.46, 9.0, 12, 0.6, 3],
    [0.1, 'dust', 0.49, 0.0, 8, 1.0, 27],
    [0.1, 'wind', -0.21, 1.16, 19, 3.5, 1, { half: 0, anim: 0.1, h: 0.225 }],
    [0.1, 'wind', 0.49, -0.09, 20, 3.5, 1, { half: 1, anim: 0.1, h: 0.225 }],
    [0.1, 'ink', 0.49, 2.0, 12, 0.6, 1],
    [1.017, 'spark', -0.33, 5.6, 5, 0.2, 1],
    [1.017, 'spark', 4.13, 5.48, 3.5, 0.2, 1],
    [1.017, 'streak', 1.29, 11.22, 11, 0.4, 4],
    [1.017, 'streak', 2.44, 11.32, 10, 0.4, 4],
    [1.783, 'ellipse', 1.91, 11.41, 8, 0.8, 1, { h: 0.25 }],
    [2.133, 'mote', 2.56, 11.24, 0.8, 0.6, 6],
    [2.666, 'spark', 1.61, 12.14, 7, 0.2, 1],
    [2.666, 'spark', 4.05, 12.26, 7, 0.2, 1],
    [2.666, 'streak', 0.81, 12.15, 10, 0.4, 3],
    [2.666, 'streak', 3.11, 11.81, 10, 0.4, 2],
    [3.483, 'mote', 1.63, 11.03, 0.8, 0.8, 10],
    [3.483, 'streak', 1.65, 13.36, 10, 0.4, 3],
    [3.483, 'streak', 1.66, 13.11, 10, 0.4, 2],
    [3.833, 'mote', 1.16, 13.91, 0.8, 0.8, 8],
    [4.1, 'flare', 1.59, 15.48, 20, 0.4, 1],
    [5.0, 'dust', 0.49, 0.0, 8, 1.0, 35],
    [5.0, 'wind', -0.21, 1.16, 38, 0.55, 1, { half: 0, anim: 0.7, h: 0.23 }],
    [5.0, 'wind', 0.49, -0.09, 40, 0.55, 1, { half: 1, anim: 0.7, h: 0.23 }],
    [5.0, 'ink', -0.81, 8.65, 20, 0.7, 3],
  ],
  bskill2: [ // Peregrinus_N_Skill2_A (on at 0.17s) + _B (1.2s) + model airline, clip times
    [0.17, 'dust', 0, 0, 7, 1.1, 30],
    [0.83, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [0.85, 'air', 3, 8, 50, 0.3, 1], // original x 22 (its MoveMotion landing spot); here she flies
    [0.85, 'dashline', -8, 8, 30, 0.4, 5], // original x 18: speed lines trail her instead
    [0.95, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.07, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.1, 'white', 0, 0, 1000, 0.09, 1],
    [1.19, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.2, 'bloom2', 5.1, 7, 90, 0.8, 1],
    [1.2, 'glow', 5.1, 7, 30, 0.36, 1],
    [1.2, 'glowy', 5.1, 7, 14, 0.36, 1],
    [1.2, 'glowy', 5.1, 7, 40, 0.4, 1],
    [1.2, 'mote', 5.1, 7, 0.8, 1.2, 40],
    [1.2, 'pang', 7.5, 2.1, 15, 0.5, 1],
    [1.2, 'pang', 7.5, 14.3, 18, 0.4, 1],
    [1.2, 'pang', 14, 7, 20, 0.5, 1],
    [1.31, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.43, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.55, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.67, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.79, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [1.8, 'flare', 3.4, 7.7, 70, 0.4, 1],
    [1.91, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [2.03, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [2.15, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [2.27, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [2.32, 'glow', -35, 8, 20, 0.5, 1],
    [2.32, 'mote', -15, 7, 0.8, 1.0, 15],
    [2.383, 'flare', 2.6, 6.2, 12, 0.5, 1],
    [2.39, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [2.41, 'white', 0, 0, 1000, 0.09, 1],
    [2.5, 'air', -10.4, 8, 50, 0.15, 1],
    [2.5, 'dust', 0, 0, 7, 1.1, 30],
    [2.5, 'fireline', -15, 7, 50, 0.35, 1],
    [2.5, 'mote', 5.1, 7, 0.8, 1.0, 20],
    [2.5, 'pang', 20, 7, 40, 0.5, 1],
    [2.51, 'airline', -0.7, 5.8, 22, 0.8, 1],
    [2.63, 'airline', -0.7, 5.8, 22, 0.8, 1],
  ],
  hskill2: [ // Peregrinus_N_CH_Skill2_A (on at 1.23s) + _B (5.57s), clip times
    [1.23, 'zizic', 2.6, 9.7, 4, 0.4, 5],
    [1.33, 'zizic', 2.6, 9.7, 4, 0.2, 5],
    [1.23, 'glow', 2.6, 9.7, 60, 2.0, 1],
    [1.23, 'glow', 2.6, 9.7, 10, 0.4, 1],
    [1.23, 'mote', 2.6, 9.7, 0.6, 0.8, 4],
    [1.23, 'dust', 2.6, 0.0, 14, 0.8, 3],
    [2.73, 'flare', 3.0, 12.1, 50, 0.35, 1],
    [2.98, 'white', 0, 0, 1000, 0.18, 1],
    [3.16, 'beamlight', 0.5, 10.5, 80, 2.0, 1],
    [3.16, 'beam1', 1.1, 10.5, 60, 1.5, 1],
    [3.16, 'beam', -0.4, 10.5, 60, 1.5, 1],
    [3.16, 'bloom', 2.6, 10.5, 100, 2.0, 1],
    [3.16, 'glow', 2.6, 10.5, 60, 0.4, 1],
    [3.16, 'line', 2.6, 10.5, 40, 0.4, 1],
    [3.16, 'air', -12.0, 10.5, 70, 0.25, 2],
    [3.16, 'groundfire', 4.4, 2.0, 0.4, 1.0, 22],
    [3.26, 'groundfire', 34.1, 2.0, 0.4, 1.0, 22],
    [3.36, 'groundfire', 63.6, 2.0, 0.4, 1.0, 22],
    [4.23, 'mote', 0.5, 10.5, 1, 1.4, 30],
    [5.57, 'ink', 1.5, 9.0, 12, 0.6, 3],
    [5.67, 'dust', 0.5, 0.0, 8, 1.0, 27],
    [5.67, 'wind', -0.2, 1.2, 19, 1.466, 1, { half: 0, anim: 0.1, h: 0.225 }],
    [5.67, 'wind', 0.5, -0.1, 20, 1.466, 1, { half: 1, anim: 0.1, h: 0.225 }],
    [5.67, 'ink', 0.5, 2.0, 12, 0.6, 1],
    [5.8, 'spark', -0.4, 5.6, 5, 0.2, 1],
    [5.8, 'spark', 4.1, 5.5, 3.5, 0.2, 1],
    [5.8, 'streak', 1.2, 11.2, 11, 0.4, 4],
    [5.8, 'streak', 2.4, 11.3, 10, 0.4, 4],
    [6.29, 'glow', 1.9, 11.4, 8, 0.25, 1],
    [6.29, 'mote', 2.5, 11.2, 0.8, 0.6, 7],
    [6.29, 'spark', 4.0, 12.3, 7, 0.2, 1],
    [6.29, 'spark', 1.6, 12.1, 7, 0.2, 1],
    [6.29, 'streak', 0.8, 12.2, 10, 0.4, 4],
    [6.29, 'streak', 3.1, 11.8, 10, 0.4, 3],
    [6.6, 'streak', 1.6, 13.4, 10, 0.4, 3],
    [6.6, 'mote', 1.6, 11.0, 0.8, 0.8, 10],
    [6.75, 'eye', 1.5, 15.5, 20, 0.2, 1],
    [7.14, 'ink', -0.8, 8.7, 20, 0.7, 3],
    [7.14, 'wind', -0.2, 1.2, 38, 0.55, 1, { half: 0, anim: 0.7, h: 0.23 }],
    [7.14, 'wind', 0.5, -0.1, 40, 0.55, 1, { half: 1, anim: 0.7, h: 0.23 }],
    [7.14, 'dust', 0.5, 0.0, 8, 1.0, 35],
  ],
};

/**
 * Start the FX on the player: `which` = 'change' | 'revert', `at` = clip time it
 * switches on, `speed` = clip play speed (times and lifetimes are divided by it).
 */
export function startChangeFx(p, which, at, speed) {
  const parts = [];
  for (const [delay, kind, ux, uy, size, life, count, opts] of TIMELINES[which]) {
    // Emitter shapes (start speed is 0 everywhere): dust in a 10-unit circle, the ink
    // ("ready" / "line") in a 10-unit rectangle, motes / streaks right at the point.
    const spread = kind === 'dust' ? 10 : kind === 'mote' ? 2 : kind === 'groundfire' ? 14
      : kind === 'dashline' ? 6 : kind === 'airline' ? 2
      : kind === 'ink' && count > 1 ? 5 : kind === 'zizic' ? 2 : 0;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = spread * UNIT * Math.random();
      parts.push({
        t0: (at + delay) / speed, life: life / speed, kind, size: size * UNIT,
        ox: ROOT_X + ux * UNIT + Math.cos(ang) * r,
        oy: ROOT_Y - uy * UNIT + Math.sin(ang) * r * (kind === 'dust' ? 0.25 : kind === 'ink' ? 0.5 : 0.8),
        rot: kind === 'streak' ? ang : kind === 'ink' ? Math.random() * Math.PI * 2
          : kind === 'spark' ? (Math.random() - 0.5) * 2.1 : (Math.random() - 0.5) * 0.35,
        sc: kind === 'dust' || kind === 'ink' || kind === 'streak' ? 0.55 + Math.random() * 0.45 : 1,
        opts: opts || null,
        vx: kind === 'mote' ? Math.cos(ang) * 12 : 0,
        vy: kind === 'mote' ? Math.sin(ang) * 12 - 10 : 0,
      });
    }
  }
  p.changeFx = { t: 0, parts, anchored: which === 'bskill2' };
}

export function tickChangeFx(p, dt) {
  const fx = p.changeFx;
  if (!fx) return;
  fx.t += dt;
  fx.real = (fx.real || 0) + dt;
  if (fx.anchored) {
    // Clip clock may hold (dash pose) or jump: born particles age in real time instead.
    const done = fx.parts.every((q) => (q.born !== undefined ? fx.real - q.born > q.life : fx.t > q.t0 + q.life));
    if (done) p.changeFx = null;
    return;
  }
  if (fx.parts.every((q) => fx.t > q.t0 + q.life)) p.changeFx = null;
}

export function drawChangeFx(ctx, p, x, y) {
  const fx = p.changeFx;
  if (!fx) return;
  ctx.save();
  for (const q of fx.parts) {
    let a = fx.t - q.t0;
    if (fx.anchored) {
      // Real-time age from the moment the clip reached its start (late starts keep their lag).
      if (a < 0 && q.born === undefined) continue;
      if (q.born === undefined) q.born = (fx.real || 0) - a;
      a = (fx.real || 0) - q.born;
    }
    if (a < 0 || a > q.life) continue;
    const k = a / q.life;
    // World-anchored bursts (bird X dash): each particle stays where it was born instead
    // of riding along with the flying body.
    if (fx.anchored && q.wx === undefined) { q.wx = x; q.wy = y; }
    const bx0 = fx.anchored ? q.wx : x;
    const by0 = fx.anchored ? q.wy : y;
    const px = bx0 + q.ox + q.vx * a;
    const py = by0 + q.oy + q.vy * a;
    const fade = Math.min(1, (1 - k) * 2.5);
    switch (q.kind) {
      case 'wind': {
        const img = getNativeWeaponImage('peregrinus-fx-wind');
        if (!img) break;
        const o = q.opts || { half: 0, anim: 0.7, h: 0.23 };
        const f = o.half * 8 + Math.min(7, Math.floor(Math.min(1, k / o.anim) * 8));
        const gx = k < 0.21 ? 0.2 + (k / 0.21) * 0.7 : 0.9 + ((k - 0.21) / 0.79) * 0.1;
        ctx.globalCompositeOperation = 'source-over';
        // Short ground bursts fade out (0.3 -> 1); the long first pair just holds.
        ctx.globalAlpha = o.anim < 0.5 ? 1 : pw([[0, 1], [0.3, 1], [0.4, 0.63], [0.6, 0.27], [0.8, 0.12], [1, 0]], k);
        drawCell(ctx, img, 2, 192, 48, f, px, py, q.size * gx, q.size * o.h);
        break;
      }
      case 'ink': {
        const img = getNativeWeaponImage('peregrinus-fx-ink');
        if (!img) break;
        const s2 = q.size * q.sc * (k < 0.3 ? 0.49 + (k / 0.3) * 0.34 : 0.83 + ((k - 0.3) / 0.7) * 0.17);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = pw([[0, 0], [0.1, 1], [0.8, 1], [1, 0]], k);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(q.rot);
        drawCell(ctx, img, 4, 96, 96, Math.min(7, Math.floor(k * 8)), 0, 0, s2, s2);
        ctx.restore();
        break;
      }
      case 'glow': {
        const img = getNativeWeaponImage('peregrinus-fx-glow');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(Math.min(1, k) * Math.PI);
        ctx.drawImage(img, px - q.size / 2, py - q.size / 2, q.size, q.size);
        break;
      }
      case 'spark': {
        const img = getNativeWeaponImage('peregrinus-fx-spark');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        drawCell(ctx, img, 4, 64, 128, Math.min(3, Math.floor(k * 4)), px, py, q.size * 0.5, q.size);
        break;
      }
      case 'streak': {
        const img = getNativeWeaponImage('peregrinus-fx-streak');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(q.rot);
        const len = q.size * (0.6 + k * 0.6);
        ctx.drawImage(img, -len * 0.1, -len * 0.06, len, len * 0.12);
        ctx.restore();
        break;
      }
      case 'eye': {
        // Closing glint at her eye: a quick green bloom that shrinks (size over life) with
        // a bright core star - not a body-sized haze.
        const img = getNativeWeaponImage('peregrinus-fx-glow');
        const sh = 1 - k * 0.7;
        ctx.globalCompositeOperation = 'lighter';
        if (img) {
          const s = q.size * 0.45 * sh;
          ctx.globalAlpha = 0.7 * Math.sin(Math.min(1, k * 1.4 + 0.2) * Math.PI);
          ctx.drawImage(img, px - s / 2, py - s / 2, s, s);
        }
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#f0fff8';
        const g = q.size * 0.16 * sh;
        ctx.beginPath();
        ctx.moveTo(px - g, py); ctx.lineTo(px, py - g * 0.12); ctx.lineTo(px + g, py); ctx.lineTo(px, py + g * 0.12);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px, py - g * 0.6); ctx.lineTo(px + g * 0.1, py); ctx.lineTo(px, py + g * 0.6); ctx.lineTo(px - g * 0.1, py);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'beam':
      case 'beam1':
      case 'beamlight': {
        // Original layers: 200-unit-long particles, renderer pivot x 0.47 (they start just
        // behind the emitter and run 194 units forward), height = sizeY x size-over-life Y.
        const key = q.kind === 'beam' ? 'peregrinus-fx-beam' : q.kind === 'beam1' ? 'peregrinus-fx-beam1'
          : 'peregrinus-fx-beamlight';
        const img = getNativeWeaponImage(key);
        if (!img) break;
        const len = 200 * UNIT;
        const h = q.size * pw(BEAM_Y[q.kind], k);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pw(BEAM_A[q.kind], k);
        ctx.drawImage(img, px - len * 0.03, py - h / 2, len, h);
        break;
      }
      case 'bloom': {
        const img = getNativeWeaponImage('peregrinus-fx-glow');
        if (!img) break;
        const s2 = q.size * pw(BLOOM_S, k);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pw(BLOOM_A, k);
        ctx.drawImage(img, px - s2 / 2, py - s2 / 2, s2, s2);
        break;
      }
      case 'flare': {
        const img = getNativeWeaponImage('peregrinus-fx-glow');
        if (!img) break;
        const w = q.size * pw(FLARE_X, k);
        const h = q.size * 0.2 * pw(FLARE_Y, k);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pw(FLARE_A, k);
        ctx.drawImage(img, px - w / 2, py - h / 2, w, h);
        break;
      }
      case 'line': {
        const img = getNativeWeaponImage('peregrinus-fx-air');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade;
        const w = q.size * (0.8 + k * 0.6);
        ctx.drawImage(img, px, py - w * 0.09, w, w * 0.18);
        break;
      }
      case 'air': {
        // 256_air2 ring blown out behind her by the recoil.
        const img = getNativeWeaponImage('peregrinus-fx-ring');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade;
        const s2 = q.size * (0.5 + k * 0.6);
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(-0.45, 1);
        ctx.drawImage(img, -s2 / 2, -s2 / 2, s2, s2);
        ctx.restore();
        break;
      }
      case 'white': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-200, -200, 4000, 4000);
        break;
      }
      case 'zizic': {
        const img = getNativeWeaponImage('peregrinus-fx-zizic');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        drawCell(ctx, img, 4, 64, 64, Math.min(7, Math.floor(k * 8)), px, py, q.size * 2.2, q.size * 2.2);
        break;
      }
      case 'groundfire': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#00bf80';
        ctx.fillRect(px - 2, py - 2 - a * 40, 4, 4);
        break;
      }
      case 'pang': {
        // Peregrinus_pang2 (2 x 3): the flurry's orange strike flashes.
        const img = getNativeWeaponImage('peregrinus-fx-pang');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        drawCell(ctx, img, 2, 192, 128, Math.min(5, Math.floor(k * 6)), px, py, q.size, q.size * 0.67);
        break;
      }
      case 'fireline': {
        const img = getNativeWeaponImage('peregrinus-fx-fireline');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade;
        ctx.drawImage(img, px - q.size / 2, py - q.size * 0.15, q.size, q.size * 0.3);
        break;
      }
      case 'airline':
      case 'dashline': {
        const img = getNativeWeaponImage('peregrinus-fx-airline');
        if (!img) break;
        ctx.globalCompositeOperation = q.kind === 'airline' ? 'source-over' : 'lighter';
        ctx.globalAlpha = (q.kind === 'airline' ? 0.47 : 0.51) * fade;
        const w = q.size * (1 + k * 0.5);
        ctx.drawImage(img, px - w * (0.2 + k * 0.6), py - w * 0.12, w, w * 0.25);
        break;
      }
      case 'bloom2':
      case 'glowy': {
        // light / light (1) of the hit burst: green (0,1,0.66) and pale yellow (1,0.97,0.69).
        const img = getNativeWeaponImage('peregrinus-fx-glow');
        if (!img) break;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(Math.min(1, k) * Math.PI) * (q.kind === 'glowy' ? 0.8 : 1);
        if (q.kind === 'glowy') ctx.filter = 'hue-rotate(-90deg) saturate(0.5) brightness(1.4)';
        const s2 = q.size * (q.kind === 'bloom2' ? 1 - k * 0.6 : 1);
        ctx.drawImage(img, px - s2 / 2, py - s2 / 2, s2, s2);
        ctx.filter = 'none';
        break;
      }
      case 'ellipse': {
        const img = getNativeWeaponImage('peregrinus-fx-glow');
        if (!img) break;
        const h = q.size * (q.opts?.h || 0.4);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pw([[0, 0], [0.1, 1], [0.2, 1], [0.31, 0.63], [0.54, 0.27], [0.77, 0.12], [1, 0]], k);
        ctx.drawImage(img, px - q.size / 2, py - h / 2, q.size, h);
        break;
      }
      case 'mote': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#c8ffe8';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, q.size * 0.35), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dust': {
        const img = getNativeWeaponImage('peregrinus-fx-dust');
        if (!img) break;
        // 128_dust_texture, 8 x 5 units (random size), static; alpha keys of the prefab.
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.6 * pw([[0, 0], [0.05, 1], [0.25, 1], [0.34, 0.63], [0.56, 0.27], [0.78, 0.12], [1, 0]], k);
        const s = q.size * q.sc * (0.81 + Math.min(1, k / 0.3) * 0.15);
        ctx.drawImage(img, px - s / 2, py - s * 0.31, s, s * 0.62);
        break;
      }
      default:
        break;
    }
  }
  ctx.restore();
}
