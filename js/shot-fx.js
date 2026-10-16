import { drawNativeWeapon, getNativeWeaponImage } from './native-weapon-fx.js';
import { W } from './canvas.js';
import { prefersLowEndGfx } from './mobile.js';

/** Canvas-native weapon effects as soft particle clusters (GPU fallback).
 *  Trails = fading mote strings; heads = soft bloom cores — not polygons / zigzags.
 *  Quality pass: size variance, additive soft sprites, color ramps along trails.
 */

function softDisk(ctx, x, y, r, color, alpha) {
  if (alpha <= 0.01 || r <= 0.2) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Soft elongated spark along local +X (caller rotates). Additive-friendly. */
function softStreak(ctx, x, y, len, thick, color, alpha) {
  if (alpha <= 0.01 || len <= 0.3 || thick <= 0.15) return;
  ctx.save();
  ctx.translate(x, y);
  // Slightly longer aspect than a soft disk — motion stretch, not a hard needle.
  ctx.scale(Math.max(0.25, (len * 1.12) / Math.max(0.001, thick)), 1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, thick, 0, Math.PI * 2);
  ctx.fill();
  // Tip-forward white core (reads as grit spark, still soft-sprite).
  ctx.globalAlpha = alpha * 0.92;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(thick * 0.32, 0, thick * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function softBloom(ctx, x, y, r, color, glow) {
  softDisk(ctx, x, y, r * 1.7, glow || color, 0.14);
  softDisk(ctx, x, y, r, color, 0.72);
  softDisk(ctx, x, y, r * 0.38, '#ffffff', 0.95);
}

/** Deterministic pseudo-random from bullet phase + index (stable trail motes). */
function moteRand(phase, i, salt = 1) {
  const n = Math.sin(phase * 12.9898 + i * 78.233 + salt * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

/** Life-ish color along trail: tip hot → mid kit → cool/glow (sharper bands). */
function trailColor(t, color, glow, core) {
  if (t < 0.18) return core;
  if (t < 0.38) return color;
  if (t > 0.78) return glow || color;
  // Mid-trail: prefer kit, with a cool bias past halfway so fade isn't a flat tint.
  return t > 0.58 ? (glow || color) : color;
}

function trailMotes(ctx, b, count, {
  color, glow, core = '#fffef8', length = 4.2, spread = 0.55, plasma = false,
  gapOdd = false, arcBend = 0,
} = {}) {
  const r = b.r;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    // Crescent: gapped arc cadence (≠ continuous forward laser ribbon). count formula frozen.
    if (gapOdd && i % 2 === 1) continue;
    const t = (i + 0.5) / count;
    const jitter = (moteRand(b.phase, i, 2) - 0.5) * spread * r;
    const flicker = 0.6 + 0.4 * Math.sin(b.age * 20 + b.phase + i * 1.7);
    const x = -t * length * r;
    const y = jitter * (1 + t * 0.85) + Math.sin(t * Math.PI) * arcBend * r;
    // Wide size variance: fine grit near tip, softer chips down-trail (count/length/spread unchanged).
    const fine = t < 0.4 && moteRand(b.phase, i, 3) < 0.55;
    const sizeMul = fine ? (0.28 + moteRand(b.phase, i, 3) * 0.55) : (0.4 + moteRand(b.phase, i, 3) * 0.95);
    const rad = r * (0.48 - t * 0.28) * sizeMul;
    const col = trailColor(t, color, glow, core);
    // Near tip: bias elongated streaks so trails read stretched, not equal blobs.
    const streakBias = t < 0.35 ? 0.28 : (t < 0.65 ? 0.42 : 0.55);
    const streak = moteRand(b.phase, i, 14) > streakBias;
    if (streak) {
      const lenMul = fine ? (2.35 + (1 - t) * 1.85) : (2.05 + (1 - t) * 1.55);
      softStreak(ctx, x, y, rad * lenMul, rad * (fine ? 0.42 : 0.52), col, 0.52 * (1 - t) * flicker);
    } else {
      softDisk(ctx, x, y, rad * 1.7, glow || color, 0.1 * (1 - t) * flicker);
      softDisk(ctx, x, y, rad, col, 0.52 * (1 - t) * flicker);
      if (t < 0.32) softDisk(ctx, x, y, rad * 0.32, '#ffffff', 0.78 * (1 - t) * flicker);
    }
    if (plasma && i % 2 === 0) {
      softDisk(
        ctx,
        x + (moteRand(b.phase, i, 4) - 0.5) * r * 0.8,
        y * 1.15,
        rad * 0.45,
        '#edffff',
        0.38 * (1 - t),
      );
    }
  }
  ctx.globalCompositeOperation = prev;
}

function kitCoreColor(style) {
  if (style === 'lightning' || style === 'jupiterorb' || style === 'teslabeam'
    || style === 'empfield' || style === 'teslacoil' || style === 'chainarc') return '#f4ffff';
  if (style === 'foxflame' || style === 'sunbird' || style === 'flameward') return '#fff2c8';
  if (style === 'sunseal') return '#fff8e0';
  if (style === 'coffinround' || style === 'coffinmissile' || style === 'coffinwall'
    || style === 'coffinshield' || style === 'plasmaslash'
    || style === 'swordguard' || style === 'orbitblade' || style === 'swordlance') return '#ffe8ff';
  if (style === 'plasmacross') return '#fff4fc';
  if (style === 'railbolt' || style === 'railbeam' || style === 'busterbeam' || style === 'xenoxcore') return '#eafcff';
  if (style === 'tracer' || style === 'lockround' || style === 'sightbeam') return '#fff8e8';
  if (style === 'commandmissile') return '#fff0d0';
  if (style === 'cleave' || style === 'dragonaxe') return '#ffe0e8';
  return '#fffef8';
}

// Original Last Origin Bori atlas supplied with the project assets. The Canvas
// silhouette below remains a fallback until the atlas finishes loading.
const boriAtlas = typeof Image === 'undefined' ? null : new Image();
// Loaded on demand (Constantia only): the canvas fallback covers the first frames.
export function preloadBori() {
  if (boriAtlas && !boriAtlas.getAttribute('src')) boriAtlas.src = new URL('../assets/bori/Texture_3P_Bori_N.png', import.meta.url).href;
}

/** Bori stays beside Constantia or a pinned target; the atlas is not a flight animation. */
export function drawBoriCompanion(ctx, x, y, r, alpha = 1, phase = 0) {
  ctx.save();
  ctx.translate(x, y + Math.sin(phase * 12) * 1.5);
  ctx.globalAlpha *= alpha;
  preloadBori();
  if (boriAtlas?.complete && boriAtlas.naturalWidth > 0) {
    ctx.shadowColor = '#ffe8a8';
    ctx.shadowBlur = 6;
    // These adjacent islands form Bori's complete sitting silhouette.
    ctx.drawImage(boriAtlas, 370, 465, 325, 380,
      -r * 0.88, -r * 1.2, r * 1.5, r * 1.92);
    ctx.drawImage(boriAtlas, 775, 14, 228, 215,
      r * 0.12, -r * 1.24, r * 1.02, r * 0.98);
    ctx.restore();
    return;
  }
  ctx.shadowColor = '#ffcf67';
  ctx.shadowBlur = 11;
  ctx.fillStyle = '#5a3524';
  ctx.strokeStyle = '#fff0ba';
  ctx.lineWidth = 2.8;
  // Tail and running body.
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -r * 0.02);
  ctx.quadraticCurveTo(-r * 1.55, -r * 0.82, -r * 1.26, -r * 1.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-r * 0.16, 0, r * 0.78, r * 0.43, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Pointed ears, face and cream muzzle.
  ctx.beginPath();
  ctx.moveTo(r * 0.18, -r * 0.22);
  ctx.lineTo(r * 0.05, -r * 0.96);
  ctx.lineTo(r * 0.48, -r * 0.59);
  ctx.lineTo(r * 0.72, -r * 0.94);
  ctx.lineTo(r * 0.86, -r * 0.36);
  ctx.quadraticCurveTo(r * 1.19, -r * 0.1, r * 1.01, r * 0.25);
  ctx.quadraticCurveTo(r * 0.47, r * 0.47, r * 0.18, -r * 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff4d3';
  ctx.beginPath();
  ctx.ellipse(r * 0.82, r * 0.06, r * 0.28, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#181316';
  ctx.beginPath();
  ctx.arc(r * 0.69, -r * 0.2, 2.4, 0, Math.PI * 2);
  ctx.arc(r * 1.06, r * 0.01, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // Gold service harness + distinct running paws.
  ctx.strokeStyle = '#ffda72';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.39);
  ctx.lineTo(r * 0.08, r * 0.38);
  ctx.stroke();
  for (const dx of [-0.56, 0.12]) {
    ctx.beginPath();
    ctx.moveTo(dx * r, r * 0.25);
    ctx.lineTo((dx + 0.25) * r, r * 0.77);
    ctx.stroke();
  }
  ctx.restore();
}

/** Animate Bori's original atlas parts as a compact gallop around attached hips. */
function drawBoriRunner(ctx, r, age) {
  preloadBori();
  if (!boriAtlas?.complete || boriAtlas.naturalWidth === 0) {
    softDisk(ctx, 0, 0, r * 0.8, '#ffcf70', 0.4);
    return;
  }
  const size = Math.min(r, 30);
  const stride = Math.sin(age * 26);
  ctx.save();
  ctx.translate(0, Math.abs(stride) * -size * 0.055);
  ctx.shadowColor = '#ffe0a0';
  ctx.shadowBlur = 5;
  const leg = (sx, sy, sw, sh, px, py, dw, dh, angle, opacity = 1) => {
    ctx.save();
    ctx.translate(px * size, py * size);
    ctx.rotate(angle);
    ctx.globalAlpha *= opacity;
    ctx.drawImage(boriAtlas, sx, sy, sw, sh, 0, 0, dw * size, dh * size);
    ctx.restore();
  };
  // Far legs sit behind the body. Their roots stay covered by the torso, so
  // the animated feet cannot detach like the old three-island collage.
  leg(0, 270, 247, 235, -0.85, 0.13, 0.82, 0.80, -stride * 0.25, 0.65);
  leg(225, 255, 330, 205, 0.07, 0.12, 0.76, 0.77, stride * 0.25, 0.65);
  // Tail, remaining near the hindquarter instead of becoming a second body.
  ctx.drawImage(boriAtlas, 15, 875, 350, 130,
    -size * 1.5, -size * 0.28, size * 0.67, size * 0.38);
  leg(0, 270, 247, 235, -0.85, 0.15, 0.83, 0.83, stride * 0.29);
  leg(225, 255, 330, 205, 0.06, 0.13, 0.80, 0.81, -stride * 0.29);
  // One continuous original head/torso image closes every leg joint.
  ctx.drawImage(boriAtlas, 14, 9, 545, 252,
    -size * 1.29, -size * 0.67, size * 2.68, size * 1.24);
  ctx.restore();
}

/** C attacks use readable silhouettes instead of the shared glowing-orb head. */
function drawSpecialSignature(ctx, b, r) {
  if (!b.special) return false;
  const style = b.style;
  const ring = (radius, color, width = 3, alpha = 0.8) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (style === 'cyclopsbeam' || style === 'busterbeam') {
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const length = Math.min(b.beamLength || 400, 30 + b.age * speed);
    const huge = style === 'busterbeam';
    ctx.shadowColor = huge ? '#57bcff' : '#f25cff';
    ctx.shadowBlur = r * 0.85;
    ctx.fillStyle = huge ? '#3e91e3' : '#9028c5';
    ctx.globalAlpha = 0.62;
    ctx.fillRect(-length, -r * (huge ? 1.17 : 0.82), length, r * (huge ? 2.34 : 1.64));
    ctx.fillStyle = huge ? '#c1f5ff' : '#ffd7ff';
    ctx.globalAlpha = 0.94;
    ctx.fillRect(-length, -r * (huge ? 0.55 : 0.36), length, r * (huge ? 1.1 : 0.72));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-length, -r * 0.14, length, r * 0.28);
    if (huge) {
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#6edfff';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-length * 0.92, side * r * 0.86 - r * 0.06, length * 0.9, r * 0.12);
      }
    } else {
      ctx.fillStyle = '#ff9aff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.48, r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'commandmissile') {
    const radius = b.blastRadius || r;
    ring(radius, '#ffbe68', 2.8, 0.83);
    ctx.strokeStyle = '#fff1c8';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.92;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = sx * radius * 0.7, y = sy * radius * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - sx * radius * 0.24, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y - sy * radius * 0.24);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffcc73';
    ctx.fillRect(-r * 0.16, -r * 0.16, r * 0.32, r * 0.32);
  } else if (style === 'teslacoil') {
    const radius = Math.max(r, b.blastRadius || 0);
    ring(radius, '#69eaff', 2.4, 0.72);
    ctx.shadowColor = '#70efff';
    ctx.shadowBlur = 11;
    ctx.strokeStyle = '#e7ffff';
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.95;
    for (let arm = 0; arm < 6; arm++) {
      const angle = arm * Math.PI / 3 + b.age * 1.4;
      const point = (dist, bend = 0) => [
        Math.cos(angle) * dist - Math.sin(angle) * bend,
        Math.sin(angle) * dist + Math.cos(angle) * bend,
      ];
      ctx.beginPath();
      ctx.moveTo(...point(r * 0.15));
      ctx.lineTo(...point(radius * 0.5, (arm % 2 ? -1 : 1) * r * 0.19));
      ctx.lineTo(...point(radius * 0.72, (arm % 2 ? 1 : -1) * r * 0.12));
      ctx.lineTo(...point(radius));
      ctx.stroke();
    }
  } else if (style === 'coffinmissile') {
    ctx.shadowColor = '#d6a9ff';
    ctx.shadowBlur = 13;
    ctx.fillStyle = '#6c4b9b';
    ctx.strokeStyle = '#ead8ff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(r * 0.95, 0);
    ctx.lineTo(r * 0.52, -r * 0.55);
    ctx.lineTo(-r * 0.62, -r * 0.55);
    ctx.lineTo(-r * 0.95, 0);
    ctx.lineTo(-r * 0.62, r * 0.55);
    ctx.lineTo(r * 0.52, r * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff6e4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.23, 0); ctx.lineTo(r * 0.42, 0);
    ctx.moveTo(r * 0.09, -r * 0.31); ctx.lineTo(r * 0.09, r * 0.31);
    ctx.stroke();
  } else if (style === 'plasmacross') {
    const radius = b.blastRadius || r;
    ctx.shadowColor = '#ff65d9';
    ctx.shadowBlur = 16;
    ctx.lineCap = 'round';
    for (const [width, color, alpha] of [[r * 0.35, '#ee4dc6', 0.73], [r * 0.13, '#fff1fb', 0.98]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(-radius, -radius); ctx.lineTo(radius, radius);
      ctx.moveTo(-radius, radius); ctx.lineTo(radius, -radius);
      ctx.stroke();
    }
  } else {
    ctx.restore();
    return false;
  }
  ctx.restore();
  return true;
}

/**
 * Static shot sprites (perf, low-end mobile): a shot whose look never changes is painted once
 * into an offscreen canvas (2x for crispness) and stamped with one drawImage afterwards,
 * instead of re-filling its paths every frame. paint(g) draws at the sprite's origin.
 */
const SHOT_SPRITES = new Map();
function shotSprite(key, x0, y0, w, h, paint) {
  let c = SHOT_SPRITES.get(key);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  const S = 2;
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * S));
  c.height = Math.max(1, Math.ceil(h * S));
  const g = c.getContext('2d');
  g.scale(S, S);
  g.translate(-x0, -y0);
  paint(g);
  c._x0 = x0; c._y0 = y0; c._w = w; c._h = h;
  if (SHOT_SPRITES.size > 256) SHOT_SPRITES.clear();
  SHOT_SPRITES.set(key, c);
  return c;
}
const stamp = (ctx, c) => ctx.drawImage(c, c._x0, c._y0, c._w, c._h);

/** Griffin main shot (1945 II P-38): stubby yellow vulcan slug with a short hot streak. */
function drawP38Shot(ctx, b) {
  const r = b.r;
  const glow = b.glow || '#ff9a2a';
  const color = b.color || '#ffe36a';
  const key = `p38|${r}|${glow}|${color}`;
  // Streak (additive) and slug (normal) as two cached sprites - same paint as before.
  const streak = shotSprite(`${key}|g`, -6.5 * r, -r, 8.8 * r, 2 * r, (g) => {
    g.globalCompositeOperation = 'lighter';
    softStreak(g, -r * 2.2, 0, r * 3.4, r * 0.7, glow, 0.5);
  });
  const slug = shotSprite(`${key}|b`, -2.3 * r, -1.1 * r, 4.6 * r, 2.2 * r, (g) => {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, r * 2.1, r * 0.95, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fffbe8';
    g.beginPath();
    g.ellipse(r * 0.4, 0, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  });
  // Low-end phones: streak + slug baked into one sprite, one stamp per shot (perf).
  if (prefersLowEndGfx()) {
    const both = shotSprite(`${key}|1`, -6.5 * r, -1.1 * r, 8.8 * r, 2.2 * r, (g) => {
      if (streak) g.drawImage(streak, streak._x0, streak._y0, streak._w, streak._h);
      if (slug) g.drawImage(slug, slug._x0, slug._y0, slug._w, slug._h);
    });
    if (both) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.vy) ctx.rotate(Math.atan2(b.vy, b.vx));
      stamp(ctx, both);
      ctx.restore();
      return;
    }
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  if (streak && slug) {
    ctx.globalCompositeOperation = 'lighter';
    stamp(ctx, streak);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    stamp(ctx, slug);
  }
  ctx.restore();
}

/** Griffin 보조무기 (P-38 homing missile): original hand-missile body + flickering plume. */
/**
 * Rampalion part shot: its robot's own original projectile sprite (b.pfx, rampalion.js),
 * turned along the flight. pfx: tex, w x h (px), ax = sprite anchor along x (the head sits on
 * the bullet), sheet = [cols, cell, frames, fps], solid = normal blend (rockets), smoke =
 * a puff sheet trailing behind, core = a hot centre line, tint = an extra colour wash.
 */
function drawRampPart(ctx, b) {
  const f = b.pfx;
  if (f?.lion) return drawLionHead(ctx, b, f);
  const img = f && (f.crescent ? crescentSprite(f.crescent)
    : f.tintTex ? tintedTex(f.tex, f.tintTex) : getNativeWeaponImage(f.tex));
  if (!img) return;
  const s = img._lo || 1;
  ctx.save();
  ctx.translate(b.x, b.y);
  // spin: rolls on its own (orbs); else turned along the flight.
  ctx.rotate(f.spin ? b.age * f.spin : Math.atan2(b.vy, b.vx));
  if (f.smoke) {
    const puff = getNativeWeaponImage(f.smoke);
    if (puff) {
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        const k = (i + ((b.age * 9) % 1)) / 3;
        ctx.globalAlpha = 0.5 * (1 - k);
        const d = 10 + 15 * k;
        drawCellAt(ctx, puff, 3, 96 * s, Math.min(8, Math.floor(k * 9)), -f.w * f.ax - 22 * k * 3, 0, d, d);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = f.solid ? 'source-over' : 'lighter';
  const x0 = -f.w * (f.ax ?? 0.5);
  if (f.sheet) {
    const [cols, cell, n, fps] = f.sheet;
    drawCellAt(ctx, img, cols, cell * s, Math.floor(b.age * fps + b.phase * 3) % n, x0 + f.w / 2, 0, f.w, f.h);
  } else {
    ctx.drawImage(img, x0, -f.h / 2, f.w, f.h);
  }
  if (f.tint) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = f.tint;
    ctx.beginPath();
    ctx.ellipse(x0 + f.w * 0.75, 0, f.w * 0.3, f.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (f.core) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = f.core;
    ctx.fillRect(x0 + f.w * 0.3, -1, f.w * 0.68, 2);
  }
  ctx.restore();
}

/**
 * Goltarion's sword wave (user): a violet crescent bowed forward, white-hot along its front
 * edge with a soft glow - painted once per colour into an offscreen sprite (+x = forward).
 */
const CRESCENTS = new Map();
function crescentSprite(color) {
  let c = CRESCENTS.get(color);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  c = document.createElement('canvas');
  c.width = 96;
  c.height = 160;
  const g = c.getContext('2d');
  const blade = () => {
    g.beginPath();
    g.ellipse(26, 80, 52, 70, 0, -Math.PI / 2, Math.PI / 2);
    g.ellipse(4, 80, 44, 66, 0, Math.PI / 2, -Math.PI / 2, true);
    g.closePath();
    g.fill();
  };
  g.shadowColor = color;
  g.shadowBlur = 14;
  const grad = g.createLinearGradient(20, 0, 80, 0);
  grad.addColorStop(0, 'rgba(120,40,200,0)');
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, '#f6ecff');
  g.fillStyle = grad;
  blade();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,250,255,0.85)';
  g.beginPath();
  g.ellipse(26, 80, 52, 70, 0, -Math.PI / 2.4, Math.PI / 2.4);
  g.ellipse(26, 80, 47, 64, 0, Math.PI / 2.4, -Math.PI / 2.4, true);
  g.closePath();
  g.fill();
  CRESCENTS.set(color, c);
  return c;
}

/**
 * Hyper Rampalion's lion head shot: its skill2 fire lion (ramp-fx-lion, mouth shut -> roaring,
 * looping) drawn like Rampalion C Lv2's lion so the face reads - a dark ember backing behind
 * the face (eyes / fangs are holes in the flame art), the body in deep orange, a light glow
 * and the centre ring on top.
 */
function drawLionHead(ctx, b, f) {
  const body = tintedTex('ramp-fx-lion', '#e8420e');
  const glow = tintedTex('ramp-fx-lion', '#ffb04a');
  const ring = tintedTex('ramp-fx-lioncenter', '#ffb24a');
  if (!body) return;
  const s = body._lo || 1;
  const cell = 384 * s;
  const ls = f.w;
  const frame = Math.floor(b.age * 14) % 9;
  const cellOf = (img, fr, x, y, w) => ctx.drawImage(img, (fr % 3) * cell, Math.floor(fr / 3) * cell, cell, cell, x - w / 2, y - w / 2, w, w);
  ctx.save();
  const back = ctx.createRadialGradient(b.x + ls * 0.08, b.y + ls * 0.05, 0, b.x + ls * 0.08, b.y + ls * 0.05, ls * 0.3);
  back.addColorStop(0, 'rgba(90,14,4,0.95)');
  back.addColorStop(0.7, 'rgba(120,24,6,0.85)');
  back.addColorStop(1, 'rgba(120,24,6,0)');
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.arc(b.x + ls * 0.08, b.y + ls * 0.05, ls * 0.3, 0, Math.PI * 2);
  ctx.fill();
  cellOf(body, frame, b.x, b.y, ls);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  if (glow) cellOf(glow, frame, b.x, b.y, ls);
  ctx.globalAlpha = 0.8;
  if (ring) cellOf(ring, frame, b.x - ls * 0.15, b.y, ls * 0.9);
  ctx.restore();
}

/** A white FX sheet coloured once (Hyper Rampalion's lion head: its skill2 lion aura in orange). */
const TINTED_TEX = new Map();
function tintedTex(key, col) {
  const id = key + col;
  let c = TINTED_TEX.get(id);
  if (c) return c;
  const img = getNativeWeaponImage(key);
  if (!img || !(img.naturalWidth || img.width) || typeof document === 'undefined') return null;
  c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.85;
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  c._lo = img._lo;
  TINTED_TEX.set(id, c);
  return c;
}

function drawCellAt(ctx, img, cols, cell, frame, x, y, w, h) {
  ctx.drawImage(img, (frame % cols) * cell, Math.floor(frame / cols) * cell, cell, cell, x - w / 2, y - h / 2, w, h);
}

function drawP38Missile(ctx, b) {
  const plume = getNativeWeaponImage('griffin-fx-plume');
  const body = getNativeWeaponImage('griffin-fx-missile');
  const flick = 0.8 + 0.2 * Math.sin(b.age * 60 + b.phase);
  const boost = Math.min(1, Math.hypot(b.vx, b.vy) / 820);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  const pl = (18 + 22 * boost) * flick;
  if (plume) ctx.drawImage(plume, -pl - 6, -6 * flick, pl, 12 * flick);
  else softStreak(ctx, -pl * 0.6, 0, pl, 3.2, '#ff8a3a', 0.8);
  softDisk(ctx, -7, 0, 5.5 * flick, '#ffb35a', 0.55);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (body) ctx.drawImage(body, -9, -4.5, 20, 9);
  else {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d9dde4';
    ctx.fillRect(-8, -2.5, 16, 5);
    ctx.fillStyle = '#ff5a3a';
    ctx.fillRect(6, -2.5, 3, 5);
  }
  ctx.restore();
}

/** One lavender flame blade (lens pointed at both ends, tip forward along +X). */
function shindenBlade(ctx, x, y, len, wid, ang, edge, body) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const blade = (l, w) => {
    ctx.beginPath();
    ctx.moveTo(l * 0.5, 0);
    ctx.quadraticCurveTo(0, -w, -l * 0.5, 0);
    ctx.quadraticCurveTo(0, w, l * 0.5, 0);
    ctx.fill();
  };
  ctx.fillStyle = edge;
  blade(len, wid);
  ctx.fillStyle = body;
  blade(len * 0.86, wid * 0.62);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(len * 0.06, -wid * 0.12, len * 0.3, wid * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Sleipnir main shot (1945 II J7W Shinden, ref video): a cluster of overlapping lavender
 * flame blades; consecutive clusters touch, so the stream reads as one purple column.
 * Lv1-2: 3 blades, Lv3+: 5 blades; blades grow with P.
 */
function drawShindenShot(ctx, b) {
  const lv = Math.max(1, Math.min(5, b.powerLevel | 0));
  // Cluster length ~= volley spacing (speed x fire interval) so clusters touch.
  const len = 64;
  const wid = 7 + lv * 0.9;
  const edge = b.glow || '#9a6bff';
  const body = b.color || '#dccaff';
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softDisk(ctx, -len * 0.1, 0, b.r * 1.5, edge, 0.18);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.95;
  const side = b.r * 0.7;
  if (lv >= 3) {
    shindenBlade(ctx, -len * 0.3, -side * 1.7, len * 0.78, wid * 0.85, 0, edge, body);
    shindenBlade(ctx, -len * 0.3, side * 1.7, len * 0.78, wid * 0.85, 0, edge, body);
  }
  shindenBlade(ctx, -len * 0.16, -side, len * 0.9, wid, 0, edge, body);
  shindenBlade(ctx, -len * 0.16, side, len * 0.9, wid, 0, edge, body);
  shindenBlade(ctx, 0, 0, len, wid * 1.05, 0, edge, body);
  ctx.restore();
}

/**
 * Rampalion's main shot "Lion Buster" (user: it was Sleipnir's exact bullet): a gold energy
 * lance with a lion's mane of flame tongues streaming back off its head and a white-hot tip.
 * Painted once per power level and mane phase into offscreen sprites, then stamped.
 */
const LION_SHOTS = new Map();
function lionShotSprite(lv, phase) {
  const id = lv * 2 + phase;
  let c = LION_SHOTS.get(id);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  const len = 46 + lv * 6;
  const wid = 9 + lv * 1.6;
  const S = 2;
  const W2 = len * 1.5;
  const H2 = wid * 4.4;
  c = document.createElement('canvas');
  c.width = Math.ceil(W2 * S);
  c.height = Math.ceil(H2 * S);
  const g = c.getContext('2d');
  g.scale(S, S);
  // Origin = the lance tip, flying +x.
  const tx = W2 * 0.86;
  const ty = H2 / 2;
  g.translate(tx, ty);
  g.globalCompositeOperation = 'lighter';
  // Soft glow round the head.
  const glow = g.createRadialGradient(-len * 0.18, 0, 0, -len * 0.18, 0, wid * 1.9);
  glow.addColorStop(0, 'rgba(255,170,60,0.55)');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.ellipse(-len * 0.18, 0, wid * 2.4, wid * 1.9, 0, 0, Math.PI * 2);
  g.fill();
  // Mane: flame tongues curling back off the head (more with power), swaying by phase.
  const tongues = lv >= 3 ? 5 : 3;
  for (let i = 0; i < tongues; i++) {
    const u = tongues === 1 ? 0 : i / (tongues - 1) - 0.5; // -0.5..0.5
    const sway = (phase ? 1 : -1) * wid * 0.25;
    const y0 = u * wid * 1.1;
    const tipX = -len * (0.95 - Math.abs(u) * 0.35);
    const tipY = u * wid * 3.0 + sway * (i % 2 ? 1 : -1);
    const grad = g.createLinearGradient(-len * 0.1, 0, tipX, 0);
    grad.addColorStop(0, 'rgba(255,200,90,0.9)');
    grad.addColorStop(0.5, 'rgba(255,110,30,0.6)');
    grad.addColorStop(1, 'rgba(220,40,10,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-len * 0.12, y0 - wid * 0.32);
    g.quadraticCurveTo(-len * 0.45, y0 + (tipY - y0) * 0.2 - wid * 0.35, tipX, tipY);
    g.quadraticCurveTo(-len * 0.45, y0 + (tipY - y0) * 0.2 + wid * 0.35, -len * 0.12, y0 + wid * 0.32);
    g.closePath();
    g.fill();
  }
  // The lance: a tapered gold spearhead.
  g.globalCompositeOperation = 'source-over';
  const body = g.createLinearGradient(-len * 0.5, 0, 0, 0);
  body.addColorStop(0, 'rgba(255,120,30,0)');
  body.addColorStop(0.45, '#ff9a2a');
  body.addColorStop(0.85, '#ffd24a');
  body.addColorStop(1, '#fff6d0');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(-len * 0.18, -wid * 0.62, -len * 0.5, -wid * 0.18);
  g.lineTo(-len * 0.5, wid * 0.18);
  g.quadraticCurveTo(-len * 0.18, wid * 0.62, 0, 0);
  g.closePath();
  g.fill();
  // White-hot core near the tip.
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,252,235,0.95)';
  g.beginPath();
  g.ellipse(-len * 0.12, 0, len * 0.16, wid * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  c._x0 = -tx;
  c._y0 = -ty;
  c._w = W2;
  c._h = H2;
  LION_SHOTS.set(id, c);
  return c;
}

function drawLionShot(ctx, b) {
  const lv = Math.max(1, Math.min(5, b.powerLevel | 0));
  const c = lionShotSprite(lv, Math.floor(b.age * 14 + b.phase) & 1);
  if (!c) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.vy) ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.drawImage(c, c._x0, c._y0, c._w, c._h);
  ctx.restore();
}

/** Express main shot (1945 II XF5U wide shot): round violet pellet with a pale core. */
function drawPancakeShot(ctx, b) {
  const r = b.r;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softDisk(ctx, -r * 0.6, 0, r * 2.1, b.glow || '#7a3cff', 0.35);
  ctx.globalAlpha = 1;
  ctx.fillStyle = b.color || '#c9a2ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.45, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6efff';
  ctx.beginPath();
  ctx.arc(r * 0.25, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Sleipnir 보조무기 (J7W heat missile, ref video): white missile wrapped in a blue glow
 * with a blue exhaust (drills through enemies, see Game multi-hit).
 */
function drawHeatMissile(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.scale(1.5, 1.5); // reads clearly on top of the purple main-shot column
  const flick = 0.75 + 0.25 * Math.sin(b.age * 70 + b.phase);
  const glow = b.glow || '#3a8cff';
  ctx.globalCompositeOperation = 'lighter';
  const boost = Math.min(1, Math.hypot(b.vx, b.vy) / 1350);
  softStreak(ctx, -15 - 10 * boost, 0, (12 + 18 * boost) * flick, 3.4, glow, 1);
  softDisk(ctx, -9, 0, 5.5 * flick, '#a8d4ff', 0.75);
  softDisk(ctx, 1, 0, 10, glow, 0.45);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Dark-blue outline separates the white body from the lavender blades behind it.
  ctx.fillStyle = '#16307a';
  ctx.beginPath();
  ctx.moveTo(11.5, 0);
  ctx.quadraticCurveTo(6, -4, -8.5, -3.8);
  ctx.lineTo(-8.5, 3.8);
  ctx.quadraticCurveTo(6, 4, 11.5, 0);
  ctx.fill();
  ctx.fillStyle = b.color || '#f4f8ff';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.quadraticCurveTo(6, -2.8, -7, -2.6);
  ctx.lineTo(-7, 2.6);
  ctx.quadraticCurveTo(6, 2.8, 10, 0);
  ctx.fill();
  ctx.fillStyle = '#6fb0ff';
  ctx.fillRect(-8.5, -4.6, 3, 9.2);
  ctx.restore();
}

/** Express 보조무기 (XF5U automatic laser): thin blue beam with a white core. */
function drawPancakeLaser(ctx, b) {
  const len = Math.min(b.beamLength || 70, 12 + b.age * Math.hypot(b.vx, b.vy));
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = b.glow || '#2f8cff';
  ctx.fillRect(-len, -4, len + 4, 8);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#6cc0ff';
  ctx.fillRect(-len, -2, len + 3, 4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = b.color || '#e8f6ff';
  ctx.fillRect(-len * 0.8, -0.8, len * 0.8 + 2, 1.6);
  softDisk(ctx, 1, 0, 5, '#9fd4ff', 0.6);
  ctx.restore();
}

/** Labiata main shot (1945 II Ki-84 Hayate wide shot): long blue-violet crystal shard. */
function drawHayateShot(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softDisk(ctx, -4, 0, 9, b.glow || '#6a5cff', 0.22);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.95;
  const sc = (b.r || 4) / 4; // big centre shards vs small side shards
  shindenBlade(ctx, 0, 0, 30 * sc, 5.2 * sc, 0, b.glow || '#6a5cff', b.color || '#c3b8ff');
  ctx.restore();
}

/** Constantia main shot (Gunbird Marion spread): pink magic orb with a sparkle tail. */
function drawMarionShot(ctx, b) {
  const sc = (b.r || 4.5) / 4.5;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softStreak(ctx, -12 * sc, 0, 20 * sc, 5 * sc, b.glow || '#ff5fc8', 0.6);
  softDisk(ctx, 0, 0, 7 * sc, b.glow || '#ff5fc8', 0.45);
  softDisk(ctx, 0, 0, 4 * sc, '#ffb3ea', 0.95);
  softDisk(ctx, 0.5, 0, 2.2 * sc, b.color || '#ffe6fb', 1);
  ctx.restore();
}

function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.95);
  ctx.bezierCurveTo(-s * 1.25, s * 0.15, -s * 1.05, -s * 0.95, 0, -s * 0.38);
  ctx.bezierCurveTo(s * 1.05, -s * 0.95, s * 1.25, s * 0.15, 0, s * 0.95);
  ctx.closePath();
}

/** Constantia 보조무기 (Marion's homing stars, as hearts): pulsing pink heart. */
function drawHeartShot(ctx, b) {
  const s = (b.r || 7) * (1 + 0.1 * Math.sin(b.age * 18));
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.sin(b.age * 6) * 0.25);
  ctx.globalCompositeOperation = 'lighter';
  softDisk(ctx, 0, 0, s * 1.9, b.glow || '#ff3d9a', 0.35);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  heartPath(ctx, s * 1.15);
  ctx.fillStyle = '#c2185b';
  ctx.fill();
  heartPath(ctx, s);
  ctx.fillStyle = '#ff5fae';
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = b.color || '#ffd6f0';
  ctx.beginPath();
  ctx.ellipse(-s * 0.42, -s * 0.28, s * 0.22, s * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const X36_EGG = [['#2f5bff', '#9fb6ff'], ['#6f7dff', '#d6dcff'], ['#22b07a', '#a6f0cf'], ['#8a4dff', '#dccaff']];

/**
 * Peregrinus human form (X-36 special shot, reference video): big glossy egg - long axis
 * along the flight, dark rim, lighter body, a pale cap and two highlight blobs at the nose.
 * It swells out of the muzzle ring, and a small pill circles it (behind / in front).
 */
function drawX36Orb(ctx, b) {
  const grow = Math.min(1, 0.25 + (b.age / 0.14) * 0.75);
  const r = (b.r || 26) * grow;
  const rx = r * 1.6;
  const ry = r * 1.05;
  const glow = b.glow || '#6f7dff';
  const light = b.color || '#d6dcff';
  const idx = Math.max(0, X36_EGG.findIndex((c) => c[0] === glow));
  const [pg, pc] = X36_EGG[(idx + 2) % X36_EGG.length];
  const orbit = b.age * 7 + idx * 1.6;
  const pill = (front) => {
    if ((Math.sin(orbit) >= 0) !== front) return;
    const px = Math.cos(orbit) * rx * 0.9;
    const py = Math.sin(orbit) * ry * 1.35;
    drawPillAt(ctx, b.x + px, b.y + py, (b.r || 26) * 0.34 * grow, orbit + Math.PI / 2, pg, pc);
  };
  pill(false);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softDisk(ctx, 0, 0, r * 1.3, glow, 0.06);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(rx * 0.25, -ry * 0.2, r * 0.2, 0, 0, rx);
  g.addColorStop(0, light);
  g.addColorStop(0.55, glow);
  g.addColorStop(1, 'rgba(10,10,40,0.85)');
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pale cap at the nose + highlight blobs (the arcade sprite's shine).
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(rx * 0.42, 0, rx * 0.36, ry * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#ffffff';
  for (const oy of [-0.32, 0.32]) {
    ctx.beginPath();
    ctx.ellipse(rx * 0.55, ry * oy, rx * 0.12, ry * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.1, 0, rx * 0.5, ry * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  pill(true);
}

/** Glossy pill (three overlapping balls) at (x, y), turned by `ang`. */
function drawPillAt(ctx, x, y, r, ang, glow, light) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  for (const [ox, a] of [[-r * 0.9, 0.85], [0, 0.9], [r * 0.9, 1]]) {
    const g = ctx.createRadialGradient(ox + r * 0.25, -r * 0.3, r * 0.1, ox, 0, r);
    g.addColorStop(0, light);
    g.addColorStop(1, glow);
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const SPIRAL_STEP = 6;

/**
 * Peregrinus human form - X-36 Lv1 "Spiral Laser", horizontal. Layers: pulsing outer glow,
 * the halves of two counter-phased strands that pass behind the core, the white core,
 * then the halves in front. `grow` 0..1 extends it to the right edge; `fade` 1..0 on
 * release (glow goes first, strands thin, the core goes last). The glow gradient is built
 * once per settings object and reused (beam drawn in local space).
 */
/** Peregrinus human-form laser opacity (user: 30% transparent). */
// 0.7 -> 0.45 (user): the additive beam washed out enemy bullets crossing it.
const SPIRAL_BEAM_ALPHA = 0.45;

export function drawSpiralBeam(ctx, x0, y, grow, fade, phase, widthMul, c) {
  const len = Math.max(0, (W + 40 - x0) * grow);
  if (len < 2 || fade <= 0) return;
  const k = widthMul;
  const amp = c.amp * k * Math.min(1, fade * 1.4);
  const glowA = Math.max(0, (fade - 0.45) / 0.55) * (0.85 + 0.15 * Math.sin(phase * 1.7));
  ctx.save();
  ctx.translate(x0, y);
  // Outer glow (cached vertical gradient, local coords).
  if (!c._glowGrad || c._glowFor !== ctx) {
    const gh = c.glowWidth;
    const rgb = c.glowRgb || '42,107,255';
    const g = ctx.createLinearGradient(0, -gh, 0, gh);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(0.35, `rgba(${rgb},0.32)`);
    g.addColorStop(0.5, `rgba(${rgb},0.55)`);
    g.addColorStop(0.65, `rgba(${rgb},0.32)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c._glowGrad = g;
    c._glowFor = ctx;
  }
  // 'screen' (not additive): the beam tints what it crosses instead of whiting it out, so
  // enemies / pickups inside the band stay readable at Lv5 width (user).
  ctx.globalCompositeOperation = 'screen';
  if (glowA > 0) {
    ctx.globalAlpha = (glowA) * SPIRAL_BEAM_ALPHA * 0.8;
    ctx.fillStyle = c._glowGrad;
    ctx.save();
    // Outer glow grows with P level more gently than the hit band (sqrt).
    ctx.scale(1, Math.sqrt(k));
    ctx.fillRect(0, -c.glowWidth, len, c.glowWidth * 2);
    ctx.restore();
  }
  // Strands: y = sin(x*wave - phase + off) * amp; depth = cos(...) (< 0 = behind the core).
  const strands = (front) => {
    ctx.beginPath();
    for (const off of [0, Math.PI]) {
      let pen = false;
      for (let x = 0; x <= len; x += SPIRAL_STEP) {
        const a = x * c.wave - phase + off;
        const inFront = Math.cos(a) >= 0;
        const yy = Math.sin(a) * amp;
        if (inFront === front) {
          if (pen) ctx.lineTo(x, yy);
          else { ctx.moveTo(x, yy); pen = true; }
        } else pen = false;
      }
    }
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Behind the core: darker, thinner.
  ctx.globalAlpha = (0.75 * fade) * SPIRAL_BEAM_ALPHA;
  ctx.strokeStyle = c.strandBack;
  ctx.lineWidth = 3.2 * (c.strandWidth || 1) * Math.sqrt(k) * fade;
  strands(false);
  ctx.stroke();
  // Core: constant brightness; collapses last.
  // Thin lines at high P level (sqrt): the swing (amp) still shows the full hit band.
  const coreW = Math.max(1.2, c.width * 0.7 * Math.sqrt(k) * Math.min(1, fade * 2.2));
  ctx.globalAlpha = (0.55) * SPIRAL_BEAM_ALPHA;
  ctx.strokeStyle = c.glow;
  ctx.lineWidth = coreW * 1.9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.globalAlpha = (1) * SPIRAL_BEAM_ALPHA;
  ctx.strokeStyle = c.core;
  ctx.lineWidth = coreW;
  ctx.stroke();
  // In front of the core: brighter, thicker.
  ctx.globalAlpha = (0.95 * fade) * SPIRAL_BEAM_ALPHA;
  ctx.strokeStyle = c.strand;
  ctx.lineWidth = 4.4 * (c.strandWidth || 1) * Math.sqrt(k) * fade;
  strands(true);
  ctx.stroke();
  ctx.globalAlpha = (0.6 * fade) * SPIRAL_BEAM_ALPHA;
  ctx.strokeStyle = c.highlight || '#cfe6ff';
  ctx.lineWidth = 1.4 * (c.strandWidth || 1) * Math.sqrt(k) * fade;
  ctx.stroke();
  // Muzzle: energy gathers while the beam forms, then a steady small flare.
  const flare = grow < 1 ? 1.6 - grow * 0.6 : 1;
  softDisk(ctx, 0, 0, c.width * 1.35 * Math.sqrt(k) * flare * fade, c.glow, 0.5);
  softDisk(ctx, 0, 0, c.width * 0.67 * Math.sqrt(k) * flare * fade, c.core, 0.95);
  ctx.restore();
}

/** The small pill that rolls beside each egg: two overlapping glossy circles, spinning. */
function drawX36Pill(ctx, b) {
  const r = b.r || 6;
  const glow = b.glow || '#6f7dff';
  const light = b.color || '#d6dcff';
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.age * 9);
  ctx.globalAlpha = 0.9;
  for (const [ox, a] of [[-r * 0.9, 0.85], [0, 0.9], [r * 0.9, 1]]) {
    const g = ctx.createRadialGradient(ox + r * 0.25, -r * 0.3, r * 0.1, ox, 0, r);
    g.addColorStop(0, light);
    g.addColorStop(1, glow);
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Peregrinus human-form shot (X-36, reference video): pale cyan capsule, white core. */
function drawX36Capsule(ctx, b) {
  const len = (b.r || 4.5) * 5.6;
  const h = (b.r || 4.5) * 1.25;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softStreak(ctx, -len * 0.5, 0, len, h * 1.4, b.glow || '#4fb0ff', 0.45);
  ctx.globalCompositeOperation = 'source-over';
  const cap = (w, hh, col, a) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-w + hh, -hh);
    ctx.lineTo(-hh, -hh);
    ctx.arc(-hh, 0, hh, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-w + hh, hh);
    ctx.arc(-w + hh, 0, hh, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  };
  cap(len, h, '#5fb8ff', 0.9);
  cap(len - 2, h * 0.66, '#bfe6ff', 1);
  cap(len * 0.7, h * 0.3, b.color || '#f4fbff', 1);
  ctx.restore();
}

/**
 * Peregrinus human-form 보조무기: Last Origin's Melite missile sprite (white body, green
 * nose, orange exhaust; drawn nose-first along the flight). Falls back to a capsule.
 */
function drawX36Missile(ctx, b) {
  const img = getNativeWeaponImage('lao-missile-melite');
  if (img) {
    ctx.save();
    ctx.translate(b.x, b.y);
    // The sprite's nose points left: turn it half a circle onto the flight direction.
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI);
    ctx.drawImage(img, -8, -16, 64, 32);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softStreak(ctx, -12, 0, 22, 6, '#ff6a00', 0.55);
  softDisk(ctx, 0, 0, 8, '#ff9a2e', 0.45);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = b.color || '#fff4c2';
  ctx.beginPath();
  ctx.ellipse(2, -1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Peregrinus bird-form 보조무기: the original sonic-boom crescent (convex side forward),
 * swelling with age and fading out at the end of its life.
 */
function drawSonicBoom(ctx, b) {
  const img = getNativeWeaponImage('peregrinus-sonicboom');
  const r = b.r || 20;
  const grow = 1 + Math.min(1, b.age / 0.9) * 0.6;
  const life = b.lifetime || 1.5;
  const fade = Math.min(1, b.age / 0.06) * Math.min(1, (life - b.age) / 0.35);
  if (fade <= 0) return;
  const h = r * 2.6 * grow;
  const w = h * 0.55;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  if (img) {
    ctx.globalAlpha = 0.95 * fade;
    ctx.drawImage(img, -w * 0.75, -h / 2, w, h);
    ctx.globalAlpha = 0.45 * fade;
    ctx.drawImage(img, -w * 1.15, -h * 0.42, w * 0.85, h * 0.84);
  } else {
    softStreak(ctx, -r, 0, r * 2, r, b.glow || '#5dffa0', 0.6 * fade);
  }
  ctx.restore();
}

/** Peregrinus main shot: slim yellow-green falcon dart. */
function drawFalconShot(ctx, b) {
  const sc = (b.r || 4) / 4;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softStreak(ctx, -14 * sc, 0, 26 * sc, 4 * sc, b.glow || '#c8e83a', 0.7);
  softStreak(ctx, -6 * sc, 0, 16 * sc, 2 * sc, b.color || '#fbffd8', 1);
  ctx.restore();
}

/** Shusui option needle: short cyan streak. */
function drawSyusuiShot(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.globalCompositeOperation = 'lighter';
  softStreak(ctx, -12, 0, 20, 4, b.glow || '#22d3ee', 0.95);
  softDisk(ctx, 0, 0, 4.8, '#e6fbff', 0.9);
  ctx.restore();
}

export function drawCharacterShot(ctx, b) {
  if (b.style === 'hayateshot') return drawHayateShot(ctx, b);
  if (b.style === 'syusuishot') return drawSyusuiShot(ctx, b);
  if (b.style === 'ramppart') return drawRampPart(ctx, b);
  if (b.style === 'marionshot') return drawMarionShot(ctx, b);
  if (b.style === 'falconshot') return drawFalconShot(ctx, b);
  if (b.style === 'sonicboom') return drawSonicBoom(ctx, b);
  if (b.style === 'x36orb') return drawX36Orb(ctx, b);
  if (b.style === 'x36pill') return drawX36Pill(ctx, b);
  if (b.style === 'x36capsule') return drawX36Capsule(ctx, b);
  if (b.style === 'x36missile') return drawX36Missile(ctx, b);
  if (b.style === 'heartshot') return drawHeartShot(ctx, b);
  if (b.style === 'shindenshot') return drawShindenShot(ctx, b);
  if (b.style === 'lionshot') return drawLionShot(ctx, b);
  if (b.style === 'pancakeshot') return drawPancakeShot(ctx, b);
  if (b.style === 'heatmissile') return drawHeatMissile(ctx, b);
  if (b.style === 'pancakelaser') return drawPancakeLaser(ctx, b);
  if (b.style === 'p38shot') return drawP38Shot(ctx, b);
  if (b.style === 'p38missile') return drawP38Missile(ctx, b);
  if (b.nativeKey && drawNativeWeapon(ctx, b)) return;
  const r = Math.max(b.r, 2.2);
  const color = b.color || '#9ef0ff';
  const glow = b.glow || color;
  const style = b.style || '';
  const plasma = style === 'lightning' || style === 'jupiterorb' || style === 'teslabeam'
    || style === 'empfield' || style === 'teslacoil' || style === 'chainarc';
  const beam = style === 'sightbeam' || style === 'teslabeam' || style === 'railbeam'
    || style === 'busterbeam'
    || style === 'swordlance' || style === 'cyclopsbeam';
  const core = kitCoreColor(style);
  const dens = b.special ? 1.4 : b.pierce ? 1.2 : 1;
  const prev = ctx.globalCompositeOperation;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));

  if (style === 'bori') {
    drawBoriRunner(ctx, r, b.age);
    softDisk(ctx, -r * 1.58, r * 0.65, r * 0.07, '#ffe6a8', 0.32);
    softDisk(ctx, -r * 1.82, r * 0.7, r * 0.045, '#ffe6a8', 0.17);
    ctx.restore();
    return;
  }

  if (drawSpecialSignature(ctx, b, r)) {
    ctx.restore();
    return;
  }

  // Soft outer halo — cheap readable presence, not a hard outline.
  softDisk(ctx, 0, 0, r * (b.special ? 2.2 : 1.7), glow, b.special ? 0.16 : 0.08);

  if (beam) {
    const len = Math.min(b.beamLength || 330, 30 + b.age * Math.hypot(b.vx, b.vy));
    // Lance = sparse gold needle; railbeam = denser continuous ribbon (≠ railspike)
    const holdLance = style === 'sightbeam';
    const railBody = style === 'railbeam';
    // Overwatch lance uses gapped needle chips (odd steps skipped) — dens/side budgets untouched.
    const steps = Math.max(5, Math.round((plasma ? 12 : holdLance ? 7 : railBody ? 12 : 10) * dens));
    const sideJitter = plasma ? 1.1 : holdLance ? 0.22 : railBody ? 0.58 : 0.45;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < steps; i++) {
      // Gap odd chips so the drop shaft reads as needle cadence, not a laser pillar.
      if (holdLance && i % 2 === 1) continue;
      const t = i / steps;
      const x = -len * t;
      const y = (moteRand(b.phase, i, 5) - 0.5) * r * sideJitter;
      const sizeMul = 0.4 + moteRand(b.phase, i, 6) * (holdLance ? 0.55 : 0.9);
      const rad = r * (1.05 - t * 0.55) * sizeMul * (holdLance ? 0.78 : railBody ? 1.08 : 1);
      const col = trailColor(t, color, glow, core);
      if (holdLance || moteRand(b.phase, i, 15) > 0.4) {
        softStreak(ctx, x, y, rad * (holdLance ? 2.65 : 2.05), rad * (holdLance ? 0.3 : 0.48), col, 0.44 * (1 - t));
      } else {
        softDisk(ctx, x, y, rad * 1.5, glow, 0.1 * (1 - t));
        softDisk(ctx, x, y, rad, col, 0.48 * (1 - t));
        if (t < 0.28) softDisk(ctx, x, y, rad * 0.3, core, 0.7 * (1 - t));
      }
    }
    // Lance tip spear — short strike needle (≠ continuous rail body tip bloom).
    if (holdLance) {
      softStreak(ctx, r * 0.28, 0, r * 2.55, r * 0.11, core, 0.84);
      softStreak(ctx, -r * 0.85, 0, r * 1.55, r * 0.08, glow, 0.36);
    }
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * (holdLance ? 0.72 : railBody ? 1.2 : 1.1), color, glow);
    softDisk(ctx, 0, 0, r * (holdLance ? 0.24 : 0.35), core, 1);
  } else if (style === 'jupiterorb' || style === 'teslacoil' || style === 'empfield'
    || style === 'flameward') {
    // Stationary / orb — soft plasma cloud of motes, not a gear.
    // jupiterorb = wide weather field (≠ round seeker-orb halo).
    // empfield = EMP pulse ring / radial discharge (≠ cyan seeking orb, ≠ weather cloud).
    // sunseal left this branch (tick84) — purification seal ring, not a filled fire orb.
    // xenoxcore left this branch (tick79) — it is a flying split shard, not a filled orb.
    const storm = style === 'jupiterorb';
    const emp = style === 'empfield';
    const n = Math.round((storm ? 14 : plasma ? 11 : 8) * dens);
    const spin = b.age * 6 + b.phase;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = spin + i * ((Math.PI * 2) / n) + moteRand(b.phase, i, 7) * 0.55;
      // EMP biases motes onto a pulse ring (annulus), not a filled seeker disk.
      const rad = emp
        ? r * (0.62 + moteRand(b.phase, i, 8) * 0.48)
        : r * (0.2 + moteRand(b.phase, i, 8) * (storm ? 1.15 : 0.85));
      const px = Math.cos(a) * rad * (storm ? 1.32 : emp ? 1.08 : 1);
      const py = Math.sin(a) * rad * (storm ? 0.68 : emp ? 1.02 : style === 'flameward' ? 0.85 : 1);
      const sz = r * (0.1 + moteRand(b.phase, i, 9) * (storm ? 0.32 : emp ? 0.18 : 0.22));
      softDisk(ctx, px, py, sz, emp ? (i % 2 ? '#ffffff' : color) : (i % 3 === 0 ? core : color), emp ? 0.38 : 0.42);
      if (plasma && !emp) softDisk(ctx, px * 0.7, py * 0.7, sz * 0.55, core, 0.5);
    }
    // Sparse lightning spark chips — white tip / cyan cool cadence (≠ solid homing orb).
    if (storm) {
      for (let i = 0; i < 4; i++) {
        const s = i % 2 ? 1 : -1;
        softStreak(
          ctx,
          (moteRand(b.phase, i, 24) - 0.5) * r * 0.55,
          s * r * (0.28 + i * 0.18),
          r * (0.85 + moteRand(b.phase, i, 25) * 0.55),
          r * 0.12,
          i % 2 ? core : glow,
          0.42,
        );
      }
    }
    // EMP radial discharge spokes + soft pulse ring plates (≠ weather streaks, ≠ seeker halo).
    // Orb dens loop (n) stays frozen; silhouette / color cadence only.
    if (emp) {
      for (let i = 0; i < 6; i++) {
        const a = spin * 0.35 + i * ((Math.PI * 2) / 6);
        softStreak(
          ctx,
          Math.cos(a) * r * 0.22,
          Math.sin(a) * r * 0.22,
          r * (0.95 + moteRand(b.phase, i, 24) * 0.45),
          r * 0.10,
          i % 2 ? '#ffffff' : glow,
          0.44,
        );
      }
      for (let i = 0; i < 3; i++) {
        const rr = r * (0.55 + i * 0.28);
        softDisk(ctx, 0, 0, rr * 0.22, i === 1 ? core : glow, i === 1 ? 0.28 : 0.14);
      }
      softDisk(ctx, 0, 0, r * 0.16, '#ffffff', 0.72);
    }
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * (storm ? 1.05 : emp ? 0.98 : 1.15), color, glow);
  } else if (style === 'sunseal') {
    // Yatagarasu purification seal — soft ember ring / clear-zone plate
    // (≠ filled fire-orb blob / seeker halo, ≠ phoenix wing-fan hold,
    //  ≠ EMP cyan pulse, ≠ Fragarach ash marker, ≠ hard seal / gear geometry).
    // dens n frozen at the prior orb-branch formula (8 * dens).
    const n = Math.round(8 * dens);
    const spin = b.age * 5.2 + b.phase;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      // Bias motes onto a soft seal ring (annulus), not a filled fire disk.
      const a = spin + i * ((Math.PI * 2) / n) + moteRand(b.phase, i, 7) * 0.45;
      const rad = r * (0.58 + moteRand(b.phase, i, 8) * 0.48);
      const px = Math.cos(a) * rad * 1.06;
      const py = Math.sin(a) * rad * 1.04;
      const sz = r * (0.10 + moteRand(b.phase, i, 9) * 0.18);
      softDisk(ctx, px, py, sz, i % 2 ? '#fff8e0' : color, 0.40);
      if (i % 3 === 0) softDisk(ctx, px * 0.72, py * 0.72, sz * 0.5, core, 0.48);
    }
    // Soft seal ring chips — cream tip → orange cool (≠ EMP white/cyan spokes, ≠ phoenix wing chips).
    for (let i = 0; i < 6; i++) {
      const a = spin * 0.32 + i * ((Math.PI * 2) / 6);
      softDisk(
        ctx,
        Math.cos(a) * r * 0.80,
        Math.sin(a) * r * 0.80,
        r * (0.14 + (i % 2 === 0 ? 0.08 : 0.04) + moteRand(b.phase, i, 24) * 0.08),
        i % 2 ? '#fff8e0' : glow,
        i % 2 === 0 ? 0.50 : 0.34,
      );
      if (i % 2 === 0) {
        softStreak(
          ctx,
          Math.cos(a) * r * 0.20,
          Math.sin(a) * r * 0.20,
          r * (0.78 + moteRand(b.phase, i, 25) * 0.35),
          r * 0.10,
          core,
          0.36,
        );
      }
    }
    // Compact clear-zone plate — soft seal mass (≠ filled fire orb, ≠ tall phoenix fan).
    for (let i = 0; i < 3; i++) {
      const rr = r * (0.42 + i * 0.22);
      softDisk(ctx, 0, 0, rr * 0.20, i === 1 ? core : glow, i === 1 ? 0.30 : 0.14);
    }
    softDisk(ctx, 0, 0, r * 0.16, '#fff8e0', 0.74);
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 1.02, color, glow);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, b.clearRadius || r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (style === 'xenoxcore') {
    // Xenox tracking split round — fragment shard plate
    // (≠ filled cyan seeker orb, ≠ continuous railbeam laser, ≠ EMP pulse ring).
    // dens n stays frozen at the prior orb-branch formula (8 * dens).
    const n = Math.round(8 * dens);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      // Bias motes onto lateral split lobes (fragment cascade), not a filled seeker disk.
      const lobe = i % 2 ? 1 : -1;
      const along = (moteRand(b.phase, i, 8) - 0.35) * r * 1.15;
      const side = lobe * r * (0.28 + moteRand(b.phase, i, 9) * 0.85);
      const sz = r * (0.10 + moteRand(b.phase, i, 10) * 0.18);
      softDisk(ctx, along, side, sz, i % 2 ? '#ffffff' : color, 0.40);
      if (i % 3 === 0) softDisk(ctx, along * 0.7, side * 0.7, sz * 0.5, core, 0.48);
    }
    // Split shard chips — ice tip → rail cyan cool (≠ seeker halo, ≠ railbeam ribbon).
    for (let i = 0; i < 5; i++) {
      const s = i % 2 ? 1 : -1;
      softStreak(
        ctx,
        -r * (0.08 + i * 0.18),
        s * r * (0.32 + i * 0.16),
        r * (0.72 + moteRand(b.phase, i, 24) * 0.45),
        r * 0.11,
        i % 2 ? '#ffffff' : glow,
        0.42,
      );
    }
    // Compact shard plate — chunky fragment mass (≠ round homing orb, ≠ laser column).
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) / 1.5;
      softDisk(
        ctx,
        t * r * 0.38,
        (moteRand(b.phase, i, 31) - 0.5) * r * 0.22,
        r * (0.16 + (i === 1 || i === 2 ? 0.14 : 0.05) + moteRand(b.phase, i, 32) * 0.1),
        i % 2 ? core : glow,
        i === 1 || i === 2 ? 0.58 : 0.32,
      );
    }
    softDisk(ctx, r * 0.18, 0, r * 0.14, '#ffffff', 0.74);
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 0.92, color, glow);
  } else if (style === 'coffinmissile') {
    // RIP coffin tracking casket — tall lid plate
    // (≠ violet seeking bolt / laser dart, ≠ HMG short slug, ≠ stationary RIP ward).
    // dens n frozen at the prior flying-branch formula (7 * dens).
    const n = Math.round(7 * dens);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      // Bias motes onto a tall casket body (lid mass), not a filled seeker disk.
      const along = (moteRand(b.phase, i, 8) - 0.4) * r * 1.05;
      const side = (moteRand(b.phase, i, 9) - 0.5) * r * 1.55;
      const sz = r * (0.10 + moteRand(b.phase, i, 10) * 0.18);
      softDisk(ctx, along, side, sz, i % 2 ? '#fff8f0' : color, 0.40);
      if (i % 3 === 0) softDisk(ctx, along * 0.7, side * 0.7, sz * 0.5, core, 0.48);
    }
    // Tall lid plate chips — cream tip → violet cool (≠ seeker halo, ≠ HMG lateral grit).
    for (let i = 0; i < 5; i++) {
      const s = (i - 2) / 2;
      softDisk(
        ctx,
        -Math.abs(s) * r * 0.22,
        s * r * 1.22,
        r * (0.18 + (i === 2 ? 0.16 : 0.06) + moteRand(b.phase, i, 24) * 0.1),
        i % 2 ? '#fff8f0' : glow,
        i === 2 ? 0.58 : 0.34,
      );
    }
    // Compact casket nose — chunky RIP mass (≠ elongated violet laser dart).
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) / 1.5;
      softDisk(
        ctx,
        t * r * 0.36,
        (moteRand(b.phase, i, 31) - 0.5) * r * 0.20,
        r * (0.15 + (i === 1 || i === 2 ? 0.13 : 0.05) + moteRand(b.phase, i, 32) * 0.1),
        i % 2 ? core : glow,
        i === 1 || i === 2 ? 0.56 : 0.30,
      );
    }
    softDisk(ctx, r * 0.16, 0, r * 0.13, '#fff8f0', 0.72);
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 0.95, color, glow);
  } else if (style === 'tracer') {
    // Classic arcade shot: one readable brass-and-ivory capsule with a short tail.
    softStreak(ctx, -r * 2.05, 0, r * 2.2, r * 0.34, glow, 0.34);
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#8a4b25';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.35, r * 1.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(r * 0.10, 0, r * 2.12, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffdf0';
    ctx.beginPath();
    ctx.ellipse(r * 0.42, 0, r * 1.38, r * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    softDisk(ctx, r * 1.48, 0, r * 0.30, '#ffffff', 0.95);
  } else if (style === 'lockround') {
    // Winchester lock / spotter slug — brass collar + short slug plate
    // (≠ gold seeking bolt / laser dart, ≠ continuous overwatch lance).
    // dens n frozen at the prior flying-branch formula (7 * dens).
    const n = Math.round(7 * dens);
    const spin = b.age * 5.2 + b.phase;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      // Bias motes onto a short lock body + soft collar ring (≠ filled seeker disk).
      const onCollar = i % 3 !== 0;
      const a = spin + i * ((Math.PI * 2) / n) + moteRand(b.phase, i, 7) * 0.4;
      const along = onCollar
        ? Math.cos(a) * r * (0.55 + moteRand(b.phase, i, 8) * 0.35)
        : (moteRand(b.phase, i, 8) - 0.4) * r * 0.85;
      const side = onCollar
        ? Math.sin(a) * r * (0.55 + moteRand(b.phase, i, 9) * 0.35)
        : (moteRand(b.phase, i, 9) - 0.5) * r * 0.55;
      const sz = r * (0.09 + moteRand(b.phase, i, 10) * 0.16);
      softDisk(ctx, along, side, sz, i % 2 ? '#fff8e8' : color, 0.40);
      if (i % 3 === 0) softDisk(ctx, along * 0.7, side * 0.7, sz * 0.5, core, 0.48);
    }
    // Soft lock collar chips — cream tip → brass cool (≠ seeker halo, ≠ lance needles).
    for (let i = 0; i < 5; i++) {
      const a = spin * 0.4 + i * ((Math.PI * 2) / 5);
      softDisk(
        ctx,
        Math.cos(a) * r * 0.72,
        Math.sin(a) * r * 0.72,
        r * (0.14 + (i === 0 ? 0.08 : 0.04) + moteRand(b.phase, i, 24) * 0.08),
        i % 2 ? '#fff8e8' : glow,
        i === 0 ? 0.52 : 0.34,
      );
    }
    // Compact brass slug plate — chunky lock mass (≠ elongated gold laser dart).
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) / 1.5;
      softDisk(
        ctx,
        t * r * 0.34,
        (moteRand(b.phase, i, 31) - 0.5) * r * 0.16,
        r * (0.16 + (i === 1 || i === 2 ? 0.12 : 0.05) + moteRand(b.phase, i, 32) * 0.1),
        i % 2 ? core : glow,
        i === 1 || i === 2 ? 0.58 : 0.30,
      );
    }
    softDisk(ctx, r * 0.14, 0, r * 0.12, '#fff8e8', 0.74);
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 0.92, color, glow);
  } else if (style === 'commandmissile') {
    // Fragarach command marker — parked designation plate
    // (≠ flying orange seeker / parked bolt, ≠ breech shell casing, ≠ sunseal seal ring).
    // dens n frozen at the prior flying-branch formula (7 * dens).
    const n = Math.round(7 * dens);
    const spin = b.age * 4.6 + b.phase;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      // Bias motes onto a soft marker ring + compact plate (≠ filled seeker disk, ≠ elongated bolt).
      const onRing = i % 3 !== 0;
      const a = spin + i * ((Math.PI * 2) / n) + moteRand(b.phase, i, 7) * 0.4;
      const along = onRing
        ? Math.cos(a) * r * (0.58 + moteRand(b.phase, i, 8) * 0.42)
        : (moteRand(b.phase, i, 8) - 0.5) * r * 0.55;
      const side = onRing
        ? Math.sin(a) * r * (0.58 + moteRand(b.phase, i, 9) * 0.42)
        : (moteRand(b.phase, i, 9) - 0.5) * r * 0.55;
      const sz = r * (0.10 + moteRand(b.phase, i, 10) * 0.18);
      softDisk(ctx, along, side, sz, i % 2 ? '#fff0d0' : color, 0.40);
      if (i % 3 === 0) softDisk(ctx, along * 0.7, side * 0.7, sz * 0.5, core, 0.48);
    }
    // Soft designation ring chips — cream tip → ash cool (≠ seeker halo, ≠ shell breech collar).
    for (let i = 0; i < 5; i++) {
      const a = spin * 0.35 + i * ((Math.PI * 2) / 5);
      softDisk(
        ctx,
        Math.cos(a) * r * 0.78,
        Math.sin(a) * r * 0.78,
        r * (0.15 + (i === 0 ? 0.08 : 0.04) + moteRand(b.phase, i, 24) * 0.08),
        i % 2 ? '#fff0d0' : glow,
        i === 0 ? 0.52 : 0.34,
      );
    }
    // Compact marker plate — chunky command mass (≠ elongated parked bolt / laser dart).
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) / 1.5;
      softDisk(
        ctx,
        t * r * 0.28,
        (moteRand(b.phase, i, 31) - 0.5) * r * 0.22,
        r * (0.18 + (i === 1 || i === 2 ? 0.14 : 0.05) + moteRand(b.phase, i, 32) * 0.1),
        i % 2 ? core : glow,
        i === 1 || i === 2 ? 0.58 : 0.30,
      );
    }
    // Ash drip chips under marker (≠ shell flying breech ash trail — parked beacon only).
    for (let i = 0; i < 3; i++) {
      softDisk(
        ctx,
        (moteRand(b.phase, i, 33) - 0.5) * r * 0.35,
        r * (0.55 + i * 0.28),
        r * (0.14 + moteRand(b.phase, i, 34) * 0.12),
        i % 2 ? '#fff0d0' : '#8aa0b4',
        0.28,
      );
    }
    softDisk(ctx, 0, 0, r * 0.16, '#fff0d0', 0.74);
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 1.05, color, glow);
  } else if (style === 'plasmacross') {
    // Trollsberd cross-cut — soft diagonal slash plate
    // (≠ generic magenta flying bolt / laser dart, ≠ crescent hold blade,
    //  ≠ hard cross / slash geometry — soft disks + soft streaks only).
    // dens n frozen at the prior flying-branch formula (7 * dens).
    const n = Math.round(7 * dens);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      // Bias motes onto soft diagonal lobes (X-cut sheet), not a filled seeker disk / bolt shaft.
      const diag = i % 2 ? 1 : -1;
      const along = (moteRand(b.phase, i, 8) - 0.4) * r * 1.05;
      const side = diag * (0.35 + moteRand(b.phase, i, 9) * 0.95) * r;
      const sz = r * (0.10 + moteRand(b.phase, i, 10) * 0.18);
      softDisk(ctx, along + side * 0.28, side, sz, i % 2 ? '#fff4fc' : color, 0.40);
      if (i % 3 === 0) softDisk(ctx, along * 0.7, side * 0.7, sz * 0.5, core, 0.48);
    }
    // Soft diagonal slash chips — cream tip → magenta cool
    // (≠ hard cross mark, ≠ crescent tall lateral plate, ≠ forward laser ribbon).
    for (let i = 0; i < 6; i++) {
      const diag = i < 3 ? 1 : -1;
      const t = ((i % 3) - 1) / 1;
      softStreak(
        ctx,
        t * r * 0.42,
        diag * t * r * 0.42,
        r * (0.78 + moteRand(b.phase, i, 24) * 0.40),
        r * 0.12,
        i % 2 ? '#fff4fc' : glow,
        0.42,
      );
    }
    // Compact cross-cut plate — chunky cut mass (≠ elongated magenta laser dart, ≠ crescent blade).
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) / 1.5;
      softDisk(
        ctx,
        t * r * 0.30,
        (moteRand(b.phase, i, 31) - 0.5) * r * 0.26,
        r * (0.16 + (i === 1 || i === 2 ? 0.14 : 0.05) + moteRand(b.phase, i, 32) * 0.1),
        i % 2 ? core : glow,
        i === 1 || i === 2 ? 0.58 : 0.32,
      );
    }
    softDisk(ctx, 0, 0, r * 0.14, '#fff4fc', 0.74);
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 0.95, color, glow);
  } else if (style === 'coffinwall' || style === 'coffinshield') {
    // RIP ward — tall soft clear-zone volume (≠ HMG tracers, ≠ parked pierce bolt / laser).
    const n = Math.round((style === 'coffinwall' ? 12 : 9) * dens);
    const spin = b.age * 4.2 + b.phase;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = spin + i * ((Math.PI * 2) / n) + moteRand(b.phase, i, 7) * 0.45;
      const rad = r * (0.28 + moteRand(b.phase, i, 8) * 1.05);
      const px = Math.cos(a) * rad * 0.48;
      const py = Math.sin(a) * rad * 1.38;
      const sz = r * (0.14 + moteRand(b.phase, i, 9) * 0.26);
      softDisk(ctx, px, py, sz, i % 3 === 0 ? core : color, 0.44);
    }
    for (let i = 0; i < 5; i++) {
      softDisk(
        ctx,
        (moteRand(b.phase, i, 10) - 0.5) * r * 0.18,
        (i - 2) * r * 0.44,
        r * (0.26 + (i === 2 ? 0.22 : 0)),
        i === 2 ? core : glow,
        i === 2 ? 0.72 : 0.30,
      );
    }
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 1.4, color, glow);
  } else if (style === 'chainarc') {
    const theta = Math.atan2(b.vy, b.vx);
    const dx = (b.chainOriginX ?? b.x) - b.x;
    const dy = (b.chainOriginY ?? b.y) - b.y;
    const ox = dx * Math.cos(theta) + dy * Math.sin(theta);
    const oy = -dx * Math.sin(theta) + dy * Math.cos(theta);
    const steps = 9;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bend = Math.sin(b.age * 20 + b.phase) * r * 1.2 * Math.sin(t * Math.PI);
      const x = ox * (1 - t);
      const y = oy * (1 - t) + bend;
      const sz = r * (0.42 - t * 0.16) * (0.55 + moteRand(b.phase, i, 16) * 0.7);
      softStreak(ctx, x, y, sz * 1.6, sz * 0.55, trailColor(t, color, glow, core), 0.45 * (1 - t * 0.4));
      softDisk(ctx, x, y, sz * 0.55, core, 0.55 * (1 - t * 0.35));
    }
    ctx.globalCompositeOperation = prev;
    softBloom(ctx, 0, 0, r * 0.9, color, glow);
  } else {
    // Flying shots — denser particle trail + soft head (hold identities diverge here).
    const holdFan = style === 'sunbird';
    const holdAxe = style === 'dragonaxe';
    const holdHmg = style === 'coffinround';
    const holdCrescent = style === 'plasmaslash';
    const holdSpike = style === 'railbolt';
    const holdArty = style === 'shell';
    const trailN = Math.round((plasma ? 11
      : holdFan ? 14
      : holdCrescent ? 9
      : holdAxe ? 7
      : holdSpike ? 4
      : holdHmg ? 12
      : holdArty ? 5
      : style === 'foxflame' ? 7 : 7) * dens);
    const len = holdSpike ? 10.4 : (b.pierce ? 6.8 : (plasma ? 5.5 : holdArty ? 3.6 : holdFan ? 2.9 : holdHmg ? 2.2 : holdCrescent ? 5.4 : holdAxe ? 2.4 : style === 'foxflame' ? 5.2 : 4.4));
    const spread = plasma ? 1.15
      : holdFan ? 2.42
      : holdCrescent ? 1.48
      : holdAxe ? 1.05
      : holdSpike ? 0.12
      : holdHmg ? 0.46
      : holdArty ? 1.02
      : style === 'foxflame' ? 0.58 : 0.52;
    trailMotes(ctx, b, trailN, {
      color, glow, core, length: len, spread, plasma,
      gapOdd: holdCrescent,
      arcBend: holdCrescent ? 1.18 : 0,
    });
    // Ember / smoke wisps — foxflame jet stays narrow; phoenix fan rises wide
    if (style === 'foxflame' || holdFan) {
      for (let i = 0; i < (holdFan ? 9 : 2); i++) {
        const t = 0.28 + i * 0.16;
        softDisk(
          ctx,
          -t * len * r,
          (moteRand(b.phase, i, 11) - 0.5) * r * (holdFan ? 3.45 : 0.85),
          r * (0.35 + moteRand(b.phase, i, 12) * 0.45) * (holdFan ? 1.28 : 0.8),
          glow,
          0.14 * (1 - t),
        );
      }
    }
    // Phoenix — tall lateral wing plate (≠ forward seeker-dart disk, ≠ crescent blade)
    if (holdFan) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const s = (i - 2) / 2;
        softDisk(
          ctx,
          -Math.abs(s) * r * 0.32,
          s * r * 1.62,
          r * (0.20 + (i === 2 ? 0.18 : 0.07) + moteRand(b.phase, i, 26) * 0.12),
          i % 2 ? core : glow,
          i === 2 ? 0.58 : 0.34,
        );
      }
      ctx.globalCompositeOperation = prev;
    }
    // HMG — short side grit chips (≠ lance aligned ribbon); dens loop frozen
    if (holdHmg) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const s = i % 2 ? 1 : -1;
        softStreak(ctx, -r * (0.22 + i * 0.24), s * r * (0.38 + i * 0.12),
          r * 0.40, r * 0.10, i % 2 ? core : glow, 0.34);
      }
      // Short caliber slug plate — chunky tracer mass (≠ forward violet laser dart)
      for (let i = 0; i < 4; i++) {
        const t = (i - 1.5) / 1.5;
        softDisk(
          ctx,
          t * r * 0.32,
          (moteRand(b.phase, i, 31) - 0.5) * r * 0.16,
          r * (0.20 + (i === 1 || i === 2 ? 0.14 : 0.05) + moteRand(b.phase, i, 32) * 0.1),
          i % 2 ? core : glow,
          i === 1 || i === 2 ? 0.56 : 0.32,
        );
      }
      ctx.globalCompositeOperation = prev;
    }
    // Artillery ash above shell tip (dens loop frozen)
    if (holdArty) {
      for (let i = 0; i < 5; i++) {
        softDisk(ctx, (moteRand(b.phase, i, 19) - 0.5) * r * 0.85, -r * (1.05 + i * 0.55),
          r * (0.30 + moteRand(b.phase, i, 20) * 0.36), glow, 0.18);
      }
      // Breech casing plate — chunky shell mass (≠ forward bolt dart, ≠ thin laser ribbon)
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) / 2;
        softDisk(
          ctx,
          t * r * 0.52,
          (moteRand(b.phase, i, 28) - 0.5) * r * 0.18,
          r * (0.24 + (i === 2 ? 0.20 : 0.07) + moteRand(b.phase, i, 29) * 0.12),
          i % 2 ? core : glow,
          i === 2 ? 0.58 : 0.34,
        );
      }
      // Breech ring chips — short vertical collar behind the casing nose
      for (let i = 0; i < 3; i++) {
        softDisk(
          ctx,
          -r * 0.38,
          (i - 1) * r * 0.40,
          r * (0.16 + (i === 1 ? 0.12 : 0)),
          i === 1 ? core : glow,
          i === 1 ? 0.52 : 0.32,
        );
      }
      ctx.globalCompositeOperation = prev;
    }
    // Returning axe — heavier side chips
    if (holdAxe) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const s = i % 2 ? 1 : -1;
        softStreak(ctx, -r * (0.48 + i * 0.28), s * r * 0.36, r * 0.92, r * 0.34, i % 2 ? core : glow, 0.50);
      }
      // Tumble blade plate — chunky lateral mass (≠ forward seeker dart, ≠ thin crescent ribbon)
      for (let i = 0; i < 5; i++) {
        const s = (i - 2) / 2;
        softDisk(
          ctx,
          -Math.abs(s) * r * 0.18,
          s * r * 1.05,
          r * (0.22 + (i === 2 ? 0.20 : 0.08) + moteRand(b.phase, i, 27) * 0.12),
          i % 2 ? core : glow,
          i === 2 ? 0.56 : 0.36,
        );
      }
      ctx.globalCompositeOperation = prev;
    }
    // Crescent — tall lateral blade plate (≠ forward laser ribbon, ≠ fan disks, ≠ axe chips)
    if (holdCrescent) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const s = (i - 2) / 2;
        softDisk(
          ctx,
          -Math.abs(s) * r * 0.22,
          s * r * 1.35,
          r * (0.18 + (i === 2 ? 0.16 : 0.06) + moteRand(b.phase, i, 23) * 0.1),
          i % 2 ? core : glow,
          i === 2 ? 0.62 : 0.38,
        );
      }
      ctx.globalCompositeOperation = prev;
    }
    ctx.globalCompositeOperation = 'lighter';
    // Lightning tip bloom stays thin (≠ fat cyan seeker-orb halo).
    // Cleave slash-wave bloom stays wide/short (≠ forward rose laser dart, ≠ axe tumble halo).
    const teslaBolt = style === 'lightning';
    const slashWave = style === 'cleave';
    softBloom(ctx, 0, 0, r * (teslaBolt ? 0.92 : slashWave ? 1.18 : plasma ? 1.35 : holdFan ? 1.22 : holdCrescent ? 0.92 : holdAxe ? 1.25 : holdArty ? 1.18 : holdHmg ? 0.88 : 1.05), color, glow);
    softDisk(ctx, r * (teslaBolt ? 0.22 : slashWave ? 0.10 : holdCrescent ? 0.06 : holdFan ? 0.08 : holdArty ? 0.02 : holdHmg ? 0.04 : 0.15), 0, r * (teslaBolt ? 0.22 : slashWave ? 0.28 : holdCrescent ? 0.22 : holdFan ? 0.26 : holdArty ? 0.38 : holdHmg ? 0.36 : 0.32), core, 1);
    // LRL basic slash-wave — tall wave-front crest + wide slash chips
    // (≠ tumble returning axe plate, ≠ thin crescent blade, ≠ stacked rose laser dart).
    // Trail dens (trailN/len/spread) stays frozen; silhouette only.
    if (slashWave) {
      for (let i = 0; i < 5; i++) {
        const s = (i - 2) / 2;
        softStreak(
          ctx,
          -r * (0.08 + Math.abs(s) * 0.22),
          s * r * (0.92 + moteRand(b.phase, i, 24) * 0.18),
          r * (0.95 + moteRand(b.phase, i, 25) * 0.35),
          r * 0.16,
          i % 2 ? '#fff0f4' : glow,
          0.42,
        );
      }
      // Wide travelling wave plate — chunky crest mass (≠ axe spin chips, ≠ crescent ribbon).
      for (let i = 0; i < 5; i++) {
        const s = (i - 2) / 2;
        softDisk(
          ctx,
          -Math.abs(s) * r * 0.12,
          s * r * 1.22,
          r * (0.20 + (i === 2 ? 0.18 : 0.07) + moteRand(b.phase, i, 26) * 0.12),
          i % 2 ? core : glow,
          i === 2 ? 0.58 : 0.34,
        );
      }
      softDisk(ctx, r * 0.18, 0, r * 0.14, '#fff0f4', 0.72);
    }
    // Fafnir search bolt — jagged fork streaks + thin arc plate (≠ cyan seeker orb)
    // Trail dens (plasma trailN/len/spread) stays frozen; silhouette only.
    if (plasma && teslaBolt) {
      for (let i = 0; i < 5; i++) {
        const s = ((i % 2) ? 1 : -1) * (Math.sin(b.age * 18 + b.phase + i) > 0 ? 1 : -0.7);
        softStreak(
          ctx,
          -r * (0.15 + i * 0.38),
          s * r * (0.22 + i * 0.16),
          r * (0.72 + moteRand(b.phase, i, 24) * 0.55),
          r * 0.11,
          i % 2 ? '#ffffff' : glow,
          0.48,
        );
      }
      // Thin elongated arc plate — directed spark mass (≠ round homing-orb halo)
      for (let i = 0; i < 4; i++) {
        const t = (i - 1.5) / 1.5;
        softDisk(
          ctx,
          t * r * 0.55,
          (moteRand(b.phase, i, 31) - 0.5) * r * 0.12,
          r * (0.12 + (i === 1 || i === 2 ? 0.10 : 0.04) + moteRand(b.phase, i, 32) * 0.08),
          i % 2 ? core : glow,
          i === 1 || i === 2 ? 0.58 : 0.30,
        );
      }
      softDisk(ctx, r * 0.35, 0, r * 0.12, '#ffffff', 0.78);
    }
    // Railspike — long tip streak (discrete bolt, not continuous laser body)
    if (holdSpike) {
      softStreak(ctx, r * 0.4, 0, r * 3.2, r * 0.11, core, 0.88);
      softStreak(ctx, -r * 1.25, 0, r * 2.1, r * 0.08, glow, 0.4);
    }
    ctx.globalCompositeOperation = prev;
  }

  // Hold / charge shots — per-identity tip cloud (not one shared mote ring).
  if (b.charge || (b.special && b.specialLevel >= 2)) {
    const n = b.specialLevel >= 3 ? 7 : 5;
    ctx.globalCompositeOperation = 'lighter';
    if (style === 'plasmaslash') {
      // Crescent tip — tall magenta plate chips (≠ forward-aligned laser needles)
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        softDisk(
          ctx,
          (moteRand(b.phase, i, 21) - 0.5) * r * 0.28,
          side * r * (0.42 + i * 0.16),
          r * (0.14 + moteRand(b.phase, i, 22) * 0.18),
          i % 2 ? core : glow,
          0.38,
        );
      }
    } else if (style === 'sunbird') {
      // Phoenix tip — rising wing chips (Hirume HOLD)
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        softDisk(
          ctx,
          -r * (0.12 + i * 0.14),
          s * r * (0.52 + i * 0.20),
          r * (0.15 + moteRand(b.phase, i, 18) * 0.22),
          i % 2 ? '#fff8e8' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softDisk(ctx, -r * 0.28, s * r * 0.92, r * 0.20, core, 0.28);
        }
      }
    } else if (style === 'flameward') {
      // Napalm tip — falling ember chips (≠ phoenix wings)
      for (let i = 0; i < n; i++) {
        softDisk(
          ctx,
          (moteRand(b.phase, i, 21) - 0.5) * r * 0.7,
          -r * (0.28 + i * 0.22),
          r * (0.18 + moteRand(b.phase, i, 22) * 0.22),
          i % 2 ? '#fff2c8' : glow,
          0.36,
        );
      }
    } else if (style === 'railbolt') {
      for (let i = 0; i < n; i++) {
        softStreak(ctx, -i * r * 0.55, (moteRand(b.phase, i, 21) - 0.5) * r * 0.12,
          r * 1.05, r * 0.1, i % 2 ? core : glow, 0.46);
      }
    } else if (style === 'sightbeam') {
      // Lance tip — aligned thin needles (≠ HMG side grit)
      for (let i = 0; i < n; i++) {
        softStreak(ctx, -i * r * 0.38, (moteRand(b.phase, i, 21) - 0.5) * r * 0.1,
          r * 0.85, r * 0.1, i % 2 ? core : glow, 0.42);
      }
    } else if (style === 'coffinround') {
      // HMG tip — short wide tracer spray, cream tip → violet cool (≠ solid laser tint)
      for (let i = 0; i < n; i++) {
        softStreak(ctx, -i * r * 0.18, (moteRand(b.phase, i, 21) - 0.5) * r * 0.58,
          r * 0.36, r * 0.12, i % 2 ? '#fff8f0' : glow, 0.32);
        if (i % 2 === 0) {
          softDisk(ctx, -i * r * 0.12, (moteRand(b.phase, i, 33) - 0.5) * r * 0.42,
            r * 0.14, core, 0.28);
        }
      }
    } else if (style === 'coffinwall' || style === 'coffinshield') {
      // Ward tip — tall plate chips (≠ HMG lateral spray, ≠ lance needles)
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        softDisk(
          ctx,
          (moteRand(b.phase, i, 21) - 0.5) * r * 0.32,
          s * r * (0.42 + i * 0.16),
          r * (0.16 + moteRand(b.phase, i, 22) * 0.2),
          i % 2 ? core : glow,
          0.36,
        );
      }
    } else if (style === 'shell') {
      // Artillery tip — falling ash, cream tip → ash cool (≠ solid bolt tint, ≠ HMG spray)
      for (let i = 0; i < n; i++) {
        softDisk(
          ctx,
          (moteRand(b.phase, i, 21) - 0.5) * r * 0.62,
          -r * (0.42 + i * 0.32),
          r * (0.18 + moteRand(b.phase, i, 22) * 0.22),
          i % 2 ? '#fff8e8' : glow,
          0.34,
        );
        if (i % 2 === 0) {
          softDisk(ctx, (moteRand(b.phase, i, 30) - 0.5) * r * 0.4, -r * (0.85 + i * 0.22),
            r * 0.22, '#6a8098', 0.22);
        }
      }
    } else if (style === 'jupiterorb') {
      // Storm tip — wide field spark chips (≠ seeker orbit ring, ≠ HMG lateral spray)
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        softDisk(
          ctx,
          (moteRand(b.phase, i, 21) - 0.5) * r * 1.05,
          s * r * (0.22 + i * 0.12),
          r * (0.14 + moteRand(b.phase, i, 22) * 0.18),
          i % 2 ? '#ffffff' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softStreak(ctx, (moteRand(b.phase, i, 23) - 0.5) * r * 0.4, s * r * 0.35,
            r * 0.72, r * 0.1, core, 0.34);
        }
      }
    } else if (style === 'empfield') {
      // EMP tip — radial pulse spokes, white tip → cyan cool (≠ seeker orbit ring, ≠ storm field)
      for (let i = 0; i < n; i++) {
        const a = b.age * 5 + b.phase + i * ((Math.PI * 2) / n);
        softStreak(
          ctx,
          Math.cos(a) * r * 0.18,
          Math.sin(a) * r * 0.18,
          r * (0.72 + moteRand(b.phase, i, 21) * 0.4),
          r * 0.10,
          i % 2 ? '#ffffff' : glow,
          0.38,
        );
        if (i % 2 === 0) {
          softDisk(
            ctx,
            Math.cos(a) * r * 0.72,
            Math.sin(a) * r * 0.72,
            r * (0.12 + moteRand(b.phase, i, 22) * 0.14),
            core,
            0.32,
          );
        }
      }
    } else if (style === 'xenoxcore') {
      // Xenox tip — split fragment chips, ice tip → rail cyan cool
      // (≠ seeker orbit ring, ≠ EMP radial spokes, ≠ continuous railbeam needles).
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        softDisk(
          ctx,
          -r * (0.06 + i * 0.14),
          s * r * (0.38 + i * 0.16),
          r * (0.14 + moteRand(b.phase, i, 21) * 0.18),
          i % 2 ? '#ffffff' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softStreak(ctx, -r * 0.18, s * r * 0.62, r * 0.78, r * 0.11, core, 0.34);
        }
      }
    } else if (style === 'coffinmissile') {
      // RIP coffin tip — tall lid plate chips, cream tip → violet cool
      // (≠ seeker orbit ring, ≠ HMG lateral spray, ≠ stationary ward tip).
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        softDisk(
          ctx,
          (moteRand(b.phase, i, 21) - 0.5) * r * 0.28,
          s * r * (0.40 + i * 0.16),
          r * (0.15 + moteRand(b.phase, i, 22) * 0.18),
          i % 2 ? '#fff8f0' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softDisk(ctx, -r * 0.12, s * r * 0.72, r * 0.18, core, 0.30);
        }
      }
    } else if (style === 'lockround') {
      // Winchester lock tip — soft collar chips, cream tip → brass cool
      // (≠ seeker orbit ring, ≠ continuous overwatch lance needles).
      for (let i = 0; i < n; i++) {
        const a = b.age * 6 + b.phase + i * ((Math.PI * 2) / n);
        softDisk(
          ctx,
          Math.cos(a) * r * 0.68,
          Math.sin(a) * r * 0.68,
          r * (0.12 + moteRand(b.phase, i, 21) * 0.16),
          i % 2 ? '#fff8e8' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softDisk(ctx, Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, r * 0.14, core, 0.30);
        }
      }
    } else if (style === 'commandmissile') {
      // Command marker tip — designation ring chips, cream tip → ash cool
      // (≠ seeker orbit ring, ≠ shell falling ash tip, ≠ parked bolt bloom).
      for (let i = 0; i < n; i++) {
        const a = b.age * 5 + b.phase + i * ((Math.PI * 2) / n);
        softDisk(
          ctx,
          Math.cos(a) * r * 0.72,
          Math.sin(a) * r * 0.72,
          r * (0.13 + moteRand(b.phase, i, 21) * 0.16),
          i % 2 ? '#fff0d0' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softDisk(
            ctx,
            (moteRand(b.phase, i, 22) - 0.5) * r * 0.28,
            r * (0.55 + i * 0.12),
            r * 0.14,
            '#8aa0b4',
            0.28,
          );
        }
      }
    } else if (style === 'plasmacross') {
      // Cross-cut tip — soft diagonal chips, cream tip → magenta cool
      // (≠ seeker orbit ring, ≠ crescent tall plate chips, ≠ hard cross mark).
      for (let i = 0; i < n; i++) {
        const diag = i % 2 ? 1 : -1;
        const flip = i % 3 === 0 ? -1 : 1;
        softDisk(
          ctx,
          diag * r * (0.30 + i * 0.10),
          diag * flip * r * (0.30 + i * 0.10),
          r * (0.14 + moteRand(b.phase, i, 21) * 0.18),
          i % 2 ? '#fff4fc' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softStreak(
            ctx,
            -r * 0.10,
            diag * r * 0.52,
            r * 0.72,
            r * 0.11,
            core,
            0.34,
          );
        }
      }
    } else if (style === 'sunseal') {
      // Purification seal tip — soft ring chips, cream tip → orange cool
      // (≠ seeker orbit ring, ≠ phoenix rising wing chips, ≠ EMP cyan spokes).
      for (let i = 0; i < n; i++) {
        const a = b.age * 5 + b.phase + i * ((Math.PI * 2) / n);
        softDisk(
          ctx,
          Math.cos(a) * r * 0.74,
          Math.sin(a) * r * 0.74,
          r * (0.13 + moteRand(b.phase, i, 21) * 0.16),
          i % 2 ? '#fff8e0' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softDisk(
            ctx,
            Math.cos(a) * r * 0.40,
            Math.sin(a) * r * 0.40,
            r * 0.14,
            core,
            0.30,
          );
        }
      }
    } else if (style === 'dragonaxe') {
      // Axe tip — tumble blade chips, cream tip → rose cool (≠ seeker orbit ring)
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        softDisk(
          ctx,
          -r * (0.08 + i * 0.12),
          s * r * (0.48 + i * 0.18),
          r * (0.16 + moteRand(b.phase, i, 18) * 0.22),
          i % 2 ? '#fff0f4' : glow,
          0.36,
        );
        if (i % 2 === 0) {
          softStreak(ctx, -r * 0.2, s * r * 0.72, r * 0.85, r * 0.22, core, 0.34);
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = b.age * 8 + b.phase + i * 1.7;
        const rad = r * (0.45 + moteRand(b.phase, i, 13) * 1.05);
        const sz = r * (0.1 + moteRand(b.phase, i, 18) * 0.18);
        softDisk(ctx, Math.cos(a) * rad * 0.35, Math.sin(a) * rad * 0.35, sz, i % 2 ? core : glow, 0.32);
      }
    }
    ctx.globalCompositeOperation = prev;
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
  ctx.restore();
}
