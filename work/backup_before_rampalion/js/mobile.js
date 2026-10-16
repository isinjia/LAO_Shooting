/**
 * Mobile / coarse-pointer detection for layout, touch pads, and lighter FX.
 * Viewport / pointer queries are cached — combat rAF used to call matchMedia
 * every trail/VFX tick.
 */

let _cached = false;
let _coarse = false;
let _narrow = false;
let _light = false;
let _portrait = false;
let _lowEnd = false;
let _dprCap = 3;
let _highEnd = false;
const DEMOTE_KEY = 'lao_gfx_demote';

function readDemote() {
  try { return Number(localStorage.getItem(DEMOTE_KEY)) | 0; } catch { return 0; }
}
let _maxTex = -1;
let _mqBound = false;

function matchMq(q) {
  try {
    return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia(q).matches);
  } catch {
    return false;
  }
}

function probeMaxTexture() {
  if (_maxTex >= 0) return _maxTex;
  _maxTex = 0;
  if (typeof document === 'undefined') return 0;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl) _maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
  } catch {
    _maxTex = 0;
  }
  return _maxTex;
}

function applyLowEndClass() {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.classList.toggle('is-lowend-gfx', _lowEnd);
  document.documentElement.dataset.laoDprCap = String(_dprCap);
  document.documentElement.dataset.laoLowend = _lowEnd ? '1' : '0';
}

function recomputeMobileFlags() {
  _coarse = matchMq('(pointer: coarse)');
  const w = (typeof window !== 'undefined' && window.innerWidth) || 0;
  const h = (typeof window !== 'undefined' && window.innerHeight) || 0;
  _narrow = Math.min(w, h) <= 720 || Math.max(w, h) <= 900;
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const touch = (nav.maxTouchPoints || 0) > 0;
  const short = Math.min(w || 9999, h || 9999);
  _light = _coarse || (_narrow && touch) || short < 520;
  _portrait = h > w;

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const highDpr = dpr >= 2.5;
  const reducedMotion = matchMq('(prefers-reduced-motion: reduce)');
  let saveData = false;
  try {
    saveData = !!(nav.connection && nav.connection.saveData);
  } catch {
    saveData = false;
  }
  const cores = nav.hardwareConcurrency | 0;
  const lowCores = cores > 0 && cores <= 4;
  const tex = probeMaxTexture();
  const tinyTex = tex > 0 && tex <= 4096;
  const smallCss = short <= 480 || Math.max(w, h) <= 900;
  const tinyCss = short <= 400 || Math.max(w, h) <= 740;
  // Coarse device class for backing-store / decorative overdraw only.
  // Does NOT change prefersLightFx() particle dens caps.
  _lowEnd = ((_light || touch || _coarse) && smallCss && (touch || _coarse || tinyCss))
    || (_light && (highDpr || reducedMotion || saveData || lowCores || tinyTex || tinyCss))
    || (touch && tinyCss);

  // Capable phones / tablets (6+ cores and 6 GB+, or iOS with a 16k GPU texture limit) get
  // the full quality path: 2x backing store, glow / motes, high smoothing (user: a good phone
  // should look good). The FPS guard (demoteGfx) steps back down if it can't hold 60.
  const mem = Number(nav.deviceMemory) || 0;
  _highEnd = (touch || _coarse) && cores >= 6 && (mem ? mem >= 6 : tex >= 16384) && !saveData;
  if (_highEnd) _lowEnd = false;

  if (_lowEnd) {
    _dprCap = (tinyCss || highDpr) ? 1 : 1.5;
  } else if (_highEnd) {
    _dprCap = 2;
  } else {
    _dprCap = _light ? 1.75 : 3;
  }
  // Stored demotion from an earlier session that dropped frames.
  const demote = readDemote();
  if (demote >= 1) _dprCap = Math.min(_dprCap, 1.5);
  if (demote >= 2 && _highEnd) {
    _highEnd = false;
    _dprCap = 1.25;
  }
  applyLowEndClass();
}

function ensureMobileFlags() {
  if (_cached) return;
  _cached = true;
  if (typeof window === 'undefined') {
    _coarse = false;
    _narrow = false;
    _light = false;
    _portrait = false;
    _lowEnd = false;
    _dprCap = 3;
    return;
  }
  recomputeMobileFlags();
  if (_mqBound) return;
  _mqBound = true;
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('resize', recomputeMobileFlags);
  }
  try {
    const mq = window.matchMedia && window.matchMedia('(pointer: coarse)');
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener('change', recomputeMobileFlags);
    else if (mq.addListener) mq.addListener(recomputeMobileFlags);
  } catch {
    /* */
  }
}

export function isCoarsePointer() {
  ensureMobileFlags();
  return _coarse;
}

export function isNarrowViewport() {
  ensureMobileFlags();
  return _narrow;
}

/** Prefer on-screen pads: touch device or coarse pointer + not a huge desktop. */
export function wantsTouchControls() {
  if (isCoarsePointer()) return true;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && isNarrowViewport()) {
    return true;
  }
  return false;
}

/** Portrait phone: game is landscape — show rotate hint. */
export function isPortrait() {
  ensureMobileFlags();
  return _portrait;
}

/** Lighter particle / DPR path for phones and coarse pointers. */
export function prefersLightFx() {
  ensureMobileFlags();
  return _light;
}

/**
 * Low-end / tiny-phone quality path: cap canvas backing store, skip decorative
 * city motes / HUD glow blur. Logical 960×540 gameplay unchanged.
 */
export function prefersLowEndGfx() {
  ensureMobileFlags();
  return _lowEnd;
}

/**
 * Sprite-sheet decode scale: low-end phones keep atlases at half resolution (1/4 of the
 * decoded memory; the ship is ~120 device px there), light devices at 0.7.
 * Frame rects scale with the sheet (frame.k), so on-screen size / anchors are unchanged.
 */
export function sheetDecodeScale() {
  ensureMobileFlags();
  try {
    const q = new URLSearchParams(location.search).get('sheetScale');
    if (q) return Math.max(0.25, Math.min(1, Number(q) || 1));
  } catch { /* */ }
  // High-end phones keep the half-res sheets too: full-res atlases decode to ~2.8 GB.
  return _lowEnd ? 0.5 : _light ? 0.7 : 1;
}

/** Capable phone / tablet on the full quality path. */
export function isHighEndMobile() {
  ensureMobileFlags();
  return _highEnd;
}

/**
 * FPS guard: lower the canvas backing-store cap one step (2 -> 1.5 -> 1.25 -> 1) and
 * remember it for the next session. Returns false when already at the floor.
 */
export function demoteGfx() {
  ensureMobileFlags();
  const steps = [2, 1.5, 1.25, 1];
  const next = steps.find((v) => v < _dprCap - 0.01);
  if (!next) return false;
  _dprCap = next;
  try { localStorage.setItem(DEMOTE_KEY, String(Math.min(2, readDemote() + 1))); } catch { /* */ }
  return true;
}

export function mobileDprCap() {
  ensureMobileFlags();
  return _dprCap;
}
