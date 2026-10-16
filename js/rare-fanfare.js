/**
 * Rare character reveal fanfare (Eternity / Labiata / Emily).
 * Hooks into select / random-slot resolution; safe if those chars are not yet in PLAYER_KEYS.
 */

import { frameDisplaySrc } from './clip-anim.js';
import { t, charDisplayName, rareTagline } from './i18n.js';

export const RARE_CHAR_KEYS = ['eternity', 'labiata', 'emily'];

export const RARE_META = {
  eternity: {
    name: '이터니티',
    title: '◆ RARE UNIT',
    tagline: '관과 기관총 — 생사의 유모가 강림한다',
    accent: '#c9a6ff',
    glow: '#7b5cff',
  },
  labiata: {
    name: '라비아타',
    title: '◆ RARE UNIT',
    tagline: '트롤스베르드 — 철충을 베는 플라즈마',
    accent: '#ff6b8a',
    glow: '#ff3d6e',
  },
  emily: {
    name: '에밀리',
    title: '◆ RARE UNIT',
    tagline: '제녹스 레일건 — 한계를 풀어낸다',
    accent: '#7ec8ff',
    glow: '#4aa8ff',
  },
};

export function isRareChar(charKey) {
  if (!charKey) return false;
  const k = String(charKey).toLowerCase();
  return RARE_CHAR_KEYS.includes(k);
}

export function rareInfo(charKey) {
  const k = String(charKey || '').toLowerCase();
  return RARE_META[k] || null;
}

/**
 * Detect random-slot markers used by select UI (another agent may add these).
 * Accepts dataset flags, key names, or explicit random keys.
 */
export function isRandomSlotKey(key) {
  if (!key) return false;
  const k = String(key).toLowerCase();
  return k === 'random' || k === 'rand' || k === '???' || k === 'mystery' || k.startsWith('random');
}

/** Select-screen Konami-style codes (direction tokens). Timeout lives in main.js. */
export const SELECT_CHEAT_TIMEOUT_MS = 1800;
export const SELECT_CHEAT_CODES = {
  // 1) Up Down ×4 → Labiata (was Eternity)
  labiata: ['up', 'down', 'up', 'down', 'up', 'down', 'up', 'down'],
  // 2) Left Right ×4 → LRL (was Labiata)
  lrl: ['left', 'right', 'left', 'right', 'left', 'right', 'left', 'right'],
  // 3) Up Left Down Right Up Down -> Constantia
  constantia: ['up', 'left', 'down', 'right', 'up', 'down'],
  // 4) Up ×3, Down ×3, Up ×7 -> Peregrinus
  peregrinus: ['up', 'up', 'up', 'down', 'down', 'down',
    'up', 'up', 'up', 'up', 'up', 'up', 'up'],
};

/**
 * Typed-name select codes (physical key codes), only live once "치트활성화온" was typed
 * on the title (main.js cheatsOn). Korean 2-beolsik and the English spelling both work:
 * 램파리온 = ㄹㅐㅁ ㅍㅏ ㄹㅣ ㅇㅗㄴ -> F O A V K F L D H S.
 */
export const SELECT_TYPED_CODES = {
  rampalion: [
    ['KeyF', 'KeyO', 'KeyA', 'KeyV', 'KeyK', 'KeyF', 'KeyL', 'KeyD', 'KeyH', 'KeyS'],
    ['KeyR', 'KeyA', 'KeyM', 'KeyP', 'KeyA', 'KeyL', 'KeyI', 'KeyO', 'KeyN'],
  ],
};

/**
 * If the typed key-code buffer ends with a name code, return that kit key.
 * @param {string[]} buffer KeyboardEvent.code values
 * @returns {string|null}
 */
export function matchTypedSelectCheat(buffer) {
  if (!Array.isArray(buffer) || !buffer.length) return null;
  for (const [key, seqs] of Object.entries(SELECT_TYPED_CODES)) {
    for (const seq of seqs) {
      if (buffer.length < seq.length) continue;
      const slice = buffer.slice(-seq.length);
      if (seq.every((c, i) => slice[i] === c)) return key;
    }
  }
  return null;
}

/** Hidden / cheat unlocks painted onto the RANDOM card (includes LRL). */
export function isCheatUnlockChar(charKey) {
  if (!charKey) return false;
  const k = String(charKey).toLowerCase();
  return Object.prototype.hasOwnProperty.call(SELECT_CHEAT_CODES, k)
    || Object.prototype.hasOwnProperty.call(SELECT_TYPED_CODES, k);
}

/** Rare fanfare keys OR cheat-unlock keys (RANDOM reveal). */
export function isSelectUnlockChar(charKey) {
  return isRareChar(charKey) || isCheatUnlockChar(charKey);
}

/**
 * If `buffer` ends with a cheat sequence, return that rare key (longest match first).
 * @param {string[]} buffer
 * @returns {string|null}
 */
export function matchSelectCheat(buffer) {
  if (!Array.isArray(buffer) || !buffer.length) return null;
  const entries = Object.entries(SELECT_CHEAT_CODES).sort((a, b) => b[1].length - a[1].length);
  for (const [key, seq] of entries) {
    if (!seq.length || buffer.length < seq.length) continue;
    const slice = buffer.slice(-seq.length);
    if (seq.every((d, i) => slice[i] === d)) return key;
  }
  return null;
}

/**
 * Random slot: named roster, plus the hidden kits' chances (assets.resolveRandomCharacter:
 * 2.5% each, Hyper Rampalion 1%).
 */
export function resolveRandomPick(assets, rng = Math.random) {
  if (typeof assets?.resolveRandomCharacter === 'function') {
    return assets.resolveRandomCharacter(rng);
  }
  const base =
    assets?.BASE_PLAYER_KEYS ||
    ['griffin', 'sleipnir', 'express76'];
  if (!base.length) return null;
  return base[Math.floor(rng() * base.length) % base.length];
}

/** Soft-sprite grit count around the rare reveal (budget-capped, no geometry). */
export const RARE_FANFARE_MOTE_COUNT = 8;

/**
 * Build orbit grit HTML for the rare reveal overlay.
 * Stretch ≥1.5 soft ellipses + white tip cores — same language as focus/option grit.
 * Pure string helper so Node QA can assert without a document.
 */
export function buildRareFanfareMotesHtml(moteN = RARE_FANFARE_MOTE_COUNT) {
  const n = Math.max(0, moteN | 0);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const stretch = (1.55 + (i % 3) * 0.35).toFixed(2);
    const ang = ((360 * i) / n).toFixed(1);
    const rad = 86 + (i % 3) * 16;
    const delay = (i * 0.12).toFixed(2);
    const size = i % 2 ? 7 : 9;
    const tip = i % 2 ? 0.34 : 0.42;
    parts.push(
      `<span class="rare-fanfare-mote" data-stretch="${stretch}" data-tip="1" ` +
        `style="--mote-a:${ang}deg;--mote-r:${rad}px;--mote-stretch:${stretch};` +
        `--mote-delay:${delay}s;--mote-size:${size}px;--mote-tip:${tip}" ` +
        `aria-hidden="true"></span>`
    );
  }
  return `<div class="rare-fanfare-motes" aria-hidden="true">${parts.join('')}</div>`;
}

/**
 * Tick170: short-landscape rare fanfare card can paint taller than painted
 * #app (live cardH≈266–273 vs appH≈180–225) so .rare-fanfare-hint (and on
 * long pt/es tags, partial hint) clips while name stays readable.
 * Measure-then-reclaim chrome only — title/name/tag/hint strings + soft
 * motes / dens / HOLD frozen. Ladder: compact → ultra (portrait hide).
 */
export function fitRareFanfareCard(el) {
  if (!el) return;
  const app = document.getElementById('app') || el.parentElement;
  const card = el.querySelector('.rare-fanfare-card');
  const hint = el.querySelector('.rare-fanfare-hint');
  const name = el.querySelector('.rare-fanfare-name');
  const tag = el.querySelector('.rare-fanfare-tag');
  if (!app || !card || !hint) return;

  const unread = (node, minVis) => {
    if (!node) return false;
    const appR = app.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    if (
      r.bottom > appR.bottom + 1.5 ||
      r.top < appR.top - 1.5 ||
      r.right > appR.right + 1.5 ||
      r.left < appR.left - 1.5
    ) {
      return true;
    }
    const vis = Math.max(
      0,
      Math.min(r.bottom, appR.bottom) - Math.max(r.top, appR.top),
    );
    return r.height > 0 && vis < Math.min(minVis, r.height - 2);
  };
  const muddy = () =>
    unread(hint, 10) || unread(name, 14) || unread(tag, 12);

  if (!muddy()) return;
  el.classList.add('is-rare-compact');
  void el.offsetHeight;
  if (!muddy()) return;
  el.classList.add('is-rare-ultra');
  void el.offsetHeight;
}

/**
 * Play SFX + inject a short DOM overlay. Returns a Promise that resolves when dismissed
 * (auto after ~2.4s or click/key).
 */
export function playRareFanfare({ charKey, audio, host, assets } = {}) {
  const info = rareInfo(charKey);
  if (!info) return Promise.resolve(false);

  audio?.unlock?.();
  audio?.play?.('fanfare');

  const parent = host || document.getElementById('overlay-content') || document.getElementById('app');
  if (!parent) return Promise.resolve(true);

  const metaName = charDisplayName(charKey, assets?.CHAR_META?.[charKey]?.name || info.name);
  const frames = assets?.anims?.[charKey]?.idle || [];
  const selectFace = ['eternity', 'labiata', 'emily'].includes(charKey)
    ? `assets/ui/char-select/${charKey}.png`
    : '';
  const portrait =
    selectFace ||
    frameDisplaySrc(frames[0]) ||
    assets?.anims?.[charKey]?.preview?.src ||
    '';
  const portraitHtml = portrait
    ? `<img class="rare-fanfare-portrait" src="${portrait}" alt="${metaName}" />`
    : `<div class="rare-fanfare-portrait is-fallback" aria-hidden="true">★</div>`;
  const el = document.createElement('div');
  el.className = 'rare-fanfare';
  el.style.setProperty('--rare-accent', info.accent);
  el.style.setProperty('--rare-glow', info.glow);
  el.innerHTML = `
    <div class="rare-fanfare-burst" aria-hidden="true"></div>
    ${buildRareFanfareMotesHtml()}
    <div class="rare-fanfare-card">
      <span class="rare-fanfare-title">${info.title}</span>
      ${portraitHtml}
      <strong class="rare-fanfare-name">${metaName}</strong>
      <p class="rare-fanfare-tag">${rareTagline(charKey) || info.tagline}</p>
      <span class="rare-fanfare-hint">${t('rare.hint')}</span>
    </div>
  `;
  parent.appendChild(el);
  const runFit = () => fitRareFanfareCard(el);
  requestAnimationFrame(() => {
    el.classList.add('is-on');
    requestAnimationFrame(runFit);
  });
  // Re-fit after rare-pop settles (letterbox / wrap can change cardH).
  setTimeout(runFit, 480);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.remove('is-on');
      el.classList.add('is-out');
      setTimeout(() => {
        el.remove();
        resolve(true);
      }, 280);
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('click', finish);
    };
    const onKey = (e) => {
      if (e.code === 'KeyZ' || e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    el.addEventListener('click', finish);
    setTimeout(finish, 2600);
  });
}
