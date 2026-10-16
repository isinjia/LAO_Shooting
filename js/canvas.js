import { mobileDprCap, prefersLightFx, prefersLowEndGfx } from './mobile.js';

/**
 * Logical game size follows the screen's landscape aspect so the field fills it both ways:
 * wider than 16:9 -> height 540, width 960..1280 (~21:9); taller than 16:9 (tablets) ->
 * width 960, height 540..720 (4:3). Measured inside the safe area (notches); portrait
 * loads use the landscape aspect. Refit whenever the viewport changes (fullscreen hides the
 * browser bars, rotation, window resize): W / H are live bindings, so every importer sees
 * the new size.
 */
function logicalSize() {
  try {
    let vw = window.visualViewport?.width || window.innerWidth || 960;
    let vh = window.visualViewport?.height || window.innerHeight || 540;
    const cs = document.body ? getComputedStyle(document.body) : null;
    if (cs) {
      vw -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      vh -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    }
    const aspect = Math.max(vw, vh) / Math.max(1, Math.min(vw, vh));
    const even = (v) => Math.round(v / 2) * 2;
    if (aspect >= 16 / 9) return [even(Math.min(1280, 540 * aspect)), 540];
    return [960, even(Math.min(720, 960 / aspect))];
  } catch {
    return [960, 540];
  }
}
export let W = 960;
export let H = 540;

/** Recompute W / H for the current viewport; true when the size changed. */
export function refitLogicalSize() {
  const [w, h] = logicalSize();
  const changed = w !== W || h !== H;
  W = w;
  H = h;
  try {
    document.documentElement.style.setProperty('--game-w', String(W));
    document.documentElement.style.setProperty('--game-h', String(H));
  } catch { /* no DOM */ }
  return changed;
}
refitLogicalSize();

/**
 * Backing store matches the *on-screen* CSS box × devicePixelRatio,
 * then maps game coords (W×H) onto it. Avoids CSS upscale blur.
 * Mobile / coarse pointer caps DPR for fill-rate; low-end phones cap harder
 * (1 or 1.5) so hitboxes / i18n / pads still live in 960×540 space.
 */
export function setupHiDpiCanvas(canvas) {
  refitLogicalSize();
  const cap = mobileDprCap();
  const dpr = Math.min(window.devicePixelRatio || 1, cap);
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width || W);
  const cssH = Math.max(1, rect.height || H);
  const bw = Math.round(cssW * dpr);
  const bh = Math.round(cssH * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  // Opaque buffer: compositor skips blending with the page (#game is already #000).
  const ctx = canvas.getContext('2d', { alpha: false });
  const sx = bw / W;
  const sy = bh / H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = prefersLowEndGfx() ? 'low' : prefersLightFx() ? 'medium' : 'high';
  if (prefersLowEndGfx() && !ctx.__lowEndLocked) {
    // Low-end phones: pin the cheap raster path for the whole game canvas. Draw code sets
    // smoothing 'high' / glow shadowBlur per sprite; both are costly on phone GPUs
    // (sheets are pre-halved there, so bilinear is enough).
    ctx.__lowEndLocked = true;
    const proto = Object.getPrototypeOf(ctx);
    const q = Object.getOwnPropertyDescriptor(proto, 'imageSmoothingQuality');
    const blur = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
    if (q?.set) Object.defineProperty(ctx, 'imageSmoothingQuality', { configurable: true, get: () => 'low', set: () => q.set.call(ctx, 'low') });
    if (blur?.set) Object.defineProperty(ctx, 'shadowBlur', { configurable: true, get: () => 0, set: () => {} });
  }
  return { ctx, dpr, scaleX: sx, scaleY: sy };
}

/** True when (o.x, o.y) is inside the visible playfield: nothing hits off-screen. */
export function onScreen(o) {
  return o.x >= 0 && o.x <= W && o.y >= 0 && o.y <= H;
}
