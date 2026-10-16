import { NativeShotEffects } from './native-weapon-fx.js';
import { prefersLowEndGfx } from './mobile.js';
import { drawCharacterShot } from './shot-fx.js';

/**
 * Unified enemy danmaku look (all hostile bullets):
 * bright white / pale-hot core + saturated orange-red outer halo — circular orbs.
 * Spawn `color` is ignored for paint so every pattern reads the same.
 * Cached soft-sprites (full + dense/tight) — no per-bullet gradient alloc.
 */
const ENEMY_ORB_PALETTE = {
  core: '#ffffff',
  hot: '#fff6c8',
  mid: '#ff8a28',
  rim: '#ff3a12',
  fade: 'rgba(255,28,8,0)',
};

let _enemyOrbFull = null;
let _enemyOrbTight = null;

function bakeEnemyOrbSprite(tight) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const outer = tight ? 13 : 15;
  const grd = g.createRadialGradient(16, 16, tight ? 0.5 : 1, 16, 16, outer);
  grd.addColorStop(0, ENEMY_ORB_PALETTE.core);
  grd.addColorStop(tight ? 0.22 : 0.16, ENEMY_ORB_PALETTE.hot);
  grd.addColorStop(tight ? 0.52 : 0.42, ENEMY_ORB_PALETTE.mid);
  grd.addColorStop(tight ? 0.82 : 0.72, ENEMY_ORB_PALETTE.rim);
  grd.addColorStop(1, ENEMY_ORB_PALETTE.fade);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(16, 16, outer, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Tinted orb for leader concept colours: white core, `color` halo (cached per colour). */
const _tintOrbs = new Map();
function tintedOrbSprite(color, tight) {
  const key = `${color}|${tight ? 1 : 0}`;
  let c = _tintOrbs.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const outer = tight ? 13 : 15;
  const grd = g.createRadialGradient(16, 16, tight ? 0.5 : 1, 16, 16, outer);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(tight ? 0.24 : 0.18, '#ffffff');
  grd.addColorStop(tight ? 0.52 : 0.44, color);
  grd.addColorStop(tight ? 0.8 : 0.72, color + 'aa');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(16, 16, outer, 0, Math.PI * 2);
  g.fill();
  _tintOrbs.set(key, c);
  return c;
}

function ensureEnemyOrbSprite(tight = false) {
  if (tight) {
    if (!_enemyOrbTight) _enemyOrbTight = bakeEnemyOrbSprite(true);
    return _enemyOrbTight;
  }
  if (!_enemyOrbFull) _enemyOrbFull = bakeEnemyOrbSprite(false);
  return _enemyOrbFull;
}

/**
 * Shared draw helper — every enemy/monster projectile uses this orb.
 * Hitbox stays `r`; draw size is slightly larger for arcade readability.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {{ skipHalo?: boolean }} [opts]
 */
/** Wall-clock seconds for the orb pulse (one read per frame is enough; cheap anyway). */
function orbClock() {
  return performance.now() / 1000;
}

function drawEnemyOrb(ctx, x, y, r, opts = null) {
  const skipHalo = !!(opts && opts.skipHalo);
  const tint = opts && opts.tint;
  const sprite = tint ? tintedOrbSprite(tint, skipHalo) : ensureEnemyOrbSprite(skipHalo);
  // Dense fields use a tighter bake (less soft bloom) + slightly smaller blit.
  // Gentle per-bullet pulse (phase by position) so the field shimmers instead of sitting still.
  const pulse = 1 + 0.06 * Math.sin(orbClock() * 11 + (x + y) * 0.045);
  const size = r * (skipHalo ? 2.5 : 2.85) * pulse;
  ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
}

const POOL_CAP = 512;
/** Soft ceiling for live enemy bullets — cull oldest when patterns spike. */
const ENEMY_LIVE_CAP = 280;
/** Soft ceiling for live friendly shots — charge/special salvos used to runaway-allocate. */
const FRIENDLY_LIVE_CAP = 200;
/** Styles drawn by ProjectileVfx — Set lookup beats per-bullet array.includes. */
const GPU_FRIENDLY_STYLES = new Set([
  'foxflame', 'sunbird', 'flameward', 'sunseal',
  'lockround',
  'cleave', 'dragonaxe',
  'shell', 'commandmissile', 'orbital',
  'lightning', 'chainarc', 'cyclopsbeam',
  'coffinround', 'coffinmissile', 'coffinwall', 'coffinshield',
  'plasmaslash', 'plasmacross', 'swordguard', 'orbitblade',
  'railbolt', 'xenoxcore',
  'jupiterorb', 'empfield', 'teslacoil',
  'railbeam', 'busterbeam', 'sightbeam', 'swordlance', 'teslabeam',
]);
const SPECIAL_SIGNATURE_STYLES = new Set([
  'cyclopsbeam', 'commandmissile', 'teslacoil',
  'coffinmissile', 'plasmacross', 'busterbeam',
]);

function waveAt(age, frequency, shape) {
  const phase = age * frequency;
  return shape === 'triangle' ? 2 / Math.PI * Math.asin(Math.sin(phase)) : Math.sin(phase);
}

/** Cached soft glow sprite per colour for player shots (no per-bullet gradients). */
const _shotHalos = new Map();
function shotHalo(color) {
  let c = _shotHalos.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, color);
  grd.addColorStop(0.35, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 1;
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  _shotHalos.set(color, c);
  return c;
}

/** 보조무기 projectiles: drawn after (above) the main shot. */
const SUB_WEAPON_STYLES = new Set(['heatmissile', 'pancakelaser', 'p38missile', 'syusuishot', 'heartshot', 'x36missile', 'sonicboom']);

export class Bullet {
  constructor(opts = {}) {
    this.reset(opts);
  }

  reset({
    x = 0, y = 0, vx = 0, vy = 0, r = 5, friendly = false, damage = 1,
    color = null, glow = null, style = null, grazeable = true, special = false,
    pierce = false, specialLevel = 0, delay = 0, waveAmplitude = 0, waveFrequency = 14,
    ay = 0, charge = false, homing = 0, lifetime = 0, waveShape = 'sine',
    clearRadius = 0, blastRadius = 0, blastFx = false, beamLength = 0,
    markDuration = 0, rootDuration = 0,
    chainCount = 0, chainRadius = 0, chainOriginX = null, chainOriginY = null,
    homingTarget = null, ignoreEnemy = null,
    orbitOwner = null, orbitOffsetX = 0, orbitOffsetY = 0,
    orbitRadius = 0, orbitAngle = 0, orbitSpeed = 0, orbitAdvanceX = 0,
    returnOwner = null, returnAt = 0, returnSpeed = 0,
    trackXTarget = null, trackXRate = 0, nativeKey = null, powerLevel = 1,
    cloneSize = 0, knockback = 0, invoiceDuration = 0, accel = 0, maxSpeed = 0,
    multiHit = 0, multiHitMax = 0,
    tint = null, hitStyle = null, partGlow = false, pfx = null, homingAfter = 0,
  } = {}) {
    this.tint = tint;
    // Rampalion part shots (rampalion.js PART_WEAPONS): own hit burst, strong halo, sprite.
    this.hitStyle = hitStyle;
    this.partGlow = !!partGlow;
    this.pfx = pfx;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ay = ay;
    this.r = r;
    this.friendly = friendly;
    this.damage = damage;
    this.color = color;
    this.glow = glow || color;
    this.style = style;
    this.nativeKey = nativeKey;
    this.cloneSize = cloneSize;
    // Express 76 Freight Shipping: push-back impulse + Courier Invoice mark.
    this.knockback = knockback;
    this.invoiceDuration = invoiceDuration;
    this.powerLevel = powerLevel;
    this.special = special;
    this.charge = !!charge;
    this.specialLevel = specialLevel;
    this.homing = homing;
    // Homing only from this age on (s): Hyper Rampalion's missiles fan out first (user).
    this.homingAfter = homingAfter;
    // Rocket boost (Griffin P-38 homing missiles): speed ramps up to maxSpeed.
    this.accel = accel;
    this.maxSpeed = maxSpeed;
    // Sleipnir J7W heat missile: drills through, re-hitting the same enemy every
    // `multiHit` s while overlapping (up to multiHitMax hits each), then flies on.
    this.multiHit = multiHit;
    this.multiHitMax = multiHitMax;
    this._drillUntil = 0;
    if (this._multiHitLog) this._multiHitLog.clear();
    else this._multiHitLog = null;
    this.lifetime = lifetime;
    this.clearRadius = clearRadius;
    this.blastRadius = blastRadius;
    this.blastFx = !!blastFx;
    this.beamLength = beamLength;
    this.markDuration = markDuration;
    this.rootDuration = rootDuration;
    this.chainCount = chainCount;
    this.chainRadius = chainRadius;
    this.chainOriginX = chainOriginX;
    this.chainOriginY = chainOriginY;
    this.homingTarget = homingTarget;
    this.ignoreEnemy = ignoreEnemy;
    this.orbitOwner = orbitOwner;
    this.orbitOffsetX = orbitOffsetX;
    this.orbitOffsetY = orbitOffsetY;
    this.orbitRadius = orbitRadius;
    this.orbitAngle = orbitAngle;
    this.orbitSpeed = orbitSpeed;
    this.orbitAdvanceX = orbitAdvanceX;
    this.returnOwner = returnOwner;
    this.returnAt = returnAt;
    this.returnSpeed = returnSpeed;
    this.trackXTarget = trackXTarget;
    this.trackXRate = trackXRate;
    this.delay = Math.max(0, delay);
    this.waveAmplitude = waveAmplitude;
    this.waveFrequency = waveFrequency;
    this.waveShape = waveShape;
    this.pierce = !!pierce;
    this.alive = true;
    this.grazed = false;
    this.grazeable = grazeable && !friendly;
    this.spin = 0;
    this.age = 0;
    this.phase = (x * 0.17 + y * 0.31) % (Math.PI * 2);
    // Reuse the Set across pool lives — pack pierce allocated a fresh Set every shot.
    if (this._pierceHit) this._pierceHit.clear();
    else this._pierceHit = null;
    /** Wall-clock stamp — throttle pierce chip SFX/VFX across multi-hits. */
    this._pierceFx = 0;
    // ProjectileVfx muzzle burst once per life — WeakSet kept pooled instances muted forever.
    this._vfxMuzzle = false;
    // Trail / cloud emitter accumulators — reset so pooled bullets don't inherit drip rate.
    this._trailAcc = 0;
    this._cloudAcc = 0;
  }

  update(dt, targets = null) {
    if (this.delay > 0) {
      const wait = Math.min(dt, this.delay);
      this.delay = Math.max(0, this.delay - wait);
      dt -= wait;
      if (dt <= 0) return;
    }
    const previousAge = this.age;
    this.age += dt;
    if (this.lifetime > 0 && this.age >= this.lifetime) {
      this.alive = false;
      return;
    }
    if (this.orbitOwner && this.orbitRadius > 0) {
      const angle = this.orbitAngle + this.age * this.orbitSpeed;
      this.x = this.orbitOwner.x + this.orbitOffsetX + this.age * this.orbitAdvanceX
        + Math.cos(angle) * this.orbitRadius;
      this.y = this.orbitOwner.y + this.orbitOffsetY + Math.sin(angle) * this.orbitRadius;
      this.vx = this.orbitAdvanceX - Math.sin(angle) * this.orbitRadius * this.orbitSpeed;
      this.vy = Math.cos(angle) * this.orbitRadius * this.orbitSpeed;
      return;
    }
    if (this.returnOwner && this.returnAt > 0 && this.age >= this.returnAt) {
      const dx = this.returnOwner.x - this.x;
      const dy = this.returnOwner.y - this.y;
      const length = Math.hypot(dx, dy) || 1;
      const speed = this.returnSpeed || Math.hypot(this.vx, this.vy);
      this.vx = dx / length * speed;
      this.vy = dy / length * speed;
    }
    if (this._drillUntil > this.age) {
      // Drilling through an enemy: crawl so the multi-hit plays out, then re-boost.
      const sp = Math.hypot(this.vx, this.vy) || 1;
      if (sp > 110) {
        this.vx *= 110 / sp;
        this.vy *= 110 / sp;
      }
    } else if (this.accel > 0) {
      const sp = Math.hypot(this.vx, this.vy) || 1;
      const next = Math.min(this.maxSpeed || sp, sp + this.accel * dt);
      this.vx *= next / sp;
      this.vy *= next / sp;
    }
    if (this.homing > 0 && targets?.length && this.age >= this.homingAfter) {
      let target = this.homingTarget?.alive ? this.homingTarget : null;
      let best = Infinity;
      if (!target) {
        for (const enemy of targets) {
          if (!enemy.alive || enemy.x < this.x - 25 || enemy === this.ignoreEnemy) continue;
          const dx = enemy.x - this.x;
          const dy = enemy.y - this.y;
          const score = dx * dx + dy * dy;
          if (score < best) { best = score; target = enemy; }
        }
      }
      if (target) {
        const speed = Math.hypot(this.vx, this.vy) || 1;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const blend = Math.min(1, this.homing * dt);
        const vx = this.vx * (1 - blend) + dx / len * speed * blend;
        const vy = this.vy * (1 - blend) + dy / len * speed * blend;
        const norm = Math.hypot(vx, vy) || 1;
        this.vx = vx / norm * speed;
        this.vy = vy / norm * speed;
      }
    }
    if (this.trackXTarget?.alive && this.trackXRate > 0) {
      this.x += (this.trackXTarget.x - this.x) * Math.min(1, this.trackXRate * dt);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt + this.ay * dt * dt * 0.5
      + this.waveAmplitude * (
        waveAt(this.age, this.waveFrequency, this.waveShape)
        - waveAt(previousAge, this.waveFrequency, this.waveShape));
    this.vy += this.ay * dt;
    // LRL axe chunks tumble in flight (visual only)
    if (this.style === 'chunk' && this.friendly && !this.special) {
      this.spin += dt * 14;
    }
  }

  /**
   * Rampalion part shots: a strong halo in the part's colour, on low-end phones too (a few
   * shots at a time) - they must read next to the base gun (user). Also drawn for the part
   * shots whose body is on the GPU layer.
   */
  drawPartGlow(ctx) {
    const rr = Math.max(14, Math.min(40, this.r * 4.2));
    const ga = ctx.globalAlpha;
    const gc = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    // Fades in over 0.1 s: a whole volley spawns on one point and its halos stacked to white.
    ctx.globalAlpha = ga * 0.85 * Math.min(1, this.age / 0.1);
    ctx.drawImage(shotHalo(this.glow || this.color || '#9ef0ff'), this.x - rr, this.y - rr, rr * 2, rr * 2);
    ctx.globalAlpha = ga;
    ctx.globalCompositeOperation = gc;
  }

  _drawFriendly(ctx) {
    if (this.partGlow) this.drawPartGlow(ctx);
    // Soft additive glow under canvas-drawn player shots (bloom read like a lit projectile).
    // Low-end phones skip it: one more blend per shot, dozens of shots on screen.
    if (!this.beamLength && !GPU_FRIENDLY_STYLES.has(this.style) && !prefersLowEndGfx()) {
      const rr = Math.max(9, this.r * 3.4);
      const ga = ctx.globalAlpha;
      const gc = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ga * 0.42;
      ctx.drawImage(shotHalo(this.glow || this.color || '#9ef0ff'), this.x - rr, this.y - rr, rr * 2, rr * 2);
      ctx.globalAlpha = ga;
      ctx.globalCompositeOperation = gc;
    }
    drawCharacterShot(ctx, this);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ skipHalo?: boolean }} [opts] dense enemy fields use tighter orb bake
   */
  draw(ctx, opts = null) {
    if (this.delay > 0) return;
    if (this.friendly) {
      this._drawFriendly(ctx);
      return;
    }
    // Hostile shots share one red/white circular orb; leader concept bullets (tint) keep
    // the white core with their own colour halo.
    if (this.tint) drawEnemyOrb(ctx, this.x, this.y, this.r, { skipHalo: !!(opts && opts.skipHalo), tint: this.tint });
    else drawEnemyOrb(ctx, this.x, this.y, this.r, opts);
  }

  offscreen(w, h, margin = 40) {
    // Beam/lance tips lead a long trailing segment. Culling on tip-only margin made
    // Constantia/Labiata/Emily hold shots vanish the moment the tip kissed a wall
    // while most of the beam was still on-screen. Keep them until the whole shaft exits.
    // Player shots that leave the field are gone (they can't hit off-screen anyway).
    if (this.friendly && !this.beamLength && !this.orbitOwner
      && (this.x > w || this.x < 0 || this.y < 0 || this.y > h)) return true;
    let m = margin;
    if (this.beamLength > 0) {
      const spd = Math.hypot(this.vx, this.vy) || 1;
      const len = Math.min(this.beamLength, 30 + this.age * spd);
      m = Math.max(margin, len + margin);
    }
    return (
      this.x < -m ||
      this.x > w + m ||
      this.y < -m ||
      this.y > h + m
    );
  }
}

export class BulletPool {
  constructor() {
    this.list = [];
    this.targets = [];
    this.nativeEffects = new NativeShotEffects();
    /** @type {Bullet[]} */
    this.free = [];
  }

  spawn(opts) {
    if (opts.friendly) this._enforceFriendlyCap();
    else this._enforceEnemyCap();
    const b = this.free.pop() || new Bullet();
    b.reset(opts);
    this.list.push(b);
    this.nativeEffects.emit(b);
    return b;
  }

  /**
   * Soft ceiling: drop bullets that already passed left / aged out,
   * instead of deleting list-head entries (often still near the ship).
   * Single-pass top-N cull — boss rings used to re-scan the whole pool per kill.
   */
  _enforceEnemyCap() {
    this._cullLiveCap({
      friendly: false,
      cap: ENEMY_LIVE_CAP,
      // Prefer left-of-field (already passed) and older bullets; keep delayed telegraphs.
      scoreOf: (b) => (220 - b.x) + b.age * 55 + (b.delay > 0 ? -80 : 0),
    });
  }

  /**
   * Prefer culling aged autofire far ahead; keep delayed special salvos and young charge bolts.
   */
  _enforceFriendlyCap() {
    this._cullLiveCap({
      friendly: true,
      cap: FRIENDLY_LIVE_CAP,
      scoreOf: (b) => b.age * 70 + b.x * 0.15
        + (b.special ? -120 : 0)
        + (b.delay > 0 ? -100 : 0)
        + (b.pierce ? -30 : 0),
    });
  }

  _cullLiveCap({ friendly, cap, scoreOf }) {
    let live = 0;
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      if (b.alive && !!b.friendly === friendly) live += 1;
    }
    if (live < cap) return;
    const need = live - cap + 1;
    const picks = [];
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      if (!b.alive || !!b.friendly !== friendly) continue;
      const score = scoreOf(b);
      if (picks.length < need) {
        picks.push({ i, score });
        if (picks.length === need) picks.sort((a, c) => a.score - c.score);
      } else if (score > picks[0].score) {
        picks[0] = { i, score };
        let k = 0;
        while (k + 1 < picks.length && picks[k].score > picks[k + 1].score) {
          const tmp = picks[k];
          picks[k] = picks[k + 1];
          picks[k + 1] = tmp;
          k += 1;
        }
      }
    }
    for (let p = 0; p < picks.length; p++) this.list[picks[p].i].alive = false;
  }

  _recycle(b) {
    b.alive = false;
    if (this.free.length < POOL_CAP) this.free.push(b);
  }

  update(dt, w, h) {
    this.nativeEffects.update(dt);
    let write = 0;
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.alive) {
        this._recycle(b);
        continue;
      }
      b.update(dt, this.targets);
      if (b.offscreen(w, h)) {
        this._recycle(b);
        continue;
      }
      list[write++] = b;
    }
    list.length = write;
  }

  /**
   * @param {'all'|'friendly'|'hostile'} only Game draws friendly shots under the player
   *   and hostile shots over it, so enemy bullets never vanish behind the ship sprite.
   */
  draw(ctx, gpuFriendly = false, only = 'all') {
    if (only !== 'hostile') this.nativeEffects.draw(ctx);
    let enemyLive = 0;
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      if (b.alive && !b.friendly) enemyLive += 1;
    }
    // Dense boss rings: use prebaked tight orb (less soft bloom) instead of full halo blit.
    // Trip earlier than 140 — insect/abyss stacks sit in the 100–140 band for long stretches.
    const enemyDrawOpts = enemyLive > 110 ? { skipHalo: true } : null;
    for (const b of this.list) {
      if (!b.alive || SUB_WEAPON_STYLES.has(b.style)) continue;
      if ((only === 'friendly' && !b.friendly) || (only === 'hostile' && b.friendly)) continue;
      // Rare styles also ride the GPU layer — skip canvas or they double-draw and spike fill.
      // C signatures keep their authored silhouette on Canvas; GPU particles
      // still supply the surrounding motion/glow behind them.
      if (gpuFriendly && b.friendly && !b.nativeKey && GPU_FRIENDLY_STYLES.has(b.style)
        && !(b.special && SPECIAL_SIGNATURE_STYLES.has(b.style))) {
        if (b.partGlow && b.delay <= 0) b.drawPartGlow(ctx);
        continue;
      }
      b.draw(ctx, b.friendly ? null : enemyDrawOpts);
    }
    // 보조무기 rounds sit above the main shot stream.
    if (only === 'hostile') return;
    for (const b of this.list) if (b.alive && SUB_WEAPON_STYLES.has(b.style)) b.draw(ctx, null);
  }

  clearEnemy() {
    let write = 0;
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.friendly) {
        this._recycle(b);
        continue;
      }
      list[write++] = b;
    }
    list.length = write;
  }

  clearAll() {
    this.nativeEffects.clear();
    for (const b of this.list) this._recycle(b);
    this.list.length = 0;
  }
}
