import { fireAimed, fireRing, fireFan, fireSpiral, fireSpreadLeft } from './patterns.js';
import { ClipAnimator } from './clip-anim.js';
import { rng } from './rng.js';
import { W, H } from './canvas.js';
import { drawBoriCompanion } from './shot-fx.js';
import { tickHazards, drawHazards } from './leader-hazards.js';

const FACE_IMG = new Image();
/** Commander nose: the number 4 (Korean 4령관 / Japanese 4令官 pun), placed in the face frame (x, y share). */
const NOSE_TEXT = '4';
const NOSE_AT = [0.3, 0.6];
const FACE_SRC = new URL('../assets/enemy/commander/commander.png', import.meta.url).href;
// Face size (x drawSize) and offset from the head bone (x face size) per body.
const FACE_SCALE = [0.38, 0.3, 0.34];
const FACE_OFF = [[0, -0.12], [0.04, 0.02], [0, -0.08]];

/** Warm the commander face sheet before the final boss appears (Game, stage start). */
export function preloadCommanderFace() {
  if (!FACE_IMG.getAttribute('src')) FACE_IMG.src = FACE_SRC;
}

export class Enemy {
  constructor({
    x, y, clips, hp, score, size = 64, drawScale = 1, kind = 'grunt',
    move = null, pattern = null, name = '', style = '', color = '',
    tint = '', flipX = false, script = null, phaseBodies = null, face = false,
  }) {
    /** Final boss: a body per HP phase (clip sets) and the commander's face over its head. */
    this.phaseBodies = phaseBodies;
    this.face = face;
    // Commander face sheet (1.3MB) loads when the final boss is built, not at boot.
    if (face && !FACE_IMG.getAttribute('src')) FACE_IMG.src = FACE_SRC;
    this._bodyPhase = 0;
    this.headTrack = clips?.headTrack || null;
    /** Scripted leader fight (leader-script.js): drives movement + fire when set. */
    this.script = script;
    this.telegraph = 0;
    this.lanceLine = null;
    /** Bioroid leaders are baked facing right; mirror them toward the player. */
    this.flipX = flipX;
    this.x = x;
    this.y = y;
    this.anim = new ClipAnimator(clips);
    this.hp = hp;
    this.maxHp = hp;
    this.score = score;
    this.size = size;
    this.drawSize = size * drawScale;
    this.kind = kind;
    this.name = name;
    this.style = style;
    this.color = color;
    /** Optional CSS color wash for remixed grunts (e.g. abyss). */
    this.tint = tint;
    this.alive = true;
    this.age = 0;
    this.fireTimer = 0.4 + rng() * 0.4;
    this.moveFn = move || defaultEnter;
    this.pattern = pattern || 'aimed';
    this.phase = 0;
    this.attackPhase = 0;
    this.exposedFor = 0;
    this.boriMarkedFor = 0;
    this.boriRootFor = 0;
    // Express 76 C: Courier Invoice (+20% Express damage taken) and freight push.
    this.invoiceFor = 0;
    this.knockVx = 0;
    this.volleyCount = 0;
    this.isSignatureAnchor = false;
    this.commanderRef = null;
    this.spiralAngle = 0;
    this.hitFlash = 0;
    this.dying = false;
    this._dieAge = 0;
    this._lastX = x;
    this._lastY = y;
    // Sticky locomotion so sine/hover bobbing doesn't flicker idle??move every frame.
    this._locomoting = false;
  }

  /**
   * Advance death presentation (live / ceremony / hitstop).
   * Empty die bakes fall back to idle ??keep the corpse brief so the list doesn't pin.
   */
  tickDying(dt) {
    if (!this.dying) return false;
    this.anim.update(dt);
    this._dieAge = (this._dieAge || 0) + dt;
    // Leaders: Game runs the death sequence (pops, then the final blast) and ends it.
    if (this.kind === 'boss' || this.kind === 'midboss') return this.dying;
    // Real die clips can run ~1.5s; idle-as-die must not hold a frozen pose for 2s.
    const limit = this.anim.hasDie ? 2.0 : 0.45;
    if (this._dieAge > limit) this.dying = false;
    return this.dying;
  }

  update(dt, player, bullets) {
    if (!this.alive) {
      // Finish die clip after HP hits 0 (still drawn while dying).
      this.tickDying(dt);
      return;
    }
    this.age += dt;
    if (this.exposedFor > 0) this.exposedFor = Math.max(0, this.exposedFor - dt);
    if (this.boriMarkedFor > 0) this.boriMarkedFor = Math.max(0, this.boriMarkedFor - dt);
    if (this.boriRootFor > 0) this.boriRootFor = Math.max(0, this.boriRootFor - dt);
    if (this.invoiceFor > 0) this.invoiceFor = Math.max(0, this.invoiceFor - dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;

    this._lastX = this.x;
    this._lastY = this.y;
    // Bori's root stalls grunts; leaders retain partial motion for phase safety.
    const controlScale = this.boriRootFor > 0
      ? (this.kind === 'boss' || this.kind === 'midboss' ? 0.55 : 0.08) : 1;
    if (this.script) {
      // Scripted leaders run their own routine (movement + attacks); no fireTimer volleys.
      // Area attacks (lasers / bolts / meteors) keep running through respawn pauses.
      if (this.hazards?.length) tickHazards(this, dt);
      if (!player?.isRespawning && !(player?.bombFlash > 0)) this.script.tick(this, dt, player, bullets);
      const bp = Math.max(0, this.script.phase);
      if (this.phaseBodies && bp !== this._bodyPhase && this.phaseBodies[bp]) {
        // Body swap on the phase break (flash covers it).
        this._bodyPhase = bp;
        this.anim = new ClipAnimator(this.phaseBodies[bp]);
        this.headTrack = this.phaseBodies[bp].headTrack || null;
      }
      else this.lanceLine = null;
      this.anim.play(Math.abs(this.y - this._lastY) > 0.6 ? 'move' : 'idle', { restart: false });
      this.anim.update(dt);
      return;
    }
    this.moveFn(this, dt, player);
    if (controlScale < 1) {
      this.x = this._lastX + (this.x - this._lastX) * controlScale;
      this.y = this._lastY + (this.y - this._lastY) * controlScale;
    }
    if (this.knockVx > 0) {
      // Push-back rides on top of the move script, then bleeds off quickly.
      this.x += this.knockVx * dt;
      this.knockVx = this.knockVx < 8 ? 0 : this.knockVx * Math.exp(-dt * 9);
    }
    // Frame-rate independent speed (px/s) with hysteresis ??avoids restart pop.
    const speed =
      Math.hypot(this.x - this._lastX, this.y - this._lastY) / Math.max(dt, 1e-6);
    const MOVE_ON = 28;
    const MOVE_OFF = 10;
    if (this._locomoting) {
      if (speed < MOVE_OFF) this._locomoting = false;
    } else if (speed > MOVE_ON) {
      this._locomoting = true;
    }

    if (!this.anim.locked) {
      if (this._locomoting) this.anim.play('move', { restart: false });
      else this.anim.play('idle', { restart: false });
    }
    this.anim.update(dt);

    // Hold cadence while the ship has no control (deathbomb grace + death flash).
    // Parking everyone at 0.02 caused a synchronized dump the instant control returned.
    if (player?.isRespawning) {
      if (this.fireTimer <= 0) {
        this.fireTimer = 0.2 + rng() * 0.28;
      }
    } else {
      this.fireTimer -= dt * controlScale;
      if (this.fireTimer <= 0) {
        // Wipe whiteout: keep counting hush down, but don't refill the just-cleared screen.
        // Freezing the timer here used to stack on bomb hush and mute leaders ~1.4s.
        if (player?.bombFlash > 0) {
          this.fireTimer = 0.08 + rng() * 0.12;
          return;
        }
        // Y clamp alone still let right-entry packs and left exit stragglers shoot off-screen.
        // Leaders get a slightly wider X gate so approach pressure survives the hover-in.
        const leader = this.kind === 'boss' || this.kind === 'midboss';
        const onField = this.y > -20 && this.y < H + 40
          && this.x > -40 && this.x < W + (leader ? 56 : 44);
        if (onField) {
          this.fire(player, bullets);
        } else {
          // Ready but off-playfield ??park a short jitter so the whole rank doesn't dump on entry.
          this.fireTimer = 0.12 + rng() * 0.22 + (this.entryHold ?? 0);
        }
      }
    }
  }

  fire(player, bullets) {
    // Monsters usually have no skill1 bake ??locking idle-as-attack restarts every shot.
    if (this.anim.hasAttack) this.anim.play('attack', { lock: true });
    const px = player.x;
    const py = player.y;
    // Soft rank (????????/?????): ???? ?????? ???�??? ??? ???
    const rank = player.enemyRankEnabled === false
      ? 1 : Math.max(1, Math.min(5, player.shotLevel | 0));
    const recovering = player.recoveryTimer > 0 && this.kind !== 'boss' && this.kind !== 'midboss';
    const linked = this.commanderRef?.alive && this.commanderRef.x < W + 40 && !recovering;
    const spdMul = (1 + (rank - 1) * 0.055) * (recovering ? 0.9 : 1);
    const rateMul = (1 - (rank - 1) * 0.04) * (recovering ? 1.22 : 1)
      * (linked ? 0.82 : 1) * (this.fireRateMul ?? 1);
    const sp = (base) => base * spdMul;

    switch (this.pattern) {
      case 'silent':
        // Recovery escorts are harmless targets, not an extra bullet wall.
        this.fireTimer = 2;
        break;
      case 'aimed':
        fireAimed(bullets, this.x, this.y, px, py, sp(150), { color: this.color || '#ff6b6b', r: 5 });
        this.fireTimer = 1.35 * rateMul;
        break;
      case 'spread':
        fireSpreadLeft(bullets, this.x, this.y, 5, sp(140), { color: this.color || '#feca57', r: 4.5 });
        this.fireTimer = 1.55 * rateMul;
        break;
      case 'fan':
        fireFan(bullets, this.x, this.y, px, py, 5, 0.7, sp(170), { color: this.color || '#f368e0', r: 5 });
        this.fireTimer = 1.2 * rateMul;
        break;
      case 'ring':
        // 8-way leaves readable gaps in pack waves (was 10 ??dense with formation stacks).
        fireRing(bullets, this.x, this.y, 6, sp(140), this.age * 0.4, { color: this.color || '#ff9f43', r: 5 });
        this.fireTimer = 1.85 * rateMul;
        break;
      case 'burst':
        fireFan(bullets, this.x, this.y, px, py, 3, 0.24, sp(190), { color: this.color || '#ff718a', r: 4.5 });
        this.fireTimer = 1.18 * rateMul;
        break;
      case 'named':
        this._namedFire(player, bullets, sp, rateMul);
        break;
      case 'midboss':
        this._midbossFire(player, bullets, spdMul, rateMul);
        break;
      case 'boss':
        this._bossFire(player, bullets, spdMul, rateMul);
        break;
      default:
        fireAimed(bullets, this.x, this.y, px, py, sp(160));
        this.fireTimer = 1.2 * rateMul;
    }
  }

  /**
   * Named mob: a three-step cycle that punishes ignoring it - a quick 3-round aimed burst,
   * a 12-way ring whose gap is aimed AWAY from the player (step aside, don't sit still),
   * then a wide 7-way fan. Faster below half HP.
   */
  _namedFire(player, bullets, sp, rateMul) {
    const color = this.color || '#ff6b6b';
    const hurry = this.hp < this.maxHp * 0.5 ? 0.8 : 1;
    const aim = Math.atan2(player.y - this.y, player.x - this.x);
    this._namedStep = this._namedStep || 0;
    const step = this._namedStep % 3;
    if (step === 0) {
      fireAimed(bullets, this.x - 20, this.y, player.x, player.y, sp(235), { color: '#ffffff', r: 4.5 });
      this._burst = (this._burst || 0) + 1;
      if (this._burst < 3) { this.fireTimer = 0.13; return; }
      this._burst = 0;
    } else if (step === 1) {
      const n = 12;
      const off = aim + Math.PI; // the gap opens on the far side: the player has to move
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2 + 0.26;
        if (Math.abs(Math.atan2(Math.sin(a - off), Math.cos(a - off))) < 0.3) continue;
        bullets.spawn({ x: this.x, y: this.y, vx: Math.cos(a) * sp(150), vy: Math.sin(a) * sp(150), r: 5.5, friendly: false, color, tint: color });
      }
    } else {
      fireFan(bullets, this.x, this.y, player.x, player.y, 7, 1.1, sp(175), { color, r: 5 });
    }
    this._namedStep += 1;
    this.fireTimer = 0.95 * rateMul * hurry;
  }

  /** Sync HP thresholds ??attackPhase (0/1/2). Returns true on phase change. */
  _syncHpPhase(_bullets, thresholds = [0.66, 0.33]) {
    const hpRatio = this.hp / this.maxHp;
    const phase = hpRatio > thresholds[0] ? 0 : hpRatio > thresholds[1] ? 1 : 2;
    this.phase = phase;
    if (this.attackPhase !== phase) {
      this.attackPhase = phase;
      this.hitFlash = 0.65;
      // Keep live bullets across HP phases ??bomb/deathbomb still clear intentionally.
      this.fireTimer = 0.55;
      return true;
    }
    return false;
  }

  _midbossFire(player, bullets, spdMul = 1, rateMul = 1) {
    const sp = (base) => base * spdMul;
    // Midboss: HP phases like bosses, but lighter density ??branch by stage theme style.
    // Brief fire pause on phase change so the new pattern doesn't stack same-frame.
    if (this._syncHpPhase(bullets, [0.66, 0.33])) return;
    const phase = this.attackPhase;
    const color = this.color || '#ff6b6b';
    const tempo = rateMul * (1 - phase * 0.08);
    const speed = sp(145 + phase * 12);

    switch (this.style) {
      case 'program':
        if (phase === 0) {
          this.spiralAngle += 0.16;
          fireSpiral(bullets, this.x, this.y, 3, speed, this.spiralAngle, { color, r: 4.5 });
          this.fireTimer = 0.42 * tempo;
        } else if (phase === 1) {
          this.spiralAngle += 0.22;
          fireSpiral(bullets, this.x, this.y, 4, speed, this.spiralAngle, { color, r: 4.5 });
          fireAimed(bullets, this.x, this.y, player.x, player.y, sp(195), { color: '#ffffff', r: 4 });
          this.fireTimer = 0.38 * tempo;
        } else {
          this.spiralAngle += 0.28;
          fireSpiral(bullets, this.x, this.y, 4, speed * 1.05, this.spiralAngle, { color, r: 4.5 });
          fireFan(bullets, this.x, this.y, player.x, player.y, 4, 0.36, sp(200), { color: '#8fe5ff', r: 4 });
          this.fireTimer = 0.4 * tempo;
        }
        break;
      case 'insect':
        if (phase === 0) {
          this.spiralAngle += 0.1;
          fireRing(bullets, this.x, this.y, 8, speed * 0.78, this.spiralAngle, { color, r: 4.5 });
          this.fireTimer = 0.82 * tempo;
        } else if (phase === 1) {
          this.spiralAngle += 0.14;
          fireRing(bullets, this.x, this.y, 8, speed * 0.82, this.spiralAngle, { color, r: 4.5 });
          fireAimed(bullets, this.x, this.y, player.x, player.y, sp(185), { color: '#ffa54d', r: 5 });
          this.fireTimer = 0.7 * tempo;
        } else {
          this.spiralAngle += 0.18;
          fireRing(bullets, this.x, this.y, 9, speed * 0.85, this.spiralAngle, { color, r: 4.5 });
          fireFan(bullets, this.x, this.y, player.x, player.y, 4, 0.38, sp(190), { color: '#ffa54d', r: 4.5 });
          this.fireTimer = 0.72 * tempo;
        }
        break;
      case 'chick':
        if (phase === 0) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 5, 0.6, speed, { color, r: 5 });
          this.fireTimer = 0.68 * tempo;
        } else if (phase === 1) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 7, 0.85, speed, { color, r: 5 });
          fireSpreadLeft(bullets, this.x, this.y - 28, 4, sp(145), { color: '#ffe9a0', r: 4 });
          this.fireTimer = 0.58 * tempo;
        } else {
          fireFan(bullets, this.x, this.y, player.x, player.y, 6, 0.9, speed * 1.02, { color, r: 5 });
          fireSpreadLeft(bullets, this.x, this.y - 30, 4, sp(150), { color: '#ffe9a0', r: 4 });
          fireSpreadLeft(bullets, this.x, this.y + 30, 3, sp(135), { color: '#ffb778', r: 4 });
          this.fireTimer = 0.64 * tempo;
        }
        break;
      case 'machine':
        if (phase === 0) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 3, 0.14, sp(210), { color, r: 4.2 });
          fireSpreadLeft(bullets, this.x, this.y, 4, speed, { color: '#ff8e7a', r: 4.5 });
          this.fireTimer = 0.74 * tempo;
        } else if (phase === 1) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 4, 0.22, sp(225), { color, r: 4.2 });
          fireSpreadLeft(bullets, this.x, this.y, 5, speed, { color: '#ff8e7a', r: 4.5 });
          fireAimed(bullets, this.x, this.y + 22, player.x, player.y, sp(240), { color: '#ffffff', r: 3.5 });
          this.fireTimer = 0.62 * tempo;
        } else {
          fireFan(bullets, this.x, this.y, player.x, player.y, 4, 0.26, sp(230), { color, r: 4.2 });
          fireSpreadLeft(bullets, this.x, this.y - 18, 4, speed, { color: '#ff8e7a', r: 4.5 });
          fireSpreadLeft(bullets, this.x, this.y + 18, 3, speed * 0.95, { color: '#9cc7ff', r: 4 });
          this.fireTimer = 0.76 * tempo;
        }
        break;
      default: // abyss (+ fallback)
        if (phase === 0) {
          this.spiralAngle += 0.18;
          fireSpiral(bullets, this.x, this.y, 3, speed, this.spiralAngle, { color, r: 5 });
          this.fireTimer = 0.36 * tempo;
        } else if (phase === 1) {
          this.spiralAngle += 0.24;
          fireSpiral(bullets, this.x, this.y, 3, speed, this.spiralAngle, { color, r: 5 });
          fireRing(bullets, this.x, this.y, 7, speed * 0.7, -this.spiralAngle, { color: '#8fe5ff', r: 4 });
          this.fireTimer = 0.36 * tempo;
        } else {
          this.spiralAngle += 0.3;
          fireSpiral(bullets, this.x, this.y, 4, speed * 1.04, this.spiralAngle, { color, r: 5 });
          fireFan(bullets, this.x, this.y, player.x, player.y, 4, 0.34, sp(195), { color: '#ff7789', r: 4.5 });
          this.fireTimer = 0.4 * tempo;
        }
    }
  }

  _bossFire(player, bullets, spdMul = 1, rateMul = 1) {
    const sp = (base) => base * spdMul;
    // Boss phases: 100??5% / 65??2% / 32??% ??each style uses a distinct pattern set.
    // Keep the fireTimer gap so P2/P3 doesn't overwrite with an instant volley.
    if (this._syncHpPhase(bullets, [0.65, 0.32])) return;
    const phase = this.attackPhase;
    const color = this.color || '#ff7789';
    const speed = sp(155 + phase * 18);
    const tempo = rateMul * (1 - phase * 0.12);
    switch (this.style) {
      case 'program':
        if (phase === 0) {
          this.spiralAngle += 0.2;
          fireSpiral(bullets, this.x, this.y, 3, speed, this.spiralAngle, { color, r: 4.5 });
          this.fireTimer = 0.3 * tempo;
        } else if (phase === 1) {
          this.spiralAngle += 0.28;
          fireSpiral(bullets, this.x, this.y, 5, speed, this.spiralAngle, { color, r: 4.5 });
          fireFan(bullets, this.x, this.y, player.x, player.y, 5, 0.4, sp(220), { color: '#ffffff', r: 4 });
          this.fireTimer = 0.24 * tempo;
        } else {
          // P3 was spiral+ring+wide fan every ~0.24s ??unreadable with rank tempo.
          this.spiralAngle += 0.34;
          fireSpiral(bullets, this.x, this.y, 5, speed * 1.05, this.spiralAngle, { color, r: 4.5 });
          fireRing(bullets, this.x, this.y, 8, speed * 0.7, -this.spiralAngle, { color: '#8fe5ff', r: 4 });
          fireFan(bullets, this.x, this.y, player.x, player.y, 5, 0.42, sp(220), { color: '#ffffff', r: 4 });
          this.fireTimer = 0.3 * tempo;
        }
        break;
      case 'insect':
        if (phase === 0) {
          this.spiralAngle += 0.12;
          fireRing(bullets, this.x, this.y, 10, speed * 0.8, this.spiralAngle, { color, r: 4.5 });
          this.fireTimer = 0.75 * tempo;
        } else if (phase === 1) {
          this.spiralAngle += 0.18;
          // 12-way + aimed sat on the halo-skip band; keep pressure with readable gaps.
          fireRing(bullets, this.x, this.y, 10, speed * 0.85, this.spiralAngle, { color, r: 4.5 });
          fireAimed(bullets, this.x, this.y, player.x, player.y, sp(200), { color: '#ffa54d', r: 5 });
          this.fireTimer = 0.62 * tempo;
        } else {
          // P3: drop the extra spiral arm so ring+fan stays readable.
          this.spiralAngle += 0.22;
          fireRing(bullets, this.x, this.y, 10, speed * 0.88, this.spiralAngle, { color, r: 4.5 });
          fireFan(bullets, this.x, this.y, player.x, player.y, 5, 0.42, sp(205), { color: '#ffa54d', r: 5 });
          fireSpiral(bullets, this.x, this.y, 2, speed, this.spiralAngle * 1.4, { color: '#eab6ff', r: 4 });
          this.fireTimer = 0.66 * tempo;
        }
        break;
      case 'chick':
        if (phase === 0) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 6, 0.7, speed, { color, r: 5 });
          this.fireTimer = 0.6 * tempo;
        } else if (phase === 1) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 9, 0.95, speed, { color, r: 5 });
          fireSpreadLeft(bullets, this.x, this.y - 34, 6, sp(155), { color: '#ffe9a0', r: 4 });
          this.fireTimer = 0.5 * tempo;
        } else {
          // Was 9+6+5 / 0.5s ??dual side-spreads stacked unreadable with rank.
          fireFan(bullets, this.x, this.y, player.x, player.y, 6, 0.95, speed * 1.02, { color, r: 5 });
          fireSpreadLeft(bullets, this.x, this.y - 36, 4, sp(155), { color: '#ffe9a0', r: 4 });
          fireSpreadLeft(bullets, this.x, this.y + 36, 3, sp(140), { color: '#ffb778', r: 4 });
          this.fireTimer = 0.62 * tempo;
        }
        break;
      case 'machine':
        if (phase === 0) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 3, 0.16, sp(230), { color, r: 4.2 });
          fireSpreadLeft(bullets, this.x, this.y, 5, speed, { color: '#ff8e7a', r: 4.5 });
          this.fireTimer = 0.68 * tempo;
        } else if (phase === 1) {
          fireFan(bullets, this.x, this.y, player.x, player.y, 5, 0.28, sp(245), { color, r: 4.2 });
          fireSpreadLeft(bullets, this.x, this.y, 7, speed, { color: '#ff8e7a', r: 4.5 });
          fireAimed(bullets, this.x, this.y + 28, player.x, player.y, sp(260), { color: '#ffffff', r: 3.5 });
          this.fireTimer = 0.55 * tempo;
        } else {
          // Fan + dual lane spreads ??slightly longer gap so lanes reopen.
          fireFan(bullets, this.x, this.y, player.x, player.y, 5, 0.32, sp(250), { color, r: 4.2 });
          fireSpreadLeft(bullets, this.x, this.y - 24, 5, speed * 1.05, { color: '#ff8e7a', r: 4.5 });
          fireSpreadLeft(bullets, this.x, this.y + 24, 4, speed, { color: '#9cc7ff', r: 4 });
          this.fireTimer = 0.7 * tempo;
        }
        break;
      default: // abyss
        if (phase === 0) {
          this.spiralAngle += 0.22;
          fireSpiral(bullets, this.x, this.y, 4, speed, this.spiralAngle, { color, r: 5 });
          this.fireTimer = 0.28 * tempo;
        } else if (phase === 1) {
          this.spiralAngle += 0.28;
          // 10-way + 5-arm sat on the live-cap / halo-skip band with rank tempo.
          fireSpiral(bullets, this.x, this.y, 4, speed, this.spiralAngle, { color, r: 5 });
          fireRing(bullets, this.x, this.y, 8, speed * 0.72, -this.spiralAngle, { color: '#8fe5ff', r: 4 });
          this.fireTimer = 0.28 * tempo;
        } else {
          this.spiralAngle += 0.34;
          // FINISH window: fewer arms/ring + longer gap so the core stays dodgeable.
          fireSpiral(bullets, this.x, this.y, 4, speed * 1.04, this.spiralAngle, { color, r: 5 });
          fireRing(bullets, this.x, this.y, 7, speed * 0.74, -this.spiralAngle, { color: '#8fe5ff', r: 4 });
          fireFan(bullets, this.x, this.y, player.x, player.y, 4, 0.34, sp(205), { color: '#ff7789', r: 4.5 });
          this.fireTimer = 0.4 * tempo;
        }
    }
    this.volleyCount += 1;
  }

  /** Commander face over the tracked head bone (assets/enemy/commander, 4 x 2 frames of 512). */
  _drawFace(ctx) {
    const tr = this.headTrack?.[this.anim.state] || this.headTrack?.idle;
    const box = this.anim._box;
    if (!tr || !box) return;
    if (!FACE_IMG.complete || !FACE_IMG.naturalWidth) return;
    const fps = this.anim.fps[this.anim.state] || 24;
    const n = tr.length;
    const idx = this.anim.locked || this.anim.state === 'die'
      ? Math.min(n - 1, Math.floor(this.anim.time * fps)) : Math.floor(this.anim.time * fps) % n;
    const [hx, hy, ang] = tr[Math.max(0, idx)];
    const ang0 = (this.headTrack.idle || tr)[0][2];
    const size = this.drawSize;
    const aspect = box.w / box.h;
    const w = aspect >= 1 ? size : size * aspect;
    const h = aspect >= 1 ? size / aspect : size;
    const sc = w / box.w;
    let fx = this.x - w / 2 + (hx - box.x) * sc;
    const fy = this.y - h / 2 + (hy - box.y) * sc;
    let rot = -(ang - ang0);
    if (this.flipX) { fx = 2 * this.x - fx; rot = -rot; }
    const face = size * (FACE_SCALE[this._bodyPhase] ?? 0.4);
    const frame = Math.floor(this.age * 5) % 8;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(rot);
    // No hit brightening: a boss is under constant fire, so the face washed out to white.
    // The face sheet looks left (toward the player) already.
    ctx.drawImage(FACE_IMG, (frame % 4) * 512, Math.floor(frame / 4) * 512, 512, 512,
      -face / 2 + face * FACE_OFF[this._bodyPhase][0], -face / 2 + face * FACE_OFF[this._bodyPhase][1], face, face);
    // "4령관" pun: a 4 where the nose would be (4 = 사 in Korean, し in Japanese 司令官).
    const fx0 = -face / 2 + face * FACE_OFF[this._bodyPhase][0];
    const fy0 = -face / 2 + face * FACE_OFF[this._bodyPhase][1];
    ctx.font = `900 ${Math.round(face * 0.17)}px "Chakra Petch", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(1.5, face * 0.018);
    ctx.strokeStyle = 'rgba(255,245,240,0.9)';
    ctx.strokeText(NOSE_TEXT, fx0 + face * NOSE_AT[0], fy0 + face * NOSE_AT[1]);
    ctx.fillStyle = '#5a2c2c';
    ctx.fillText(NOSE_TEXT, fx0 + face * NOSE_AT[0], fy0 + face * NOSE_AT[1]);
    ctx.restore();
  }

  /** Script tells: a charge glow before each attack and the aim line of a lance. */
  _drawTelegraph(ctx) {
    ctx.save();
    if (this.telegraph > 0) {
      const k = Math.min(1, this.telegraph);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.45 * k;
      ctx.strokeStyle = this.telegraphColor || '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x - 18, this.y, 46 * (1.4 - k * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = this.telegraphColor || '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x - 18, this.y, 10 + 8 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mortar target marks (leader-script mortar): a ring closing on the impact point.
    for (const m of this.marks || []) {
      const k = Math.min(1, m.t / m.warn);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.5 * k * (0.6 + 0.4 * Math.sin(m.t * 26));
      // Soft target disc + hot centre: the landing zone reads as a glowing area.
      ctx.fillStyle = m.color || '#ff9a3c';
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = 0.1 + 0.18 * k;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.25, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.2 + 0.25 * k;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5 + 0.5 * k;
      ctx.beginPath(); ctx.arc(m.x, m.y, 3 + 3 * k, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = ga;
      ctx.strokeStyle = m.color || '#ff9a3c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * (1.6 - 0.6 * k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - m.r * 0.5, m.y); ctx.lineTo(m.x + m.r * 0.5, m.y);
      ctx.moveTo(m.x, m.y - m.r * 0.5); ctx.lineTo(m.x, m.y + m.r * 0.5);
      ctx.stroke();
    }
    const L = this.lanceLine;
    if (L) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.5 * L.k * (0.6 + 0.4 * Math.sin(L.k * 30));
      ctx.strokeStyle = L.color || '#ff4040';
      ctx.lineWidth = 2 + L.k * 3;
      ctx.setLineDash([14, 8]);
      ctx.beginPath();
      ctx.moveTo(L.x - 20, L.y);
      ctx.lineTo(L.x - 20 + Math.cos(L.ang) * 1400, L.y + Math.sin(L.ang) * 1400);
      ctx.stroke();
    }
    ctx.restore();
  }

  damage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.08;
    if (this.hp <= 0) {
      this.alive = false;
      this.dying = true;
      this._dieAge = 0;
      // Leaders hold the last die frame until their death sequence ends (Game).
      const leader = this.kind === 'boss' || this.kind === 'midboss';
      this.anim.onFinished = (finished) => {
        if (finished === 'die' && !leader) this.dying = false;
      };
      this.anim.play('die', { lock: true });
      return true;
    }
    return false;
  }

  draw(ctx) {
    if (!this.alive && !this.dying) return;
    if (this.alive && this.script) this._drawTelegraph(ctx);
    if (this.alive && !this.dying && this.hazards?.length) drawHazards(ctx, this);
    if (this.alive && this.boriMarkedFor > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.boriMarkedFor * 2);
      ctx.strokeStyle = this.boriRootFor > 0 ? '#ffdc70' : '#fff2ad';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.drawSize * 0.34,
        this.drawSize * 0.37, 0, 0, Math.PI * 2);
      ctx.stroke();
      const px = this.x;
      const py = this.y - this.drawSize * 0.51;
      ctx.fillStyle = '#fff2ad';
      ctx.beginPath();
      ctx.ellipse(px, py + 3, 7, 5, 0, 0, Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(px - 7 + i * 6 + 2.2, py - 5);
        ctx.arc(px - 7 + i * 6, py - 5, 2.2, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    // Signature/commander caret (^) markers above enemies removed (UI declutter).
    if (this.alive && this.dropsPower) {
      ctx.save();
      // Soft red single stroke + glow used to merge into rose/neon wash + sprite �
      // dark under-rim + tip edge keep the power-carrier telegraph readable (cue only).
      const prx = this.drawSize * 0.38;
      const pry = this.drawSize * 0.42;
      ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, prx, pry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ff5959';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ff3c43';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, prx, pry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fffef8';
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, prx, pry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Soft underglow wash before sprite ??remixed grunts (abyss etc.) without new art.
    if (this.tint) {
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = this.tint;
      ctx.beginPath();
      ctx.ellipse(this.x - 2, this.y + 2, this.drawSize * 0.4, this.drawSize * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.alive && this.invoiceFor > 0) {
      // Courier Invoice tag: dashed delivery-orange ring, distinct from Bori's pin.
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.invoiceFor * 2) * 0.9;
      ctx.strokeStyle = '#ff9a3c';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -this.age * 30;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.drawSize * 0.36, this.drawSize * 0.39, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Baked MP sprites already face left (toward player on the left). Do not flip.
    // Leaders (midboss / boss) take constant fire: no translucent hit flash, they stay solid.
    const leader = this.kind === 'boss' || this.kind === 'midboss';
    const animOpts = { flash: !leader && this.alive && this.hitFlash > 0, flipX: this.flipX }; // no white during the die clip
    if (this.spriteTint) this._drawTinted(ctx, animOpts);
    else this.anim.draw(ctx, this.x, this.y, this.drawSize, animOpts);
    if (this.face) this._drawFace(ctx);
    // Bori remains beside the marked target after the brief rush and root.
    if (this.alive && this.boriMarkedFor > 0) {
      const side = this.x > W * 0.65 ? -1 : 1;
      drawBoriCompanion(ctx, this.x + side * this.drawSize * 0.44,
        this.y + this.drawSize * 0.18, 26, Math.min(1, this.boriMarkedFor * 2), this.age, 'pin');
    }
    if (this.alive && this.dropsPower) {
      ctx.save();
      const y = this.y - this.drawSize * 0.48;
      ctx.fillStyle = '#c31f32';
      ctx.strokeStyle = '#fff1c9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', this.x, y + 1);
      ctx.restore();
    }
  }

  /**
   * Sprite with a light colour wash (stand-in named mobs: a resized elite tinted so it reads
   * as a variant). Rendered through a small offscreen canvas at the backing-store scale.
   */
  _drawTinted(ctx, animOpts) {
    const k = Math.max(1, ctx.getTransform?.().a || 1);
    const size = Math.ceil(this.drawSize * 1.35);
    const c = (this._tintCanvas ||= document.createElement('canvas'));
    const px = Math.ceil(size * k);
    if (c.width !== px) { c.width = px; c.height = px; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    g.setTransform(k, 0, 0, k, 0, 0);
    this.anim.draw(g, size / 2, size / 2, this.drawSize, animOpts);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.18;
    g.fillStyle = this.spriteTint;
    g.fillRect(0, 0, px, px);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(c, this.x - size / 2, this.y - size / 2, size, size);
  }

  get hitR() {
    // Damage hitbox matches drawn sprite footprint (centered circle over drawSize).
    // drawScale is baked into drawSize so mid/boss enlargements stay fully hittable.
    return this.drawSize * 0.5;
  }
}

function defaultEnter(e, dt) {
  if (e.age < 1.2) e.x -= 140 * dt;
  else e.y += Math.sin(e.age * 1.5) * 40 * dt;
}

export function moveSine(e, dt) {
  e.x -= 95 * dt;
  e.y += Math.sin(e.age * 2.2) * 70 * dt;
}

export function moveDive(e, dt) {
  e.x -= (e.age < 1 ? 200 : 110) * dt;
}

export function moveHover(e, dt) {
  const targetX = e.kind === 'boss' ? W - 200 : W - 170;
  if (e.kind === 'grunt' && e.age > 8) {
    e.x -= 165 * dt;
    return;
  }
  if (e.x > targetX) e.x -= 100 * dt;
  const centerY = e.kind === 'boss' || e.kind === 'midboss' ? H * 0.5 : (e.anchorY ?? e.y);
  const ty = Math.max(62, Math.min(H - 62, centerY + Math.sin(e.age * 0.7) * (e.kind === 'boss' ? 130 : e.kind === 'midboss' ? 100 : 28)));
  e.y += (ty - e.y) * Math.min(1, 1.8 * dt);
}

export function moveArc(e, dt) {
  e.x -= 125 * dt;
  const origin = e.anchorY ?? e.y;
  e.y = Math.max(45, Math.min(H - 45, origin + Math.sin(e.age * 1.7) * 88));
}

export function moveWeave(e, dt) {
  e.x -= 105 * dt;
  const origin = e.anchorY ?? e.y;
  e.y = Math.max(42, Math.min(H - 42, origin + Math.sin(e.age * 3.5) * 48));
}

export function moveSideSweep(e, dt) {
  e.y += e._dir * 130 * dt;
  e.x -= 45 * dt;
  if (e.y < 50 || e.y > H - 50) e._dir *= -1;
}

/** Double-corkscrew lane ??odd/even strands wind opposite (not a flat dive). */
export function moveHelix(e, dt) {
  const wind = e._helixWind ?? 1;
  const amp = e._helixAmp ?? 72;
  const phase = e._helixPhase ?? 0;
  const origin = e.anchorY ?? H / 2;
  e.x -= 112 * dt;
  e.y = Math.max(45, Math.min(H - 45, origin + Math.sin(e.age * 2.75 + phase) * amp * wind));
}

/** Abyss pulse drift ??slow advance with compound bob (S5 remix identity). */
export function moveAbyss(e, dt) {
  e.x -= 88 * dt;
  const origin = e.anchorY ?? e.y;
  const bob = Math.sin(e.age * 1.75) * 52 + Math.sin(e.age * 4.1) * 16;
  e.y = Math.max(42, Math.min(H - 42, origin + bob));
}

/** Top/bottom ambush entry ??dive into a lane target, then drift left. */
export function moveAmbush(e, dt) {
  const targetY = e.anchorY ?? H * 0.5;
  const pull = Math.min(1, 2.4 * dt);
  e.y += (targetY - e.y) * pull;
  e.x -= (e.age < 0.85 ? 40 : 115) * dt;
  if (e.age > 1.1) {
    e.y += Math.sin(e.age * 2.1) * 28 * dt;
  }
}
