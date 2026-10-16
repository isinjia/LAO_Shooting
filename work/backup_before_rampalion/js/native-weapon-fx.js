import { sheetDecodeScale } from './mobile.js';
import { NATIVE_SHOT_FRAMES } from './native-shot-data.js';

const textures = new Map();
// Large body sheets ship as WebP (Griffin full 262-frame Skill2 is ~12MB as PNG).
const WEBP_KEYS = new Set(['griffin-skill1', 'griffin-skill2', 'sleipnir-skill1', 'sleipnir-skill2', 'labiata-skill1-0', 'labiata-skill2-0',
  'constantia-skill1-0', 'constantia-skill2-0', 'constantia-bori-0', 'express76-skill1', 'express76-skill2', 'lrl-skill1']);
const tint = { hirume: '#ffb13e', constantia: '#ffe0a0', lrl: '#ff5269', 'lrl-flight': '#ff5877',
  labiata: '#ff85e2', emily: '#8beaff', 'lrl-hit-cut': '#ff7d90', 'lrl-hit-sparks': '#ffc4b2',
  'lrl-skill1-clone': '#43baff' };

const ALL_KEYS = [...Object.keys(NATIVE_SHOT_FRAMES), 'lrl-axe', 'lrl-arrow', 'lrl-flight', 'lrl-hit-cut', 'lrl-hit-sparks', 'lrl-skill1-clone', 'lrl-skill1', 'lrl-skill2', 'lrl-skill2-clean', 'peregrinus-sonicboom', 'lao-missile-melite', 'lao-fx-airboom', 'lao-fx-fireball', 'lao-fx-flameburst', 'lao-fx-shockring', 'lao-fx-smog', 'lao-fx-rocks', 'lao-fx-dust', 'lao-fx-fireline', 'lao-fx-spark', 'lao-fx-groundsmoke', 'peregrinus-fx-wind', 'peregrinus-fx-ink', 'peregrinus-fx-glow', 'peregrinus-fx-spark', 'peregrinus-fx-streak', 'peregrinus-fx-dust', 'peregrinus-fx-beam', 'peregrinus-fx-beam1', 'peregrinus-fx-beamlight', 'peregrinus-fx-pang', 'peregrinus-fx-fireline', 'peregrinus-fx-airline', 'peregrinus-fx-air', 'peregrinus-fx-ring', 'peregrinus-fx-zizic', 'lrl-skill2-star', 'griffin-skill1', 'griffin-skill2', 'sleipnir-skill1', 'sleipnir-skill2',
    'express76-skill1', 'express76-skill2', 'express76-freight',
    'express76-fx-sonicboom', 'express76-fx-impact', 'express76-fx-smoke', 'express76-fx-trail',
    'express76-fx-box', 'express76-fx-light', 'express76-fx-bling', 'express76-fx-hit',
    'griffin-fx-missile', 'griffin-fx-plume', 'griffin-fx-booster', 'griffin-fx-firehit',
    'griffin-fx-groundfire', 'griffin-fx-skill2hit', 'griffin-fx-smog', 'griffin-fx-boom',
    'griffin-fx-jet', 'griffin-fx-line', 'griffin-fx-linegold',
    'sleipnir-fx-bullet', 'sleipnir-fx-lastbullet', 'sleipnir-fx-muzzle', 'sleipnir-fx-hit',
    'sleipnir-fx-lasthit', 'sleipnir-fx-lastfire', 'sleipnir-fx-sonic', 'sleipnir-fx-startsmoke',
    'sleipnir-fx-ring', 'sleipnir-fx-boost', 'sleipnir-fx-upsmoke', 'sleipnir-fx-flyboom',
    'sleipnir-fx-groundsmoke', 'sleipnir-fx-backsmoke', 'sleipnir-fx-aftersmoke',
    'sleipnir-fx-downsmoke', 'sleipnir-fx-eyes', 'sleipnir-fx-line', 'sleipnir-fx-goggle',
    'sleipnir-fx-aura', 'express76-fx-fireparticle', 'express76-fx-buffline',
    'express76-prop-atm', 'express76-prop-atmbroken', 'express76-prop-bill',
    'express76-prop-moneystack', 'express76-prop-boxlid', 'express76-prop-boxleft', 'express76-prop-boxright',
    'express76-prop-heldbox',
    'constantia-fx-muzzle', 'constantia-fx-muzzlering', 'constantia-fx-hit', 'constantia-fx-hitsmoke', 'constantia-fx-hitline', 'constantia-fx-boriring',
    'constantia-fx-borismoke', 'constantia-fx-bite', 'constantia-fx-bitehit', 'constantia-fx-tracer', 'constantia-fx-aim', 'constantia-fx-case',
    'constantia-skill1-0', 'constantia-skill2-0', 'constantia-bori-0',
    'labiata-skill1-0', 'labiata-skill2-0', 'labiata-fx-hit', 'labiata-fx-baghit',
    'labiata-fx-blade', 'labiata-fx-bladedeco', 'labiata-fx-smoke2', 'labiata-fx-smoke4',
    'labiata-fx-downsmoke', 'labiata-fx-baglight', 'labiata-fx-spark', 'labiata-fx-inparticle',
    'labiata-fx-inaura', 'labiata-fx-swing', 'labiata-fx-swingsmoke', 'labiata-fx-upsmoke',
    'labiata-fx-windaura', 'labiata-fx-jumpsmoke', 'labiata-fx-groundbomb',
    'labiata-fx-grounddeco', 'labiata-fx-groundsmoke', 'labiata-fx-hit2',
    'labiata-fx-buffaura', 'labiata-fx-finalhit', 'labiata-fx-rocks'];
const ALL_SET = new Set(ALL_KEYS);
// Skill-body sheets with a half-resolution copy (<key>.lo.webp) for low-end phones;
// image._lo = 0.5 tells Player to halve the cells / atlas rects (on-screen size unchanged).
const LO_KEYS = new Set(['griffin-skill1', 'griffin-skill2', 'sleipnir-skill1', 'sleipnir-skill2',
  'express76-skill1', 'express76-skill2', 'labiata-skill1-0', 'labiata-skill2-0', 'constantia-skill1-0', 'constantia-skill2-0',
  'lrl-skill1']);
// Kit-owned textures (skill bodies, props, FX) load only for the pilot in the sortie;
// anything else asked for later loads on first use (texGet). Boot keeps only shared art.
const PILOTS = ['griffin', 'sleipnir', 'express76', 'constantia', 'labiata', 'lrl', 'peregrinus'];
const ownerOf = (key) => PILOTS.find((p) => key === p || key.startsWith(`${p}-`)) || null;
const pending = new Map();

/**
 * Decode the shared set plus one pilot's kit (charKey; omit = shared only).
 * Only original textures and runtime material tinting.
 */
export function loadNativeWeaponFx(charKey = null) {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(ALL_KEYS.filter((k) => {
    const o = ownerOf(k);
    return !o || o === charKey;
  }).map(loadKey));
}

function texGet(key) {
  const t = textures.get(key);
  if (!t && ALL_SET.has(key) && !pending.has(key)) loadKey(key);
  return t;
}

function loadKey(key) {
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    const image = new Image();
    const lo = LO_KEYS.has(key) && sheetDecodeScale() < 1;
    if (lo) image._lo = 0.5;
    image.src = new URL(`../assets/native-shots/${key}.${lo ? 'lo.webp' : WEBP_KEYS.has(key) ? 'webp' : 'png'}`, import.meta.url).href;
    try {
      await image.decode();
    } catch {
      // decode() can reject under memory pressure while several large sheets decode at
      // once; the bitmap is still usable once it has loaded (drawImage decodes lazily).
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }
      if (!(image.naturalWidth > 0)) {
        console.warn('[native-weapon-fx] failed to load', key);
        return;
      }
    }
    let texture = image;
    if (tint[key]) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = tint[key]; ctx.fillRect(0, 0, canvas.width, canvas.height);
      texture = canvas;
    }
    textures.set(key, { texture, image });
  })();
  pending.set(key, job);
  return job;
}

export function getNativeWeaponImage(key) { return texGet(key)?.image || null; }

// Unity sheet: 4 x 3 cells, including the two transparent terminal cells.
// A single pivot/scale preserves the authored thinning and drifting of the slash.
export const LRL_CLIP = Object.freeze({ columns: 4, rows: 3, count: 12,
  pivotX: 245, pivotY: 315, referenceWidth: 300, duration: 0.46 });

export function sampleLrlClip(progress) {
  const frame = Math.max(0, Math.min(11, progress * 11));
  const first = Math.floor(frame);
  return { first, second: Math.min(11, first + 1), mix: frame - first };
}

function lrlCell(ctx, entry, index, size, alpha, original = false) {
  if (alpha <= 0.001) return;
  const cw = entry.image.width / 4, ch = entry.image.height / 3;
  const scale = size / LRL_CLIP.referenceWidth;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(original ? entry.image : entry.texture,
    (index % 4) * cw, Math.floor(index / 4) * ch, cw, ch,
    -LRL_CLIP.pivotX * scale, -LRL_CLIP.pivotY * scale, cw * scale, ch * scale);
  ctx.restore();
}

function lrlFrame(ctx, entry, frame, size, alpha = 1, original = false) {
  const { first, second, mix } = sampleLrlClip(frame / 11);
  // Additive interpolation avoids dark seams between translucent animation cells.
  lrlCell(ctx, entry, first, size, alpha * (1 - mix), original);
  lrlCell(ctx, entry, second, size, alpha * mix, original);
}

export function lrlFlightLayers(age) {
  // Each wave plays all sixteen authored cells once. Staggered waves bridge the
  // transparent end cells without freezing a crescent or jumping to frame zero.
  const interval = 0.20, duration = 0.56;
  const newest = Math.floor(age / interval);
  const layers = [];
  for (let index = Math.max(0, newest - 2); index <= newest; index++) {
    const elapsed = age - index * interval;
    if (elapsed < 0 || elapsed >= duration) continue;
    const progress = elapsed / duration;
    layers.push({ progress, frame: progress * 15,
      x: -progress * 26,
      rotation: -Math.PI / 2,
      alpha: Math.min(1, elapsed / 0.04) * Math.min(1, (1-progress) / 0.22) });
  }
  return layers;
}
function drawLrlFlight(ctx, b) {
  const entry = texGet('lrl-flight');
  if (!entry) return;
  const size = b.r * 3.65, scale = size / 363;
  const cw = entry.image.width / 4, ch = entry.image.height / 4;
  const stamp = (frame, alpha, original) => {
    const first = Math.floor(frame), mix = frame - first;
    for (let n = 0; n < 2; n++) {
      const index = Math.min(15, first + n), weight = n ? mix : 1 - mix;
      if (weight * alpha < 0.001) continue;
      ctx.save();ctx.globalAlpha *= alpha * weight;
      ctx.drawImage(original ? entry.image : entry.texture,
        index % 4 * cw, Math.floor(index / 4) * ch, cw, ch,
        -257 * scale, -273 * scale, cw * scale, ch * scale);
      ctx.restore();
    }
  };
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));
  ctx.globalCompositeOperation = 'lighter';
  // Rotate the whole slash around one fixed pivot. Every overlapping wave
  // shares this angle; only its original sprite animation is staggered.
  const spin = b.age * 12.5;
  for (const layer of lrlFlightLayers(b.age + 0.055)) {
    ctx.save();ctx.rotate(spin);ctx.translate(layer.x,0);ctx.rotate(layer.rotation);
    // Warm outer blade, narrow white interior. Avoid bleaching the entire texture.
    stamp(layer.frame,layer.alpha * 0.8,false);
    ctx.scale(0.94,0.94);stamp(layer.frame,layer.alpha * 0.30,true);
    ctx.restore();
  }
  // Tiny authored fragments peel off the back with their own short lifetimes.
  for(let i=0;i<2;i++) {
    const life=((b.age*2.3+i/2)%1);
    ctx.save();ctx.rotate(spin);ctx.translate(-12-life*(24+b.powerLevel*3),
      Math.sin(i*2.4+life*1.7)*(4+life*b.r*.65));
    ctx.rotate(-Math.PI/2+(i ? 0.14 : -0.14));
    lrlFrame(ctx,texGet('lrl'),6+life*4,b.r*(1-life*.55),.42*(1-life));
    ctx.restore();
  }
  ctx.restore();
}

const HIT_SHEETS = {
  cut: { key: 'lrl-hit-cut', columns: 4, rows: 2, pivot: [256, 255], span: 479 },
  sparks: { key: 'lrl-hit-sparks', columns: 3, rows: 2, pivot: [253, 288], span: 358 },
};
function hitSheet(ctx, sheet, progress, size, alpha, original = false) {
  const entry = texGet(sheet.key);
  if (!entry || progress >= 1) return;
  const cw = entry.image.width / sheet.columns, ch = entry.image.height / sheet.rows;
  const frame = Math.min(sheet.columns * sheet.rows - 1, progress * (sheet.columns * sheet.rows - 1));
  const first = Math.floor(frame), mix = frame - first;
  for (let n = 0; n < 2; n++) {
    const index = Math.min(sheet.columns * sheet.rows - 1, first + n);
    const weight = n ? mix : 1 - mix;
    if (weight < 0.001) continue;
    const scale = size / sheet.span;
    ctx.save(); ctx.globalAlpha *= alpha * weight;
    ctx.drawImage(original ? entry.image : entry.texture,
      index % sheet.columns * cw, Math.floor(index / sheet.columns) * ch, cw, ch,
      -sheet.pivot[0] * scale, -sheet.pivot[1] * scale, cw * scale, ch * scale);
    ctx.restore();
  }
}
function drawLrlImpact(ctx, fx) {
  const t = fx.age / fx.duration;
  const size = 40 + Math.min(42, fx.r) * 2.4;
  ctx.save(); ctx.translate(fx.x, fx.y);
  ctx.globalCompositeOperation = 'lighter';
  // A short diagonal cut stays at the contact point. It never travels like a shot.
  ctx.rotate(fx.angle - Math.PI * 0.28);
  hitSheet(ctx, HIT_SHEETS.cut, t, size, 0.95);
  hitSheet(ctx, HIT_SHEETS.cut, t, size * 0.92, 0.85, true);
  if (fx.heavy && t > 0.08) {
    ctx.rotate(Math.PI * 0.56);
    hitSheet(ctx, HIT_SHEETS.cut, (t - 0.08) / 0.92, size * 0.75, 0.65);
  }
  ctx.restore();
  ctx.save(); ctx.translate(fx.x, fx.y);
  ctx.globalCompositeOperation = 'lighter';
  hitSheet(ctx, HIT_SHEETS.sparks, t, size * 0.42, 0.72 * (1 - t));
  ctx.restore();
}

/** Cosmetic snapshots survive bullet recycling; bounded and advanced by sim time. */
export class NativeShotEffects {
  constructor() { this.list = []; }
  emit(b, kind = 'launch', point = b) {
    if (b.nativeKey !== 'lrl' && b.nativeKey !== 'lrl-axe') return;
    if (b.nativeKey === 'lrl-axe' && kind !== 'impact') return;
    if (this.list.length >= 48) this.list.shift();
    this.list.push({ x: point.x, y: point.y, r: b.r,
      angle: Math.atan2(b.vy, b.vx), age: 0, kind, heavy: b.nativeKey === 'lrl-axe',
      duration: kind === 'launch' ? 0.34 : b.nativeKey === 'lrl-axe' ? 0.32 : 0.26 });
  }
  update(dt) {
    let n = 0;
    for (const fx of this.list) {
      fx.age += dt;
      if (fx.age < fx.duration) this.list[n++] = fx;
    }
    this.list.length = n;
  }
  clear() { this.list.length = 0; }
  draw(ctx) {
    const entry = texGet('lrl');
    if (!entry) return;
    for (const fx of this.list) {
      if (fx.kind === 'impact') { drawLrlImpact(ctx, fx); continue; }
      const t = fx.age / fx.duration;
      ctx.save(); ctx.translate(fx.x + t * 6, fx.y);
      ctx.rotate(fx.angle - Math.PI / 2 + 0.12);
      ctx.globalCompositeOperation = 'lighter';
      const size = fx.r * 3.5 * (1 + 0.22 * t);
      lrlFrame(ctx, entry, t * 11, size, 0.65);
      lrlFrame(ctx, entry, t * 11, size, 0.3, true);
      ctx.restore();
    }
  }
}

function drawLrlAxe(ctx, b, entry) {
  // Opaque original weapon art owns the silhouette, never an additive light blob.
  const width = b.r * 3.2;
  const height = width * entry.image.height / entry.image.width;
  const angle = -Math.PI / 4 + b.age * 11;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.globalCompositeOperation = 'source-over';
  const stamp = (rotation, alpha) => {
    ctx.save(); ctx.rotate(rotation); ctx.globalAlpha *= alpha;
    ctx.drawImage(entry.image, -width / 2, -height / 2, width, height);
    ctx.restore();
  };
  // Two quiet rotational echoes; solid blade and handle remain dominant.
  if (b.age > 0.06) stamp(angle - 0.65, 0.08);
  if (b.age > 0.03) stamp(angle - 0.32, 0.14);
  ctx.shadowColor = 'rgba(8, 3, 10, 0.85)'; ctx.shadowBlur = 2;
  stamp(angle, 1);
  ctx.restore();
}

export function drawNativeWeapon(ctx, b) {
  // Freight Shipping slam hitbox: Express herself + original FX are drawn by express76-skill.js.
  if (b.nativeKey === 'express76-slam') return true;
  const entry = texGet(b.nativeKey);
  if (!entry) return false;
  if (b.nativeKey === 'lrl-skill1-clone') {
    const frame = Math.min(12, Math.floor(b.age * 18) % 13);
    const sx = (frame % 4) * 192, sy = Math.floor(frame / 4) * 192;
    const size = b.cloneSize || 118;
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.globalCompositeOperation = 'lighter';
    for (const [back, alpha] of [[44, .12], [23, .22]]) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(entry.texture, sx, sy, 192, 192,
        -size / 2 - back, -size / 2, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .67;
    ctx.drawImage(entry.image, sx, sy, 192, 192, -size / 2, -size / 2, size, size);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .39;
    ctx.drawImage(entry.texture, sx, sy, 192, 192, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  if (b.nativeKey === 'lrl-arrow') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    const length = 30 + b.powerLevel * 3;
    ctx.shadowColor = '#ff415d'; ctx.shadowBlur = 7;
    ctx.drawImage(entry.image, -length / 2, -3.5, length, 7);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffbc91';
    ctx.fillRect(-length * 0.13, -0.65, length * 0.43, 1.3);
    ctx.fillStyle = '#fff2d9';
    ctx.fillRect(length * 0.31, -0.75, 3, 1.5);
    ctx.restore(); return true;
  }
  if (b.nativeKey === 'lrl-axe') { drawLrlAxe(ctx, b, entry); return true; }
  if (b.nativeKey === 'lrl') { drawLrlFlight(ctx, b, entry); return true; }
  const key = b.nativeKey, r = b.r, power = b.powerLevel || 1;
  const frames = NATIVE_SHOT_FRAMES[key];
  if (!frames?.length) return false;
  // Keep the strong early animation cells; faded tail cells are impact-only art.
  const frame = frames[Math.floor(b.age * 18) % Math.min(frames.length, key === 'hirume' ? 4 : 6)];
  const stamp = (w, h, angle = 0, x = 0, y = 0, alpha = 1, original = false) => {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.globalAlpha *= alpha;
    ctx.drawImage(original ? entry.image : entry.texture, ...frame, -w/2, -h/2, w,h);
    ctx.restore();
  };
  ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(Math.atan2(b.vy,b.vx));
  switch (key) {
    case 'hirume':
      stamp(r*3.4,r*3.7,0,-r*0.65,0,0.3);
      stamp(r*2.6,r*3.0);
      stamp(r*1.5,r*1.75,0,r*0.14,0,0.88,true);
      break;
    case 'constantia':
      stamp(Math.max(20,r*5.2),Math.max(5,r*1.5));
      break;
    case 'merlin':
      ctx.shadowColor = '#ffae69'; ctx.shadowBlur = 4;
      stamp(25+power*4,10+power*1.2);
      break;
    case 'griffin':
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#ff6a2c'; ctx.shadowBlur = 6;
      stamp(32+power*5,14+power*1.6,0,-6,0,0.35);
      stamp(28+power*4,12+power*1.3);
      stamp(20+power*3,8+power,0,4,0,0.9,true);
      break;
    case 'fafnir':
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#76dcff'; ctx.shadowBlur = 5;
      stamp(30+power*4,18+power*1.5,0,-15,0,0.28);
      stamp(28+power*4,18+power*1.5);
      stamp(28+power*4,18+power*1.5);
      break;
    case 'eternity':
      stamp(18+power*2.8,5+power*0.5,Math.PI);
      break;
    case 'labiata':
      stamp(r*2.8,r*1.6,-Math.PI/2);
      stamp(r*2.1,r*0.9,-Math.PI/2,0,0,0.9,true);
      break;
    case 'emily': {
      const length=Math.min(b.beamLength,30+b.age*Math.hypot(b.vx,b.vy));
      stamp(length,r*2.9,Math.PI,-length/2);
      stamp(length,r*1.15,Math.PI,-length/2,0,0.85,true);
      break;
    }
  }
  ctx.restore();
  return true;
}
