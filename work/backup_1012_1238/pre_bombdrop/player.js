import { fireRoleBasic } from './basic-shot-patterns.js';
import { SPECIAL_ATTACKS } from './special-shots.js';
import { fireCharacterCharge } from './weapon-skills.js';
import { ClipAnimator, makeSheetFrame } from './clip-anim.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { startGriffinRun, tickGriffinRun, runOffset, drawGriffinRunUnder, drawGriffinRunOver,
  GRIFFIN_C } from './griffin-skill.js';
import { startRun, tickRun, tickRunLeft, runOffset as skillRunOffset, drawRunUnder, drawRunOver, drawRunLeft } from './skill-run.js';
import { SLEIPNIR_C, SLEIPNIR_X } from './sleipnir-skill.js';
import { EXPRESS_C, EXPRESS_X } from './express76-skill.js';
import { LABIATA_C, LABIATA_X } from './labiata-skill.js';
import { CONSTANTIA_SP, CONSTANTIA_X } from './constantia-skill.js';
import { LRL_X } from './lrl-skill.js';
import { SKILL_ATLAS } from './skill-body-atlas.js';
import { VOICE_EVENTS, VOICE_ACTIONS } from './voice-events.js';
import { drawSpiralBeam } from './shot-fx.js';
import { startChangeFx, tickChangeFx, drawChangeFx } from './peregrinus-fx.js';
import { onScreen, W } from './canvas.js';

// Original-skill runs (Griffin format): C = controller anim_skill1, X = anim_skill2.
// Griffin's X uses its dedicated bombing-run module (griffin-skill.js).
const RUN_SPECS = {
  griffin: { special: GRIFFIN_C },
  sleipnir: { special: SLEIPNIR_C, bomb: SLEIPNIR_X },
  express76: { special: EXPRESS_C, bomb: EXPRESS_X },
  labiata: { special: LABIATA_C, bomb: LABIATA_X },
  constantia: { special: CONSTANTIA_SP, bomb: CONSTANTIA_X },
  lrl: { bomb: LRL_X },
};
// Full baked skill clips (24fps): [sheet key, frame count, columns, cell px, draw scale].
// Wide-cropped sheets (draw scale > 1) keep props in frame: Sleipnir's guns/plane form,
// Express's hanging ATM (tools/import-skill-body-sheets.py "fit").
const BODY_CLIPS = {
  griffin: { skill1: ['griffin-skill1', 36, 6, 192, 1], skill2: ['griffin-skill2', 262, 17, 192, 1] },
  sleipnir: { skill1: ['sleipnir-skill1', 184, 14, 256, 1.944], skill2: ['sleipnir-skill2', 228, 16, 256, 2.162] },
  express76: { skill1: ['express76-skill1', 102, 11, 256, 1.12], skill2: ['express76-skill2', 140, 12, 192, 1] },
  // Trimmed atlases (SKILL_ATLAS): frames anchored to the idle box at full body size.
  labiata: { skill1: 'labiata-skill1', skill2: 'labiata-skill2' },
  constantia: { skill1: 'constantia-skill1', skill2: 'constantia-skill2' },
};

const BASIC_KEYS = { yatagarasu: 'hirume', rifle: 'constantia', axe: 'lrl',
  baton: 'merlin', tesla: 'fafnir', hmg: 'eternity', plasma: 'labiata', railgun: 'emily' };

/** Always draw every pilot's hurt point (as the white focus core, faded outside FOCUS). */
export const SHOW_HURT_POINT = true;

/**
 * Express 76 sub laser by P level: cooldown (s), beam half-height (px), damage per 0.05 s tick
 * (x shotDamage), on time (s).
 */
const SUB_BEAM = {
  dur: 0.28,
  cd: [0, 1.4, 1.2, 1.05, 0.9, 0.8],
  half: [0, 4, 5, 6, 7, 8],
  dmg: [0, 1.6, 1.8, 2.0, 2.15, 2.3],
};

/** LRL skill1 dash starts at frame 37 of the original clip (1.55s, EventMoveMotionStart). */
const LRL_DASH_FROM = 37;

// SP gauge pacing (1945 II reference): ~15 s of fighting for Lv1, ~45 s for Lv2, ~90 s for Lv3.
const SP_GAIN = 0.21;
const SP_SEGMENT_RATE = [1, 0.5, 0.34];

export { SUB_BEAM };

/** Respawn: empty beat after the die clip, then the fly-in from the left edge. */
const RESPAWN_GAP = 0.35;
const ENTER_TIME = 0.8;
const ENTER_FROM_X = -70;
/** Death clip length (s): clips outside this range are re-timed to DIE_FIT (user). */
const DIE_RANGE = [2.5, 3.5];
const DIE_FIT = 3.0;
/** Slowest death playback (frames/s): short clips (Griffin, 19 frames) stretch only this far. */
const DIE_MIN_FPS = 12;

/** Re-time an animator's die clip so it lasts DIE_RANGE (clip-clock voices stay on pose). */
function fitDieClip(anim) {
  const frames = anim?.clips?.die?.length || 0;
  const fps = anim?.fps?.die || 24;
  if (!frames) return;
  const dur = frames / fps;
  if (dur < DIE_RANGE[0] || dur > DIE_RANGE[1]) anim.fps.die = Math.max(DIE_MIN_FPS, frames / DIE_FIT);
}

export class Player {
  constructor(charKey, meta, clips, canvasW, canvasH) {
    this.charKey = charKey;
    this.meta = meta;
    this.anim = new ClipAnimator(clips);
    fitDieClip(this.anim);
    // Original voices (skill / death shouts) ride the animation clock: js/voice-events.js.
    this._wireVoices(this.anim);
    if (charKey === 'lrl') {
      // Clean copy: the yellow eye sparkle of the beam pose recoloured red
      // (tools/clean-lrl-skill2-eye.py) to match the bomb's red eye glow.
      const sheet = getNativeWeaponImage('lrl-skill2-clean') || getNativeWeaponImage('lrl-skill2');
      if (sheet) {
        this.anim.clips.skill2 = Array.from({ length: 36 }, (_, i) =>
          makeSheetFrame(sheet, { x: (i % 6) * 192, y: Math.floor(i / 6) * 192,
            w: 192, h: 192 }));
        this.anim.fps.skill2 = 22;
        this.anim.hasSkill2 = true;
      }
      // Original skill1, forward dash only (EventMoveMotionStart..End, frames 37-71 =
      // 1.55-2.97s; no wind-up, no stumble): 35 frames cropped to the idle box, 12 x 192 cells.
      // Indices keep the original clip time (frames 0-36 alias the first dash frame; C starts
      // the clip at frame 37) so its sound events stay on the original timing.
      const s1 = getNativeWeaponImage('lrl-skill1');
      if (s1) {
        const c = 192 * (s1._lo || 1);
        this.anim.clips.skill1 = Array.from({ length: 72 }, (_, i) => {
          const k = Math.max(0, i - LRL_DASH_FROM);
          return makeSheetFrame(s1, { x: (k % 12) * c, y: Math.floor(k / 12) * c, w: c, h: c });
        });
        this.anim.fps.skill1 = 24.1008;
      }
    } else if (BODY_CLIPS[charKey]) {
      this.anim.drawScale = {};
      for (const [clip, spec] of Object.entries(BODY_CLIPS[charKey])) {
        if (typeof spec === 'string') {
          // Per-frame trimmed atlas: anchored in bake space, may overflow the box.
          const at = SKILL_ATLAS[spec];
          const pages = at ? at.pages.map((k) => getNativeWeaponImage(k)) : [];
          if (!at || pages.some((pg) => !pg)) continue;
          let last = null;
          this.anim.clips[clip] = at.frames.map((f) => {
            if (!f) return last;
            const [pg, x, y, w, h, ox, oy] = f;
            // Low-end half-resolution page (_lo): rects and k shrink together.
            const s = pages[pg]._lo || 1;
            last = makeSheetFrame(pages[pg], { x: x * s, y: y * s, w: w * s, h: h * s, ox, oy, k: at.k * s, overflow: true });
            return last;
          }).map((fr, i, arr) => fr || arr.find(Boolean));
          this.anim.fps[clip] = 24;
          this.anim.drawScale[clip] = 1;
          if (clip === 'skill2') this.anim.hasSkill2 = true;
          continue;
        }
        const [key, count, cols, cell, scale] = spec;
        const sheet = getNativeWeaponImage(key);
        if (!sheet) continue;
        const c = cell * (sheet._lo || 1);
        this.anim.clips[clip] = Array.from({ length: count }, (_, i) =>
          makeSheetFrame(sheet, { x: (i % cols) * c, y: Math.floor(i / cols) * c, w: c, h: c }));
        this.anim.fps[clip] = 24;
        this.anim.drawScale[clip] = scale;
        if (clip === 'skill2') this.anim.hasSkill2 = true;
      }
    }
    this.w = canvasW;
    this.h = canvasH;
    this.x = 120;
    this.y = canvasH / 2;
    this.speed = 300;
    this.focusSpeed = 130;
    this.hitR = 4;
    this.drawSize = meta.drawSize || 78;
    this.drawOffsetX = meta.drawOffsetX || 0;
    this.drawOffsetY = meta.drawOffsetY || 0;
    this.fireCooldown = 0;
    this._shotCounter = 0;
    this.invuln = 1.5;
    this.lives = 3;
    /** 폭탄 재고 — X키, SP 게이지와 별개 */
    this.bombs = 3;
    this.bombsMax = 3;
    /** 특수탄 레벨: 100/200/300에서 Lv1/2/3. 시작 Lv1, 발동 시 현재 레벨 소비. */
    this.spCost = 100;
    this.spMax = this.spCost * 3;
    this.sp = this.spCost;
    this.alive = true;
    /** A short reduced-pressure window after losing power; never grants invulnerability. */
    this.recoveryTimer = 0;
    this.focus = false;
    this.bombFlash = 0;
    this.specialFlash = 0;
    this.unrepFor = 0;
    /** Mid-life death: brief die flash before respawn (no screen-wide bullet clear). */
    this.respawnTimer = 0;
    /** Fly-in after a respawn (s left); see enterFromLeft. */
    this.entering = 0;
    this.deathFlash = 0;
    /**
     * Classic shmup deathbomb grace after a hit.
     * Life is not spent until this expires; X + bomb stock cancels the miss.
     * First grace of a sortie is slightly longer so the X cue can be learned.
     */
    this.deathBombMax = 0.28;
    this.deathBombFirstMax = 0.34;
    this.deathBombTimer = 0;
    /** Active window length (first miss may use deathBombFirstMax). */
    this._deathBombWindowMax = 0.28;
    /** How many deathbomb windows opened this sortie (for first-hit teaching). */
    this.deathBombOpens = 0;
    /** One-shot for Game: 'respawn' | 'dead' | null after grace fails. */
    this.missJustCommitted = null;
    this.moving = false;
    this.facing = 1;
    /** 1945-style shot levels 1–5; level = 1 + successful P pickups (capped). */
    this.shotLevel = 1;
    this.shotLevelMax = 5;
    /** Four P pickups raise the starting Lv1 shot to Lv5. */
    this.shotPowerItemCap = 5;
    /** Stage 1 teaches shot upgrades without raising enemy bullet rank. */
    this.enemyRankEnabled = true;
    /** Hold-FIRE enhanced shot gauge 0~1 (fills while FIRE held). */
    this.charge = 0;
    this._wasShooting = false;
    this._t = 0;
    /** Set true for one frame when a charge volley fires (Game plays SFX). */
    this.chargeFired = false;
    /**
     * Release pressed during hitstop — fire on the next live sim frame.
     * Spawning into a frozen field left volleys parked on the muzzle.
     */
    this._chargeQueued = false;
    /**
     * Brief Z tap during hitstop (or between frames) — fire one autofire volley
     * on the next live frame. Hold streams still own cadence when Z stays down.
     */
    this._shootQueued = false;
    /** One-shot for Game shoot SFX after a queued tap volley. */
    this.tapShotFired = false;
    /** HUD 피드백용: 'up' | 'down' | null */
    this.powerFlash = null;
    this.powerFlashT = 0;
  }

  /**
   * Combat SP (damage / kills / graze). Strikers 1945 II pacing: Lv1 comes quickly,
   * Lv2 takes a while, Lv3 takes most of a stage — each further segment fills slower.
   */
  addSp(amount) {
    if (!this.alive || amount <= 0) return;
    let left = amount * SP_GAIN;
    while (left > 0 && this.sp < this.spMax) {
      const seg = Math.min(2, Math.floor(this.sp / this.spCost));
      const rate = SP_SEGMENT_RATE[seg];
      const room = (seg + 1) * this.spCost - this.sp;
      const step = Math.min(room, left * rate);
      this.sp += step;
      left -= step / rate;
      if (step <= 0) break;
    }
    this.sp = Math.min(this.spMax, this.sp);
  }

  /** Flat SP (cheat / scripted refills): no combat scaling. */
  addSpRaw(amount) {
    if (amount > 0) this.sp = Math.min(this.spMax, this.sp + amount);
  }

  /** @returns {boolean} true if bomb stock increased */
  addBomb(n = 1) {
    if (!this.alive || n <= 0) return false;
    if (this.bombs >= this.bombsMax) return false;
    this.bombs = Math.min(this.bombsMax, this.bombs + n);
    return true;
  }

  /** @returns {boolean} true if level increased */
  powerUpShot() {
    const cap = Math.min(this.shotPowerItemCap, this.shotLevelMax);
    if (this.shotLevel >= cap) return false;
    this.shotLevel += 1;
    this.powerFlash = 'up';
    this.powerFlashT = 0.55;
    return true;
  }

  /**
   * No-miss stage-clear bonus can also grant the final shot level.
   * @returns {boolean} true if level increased
   */
  powerUpShotBonus() {
    if (this.shotLevel >= this.shotLevelMax) return false;
    if (this.shotLevel < this.shotPowerItemCap) {
      // Prefer filling P-cap first; bonus path is the overclock beyond it.
      return this.powerUpShot();
    }
    this.shotLevel += 1;
    this.powerFlash = 'up';
    this.powerFlashT = 0.7;
    return true;
  }

  /**
   * 전국블레이드식: 적 몸체 접촉 시 미스 대신 파워 다운.
   * @returns {boolean} true if shot level decreased
   */
  powerDownShot() {
    if (!this.alive) return false;
    this.invuln = Math.max(this.invuln, 1.1);
    this.charge = 0;
    this._chargeQueued = false;
    if (this.shotLevel <= 1) {
      this.powerFlash = 'down';
      this.powerFlashT = 0.4;
      return false;
    }
    this.shotLevel -= 1;
    this.recoveryTimer = Math.max(this.recoveryTimer, 5.5);
    this.powerFlash = 'down';
    this.powerFlashT = 0.55;
    return true;
  }

  /** P/O practice controls change weapon level without a pickup, score, or hit invulnerability. */
  adjustShotLevelCheat(delta) {
    if (!this.alive) return false;
    const next = Math.max(1, Math.min(this.shotLevelMax, this.shotLevel + Math.sign(delta)));
    if (next === this.shotLevel) return false;
    this.shotLevel = next;
    this.powerFlash = delta > 0 ? 'up' : 'down';
    this.powerFlashT = 0.55;
    return true;
  }

  /**
   * Classic shmup miss — shot power returns to base Lv1.
   * Bomb stock / SP are unchanged. Deathbomb cancel must not call this.
   * @returns {boolean} true if level actually dropped
   */
  resetShotPower() {
    const dropped = this.shotLevel > 1;
    this.shotLevel = 1;
    if (dropped) {
      this.powerFlash = 'down';
      this.powerFlashT = 0.55;
    }
    return dropped;
  }

  get specialLevel() {
    return Math.min(3, Math.floor(this.sp / this.spCost));
  }

  get specialName() {
    return (SPECIAL_ATTACKS[this.charKey] || SPECIAL_ATTACKS.hirume)[this.specialLevel - 1]?.name || '';
  }

  get spReady() {
    return this.sp >= this.spCost;
  }

  get chargeReady() {
    return this.meta?.chargeEnabled !== false && this.charge >= 1;
  }

  /** Hurt point: the body centre of the current form's sprite (meta.hitOffset). */
  get hitX() {
    return this.x + (this.meta?.hitOffset?.x ?? 0);
  }

  get hitY() {
    return this.y + (this.meta?.hitOffset?.y ?? -10);
  }

  resetPosition() {
    this.x = 120;
    this.y = this.h / 2;
    this._syusui = null;
    this.invuln = 2;
  }

  /** True while deathbomb grace or mid-life death flash (immune, no control / fire). */
  get isRespawning() {
    return this.respawnTimer > 0 || this.deathBombTimer > 0;
  }

  get inDeathBombWindow() {
    return this.deathBombTimer > 0;
  }

  /** 0..1 remaining grace (1 = just opened). */
  get deathBombRatio() {
    const max = this._deathBombWindowMax || this.deathBombMax;
    if (this.deathBombTimer <= 0 || max <= 0) return 0;
    return Math.max(0, Math.min(1, this.deathBombTimer / max));
  }

  /** True during the first deathbomb window of the sortie (tutorial emphasis). */
  get isFirstDeathBomb() {
    return this.deathBombOpens === 1 && this.deathBombTimer > 0;
  }

  /**
   * Advance deathbomb grace on wall-clock dt.
   * Hitstop freezes simDt — without this the ring/timer stall while the prompt still pulses.
   * @returns {boolean} true while grace is (or was) active this call
   */
  tickDeathBomb(dt) {
    if (this.deathBombTimer <= 0 || !this.alive) return false;
    this.deathBombTimer -= dt;
    if (this.deathFlash > 0) this.deathFlash -= dt;
    this.anim.update(dt);
    if (this.deathBombTimer <= 0) {
      this.deathBombTimer = 0;
      this._commitMiss();
    }
    return true;
  }

  /**
   * Advance mid-life death flash on wall-clock dt.
   * Hitstop used to freeze respawnTimer after grace failed — sticky corpse vs live bullets.
   * @returns {boolean} true while respawn flash is active
   */
  tickRespawn(dt) {
    if (this.respawnTimer <= 0 || !this.alive) return false;
    this.respawnTimer -= dt;
    if (this.deathFlash > 0) this.deathFlash -= dt;
    this.anim.update(dt);
    if (this.respawnTimer <= 0) {
      this.respawnTimer = 0;
      this.deathFlash = 0;
      this.anim.locked = false;
      this.anim.play('idle', { restart: true });
      this.enterFromLeft();
    }
    return true;
  }

  /** Seconds of the die clip still to play (0 once it has finished). */
  get dieLeft() {
    if (this.anim.state !== 'die') return 0;
    const frames = this.anim.clips.die?.length || 0;
    // The clip holds on its last frame (time clamps to (frames - 1) / fps) when done.
    return Math.max(0, (frames - 1) / (this.anim.fps.die || 24) - this.anim.time);
  }

  /** Respawn: start off the left edge and fly in to the start position (no control yet). */
  /** Stage-clear fly-off (Game sets it after the tally); cleared by the next fly-in. */
  exitRight() {
    this.exiting = true;
    this.cinematic = false;
    this._exitV = 140;
  }

  enterFromLeft() {
    this.exiting = false;
    this.cinematic = false;
    this.resetPosition();
    this.x = ENTER_FROM_X;
    this.entering = ENTER_TIME;
    this.invuln = 2 + ENTER_TIME;
  }

  /** Shared focus/move/anim tick — used by live update and hitstop feel. */
  _tickLocomotion(dt, input) {
    this._t += dt;
    this.focus = input.shift;
    // Per-pilot / per-form move speed (meta.speed); focus keeps the same 43% ratio.
    const base = this.meta?.speed ?? this.speed;
    const sp = this.focus ? base * (this.focusSpeed / this.speed) : base;
    let dx = 0;
    let dy = 0;
    const digital = !!(input.left || input.right || input.up || input.down);
    if (digital) {
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
    } else {
      const ax = Number(input.ax) || 0;
      const ay = Number(input.ay) || 0;
      dx = ax;
      dy = ay;
      const mag = Math.hypot(dx, dy);
      if (mag > 1) {
        dx /= mag;
        dy /= mag;
      }
    }
    // Bomb: rooted until the bomb animation ends (all pilots).
    if (this.bombLocked) {
      dx = 0;
      dy = 0;
    }
    this.moving = Math.hypot(dx, dy) > 0.02;
    if (this.moving) {
      if (digital) {
        const len = Math.hypot(dx, dy);
        this.x += (dx / len) * sp * dt;
        this.y += (dy / len) * sp * dt;
      } else {
        this.x += dx * sp * dt;
        this.y += dy * sp * dt;
      }
    }
    // Landscape shmup: always face right (fire direction), never flip when retreating
    this.facing = 1;

    const margin = 28;
    this.x = Math.max(margin, Math.min(this.w - margin, this.x));
    this.y = Math.max(margin, Math.min(this.h - margin, this.y));

    if (!this.anim.locked) {
      if (this.moving) this.anim.play('move', { restart: false });
      else this.anim.play('idle', { restart: false });
    }
    this.anim.update(dt);
  }

  /**
   * Wall-clock combat feel while sim hitstop freezes the world.
   * Keeps i-frame / bomb flash decaying, charge fill, and ship movement responsive.
   * Autofire / charge volleys do not spawn into a paused field — cooldown still recovers
   * so freeze duration isn't stacked on top of fireRate as a hidden DPS tax.
   * Full charge holds at 1; a release during freeze queues fire for the next live frame.
   */
  tickHitstopFeel(dt, input, _bullets) {
    this.chargeFired = false;
    if (this.meta?.chargeEnabled === false) {
      this.charge = 0;
      this._chargeQueued = false;
    }
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.recoveryTimer > 0) this.recoveryTimer = Math.max(0, this.recoveryTimer - dt);
    if (this.bombFlash > 0) this.bombFlash = Math.max(0, this.bombFlash - dt);
    if (this.specialFlash > 0) this.specialFlash = Math.max(0, this.specialFlash - dt);
    if (this.unrepFor > 0) this.unrepFor = Math.max(0, this.unrepFor - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.powerFlashT > 0) {
      this.powerFlashT -= dt;
      if (this.powerFlashT <= 0) this.powerFlash = null;
    }
    if (!this.alive || this.isRespawning) {
      this.charge = 0;
      this._chargeQueued = false;
      this._wasShooting = false;
      // Keep _shootQueued — same as bomb/special taps through death flash / grace.
      return;
    }
    // Don't glue the ship — frozen bullets + stuck movement felt like input lag.
    this._tickLocomotion(dt, input);
    if (input.shoot && this.meta?.chargeEnabled !== false) {
      this.charge = Math.min(1, this.charge + dt / 1.05);
      this._wasShooting = true;
    } else {
      if (this.meta?.chargeEnabled !== false && this._wasShooting && this.charge >= 0.55) {
        this._chargeQueued = true;
      }
      this.charge = 0;
      this._wasShooting = false;
    }
  }

  /** Alternate form (Peregrinus human form): its clips come from Game after construction. */
  setAltForm(clips, changeClips, revertClips, bombClips, birdBombClips) {
    const form = this.meta?.humanForm;
    if (!form || !clips) return;
    this._baseMeta = this.meta;
    this._baseAnim = this.anim;
    this._altAnim = new ClipAnimator(clips);
    fitDieClip(this._altAnim);
    this._wireVoices(this._altAnim); // a downed human form still plays the pilot's die voice
    // Transformation clip (bird -> human), played once before the swap.
    this._changeAnim = changeClips ? new ClipAnimator(changeClips) : null;
    if (this._changeAnim) this._changeAnim.fps.idle = (this._changeAnim.fps.idle || 24) * (form.changeSpeed || 1);
    // Transformation back (human -> bird) when the form runs out.
    this._revertAnim = revertClips ? new ClipAnimator(revertClips) : null;
    if (this._revertAnim) this._revertAnim.fps.idle = (this._revertAnim.fps.idle || 24) * (form.changeSpeed || 1);
    this.changing = 0;
    this.reverting = 0;
    this.formBlink = 0;
    // Human-form X (original Skil_2), played once.
    this._hBombAnim = bombClips ? new ClipAnimator(bombClips) : null;
    // Bird-form X (original bird_Skil_2), played once.
    this._bBombAnim = birdBombClips ? new ClipAnimator(birdBombClips) : null;
    this.hBomb = null;
    this.fxEvents ||= [];
    this._altMeta = { ...this.meta, ...form, shot: { ...form.shot }, humanForm: form };
    this.humanFor = 0;
  }

  get inHumanForm() {
    return this.humanFor > 0;
  }

  /** C: play the transformation, then switch to the human form. */
  _startChange(level) {
    const frames = this._changeAnim?.clips?.idle || [];
    if (!frames.length) return this._enterHumanForm(level);
    this._changeLevel = level;
    this.changing = frames.length / (this._changeAnim.fps.idle || 24) - 0.02;
    this.anim = this._changeAnim;
    this.anim.locked = false;
    this.anim.play('idle', { restart: true, lock: true });
    // Peregrinus_N_Change switches on at 0.67s of bird_change_motion.
    startChangeFx(this, 'change', 0.67, this._altMeta?.changeSpeed || 1);
    // Not invulnerable while transforming; she can still move.
    this.formFlash = 0.3;
    return true;
  }

  /**
   * Human-form X: her original human Skil_2 - charge, eye flash, white-out, giant green
   * beam, then she folds back into the bird (the clip ends on the bird). Events go to
   * Game through fxEvents; the human form ends with it.
   */
  _startHumanBomb(cfg = this._altMeta?.bomb, anim = this._hBombAnim, targets = null) {
    const frames = anim?.clips?.idle || [];
    if (!cfg || !frames.length) return false;
    const len = frames.length / 24; // clip seconds at the bake's 24 fps
    // Dive target (bird X): the body flies to the field centre and back; the ship stays.
    this.hBomb = { t: 0, len, cfg, next: 0, targets, hitSet: new Set() };
    this.bombDx = 0;
    this.bombDy = 0;
    this.humanFor = 0;
    this.formBlink = 0;
    this.beamOn = false;
    this.beamFade = 0;
    this.beamGrow = 0;
    this.anim = anim;
    this.anim.fps.idle = 24 * cfg.speed;
    this.anim.locked = false;
    this.anim.play('idle', { restart: true, lock: true });
    const st = cfg.stretch;
    const dur = (len + (st ? (st[1] - st[0]) * (st[2] - 1) : 0)) / cfg.speed;
    // Bird dash: open-ended (ends itself); lock covers it, released in _endHumanBomb.
    const lockFor = cfg.dash ? 30 : dur;
    this._bombAnimLock = lockFor;
    this.invuln = Math.max(this.invuln, lockFor + 2.5);
    startChangeFx(this, cfg.fx || 'hskill2', 0, cfg.speed);
    return true;
  }

  _tickHumanBomb(dt) {
    const b = this.hBomb;
    if (!b) return;
    const st = b.cfg.stretch;
    const slow = st && b.t >= st[0] && b.t < st[1] ? st[2] : 1;
    if (!b.cfg.dash) b.t += (dt * b.cfg.speed) / slow;
    if (st) {
      // Body clip and its FX follow the stretched clip clock.
      this.anim.time = b.t / b.cfg.speed;
      if (this.changeFx) this.changeFx.t = b.t / b.cfg.speed;
    }
    if (b.cfg.dash) {
      this._tickBirdDash(b, dt);
      if (!this.hBomb) return;
    } else {
      this.bombDx = 0;
      this.bombDy = 0;
    }
    const evs = b.cfg.events;
    while (b.next < evs.length && evs[b.next][0] <= b.t) {
      const [, type, arg] = evs[b.next++];
      if (type === 'sfx') this.fxEvents.push({ type, stem: arg });
      else if (type === 'shake') this.fxEvents.push({ type, mag: arg });
      else if (type === 'blast') {
        if (b.cfg.dash) {
          // Bird X flurry: only what the body is touching.
          this.fxEvents.push({ type: 'hitList', share: arg, list: this._bombBodyHits() });
        } else if (b.cfg.beamHalf) {
          // Human X: only the beam band, ahead of her.
          this.fxEvents.push({ type: 'band', share: arg, x: this.x, y: this.y + b.cfg.beamY, half: b.cfg.beamHalf });
        } else this.fxEvents.push({ type, share: arg });
      }
    }
    if (b.t >= b.len) this._endHumanBomb();
  }

  /**
   * Bird X as a state machine on the clip (b.t = clip time): wind-up (clip 0-0.8) ->
   * straight dash ahead (dash pose held) -> on touching an enemy, stop and play the clip's
   * flurry (1.15-2.55, its 9 hits land on what the body touches) and dash on -> off the
   * right edge -> fly back in from the left (bird move loop; the clip hides her there) ->
   * the clip's landing (3.8-4.5).
   */
  _tickBirdDash(b, dt) {
    const d = b.cfg.dash;
    const sp = b.cfg.speed;
    const ease = (u) => u * u * (3 - 2 * u);
    b.phase ||= 'wind';
    b.bx ??= this.x;
    const skipTo = (t) => {
      b.t = t;
      while (b.next < b.cfg.events.length && b.cfg.events[b.next][0] < t) b.next++;
    };
    const useClip = () => {
      if (this._bombClipAnim && this.anim === this._baseAnim) this.anim = this._bombClipAnim;
    };
    switch (b.phase) {
      case 'wind':
        b.t += dt * sp;
        b.bx = this.x;
        if (b.t >= d.out[0]) { b.phase = 'dash'; b.v = 300; }
        break;
      case 'dash':
      case 'dash2':
        // Accelerate straight ahead; the clip holds its dash pose.
        b.v = Math.min(d.maxSpeed, b.v + d.accel * dt);
        b.bx += b.v * dt;
        if (b.phase === 'dash') b.t = Math.min(d.pose, b.t + dt * sp);
        else b.t = d.pose;
        if (b.phase === 'dash' && this._bombBodyHits(b.bx).length) {
          b.phase = 'flurry';
          skipTo(d.flurry[0]);
        } else if (b.bx > W + d.margin) {
          b.phase = 'back';
          b.backT = 0;
          skipTo(d.land[0]);
          b.t = d.land[0];
          this._bombClipAnim = this.anim;
          this.anim = this._baseAnim;
          this.anim.locked = false;
          this.anim.play('move', { restart: true, lock: true });
        }
        break;
      case 'flurry':
        b.t += dt * sp;
        if (b.t >= d.flurry[1]) { b.phase = 'dash2'; b.v = Math.max(b.v, 500); }
        break;
      case 'back': {
        b.backT += dt;
        const u = ease(Math.min(1, b.backT / d.backTime));
        b.bx = -d.margin + (this.x + d.margin) * u;
        if (this.anim === this._baseAnim && !this.anim.locked) this.anim.play('move', { restart: true, lock: true });
        if (b.backT >= d.backTime) {
          b.phase = 'land';
          useClip();
          b.t = d.land[0];
        }
        break;
      }
      case 'land':
        b.bx = this.x;
        b.t += dt * sp;
        if (b.t >= d.land[1]) { this._endHumanBomb(); return; }
        break;
      default:
        break;
    }
    if (this.anim !== this._baseAnim) this.anim.time = b.t / sp;
    if (this.changeFx) this.changeFx.t = b.t / sp;
    this.bombDx = b.bx - this.x;
    this.bombDy = 0;
  }

  /** Enemies within the bird X's hit radius of the diving body. */
  _bombBodyHits(atX) {
    const b = this.hBomb;
    const bx = (atX ?? this.x + (this.bombDx || 0)) + 20;
    const by = this.y + (this.bombDy || 0);
    const r = b?.cfg.hitRadius || 80;
    return (b?.targets || []).filter((e) => e.alive && !e.dying && onScreen(e)
      && (e.x - bx) ** 2 + (e.y - by) ** 2 <= (r + (e.hitR || 20)) ** 2);
  }

  _endHumanBomb() {
    if (!this.hBomb) return;
    this.hBomb = null;
    this._bombClipAnim = null;
    // Release the bomb lock now (its expiry grants the usual 2s of i-frames).
    if (this._bombAnimLock > 0.01) this._bombAnimLock = 0.01;
    this.bombDx = 0;
    this.bombDy = 0;
    this.humanFor = 0;
    this.meta = this._baseMeta;
    this.drawSize = this._baseMeta.drawSize || this.drawSize;
    this.anim = this._baseAnim;
    this.anim.locked = false;
    this.anim.play('idle', { restart: true });
  }

  /** Human form ran out: back to the bird's weapons and play the human -> bird clip. */
  _startRevert() {
    const frames = this._revertAnim?.clips?.idle || [];
    if (!frames.length) { this._leaveHumanForm(); return; }
    this.humanFor = 0;
    this.formBlink = 0;
    this.meta = this._baseMeta;
    this.drawSize = this._baseMeta.drawSize || this.drawSize;
    this.reverting = frames.length / (this._revertAnim.fps.idle || 24) - 0.02;
    this.anim = this._revertAnim;
    this.anim.locked = false;
    this.anim.play('idle', { restart: true, lock: true });
    // Peregrinus_N_CH_Change switches on at 0.5s of change_motion.
    startChangeFx(this, 'revert', 0.5, this._altMeta?.changeSpeed || 1);
  }

  /** A hit mid-transformation: drop the clip so the die pose comes from a real form. */
  _cancelChange() {
    if (this.changing > 0) {
      this.changing = 0;
      this.anim = this._baseAnim;
    }
    if (this.reverting > 0) {
      this.reverting = 0;
      this.anim = this._baseAnim;
    }
  }

  _enterHumanForm(level) {
    if (!this._altAnim) return false;
    this.humanFor = this._altMeta.seconds[Math.max(1, Math.min(3, level))] || 6;
    this.humanMax = this.humanFor;
    this.meta = this._altMeta;
    this.anim = this._altAnim;
    this.anim.locked = false;
    this.anim.play('idle', { restart: true });
    this.drawSize = this._altMeta.drawSize || this.drawSize;
    this._subCd = 0;
    this.formFlash = 0.45;
    return true;
  }

  _leaveHumanForm() {
    this.formBlink = 0;
    if (!this._baseAnim || this.anim === this._baseAnim) { this.humanFor = 0; return; }
    const state = this.anim.state;
    this.humanFor = 0;
    this.meta = this._baseMeta;
    this.anim = this._baseAnim;
    this.anim.locked = false;
    this.anim.play(state === 'die' ? 'die' : 'idle', { restart: true, lock: state === 'die' });
    this.drawSize = this._baseMeta.drawSize || this.drawSize;
    this.formFlash = 0.45;
  }

  /**
   * Spiral Laser (Peregrinus human form): grows to the right edge while FIRE is held (or auto-fire is on),
   * collapses on release. The strand phase never resets. Damage: Game._tickSpiralBeam.
   */
  _tickSpiral(dt, input) {
    const cfg = this.meta?.spiral;
    if (cfg) this._beamCfg = cfg;
    const c = this._beamCfg;
    if (!c) return;
    // Auto-fire (option) keeps the beam on like a held FIRE.
    const want = !!cfg && !!(input?.shoot || input?.autoFire) && this.alive && !this.isRespawning
      && !this.skillRun && !this.bombRun && !this.hBomb;
    this.beamPhase = (this.beamPhase || 0) + dt * c.speed;
    if (want) {
      if (!this.beamOn) this.beamGrow = this.beamFade > 0 ? this.beamGrow : 0;
      this.beamOn = true;
      this.beamFade = 1;
      this.beamGrow = Math.min(1, (this.beamGrow || 0) + dt / c.grow);
    } else if (this.beamOn || this.beamFade > 0) {
      this.beamOn = false;
      this.beamFade = Math.max(0, (this.beamFade || 0) - dt / c.fade);
      if (this.beamFade <= 0) this.beamGrow = 0;
    }
    const lv = Math.max(1, Math.min(5, this.shotLevel | 0));
    this.beamWidthMul = c.levelWidth?.[lv] || 1;
    this.beamDamage = (this.meta.shotDamage || 1) * [1, 1, 1.12, 1.25, 1.45, 1.66][lv] * c.damage;
  }

  get beamX() {
    return this.x + 46;
  }

  /** Original voices (skill / death shouts) ride an animation clock: js/voice-events.js. */
  _wireVoices(anim) {
    if (!anim || !VOICE_EVENTS[this.charKey]) return;
    anim.voices = VOICE_EVENTS[this.charKey];
    anim.onVoice = (stem) => {
      // One line per moment: a form swap replays the same clip (human die -> bird die).
      const last = this._lastVoice;
      if (last && last.stem === stem && last.anim !== anim && this._voiceClock - last.t < 1) return;
      this._lastVoice = { stem, t: this._voiceClock || 0, anim };
      (this.fxEvents ||= []).push({ type: 'sfx', stem });
    };
    // Cut clip (respawn ends the die pose early): play the rest at its original clip time.
    anim.onVoiceLater = (stem, state, t, delay) => {
      (this._lateVoices ||= []).push({ stem, state, t, at: (this._voiceClock || 0) + delay, anim });
    };
  }

  _tickLateVoices() {
    const q = this._lateVoices;
    if (!q?.length) return;
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].at > (this._voiceClock || 0) + 1e-6) continue;
      const v = q.splice(i, 1)[0];
      v.anim.onVoice?.(v.stem, v.state, v.t);
    }
  }

  /**
   * Voice track started by a cast (Game calls it after a successful C / X): VOICE_ACTIONS
   * times are seconds after the cast, i.e. after the start of the clip the cast plays.
   */
  startActionVoice(action) {
    const list = VOICE_ACTIONS[this.charKey]?.[action];
    if (!list) return;
    this._actionVoice = { t: 0, list, next: 0 };
    this._tickActionVoice(0);
  }

  _tickActionVoice(dt) {
    const v = this._actionVoice;
    if (!v) return;
    v.t += dt;
    while (v.next < v.list.length && v.list[v.next][0] <= v.t + 1e-6) {
      (this.fxEvents ||= []).push({ type: 'sfx', stem: v.list[v.next][1] });
      v.next += 1;
    }
    if (v.next >= v.list.length || !this.alive) this._actionVoice = null;
  }

  update(dt, input, bullets) {
    this._voiceClock = (this._voiceClock || 0) + dt;
    this._tickSubBeam(dt);
    this._tickLateVoices();
    this._tickActionVoice(dt);
    this._tickSpiral(dt, input);
    tickChangeFx(this, dt);
    this._tickHumanBomb(dt);
    if (this.formFlash > 0) this.formFlash -= dt;
    if (this._emitT > 0) this._emitT -= dt;
    if (this.changing > 0 && this.alive && !this.isRespawning) {
      this.changing -= dt;
      if (this.changing <= 0) this._enterHumanForm(this._changeLevel || 1);
    }
    if (this.humanFor > 0 && this.alive && !this.isRespawning) {
      this.humanFor -= dt;
      // Last warnSeconds: yellow blink, 3 Hz rising to 12 Hz.
      const warn = this._altMeta?.warnSeconds || 3;
      if (this.humanFor < warn) {
        const k = 1 - Math.max(0, this.humanFor) / warn;
        this._blinkPhase = (this._blinkPhase || 0) + dt * (3 + 9 * k);
        this.formBlink = (this._blinkPhase % 1) < 0.5 ? 0.55 + 0.35 * k : 0;
      } else {
        this._blinkPhase = 0;
        this.formBlink = 0;
      }
      if (this.humanFor <= 0) this._startRevert();
    }
    if (this.reverting > 0 && this.alive && !this.isRespawning) {
      this.reverting -= dt;
      if (this.reverting <= 0) {
        this.reverting = 0;
        this.anim = this._baseAnim;
        this.anim.locked = false;
        this.anim.play('idle', { restart: true });
      }
    }
    this.chargeFired = false;
    this.tapShotFired = false;
    this.missJustCommitted = null;
    if (this.meta?.chargeEnabled === false) {
      this.charge = 0;
      this._chargeQueued = false;
    }
    if (!this.alive) {
      this._shootQueued = false;
      this.anim.update(dt);
      if (this.deathFlash > 0) this.deathFlash -= dt;
      return;
    }

    // Deathbomb grace: still showing die flash; X may cancel before life is spent.
    if (this.deathBombTimer > 0) {
      this.tickDeathBomb(dt);
      return;
    }

    if (this.respawnTimer > 0) {
      this.tickRespawn(dt);
      return;
    }

    if (this.exiting) {
      // Stage clear: accelerate off to the right (no fire, untouchable).
      this._exitV = (this._exitV || 140) + 1100 * dt;
      this.x += this._exitV * dt;
      this.invuln = Math.max(this.invuln, 0.5);
      this.anim.play('move', { restart: false });
      this.anim.update(dt);
      return;
    }
    if (this.cinematic) {
      // Stage-clear tally: the ship holds its position, no input / fire.
      this.invuln = Math.max(this.invuln, 0.5);
      this.anim.play('idle', { restart: false });
      this.anim.update(dt);
      return;
    }

    if (this.entering > 0) {
      // Fly-in after a respawn: eased glide from off-screen, invulnerable, no fire.
      this.entering = Math.max(0, this.entering - dt);
      const k = 1 - this.entering / ENTER_TIME;
      this.x = ENTER_FROM_X + (120 - ENTER_FROM_X) * (1 - (1 - k) ** 3);
      if (this.invuln > 0) this.invuln -= dt;
      this.anim.play('move', { restart: false });
      this.anim.update(dt);
      return;
    }

    this._tickLocomotion(dt, input);

    if (this.invuln > 0) this.invuln -= dt;
    if (this._bombAnimLock > 0) {
      this._bombAnimLock = Math.max(0, this._bombAnimLock - dt);
      if (this._bombAnimLock === 0) this.invuln = 2; // 2s of i-frames after the bomb clip
    }
    if (this.recoveryTimer > 0) this.recoveryTimer = Math.max(0, this.recoveryTimer - dt);
    if (this.bombFlash > 0) this.bombFlash -= dt;
    if (this.specialFlash > 0) this.specialFlash -= dt;
    if (this.unrepFor > 0) this.unrepFor = Math.max(0, this.unrepFor - dt);
    if (this.fireCooldown > 0) this.fireCooldown -= dt * (this.unrepFor > 0 ? 1.18 : 1);
    if (this._subCd > 0) this._subCd -= dt;
    if (this.powerFlashT > 0) {
      this.powerFlashT -= dt;
      if (this.powerFlashT <= 0) this.powerFlash = null;
    }

    tickRunLeft(this, dt, bullets);
    if (this.skillRun) {
      // Away on an original Skill1/Skill2 run: no gun / charge until she lands.
      tickRun(this, dt, bullets);
      // Shusui options keep flying their formation on the (still steerable) ship.
      this._tickSyusui(dt, bullets);
      this.charge = 0;
      this._chargeQueued = false;
      this._shootQueued = false;
      this._wasShooting = false;
      return;
    }
    if (this.bombRun) {
      // Griffin is away on her Skill2 bombing run: no gun / charge until she lands.
      tickGriffinRun(this, dt, bullets);
      this.charge = 0;
      this._chargeQueued = false;
      this._shootQueued = false;
      this._wasShooting = false;
      return;
    }

    // Hitstop release / full-bar hold — fire into a live field only.
    if (this._chargeQueued && this.meta?.chargeEnabled !== false) {
      this._chargeQueued = false;
      this.fireCharge(bullets);
      this.chargeFired = true;
      this.charge = 0;
      this._wasShooting = !!input.shoot;
      if (!input.shoot) {
        // Charge tap consumed the press — don't also dump a queued autofire.
        this._shootQueued = false;
        return;
      }
    }

    // Brief Z tap (often eaten by hitstop): one volley once the field is live.
    // Hold keeps the normal autofire stream; keep the queue while cooldown recovers.
    if (this._shootQueued) {
      if (input.shoot) {
        this._shootQueued = false;
      } else if (this.fireCooldown <= 0) {
        this._shootQueued = false;
        this.shoot(bullets);
        this.fireOptions(bullets);
        this.fireSubWeapon(bullets);
        this.fireCooldown = this.meta.fireRate * (this.shotLevel <= 1 ? 1.35 : this.shotLevel === 2 ? 1.15 : 1);
        this.tapShotFired = true;
      }
    }

    // 전국블레이드식: 홀드 중 차지 충전 + 기존 오토샷 유지
    // autoFire streams shots and fills charge like a FIRE hold.
    if (input.shoot) {
      if (this.meta?.chargeEnabled !== false) {
        this.charge = Math.min(1, this.charge + dt / 1.05);
      }
      if (this.fireCooldown <= 0) {
        this.shoot(bullets);
        this.fireOptions(bullets);
        this.fireSubWeapon(bullets);
        this.fireCooldown = this.meta.fireRate * (this.shotLevel <= 1 ? 1.35 : this.shotLevel === 2 ? 1.15 : 1);
      }
      if (this.meta?.chargeEnabled !== false && this.charge >= 1) {
        this.fireCharge(bullets);
        this.chargeFired = true;
        this.charge = 0;
      }
      this._wasShooting = true;
    } else {
      if (input.autoFire) {
        // Auto-fire acts like a held FIRE: the charge shot (LRL's Dark Axe) builds and
        // releases on its own, as the other pilots' sub weapons do.
        if (this.meta?.chargeEnabled !== false) {
          this.charge = Math.min(1, this.charge + dt / 1.05);
          if (this.charge >= 1) {
            this.fireCharge(bullets);
            this.chargeFired = true;
            this.charge = 0;
          }
        }
      } else {
        if (this.meta?.chargeEnabled !== false && this._wasShooting && this.charge >= 0.55) {
          this.fireCharge(bullets);
          this.chargeFired = true;
        }
        this.charge = 0;
      }
      this._wasShooting = false;
      if (input.autoFire && this.fireCooldown <= 0) {
        this.shoot(bullets);
        this.fireOptions(bullets);
        this.fireSubWeapon(bullets);
        this.fireCooldown = this.meta.fireRate * (this.shotLevel <= 1 ? 1.35 : this.shotLevel === 2 ? 1.15 : 1);
      }
    }
    this._tickSyusui(dt, bullets);
  }

  shoot(bullets) {
    if (this.hBomb) return; // keeps firing through the bird <-> human transformation (user)
    // Main shots must remain useful at screen range; power changes coverage and role.
    const lv = Math.max(1, Math.min(5, this.shotLevel | 0));
    const dmgMul = [1, 1, 1.12, 1.25, 1.4, 1.55][lv];
    const dmg = this.meta.shotDamage * dmgMul;
    const spd = this.meta.shotSpeed;
    const shot = this.meta.shot || {};
    const color = shot.color || '#9ef0ff';
    const glow = shot.glow || color;
    const style = shot.style || 'orb';
    const r = shot.r ?? 4;
    const pattern = shot.pattern || 'yatagarasu';
    const base = { friendly: true, grazeable: false, color, glow, style,
      nativeKey: BASIC_KEYS[pattern], powerLevel: lv };
    const focusTight = this.focus ? 0.55 : 1;
    const spawn = (opts) => bullets.spawn(opts);
    const targets = (bullets.targets || []).filter((enemy) => enemy.alive);
    this._shotCounter = (this._shotCounter || 0) + 1;

    switch (pattern) {
      case 'rifle': {
        // A1 Rifle Shot: aimed Winchester slugs (1945 vulcan), not lock-on missiles.
        const focusMul = this.focus ? 1.14 : 1;
        const lane = this._shotCounter % 2 ? -1 : 1;
        const threats = targets.filter((enemy) => enemy.x > this.x + 60);
        const lockFor = (x, y, rank = 0) => [...threats]
          .sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2
            - ((b.x - x) ** 2 + (b.y - y) ** 2))[rank % Math.max(1, threats.length)] || null;
        // Spread at 40% (user): aim angles and lane offsets are scaled by RIFLE_SPREAD.
        const RIFLE_SPREAD = 0.4;
        const aimFor = (target, x, y, velocity) => {
          const angle = target ? Math.atan2(target.y - y, target.x - x) * RIFLE_SPREAD : 0;
          return { vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity };
        };
        const centerX = this.x + (lv <= 2 ? 38 : 40);
        const centerY = this.y + lane * (lv <= 2 ? 4 : 5) * focusTight * RIFLE_SPREAD;
        const centerTarget = lockFor(centerX, centerY);
        const centerAim = aimFor(centerTarget, centerX, centerY,
          spd * (lv === 1 ? 1 : lv === 2 ? 1.12 : lv >= 5 ? 1.28 : 1.15));
        if (lv <= 2) {
          spawn({
            x: centerX, y: centerY, ...centerAim,
            r: r * (lv === 1 ? 1 : 1.45),
            damage: dmg * focusMul * (lv === 1 ? 1 : 1.18),
            pierce: lv >= 2, ...base,
          });
        } else {
          spawn({
            x: centerX, y: centerY, ...centerAim,
            r: r * (lv >= 5 ? 1.9 : lv >= 4 ? 1.7 : 1.35),
            damage: dmg * focusMul * (lv >= 5 ? 1.35 : 1.2), pierce: true, ...base,
          });
          const pin = (lv >= 4 ? [-28, 28] : [-10, 10]).map((v) => v * RIFLE_SPREAD);
          for (let i = 0; i < pin.length; i++) {
            const oy = pin[i];
            const x = this.x + 30;
            const y = this.y + oy * focusTight;
            const target = lockFor(x, y, i);
            spawn({
              x, y, ...aimFor(target, x, y, spd * 0.98),
              r: r * 0.85, damage: dmg * 0.22,
              delay: 0.04, pierce: lv >= 4, ...base,
            });
          }
          if (lv >= 4) {
            const x = this.x + 22;
            const y = this.y - lane * 8 * focusTight * RIFLE_SPREAD;
            const target = lockFor(x, y, 1);
            spawn({
              x, y, ...aimFor(target, x, y, spd * 0.88),
              r: r * 0.7, damage: dmg * 0.2 * focusMul, delay: 0.07, ...base,
            });
          }
          if (lv >= 5) {
            const x = this.x + 16;
            const y = this.y + lane * 6 * focusTight * RIFLE_SPREAD;
            const target = lockFor(x, y, 2);
            spawn({
              x, y, ...aimFor(target, x, y, spd * 1.42),
              r: r * 1.05, damage: dmg * 0.3 * focusMul,
              delay: 0.11, pierce: true, ...base,
            });
          }
        }
        break;
      }
      case 'p38': {
        // 1945 II P-38 Lightning: parallel twin-boom vulcan streams; P adds lanes and,
        // from Lv4, a slight outer fan. FOCUS pulls the lanes together.
        const lanes = [null, [-6, 6], [-10, 0, 10], [-15, -5, 5, 15], [-15, -5, 5, 15],
          [-18, -9, 0, 9, 18]][lv];
        const per = dmg * 0.34 * (this.focus ? 1.1 : 1);
        const v = spd * (1 + lv * 0.02);
        for (const oy of lanes) {
          spawn({ x: this.x + 34, y: this.y + oy * focusTight, vx: v, vy: 0,
            r, damage: per, lifetime: 1.4, ...base });
        }
        if (lv >= 4) {
          const fan = (lv >= 5 ? 0.13 : 0.09) * focusTight;
          for (const side of [-1, 1]) {
            spawn({ x: this.x + 28, y: this.y + side * 12 * focusTight,
              vx: Math.cos(fan) * v, vy: side * Math.sin(fan) * v,
              r: r * 0.9, damage: per * 0.85, lifetime: 1.4, ...base });
          }
        }
        break;
      }
      case 'shinden': {
        // 1945 II J7W Shinden (ref video): one cluster of lavender flame blades per volley,
        // fired fast enough that the clusters chain into a single thick purple column.
        // P makes the column wider (more / bigger blades) and hit harder.
        // Same 0.1s cadence as Griffin's P-38 shot; one cluster carries the volley damage.
        const per = dmg * [0, 0.75, 1.0, 1.25, 1.5, 1.75][lv] * (this.focus ? 1.1 : 1);
        spawn({ x: this.x + 34, y: this.y, vx: spd, vy: 0,
          r: [0, 7, 8, 9, 10, 11][lv], damage: per, lifetime: 1.6, ...base });
        break;
      }
      case 'pancake': {
        // 1945 II XF5U Flying Pancake: wide shot - a fan of pellets that opens with P.
        // FOCUS halves the fan for a narrower spread.
        const ways = [null, [0, -0.18, 0.18], [0, -0.12, 0.12, -0.26, 0.26],
          [0, -0.13, 0.13, -0.28, 0.28], [0, -0.1, 0.1, -0.21, 0.21, -0.34, 0.34],
          [0, -0.1, 0.1, -0.21, 0.21, -0.34, 0.34]][lv];
        const per = dmg * (lv >= 5 ? 0.36 : lv === 3 ? 0.34 : 0.3);
        const v = spd * (1 + lv * 0.02);
        // Spread at 50% of the original fan (user).
        const fan = (this.focus ? 0.5 : 1) * 0.5;
        for (const a of ways) {
          const ang = a * fan;
          spawn({ x: this.x + 30, y: this.y + Math.sin(ang) * 10, vx: Math.cos(ang) * v,
            vy: Math.sin(ang) * v, r: r * (lv >= 3 ? 1.15 : 1), damage: per,
            lifetime: 1.3, ...base });
        }
        break;
      }
      case 'marion': {
        // Gunbird Marion: wide magic spread fanned around the nose; power adds ways
        // (3/4/5/6/7) and widens the fan. Focus narrows it.
        const ways = [0, 3, 4, 5, 6, 7][lv];
        // Constantia: fan angle and muzzle offsets at 50% of the original (user).
        const MARION_SPREAD = 0.5;
        const half = [0, 0.2, 0.27, 0.34, 0.4, 0.46][lv] * MARION_SPREAD * (this.focus ? 0.5 : 1);
        const each = dmg * [0, 0.42, 0.36, 0.32, 0.29, 0.27][lv];
        for (let i = 0; i < ways; i++) {
          const k = ways === 1 ? 0 : i / (ways - 1) - 0.5;
          const ang = k * 2 * half;
          spawn({ x: this.x + 28, y: this.y + k * 10 * MARION_SPREAD, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            r: r * (lv >= 4 ? 1.15 : 1), damage: each, lifetime: 1.3, ...base });
        }
        break;
      }
      case 'spiral':
        // Peregrinus human form: Spiral Laser is a held beam (see _tickSpiral); FIRE only
        // keeps the 보조무기 cadence here.
        break;
      case 'falcon': {
        // Peregrinus: twin falcon darts in fixed lanes; P adds side pairs that splay a
        // little (Lv2/3: 1 pair, Lv4/5: 2 pairs) and thickens the darts.
        const each = dmg * [0, 0.5, 0.42, 0.4, 0.34, 0.33][lv];
        for (const oy of [-5, 5]) {
          spawn({ x: this.x + 34, y: this.y + oy * focusTight, vx: spd, vy: 0,
            r: r * (lv >= 3 ? 1.2 : 1), damage: each, lifetime: 1.1, ...base });
        }
        const pairs = lv >= 4 ? 2 : lv >= 2 ? 1 : 0;
        for (let k = 1; k <= pairs; k++) {
          for (const side of [-1, 1]) {
            const ang = side * (0.06 + (k - 1) * 0.06) * (this.focus ? 0.5 : 1);
            spawn({ x: this.x + 28, y: this.y + side * (10 + k * 7) * focusTight,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
              r: r * 0.85, damage: each * 0.8, lifetime: 1.1, ...base });
          }
        }
        break;
      }
      case 'hayate': {
        // 1945 II Ki-84 Hayate (ref: youtu.be/599ubitYGq4): two large crystal shards
        // fly straight ahead in fixed lanes at every power level; power-ups add small
        // side shards that splay slightly outward (Lv2/3: 1 pair, Lv4/5: 2 pairs = 6).
        const fan = this.focus ? 0.5 : 1;
        const mainDmg = dmg * [0, 0.52, 0.5, 0.5, 0.48, 0.48][lv];
        for (const oy of [-6, 6]) {
          spawn({ x: this.x + 32, y: this.y + oy * focusTight, vx: spd, vy: 0,
            r: r * 1.25, damage: mainDmg, lifetime: 1.3, ...base });
        }
        const pairs = lv >= 4 ? 2 : lv >= 2 ? 1 : 0;
        const sideDmg = dmg * (lv === 3 || lv === 5 ? 0.24 : 0.18);
        for (let k = 1; k <= pairs; k++) {
          for (const side of [-1, 1]) {
            const ang = side * (0.03 + (k - 1) * 0.035) * fan;
            spawn({ x: this.x + 26 - k * 4, y: this.y + side * (12 + k * 8) * focusTight,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
              r: r * (lv === 3 || lv === 5 ? 0.8 : 0.7), damage: sideDmg, lifetime: 1.3, ...base });
          }
        }
        break;
      }
      case 'axe':
      case 'baton':
      case 'tesla':
      case 'hmg':
      case 'plasma':
        fireRoleBasic(this, bullets, { lv, dmg, spd, r, base, targets });
        break;
      case 'railgun': {
        // Emily — one travelling laser. P widens, lengthens and brightens this beam.
        // Hold fires delayed rail spikes (weapon-skills); basic stays continuous railbeam.
        const focusMul = this.focus ? 1.14 : 1;
        spawn({
          x: this.x + 34, y: this.y,
          vx: spd * (1 + lv * 0.025), vy: 0,
          r: [0, 3.2, 4.5, 6.2, 8.3, 11.2][lv],
          damage: dmg * focusMul * (1.15 + lv * 0.08),
          pierce: true, beamLength: [0, 125, 175, 230, 300, 390][lv],
          ...base, style: 'railbeam',
        });
        break;
      }
      case 'yatagarasu':
      default: {
        // Pre-lore Yatagarasu jets — wide-formation fire stream (not falling napalm puffs).
        const focusMul = this.focus ? 1.12 : 1;
        const flame = (side, spread, scale = 1, delay = 0) => spawn({
          x: this.x + 28, y: this.y + side * 8 * focusTight,
          vx: spd * (0.96 + lv * 0.02),
          vy: side * spread * focusTight,
          r: r * scale,
          damage: dmg * focusMul * scale,
          pierce: lv >= 2,
          lifetime: 1.85,
          delay, ...base,
        });
        flame(0, 0, lv >= 2 ? 1.12 + lv * 0.05 : 1);
        if (lv >= 3) for (const side of [-1, 1]) flame(side, 150, 0.5);
        if (lv >= 4) flame(0, 0, 0.7, 0.08);
        if (lv >= 5) for (const side of [-1, 1]) flame(side, 230, 0.5, 0.12);
        break;
      }
    }
  }

  /**
   * 보조무기 (sub weapon). Griffin: 1945 II P-38 homing missiles, launched automatically
   * alongside the main shot on their own cooldown (no hold/charge). Pairs leave the
   * wing roots, flare outward, then boost and home on the nearest enemies.
   */
  fireSubWeapon(bullets) {
    if (this.hBomb) return; // keeps firing through the bird <-> human transformation (user)
    const kind = this.meta?.subWeapon;
    if (!kind || this._subCd > 0) return;
    const lv = Math.max(1, Math.min(5, this.shotLevel | 0));
    if (kind === 'heat') return this._fireHeatMissiles(bullets, lv);
    if (kind === 'syusui') {
      // Options act on their own tick; firing just keeps them on the attack.
      this._syusuiActive = 0.3;
      return;
    }
    if (kind === 'laser') return this._fireAutoLaser(bullets, lv);
    if (kind === 'hearts') return this._fireHearts(bullets, lv);
    if (kind === 'sonic') return this._fireSonicBoom(bullets, lv);
    const x36 = kind === 'x36missile';
    // Powers up with P like the main shot: every level adds missiles or fires faster.
    const pairs = [0, 1, 1, 2, 2, 3][lv];
    this._subCd = [0, 0.7, 0.5, 0.6, 0.45, 0.45][lv];
    const ranked = (bullets.targets || []).filter((e) => e.alive && e.x > this.x + 30)
      .sort((a, b) => (a.x - this.x) ** 2 + (a.y - this.y) ** 2
        - ((b.x - this.x) ** 2 + (b.y - this.y) ** 2));
    let n = 0;
    for (let k = 0; k < pairs; k++) {
      for (const side of [-1, 1]) {
        const target = ranked.length ? ranked[n % ranked.length] : null;
        n += 1;
        bullets.spawn({
          friendly: true, grazeable: false,
          x: this.x + 6 - k * 6, y: this.y + side * (14 + k * 10),
          vx: 230, vy: side * (150 + k * 40),
          accel: 1500, maxSpeed: 820,
          homing: 5.5, homingTarget: target,
          r: 5, damage: (this.meta.shotDamage || 1) * (0.9 + lv * 0.12),
          lifetime: 2.6, delay: k * 0.07,
          color: x36 ? '#fff4c2' : '#fff1c8', glow: x36 ? '#ff8a1e' : '#ff7a2a',
          style: x36 ? 'x36missile' : 'p38missile',
        });
      }
    }
  }

  /**
   * Sleipnir 보조무기 = 1945 II J7W heat missiles: fired straight ahead in pairs; each
   * drills through what it meets, multi-hitting (up to 5 hits per enemy), then flies on.
   */
  _fireHeatMissiles(bullets, lv) {
    // P widens each volley: Lv1 1 pair, Lv2 2, Lv3-4 3, Lv5 4 pairs (8 missiles), all
    // launched together on spread lanes so the upgrade reads at a glance. Two volleys may be
    // in flight (Lv4 three, Lv5 2.5) so each level fires more missiles per second.
    const sets = [0, 1, 2, 3, 3, 4][lv];
    const cap = sets * [0, 4, 4, 4, 6, 5][lv];
    let out = 0;
    for (const b of bullets.list) if (b.alive && b.style === 'heatmissile') out += 1;
    if (out + sets * 2 > cap) return;
    this._subCd = [0, 0.4, 0.38, 0.36, 0.28, 0.28][lv];
    const base = this.meta.shotDamage || 1;
    for (let k = 0; k < sets; k++) {
      for (const side of [-1, 1]) {
        bullets.spawn({
          friendly: true, grazeable: false,
          x: this.x + 18 - k * 10, y: this.y + side * (15 + k * 13),
          vx: 520, vy: 0, accel: 2400, maxSpeed: 1350,
          r: 6, damage: base * 0.2, lifetime: 2.4, delay: k * 0.035,
          multiHit: 0.045, multiHitMax: 10,
          color: '#f4f8ff', glow: '#3a8cff', style: 'heatmissile',
        });
      }
    }
  }

  /**
   * Labiata 보조무기 = 1945 II Ki-84 Hayate Shusui options. One option per power level.
   * While the player fires, each option picks an on-screen enemy (spread across
   * targets), flies to it, latches on and keeps firing short needles into it. When its
   * target dies or leaves the screen it moves on; idle options trail the ship.
   */
  _tickSyusui(dt, bullets) {
    if (this.meta?.subWeapon !== 'syusui') return;
    const lv = Math.max(1, Math.min(5, this.shotLevel | 0));
    const opts = (this._syusui ||= []);
    while (opts.length < lv) {
      opts.push({ x: this.x - 10, y: this.y, ang: 0, target: null, latched: false,
        fireT: 0, ox: 0, oy: 0 });
    }
    opts.length = lv;
    if (this._syusuiActive > 0) this._syusuiActive -= dt;
    const active = this._syusuiActive > 0;
    const live = (bullets.targets || []).filter((e) => e.alive && onScreen(e));
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      if (o.target && (!o.target.alive || !onScreen(o.target))) {
        o.target = null;
        o.latched = false;
      }
      if (active && !o.target && live.length) {
        // Prefer an enemy no other option has, nearest to this option.
        const taken = new Set(opts.map((q) => q.target).filter(Boolean));
        const pool = live.filter((e) => !taken.has(e));
        const from = pool.length ? pool : live;
        o.target = from.reduce((best, e) => ((e.x - o.x) ** 2 + (e.y - o.y) ** 2
          < (best.x - o.x) ** 2 + (best.y - o.y) ** 2 ? e : best), from[0]);
        o.latched = false;
        const r = (o.target.hitR || 20) * 0.55;
        o.ox = -r + (i % 2) * 6;
        o.oy = (i % 3 - 1) * r * 0.6;
      }
      if (!active) {
        o.target = null;
        o.latched = false;
      }
      let tx;
      let ty;
      if (o.target) {
        tx = o.target.x + o.ox;
        ty = o.target.y + o.oy;
      } else {
        // Trail formation behind the ship: a V symmetric about her (any option count).
        const k = i - (opts.length - 1) / 2;
        tx = this.x - 34 - Math.abs(k) * 16;
        ty = this.hitY + k * 26;
      }
      const dx = tx - o.x;
      const dy = ty - o.y;
      const d = Math.hypot(dx, dy);
      if (o.latched) {
        o.x = tx;
        o.y = ty;
      } else {
        const sp = o.target ? 1100 : 700;
        const step = Math.min(d, sp * dt);
        if (d > 0.01) {
          o.x += dx / d * step;
          o.y += dy / d * step;
          if (o.target || d > 3) o.ang = Math.atan2(dy, dx);
        }
        if (o.target && d < 8) o.latched = true;
        if (!o.target && d < 4) o.ang += (0 - o.ang) * Math.min(1, dt * 8);
      }
      if (o.latched && o.target) {
        o.ang = Math.atan2(o.target.y - o.y, o.target.x - o.x);
        o.fireT -= dt;
        if (o.fireT <= 0) {
          o.fireT = 0.09;
          const c = Math.cos(o.ang);
          const s = Math.sin(o.ang);
          bullets.spawn({
            friendly: true, grazeable: false, x: o.x + c * 12, y: o.y + s * 12,
            vx: c * 700, vy: s * 700, r: 6,
            damage: (this.meta.shotDamage || 1) * 0.3, lifetime: 0.2,
            color: '#e6fbff', glow: '#22d3ee', style: 'syusuishot',
          });
        }
      }
    }
  }

  /** Shusui option sprites (small cyan rocket planes), drawn over the body. */
  _drawSyusui(ctx) {
    // Hidden only while the body leaves the ship (bomb runs); C runs ride on it.
    if (!this._syusui || this.bombRun || (this.skillRun && !this.skillRun.spec.followShip) || !this.alive) return;
    for (const o of this._syusui) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.ang);
      ctx.scale(2, 2); // 2x so the options read clearly in combat
      ctx.globalCompositeOperation = 'lighter';
      const flick = 0.75 + 0.25 * Math.sin(this._t * 60 + o.oy);
      const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, 13);
      aura.addColorStop(0, 'rgba(94,234,212,0.55)');
      aura.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(-7, 0, 0, -7, 0, 13 * flick);
      g.addColorStop(0, 'rgba(200,250,255,0.95)');
      g.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(-10, 0, 13 * flick, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0e4a5c';
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(-6, -7.5);
      ctx.lineTo(-1, -7.5);
      ctx.lineTo(3, 0);
      ctx.lineTo(-1, 7.5);
      ctx.lineTo(-6, 7.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0fdff';
      ctx.beginPath();
      ctx.ellipse(2.5, -0.6, 2.6, 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Express 보조무기 = 1945 II XF5U automatic laser: thin blue lasers aimed precisely at
   * enemies (round-robin). P raises how many lasers may be on screen at once.
   */
  /**
   * Constantia 보조무기 = Gunbird Marion's homing stars, drawn as hearts: they pop out
   * around her and curve onto enemies. Like Marion's, they come much faster when she is
   * close to her target. P adds hearts per volley (1/2/2/3/4) and shortens the cycle.
   */
  _fireHearts(bullets, lv) {
    const ranked = (bullets.targets || []).filter((e) => e.alive && onScreen(e) && e.x > this.x - 20)
      .sort((a, b) => (a.x - this.x) ** 2 + (a.y - this.y) ** 2
        - ((b.x - this.x) ** 2 + (b.y - this.y) ** 2));
    const near = ranked.length ? Math.hypot(ranked[0].x - this.x, ranked[0].y - this.y) : 9999;
    const close = near < 220 ? 0.45 : near < 380 ? 0.7 : 1;
    this._subCd = [0, 0.6, 0.5, 0.46, 0.42, 0.38][lv] * close;
    const count = [0, 1, 2, 2, 3, 4][lv];
    for (let i = 0; i < count; i++) {
      this._heartPick = ((this._heartPick || 0) + 1) % 997;
      const target = ranked.length ? ranked[(this._heartPick + i) % Math.min(ranked.length, 4)] : null;
      const side = this._heartPick % 2 ? -1 : 1;
      const ang = side * (0.7 + (i % 2) * 0.5) - 0.2;
      bullets.spawn({
        friendly: true, grazeable: false,
        x: this.x + 8, y: this.y + side * 8,
        vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
        accel: 900, maxSpeed: 640,
        homing: 4.5 + lv * 0.4, homingTarget: target,
        // x0.7: homing hearts never miss a boss; they were half of her boss DPS.
        r: 9.5, damage: (this.meta.shotDamage || 1) * (0.7 + lv * 0.1) * 0.7,
        lifetime: 2.4, delay: i * 0.05,
        color: '#ffd6f0', glow: '#ff3d9a', style: 'heartshot',
      });
    }
  }

  /**
   * Peregrinus bird form 보조무기: sonic boom. A crescent shock wave leaves the beak and
   * rolls forward, swelling as it goes, piercing (each enemy hit once per wave). P makes it
   * bigger and more frequent; Lv4+ fires a second, trailing wave.
   */
  _fireSonicBoom(bullets, lv) {
    this._subCd = [0, 0.95, 0.8, 0.7, 0.62, 0.55][lv];
    const waves = lv >= 4 ? 2 : 1;
    for (let i = 0; i < waves; i++) {
      bullets.spawn({
        friendly: true, grazeable: false,
        x: this.x + 36, y: this.y, vx: 560, vy: 0,
        r: [0, 20, 23, 26, 29, 33][lv], pierce: true,
        damage: (this.meta.shotDamage || 1) * (0.9 + lv * 0.15),
        lifetime: 1.5, delay: i * 0.14,
        color: '#f2fff4', glow: '#5dffa0', style: 'sonicboom',
      });
    }
  }

  /**
   * Express 76 sub weapon: a short forward laser. Every cooldown a straight beam flashes from
   * the nose to the screen edge for SUB_BEAM.dur s, piercing everything in its band; thicker
   * and more often with P. Damage ticks in Game._tickSubBeam.
   */
  _fireAutoLaser(bullets, lv) {
    if (this._subBeam) return;
    this._subCd = SUB_BEAM.cd[lv];
    this._subBeam = { t: 0, lv, half: SUB_BEAM.half[lv],
      dmg: (this.meta.shotDamage || 1) * SUB_BEAM.dmg[lv] };
  }

  _tickSubBeam(dt) {
    const sb = this._subBeam;
    if (!sb) return;
    sb.t += dt;
    if (sb.t >= SUB_BEAM.dur || !this.alive || this.isRespawning) this._subBeam = null;
  }

  /** Beam opening (0-1): snaps on in 0.04 s, thins out over the last 0.1 s. */
  get subBeamOpen() {
    const sb = this._subBeam;
    if (!sb) return 0;
    return Math.min(1, sb.t / 0.04) * Math.min(1, (SUB_BEAM.dur - sb.t) / 0.1);
  }

  _drawSubBeam(ctx) {
    const sb = this._subBeam;
    const k = this.subBeamOpen;
    if (!sb || k <= 0) return;
    const x0 = this.x + 24;
    const y = this.y + 2;
    const x1 = W + 40; // full field width (W is 960..1280)
    const half = sb.half * (0.35 + 0.65 * k);
    const taper = 34;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Each layer: a spindle that starts as a point in the muzzle and swells to full width
    // over `taper` px (no hard-cut rectangle end), fading in along x.
    const layer = (h, color, alpha) => {
      const g = ctx.createLinearGradient(x0 - 4, 0, x0 + taper, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, color);
      ctx.globalAlpha = alpha * k;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - 4, y);
      ctx.quadraticCurveTo(x0 + taper * 0.35, y - h, x0 + taper, y - h);
      ctx.lineTo(x1, y - h);
      ctx.lineTo(x1, y + h);
      ctx.lineTo(x0 + taper, y + h);
      ctx.quadraticCurveTo(x0 + taper * 0.35, y + h, x0 - 4, y);
      ctx.closePath();
      ctx.fill();
    };
    layer(half * 4.2, '#2f8cff', 0.12);
    layer(half * 2.4, '#2f8cff', 0.35);
    layer(half, '#5fb4ff', 0.75);
    layer(half * 0.38, '#e8f6ff', 0.95);
    // Muzzle: round bloom + short cross glints so the beam pours out of the gun.
    const r = half * 4.2;
    const g = ctx.createRadialGradient(x0, y, 0, x0, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(150,205,255,0.65)');
    g.addColorStop(1, 'rgba(47,140,255,0)');
    ctx.globalAlpha = k;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x0, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8 * k;
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath();
    ctx.ellipse(x0, y, r * 1.5, Math.max(1, half * 0.22), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x0, y, Math.max(1, half * 0.22), r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Power options (Lv2+) — per-character assist trajectories, not one shared orbit spray.
   */
  fireOptions(bullets) {
    if (this.hBomb) return; // keeps firing through the bird <-> human transformation (user)
    const lv = this.shotLevel | 0;
    if (lv < 2) return;
    const shot = this.meta.shot || {};
    const color = shot.glow || shot.color || '#9ef0ff';
    const rare = !!this.meta.rare;
    const pattern = shot.pattern || 'yatagarasu';
    if (['axe', 'baton', 'tesla', 'hmg', 'plasma', 'p38', 'shinden', 'pancake', 'hayate', 'marion', 'falcon', 'x36sp'].includes(pattern)) return;
    const dmg = (this.meta.shotDamage || 1)
      * (lv >= 5 ? 0.5 : lv >= 3 ? 0.42 : 0.32) * (rare ? 1.06 : 1);
    const spd = (this.meta.shotSpeed || 420) * 0.88;
    const focusOpt = this.focus ? 0.55 : 1;
    const style = shot.style || 'orb';
    const twin = lv >= 3;
    const spawnOpt = (spec) => bullets.spawn({
      friendly: true, grazeable: false, damage: dmg, color, glow: color, style,
      nativeKey: BASIC_KEYS[pattern], powerLevel: lv, ...spec,
    });

    switch (pattern) {
      case 'rifle': {
        // 1945 option guns: aimed snapshots at split lanes, not seeking missiles.
        const ys = twin ? [-18, 18] : [this._shotCounter % 2 ? -16 : 16];
        const targets = (bullets.targets || []).filter((enemy) => enemy.alive && enemy.x > this.x + 60)
          .sort((a, b) => a.x - b.x);
        const used = new Set();
        for (const oy of ys) {
          const x = this.x + 10;
          const y = this.y + oy * focusOpt;
          const available = targets.filter((enemy) => !used.has(enemy));
          const choices = available.length ? available : targets;
          const target = choices.sort((a, b) => {
            const score = (enemy) => {
              const dx = enemy.x - x;
              const dy = enemy.y - y;
              const lanePenalty = Math.sign(enemy.y - this.y) === Math.sign(oy) ? 0 : 12000;
              return dx * dx + dy * dy + lanePenalty;
            };
            return score(a) - score(b);
          })[0];
          if (target) used.add(target);
          const speed = spd * (lv >= 5 ? 1.12 : 1.05);
          const angle = target ? Math.atan2(target.y - y, target.x - x) : null;
          spawnOpt({
            x, y,
            vx: angle === null ? speed : Math.cos(angle) * speed,
            vy: angle === null
              ? (lv >= 3 ? -oy * (lv >= 5 ? 2.1 : 1.55) * focusOpt : 0)
              : Math.sin(angle) * speed,
            damage: dmg * 0.5,
            r: lv >= 4 ? 4.2 : 3.8, style: 'tracer', pierce: lv >= 4,
            lifetime: 2.1,
          });
        }
        break;
      }
      case 'railgun': {
        // Her P upgrades modify the single laser; no extra escort projectiles.
        break;
      }
      case 'yatagarasu':
      default: {
        // Wide-formation escort embers cover lanes outside the central flame.
        const n = twin ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const side = twin ? (i === 0 ? -1 : 1) : (this._shotCounter % 2 ? -1 : 1);
          spawnOpt({
            x: this.x + 16, y: this.y + side * 16 * focusOpt,
            vx: spd * 0.98, vy: side * (110 + lv * 24) * focusOpt,
            r: lv >= 4 ? 5.4 : 4.4, style: 'foxflame',
            delay: i * 0.04,
          });
        }
        break;
      }
    }
  }

  /** Hold-FIRE tactical shot — scales with shotLevel inside weapon-skills. */
  fireCharge(bullets) {
    if (this.meta?.chargeEnabled === false) return;
    fireCharacterCharge(this, bullets);
  }

  /**
   * 재고형 폭탄 (X) — SP와 무관.
   * 전국블레이드식: 적탄 즉시 소거 + 긴 무적(긴급 회피).
   * LRL uses its original Skill2 animation while the screen-wide bomb resolves.
   */
  tryBomb(bullets) {
    if (!this.alive || this.respawnTimer > 0 || this.deathBombTimer > 0 || this.bombs <= 0 || this.entering > 0
      || this.bombRun || this.skillRun) {
      return false;
    }
    this.bombs -= 1;
    this.invuln = Math.max(this.invuln, 2.6);
    this.bombFlash = 0.7;
    this.charge = 0;
    this._chargeQueued = false;
    this._shootQueued = false;
    // Peregrinus human form: X = her original Skil_2 giant beam (ends in the bird).
    if (this.inHumanForm && this._hBombAnim && this._startHumanBomb(undefined, undefined, bullets?.targets)) return true;
    // Peregrinus bird form: X = her original bird_Skil_2 dive flurry.
    if (this._baseMeta?.birdBomb && this.meta === this._baseMeta && this._bBombAnim
      && !(this.changing > 0) && !(this.reverting > 0)
      && this._startHumanBomb(this._baseMeta.birdBomb, this._bBombAnim, bullets?.targets)) return true;
    if (this.anim.hasSkill2) {
      this.anim.locked = false;
      this.anim.play('skill2', { lock: true });
    }
    // Griffin: full original Skill2 bombing run (griffin-skill.js); others: skill-run.js.
    if (this.charKey === 'griffin') startGriffinRun(this);
    else if (RUN_SPECS[this.charKey]?.bomb) {
      startRun(this, RUN_SPECS[this.charKey].bomb, { kind: 'bomb', enemies: bullets?.targets });
    }
    this._startBombAnimLock();
    // Enemy-bullet clear runs in Game._onBombFired (after wipe sparks).
    return true;
  }

  /**
   * Deathbomb: spend a bomb during the post-hit grace to cancel the life loss.
   * Clears enemy bullets (same as a normal X bomb); does not spend a life.
   */
  tryDeathBomb(bullets) {
    if (this.deathBombTimer <= 0 || !this.alive || this.bombs <= 0) return false;
    this.bombs -= 1;
    this.deathBombTimer = 0;
    this.respawnTimer = 0;
    this.deathFlash = 0;
    this.missJustCommitted = null;
    this.anim.locked = false;
    this.anim.play(this.anim.hasSkill2 ? 'skill2' : 'idle',
      { restart: true, lock: this.anim.hasSkill2 });
    this.invuln = Math.max(this.invuln, 2.6);
    if (this.charKey === 'griffin') startGriffinRun(this);
    else if (RUN_SPECS[this.charKey]?.bomb) {
      startRun(this, RUN_SPECS[this.charKey].bomb, { kind: 'bomb', enemies: bullets?.targets });
    }
    this._startBombAnimLock();
    this.bombFlash = 0.7;
    this.charge = 0;
    this._chargeQueued = false;
    this._shootQueued = false;
    // Enemy-bullet clear runs in Game._onBombFired (after wipe sparks).
    return true;
  }

  /** Grace expired — spend life and either game-over or mid-life respawn flash. */
  _commitMiss() {
    // A miss ends the human form (back to the bird).
    this._endHumanBomb();
    this._cancelChange();
    if (this.inHumanForm) this._leaveHumanForm();
    this.lives -= 1;
    this.charge = 0;
    this._chargeQueued = false;
    this._shootQueued = false;
    // Miss resets P shot level only (deathbomb success never reaches here).
    this.resetShotPower();
    this.recoveryTimer = Math.max(this.recoveryTimer, 7);
    this.deathFlash = 0.55;
    this.anim.play('die', { lock: true });
    if (this.lives <= 0) {
      this.alive = false;
      this.respawnTimer = 0;
      this.missJustCommitted = 'dead';
      return;
    }
    // The die clip plays to its end, the ship is gone for RESPAWN_GAP, then flies back in
    // from the left edge (user: full death motion, then re-enter from the start).
    this.respawnTimer = this.dieLeft + RESPAWN_GAP;
    this.missJustCommitted = 'respawn';
  }

  /**
   * Express 76 Skill2 "Here's Your Delivery!" grants an ally ATK/CRIT +20% and AP +3.
   * Solo adaptation: X delivers to herself — 6s of +20% shot damage (Game) and
   * faster cadence, riding the existing unrepFor buff timer/aura.
   */
  _grantDeliveryBuff() {
    if (this.charKey !== 'express76') return;
    // AP +3 -> one extra C-gauge segment ("Delivery Complete!").
    this.unrepFor = Math.max(this.unrepFor, 6);
    this.sp = Math.min(this.spMax, this.sp + this.spCost);
    this.buffJustGranted = 'delivery'; // Game shows what it gives (user)
  }

  /** True while a bomb animation is playing: the ship cannot move. */
  get bombLocked() {
    if (this.hBomb?.cfg.mobile) return false; // human X: she steers the beam
    return !!(this.bombRun || this.skillRun?.kind === 'bomb' || this._bombAnimLock > 0 || this.hBomb);
  }

  /**
   * Pilots without an original-skill bomb run: root for the bomb clip (skill2 if
   * baked, else the bomb VFX length) and stay invulnerable until 2s after it ends.
   */
  _startBombAnimLock() {
    if (this.bombRun || this.skillRun) return;
    const clip = this.anim.hasSkill2 ? this.anim.clips.skill2 : null;
    const dur = clip?.length ? clip.length / (this.anim.fps.skill2 || 24) : 1.7;
    this._bombAnimLock = dur;
    // Covered through the clip; the 2s post-bomb window is set when the lock releases.
    this.invuln = Math.max(this.invuln, dur + 2.5);
  }

  /** C: character-specific attack or local bullet-control skill; X remains the full-screen bomb. */
  trySpecial(bullets) {
    if (!this.alive || this.isRespawning || this.entering > 0 || !this.spReady || this.bombRun || this.skillRun) return false;
    if (this.meta?.humanForm && this._altAnim) {
      // Peregrinus: C = transform to the human form (longer with C level); no re-cast.
      if (this.inHumanForm || this.changing > 0 || this.reverting > 0) return false;
      const lv = this.specialLevel;
      this.sp -= lv * this.spCost;
      this.lastSpecialLevel = lv;
      this.specialFlash = 0.28 + lv * 0.06;
      return this._startChange(lv);
    }
    const level = this.specialLevel;
    this.sp -= level * this.spCost;
    this.lastSpecialLevel = level;
    this.specialFlash = 0.28 + level * 0.06;
    const shot = this.meta.shot || {};
    const attack = (SPECIAL_ATTACKS[this.charKey] || SPECIAL_ATTACKS.hirume)[level - 1];
    this.lastSpecialName = attack.name;
    if (RUN_SPECS[this.charKey]?.special) {
      // Original Skill1 run (Griffin format): body, path, projectiles and FX from the clip.
      // A per-level array (Sleipnir) picks that level's routine.
      const spec = RUN_SPECS[this.charKey].special;
      startRun(this, Array.isArray(spec) ? spec[level] || spec[1] : spec, { kind: 'special', level, enemies: bullets.targets });
      return true;
    }
    if (this.charKey === 'lrl' && this.anim.clips.skill1?.length) {
      // LRL C: a short burst of her original skill1 dash (forward run only).
      this.anim.locked = false;
      this.anim.play('skill1', { lock: true });
      this.anim.time = LRL_DASH_FROM / 24.1008;
    } else if (this.anim.hasAttack) {
      this.anim.locked = false;
      this.anim.play('attack', { lock: true });
    }
    if (this.charKey === 'merlin') this.unrepFor = 2.5 + level;
    const topTarget = attack.role === 'artillery' || attack.role === 'area-denial'
      || attack.role === 'support-suppression'
      || attack.role === 'area-salvo'
      || attack.role === 'area-shock'
      || attack.role === 'plasma-bloom'
      || attack.role === 'pin-control'
      || attack.role === 'area-shock'
      || attack.role === 'plasma-bloom'
      || attack.role === 'freight-shipping'
      ? (bullets.targets || []).filter((enemy) => enemy.alive && enemy.x > this.x + 50)
        .sort((a, b) => (b.hp || 0) - (a.hp || 0))[0]
      : null;
    for (const spec of attack.shots) {
      const fromTop = spec.origin === 'top';
      const atTarget = spec.origin === 'target';
      bullets.spawn({
        x: fromTop || atTarget
          ? (topTarget?.x ?? this.x + 370) + (spec.x || 0)
          : this.x + (spec.x ?? 28),
        y: fromTop ? 8 : atTarget ? (topTarget?.y ?? this.y) + (spec.y || 0)
          : this.y + (spec.y || 0),
        vx: spec.vx ?? (this.meta.shotSpeed || 800) * (spec.speed ?? 1),
        vy: spec.vy ?? 0,
        r: spec.r, damage: spec.damage, delay: spec.delay || 0,
        waveAmplitude: spec.waveAmplitude || 0, waveFrequency: spec.waveFrequency || 14,
        friendly: true, grazeable: false, special: true, specialLevel: level,
        pierce: !!spec.pierce,
        homing: spec.homing || 0, lifetime: spec.lifetime || 0,
        homingTarget: attack.role === 'pin-control' ? topTarget : null,
        markDuration: spec.markDuration || 0, rootDuration: spec.rootDuration || 0,
        clearRadius: spec.clearRadius || 0, blastRadius: spec.blastRadius || 0,
        beamLength: spec.beamLength || 0,
        chainCount: spec.chainCount || 0, chainRadius: spec.chainRadius || 0,
        nativeKey: spec.nativeKey || null,
        cloneSize: spec.cloneSize || 0,
        knockback: spec.knockback || 0, invoiceDuration: spec.invoiceDuration || 0,
        style: spec.style || shot.style || 'orb', color: spec.color || shot.color, glow: spec.glow || shot.glow,
      });
    }
    return true;
  }

  hit() {
    // Debug U: invincibility toggle (Game._toggleGodCheat).
    if (this.godMode) return false;
    if (this.invuln > 0 || !this.alive || this.isRespawning) return false;
    this._cancelChange();
    this.skillRun = null;
    this.charge = 0;
    this.unrepFor = 0;
    this._chargeQueued = false;
    // Keep _shootQueued through grace — tap after revive still counts.
    this.missJustCommitted = null;
    // Open a short deathbomb window before spending the life.
    // Bullets stay on screen until a successful X bomb (or grace ends → respawn/GO).
    // First window of the sortie is slightly longer so the X cue can be learned.
    this.deathBombOpens += 1;
    this._deathBombWindowMax = this.deathBombOpens === 1
      ? this.deathBombFirstMax
      : this.deathBombMax;
    this.deathBombTimer = this._deathBombWindowMax;
    this.deathFlash = 0.55;
    this.anim.play('die', { lock: true });
    return true;
  }

  draw(ctx) {
    if (!this.alive && this.anim.state !== 'die') return;
    if (this.isRespawning) {
      // Brief impact flash; skip locomotion/options while downed.
      const deathbomb = this.deathBombTimer > 0;
      // Die clip finished: the ship is gone until it flies back in.
      if (!deathbomb && this.anim.state === 'die' && this.dieLeft <= 0) return;
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(this.deathFlash * 22));
      ctx.save();
      ctx.globalAlpha = deathbomb ? pulse : 1;
      this.anim.draw(ctx, this.x + this.drawOffsetX, this.y + this.drawOffsetY, this.drawSize, {
        flipX: this.facing < 0,
        flash: this.deathFlash > 0.2,
      });
      // Deathbomb grace: urgent ring so the X window reads vs a normal death flash.
      if (deathbomb) {
        const ratio = this.deathBombRatio;
        // Wall-clock urgency — deathFlash freezes under hitstop and made the ring look stuck.
        const now = performance.now();
        const urg = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.028));
        const stocked = this.bombs > 0;
        const accent = stocked ? '#ffe08a' : '#ff7a6a';
        const hot = stocked ? '#fff4c8' : '#ffc0b0';
        const rInner = 30 + (1 - ratio) * 10;
        const teach = this.isFirstDeathBomb;

        // Soft under-bloom so the timer ring separates from the die sprite.
        const prevComp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = accent;
        ctx.globalAlpha = (0.16 + urg * 0.18) * (0.7 + ratio * 0.3);
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 26 + (1 - ratio) * 6, 18 + (1 - ratio) * 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hot;
        ctx.globalAlpha = (0.12 + urg * 0.14) * ratio;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Soft-sprite grit / tip needles on the countdown arc (no X / slash geometry).
        // Tip-forward stretch + cool-band rear — moteN frozen (6 / teach 8); no dens churn.
        const moteN = teach ? 8 : 6;
        for (let i = 0; i < moteN; i++) {
          const span = Math.max(0.08, ratio) * Math.PI * 2;
          const a = -Math.PI / 2 + (span * (i + 0.5)) / moteN + Math.sin(now * 0.01 + i) * 0.04;
          const rad = rInner + ((i % 3) - 1) * 2.2;
          const px = this.x + Math.cos(a) * rad;
          const py = this.y + Math.sin(a) * rad;
          const fine = (i % 2) === 0;
          // Tip needles stretch harder; soft rear chips stay shorter (option-trail language).
          const stretch = fine ? 2.65 + (i % 3) * 0.4 : 1.78 + (i % 2) * 0.35;
          const rr = fine ? 0.62 : 0.98;
          const tipBias = fine ? 1 : 0.28;
          const pulse = 0.4 + 0.45 * Math.sin(now * 0.02 + i * 1.3);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a + Math.PI / 2);
          ctx.scale(stretch, 1);
          // Cool-band: tip = hot core, rear soft chip = cooler accent (stocked gold / empty red).
          ctx.fillStyle = tipBias > 0.45 ? hot : accent;
          ctx.globalAlpha = ((tipBias > 0.45 ? 0.32 : 0.2) + urg * 0.35) * pulse;
          ctx.beginPath();
          ctx.arc(0, 0, rr * 1.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = tipBias > 0.35 ? '#fffef8' : '#fff8e8';
          ctx.globalAlpha = (0.42 + tipBias * 0.28 + urg * 0.28) * pulse;
          ctx.beginPath();
          ctx.arc(rr * 0.38, 0, Math.max(0.32, rr * (0.28 + tipBias * 0.08)), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalCompositeOperation = prevComp;

        // Countdown + presence rings — dark under-rim + tip edge keep the X-window
        // telegraph readable against same-hue additive bloom / neon wash (cue only;
        // moteN / rInner / 38 / 44 / deathBomb timers frozen).
        const a0 = -Math.PI / 2;
        const a1 = a0 + Math.PI * 2 * ratio;
        const arcA = 0.4 + urg * 0.5;
        const ringA = 0.28 + urg * 0.35;
        const haloA = (0.18 + urg * 0.22) * ratio;
        ctx.lineCap = 'round';

        ctx.globalAlpha = arcA * 0.9;
        ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
        ctx.lineWidth = teach ? 5.5 : 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, rInner, a0, a1);
        ctx.stroke();
        ctx.globalAlpha = arcA;
        ctx.strokeStyle = accent;
        ctx.lineWidth = teach ? 3.5 : 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, rInner, a0, a1);
        ctx.stroke();
        ctx.strokeStyle = '#fffef8';
        ctx.globalAlpha = arcA * 0.72;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, rInner, a0, a1);
        ctx.stroke();

        ctx.globalAlpha = ringA * 0.9;
        ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = ringA;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fffef8';
        ctx.globalAlpha = ringA * 0.72;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 38, 0, Math.PI * 2);
        ctx.stroke();

        // Outer halo tick — remaining-window readability without filling the die body.
        ctx.globalAlpha = haloA * 0.9;
        ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 44, a0, a1);
        ctx.stroke();
        ctx.globalAlpha = haloA;
        ctx.strokeStyle = hot;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 44, a0, a1);
        ctx.stroke();
        ctx.strokeStyle = '#fffef8';
        ctx.globalAlpha = haloA * 0.72;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 44, a0, a1);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    // Soft ghost during i-frames — hard blink hid the ship (and focus core) in dense fire.
    const s = this.drawSize;
    const invulnA = this.invuln > 0
      ? 0.38 + (0.5 + 0.5 * Math.sin(this.invuln * 26)) * 0.42
      : 1;
    ctx.save();
    if (this.unrepFor > 0 && this.alive) {
      // Buff aura (user): a warm yellow glow behind the body with flame motes rising off it,
      // fading out over the last 0.6s. Rides on the body even while a skill run moved it.
      const ro = this.skillRun ? skillRunOffset(this, this.skillRun) : { dx: 0, dy: 0 };
      const cx = this.x + ro.dx;
      const cy = this.y + ro.dy;
      const fade = Math.min(1, this.unrepFor / 0.6) * invulnA;
      const r = s * 1.05 * (0.9 + 0.1 * Math.sin(this._t * 8));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255, 240, 160, 0.85)');
      g.addColorStop(0.5, 'rgba(255, 205, 60, 0.5)');
      g.addColorStop(1, 'rgba(255, 160, 20, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.9, r * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd860';
      for (let i = 0; i < 8; i++) {
        const ph = (this._t * 1.3 + i / 8) % 1;
        const ang = (i / 8) * Math.PI * 2 + Math.sin(this._t * 2 + i) * 0.3;
        const mx = cx + Math.cos(ang) * s * 0.48 * (1 - ph * 0.4);
        const my = cy + s * 0.3 - ph * s * 1.0;
        ctx.globalAlpha = fade * (1 - ph) * 0.85;
        ctx.beginPath();
        ctx.ellipse(mx, my, s * 0.07 * (1 - ph * 0.5), s * 0.13 * (1 - ph * 0.5), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // (No rare underglow / power option orbs behind the character - removed by request.)
    if (this.specialFlash > 0) {
      const level = this.lastSpecialLevel || 1;
      const k = this.specialFlash / (0.28 + level * 0.06);
      const mx = this.x + 30;
      const my = this.y;
      const style = this.meta.shot?.style || 'orb';
      const accent = this.meta.shot?.glow || this.meta.shot?.color || '#ffe08a';
      const kit = this.meta.shot?.color || '#ffe08a';
      // Soft bloom flash (shared ellipse stack — not geometric C marks).
      ctx.globalAlpha = k * 0.28 * invulnA;
      ctx.fillStyle = kit;
      ctx.beginPath();
      ctx.ellipse(mx, my, 16 + level * 11, 8 + level * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = k * 0.7 * invulnA;
      ctx.beginPath();
      ctx.ellipse(mx, my, 9 + level * 7, 4 + level * 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e8';
      ctx.globalAlpha = k * 0.85 * invulnA;
      ctx.beginPath();
      ctx.ellipse(mx, my, 4 + level * 2, 2 + level, 0, 0, Math.PI * 2);
      ctx.fill();
      // C special muzzle: grit + forward needles w/ tip cores (soft-sprite language).
      // Tip-forward stretch + cool-band rear — moteN frozen (7 / lightning|foxflame 9).
      const prevComp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      const moteN = style === 'lightning' || style === 'foxflame' ? 9 : 7;
      for (let i = 0; i < moteN; i++) {
        const fine = (i % 3) === 0;
        const a = this._t * 9 + i * 1.7;
        const rad = 6 + level * 2 + (i % 3) * 3 + (fine ? 1.2 : 0);
        const px = mx + Math.cos(a) * rad * 0.45 + 6 + (i % 4) * 1.1;
        const py = my + Math.sin(a) * rad * 0.38 + ((i % 5) - 2) * 0.75;
        const pulse = 0.38 + 0.42 * Math.sin(this._t * 14 + i);
        // Tip needles stretch harder; soft rear chips stay shorter (deathbomb/focus language).
        const stretch = fine
          ? (2.65 + (i % 3) * 0.4 + level * 0.18)
          : (1.78 + (i % 2) * 0.35 + level * 0.1);
        const r = fine
          ? (0.65 + level * 0.12)
          : (1.15 + (i % 3) * 0.32 + level * 0.18);
        const tipBias = fine ? 1 : 0.28;
        const ang = ((i % 5) - 2) * 0.16;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.scale(stretch, 1);
        // Cool-band: tip = kit accent hot, rear soft chip = cooler kit mid.
        ctx.fillStyle = tipBias > 0.45 ? accent : kit;
        ctx.globalAlpha = k * pulse * ((tipBias > 0.45 ? 0.42 : 0.28)) * invulnA;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = k * pulse * ((tipBias > 0.45 ? 0.88 : 0.62)) * invulnA;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tipBias > 0.35 ? '#fffef8' : '#fff8e8';
        ctx.globalAlpha = k * pulse * (0.55 + tipBias * 0.28) * invulnA;
        ctx.beginPath();
        ctx.arc(r * 0.38, 0, Math.max(0.32, r * (0.28 + tipBias * 0.08)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = prevComp;
      if (style === 'lightning') {
        const g = ctx.createRadialGradient(mx, my, 1, mx + 4, my, 14 + level * 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, accent);
        g.addColorStop(1, 'rgba(80,220,255,0)');
        ctx.globalAlpha = k * 0.55 * invulnA;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(mx + 4, my, 12 + level * 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Hold-FIRE feedback is HUD gauge + muzzle cue (projectile-vfx).
    // No behind-character gather orbs/rings while charging.

    // Sword waves etc. still flying after a finished run (spec.detachShots).
    drawRunLeft(ctx, this);
    ctx.globalAlpha = invulnA;
    if (this.skillRun) {
      // Original skill run: the body follows the clip's root-motion path; no i-frame blink.
      const o = skillRunOffset(this, this.skillRun);
      drawRunUnder(ctx, this, s);
      ctx.globalAlpha = 1;
      this.anim.draw(ctx, this.x + o.dx + this.drawOffsetX, this.y + o.dy + this.drawOffsetY, s,
        { flipX: this.facing < 0 });
      drawRunOver(ctx, this, s);
    } else if (this.bombRun) {
      // Griffin Skill2: body follows the original pelvis flight path; no i-frame blink.
      const o = runOffset(this, this.bombRun.t);
      drawGriffinRunUnder(ctx, this, s);
      ctx.globalAlpha = 1;
      this.anim.draw(ctx, this.x + o.dx + this.drawOffsetX, this.y + o.dy + this.drawOffsetY, s,
        { flipX: this.facing < 0 });
      drawGriffinRunOver(ctx, this);
    } else {
      ctx.globalAlpha = invulnA;
      // bombDx: the bird X dive moves only the body (and its FX), not the ship.
      const bx = this.x + (this.bombDx || 0);
      const by = this.y + (this.bombDy || 0);
      this.anim.draw(ctx, bx + this.drawOffsetX, by + this.drawOffsetY, s,
        { flipX: this.facing < 0 });
      drawChangeFx(ctx, this, bx + this.drawOffsetX, by + this.drawOffsetY);
      this._drawSubBeam(ctx);
      if (this.beamGrow > 0 && this._beamCfg) {
        drawSpiralBeam(ctx, this.beamX, this.y, this.beamGrow, this.beamOn ? 1 : this.beamFade,
          this.beamPhase, this.beamWidthMul || 1, this._beamCfg);
      }
      if (this.formBlink > 0) {
        // Human form running out: the body flashes yellow (second, tinted additive pass).
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.formBlink;
        ctx.filter = 'brightness(0.7) sepia(1) saturate(9) hue-rotate(5deg)';
        this.anim.draw(ctx, this.x + this.drawOffsetX, this.y + this.drawOffsetY, s,
          { flipX: this.facing < 0 });
        ctx.restore();
      }
    }

    this._drawSyusui(ctx);

    if (this.alive && (SHOW_HURT_POINT || this.focus)) {
      // Hurt point = the white focus core (user: reads better than the old red sphere). Always
      // shown, at reduced opacity outside FOCUS; full strength while focusing.
      const coreA = this.focus ? 1 : 0.55;
      // Focus core: soft bloom + orbit grit, then solid white hitbox on top.
      const hx = this.hitX;
      const hy = this.hitY;
      const hr = this.hitR;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(this._t * 9.5));
      const prevFocus = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#9ef0ff';
      ctx.globalAlpha = (0.14 + pulse * 0.1) * invulnA * coreA;
      ctx.beginPath();
      ctx.ellipse(hx, hy, hr + 10, hr + 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e8';
      ctx.globalAlpha = (0.1 + pulse * 0.12) * invulnA * coreA;
      ctx.beginPath();
      ctx.ellipse(hx, hy, hr + 5, hr + 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Soft-sprite grit on a tight orbit — tip-forward + cool-band (moteN frozen 5).
      const moteN = 5;
      for (let i = 0; i < moteN; i++) {
        const a = this._t * 3.4 + (Math.PI * 2 * i) / moteN;
        const rad = hr + 7.5 + ((i % 3) - 1) * 1.1;
        const px = hx + Math.cos(a) * rad;
        const py = hy + Math.sin(a) * rad;
        const fine = (i % 2) === 0;
        // Tip needles stretch harder; soft rear chips shorter (deathbomb / option language).
        const stretch = fine ? 2.15 + (i % 3) * 0.28 : 1.78 + (i % 2) * 0.22;
        const rr = fine ? 0.72 : 0.98;
        const tipBias = fine ? 1 : 0.28;
        const flicker = 0.4 + 0.4 * Math.sin(this._t * 14 + i * 1.7);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a + Math.PI / 2);
        ctx.scale(stretch, 1);
        // Cool-band: tip cyan wash → warmer rear chip.
        ctx.fillStyle = tipBias > 0.45 ? '#9ef0ff' : '#fff8e8';
        ctx.globalAlpha = ((tipBias > 0.45 ? 0.3 : 0.2) + pulse * 0.22) * flicker * invulnA * coreA;
        ctx.beginPath();
        ctx.arc(0, 0, rr * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tipBias > 0.35 ? '#fffef8' : '#fff8e8';
        ctx.globalAlpha = (0.48 + tipBias * 0.28 + pulse * 0.22) * flicker * invulnA * coreA;
        ctx.beginPath();
        ctx.arc(rr * 0.38, 0, Math.max(0.32, rr * (0.28 + tipBias * 0.08)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = prevFocus;

      // Solid core — dark under-rim + tip edge keep the focus hitbox
      // readable against pale-cyan neon wash (cue only; bloom / mote dens /
      // hitR geometry frozen).
      ctx.globalAlpha = coreA;
      ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(hx, hy, hr + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, hr + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.strokeStyle = '#fffef8';
      ctx.globalAlpha = 0.72 * invulnA * coreA;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(hx, hy, hr + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = coreA;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
