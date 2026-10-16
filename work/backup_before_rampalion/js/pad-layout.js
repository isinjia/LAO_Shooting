/**
 * Mobile pad layout: per-control offset + size chosen by the player (OPTIONS > 버튼 배치).
 *
 * The stored layout only nudges each control away from its stock CSS spot, so every
 * existing breakpoint / fixed-vs-floating rule keeps working underneath:
 *   x, y  offset as a fraction of the viewport (x of width, y of height)
 *   s     size multiplier
 * Applied through CSS custom properties (--tc-x / --tc-y / --tc-s) that the individual
 * `translate` / `scale` properties read (css/style.css, "Pad layout"), so they compose with
 * the pads' own `transform` (press feedback, knob travel) instead of replacing it.
 */

export const PAD_ITEMS = ['stick', 'shoot', 'special', 'bomb', 'focus', 'pause'];
export const PAD_SCALE_MIN = 0.6;
export const PAD_SCALE_MAX = 1.8;

const SELECTORS = {
  stick: '.tc-stick-zone',
  shoot: '.tc-fire',
  special: '.tc-special',
  bomb: '.tc-bomb',
  focus: '.tc-focus',
  pause: '.tc-pause',
};

const LABEL_KEYS = {
  stick: 'pad.item.stick',
  shoot: 'pad.item.shoot',
  special: 'pad.item.special',
  bomb: 'pad.item.bomb',
  focus: 'pad.item.focus',
  pause: 'pad.item.pause',
};

function num(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

/** Clean a saved layout: known items only, offsets within one screen, sane sizes. */
export function normalizePadLayout(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of PAD_ITEMS) {
    const v = raw[k];
    if (!v || typeof v !== 'object') continue;
    const x = num(v.x, -1, 1, 0);
    const y = num(v.y, -1, 1, 0);
    const s = num(v.s, PAD_SCALE_MIN, PAD_SCALE_MAX, 1);
    if (Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4 && Math.abs(s - 1) < 1e-3) continue;
    out[k] = { x: +x.toFixed(4), y: +y.toFixed(4), s: +s.toFixed(3) };
  }
  return out;
}

function padEl(root, k) {
  return root?.querySelector(SELECTORS[k]) || null;
}

/** Push a layout onto the live pad DOM (missing items fall back to the stock spot). */
export function applyPadLayout(root, layout) {
  if (!root) return;
  for (const k of PAD_ITEMS) {
    const el = padEl(root, k);
    if (!el) continue;
    const v = layout?.[k];
    if (!v) {
      el.style.removeProperty('--tc-x');
      el.style.removeProperty('--tc-y');
      el.style.removeProperty('--tc-s');
      continue;
    }
    el.style.setProperty('--tc-x', `${(v.x || 0) * 100}vw`);
    el.style.setProperty('--tc-y', `${(v.y || 0) * 100}vh`);
    el.style.setProperty('--tc-s', String(v.s || 1));
  }
}

/**
 * Full-screen layout editor over the pads.
 * @param {{
 *   root: HTMLElement,
 *   layout: object,
 *   padMode: 'fixed'|'floating',
 *   t: (key:string, vars?:object)=>string,
 *   onSave: (layout:object)=>void,
 *   onClose: ()=>void,
 * }} opts
 */
export function openPadEditor({ root, layout, padMode, t, onSave, onClose }) {
  if (!root) { onClose?.(); return () => {}; }
  const floating = padMode === 'floating';
  const saved = normalizePadLayout(layout);
  let work = JSON.parse(JSON.stringify(saved));
  let selected = 'shoot';
  let drag = null;

  // Show every pad in its play position, whatever menu chrome the root was wearing.
  const prevClass = root.className;
  const prevAria = root.getAttribute('aria-hidden');
  root.className = `touch-controls ${floating ? 'tc-mode-float' : 'tc-mode-fixed'} is-on tc-editing`;
  root.setAttribute('aria-hidden', 'false');
  root.querySelectorAll('.is-held').forEach((el) => el.classList.remove('is-held'));

  const shade = document.createElement('div');
  shade.className = 'tc-edit-shade';
  root.parentNode.insertBefore(shade, root);

  const bar = document.createElement('div');
  bar.className = 'tc-edit-bar';
  bar.innerHTML = `
    <div class="tc-edit-row">
      <strong class="tc-edit-title">${t('pad.title')}</strong>
      <button type="button" class="tc-edit-flip" data-act="flip" aria-label="${t('pad.flip')}">⇅</button>
    </div>
    <p class="tc-edit-hint">${t('pad.hint')}</p>
    <div class="tc-edit-row tc-edit-size">
      <span class="tc-edit-sel"></span>
      <input type="range" class="tc-edit-range" min="${Math.round(PAD_SCALE_MIN * 100)}" max="${Math.round(PAD_SCALE_MAX * 100)}" step="5" />
      <em class="tc-edit-pct"></em>
    </div>
    <p class="tc-edit-note" hidden>${t('pad.floatNote')}</p>
    <div class="tc-edit-row tc-edit-actions">
      <button type="button" class="btn btn-mini" data-act="reset-one">${t('pad.resetOne')}</button>
      <button type="button" class="btn btn-mini" data-act="reset-all">${t('pad.resetAll')}</button>
      <span class="tc-edit-spacer"></span>
      <button type="button" class="btn btn-mini" data-act="cancel">${t('pad.cancel')}</button>
      <button type="button" class="btn btn-mini btn-primary" data-act="save">${t('pad.save')}</button>
    </div>`;
  document.body.appendChild(bar);
  const range = bar.querySelector('.tc-edit-range');
  const pct = bar.querySelector('.tc-edit-pct');
  const selLabel = bar.querySelector('.tc-edit-sel');
  const note = bar.querySelector('.tc-edit-note');

  const item = (k) => work[k] || { x: 0, y: 0, s: 1 };
  const setItem = (k, v) => { work[k] = { x: v.x, y: v.y, s: v.s }; };

  function syncBar() {
    const v = item(selected);
    selLabel.textContent = t(LABEL_KEYS[selected]);
    range.value = String(Math.round(v.s * 100));
    pct.textContent = `${Math.round(v.s * 100)}%`;
    note.hidden = !(floating && selected === 'stick');
    for (const k of PAD_ITEMS) padEl(root, k)?.classList.toggle('tc-edit-picked', k === selected);
  }

  /** Keep the picked pad fully on screen after a move / resize. */
  function clampOnScreen(k) {
    const el = padEl(root, k);
    if (!el) return;
    const target = k === 'stick' ? (el.querySelector('.tc-stick-base') || el) : el;
    const r = target.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const v = item(k);
    let dx = 0;
    let dy = 0;
    if (r.width < W) {
      if (r.left < 0) dx = -r.left;
      else if (r.right > W) dx = W - r.right;
    }
    if (r.height < H) {
      if (r.top < 0) dy = -r.top;
      else if (r.bottom > H) dy = H - r.bottom;
    }
    if (dx || dy) {
      setItem(k, { x: v.x + dx / W, y: v.y + dy / H, s: v.s });
      applyPadLayout(root, work);
    }
  }

  function pickAt(target) {
    for (const k of PAD_ITEMS) {
      const el = padEl(root, k);
      if (!el) continue;
      if (k === 'stick') {
        // Fixed: the whole stick zone. Floating: only the visible base (the zone is half
        // the screen and would swallow every touch).
        const hit = floating ? target.closest('.tc-stick-base') : target.closest('.tc-stick-zone');
        if (hit && el.contains(hit)) return k;
      } else if (el === target || el.contains(target)) {
        return k;
      }
    }
    return null;
  }

  const onDown = (e) => {
    const k = pickAt(e.target);
    // Swallow every pad touch so live controls never fire while editing.
    e.preventDefault();
    e.stopPropagation();
    if (!k) return;
    selected = k;
    syncBar();
    if (floating && k === 'stick') return; // floating stick follows the thumb: size only
    const v = item(k);
    drag = { id: e.pointerId, k, sx: e.clientX, sy: e.clientY, x0: v.x, y0: v.y };
    try { root.setPointerCapture?.(e.pointerId); } catch { /* */ }
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const v = item(drag.k);
    setItem(drag.k, {
      x: drag.x0 + (e.clientX - drag.sx) / window.innerWidth,
      y: drag.y0 + (e.clientY - drag.sy) / window.innerHeight,
      s: v.s,
    });
    applyPadLayout(root, work);
    clampOnScreen(drag.k);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
  };
  const block = (e) => e.preventDefault();

  root.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
  root.addEventListener('touchstart', block, { passive: false, capture: true });

  range.oninput = () => {
    const v = item(selected);
    setItem(selected, { x: v.x, y: v.y, s: Number(range.value) / 100 });
    pct.textContent = `${range.value}%`;
    applyPadLayout(root, work);
    clampOnScreen(selected);
  };

  function close() {
    root.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    root.removeEventListener('touchstart', block, { capture: true });
    for (const k of PAD_ITEMS) padEl(root, k)?.classList.remove('tc-edit-picked');
    root.className = prevClass;
    if (prevAria == null) root.removeAttribute('aria-hidden');
    else root.setAttribute('aria-hidden', prevAria);
    bar.remove();
    shade.remove();
    onClose?.();
  }

  bar.addEventListener('click', (e) => {
    const act = e.target.closest?.('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'flip') {
      bar.classList.toggle('is-bottom');
    } else if (act === 'reset-one') {
      delete work[selected];
      applyPadLayout(root, work);
      syncBar();
    } else if (act === 'reset-all') {
      work = {};
      applyPadLayout(root, work);
      syncBar();
    } else if (act === 'cancel') {
      applyPadLayout(root, saved);
      close();
    } else if (act === 'save') {
      const next = normalizePadLayout(work);
      applyPadLayout(root, next);
      onSave?.(next);
      close();
    }
  });

  applyPadLayout(root, work);
  syncBar();
  return close;
}
