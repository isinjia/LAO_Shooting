import { sheetDecodeScale } from './mobile.js';
/**
 * Clip animator for Unity-baked Idle / Move / Skill frames
 * (same pipeline as Skin_3P_Hirume_R1 Python bake).
 * Prefers packed sheet.json atlases when present; falls back to per-frame PNGs.
 */

const contentBoxCache = new WeakMap();
/** Lazy data-URL cache for sheet frames used as <img src> (select UI, fanfare). */
const displaySrcCache = new WeakMap();

function isSheetFrame(img) {
  return !!(img && img.sheet && Number.isFinite(img.sx));
}

/**
 * URL usable in <img src>. Native Image → .src; sheet frames → cached thumbnail data-URL.
 * Avoids select-screen assigning `undefined` → GET /undefined (mass 404s).
 */
export function frameDisplaySrc(frame, { maxSide = 128 } = {}) {
  if (!frame) return '';
  if (!isSheetFrame(frame)) return frame.src || '';
  let cached = displaySrcCache.get(frame);
  if (cached != null) return cached;
  const src = frameSource(frame);
  const scale = Math.min(1, maxSide / Math.max(src.sw, src.sh, 1));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.sw * scale));
  c.height = Math.max(1, Math.round(src.sh * scale));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src.image, src.sx, src.sy, src.sw, src.sh, 0, 0, c.width, c.height);
  try {
    cached = c.toDataURL('image/png');
  } catch {
    cached = src.image.src || '';
  }
  displaySrcCache.set(frame, cached);
  return cached;
}

/** Sheet frame descriptor used by ClipAnimator.draw / contentBox. */
export function makeSheetFrame(sheetImg, rect) {
  const frame = {
    sheet: sheetImg,
    sx: +rect.x || 0,
    sy: +rect.y || 0,
    sw: +rect.w || 0,
    sh: +rect.h || 0,
    ox: Number.isFinite(rect.ox) ? rect.ox : null,
    oy: Number.isFinite(rect.oy) ? rect.oy : null,
    // Downscaled skill atlases (tools/import-skill-body-sheets.py "trim"): atlas px per
    // bake px, and whether the pose may reach outside the shared contentBox.
    k: rect.k || 1,
    overflow: !!rect.overflow,
    width: rect.w | 0,
    height: rect.h | 0,
    naturalWidth: rect.w | 0,
    naturalHeight: rect.h | 0,
  };
  // Compat for UI that reads frame.src (select idle cycle, rare fanfare).
  Object.defineProperty(frame, 'src', {
    configurable: true,
    enumerable: true,
    get() {
      return frameDisplaySrc(frame);
    },
  });
  return frame;
}

function frameSource(img) {
  if (isSheetFrame(img)) {
    return {
      image: img.sheet,
      sx: img.sx,
      sy: img.sy,
      sw: img.sw,
      sh: img.sh,
    };
  }
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  return { image: img, sx: 0, sy: 0, sw: w, sh: h };
}

/** Tight alpha bbox so empty padding doesn't shrink the character on screen. */
function contentBox(img) {
  let box = contentBoxCache.get(img);
  if (box) return box;
  const src = frameSource(img);
  const w = src.sw;
  const h = src.sh;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src.image, src.sx, src.sy, src.sw, src.sh, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) box = { x: 0, y: 0, w, h };
  else {
    const pad = 4;
    box = {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      w: Math.min(w, maxX - minX + 1 + pad * 2),
      h: Math.min(h, maxY - minY + 1 + pad * 2),
    };
  }
  contentBoxCache.set(img, box);
  return box;
}

export class ClipAnimator {
  constructor(clips, { fps = 24 } = {}) {
    // Track real clips before idle fallbacks — empty attack must not lock/restart anim.
    this.hasAttack = !!(clips.attack?.length);
    this.hasSkill2 = !!(clips.skill2?.length);
    this.hasDie = !!(clips.die?.length);
    /** Skill clip release times (leaders): the boss script fires on this clip time. */
    this.hitTime = { attack: clips.attackHit ?? null, skill2: clips.skill2Hit ?? null };
    this.clips = {
      idle: clips.idle || [],
      move: clips.move?.length ? clips.move : clips.idle || [],
      attack: this.hasAttack ? clips.attack : clips.idle || [],
      // skill2 (bomb) — fall back to attack then idle if not baked
      skill2: this.hasSkill2
        ? clips.skill2
        : (this.hasAttack ? clips.attack : clips.idle || []),
      die: this.hasDie ? clips.die : clips.idle || [],
    };
    this.fps = {
      idle: clips.idleFps || fps,
      move: clips.moveFps || fps,
      attack: clips.attackFps || fps,
      skill2: clips.skill2Fps || clips.attackFps || fps,
      die: clips.dieFps || fps,
    };
    // Bake uses fixed viewport — one content box for all frames
    this._box = clips.contentBox || null;
    this.state = 'idle';
    this.time = 0;
    this.locked = false;
    this.onFinished = null;
    /** Original voice events: { state: [[clipSeconds, stem], ...] } and the player hook. */
    this.voices = null;
    this.onVoice = null;
    this._vLast = null;
    this._vState = null;
  }

  play(state, { lock = false, restart = true } = {}) {
    if (this.locked && this.state === 'die') return;
    if (this.locked && state !== 'die') return;
    if (this.state === state && !restart && !lock) return;
    // A respawn cuts the death pose short (~0.8s): shouts still due keep their original
    // clip time (scheduled by the owner at the remaining offset).
    if (this.voices && this.state === 'die' && state !== 'die') this._flushVoices(2);
    this.state = state;
    this.time = 0;
    this.locked = lock;
    this._vLast = null;
    this._vFired = null;
  }

  /**
   * Fire voice events whose clip time falls in (from, to]. Driven by the clip clock, so a
   * voice lands on the same pose as in the original even when a run remaps or speeds up
   * the clip. A fresh play starts just before its first time (mid-clip starts skip the
   * earlier lines); a remap jump or rewind only plays from the frame it lands on, and
   * each event fires once per play (runs that re-sync the clock can step it back).
   */
  _tickVoices(from, to, dt) {
    const list = this.voices?.[this.state];
    if (!list || !this.onVoice) return;
    if (to < from || to - from > Math.max(0.25, dt * 3)) from = to - dt;
    for (let i = 0; i < list.length; i++) {
      const [t, stem] = list[i];
      if (t <= from || t > to || this._vFired?.has(i)) continue;
      (this._vFired ||= new Set()).add(i);
      this.onVoice(stem, this.state, t);
    }
  }

  _flushVoices(ahead) {
    const list = this.voices?.[this.state];
    if (!list || !this.onVoice || this._vLast === null) return;
    for (let i = 0; i < list.length; i++) {
      const [t, stem] = list[i];
      if (this._vFired?.has(i) || t <= this._vLast - 1e-4 || t > this._vLast + ahead) continue;
      (this._vFired ||= new Set()).add(i);
      if (this.onVoiceLater) this.onVoiceLater(stem, this.state, t, t - this._vLast);
      else this.onVoice(stem, this.state, t);
    }
  }

  update(dt) {
    if (this._vState !== this.state) this._vFired = null;
    const vFrom = this._vLast === null || this._vState !== this.state ? this.time - 1e-4 : this._vLast;
    this.time += dt;
    if (this.voices) {
      this._tickVoices(vFrom, this.time, dt);
      this._vLast = this.time;
      this._vState = this.state;
    }
    const frames = this.clips[this.state] || this.clips.idle;
    const fps = this.fps[this.state] || 24;
    if (!frames.length) return;
    if (this.locked) {
      const idx = Math.floor(this.time * fps);
      if (idx >= frames.length) {
        const finished = this.state;
        if (finished === 'die') {
          // Hold last die frame; stay locked so locomotion cannot restart it.
          this.time = (frames.length - 1) / Math.max(fps, 1e-6);
          if (this.onFinished) {
            const cb = this.onFinished;
            this.onFinished = null;
            cb(finished);
          }
          return;
        }
        this.locked = false;
        this.state = 'idle';
        this.time = 0;
        if (this.onFinished) this.onFinished(finished);
      }
    }
  }

  get image() {
    const frames = this.clips[this.state] || this.clips.idle;
    if (!frames.length) return null;
    const fps = this.fps[this.state] || 24;
    if (this.locked || this.state === 'die') {
      const idx = Math.min(frames.length - 1, Math.floor(this.time * fps));
      return frames[idx];
    }
    return frames[Math.floor(this.time * fps) % frames.length];
  }

  draw(ctx, x, y, size, opts = {}) {
    // Wide-cropped clips (skill sheets with props beyond the body box) carry a scale
    // so the character itself stays the same on-screen size as idle.
    size *= this.drawScale?.[this.state] || 1;
    const img = this.image;
    if (!img) return;
    const packed = isSheetFrame(img);
    if (!packed && !this._box) this._box = contentBox(img);
    // A packed frame has its own atlas rectangle, but ox/oy place that crop
    // back in the original bake viewport. Keep the original common contentBox
    // for stable player/enemy scale and animation alignment.
    const anchored = packed && Number.isFinite(img.ox) && Number.isFinite(img.oy) && !!this._box;
    const box = anchored || !packed
      ? this._box
      : { x: 0, y: 0, w: img.sw, h: img.sh };
    const aspect = box.w / box.h;
    let w = size;
    let h = size;
    if (aspect < 1) w = size * aspect;
    else h = size / aspect;

    const src = frameSource(img);
    const imageX = anchored ? img.ox : 0;
    const imageY = anchored ? img.oy : 0;
    // k: atlas px per bake px (1 for full-res sheets); bake-space size of the crop.
    const k = (packed && img.k) || 1;
    const nw = src.sw / k;
    const nh = src.sh / k;
    // Death poses fall/slide outside the shared contentBox; draw them whole
    // (still positioned in box space) instead of clipping the collapse. Trimmed
    // skill atlas frames (giant sword etc.) and leader skill clips do the same.
    const overflow = anchored && (this.state === 'die' || this.state === 'attack' || this.state === 'skill2' || img.overflow);
    const cropX = overflow ? imageX : Math.max(box.x, imageX);
    const cropY = overflow ? imageY : Math.max(box.y, imageY);
    const cropW = (overflow ? imageX + nw : Math.min(box.x + box.w, imageX + nw)) - cropX;
    const cropH = (overflow ? imageY + nh : Math.min(box.y + box.h, imageY + nh)) - cropY;
    if (cropW <= 0 || cropH <= 0) return;
    const sourceX = src.sx + (cropX - imageX) * k;
    const sourceY = src.sy + (cropY - imageY) * k;
    const drawX = (cropX - box.x) * w / box.w;
    const drawY = (cropY - box.y) * h / box.h;
    const drawW = cropW * w / box.w;
    const drawH = cropH * h / box.h;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (opts.flipX) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
    }
    const dx = opts.flipX ? -w / 2 + drawX : x - w / 2 + drawX;
    const dy = opts.flipX ? -h / 2 + drawY : y - h / 2 + drawY;
    ctx.drawImage(src.image, sourceX, sourceY, cropW * k, cropH * k, dx, dy, drawW, drawH);
    if (opts.flash) {
      // Hit flash (1945 style): a white silhouette of the frame over the sprite for a few
      // frames, instead of going see-through (user). Built on one shared scratch canvas.
      const sil = flashSilhouette(src.image, sourceX, sourceY, cropW * k, cropH * k);
      if (sil) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(sil, 0, 0, sil.width, sil.height, dx, dy, drawW, drawH);
      }
    }
    ctx.restore();
  }
}

let _flashCanvas = null;
/** White silhouette of an atlas region (alpha kept), drawn into a shared scratch canvas. */
function flashSilhouette(image, sx, sy, sw, sh) {
  const w = Math.max(1, Math.min(512, Math.ceil(sw)));
  const h = Math.max(1, Math.min(512, Math.ceil(sh)));
  if (typeof document === 'undefined') return null;
  const c = (_flashCanvas ||= document.createElement('canvas'));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  return c;
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode();
      } catch { /* already decoded via onload */ }
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed ${src}`));
    img.src = src;
  });
}

function blobToImage(blob, src) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode();
      } catch { /* */ }
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed ${src}`));
    };
    img.src = url;
  });
}

/** Decode sheets off the main paint path when the browser allows. */
export async function loadDecodedImage(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed ${src}`);
    const blob = await res.blob();
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(blob);
      } catch { /* fall through to HTMLImage */ }
    }
    return await blobToImage(blob, src);
  } catch {
    return loadHtmlImage(src);
  }
}

function loadImage(src) {
  return loadDecodedImage(src);
}

/** Sample frames evenly for a cheap union content-box (legacy bakes). */
function sampleFrames(list, maxSamples = 8) {
  if (!list?.length) return [];
  if (list.length <= maxSamples) return list;
  const out = [];
  for (let i = 0; i < maxSamples; i++) {
    out.push(list[Math.floor((i * (list.length - 1)) / (maxSamples - 1))]);
  }
  return out;
}

/** Union of per-image alpha bboxes so attack ribbon/rifle aren't cropped by idle. */
function unionContentBox(images) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const img of images) {
    if (!img) continue;
    const b = contentBox(img);
    any = true;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!any) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function bakedContentBox(data) {
  if (
    data?.contentBox &&
    Number.isFinite(data.contentBox.x) &&
    Number.isFinite(data.contentBox.y) &&
    Number.isFinite(data.contentBox.w) &&
    Number.isFinite(data.contentBox.h)
  ) {
    return data.contentBox;
  }
  return null;
}

/** Progress units for AssetBank: sheet count when packed, else per-frame PNG count. */
export function countAnimFrames(data) {
  if (!data) return 0;
  if (Array.isArray(data.sheetFiles) && data.sheetFiles.length) return data.sheetFiles.length;
  if (Array.isArray(data.sheets) && data.sheets.length) {
    // sheet.json (or anim that inlined sheets[])
    if (data.sheets.every((s) => typeof s === 'string')) return data.sheets.length;
  }
  if (typeof data.frameCount === 'number' && Array.isArray(data.sheets) && data.sheets.length) {
    return data.sheets.length;
  }
  const die = data.die || data.Die || [];
  // sheet.json frame rect arrays are objects, not path strings — still count lengths for fallback.
  if (die.length && typeof die[0] === 'object' && die[0] && 's' in die[0]) {
    return (data.sheets?.length) || 0;
  }
  // anim.json that only points at a packed atlas — avoid budgeting hundreds of PNG slots.
  if (typeof data.sheet === 'string' && data.sheet) {
    if (typeof data.frameCount === 'number' && data.frameCount > 0) {
      return Math.max(1, Math.ceil(data.frameCount / 25));
    }
    return 4;
  }
  return (
    (data.idle?.length || 0) +
    (data.move?.length || 0) +
    die.length
  );
}

export async function fetchAnimJson(baseDir, animFile = 'anim.json') {
  const res = await fetch(`${baseDir}/${animFile}`);
  if (!res.ok) throw new Error(`No anim.json at ${baseDir}`);
  return res.json();
}

export async function fetchSheetJson(baseDir, sheetFile = 'sheet.json') {
  const file = sheetFile || 'sheet.json';
  const res = await fetch(`${baseDir}/${file}`);
  if (!res.ok) return null;
  return res.json();
}

function previewFromFrame(frame) {
  if (!frame) return null;
  if (!isSheetFrame(frame)) return frame;
  const c = document.createElement('canvas');
  c.width = frame.sw;
  c.height = frame.sh;
  const g = c.getContext('2d');
  g.drawImage(frame.sheet, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
  // `.src` (a PNG data URL) is only read by a few DOM portraits. Encode lazily —
  // a sync toDataURL per clip stalled combat frames during background prefetch.
  let src = null;
  Object.defineProperty(c, 'src', {
    configurable: true,
    get() {
      if (src === null) {
        try {
          src = c.toDataURL('image/png');
        } catch {
          src = frame.sheet.src || '';
        }
      }
      return src;
    },
    set(v) { src = v; },
  });
  return c;
}

/**
 * Load packed sheet.json + sheet_XX.png atlases.
 * @returns {Promise<object|null>} null if sheet.json missing
 */
export async function loadSheetAnim(baseDir, { onFrame = null, sheetData = null, sheetFile = null } = {}) {
  const data =
    sheetData ||
    (await fetchSheetJson(baseDir, sheetFile || 'sheet.json'));
  if (!data?.sheets?.length) return null;

  // Low-end phones: pre-baked half-resolution sheets (tools/make-lo-sheets.py) when present.
  let lo = null;
  if (sheetDecodeScale() < 1) {
    try {
      const res = await fetch(`${baseDir}/sheet_lo.json`);
      if (res.ok) lo = (await res.json())?.sheets || null;
    } catch { lo = null; }
  }
  const sheets = await Promise.all(
    data.sheets.map(async (rel) => {
      const alt = lo?.[rel];
      let img = null;
      if (alt?.file) {
        try {
          img = await loadDecodedImage(`${baseDir}/${alt.file}`);
          img._scale = alt.sx;
          img._scaleY = alt.sy;
        } catch { img = null; }
      }
      if (!img) img = await loadDecodedImage(`${baseDir}/${rel}`);
      if (onFrame) onFrame();
      return img;
    }),
  );

  const mapClip = (list) => {
    if (!list?.length) return [];
    return list.map((rect) => {
      const sheet = sheets[rect.s | 0];
      if (!sheet) throw new Error(`sheet index ${rect.s} missing in ${baseDir}`);
      const s = sheet._scale || 1;
      if (s === 1) return makeSheetFrame(sheet, rect);
      // Reduced atlas: rects shrink with it; k (atlas px per bake px) carries the scale.
      const sy = sheet._scaleY || s;
      return makeSheetFrame(sheet, {
        ...rect, x: rect.x * s, y: rect.y * sy, w: rect.w * s, h: rect.h * sy, k: (rect.k || 1) * s,
      });
    });
  };

  const idle = mapClip(data.idle);
  const move = mapClip(data.move);
  const die = mapClip(data.die);
  // Leader skill clips packed into the sheet (sheetSkills): skill1 -> attack, skill2.
  const attack = mapClip(data.skill1);
  const skill2 = mapClip(data.skill2);
  const attackFps = data.skill1Fps || data.attackFps || 24;
  const skill2Fps = data.skill2Fps || attackFps;
  // Idle+move only — die flatten/FX samples expand the union box and shrink
  // locomotion (Labiata-style), and make death flash look inconsistently scaled.
  const resolvedBox =
    bakedContentBox(data) ||
    unionContentBox([
      ...sampleFrames(idle, 4),
      ...sampleFrames(move, 4),
    ]);

  return {
    idle,
    move,
    attack,
    skill2,
    die,
    idleFps: data.idleFps || 24,
    moveFps: data.moveFps || 24,
    attackFps,
    skill2Fps,
    // Original release time (Unity animation event) of each skill clip, in clip seconds.
    attackHit: data.skill1HitTime ?? null,
    skill2Hit: data.skill2HitTime ?? null,
    dieFps: data.dieFps || 24,
    preview: previewFromFrame(idle[0]),
    contentBox: resolvedBox,
    fromSheet: true,
    sheets,
  };
}

/**
 * Load Hirume-style anim.json + frame paths relative to baseDir.
 * Prefers sheet.json when available; falls back to per-frame native PNGs.
 * @param {string} baseDir
 * @param {string|object} [animFileOrOpts='anim.json'] anim filename, or { animFile, data, onFrame, preferSheet }
 */
export async function loadNativeAnim(baseDir, animFileOrOpts = 'anim.json') {
  const opts =
    typeof animFileOrOpts === 'string'
      ? { animFile: animFileOrOpts }
      : animFileOrOpts || {};
  const animFile = opts.animFile || 'anim.json';
  const onFrame = typeof opts.onFrame === 'function' ? opts.onFrame : null;
  const preferSheet = opts.preferSheet !== false;
  const data = opts.data || (await fetchAnimJson(baseDir, animFile));

  if (preferSheet) {
    try {
      const sheetFile =
        opts.sheetFile ||
        (typeof data.sheet === 'string' && data.sheet ? data.sheet : 'sheet.json');
      const sheetAnim = await loadSheetAnim(baseDir, {
        onFrame,
        sheetData: opts.sheetData || null,
        sheetFile,
      });
      if (sheetAnim) return sheetAnim;
    } catch (err) {
      console.warn(`[clip-anim] sheet load failed for ${baseDir}, falling back to frames`, err);
    }
  }

  const loadList = async (list) => {
    if (!list?.length) return [];
    // sheet.json rects are objects — never treat them as PNG paths
    if (typeof list[0] === 'object') return [];
    return Promise.all(
      list.map(async (rel) => {
        const img = await loadImage(`${baseDir}/${rel}`);
        if (onFrame) onFrame();
        return img;
      })
    );
  };

  const idle = await loadList(data.idle);
  const move = await loadList(data.move);
  // skill1 / skill2 PNG frames are not loaded for now (unused; keep files on disk).
  const attack = [];
  const skill2 = [];
  const attackFps = data.skill1Fps || data.attackFps || 24;
  const skill2Fps = data.skill2Fps || attackFps;
  const die = await loadList(data.die || data.Die);

  // Idle+move only — die flatten/FX samples expand the union box and shrink
  // locomotion (Labiata-style), and make death flash look inconsistently scaled.
  const resolvedBox =
    bakedContentBox(data) ||
    unionContentBox([
      ...sampleFrames(idle, 4),
      ...sampleFrames(move, 4),
    ]);

  return {
    idle,
    move,
    attack,
    skill2,
    die,
    idleFps: data.idleFps || 24,
    moveFps: data.moveFps || 24,
    attackFps,
    skill2Fps,
    dieFps: data.dieFps || 24,
    preview: idle[0],
    contentBox: resolvedBox,
    fromSheet: false,
  };
}
