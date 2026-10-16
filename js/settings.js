/**
 * Persistent player preferences (volume, keys, tutorial, display).
 */

import { normalizeLang, systemLocale } from './i18n.js';
import { wantsTouchControls } from './mobile.js';
import { normalizePadLayout } from './pad-layout.js';

const STORAGE_KEY = 'lao_mini_settings_v1';
const TUTORIAL_KEY = 'lao_mini_tutorial_seen';
/** Bump to re-apply changed defaults to existing saves once (see loadSettings). */
const SETTINGS_VERSION = 4;

export const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  shoot: ['Space'],
  focus: ['ShiftLeft', 'ShiftRight'],
  bomb: ['KeyX'],
  special: ['KeyC'],
  /** Rampalion leg-part skill (dash / barrier, user). Z was a second FIRE key. */
  leg: ['KeyZ'],
  pause: ['Escape'],
  mute: ['KeyM'],
};

export const POWER_CHEAT_CODES = ['KeyP', 'KeyO'];

export const KEY_LABELS = {
  left: '왼쪽',
  right: '오른쪽',
  up: '위',
  down: '아래',
  shoot: '사격',
  focus: '저속(포커스)',
  bomb: '폭탄',
  special: '특수탄',
  leg: '다리 스킬',
  pause: '일시정지',
  mute: '음소거',
};

const DEFAULTS = {
  bgmVolume: 0.7,
  sfxVolume: 0.85,
  muted: false,
  fullscreen: false,
  /** On-screen stick: 'fixed' (corners) or 'floating' (appear at left-zone touch). */
  padMode: 'floating',
  /** Stream shots without holding FIRE; FIRE hold still charges. On by default (user). */
  autoFire: true,
  /** UI language: ko / ja / en / zh-Hant / zh-Hans / pt / es / ru. Default = OS language
   *  (English when unsupported) until the player picks one in OPTIONS (langSet). */
  lang: systemLocale(),
  langSet: false,
  keys: structuredCloneSafe(DEFAULT_KEYS),
  /** Mobile pad offsets / sizes from OPTIONS > pad layout (pad-layout.js). */
  padLayout: {},
};

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function normalizeKeys(raw) {
  const out = structuredCloneSafe(DEFAULT_KEYS);
  if (!raw || typeof raw !== 'object') return out;
  for (const action of Object.keys(DEFAULT_KEYS)) {
    const list = raw[action];
    if (!Array.isArray(list) || !list.length) continue;
    const cleaned = list.filter((c) => typeof c === 'string' && c.length > 0
      && !POWER_CHEAT_CODES.includes(c));
    if (cleaned.length) out[action] = cleaned;
  }
  return out;
}

export function loadSettings() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    parsed = null;
  }
  const base = structuredCloneSafe(DEFAULTS);
  // Phones / tablets start with auto-fire on and fullscreen (entered on the first tap).
  if (wantsTouchControls()) {
    base.autoFire = true;
    base.fullscreen = true;
  }
  if (!parsed || typeof parsed !== 'object') return base;
  // Saves from before the v2 defaults (floating stick; mobile auto-fire + fullscreen) take
  // the new defaults once; later saves keep whatever the player chose.
  if ((parsed.v | 0) < 2) {
    parsed = { ...parsed, padMode: base.padMode };
    if (wantsTouchControls()) parsed.autoFire = true;
    if (base.fullscreen) parsed.fullscreen = true;
  }
  // v3: auto-fire on by default (user). Real v2 saves recorded the old default (off), so they
  // take it once; saves without a version (QA scripts' seeded settings) keep their value.
  if ((parsed.v | 0) >= 1 && (parsed.v | 0) < 3) parsed = { ...parsed, autoFire: true };
  // v4: Z moved from FIRE to the leg skill (user). Drop it from a saved FIRE binding, and keep
  // the leg skill off Z when a saved binding already uses Z for something else.
  if ((parsed.v | 0) < 4 && parsed.keys && typeof parsed.keys === 'object') {
    const keys = { ...parsed.keys };
    if (Array.isArray(keys.shoot)) {
      const shoot = keys.shoot.filter((c) => c !== 'KeyZ');
      keys.shoot = shoot.length ? shoot : ['Space'];
    }
    const zTaken = Object.entries(keys).some(([a, l]) => a !== 'leg' && Array.isArray(l) && l.includes('KeyZ'));
    if (!Array.isArray(keys.leg) && zTaken) keys.leg = ['KeyV'];
    parsed = { ...parsed, keys };
  }
  return {
    bgmVolume: clamp01(parsed.bgmVolume ?? base.bgmVolume),
    sfxVolume: clamp01(parsed.sfxVolume ?? base.sfxVolume),
    muted: !!parsed.muted,
    fullscreen: !!(parsed.fullscreen ?? base.fullscreen),
    padMode: (parsed.padMode ?? base.padMode) === 'fixed' ? 'fixed' : 'floating',
    autoFire: !!(parsed.autoFire ?? base.autoFire),
    // Only a language picked in OPTIONS sticks; otherwise follow the OS each launch.
    lang: parsed.langSet ? normalizeLang(parsed.lang) : systemLocale(),
    langSet: !!parsed.langSet,
    keys: normalizeKeys(parsed.keys),
    padLayout: normalizePadLayout(parsed.padLayout),
  };
}

export function saveSettings(settings) {
  const payload = {
    v: SETTINGS_VERSION,
    bgmVolume: clamp01(settings.bgmVolume),
    sfxVolume: clamp01(settings.sfxVolume),
    muted: !!settings.muted,
    fullscreen: !!settings.fullscreen,
    padMode: settings.padMode === 'floating' ? 'floating' : 'fixed',
    autoFire: !!settings.autoFire,
    lang: normalizeLang(settings.lang),
    langSet: !!settings.langSet,
    keys: normalizeKeys(settings.keys),
    padLayout: normalizePadLayout(settings.padLayout),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function isTutorialSeen() {
  return localStorage.getItem(TUTORIAL_KEY) === '1';
}

export function markTutorialSeen() {
  localStorage.setItem(TUTORIAL_KEY, '1');
}

export function codeLabel(code) {
  if (!code) return '—';
  const map = {
    Space: 'Space',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    Escape: 'Esc',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export function primaryCode(settings, action) {
  const list = settings?.keys?.[action] || DEFAULT_KEYS[action] || [];
  return list[0] || '';
}

export function codesFor(settings, action) {
  return settings?.keys?.[action] || DEFAULT_KEYS[action] || [];
}

/** Match KeyboardEvent.code against bound action (supports multi-bind). */
export function matchAction(settings, action, code) {
  return codesFor(settings, action).includes(code);
}

/** Inside the mobile shell (play.html) the shell page goes fullscreen, so the rotated
 *  game frame keeps its transform (a fullscreen iframe would drop it). */
export function fsDocument() {
  try {
    if (window.parent !== window && window.parent.__LAO_SHELL__) return window.parent.document;
  } catch { /* cross-origin */ }
  return document;
}

function fsElement() {
  const d = fsDocument();
  return d.fullscreenElement || d.webkitFullscreenElement || null;
}

/** Element fullscreen is available (iPhone Safari has none: use Add to Home Screen). */
export function canFullscreen() {
  const d = fsDocument();
  const el = d.documentElement;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled
    || el.requestFullscreen || el.webkitRequestFullscreen);
}

export async function applyFullscreen(want) {
  const app = document.getElementById('app');
  try {
    if (want) {
      if (!fsElement()) {
        // The whole document goes fullscreen so overlays / touch pads stay inside it.
        const el = fsDocument().documentElement;
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (app?.webkitRequestFullscreen) app.webkitRequestFullscreen();
      }
      // Unrotated phones: keep the field landscape while fullscreen (ignored where unsupported).
      // In the shell the frame already turns with the device, so no lock there.
      if (fsDocument() === document) {
        try { await screen.orientation?.lock?.('landscape'); } catch { /* not allowed */ }
      }
    } else if (fsElement()) {
      try { screen.orientation?.unlock?.(); } catch { /* not allowed */ }
      const d = fsDocument();
      if (d.exitFullscreen) await d.exitFullscreen();
      else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
    }
  } catch {
    /* browser may block without gesture */
  }
  return !!fsElement();
}

export function isFullscreen() {
  return !!fsElement();
}
