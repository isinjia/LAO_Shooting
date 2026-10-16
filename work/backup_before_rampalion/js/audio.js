import { SFX_TABLE } from './sfx-table.js';

/** Per-cue clip gain on top of the table mix. Griffin's P-38 clip is half the length of the
 *  other shot clips and read as silent under the field (user). */
const SFX_GAIN = { 'shoot:p38shot': 1.6 };

/** Mix levels (tools/score-sfx.mjs balance): master bus, and make-up gain for BGM tracks. */
const MASTER_VOL = 0.75;
/** Cues switched off entirely (no clip, no synth fallback): enemy hit / death and the wave
 *  cue chime (user request). */
// Kill sound off (user): the hit sound already marks the kill; cue / graze stay off too.
export const DISABLED_CUES = new Set(['enemyDeath', 'cue', 'graze']);

/** Enemy-hit sound class per friendly projectile style (js/sfx-table.js "enemyHit:<class>"). */
const HIT_CLASS = {
  p38shot: 'bullet', shindenshot: 'bullet', hayateshot: 'bullet', falconshot: 'bullet', tracer: 'bullet',
  lockround: 'bullet', coffinround: 'bullet',
  pancakeshot: 'heavy', shell: 'heavy', coffinwall: 'heavy',
  p38missile: 'missile', x36missile: 'missile', heatmissile: 'missile', commandmissile: 'missile', coffinmissile: 'missile',
  spiral: 'energy', pancakelaser: 'energy', railbeam: 'energy', railbolt: 'energy', busterbeam: 'energy',
  lightning: 'energy', teslacoil: 'energy', jupiterorb: 'energy',
  cleave: 'slash', plasmaslash: 'slash', plasmacross: 'slash', dragonaxe: 'slash', lrlphantom: 'slash',
  orbitblade: 'slash', syusuishot: 'slash',
  marionshot: 'magic', heartshot: 'magic', sunseal: 'magic', sunbird: 'magic', foxflame: 'magic',
  sonicboom: 'impact', bori: 'impact',
};
const BGM_TRACK_GAIN = 1.9;
/**
 * Lightweight arcade audio — procedural Web Audio with optional file drop-ins.
 * Place real assets later at: assets/audio/<name>.{ogg,mp3,wav}
 * Mute-safe: autoplay blocks leave synth silent until a user gesture unlocks AudioContext.
 *
 * Stage BGM drop-ins (optional): bgm_1…bgm_5 or bgm_<mood> (city/hive/nest/airfield/abyss).
 */

const FILE_MAP = {
  shoot: 'shoot',
  enemyHit: 'enemy_hit',
  enemyDeath: 'enemy_death',
  playerHit: 'player_hit',
  playerDeath: 'player_death',
  bomb: 'bomb',
  special: 'special',
  pickupP: 'pickup_p',
  pickupB: 'pickup_b',
  powerDown: 'power_down',
  charge: 'charge',
  chargeHold: 'charge_hold',
  deny: 'deny',
  warning: 'warning',
  graze: 'graze',
  cue: 'cue',
  clear: 'clear',
  phase: 'phase',
  fanfare: 'fanfare',
  bgm: 'bgm',
};

/**
 * Optional file drop-ins that are KNOWN to exist under assets/audio/.
 * Empty = procedural synth only (no fetch → no 404 spam).
 * When you add e.g. `bgm_city.ogg`, list the stem here: 'bgm_city'.
 */
const PRESENT_AUDIO_STEMS = new Set([
  // intentionally empty until real files are dropped in
]);

/** Alias map so callers can use short or legacy names. */
const ALIASES = {
  shot: 'shoot',
  explosion: 'enemyDeath',
  hit: 'playerHit',
  pickup: 'pickupP',
  death: 'playerDeath',
  rare: 'fanfare',
  powerdown: 'powerDown',
  power_down: 'powerDown',
};

/** Per-act procedural motif (and preferred file stem after generic bgm). */
export const STAGE_BGM = {
  city: {
    label: 'city',
    fileKeys: ['bgm_1', 'bgm_city'],
    pad: [98, 130.81, 164.81, 196],
    arp: [392, 493.88, 587.33, 659.25, 784],
    pulse: 72,
    pulseType: 'square',
    lfo: 0.14,
    padGain: 0.055,
    arpGain: 0.028,
    pulseGain: 0.014,
    arpHz: 5.2,
    color: 'cool',
  },
  hive: {
    label: 'hive',
    fileKeys: ['bgm_2', 'bgm_hive'],
    pad: [92.5, 110, 138.59, 185],
    arp: [277.18, 329.63, 369.99, 415.3],
    pulse: 46,
    pulseType: 'sawtooth',
    lfo: 0.09,
    padGain: 0.062,
    arpGain: 0.02,
    pulseGain: 0.016,
    arpHz: 3.6,
    color: 'eerie',
  },
  nest: {
    label: 'nest',
    fileKeys: ['bgm_3', 'bgm_nest'],
    pad: [87.31, 110, 130.81, 174.61],
    arp: [349.23, 392, 440, 523.25],
    pulse: 55,
    pulseType: 'triangle',
    lfo: 0.11,
    padGain: 0.058,
    arpGain: 0.026,
    pulseGain: 0.012,
    arpHz: 4.4,
    color: 'warm',
  },
  airfield: {
    label: 'airfield',
    fileKeys: ['bgm_4', 'bgm_airfield'],
    pad: [82.41, 103.83, 123.47, 164.81],
    arp: [329.63, 392, 493.88, 587.33],
    pulse: 90,
    pulseType: 'square',
    lfo: 0.18,
    padGain: 0.05,
    arpGain: 0.032,
    pulseGain: 0.02,
    arpHz: 6.5,
    color: 'martial',
  },
  abyss: {
    label: 'abyss',
    fileKeys: ['bgm_5', 'bgm_abyss'],
    pad: [73.42, 87.31, 110, 146.83],
    arp: [220, 261.63, 293.66, 349.23, 415.3],
    pulse: 40,
    pulseType: 'sawtooth',
    lfo: 0.07,
    padGain: 0.07,
    arpGain: 0.024,
    pulseGain: 0.022,
    arpHz: 4.0,
    color: 'dark',
  },
};

const SCENE_BY_INDEX = ['city', 'hive', 'nest', 'airfield', 'abyss'];

export function moodForStage(stageOrIndex) {
  if (typeof stageOrIndex === 'number') {
    return SCENE_BY_INDEX[Math.max(0, Math.min(SCENE_BY_INDEX.length - 1, stageOrIndex | 0))] || 'city';
  }
  if (stageOrIndex && typeof stageOrIndex === 'object') {
    return stageOrIndex.scene || SCENE_BY_INDEX[stageOrIndex.index | 0] || 'city';
  }
  if (typeof stageOrIndex === 'string' && STAGE_BGM[stageOrIndex]) return stageOrIndex;
  return 'city';
}

export class ArcadeAudio {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    this.muted = false;
    this.unlocked = false;
    this.last = new Map();
    this.buffers = new Map();
    this._fileTried = new Set();
    this.bgmNode = null;
    this.bgmGain = null;
    this._bgmWanted = false;
    this._bgmMood = 'city';
    this._unlockBound = false;
    /** Guards startBgm ↔ unlock re-entry (sync path when AudioContext is already running). */
    this._inStartBgm = false;
    this._bgmVol = 0.7;
    this._sfxVol = 0.85;
    // Sample-based mix (original LAO SFX + BGM) behind a master limiter; the old 0.22 was
    // tuned for the raw synth voices.
    this._masterVol = MASTER_VOL;
    this._procStops = [];
    /** Soft charge-hold loop (Z/Space) — stop on release / fire. */
    this._chargeHold = null;
    this._chargeHoldTickAt = 0;
    /** 0 soft waves → 1 boss peak; scales procedural pad/arp/pulse. */
    this._bgmIntensity = 0.35;
    this._intensityNodes = null;

    if (!this.ctx) return;

    this.master = this.ctx.createGain();
    this.master.gain.value = this._masterVol;
    // Master limiter: stacked kill explosions + bomb + WARNING over the BGM never clip.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -4;
    this.limiter.knee.value = 2;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.15;
    this.master.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);

    /** Optional peak meter for technical SFX checks (tools/check-audio.mjs). */
    this._analyser = this.ctx.createAnalyser();
    this._analyser.fftSize = 2048;
    this._meterBuf = new Float32Array(this._analyser.fftSize);
    this.limiter.connect(this._analyser);
    this._captureChunks = null;
    this._mediaDest = null;
    this._mediaRecorder = null;

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this._sfxVol;
    this.sfxBus.connect(this.master);

    this.bgmBus = this.ctx.createGain();
    this.bgmBus.gain.value = this._bgmVol * 0.55;
    this.bgmBus.connect(this.master);

    const length = Math.floor(this.ctx.sampleRate * 0.9);
    this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    this._bindUnlock();
    this._bindResume();
    this._preloadSfx();
  }

  /** Decode every original SFX clip once (js/sfx-table.js, ~0.4MB of ogg). */
  _preloadSfx() {
    this._sfxBuf = new Map();
    this._sfxNext = new Map();
    this._sfxActive = new Map();
    if (!this.ctx || typeof fetch === 'undefined' || location.protocol === 'file:') return;
    const stems = new Set(Object.values(SFX_TABLE).flatMap((e) => e.files));
    for (const stem of stems) {
      fetch(`assets/audio/sfx/${stem}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((a) => this.ctx.decodeAudioData(a))
        .then((buf) => this._sfxBuf.set(stem, buf))
        .catch(() => { /* procedural fallback stays */ });
    }
  }

  /**
   * Original SFX for a cue: rotates variants, small pitch jitter on rapid cues, and a voice
   * cap per cue (oldest instance stops) so kill chains / autofire never pile up.
   * @returns {boolean} false when no clip is loaded (caller falls back to the synth).
   */
  _playSfx(key, style = '') {
    const hitKey = key === 'enemyHit' && HIT_CLASS[style] ? `enemyHit:${HIT_CLASS[style]}` : null;
    const tableKey = hitKey && SFX_TABLE[hitKey] ? hitKey
      : key === 'shoot' ? (SFX_TABLE[`shoot:${style}`] ? `shoot:${style}` : 'shoot') : key;
    const e = SFX_TABLE[tableKey];
    if (!e || e.loop || !this._sfxBuf) return false;
    const n = e.files.length;
    const i = (this._sfxNext.get(tableKey) || 0) % n;
    const buf = this._sfxBuf.get(e.files[i]);
    if (!buf) return false;
    this._sfxNext.set(tableKey, i + 1);
    const now = this.ctx.currentTime;
    const active = (this._sfxActive.get(tableKey) || []).filter((v) => v.end > now);
    // Enemy hits: at most two ringing at once across all hit classes (oldest cut).
    const pool = key === 'enemyHit'
      ? [...this._sfxActive].filter(([k]) => k.startsWith('enemyHit')).flatMap(([, l]) => l)
        .filter((v) => v.end > now).sort((x, y) => x.end - y.end)
      : active;
    const cap = key === 'enemyHit' ? 2 : (e.voices || 4);
    while (pool.length >= cap) {
      const old = pool.shift();
      old.end = now;
      try {
        old.g.gain.setTargetAtTime(0, now, 0.01);
        old.src.stop(now + 0.04);
      } catch { /* */ }
    }
    for (let j = active.length - 1; j >= 0; j--) if (active[j].end <= now) active.splice(j, 1);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    const rate = 1 + (Math.random() * 2 - 1) * (e.jitter || 0);
    src.playbackRate.value = rate;
    g.gain.value = SFX_GAIN[tableKey] ?? 1;
    src.connect(g).connect(this.sfxBus);
    src.start(now);
    active.push({ src, g, end: now + buf.duration / rate });
    this._sfxActive.set(tableKey, active);
    return true;
  }

  /**
   * Pilot voice line (assets/audio/voice/<stem>.ogg, js/pilot-voices.js) on its own channel:
   * a new line cuts the previous one (lines never talk over each other) and the BGM dips
   * under it. Decoded once and cached.
   */
  playVoice(stem, gain = 1) {
    if (!stem || !this.ctx || this.muted || location.protocol === 'file:') return;
    this._voiceBuf ||= new Map();
    let job = this._voiceBuf.get(stem);
    if (!job) {
      job = fetch(`assets/audio/voice/${stem}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((a) => this.ctx.decodeAudioData(a))
        .catch(() => null);
      this._voiceBuf.set(stem, job);
    }
    const asked = this.ctx.currentTime;
    const token = (this._voiceToken = (this._voiceToken || 0) + 1);
    job.then((buf) => {
      if (!buf || this.muted || token !== this._voiceToken || this.ctx.currentTime - asked > 0.6) return;
      if (this._voice) {
        try { this._voice.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); this._voice.src.stop(this.ctx.currentTime + 0.08); } catch { /* */ }
      }
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = buf;
      g.gain.value = gain;
      src.connect(g).connect(this.sfxBus);
      src.start();
      this._voice = { src, g };
      this._voiceEnd = this.ctx.currentTime + buf.duration;
      this.duckBgm(0.6, Math.max(0.2, buf.duration - 0.4), 0.5);
    });
  }

  /**
   * Announcer line (assets/audio/voice/ann_*.ogg, original minigame announcer) on its own
   * channel: skipped while a pilot line is playing so it never talks over / cuts the pilot;
   * a new announcement replaces the previous one.
   */
  playAnnounce(stem, gain = 0.9, { waitForPilot = false } = {}) {
    if (!stem || !this.ctx || this.muted || location.protocol === 'file:') return;
    const busyFor = (this._voiceEnd || 0) - this.ctx.currentTime;
    if (busyFor > 0) {
      // Queued lines (e.g. "Perfect" after a clear) wait for the pilot if it is short.
      if (waitForPilot && busyFor < 4) setTimeout(() => this.playAnnounce(stem, gain), busyFor * 1000 + 150);
      return;
    }
    this._voiceBuf ||= new Map();
    let job = this._voiceBuf.get(stem);
    if (!job) {
      job = fetch(`assets/audio/voice/${stem}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((a) => this.ctx.decodeAudioData(a))
        .catch(() => null);
      this._voiceBuf.set(stem, job);
    }
    const asked = this.ctx.currentTime;
    job.then((buf) => {
      if (!buf || this.muted || this.ctx.currentTime - asked > 0.6) return;
      if (this.ctx.currentTime < (this._voiceEnd || 0)) return;
      if (this._announce) {
        try { this._announce.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); this._announce.src.stop(this.ctx.currentTime + 0.08); } catch { /* */ }
      }
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = buf;
      g.gain.value = gain;
      src.connect(g).connect(this.sfxBus);
      src.start();
      this._announce = { src, g };
      this.duckBgm(0.7, Math.max(0.2, buf.duration - 0.3), 0.4);
    });
  }

  /** Decode a pilot's lines ahead of time (sortie). */
  preloadVoices(stems) {
    if (!this.ctx || location.protocol === 'file:') return;
    this._voiceBuf ||= new Map();
    for (const stem of stems) {
      if (!stem || this._voiceBuf.has(stem)) continue;
      this._voiceBuf.set(stem, fetch(`assets/audio/voice/${stem}.ogg`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((a) => this.ctx.decodeAudioData(a)).catch(() => null));
    }
  }

  _bindUnlock() {
    if (this._unlockBound || !this.ctx) return;
    this._unlockBound = true;
    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // pointerdown covers mouse + modern touch; touchstart helps older iOS Safari.
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  /** iOS / Safari: resume after tab hide, interruption, or lock. */
  _bindResume() {
    if (this._resumeBound || !this.ctx) return;
    this._resumeBound = true;
    this._onVisibility = () => {
      if (document.visibilityState === 'visible') this.unlock();
    };
    this._onPageShow = () => this.unlock();
    this._onCtxState = () => {
      const st = this.ctx?.state;
      if (st === 'interrupted' || st === 'suspended') {
        if (document.visibilityState === 'visible') this.unlock();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('pageshow', this._onPageShow);
    try { this.ctx.addEventListener('statechange', this._onCtxState); } catch { /* */ }
  }

  /** Resume AudioContext after autoplay policy; start BGM if requested. */
  unlock() {
    if (!this.ctx) return;
    const run = () => {
      this.unlocked = this.ctx.state === 'running';
      // Avoid infinite recursion: startBgm() calls unlock(), which must not
      // synchronously re-enter startBgm while that call is still on the stack.
      // After async resume(), _inStartBgm is false so deferred BGM start still runs.
      if (this._bgmWanted && !this.muted && !this._inStartBgm) {
        this.startBgm(this._bgmMood);
      }
    };
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(run).catch(() => {});
    } else {
      run();
    }
  }

  applySettings(settings) {
    if (!settings) return;
    this.setBgmVolume(settings.bgmVolume ?? this._bgmVol);
    this.setSfxVolume(settings.sfxVolume ?? this._sfxVol);
    this.setMuted(!!settings.muted);
  }

  setBgmVolume(v) {
    this._bgmVol = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.bgmBus && this.ctx) {
      const target = this.muted ? 0 : this._bgmVol * 0.55;
      const t = this.ctx.currentTime;
      // Cancel in-flight duck ramps so OPTIONS slider always wins.
      try { this.bgmBus.gain.cancelScheduledValues(t); } catch { /* */ }
      this.bgmBus.gain.setTargetAtTime(target, t, 0.04);
    }
  }

  /**
   * Brief BGM sidechain so bomb / WARNING / CLEAR stingers read over the pad.
   * Depth 0–1; hold/release in seconds. No-op when muted or BGM silent.
   */
  duckBgm(depth = 0.42, hold = 0.28, release = 0.55) {
    if (!this.ctx || !this.bgmBus || this.muted) return;
    const base = this._bgmVol * 0.55;
    if (base <= 0.0001) return;
    const d = Math.max(0, Math.min(0.85, Number(depth) || 0));
    if (d <= 0) return;
    const t = this.ctx.currentTime;
    const ducked = Math.max(0.0001, base * (1 - d));
    const atk = 0.045;
    const h = Math.max(0.05, Number(hold) || 0.28);
    const rel = Math.max(0.08, Number(release) || 0.55);
    try {
      const cur = this.bgmBus.gain.value;
      this.bgmBus.gain.cancelScheduledValues(t);
      this.bgmBus.gain.setValueAtTime(cur, t);
      this.bgmBus.gain.linearRampToValueAtTime(ducked, t + atk);
      this.bgmBus.gain.linearRampToValueAtTime(ducked, t + atk + h);
      this.bgmBus.gain.linearRampToValueAtTime(base, t + atk + h + rel);
    } catch { /* */ }
  }

  setSfxVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.sfxBus && this.ctx) {
      const target = this.muted ? 0 : this._sfxVol;
      this.sfxBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  getBgmVolume() { return this._bgmVol; }
  getSfxVolume() { return this._sfxVol; }

  /** Lazy-load optional file once; only when stem is listed in PRESENT_AUDIO_STEMS. */
  _tryLoadFile(key, fileStem = null) {
    if (!this.ctx || this.buffers.has(key)) return;
    const tryKey = fileStem ? `${key}::${fileStem}` : key;
    if (this._fileTried.has(tryKey)) return;
    // Skip fetch on file:// to avoid CORS noise; http(s) servers can drop in assets/audio/*.
    if (location.protocol === 'file:') {
      this._fileTried.add(tryKey);
      return;
    }
    const base = fileStem || FILE_MAP[key];
    if (!base) {
      this._fileTried.add(tryKey);
      return;
    }
    // No probing: missing drop-ins used to generate 3×ext 404s per cue (~24×/session).
    if (!PRESENT_AUDIO_STEMS.has(base)) {
      this._fileTried.add(tryKey);
      return;
    }
    this._fileTried.add(tryKey);
    (async () => {
      for (const ext of ['ogg', 'mp3', 'wav']) {
        try {
          const res = await fetch(`assets/audio/${base}.${ext}`);
          if (!res.ok) continue;
          const arr = await res.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(arr.slice(0));
          this.buffers.set(key, buf);
          if (key.startsWith('bgm') && this._bgmWanted && !this.muted) {
            this.stopBgm(true);
            this.startBgm(this._bgmMood);
          }
          return;
        } catch {
          /* try next extension */
        }
      }
    })();
  }

  /**
   * Original skill SFX (assets/audio/skill/<stem>.ogg, from the Unity clips'
   * EventSoundPlaySFXPrefab). Decoded once and cached; played on the SFX bus so
   * mute / SFX volume apply.
   */
  preloadClip(stem) {
    if (!this.ctx || location.protocol === 'file:') return null;
    this._clips = this._clips || new Map();
    if (this._clips.has(stem)) return this._clips.get(stem);
    const job = fetch(`assets/audio/skill/${stem}.ogg`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.status))))
      .then((arr) => this.ctx.decodeAudioData(arr))
      .catch(() => null);
    this._clips.set(stem, job);
    return job;
  }

  playClip(stem, gain = 0.9) {
    if (!this.ctx || this.muted) return;
    const job = this.preloadClip(stem);
    if (!job) return;
    const at = this.ctx.currentTime;
    job.then((buf) => {
      if (!buf || this.muted) return;
      // Late decode: skip clips that would start well behind their event.
      if (this.ctx.currentTime - at > 0.35) return;
      const src = this.ctx.createBufferSource();
      const amp = this.ctx.createGain();
      amp.gain.value = gain;
      src.buffer = buf;
      src.connect(amp).connect(this.sfxBus);
      src.start();
    });
  }

  toggle() {
    return this.setMuted(!this.muted);
  }

  setMuted(m) {
    const next = !!m;
    if (this.muted === next) return this.muted;
    this.muted = next;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this._masterVol, this.ctx.currentTime, 0.03);
    }
    if (this.muted) {
      this.stopChargeHold();
      this.stopBgm(true);
    } else if (this._bgmWanted) {
      this.startBgm(this._bgmMood);
    }
    return this.muted;
  }

  /**
   * While holding shoot to charge: soft rising drone + sparse ticks.
   * No spam — one loop, pitch/gain follow charge level; ticks ~7/sec max.
   */
  setChargeHold(active, level = 0) {
    if (!active || this.muted) {
      this.stopChargeHold();
      return;
    }
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      this.unlock();
      return;
    }
    const amt = Math.max(0, Math.min(1, Number(level) || 0));
    if (!this._chargeHold) this._startChargeHold();
    const h = this._chargeHold;
    if (!h) return;
    const t = this.ctx.currentTime;
    if (h.sample) {
      // Loop swells and rises with the charge level.
      try {
        h.src.playbackRate.setTargetAtTime(0.85 + amt * 0.35, t, 0.05);
        h.gain.gain.setTargetAtTime(0.35 + amt * 0.65, t, 0.04);
      } catch { /* */ }
      return;
    }
    const freq = 115 + amt * 170;
    const gain = 0.005 + amt * 0.009;
    try {
      h.osc.frequency.setTargetAtTime(freq, t, 0.05);
      h.osc2.frequency.setTargetAtTime(freq * 2.01, t, 0.05);
      h.gain.gain.setTargetAtTime(gain, t, 0.04);
    } catch { /* */ }

    // The charge cue stays under autofire; repeated high-pitched ticks masked
    // the projectile launch and made holding Z sound like an alarm.
  }

  /**
   * Peregrinus spiral laser: one seamless original laser loop while the beam is on (it used to
   * re-fire a one-shot per volley, stuttering up to 7x/s under a continuous beam).
   */
  setBeamHold(active) {
    if (!active || this.muted || !this.ctx || this.ctx.state !== 'running') {
      const h = this._beamHold;
      if (!h) return;
      this._beamHold = null;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      try {
        h.gain.gain.cancelScheduledValues(t);
        h.gain.gain.setTargetAtTime(0.0001, t, 0.04);
        h.src.stop(t + 0.15);
      } catch { /* */ }
      return;
    }
    if (this._beamHold) return;
    const buf = this._sfxBuf?.get(SFX_TABLE.beamHold?.files?.[0]);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buf;
    src.loop = true;
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.setTargetAtTime(1, t, 0.03);
    src.connect(gain).connect(this.sfxBus);
    src.start(t);
    this._beamHold = { src, gain };
  }

  _startChargeHold() {
    if (!this.ctx || this.muted || this.ctx.state !== 'running' || this._chargeHold) return;
    this._tryLoadFile('chargeHold');
    const t = this.ctx.currentTime;
    // Original energy loop (atk_energy_loop) when decoded; synth drone otherwise.
    const loopBuf = this._sfxBuf?.get(SFX_TABLE.chargeHold?.files?.[0]);
    if (loopBuf) {
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = loopBuf;
      src.loop = true;
      gain.gain.value = 0.0001;
      src.connect(gain).connect(this.sfxBus);
      src.start(t);
      gain.gain.setTargetAtTime(0.35, t, 0.06);
      this._chargeHold = { src, gain, sample: true };
      this._chargeHoldTickAt = t;
      return;
    }
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.value = 180;
    osc2.frequency.value = 360;
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    gain.gain.value = 0.0001;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc2.start(t);
    gain.gain.setTargetAtTime(0.005, t, 0.06);
    this._chargeHold = { osc, osc2, filter, gain };
    this._chargeHoldTickAt = t;
  }

  stopChargeHold() {
    const h = this._chargeHold;
    if (!h) return;
    this._chargeHold = null;
    this._chargeHoldTickAt = 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setTargetAtTime(0.0001, t, 0.03);
      if (h.sample) h.src.stop(t + 0.08);
      else {
        h.osc.stop(t + 0.08);
        h.osc2.stop(t + 0.08);
      }
    } catch { /* */ }
  }

  tone(freq, duration, type = 'triangle', gain = 0.2, endFreq = freq, delay = 0, dest = null) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + duration);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp).connect(dest || this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  hiss(duration, gain, cutoff = 900, delay = 0) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(amp).connect(this.sfxBus);
    source.start(t);
    source.stop(t + duration);
  }

  /** Soft click / metallic ping helper for layered SFX. */
  click(freq, duration = 0.04, gain = 0.08, delay = 0) {
    this.tone(freq, duration, 'sine', gain, freq * 1.6, delay);
    this.tone(freq * 2.02, duration * 0.7, 'triangle', gain * 0.45, freq * 2.4, delay);
  }

  _playBuffer(key, opts = {}) {
    const buf = this.buffers.get(key);
    if (!buf || !this.ctx || this.muted || this.ctx.state !== 'running') return false;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    src.loop = !!opts.loop;
    g.gain.value = opts.gain ?? 1;
    src.connect(g).connect(opts.bus || this.sfxBus);
    src.start();
    if (opts.loop) {
      this.bgmNode = src;
      this.bgmGain = g;
    }
    return true;
  }

  /**
   * Start / switch stage BGM. Accepts mood string, stage index, or stage object with `.scene`.
   */
  startBgm(moodOrStage = this._bgmMood) {
    this._bgmWanted = true;
    this._bgmMood = moodForStage(moodOrStage);
    if (!this.ctx || this.muted) return;
    // An original track was asked for (stage / leader / pilot theme): (re)start it instead.
    if (this._trackWanted) {
      this.playBgmTrack(this._trackWanted);
      return;
    }
    this._inStartBgm = true;
    try {
      this.unlock();
      this._tryLoadFile('bgm');
      const motif = STAGE_BGM[this._bgmMood] || STAGE_BGM.city;
      for (const stem of motif.fileKeys) this._tryLoadFile(`bgm_${stem}`, stem);
      if (this.ctx.state !== 'running') return;
      this.stopBgm(true);
      // Clear leftover CLEAR/bomb duck ramps so the next motif opens at full pad.
      if (this.bgmBus) {
        const base = this._bgmVol * 0.55;
        const t = this.ctx.currentTime;
        try {
          this.bgmBus.gain.cancelScheduledValues(t);
          this.bgmBus.gain.setValueAtTime(base, t);
        } catch { /* */ }
      }

      // Prefer stage-specific file, then generic bgm.*, else procedural motif.
      for (const stem of motif.fileKeys) {
        const bufKey = `bgm_${stem}`;
        if (this.buffers.has(bufKey) && this._playBuffer(bufKey, { loop: true, gain: 0.55, bus: this.bgmBus })) {
          return;
        }
      }
      if (this._playBuffer('bgm', { loop: true, gain: 0.55, bus: this.bgmBus })) return;
      this._startProceduralBgm(this._bgmMood);
    } finally {
      this._inStartBgm = false;
    }
  }

  /**
   * Original BGM track (assets/audio/bgm/<stem>.ogg, js/bgm-tracks.js), streamed through an
   * <audio> element into the BGM bus (no 50MB+ decoded buffers on phones). Crossfades from
   * the current track; the procedural motif covers the gap while it buffers / if it fails.
   */
  playBgmTrack(stem, { fade = 0.9 } = {}) {
    if (!stem) return false;
    this._trackWanted = stem;
    this._bgmWanted = true;
    if (!this.ctx || this.muted || typeof Audio === 'undefined' || location.protocol === 'file:') return false;
    const cur = this._track;
    if (cur && cur.stem === stem && !cur.dead) {
      if (cur.el.paused) cur.el.play().catch(() => {});
      return true;
    }
    // unlock() may synchronously re-enter startBgm -> playBgmTrack; guard like startBgm does.
    const reentry = this._inStartBgm;
    this._inStartBgm = true;
    try { this.unlock(); } finally { this._inStartBgm = reentry; }
    // Procedural / buffer loop off; the old file track fades out.
    this._clearArpReschedule();
    this._intensityNodes = null;
    if (this.bgmNode) {
      try { this.bgmNode.stop(); } catch { /* */ }
      this.bgmNode = null;
      this.bgmGain = null;
    }
    this._fadeOutTrack(cur, fade);
    const el = new Audio(`assets/audio/bgm/${stem}.ogg`);
    el.loop = true;
    el.preload = 'auto';
    const g = this.ctx.createGain();
    g.gain.value = 0;
    let srcNode = null;
    try {
      srcNode = this.ctx.createMediaElementSource(el);
      srcNode.connect(g).connect(this.bgmBus);
    } catch {
      srcNode = null;
    }
    const tr = { stem, el, g, src: srcNode, dead: false };
    this._track = tr;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(BGM_TRACK_GAIN, t, Math.max(0.05, fade / 3));
    el.play().catch(() => {
      // Autoplay gate: unlock() re-runs startBgm -> playBgmTrack after the first gesture.
    });
    // Hosts without HTTP range support can't seek: restart by hand if loop ends the stream.
    el.addEventListener('ended', () => {
      if (this._track === tr && !tr.dead && !this.muted) {
        try { el.currentTime = 0; } catch { /* */ }
        el.play().catch(() => {});
      }
    });
    el.addEventListener('error', () => {
      if (this._track === tr && !tr.dead) {
        tr.dead = true;
        this._startProceduralBgm(this._bgmMood);
      }
    }, { once: true });
    if (!this._trackVisBound && typeof document !== 'undefined') {
      this._trackVisBound = true;
      document.addEventListener('visibilitychange', () => {
        const tk = this._track;
        if (!tk || tk.dead) return;
        if (document.hidden) tk.el.pause();
        else if (!this.muted && this._bgmWanted) tk.el.play().catch(() => {});
      });
    }
    return true;
  }

  _fadeOutTrack(tr, fade = 0.6) {
    if (!tr || tr.dead) return;
    tr.dead = true;
    try {
      tr.g.gain.setTargetAtTime(0, this.ctx.currentTime, Math.max(0.05, fade / 3));
    } catch { /* */ }
    setTimeout(() => {
      try { tr.el.pause(); } catch { /* */ }
      try { tr.src?.disconnect(); tr.g.disconnect(); } catch { /* */ }
      tr.el.removeAttribute('src');
      try { tr.el.load(); } catch { /* */ }
    }, fade * 1000 + 200);
  }

  /** Current original track stem (or null). */
  get bgmTrack() { return this._track && !this._track.dead ? this._track.stem : null; }

  setStageBgm(moodOrStage) {
    const next = moodForStage(moodOrStage);
    if (next === this._bgmMood && this.bgmNode) return;
    this.startBgm(next);
  }

  /**
   * Arcade pacing sidechain for procedural BGM (file loops stay at bus gain).
   * @param {number} level 0–1
   */
  setBgmIntensity(level = 0.35) {
    this._bgmIntensity = Math.max(0, Math.min(1, Number(level) || 0));
    const nodes = this._intensityNodes;
    if (!nodes || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const k = this._bgmIntensity;
    try {
      if (nodes.padG) nodes.padG.gain.setTargetAtTime(nodes.padBase * (0.75 + k * 0.55), t, 0.12);
      if (nodes.arpMul) nodes.arpMul.gain.setTargetAtTime(0.65 + k * 0.7, t, 0.1);
      if (nodes.pulseG) nodes.pulseG.gain.setTargetAtTime(nodes.pulseBase * (0.55 + k * 0.9), t, 0.1);
      if (nodes.filter) {
        const base = nodes.filterBase || 1400;
        nodes.filter.frequency.setTargetAtTime(base * (0.85 + k * 0.45), t, 0.15);
      }
    } catch { /* */ }
  }

  _startProceduralBgm(mood = 'city') {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const m = STAGE_BGM[mood] || STAGE_BGM.city;
    const t0 = this.ctx.currentTime;
    const stops = [];

    const master = this.ctx.createGain();
    master.gain.value = 1;
    master.connect(this.bgmBus);

    // Layer 1 — pad chord
    const padG = this.ctx.createGain();
    const padBase = m.padGain;
    padG.gain.value = padBase * (0.75 + this._bgmIntensity * 0.55);
    padG.connect(master);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const filterBase = m.color === 'dark' ? 900 : m.color === 'eerie' ? 1200 : m.color === 'martial' ? 2000 : 1800;
    filter.frequency.value = filterBase * (0.85 + this._bgmIntensity * 0.45);
    filter.Q.value = 0.7;
    filter.connect(padG);

    m.pad.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.value = 0.9 / m.pad.length;
      o.connect(g).connect(filter);
      o.start(t0);
      stops.push(o);
    });

    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = m.lfo;
    lfoG.gain.value = m.padGain * 0.35;
    lfo.connect(lfoG).connect(padG.gain);
    lfo.start(t0);
    stops.push(lfo);

    // Layer 2 — arpeggio motif (finite AutomationEvents — reschedule for long stages)
    const arpMul = this.ctx.createGain();
    arpMul.gain.value = 0.65 + this._bgmIntensity * 0.7;
    arpMul.connect(master);
    const arpG = this.ctx.createGain();
    arpG.gain.value = 0.0001;
    arpG.connect(arpMul);
    const arp = this.ctx.createOscillator();
    arp.type = m.color === 'martial' ? 'square' : 'triangle';
    arp.frequency.value = m.arp[0];
    arp.connect(arpG);
    arp.start(t0);
    stops.push(arp);

    const beat = 60 / (m.arpHz * 15); // step duration
    const steps = 64;
    this._scheduleArpWindow(arp, arpG, m, beat, steps, t0);
    // Keep a soft sustain bed under the sequenced notes
    const bed = this.ctx.createOscillator();
    const bedG = this.ctx.createGain();
    bed.type = 'sine';
    bed.frequency.value = m.arp[0] / 2;
    bedG.gain.value = m.arpGain * 0.25;
    bed.connect(bedG).connect(arpMul);
    bed.start(t0);
    stops.push(bed);

    // Reschedule arp automation before the window ends (~40–50s → silence without this).
    this._clearArpReschedule();
    this._arpState = { arp, arpG, motif: m, beat, steps };
    const windowMs = Math.max(4000, Math.floor(steps * beat * 1000) - 800);
    this._arpRescheduleTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this._arpState || this.ctx.state !== 'running') return;
      if (!this.bgmNode || this.bgmNode._proc !== true) return;
      try {
        const { arp: a, arpG: g, motif, beat: b, steps: s } = this._arpState;
        this._scheduleArpWindow(a, g, motif, b, s, this.ctx.currentTime + 0.02);
      } catch { /* */ }
    }, windowMs);

    // Layer 3 — pulse / kick bed
    const pulse = this.ctx.createOscillator();
    const pulseG = this.ctx.createGain();
    const pulseBase = m.pulseGain;
    pulse.type = m.pulseType;
    pulse.frequency.value = m.pulse;
    pulseG.gain.value = pulseBase * (0.55 + this._bgmIntensity * 0.9);
    pulse.connect(pulseG).connect(master);
    pulse.start(t0);
    stops.push(pulse);

    this._intensityNodes = { padG, padBase, arpMul, pulseG, pulseBase, filter, filterBase };

    // Layer 4 — soft noise texture (hive/abyss)
    if (m.color === 'eerie' || m.color === 'dark') {
      const src = this.ctx.createBufferSource();
      const nf = this.ctx.createBiquadFilter();
      const ng = this.ctx.createGain();
      src.buffer = this.noise;
      src.loop = true;
      nf.type = 'bandpass';
      nf.frequency.value = m.color === 'dark' ? 420 : 780;
      nf.Q.value = 0.6;
      ng.gain.value = m.color === 'dark' ? 0.018 : 0.012;
      src.connect(nf).connect(ng).connect(master);
      src.start(t0);
      stops.push(src);
    }

    this._procStops = stops;
    this.bgmNode = {
      _proc: true,
      stop: () => {
        for (const n of stops) {
          try { n.stop(); } catch { /* */ }
        }
      },
    };
    this.bgmGain = master;
  }

  /** Schedule one finite arp automation window (called at start + on reschedule). */
  _scheduleArpWindow(arp, arpG, m, beat, steps, t0) {
    for (let i = 0; i < steps; i++) {
      const t = t0 + i * beat;
      const note = m.arp[i % m.arp.length];
      const accent = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.7 : 0.45;
      try {
        arp.frequency.setValueAtTime(note, t);
        arpG.gain.cancelScheduledValues(t);
        arpG.gain.setValueAtTime(0.0001, t);
        arpG.gain.exponentialRampToValueAtTime(m.arpGain * accent, t + 0.01);
        arpG.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.85);
      } catch { /* */ }
    }
  }

  _clearArpReschedule() {
    if (this._arpRescheduleTimer) {
      clearInterval(this._arpRescheduleTimer);
      this._arpRescheduleTimer = null;
    }
    this._arpState = null;
  }

  stopBgm(keepWanted = false) {
    if (!keepWanted) {
      this._bgmWanted = false;
      this._trackWanted = null;
    }
    if (this._track) {
      this._fadeOutTrack(this._track, keepWanted ? 0.15 : 0.5);
      this._track = null;
    }
    this._clearArpReschedule();
    this._intensityNodes = null;
    if (this.bgmNode) {
      try { this.bgmNode.stop(); } catch { /* */ }
      this.bgmNode = null;
      this.bgmGain = null;
    }
    this._procStops = [];
  }

  _playShot(style) {
    const variant = (this._shotVariant = (this._shotVariant || 0) + 1) % 3;
    const pitch = [0.96, 1, 1.035][variant];
    // Soft ceiling — autofire must never stack into a piercing wall of noise.
    switch (style) {
      case 'shell': // Merlin: a short launcher thump with an airy rocket tail.
        this.tone(165 * pitch, 0.085, 'triangle', 0.06, 82 * pitch);
        this.hiss(0.09, 0.032, 850);
        break;
      case 'tracer': // Constantia: dry rifle snap.
        this.hiss(0.038, 0.052, 2500);
        this.tone(230 * pitch, 0.042, 'triangle', 0.048, 115 * pitch);
        this.click(980 * pitch, 0.02, 0.028);
        break;
      case 'cleave': // LRL: low blade whoosh.
        this.hiss(0.08, 0.032, 1100);
        this.tone(220 * pitch, 0.095, 'sine', 0.048, 90 * pitch);
        break;
      case 'plasmaslash': // Labiata: brighter plasma edge than LRL cleave.
        this.hiss(0.07, 0.03, 1600);
        this.tone(310 * pitch, 0.08, 'triangle', 0.045, 140 * pitch);
        this.click(720 * pitch, 0.025, 0.03);
        break;
      case 'lightning': // Fafnir: brief electric crackle.
        this.hiss(0.04, 0.042, 3400);
        this.tone(520 * pitch, 0.045, 'square', 0.026, 260 * pitch);
        this.tone(780 * pitch, 0.03, 'triangle', 0.018, 400 * pitch, 0.01);
        break;
      case 'x36capsule': // Peregrinus human form: bright, quick energy zap.
        this.hiss(0.02, 0.02, 4400);
        this.tone(940 * pitch, 0.024, 'triangle', 0.015, 640 * pitch);
        break;
      case 'x36orb': // Peregrinus human form: soft, heavy plasma whoom.
        this.hiss(0.05, 0.03, 1600);
        this.tone(180 * pitch, 0.07, 'sine', 0.03, 120 * pitch);
        break;
      case 'falconshot': // Peregrinus: sharp, airy dart whip.
        this.hiss(0.02, 0.022, 4600);
        this.tone(760 * pitch, 0.022, 'sawtooth', 0.012, 520 * pitch);
        break;
      case 'marionshot': // Constantia (Gunbird Marion): light, sparkly magic chime.
        this.hiss(0.018, 0.016, 5200);
        this.tone(1180 * pitch, 0.03, 'sine', 0.016, 880 * pitch);
        break;
      case 'hayateshot': // Labiata Ki-84: crisp glassy crystal shard volley.
        this.hiss(0.024, 0.024, 3800);
        this.tone(640 * pitch, 0.028, 'triangle', 0.018, 420 * pitch);
        break;
      case 'shindenshot': // Sleipnir J7W: heavier, lower cannon thud than the P-38 rattle.
        this.hiss(0.026, 0.03, 2200);
        this.tone(250 * pitch, 0.032, 'square', 0.022, 140 * pitch);
        break;
      case 'pancakeshot': // Express XF5U: soft, airy pellet puff for the wide fan.
        this.hiss(0.03, 0.022, 3400);
        this.tone(520 * pitch, 0.03, 'triangle', 0.02, 330 * pitch);
        break;
      case 'p38shot': // Griffin P-38: light, quick vulcan rattle (fires every 0.1s).
        this.hiss(0.022, 0.026, 2900);
        this.tone(410 * pitch, 0.026, 'square', 0.018, 230 * pitch);
        break;
      case 'coffinround': // Eternity: restrained mechanical burst.
        this.hiss(0.028, 0.038, 1700);
        this.tone(175 * pitch, 0.034, 'square', 0.03, 110 * pitch);
        break;
      case 'railbolt': // Emily: weighty rail discharge.
        this.hiss(0.07, 0.048, 2300);
        this.tone(300 * pitch, 0.1, 'triangle', 0.065, 78 * pitch);
        this.tone(90, 0.08, 'sine', 0.04, 50, 0.02);
        break;
      case 'foxflame': // Hirume: soft flame puff.
        this.hiss(0.055, 0.024, 1650);
        this.tone(375 * pitch, 0.055, 'sine', 0.028, 230 * pitch);
        this.tone(520 * pitch, 0.04, 'triangle', 0.016, 360 * pitch, 0.015);
        break;
      default:
        this.hiss(0.05, 0.03, 1650);
        this.tone(290 * pitch, 0.055, 'triangle', 0.036, 155 * pitch);
    }
  }

  _playCharge(style) {
    switch (style) {
      case 'shell':
        this.tone(145, 0.18, 'triangle', 0.13, 58);
        this.hiss(0.2, 0.09, 1050);
        this.tone(82, 0.17, 'sine', 0.075, 38, 0.025);
        break;
      case 'tracer':
        this.click(620, 0.05, 0.12);
        this.tone(260, 0.1, 'triangle', 0.14, 880);
        this.hiss(0.08, 0.1, 2800);
        break;
      case 'cleave':
        this.hiss(0.16, 0.12, 900);
        this.tone(140, 0.2, 'sawtooth', 0.14, 60);
        this.tone(90, 0.18, 'sine', 0.08, 40, 0.04);
        break;
      case 'plasmaslash':
        this.hiss(0.14, 0.11, 1400);
        this.tone(200, 0.16, 'triangle', 0.13, 720);
        this.tone(480, 0.1, 'sine', 0.08, 960, 0.03);
        break;
      case 'lightning':
        this.hiss(0.12, 0.14, 3600);
        this.tone(360, 0.12, 'square', 0.12, 900);
        this.tone(720, 0.1, 'triangle', 0.09, 1200, 0.03);
        break;
      case 'coffinround':
        this.tone(150, 0.14, 'square', 0.12, 70);
        this.hiss(0.12, 0.1, 1200);
        this.click(400, 0.05, 0.08);
        break;
      case 'railbolt':
        this.hiss(0.18, 0.12, 2200);
        this.tone(280, 0.2, 'triangle', 0.15, 70);
        this.tone(110, 0.16, 'sine', 0.09, 45, 0.04);
        break;
      case 'foxflame':
      default:
        this.click(480, 0.05, 0.12);
        this.tone(180, 0.12, 'sawtooth', 0.16, 720);
        this.tone(520, 0.1, 'triangle', 0.12, 1100, 0.03);
        this.hiss(0.1, 0.14, 2400);
    }
  }

  _playSpecial(style, level = 1) {
    const lv = Math.max(1, Math.min(3, level | 0));
    const g = 0.1 + lv * 0.035;
    if (style === 'shell') {
      this.hiss(0.2 + lv * 0.04, 0.12 + lv * 0.02, 950);
      this.tone(135, 0.26 + lv * 0.03, 'sawtooth', 0.12 + lv * 0.02, 48);
      if (lv >= 2) this.tone(78, 0.22, 'sine', 0.08, 34, 0.05);
      if (lv >= 3) this.tone(200, 0.18, 'triangle', 0.08, 90, 0.1);
      return;
    }
    if (style === 'tracer') {
      this.click(700, 0.05, 0.1);
      this.tone(320, 0.14 + lv * 0.03, 'triangle', g, 980);
      if (lv >= 2) this.tone(520, 0.12, 'sine', g * 0.7, 1200, 0.05);
      if (lv >= 3) this.hiss(0.16, 0.12, 2600);
      return;
    }
    if (style === 'cleave' || style === 'plasmaslash') {
      this.hiss(0.16 + lv * 0.03, 0.12 + lv * 0.02, style === 'plasmaslash' ? 1600 : 1000);
      this.tone(180, 0.22 + lv * 0.04, 'sawtooth', g, 70);
      if (lv >= 3) this.tone(440, 0.16, 'triangle', 0.09, 880, 0.08);
      return;
    }
    if (style === 'lightning') {
      this.hiss(0.14, 0.14, 3200);
      this.tone(280 + lv * 40, 0.2, 'square', g, 900);
      if (lv >= 2) this.tone(560, 0.14, 'triangle', 0.08, 1100, 0.04);
      if (lv >= 3) this.tone(120, 0.2, 'sine', 0.07, 50, 0.06);
      return;
    }
    if (style === 'railbolt') {
      this.hiss(0.2, 0.14, 2100);
      this.tone(260, 0.24 + lv * 0.03, 'triangle', g + 0.02, 70);
      if (lv >= 2) this.tone(90, 0.18, 'sine', 0.08, 40, 0.04);
      if (lv >= 3) this.click(540, 0.06, 0.1);
      return;
    }
    if (style === 'coffinround') {
      this.tone(160, 0.18 + lv * 0.03, 'square', g, 80);
      this.hiss(0.12 + lv * 0.03, 0.1, 1400);
      if (lv >= 3) this.tone(320, 0.14, 'triangle', 0.08, 600, 0.08);
      return;
    }
    // foxflame / default — Lv1 soft flare → Lv3 rising triad (still < bomb boom)
    this.tone(220, 0.2 + lv * 0.03, 'sawtooth', g, 700 + lv * 80);
    if (lv >= 2) this.tone(440, 0.16, 'triangle', 0.09, 980, 0.05);
    if (lv >= 3) this.tone(660, 0.14, 'sine', 0.08, 1100, 0.1);
    this.hiss(0.14 + lv * 0.02, 0.12 + lv * 0.02, 2400);
  }

  _playBomb(style) {
    // Shared emergency weight — character color only tints the upper layer.
    this.hiss(0.55, 0.32, 1200);
    this.tone(130, 0.58, 'sawtooth', 0.22, 32);
    this.tone(70, 0.65, 'sine', 0.13, 28, 0.05);
    this.hiss(0.22, 0.14, 600, 0.15);
    switch (style) {
      case 'tracer': this.click(880, 0.06, 0.08, 0.08); break;
      case 'shell': this.tone(55, 0.35, 'triangle', 0.08, 40, 0.1); break;
      case 'lightning': this.hiss(0.18, 0.1, 3000, 0.12); break;
      case 'railbolt': this.tone(200, 0.2, 'triangle', 0.08, 60, 0.1); break;
      case 'cleave':
      case 'plasmaslash': this.hiss(0.2, 0.1, 800, 0.08); break;
      case 'foxflame': this.tone(420, 0.16, 'sine', 0.06, 200, 0.12); break;
      default: break;
    }
  }

  play(kind, detail = '') {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state !== 'running') {
      this.unlock();
      return;
    }
    const key = ALIASES[kind] || kind;
    if (DISABLED_CUES.has(key)) return;
    const shotStyle = typeof detail === 'string' ? detail : detail?.style || '';
    const specialLevel = typeof detail === 'object' && detail ? (detail.level | 0) : 0;
    const now = this.ctx.currentTime;
    // Per-voice cooldown keys so pierce hit spam can't stack with shoot. Enemy hits share
    // one key across shot classes: per-class gaps let main shot + missiles + options
    // interleave into a machine-gun rattle (user: "one shot sounds like a burst").
    const coolKey = key === 'shoot' ? `shoot:${shotStyle || 'default'}` : key;
    const cooldown = {
      // Every volley sounds (fastest gun: 0.1 s). A 0.13 s gap used to drop every other
      // shot once P sped the gun up, so Lv2+ sounded *slower* than Lv1 (user).
      shoot: 0.06,
      enemyHit: 0.11, enemyDeath: 0.075, playerHit: 0.15,
      playerDeath: 0.3, bomb: 0.22, special: 0.16, pickupP: 0.1, pickupB: 0.1,
      powerDown: 0.18, charge: 0.22, chargeHold: 0.15, deny: 0.12,
      // Graze 0.05 let ring stacks chirp every frame; slightly wider gap keeps the glitter readable.
      warning: 0.55, graze: 0.08, cue: 0.35, clear: 0.4, phase: 0.42, fanfare: 0.8,
      // Leader area attacks: rows of spikes / columns land together, one cue per burst.
      'hz:meteor': 0.08, 'hz:fall': 0.12, 'hz:charge': 0.25, 'hz:beam': 0.15, 'hz:bolt': 0.1,
      'hz:girder': 0.05, 'hz:tape': 0.15, 'hz:swoop': 0.3, 'hz:spike': 0.09, 'hz:column': 0.12,
      'hz:sigil': 0.1, 'hz:cone': 0.6, missileLaunch: 0.07, missileBlast: 0.045, laserFire: 0.2,
      'ui:move': 0.04, 'ui:ok': 0.1, 'ui:open': 0.2,
      // One soft shot per enemy volley; leaders / dense waves fire every frame, so cap 5/s.
      enemyFire: 0.2,
    }[key] || 0;
    if (now - (this.last.get(coolKey) ?? -Infinity) < cooldown) return;
    this.last.set(coolKey, now);
    this._tryLoadFile(key);

    // Sidechain pad under big one-shots so SFX aren't buried in procedural BGM.
    const duck = {
      bomb: [0.55, 0.4, 0.7],
      warning: [0.48, 0.55, 0.65],
      clear: [0.5, 0.7, 0.85],
      phase: [0.38, 0.25, 0.5],
      fanfare: [0.52, 0.85, 0.9],
      playerDeath: [0.45, 0.35, 0.7],
      playerHit: [0.28, 0.12, 0.4],
      special: [0.32, 0.18, 0.45],
    }[key];
    if (duck) this.duckBgm(duck[0], duck[1], duck[2]);

    if (this._playSfx(key, shotStyle)) return;
    if (this._playBuffer(key)) return;

    switch (key) {
      case 'shoot':
        this._playShot(shotStyle);
        break;
      case 'enemyHit':
        this.tone(420, 0.028, 'square', 0.055, 180);
        this.click(900, 0.03, 0.04);
        this.hiss(0.03, 0.055, 2600);
        break;
      case 'enemyDeath':
        // Slightly softer peak — chained kills used to swamp bomb/WARNING.
        this.hiss(0.2, 0.16, 820);
        this.tone(180, 0.18, 'sawtooth', 0.11, 48);
        this.tone(90, 0.24, 'sine', 0.07, 40, 0.05);
        break;
      case 'playerHit':
        this.hiss(0.3, 0.3, 1500);
        this.tone(280, 0.3, 'square', 0.16, 65);
        this.tone(140, 0.22, 'sawtooth', 0.09, 50, 0.08);
        break;
      case 'playerDeath':
        this.hiss(0.5, 0.36, 960);
        this.tone(220, 0.42, 'sawtooth', 0.2, 40);
        this.tone(110, 0.55, 'sine', 0.14, 35, 0.12);
        this.tone(55, 0.6, 'triangle', 0.09, 30, 0.2);
        break;
      case 'pickupP':
        this.click(700, 0.06, 0.1);
        this.tone(880, 0.1, 'sine', 0.14, 1180, 0.05);
        this.tone(1320, 0.12, 'triangle', 0.1, 1600, 0.12);
        break;
      case 'pickupB':
        this.click(520, 0.07, 0.1);
        this.tone(620, 0.12, 'triangle', 0.14, 900, 0.04);
        this.tone(900, 0.14, 'sine', 0.12, 1200, 0.1);
        break;
      case 'powerDown':
        // Body contact / P demote — short descending sting (not a full miss).
        this.hiss(0.08, 0.1, 1400);
        this.tone(420, 0.1, 'square', 0.12, 180);
        this.tone(260, 0.14, 'triangle', 0.1, 110, 0.05);
        break;
      case 'charge':
        this._playCharge(shotStyle);
        break;
      case 'deny':
        // Empty bomb / empty special — short dull click, not a hit.
        this.click(220, 0.05, 0.07);
        this.tone(160, 0.07, 'square', 0.06, 90);
        break;
      case 'graze':
        this.tone(1100, 0.035, 'sine', 0.045, 1600);
        this.tone(1650, 0.025, 'triangle', 0.025, 1900, 0.01);
        break;
      case 'cue':
        this.tone(540, 0.09, 'triangle', 0.1, 760);
        this.tone(760, 0.1, 'sine', 0.08, 920, 0.08);
        break;
      case 'warning':
        // Heavier than phase — long descending siren so mid/boss WARN reads clearly.
        this.tone(460, 0.22, 'sawtooth', 0.18, 320);
        this.tone(320, 0.28, 'sawtooth', 0.16, 240, 0.24);
        this.tone(560, 0.2, 'square', 0.12, 360, 0.52);
        this.hiss(0.2, 0.13, 1800, 0.1);
        this.tone(180, 0.35, 'sine', 0.08, 90, 0.35);
        break;
      case 'special':
        this._playSpecial(shotStyle, specialLevel || 1);
        break;
      case 'bomb':
        this._playBomb(shotStyle);
        break;
      case 'phase':
        // Shorter, brighter than WARNING — HP threshold telegraph.
        this.tone(220, 0.14, 'triangle', 0.13, 560);
        this.tone(560, 0.16, 'sine', 0.12, 840, 0.1);
        this.tone(840, 0.14, 'triangle', 0.09, 1120, 0.22);
        this.click(980, 0.05, 0.07, 0.08);
        break;
      case 'clear':
        for (const [i, f] of [523, 659, 784, 1047].entries())
          this.tone(f, 0.24, 'sine', 0.17, f * 1.02, i * 0.1);
        this.tone(1319, 0.3, 'triangle', 0.1, 1319, 0.42);
        break;
      case 'fanfare':
        this._playFanfareProc();
        break;
      default:
        break;
    }
  }

  _playFanfareProc() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.tone(f, 0.28, 'triangle', 0.16, f * 1.01, i * 0.09);
      this.tone(f * 2, 0.18, 'sine', 0.06, f * 2.02, i * 0.09 + 0.02);
    });
    this.hiss(0.35, 0.12, 3200, 0.05);
    this.tone(196, 0.55, 'sine', 0.1, 196, 0.15);
  }

  /** Instantaneous |sample| peak on the master bus (technical checks only). */
  samplePeak() {
    if (!this._analyser || !this._meterBuf) return 0;
    this._analyser.getFloatTimeDomainData(this._meterBuf);
    let peak = 0;
    for (let i = 0; i < this._meterBuf.length; i++) {
      const a = Math.abs(this._meterBuf[i]);
      if (a > peak) peak = a;
    }
    return peak;
  }

  /**
   * Sample peak over `ms` while optional cues fire.
   * @param {number} ms
   * @param {() => void} [fire]
   */
  async measurePeak(ms = 250, fire = null) {
    if (!this.ctx) return { peak: 0, clipped: false };
    await this.ctx.resume().catch(() => {});
    if (typeof fire === 'function') fire();
    const t0 = performance.now();
    let peak = 0;
    while (performance.now() - t0 < ms) {
      peak = Math.max(peak, this.samplePeak());
      await new Promise((r) => setTimeout(r, 16));
    }
    return { peak, clipped: peak >= 0.99 };
  }

  /**
   * Capture master bus to a Blob (webm/opus in Chromium) for offline peak tools.
   * @param {number} ms
   * @param {() => void} [fire]
   */
  async captureBlob(ms = 400, fire = null) {
    if (!this.ctx || typeof MediaRecorder === 'undefined') {
      return { ok: false, error: 'no MediaRecorder', peak: (await this.measurePeak(ms, fire)).peak };
    }
    await this.ctx.resume().catch(() => {});
    if (!this._mediaDest) {
      this._mediaDest = this.ctx.createMediaStreamDestination();
      this.master.connect(this._mediaDest);
    }
    const chunks = [];
    const rec = new MediaRecorder(this._mediaDest.stream);
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = () => resolve(); });
    rec.start();
    const peakInfo = await this.measurePeak(ms, fire);
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    const buf = await blob.arrayBuffer();
    return {
      ok: true,
      mime: blob.type,
      bytes: buf.byteLength,
      peak: peakInfo.peak,
      clipped: peakInfo.clipped,
      buffer: buf,
    };
  }

  dispose() {
    this.stopChargeHold();
    this.stopBgm(false);
    try { this._mediaRecorder?.stop?.(); } catch { /* */ }
    if (this._resumeBound) {
      document.removeEventListener('visibilitychange', this._onVisibility);
      window.removeEventListener('pageshow', this._onPageShow);
      try { this.ctx?.removeEventListener('statechange', this._onCtxState); } catch { /* */ }
      this._resumeBound = false;
    }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
