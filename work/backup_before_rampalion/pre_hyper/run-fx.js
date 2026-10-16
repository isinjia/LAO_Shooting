// Shared drawing / timing helpers for original-skill runs (skill-run.js and griffin-skill.js).
import { getNativeWeaponImage } from './native-weapon-fx.js';

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smooth = (k) => k * k * (3 - 2 * k);

/** Piecewise-linear sample of [t, a, b, ...] keyframes; returns `cols` values. */
export function sampleKeys(keys, t, cols = 2) {
  if (t <= keys[0][0]) return keys[0].slice(1, 1 + cols);
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b[0]) {
      const a = keys[i - 1];
      const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return a.slice(1, 1 + cols).map((v, j) => v + (b[1 + j] - v) * k);
    }
  }
  return keys[keys.length - 1].slice(1, 1 + cols);
}

/** Draw one cell of a uniform sprite sheet centred at (x, y). */
export function drawCell(ctx, img, cols, cellW, cellH, frame, x, y, w, h) {
  ctx.drawImage(img, (frame % cols) * cellW, Math.floor(frame / cols) * cellH, cellW, cellH,
    x - w / 2, y - h / 2, w, h);
}

/** Additive radial bloom (white-hot core -> warm edge). `hue` picks the rim colour. */
export function bloom(ctx, x, y, rx, ry, alpha, hue = 'warm') {
  if (alpha <= 0.01 || rx <= 0 || ry <= 0) return;
  const stops = hue === 'cyan'
    ? ['rgba(240,252,255,1)', 'rgba(120,220,255,0.85)', 'rgba(30,140,255,0.45)', 'rgba(0,90,255,0)']
    : ['rgba(255,252,230,1)', 'rgba(255,224,90,0.85)', 'rgba(255,128,24,0.45)', 'rgba(255,90,0,0)'];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.35, stops[1]);
  g.addColorStop(0.7, stops[2]);
  g.addColorStop(1, stops[3]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Sheet descriptors for FX textures under assets/native-shots (key -> grid/cell).
 * `n` = playable frame count (trailing empty cells skipped).
 */
export const SHEETS = {
  'griffin-fx-firehit': { cols: 4, cell: 160, n: 16 },
  'griffin-fx-groundfire': { cols: 4, cell: 160, n: 8 },
  'griffin-fx-skill2hit': { cols: 4, cell: 192, n: 12 },
  'griffin-fx-smog': { cols: 4, cell: 192, n: 12 },
  'griffin-fx-boom': { cols: 4, cell: 192, n: 12 },
  // Last Origin sqns explosion_3x3_sprite_2895 (round air burst + smoke), 1024 -> 576.
  'lao-fx-airboom': { cols: 3, cell: 192, n: 9 },
  // Shared copies of original fire / ring / smoke sheets for leader area attacks (meteor):
  // pilot-owned keys only load with that pilot, these load for every sortie.
  'lao-fx-fireball': { cols: 4, cell: 160, n: 16 },
  'lao-fx-flameburst': { cols: 4, cell: 192, n: 12 },
  'lao-fx-shockring': { cols: 3, cell: 192, n: 9 },
  'lao-fx-smog': { cols: 4, cell: 192, n: 12 },
  'lao-fx-groundsmoke': { cols: 4, cell: 192, n: 12 },
  'peregrinus-fx-glow': { cols: 1, cell: 128, n: 1 },
  'peregrinus-fx-ring': { cols: 1, cell: 128, n: 1 },
  'griffin-fx-booster': { cols: 3, cell: 128, n: 9 },
  'sleipnir-fx-muzzle': { cols: 4, cell: 192, n: 8 },
  'sleipnir-fx-hit': { cols: 3, cell: 160, n: 9 },
  'sleipnir-fx-lasthit': { cols: 4, cell: 192, n: 14 },
  'sleipnir-fx-lastfire': { cols: 4, cell: 192, n: 8 },
  'sleipnir-fx-sonic': { cols: 3, cell: 160, n: 9 },
  'sleipnir-fx-startsmoke': { cols: 4, cell: 160, n: 8 },
  'sleipnir-fx-ring': { cols: 3, cell: 192, n: 9 },
  'sleipnir-fx-boost': { cols: 3, cell: 192, n: 6 },
  'sleipnir-fx-upsmoke': { cols: 3, cell: 160, n: 9 },
  'sleipnir-fx-flyboom': { cols: 4, cell: 192, n: 12 },
  'sleipnir-fx-groundsmoke': { cols: 4, cell: 192, n: 12 },
  'sleipnir-fx-backsmoke': { cols: 4, cell: 192, n: 14 },
  'sleipnir-fx-aftersmoke': { cols: 4, cell: 192, n: 10 },
  'sleipnir-fx-downsmoke': { cols: 3, cell: 160, n: 9 },
  'sleipnir-fx-eyes': { cols: 4, cell: 256, n: 8 },
  'sleipnir-fx-line': { cols: 4, cell: 256, n: 8 },
  'sleipnir-fx-goggle': { cols: 3, cell: 160, n: 9 },
  // Constantia Attack_01 / Attack_02 (tools/import-constantia-fx.py).
  'constantia-fx-muzzle': { cols: 4, cell: 128, n: 8 },
  'constantia-fx-muzzlering': { cols: 4, cell: 128, n: 8 },
  'constantia-fx-hit': { cols: 4, cell: 128, n: 8 },
  'constantia-fx-hitsmoke': { cols: 4, cell: 128, n: 12 },
  'constantia-fx-hitline': { cols: 1, cell: 128, n: 2 },
  'constantia-fx-boriring': { cols: 4, cell: 128, n: 8 },
  'constantia-fx-borismoke': { cols: 3, cell: 160, n: 9 },
  'constantia-fx-bite': { cols: 5, cell: 128, n: 10 },
  'constantia-fx-bitehit': { cols: 4, cell: 128, n: 8 },
  // Labiata skill1 / skill2 (tools/import-labiata-fx.py).
  'labiata-fx-hit': { cols: 3, cell: 192, n: 8 },
  'labiata-fx-baghit': { cols: 4, cell: 192, n: 13 },
  'labiata-fx-blade': { cols: 4, cell: 256, n: 10 },
  'labiata-fx-bladedeco': { cols: 3, cell: 256, n: 9 },
  'labiata-fx-smoke2': { cols: 3, cell: 160, n: 9 },
  'labiata-fx-smoke4': { cols: 4, cell: 192, n: 11 },
  'labiata-fx-downsmoke': { cols: 3, cell: 160, n: 9 },
  'labiata-fx-baglight': { cols: 4, cell: 160, n: 12 },
  'labiata-fx-spark': { cols: 4, cell: 160, n: 16 },
  'labiata-fx-inparticle': { cols: 3, cell: 192, n: 5 },
  'labiata-fx-inaura': { cols: 3, cell: 192, n: 7 },
  'labiata-fx-swing': { cols: 3, cell: 256, n: 8 },
  'labiata-fx-swingsmoke': { cols: 4, cell: 192, n: 12 },
  'labiata-fx-upsmoke': { cols: 3, cell: 192, n: 9 },
  'labiata-fx-windaura': { cols: 4, cell: 192, n: 10 },
  'labiata-fx-jumpsmoke': { cols: 4, cell: 192, n: 10 },
  'labiata-fx-groundbomb': { cols: 4, cell: 256, n: 11 },
  'labiata-fx-grounddeco': { cols: 4, cell: 256, n: 11 },
  'labiata-fx-groundsmoke': { cols: 4, cell: 256, n: 10 },
  'labiata-fx-hit2': { cols: 4, cell: 256, n: 18 },
  'labiata-fx-buffaura': { cols: 3, cell: 192, n: 18 },
  'labiata-fx-finalhit': { cols: 3, cell: 256, n: 18 },
  'express76-fx-fireparticle': { cols: 4, cell: 192, n: 6 },
  'express76-fx-sonicboom': { cols: 3, cell: 160, n: 9 },
  'express76-fx-impact': { cols: 3, cell: 192, n: 8 },
  'express76-fx-smoke': { cols: 3, cell: 192, n: 9 },
  'express76-fx-bling': { cols: 3, cell: 128, n: 6 },
  'express76-fx-hit': { cols: 3, cell: 160, n: 7 },
};

/** Draw a timed sheet animation: progress k in [0,1) picks the frame. */
export function drawSheetAt(ctx, key, k, x, y, w, h, opts = {}) {
  const img = getNativeWeaponImage(key);
  const s = SHEETS[key];
  if (!img || !s || k < 0 || k >= 1) return;
  const frame = Math.min(s.n - 1, Math.floor(k * s.n));
  ctx.save();
  ctx.globalCompositeOperation = opts.blend || 'lighter';
  ctx.globalAlpha = opts.alpha ?? 1;
  if (opts.rot || opts.flip) {
    ctx.translate(x, y);
    if (opts.rot) ctx.rotate(opts.rot);
    if (opts.flip) ctx.scale(-1, 1);
    drawCell(ctx, img, s.cols, s.cell, s.cell, frame, 0, 0, w, h);
  } else {
    drawCell(ctx, img, s.cols, s.cell, s.cell, frame, x, y, w, h);
  }
  ctx.restore();
}
