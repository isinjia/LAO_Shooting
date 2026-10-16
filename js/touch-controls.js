/**
 * On-screen virtual stick + action pads for landscape shmup play.
 * Writes into the same action names as keyboard (left/right/up/down/shoot/focus/bomb/special).
 * Modes: fixed (corner stick) and floating (stick at first left-zone touch).
 */

const STICK_DEAD = 0.22;
const STICK_MAX = 46;

export class TouchControls {
  /**
   * @param {HTMLElement} root
   * @param {{
   *   onDir?: (dx:number, dy:number)=>void,
   *   onButton?: (action:string, down:boolean)=>void,
   *   onPause?: ()=>void,
   *   onGesture?: ()=>void,
   *   padMode?: 'fixed'|'floating',
   * }} [handlers]
   */
  constructor(root, handlers = {}) {
    this.root = root;
    this.onDir = handlers.onDir || (() => {});
    this.onButton = handlers.onButton || (() => {});
    this.onPause = handlers.onPause || (() => {});
    this.onGesture = handlers.onGesture || (() => {});
    this.enabled = false;
    this._stickId = null;
    this._stickOrigin = { x: 0, y: 0 };
    this._knob = root.querySelector('.tc-stick-knob');
    this._base = root.querySelector('.tc-stick-base');
    this._zone = root.querySelector('.tc-stick-zone');
    this._btnMap = new Map();
    this._bound = false;
    this._fadeTimer = 0;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this.setMode(handlers.padMode || 'fixed');
    this._bindDom();
  }

  _bindDom() {
    if (!this.root || this._bound) return;
    this._bound = true;
    this.root.querySelectorAll('[data-tc]').forEach((el) => {
      const action = el.getAttribute('data-tc');
      if (!action) return;
      this._btnMap.set(el, action);
    });
    this.root.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    // Block scroll / browser gestures over pads.
    // Named handler so select↔combat dispose can drop it (anon leaked per new TouchControls).
    this._onTouchStartBlock = (e) => e.preventDefault();
    this.root.addEventListener('touchstart', this._onTouchStartBlock, { passive: false });
  }

  /** @param {'fixed'|'floating'} mode */
  setMode(mode) {
    this.mode = mode === 'floating' ? 'floating' : 'fixed';
    this.root?.classList.toggle('tc-mode-float', this.mode === 'floating');
    this.root?.classList.toggle('tc-mode-fixed', this.mode !== 'floating');
    this._hideFloatStick(true);
    if (this.enabled) this.reset();
  }

  setVisible(on) {
    this.enabled = !!on;
    this.root?.classList.toggle('is-on', this.enabled);
    if (!this.enabled) {
      this.reset();
      this.setPadHints({});
    }
  }

  /**
   * Combat-state hints on action pads (deathbomb / SP ready / charge / empty bomb).
   * @param {{ deathbomb?: boolean, specialReady?: boolean, chargeReady?: boolean, bombEmpty?: boolean, chargePct?: number, bombs?: number }} hints
   */
  setPadHints(hints = {}) {
    if (!this.root) return;
    const deathbomb = !!hints.deathbomb;
    const specialReady = !!hints.specialReady;
    const chargeReady = !!hints.chargeReady;
    const bombEmpty = !!hints.bombEmpty;
    const chargePct = Math.max(0, Math.min(100, hints.chargePct | 0));
    const bombs = hints.bombs == null ? -1 : (hints.bombs | 0);
    const specialCd = hints.specialCd | 0;
    const specialCdPct = hints.specialCdPct | 0;
    // Rampalion leg-part Z skill (dash / barrier): its own button while the legs are fused.
    const legShow = !!hints.legShow;
    const legKind = hints.legKind || '';
    const legCd = hints.legCd | 0;
    const legCdPct = hints.legCdPct | 0;
    const prev = this._padHints;
    if (
      prev
      && prev.deathbomb === deathbomb
      && prev.specialReady === specialReady
      && prev.chargeReady === chargeReady
      && prev.bombEmpty === bombEmpty
      && prev.chargePct === chargePct
      && prev.bombs === bombs
      && prev.specialCd === specialCd
      && prev.specialCdPct === specialCdPct
      && prev.legShow === legShow
      && prev.legKind === legKind
      && prev.legCd === legCd
      && prev.legCdPct === legCdPct
    ) {
      return;
    }
    const next = prev || (this._padHints = {});
    next.deathbomb = deathbomb;
    next.specialReady = specialReady;
    next.chargeReady = chargeReady;
    next.bombEmpty = bombEmpty;
    next.chargePct = chargePct;
    next.bombs = bombs;
    next.specialCd = specialCd;
    next.specialCdPct = specialCdPct;
    next.legShow = legShow;
    next.legKind = legKind;
    next.legCd = legCd;
    next.legCdPct = legCdPct;
    const leg = this.root.querySelector('.tc-leg');
    if (leg) {
      leg.hidden = !legShow;
      leg.dataset.kind = legKind;
      leg.classList.toggle('is-cooldown', legCd > 0);
      let cd = leg.querySelector('.tc-cd');
      if (legCd > 0 && !cd) {
        cd = document.createElement('span');
        cd.className = 'tc-cd';
        cd.setAttribute('aria-hidden', 'true');
        leg.appendChild(cd);
      }
      if (cd) {
        cd.textContent = legCd > 0 ? String(legCd) : '';
        cd.style.setProperty('--tc-cd', String(legCdPct));
      }
      if (!legShow && leg.classList.contains('is-held')) {
        leg.classList.remove('is-held');
        this.onButton('leg', false);
      }
    }
    const bomb = this.root.querySelector('.tc-bomb');
    const special = this.root.querySelector('.tc-special');
    const fire = this.root.querySelector('.tc-fire');
    bomb?.classList.toggle('is-deathbomb', next.deathbomb);
    bomb?.classList.toggle('is-empty', next.bombEmpty && !next.deathbomb);
    special?.classList.toggle('is-ready', next.specialReady);
    if (special) {
      // Cooldown sweep + seconds while C is locked (Peregrinus' human form).
      special.classList.toggle('is-cooldown', specialCd > 0);
      let cd = special.querySelector('.tc-cd');
      if (specialCd > 0 && !cd) {
        cd = document.createElement('span');
        cd.className = 'tc-cd';
        cd.setAttribute('aria-hidden', 'true');
        special.appendChild(cd);
      }
      if (cd) {
        cd.textContent = specialCd > 0 ? String(specialCd) : '';
        cd.style.setProperty('--tc-cd', String(specialCdPct));
      }
    }
    fire?.classList.toggle('is-charge-ready', next.chargeReady);
    if (fire) fire.style.setProperty('--tc-charge', String(next.chargePct));
    const stock = this.root.querySelector('#tc-bomb-stock');
    if (stock && next.bombs >= 0 && stock.textContent !== String(next.bombs)) {
      stock.textContent = String(next.bombs);
    }
  }

  reset() {
    this._stickId = null;
    this._setKnob(0, 0);
    this.onDir(0, 0);
    this._hideFloatStick(this.mode !== 'floating');
    this.root?.querySelectorAll('.tc-btn.is-held').forEach((el) => el.classList.remove('is-held'));
    for (const action of ['shoot', 'focus', 'bomb', 'special', 'leg']) {
      this.onButton(action, false);
    }
  }

  dispose() {
    this.reset();
    this.setVisible(false);
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    if (!this._bound) return;
    this.root?.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    if (this._onTouchStartBlock) {
      this.root?.removeEventListener('touchstart', this._onTouchStartBlock);
      this._onTouchStartBlock = null;
    }
    this._bound = false;
  }

  _gesture() {
    this.onGesture();
  }

  _hideFloatStick(immediate = false) {
    this.root?.classList.remove('is-stick-on');
    if (this.mode !== 'floating' || immediate) {
      this._clearBasePos();
    }
  }

  _clearBasePos() {
    if (!this._base) return;
    this._base.style.left = '';
    this._base.style.top = '';
    this._base.style.bottom = '';
  }

  _placeFloatStick(clientX, clientY) {
    const zone = this._zone;
    if (!zone || !this._base) return;
    const rect = zone.getBoundingClientRect();
    const bw = this._base.offsetWidth || 96;
    const bh = this._base.offsetHeight || 96;
    const x = clientX - rect.left - bw / 2;
    const y = clientY - rect.top - bh / 2;
    this._base.style.left = `${x}px`;
    this._base.style.top = `${y}px`;
    this._base.style.bottom = 'auto';
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = 0;
    }
    this.root.classList.add('is-stick-on');
  }

  _onPointerDown(e) {
    if (!this.enabled || e.pointerType === 'mouse' && e.button !== 0) return;
    // OPTIONS > pad layout editor owns every touch while it is open.
    if (this.root.classList.contains('tc-editing')) return;
    const target = e.target.closest?.('[data-tc], .tc-stick-zone');
    if (!target || !this.root.contains(target)) return;
    e.preventDefault();
    e.stopPropagation();
    this._gesture();

    if (target.classList.contains('tc-stick-zone') || target.closest('.tc-stick-zone')) {
      if (this._stickId != null) return;
      this._stickId = e.pointerId;
      const zone = this._zone || target.closest('.tc-stick-zone');
      if (this.mode === 'floating') {
        this._stickOrigin.x = e.clientX;
        this._stickOrigin.y = e.clientY;
        this._placeFloatStick(e.clientX, e.clientY);
      } else {
        const rect = zone.getBoundingClientRect();
        this._stickOrigin.x = rect.left + rect.width / 2;
        this._stickOrigin.y = rect.top + rect.height / 2;
      }
      zone.setPointerCapture?.(e.pointerId);
      this._updateStick(e.clientX, e.clientY);
      return;
    }

    const btn = e.target.closest?.('[data-tc]');
    if (!btn) return;
    const action = btn.getAttribute('data-tc');
    if (action === 'pause') {
      this.onPause();
      return;
    }
    btn.classList.add('is-held');
    btn._tcPtr = e.pointerId;
    btn.setPointerCapture?.(e.pointerId);
    this.onButton(action, true);
  }

  _onPointerMove(e) {
    if (!this.enabled || this._stickId !== e.pointerId) return;
    e.preventDefault();
    this._updateStick(e.clientX, e.clientY);
  }

  _onPointerUp(e) {
    if (!this.enabled) return;
    if (this._stickId === e.pointerId) {
      this._stickId = null;
      this._setKnob(0, 0);
      this.onDir(0, 0);
      if (this.mode === 'floating') {
        this.root?.classList.remove('is-stick-on');
        if (this._fadeTimer) clearTimeout(this._fadeTimer);
        this._fadeTimer = setTimeout(() => {
          this._clearBasePos();
          this._fadeTimer = 0;
        }, 180);
      }
    }
    this.root?.querySelectorAll('[data-tc].is-held').forEach((btn) => {
      if (btn._tcPtr === e.pointerId) {
        btn.classList.remove('is-held');
        btn._tcPtr = null;
        const action = btn.getAttribute('data-tc');
        if (action && action !== 'pause') this.onButton(action, false);
      }
    });
  }

  _updateStick(clientX, clientY) {
    let dx = (clientX - this._stickOrigin.x) / STICK_MAX;
    let dy = (clientY - this._stickOrigin.y) / STICK_MAX;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    this._setKnob(dx * STICK_MAX, dy * STICK_MAX);
    const ox = Math.abs(dx) < STICK_DEAD ? 0 : dx;
    const oy = Math.abs(dy) < STICK_DEAD ? 0 : dy;
    this.onDir(ox, oy);
  }

  _setKnob(px, py) {
    if (!this._knob) return;
    this._knob.style.transform = `translate(${px}px, ${py}px)`;
  }
}
