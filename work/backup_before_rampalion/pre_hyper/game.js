import { STAGES } from './stage-plan.js';
import { drawStageBackground } from './stage-background.js';
import { ArcadeAudio, moodForStage } from './audio.js';
import { BombVfx } from './bomb-vfx.js';
import { ProjectileVfx } from './projectile-vfx.js';
import { runPos, SKILL_SFX } from './skill-run.js';
import { VOICE_EVENTS, VOICE_ACTIONS } from './voice-events.js';
import { BGM_TABLE } from './bgm-tracks.js';
import { PILOT_VOICES } from './pilot-voices.js';
import { PolishFx } from './polish-fx.js';
import { Player } from './player.js';
import { hazardHits, setHazardImpact, setHazardCue } from './leader-hazards.js';
import { HitFx, hasHitRecipe } from './hit-fx.js';
import { Enemy, preloadCommanderFace, moveSine, moveDive, moveHover, moveSideSweep, moveArc, moveWeave, moveHelix, moveAbyss, moveAmbush } from './enemy.js';
import { BulletPool } from './bullet.js';
import { W, H, setupHiDpiCanvas, onScreen } from './canvas.js';
import { matchAction, loadSettings } from './settings.js';
import { t, charDisplayName, specialDisplayName, getLocale } from './i18n.js';
import {
  PowerUp,
  PickupFeedback,
  shouldDropPowerUp,
  shouldDropBomb,
} from './powerup.js';
import { isRareChar, rareInfo } from './rare-fanfare.js';
import { prefersLightFx, wantsTouchControls, demoteGfx } from './mobile.js';
import { TouchControls } from './touch-controls.js';
import { setGameplaySeed, rng as gameplayRng } from './rng.js';
import { ensureNewUiSlices, newUiSlice } from './newui-assets.js';
import { drawSheetAt } from './run-fx.js';
import { LeaderScript, LEADER_SCRIPTS } from './leader-script.js';
import { ClipAnimator } from './clip-anim.js';
import { initRampalion, rampFuse, rampBreak, RAMPALION_ASSET_KEYS, RAMPALION_ROBOTS } from './rampalion.js';

const BEAM_STYLES = new Set(['cyclopsbeam', 'sightbeam', 'teslabeam', 'railbeam', 'busterbeam', 'swordlance']);

// Graze reward (silent): score per graze, stage-clear bonus per graze, raw SP per graze
// (Player.addSp scales it: ~2.5 SP at Lv1 -> ~40 grazes per C level).
/** Midboss / boss death sequence length (s): body pops, then the final blast. */
/** Empty-field seconds before the pace keeper sends a small grunt rank in. */
const PACE_GAP = 0.8;
/** Seconds a leader waits for the field to clear before stragglers are sent off. */
/** Dev FPS readout (?fps=1 in the URL). */
const SHOW_FPS = typeof location !== 'undefined' && /[?&]fps=1/.test(location.search);
/** Named mob: glide in, then a slow figure-8 in the right third (stays until killed). */
function moveNamed(e, dt) {
  const tx = W - 210;
  if (e.x > tx) e.x -= 120 * dt;
  const ty = H * 0.5 + Math.sin(e.age * 0.55) * (H * 0.28);
  e.y += (ty - e.y) * Math.min(1, 1.6 * dt);
  e.x += Math.sin(e.age * 1.1) * 18 * dt;
}

/** Seconds between supply convoys while the ship is at Lv1-2 (user: within 10 s). */
const POWER_RECOVERY_GAP = 10;
/** Minimum seconds between bomb item drops (mid-boss drops ignore it). */
const BOMB_DROP_GAP = 40;
/** Clear tally: first bonus line appears at, and the lines appear apart (s). */
const TALLY_REVEAL0 = 0.45;
const TALLY_REVEAL_GAP = 0.32;

/** Announcer lines (assets/audio/voice/ann_*.ogg) decoded at sortie. */
const ANNOUNCER_STEMS = [
  'ann_levelup_1', 'ann_levelup_2', 'ann_levelup_3', 'ann_levelup_4', 'ann_notready_1', 'ann_notready_2',
  'ann_hplow_1', 'ann_hplow_2', 'ann_perfect_1', 'ann_perfect_2', 'ann_becareful_1', 'ann_becareful_2',
  'ann_bossalert_1', 'ann_bossalert_2', 'ann_battlestart_1', 'ann_battlestart_2',
  'ann_clear_1', 'ann_clear_2', 'ann_clear_3', 'ann_clear_4', 'ann_clear_5', 'ann_clear_6',
  'ann_amazing_1', 'ann_amazing_2', 'ann_amazing_3', 'ann_great_1', 'ann_great_2',
  'ann_success_1', 'ann_success_2', 'ann_stageclear_1', 'ann_stageclear_2',
];

/** FIRE pad long-press that toggles auto-fire. */
const AUTO_FIRE_HOLD_MS = 650;
const LEADER_WAIT_MAX = 10;
const LEADER_DEATH_TIME = 2.4;
/** HP of oneHit enemies (ENEMY_META): below any projectile's damage. */
const ONE_HIT_HP = 0.01;
/** X damage to a midboss / boss (packs keep the full blast): user asked for half. */
const LEADER_BOMB_SCALE = 0.5;
/** Final boss: HP of each of its three bodies, as a share of the stage boss HP. */
const FINAL_FORM_HP = 0.5;
const GRAZE_SCORE = 100;
const GRAZE_CLEAR_BONUS = 100;
const GRAZE_SP = 12;

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {*} assets
   * @param {string} charKey
   * @param {{ audio?: ArcadeAudio, settings?: object, onPauseChange?: (paused:boolean)=>void, onSettingsChange?: (s:object)=>void, isInputBlocked?: ()=>boolean }} [opts]
   */
  constructor(canvas, assets, charKey, opts = {}) {
    this.canvas = canvas;
    const { ctx } = setupHiDpiCanvas(canvas);
    this.ctx = ctx;
    this.assets = assets;
    this.charKey = charKey;
    this.bullets = new BulletPool();
    this.projectileVfx = new ProjectileVfx(canvas);
    // Per-shot-type hit bursts from the pilots' original FX sheets.
    this.hitFx = new HitFx();
    // Enemy volleys: flag any hostile spawn this frame -> one 'enemyFire' cue (update loop).
    const spawnShot = this.bullets.spawn.bind(this.bullets);
    this.bullets.spawn = (o) => {
      if (o && !o.friendly) this._enemyShot = true;
      return spawnShot(o);
    };
    this.bombVfx = new BombVfx();
    this.fx = new PolishFx();
    // Leader area attacks: impact particles the moment one goes live.
    setHazardImpact((h) => this._hazardImpact(h));
    // Leader area attacks: a charge-up as beams / flame / sigils appear, the meteor's whoosh
    // just before it lands (impact sounds live in _hazardImpact).
    setHazardCue((h, when) => {
      if (when === 'start' && (h.kind === 'beam' || h.kind === 'cone' || h.kind === 'sigil')) this.audio.play('hz:charge');
      else if (when === 'late' && h.kind === 'meteor') this.audio.play('hz:fall');
    });
    // Kill blasts: the original LAO airboom sheet under PolishFx's fire / shock / ember layers.
    this.fx.onBlast = (x, y, scale) => this._spawnSheetFx('lao-fx-airboom', x, y, 64 + scale * 46, 0.32 + scale * 0.06);
    this.fx.setLightMode(prefersLightFx());
    // Ceremony cards may sample Title_Deco / Top_Bg when ready (non-blocking).
    ensureNewUiSlices();
    this._ownsAudio = !opts.audio;
    this.audio = opts.audio || new ArcadeAudio();
    // Decode this pilot's original skill SFX now so timeline events play on cue.
    for (const stem of SKILL_SFX[charKey] || []) this.audio.preloadClip?.(stem);
    // Pilot battle voice lines (stage start, C / X, WARNING, miss, clear).
    this.audio.preloadVoices?.(Object.values(PILOT_VOICES[charKey] || {}));
    this.audio.preloadVoices?.(ANNOUNCER_STEMS);
    // ...and the original voices on its animations (skill / death shouts).
    for (const list of [...Object.values(VOICE_EVENTS[charKey] || {}), ...Object.values(VOICE_ACTIONS[charKey] || {})]) {
      for (const [, stem] of list) this.audio.preloadClip?.(stem);
    }
    this.settings = opts.settings || loadSettings();
    this.onPauseChange = opts.onPauseChange || null;
    this.onSettingsChange = opts.onSettingsChange || null;
    /** PC debug cheat keys (main.js: typed "치트활성화온" on the title). */
    this.cheats = !!opts.cheats;
    this.isInputBlocked = opts.isInputBlocked || (() => false);
    this.enemies = [];
    this.bullets.targets = this.enemies;
    this.powerUps = [];
    this.pickupFx = new PickupFeedback();
    this.particles = [];
    this.score = 0;
    this.graze = 0;
    this.time = 0;
    this.stages = STAGES;
    this.stageIndex = 0;
    this.stageClock = 0;
    this.stageWaveIndex = 0;
    // First sortie opens through the gate too: fly-in + "battle starts shortly" (entry).
    this.stagePhase = 'asset-gate';
    this.midDone = false;
    this.stageWait = 0;
    this.stageIntro = 3.2;
    this._introPeak = 3.2;
    this.stageTitle = 'STAGE 1';
    this.stageSubtitle = '';
    this.stageCue = '';
    this.stageCueTime = 0;
    this.warningKind = '';
    this.stageHits = 0;
    this.stageGrazeStart = 0;
    this.stageClearBonus = 0;
    this._bossPhaseSeen = -1;
    this.state = 'playing'; // playing | cleared | gameover
    this.paused = false;
    this.bgX = 0;
    this.bgFar = assets.images.loop_far;
    this.bgMid = assets.images.loop_mid;
    this.bgNear = assets.images.loop_near;
    this.boss = null;
    this.input = {
      left: false, right: false, up: false, down: false,
      shoot: false, shift: false, bomb: false, special: false,
      ax: 0, ay: 0, autoFire: false,
    };
    /** Keyboard latch (merged with touch each sync). */
    this._keyInput = {
      left: false, right: false, up: false, down: false,
      shoot: false, shift: false, bomb: false, special: false,
    };
    /** Touch latch (merged with keyboard each sync). */
    this._touchInput = {
      left: false, right: false, up: false, down: false,
      shoot: false, shift: false, bomb: false, special: false,
      ax: 0, ay: 0,
    };
    this._touchControls = null;
    this._bombLatch = false;
    this._bombQueued = false;
    this._specialLatch = false;
    this._specialQueued = false;
    this.specialNotice = '';
    this.specialNoticeUntil = 0;
    /** Stage-clear bomb award text: 'bomb' | 'score' | '' */
    this._clearBombKind = '';
    /** True when no-miss stage clear actually awarded a life. */
    this._clearNomissLife = false;
    /** True when no-miss stage clear granted a shot-power bonus. */
    this._clearLv4 = false;
    /** Final-stage clear card (ALL CLEAR) vs normal STAGE CLEAR. */
    this._clearIsFinale = false;
    /** Whole-run no-miss (never committed a life loss). */
    this.runNoMiss = true;
    /** Brief rim flash after boss/mid phase change telegraph. */
    this._phaseTelegraph = 0;
    /** Edge-detect special gauge crossing Lv1 ready. */
    this._spWasReady = false;
    /** Brief HUD pulse after LIFE +1 extend. */
    this._lifeExtendFlash = 0;
    /** Brief SP track pulse when crossing ready. */
    this._spReadyFlash = 0;
    /** After a miss / deathbomb — stronger item pull so drops aren't stranded. */
    this._itemMagnetBoost = 0;
    /** Last low-power recovery escort, measured on this stage's wave clock. */
    this._lastPowerRecoveryAt = 0;
    this._powerRecoveryDueAt = Infinity;
    /** Wall-clock for bomb/projectile VFX — sim `time` freezes under hitstop. */
    this._fxClock = 0;
    /** Low-cost FPS readout (display ~8Hz). */
    this._fpsFrames = 0;
    this._fpsLastSample = 0;
    this._fpsDisplay = 0;
    /** Stage act assets must be ensured before waves/leaders spawn (no placeholder skins). */
    this._assetsReady = true;
    this._assetGatePending = null;
    this._assetGateLabel = '';
    /** Fatal asset-gate error (retry exhausted) — halt rather than spawn substitutes. */
    this._assetGateError = null;
    /** Debug / smoke: sim speed multiplier + optional invuln bot helpers. */
    this.debug = {
      turbo: 1,
      /** Extra fixed-dt sim steps per update (headless rAF is often throttled). */
      pumpSteps: 1,
      invuln: false,
      autoPlay: false,
      /** Fixed combat RNG seed (null = native Math.random). */
      rngSeed: null,
      /** Record digital input edges for replay. */
      recordInputs: false,
      /** Replay buffer: [{f, t, action, down}] against sim frame index. */
      replayInputs: null,
      /** When true, ignore external update() unless tick() sets the allow flag. */
      manualTick: false,
    };
    this._allowTick = false;
    this._rngState = 0;
    this._inputLog = [];
    this._replayCursor = 0;
    this._inputLast = null;
    this._simFrame = 0;
    /** Per-wave perf peaks for regression harness (relative / headless only). */
    this.perfLog = [];
    this._perfWave = null;
    /** Full-run segment metrics (waves / mid / boss / totals + usage). */
    this.runMetrics = this._freshRunMetrics();
    this._seg = {
      stageStartedAt: 0,
      waveAccum: 0,
      midFight: 0,
      bossFight: 0,
      midStartedAt: 0,
      bossStartedAt: 0,
      bombsStart: 0,
      specials: { 1: 0, 2: 0, 3: 0 },
      bombsUsed: 0,
      misses: 0,
      deathbombs: 0,
      frameSamples: 0,
      frameDtSum: 0,
      frameDtMax: 0,
    };
    this.isRare = isRareChar(charKey);
    this.rareMeta = this.isRare ? rareInfo(charKey) : null;

    const meta = assets.CHAR_META[charKey];
    const clips = (typeof assets.getAnim === 'function' ? assets.getAnim(charKey) : null)
      || assets.anims[charKey]
      || assets.anims.hirume;
    this.player = new Player(charKey, meta, clips, W, H);
    if (meta?.humanForm) {
      const alt = (typeof assets.getAnim === 'function' ? assets.getAnim(meta.humanForm.clips) : null)
        || assets.anims[meta.humanForm.clips];
      const change = (typeof assets.getAnim === 'function' ? assets.getAnim(meta.humanForm.changeClips) : null)
        || assets.anims[meta.humanForm.changeClips];
      const revert = (typeof assets.getAnim === 'function' ? assets.getAnim(meta.humanForm.revertClips) : null)
        || assets.anims[meta.humanForm.revertClips];
      const hbomb = (typeof assets.getAnim === 'function' ? assets.getAnim(meta.humanForm.bomb?.clips) : null)
        || assets.anims[meta.humanForm.bomb?.clips];
      const bbomb = (typeof assets.getAnim === 'function' ? assets.getAnim(meta.birdBomb?.clips) : null)
        || assets.anims[meta.birdBomb?.clips];
      this.player.setAltForm(alt, change, revert, hbomb, bbomb);
    }
    if (meta?.rampalion) {
      const clipsByKey = {};
      for (const key of RAMPALION_ASSET_KEYS) {
        clipsByKey[key] = (typeof assets.getAnim === 'function' ? assets.getAnim(key) : null)
          || assets.anims?.[key] || null;
      }
      initRampalion(this.player, {
        clips: clipsByKey,
        boneTrack: clips?.boneTrack || null,
        makeAnimator: (c) => new ClipAnimator(c),
        onEvent: (type, d) => this._onRampalionEvent(type, d),
      });
    }
    this.player.enemyRankEnabled = false;
    // Kit-colored hit/kill sparks (beyond generic warm flash).
    this.fx.setKitPalette({
      color: meta?.shot?.color,
      glow: meta?.shot?.glow,
      style: meta?.shot?.style,
    });
    this._hud = this._cacheHud();

    this._bindInput();
    this._updateHud();
    this.audio.applySettings(this.settings);
    // Saved OPTIONS auto-fire applies from the first frame (input used to sync only on a key).
    this._syncMergedInput();
    this.audio.unlock();
    this.audio.startBgm(moodForStage(this.stages[0]));
    this.audio.setBgmIntensity?.(0.35);
    this._syncBgm();
    this._beginStageSegment(0);
    this._assetsReady = !!(this.assets.bank?.isStageReady?.(0) ?? true);
    if (!this._assetsReady) this._requestStageAssets(0, 'STAGE 1');
    this._onResize = () => {
      const { ctx } = setupHiDpiCanvas(this.canvas);
      this.ctx = ctx;
      this.projectileVfx.resize();
    };
    window.addEventListener('resize', this._onResize);
    // Hidden kits use the regular HUD (user): no rare accent / glow.
    document.getElementById('hud')?.classList.remove('is-rare-sortie');
    document.getElementById('hud')?.style.removeProperty('--rare-accent');
    document.getElementById('hud')?.style.removeProperty('--rare-glow');
    const shotColor = meta?.shot?.color || '#ffb347';
    document.getElementById('charge-fill')?.style.setProperty('--charge-tint', shotColor);
  }

  setSettings(next) {
    this.settings = next;
    this.audio.applySettings(next);
    this._touchControls?.setMode(next?.padMode === 'floating' ? 'floating' : 'fixed');
    this._syncMergedInput();
    this._syncAutoFireUi();
    this._updateHud();
  }

  /**
   * Quality guard (phones): after 3 s of live play below ~48 fps on average, drop the canvas
   * resolution one step (mobile.js demoteGfx), then re-check after another 6 s.
   */
  _gfxGuard(sec) {
    if (!wantsTouchControls() || this.state !== 'playing' || this.paused || this.debug?.manualTick) {
      this._gfxLow = 0;
      return;
    }
    if (sec > 0.5) return; // tab switch / stall, not steady-state cost
    this._gfxCool = Math.max(0, (this._gfxCool ?? 3) - sec);
    this._gfxLow = (this._gfxLow || 0) + (this._fpsDisplay < 48 ? sec : -sec * 0.5);
    this._gfxLow = Math.max(0, this._gfxLow);
    if (this._gfxCool > 0 || this._gfxLow < 3) return;
    this._gfxLow = 0;
    this._gfxCool = 6;
    if (demoteGfx()) this._onResize?.();
  }

  _armAutoFireHold() {
    this._cancelAutoFireHold();
    this._autoHoldTimer = setTimeout(() => {
      this._autoHoldTimer = 0;
      if (this.state !== 'playing' || this.paused || this.isInputBlocked()) return;
      this._toggleAutoFire();
    }, AUTO_FIRE_HOLD_MS);
  }

  _cancelAutoFireHold() {
    if (this._autoHoldTimer) clearTimeout(this._autoHoldTimer);
    this._autoHoldTimer = 0;
  }

  _toggleAutoFire() {
    this.settings = { ...this.settings, autoFire: !this.settings?.autoFire };
    this.onSettingsChange?.(this.settings);
    this._syncMergedInput();
    this.audio.play('cue');
    try { navigator.vibrate?.(this.settings.autoFire ? [18, 40, 18] : 25); } catch { /* no haptics */ }
    this._syncAutoFireUi(true);
  }

  /** HUD chip + FIRE pad state for auto-fire; `announce` pops a short toast. */
  _syncAutoFireUi(announce = false) {
    const on = !!this.settings?.autoFire;
    const chip = document.getElementById('auto-fire-chip');
    if (chip) chip.hidden = !on;
    document.querySelector('#touch-controls .tc-fire')?.classList.toggle('is-auto', on);
    if (!announce) return;
    const toast = document.getElementById('auto-fire-toast');
    if (!toast) return;
    toast.textContent = t(on ? 'hud.autoOn' : 'hud.autoOff');
    toast.classList.toggle('is-off', !on);
    toast.classList.remove('is-show');
    void toast.offsetWidth;
    toast.classList.add('is-show');
  }

  setPaused(paused) {
    const next = !!paused;
    if (this.paused === next) return;
    this.paused = next;
    if (this.paused) {
      this.audio.stopChargeHold();
      this.audio.setBeamHold?.(false);
      // Release held touch so FIRE/BOMB don't stick under the pause overlay.
      for (const key of Object.keys(this._touchInput)) this._touchInput[key] = false;
      this._syncMergedInput();
      this._touchControls?.reset();
      this.setTouchPadsVisible(false);
    } else {
      this.setTouchPadsVisible(true);
    }
    this._updateHud();
    this.onPauseChange?.(this.paused);
  }

  /** Snapshot for result / game-over overlay (no ranking board). */
  getResultStats() {
    const reached = Math.min(this.stageIndex + 1, this.stages.length);
    const stageName = this.stages[Math.min(this.stageIndex, this.stages.length - 1)]?.name || '';
    const charName = charDisplayName(this.charKey, this.assets.CHAR_META[this.charKey]?.name || this.charKey);
    return {
      cleared: this.state === 'cleared',
      score: this.score,
      graze: this.graze,
      stage: reached,
      stageName,
      charKey: this.charKey,
      charName,
      maxCombo: this.fx?.maxCombo || 0,
      noMiss: !!this.runNoMiss,
      shotLevel: this.player?.shotLevel || 1,
      runMetrics: this.getRunMetrics(),
    };
  }

  _freshRunMetrics() {
    return {
      charKey: this.charKey,
      stages: [],
      totalMisses: 0,
      totalBombs: 0,
      totalDeathbombs: 0,
      specialsByLevel: { 1: 0, 2: 0, 3: 0 },
      cleared: false,
      wallMs: 0,
      _wallStarted: performance.now(),
    };
  }

  _beginStageSegment(index) {
    // Final stage: load the commander face now so the boss never appears faceless.
    if (this.assets.ENEMY_META[this.stages[index]?.boss]?.face) preloadCommanderFace();
    this._seg = {
      stageIndex: index,
      stageStartedAt: this.time,
      waveAccum: 0,
      midFight: 0,
      bossFight: 0,
      midStartedAt: 0,
      bossStartedAt: 0,
      bombsStart: this.player?.bombs ?? 3,
      specials: { 1: 0, 2: 0, 3: 0 },
      bombsUsed: 0,
      misses: 0,
      deathbombs: 0,
      frameSamples: 0,
      frameDtSum: 0,
      frameDtMax: 0,
    };
  }

  _finalizeStageSegment({ finale = false } = {}) {
    const s = this._seg;
    if (!s || s._closed) return;
    s._closed = true;
    const avgFps = s.frameSamples > 0 ? (s.frameSamples / Math.max(0.001, s.frameDtSum)) : 0;
    const row = {
      stage: (s.stageIndex | 0) + 1,
      name: this.stages[s.stageIndex]?.name || '',
      waveSec: +s.waveAccum.toFixed(2),
      midFightSec: +s.midFight.toFixed(2),
      bossFightSec: +s.bossFight.toFixed(2),
      totalSec: +(s.waveAccum + s.midFight + s.bossFight).toFixed(2),
      misses: s.misses,
      bombsUsed: s.bombsUsed,
      deathbombs: s.deathbombs,
      specials: { ...s.specials },
      avgFps: +avgFps.toFixed(1),
      minFps: s.frameDtMax > 0 ? +(1 / s.frameDtMax).toFixed(1) : 0,
      frameDrops: s.frameDtMax > (1 / 45) ? 1 : 0,
    };
    this.runMetrics.stages.push(row);
    this.runMetrics.totalMisses += s.misses;
    this.runMetrics.totalBombs += s.bombsUsed;
    this.runMetrics.totalDeathbombs += s.deathbombs;
    for (const lv of [1, 2, 3]) this.runMetrics.specialsByLevel[lv] += s.specials[lv] || 0;
    if (finale) {
      this.runMetrics.cleared = true;
      this.runMetrics.wallMs = Math.round(performance.now() - this.runMetrics._wallStarted);
    }
  }

  getRunMetrics() {
    return {
      ...this.runMetrics,
      wallMs: this.runMetrics.cleared
        ? this.runMetrics.wallMs
        : Math.round(performance.now() - this.runMetrics._wallStarted),
      live: this._seg && !this._seg._closed ? {
        stage: (this._seg.stageIndex | 0) + 1,
        phase: this.stagePhase,
        waveSec: +this._seg.waveAccum.toFixed(2),
        midFightSec: +this._seg.midFight.toFixed(2),
        bossFightSec: +this._seg.bossFight.toFixed(2),
      } : null,
    };
  }

  /** Kick ensureStage and hold the field until the act roster is resident. */
  _requestStageAssets(index, label = '') {
    const bank = this.assets.bank;
    if (!bank?.ensureStage) {
      this._assetsReady = true;
      return;
    }
    if (bank.isStageReady?.(index)) {
      this._assetsReady = true;
      this._assetGatePending = null;
      this._assetGateLabel = '';
      this._assetGateError = null;
      return;
    }
    this._assetsReady = false;
    this._assetGateError = null;
    this._assetGateLabel = label || `STAGE ${index + 1}`;
    const token = {};
    this._assetGatePending = token;
    Promise.resolve(bank.ensureStage(index))
      .then(() => {
        if (this._assetGatePending !== token) return;
        this._assetsReady = true;
        this._assetGatePending = null;
        this._assetGateLabel = '';
        this._assetGateError = null;
        bank.prefetchFrom?.(index + 1);
        bank.unloadDistantStages?.(index);
      })
      .catch((err) => {
        console.error('[assets] stage ensure failed — halting (no substitute art)', err);
        if (this._assetGatePending === token) {
          this._assetsReady = false;
          this._assetGatePending = null;
          this._assetGateError = {
            message: err?.message || String(err),
            detail: bank?.getLastError?.() || null,
          };
          this.stagePhase = 'asset-error';
          this.stageTitle = 'ASSET ERROR';
          this.stageSubtitle = this._assetGateError.message;
          this._setStageIntro(Math.max(this.stageIntro, 2.5));
        }
      });
  }

  _clipsReady(key) {
    if (!key) return false;
    if (this.assets.bank?.hasFailed?.(key)) return false;
    if (typeof this.assets.hasClip === 'function') return this.assets.hasClip(key);
    if (this.assets.bank?.hasClip) return this.assets.bank.hasClip(key);
    return !!(this.assets.anims && this.assets.anims[key]);
  }

  /** Gameplay RNG (spawns/drops/cadence). VFX keeps Math.random. */
  _rand() {
    return gameplayRng();
  }

  setRngSeed(seed) {
    if (seed == null) {
      this.debug.rngSeed = null;
      setGameplaySeed(null);
      return;
    }
    this.debug.rngSeed = seed >>> 0;
    setGameplaySeed(this.debug.rngSeed);
  }

  startInputRecord() {
    this.debug.recordInputs = true;
    this.debug.replayInputs = null;
    this._inputLog = [];
    this._replayCursor = 0;
    this._simFrame = 0;
    this._inputLast = {
      left: false, right: false, up: false, down: false,
      shoot: false, focus: false, bomb: false, special: false,
    };
  }

  stopInputRecord() {
    this.debug.recordInputs = false;
    return this._inputLog.slice();
  }

  loadInputReplay(events) {
    this.debug.recordInputs = false;
    this.debug.replayInputs = Array.isArray(events) ? events.slice() : null;
    this._replayCursor = 0;
    this._simFrame = 0;
  }

  getInputLog() {
    return this._inputLog.slice();
  }

  /** Capture digital input edges from keyboard OR autoPlay (both mutate _keyInput). */
  _recordInputEdges() {
    if (!this.debug?.recordInputs || !this._inputLast) return;
    const k = this._keyInput;
    const cur = {
      left: !!k.left,
      right: !!k.right,
      up: !!k.up,
      down: !!k.down,
      shoot: !!k.shoot,
      focus: !!k.shift,
      bomb: !!k.bomb,
      special: !!k.special,
    };
    const f = this._simFrame | 0;
    const t = +this.time.toFixed(4);
    for (const action of Object.keys(cur)) {
      if (cur[action] !== this._inputLast[action]) {
        this._inputLog.push({ f, t, action, down: cur[action] });
        this._inputLast[action] = cur[action];
      }
    }
  }

  /**
   * Lightweight sortie bot for full-clear smoke: weave + fire + C when ready +
   * deathbomb / emergency bomb. Enable via `game.debug.autoPlay = true`.
   */
  _tickAutoPlay() {
    const p = this.player;
    if (!p?.alive) return;
    const t = this.time;
    const k = this._keyInput;
    // Soft vertical weave; stay mid-left so packs enter the lane.
    const targetY = H * 0.5 + Math.sin(t * 1.7) * 90;
    const targetX = 140 + Math.sin(t * 0.55) * 36;
    k.shoot = true;
    k.shift = true;
    k.up = p.y > targetY + 10;
    k.down = p.y < targetY - 10;
    k.left = p.x > targetX + 12;
    k.right = p.x < targetX - 12;
    // Drive special/bomb through key latches so record/replay can capture them.
    // Bank to Lv2+ — dumping Lv1 forever starved Merlin/Fafnir S5 boss clocks.
    const lv = p.specialLevel;
    const leaderFight = this.stagePhase === 'boss' || this.stagePhase === 'midboss';
    const wantSpecial = lv >= 2;
    let wantBomb = false;
    if (p.inDeathBombWindow && p.bombs > 0) {
      wantBomb = true;
    } else if (p.bombs > 0 && this.boss?.alive && leaderFight) {
      const hpRatio = this.boss.hp / Math.max(1, this.boss.maxHp);
      // Chip leaders more often on long stalls (Merlin/Fafnir smoke timeouts).
      if (hpRatio < 0.28 && (t % 2.0) < 0.1) wantBomb = true;
      else if (hpRatio < 0.5 && (t % 3.2) < 0.1) wantBomb = true;
    }
    k.bomb = wantBomb;
    k.special = wantSpecial;
    this._syncMergedInput();
  }

  /** Clear failed roster keys and re-kick ensureStage (asset-error recovery). */
  retryStageAssets() {
    const index = this.stageIndex | 0;
    const stage = this.stages[index];
    const keys = [];
    if (stage?.mid) keys.push(stage.mid);
    if (stage?.boss) keys.push(stage.boss);
    for (const wave of stage?.waves || []) {
      for (const g of wave.groups || []) {
        if (g?.key) keys.push(g.key);
      }
    }
    this.assets.bank?.clearFailed?.(keys);
    this.assets.bank?.clearLastError?.();
    this._assetGateError = null;
    this.stagePhase = 'asset-gate';
    this.stageTitle = 'LOADING';
    this.stageSubtitle = stage?.name || `STAGE ${index + 1}`;
    this._setStageIntro(0.5);
    this._requestStageAssets(index, `STAGE ${index + 1}`);
    return true;
  }

  _clipsFor(key) {
    // Never substitute another monster's art — missing clips skip spawn.
    if (!key) return null;
    if (this.assets.bank?.hasFailed?.(key)) return null;
    return this.assets.anims?.[key] || null;
  }

  _spawnFormation(group) {
    const spawned = [];
    const move = {
      dive: moveDive, sine: moveSine, side: moveSideSweep, hover: moveHover,
      arc: moveArc, weave: moveWeave, abyss: moveAbyss, helix: moveHelix,
    }[group.move] || moveDive;
    const m = this.assets.ENEMY_META[group.key];
    const count = group.count;
    const stage = this.stages[this.stageIndex];
    const clips = this._clipsFor(group.key);
    if (!clips || !m) return spawned;
    for (let i = 0; i < count; i++) {
      let x = W + 45 + i * 38;
      let y = 70 + (i % 5) * 100;
      if (group.ambush || group.role === 'ambush') {
        // Edge dive: top/bottom jaws then sweep into the lane (stage-unique ambush beat).
        const top = i % 2 === 0;
        x = W * (0.42 + (Math.floor(i / 2) % 3) * 0.14);
        y = top ? -40 - Math.floor(i / 2) * 28 : H + 40 + Math.floor(i / 2) * 28;
      } else if (group.formation === 'diagonal') {
        // Was listed in stage-plan but fell through to a boring column — ~1/7 waves.
        // Slash from the right: descending or ascending by group seed.
        const rising = ((group.score | 0) + count) % 2 === 0;
        x = W + 50 + i * 46;
        y = rising ? (H - 72 - i * 66) : (72 + i * 66);
        y = Math.max(55, Math.min(H - 55, y));
      } else if (group.formation === 'pincer') {
        x = W + 45 + Math.floor(i / 2) * 58;
        y = i % 2 ? H - 65 : 65;
      } else if (group.formation === 'helix') {
        // Double corkscrew from the right — odd/even strands wind opposite.
        // Spawn shape alone used to flatten into dive/sine; locomotion stays helical.
        const baseWind = ((group.score | 0) % 2 === 0) ? 1 : -1;
        const wind = (i % 2 === 0 ? 1 : -1) * baseWind;
        const t = i * 0.85 + ((group.score | 0) % 7) * 0.2;
        x = W + 48 + i * 44;
        y = H / 2 + Math.sin(t) * wind * (72 + Math.floor(i / 2) * 12);
        y = Math.max(55, Math.min(H - 55, y));
      } else if (group.formation === 'grid') {
        x = W + 45 + Math.floor(i / 3) * 70;
        y = 95 + (i % 3) * 160;
      } else if (group.formation === 'escort') {
        x = W + 120 + i * 60;
        y = i % 2 ? H * 0.63 : H * 0.37;
      } else if (group.formation === 'chevron') {
        x = W + 45 + Math.floor(i / 2) * 55;
        y = H / 2 + (i % 2 ? 1 : -1) * (42 + Math.floor(i / 2) * 45);
      } else if (group.formation === 'stagger') {
        x = W + 45 + i * 64;
        y = 95 + ((i * 2) % 5) * 88;
      }
      // Longer trail behind the lead ship: ranks stream in instead of arriving as one block,
      // so the field stays occupied between encounters (no dead air).
      // Bigger bodies need wider ranks so formations don't overlap into one blob.
      const spread = Math.max(1, (m.size * (m.drawScale || 1)) / 72);
      if (!(group.ambush || group.role === 'ambush')) x = W + 45 + (x - W - 45) * (stage.trail ?? 1) * spread;
      // Aftermath / finale cadence offsets — denser ranks still desync.
      const roleBias = group.role === 'finale' ? 0.04 : group.role === 'aftermath' ? 0.1 : 0;
      const e = this._spawnEnemy({
        x, y, clips,
        // Small fry die to any single hit (1945 style); big bodies keep the stage HP.
        hp: m.oneHit ? ONE_HIT_HP : group.hp, score: group.score,
        size: m.size, drawScale: m.drawScale,
        // 1945 popcorn: in a small-fry rank only every third ship fires.
        pattern: m.oneHit && i % 3 !== 0 ? 'silent' : group.pattern, move, name: m.name,
        color: stage.color,
        tint: group.tint || '',
        powerCarrier: i === group.powerCarrierIndex,
      });
      spawned.push(e);
      // Per-stage volley interval scale for rank-and-file ships (bullet density on screen).
      e.fireRateMul = stage.fireMul ?? 1;
      // Opening act: newcomers hold their first volley a beat after entering.
      e.entryHold = stage.firstShot ?? 0;
      if (group.opening) e.fireTimer += 0.55;
      if (group.ambush || group.role === 'ambush') {
        const top = i % 2 === 0;
        e._ambush = true;
        e._dir = top ? 1 : -1;
        e.anchorY = H * (top ? 0.28 : 0.72);
        e.fireTimer += 0.55 + i * 0.08 + roleBias;
        // Always use ambush ingress so top/bottom spawns enter the lane before firing.
        e.moveFn = moveAmbush;
      } else {
        e.fireTimer += roleBias;
      }
      // Abyss remix: bullet color matches tint for identity.
      if (stage.scene === 'abyss' && group.tint) e.color = group.tint;
      const isAmbush = !!(group.ambush || group.role === 'ambush');
      if (!isAmbush) {
        if (group.move === 'side') e._dir = y < H / 2 ? 1 : -1;
        if (group.move === 'hover') e.anchorY = y;
        if (group.move === 'arc' || group.move === 'weave' || group.move === 'abyss') e.anchorY = y;
      } else if (group.move === 'arc' || group.move === 'weave' || group.move === 'abyss' || group.move === 'sine') {
        // Keep ambush lane target; don't snap anchor to off-screen spawn Y.
        e.anchorY = e.anchorY || H * 0.5;
      }
      if (!isAmbush && group.formation === 'helix') {
        // Formation owns locomotion so the corkscrew reads end-to-end.
        // Apply last — hover/arc/weave must not overwrite helix anchors.
        const baseWind = ((group.score | 0) % 2 === 0) ? 1 : -1;
        const wind = (i % 2 === 0 ? 1 : -1) * baseWind;
        const phase = i * 0.85 + ((group.score | 0) % 7) * 0.2;
        e.moveFn = moveHelix;
        e.anchorY = H / 2;
        e._helixWind = wind;
        e._helixPhase = phase;
        // Pair amp by strand index so the double helix stays inside the playfield.
        e._helixAmp = 72 + Math.floor(i / 2) * 12;
        // Stagger strand cadence — both corkscrews used to dump in sync.
        e.fireTimer += (i % 2) * 0.22 + Math.floor(i / 2) * 0.08;
      } else if (!isAmbush && group.formation === 'pincer') {
        // Desync jaw pairs — top/bottom ranks used to dump together.
        e.fireTimer += (i % 2) * 0.2 + Math.floor(i / 2) * 0.07;
      } else if (!isAmbush && group.formation === 'escort') {
        // Wingmen share entry timing; offset cadence so the pair doesn't double-tap.
        e.fireTimer += (i % 2) * 0.18 + Math.floor(i / 2) * 0.06;
      } else if (!isAmbush && group.formation === 'chevron') {
        // V-wing pairs enter mirrored — stagger left/right volleys.
        e.fireTimer += (i % 2) * 0.16 + Math.floor(i / 2) * 0.07;
      } else if (!isAmbush && group.formation === 'stagger') {
        // Positions already offset; cadence still synced without an index spread.
        e.fireTimer += i * 0.1;
      } else if (!isAmbush && group.formation === 'diagonal') {
        // Slash ranks used to dump in lockstep after the staggered entry.
        e.fireTimer += i * 0.09 + (i % 2) * 0.05;
      } else if (!isAmbush && group.formation === 'grid') {
        // 3-row cells enter as a wall — desync by column then row.
        e.fireTimer += (i % 3) * 0.12 + Math.floor(i / 3) * 0.08;
      }
    }
    return spawned;
  }

  /** Destroying the marked leader slows the linked signature escorts. */
  _linkSignatureEncounter(encounter, packs) {
    if (encounter.role !== 'signature') return;
    const anchorIndex = encounter.groups.findIndex((group) => group.signatureAnchor);
    const anchor = packs[anchorIndex]?.[0];
    if (!anchor) return;
    anchor.isSignatureAnchor = true;
    for (const pack of packs) {
      for (const enemy of pack) {
        if (enemy !== anchor) enemy.commanderRef = anchor;
      }
    }
  }

  /** Four easy escorts, last one marked red with P, when a weak ship missed supply. */
  _maybeSpawnPowerRecovery() {
    const p = this.player;
    const stage = this.stages[this.stageIndex];
    const urgent = this.time >= this._powerRecoveryDueAt;
    // Lv1-2 (user): supply keeps coming in waves, midboss and boss fights alike, at most
    // POWER_RECOVERY_GAP s after the previous convoy - but never while a P item or a P
    // carrier is still on screen (it comes once that is taken or gone).
    if (!p?.alive || p.isRespawning || p.shotLevel > 2) return;
    // Rampalion (user): no supply after stage 1, however low the power falls.
    if (p._ramp && this.stageIndex > 0) return;
    if (this.powerUps.some((item) => item.alive && item.type === 'power')) return;
    if (this.enemies.some((enemy) => enemy.alive && enemy.dropsPower)) return;
    if (!urgent) {
      if (this.stagePhase === 'waves' && this.stageClock < (this.stageIndex === 0 ? 20 : 12)) return;
      if (this.time - (this._lastPowerRecoveryTime ?? -Infinity) < POWER_RECOVERY_GAP) return;
    }
    const key = stage.grunts[0];
    const meta = this.assets.ENEMY_META[key];
    const clips = this._clipsFor(key);
    if (!meta || !clips) return;
    for (let i = 0; i < 4; i++) {
      const e = this._spawnEnemy({
        x: W + 48 + i * 42,
        y: H * 0.5 + (i % 2 ? 17 : -17),
        clips,
        hp: meta.oneHit ? ONE_HIT_HP : Math.max(2, Math.ceil(stage.gruntHp * 0.45)),
        score: 100,
        size: meta.size,
        drawScale: meta.drawScale,
        pattern: 'silent',
        move: moveDive,
        name: meta.name,
        color: stage.color,
        powerCarrier: i === 3,
      });
      e.recoveryCarrier = i === 3;
      e.fireTimer = 2;
    }
    this._lastPowerRecoveryAt = this.stageClock;
    this._lastPowerRecoveryTime = this.time;
    this._powerRecoveryDueAt = Infinity;
    this.stageCue = t('cue.supply');
    this.stageCueTime = 2;
    this.audio.play('cue');
  }

  _spawnStageLeader(key, kind, hp, score, form = 0) {
    // The leader enters the live field: wave enemies and their bullets stay (user request).
    const m = this.assets.ENEMY_META[key];
    let clips = this._clipsFor(key);
    if (!m || !clips) return;
    // Final boss: three separate fights, one body each (Yimir -> Arachne -> Roc), each with
    // its own HP bar and that phase's attack routine for the whole fight.
    let script = LEADER_SCRIPTS[key] ? new LeaderScript(LEADER_SCRIPTS[key]) : null;
    if (m.phaseBodies) {
      clips = this.assets.anims?.[m.phaseBodies[form]] || clips;
      const def = LEADER_SCRIPTS[key];
      if (def) {
        const ph = def.phases[Math.min(form, def.phases.length - 1)];
        script = new LeaderScript({ ...def, phases: [{ ...ph, hp: 1 }] });
      }
    }
    this.boss = this._spawnEnemy({
      x: W + 80, y: H / 2, clips,
      hp, score, size: m.size, drawScale: (m.drawScale || 1) * (kind === 'boss' ? 1.5 : 1.22),
      kind, pattern: kind === 'boss' ? 'boss' : 'midboss', move: moveHover, flipX: !!m.flipX,
      script,
      face: !!m.face,
      style: this.stages[this.stageIndex].bossStyle,
      color: this.stages[this.stageIndex].color,
      name: `${kind === 'boss' ? 'BOSS' : 'MID'} — ${m.name.toUpperCase()}`,
    });
    if (m.phaseBodies) {
      this.boss.finalForm = form;
      this.boss.finalForms = m.phaseBodies.length;
      this.boss._bodyPhase = form;              // face size / offset for this body
      this.boss.headTrack = clips.headTrack || null;
    }
    // Hover-in beat before the first volley — spawn timer used to arm as soon as X-gate opened.
    this.boss.fireTimer = Math.max(this.boss.fireTimer, kind === 'boss' ? 1.05 : 0.85);
    this._bossPhaseSeen = this.boss.attackPhase ?? 0;
    this.fx.addShake(kind === 'boss' ? 8 : 5, 0.25);
    this.audio.setBgmIntensity?.(kind === 'boss' ? 1 : 0.62);
  }

  _beginWarning(kind) {
    this.warningKind = kind;
    this.stagePhase = kind === 'boss' ? 'boss-windup' : 'mid-windup';
    this.stageWait = kind === 'boss' ? 2.4 : 2.0;
    // The alarm clears the enemy bullets (user); the grunts are already gone by now.
    this._sparkClearedEnemyBullets?.();
    this.bullets.clearEnemy();
    this._setStageIntro(this.stageWait);
    this.stageTitle = 'WARNING';
    this.stageSubtitle = kind === 'boss' ? 'FINAL TARGET DETECTED' : 'MIDBOSS SIGNATURE';
    this.audio.play('warning');
    // Announcer "Boss alert" first, then the pilot's warning line right after it (user).
    this._announce('bossalert', 2);
    const tok = (this._warnVoiceTok = (this._warnVoiceTok || 0) + 1);
    setTimeout(() => {
      if (!this._disposed && this._warnVoiceTok === tok && this.state === 'playing') this._voice('warning');
    }, 1150);
    this.fx.addShake(4, 0.2);
  }

  /**
   * @param {number} dt
   * @param {{ wallClockOnly?: boolean }} [opts]
   * wallClockOnly: hitstop — advance card/wait timers & windup spawns, but never the wave clock.
   * Card fades used to run on wall-clock while stageWait stayed sim-frozen → blank gap after WARNING/CLEAR.
   */
  _updateStageFlow(dt, { wallClockOnly = false } = {}) {
    if (this.stageIntro > 0) this.stageIntro = Math.max(0, this.stageIntro - dt);
    if (this.stageCueTime > 0) this.stageCueTime = Math.max(0, this.stageCueTime - dt);
    const stage = this.stages[this.stageIndex];

    // Hold the field until the act roster is fully resident — never spawn placeholders.
    if (this.stagePhase === 'asset-gate') {
      if (this._assetGateError) {
        this.stagePhase = 'asset-error';
        this.stageTitle = 'ASSET ERROR';
        this.stageSubtitle = this._assetGateError.message;
        this._setStageIntro(Math.max(this.stageIntro, 1.5));
        return;
      }
      if (!this._assetsReady) {
        this.stageTitle = 'LOADING';
        this.stageSubtitle = this._assetGateLabel || 'NEXT SECTOR';
        this._setStageIntro(Math.max(this.stageIntro, 0.35));
        return;
      }
      this._beginStageEntry();
      return;
    }
    if (this.stagePhase === 'entry') {
      // The ship flies in from the left; the battle opens once it (and, on the first stage,
      // the announcer's "battle starts shortly") has finished.
      this.stageWait -= dt;
      if (this.stageWait <= 0) {
        this.stagePhase = 'waves';
        this._setStageIntro(Math.max(this.stageIntro, 0.6));
      }
      return;
    }
    if (this.stagePhase === 'tally') {
      this._tickTally(dt);
      return;
    }
    if (this.stagePhase === 'exit') {
      // Fly-off to the right, then fade to black and move on.
      this.stageWait -= dt;
      if (this.stageWait <= 0.6 && !this._fade?.out) this._fadeTo(1, 0.6);
      if (this.stageWait > 0) return;
      this.player.exiting = false;
      this.stagePhase = 'transition';
      this.stageWait = 0;
    }

    if (this.stagePhase === 'asset-error') {
      this.stageTitle = 'ASSET ERROR';
      this.stageSubtitle = this._assetGateError?.message || 'LOAD FAILED';
      this._setStageIntro(Math.max(this.stageIntro, 0.5));
      return;
    }

    if (this.stagePhase === 'transition') {
      this.stageWait -= dt;
      if (this.stageWait > 0) return;
      this._finalizeStageSegment({ finale: false });
      this.stageIndex += 1;
      if (this.stageIndex >= this.stages.length) {
        this.state = 'cleared';
        this._fade = null;
        this._fadeEl?.remove();
        this._fadeEl = null;
        this.runMetrics.cleared = true;
        this.runMetrics.wallMs = Math.round(performance.now() - this.runMetrics._wallStarted);
        // Final mission sting — stage clears already played `clear` on boss kill.
        this.audio.play('fanfare');
        return;
      }
      this._enterStage();
      return;
    }
    if (this.stagePhase === 'mid-recover') {
      this.stageWait -= dt;
      if (this.stageWait <= 0) {
        this.stagePhase = 'waves';
        this._setStageIntro(1.8);
        this.stageTitle = t('card.lateHalf');
        this.stageSubtitle = stage.aftermathCue || stage.subtitle;
        this.warningKind = '';
        this.audio.setBgmIntensity?.(0.48);
      }
      return;
    }
    if (this.stagePhase === 'mid-windup') {
      this.stageWait -= dt;
      if (this.stageWait <= 0) {
        if (!this._clipsReady(stage.mid)) {
          if (this.assets.bank?.hasFailed?.(stage.mid)) {
            this._assetGateError = {
              message: `ASSET LOAD FAILED: ${stage.mid}`,
              detail: this.assets.bank?.getLastError?.() || null,
            };
            this.stagePhase = 'asset-error';
            this.stageTitle = 'ASSET ERROR';
            this.stageSubtitle = this._assetGateError.message;
            return;
          }
          this.stageWait = 0.05;
          this.assets.bank?.ensureEnemy?.(stage.mid)?.catch?.(() => {});
          this.stageTitle = 'LOADING';
          this.stageSubtitle = 'MIDBOSS';
          return;
        }
        this._spawnStageLeader(stage.mid, 'midboss', stage.midHp, stage.midScore);
        this.stagePhase = 'midboss';
        this._seg.midStartedAt = this.time;
        this._setStageIntro(1.7);
        this.stageTitle = 'MIDBOSS APPROACH';
        this.stageSubtitle = this.boss?.name || '';
        this.warningKind = '';
      }
      return;
    }
    if (this.stagePhase === 'boss-windup') {
      this.stageWait -= dt;
      if (this.stageWait <= 0) {
        if (!this._clipsReady(stage.boss)) {
          if (this.assets.bank?.hasFailed?.(stage.boss)) {
            this._assetGateError = {
              message: `ASSET LOAD FAILED: ${stage.boss}`,
              detail: this.assets.bank?.getLastError?.() || null,
            };
            this.stagePhase = 'asset-error';
            this.stageTitle = 'ASSET ERROR';
            this.stageSubtitle = this._assetGateError.message;
            return;
          }
          this.stageWait = 0.05;
          this.assets.bank?.ensureEnemy?.(stage.boss)?.catch?.(() => {});
          this.stageTitle = 'LOADING';
          this.stageSubtitle = 'BOSS';
          return;
        }
        // Final boss (three bodies): each fight gets FINAL_FORM_HP of the stage boss HP.
        const finalBoss = !!this.assets.ENEMY_META[stage.boss]?.phaseBodies;
        this._spawnStageLeader(stage.boss, 'boss', finalBoss ? Math.round(stage.bossHp * FINAL_FORM_HP) : stage.bossHp, stage.bossScore);
        this.stagePhase = 'boss';
        this._seg.bossStartedAt = this.time;
        this._setStageIntro(1.8);
        this.stageTitle = 'BOSS APPROACH';
        this.stageSubtitle = this.boss?.name || '';
        this.warningKind = '';
      }
      return;
    }
    if (this.stagePhase !== 'waves') return;
    // Hitstop: keep PHASE/cue cards alive, but don't spawn wave encounters into a frozen field.
    if (wallClockOnly) return;
    if (!this._assetsReady) {
      this._requestStageAssets(this.stageIndex, `STAGE ${this.stageIndex + 1}`);
      return;
    }
    // Peek: if the next due wave lacks clips, hold the clock (no placeholder spawns).
    if (this.stageWaveIndex < stage.waves.length
      && this.stageClock + dt >= stage.waves[this.stageWaveIndex].at) {
      const peek = stage.waves[this.stageWaveIndex];
      const missing = peek.groups.some((g) => !this._clipsReady(g.key));
      if (missing) {
        for (const g of peek.groups) {
          if (!this._clipsReady(g.key)) this.assets.bank?.ensureEnemy?.(g.key);
        }
        return;
      }
    }
    // A leader is due: hold the wave clock until every grunt is dead or gone (user: the
    // midboss / boss only arrives after the fight with the small fry is over).
    const due = !this.midDone && this.stageClock >= stage.midAt ? 'mid'
      : (this.stageWaveIndex === stage.waves.length && this.stageClock >= stage.bossAt ? 'boss' : null);
    if (due) {
      if (!this._fieldClearForLeader(dt)) return;
      this._leaderWait = 0;
      if (due === 'mid') this.midDone = true;
      this._beginWarning(due);
      return;
    }
    this._namedFlow(stage);
    this.stageClock += dt;
    if (this._seg) this._seg.waveAccum += dt;
    while (this.stageWaveIndex < stage.waves.length && this.stageClock >= stage.waves[this.stageWaveIndex].at) {
      const encounter = stage.waves[this.stageWaveIndex];
      const packs = encounter.groups.map((group) => this._spawnFormation(group));
      this._linkSignatureEncounter(encounter, packs);
      this._maybeSpawnPowerRecovery();
      if (encounter.cue) {
        this.stageCue = encounter.cue;
        this.stageCueTime = 2.5;
        this.audio.play('cue');
      }
      this.stageWaveIndex += 1;
    }
    this._paceKeeper(stage, dt);
  }

  /**
   * Pace keeper (1945-style: the field is rarely empty): when no grunt has been on screen for
   * PACE_GAP s and the next scheduled wave is still > 2 s away, a small rank of the stage's
   * own grunts flies in. Scheduled waves / signature indices are untouched.
   */
  _paceKeeper(stage, dt) {
    const busy = this.enemies.some((e) => e.alive && !e.dying && e.kind !== 'boss' && e.kind !== 'midboss');
    if (busy) { this._emptyFor = 0; return; }
    this._emptyFor = (this._emptyFor || 0) + dt;
    const next = stage.waves[this.stageWaveIndex];
    if (this._emptyFor < PACE_GAP || !next || next.at - this.stageClock < 1) return;
    // Not right before a leader: the field must clear for the midboss / boss.
    if ((!this.midDone && stage.midAt - this.stageClock < 3) || stage.bossAt - this.stageClock < 3) return;
    this._emptyFor = 0;
    this._fillers = (this._fillers || 0) + 1;
    const grunts = stage.grunts || [];
    const key = grunts[this._fillers % Math.max(1, grunts.length)];
    if (!key) return;
    const forms = ['chevron', 'stagger', 'diagonal', 'helix'];
    const moves = ['dive', 'sine', 'arc', 'weave'];
    this._spawnFormation({
      key, count: 4 + (this._fillers % 2), hp: stage.gruntHp, score: stage.gruntScore,
      formation: forms[this._fillers % forms.length], move: moves[this._fillers % moves.length],
      pattern: (stage.patterns || ['aimed'])[this._fillers % (stage.patterns?.length || 1)],
      tint: stage.gruntTint || '', ambush: false, role: 'filler', opening: false, powerCarrierIndex: -1,
    });
  }

  /**
   * True once no grunt is left (dead, or flown off). Stragglers that linger past
   * LEADER_WAIT_MAX turn tail and leave the field so the stage can't stall.
   */
  /**
   * Named mobs (user): one before the midboss and one between the midboss and the boss.
   * Twice the size of a regular elite, a tougher pattern (enemy.js _namedFire), worth taking
   * out first: the kill has a 20% chance of a P or bomb item. Left alone it keeps
   * firing, and flees with the stragglers when the leader arrives.
   */
  _namedFlow(stage) {
    const list = stage.named;
    if (!list?.length) return;
    const flags = (this._namedSpawned ||= [false, false]);
    const at = [stage.midAt * 0.55, stage.midAt + (stage.bossAt - stage.midAt) * 0.4];
    for (let i = 0; i < 2; i++) {
      if (flags[i]) continue;
      if (i === 0 && this.midDone) { flags[0] = true; continue; }
      if (i === 1 && !this.midDone) continue;
      if (this.stageClock < at[i]) continue;
      flags[i] = true;
      this._spawnNamed(list[i] || list[0], stage);
    }
  }

  _spawnNamed(key, stage) {
    let k = key;
    let clips = this._clipsFor(k);
    if (!clips) { k = stage.elites?.[0]; clips = this._clipsFor(k); }
    const m = this.assets.ENEMY_META[k];
    if (!clips || !m) return null;
    const named = !!m.named;
    const e = this._spawnEnemy({
      x: W + 120, y: H * 0.5, clips,
      hp: Math.round((stage.eliteHp || 20) * 10),
      score: 3000 + this.stageIndex * 1000,
      // Stand-in elites: 2x, capped so a big elite (juggernaut) doesn't fill the lane.
      size: m.size, drawScale: (m.drawScale || 1) * (named ? 1 : Math.min(2, 260 / (m.size * (m.drawScale || 1)))),
      kind: 'named', pattern: 'named', move: moveNamed, name: m.name,
      color: stage.color, flipX: !!m.flipX,
    });
    e.named = true;
    this._announce('becareful', 2);
    // Stand-in (no original named art yet): the resized elite gets a light crimson wash (user).
    if (!named) e.spriteTint = '#c41e3a';
    e.fireTimer = 1.4;
    return e;
  }

  /** Named kill reward (checked every frame, whatever dealt the last hit). */
  _tickNamedRewards() {
    for (const e of this.enemies) {
      if (!e.named || e.alive || e._namedPaid) continue;
      e._namedPaid = true;
      if (e.retreating && e.hp > 0) continue;
      // 20% chance of one item, P or bomb (user); enemy bullets stay.
      let drop = gameplayRng() < 0.2 ? (gameplayRng() < 0.5 ? 'power' : 'bomb') : null;
      if (drop === 'bomb') {
        // Bomb rewards share the random drops' spacing (never 2-3 bombs on screen at once).
        const last = this._lastBombDropAt <= this.time ? this._lastBombDropAt : -Infinity;
        if (this.time - last < BOMB_DROP_GAP || this.player.bombs >= this.player.bombsMax) drop = null;
        else this._lastBombDropAt = this.time;
      }
      if (drop) {
        this.powerUps.push(new PowerUp(e.x, e.y, drop));
        this._trimPowerUps();
      }
      this.fx.explosion(e.x, e.y, 1.8);
      this.fx.addShake(6, 0.25);
      this.audio.play('leaderBlast');
    }
  }

  /** Stage open: fade in, fly in from the left, then the battle (see the 'entry' phase). */
  _beginStageEntry() {
    this.stagePhase = 'entry';
    const first = this.stageIndex === 0;
    this.stageWait = first ? 3.0 : 2.0;
    this._setStageIntro(this.stageWait + 0.6);
    this.stageTitle = `STAGE ${this.stageIndex + 1}`;
    this.stageSubtitle = '';
    this.player.x = -70;
    this.player.y = H * 0.5;
    this.player.enterFromLeft();
    this._fadeTo(0, first ? 0.5 : 0.8);
    // "Battle starts shortly" (original minigame announcer) on the first sortie.
    if (first) this._announce('battlestart', 2, 0, { waitForPilot: true });
  }

  /**
   * Arcade tally (user): every bonus line appears with its full amount, then each line in
   * turn drains to 0 while TOTAL (and the score) climbs by the same amount, with a counter
   * tick and a ding as each line empties. Then the cheer, a beat, and the fly-off.
   */
  _tickTally(dt) {
    const T = this._tally;
    if (!T) return;
    T.t += dt;
    const n = T.rows.length;
    T.rows.forEach((r, i) => {
      if (r.left == null) r.left = r.value;
      if (!r.shownUp && T.t >= TALLY_REVEAL0 + i * TALLY_REVEAL_GAP) {
        r.shownUp = true;
        this.audio.play('ui:move');
      }
    });
    const xferAt = TALLY_REVEAL0 + n * TALLY_REVEAL_GAP + 0.35;
    if (T.t >= xferAt && !T.xferDone) {
      const r = T.rows.find((q) => q.left > 0);
      if (!r) {
        T.xferDone = T.t;
      } else {
        // Each line drains in at most ~0.9 s; small ones go quicker.
        r.rate ||= Math.max(r.value / 0.9, 6000);
        const step = Math.min(r.left, Math.ceil(r.rate * dt));
        r.left -= step;
        T.paid += step;
        this.score += step;
        if (T.t - T.tickAt > 0.045) {
          T.tickAt = T.t;
          this.audio.play('ui:move');
        }
        if (r.left <= 0) this.audio.play('ui:ok');
      }
    }
    T.totalShown = T.paid;
    if (T.xferDone && !T.cheered) {
      // Announcer cheer on the final TOTAL (user): "Perfect" for a no-miss stage, else one
      // of Clear / Stage Clear / Great / Amazing / Success (original minigame announcer).
      T.cheered = true;
      if (T.noMiss) this._announce('perfect', 2, 0, { waitForPilot: true });
      else {
        const pool = [['clear', 6], ['stageclear', 2], ['great', 2], ['amazing', 3], ['success', 2]];
        const [name, cnt] = pool[Math.floor(Math.random() * pool.length)];
        this._announce(name, cnt, 0, { waitForPilot: true });
      }
    }
    if (T.xferDone && T.t >= T.xferDone + 1.4 && !T.done) {
      T.done = true;
      this.player.exitRight();
      this.stagePhase = 'exit';
      this.stageWait = 1.6;
    }
  }

  /** Full-field black fade (DOM layer over the HUD), driven by sim time. */
  _fadeTo(target, dur) {
    const from = this._fade ? this._fadeValue() : (target === 0 ? 1 : 0);
    this._fade = { from, to: target, t: 0, dur: Math.max(0.01, dur), out: target === 1 };
  }

  _fadeValue() {
    const f = this._fade;
    if (!f) return 0;
    const k = Math.min(1, f.t / f.dur);
    return f.from + (f.to - f.from) * k;
  }

  _fieldClearForLeader(dt) {
    const left = this.enemies.filter((e) => e.alive && !e.dying && e.kind !== 'boss' && e.kind !== 'midboss');
    if (!left.length) return true;
    this._leaderWait = (this._leaderWait || 0) + dt;
    // No forced retreat (user): the leader waits until every enemy on screen is shot down or
    // has flown off on its own. Only ships still parked off-screen (never entered) are
    // dropped after LEADER_WAIT_MAX, silently, so the stage can't stall on something unseen.
    if (this._leaderWait > LEADER_WAIT_MAX) {
      for (const e of left) {
        const visible = e.x > -40 && e.x < W + 40 && e.y > -40 && e.y < H + 40;
        if (!visible) e.alive = false;
      }
    }
    return false;
  }

  /** MID CLEAR / STAGE CLEAR cards — no stray grunt fire or late deaths. */
  _inCeremony() {
    return this.stagePhase === 'transition'
      || this.stagePhase === 'mid-recover'
      || this.stagePhase === 'asset-gate'
      || this.stagePhase === 'entry'
      || this.stagePhase === 'tally'
      || this.stagePhase === 'exit';
  }

  /**
   * Midboss / boss death sequence (~2.4 s): the field's bullets clear, small explosions pop
   * all over the body (faster and faster) while it collapses, then a final blast the size of
   * the body and it is gone. Clear cards wait for it (_resolveStageLeader).
   */
  _tickLeaderDeath(dt) {
    const b = this.boss;
    if (!b || b.alive || !b.dying || (b.kind !== 'boss' && b.kind !== 'midboss')) return;
    let d = b._deathSeq;
    if (!d) {
      d = b._deathSeq = { t: 0, next: 0 };
      this.bullets.clearEnemy();
      this.fx.addFlash(0.12);
      this.fx.addShake(6, 0.3);
      this.player.invuln = Math.max(this.player.invuln, LEADER_DEATH_TIME + 0.5);
    }
    d.t += dt;
    const size = b.drawSize || 200;
    while (d.next <= d.t && d.t < LEADER_DEATH_TIME - 0.2) {
      const f = d.t / LEADER_DEATH_TIME;
      const ox = (Math.random() - 0.5) * size * 0.7;
      const oy = (Math.random() - 0.5) * size * 0.6;
      this._spawnSheetFx('lao-fx-airboom', b.x + ox, b.y + oy, 60 + Math.random() * 60 * (0.6 + f), 0.45);
      // Every other pop also throws fire, a shock ring and embers (PolishFx blast layers).
      d.pops = (d.pops || 0) + 1;
      if (d.pops % 2) this.fx.explosion(b.x + ox, b.y + oy, 0.8 + f * 0.6);
      else this.fx.hitSpark(b.x + ox * 0.6, b.y + oy * 0.6, 7);
      this.fx.addShake(2 + f * 3, 0.12);
      this.audio.play('leaderPop');
      // Pops speed up toward the final blast.
      d.next += 0.2 - 0.11 * f + Math.random() * 0.05;
    }
    if (d.t >= LEADER_DEATH_TIME - 0.2 && !d.blast) {
      d.blast = true;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        this._spawnSheetFx('lao-fx-airboom', b.x + Math.cos(a) * size * 0.18, b.y + Math.sin(a) * size * 0.15,
          size * (i === 0 ? 1.7 : 1.1), 0.7);
      }
      // Final blast: a huge fire / shock body plus a ring of secondary blasts.
      this.fx.explosion(b.x, b.y, 2.8);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        this.fx.explosion(b.x + Math.cos(a) * size * 0.32, b.y + Math.sin(a) * size * 0.26, 1.2);
      }
      this.fx.addFlash(0.32);
      this.fx.addShake(12, 0.6);
      this.audio.play('leaderBlast');
    }
    if (d.t >= LEADER_DEATH_TIME) b.dying = false;
  }

  /** Despawn live field enemies (keep boss/mid die clips). No score for purge. */
  _purgeFieldEnemies() {
    for (const e of this.enemies) {
      if (e.kind === 'boss' || e.kind === 'midboss') continue;
      if (e.dying) continue;
      e.alive = false;
      e.dying = false;
    }
  }

  /** Swap-remove finished corpses — avoid allocating a fresh array every tick. */
  _compactEnemies() {
    let write = 0;
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive && !e.dying) continue;
      list[write++] = e;
    }
    list.length = write;
  }

  _beginCeremonySafety() {
    this._purgeFieldEnemies();
    this.bullets.clearEnemy();
    this.audio.stopChargeHold();
    if (this.player.alive) {
      this.player.invuln = Math.max(this.player.invuln, 2.4);
      this.player.charge = 0;
      this.player._chargeQueued = false;
      this.player._shootQueued = false;
    }
  }

  /** Hit / body contact — break the chain even if a deathbomb later saves the life. */
  _breakCombo() {
    this.fx.combo = 0;
    this.fx.comboTimer = 0;
  }

  _resolveStageLeader() {
    if (!this.boss || this.boss.alive) return;
    // Clear cards wait for the death sequence (pops + final blast) to finish.
    if (this.boss.dying) return;
    if (this.stagePhase === 'midboss') {
      if (this._seg?.midStartedAt) {
        this._seg.midFight += Math.max(0, this.time - this._seg.midStartedAt);
        this._seg.midStartedAt = 0;
      }
      // Mid clear used to be a silent 2s pause — same beat weight as WARN/PHASE.
      this.stagePhase = 'mid-recover';
      this.stageWait = 2.2;
      this._beginCeremonySafety();
      this._setStageIntro(2.0);
      this.stageTitle = 'MID CLEAR';
      this.stageSubtitle = this.boss?.name
        ? `${this.boss.name.replace(/^MID\s*—\s*/i, '')} DOWN`
        : 'SECTOR SECURED';
      this.audio.play('cue');
      this.fx.addShake(4, 0.22);
      this.fx.addFlash(0.08);
    } else if (this.stagePhase === 'boss' && this.boss.finalForm != null
      && this.boss.finalForm < this.boss.finalForms - 1) {
      // Final boss: the next body comes in after this one's death sequence.
      const stage = this.stages[this.stageIndex];
      const next = this.boss.finalForm + 1;
      this._spawnStageLeader(stage.boss, 'boss', Math.round(stage.bossHp * FINAL_FORM_HP), stage.bossScore, next);
      this._setStageIntro(1.6);
      this.stageTitle = `PHASE ${next + 1}`;
      this.stageSubtitle = this.boss?.name || '';
      this.audio.play('warning');
    } else if (this.stagePhase === 'boss') {
      if (this._seg?.bossStartedAt) {
        this._seg.bossFight += Math.max(0, this.time - this._seg.bossStartedAt);
        this._seg.bossStartedAt = 0;
      }
      // Arcade clear (user, Metal Slug style): a tally that counts up, the ship flies off to
      // the right, fade out; the next stage fades in and the ship flies in from the left.
      this._clearIsFinale = this.stageIndex >= this.stages.length - 1;
      this.stageTitle = this._clearIsFinale ? 'ALL CLEAR' : 'STAGE CLEAR';
      this.stageSubtitle = '';
      this._beginCeremonySafety();
      const stageNo = this.stageIndex + 1;
      const noMiss = this.stageHits === 0;
      const bombAdded = this.player.addBomb(1);
      this._clearBombKind = bombAdded ? 'bomb' : 'score';
      this._clearNomissLife = false;
      this._clearLv4 = false;
      if (noMiss && this.player.lives < 5 && !this.player._ramp) {
        this.player.lives += 1;
        this._clearNomissLife = true;
        this._lifeExtendFlash = 1.4;
      }
      const rows = [
        { label: 'BOSS DESTROYED', value: stageNo * 4000 },
        { label: noMiss ? 'NO MISS' : 'NO MISS', value: noMiss ? 10000 : 0, note: this._clearNomissLife ? '1UP' : '' },
        { label: 'BOMB STOCK', value: this.player.bombs * 500 + (bombAdded ? 0 : 1500) },
      ];
      this.stageClearBonus = rows.reduce((a, r) => a + r.value, 0);
      this._tally = { rows, total: this.stageClearBonus, t: 0, paid: 0, done: false, tickAt: 0 };
      this.stagePhase = 'tally';
      this.player.cinematic = true;
      this.stageIntro = 0;
      this._tally.noMiss = noMiss;
      this.audio.play('clear');
      this._voice('clear');
    }
  }

  _spawnEnemy(opts) {
    const e = new Enemy(opts);
    // A visible carrier is chosen by the stage script, never by a hidden roll.
    e.dropsPower = !!opts.powerCarrier;
    this.enemies.push(e);
    return e;
  }

  /** @param {{ kind?: string, score?: number }} e */
  _powerDropKind(e) {
    if (e.kind === 'boss' || e.kind === 'midboss') return e.kind;
    return (e.score | 0) >= 500 ? 'elite' : 'grunt';
  }

  _syncMergedInput() {
    const k = this._keyInput;
    const t = this._touchInput;
    this.input.left = !!k.left;
    this.input.right = !!k.right;
    this.input.up = !!k.up;
    this.input.down = !!k.down;
    this.input.shoot = !!(k.shoot || t.shoot);
    this.input.shift = !!(k.shift || t.shift);
    this.input.bomb = !!(k.bomb || t.bomb);
    this.input.special = !!(k.special || t.special);
    this.input.ax = Number(t.ax) || 0;
    this.input.ay = Number(t.ay) || 0;
    // OPTIONS auto-fire works on every device (was touch-only, so PC ignored the toggle).
    this.input.autoFire = !!this.settings?.autoFire;
  }

  _setKeyAction(action, down) {
    switch (action) {
      case 'left': this._keyInput.left = down; break;
      case 'right': this._keyInput.right = down; break;
      case 'up': this._keyInput.up = down; break;
      case 'down': this._keyInput.down = down; break;
      case 'shoot': this._keyInput.shoot = down; break;
      case 'focus': this._keyInput.shift = down; break;
      case 'bomb': this._keyInput.bomb = down; break;
      case 'special': this._keyInput.special = down; break;
      default: break;
    }
    this._syncMergedInput();
  }

  _tickInputReplay() {
    const events = this.debug?.replayInputs;
    if (!events?.length) return;
    const f = this._simFrame | 0;
    while (this._replayCursor < events.length) {
      const ev = events[this._replayCursor];
      const ef = Number.isFinite(ev.f) ? (ev.f | 0) : null;
      if (ef != null) {
        if (ef > f) break;
        if (ef < f) { this._replayCursor += 1; continue; }
      } else if (ev.t > this.time + 1e-6) {
        break;
      }
      this._replayCursor += 1;
      this._setKeyAction(ev.action, !!ev.down);
    }
  }

  _samplePerf(dt) {
    const enemies = this.enemies?.length || 0;
    let bullets = 0;
    const bl = this.bullets?.list;
    if (bl) {
      for (let i = 0; i < bl.length; i++) if (bl[i]?.alive) bullets += 1;
    }
    const fx = (this.particles?.length || 0)
      + (this.fx?.active?.length || 0)
      + (this.fx?.popups?.length || 0)
      + (this.pickupFx?.list?.length || 0);
    if (!this._perfWave) {
      this._perfWave = {
        stage: this.stageIndex + 1,
        wave: this.stageWaveIndex,
        phase: this.stagePhase,
        maxEnemies: enemies,
        maxBullets: bullets,
        maxFx: fx,
        maxDt: dt,
        samples: 1,
      };
      return;
    }
    const w = this._perfWave;
    if (w.wave !== this.stageWaveIndex || w.stage !== this.stageIndex + 1 || w.phase !== this.stagePhase) {
      this.perfLog.push(w);
      this._perfWave = {
        stage: this.stageIndex + 1,
        wave: this.stageWaveIndex,
        phase: this.stagePhase,
        maxEnemies: enemies,
        maxBullets: bullets,
        maxFx: fx,
        maxDt: dt,
        samples: 1,
      };
      return;
    }
    w.maxEnemies = Math.max(w.maxEnemies, enemies);
    w.maxBullets = Math.max(w.maxBullets, bullets);
    w.maxFx = Math.max(w.maxFx, fx);
    w.maxDt = Math.max(w.maxDt, dt);
    w.samples += 1;
  }

  getPerfLog() {
    if (this._perfWave) return [...this.perfLog, this._perfWave];
    return this.perfLog.slice();
  }

  _setTouchAction(action, down) {
    switch (action) {
      case 'left': this._touchInput.left = down; break;
      case 'right': this._touchInput.right = down; break;
      case 'up': this._touchInput.up = down; break;
      case 'down': this._touchInput.down = down; break;
      case 'shoot': this._touchInput.shoot = down; break;
      case 'focus': this._touchInput.shift = down; break;
      case 'bomb': this._touchInput.bomb = down; break;
      case 'special': this._touchInput.special = down; break;
      default: break;
    }
    this._syncMergedInput();
  }

  _clearAllInput() {
    for (const key of Object.keys(this._keyInput)) this._keyInput[key] = false;
    for (const key of Object.keys(this._touchInput)) this._touchInput[key] = false;
    for (const key of Object.keys(this.input)) this.input[key] = false;
    this._specialQueued = false;
    this._bombQueued = false;
    this._specialLatch = this._bombLatch = false;
    if (this.player) this.player._shootQueued = false;
    this._touchControls?.reset();
  }

  setTouchPadsVisible(on) {
    if (!this._touchControls) return;
    this._touchControls.setVisible(!!on && wantsTouchControls());
  }

  /** Enter stage `this.stageIndex` (after a clear, or the Y / T debug jump): field reset,
   *  per-stage counters, BGM, and the asset gate before its waves open. */
  _enterStage() {
    this.enemies.length = 0;
    this.bullets.clearEnemy();
    this.powerUps.length = 0;
    this.boss = null;
    this._clearBombKind = '';
    this.stageClock = 0;
    this._lastPowerRecoveryAt = 0;
    if (this.player.shotLevel > 2) this._powerRecoveryDueAt = Infinity;
    this.player.enemyRankEnabled = true;
    this.stageWaveIndex = 0;
    this.midDone = false;
    this._namedSpawned = [false, false];
    this.warningKind = '';
    this.stageCue = '';
    this.stageCueTime = 0;
    this.stageHits = 0;
    this.stageGrazeStart = this.graze;
    this.stageClearBonus = 0;
    this._clearBombKind = '';
    this._clearNomissLife = false;
    this._clearLv4 = false;
    this._clearIsFinale = false;
    this._bossPhaseSeen = -1;
    this._phaseTelegraph = 0;
    this._breakCombo();
    this.audio.setStageBgm(moodForStage(this.stages[this.stageIndex]));
    this.audio.setBgmIntensity?.(0.35);
    this._beginStageSegment(this.stageIndex);
    // Gate waves until ensureStage completes (prefetch alone is not enough).
    this.stagePhase = 'asset-gate';
    this.stageTitle = 'LOADING';
    this.stageSubtitle = this.stages[this.stageIndex]?.name || '';
    this._setStageIntro(1.2);
    this._requestStageAssets(this.stageIndex, `STAGE ${this.stageIndex + 1}`);
  }

  /** Debug Y / T: jump to the next / previous stage (fresh stage start). */
  _jumpStageCheat(delta) {
    if (this.state !== 'playing' || this.paused) return false;
    const to = Math.max(0, Math.min(this.stages.length - 1, this.stageIndex + delta));
    if (to === this.stageIndex) return false;
    this.stageIndex = to;
    this._enterStage();
    this._setSpecialNotice(`STAGE ${to + 1}`, 1.0);
    return true;
  }

  /** Debug U: invincibility on / off (no hits, no body-contact power loss). */
  _toggleGodCheat() {
    if (this.state !== 'playing' || !this.player) return false;
    this.player.godMode = !this.player.godMode;
    this._setSpecialNotice(this.player.godMode ? '무적 ON' : '무적 OFF', 1.0);
    return true;
  }

  _adjustPowerCheat(delta) {
    if (this.state !== 'playing' || this.paused || !this.player?.adjustShotLevelCheat(delta)) {
      return false;
    }
    this.audio.play(delta > 0 ? 'pickupP' : 'powerDown');
    this._setSpecialNotice(`POWER ${delta > 0 ? 'UP' : 'DOWN'} · Lv${this.player.shotLevel}`, 0.95);
    if (this.player._ramp) {
      if (delta > 0) this._rampalionFuse();
      else rampBreak(this.player);
    }
    this._updateHud();
    return true;
  }

  /** Debug I: +1 bomb (up to the stock max). */
  _bombCheat() {
    if (this.state !== 'playing' || !this.player?.alive) return false;
    const ok = this.player.addBomb(1);
    this._setSpecialNotice(ok ? `BOMB +1 · ${this.player.bombs}` : `BOMB FULL · ${this.player.bombs}`, 0.9);
    this._updateHud();
    return ok;
  }

  _chargeSpecialCheat() {
    if (this.state !== 'playing' || this.paused || !this.player?.alive
      || this.player.sp >= this.player.spMax) return false;
    this.player.addSpRaw(this.player.spCost);
    this._setSpecialNotice(`SP CHARGE · Lv${this.player.specialLevel}`, 0.95);
    this._updateHud();
    return true;
  }

  _bindInput() {
    const resolveActions = (code) => {
      const actions = ['left', 'right', 'up', 'down', 'shoot', 'focus', 'bomb', 'special'];
      return actions.filter((a) => matchAction(this.settings, a, code));
    };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.audio.unlock();
      if (this.isInputBlocked()) return;
      // Debug cheats, only once enabled on the title: P/O power, Z SP charge (Z is also the
      // default FIRE key, so it used to refill SP for everyone), Y/T stage, U invincible,
      // I +1 bomb.
      if (this.cheats) {
        if (e.code === 'KeyP' || e.code === 'KeyO') {
          e.preventDefault();
          if (!e.repeat) this._adjustPowerCheat(e.code === 'KeyP' ? 1 : -1);
          return;
        }
        if (e.code === 'KeyZ' && !e.repeat) this._chargeSpecialCheat();
        if (!e.repeat && (e.code === 'KeyY' || e.code === 'KeyT')) {
          e.preventDefault();
          this._jumpStageCheat(e.code === 'KeyY' ? 1 : -1);
          return;
        }
        if (e.code === 'KeyU' && !e.repeat) {
          e.preventDefault();
          this._toggleGodCheat();
          return;
        }
        if (e.code === 'KeyI' && !e.repeat) {
          e.preventDefault();
          this._bombCheat();
          return;
        }
      }
      if (matchAction(this.settings, 'pause', e.code) && !e.repeat) {
        this.setPaused(!this.paused);
        return;
      }
      if (matchAction(this.settings, 'mute', e.code) && !e.repeat) {
        this.audio.toggle();
        this.settings = { ...this.settings, muted: this.audio.muted };
        this.onSettingsChange?.(this.settings);
        this._updateHud();
        return;
      }
      if (this.paused) return;
      const acts = resolveActions(e.code);
      // Queue taps so brief presses aren't eaten by hitstop freeze frames.
      if (acts.includes('special') && !e.repeat) this._specialQueued = true;
      if (acts.includes('bomb') && !e.repeat) this._bombQueued = true;
      if (acts.includes('shoot') && !e.repeat) this.player._shootQueued = true;
      for (const a of acts) this._setKeyAction(a, true);
    };
    this._onKeyUp = (e) => {
      for (const a of resolveActions(e.code)) this._setKeyAction(a, false);
    };
    this._onBlur = () => this._clearAllInput();
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    const touchRoot = document.getElementById('touch-controls');
    if (touchRoot && wantsTouchControls()) {
      this._touchControls = new TouchControls(touchRoot, {
        padMode: this.settings?.padMode === 'floating' ? 'floating' : 'fixed',
        onGesture: () => this.audio.unlock(),
        onDir: (dx, dy) => {
          this._touchInput.ax = dx;
          this._touchInput.ay = dy;
          this._syncMergedInput();
        },
        onButton: (action, down) => {
          if (action === 'shoot' && !down) this._cancelAutoFireHold();
          if (this.isInputBlocked() || this.paused) {
            if (!down) this._setTouchAction(action, false);
            return;
          }
          // Long-press FIRE toggles auto-fire (mobile has no OPTIONS shortcut mid-run).
          if (action === 'shoot' && down) this._armAutoFireHold();
          if (down) {
            if (action === 'special') this._specialQueued = true;
            if (action === 'bomb') this._bombQueued = true;
            if (action === 'shoot') this.player._shootQueued = true;
          }
          this._setTouchAction(action, down);
        },
        onPause: () => {
          this.audio.unlock();
          if (this.isInputBlocked()) return;
          this.setPaused(!this.paused);
        },
      });
      this._touchControls.setVisible(true);
      document.body.classList.add('has-touch-pads');
    }
    this._syncAutoFireUi();
  }

  dispose() {
    this._disposed = true;
    this._fadeEl?.remove();
    this._fadeEl = null;
    this.setRngSeed(null);
    if (this._perfWave) {
      this.perfLog.push(this._perfWave);
      this._perfWave = null;
    }
    this.audio.stopChargeHold();
    this.audio.setBeamHold?.(false);
    if (this._ownsAudio) this.audio.dispose();
    else this.audio.stopBgm(false);
    this.projectileVfx.dispose();
    this.bombVfx.clear();
    this.pickupFx.clear();
    this.fx.clear();
    this._cancelAutoFireHold();
    this._touchControls?.dispose();
    this._touchControls = null;
    document.body.classList.remove('has-touch-pads');
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    const hud = document.getElementById('hud');
    hud?.classList.remove('is-rare-sortie');
    hud?.style.removeProperty('--rare-accent');
    hud?.style.removeProperty('--rare-glow');
    document.getElementById('charge-fill')?.style.removeProperty('--charge-tint');
    document.getElementById('life-stock')?.classList.remove('is-critical', 'is-extend');
    document.getElementById('life-warn')?.classList.remove('is-on');
    document.getElementById('bomb-stock')?.classList.remove('is-deathbomb', 'is-empty');
    document.getElementById('sp-track')?.classList.remove('is-ready-flash');
    document.getElementById('boss-bar')?.classList.remove('is-critical');
    this._touchControls?.setPadHints({});
  }

  /** Apply life-loss side effects after deathbomb grace expires. */
  _handleMissCommit() {
    const kind = this.player.missJustCommitted;
    if (!kind) return;
    const dead = kind === 'dead';
    const enteringLastLife = !dead && this.player.lives === 1;
    this.player.missJustCommitted = null;
    this._voice(dead ? 'gameover' : 'miss');
    this.stageHits += 1;
    if (!dead) this._powerRecoveryDueAt = Math.min(this._powerRecoveryDueAt, this.time + 5.5);
    this.runNoMiss = false;
    if (this._seg) this._seg.misses += 1;
    // Safety: hit() already broke the chain; keep commit path idempotent.
    this._breakCombo();
    // Impact already played playerHit when the grace opened.
    if (dead) {
      this.audio.play('playerDeath');
      this._spawnBurst(this.player.x, this.player.y, 10);
      // Apply immediately — game-over may stop further item ticks.
      for (const item of this.powerUps) item.snapToward(this.player.x, this.player.y, 360, 0.78);
    } else {
      // Respawn teleports left — vacuum so mid-screen drops aren't stranded.
      this._itemMagnetBoost = Math.max(this._itemMagnetBoost, 2.4);
      if (enteringLastLife) {
        this._announce('hplow', 2);
        // One-shot last-life sting — HUD pulse alone was easy to miss mid-bullet hell.
        this._setSpecialNotice(t('notice.lastLife'), 1.65);
        this.audio.play('warning');
        this.fx.addFlash(0.1);
        this.fx.addShake(5, 0.22);
      }
    }
    this.audio.stopChargeHold();
  }

  /** SP status / combat cue — wall-clock so hitstop doesn't stretch the banner. */
  _setSpecialNotice(text, seconds = 1.0) {
    this.specialNotice = text;
    this.specialNoticeUntil = this._fxClock + seconds;
  }

  /** Fire bomb/special from held input or queued taps (survives hitstop). */
  _drainCombatButtons() {
    if (this._bombQueued || (this.input.bomb && !this._bombLatch)) {
      // Mid-life death flash: X isn't usable — keep tap/hold (same as C).
      // Deathbomb window still drains immediately below.
      if (this.player.respawnTimer > 0 || this.player.inDeathBombWindow) {
        // X pressed as she dies is cancelled, not saved for after the respawn (user: no
        // deathbomb). Holding X through the respawn does not fire either (latch).
        this._bombQueued = false;
        this._bombLatch = true;
      } else {
        this._bombQueued = false;
        if (this.player.inDeathBombWindow) {
          // Classic deathbomb: X during post-hit grace cancels the life loss.
          if (this.player.tryDeathBomb(this.bullets)) {
            this.player.startActionVoice('bomb'); this._drainPlayerFxEvents(); this._voice('bomb'); // cast voice on the cast frame (bomb hitstop holds the sim)
            if (this._seg) this._seg.deathbombs += 1;
            this._onBombFired();
            this._itemMagnetBoost = Math.max(this._itemMagnetBoost, 1.6);
            this._setSpecialNotice(t('notice.deathbombKeep'), 1.1);
          } else {
            this._setSpecialNotice(t('notice.noBombFail'), 1.0);
            this.audio.play('deny'); this._announce('notready', 2, 4);
          }
        } else if (this.player.tryBomb(this.bullets)) {
          this.player.startActionVoice('bomb'); this._drainPlayerFxEvents(); this._voice('bomb'); // cast voice on the cast frame (bomb hitstop holds the sim)
          this._onBombFired();
        } else if (this.player.alive && !this.player.isRespawning) {
          // Match special's empty-gauge sting — X with 0 stock used to feel dead.
          this._setSpecialNotice(t('notice.noBombDrop'), 1.0);
          this.audio.play('deny'); this._announce('notready', 2, 4);
        }
        this._bombLatch = true;
      }
    }
    if (!this.input.bomb) this._bombLatch = false;

    if (this._specialQueued || (this.input.special && !this._specialLatch)) {
      // C isn't usable while locked — keep the tap/hold for after grace/death flash.
      if (this.player.isRespawning) {
        /* preserve queue / unlatched hold */
      } else {
        this._specialQueued = false;
        if (this.player.trySpecial(this.bullets)) {
          this.player.startActionVoice('special'); this._drainPlayerFxEvents(); this._voice('special'); // cast voice on the cast frame (bomb hitstop holds the sim)
          this._onSpecialFired();
          if (this.player.lastCastKind === 'hskill1') {
            this._setSpecialNotice(t('notice.hskill1'), 0.9);
          } else {
            this._setSpecialNotice(t('notice.specialFired', {
              lv: this.player.lastSpecialLevel,
              name: specialDisplayName(this.player.charKey) || this.player.lastSpecialName,
            }), 1.1);
          }
        } else if (this.player.alive && this.player.inHumanForm && this.player._altMeta?.skill1) {
          // Human form C on cooldown (or mid-jump): no gauge talk.
          if ((this.player.hSkillCd || 0) > 0 && !this.player.hSkill) {
            this._setSpecialNotice(t('notice.cooldown', { s: this.player.hSkillCd.toFixed(1) }), 0.8);
            this.audio.play('deny');
          }
        } else if (this.player.alive) {
          this._setSpecialNotice(t('notice.lowGauge'), 1.1);
          this.audio.play('deny'); this._announce('notready', 2, 4);
        }
        this._specialLatch = true;
      }
    }
    if (!this.input.special) this._specialLatch = false;
  }

  /** Test harness tick — bypasses manualTick gate used to silence the rAF loop. */
  tick(dt) {
    this._allowTick = true;
    try {
      this.update(dt);
    } finally {
      this._allowTick = false;
    }
  }

  /**
   * Deterministic combat harness: freeze rAF, reseed RNG, rewind to stage-1 sortie start.
   * Does not reload assets — only clears mutable combat state.
   */
  prepareDeterministicRun(seed = 0xc0ffee) {
    this.debug.manualTick = true;
    this.setRngSeed(seed);
    this.enemies.length = 0;
    this.bullets.clearAll();
    this.powerUps.length = 0;
    this.particles.length = 0;
    this.boss = null;
    this.score = 0;
    this.graze = 0;
    this.time = 0;
    this._fxClock = 0;
    this._simFrame = 0;
    this.stageIndex = 0;
    this.stageClock = 0;
    this.stageWaveIndex = 0;
    this.stagePhase = 'waves';
    this.midDone = false;
    this.stageWait = 0;
    this.stageIntro = 0;
    this._introPeak = 0;
    this.stageCue = '';
    this.stageCueTime = 0;
    this.warningKind = '';
    this.stageHits = 0;
    this.stageGrazeStart = 0;
    this.stageClearBonus = 0;
    this._bossPhaseSeen = -1;
    this._phaseTelegraph = 0;
    this._assetGateError = null;
    this._assetsReady = true;
    this._assetGatePending = null;
    this._lastPowerRecoveryAt = 0;
    this._itemMagnetBoost = 0;
    this._powerRecoveryDueAt = Infinity;
    this._spWasReady = false;
    this._spReadyFlash = 0;
    this._lifeExtendFlash = 0;
    this.bgX = 0;
    this._clearAllInput();
    this.runNoMiss = true;
    this.runMetrics = this._freshRunMetrics();
    this._beginStageSegment(0);
    this.perfLog = [];
    this._perfWave = null;
    const p = this.player;
    if (p) {
      p.lives = p._ramp ? 1 : 3;
      p.bombs = p.bombsStart ?? 2;
      p.sp = p.spCost;
      p.shotLevel = 1;
      p.charge = 0;
      p.invuln = 1.5;
      p.alive = true;
      p.deathBombTimer = 0;
      p.deathBombOpens = 0;
      p.missJustCommitted = null;
      p.respawnTimer = 0;
      p.fireCooldown = 0;
      p._chargeQueued = false;
      p._shootQueued = false;
      p.anim?.play?.('idle', { restart: true });
      p.enterFromLeft?.();
    }
    this.fx?.clear?.();
    this.pickupFx?.clear?.();
    this.bombVfx?.clear?.();
    if (this.projectileVfx) this.projectileVfx.count = 0;
    this.particles.length = 0;
    return this;
  }

  /**
   * Original BGM by stage phase (js/bgm-tracks.js): the stage's battle track during waves,
   * the leader's track from its WARNING windup through the fight. The stage clear card
   * keeps the boss track; the next stage's waves bring in its own battle track.
   */
  _syncBgmKey() {
    const stage = this.stages[Math.min(this.stageIndex, this.stages.length - 1)];
    const ph = this.stagePhase;
    if (ph === 'mid-windup' || ph === 'midboss') return BGM_TABLE.leaders[stage.mid] || null;
    if (ph === 'boss-windup' || ph === 'boss') return BGM_TABLE.leaders[stage.boss] || null;
    if (ph === 'transition' || ph === 'tally' || ph === 'exit') return this.audio.bgmTrack;
    return BGM_TABLE.stages[this.stageIndex] || null;
  }

  /** Pilot voice line for a game moment (js/pilot-voices.js). */
  /** Announcer line (ann_<name>_<1..variants>), optional per-line cooldown in game seconds. */
  _announce(name, variants = 1, cooldown = 0, opts) {
    const at = (this._annAt ||= {});
    if (cooldown && this.time - (at[name] ?? -Infinity) < cooldown) return;
    at[name] = this.time;
    // Cosmetic pick: Math.random keeps the seeded gameplay RNG untouched.
    this.audio.playAnnounce?.(`ann_${name}_${1 + Math.floor(Math.random() * variants)}`, 0.9, opts);
  }

  _voice(slot) {
    this.audio.playVoice?.(PILOT_VOICES[this.charKey]?.[slot]);
  }

  _syncBgm() {
    // Stage start line once per stage, when its waves open.
    if (this.stagePhase === 'waves' && this._voiceStage !== this.stageIndex) {
      this._voiceStage = this.stageIndex;
      this._voice('stageStart');
    }
    const want = this._syncBgmKey();
    if (want && want !== this._bgmKey) {
      this._bgmKey = want;
      this.audio.playBgmTrack?.(want);
    }
  }

  update(dt) {
    if (this.state !== 'playing') {
      this.audio.setBeamHold?.(false);
      return;
    }
    if (this.paused) return;
    this._syncBgm();
    if (this.debug?.manualTick && !this._allowTick) return;

    // Frame pacing sample (wall dt before turbo/pump).
    if (this._seg && dt > 0) {
      this._seg.frameSamples += 1;
      this._seg.frameDtSum += dt;
      if (dt > this._seg.frameDtMax) this._seg.frameDtMax = dt;
    }

    const steps = Math.max(1, Math.min(60, (this.debug?.pumpSteps | 0) || 1));
    if (steps > 1) {
      // Headless rAF is often ~5–15fps — pump fixed slices so smokes finish.
      const slice = 1 / 30;
      for (let i = 0; i < steps; i++) {
        if (this.state !== 'playing' || this.paused) break;
        this._updateSim(slice);
      }
      return;
    }

    const turbo = Math.max(1, Math.min(12, Number(this.debug?.turbo) || 1));
    if (turbo > 1) dt *= turbo;
    this._updateSim(dt);
  }

  /** One simulation slice (turbo already applied by caller when needed). */
  _updateSim(dt) {
    if (this.state !== 'playing' || this.paused) return;

    if (this.debug?.invuln && this.player) {
      this.player.invuln = Math.max(this.player.invuln, 2);
    }
    this._tickInputReplay();
    if (this.debug?.autoPlay && !this.debug?.replayInputs) this._tickAutoPlay();
    this._recordInputEdges();
    this._samplePerf(dt);
    this._simFrame += 1;

    // Consume bomb/special before hitstop so brief taps during freeze aren't lost.
    this._drainCombatButtons();

    // Presentation clock always advances — bomb/projectile VFX looked frozen under hitstop.
    this._fxClock += dt;

    // Hitstop freezes gameplay briefly; VFX still tick lightly inside PolishFx.
    const simDt = this.fx.tick(dt);
    if (simDt <= 0) {
      // Deathbomb grace + mid-life flash are wall-clock — sim freeze stalled both.
      if (this.player.inDeathBombWindow) {
        this.player.tickDeathBomb(dt);
        if (this.player.missJustCommitted) this._handleMissCommit();
      } else if (this.player.respawnTimer > 0) {
        this.player.tickRespawn(dt);
      }
      // i-frames / bomb flash / charge / movement — hitstop used to stall all of these.
      this.player.tickHitstopFeel(dt, this.input, this.bullets);
      if (this.player.chargeFired) {
        this.audio.stopChargeHold();
        this.audio.play('charge', this.player.meta.shot?.style);
      } else {
        const charging = !!(
          this.input.shoot
          && this.player.alive
          && !this.player.isRespawning
          && this.player.charge > 0.04
        );
        this.audio.setChargeHold(charging, this.player.charge);
      }
      // Presentation-only while the field is frozen.
      this._tickHitstopPresentation(dt);
      // Cards + windup/CLEAR waits on wall-clock (wave clock stays sim-locked).
      this._updateStageFlow(dt, { wallClockOnly: true });
      if (this.state !== 'playing') {
        this._updateHud();
        return;
      }
      // Magnet + pickup only (no drift) — deathbomb B restock was soft-locked by freeze.
      if (this._itemMagnetBoost > 0) {
        this._itemMagnetBoost = Math.max(0, this._itemMagnetBoost - dt);
      }
      this._updatePowerUps(dt, { drift: false });
      // Player can move during freeze — still resolve hazards vs frozen field.
      this._collisions({ worldFrozen: true });
      if (this.player.missJustCommitted) this._handleMissCommit();
      // Bomb can finish a leader during hitstop — don't defer CLEAR safety/invuln.
      this._compactEnemies();
      this._resolveStageLeader();
      if (this.boss && !this.boss.alive && !this.boss.dying) this.boss = null;
      // Graze during freeze can cross SP ready — don't wait for unfreeze to cue.
      this._pollSpReadyCue();
      // HUD flashes + legacy bursts keep living with PolishFx particles.
      if (this._lifeExtendFlash > 0) {
        this._lifeExtendFlash = Math.max(0, this._lifeExtendFlash - dt);
      }
      if (this._spReadyFlash > 0) {
        this._spReadyFlash = Math.max(0, this._spReadyFlash - dt);
      }
      if (this._phaseTelegraph > 0) {
        this._phaseTelegraph = Math.max(0, this._phaseTelegraph - dt);
      }
      this._updateParticles(dt);
      if (!this.player.alive) this.state = 'gameover';
      this._updateHud();
      return;
    }

    this.time += simDt;
    // Background / grid scroll speed (user: 2x the old 70 px/s).
    this.bgX += 140 * simDt;
    if (this._lifeExtendFlash > 0) {
      this._lifeExtendFlash = Math.max(0, this._lifeExtendFlash - simDt);
    }
    if (this._spReadyFlash > 0) {
      this._spReadyFlash = Math.max(0, this._spReadyFlash - simDt);
    }
    if (this._phaseTelegraph > 0) {
      this._phaseTelegraph = Math.max(0, this._phaseTelegraph - simDt);
    }
    if (this._itemMagnetBoost > 0) {
      this._itemMagnetBoost = Math.max(0, this._itemMagnetBoost - simDt);
    }

    this._updateStageFlow(simDt);
    if (this.state !== 'playing') return;
    if (this.stagePhase === 'waves' || this.stagePhase === 'midboss' || this.stagePhase === 'boss') {
      this._maybeSpawnPowerRecovery();
    }

    const ceremony = this._inCeremony();
    const shotCooldown = this.player.fireCooldown;
    this.player.update(simDt, this.input, this.bullets);
    this._tickSpiralBeam(simDt);
    this._tickSubBeam(simDt);
    this._drainPlayerFxEvents();
    if (this.player.buffJustGranted) {
      // Express X "Here's Your Delivery!": spell out the buff over the ship.
      this._buffBanner = { title: t('buff.deliveryTitle'), fx: t('buff.deliveryFx'), t: 0, life: 2.4 };
      this.player.buffJustGranted = null;
    }
    if (this._buffBanner) {
      this._buffBanner.t += simDt;
      if (this._buffBanner.t >= this._buffBanner.life) this._buffBanner = null;
    }
    if (this.player.missJustCommitted) this._handleMissCommit();
    this._tickSkillCamera(simDt);
    const sruns = [this.player.skillRun || this.player.skillRunTail, this.player.skillRunLeft];
    this.player.skillRunTail = null;
    for (const srun of sruns) {
      if (!srun || !srun.events.length) continue;
      // C runs deal special damage, X runs bomb damage (per-pilot multipliers).
      this._runMul = srun.kind === 'special' ? this._specialMul() : this._bombMul();
      this._runKind = srun.kind;
      // Original skill runs (skill-run.js): damage / blast / camera events.
      for (const ev of srun.events) {
        if (ev.type === 'shake') this.fx.addShake(3 + ev.mag * 3, 0.18 + ev.mag * 0.08);
        else if (ev.type === 'hitstop') this.fx.addHitstop(ev.t);
        else if (ev.type === 'damage') this._skillRunHit(ev);
        else if (ev.type === 'cue') this.audio.play(ev.key);
        else if (ev.type === 'blast') this._applyBombDamage(ev.share);
        else if (ev.type === 'flash') this.fx.addFlash(ev.t ?? 0.12);
        else if (ev.type === 'gpuFlame') {
          if (this.projectileVfx.active) this.projectileVfx.flame(ev.x, ev.y, ev.len, ev.dir || 0);
          else ev.fallback?.();
        } else if (ev.type === 'gpuSlam') {
          // GPU particle explosion (THREE layer); canvas fallback when WebGL is off.
          if (this.projectileVfx.active) this.projectileVfx.slam(ev.x, ev.y, ev.power ?? 1);
          else ev.fallback?.();
        }
        else if (ev.type === 'clearBullets') {
          // Skill-run wipe (e.g. Labiata's X slam): every enemy shot on screen goes.
          this._sparkClearedEnemyBullets();
          this.bullets.clearEnemy();
        }
        else if (ev.type === 'blastEnemy') this._applyBombDamageTo(ev.enemy, ev.scale ?? 1);
        else if (ev.type === 'sfx') this.audio.playClip?.(ev.stem);
        else if (ev.type === 'camera') {
          this._cam = this._cam || { z: 1, tz: 1, rate: 4, fx: W / 2, fy: H / 2, focus: null };
          this._cam.tz = ev.zoom;
          this._cam.rate = 1 / Math.max(0.05, ev.blend);
          this._cam.focus = ev.focus;
        }
      }
      if (srun.events.some((ev) => ev.type === 'damage' || ev.type === 'blast' || ev.type === 'blastEnemy')) {
        this.audio.play('enemyHit');
      }
      srun.events.length = 0;
      this._runMul = null;
      this._runKind = null;
    }
    const run = this.player.bombRun;
    if (run && run.events.length) {
      // Griffin Skill2: original camera shakes + per-projectile share of the blast.
      for (const ev of run.events) {
        if (ev.type === 'shake') this.fx.addShake(3 + ev.mag * 3, 0.18 + ev.mag * 0.08);
        else if (ev.type === 'sfx') this.audio.playClip?.(ev.stem);
        else if (ev.type === 'impact') {
          this._applyBombDamage(ev.share);
          this.audio.play('enemyHit');
        }
      }
      run.events.length = 0;
    }
    if (this.player.freightImpact) {
      // Express 76 Freight Shipping slam: original EventCameraShake + brief time-scale dip.
      const lv = this.player.freightImpact.level || 1;
      this.fx.addShake(4 + lv * 1.5, 0.2);
      this.fx.addHitstop(0.05);
      this.audio.play('enemyHit');
      this.player.freightImpact = null;
    }
    if (this.player.chargeFired) {
      this.audio.stopChargeHold();
      this.audio.play('charge', this.player.meta.shot?.style);
    } else {
      const charging = !!(
        this.input.shoot
        && this.player.alive
        && !this.player.isRespawning
        && this.player.charge > 0.04
      );
      this.audio.setChargeHold(charging, this.player.charge);
      if (
        this.player.tapShotFired
        || ((this.input.shoot || this.input.autoFire) && this.player.fireCooldown > shotCooldown + 0.02)
      ) {
        // Peregrinus spiral laser hums as one loop (setBeamHold below), not per volley.
        if (this.player.meta.shot?.style !== 'spiral') this.audio.play('shoot', this.player.meta.shot?.style);
      }
      this.audio.setBeamHold?.(!!this.player.beamOn && this.player.alive && !this.player.isRespawning);
    }

    for (const e of this.enemies) {
      if (ceremony) {
        // Clear cards: freeze live combat; only finish death clips.
        if (e.dying) e.tickDying(simDt);
        continue;
      }
      e.update(simDt, this.player, this.bullets);
      // Cull grunts/elites that leave the playfield; keep leaders for death anims.
      if (e.kind === 'boss' || e.kind === 'midboss' || e.dying) continue;
      // Right-edge cull only after the ship has entered: trailing rank members spawn far right.
      if (e.x < W) e._entered = true;
      if (e.x < -120 || (e._entered && e.x > W + 160) || e.y < -180 || e.y > H + 160) {
        e.alive = false;
        e.dying = false;
      }
    }

    this._tickLeaderDeath(simDt);

    // Boss / midboss HP phase change: light FX only — no PHASE tip/banner card.
    if (this.boss && this.boss.alive && (this.boss.kind === 'boss' || this.boss.kind === 'midboss')) {
      const phase = this.boss.attackPhase ?? 0;
      if (this._bossPhaseSeen >= 0 && phase > this._bossPhaseSeen) {
        // No phase-change sting (user): shmup bosses shift patterns without a cue sound.
        this.audio.setBgmIntensity?.(this.boss.kind === 'boss' ? 0.75 + phase * 0.12 : 0.55 + phase * 0.1);
        this.fx.addShake(this.boss.kind === 'boss' ? 7 : 5, 0.3);
        this.fx.addFlash(this.boss.kind === 'boss' ? 0.14 : 0.11);
        this._phaseTelegraph = 0.55;
      }
      this._bossPhaseSeen = phase;
    }

    this.bullets.update(simDt, W, H);
    this.hitFx.update(simDt);
    if (this._fade) this._fade.t += simDt;
    this._tickNamedRewards();
    if (this._enemyShot) {
      this._enemyShot = false;
      this.audio.play('enemyFire');
    }
    this._updatePowerUps(simDt);
    this._collisions();
    this._updateParticles(simDt);

    this._compactEnemies();
    this._resolveStageLeader();
    if (this.boss && !this.boss.alive && !this.boss.dying) this.boss = null;

    // One-shot when SP first crosses Lv1 — HUD glow alone was easy to miss mid-fight.
    this._pollSpReadyCue();

    if (!this.player.alive) this.state = 'gameover';

    this._updateHud();
  }

  /**
   * Wall-clock presentation under hitstop: death clips / hit flash keep reading,
   * and friendly shot delays (special salvos) don't stall mid-telegraph.
   * Enemy bullets and positions stay frozen.
   */
  _tickHitstopPresentation(dt) {
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      // Shared failsafe — freeze used to leave stuck corpses until unfreeze.
      if (e.dying) e.tickDying(dt);
    }
    for (const b of this.bullets.list) {
      if (!b.alive || !b.friendly || b.delay <= 0) continue;
      b.delay = Math.max(0, b.delay - dt);
    }
  }

  /** Edge-detect SP crossing Lv1 ready (live + hitstop graze paths). */
  _pollSpReadyCue() {
    const spReady = this.player.spReady;
    if (spReady && !this._spWasReady && this.player.alive && !this.player.isRespawning) {
      const lv = this.player.specialLevel;
      this._setSpecialNotice(t('notice.cReady', {
        lv,
        name: specialDisplayName(this.player.charKey) || this.player.specialName,
      }), 1.05);
      this.audio.play('cue');
      this._spReadyFlash = 0.7;
    }
    this._spWasReady = spReady;
  }

  _setStageIntro(seconds) {
    this.stageIntro = seconds;
    this._introPeak = seconds;
  }

  /** Soft ceiling — bomb wipe + magnet chains used to leave 30+ gradient icons. */
  _trimPowerUps() {
    const CAP = 16;
    const items = this.powerUps;
    const p = this.player;
    const px = p?.alive ? p.x : 120;
    const py = p?.alive ? p.y : H * 0.5;
    while (items.length > CAP) {
      // Prefer keeping bombs and items nearer the ship; drop far/old P first.
      let worst = 0;
      let worstScore = -Infinity;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const d2 = (it.x - px) * (it.x - px) + (it.y - py) * (it.y - py);
        const score = d2 * 0.001 + it.age * 2 + (it.type === 'bomb' ? -80 : 0);
        if (score > worstScore) {
          worstScore = score;
          worst = i;
        }
      }
      items[worst] = items[items.length - 1];
      items.pop();
    }
  }

  /** A red-marked carrier always releases its P, even at full power. */
  _tryDropPowerUp(e) {
    if (!e) return;
    if (!shouldDropPowerUp(this.player.shotLevel, e)) return;
    const item = new PowerUp(e.x, e.y, 'power');
    if (e.recoveryCarrier) {
      // A recovery offer must cross the player's lane before its 18s expiry.
      item.vx = -205;
      item.bobAmp = 12;
      this._itemMagnetBoost = Math.max(this._itemMagnetBoost, 8);
    }
    this.powerUps.push(item);
    this._trimPowerUps();
  }

  /** 전국블레이드식 B 폭탄 아이템 */
  _tryDropBomb(e) {
    if (!e) return;
    const kind = this._powerDropKind(e);
    // Space bomb drops out (feedback: too many bombs); an empty stock waits half as long.
    const gap = this.player.bombs <= 0 ? BOMB_DROP_GAP / 2 : BOMB_DROP_GAP;
    // (A retry restarts the clock: a stamp from the old run never blocks.)
    const last = this._lastBombDropAt <= this.time ? this._lastBombDropAt : -Infinity;
    if (kind !== 'midboss' && this.time - last < gap) return;
    if (!shouldDropBomb(kind, this.player.bombs, this.player.bombsMax)) return;
    this._lastBombDropAt = this.time;
    this.powerUps.push(new PowerUp(e.x + 12, e.y - 8, 'bomb'));
    this._trimPowerUps();
  }

  /**
   * @param {number} dt
   * @param {{ drift?: boolean }} [opts] drift=false during hitstop (world frozen, pickups still count)
   */
  _updatePowerUps(dt, { drift = true } = {}) {
    const p = this.player;
    const boost = this._itemMagnetBoost > 0;
    // Focus rewards careful play with a wider pull — classic Psikyo lane-control feel.
    const magnetR = boost ? 300 : (p.focus ? 168 : 125);
    const magnetPull = boost ? 1.9 : (p.focus ? 1.28 : 1);
    for (const item of this.powerUps) {
      if (drift) item.update(dt, W, H);
      if (p.alive) item.magnetToward(p, dt, magnetR, magnetPull);
      if (p.alive && item.tryPickup(p)) {
        if (item.type === 'bomb') {
          const wasEmpty = p.bombs <= 0;
          if (p.addBomb(1)) {
            this.score += 200;
            // PickupFeedback spark ring covers the beat — skip legacy burst.
            this.fx.scorePopup(p.x, p.y - 18, 200);
            // Empty → stocked is the deathbomb recovery beat players look for.
            if (wasEmpty) {
              if (p.inDeathBombWindow) {
                // Mid-grace pickup: re-arm X and flash the same cue as a fresh hit.
                this._bombLatch = false;
                this._setSpecialNotice('X · DEATHBOMB', 0.5);
              } else {
                this._setSpecialNotice(t('notice.bombRestock'), 1.05);
              }
            }
          } else {
            // Full stock — score consolation (was silent +400).
            this.score += 400;
            this.fx.scorePopup(p.x, p.y - 18, 400, { big: true });
            this._setSpecialNotice(t('notice.bombFull'), 1.0);
          }
          this.audio.play('pickupB');
          this.pickupFx.spawn('bomb', p.x, p.y);
        } else if (p.powerUpShot()) {
          this.score += 100;
          this.audio.play('pickupP');
          this._announce('levelup', 4);
          this.pickupFx.spawn('power', p.x, p.y);
          // Mirror POWER DOWN notice — Lv flash alone was easy to miss.
          this._setSpecialNotice(`POWER UP · Lv${p.shotLevel}`, 0.95);
          if (p._ramp) this._rampalionFuse();
        } else {
          // Max power — surplus P awards score.
          this.score += 500;
          this.fx.scorePopup(p.x, p.y - 18, 500, { big: true });
          this._setSpecialNotice(t('notice.powerFull'), 1.0);
          this.audio.play('pickupP');
          this.pickupFx.spawn('power', p.x, p.y);
        }
      }
    }
    // Swap-remove — avoid allocating a fresh array every magnet tick.
    let write = 0;
    const items = this.powerUps;
    for (let i = 0; i < items.length; i++) {
      if (!items[i].alive) continue;
      items[write++] = items[i];
    }
    items.length = write;
    this.pickupFx.update(dt, p.alive ? p : null);
  }

  _creditGraze(b) {
    if (!b.grazeable || b.grazed) return false;
    b.grazed = true;
    this.graze += 1;
    // Silent reward (mint ring, no chime): +100 score, +100 clear bonus
    // per graze (stage clear), and ~40 grazes fill a C level. i-frames (bomb / respawn)
    // pay score only, so skating through a ring can't farm the gauge.
    this.score += GRAZE_SCORE;
    const p = this.player;
    const skate = p.bombFlash > 0 || p.invuln > 0;
    if (!skate) this.player.addSp(GRAZE_SP);
    // Silent mint ring where the bullet slipped past (polish-fx grazeSpark).
    this.fx.grazeSpark(b.x, b.y);
    return true;
  }

  /**
   * Friendly vs enemy hit test. Cyclops beam is a long capsule matching GPU length;
   * other shots stay circular.
   */
  _friendlyHitsEnemy(b, e, hitScale = 1) {
    const er = e.hitR * hitScale;
    if (BEAM_STYLES.has(b.style)) {
      const spd = Math.hypot(b.vx, b.vy) || 1;
      const len = Math.min(b.beamLength || 360, 30 + b.age * spd);
      const ux = b.vx / spd;
      const uy = b.vy / spd;
      // Tip at bullet; beam trails opposite velocity (matches ProjectileVfx type 10).
      const tx = b.x - ux * len;
      const ty = b.y - uy * len;
      const dx = b.x - tx;
      const dy = b.y - ty;
      const seg2 = dx * dx + dy * dy || 1;
      let t = ((e.x - tx) * dx + (e.y - ty) * dy) / seg2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const cx = tx + dx * t;
      const cy = ty + dy * t;
      const rad = Math.max(b.r, 14) + er;
      const hx = e.x - cx;
      const hy = e.y - cy;
      return hx * hx + hy * hy < rad * rad;
    }
    const reach = b.r + er;
    const dx = b.x - e.x;
    if (dx > reach || dx < -reach) return false;
    const dy = b.y - e.y;
    if (dy > reach || dy < -reach) return false;
    return dx * dx + dy * dy < reach * reach;
  }

  /** Local skill shields and beam lanes erase only bullets they actually touch. */
  _friendlyClearsBullet(friendly, hostile) {
    const radius = friendly.clearRadius + hostile.r * 0.55;
    if (BEAM_STYLES.has(friendly.style)) {
      const speed = Math.hypot(friendly.vx, friendly.vy) || 1;
      const ux = friendly.vx / speed;
      const uy = friendly.vy / speed;
      const length = Math.min(friendly.beamLength || 360, 30 + friendly.age * speed);
      const dx = hostile.x - friendly.x;
      const dy = hostile.y - friendly.y;
      const along = Math.max(-length, Math.min(0, dx * ux + dy * uy));
      const px = dx - along * ux;
      const py = dy - along * uy;
      return px * px + py * py <= radius * radius;
    }
    const dx = hostile.x - friendly.x;
    const dy = hostile.y - friendly.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  /** Jupiter charge arcs toward nearby survivors after its first impact. */
  _spawnChainLinks(shot, struck) {
    if (!shot.chainCount || !shot.chainRadius) return;
    const radius2 = shot.chainRadius * shot.chainRadius;
    const targets = this.enemies.filter((enemy) => {
      if (!enemy.alive || enemy === struck) return false;
      const dx = enemy.x - struck.x;
      const dy = enemy.y - struck.y;
      return dx * dx + dy * dy <= radius2;
    }).sort((a, b) => {
      const da = (a.x - struck.x) ** 2 + (a.y - struck.y) ** 2;
      const db = (b.x - struck.x) ** 2 + (b.y - struck.y) ** 2;
      return da - db;
    }).slice(0, shot.chainCount);
    for (const target of targets) {
      const dx = target.x - struck.x;
      const dy = target.y - struck.y;
      const length = Math.hypot(dx, dy) || 1;
      this.bullets.spawn({
        x: struck.x, y: struck.y,
        vx: dx / length * 1000, vy: dy / length * 1000,
        r: 8, damage: shot.damage * 0.36, friendly: true,
        grazeable: false, charge: !!shot.charge, special: !!shot.special,
        specialLevel: shot.specialLevel || 0, style: 'chainarc',
        color: shot.color, glow: shot.glow, homing: 12, homingTarget: target,
        ignoreEnemy: struck, chainOriginX: struck.x, chainOriginY: struck.y,
        lifetime: 0.45, delay: 0.025,
      });
    }
  }

  /**
   * @param {{ worldFrozen?: boolean }} [opts]
   * worldFrozen: hitstop — skip friendly→enemy & body power-down (field paused);
   * still test enemy bullets vs ship because the player can move during the freeze.
   */
  _collisions({ worldFrozen = false } = {}) {
    const p = this.player;
    for (const b of this.bullets.list) {
      if (!b.alive || b.delay > 0) continue;

      if (b.friendly) {
        if (worldFrozen) continue;
        if (b.clearRadius > 0) {
          let sparks = 0;
          for (const hostile of this.bullets.list) {
            if (!hostile.alive || hostile.friendly || hostile.delay > 0) continue;
            if (!this._friendlyClearsBullet(b, hostile)) continue;
            hostile.alive = false;
            if (sparks++ < 5) this.fx.hitSpark(hostile.x, hostile.y, 2);
          }
        }
        // Defensive wards clear hostile bullets but never collide with or damage enemies.
        if (b.damage <= 0) continue;
        // Player shots only hit inside the visible field (beams: their shaft may still be on).
        if (!b.beamLength && !onScreen(b)) continue;
        for (const e of this.enemies) {
          if (b.ignoreEnemy === e) continue;
          // Enemies playing their DIE clip have no hitbox: shots fly straight through.
          // Enemies still off-screen (entering / leaving) can't be hit either.
          if (!e.alive || !onScreen(e)) continue;
          if (b.pierce && b._pierceHit && b._pierceHit.has(e)) continue;
          if (b.multiHit > 0) {
            const log = b._multiHitLog?.get(e);
            if (log && (b.age - log.t < b.multiHit || log.n >= b.multiHitMax)) continue;
          }
          if (!this._friendlyHitsEnemy(b, e)) continue;
          if (b.multiHit > 0) {
            // J7W heat missile: drill hit - crawl while inside (Bullet._drillUntil) so the
            // hits read; once this enemy's hit budget is spent it re-boosts and flies on.
            if (!b._multiHitLog) b._multiHitLog = new Map();
            const log = b._multiHitLog.get(e) || { t: 0, n: 0 };
            log.t = b.age;
            log.n += 1;
            b._multiHitLog.set(e, log);
            if (log.n < b.multiHitMax) b._drillUntil = b.age + 0.09;
          } else if (b.pierce) {
            if (!b._pierceHit) b._pierceHit = new Set();
            b._pierceHit.add(e);
          } else {
            b.alive = false;
          }
          const marked = p.charKey === 'constantia' && e.boriMarkedFor > 0
            && b.style !== 'bori' && !b.special ? 1.2 : 1;
          // Merlin UNREP +10%; Express 76 "Here's Your Delivery!" buff (from X) is ATK +20%.
          const unrep = p.unrepFor > 0 && !b.special
            ? (p.charKey === 'express76' ? 1.2 : p.charKey === 'merlin' ? 1.1 : 1) : 1;
          // Courier Invoice (Express C): the tagged enemy takes +20% from Express shots.
          const invoiced = p.charKey === 'express76' && e.invoiceFor > 0 && !b.special ? 1.2 : 1;
          // Per-pilot P-level growth (meta.lvDmg[lv]) keeps each role's DPS tier at every level.
          const lvMul = this.player.meta?.lvDmg?.[this.player.shotLevel | 0] ?? 1;
          // C projectiles carry the pilot's special multiplier (Lv5-fire DPS floor).
          const spMul = b.special ? this._specialMul() : 1;
          const hitDamage = b.damage * marked * unrep * invoiced * lvMul * spMul;
          if (b.invoiceDuration > 0) e.invoiceFor = Math.max(e.invoiceFor || 0, b.invoiceDuration);
          if (b.knockback > 0) {
            // Freight Shipping push-back; leaders barely budge so phases stay intact.
            const leader = e.kind === 'boss' || e.kind === 'midboss';
            e.knockVx = Math.max(e.knockVx || 0, b.knockback * (leader ? 0.15 : 1) * 9);
          }
          if (b.markDuration > 0) {
            e.boriMarkedFor = Math.max(e.boriMarkedFor || 0, b.markDuration);
            e.boriRootFor = Math.max(e.boriRootFor || 0,
              b.rootDuration * (e.kind === 'boss' || e.kind === 'midboss' ? 0.55 : 1));
          }
          const dealt = Math.min(hitDamage, Math.max(0, e.hp));
          const killed = e.damage(hitDamage);
          if (b.chainCount > 0) this._spawnChainLinks(b, e);
          // 특수탄 피해로는 게이지 미충전 (풀바 소모 후 즉시 재충전 방지)
          // Pierce lane chips used to bank nearly a free C through a pack before kill bonuses.
          if (!b.special && dealt > 0) {
            // Leaders soak damage continuously: half rate so a boss fight doesn't refill the gauge.
            const leaderHit = e.kind === 'boss' || e.kind === 'midboss';
            this.player.addSp(dealt * (b.pierce ? 0.75 : 1.35) * (leaderHit ? 0.5 : 1));
          }
          if (killed) {
            this.bullets.nativeEffects?.emit(b, 'impact', e);
            if (hasHitRecipe(b.style)) this.hitFx.spawn(b, b.x, b.y, true);
            else this.projectileVfx.impact(b);
            // The killing hit sounds like any other hit (no separate kill sound, user).
            this.audio.play('enemyHit', b.style);
            if (!b.special) this.player.addSp(6);
            const bossLike = e.kind === 'boss' || e.kind === 'midboss';
            const comboBonus = this.fx.noteKill(e.score, e.x, e.y, { boss: bossLike });
            this.score += e.score + comboBonus;
            // PolishFx.noteKill already owns the explosion — legacy burst doubled fill.
            this._tryDropPowerUp(e);
            this._tryDropBomb(e);
          } else {
            // Pierce packs used to stamp impact+hit SFX on every contact in a lane.
            const fxGap = b.pierce ? 0.045 : 0;
            const due = !fxGap || !b._pierceFx || (this._fxClock - b._pierceFx) >= fxGap;
            if (due) {
              // Missiles (X-36 / Griffin P-38 sub) burst on impact. Peregrinus human-form X-36
              // bursts are small (user): they buried the spiral beam's own green hit.
              if (b.style === 'x36missile') this._spawnSheetFx('lao-fx-airboom', b.x, b.y, 40, 0.3, 'source-over', { alpha: 0.75 });
              else if (b.style === 'p38missile') this._spawnSheetFx('lao-fx-airboom', b.x, b.y, 78, 0.42);
              this.bullets.nativeEffects?.emit(b, 'impact', e);
              // Basic shots with an original hit sheet (hit-fx.js) skip the shared white glint
              // and particle burst, so each pilot's hit reads as its own.
              const ownHit = hasHitRecipe(b.style);
              if (ownHit) this.hitFx.spawn(b, b.x, b.y);
              else this.projectileVfx.impact(b);
              // Hit sound by projectile class (bullet / missile / energy / slash / magic / impact).
              this.audio.play('enemyHit', b.style);
              if (ownHit) { if (this.fx.shake < 0.03) this.fx.addShake(0.9, 0.045); }
              else if (b.nativeKey !== 'lrl' && b.nativeKey !== 'lrl-axe') this.fx.noteHit(b.x, b.y);
              if (b.pierce) b._pierceFx = this._fxClock;
            }
          }
          if (b.blastRadius > 0) {
            for (const nearby of this.enemies) {
              if (!nearby.alive || nearby === e || !onScreen(nearby)) continue;
              const dx = nearby.x - e.x;
              const dy = nearby.y - e.y;
              if (dx * dx + dy * dy > b.blastRadius * b.blastRadius) continue;
              const splash = b.damage * 0.45;
              if (nearby.damage(splash)) {
                const comboBonus = this.fx.noteKill(nearby.score, nearby.x, nearby.y);
                this.score += nearby.score + comboBonus;
                this._tryDropPowerUp(nearby);
                this._tryDropBomb(nearby);
              } else {
                this.fx.noteHit(nearby.x, nearby.y);
              }
            }
          }
          if (!b.pierce) break;
        }
      } else if (p.alive && !p.isRespawning && !this._inCeremony()) {
        // Hurt point = body centre of the sprite (hitX / hitY, per pilot).
        const dx = b.x - p.hitX;
        const dy = b.y - p.hitY;
        const dist2 = dx * dx + dy * dy;
        const hitR = p.hitR + b.r * 0.55;
        if (dist2 < hitR * hitR) {
          // i-frames: pass through — absorbing every contact vacuumed the pattern.
          if (p.invuln > 0) {
            // Still credit graze for bullets that phase through the core.
            // `continue` used to skip the graze branch entirely during invuln.
            // Skip during hitstop — skating through a frozen screen farmed SP/score.
            if (!worldFrozen) this._creditGraze(b);
            continue;
          }
          b.alive = false;
          { const struck = p.hit(); if (struck === 'shield') this._onRampalionShieldHit(); else if (struck === 'armor') this._onRampalionArmorHit(); else if (struck) this._onPlayerStruck(); }
        } else if (!worldFrozen && dist2 < (p.hitR + 28) ** 2) {
          // Live field only — frozen bullets aren't a graze vacuum.
          this._creditGraze(b);
        }
      }
    }

    // Leader area attacks (lasers / lightning / meteors / spikes): live area hits the hurt point.
    if (!worldFrozen && p.alive && !p.isRespawning && p.invuln <= 0 && !this._inCeremony()) {
      for (const e of this.enemies) {
        if (!e.alive || e.dying || !e.hazards?.length) continue;
        if (e.hazards.some((h) => hazardHits(h, p.hitX, p.hitY, p.hitR))) {
          { const struck = p.hit(); if (struck === 'shield') this._onRampalionShieldHit(); else if (struck === 'armor') this._onRampalionArmorHit(); else if (struck) this._onPlayerStruck(); }
          break;
        }
      }
    }

    // 전국블레이드식: 몸체 접촉 = 파워 다운 (미스/잔기 감소 아님)
    // Live field only — skating a frozen sprite during hitstop felt like lag-punish.
    // Bullets above still resolve (player chose to move into a parked hazard).
    if (!worldFrozen && p.alive && !p.isRespawning && p.invuln <= 0 && !this._inCeremony()) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - p.hitX;
        const dy = e.y - p.hitY;
        // Body-contact uses a tighter fraction of sprite hitR so full-image
        // damage boxes don't make grazing power-downs unfair.
        if (!p.godMode && dx * dx + dy * dy < (e.hitR * 0.38 + p.hitR) ** 2) {
          const lost = p.powerDownShot();
          if (lost) this._powerRecoveryDueAt = Math.min(this._powerRecoveryDueAt, this.time + 5.5);
          // Body check is a combat interrupt — same combo break as a bullet clip.
          this._breakCombo();
          this.audio.play('powerDown');
          this._setSpecialNotice(lost ? `POWER DOWN · Lv${p.shotLevel}` : t('notice.bodyKeep'), 0.95);
          // hitSpark owns the chip glitter — legacy burst was a second particle storm.
          this.fx.hitSpark(p.x, p.y, lost ? 8 : 4);
          this.fx.addShake(lost ? 3.5 : 2, 0.12);
          // The next eligible wave supplies a marked recovery carrier instead
          // of randomly gifting a P at the collision point.
          break;
        }
      }
    }
  }

  _spawnBurst(x, y, n) {
    // Legacy light burst — death accents / special trails. Combat kills use PolishFx.
    const count = Math.min(n, 12);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.3,
        color: `hsl(${20 + Math.random() * 40},100%,70%)`,
      });
    }
    // Drop oldest without O(n) splice when the legacy pool spikes.
    const list = this.particles;
    while (list.length > 80) {
      list[0] = list[list.length - 1];
      list.pop();
    }
  }

  /** 폭탄: 적탄 소거 파티클 (전국블레이드식 넓은 긴급 회피 피해) */
  _onBombFired() {
    if (this._seg) this._seg.bombsUsed += 1;
    // Original-skill bombs play their own Unity SFX from the run timeline.
    if (!this.player.bombRun && !this.player.skillRun && !this.player.hBomb) {
      this.audio.play('bomb', { style: this.player.meta.shot?.style, char: this.charKey });
    }
    this.fx.noteBomb();
    // Spark then recycle — clear used to run inside tryBomb before FX could read positions.
    this._sparkClearedEnemyBullets();
    this.bullets.clearEnemy();
    this._spawnBombFx();
    // Griffin's original Skill2 run delivers the blast through its 8 projectiles
    // (1/8 each on landing, see griffin-skill.js); everyone else resolves now.
    if (this.player.bombRun || this.player.skillRun?.kind === 'bomb' || this.player.hBomb) return;
    this._applyBombDamage(1);
  }

  /**
   * Spiral Laser (Peregrinus human form): while the beam is on (not while collapsing),
   * every `tick` s each on-screen enemy touching the straight band takes damage - pierces.
   */
  /** Particles for a leader area attack going live (sparks / dust / debris by kind). */
  _hazardImpact(h) {
    const sfx = h.kind === 'bolt' && h.style ? { girder: 'hz:girder', tape: 'hz:tape', swoop: 'hz:swoop' }[h.style]
      : { meteor: 'hz:meteor', beam: 'hz:beam', bolt: 'hz:bolt', spike: 'hz:spike', column: 'hz:column',
        sigil: 'hz:sigil', cone: 'hz:cone' }[h.kind];
    if (sfx) this.audio.play(sfx);
    const fx = this.fx;
    const sparks = (x, y, n) => fx.hitSpark(x, y, n);
    if (h.kind === 'column') {
      this._spawnSheetFx('lao-fx-groundsmoke', h.x, H - h.w * 0.55, h.w * 2.6, 0.7, 'source-over', { alpha: 0.85 });
      fx.addShake(2.5, 0.1);
    } else if (h.kind === 'spike') {
      this._spawnSheetFx('lao-fx-shockring', h.x, h.y + h.r * 0.2, h.r * 3, 0.32, 'lighter', { h: h.r * 1.2 });
    }
    if (h.kind === 'meteor') {
      // Original-texture blast: round air burst + smoke, a flame plume thrown up, a flat
      // shock ring and dark smog, on top of the particle explosion.
      const r = h.r;
      this._spawnSheetFx('lao-fx-airboom', h.x, h.y - r * 0.15, r * 3.6, 0.75);
      this._spawnSheetFx('lao-fx-flameburst', h.x, h.y - r * 0.55, r * 2.6, 0.55, 'lighter');
      this._spawnSheetFx('lao-fx-shockring', h.x, h.y, r * 3.4, 0.38, 'lighter', { h: r * 1.5 });
      this._spawnSheetFx('lao-fx-smog', h.x + r * 0.2, h.y - r * 0.3, r * 2.8, 1.0, 'source-over', { alpha: 0.75 });
      fx.explosion(h.x, h.y, Math.max(0.9, h.r / 40));
      fx.addShake(5, 0.16);
    } else if (h.kind === 'bolt') {
      // Along the bolt: a few strike points; girders land with a heavy thud.
      for (let i = 1; i <= 3; i++) {
        const u = i / 4;
        sparks(h.x0 + (h.x1 - h.x0) * u, h.y0 + (h.y1 - h.y0) * u, h.style === 'tape' ? 3 : 5);
      }
      if (h.style === 'girder') { fx.explosion(h.x1, Math.min(h.y1, H) - 12, 0.9); fx.addShake(3, 0.1); }
    } else if (h.kind === 'beam') {
      sparks(h.x, h.y, 7);
    } else if (h.kind === 'cone') {
      sparks(h.x - 20, h.y, 8);
    } else if (h.kind === 'spike') {
      sparks(h.x, h.y - h.r * 0.6, 5);
    } else if (h.kind === 'column') {
      sparks(h.x, h.top + 8, 6);
      fx.explosion(h.x, H - 14, 0.8);
    } else if (h.kind === 'sigil') {
      // Curse eruption in the sigil's own (rose / violet) palette, no fire sheet.
      fx._blastLayers(h.x, h.y, 1.1, 'rose');
      sparks(h.x, h.y, 6);
    }
  }

  /** Rampalion hit above power Lv1: one level (and the fusion) lost instead of the only life. */
  _onRampalionArmorHit() {
    const p = this.player;
    const broken = p._ramp?.lastArmorBreak || null;
    this._breakCombo();
    this.audio.play('playerHit');
    this.audio.play('powerDown');
    this.audio.stopChargeHold();
    this.fx.hitSpark(p.x, p.y, 10);
    this.fx.addShake(4, 0.16);
    this._setSpecialNotice(broken
      ? `파츠 이탈! ${RAMPALION_ROBOTS[broken.robot].name} ${broken.opt.partName} · POWER Lv${p.shotLevel}`
      : `장갑 피격 · POWER Lv${p.shotLevel}`, 1.3);
    // Stage 1 only (Rampalion rule): the supply convoy may answer the lost level.
    if (this.stageIndex === 0) this._powerRecoveryDueAt = Math.min(this._powerRecoveryDueAt, this.time + 5.5);
    if (p.shotLevel <= 1) this._setSpecialNotice(`합체 해제! 다음 피격 시 격파 · POWER Lv1`, 1.6);
    this._updateHud?.();
  }

  /** Rampalion's Tyrant-head shield took the hit: it breaks, nothing else is lost. */
  _onRampalionShieldHit() {
    const p = this.player;
    this.audio.play('playerHit');
    this.audio.play('hz:bolt');
    this.fx.hitSpark(p.x, p.y, 12);
    this.fx.addShake(3, 0.14);
    this._setSpecialNotice('보호막 파괴! 60초 후 재생성', 1.4);
  }

  /** Rampalion level-up: a random robot flies in to graft its part onto the next location. */
  _rampalionFuse() {
    return rampFuse(this.player, () => gameplayRng());
  }

  /** Docking cues from rampalion.js (robot launched / part grafted). */
  _onRampalionEvent(type, d) {
    const p = this.player;
    if (type === 'dockStart') {
      this.audio.play('cue');
      this._setSpecialNotice(`${d.robot.name} 합체 개시! → ${d.slot.label}`, 1.0);
    } else if (type === 'dockDone') {
      this.fx.hitSpark(p.x, p.y, 14);
      this.fx.addShake(3, 0.2);
      this.audio.play('pickupP');
      this._setSpecialNotice(`합체! ${d.slot.label}에 ${d.opt.partName} 장착 · ${d.formName}`, 1.8);
    } else if (type === 'shieldUp') {
      this.audio.play('pickupB');
      this._setSpecialNotice('보호막 재생성!', 1.2);
    }
  }

  /** The ship was struck (bullet or leader area attack): combo break, cues, deathbomb window. */
  _onPlayerStruck() {
    const p = this.player;
    // Impact sting only — life / stageHits commit after deathbomb grace fails.
    // Bullets stay on screen (classic shmup); X bomb clears if deathbomb succeeds.
    // Clip breaks combo immediately — deathbomb must not preserve a phantom chain.
    this._breakCombo();
    this.audio.play('playerHit');
    this.audio.stopChargeHold();
    this.fx.notePlayerHit(p.x, p.y);
    // notePlayerHit owns shatter sparks + shake — skip legacy burst double-up.
    // Prompt immediately — the grace is short and easy to miss without a cue.
    this._bombLatch = false;
    if (p.bombs > 0) {
      this._setSpecialNotice('X · DEATHBOMB', 0.5);
    } else {
      this._setSpecialNotice(t('notice.noBombWindow'), 0.95);
    }
    // Held / queued X after prior deny still counts once the window opens.
    if (this._bombQueued || this.input.bomb) {
      this._bombQueued = false;
      if (this.player.tryDeathBomb(this.bullets)) {
        if (this._seg) this._seg.deathbombs += 1;
        this._onBombFired();
        this._itemMagnetBoost = Math.max(this._itemMagnetBoost, 1.6);
        this._setSpecialNotice(t('notice.deathbombKeep'), 1.1);
      } else if (this.player.bombs <= 0) {
        this.audio.play('deny'); this._announce('notready', 2, 4);
      }
      this._bombLatch = true;
    }
  }

  _tickSpiralBeam(dt) {
    const p = this.player;
    const c = p?._beamCfg;
    if (!c || !p.beamOn) {
      if (p) p._beamTick = 0;
      return;
    }
    p._beamTick = (p._beamTick || 0) - dt;
    if (p._beamTick > 0) return;
    p._beamTick += c.tick;
    const x0 = p.beamX;
    const x1 = x0 + (W + 40 - x0) * (p.beamGrow || 0);
    const half = c.width * (p.beamWidthMul || 1);
    for (const e of this.enemies) {
      if (!e.alive || e.dying || !onScreen(e)) continue;
      const er = e.hitR || 20;
      if (e.x + er < x0 || e.x - er > x1 || Math.abs(e.y - p.y) > half + er) continue;
      // Main weapon (not a C): no special multiplier.
      this._skillRunHit({ target: e, x: e.x, y: e.y, amount: p.beamDamage || 1, raw: true, hitStyle: 'spiralbeam', beamY: p.y });
    }
  }

  /**
   * Enemy bullets crossing the player's own beam (Peregrinus spiral laser / Express sub laser)
   * get a dark backing disc so they stay readable over the additive glow (user).
   */
  _drawBeamBulletBacking(ctx) {
    const p = this.player;
    const bands = [];
    if (p.beamGrow > 0 && p._beamCfg) bands.push([p.beamX, p.y, p._beamCfg.glowWidth * (p.beamWidthMul || 1)]);
    if (p._subBeam && p.subBeamOpen > 0) for (const q of p.subBeamPoints()) bands.push([q.x, q.y, p._subBeam.half * 4.2]);
    if (!bands.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(8, 4, 14, 0.62)';
    ctx.beginPath();
    for (const b of this.bullets.list) {
      if (!b.alive || b.friendly) continue;
      for (const [x0, y, hw] of bands) {
        if (b.x > x0 - 10 && Math.abs(b.y - y) < hw + (b.r || 5)) {
          const rr = (b.r || 5) * 1.7 + 2;
          ctx.moveTo(b.x + rr, b.y);
          ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
          break;
        }
      }
    }
    ctx.fill();
    ctx.restore();
  }

  /** Express 76 sub laser: piercing damage ticks (0.05 s) along the beam band. */
  _tickSubBeam(dt) {
    const p = this.player;
    const sb = p?._subBeam;
    if (!sb) { if (p) p._subBeamTick = 0; return; }
    p._subBeamTick = (p._subBeamTick || 0) - dt;
    if (p._subBeamTick > 0) return;
    p._subBeamTick += 0.05;
    if (!sb._sfx) { sb._sfx = true; this.audio.play('laserFire'); }
    let hit = false;
    // One band per muzzle (Express nose, or Rampalion's two Roc wing tips).
    for (const q of p.subBeamPoints()) {
      const x0 = q.x + 6;
      const y = q.y;
      for (const e of this.enemies) {
        if (!e.alive || e.dying || !onScreen(e)) continue;
        const er = e.hitR || 20;
        if (e.x + er < x0 || Math.abs(e.y - y) > sb.half + er) continue;
        this._skillRunHit({ target: e, x: e.x, y: e.y, amount: sb.dmg, raw: true, hitStyle: 'expresslaser', beamY: y });
        hit = true;
      }
    }
    if (hit) this.audio.play('enemyHit', 'pancakelaser');
  }

  /**
   * Events queued by the player's own timelines (Peregrinus human-form X): original SFX,
   * camera shakes, and the bomb damage split over the clip's EventHits (+ green hit glow).
   */
  _drainPlayerFxEvents() {
    const q = this.player.fxEvents;
    if (!q || !q.length) return;
    for (const ev of q) {
      if (ev.type === 'sfx') this.audio.playClip?.(ev.stem);
      else if (ev.type === 'shake') this.fx.addShake(3 + ev.mag * 3, 0.18 + ev.mag * 0.08);
      else if (ev.type === 'hskill1') this._humanSkill1Event(ev);
      else if (ev.type === 'band' || ev.type === 'hitList') {
        // Peregrinus X: only enemies the beam band / diving body actually touch.
        const hit = ev.type === 'hitList' ? ev.list : this.enemies.filter((e) => e.alive && !e.dying
          && onScreen(e) && e.x > ev.x && Math.abs(e.y - ev.y) <= ev.half + (e.hitR || 20));
        for (const e of hit) {
          if (!e.alive) continue;
          this._spawnSheetFx('peregrinus-fx-glow', e.x, e.y, 150, 0.4, 'lighter');
          this._applyBombDamageTo(e, ev.share);
        }
        if (hit.length) this.audio.play('enemyHit');
      }
      else if (ev.type === 'blast') {
        for (const e of this.enemies) {
          if (e.alive && !e.dying && onScreen(e)) this._spawnSheetFx('peregrinus-fx-glow', e.x, e.y, 150, 0.4, 'lighter');
        }
        this._applyBombDamage(ev.share);
        this.audio.play('enemyHit');
      }
    }
    q.length = 0;
  }

  /**
   * Peregrinus human-form C (Skill 1 jump & dive): take-off dust, dive streak, and the
   * landing slam - area damage, enemy bullets cleared round it, shock ring + blast.
   */
  _humanSkill1Event(ev) {
    if (ev.phase === 'jump') {
      this._spawnSheetFx('lao-fx-groundsmoke', ev.x, ev.y, 150, 0.45, 'source-over', { h: 90, alpha: 0.8 });
      this._spawnSheetFx('peregrinus-fx-ring', ev.x, ev.y, 120, 0.3, 'lighter', { h: 60, rot: -Math.PI / 2 });
      this.audio.play('missileLaunch');
      return;
    }
    if (ev.phase === 'dive') {
      const ang = Math.atan2(ev.ty - ev.y, ev.tx - ev.x);
      const len = Math.hypot(ev.tx - ev.x, ev.ty - ev.y);
      // Dive streak: the round glow stretched along the path.
      this._spawnSheetFx('peregrinus-fx-glow', (ev.x + ev.tx) / 2, (ev.y + ev.ty) / 2, len + 80, 0.22, 'lighter',
        { h: 46, rot: ang, alpha: 0.9 });
      this._spawnSheetFx('peregrinus-fx-glow', ev.x, ev.y, 140, 0.2, 'lighter');
      return;
    }
    if (ev.phase !== 'impact') return;
    const r = ev.r || 160;
    this._spawnSheetFx('lao-fx-shockring', ev.x, ev.y + 10, r * 2.6, 0.42, 'lighter', { h: r * 1.15 });
    this._spawnSheetFx('lao-fx-airboom', ev.x, ev.y, r * 1.5, 0.5, 'lighter');
    this._spawnSheetFx('peregrinus-fx-glow', ev.x, ev.y, r * 1.6, 0.35, 'lighter');
    this._spawnSheetFx('lao-fx-groundsmoke', ev.x, ev.y + 20, r * 2.2, 0.6, 'source-over', { h: r, alpha: 0.75 });
    this.fx.addShake(9, 0.32);
    this.fx.addFlash?.(0.08);
    this.audio.play('leaderBlast');
    // Enemy bullets inside the slam are wiped.
    for (const b of this.bullets.list) {
      if (!b.alive || b.friendly) continue;
      if ((b.x - ev.x) ** 2 + (b.y - ev.y) ** 2 <= (r * 1.1) ** 2) b.alive = false;
    }
    let hit = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.dying || !onScreen(e)) continue;
      const er = e.hitR || 20;
      if ((e.x - ev.x) ** 2 + (e.y - ev.y) ** 2 > (r + er) ** 2) continue;
      const bossLike = e.kind === 'boss' || e.kind === 'midboss';
      const killed = e.damage(ev.amount * (bossLike ? (ev.leaderScale ?? 0.6) : 1));
      hit += 1;
      this._spawnSheetFx('lao-fx-airboom', e.x, e.y, 96, 0.3, 'lighter');
      if (killed) {
        const comboBonus = this.fx.noteKill(e.score, e.x, e.y, { boss: bossLike });
        this.score += e.score + comboBonus;
        this._tryDropPowerUp(e);
        this._tryDropBomb(e);
      } else {
        this.fx.noteHit(e.x, e.y);
        if (e.knockVx !== undefined || !bossLike) e.knockVx = Math.max(e.knockVx || 0, bossLike ? 0 : 260);
      }
    }
    if (hit) this.audio.play('enemyHit', 'heavy');
  }

  /** Short-lived sprite-sheet bursts in the world (pooled; capped so volleys stay cheap). */
  _spawnSheetFx(key, x, y, size, dur, blend = 'source-over', opts = null) {
    const list = (this._sheetFx ||= []);
    let f = list.find((q) => q.age >= q.dur);
    if (!f) {
      if (list.length >= 24) return;
      f = {};
      list.push(f);
    }
    f.key = key;
    f.x = x;
    f.y = y;
    f.size = size;
    f.dur = dur;
    f.age = 0;
    f.t0 = this._fxClock;
    f.blend = blend;
    f.h = opts?.h ?? size;
    f.rot = opts?.rot ?? 0;
    f.alpha = opts?.alpha ?? 1;
  }

  /** Buff banner above the ship (Express X): rises in, holds, fades. */
  _drawBuffBanner(ctx) {
    const b = this._buffBanner;
    if (!b) return;
    const p = this.player;
    const k = b.t / b.life;
    const a = Math.min(1, b.t / 0.15) * (k > 0.75 ? (1 - k) / 0.25 : 1);
    const x = Math.max(150, Math.min(W - 150, p.x));
    const y = Math.max(70, p.y - 78 - Math.min(1, b.t / 0.25) * 14);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = '800 20px "Chakra Petch", "Noto Sans KR", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(30, 14, 0, 0.9)';
    ctx.strokeText(b.title, x, y);
    ctx.fillStyle = '#ffd36a';
    ctx.fillText(b.title, x, y);
    ctx.font = '700 14px "Chakra Petch", "Noto Sans KR", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText(b.fx, x, y + 22);
    ctx.fillStyle = '#fff4d6';
    ctx.fillText(b.fx, x, y + 22);
    ctx.restore();
  }

  _syncFadeLayer() {
    let el = this._fadeEl;
    const v = this._fadeValue();
    if (!el) {
      if (v <= 0.001) return;
      el = this._fadeEl = document.createElement('div');
      el.className = 'stage-fade';
      document.getElementById('app')?.appendChild(el);
    }
    const o = String(Math.round(v * 1000) / 1000);
    if (el.style.opacity !== o) el.style.opacity = o;
  }

  /** Metal Slug-style clear tally panel (canvas). */
  _drawTally(ctx) {
    const T = this._tally;
    if (!T || (this.stagePhase !== 'tally' && this.stagePhase !== 'exit')) return;
    const a = Math.min(1, T.t / 0.35) * (this.stagePhase === 'exit' ? Math.max(0, (this.stageWait - 0.9) / 0.7) : 1);
    if (a <= 0) return;
    const w = 460;
    const rowH = 34;
    const h = 108 + T.rows.length * rowH + 52;
    const x = (W - w) / 2;
    const y = Math.max(40, (H - h) / 2 - 20);
    const xferAt = TALLY_REVEAL0 + T.rows.length * TALLY_REVEAL_GAP + 0.35;
    const active = T.t >= xferAt && !T.xferDone ? T.rows.find((q) => q.left > 0) : null;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6, 10, 18, 0.86)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 214, 120, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#ffcf5a';
    ctx.fillRect(x, y, w, 4);
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const stageNo = Math.min(this.stageIndex + 1, this.stages.length);
    const title = this._clearIsFinale ? 'ALL CLEAR' : `STAGE ${stageNo} CLEAR`;
    ctx.font = 'bold 34px "Chakra Petch", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(20, 12, 2, 0.9)';
    ctx.strokeText(title, W / 2, y + 46);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(title, W / 2, y + 46);
    ctx.font = 'bold 19px "Chakra Petch", "Noto Sans KR", sans-serif';
    T.rows.forEach((r, i) => {
      if (!r.shownUp) return;
      const ry = y + 100 + i * rowH;
      const shownAt = TALLY_REVEAL0 + i * TALLY_REVEAL_GAP;
      ctx.globalAlpha = a * Math.min(1, (T.t - shownAt) / 0.12 + 0.2);
      const isActive = r === active;
      if (isActive) {
        // The line being paid out glows.
        ctx.fillStyle = 'rgba(255, 214, 120, 0.12)';
        ctx.fillRect(x + 18, ry - rowH / 2 + 2, w - 36, rowH - 4);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = r.left > 0 ? '#cfe2f5' : '#7d8ea3';
      ctx.fillText(r.label + (r.note ? `  ${r.note}` : ''), x + 34, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = isActive ? '#ffffff' : r.left > 0 ? '#ffd65a' : '#6f7f92';
      ctx.fillText(String(r.left ?? r.value), x + w - 34, ry);
    });
    if (T.t >= xferAt - 0.2) {
      ctx.globalAlpha = a;
      const ty = y + h - 34;
      ctx.fillStyle = 'rgba(255, 214, 120, 0.5)';
      ctx.fillRect(x + 28, ty - 24, w - 56, 1);
      ctx.font = 'bold 24px "Chakra Petch", "Noto Sans KR", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('TOTAL', x + 34, ty);
      ctx.textAlign = 'right';
      // Final total pulses once the last line is in.
      const pulse = T.xferDone ? 1 + 0.12 * Math.max(0, 1 - (T.t - T.xferDone) / 0.35) : 1;
      ctx.save();
      ctx.translate(x + w - 34, ty);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = T.xferDone ? '#fff2a8' : '#ffcf5a';
      ctx.fillText(String(T.totalShown ?? 0), 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawSheetFx(ctx) {
    const list = this._sheetFx;
    if (!list) return;
    for (const f of list) {
      f.age = this._fxClock - f.t0;
      if (f.age >= f.dur) continue;
      drawSheetAt(ctx, f.key, f.age / f.dur, f.x, f.y, f.size, f.h ?? f.size,
        { blend: f.blend, rot: f.rot, alpha: (f.alpha ?? 1) * (f.blend === 'lighter' ? Math.sin((f.age / f.dur) * Math.PI) : 1) });
    }
  }

  /** Ease the skill-run camera toward its target zoom; release when no run is active. */
  _tickSkillCamera(dt) {
    const cam = this._cam;
    if (!cam) return;
    const run = this.player.skillRun;
    if (!run) cam.tz = 1;
    const q = run ? (cam.focus === 'target' ? { x: run.tx, y: run.ty } : runPos(this.player, run)) : null;
    if (q) {
      // Keep the focus inside the frame so the zoom never exposes the canvas edge.
      cam.fx += (Math.max(0, Math.min(W, q.x)) - cam.fx) * Math.min(1, dt * 6);
      cam.fy += (Math.max(0, Math.min(H, q.y)) - cam.fy) * Math.min(1, dt * 6);
    }
    cam.z += (cam.tz - cam.z) * Math.min(1, dt * cam.rate * 3);
    if (!run && Math.abs(cam.z - 1) < 0.001) cam.z = 1;
  }

  /** Full bomb blast on one enemy (Sleipnir's charge hits whatever it crosses). */
  _applyBombDamageTo(e, scale = 1) {
    if (!e || !e.alive) return;
    const bossLike = e.kind === 'boss' || e.kind === 'midboss';
    const killed = e.damage((bossLike ? 22 : 40) * scale * (this._runMul ?? this._bombMul())
      * (bossLike && (this._runKind ?? 'bomb') === 'bomb' ? LEADER_BOMB_SCALE : 1));
    if (killed) {
      const comboBonus = this.fx.noteKill(e.score, e.x, e.y, { boss: bossLike, soft: true });
      this.score += e.score + comboBonus;
      this.player.addSp(3);
      this._tryDropPowerUp(e);
      this._tryDropBomb(e);
    } else {
      this.fx.noteHit(e.x, e.y);
      e.fireTimer = Math.max(e.fireTimer, bossLike ? 0.85 : 0.65);
    }
  }

  /**
   * Damage multipliers for C (special) and X (bomb): per pilot in CHAR_META (specialMul /
   * bombMul; the human form has its own bombMul). User rule: every C level and the X out-DPS
   * Lv5 normal fire (tools/eval-bomb-dps.mjs).
   */
  _specialMul() {
    return this.player.meta?.specialMul ?? 1;
  }

  _bombMul() {
    return this.player.meta?.bombMul ?? 1;
  }

  /** Skill-run C hit: damage one enemy (the run target, else the nearest to the hit). */
  _skillRunHit(ev) {
    let e = ev.target && ev.target.alive ? ev.target : null;
    if (!e) {
      let best = 150 * 150;
      for (const c of this.enemies) {
        if (!c.alive) continue;
        const d = (c.x - ev.x) ** 2 + (c.y - ev.y) ** 2;
        if (d < best) { best = d; e = c; }
      }
    }
    if (!e) return;
    if (ev.sfx && !ev.quiet) this.audio.play('enemyHit', ev.sfx);
    if (ev.invoice) e.invoiceFor = Math.max(e.invoiceFor || 0, ev.invoice);
    if (ev.knockback) {
      const leader = e.kind === 'boss' || e.kind === 'midboss';
      e.knockVx = Math.max(e.knockVx || 0, ev.knockback * (leader ? 0.15 : 1) * 9);
    }
    const leaderBomb = !ev.raw && this._runKind === 'bomb' && (e.kind === 'boss' || e.kind === 'midboss');
    const killed = e.damage(ev.amount * (ev.raw ? 1 : (this._runMul ?? this._specialMul()))
      * (leaderBomb ? LEADER_BOMB_SCALE : 1));
    if (killed) {
      if (!ev.sfx) this.audio.play('enemyHit', ev.hitStyle || '');
      const bossLike = e.kind === 'boss' || e.kind === 'midboss';
      const comboBonus = this.fx.noteKill(e.score, e.x, e.y, { boss: bossLike });
      this.score += e.score + comboBonus;
      this._tryDropPowerUp(e);
      this._tryDropBomb(e);
    } else if (ev.hitStyle && hasHitRecipe(ev.hitStyle)) {
      // Beam contact: the burst sits where the beam meets the body, not at its centre.
      const er = e.hitR || 20;
      const hy = Math.max(e.y - er * 0.6, Math.min(e.y + er * 0.6, ev.beamY ?? e.y));
      this.hitFx.spawn({ style: ev.hitStyle, vx: 1, vy: 0, powerLevel: this.player.shotLevel }, e.x - er * 0.7, hy);
      if (this.fx.shake < 0.03) this.fx.addShake(0.9, 0.045);
    } else {
      this.fx.noteHit(e.x, e.y);
    }
  }

  /** Bomb blast: pack 40 / leader 22, scaled (Griffin splits it across projectile hits). */
  _applyBombDamage(scale = 1) {
    // Leaders stay chip (below C Lv3 pierce farming); packs wipe so X reads as emergency clear.
    let survivorFx = 0;
    for (const e of this.enemies) {
      if (!e.alive || !onScreen(e)) continue;
      const bossLike = e.kind === 'boss' || e.kind === 'midboss';
      const blastDmg = (bossLike ? 22 : 40) * scale * (this._runMul ?? this._bombMul())
        * (bossLike && (this._runKind ?? 'bomb') === 'bomb' ? LEADER_BOMB_SCALE : 1);
      const dealt = Math.min(blastDmg, Math.max(0, e.hp));
      const killed = e.damage(blastDmg);
      if (killed) {
        const comboBonus = this.fx.noteKill(e.score, e.x, e.y, { boss: bossLike, soft: true });
        this.score += e.score + comboBonus;
        // Half of a gun-kill — X pack wipes used to bank a free C from SP alone.
        this.player.addSp(3);
        this._tryDropPowerUp(e);
        this._tryDropBomb(e);
      } else if (dealt > 0) {
        // Dense elite piles used to stamp noteHit per survivor on top of the bomb flash.
        if (bossLike || survivorFx < 4) {
          this.fx.noteHit(e.x, e.y);
          survivorFx += 1;
        }
        // Brief hush so survivors don't refill the just-cleared screen.
        // Overlap bombFlash (~0.7) so the whiteout isn't undercut by early re-rings.
        const hush = (e.kind === 'boss' || e.kind === 'midboss') ? 0.85 : 0.65;
        e.fireTimer = Math.max(e.fireTimer, hush);
      }
    }
  }

  /** Visual-only: glitter at cancelled enemy bullets (capped for dense screens). */
  _sparkClearedEnemyBullets() {
    const tint = this.player.meta?.shot?.color || '#ffe08a';
    const list = this.bullets.list;
    const maxSparks = 18;
    // Reservoir — one pass spreads sparks across the wipe (list-head-only skipped the ring).
    const picks = [];
    let seen = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.alive || b.friendly || b.delay > 0) continue;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) continue;
      seen += 1;
      if (picks.length < maxSparks) {
        picks.push(b);
      } else {
        const j = (Math.random() * seen) | 0;
        if (j < maxSparks) picks[j] = b;
      }
    }
    for (let i = 0; i < picks.length; i++) {
      const b = picks[i];
      this.fx.wipeSpark(b.x, b.y, tint);
    }
  }

  _spawnBombFx() {
    this.bombVfx.trigger(this.player, this.enemies, this._fxClock);
  }

  /** C is an offensive shot, not a second screen-clearing bomb. */
  _onSpecialFired() {
    const level = this.player.lastSpecialLevel || 1;
    if (this._seg && level >= 1 && level <= 3) this._seg.specials[level] += 1;
    if (!this.player.skillRun) {
      this.audio.play('special', { style: this.player.meta.shot?.style, level, char: this.charKey });
    }
    const color = this.player.meta.shot?.color || '#ffe08a';
    // Flash/shake only — no hitstop (keeps C distinct from X bomb freeze).
    this.fx.noteSpecial(level);
    for (let i = 0; i < 5 + level * 4; i++) {
      const angle = (i / (4 + level * 4) - 0.5) * 0.95;
      this.particles.push({
        x: this.player.x + 28, y: this.player.y,
        vx: Math.cos(angle) * (120 + level * 55),
        vy: Math.sin(angle) * (110 + level * 20),
        life: 0.18 + level * 0.04, color,
      });
    }
    const list = this.particles;
    while (list.length > 80) {
      list[0] = list[list.length - 1];
      list.pop();
    }
  }

  _updateParticles(dt) {
    const list = this.particles;
    let write = 0;
    const xMin = -72;
    const xMax = W + 72;
    const yMin = -72;
    const yMax = H + 72;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) continue;
      list[write++] = p;
    }
    list.length = write;
  }

  _cacheHud() {
    const id = (k) => document.getElementById(k);
    return {
      score: id('score'), lives: id('lives'), graze: id('graze'),
      stageNum: id('stage-num'), hi: id('hi-score'), mute: id('mute-flag'),
      audio: id('hud-audio'), pause: id('pause-flag'), combo: id('combo-val'),
      livesPips: id('lives-pips'), bombsPips: id('bombs-pips'),
      lifeStock: id('life-stock'), lifeWarn: id('life-warn'),
      bombStock: id('bomb-stock'), bombs: id('bombs'), power: id('power-lv'),
      chargeRow: id('charge-row'), chargeFill: id('charge-fill'), chargeTrack: id('charge-track'),
      spFill: id('sp-fill'), spTrack: id('sp-track'), spPct: id('sp-pct'),
      spStatus: id('sp-status'), bossBar: id('boss-bar'),
      bossName: id('boss-name'), bossHpFill: id('boss-hp-fill'),
      bossTag: id('boss-tag'), bossHpPct: id('boss-hp-pct'),
    };
  }

  _updateHud() {
    const h = this._hud || (this._hud = this._cacheHud());
    const setText = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
    const setWidth = (el, v) => { if (el && el.style.width !== v) el.style.width = v; };

    setText(h.score, String(this.score).padStart(7, '0'));
    setText(h.lives, String(Math.max(0, this.player.lives)));
    setText(h.graze, String(this.graze));
    setText(h.stageNum, String(Math.min(this.stageIndex + 1, this.stages.length)));
    if (h.hi && this.score > Number(h.hi.textContent || 0)) {
      setText(h.hi, String(this.score).padStart(7, '0'));
    }
    if (h.mute) {
      const muteLabel = this.audio.muted
        ? 'MUTE'
        : `BGM ${Math.round((this.audio.getBgmVolume?.() ?? 0.7) * 100)}`;
      setText(h.mute, muteLabel);
      h.mute.classList.toggle('is-muted', !!this.audio.muted);
    }
    h.audio?.classList.toggle('is-live', !!this.audio.muted);
    h.pause?.classList.toggle('is-on', !!this.paused);
    if (h.combo) {
      const c = this.fx.combo;
      setText(h.combo, c > 1 ? String(c) : '—');
      h.combo.classList.toggle('is-hot', c >= 5);
    }
    const syncPips = (el, count, total) => {
      if (!el || el.dataset.count === String(count)) return;
      el.dataset.count = String(count);
      el.innerHTML = Array.from({ length: total }, (_, i) => `<span class="pip${i < count ? ' on' : ''}"></span>`).join('');
    };
    syncPips(h.livesPips, Math.max(0, this.player.lives), 5);
    syncPips(h.bombsPips, Math.max(0, this.player.bombs), this.player.bombsMax);

    const lifeCritical = this.player.alive && this.player.lives === 1;
    if (h.lifeStock) {
      h.lifeStock.classList.toggle('is-critical', lifeCritical);
      h.lifeStock.classList.toggle('is-extend', this._lifeExtendFlash > 0);
    }
    h.lifeWarn?.classList.toggle('is-on', lifeCritical);

    if (h.bombStock) {
      h.bombStock.classList.toggle('is-deathbomb', !!this.player.inDeathBombWindow && this.player.bombs > 0);
      h.bombStock.classList.toggle('is-empty', this.player.bombs <= 0 && this.player.alive);
    }

    setText(h.bombs, String(Math.max(0, this.player.bombs)));

    if (h.power) {
      setText(h.power, String(this.player.shotLevel));
      h.power.classList.toggle('flash-up', this.player.powerFlash === 'up');
      h.power.classList.toggle('flash-down', this.player.powerFlash === 'down');
      h.power.classList.toggle('is-overclock', this.player.shotLevel >= 5);
      const tipKey = `${getLocale()}|${this.player.shotLevel >= 5 ? 1 : 0}`;
      if (this._hudPowerTipKey !== tipKey && h.power.parentElement) {
        this._hudPowerTipKey = tipKey;
        h.power.parentElement.title = this.player.shotLevel >= 5
          ? t('hud.powerTipMax')
          : t('hud.powerTip');
      }
    }

    const canCharge = this.player.meta?.chargeEnabled !== false;
    if (h.chargeRow) h.chargeRow.hidden = !canCharge;
    const chargePct = canCharge ? Math.round(this.player.charge * 100) : 0;
    setWidth(h.chargeFill, `${chargePct}%`);
    h.chargeTrack?.classList.toggle('ready', canCharge && this.player.charge >= 0.98);

    const spPct = Math.round((this.player.sp / this.player.spMax) * 100);
    setWidth(h.spFill, `${spPct}%`);
    const level = this.player.specialLevel;
    setText(h.spPct, `Lv${level}`);
    if (h.spStatus) {
      const noticeOn = this._fxClock < this.specialNoticeUntil;
      const spLock = Math.ceil(this.player.specialLock || 0);
      const spKey = spLock > 0 ? `c|${getLocale()}|${spLock}` : noticeOn
        ? `n|${this.specialNotice}`
        : `l|${getLocale()}|${level}|${this.player.charKey}|${this.player.specialName || ''}`;
      if (this._hudSpKey !== spKey) {
        this._hudSpKey = spKey;
        const spStatusText = spLock > 0
          ? t('hud.spCooldown', { s: spLock })
          : noticeOn
          ? this.specialNotice
          : (level > 0
            ? t('hud.spReady', { lv: level, name: specialDisplayName(this.player.charKey) || this.player.specialName, n: level })
            : t('hud.spCharge'));
        setText(h.spStatus, spStatusText);
        // Tick117: long i18n ready-lines (en/pt/es/ru) + dual-stroke shadow bleed
        // past fixed 260px ellipsis. Measure then grow max-width (floor retained).
        const prevFont = this.ctx.font;
        this.ctx.font = '700 11px "Noto Sans KR", "Malgun Gothic", sans-serif';
        const rawW = this.ctx.measureText(spStatusText).width;
        this.ctx.font = prevFont;
        // Ready-line letter-spacing 0.04em is CSS-only — canvas measure misses it.
        const tracking = [...spStatusText].length * 11 * 0.04;
        const statusMax = Math.min(400, Math.max(260, Math.ceil(rawW + tracking + 12)));
        const statusMaxCss = `${statusMax}px`;
        if (h.spStatus.style.maxWidth !== statusMaxCss) h.spStatus.style.maxWidth = statusMaxCss;
      }
    }
    if (h.spTrack) {
      h.spTrack.classList.toggle('ready', !!this.player.specialUsable);
      h.spTrack.classList.toggle('is-cooldown', this.player.specialLock > 0);
      h.spTrack.classList.toggle('is-ready-flash', this._spReadyFlash > 0);
    }

    // Mirror stock / gauge readiness onto on-screen pads (thumbs can't read small HUD).
    const pad = this._padHintScratch || (this._padHintScratch = {});
    pad.deathbomb = !!this.player.inDeathBombWindow && this.player.bombs > 0;
    // C locked by its own effect (Peregrinus' human form): show the countdown (user).
    const lock = this.player.specialLock || 0;
    if (lock > 0) {
      if (!(this._spLockTotal > 0) || lock > this._spLockTotal) this._spLockTotal = lock;
    } else {
      this._spLockTotal = 0;
    }
    pad.specialReady = !!this.player.specialUsable;
    pad.specialCd = lock > 0 ? Math.ceil(lock) : 0;
    pad.specialCdPct = lock > 0 ? Math.round((lock / this._spLockTotal) * 100) : 0;
    pad.chargeReady = canCharge && this.player.charge >= 0.98;
    pad.bombEmpty = this.player.bombs <= 0 && this.player.alive;
    pad.chargePct = chargePct;
    pad.bombs = Math.max(0, this.player.bombs);
    this._touchControls?.setPadHints(pad);

    const bar = h.bossBar;
    if (!bar) return;
    if (this.boss && this.boss.alive) {
      bar.classList.remove('hidden');
      bar.classList.toggle('is-mid', this.boss.kind === 'midboss');
      setText(h.bossName, this.boss.name || 'BOSS');
      const pct = Math.max(0, this.boss.hp / this.boss.maxHp) * 100;
      setWidth(h.bossHpFill, `${pct}%`);
      // Low HP read — phase tag alone didn't sell the finish window.
      bar.classList.toggle('is-critical', pct <= 22);
      if (h.bossTag) {
        const phase = (this.boss.finalForm ?? this.boss.attackPhase ?? 0) + 1;
        if (this.boss.kind === 'boss') {
          setText(h.bossTag, pct <= 22 ? 'FINISH' : `PHASE ${phase}`);
          h.bossTag.classList.toggle('phase-hot', phase >= 3 || pct <= 22);
        } else {
          setText(h.bossTag, pct <= 22 ? 'FINISH' : `MID P${phase}`);
          h.bossTag.classList.toggle('phase-hot', phase >= 3 || pct <= 22);
        }
      }
      setText(h.bossHpPct, `${Math.ceil(pct)}%`);
    } else {
      bar.classList.add('hidden');
      bar.classList.remove('is-mid', 'is-critical');
    }
  }

  /**
   * Bake static STAGE plate + route subtitle (dual-stroke) once per stage.
   * Live path used leftover textBaseline=middle from PolishFx; keep that.
   * Route fill still updates every frame.
   */
  _ensureStageHudBitmaps(measureCtx, stage, stageLabel, labelW) {
    const capKey = `${stageLabel}\0${stage.color}\0${labelW}`;
    if (this._stageCapKey !== capKey) {
      this._stageCapKey = capKey;
      const pad = 4;
      const c = this._stageCapCanvas || (this._stageCapCanvas = document.createElement('canvas'));
      c.width = Math.max(1, Math.ceil(labelW + pad * 2));
      c.height = 22 + pad * 2;
      const g = c.getContext('2d');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '700 13px "Chakra Petch", "Noto Sans KR", "Malgun Gothic", sans-serif';
      g.fillStyle = 'rgba(6,10,18,0.72)';
      g.fillRect(pad, pad, labelW, 22);
      g.strokeStyle = 'rgba(184,210,235,0.35)';
      g.lineWidth = 1;
      g.strokeRect(pad + 0.5, pad + 0.5, labelW - 1, 21);
      g.fillStyle = stage.color;
      g.fillRect(pad, pad, 3, 22);
      g.lineJoin = 'round';
      const tx = pad + labelW / 2;
      const ty = pad + 13;
      g.lineWidth = 3.5;
      g.strokeStyle = 'rgba(6, 10, 18, 0.88)';
      g.strokeText(stageLabel, tx, ty);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(184, 210, 235, 0.42)';
      g.strokeText(stageLabel, tx, ty);
      g.fillStyle = '#e8f4ff';
      g.fillText(stageLabel, tx, ty);
      this._stageCapPad = pad;
    }
    const sub = stage.subtitle;
    if (this._stageSubKey !== sub) {
      this._stageSubKey = sub;
      const font = '11px "Noto Sans KR", "Malgun Gothic", sans-serif';
      measureCtx.font = font;
      const tw = Math.ceil(measureCtx.measureText(sub).width);
      const padX = 8;
      const padY = 10;
      const c = this._stageSubCanvas || (this._stageSubCanvas = document.createElement('canvas'));
      c.width = Math.max(1, tw + padX * 2);
      c.height = Math.max(1, 24 + padY * 2);
      const g = c.getContext('2d');
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      const tx = c.width / 2;
      const ty = c.height / 2;
      g.lineWidth = 3.2;
      g.strokeStyle = 'rgba(4, 8, 16, 0.84)';
      g.strokeText(sub, tx, ty);
      g.lineWidth = 1.1;
      g.strokeStyle = 'rgba(184, 210, 235, 0.36)';
      g.strokeText(sub, tx, ty);
      g.fillStyle = 'rgba(255,255,255,0.88)';
      g.fillText(sub, tx, ty);
    }
  }

  /** LAO-style: wide strip tiled on X (same sprite repeated along scroll). */
  _drawLoopX(ctx, img, scroll, destY, destH, alpha = 1) {
    if (!img) return;
    const scale = destH / img.height;
    const bw = img.width * scale;
    const bh = destH;
    let x = -(((scroll % bw) + bw) % bw);
    ctx.globalAlpha = alpha;
    while (x < W) {
      ctx.drawImage(img, x, destY, bw, bh);
      x += bw;
    }
    ctx.globalAlpha = 1;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const shake = this.fx.getShakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    // Skill-run camera (EventCameraControl*): gentle zoom-in on the courier/target.
    const cam = this._cam;
    if (cam && cam.z > 1.0005) {
      ctx.translate(cam.fx, cam.fy);
      ctx.scale(cam.z, cam.z);
      ctx.translate(-cam.fx, -cam.fy);
    }

    const currentStage = this.stages[Math.min(this.stageIndex, this.stages.length - 1)];
    const split = typeof window !== 'undefined' ? window.__LAO_SPLIT__ : null;
    const tBg = split ? performance.now() : 0;
    // Effect-quality probe (tools/eval-fx.mjs): a flat backdrop isolates the effect pixels.
    if (window.__FX_FLATBG__) { ctx.fillStyle = '#151a24'; ctx.fillRect(-50, -50, W + 100, H + 100); }
    else drawStageBackground(ctx, this.assets.images, currentStage, this.bgX, this.time);
    if (split) split.bg = (split.bg || 0) + (performance.now() - tBg);

    for (const e of this.enemies) e.draw(ctx);
    for (const item of this.powerUps) item.draw(ctx);
    this.bullets.draw(ctx, this.projectileVfx.active, 'friendly');
    this.hitFx.draw(ctx);
    this._drawSheetFx(ctx);
    this.player.draw(ctx);
    this.pickupFx.draw(ctx);
    // Enemy bullets over the ship: they used to slip behind the sprite and look eaten.
    this._drawBeamBulletBacking(ctx);
    this.bullets.draw(ctx, this.projectileVfx.active, 'hostile');
    this.projectileVfx.render(this.bullets.list, this._fxClock, this.player, this.bombVfx);
    this.bombVfx.drawOriginalSkill2(ctx, this._fxClock);

    for (const p of this.particles) {
      const a = Math.max(0, p.life * 2);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.globalAlpha = a * 0.4;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 7, 2.2, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff8ee';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3.2, 1.1, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.fx.draw(ctx);
    if (!this.projectileVfx.active) this.bombVfx.drawCanvas(ctx, this._fxClock);
    this.bombVfx.drawLabel(ctx, this._fxClock);
    this._drawBuffBanner(ctx);
    this._drawTally(ctx);
    this._syncFadeLayer();
    const stage = this.stages[Math.min(this.stageIndex, this.stages.length - 1)];
    ctx.save();
    ctx.textAlign = 'center';
    const stageLabel = t('hud.stageN', {
      n: Math.min(this.stageIndex + 1, this.stages.length),
    });
    ctx.font = '700 13px "Chakra Petch", "Noto Sans KR", "Malgun Gothic", sans-serif';
    if (this._stageLabelCache !== stageLabel) {
      this._stageLabelCache = stageLabel;
      this._stageLabelW = Math.min(420, ctx.measureText(stageLabel).width + 28);
    }
    const labelW = this._stageLabelW;
    this._ensureStageHudBitmaps(ctx, stage, stageLabel, labelW);
    // Mobile: canvas UI at 50% like the DOM HUD (user).
    if (document.body.classList.contains('has-touch-pads')) ctx.globalAlpha = 0.5;
    ctx.drawImage(this._stageCapCanvas, W / 2 - labelW / 2 - this._stageCapPad, 14 - this._stageCapPad);
    ctx.globalAlpha = 1;
    // (Bottom route strip + stage subtitle removed - user.)

    // Ceremony cards: WARNING + stage START + stage CLEAR only.
    // Still hidden: wave cues, PHASE tips, MID CLEAR, late-half, LOADING, approach toasts.
    const warning = this.stagePhase === 'mid-windup' || this.stagePhase === 'boss-windup';
    const isStageClear = this.stagePhase === 'transition'
      && (this.stageTitle === 'STAGE CLEAR' || this.stageTitle === 'ALL CLEAR');
    const isStageStart = (this.stagePhase === 'waves' || this.stagePhase === 'entry')
      && /^STAGE\s+\d+/i.test(this.stageTitle || '');
    if (this.stageIntro > 0 && (warning || isStageClear || isStageStart)) {
      const alpha = Math.min(1, this.stageIntro / 0.35);
      ctx.globalAlpha = alpha;
      if (warning) {
        // Wall-clock pulse — sim `time` freezes under hitstop and parked the WARNING card.
        // Midboss: brass/amber band (matches #boss-bar.is-mid). Boss: hotter crimson.
        const isBossWarn = this.warningKind === 'boss';
        const pulseRate = isBossWarn ? 14 : 11;
        const pulse = 0.55 + 0.45 * Math.sin(this._fxClock * pulseRate);
        const bandY = H / 2 - 78;
        ctx.fillStyle = isBossWarn
          ? `rgba(28, 4, 10, ${0.78 + pulse * 0.1})`
          : `rgba(22, 14, 6, ${0.8 + pulse * 0.08})`;
        ctx.fillRect(0, bandY, W, 156);
        ctx.fillStyle = isBossWarn
          ? `rgba(255, 70, 80, ${0.12 + pulse * 0.18})`
          : `rgba(255, 170, 60, ${0.10 + pulse * 0.15})`;
        ctx.fillRect(0, bandY + 8, W, 140);
        ctx.fillStyle = isBossWarn
          ? `rgba(232, 69, 85, ${0.4 + pulse * 0.45})`
          : `rgba(212, 162, 74, ${0.42 + pulse * 0.4})`;
        ctx.fillRect(0, bandY, W, 3);
        ctx.fillRect(0, bandY + 153, W, 3);
        ctx.globalAlpha = alpha * (0.35 + pulse * 0.4);
        ctx.fillStyle = isBossWarn ? 'rgba(255,210,160,0.9)' : 'rgba(255,230,180,0.92)';
        ctx.fillRect(0, bandY + 5, W, 1.5);
        ctx.fillRect(0, bandY + 149, W, 1.5);
        // Soft-sprite grit inside the band — elongated ellipses + white tip cores (no geometry marks).
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 8; i++) {
          const a = this._fxClock * (1.15 + i * 0.08) + i * 0.85;
          const stretch = 1.55 + (i % 3) * 0.14;
          const mx = W * (0.14 + (i % 4) * 0.22) + Math.sin(a) * 16;
          const my = bandY + 26 + (i % 5) * 24 + Math.cos(a * 0.75) * 9;
          const body = isBossWarn
            ? `rgba(255, ${110 + pulse * 70 | 0}, ${120 + i * 4}, ${0.22 + pulse * 0.18})`
            : `rgba(255, ${190 + pulse * 40 | 0}, ${110 + i * 6}, ${0.2 + pulse * 0.16})`;
          ctx.globalAlpha = alpha * (0.45 + pulse * 0.35);
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.ellipse(mx, my, 5.5 * stretch, 2.4, a * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 252, 245, 0.9)';
          ctx.beginPath();
          ctx.ellipse(mx + stretch * 2.2, my, 1.55, 1.1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = alpha;
        const chevHot = isBossWarn
          ? `rgba(255, ${90 + pulse * 80 | 0}, ${100 + pulse * 40 | 0}, 0.85)`
          : `rgba(255, ${170 + pulse * 50 | 0}, ${70 + pulse * 30 | 0}, 0.88)`;
        ctx.fillStyle = chevHot;
        const chev = 18 + pulse * 4;
        ctx.beginPath();
        ctx.moveTo(28, H / 2); ctx.lineTo(28 + chev, H / 2 - 22); ctx.lineTo(28 + chev, H / 2 + 22);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(W - 28, H / 2); ctx.lineTo(W - 28 - chev, H / 2 - 22); ctx.lineTo(W - 28 - chev, H / 2 + 22);
        ctx.closePath(); ctx.fill();
        // Dual stroke: dark outer + kind-tinted rim so pulse never washes the glyph.
        ctx.font = 'bold 48px "Chakra Petch", "Malgun Gothic", sans-serif';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 8;
        ctx.strokeStyle = isBossWarn
          ? `rgba(28, 4, 10, ${0.82 + pulse * 0.12})`
          : `rgba(24, 14, 4, ${0.84 + pulse * 0.1})`;
        ctx.strokeText('WARNING', W / 2, H / 2 - 6);
        ctx.lineWidth = 3;
        ctx.strokeStyle = isBossWarn
          ? `rgba(255, 120, 130, ${0.35 + pulse * 0.25})`
          : `rgba(255, 210, 140, ${0.38 + pulse * 0.22})`;
        ctx.strokeText('WARNING', W / 2, H / 2 - 6);
        ctx.fillStyle = isBossWarn
          ? `rgba(255, ${100 + pulse * 70 | 0}, ${110 + pulse * 35 | 0}, 1)`
          : `rgba(255, ${210 + pulse * 30 | 0}, ${150 + pulse * 25 | 0}, 1)`;
        ctx.fillText('WARNING', W / 2, H / 2 - 6);
        // Kind chip — mid vs final read without relying on subtitle alone.
        // Caption dual-stroke: dark outer + kind rim (title parity — wash never muddies chip/sub).
        const chip = isBossWarn ? 'FINAL' : 'MID';
        ctx.font = 'bold 11px "Chakra Petch", "Noto Sans KR", sans-serif';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = isBossWarn
          ? 'rgba(28, 4, 10, 0.86)'
          : 'rgba(24, 14, 4, 0.86)';
        ctx.strokeText(chip, W / 2, H / 2 + 18);
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = isBossWarn
          ? `rgba(255, 140, 150, ${0.42 + pulse * 0.18})`
          : `rgba(255, 214, 140, ${0.44 + pulse * 0.16})`;
        ctx.strokeText(chip, W / 2, H / 2 + 18);
        ctx.fillStyle = isBossWarn
          ? `rgba(255, 140, 150, ${0.75 + pulse * 0.2})`
          : `rgba(255, 214, 140, ${0.78 + pulse * 0.18})`;
        ctx.fillText(chip, W / 2, H / 2 + 18);
        const warnSub = this.stageSubtitle || (isBossWarn ? 'BOSS' : 'MIDBOSS');
        ctx.font = 'bold 16px "Chakra Petch", "Noto Sans KR", sans-serif';
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = isBossWarn
          ? 'rgba(28, 4, 10, 0.84)'
          : 'rgba(24, 14, 4, 0.84)';
        ctx.strokeText(warnSub, W / 2, H / 2 + 38);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isBossWarn
          ? 'rgba(255, 160, 150, 0.4)'
          : 'rgba(255, 214, 150, 0.42)';
        ctx.strokeText(warnSub, W / 2, H / 2 + 38);
        ctx.fillStyle = '#ffe0a8';
        ctx.fillText(warnSub, W / 2, H / 2 + 38);
      } else {
        // Valofe NewUI ceremony card — steel panel + cyan/brass accents.
        // CLEAR: stage brass vs finale gold. START: cyan wash + soft grit + dual stroke + kind chip.
        const elapsed = Math.max(0, (this._introPeak || this.stageIntro) - this.stageIntro);
        const enter = Math.min(1, elapsed / 0.35);
        const slide = (1 - enter) * 18;
        const isFinaleClear = isStageClear && !!this._clearIsFinale;
        // START taller for kind chip + deco rhythm (parity with CLEAR title stack).
        const cardH = isStageClear ? 148 : 118;
        const cardW = 470;
        const cardX = W / 2 - cardW / 2;
        const cardY = H / 2 - (isStageClear ? 62 : 52) + slide;
        const accent = isStageClear
          ? (isFinaleClear ? '#ffd070' : '#c58917')
          : '#00e8c8';
        const cardAlpha = alpha * (0.55 + enter * 0.45);
        ctx.globalAlpha = cardAlpha;
        if (isStageClear) {
          // Stage CLEAR: soft brass wash. ALL CLEAR: hotter gold peak.
          const peak = isFinaleClear ? 0.34 : 0.2;
          const wash = Math.min(peak, elapsed < 0.75 ? (0.75 - elapsed) * (isFinaleClear ? 0.48 : 0.35) : 0);
          if (wash > 0) {
            ctx.fillStyle = isFinaleClear
              ? `rgba(255, 210, 100, ${wash})`
              : `rgba(255, 200, 120, ${wash})`;
            ctx.fillRect(0, 0, W, H);
          }
        } else {
          // STAGE START: soft cyan wash peek (keeps cyan identity — not brass-forced).
          const wash = Math.min(0.16, elapsed < 0.6 ? (0.6 - elapsed) * 0.28 : 0);
          if (wash > 0) {
            ctx.fillStyle = `rgba(0, 232, 200, ${wash})`;
            ctx.fillRect(0, 0, W, H);
          }
        }
        ctx.fillStyle = isStageClear
          ? (isFinaleClear ? 'rgba(18, 12, 6, 0.92)' : 'rgba(12, 10, 8, 0.9)')
          : 'rgba(8, 10, 14, 0.9)';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.fillStyle = isStageClear
          ? (isFinaleClear ? 'rgba(255, 200, 80, 0.07)' : 'rgba(212, 162, 74, 0.06)')
          : 'rgba(0, 232, 200, 0.05)';
        ctx.fillRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12);
        // Hatch strip (NewUI panel texture cue) — keep as fallback under bitmaps.
        ctx.save();
        ctx.beginPath();
        ctx.rect(cardX + 6, cardY + 6, cardW - 12, cardH - 12);
        ctx.clip();
        const box2 = newUiSlice('box2');
        if (box2) {
          ctx.globalAlpha = cardAlpha * 0.22;
          const tile = 10;
          for (let ty = cardY + 6; ty < cardY + cardH - 6; ty += tile) {
            for (let tx = cardX + 6; tx < cardX + cardW - 6; tx += tile) {
              ctx.drawImage(box2, tx, ty, tile, tile);
            }
          }
          ctx.globalAlpha = cardAlpha;
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.045)';
          ctx.lineWidth = 1;
          for (let hx = -cardH; hx < cardW + cardH; hx += 5) {
            ctx.beginPath();
            ctx.moveTo(cardX + hx, cardY + 6);
            ctx.lineTo(cardX + hx + cardH, cardY + cardH - 6);
            ctx.stroke();
          }
        }
        // Soft-sprite grit inside CLEAR card — elongated ellipses + white tip cores.
        if (isStageClear) {
          const pulseRate = isFinaleClear ? 12 : 9;
          const pulse = 0.55 + 0.45 * Math.sin(this._fxClock * pulseRate);
          ctx.globalCompositeOperation = 'screen';
          for (let i = 0; i < 8; i++) {
            const a = this._fxClock * (1.05 + i * 0.07) + i * 0.9;
            const stretch = 1.55 + (i % 3) * 0.12;
            const mx = cardX + 36 + (i % 4) * 100 + Math.sin(a) * 10;
            const my = cardY + 22 + (i % 5) * 20 + Math.cos(a * 0.7) * 6;
            const body = isFinaleClear
              ? `rgba(255, ${180 + pulse * 50 | 0}, ${90 + i * 5}, ${0.2 + pulse * 0.16})`
              : `rgba(255, ${200 + pulse * 30 | 0}, ${120 + i * 4}, ${0.18 + pulse * 0.14})`;
            ctx.globalAlpha = cardAlpha * (0.4 + pulse * 0.35);
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.ellipse(mx, my, 5.2 * stretch, 2.2, a * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 252, 245, 0.9)';
            ctx.beginPath();
            ctx.ellipse(mx + stretch * 2.0, my, 1.5, 1.05, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = cardAlpha;
        } else {
          // Soft-sprite grit inside START card — cyan tint (budget lighter than CLEAR).
          const pulse = 0.55 + 0.45 * Math.sin(this._fxClock * 10);
          ctx.globalCompositeOperation = 'screen';
          for (let i = 0; i < 6; i++) {
            const a = this._fxClock * (1.08 + i * 0.08) + i * 0.95;
            const stretch = 1.55 + (i % 3) * 0.12;
            const mx = cardX + 40 + (i % 3) * 130 + Math.sin(a) * 10;
            const my = cardY + 20 + (i % 4) * 18 + Math.cos(a * 0.7) * 5;
            ctx.globalAlpha = cardAlpha * (0.38 + pulse * 0.32);
            ctx.fillStyle = `rgba(${60 + i * 8}, ${220 + pulse * 30 | 0}, ${200 + i * 4}, ${0.18 + pulse * 0.14})`;
            ctx.beginPath();
            ctx.ellipse(mx, my, 5.0 * stretch, 2.1, a * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 252, 245, 0.9)';
            ctx.beginPath();
            ctx.ellipse(mx + stretch * 2.0, my, 1.45, 1.0, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = cardAlpha;
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);
        ctx.strokeStyle = isStageClear
          ? (isFinaleClear
            ? `rgba(255, 200, 100, ${0.4 + enter * 0.2})`
            : `rgba(212, 162, 74, ${0.36 + enter * 0.18})`)
          : `rgba(0, 232, 200, 0.55)`;
        ctx.strokeRect(cardX + 4.5, cardY + 4.5, cardW - 9, cardH - 9);
        // Top_Bg vertical edge rail (20×500 slice) — only when preloaded.
        const topBg = newUiSlice('topBg');
        if (topBg) {
          ctx.save();
          ctx.globalAlpha = cardAlpha * (isStageClear ? 0.55 : 0.72);
          ctx.drawImage(topBg, cardX, cardY, 7, cardH);
          ctx.drawImage(topBg, cardX + cardW - 7, cardY, 7, cardH);
          ctx.restore();
          ctx.globalAlpha = cardAlpha;
        }
        ctx.fillStyle = accent;
        ctx.fillRect(cardX, cardY, 4, cardH);
        ctx.fillStyle = accent;
        ctx.globalAlpha = cardAlpha * 0.85;
        ctx.fillRect(cardX + 8, cardY, cardW - 16, 2);
        ctx.globalAlpha = cardAlpha;
        const stageNo = Math.min(this.stageIndex + 1, this.stages.length);
        const clearTitle = isStageClear
          ? (this.stageTitle || `STAGE ${stageNo}`)
          : t('hud.stageN', { n: stageNo });
        ctx.font = 'bold 28px "Chakra Petch", "Noto Sans KR", "Malgun Gothic", sans-serif';
        ctx.lineJoin = 'round';
        if (isStageClear) {
          // Dual stroke: dark outer + brass/gold rim so wash never washes the glyph.
          ctx.lineWidth = 7;
          ctx.strokeStyle = isFinaleClear
            ? 'rgba(28, 16, 4, 0.88)'
            : 'rgba(20, 14, 6, 0.86)';
          ctx.strokeText(clearTitle, W / 2, cardY + 46);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = isFinaleClear
            ? 'rgba(255, 220, 140, 0.55)'
            : 'rgba(255, 210, 150, 0.48)';
          ctx.strokeText(clearTitle, W / 2, cardY + 46);
          ctx.fillStyle = isFinaleClear ? '#fff0c0' : '#f4f7ff';
        } else {
          // Dual stroke: dark outer + cyan rim so START wash never washes the glyph.
          ctx.lineWidth = 7;
          ctx.strokeStyle = 'rgba(4, 16, 18, 0.88)';
          ctx.strokeText(clearTitle, W / 2, cardY + 46);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(0, 232, 200, 0.5)';
          ctx.strokeText(clearTitle, W / 2, cardY + 46);
          ctx.fillStyle = '#e8ffff';
        }
        ctx.fillText(clearTitle, W / 2, cardY + 46);
        // Caption dual-stroke: kind chip + subtitle (+ CLEAR bonus) match title wash resistance.
        if (isStageClear) {
          // Kind chip — STAGE CLEAR vs ALL CLEAR without relying on title alone.
          const chip = isFinaleClear ? 'ALL' : 'CLEAR';
          ctx.font = 'bold 11px "Chakra Petch", "Noto Sans KR", sans-serif';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = isFinaleClear
            ? 'rgba(28, 16, 4, 0.86)'
            : 'rgba(20, 14, 6, 0.86)';
          ctx.strokeText(chip, W / 2, cardY + 62);
          ctx.lineWidth = 1.25;
          ctx.strokeStyle = isFinaleClear
            ? 'rgba(255, 220, 140, 0.48)'
            : 'rgba(255, 210, 150, 0.44)';
          ctx.strokeText(chip, W / 2, cardY + 62);
          ctx.fillStyle = isFinaleClear
            ? 'rgba(255, 220, 140, 0.9)'
            : 'rgba(255, 214, 160, 0.88)';
          ctx.fillText(chip, W / 2, cardY + 62);
        } else {
          // Kind chip — START read without relying on title alone.
          ctx.font = 'bold 11px "Chakra Petch", "Noto Sans KR", sans-serif';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = 'rgba(4, 16, 18, 0.86)';
          ctx.strokeText('START', W / 2, cardY + 62);
          ctx.lineWidth = 1.25;
          ctx.strokeStyle = 'rgba(0, 232, 200, 0.45)';
          ctx.strokeText('START', W / 2, cardY + 62);
          ctx.fillStyle = 'rgba(140, 255, 230, 0.9)';
          ctx.fillText('START', W / 2, cardY + 62);
        }
        // Title_Deco underline under stage title (320×16 slice).
        const deco = newUiSlice('titleDeco');
        if (deco) {
          const dw = Math.min(280, cardW - 48);
          const dh = 12;
          ctx.save();
          ctx.globalAlpha = cardAlpha * 0.9;
          ctx.drawImage(deco, W / 2 - dw / 2, cardY + 72, dw, dh);
          ctx.restore();
          ctx.globalAlpha = cardAlpha;
        }
        // START: number-only title — no "/N" total, no stage.name subtitle.
        const cardSub = isStageStart ? '' : (this.stageSubtitle || '');
        if (cardSub) {
          ctx.font = '15px "Noto Sans KR", "Malgun Gothic", sans-serif';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 4;
          ctx.strokeStyle = isStageClear
            ? (isFinaleClear ? 'rgba(28, 16, 4, 0.84)' : 'rgba(20, 14, 6, 0.84)')
            : 'rgba(4, 16, 18, 0.84)';
          ctx.strokeText(cardSub, W / 2, cardY + 96);
          ctx.lineWidth = 1.35;
          ctx.strokeStyle = isStageClear
            ? (isFinaleClear ? 'rgba(255, 220, 140, 0.4)' : 'rgba(255, 210, 150, 0.38)')
            : 'rgba(0, 232, 200, 0.38)';
          ctx.strokeText(cardSub, W / 2, cardY + 96);
          ctx.fillStyle = isStageClear ? accent : (stage.color || accent);
          ctx.fillText(cardSub, W / 2, cardY + 96);
        }
        if (isStageClear) {
          const bombLine = this._clearBombKind === 'score' ? '폭탄 만재 SCORE +1500' : '폭탄 +1';
          const lifeLine = this._clearNomissLife ? ' · 노미스 LIFE +1' : '';
          const powerLine = this._clearLv4 ? ` · POWER Lv${this.player?.shotLevel || 5}` : '';
          const bonusLine = `BONUS +${this.stageClearBonus.toLocaleString()} · ${bombLine}${lifeLine}${powerLine}`;
          ctx.font = 'bold 13px "Chakra Petch", "Malgun Gothic", sans-serif';
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = isFinaleClear
            ? 'rgba(28, 16, 4, 0.84)'
            : 'rgba(20, 14, 6, 0.84)';
          ctx.strokeText(bonusLine, W / 2, cardY + 124);
          ctx.lineWidth = 1.25;
          ctx.strokeStyle = isFinaleClear
            ? 'rgba(255, 220, 140, 0.38)'
            : 'rgba(255, 210, 150, 0.36)';
          ctx.strokeText(bonusLine, W / 2, cardY + 124);
          ctx.fillStyle = isFinaleClear ? '#fff0c0' : '#ffe6a1';
          ctx.fillText(bonusLine, W / 2, cardY + 124);
        }
      }
      ctx.globalAlpha = 1;
    }
    // Phase telegraph rim — short after HP phase break so the pattern swap reads.
    // Pale stage accents (#9cc7ff machine / #74d4ff program) used to paint the rim
    // at low alpha into the same-hue neon wash — dark under-rim + tip edge keep
    // the phase-swap cue readable without pattern / difficulty churn.
    if (this._phaseTelegraph > 0 && this.boss?.alive) {
      const a = Math.min(1, this._phaseTelegraph / 0.25) * 0.55;
      ctx.save();
      const col = stage.color || '#ffe08a';
      ctx.strokeStyle = 'rgba(12, 8, 18, 0.78)';
      ctx.globalAlpha = a * 0.9;
      ctx.lineWidth = 22;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      ctx.strokeStyle = col;
      ctx.globalAlpha = a * 0.34;
      ctx.lineWidth = 18;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.globalAlpha = a;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(11, 11, W - 22, H - 22);
      ctx.strokeStyle = '#fffef8';
      ctx.globalAlpha = a * 0.72;
      ctx.lineWidth = 1.55;
      ctx.strokeRect(16, 16, W - 32, H - 32);
      ctx.restore();
    }
    // (Rare sortie chip at the top-left removed - user.)
    // Deathbomb grace prompt — readable even under hitstop freeze frames.
    if (this.player.inDeathBombWindow && this.player.alive) {
      const ratio = this.player.deathBombRatio;
      const canBomb = this.player.bombs > 0;
      const first = !!this.player.isFirstDeathBomb;
      // Wall-clock pulse — sim `time` freezes under hitstop and made the prompt look dead.
      const pulse = 0.65 + 0.35 * Math.abs(Math.sin(performance.now() * (first ? 0.03 : 0.022)));
      const dbTitle = canBomb ? 'X · DEATHBOMB' : 'NO BOMB';
      const dbSub = canBomb
        ? (first ? t('deathbomb.first') : t('deathbomb.ok'))
        : t('deathbomb.needDrop');
      // Tick116: long i18n subs (en/pt/es/ru) + dual-stroke bleed past fixed 268/236 plates.
      // Measure first, then grow plate (cap to stage) — keep caption dual-stroke language.
      ctx.save();
      ctx.font = '11px "Noto Sans KR", "Malgun Gothic", sans-serif';
      const subW = ctx.measureText(dbSub).width;
      ctx.font = `bold ${first ? 20 : 18}px "Chakra Petch", "Malgun Gothic", sans-serif`;
      const titleW = ctx.measureText(dbTitle).width;
      const baseW = first ? 268 : 236;
      const boxW = Math.min(W - 48, Math.max(baseW, Math.ceil(Math.max(subW, titleW) + 28)));
      const boxH = first ? 52 : 44;
      ctx.globalAlpha = first ? 0.94 : 0.88;
      ctx.fillStyle = 'rgba(10, 6, 4, 0.82)';
      ctx.fillRect(W / 2 - boxW / 2, H * 0.28 - 20, boxW, boxH);
      if (first) {
        ctx.strokeStyle = `rgba(255, 210, 100, ${0.35 + pulse * 0.45})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - boxW / 2, H * 0.28 - 20, boxW, boxH);
      }
      ctx.fillStyle = canBomb ? `rgba(255, 200, 90, ${0.45 + pulse * 0.4})` : `rgba(255, 90, 70, ${0.4 + pulse * 0.35})`;
      ctx.fillRect(W / 2 - boxW / 2, H * 0.28 - 20, boxW * ratio, 3);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Caption dual-stroke: dark outer + amber/rose rim so pulse bar never muddies title/sub.
      const dbTitleY = H * 0.28 + (first ? 0 : 2);
      ctx.font = `bold ${first ? 20 : 18}px "Chakra Petch", "Malgun Gothic", sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = canBomb ? 'rgba(18, 10, 4, 0.88)' : 'rgba(22, 6, 6, 0.88)';
      ctx.strokeText(dbTitle, W / 2, dbTitleY);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = canBomb
        ? `rgba(255, 214, 120, ${0.42 + pulse * 0.2})`
        : `rgba(255, 150, 130, ${0.4 + pulse * 0.18})`;
      ctx.strokeText(dbTitle, W / 2, dbTitleY);
      ctx.fillStyle = canBomb ? '#ffe6a1' : '#ffb0a0';
      ctx.fillText(dbTitle, W / 2, dbTitleY);
      const dbSubY = H * 0.28 + 18;
      ctx.font = '11px "Noto Sans KR", "Malgun Gothic", sans-serif';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = canBomb ? 'rgba(18, 10, 4, 0.84)' : 'rgba(22, 6, 6, 0.84)';
      ctx.strokeText(dbSub, W / 2, dbSubY);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = canBomb
        ? 'rgba(255, 220, 150, 0.38)'
        : 'rgba(255, 170, 150, 0.36)';
      ctx.strokeText(dbSub, W / 2, dbSubY);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(dbSub, W / 2, dbSubY);
      ctx.restore();
    }
    if (this.paused) {
      // Dim only — DOM pause / options menu owns the interactive UI.
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(3,7,14,0.55)';
      ctx.fillRect(-shake.x, -shake.y, W, H);
    }
    ctx.restore();
    ctx.restore();

    // Top-right FPS (after shake restore). Sample ~8Hz.
    this._fpsFrames += 1;
    const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (!this._fpsLastSample) this._fpsLastSample = nowMs;
    const elapsed = nowMs - this._fpsLastSample;
    if (elapsed >= 125) {
      this._fpsDisplay = Math.round((this._fpsFrames * 1000) / elapsed);
      this._fpsFrames = 0;
      this._fpsLastSample = nowMs;
      this._gfxGuard(elapsed / 1000);
    }
    // FPS readout is a dev aid: only with ?fps=1.
    if (this._fpsDisplay > 0 && SHOW_FPS) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.font = '700 13px "Chakra Petch", "Malgun Gothic", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const label = `${this._fpsDisplay} FPS`;
      // Below DOM STAGE/GRAZE/COMBO (.hud-top ~8px + meta plate ~48px).
      const fpsX = W - 12;
      const fpsY = 60;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(6, 10, 16, 0.85)';
      ctx.strokeText(label, fpsX, fpsY);
      ctx.fillStyle = '#b8ffe8';
      ctx.fillText(label, fpsX, fpsY);
      ctx.restore();
    }
  }
}

