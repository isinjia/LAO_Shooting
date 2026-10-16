/**
 * Pooled combat feedback: sparks, explosions, graze glitter, score popups,
 * screen shake, hitstop, and bomb white-flash. Visual/timing only.
 */

import { W, H } from './canvas.js';

const PARTICLE_CAP = 360;
const PARTICLE_CAP_LIGHT = 120;
const POPUP_CAP = 40;
const POPUP_CAP_LIGHT = 20;
/** Cull / skip-draw margin past the 960×540 playfield. */
const FX_PAD = 72;
const POPUP_BMP_CAP = 48;

/** Prebaked warm accents — avoid per-spark `hsl(...)` string churn. */
const WARM_PALETTE = (() => {
  const out = [];
  for (let i = 0; i < 32; i++) {
    const hue = 18 + (i / 31) * 42;
    const lit = 58 + ((i * 7) % 23);
    out.push(`hsl(${hue.toFixed(1)},100%,${lit}%)`);
  }
  return out;
})();

function hslWarm() {
  return WARM_PALETTE[(Math.random() * WARM_PALETTE.length) | 0];
}

/**
 * Fireball sprites: radial gradients baked once per palette and heat stage (0 = white hot
 * .. 3 = cooling ember), drawn scaled - no per-frame gradient building.
 */
const FIRE_PALETTES = {
  fire: [
    ['#ffffff', '#fff6c8', '#ffc24a', 'rgba(255,110,30,0)'],
    ['#fff4c0', '#ffc04a', '#ff7a22', 'rgba(200,40,20,0)'],
    ['#ffb848', '#ff6a22', '#c8301c', 'rgba(90,20,20,0)'],
    ['#ff6a2a', '#b8321e', '#5a1e1a', 'rgba(30,14,14,0)'],
  ],
  rose: [
    ['#ffffff', '#ffe6ee', '#ff8aa8', 'rgba(255,80,120,0)'],
    ['#ffe0ea', '#ff8aa8', '#ff4a78', 'rgba(180,30,70,0)'],
    ['#ff9ab4', '#ff4a78', '#b81e4a', 'rgba(70,10,30,0)'],
    ['#ff5a84', '#a01e44', '#4a1024', 'rgba(20,6,12,0)'],
  ],
};
const _fireSprites = new Map();
function fireSprite(palette, stage) {
  const key = `${palette}|${stage}`;
  let c = _fireSprites.get(key);
  if (c) return c;
  const stops = (FIRE_PALETTES[palette] || FIRE_PALETTES.fire)[stage];
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, stops[0]);
  grd.addColorStop(0.28, stops[1]);
  grd.addColorStop(0.62, stops[2]);
  grd.addColorStop(1, stops[3]);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _fireSprites.set(key, c);
  return c;
}

/** Graze ring colour (mint: unlike the white-rose hit burst or warm kill sparks). */
const GRAZE_RING = '#5dffc8';

const SCORE_POPUPS = false;

export class PolishFx {
  constructor() {
    /** @type {Array<any>} */
    this.pool = [];
    /** @type {Array<any>} */
    this.active = [];
    /** @type {Array<any>} */
    this.popups = [];
    /** @type {Array<any>} */
    this._popupPool = [];
    /** @type {Map<string, { canvas: HTMLCanvasElement, w: number, h: number }>} */
    this._popupBmp = new Map();
    this.shake = 0;
    this.shakeMag = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.combo = 0;
    this.comboTimer = 0;
    /** Peak combo reached this sortie (result screen). */
    this.maxCombo = 0;
    /** Reused by getShakeOffset — avoid per-frame {x,y} allocation. */
    this._shakeOff = { x: 0, y: 0 };
    /** Fewer particles / softer shake on phones. */
    this.light = false;
    /** Active pilot kit palette — tints hit/kill sparks beyond generic warm flash. */
    this.kitColor = '#ffe08a';
    this.kitGlow = '#ffab52';
    this.kitStyle = 'orb';
  }

  setLightMode(on) {
    this.light = !!on;
  }

  /** @param {{ color?: string, glow?: string, style?: string }} [palette] */
  setKitPalette(palette = {}) {
    this.kitColor = palette.color || '#ffe08a';
    this.kitGlow = palette.glow || palette.color || '#ffab52';
    this.kitStyle = palette.style || 'orb';
  }

  _particleCap() {
    return this.light ? PARTICLE_CAP_LIGHT : PARTICLE_CAP;
  }

  _popupCap() {
    return this.light ? POPUP_CAP_LIGHT : POPUP_CAP;
  }

  clear() {
    while (this.active.length) this.pool.push(this.active.pop());
    while (this.popups.length) this._popupPool.push(this.popups.pop());
    this.shake = 0;
    this.shakeMag = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
  }

  _alloc() {
    return this.pool.pop() || {
      kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0,
      r: 2, color: '#fff', drag: 0.9, grav: 0, rot: 0, spin: 0, expand: 180,
      stretch: 1, rampHot: '', rampCool: '',
    };
  }

  _emit(partial) {
    const cap = this._particleCap();
    if (this.active.length >= cap) {
      // Drop oldest without O(n) shift — dense chip storms paid this every spawn.
      const old = this.active[0];
      this.active[0] = this.active[this.active.length - 1];
      this.active.pop();
      this.pool.push(old);
    }
    const p = this._alloc();
    p.kind = partial.kind || 'spark';
    p.x = partial.x; p.y = partial.y;
    p.vx = partial.vx || 0; p.vy = partial.vy || 0;
    p.life = partial.life; p.max = partial.life;
    p.r = partial.r ?? 2;
    p.color = partial.color || '#fff';
    p.drag = partial.drag ?? 0.92;
    p.grav = partial.grav ?? 0;
    p.rot = partial.rot || 0;
    p.spin = partial.spin || 0;
    p.expand = partial.expand ?? 180;
    p.stretch = partial.stretch ?? 1;
    p.rampHot = partial.rampHot || '';
    p.rampCool = partial.rampCool || '';
    p.grow = partial.grow ?? 0;
    p.palette = partial.palette || 'fire';
    p.width = partial.width ?? 3;
    p.aura = !!partial.aura;
    this.active.push(p);
  }

  addShake(mag, duration = 0.18) {
    const m = this.light ? mag * 0.55 : mag;
    this.shakeMag = Math.max(this.shakeMag, m);
    this.shake = Math.max(this.shake, duration);
  }

  addHitstop(t = 0.04) {
    this.hitstop = Math.max(this.hitstop, t);
  }

  addFlash(t = 0.12) {
    this.flash = Math.max(this.flash, t);
  }

  hitSpark(x, y, n = 5) {
    // Soft flash + velocity sparks — elongated additive chips, not circle blobs / geometry.
    // count / fine / drag frozen — tip-forward stretch + cool #fffef8 only (no dens churn).
    const cap = this._particleCap();
    const load = this.active.length / cap;
    const scale = this.light ? 0.5 : 1;
    const count = Math.max(4, Math.round(n * 1.65 * scale * (load > 0.7 ? 0.4 : load > 0.45 ? 0.65 : 1)));
    const accent = this.kitColor || '#fff8dc';
    const glow = this.kitGlow || accent;
    const plasma = this.kitStyle === 'lightning' || this.kitStyle === 'jupiterorb'
      || this.kitStyle === 'teslabeam' || this.kitStyle === 'chainarc';
    this._emit({
      kind: 'flash', x, y, vx: 0, vy: 0,
      life: this.light ? 0.06 : 0.09,
      r: 5 + count * 0.28,
      color: accent, drag: 1, grav: 0,
    });
    this._emit({
      kind: 'flash', x, y, vx: 0, vy: 0,
      life: this.light ? 0.04 : 0.065,
      r: 2.4 + count * 0.14,
      // Cool tip flash (was pure #ffffff — match wipe/graze #fffef8 language).
      color: '#fffef8', drag: 1, grav: 0,
    });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.55;
      const sp = 150 + Math.random() * 300;
      const smoke = !this.light && i % 5 === 0;
      // Fine grit needles + brighter chips (same emit budget — quality, not dens churn).
      const fine = !smoke && i % 3 !== 0;
      const r = smoke
        ? 3.2 + Math.random() * 4.5
        : (fine ? 0.4 + Math.random() * 1.15 : 0.85 + Math.random() * 2.4);
      this._emit({
        kind: smoke ? 'smoke' : 'spark',
        x: x + (Math.random() - 0.5) * 3,
        y: y + (Math.random() - 0.5) * 3,
        vx: Math.cos(a) * sp * (smoke ? 0.32 : 1),
        vy: Math.sin(a) * sp * (smoke ? 0.32 : 1) - (smoke ? 12 : 0),
        life: (smoke ? 0.26 : 0.08) + Math.random() * (smoke ? 0.18 : 0.12),
        r,
        color: i % 3 === 0 ? '#fffef8' : (i % 2 === 0 ? accent : (plasma ? glow : hslWarm())),
        drag: smoke ? 0.9 : (fine ? 0.74 : 0.78), grav: smoke ? -8 : 10,
        // Tip-forward stretch: fine 2.65+ / soft 1.85+ (was 2.35/1.85 muddier soft disks).
        stretch: smoke ? 1 : (fine ? 2.65 + Math.random() * 2.4 : 1.85 + Math.random() * 1.6),
        rampHot: '#fffef8',
        rampCool: glow,
      });
    }
    this._kitHitAccent(x, y, load);
  }

  /** Extra kit-colored motes — still particles, never geometric marks. */
  _kitHitAccent(x, y, load = 0) {
    if (this.light || load > 0.8) return;
    const style = this.kitStyle || 'orb';
    const accent = this.kitColor || '#ffe08a';
    const glow = this.kitGlow || accent;
    const plasma = style === 'lightning' || style === 'jupiterorb' || style === 'teslacoil'
      || style === 'empfield' || style === 'teslabeam' || style === 'chainarc';
    const fire = style === 'foxflame' || style === 'flameward';
    const holdFan = style === 'sunbird';
    const crescent = style === 'plasmaslash' || style === 'plasmacross';
    const axe = style === 'dragonaxe' || style === 'cleave';
    const lance = style === 'sightbeam';
    const slug = style === 'tracer' || style === 'lockround';
    const spike = style === 'railbolt';
    const arty = style === 'shell';
    const hmg = style === 'coffinround';
    const n = plasma || holdFan || crescent || fire ? 8 : (hmg ? 8 : axe || arty || slug ? 6 : lance || spike ? 4 : 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (spike ? 250 : (lance ? 220 : slug ? 140 : hmg ? 185 : (plasma ? 170 : axe ? 95 : arty ? 70 : fire ? 80 : 90)))
        + Math.random() * (hmg ? 90 : arty || fire || slug ? 70 : 120);
      const forward = lance || hmg || spike;
      let vx; let vy;
      if (spike) {
        const ang = (Math.random() - 0.5) * 0.12;
        vx = Math.cos(ang) * sp;
        vy = Math.sin((Math.random() - 0.5) * 0.12) * sp * 0.28;
      } else if (lance) {
        const ang = (Math.random() - 0.5) * 0.2;
        vx = Math.cos(ang) * sp;
        vy = Math.sin((Math.random() - 0.5) * 0.16) * sp * 0.55;
      } else if (hmg) {
        const ang = (Math.random() - 0.5) * 0.92;
        vx = Math.cos(ang) * sp;
        vy = Math.sin((Math.random() - 0.5) * 0.68) * sp;
      } else if (forward) {
        const ang = (Math.random() - 0.5) * 0.4;
        vx = Math.cos(ang) * sp;
        vy = Math.sin((Math.random() - 0.5) * 0.35) * sp;
      } else if (crescent) {
        const ang = (Math.random() - 0.5) * Math.PI;
        vx = Math.cos(ang) * sp * (0.45 + Math.random() * 0.95);
        vy = Math.sin(ang) * sp * 1.32;
      } else if (axe) {
        const ang = a * 0.48 + (Math.random() - 0.5) * 0.7;
        vx = Math.cos(ang) * sp;
        vy = Math.sin(ang) * sp * 0.68;
      } else {
        vx = Math.cos(a) * sp;
        vy = Math.sin(a) * sp - (holdFan ? 52 : fire ? 14 : arty ? 34 : 0);
      }
      this._emit({
        kind: (holdFan || arty) && i % 3 === 0 ? 'smoke' : 'spark',
        x, y, vx, vy,
        life: 0.09 + Math.random() * (plasma ? 0.16 : hmg ? 0.06 : arty ? 0.18 : 0.12),
        r: 0.6 + Math.random() * (plasma ? 2.6 : axe ? 3.4 : spike ? 1.2 : lance ? 1.5 : hmg ? 1.7 : holdFan ? 2.6 : 2.0),
        color: i % 2 ? accent : (plasma ? '#edffff' : glow),
        drag: 0.76, grav: holdFan ? -32 : (fire ? -8 : (plasma ? -2 : arty ? -18 : hmg ? 6 : axe ? 12 : 6)),
        stretch: (spike ? 3.6 : lance ? 3.0 : crescent ? 3.2 : hmg ? 1.25 : axe ? 1.25 : 1.8) + Math.random() * (hmg ? 1.1 : 2.6),
        rampHot: plasma ? '#edffff' : '#fffef8',
        rampCool: glow,
      });
    }
  }

  explosion(x, y, scale = 1) {
    // Soft core flash + mote/smoke burst — no cross / slash / chunk geometry.
    const cap = this._particleCap();
    const load = this.active.length / cap;
    const lightMul = this.light ? 0.48 : 1;
    const n = Math.max(6, Math.round((12 + scale * 10) * lightMul * (load > 0.7 ? 0.5 : load > 0.45 ? 0.72 : 1)));
    const accent = this.kitColor || '#ffe08a';
    const glow = this.kitGlow || accent;
    this._emit({
      kind: 'flash', x, y, vx: 0, vy: 0,
      life: 0.12 + 0.04 * scale,
      r: 10 + scale * 8,
      color: '#fff8e0', drag: 1, grav: 0,
    });
    this._emit({
      kind: 'flash', x, y, vx: 0, vy: 0,
      life: 0.08 + 0.03 * scale,
      r: 5 + scale * 3,
      // Cool tip flash (was pure #ffffff — match wipe/graze #fffef8 language).
      color: '#fffef8', drag: 1, grav: 0,
    });
    if (!this.light) {
      this._emit({
        kind: 'smoke', x, y, vx: 0, vy: -8,
        life: 0.36 + 0.08 * scale, r: 8 * scale,
        color: glow, drag: 0.94, grav: -12,
      });
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const sp = (100 + Math.random() * 240) * (0.75 + scale * 0.35);
      const smoke = !this.light && i % 4 === 0;
      // Fine grit + brighter chips (same n budget — soft streak language, not dens churn).
      // n / fine / drag frozen — tip-forward stretch + cool #fffef8 only (no dens churn).
      const fine = !smoke && i % 3 !== 0;
      const tipChip = !smoke && Math.random() < 0.28;
      this._emit({
        kind: smoke ? 'smoke' : 'spark',
        x: x + (Math.random() - 0.5) * 6 * scale,
        y: y + (Math.random() - 0.5) * 6 * scale,
        vx: Math.cos(a) * sp * (smoke ? 0.4 : 1),
        vy: Math.sin(a) * sp * (smoke ? 0.4 : 1) - 16,
        life: (smoke ? 0.3 : (fine ? 0.09 : 0.11)) + Math.random() * 0.2 * scale,
        r: (smoke
          ? 3.2 + Math.random() * 4.2
          : (fine ? 0.45 + Math.random() * 1.15 : 0.85 + Math.random() * 2.5)) * scale,
        color: tipChip || i % 3 === 0 ? '#fffef8' : (i % 2 === 0 ? accent : (smoke ? glow : hslWarm())),
        drag: smoke ? 0.9 : (fine ? 0.74 : 0.78), grav: smoke ? -10 : 12,
        // Tip-forward stretch: fine 2.65+ / soft 1.85+ (was 2.4/1.85 muddier soft disks).
        stretch: smoke ? 1 : (fine ? 2.65 + Math.random() * 2.4 : 1.85 + Math.random() * 1.6),
        rampHot: '#fffef8',
        rampCool: glow,
      });
    }
    this._blastLayers(x, y, scale, 'fire', load);
    // The original LAO explosion sheet under the procedural layers (Game wires onBlast).
    if (this.onBlast && scale >= 0.8 && load < 0.85) this.onBlast(x, y, scale);
    this._kitHitAccent(x, y, load);
  }

  /**
   * Commercial-style blast body shared by kills and the ship hit: rolling fireballs that cool
   * from white to ember, a shockwave ring, long-lived embers that arc down, and dark smoke
   * that lingers after the fire.
   */
  _blastLayers(x, y, scale, palette = 'fire', load = 0) {
    const lite = this.light || load > 0.75;
    const balls = lite ? 2 : Math.round(3 + scale * 1.6);
    for (let i = 0; i < balls; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = i === 0 ? 0 : (9 + Math.random() * 12) * scale;
      const sp = (i === 0 ? 0 : 55 + Math.random() * 60) * scale;
      this._emit({
        kind: 'fireball', palette,
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
        life: (0.34 + Math.random() * 0.18) * (0.85 + scale * 0.15),
        r: (i === 0 ? 9 : 4 + Math.random() * 4) * scale,
        grow: (i === 0 ? 42 : 22 + Math.random() * 18) * scale,
        drag: 0.9, grav: -16,
      });
    }
    this._emit({
      kind: 'fireball', palette, x, y, vx: 0, vy: -6,
      life: 0.42 + 0.06 * scale, r: 16 * scale, grow: 40 * scale, drag: 0.9, grav: 0,
      aura: true,
    });
    this._emit({
      kind: 'shock', x, y, vx: 0, vy: 0,
      life: 0.3 + 0.05 * scale, r: 5 * scale, grow: 260 * Math.sqrt(scale),
      width: 2.4 + scale * 0.6,
      color: palette === 'rose' ? '#ff8aa8' : '#ffd890', drag: 1, grav: 0,
    });
    if (lite) return;
    const embers = Math.round(5 + scale * 3);
    for (let i = 0; i < embers; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const sp = (80 + Math.random() * 130) * (0.8 + scale * 0.25);
      this._emit({
        kind: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.3, r: 1.4 + Math.random() * 1.4,
        color: palette === 'rose' ? '#ff9ab4' : '#ffb04a', drag: 0.94, grav: 200,
        stretch: 1.6, rampHot: '#fff6d8', rampCool: palette === 'rose' ? '#c8305a' : '#e2501e',
      });
    }
    for (let i = 0; i < (scale > 1.5 ? 3 : 2); i++) {
      this._emit({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 12 * scale, y: y + (Math.random() - 0.5) * 8 * scale,
        vx: (Math.random() - 0.5) * 30, vy: -18 - Math.random() * 16,
        life: 0.62 + Math.random() * 0.3, r: (7 + Math.random() * 5) * scale,
        color: '#3a3338', drag: 0.95, grav: -10,
      });
    }
  }

  /**
   * Graze mark: one thin mint ring that opens where the bullet slipped past. Hollow outline,
   * own colour, no flash / white core / shake: it can't be mistaken for the ship being hit
   * (that is the filled white-rose burst + shake of notePlayerHit). Silent.
   */
  grazeSpark(x, y) {
    const cap = this._particleCap();
    if (this.active.length > cap * 0.85) return;
    this._emit({
      kind: 'ring', x, y, vx: 0, vy: 0,
      life: 0.28, r: 3, grow: 46,
      color: GRAZE_RING, drag: 1, grav: 0,
    });
  }

  /** Bomb/cancel mote — 1 spark so dense wipes don't flood PARTICLE_CAP. */
  wipeSpark(x, y, tint = null) {
    // Soft elongated chip + tip-hot ramp (still one emit — quality, not dens churn).
    // Single-emit frozen — tip-forward stretch + cool #fffef8 only (no dens churn).
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const fine = Math.random() < 0.62;
    const sp = (fine ? 62 : 48) + Math.random() * (fine ? 85 : 65);
    const cool = tint || (Math.random() < 0.5 ? '#e8f6ff' : '#ffe08a');
    const tipChip = Math.random() < 0.28;
    this._emit({
      kind: 'spark', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (fine ? 30 : 22),
      life: 0.14 + Math.random() * (fine ? 0.12 : 0.16),
      r: fine ? 0.5 + Math.random() * 0.85 : 1.2 + Math.random() * 1.3,
      color: tipChip ? '#fffef8' : cool,
      drag: fine ? 0.82 : 0.86, grav: -18,
      // Tip-forward stretch: fine 2.65+ / soft 1.85+ (was 2.45/1.55 muddier soft disks).
      stretch: fine ? 2.65 + Math.random() * 2.4 : 1.85 + Math.random() * 1.6,
      rampHot: '#fffef8',
      rampCool: cool,
    });
  }

  scorePopup(x, y, value, { combo = 0, big = false } = {}) {
    // Floating numbers off (user: kill / pickup scores read as damage numbers); the score
    // still counts on the HUD.
    if (!SCORE_POPUPS) return;
    const cap = this._popupCap();
    if (this.popups.length >= cap) {
      const old = this.popups[0];
      this.popups[0] = this.popups[this.popups.length - 1];
      this.popups.pop();
      if (old) this._popupPool.push(old);
    }
    const label = combo > 1 ? `${value}  ×${combo}` : `+${value}`;
    const color = big ? '#ffe08a' : combo > 4 ? '#ffb0c0' : '#e8f4ff';
    const p = this._popupPool.pop() || {
      x: 0, y: 0, label: '', age: 0, life: 0.7, big: false, color: '#e8f4ff', bmpKey: '',
    };
    p.x = x + (Math.random() - 0.5) * 10;
    p.y = y - 10;
    p.label = label;
    p.age = 0;
    p.life = big ? 1.1 : 0.7;
    p.big = big;
    p.color = color;
    p.bmpKey = `${big ? 1 : 0}|${color}|${label}`;
    this.popups.push(p);
  }

  /** Bake dual-stroke score label once per label/color/size class. */
  _popupBitmap(key, label, color, big) {
    let bmp = this._popupBmp.get(key);
    if (bmp) return bmp;
    const size = big ? 19 : 13.5;
    const pad = 6;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = `bold ${Math.round(size)}px "Chakra Petch", "Malgun Gothic", sans-serif`;
    const tw = Math.ceil(g.measureText(label).width);
    const th = Math.ceil(size * 1.35);
    c.width = tw + pad * 2;
    c.height = th + pad * 2 + (big ? 2 : 0);
    g.font = `bold ${Math.round(size)}px "Chakra Petch", "Malgun Gothic", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cx = c.width / 2;
    const cy = c.height / 2 + (big ? 0.25 : 0);
    g.lineWidth = 3.5;
    g.strokeStyle = 'rgba(4,8,16,0.9)';
    g.strokeText(label, cx, cy);
    g.fillStyle = color;
    g.fillText(label, cx, cy);
    if (big) {
      g.globalAlpha = 0.45;
      g.fillStyle = '#fff8e0';
      g.fillText(label, cx, cy - 0.5);
      g.globalAlpha = 1;
    }
    bmp = { canvas: c, w: c.width, h: c.height };
    if (this._popupBmp.size >= POPUP_BMP_CAP) this._popupBmp.clear();
    this._popupBmp.set(key, bmp);
    return bmp;
  }

  noteKill(score, x, y, { boss = false, soft = false } = {}) {
    this.comboTimer = 1.6;
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const bonus = Math.floor(score * Math.min(0.35, (this.combo - 1) * 0.04));
    const shown = score + bonus;
    const c = this.combo;
    // Soft (X pack wipe): keep score math, but don't stamp a popup/explosion per corpse.
    const showPopup = !soft || boss || c <= 6 || (c % 3) === 0;
    if (showPopup) {
      this.scorePopup(x, y, shown, { combo: c, big: boss || c >= 8 });
    }
    if (boss) {
      this.explosion(x, y, 2.2);
      if (!soft) {
        this.addShake(10, 0.35);
        this.addHitstop(0.08);
      }
    } else if (!soft) {
      this.explosion(x, y, 1);
      // Wave wipes chained 28ms freezes every death — hitch only the first hits.
      this.addShake(c <= 3 ? 2.5 : 1.1, c <= 3 ? 0.1 : 0.06);
      if (c <= 2) this.addHitstop(0.028);
      else if (c === 3) this.addHitstop(0.012);
    } else if (c <= 4 || (c % 2) === 0) {
      // Dense X chains used to enqueue a full soft explosion per kill before PARTICLE_CAP shed.
      this.explosion(x, y, c <= 3 ? 0.7 : 0.45);
    }
    return bonus;
  }

  noteHit(x, y) {
    this.hitSpark(x, y, 6);
    // Continuous boss chip used to pin a constant micro-shake under autofire.
    if (this.shake < 0.03) this.addShake(0.9, 0.045);
  }

  noteBomb() {
    this.addFlash(0.22);
    this.addShake(14, 0.45);
    this.addHitstop(0.06);
  }

  /** Special (C) — punch without freezing the field (X bomb owns hitstop). */
  noteSpecial(level = 1) {
    const lv = Math.max(1, Math.min(3, level | 0));
    this.addFlash(0.06 + lv * 0.03);
    this.addShake(3.5 + lv * 2.2, 0.14 + lv * 0.04);
  }

  notePlayerHit(x, y) {
    // Distinct from kit kill booms: cool-white shatter + rose sting (still soft sprites).
    // Deathbomb grace is wall-clock — keep hitstop short so the X window stays usable.
    const cap = this._particleCap();
    const load = this.active.length / cap;
    const scale = this.light ? 0.55 : 1;
    const loadMul = load > 0.7 ? 0.45 : load > 0.45 ? 0.7 : 1;
    const n = Math.max(8, Math.round(18 * scale * loadMul));
    // Hot core + rose sting bloom (≠ warm kit explosion palette).
    this._emit({
      kind: 'flash', x, y, vx: 0, vy: 0,
      life: this.light ? 0.08 : 0.12,
      r: 14 * scale,
      color: '#fff8f2', drag: 1, grav: 0,
    });
    this._emit({
      kind: 'flash', x, y, vx: 0, vy: 0,
      life: this.light ? 0.055 : 0.085,
      r: 7 * scale,
      color: '#ff6b8a', drag: 1, grav: 0,
    });
    this._emit({
      kind: 'flash', x, y, vx: 0, vy: 0,
      life: this.light ? 0.04 : 0.06,
      r: 3.2 * scale,
      color: '#ffffff', drag: 1, grav: 0,
    });
    this._blastLayers(x, y, 1.35, 'rose', load);
    if (!this.light && load < 0.75) {
      this._emit({
        kind: 'smoke', x, y, vx: 0, vy: -10,
        life: 0.32, r: 9,
        color: '#c87890', drag: 0.93, grav: -14,
      });
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const sp = (220 + Math.random() * 320) * scale;
      const smoke = !this.light && i % 6 === 0;
      // Tip-forward shatter grit (n / loadMul budget frozen — no dens churn).
      const fine = !smoke && i % 3 !== 0;
      this._emit({
        kind: smoke ? 'smoke' : 'spark',
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(a) * sp * (smoke ? 0.28 : 1),
        vy: Math.sin(a) * sp * (smoke ? 0.28 : 1) - (smoke ? 18 : 8),
        life: (smoke ? 0.28 : 0.09) + Math.random() * (smoke ? 0.16 : 0.11),
        r: smoke
          ? 3.4 + Math.random() * 3.8
          : (fine ? 0.45 + Math.random() * 1.1 : 0.9 + Math.random() * 2.2),
        color: smoke
          ? '#b86880'
          : (i % 4 === 0 ? '#fffef8' : i % 2 === 0 ? '#ffe8ee' : '#ff7a96'),
        drag: smoke ? 0.9 : 0.72, grav: smoke ? -10 : 18,
        stretch: smoke ? 1 : (fine ? 2.65 + Math.random() * 2.6 : 1.85 + Math.random() * 2.0),
        rampHot: '#fffef8',
        rampCool: '#ff6b8a',
      });
    }
    this.addShake(12, 0.4);
    this.addHitstop(0.055);
    this.addFlash(0.1);
  }

  _tickVisuals(dt) {
    // Swap-remove — dense kill chains used to pay O(n) splice per expired spark.
    let write = 0;
    const active = this.active;
    const xMin = -FX_PAD;
    const xMax = W + FX_PAD;
    const yMin = -FX_PAD;
    const yMax = H + FX_PAD;
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      p.life -= dt;
      if (p.kind === 'flash') {
        p.r += 70 * dt;
      } else if (p.kind === 'ring' || p.kind === 'shock') {
        p.r += (p.grow || 40) * dt;
        if (p.kind === 'shock') p.grow *= Math.pow(0.04, dt);
      } else if (p.kind === 'fireball') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.grav * dt;
        p.r += p.grow * dt;
        p.grow *= Math.pow(0.12, dt);
      } else if (p.kind === 'smoke') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.grav * dt;
        p.r += 18 * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.grav * dt;
        p.rot += p.spin * dt;
      }
      if (p.life <= 0) {
        this.pool.push(p);
        continue;
      }
      // Far off-playfield chips never re-enter before life ends — free the slot.
      if (p.kind !== 'flash' && (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax)) {
        this.pool.push(p);
        continue;
      }
      active[write++] = p;
    }
    active.length = write;

    let pWrite = 0;
    const popups = this.popups;
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      p.age += dt;
      p.y -= 38 * dt;
      if (p.age >= p.life) {
        this._popupPool.push(p);
        continue;
      }
      popups[pWrite++] = p;
    }
    popups.length = pWrite;
  }

  /**
   * @returns {number} scaled dt after hitstop (0 while frozen)
   */
  tick(dt) {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      // Still decay flash/shake lightly during freeze for visual continuity
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.5);
      // Combo window is wall-clock — freeze used to pad chains across hitch frames.
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }
      // Sparks/rings keep drifting — a full VFX freeze made short hitstop look broken.
      this._tickVisuals(dt);
      return 0;
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      if (this.shake <= 0) this.shakeMag = 0;
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this._tickVisuals(dt);
    return dt;
  }

  getShakeOffset() {
    const o = this._shakeOff;
    if (this.shake <= 0 || this.shakeMag <= 0) {
      o.x = 0;
      o.y = 0;
      return o;
    }
    const k = Math.min(1, this.shake / 0.12) * this.shakeMag;
    o.x = (Math.random() - 0.5) * 2 * k;
    o.y = (Math.random() - 0.5) * 2 * k;
    return o;
  }

  draw(ctx) {
    const rich = !this.light || this.active.length < 90;
    const prevComp = ctx.globalCompositeOperation;
    let comp = prevComp;
    const setComp = (next) => {
      if (comp === next) return;
      ctx.globalCompositeOperation = next;
      comp = next;
    };
    const xMin = -FX_PAD;
    const xMax = W + FX_PAD;
    const yMin = -FX_PAD;
    const yMax = H + FX_PAD;
    const active = this.active;
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) continue;
      const a = Math.max(0, p.life / p.max);
      // Color ramp: white-hot → kit mid → cool/glow over life (sharper bands).
      let col = p.color;
      if (p.rampHot && p.rampCool) {
        if (a > 0.78) col = p.rampHot;
        else if (a > 0.42) col = p.color || p.rampHot;
        else if (a > 0.22) col = p.color || p.rampCool;
        else col = p.rampCool;
      }
      if (p.kind === 'flash') {
        // Soft bloom flash only — no cross geometry. Additive for punch.
        setComp('lighter');
        ctx.fillStyle = col;
        ctx.globalAlpha = a * 0.16;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 1.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a * 0.62;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = a * 0.95;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        // Graze mark: hollow mint outline (soft halo + crisp line), fading as it opens.
        setComp('lighter');
        ctx.strokeStyle = col;
        ctx.globalAlpha = a * 0.28;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = a * 0.85;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'shock') {
        // Shockwave: a bright ring that thins as it opens, soft outer halo.
        setComp('lighter');
        ctx.strokeStyle = col;
        ctx.globalAlpha = a * 0.3;
        ctx.lineWidth = p.width * 2.6 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = '#fffef4';
        ctx.lineWidth = Math.max(0.8, p.width * a);
        ctx.stroke();
      } else if (p.kind === 'fireball') {
        // Fireball: baked gradient, cools white -> yellow -> orange -> ember with age.
        const age = 1 - a;
        const stage = age < 0.18 ? 0 : age < 0.42 ? 1 : age < 0.7 ? 2 : 3;
        setComp(stage < 3 ? 'lighter' : 'source-over');
        const rr = p.r * 2;
        // Aura variant: a big faint light spill around the blast.
        ctx.globalAlpha = p.aura ? a * 0.28 : Math.min(1, a * 1.6) * (stage < 3 ? 0.95 : 0.75);
        ctx.drawImage(fireSprite(p.palette, stage), p.x - rr, p.y - rr, rr * 2, rr * 2);
      } else if (p.kind === 'smoke') {
        setComp('source-over');
        ctx.fillStyle = col;
        ctx.globalAlpha = a * 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 1.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a * 0.34;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // spark — velocity-aligned soft streak via ellipse rotation (no save/restore).
        setComp('lighter');
        const spd = Math.hypot(p.vx, p.vy);
        const ang = spd > 10 ? Math.atan2(p.vy, p.vx) : (p.rot || 0);
        const rad = p.r * (0.45 + a * 0.65);
        const stretch = (p.stretch || 1) * (1 + Math.min(2.15, spd * 0.01));
        const rx = rad * stretch;
        const tipR = Math.max(0.4, rad * 0.3);
        const tipAlong = rad * 0.28 * stretch;
        const tipX = p.x + Math.cos(ang) * tipAlong;
        const tipY = p.y + Math.sin(ang) * tipAlong;
        ctx.fillStyle = col;
        if (rich) {
          ctx.globalAlpha = a * 0.18;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx * 1.85, rad * 1.85, ang, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = a * 0.9;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, rad, ang, 0, Math.PI * 2);
        ctx.fill();
        // Tip-forward white grit core along stretch axis (matches prior scaled arc).
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = a * 0.96;
        ctx.beginPath();
        ctx.ellipse(tipX, tipY, tipR * stretch, tipR, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = prevComp;
    ctx.globalAlpha = 1;

    const popups = this.popups;
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) continue;
      const t = p.age / p.life;
      const fade = t < 0.1 ? t / 0.1 : t > 0.7 ? (1 - t) / 0.3 : 1;
      const pop = 1 + (t < 0.12 ? (1 - t / 0.12) * 0.28 : 0);
      const bmp = this._popupBitmap(p.bmpKey || `${p.big ? 1 : 0}|${p.color}|${p.label}`, p.label, p.color, p.big);
      const dw = bmp.w * pop;
      const dh = bmp.h * pop;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.drawImage(bmp.canvas, p.x - dw / 2, p.y - dh / 2, dw, dh);
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0) {
      const k = Math.min(0.55, this.flash * 2.8);
      ctx.fillStyle = `rgba(255,250,236,${k})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.fillStyle = `rgba(255,214,150,${k * 0.4})`;
      ctx.fillRect(-20, -20, W + 40, 40);
      ctx.fillRect(-20, H - 20, W + 40, 40);
      ctx.strokeStyle = `rgba(255,236,190,${k * 0.55})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, 944, 524);
    }
  }
}
