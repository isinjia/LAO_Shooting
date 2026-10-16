import { W, H } from './canvas.js';

/** Painted backdrop slice width: the 1024x576 art at the 540 field height (16:9). */
const sliceW = () => Math.round((H * 1024) / 576);
import { prefersLowEndGfx } from './mobile.js';

/** Pre-scale bg slices once — combat used to resample 1024×576→960×540 every frame. */
const paintedSliceCache = new WeakMap();
const tileBitmapCache = new WeakMap();
const fullSceneCache = new WeakMap();
const gradeOverlayCache = new Map();

function copySmoothing(src, dst) {
  dst.imageSmoothingEnabled = src.imageSmoothingEnabled !== false;
  dst.imageSmoothingQuality = src.imageSmoothingQuality || 'low';
}

function paintedSlice(ctx, img, sourceY, wash) {
  let bySrc = paintedSliceCache.get(img);
  if (!bySrc) {
    bySrc = new Map();
    paintedSliceCache.set(img, bySrc);
  }
  const q = ctx.imageSmoothingQuality || 'low';
  const key = `${sourceY}|${q}|${wash || ''}|${H}`;
  let c = bySrc.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  // Keep the painting's 16:9 (1024x576 -> 960x540); wider screens tile it (paintedScene).
  c.width = sliceW();
  c.height = H;
  const g = c.getContext('2d');
  copySmoothing(ctx, g);
  g.drawImage(img, 0, sourceY, 1024, 576, 0, 0, sliceW(), H);
  if (wash) {
    g.fillStyle = wash;
    g.fillRect(0, 0, sliceW(), H);
  }
  bySrc.set(key, c);
  return c;
}

function tileBitmap(ctx, img, destH) {
  let byH = tileBitmapCache.get(img);
  if (!byH) {
    byH = new Map();
    tileBitmapCache.set(img, byH);
  }
  const q = ctx.imageSmoothingQuality || 'low';
  const key = `${destH}|${q}`;
  let slot = byH.get(key);
  if (slot) return slot;
  const width = img.width * destH / img.height;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(destH));
  const g = c.getContext('2d');
  copySmoothing(ctx, g);
  g.drawImage(img, 0, 0, img.width, img.height, 0, 0, c.width, c.height);
  slot = { canvas: c, width: c.width };
  byH.set(key, slot);
  return slot;
}

function fullSceneBitmap(ctx, img, dw, dh, wash) {
  let bySize = fullSceneCache.get(img);
  if (!bySize) {
    bySize = new Map();
    fullSceneCache.set(img, bySize);
  }
  const q = ctx.imageSmoothingQuality || 'low';
  const key = `${dw}|${dh}|${q}|${wash || ''}`;
  let c = bySize.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(dw));
  c.height = Math.max(1, Math.round(dh));
  const g = c.getContext('2d');
  copySmoothing(ctx, g);
  g.drawImage(img, 0, 0, img.width, img.height, 0, 0, c.width, c.height);
  if (wash) {
    g.fillStyle = wash;
    g.fillRect(0, 0, c.width, c.height);
  }
  bySize.set(key, c);
  return c;
}

function tile(ctx, img, scroll, y, h, alpha = 1) {
  if (!img) return;
  const bit = tileBitmap(ctx, img, h);
  const width = bit.width;
  const offset = ((scroll % width) + width) % width;
  ctx.globalAlpha = alpha;
  for (let x = -offset; x < W; x += width) ctx.drawImage(bit.canvas, x, y);
  ctx.globalAlpha = 1;
}

function paintedScene(ctx, img, scroll, sourceY, parallax = 0.16, wash) {
  if (!img) return;
  const slice = paintedSlice(ctx, img, sourceY, wash);
  const width = slice.width;
  const pos = scroll * parallax;
  const offset = ((pos % width) + width) % width;
  // Every other copy is mirrored so the painting's left / right edges meet seamlessly
  // (wider-than-16:9 screens always show a join).
  let n = Math.floor(pos / width);
  for (let x = -offset; x < W; x += width, n += 1) {
    if (n & 1) {
      ctx.save();
      ctx.translate(x + width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(slice, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(slice, x, 0);
    }
  }
}

function fullScene(ctx, img, scroll, swayAmp = 38, wash) {
  if (!img) return;
  const sway = Math.sin(scroll * 0.0015) * swayAmp;
  // Cover the (possibly wider than 16:9) field without stretching the art.
  const ar = (img.naturalWidth || img.width || 16) / (img.naturalHeight || img.height || 9);
  const dw = Math.round(Math.max(W + 84, (H + 44) * ar));
  const dh = Math.round(dw / ar);
  ctx.drawImage(fullSceneBitmap(ctx, img, dw, dh, wash), -42 + sway - (dw - W - 84) / 2, -(dh - H) / 2);
}

function motes(ctx, t, color, count, speed) {
  // Decorative drift only — skip on low-end (fill-rate). Scene grids / silhouettes stay.
  if (prefersLowEndGfx()) return;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = (i * 137 + Math.sin(i * 24.7) * 57 - t * speed * (0.5 + i % 3) % (W + 60) + W * 4) % (W + 60) - 30;
    const y = (i * 93 + Math.sin(t * 0.8 + i) * 18) % H;
    ctx.globalAlpha = 0.2 + 0.2 * Math.sin(t * 2 + i * 4) ** 2;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 3) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Bake tint+edge+vignette+accent — four translucent washes composited to one blit. */
function gradeOverlay(grade, stageColor) {
  const key = `${grade.tint}|${grade.top}|${grade.bottom}|${grade.vig}|${stageColor || ''}|${W}x${H}`;
  let c = gradeOverlayCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = grade.tint;
  g.fillRect(0, 0, W, H);
  const edge = g.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, grade.top);
  edge.addColorStop(0.22, 'rgba(0,0,0,0)');
  edge.addColorStop(0.78, 'rgba(0,0,0,0)');
  edge.addColorStop(1, grade.bottom);
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);
  const vig = g.createRadialGradient(W * 0.5, H * 0.45, H * 0.15, W * 0.5, H * 0.5, H * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(0,0,0,${grade.vig})`);
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  if (stageColor) {
    g.fillStyle = stageColor;
    g.globalAlpha = 0.22;
    g.fillRect(0, 0, W, 2);
    g.globalAlpha = 0.12;
    g.fillRect(0, H - 2, W, 2);
    g.globalAlpha = 1;
  }
  gradeOverlayCache.set(key, c);
  return c;
}

function scanCity(ctx, scroll, t) {
  // Far grid parallax
  ctx.strokeStyle = 'rgba(70,160,210,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const x = ((i * 160 - scroll * 0.18) % (W + 160) + W + 160) % (W + 160);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40, H);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(95,220,255,0.18)';
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const x = ((i * 119 - scroll * 0.42) % (W + 119) + W + 119) % (W + 119);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  ctx.stroke();
  const pulse = 0.12 + Math.sin(t * 1.5) * 0.05;
  ctx.fillStyle = `rgba(70,195,255,${pulse})`;
  for (let y = 24; y < H; y += 40) ctx.fillRect(0, y, W, 1);
  // Near neon streaks
  ctx.fillStyle = 'rgba(120,230,255,0.08)';
  for (let i = 0; i < 5; i++) {
    const y = 60 + i * 90 + Math.sin(t + i) * 6;
    const x = ((scroll * 1.1 + i * 200) % (W + 200)) - 100;
    ctx.fillRect(x, y, 140, 2);
  }
  motes(ctx, t, '#8ff1ff', 24, 18);
}

function hive(ctx, scroll, t) {
  // Far hex wash
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(160,80,220,0.18)';
  ctx.beginPath();
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const x = ((col * 150 - scroll * 0.2) % 1200 + 1200) % 1200 - 60;
      const y = 30 + row * 130;
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k;
        const px = x + Math.cos(a) * 34;
        const py = y + Math.sin(a) * 34;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(208,117,255,0.28)';
  ctx.beginPath();
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const x = ((col * 128 - scroll * 0.48) % 1280 + 1280) % 1280 - 80;
      const y = 45 + row * 111 + (col % 2) * 48;
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k;
        const px = x + Math.cos(a) * 26;
        const py = y + Math.sin(a) * 26;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
  ctx.stroke();
  // Spore fog band
  const fog = 0.08 + 0.04 * Math.sin(t * 0.9);
  ctx.fillStyle = `rgba(120,40,160,${fog})`;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
  motes(ctx, t, '#eab6ff', 36, 22);
}

function nest(ctx, scroll, t) {
  // Far silk canopy
  ctx.strokeStyle = 'rgba(255,200,140,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const x = ((i * 120 - scroll * 0.22) % 1200 + 1200) % 1200;
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + Math.sin(t * 0.4 + i) * 40, H * 0.35, x + 30, H * 0.55);
  }
  ctx.stroke();
  for (let i = 0; i < 14; i++) {
    const x = ((i * 103 - scroll * 0.62) % 1442 + 1442) % 1442 - 80;
    const y = 455 + (i % 3) * 22;
    ctx.fillStyle = i % 2 ? 'rgba(246,163,87,0.32)' : 'rgba(255,212,140,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, 19 + i % 4 * 6, 32 + i % 3 * 8, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,222,180,0.24)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + Math.sin(t + i) * 22, y * 0.5, x, y);
    ctx.stroke();
  }
  // Ember drift
  motes(ctx, t, '#ffc795', 28, 10);
  motes(ctx, t * 1.2, '#ff8a4a', 10, 6);
}

function airfield(ctx, scroll, t) {
  // Far runway lights
  ctx.fillStyle = 'rgba(40,120,200,0.12)';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 200 - scroll * 0.3) % 1600 + 1600) % 1600 - 40;
    ctx.fillRect(x, H - 140, 80, 2);
  }
  ctx.fillStyle = 'rgba(60,175,255,0.18)';
  for (let i = 0; i < 10; i++) {
    const x = ((i * 166 - scroll * 0.95) % 1660 + 1660) % 1660 - 50;
    ctx.fillRect(x, H - 95, 60, 3);
    ctx.fillRect(x + 23, H - 106, 3, 14);
  }
  ctx.strokeStyle = 'rgba(115,205,255,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W * 0.75, 90, 55 + Math.sin(t * 2) * 3, 0, Math.PI * 2);
  ctx.moveTo(W * 0.75, 90);
  ctx.lineTo(W * 0.75 + Math.cos(t * 1.8) * 80, 90 + Math.sin(t * 1.8) * 80);
  ctx.stroke();
  // Contrail
  ctx.strokeStyle = 'rgba(180,220,255,0.14)';
  ctx.beginPath();
  for (let x = 0; x < W; x += 20) {
    const y = 70 + Math.sin(x * 0.02 + t) * 8 + Math.sin(scroll * 0.01) * 4;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  motes(ctx, t, '#b4dfff', 20, 36);
}

function abyss(ctx, scroll, t) {
  ctx.lineWidth = 5;
  for (let j = 0; j < 10; j++) {
    const y = 35 + j * 54;
    ctx.strokeStyle = j % 2 ? 'rgba(255,78,105,0.15)' : 'rgba(151,53,112,0.18)';
    ctx.beginPath();
    for (let x = 0; x <= W; x += 28) {
      const yy = y + Math.sin(x * 0.018 + t * 0.9 + j) * (12 + j % 3 * 5);
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Near claw silhouettes
  ctx.fillStyle = 'rgba(40,0,12,0.35)';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 210 - scroll * 0.7) % 1260 + 1260) % 1260 - 40;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 30, H - 90 - (i % 3) * 20);
    ctx.lineTo(x + 55, H);
    ctx.fill();
  }
  const pulse = 0.07 + 0.04 * Math.sin(t * 2.4);
  ctx.fillStyle = `rgba(255,45,78,${pulse})`;
  ctx.fillRect(0, 0, W, H);
  motes(ctx, t, '#ff8ba0', 40, 14);
}

/** Act-specific color grade / overlay after scene FX. */
const ACT_GRADE = {
  city: {
    wash: 'rgba(4,22,40,0.38)',
    tint: 'rgba(40,140,200,0.07)',
    top: 'rgba(10,40,70,0.35)',
    bottom: 'rgba(0,10,20,0.45)',
    vig: 0.4,
  },
  hive: {
    wash: 'rgba(42,8,52,0.32)',
    tint: 'rgba(160,60,220,0.09)',
    top: 'rgba(50,10,70,0.4)',
    bottom: 'rgba(20,0,30,0.5)',
    vig: 0.45,
  },
  nest: {
    wash: 'rgba(70,32,8,0.34)',
    tint: 'rgba(255,140,60,0.08)',
    top: 'rgba(60,25,5,0.38)',
    bottom: 'rgba(30,12,0,0.48)',
    vig: 0.42,
  },
  airfield: {
    wash: 'rgba(4,16,36,0.4)',
    tint: 'rgba(80,160,255,0.06)',
    top: 'rgba(8,30,60,0.36)',
    bottom: 'rgba(0,8,20,0.5)',
    vig: 0.38,
  },
  abyss: {
    wash: 'rgba(40,4,18,0.26)',
    tint: 'rgba(220,30,70,0.1)',
    top: 'rgba(50,0,20,0.42)',
    bottom: 'rgba(20,0,10,0.55)',
    vig: 0.5,
  },
};

export function drawStageBackground(ctx, images, stage, scroll, t) {
  ctx.fillStyle = '#0a1018';
  ctx.fillRect(0, 0, W, H);
  const scene = stage.scene;
  const grade = ACT_GRADE[scene] || ACT_GRADE.city;
  // Hive tiles are translucent — wash must stay a screen fill. Other acts cover
  // the buffer, so bake the same wash into the pre-scaled blit (one less blend).
  const bakeWash = scene !== 'hive' ? grade.wash : '';
  // Distinct parallax speeds per act
  if (scene === 'city') paintedScene(ctx, images.bg1, scroll, 130, 0.14, bakeWash);
  else if (scene === 'airfield') paintedScene(ctx, images.bg3, scroll, 190, 0.2, bakeWash);
  else if (scene === 'nest') paintedScene(ctx, images.lao_bg_2_8_1, scroll, 160, 0.12, bakeWash);
  else if (scene === 'abyss') fullScene(ctx, images.lao_bg_13_30, scroll, 48, bakeWash);
  else {
    // hive — stacked loop layers with stronger depth
    tile(ctx, images.loop_far, scroll * 0.18, 0, H, 0.9);
    tile(ctx, images.loop_mid, scroll * 0.42, 0, H, 0.65);
    tile(ctx, images.loop_near, scroll * 1.05, H - 205, 205, 0.92);
    ctx.fillStyle = grade.wash;
    ctx.fillRect(0, 0, W, H);
  }

  if (scene === 'city') scanCity(ctx, scroll, t);
  else if (scene === 'hive') hive(ctx, scroll, t);
  else if (scene === 'nest') nest(ctx, scroll, t);
  else if (scene === 'airfield') airfield(ctx, scroll, t);
  else abyss(ctx, scroll, t);

  // Static grade (tint+edge+vignette+accent) — same over-composite, one blit.
  ctx.drawImage(gradeOverlay(grade, stage.color), 0, 0);
}
