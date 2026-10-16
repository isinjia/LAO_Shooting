import { H } from './canvas.js';
import { drawSheetAt, drawCell } from './run-fx.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
// Leader area attacks (not bullets): lasers, lightning bolts, meteors / shells, ground
// spikes. Each hazard warns first (thin line / target ring), then is live for `life` s,
// then fades. Owned by the leader (e.hazards), ticked in Enemy.update, drawn with the
// leader, and tested against the player in Game._collisions (hazardHits).
//
// kinds:
//   beam   { x, y, ang, len, width, warn, life, spin, follow }   laser from (x, y)
//   bolt   { x0, y0, x1, y1, width, warn, life }                  lightning along a line
//   meteor { x, y, r, warn, life, fx, fy }                        falls from (fx, fy), blasts r
//   spike  { x, y, r, warn, life }                                erupts from the ground
//   cone   { x, y, ang, half, len, spin, follow }                 flame cone (Nidhogg)
//   column { x, w, top }                                          rock column from the floor
//   sigil  { x, y, r }                                            rune circle that erupts
//   bolt styles: 'girder' (steel beam), 'tape' (barricade line), 'swoop' (wing shadow)

const FADE = 0.22;

export function addHazard(e, h) {
  h.t = 0;
  h.life ??= 0.3;
  h.warn ??= 0.6;
  (e.hazards ||= []).push(h);
  return h;
}

/** Advance hazards; beams that follow ride the leader, spinning beams turn while live. */
/** Game hook: (h) => spawn impact particles the frame a hazard goes live. */
let onImpact = null;
export function setHazardImpact(fn) {
  onImpact = fn;
}
/** Game hook: (h, 'start' | 'late') = the hazard appeared / is 0.35 s from going live. */
let onCue = null;
export function setHazardCue(fn) {
  onCue = fn;
}

export function tickHazards(e, dt) {
  const list = e.hazards;
  if (!list?.length) return;
  for (const h of list) {
    const was = h.t;
    h.t += dt;
    if (onCue) {
      if (was === 0) onCue(h, 'start');
      const late = Math.max(0, h.warn - 0.35);
      if (was < late && h.t >= late) onCue(h, 'late');
    }
    if (was < h.warn && h.t >= h.warn && onImpact) onImpact(h);
    if (h.kind === 'beam' || h.kind === 'cone') {
      if (h.follow) { h.x = e.x - (h.kind === 'cone' ? 30 : 20); h.y = e.y; }
      if (h.spin && h.t > h.warn) h.ang += h.spin * dt;
    }
  }
  e.hazards = list.filter((h) => h.t < h.warn + h.life + FADE);
}

export function hazardLive(h) {
  return h.t >= h.warn && h.t < h.warn + h.life;
}

function segDist2(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
  const qx = x0 + dx * u - px;
  const qy = y0 + dy * u - py;
  return qx * qx + qy * qy;
}

/** Point (x, y) with radius r inside a hazard's live area. */
export function hazardHits(h, x, y, r) {
  if (!hazardLive(h)) return false;
  if (h.kind === 'beam') {
    const len = h.len ?? 1400;
    const x1 = h.x + Math.cos(h.ang) * len;
    const y1 = h.y + Math.sin(h.ang) * len;
    const w = h.width / 2 + r * 0.6;
    return segDist2(x, y, h.x, h.y, x1, y1) < w * w;
  }
  if (h.kind === 'bolt') {
    const w = h.width / 2 + r * 0.6;
    return segDist2(x, y, h.x0, h.y0, h.x1, h.y1) < w * w;
  }
  if (h.kind === 'cone') {
    const dx = x - h.x;
    const dy = y - h.y;
    const d = Math.hypot(dx, dy);
    if (d > h.len + r) return false;
    let da = Math.atan2(dy, dx) - h.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    return Math.abs(da) < h.half + Math.atan2(r, Math.max(1, d));
  }
  if (h.kind === 'column') {
    return Math.abs(x - h.x) < h.w / 2 + r * 0.6 && y > h.top - r * 0.6;
  }
  const rr = h.r + r * 0.5;
  return (x - h.x) ** 2 + (y - h.y) ** 2 < rr * rr;
}

/** Danger estimate for bots / tools: warning or live area at (x, y). */
export function hazardCovers(h, x, y, pad = 0) {
  const t = h.t;
  h.t = Math.max(h.t, h.warn);
  const hit = h.t < h.warn + h.life && hazardHits(h, x, y, pad);
  h.t = t;
  return hit;
}

// ---------------------------------------------------------------- drawing

function beamEnd(h) {
  const len = h.len ?? 1400;
  return [h.x + Math.cos(h.ang) * len, h.y + Math.sin(h.ang) * len];
}

function drawBeam(ctx, h) {
  const [x1, y1] = beamEnd(h);
  if (h.t < h.warn) {
    // Aim line: thin, flickering, a faint band showing the beam's width.
    const k = h.t / h.warn;
    ctx.globalAlpha = 0.08 + 0.1 * k;
    ctx.strokeStyle = h.color;
    ctx.lineWidth = h.width;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalAlpha = 0.35 + 0.45 * k * (0.6 + 0.4 * Math.sin(h.t * 40));
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(x1, y1); ctx.stroke();
    // Charge ball at the muzzle.
    ctx.globalAlpha = 0.5 + 0.5 * k;
    ctx.fillStyle = h.color;
    ctx.beginPath(); ctx.arc(h.x, h.y, 4 + h.width * 0.45 * k, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const live = h.t - h.warn;
  const fade = live > h.life ? 1 - (live - h.life) / FADE : Math.min(1, live / 0.06);
  const w = h.width * (0.85 + 0.15 * Math.sin(h.t * 50)) * Math.max(0.2, fade);
  ctx.lineCap = 'round';
  ctx.strokeStyle = h.color;
  ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(x1, y1);
  ctx.globalAlpha = 0.1 * fade;
  ctx.lineWidth = w * 4.2;
  ctx.stroke();
  ctx.globalAlpha = 0.16 * fade;
  ctx.lineWidth = w * 2.8;
  ctx.stroke();
  ctx.globalAlpha = 0.28 * fade;
  ctx.lineWidth = w * 1.8;
  ctx.stroke();
  ctx.globalAlpha = 0.75 * fade;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.globalAlpha = 0.95 * fade;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, w * 0.38);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(h.x, h.y, w * 0.75, 0, Math.PI * 2); ctx.fill();
}

function jagged(ctx, x0, y0, x1, y1, amp, seed, segPx = 26) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const n = Math.max(4, Math.round(len / segPx));
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) {
    const u = i / n;
    // Cheap per-frame noise in [-1, 1] (re-rolled every frame = crackling).
    const o = hash01(i, seed) * 2 - 1;
    ctx.lineTo(x0 + dx * u + nx * o * amp, y0 + dy * u + ny * o * amp);
  }
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function drawBolt(ctx, h) {
  if (h.style) return drawStyledBolt(ctx, h);
  if (h.t < h.warn) {
    const k = h.t / h.warn;
    ctx.globalAlpha = 0.1 + 0.12 * k;
    ctx.strokeStyle = h.color;
    ctx.lineWidth = h.width;
    ctx.beginPath(); ctx.moveTo(h.x0, h.y0); ctx.lineTo(h.x1, h.y1); ctx.stroke();
    ctx.globalAlpha = 0.3 + 0.5 * k * (0.5 + 0.5 * Math.sin(h.t * 34));
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Static charge gathering at both ends.
    ctx.globalAlpha = 0.25 + 0.5 * k;
    for (const [x, y] of [[h.x0, h.y0], [h.x1, h.y1]]) {
      ctx.drawImage(auraSprite(h.color), x - 26, y - 26, 52, 52);
    }
    return;
  }
  const live = h.t - h.warn;
  const fade = Math.max(0, live > h.life ? 1 - (live - h.life) / FADE : 1);
  const strike = Math.max(0, 1 - live / 0.1); // first 0.1 s: the strike flash
  const seed = Math.floor(h.t * 30) + h.x0 * 0.13;
  const dx = h.x1 - h.x0;
  const dy = h.y1 - h.y0;
  const len = Math.hypot(dx, dy) || 1;
  // Soft glow channel: aura stamps along the line (no shadowBlur: cheap on phones).
  ctx.globalAlpha = (0.35 + 0.4 * strike) * fade;
  const glowR = h.width * 2.2;
  for (let d = 0; d <= len; d += glowR * 0.8) {
    const u = d / len;
    ctx.drawImage(auraSprite(h.color), h.x0 + dx * u - glowR, h.y0 + dy * u - glowR, glowR * 2, glowR * 2);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Two independent strands (re-rolled 30x/s = crackle), coloured body + white-hot core.
  for (let strand = 0; strand < 2; strand++) {
    const sd = seed + strand * 17.3;
    const amp = h.width * (strand ? 1.1 : 0.75);
    ctx.globalAlpha = (strand ? 0.55 : 0.9) * fade;
    ctx.strokeStyle = h.color;
    ctx.lineWidth = h.width * (strand ? 0.3 : 0.5);
    jagged(ctx, h.x0, h.y0, h.x1, h.y1, amp, sd, 14);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = strand ? 1.2 : 2.4;
    jagged(ctx, h.x0, h.y0, h.x1, h.y1, amp, sd, 14);
  }
  // Forks off random points, re-rolled with the crackle.
  ctx.globalAlpha = 0.6 * fade;
  ctx.strokeStyle = h.color;
  ctx.lineWidth = 1.4;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 0; i < 4; i++) {
    const u = 0.15 + 0.7 * hash01(i, seed);
    const side = hash01(i + 9, seed) < 0.5 ? -1 : 1;
    const fl = 30 + 50 * hash01(i + 3, seed);
    const fx = h.x0 + dx * u;
    const fy = h.y0 + dy * u;
    jagged(ctx, fx, fy, fx + nx * side * fl + dx / len * fl * 0.6, fy + ny * side * fl + dy / len * fl * 0.6, 8, seed + i, 10);
  }
  // Original spark sheet at both ends, tinted to the bolt.
  const spark = tinted('lao-fx-spark', h.color);
  if (spark) {
    const fr = Math.min(3, Math.floor((live / (h.life + FADE)) * 4));
    ctx.globalAlpha = fade;
    for (const [x, y] of [[h.x0, h.y0], [h.x1, h.y1]]) {
      drawCell(ctx, spark, 4, 64, 128, fr, x, y, h.width * 3, h.width * 6);
    }
  }
  if (strike > 0) {
    ctx.globalAlpha = strike * 0.8;
    ctx.drawImage(auraSprite('#ffffff'), h.x1 - 60, h.y1 - 60, 120, 120);
  }
}

/** Meteor position along its fall at warn progress k (eased in: it accelerates). */
function meteorAt(h, k) {
  const u = k * k;
  return [h.fx + (h.x - h.fx) * u, h.fy + (h.y - h.fy) * u];
}

function drawMeteor(ctx, h) {
  if (h.t < h.warn) {
    const k = h.t / h.warn;
    const hot = k > 0.72 ? (k - 0.72) / 0.28 : 0; // last stretch: the marker heats to white
    // Target marker: soft heat pool, the meteor's growing shadow, a rotating dashed lock
    // ring and four chevrons closing in on the impact point.
    ctx.globalAlpha = (0.18 + 0.32 * k) * (0.8 + 0.2 * Math.sin(h.t * 22));
    ctx.drawImage(auraSprite(h.color), h.x - h.r * 1.5, h.y - h.r * 1.5, h.r * 3, h.r * 3);
    if (hot > 0) {
      ctx.globalAlpha = 0.5 * hot;
      ctx.drawImage(auraSprite('#ffffff'), h.x - h.r * 0.8, h.y - h.r * 0.8, h.r * 1.6, h.r * 1.6);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.18 + 0.22 * k;
    ctx.fillStyle = '#05030a';
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.25 + 0.6 * k), 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + 0.4 * k;
    ctx.strokeStyle = hot > 0.5 ? '#ffffff' : h.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([h.r * 0.42, h.r * 0.2]);
    ctx.lineDashOffset = -h.t * 60;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (1.35 - 0.35 * k), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.35 + 0.3 * k;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = h.color2 || h.color;
    ctx.globalAlpha = 0.6 + 0.4 * k;
    const cd = h.r * (1.9 - 1.0 * k);
    const cs = h.r * 0.22;
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 + Math.PI / 4 + h.t * 1.5;
      const cx = h.x + Math.cos(a) * cd;
      const cy = h.y + Math.sin(a) * cd;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a + 2.4) * cs, cy + Math.sin(a + 2.4) * cs);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - 2.4) * cs, cy + Math.sin(a - 2.4) * cs);
      ctx.stroke();
    }
    // The meteor: the original fire sheet as a comet rotated along the fall, with a fading
    // ember / smoke wake sampled from earlier points of the same path.
    const ang = Math.atan2(h.y - h.fy, h.x - h.fx);
    const rot = ang + Math.PI * 0.75; // the sheet's flame trails toward its lower-left
    const size = h.r * 2.3;
    const [mx, my] = meteorAt(h, k);
    // Continuous tapered heat streak back along the path (last ~0.16 s of travel).
    const [bx, by] = meteorAt(h, Math.max(0, (h.t - 0.16) / h.warn));
    const len = Math.hypot(mx - bx, my - by);
    if (len > 4) {
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.atan2(by - my, bx - mx));
      const grd = ctx.createLinearGradient(0, 0, len * 1.3, 0);
      grd.addColorStop(0, 'rgba(255,240,200,0.9)');
      grd.addColorStop(0.25, h.color);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = grd;
      const w = h.r * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -w); ctx.quadraticCurveTo(len * 0.6, -w * 0.5, len * 1.3, 0);
      ctx.quadraticCurveTo(len * 0.6, w * 0.5, 0, w);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Ember / smoke wake: dense, shrinking samples from earlier points of the same path.
    for (let i = 8; i >= 1; i--) {
      const kk = (h.t - i * 0.024) / h.warn;
      if (kk <= 0) continue;
      const [tx, ty] = meteorAt(h, kk);
      const fade = 1 - i / 9;
      const ss = size * (0.55 + i * 0.09);
      drawSheetAt(ctx, 'lao-fx-smog', (0.3 + i * 0.06) % 1, tx, ty, ss, ss,
        { blend: 'source-over', alpha: 0.16 * fade, rot: h.t * 2 + i });
      const fs = size * (0.95 - i * 0.08);
      drawSheetAt(ctx, 'lao-fx-fireball', (h.t * 2.2 + i * 0.07) % 0.5, tx, ty, fs, fs, { alpha: 0.38 * fade, rot });
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(auraSprite(h.color), mx - h.r * 1.4, my - h.r * 1.4, h.r * 2.8, h.r * 2.8);
    drawSheetAt(ctx, 'lao-fx-fireball', (h.t * 2.2) % 0.5, mx, my, size, size, { alpha: 1, rot });
    ctx.globalAlpha = 0.9;
    ctx.drawImage(auraSprite('#fff4d6'), mx - h.r * 0.45, my - h.r * 0.45, h.r * 0.9, h.r * 0.9);
    return;
  }
  // Impact: a white-hot flash and a heat pool; the textured blast (air burst, flame plume,
  // shock ring, smog) is spawned by Game._hazardImpact and outlives the hazard.
  const live = h.t - h.warn;
  const k = Math.min(1, live / (h.life + FADE));
  ctx.globalAlpha = Math.max(0, 1 - live / 0.12);
  ctx.drawImage(auraSprite('#ffffff'), h.x - h.r * 1.6, h.y - h.r * 1.6, h.r * 3.2, h.r * 3.2);
  ctx.globalAlpha = 0.7 * (1 - k);
  ctx.drawImage(auraSprite(h.color), h.x - h.r * 2, h.y - h.r * 2, h.r * 4, h.r * 4);
}

/** Stable pseudo-random in [0, 1) for particle i of a hazard. */
function hash01(i, salt = 0) {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Original texture recoloured to `color` (alpha kept), cached per key + colour. */
const _tints = new Map();
function tinted(key, color) {
  const img = getNativeWeaponImage(key);
  if (!img || !(img.naturalWidth || img.width)) return null;
  const id = `${key}|${color}`;
  let c = _tints.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.7;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  _tints.set(id, c);
  return c;
}

/** Soft radial aura per colour (baked once). */
const _auras = new Map();
function auraSprite(color) {
  let c = _auras.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, color);
  grd.addColorStop(0.45, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.5;
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _auras.set(color, c);
  return c;
}

/** Additive soft halo + white core streak under a solid hazard while it is live. */
function liveGlow(ctx, h, x, y, rx, ry) {
  const live = h.t - h.warn;
  if (live < 0) return;
  const k = live > h.life ? Math.max(0, 1 - (live - h.life) / FADE) : Math.min(1, live / 0.05);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9 * k;
  ctx.drawImage(auraSprite(h.color), x - rx * 2, y - ry * 2, rx * 4, ry * 4);
  ctx.globalAlpha = 0.85 * k;
  ctx.drawImage(auraSprite('#ffffff'), x - rx * 0.5, y - ry * 0.5, rx, ry);
  ctx.restore();
}

function drawSpike(ctx, h) {
  if (h.t < h.warn) {
    const k = h.t / h.warn;
    // Frost spreading over the spot: cold glow, crack lines growing out, glints.
    ctx.globalAlpha = 0.25 + 0.35 * k;
    ctx.drawImage(auraSprite(h.color), h.x - h.r * 1.3, h.y - h.r * 0.7, h.r * 2.6, h.r * 1.4);
    ctx.globalAlpha = 0.55 + 0.4 * k;
    ctx.strokeStyle = h.color2 || '#e8fbff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + hash01(i, h.x) * 0.6;
      const l = h.r * k * (0.6 + 0.5 * hash01(i, h.y));
      const mx = h.x + Math.cos(a) * l * 0.5;
      const my = h.y + Math.sin(a) * l * 0.28;
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(mx + Math.sin(a) * 4, my);
      ctx.lineTo(h.x + Math.cos(a) * l, h.y + Math.sin(a) * l * 0.55);
    }
    ctx.stroke();
    ctx.globalAlpha = k * (0.5 + 0.5 * Math.sin(h.t * 40));
    ctx.drawImage(auraSprite('#ffffff'), h.x - 8, h.y - 8, 16, 16);
    return;
  }
  liveGlow(ctx, h, h.x, h.y, h.r * 1.4, h.r * 0.7);
  const live = h.t - h.warn;
  const rise = Math.min(1, live / 0.08);
  const fade = Math.max(0, live > h.life ? 1 - (live - h.life) / FADE : 1);
  const tall = h.r * 2.8 * rise;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = fade;
  // Ice crystals: faceted shards (lit face / shadow face), white edges, leaning outward.
  for (let i = -2; i <= 2; i++) {
    const bx = h.x + i * h.r * 0.36;
    const ht = tall * (1 - Math.abs(i) * 0.2) * (0.85 + 0.3 * hash01(i + 3, h.x));
    const lean = i * h.r * 0.12;
    const hw = h.r * (0.2 + 0.06 * hash01(i + 5, h.y));
    const by = h.y + h.r * 0.3;
    const tx = bx + lean;
    const ty = by - ht;
    const lit = ctx.createLinearGradient(tx, ty, bx, by);
    lit.addColorStop(0, '#ffffff');
    lit.addColorStop(0.35, h.color2 || '#d8f8ff');
    lit.addColorStop(1, h.color);
    ctx.fillStyle = lit;
    ctx.beginPath(); ctx.moveTo(bx - hw, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + hw * 0.1, by); ctx.closePath(); ctx.fill();
    const dark = ctx.createLinearGradient(tx, ty, bx, by);
    dark.addColorStop(0, h.color2 || '#d8f8ff');
    dark.addColorStop(1, 'rgba(20,60,110,0.95)');
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(bx + hw * 0.1, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + hw, by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx - hw, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + hw, by); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  // Glints on the tips.
  ctx.globalAlpha = fade * (0.6 + 0.4 * Math.sin(h.t * 30));
  ctx.drawImage(auraSprite('#ffffff'), h.x - 10, h.y + h.r * 0.3 - tall - 10, 20, 20);
}

export function drawHazards(ctx, e) {
  const list = e.hazards;
  if (!list?.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const h of list) {
    ctx.save();
    if (h.kind === 'beam') drawBeam(ctx, h);
    else if (h.kind === 'bolt') drawBolt(ctx, h);
    else if (h.kind === 'meteor') drawMeteor(ctx, h);
    else if (h.kind === 'cone') drawCone(ctx, h);
    else if (h.kind === 'sigil') drawSigil(ctx, h);
    else if (h.kind === 'column') {
      ctx.globalCompositeOperation = 'source-over';
      drawColumn(ctx, h);
    } else if (h.kind === 'spike') {
      ctx.globalCompositeOperation = 'source-over';
      drawSpike(ctx, h);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---- styled bolts / new kinds ----

function lineWarn(ctx, h, dash) {
  const k = h.t / h.warn;
  ctx.globalAlpha = 0.1 + 0.14 * k;
  ctx.strokeStyle = h.color;
  ctx.lineWidth = h.width;
  ctx.beginPath(); ctx.moveTo(h.x0, h.y0); ctx.lineTo(h.x1, h.y1); ctx.stroke();
  ctx.globalAlpha = 0.35 + 0.5 * k * (0.5 + 0.5 * Math.sin(h.t * 30));
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawStyledBolt(ctx, h) {
  const vertical = Math.abs(h.x1 - h.x0) < Math.abs(h.y1 - h.y0);
  if (h.t < h.warn) {
    lineWarn(ctx, h, h.style === 'tape' ? [18, 10] : [6, 6]);
    return;
  }
  const live = h.t - h.warn;
  const fade = live > h.life ? Math.max(0, 1 - (live - h.life) / FADE) : 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = fade;
  const w = h.width;
  if (h.style === 'girder' || h.style === 'tape') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12 * fade;
    ctx.strokeStyle = h.color || '#ffd24a';
    ctx.lineWidth = w * 3.6;
    ctx.beginPath(); ctx.moveTo(h.x0, h.y0); ctx.lineTo(h.x1, h.y1); ctx.stroke();
    ctx.globalAlpha = 0.3 * fade;
    ctx.lineWidth = w * 2.2;
    ctx.beginPath(); ctx.moveTo(h.x0, h.y0); ctx.lineTo(h.x1, h.y1); ctx.stroke();
    ctx.globalAlpha = 0.6 * fade;
    ctx.strokeStyle = '#fff6d0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (h.style === 'girder') liveGlow(ctx, h, h.x0, h.y1 - 14, w * 1.4, w * 0.6);
  }
  if (h.style === 'girder') {
    // Steel beam dropping from the top: grey I-beam with yellow/black ends.
    const drop = Math.min(1, live / 0.12);
    const yEnd = h.y0 + (h.y1 - h.y0) * drop;
    ctx.fillStyle = '#6d7480';
    ctx.fillRect(h.x0 - w / 2, h.y0, w, yEnd - h.y0);
    ctx.fillStyle = '#9aa3b0';
    ctx.fillRect(h.x0 - w / 2, h.y0, 5, yEnd - h.y0);
    ctx.fillRect(h.x0 + w / 2 - 5, h.y0, 5, yEnd - h.y0);
    ctx.fillStyle = h.color || '#ffd24a';
    for (let y = yEnd - 26; y > yEnd - 80 && y > h.y0; y -= 26) {
      ctx.fillRect(h.x0 - w / 2, y, w, 12);
    }
    return;
  }
  if (h.style === 'tape') {
    // Barricade tape: yellow/black diagonal stripes across the lane.
    const len = Math.hypot(h.x1 - h.x0, h.y1 - h.y0);
    ctx.save();
    ctx.translate(h.x0, h.y0);
    ctx.rotate(Math.atan2(h.y1 - h.y0, h.x1 - h.x0));
    ctx.fillStyle = h.color || '#ffd24a';
    ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = '#1a1a1a';
    for (let x = 0; x < len; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, -w / 2); ctx.lineTo(x + 16, -w / 2); ctx.lineTo(x + 6, w / 2); ctx.lineTo(x - 10, w / 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    return;
  }
  // swoop: a dark wing shadow with a bright leading edge, sweeping right -> left.
  const u = Math.min(1, live / Math.max(0.05, h.life));
  const lead = vertical ? 0 : (h.x1 - (h.x1 - h.x0) * u);
  const grd = ctx.createLinearGradient(lead, 0, h.x1, 0);
  grd.addColorStop(0, h.color2 || '#fff4c8');
  grd.addColorStop(0.08, h.color || '#ffd24a');
  grd.addColorStop(1, 'rgba(40, 30, 10, 0.15)');
  ctx.fillStyle = grd;
  ctx.globalAlpha = 0.8 * fade;
  ctx.beginPath();
  ctx.ellipse((lead + h.x1) / 2, h.y0, Math.max(1, (h.x1 - lead) / 2), w / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = h.color || '#ffd24a';
  ctx.globalAlpha = 0.55 * fade;
  ctx.beginPath();
  ctx.ellipse(lead + 60, h.y0, 70, w * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9 * fade;
  ctx.beginPath();
  ctx.ellipse(lead + 26, h.y0, 30, w * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCone(ctx, h) {
  const a0 = h.ang - h.half;
  const a1 = h.ang + h.half;
  if (h.t < h.warn) {
    const k = h.t / h.warn;
    ctx.globalAlpha = 0.08 + 0.12 * k;
    ctx.fillStyle = h.color;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.arc(h.x, h.y, h.len, a0, a1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.4 + 0.4 * k;
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -h.t * 80;
    ctx.stroke();
    ctx.setLineDash([]);
    // Fire gathering in the mouth.
    const g = 30 + 50 * k;
    ctx.globalAlpha = 0.5 + 0.5 * k;
    ctx.drawImage(auraSprite(h.color), h.x - g, h.y - g, g * 2, g * 2);
    ctx.globalAlpha = k;
    ctx.drawImage(auraSprite('#fff2c8'), h.x - g * 0.4, h.y - g * 0.4, g * 0.8, g * 0.8);
    return;
  }
  const live = h.t - h.warn;
  const fade = live > h.life ? Math.max(0, 1 - (live - h.life) / FADE) : 1;
  const grow = Math.min(1, live / 0.18); // the stream reaches out over 0.18 s
  // Heat body under the flames (soft, low alpha).
  const grd = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, h.len);
  grd.addColorStop(0, 'rgba(255,250,230,0.9)');
  grd.addColorStop(0.2, h.color2 || '#ffd24a');
  grd.addColorStop(0.6, h.color || '#ff7a2a');
  grd.addColorStop(1, 'rgba(255, 60, 20, 0)');
  ctx.globalAlpha = 0.38 * fade;
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.arc(h.x, h.y, h.len * grow, a0, a1); ctx.closePath(); ctx.fill();
  // Smoke rolling off the far half (source-over, dark).
  const dust = getNativeWeaponImage('lao-fx-dust');
  if (dust) {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const ph = (h.t * 0.9 + hash01(i, 5)) % 1;
      const d = h.len * (0.45 + 0.55 * ph) * grow;
      const a = h.ang + (hash01(i, 7) * 2 - 1) * h.half * 1.1;
      const sz = 60 + d * 0.35;
      ctx.globalAlpha = 0.28 * Math.sin(ph * Math.PI) * fade;
      ctx.drawImage(dust, h.x + Math.cos(a) * d - sz / 2, h.y + Math.sin(a) * d - sz / 2, sz, sz);
    }
    ctx.globalCompositeOperation = 'lighter';
  }
  // The flames: original fire sheet particles streaming out of the mouth, growing and
  // burning out with distance.
  const rot = h.ang + Math.PI * 0.75;
  for (let i = 0; i < 28; i++) {
    const ph = (h.t * 1.7 + hash01(i, 1)) % 1;
    const d = h.len * ph * grow;
    const wob = Math.sin(h.t * 9 + i) * 0.25;
    const a = h.ang + (hash01(i, 2) * 2 - 1 + wob * ph) * h.half * 0.9;
    const sz = 34 + d * 0.42;
    drawSheetAt(ctx, 'lao-fx-fireball', Math.min(0.99, ph * 0.9), h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, sz, sz,
      { alpha: fade * Math.min(1, (1 - ph) * 1.6), rot: rot + wob });
  }
  // Fast flame streaks along the stream.
  const line = getNativeWeaponImage('lao-fx-fireline');
  if (line) {
    for (let i = 0; i < 6; i++) {
      const ph = (h.t * 2.6 + hash01(i, 3)) % 1;
      const d = h.len * ph * grow;
      const a = h.ang + (hash01(i, 4) * 2 - 1) * h.half * 0.7;
      const l = 120 + 140 * hash01(i, 6);
      ctx.save();
      ctx.translate(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d);
      ctx.rotate(a);
      ctx.globalAlpha = 0.8 * Math.sin(ph * Math.PI) * fade;
      ctx.drawImage(line, -l / 2, -l * 0.06, l, l * 0.12);
      ctx.restore();
    }
  }
  // White-hot mouth.
  ctx.globalAlpha = fade;
  ctx.drawImage(auraSprite('#fff4d6'), h.x - 34, h.y - 34, 68, 68);
}

function drawColumn(ctx, h) {
  const base = H;
  if (h.t < h.warn) {
    const k = h.t / h.warn;
    // Ground cracking: a glowing seam, faint edge guides up to the column top, pebbles
    // hopping and dust puffs that thicken toward the eruption.
    ctx.globalAlpha = 0.35 + 0.45 * k * (0.75 + 0.25 * Math.sin(h.t * 30));
    ctx.drawImage(auraSprite(h.color), h.x - h.w * 1.2, base - h.w * 0.5, h.w * 2.4, h.w);
    ctx.globalAlpha = 0.15 + 0.25 * k;
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = h.t * 40;
    ctx.beginPath();
    ctx.moveTo(h.x - h.w / 2, base); ctx.lineTo(h.x - h.w / 2, h.top);
    ctx.moveTo(h.x + h.w / 2, base); ctx.lineTo(h.x + h.w / 2, h.top);
    ctx.stroke();
    ctx.setLineDash([]);
    const rocks = getNativeWeaponImage('lao-fx-rocks');
    if (rocks) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 4; i++) {
        const hop = Math.abs(Math.sin(h.t * (14 + i * 3) + i)) * 14 * k;
        const px = h.x + (hash01(i, 11) - 0.5) * h.w;
        const sz = 10 + 8 * hash01(i, 12);
        ctx.drawImage(rocks, 380 + i * 90, 40, 80, 70, px - sz / 2, base - 6 - hop - sz, sz, sz * 0.85);
      }
      const dust = getNativeWeaponImage('lao-fx-dust');
      if (dust) {
        for (let i = 0; i < 3; i++) {
          const ph = (h.t * 1.5 + i / 3) % 1;
          const sz = h.w * (0.8 + ph) * (0.5 + k);
          ctx.globalAlpha = 0.35 * k * Math.sin(ph * Math.PI);
          ctx.drawImage(dust, h.x + (i - 1) * h.w * 0.4 - sz / 2, base - sz * 0.6 - ph * 20, sz, sz);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
    }
    return;
  }
  const live = h.t - h.warn;
  const rise = Math.min(1, live / 0.1);
  const fade = live > h.life ? Math.max(0, 1 - (live - h.life) / FADE) : 1;
  const top = base - (base - h.top) * rise;
  // Stone spire: dark base fill, the original rock texture clipped into it, side shading
  // and a hot rim in the leader's colour.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = fade;
  ctx.save();
  // Craggy silhouette: both flanks step in and out on the way up to a broken tip.
  const sx = (i, side) => h.x + side * h.w * (0.6 - 0.42 * i) + side * h.w * 0.09 * (hash01(i * 7 + (side > 0 ? 3 : 0), h.x) - 0.5);
  ctx.beginPath();
  ctx.moveTo(h.x - h.w * 0.62, base);
  for (let i = 1; i <= 5; i++) ctx.lineTo(sx(i / 5, -1), base - (base - top - 26) * (i / 5));
  ctx.lineTo(h.x - h.w * 0.12, top);
  ctx.lineTo(h.x + h.w * 0.08, top + 9);
  ctx.lineTo(h.x + h.w * 0.22, top + 16);
  for (let i = 5; i >= 1; i--) ctx.lineTo(sx(i / 5, 1), base - (base - top - 30) * (i / 5));
  ctx.lineTo(h.x + h.w * 0.62, base);
  ctx.closePath();
  ctx.fillStyle = '#4a423c';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Stone strata: stacked bands of lit / mid / shadow facets with dark cracks between.
  const tones = ['#7b7068', '#5f564f', '#8a7e74', '#514842', '#6c625a'];
  const ch = h.w * 0.5;
  let band = 0;
  for (let y = base; y > top - ch; y -= ch, band++) {
    const off = (hash01(band, h.x) - 0.5) * h.w * 0.3;
    const mid = h.x + off;
    ctx.fillStyle = tones[band % tones.length];
    ctx.beginPath();
    ctx.moveTo(h.x - h.w, y); ctx.lineTo(mid - h.w * 0.1, y - ch * 0.15); ctx.lineTo(mid + h.w * 0.05, y - ch);
    ctx.lineTo(h.x - h.w, y - ch * 1.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tones[(band + 3) % tones.length];
    ctx.beginPath();
    ctx.moveTo(mid - h.w * 0.1, y - ch * 0.15); ctx.lineTo(h.x + h.w, y + ch * 0.05); ctx.lineTo(h.x + h.w, y - ch);
    ctx.lineTo(mid + h.w * 0.05, y - ch); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,10,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(h.x - h.w, y - ch * 1.05); ctx.lineTo(mid + h.w * 0.05, y - ch); ctx.lineTo(h.x + h.w, y - ch * 0.95);
    ctx.moveTo(mid - h.w * 0.1, y - ch * 0.15); ctx.lineTo(mid + h.w * 0.05, y - ch);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,220,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(h.x - h.w, y - ch * 1.05 + 2); ctx.lineTo(mid + h.w * 0.05, y - ch + 2); ctx.stroke();
  }
  ctx.restore();
  const shade = ctx.createLinearGradient(h.x - h.w * 0.6, 0, h.x + h.w * 0.6, 0);
  shade.addColorStop(0, 'rgba(255,240,210,0.18)');
  shade.addColorStop(0.45, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.strokeStyle = h.color2 || '#ffe2b0';
  ctx.globalAlpha = 0.9 * fade;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  liveGlow(ctx, h, h.x, base - 6, h.w * 1.1, h.w * 0.45);
  liveGlow(ctx, h, h.x - h.w * 0.12, top + 8, h.w * 0.45, h.w * 0.35);
}

function drawSigil(ctx, h) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, h.t / h.warn) * (h.t < h.warn ? 0.55 : Math.max(0, 1 - (h.t - h.warn) / (h.life + FADE)));
  ctx.drawImage(auraSprite(h.color), h.x - h.r * 1.9, h.y - h.r * 1.9, h.r * 3.8, h.r * 3.8);
  ctx.restore();
  liveGlow(ctx, h, h.x, h.y, h.r * 1.1, h.r * 1.1);
  if (h.t < h.warn) {
    ctx.save();
    ctx.globalAlpha = 0.18 * Math.min(1, h.t / h.warn);
    ctx.lineWidth = 9;
    ctx.strokeStyle = h.color;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  const spin = h.t * 1.6;
  const k = Math.min(1, h.t / h.warn);
  ctx.strokeStyle = h.color;
  if (h.t < h.warn) {
    ctx.globalAlpha = 0.35 + 0.5 * k;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.68, 0, Math.PI * 2); ctx.stroke();
    // Rotating pentagram.
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = spin + (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = h.x + Math.cos(a) * h.r * 0.66;
      const py = h.y + Math.sin(a) * h.r * 0.66;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.08 + 0.12 * k;
    ctx.fillStyle = h.color;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const live = h.t - h.warn;
  const u = Math.min(1, live / (h.life + FADE));
  ctx.globalAlpha = 0.9 * (1 - u);
  ctx.fillStyle = h.color2 || h.color;
  // Soft eruption: a gradient flare upward and a blooming aura over the circle.
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(auraSprite(h.color2 || h.color), h.x - h.r * 0.7, h.y - h.r * 2.2, h.r * 1.4, h.r * 2.6);
  const rr = h.r * (1.2 + 0.5 * u);
  ctx.drawImage(auraSprite(h.color), h.x - rr * 1.6, h.y - rr * 1.6, rr * 3.2, rr * 3.2);
  ctx.globalAlpha = 0.95 * (1 - u);
  ctx.drawImage(auraSprite('#ffffff'), h.x - h.r * 0.5, h.y - h.r * 0.5, h.r, h.r);
}
