// Per-shot-type hit effects from each pilot's original FX sheets (assets/native-shots), so
// every basic shot reads differently on contact instead of one shared white glint:
//   Griffin P-38 vulcan   orange starburst + metal spark spray (griffin-fx-skill2hit)
//   Sleipnir Shinden      lavender flame-blade slash sparks (sleipnir-fx-hit)
//   Express 76 pellets    white impact pop + twinkle (express76-fx-impact / -bling)
//   Constantia Marion     pink magic burst (constantia-fx-bitehit, tinted) + twinkle
//   Labiata Hayate        cyan crystal ring flash (labiata-fx-baghit, tinted)
//   Peregrinus falcon     green electric crackle + strike flash (peregrinus-fx-zizic / -pang)
// Sub weapons: Sleipnir heat missiles (flame burst), Constantia hearts, Labiata syusui.
// Beams: Express 76 sub laser (blue burn splash), Peregrinus spiral laser (green crackle).
// LRL keeps its own cut sheet (native-weapon-fx.js). Sheets are owned by the pilot, so they
// are already loaded for the sortie. Bounded pool, advanced by sim time.
import { drawCell } from './run-fx.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { prefersLowEndGfx } from './mobile.js';

// key -> grid: cols, cell w / h, playable frames.
const GRID = {
  'griffin-fx-skill2hit': [4, 192, 192, 12],
  'sleipnir-fx-hit': [3, 160, 160, 9],
  'express76-fx-impact': [3, 192, 192, 8],
  'express76-fx-bling': [3, 128, 128, 6],
  'constantia-fx-bitehit': [4, 128, 128, 8],
  'labiata-fx-baghit': [4, 192, 192, 13],
  'peregrinus-fx-zizic': [4, 64, 64, 8],
  'peregrinus-fx-pang': [2, 192, 128, 6],
  'lao-fx-spark': [4, 64, 128, 4],
  'sleipnir-fx-flyboom': [4, 192, 192, 12],
  'labiata-fx-hit': [3, 192, 192, 8],
  'peregrinus-fx-glow': [1, 128, 128, 1],
  'lao-fx-shockring': [3, 192, 192, 9],
  'lao-fx-fireline': [1, 256, 64, 1],
  'peregrinus-fx-ring': [1, 128, 128, 1],
  'ramp-fx-sparks': [2, 256, 256, 4],
  'ramp-pf-tyrant-bite': [2, 192, 192, 4],
  'ramp-pf-aeda-hit': [3, 160, 160, 9],
  'ramp-pf-aeda-orb': [1, 96, 96, 1],
  'ramp-pf-golt-hit': [2, 160, 160, 4],
  'ramp-pf-golt-ring': [1, 160, 160, 1],
  'ramp-pf-hest-hit': [2, 160, 160, 6],
  'ramp-pf-roc-hit': [3, 160, 160, 9],
  'ramp-pf-roc-orb': [1, 128, 128, 1],
  'ramp-pf-sb-boom': [3, 192, 192, 9],
  'ramp-pf-shade-hit': [1, 128, 128, 1],
  'ramp-pf-shade-muzzle': [4, 128, 128, 8],
  'ramp-pf-alfred-hit': [2, 160, 160, 4],
};

// Layers per shot style: sheet, size (px), life (s), rotation ('dir' = along the shot,
// 'back' = sprayed back toward the shooter, 'rand'), rotOff (added to rot), tint,
// aspect (h / w), alpha, grow ([start, end] size multiplier over the layer's life).
const RECIPES = {
  p38shot: [
    { key: 'griffin-fx-skill2hit', size: 54, life: 0.24, rot: 'rand' },
    { key: 'lao-fx-spark', size: 30, life: 0.14, rot: 'back', aspect: 2 },
  ],
  shindenshot: [
    { key: 'sleipnir-fx-hit', size: 82, life: 0.26, rot: 'dir' },
  ],
  // Rampalion Lion Buster: its own swirling flame + gold spark burst.
  lionshot: [
    { key: 'ramp-fx-fire', size: 70, life: 0.26, rot: 'rand' },
    { key: 'ramp-fx-sparks', size: 56, life: 0.18, rot: 'rand', tint: '#ffcf6a' },
  ],
  // Express pellets: the impact burst only fills the middle ~45% of its 192px cell, so at
  // 70px it read as a ~30px speck under the purple pellet glow (looked like no hit FX).
  pancakeshot: [
    { key: 'express76-fx-impact', size: 118, life: 0.26, rot: 'rand' },
    { key: 'express76-fx-bling', size: 80, life: 0.3, rot: 'none', alpha: 1 },
  ],
  marionshot: [
    { key: 'constantia-fx-bitehit', size: 66, life: 0.24, rot: 'rand', tint: '#ff7ad0' },
    { key: 'express76-fx-bling', size: 46, life: 0.3, rot: 'none', tint: '#ffd0f0', alpha: 0.9 },
  ],
  hayateshot: [
    { key: 'labiata-fx-baghit', size: 74, life: 0.28, rot: 'dir', tint: '#8ff4ff' },
  ],
  // Sub weapons.
  heatmissile: [
    { key: 'sleipnir-fx-flyboom', size: 58, life: 0.32, rot: 'none' },
  ],
  heartshot: [
    { key: 'constantia-fx-bitehit', size: 52, life: 0.24, rot: 'rand', tint: '#ff4fa8' },
  ],
  syusuishot: [
    { key: 'labiata-fx-hit', size: 64, life: 0.24, rot: 'dir', tint: '#9ff6ff' },
  ],
  // Peregrinus human-form X-36 missiles: a small orange spark spray (no shared white glint).
  x36missile: [
    { key: 'lao-fx-spark', size: 34, life: 0.16, rot: 'back', aspect: 2 },
  ],
  // Beams (damage ticks, spawned at the beam's contact point on the target).
  // Express sub laser: its own burn (not the pellets' impact burst) - a cyan shock
  // crescent bowed toward the beam, a hot flare streak along it, pale sparks thrown back.
  expresslaser: [
    { key: 'lao-fx-shockring', size: 66, life: 0.2, rot: 'dir', rotOff: Math.PI / 2, tint: '#5fc2ff' },
    { key: 'lao-fx-fireline', size: 74, life: 0.12, rot: 'dir', aspect: 0.28, tint: '#a8e2ff' },
    { key: 'lao-fx-spark', size: 26, life: 0.14, rot: 'back', aspect: 2, tint: '#d8f0ff' },
  ],
  // Peregrinus spiral laser: its own burn, apart from the falcon shot's electric crackle -
  // a mint wind ring bowed toward the beam that swells out, a soft core glow, a hot flare.
  spiralbeam: [
    { key: 'peregrinus-fx-ring', size: 84, life: 0.2, rot: 'dir', tint: '#6dffc0', grow: [0.55, 1.15] },
    { key: 'peregrinus-fx-glow', size: 92, life: 0.14, rot: 'none', alpha: 0.8 },
    { key: 'lao-fx-fireline', size: 80, life: 0.1, rot: 'dir', aspect: 0.3, tint: '#9dffd8' },
  ],
  // Rampalion's fused parts (b.hitStyle, rampalion.js PART_WEAPONS): each part's robot's own
  // original hit (tools/import-rampalion-part-fx.py).
  'ramp-tyrant': [
    { key: 'ramp-pf-tyrant-bite', size: 84, life: 0.3, rot: 'dir' },
    { key: 'ramp-fx-sparks', size: 52, life: 0.18, rot: 'rand', tint: '#ff9a3c' },
  ],
  'ramp-aeda': [
    { key: 'ramp-pf-aeda-hit', size: 76, life: 0.3, rot: 'rand' },
    { key: 'ramp-pf-aeda-orb', size: 44, life: 0.12, rot: 'none', alpha: 0.9 },
  ],
  'ramp-golt': [
    { key: 'ramp-pf-golt-hit', size: 78, life: 0.32, rot: 'rand' },
    { key: 'ramp-pf-golt-ring', size: 64, life: 0.22, rot: 'none', grow: [0.5, 1.25], alpha: 0.9 },
  ],
  'ramp-hest': [
    { key: 'ramp-pf-hest-hit', size: 82, life: 0.3, rot: 'dir' },
  ],
  'ramp-roc': [
    { key: 'ramp-pf-roc-hit', size: 74, life: 0.26, rot: 'rand' },
    { key: 'ramp-pf-roc-orb', size: 40, life: 0.1, rot: 'rand', alpha: 0.85 },
  ],
  'ramp-sb': [
    { key: 'ramp-pf-sb-boom', size: 96, life: 0.42, rot: 'rand' },
  ],
  'ramp-shade': [
    { key: 'ramp-pf-shade-hit', size: 30, life: 0.12, rot: 'rand' },
    { key: 'ramp-pf-shade-muzzle', size: 36, life: 0.1, rot: 'back' },
  ],
  'ramp-alfred': [
    { key: 'ramp-pf-alfred-hit', size: 70, life: 0.28, rot: 'rand' },
  ],
  falconshot: [
    { key: 'peregrinus-fx-zizic', size: 58, life: 0.22, rot: 'rand' },
    { key: 'peregrinus-fx-pang', size: 46, life: 0.16, rot: 'dir', aspect: 0.67, tint: '#7dffc4' },
  ],
};

export function hasHitRecipe(style) {
  return !!RECIPES[style];
}

const _tints = new Map();
function sheetImage(key, tint) {
  const img = getNativeWeaponImage(key);
  if (!img || !(img.naturalWidth || img.width)) return null;
  if (!tint) return img;
  const id = `${key}|${tint}`;
  let c = _tints.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.65;
  g.fillStyle = tint;
  g.fillRect(0, 0, c.width, c.height);
  _tints.set(id, c);
  return c;
}

const MAX = 48;

export class HitFx {
  constructor() {
    this.list = [];
    this._frameSpawns = 0;
  }

  /** Hit by bullet b at point (x, y); `kill` makes the burst 40% bigger. */
  spawn(b, x, y, kill = false) {
    const recipe = RECIPES[b.hitStyle || b.style];
    if (!recipe) return;
    // Fast guns at Lv5 land many hits per frame: cap new bursts per frame (low-end phones:
    // 2 per frame, main layer only).
    const low = prefersLowEndGfx();
    if (this._frameSpawns >= (low ? 2 : 5)) return;
    this._frameSpawns += 1;
    const dir = Math.atan2(b.vy || 0, b.vx || 1);
    const scale = (kill ? 1.4 : 1) * (b.special ? 1.5 : 1) * (0.9 + Math.min(5, b.powerLevel || 1) * 0.04);
    for (const L of (low ? recipe.slice(0, 1) : recipe)) {
      if (this.list.length >= MAX) this.list.shift();
      const rot = (L.rot === 'dir' ? dir : L.rot === 'back' ? dir + Math.PI + (Math.random() - 0.5) * 0.6
        : L.rot === 'rand' ? Math.random() * Math.PI * 2 : 0) + (L.rotOff || 0);
      this.list.push({
        L, x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
        rot, size: L.size * scale, age: 0, life: L.life * (kill ? 1.2 : 1),
      });
    }
  }

  update(dt) {
    this._frameSpawns = 0;
    let n = 0;
    for (const f of this.list) {
      f.age += dt;
      if (f.age < f.life) this.list[n++] = f;
    }
    this.list.length = n;
  }

  clear() {
    this.list.length = 0;
  }

  draw(ctx) {
    if (!this.list.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.list) {
      const g = GRID[f.L.key];
      const img = g && sheetImage(f.L.key, f.L.tint);
      if (!img) continue;
      const k = f.age / f.life;
      const frame = Math.min(g[3] - 1, Math.floor(k * g[3]));
      const grow = f.L.grow ? f.L.grow[0] + (f.L.grow[1] - f.L.grow[0]) * k : 1;
      const w = f.size * grow;
      const h = f.size * grow * (f.L.aspect ?? g[2] / g[1]);
      ctx.globalAlpha = (f.L.alpha ?? 1) * (k > 0.75 ? (1 - k) / 0.25 : 1);
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.rot) ctx.rotate(f.rot);
      // Cells are in source px; images decoded at a lower scale carry image._lo.
      const s = img._lo || 1;
      drawCell(ctx, img, g[0], g[1] * s, g[2] * s, frame, 0, 0, w, h);
      ctx.restore();
    }
    ctx.restore();
  }
}
