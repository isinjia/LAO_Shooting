import { showIntroCrawl } from './intro-crawl.js';
import { showEnding } from './ending-dialog.js';
import { loadAssets } from './assets.js';
import { Game } from './game.js';
import { ArcadeAudio } from './audio.js';
import {
  loadSettings,
  saveSettings,
  isTutorialSeen,
  markTutorialSeen,
  KEY_LABELS,
  DEFAULT_KEYS,
  POWER_CHEAT_CODES,
  codeLabel,
  primaryCode,
  applyFullscreen,
  isFullscreen,
  canFullscreen,
  fsDocument,
  matchAction,
} from './settings.js';
import {
  isRareChar,
  isRandomSlotKey,
  isSelectUnlockChar,
  resolveRandomPick,
  rareInfo,
  matchSelectCheat,
  matchTypedSelectCheat,
  SELECT_CHEAT_TIMEOUT_MS,
} from './rare-fanfare.js';
import { wantsTouchControls, isPortrait, prefersLowEndGfx } from './mobile.js';
import { frameDisplaySrc } from './clip-anim.js';
import { refitLogicalSize } from './canvas.js';
import {
  LOCALES,
  t,
  setLocale,
  applyDocumentLang,
  charDisplayName,
  missingI18nKeys,
} from './i18n.js';
import { ensureNewUiSlices } from './newui-assets.js';
import { TouchControls } from './touch-controls.js';
import { applyPadLayout, openPadEditor } from './pad-layout.js';
import { playBiosBoot, playLogo, showDemoBanner, showBlank, fadeOut, fadeIn, blackNow, crtOff, crtOn } from './attract.js';
import { BGM_TABLE } from './bgm-tracks.js';
import { PILOT_VOICES } from './pilot-voices.js';
const overlay = document.getElementById('overlay');
const content = document.getElementById('overlay-content');
const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
const rotateHint = document.getElementById('rotate-hint');
let assets = null;
let game = null;
let selected = 'griffin';
/** Hidden kit unlocked on RANDOM via select cheat (`labiata` / `lrl`). */
let selectForcedRare = null;
let selectPreviewTimers = [];
let randomPreviewTimer = 0;
let cheatBuf = [];
let cheatLastAt = 0;
/** Select-screen stick / FIRE pads (touch-ui only; disposed on leave). */
let selectNavPads = null;
let selectStickLatch = null;
/** Title-screen stick / FIRE pads (touch-ui only; vertical menu; disposed on leave). */
let titleNavPads = null;
let titleStickLatch = null;
/** Title START/OPTIONS focus index (0 = START, 1 = OPTIONS). */
let titleMenuIndex = 0;
const SELECT_GRID_COLS = 3;
const SELECT_STICK_THRESH = 0.42;
let raf = 0;
let last = 0;
let settings = loadSettings();
setLocale(settings.lang);
applyDocumentLang();
const audio = new ArcadeAudio();
audio.applySettings(settings);
/** @type {'title'|'select'|'options'|'pause'|'tutorial'|'none'} */
let screen = 'title';
let optionsReturn = 'title';
let rebindAction = null;
const HI_KEY = 'lao_mini_hiscore';
const touchUi = wantsTouchControls();
// Player-tuned pad positions / sizes (OPTIONS > pad layout) on the shared pad DOM.
applyPadLayout(document.getElementById('touch-controls'), settings.padLayout);

function syncPortraitHint() {
  const portrait = isPortrait();
  document.body.classList.toggle('is-portrait', portrait);
  if (rotateHint) {
    rotateHint.classList.toggle('is-on', portrait);
    rotateHint.setAttribute('aria-hidden', portrait ? 'false' : 'true');
  }
}

function syncTouchPads() {
  if (!game) return;
  // Pads only during live play (no overlay menus).
  const play = screen === 'none' && !game.paused;
  game.setTouchPadsVisible(play);
}
function readHiScore() {
  const n = Number(localStorage.getItem(HI_KEY) || 0);
  return Number.isFinite(n) ? Math.max(0, n | 0) : 0;
}
function writeHiScore(score) {
  const next = Math.max(readHiScore(), score | 0);
  localStorage.setItem(HI_KEY, String(next));
  return next;
}
function padScore(n) {
  return String(Math.max(0, n | 0)).padStart(7, '0');
}
function setHudDimmed(on) {
  hud.classList.toggle('is-dimmed', !!on);
}
function syncHiHud() {
  const hiEl = document.getElementById('hi-score');
  if (hiEl) hiEl.textContent = padScore(readHiScore());
}
function persistSettings(partial = {}) {
  settings = saveSettings({ ...settings, ...partial });
  setLocale(settings.lang);
  applyDocumentLang();
  audio.applySettings(settings);
  if (game) game.setSettings(settings);
  applyPadLayout(document.getElementById('touch-controls'), settings.padLayout);
  return settings;
}
function clearTitleStageArt() {
  overlay.querySelector('.title-stage-art')?.remove();
  overlay.classList.remove('is-title-art');
}
function showOverlay(html, screenClass = '') {
  overlay.classList.remove('hidden');
  content.className = screenClass;
  // Clear prior panel-budget inline caps (options/select/tutorial/pause/result sync)
  // so the next screen does not inherit a stale maxHeight / pad after innerHTML swap.
  content.style.maxHeight = '';
  content.style.paddingTop = '';
  content.style.paddingBottom = '';
  content.innerHTML = html;
  // Title sky + Griffin stage lives on #overlay (full-bleed), not inside the panel.
  if (screenClass === 'screen-title') {
    overlay.classList.add('is-title-art');
  } else {
    clearTitleStageArt();
  }
  syncTouchPads();
}
function hideOverlay() {
  clearTitleStageArt();
  overlay.classList.add('hidden');
  content.className = '';
  content.style.maxHeight = '';
  content.style.paddingTop = '';
  content.style.paddingBottom = '';
  content.innerHTML = '';
  screen = 'none';
  syncTouchPads();
}
function keyChip(action) {
  const codes = settings.keys?.[action] || DEFAULT_KEYS[action] || [];
  return codes.map((c) => `<kbd>${codeLabel(c)}</kbd>`).join(' / ');
}
function showTitle() {
  selectForcedRare = null;
  cheatBuf = [];
  stopTitleNavPads();
  stopSelectNavPads();
  if (game) {
    game.dispose();
    game = null;
  }
  cancelAnimationFrame(raf);
  raf = 0;
  setHudDimmed(true);
  syncHiHud();
  document.getElementById('boss-bar').classList.add('hidden');
  screen = 'title';
  // Original title BGM (01 BGM_Title).
  audio.playBgmTrack(BGM_TABLE.title);
  const touchHelp = touchUi
    ? `<div class="title-touch-help">${t('title.touchHelp')}</div>`
    : '';
  showOverlay(`
    <div class="panel-frame" aria-hidden="true">
      <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
      <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
    </div>
    <aside class="lobby-rail" aria-hidden="true">
      <span class="lobby-rail-ico lobby-ico-mission" title="mission"></span>
      <span class="lobby-rail-ico lobby-ico-squad" title="squad"></span>
      <span class="lobby-rail-ico lobby-ico-cha" title="character"></span>
      <span class="lobby-rail-ico lobby-ico-equip lobby-rail-ico-brass" title="equip"></span>
    </aside>
    <aside class="lobby-rail lobby-rail-right" aria-hidden="true">
      <span class="lobby-rail-ico lobby-ico-workshop lobby-rail-ico-brass" title="workshop"></span>
      <span class="lobby-rail-ico lobby-ico-research" title="research"></span>
      <span class="lobby-rail-ico lobby-ico-room" title="room"></span>
      <span class="lobby-rail-ico lobby-ico-friend" title="friend"></span>
    </aside>
    <div class="title-hero">
      <span class="brand-mark">HORIZONTAL BULLET HELL</span>
      <h1><span class="title-main">LAST SHOOTING</span><span class="title-sub">SIDE SCROLL SHOOTER</span><span class="title-tagline">${t('title.tagline')}</span></h1>
    </div>
    <div class="title-actions" role="menu" aria-label="Title menu">
      <button class="btn btn-primary btn-cta" id="btn-start" role="menuitem">${t('btn.start')}</button>
      <button class="btn" id="btn-options" role="menuitem">${t('btn.options')}</button>
    </div>
    ${touchHelp}
    <footer class="lobby-foot" aria-hidden="true">
      <span>LAO MINI</span><span class="lobby-status-sep">·</span>
      <span>SIDE SCROLL</span><span class="lobby-status-sep">·</span>
      <span class="lobby-status-mint">STANDBY</span>
    </footer>
  `, 'screen-title');
  // Full-bleed sky is CSS on .overlay-veil; Griffin plate sits on #overlay right.
  overlay.querySelector('.title-stage-art')?.remove();
  const stage = document.createElement('div');
  stage.className = 'title-stage-art';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML =
    '<img class="title-griffin" src="assets/ui/title-griffin-pa00.webp" alt="" draggable="false" />';
  overlay.appendChild(stage);
  // Title CONTROLS / HI-SCORE chrome removed — budget sync no-ops without .keys.
  syncTitleKeysPanelBudget();
  titleMenuIndex = 0;
  setTitleMenuFocus(0);
  titleMenuButtons().forEach((btn, i) => {
    btn.addEventListener('pointerenter', () => setTitleMenuFocus(i));
  });
  document.getElementById('btn-start').onclick = () => {
    stopTitleNavPads();
    audio.unlock();
    void showSelect();
  };
  document.getElementById('btn-options').onclick = () => {
    stopTitleNavPads();
    showOptions('title');
  };
  startTitleNavPads();
}

/** Grow title CONTROLS `.keys-rules` max-height for long i18n wrap (es/ru). */
function syncTitleKeysRulesHeight() {
  const rules = content?.querySelector?.('.keys-rules');
  if (!rules) return;
  rules.style.maxHeight = 'none';
  const need = Math.ceil(rules.scrollHeight) + 1; // +1 subpixel pad
  const fs = parseFloat(getComputedStyle(rules).fontSize) || 11;
  const floor = Math.ceil(fs * 3.6);
  const cap = Math.ceil(fs * 6.6);
  rules.style.maxHeight = `${Math.min(cap, Math.max(floor, need))}px`;
}

/** Vertical box model for flex budget (height + vertical margins). */
function _blockBudgetH(el) {
  if (!el) return 0;
  const cs = getComputedStyle(el);
  return (
    el.offsetHeight +
    (parseFloat(cs.marginTop) || 0) +
    (parseFloat(cs.marginBottom) || 0)
  );
}

/**
 * Keep title CONTROLS pins readable after i18n height grow (tick118) / tall touchHelp.
 * Reclaim from `.title-touch-help` (strings kept, scroll if clamped), then min-height `.keys`
 * so keys-grid does not collapse to 0 and HI-SCORE stays inside the overflow:hidden panel.
 * Tick122: unitless lh → gridFloor px. Tick123: maxCap ≥ pinned+gridFloor so tall
 * rules + grid minHeight cannot overflow-hide the HI pin.
 * Tick124: prefer full keys-grid scrollHeight under maxCap (gridWant no longer
 * collapses to gridFloor) so Focus/Bomb/Special + Pause/Mute rows are not
 * scroll-clipped when the ≤268 budget can fund them.
 * Tick130: parent-aware cap — never force keys minHeight past overlay-content
 * remaining space (hero+CTA used to push entire CONTROLS below oc clip @800×450,
 * hiVisibleInOc=0 while keys-internal HI looked healthy). Reclaim title lobby
 * chrome (strip/foot/status/tagline) + compact decorative hero bits; keep h1.
 * Tick135: extreme-short (@640×360 / @720×400) — after tick130 chrome ladder
 * HI can stay inside while keys-grid collapses to ~5–14px (panel margin outside
 * oc cannot fund the flex slot). Compact CONTROLS head/rules chrome (strings
 * kept) then re-fund a soft grid floor ≥40; tick118 rules grow restored on
 * taller viewports via syncTitleKeysRulesHeight re-entry.
 */
function syncTitleKeysPanelBudget() {
  const keys = content?.querySelector?.('.keys');
  if (!keys || !content?.classList?.contains?.('screen-title')) return;
  const head = keys.querySelector('.keys-head');
  const grid = keys.querySelector('.keys-grid');
  const rules = keys.querySelector('.keys-rules');
  const hi = keys.querySelector('.keys-hiscore');
  // HI-SCORE-only title panel (CONTROLS body removed) — no keys-grid budget.
  if (!hi) return;
  if (!head || !grid) {
    keys.style.minHeight = '';
    keys.style.maxHeight = '';
    return;
  }

  const strip = content.querySelector('.lobby-resource-strip');
  const foot = content.querySelector('.lobby-foot');
  const status = content.querySelector('.lobby-status-bar');
  const tagline = content.querySelector('.tagline');
  const hero = content.querySelector('.title-hero');
  const brand = hero?.querySelector?.('.brand-mark');
  const titleSub = hero?.querySelector?.('.title-sub');
  const h1 = hero?.querySelector?.('h1');
  const actions = content.querySelector('.title-actions');
  const touchHelp = content.querySelector('.title-touch-help');

  // Clear prior tick119/122/123/124/130/135 inline so remeasure is stable across locale switches.
  keys.style.minHeight = '';
  keys.style.maxHeight = '';
  grid.style.minHeight = '';
  if (touchHelp) {
    touchHelp.style.maxHeight = '';
    touchHelp.style.overflow = '';
  }
  if (strip) strip.style.display = '';
  if (foot) foot.style.display = '';
  if (status) status.style.display = '';
  if (tagline) tagline.style.display = '';
  if (brand) brand.style.display = '';
  if (titleSub) titleSub.style.display = '';
  if (h1) {
    h1.style.fontSize = '';
    h1.style.marginBottom = '';
  }
  if (hero) hero.style.marginBottom = '';
  if (actions) {
    actions.style.margin = '';
    actions.style.gap = '';
    const cta = actions.querySelector('.btn-cta');
    if (cta) cta.style.padding = '';
  }
  // Tick135 compact clear — restore tick118 rules grow before pinned measure.
  head.style.margin = '';
  head.style.fontSize = '';
  head.style.padding = '';
  if (rules) {
    rules.style.display = '';
    rules.style.margin = '';
    rules.style.fontSize = '';
    rules.style.lineHeight = '';
    rules.style.overflow = '';
    rules.style.minHeight = '';
  }
  syncTitleKeysRulesHeight();

  const csKeys = getComputedStyle(keys);
  const maxH = parseFloat(csKeys.maxHeight);
  const cssMax = Number.isFinite(maxH) && maxH > 0 ? maxH : 200;
  const padY =
    (parseFloat(csKeys.paddingTop) || 0) + (parseFloat(csKeys.paddingBottom) || 0);
  const gridCs = getComputedStyle(grid);
  const gridFs = parseFloat(gridCs.fontSize) || 11;
  // Tick122: keys-grid uses unitless line-height:1.55 — parseFloat("1.55")===1.55
  // (not px). Treating that as 1.55px made gridFloor≈4, so es/pt rules grow
  // (tick118) early-returned "healthy" while keys-grid crushed to ~7–15px.
  let gridLh = parseFloat(gridCs.lineHeight);
  const lhRaw = gridCs.lineHeight;
  if (
    !Number.isFinite(gridLh)
    || lhRaw === 'normal'
    || (gridLh > 0 && gridLh < gridFs * 0.9 && !lhRaw.endsWith('px'))
  ) {
    const mult = Number.isFinite(gridLh) && gridLh > 0 && gridLh < 8 ? gridLh : 1.55;
    gridLh = gridFs * mult;
  }
  // At least ~2.5 key rows visible; prefer full grid when it fits under maxCap.
  const gridFloor = Math.ceil(gridLh * 2.5);
  // Tick124: prior gridWant used max(gridFloor, ceil(lh*2.5)) (== gridFloor),
  // so Math.min(scrollHeight, gridFloor) never preferred the full 4-row grid.
  const gridFull = Math.max(gridFloor, Math.ceil(grid.scrollHeight));
  const pinned = _blockBudgetH(head) + _blockBudgetH(rules) + _blockBudgetH(hi);
  // Tick123: after tick118 rules grow + tick122 grid minHeight, cssMax+48 alone
  // (~174 on 800×450) is shorter than head+gridFloor+rules+HI — HI-SCORE was
  // fully clipped by keys overflow:hidden (es live hiVisibleH=0). Raise cap to
  // the pinned+floor need (still ≤260) so the opaque HI pin stays inside.
  const floorNeed = Math.ceil(pinned + gridFloor + padY);
  const fullNeed = Math.ceil(pinned + gridFull + padY);
  // Tick124: also raise maxCap toward fullNeed so Focus/Bomb/Special + Pause/Mute
  // fit when the hard ceiling allows (ko/en/ru/pt live). Ceiling 268 (was 260)
  // covers es fullNeed≈263 after tall rules grow without unbounded panel grow.
  const maxCap = Math.min(268, Math.max(cssMax + 48, floorNeed, fullNeed));
  const need = fullNeed;

  const app = document.getElementById('app');
  const appH = app?.clientHeight || window.innerHeight || 540;

  const measureAvail = () => {
    // Read the flex-assigned keys slot: clear forced min/max briefly so
    // `.keys` (flex:1) fills remaining overlay-content space after chrome
    // reclaim. Arithmetic sibling sums drifted on border-box padding.
    const prevMin = keys.style.minHeight;
    const prevMax = keys.style.maxHeight;
    const prevGridMin = grid.style.minHeight;
    keys.style.minHeight = '0px';
    keys.style.maxHeight = 'none';
    grid.style.minHeight = '0px';
    void content.offsetHeight;
    const slot = Math.floor(keys.clientHeight);
    keys.style.minHeight = prevMin;
    keys.style.maxHeight = prevMax;
    grid.style.minHeight = prevGridMin;
    return slot;
  };
  const hiInsideOc = () => {
    void content.offsetHeight;
    const ocR = content.getBoundingClientRect();
    const hiR = hi.getBoundingClientRect();
    const keysR = keys.getBoundingClientRect();
    const hiVis = Math.max(
      0,
      Math.min(hiR.bottom, ocR.bottom) - Math.max(hiR.top, ocR.top),
    );
    // Require nearly full HI pin (not a ~20px partial peek).
    return (
      hiVis >= hiR.height - 1.5
      && hiR.bottom <= ocR.bottom + 1.5
      && keysR.top < ocR.bottom - 8
    );
  };
  const hiOverOc = () => {
    void content.offsetHeight;
    const ocR = content.getBoundingClientRect();
    const hiR = hi.getBoundingClientRect();
    return Math.max(0, hiR.bottom - (ocR.bottom + 1));
  };

  // Tick130: short / parent-short landscapes — reclaim decorative lobby chrome
  // so CONTROLS can occupy remaining flex space (display only; i18n kept).
  // Ladder is avail-driven (not HI-precheck) to avoid over-hiding before
  // parent-aware minHeight is applied. Compact CTA before brand so 720p
  // can keep HORIZONTAL BULLET HELL / title-sub when the slot allows.
  const compactActions = () => {
    if (!actions) return;
    actions.style.margin = '4px auto 6px';
    actions.style.gap = '6px';
    const cta = actions.querySelector('.btn-cta');
    if (cta) cta.style.padding = '10px 18px';
  };
  let avail = measureAvail();
  if (appH <= 480 || avail < floorNeed) {
    if (strip) strip.style.display = 'none';
    if (foot) foot.style.display = 'none';
    avail = measureAvail();
  }
  if (avail < floorNeed) {
    compactActions();
    if (status) status.style.display = 'none';
    avail = measureAvail();
  }
  if (avail < floorNeed) {
    if (tagline) tagline.style.display = 'none';
    avail = measureAvail();
  }
  if (avail < floorNeed) {
    if (brand) brand.style.display = 'none';
    if (titleSub) titleSub.style.display = 'none';
    if (h1) {
      h1.style.fontSize = '22px';
      h1.style.marginBottom = '2px';
    }
    if (hero) hero.style.marginBottom = '0';
    avail = measureAvail();
  }

  // Parent-aware ceiling: never force minHeight past remaining oc space.
  const parentCap = Math.max(0, avail);
  const effectiveCap = Math.min(maxCap, Math.max(parentCap, 0));
  const gridBudget = Math.max(
    0,
    Math.min(
      gridFull,
      Math.max(
        parentCap >= floorNeed ? gridFloor : 0,
        Math.floor(effectiveCap - pinned - padY),
      ),
    ),
  );

  // Already healthy — keys funded AND HI visible inside overlay-content.
  if (
    keys.clientHeight + 1 >= Math.min(need, effectiveCap || maxCap)
    && keys.clientHeight + 1 >= Math.min(floorNeed, effectiveCap || floorNeed)
    && grid.clientHeight >= Math.max(0, gridBudget - 1)
    && hiInsideOc()
    && parentCap >= floorNeed
  ) {
    return;
  }

  let target;
  if (effectiveCap >= floorNeed) {
    target = Math.min(effectiveCap, Math.max(need, floorNeed));
  } else if (effectiveCap > 0) {
    // Severely short: fit CONTROLS shell; grid may shrink below floor.
    target = effectiveCap;
  } else {
    target = 0;
  }

  // Flex siblings are pinned (tick32/40) — reclaim only from optional touchHelp.
  if (touchHelp && target > 0) {
    const shortfall = Math.max(0, target - keys.clientHeight);
    if (shortfall > 0) {
      const helpFs = parseFloat(getComputedStyle(touchHelp).fontSize) || 12;
      const helpFloor = Math.ceil(helpFs * 2.8); // keep ~2 lines readable
      const helpH = touchHelp.offsetHeight;
      const helpMax = Math.max(helpFloor, helpH - shortfall);
      if (helpMax < helpH - 0.5) {
        touchHelp.style.maxHeight = `${helpMax}px`;
        touchHelp.style.overflow = 'auto';
        avail = measureAvail();
        const recap = Math.min(maxCap, Math.max(0, avail));
        if (recap >= floorNeed) {
          target = Math.min(recap, Math.max(need, floorNeed));
        } else {
          target = recap;
        }
      }
    }
  }

  if (target > cssMax + 0.5) keys.style.maxHeight = `${target}px`;
  else if (parentCap > 0 && parentCap < cssMax) keys.style.maxHeight = `${parentCap}px`;
  keys.style.minHeight = target > 0 ? `${target}px` : '0px';
  // Protect keys-grid from flex crush; fund full rows when target allows.
  const gridTarget = Math.max(
    0,
    Math.min(gridFull, Math.floor(Math.max(0, target - pinned - padY))),
  );
  // Prefer gridFloor when the parent-funded target can host it (tick122/124).
  const gridFinal =
    target >= floorNeed ? Math.max(gridFloor, gridTarget) : gridTarget;
  grid.style.minHeight = `${gridFinal}px`;

  // Final health shave if HI still outside oc (measureAvail can overshoot
  // by a few px vs getBoundingClientRect after flex settle). Shrink keys
  // first; only then climb the chrome ladder one step at a time — never
  // re-expand toward fullNeed (that over-hid brand/status on 720p).
  const applyKeysTarget = (next) => {
    const capped = Math.max(0, Math.min(maxCap, Math.floor(next)));
    keys.style.maxHeight = capped > 0 ? `${capped}px` : '0px';
    keys.style.minHeight = capped > 0 ? `${capped}px` : '0px';
    const g = Math.max(
      0,
      Math.min(gridFull, Math.floor(Math.max(0, capped - pinned - padY))),
    );
    grid.style.minHeight = `${capped >= floorNeed ? Math.max(gridFloor, g) : g}px`;
  };
  const chromeSteps = [
    () => {
      if (strip) strip.style.display = 'none';
      if (foot) foot.style.display = 'none';
    },
    () => {
      compactActions();
      if (status) status.style.display = 'none';
    },
    () => {
      if (tagline) tagline.style.display = 'none';
    },
    () => {
      if (brand) brand.style.display = 'none';
      if (titleSub) titleSub.style.display = 'none';
      if (h1) {
        h1.style.fontSize = '22px';
        h1.style.marginBottom = '2px';
      }
      if (hero) hero.style.marginBottom = '0';
    },
  ];
  let chromeStep = 0;
  for (let i = 0; i < 6; i += 1) {
    if (hiInsideOc()) break;
    const over = hiOverOc();
    const cur = parseFloat(keys.style.minHeight) || keys.clientHeight || 0;
    if (over > 0.5 && cur > 0) {
      applyKeysTarget(cur - over - 4);
      continue;
    }
    if (chromeStep < chromeSteps.length) {
      chromeSteps[chromeStep]();
      chromeStep += 1;
      avail = measureAvail();
      applyKeysTarget(
        avail >= floorNeed
          ? Math.min(avail, Math.max(need, floorNeed))
          : avail,
      );
      continue;
    }
    applyKeysTarget(Math.min(cur > 0 ? cur - 8 : 0, measureAvail()));
  }

  // Tick135: extreme-short grid floor — HI-inside alone can mask a crushed
  // keys-grid (@640×360 live gridH≈5 / @720×400≈14). Compact CONTROLS head +
  // rules chrome only when grid < 40; contact/combo strings stay in DOM.
  // Pin rules minHeight so flex:1 keys-grid cannot eat the peek band.
  // @800×450 already ≥42 after tick130 — do not clip tick118 rules grow.
  void content.offsetHeight;
  const softGridWant = 40;
  if (grid.clientHeight + 0.5 < softGridWant) {
    head.style.margin = '0 0 2px';
    head.style.fontSize = '11px';
    head.style.padding = '0';
    const rulesFloor = Math.ceil(10 * 2.8);
    if (rules) {
      // Ensure peek visible if any legacy CSS hide remains.
      rules.style.display = 'block';
      rules.style.margin = '2px 0 0';
      rules.style.fontSize = '10px';
      rules.style.lineHeight = '1.25';
      // ~2.8 lines — enough for compact contact+combo peek; full grow on taller.
      rules.style.maxHeight = `${rulesFloor}px`;
      rules.style.minHeight = `${rulesFloor}px`;
      rules.style.overflow = 'hidden';
    }
    keys.style.minHeight = '0px';
    keys.style.maxHeight = 'none';
    grid.style.minHeight = '0px';
    void content.offsetHeight;
    const pinnedSoft =
      _blockBudgetH(head) + _blockBudgetH(rules) + _blockBudgetH(hi);
    const floorSoft = Math.ceil(pinnedSoft + softGridWant + padY);
    applyKeysTarget(Math.min(maxCap, floorSoft));
    grid.style.minHeight = `${softGridWant}px`;
    if (rules) rules.style.minHeight = `${rulesFloor}px`;
    for (let i = 0; i < 4; i += 1) {
      if (hiInsideOc()) break;
      const over = hiOverOc();
      const cur = parseFloat(keys.style.minHeight) || keys.clientHeight || 0;
      if (over > 0.5 && cur > softGridWant + rulesFloor + 24) {
        applyKeysTarget(cur - over - 4);
        const g = Math.max(
          0,
          Math.min(
            softGridWant,
            Math.floor(
              Math.max(
                0,
                (parseFloat(keys.style.minHeight) || 0) - pinnedSoft - padY,
              ),
            ),
          ),
        );
        grid.style.minHeight = `${Math.max(g, Math.min(softGridWant, 36))}px`;
        if (rules) rules.style.minHeight = `${rulesFloor}px`;
        continue;
      }
      break;
    }
  }
}
function charCardHtml(key, meta, preview, revealedKey = null, slot = 1) {
  const revealing = isRandomSlotKey(key) && isSelectUnlockChar(revealedKey);
  const showKey = revealing ? revealedKey : key;
  const rare = isRareChar(showKey);
  const random = isRandomSlotKey(key) && !revealing;
  const selectedOn =
    key === selected ||
    showKey === selected ||
    (revealing && isSelectUnlockChar(selected));
  const selectedCls = selectedOn ? ' selected' : '';
  const rareCls = rare ? ' is-rare' : '';
  const randCls = isRandomSlotKey(key) ? ' is-random' : '';
  const revealedCls = revealing ? ' is-revealed' : '';
  const badge = rare
    ? '<span class="rare-badge">RARE</span>'
    : random
      ? '<span class="rare-badge random">???</span>'
      : '';
  const displayName = random ? 'RANDOM' : charDisplayName(showKey, meta?.name || showKey);
  const face = random
    ? `<div class="char-preview random-face" id="${key}-preview" aria-hidden="true">
        <span class="dice" title="RANDOM">⚄</span>
        <span class="qmark">?</span>
      </div>`
    : `<img class="char-preview" id="${key}-preview" src="${preview}" alt="${displayName}" />`;
  const slotLbl = random || isRandomSlotKey(key) ? '??' : String(slot).padStart(2, '0');
  return `
    <button class="char-card${selectedCls}${rareCls}${randCls}${revealedCls}" data-key="${key}" data-slot="${slot}">
      <span class="char-slot">${slotLbl}</span>
      ${badge}
      ${face}
      <div class="name">${displayName}</div>
    </button>`;
}

const ARROW_DIR = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

function selectDirFromEvent(e) {
  if (!e || e.altKey || e.ctrlKey || e.metaKey) return null;
  if (ARROW_DIR[e.code]) return ARROW_DIR[e.code];
  if (matchAction(settings, 'up', e.code)) return 'up';
  if (matchAction(settings, 'down', e.code)) return 'down';
  if (matchAction(settings, 'left', e.code)) return 'left';
  if (matchAction(settings, 'right', e.code)) return 'right';
  return null;
}

function stopSelectNavPads() {
  if (selectNavPads) {
    selectNavPads.dispose();
    selectNavPads = null;
  }
  selectStickLatch = null;
  const root = document.getElementById('touch-controls');
  // Title menu reuses is-select-nav chrome — do not strip while title pads live.
  if (!titleNavPads) {
    root?.classList.remove('is-select-nav', 'is-title-nav');
    root?.setAttribute('aria-hidden', 'true');
    // Only drop has-touch-pads when live play pads are not active.
    if (!(game && screen === 'none' && !game.paused)) {
      document.body.classList.remove('has-touch-pads');
    }
  }
}

function stopTitleNavPads() {
  if (titleNavPads) {
    titleNavPads.dispose();
    titleNavPads = null;
  }
  titleStickLatch = null;
  const root = document.getElementById('touch-controls');
  // Select nav may still own pads — only clear title caption/chrome then.
  if (!selectNavPads) {
    root?.classList.remove('is-select-nav', 'is-title-nav');
    root?.setAttribute('aria-hidden', 'true');
    if (!(game && screen === 'none' && !game.paused)) {
      document.body.classList.remove('has-touch-pads');
    }
  } else {
    root?.classList.remove('is-title-nav');
  }
}

function titleMenuButtons() {
  return [
    document.getElementById('btn-start'),
    document.getElementById('btn-options'),
  ].filter(Boolean);
}

/** Arcade focus highlight on title START / OPTIONS (title screen only). */
function setTitleMenuFocus(idx) {
  if (screen !== 'title') return;
  const btns = titleMenuButtons();
  if (!btns.length) return;
  const n = btns.length;
  titleMenuIndex = ((idx % n) + n) % n;
  btns.forEach((b, i) => {
    const on = i === titleMenuIndex;
    b.classList.toggle('is-menu-focus', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function moveTitleMenu(dir) {
  if (screen !== 'title') return;
  const before = titleMenuIndex;
  if (dir === 'up') setTitleMenuFocus(titleMenuIndex - 1);
  else if (dir === 'down') setTitleMenuFocus(titleMenuIndex + 1);
  if (titleMenuIndex !== before) audio.play('ui:move');
}

function confirmTitleMenu() {
  if (screen !== 'title') return;
  const btns = titleMenuButtons();
  const btn = btns[titleMenuIndex];
  if (btn) btn.click();
}

/**
 * PC debug cheats (P/O power, J SP charge, Y/T stage jump, U invincible) are off until
 * "치트활성화온" is typed on the title screen. Matched by physical key (2-beolsik layout:
 * ㅊㅣㅌㅡㅎㅘㄹㅅㅓㅇㅎㅘㅇㅗㄴ), so it works with the Korean or the English IME. Lasts
 * for the browser session. Unrelated to the hidden-pilot codes on the select screen.
 */
const CHEAT_ON_CODES = ['KeyC', 'KeyL', 'KeyX', 'KeyM', 'KeyG', 'KeyH', 'KeyK', 'KeyF', 'KeyT',
  'KeyJ', 'KeyD', 'KeyG', 'KeyH', 'KeyK', 'KeyD', 'KeyH', 'KeyS'];
let cheatsOn = false;
try { cheatsOn = sessionStorage.getItem('lao_cheats') === '1'; } catch { /* */ }
const cheatOnBuf = [];
function trackCheatCode(e) {
  if (cheatsOn || !e.code || e.repeat) return;
  cheatOnBuf.push(e.code);
  if (cheatOnBuf.length > CHEAT_ON_CODES.length) cheatOnBuf.shift();
  if (cheatOnBuf.length === CHEAT_ON_CODES.length && cheatOnBuf.every((k, i) => k === CHEAT_ON_CODES[i])) {
    cheatsOn = true;
    try { sessionStorage.setItem('lao_cheats', '1'); } catch { /* */ }
    audio.play('ui:ok');
    const note = document.createElement('div');
    note.className = 'cheat-on-toast';
    note.textContent = '치트 활성화';
    document.getElementById('app')?.appendChild(note);
    setTimeout(() => note.remove(), 1800);
  }
}

function onTitleMenuKey(e) {
  if (screen !== 'title') return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  trackCheatCode(e);
  if (e.code === 'Space' || e.code === 'Enter') {
    if (e.repeat) return;
    e.preventDefault();
    // START opens the select screen synchronously; without this the same key event reached
    // the select handler next and confirmed the last-picked pilot (bug: "sometimes starts
    // straight away as Express").
    e.stopImmediatePropagation();
    confirmTitleMenu();
    return;
  }
  const dir = selectDirFromEvent(e);
  if (dir !== 'up' && dir !== 'down') return;
  if (e.repeat) return;
  e.preventDefault();
  moveTitleMenu(dir);
}

function startTitleNavPads() {
  stopTitleNavPads();
  stopSelectNavPads();
  if (!touchUi) return;
  const root = document.getElementById('touch-controls');
  if (!root) return;
  root.classList.add('is-select-nav', 'is-title-nav');
  root.setAttribute('aria-hidden', 'false');
  titleStickLatch = null;
  titleNavPads = new TouchControls(root, {
    padMode: settings?.padMode === 'floating' ? 'floating' : 'fixed',
    onGesture: () => audio.unlock(),
    onDir: (dx, dy) => {
      if (screen !== 'title') return;
      // Vertical menu only — ignore left/right stick tilt.
      let dir = null;
      if (Math.abs(dy) >= Math.abs(dx)) {
        if (dy >= SELECT_STICK_THRESH) dir = 'down';
        else if (dy <= -SELECT_STICK_THRESH) dir = 'up';
      }
      if (!dir) {
        titleStickLatch = null;
        return;
      }
      if (titleStickLatch === dir) return;
      titleStickLatch = dir;
      moveTitleMenu(dir);
    },
    onButton: (action, down) => {
      if (screen !== 'title' || !down) return;
      if (action === 'shoot') confirmTitleMenu();
    },
    onPause: () => {},
  });
  titleNavPads.setVisible(true);
  document.body.classList.add('has-touch-pads');
}

function startSelectNavPads() {
  stopSelectNavPads();
  stopTitleNavPads();
  if (!touchUi) return;
  const root = document.getElementById('touch-controls');
  if (!root) return;
  root.classList.add('is-select-nav');
  root.setAttribute('aria-hidden', 'false');
  selectStickLatch = null;
  selectNavPads = new TouchControls(root, {
    padMode: settings?.padMode === 'floating' ? 'floating' : 'fixed',
    onGesture: () => audio.unlock(),
    onDir: (dx, dy) => {
      if (screen !== 'select') return;
      let dir = null;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx >= SELECT_STICK_THRESH) dir = 'right';
        else if (dx <= -SELECT_STICK_THRESH) dir = 'left';
      } else if (dy >= SELECT_STICK_THRESH) dir = 'down';
      else if (dy <= -SELECT_STICK_THRESH) dir = 'up';
      if (!dir) {
        selectStickLatch = null;
        return;
      }
      if (selectStickLatch === dir) return;
      selectStickLatch = dir;
      moveSelectByDir(dir);
      // Same direction cheats as the keyboard (one entry per flick of the stick).
      pushSelectCheat(dir);
    },
    onButton: (action, down) => {
      if (screen !== 'select' || !down) return;
      if (action === 'shoot') confirmSelectSortie();
    },
    onPause: () => {},
  });
  selectNavPads.setVisible(true);
  document.body.classList.add('has-touch-pads');
}

function stopSelectPreviews() {
  selectPreviewTimers.forEach((id) => clearInterval(id));
  selectPreviewTimers = [];
  if (randomPreviewTimer) {
    clearInterval(randomPreviewTimer);
    randomPreviewTimer = 0;
  }
  stopSelectNavPads();
}

function selectCardNodes() {
  return [...(content?.querySelectorAll('.char-card') || [])];
}

function selectFocusIndex() {
  const cards = selectCardNodes();
  let idx = cards.findIndex((c) => c.classList.contains('selected'));
  if (idx < 0) {
    idx = cards.findIndex((c) => c.dataset.key === selected);
  }
  if (idx < 0 && selectForcedRare) {
    idx = cards.findIndex((c) => isRandomSlotKey(c.dataset.key));
  }
  return { cards, idx: idx < 0 ? 0 : idx };
}

/** Highlight / select a card without confirming sortie (keyboard / stick). */
function setSelectedCard(btn) {
  if (!btn || screen !== 'select') return;
  if (!btn.classList.contains('selected')) audio.play('ui:move');
  const key = btn.dataset.key;
  // A cheat-revealed RANDOM slot (LRL / Labiata) stays revealed while the highlight
  // moves; only another cheat swaps it. Focusing it again selects that hidden kit.
  if (isRandomSlotKey(key) && selectForcedRare) {
    selected = selectForcedRare;
  } else {
    selected = key;
  }
  content.querySelectorAll('.char-card').forEach((b) => b.classList.toggle('selected', b === btn));
  syncSelectDossier();
}

function moveSelectByDir(dir) {
  const { cards, idx } = selectFocusIndex();
  if (!cards.length) return;
  // 3 named on top + RANDOM centered below (not a 3×2 filled grid).
  const randomIdx = cards.findIndex((c) => isRandomSlotKey(c.dataset.key));
  const topCards = cards.filter((c) => !isRandomSlotKey(c.dataset.key));
  const onRandom = randomIdx >= 0 && idx === randomIdx;
  let nextIdx = idx;
  if (dir === 'left' || dir === 'right') {
    if (onRandom || !topCards.length) return;
    const topIdx = topCards.indexOf(cards[idx]);
    const n = topCards.length;
    const step = dir === 'left' ? -1 : 1;
    const ni = ((topIdx + step) % n + n) % n;
    nextIdx = cards.indexOf(topCards[ni]);
  } else if (dir === 'down' || dir === 'up') {
    if (randomIdx < 0) return;
    if (onRandom) {
      const mid = Math.min(1, Math.max(0, topCards.length - 1));
      nextIdx = cards.indexOf(topCards[mid] || topCards[0]);
    } else {
      nextIdx = randomIdx;
    }
  } else return;
  const btn = cards[nextIdx];
  if (btn) setSelectedCard(btn);
}

function confirmSelectSortie() {
  if (screen !== 'select') return;
  document.getElementById('btn-go')?.click();
}

/** Unity FormationIcon (N) for select faces — never SelectWorld Event_Btn. */
const SELECT_PORTRAITS = {
  griffin: 'assets/ui/char-select/griffin.png',
  sleipnir: 'assets/ui/char-select/sleipnir.png',
  express76: 'assets/ui/char-select/express76.png',
  hirume: 'assets/ui/char-select/hirume.png',
  constantia: 'assets/ui/char-select/constantia.png',
  lrl: 'assets/ui/char-select/lrl.png',
  merlin: 'assets/ui/char-select/merlin.png',
  fafnir: 'assets/ui/char-select/fafnir.png',
  eternity: 'assets/ui/char-select/eternity.png',
  labiata: 'assets/ui/char-select/labiata.png',
  peregrinus: 'assets/ui/char-select/peregrinus.png',
  emily: 'assets/ui/char-select/emily.png',
  rampalion: 'assets/ui/char-select/rampalion.png',
};

/** Prefer LAO FormationIcon; fall back to unit bake preview / idle frame. */
function selectPortraitSrc(charKey) {
  if (!charKey || isRandomSlotKey(charKey)) return '';
  if (SELECT_PORTRAITS[charKey]) return SELECT_PORTRAITS[charKey];
  const frames = assets?.anims?.[charKey]?.idle || [];
  return (
    frameDisplaySrc(frames[0]) ||
    assets?.anims?.[charKey]?.preview?.src ||
    `assets/sd_baked/${charKey}/preview.png`
  );
}

function startIdlePreview(charKey, el) {
  // FormationIcon select faces stay static — do not overwrite with SD idle cycle.
  if (SELECT_PORTRAITS[charKey]) return;
  const frames = assets?.anims?.[charKey]?.idle || [];
  const isRandomEl = el && el.id === 'random-preview';
  if (isRandomEl && randomPreviewTimer) {
    clearInterval(randomPreviewTimer);
    randomPreviewTimer = 0;
  }
  if (!el || el.tagName !== 'IMG' || frames.length <= 1) return;
  let i = 0;
  const id = setInterval(() => {
    i = (i + 1) % frames.length;
    const src = frameDisplaySrc(frames[i]);
    if (src) el.src = src;
  }, 1000 / (assets.anims[charKey].idleFps || 24));
  if (isRandomEl) randomPreviewTimer = id;
  else selectPreviewTimers.push(id);
}

function rarePortrait(charKey) {
  return selectPortraitSrc(charKey);
}

function rareSelectMeta(charKey) {
  return assets?.CHAR_META?.[charKey] || rareInfo(charKey) || { name: charKey };
}

function paintRandomSlot(revealedKey) {
  const card = content.querySelector('.char-card[data-key="random"]');
  if (!card) return;
  const revealing = isSelectUnlockChar(revealedKey);
  const meta = revealing ? rareSelectMeta(revealedKey) : { name: 'RANDOM' };
  const preview = revealing ? rarePortrait(revealedKey) : '';
  const wrap = document.createElement('div');
  wrap.innerHTML = charCardHtml('random', meta, preview, revealing ? revealedKey : null, 0).trim();
  const next = wrap.firstElementChild;
  card.replaceWith(next);
  bindCharCards();
  syncSelectDossier();
  if (revealing) startIdlePreview(revealedKey, document.getElementById('random-preview'));
  else if (randomPreviewTimer) {
    clearInterval(randomPreviewTimer);
    randomPreviewTimer = 0;
  }
}

function syncSelectDossier() {
  const nameEl = content.querySelector('#select-dossier-name');
  const kitEl = content.querySelector('#select-dossier-kit');
  if (!nameEl || !kitEl) return;
  const forced = selectForcedRare && isSelectUnlockChar(selectForcedRare) ? selectForcedRare : null;
  const key = selected;
  const random = isRandomSlotKey(key) && !forced;
  // Character select: one sortie-prep track (BGM_Thrill_01) whichever pilot is highlighted.
  audio?.playBgmTrack?.(BGM_TABLE.select);
  const meta = assets?.CHAR_META?.[key] || rareSelectMeta(key);
  const name = random ? 'RANDOM' : charDisplayName(key, meta?.name || key);
  nameEl.textContent = name;
  // Select UI: hide SHOT / HOLD / SPECIAL skill names (combat HUD / kits untouched).
  kitEl.textContent = '';
  kitEl.hidden = true;
}

function bindCharCards() {
  content.querySelectorAll('.char-card').forEach((btn) => {
    btn.onclick = () => {
      setSelectedCard(btn);
      // Direct sortie — no standby/confirm step (mouse + touch).
      confirmSelectSortie();
    };
  });
}

async function applySelectCheat(charKey) {
  if (!isSelectUnlockChar(charKey)) return;
  selectForcedRare = charKey;
  selected = charKey;
  cheatBuf = [];
  audio.unlock();
  audio.play?.('cue');
  // Reveal right away (portrait is a static select image) with the highlight on it,
  // then load the kit.
  if (screen === 'select') {
    paintRandomSlot(charKey);
    content.querySelectorAll('.char-card').forEach((b) => {
      b.classList.toggle('selected', isRandomSlotKey(b.dataset.key));
    });
    syncSelectDossier();
  }
  if (assets?.bank?.ensurePlayer) {
    try {
      await assets.bank.ensurePlayer(charKey);
    } catch (err) {
      console.warn('[assets] cheat rare load failed', err);
    }
  }
  // A newer cheat (LRL <-> Labiata) may own the slot by now: don't repaint a stale one.
  if (screen !== 'select' || selectForcedRare !== charKey) return;
  paintRandomSlot(charKey);
  content.querySelectorAll('.char-card').forEach((b) => {
    b.classList.toggle('selected', isRandomSlotKey(b.dataset.key) ? selected === charKey
      : b.dataset.key === selected);
  });
  syncSelectDossier();
}

/**
 * Typed-name hidden pilots (e.g. 램파리온 / rampalion): only after the title cheat
 * ("치트활성화온") is on. Physical key codes, so the Korean or English IME both match.
 */
let typedCheatBuf = [];
let typedCheatLastAt = 0;
function trackTypedSelectCheat(e) {
  if (!cheatsOn || !e.code || e.repeat) return null;
  const now = performance.now();
  if (now - typedCheatLastAt > 2500) typedCheatBuf = [];
  typedCheatLastAt = now;
  typedCheatBuf.push(e.code);
  if (typedCheatBuf.length > 16) typedCheatBuf.splice(0, typedCheatBuf.length - 16);
  const hit = matchTypedSelectCheat(typedCheatBuf);
  if (hit) typedCheatBuf = [];
  return hit;
}

function onSelectCheatKey(e) {
  if (screen !== 'select') return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const typedHit = trackTypedSelectCheat(e);
  if (typedHit) {
    // The last letter of the name must not also move the highlight off RANDOM.
    e.preventDefault();
    void applySelectCheat(typedHit);
    return;
  }
  // Space confirms current highlight (SORTIE). Enter kept as alias.
  if (e.code === 'Space' || e.code === 'Enter') {
    if (e.repeat) return;
    // Not while the roster is still loading (no cards yet): nothing has been picked.
    if (!content.querySelector('.char-card')) return;
    e.preventDefault();
    confirmSelectSortie();
    return;
  }
  const dir = selectDirFromEvent(e);
  if (!dir) return;
  if (e.repeat) return;
  e.preventDefault();
  // Arrows / WASD: 2D grid focus among character cards.
  moveSelectByDir(dir);
  pushSelectCheat(dir);
}

/** Rare-unlock cheat buffer (direction sequence): keyboard arrows and the touch stick. */
function pushSelectCheat(dir) {
  const now = performance.now();
  if (now - cheatLastAt > SELECT_CHEAT_TIMEOUT_MS) cheatBuf = [];
  cheatLastAt = now;
  cheatBuf.push(dir);
  if (cheatBuf.length > 16) cheatBuf.splice(0, cheatBuf.length - 16);
  const hit = matchSelectCheat(cheatBuf);
  if (hit) {
    cheatBuf = [];
    void applySelectCheat(hit);
  }
}

async function showSelect() {
  screen = 'select';
  // Priority: roster clips for select portraits (title already showed with BGs only).
  if (assets?.bank && typeof assets.bank.loadSelect === 'function') {
    showLoading();
    try {
      assets = await assets.bank.loadSelect(updateLoading);
    } catch (err) {
      showOverlay(`
        <span class="brand-mark">ERROR</span>
        <h2>${t('err.charLoad')}</h2>
        <p>${err.message}</p>
        <button class="btn" id="btn-load-back"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${t('btn.toTitle')}</button>
      `, 'screen-result gameover');
      document.getElementById('btn-load-back').onclick = () => showTitle();
      console.error(err);
      return;
    }
  }
  // Slots 1–3 = named roster; RANDOM below (hidden kits are cheat-only, not direct-pick).
  const baseKeys =
    assets.BASE_PLAYER_KEYS ||
    ['griffin', 'sleipnir', 'express76'];
  const randomKey = assets.RANDOM_SLOT_KEY || 'random';
  const keys = [...baseKeys, randomKey];
  if (selectForcedRare && isSelectUnlockChar(selectForcedRare)) {
    selected = selectForcedRare;
    if (assets?.bank?.ensurePlayer) {
      try {
        await assets.bank.ensurePlayer(selectForcedRare);
      } catch (err) {
        console.warn('[assets] cheat rare load failed', err);
      }
    }
  } else {
    selectForcedRare = null;
    // After a hidden sortie, highlight RANDOM again (not a named card).
    if (isSelectUnlockChar(selected) || isRandomSlotKey(selected)) selected = randomKey;
    else if (!keys.includes(selected)) selected = baseKeys[0] || 'griffin';
  }
  const cols = 3;
  const cards = keys
    .map((key, i) => {
      const slot = i + 1;
      if (isRandomSlotKey(key)) {
        if (selectForcedRare) {
          const meta = rareSelectMeta(selectForcedRare);
          return charCardHtml(key, meta, rarePortrait(selectForcedRare), selectForcedRare, slot);
        }
        return charCardHtml(key, { name: 'RANDOM' }, '', null, slot);
      }
      const meta = assets.CHAR_META[key] || rareInfo(key) || { name: key };
      const preview = selectPortraitSrc(key);
      return charCardHtml(key, meta, preview, null, slot);
    })
    .join('');
  showOverlay(`
    <div class="panel-frame" aria-hidden="true">
      <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
      <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
    </div>
    <aside class="lobby-rail lobby-rail-select" aria-hidden="true">
      <span class="lobby-rail-ico lobby-ico-cha" title="character"></span>
      <span class="lobby-rail-ico lobby-ico-squad" title="squad"></span>
      <span class="lobby-rail-ico lobby-ico-mission lobby-rail-ico-brass" title="mission"></span>
    </aside>
    <aside class="lobby-rail lobby-rail-right lobby-rail-select" aria-hidden="true">
      <span class="lobby-rail-ico lobby-ico-book" title="book"></span>
      <span class="lobby-rail-ico lobby-ico-box3" title="box"></span>
      <span class="lobby-rail-ico lobby-ico-base lobby-rail-ico-brass" title="base"></span>
    </aside>
    <header class="sortie-head">
      <span class="brand-mark">SORTIE SELECT</span>
      <h2>${t('select.h2')}</h2>
      <span class="sortie-deco" aria-hidden="true"></span>
    </header>
    <div class="lobby-resource-strip lobby-resource-select" aria-hidden="true">
      <span class="lobby-chip"><i class="lobby-chip-ico lobby-ico-cha"></i>ROSTER</span>
      <span class="lobby-chip lobby-chip-mint"><i class="lobby-chip-ico lobby-ico-mission"></i>SORTIE</span>
    </div>
    <div class="select-dossier">
      <div>
        <div class="select-dossier-name" id="select-dossier-name">—</div>
        <div class="select-dossier-kit" id="select-dossier-kit"></div>
      </div>
    </div>
    <div class="char-grid" style="grid-template-columns:repeat(${cols},1fr)">
      ${cards}
    </div>
    <div class="select-actions">
      <button class="btn btn-primary btn-cta" id="btn-go">${t('btn.sortie')}</button>
      <button class="btn btn-ghost" id="btn-options-select">${t('btn.options')}</button>
    </div>
  `, 'screen-select');
  stopSelectPreviews();
  keys.forEach((key) => {
    if (isRandomSlotKey(key)) {
      if (selectForcedRare) startIdlePreview(selectForcedRare, document.getElementById(`${key}-preview`));
      return;
    }
    startIdlePreview(key, document.getElementById(`${key}-preview`));
  });
  bindCharCards();
  syncSelectDossier();
  // Tick126: long i18n kit/dossier must not push SORTIE CTA past body clip.
  syncSelectPanelBudget();
  requestAnimationFrame(() => {
    syncSelectPanelBudget();
    requestAnimationFrame(() => syncSelectPanelBudget());
  });
  // Touch / coarse: left stick moves highlight; FIRE confirms (above overlay).
  startSelectNavPads();
  document.getElementById('btn-go').onclick = async () => {
    stopSelectPreviews();
    let pick = selected;
    const forced = selectForcedRare && isSelectUnlockChar(selectForcedRare) ? selectForcedRare : null;
    // The revealed kit sorties only from the RANDOM slot; a named card sorties as itself.
    // Hidden kits start exactly like the regular ones (user): no separate loading screen or
    // reveal fanfare - startGame loads the pilot with the stage.
    if (forced && selected === forced) pick = forced;
    else if (isRandomSlotKey(pick)) pick = resolveRandomPick(assets) || baseKeys[0] || 'griffin';
    beginSortie(pick);
  };
  document.getElementById('btn-options-select').onclick = () => {
    stopSelectPreviews();
    showOptions('select');
  };
}
function showTutorialThen(startFn) {
  if (isTutorialSeen()) {
    startFn();
    return;
  }
  showTutorialPanel(startFn);
}

/** The sortie briefing; `help` = opened from PAUSE (one CLOSE button back to the menu). */
function showTutorialPanel(onDone, { help = false } = {}) {
  screen = 'tutorial';
  showOverlay(`
    <div class="panel-frame" aria-hidden="true">
      <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
      <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
    </div>
    <header class="opt-head">
      <span class="brand-mark">SORTIE BRIEFING</span>
      <h2>${t('tut.h2')}</h2>
      <span class="tutorial-deco" aria-hidden="true"></span>
    </header>
    <div class="tutorial-grid">
      ${touchUi ? `
      <div class="tut-row"><span class="tut-pill">STICK</span><span>${t('tut.stick')}</span></div>
      <div class="tut-row"><span class="tut-pill">FIRE</span><span>${t('tut.fire')}</span></div>
      <div class="tut-row"><span class="tut-pill">BOMB</span><span>${t('tut.bomb')}</span></div>
      <div class="tut-row"><span class="tut-pill">SP</span><span>${t('tut.sp')}</span></div>
      ` : `
      <div class="tut-row"><kbd>${codeLabel(primaryCode(settings, 'shoot'))}</kbd><span>${t('tut.fire')}</span></div>
      <div class="tut-row"><kbd>${codeLabel(primaryCode(settings, 'bomb'))}</kbd><span>${t('tut.kbBomb')}</span></div>
      <div class="tut-row"><kbd>${codeLabel(primaryCode(settings, 'special'))}</kbd><span>${t('tut.sp')}</span></div>
      <div class="tut-row"><kbd>${codeLabel(primaryCode(settings, 'focus'))}</kbd><span>${t('tut.focus')}</span></div>
      `}
    </div>
    ${help ? '' : `<p class="tutorial-note">${t('tut.note')}</p>`}
    <div class="pause-actions">
      ${help ? `<button class="btn btn-primary btn-cta" id="btn-tut-close">${t('btn.close')}</button>` : `
      <button class="btn btn-primary btn-cta" id="btn-tut-go">${t('btn.sortie')}</button>
      <button class="btn btn-ghost" id="btn-tut-skip">${t('btn.tutSkip')}</button>`}
    </div>
  `, 'screen-tutorial');
  // Tick125: long i18n tut rows must not push sortie CTA past body clip.
  syncTutorialPanelBudget();
  requestAnimationFrame(() => syncTutorialPanelBudget());
  if (help) {
    document.getElementById('btn-tut-close').onclick = () => onDone();
    return;
  }
  const finish = (remember) => {
    if (remember) markTutorialSeen();
    onDone();
  };
  document.getElementById('btn-tut-go').onclick = () => finish(true);
  document.getElementById('btn-tut-skip').onclick = () => finish(true);
}

/**
 * Tick126+: keep select SORTIE CTA inside #app after long-locale kit/dossier
 * wrap + 6-card grid. Cap panel to ~92% of app height; pin head/resource/
 * dossier/actions.
 * Nav/no-scroll tick: `.char-grid` is overflow:hidden (no scroll). Budget
 * reclaims chrome so both card rows fit the flex slot; face size scales via
 * --select-face. CTA-health ladder (tick141/144/161) preserved.
 */
function syncSelectPanelBudget() {
  const oc = content;
  if (!oc?.classList.contains('screen-select')) return;
  const grid = oc.querySelector('.char-grid');
  const actions = oc.querySelector('.select-actions');
  const head = oc.querySelector('.sortie-head');
  const resource = oc.querySelector('.lobby-resource-select');
  const dossier = oc.querySelector('.select-dossier');
  const deco = oc.querySelector('.sortie-deco');
  const blurb = oc.querySelector('.select-blurb');
  const brand = head?.querySelector('.brand-mark');
  const h2 = head?.querySelector('h2');
  const hint = oc.querySelector('.select-dossier-hint');
  if (!grid || !actions) return;

  // Clear prior tick161 chrome so resize / remount remeasure is stable.
  oc.classList.remove('is-select-short');
  oc.style.maxHeight = '';
  oc.style.paddingTop = '';
  oc.style.paddingBottom = '';
  grid.style.minHeight = '';
  grid.style.overflow = 'hidden';
  oc.style.setProperty('--select-face', '');
  if (resource) resource.style.display = '';
  if (deco) deco.style.display = '';
  if (blurb) blurb.style.display = '';
  if (brand) {
    brand.style.display = '';
    brand.style.marginBottom = '';
  }
  if (h2) {
    h2.style.fontSize = '';
    h2.style.margin = '';
    h2.style.letterSpacing = '';
    h2.style.marginBottom = '';
  }
  if (hint) hint.style.display = '';
  if (dossier) {
    dossier.style.padding = '';
    dossier.style.border = '';
    dossier.style.backgroundImage = '';
    dossier.style.boxShadow = '';
    dossier.style.clipPath = '';
    dossier.style.marginBottom = '';
  }
  actions.style.padding = '';
  actions.style.border = '';
  actions.style.backgroundImage = '';
  actions.style.clipPath = '';
  actions.style.gap = '';
  for (const b of actions.querySelectorAll('.btn')) {
    b.style.padding = '';
    b.style.minHeight = '';
    b.style.fontSize = '';
    b.style.minWidth = '';
  }


  const app = document.getElementById('app');
  const appH = app?.clientHeight || window.innerHeight || 540;
  // Hard ceiling 680 matches CSS.
  // Tick141: SE-class — clientHeight can read 320 while the painted #app
  // box is ≈319.5 (live panelOver≈0.25 / headroom≈−0.3; CTA clear).
  // Keep the 320 floor intent, then clamp to the measured box height.
  const appBoxH = app?.getBoundingClientRect?.().height || appH;
  const fitH = Math.floor(Math.min(appH, appBoxH));
  const ratioCap = Math.floor(fitH * 0.92);
  const floorCap = Math.min(320, fitH);
  let maxCap = Math.min(680, Math.max(floorCap, ratioCap));
  oc.style.maxHeight = `${maxCap}px`;

  // Prefer reclaiming chrome early so both card rows stay on-screen (no scroll).
  if (resource && appH <= 640) resource.style.display = 'none';
  if (appH <= 520) {
    if (deco) deco.style.display = 'none';
    if (blurb) blurb.style.display = 'none';
  }

  const card = grid.querySelector('.char-card');
  const cardH = card ? Math.max(56, _blockBudgetH(card)) : 96;
  const gapY = parseFloat(getComputedStyle(grid).rowGap || getComputedStyle(grid).gap) || 8;
  const csOc = getComputedStyle(oc);
  const padY =
    (parseFloat(csOc.paddingTop) || 0) + (parseFloat(csOc.paddingBottom) || 0);
  const pinnedH = () =>
    _blockBudgetH(head) +
    _blockBudgetH(resource) +
    _blockBudgetH(dossier) +
    _blockBudgetH(actions) +
    padY;

  const SAFETY = 8;
  // Full two-row roster (6 cards / 3 cols) — no scroll priority.
  const fullFloorWant = Math.ceil(cardH * 2 + gapY);
  // Absolute minimum readable band if chrome cannot shrink further.
  const softFloorWant = Math.min(Math.ceil(cardH * 0.9), 64);
  let pinned = pinnedH();
  let avail = Math.floor(maxCap - pinned - SAFETY);

  const reclaimForGrid = (want) => {
    if (avail >= want) return;
    if (resource) resource.style.display = 'none';
    if (deco) deco.style.display = 'none';
    if (blurb) blurb.style.display = 'none';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    if (avail >= want) return;
    if (dossier) {
      dossier.style.padding = '4px 6px';
      dossier.style.border = 'none';
      dossier.style.backgroundImage = 'none';
      dossier.style.boxShadow = 'none';
      dossier.style.clipPath = 'none';
      dossier.style.marginBottom = '4px';
      pinned = pinnedH();
      avail = Math.floor(maxCap - pinned - SAFETY);
    }
    if (avail >= want) return;
    actions.style.border = 'none';
    actions.style.backgroundImage = 'none';
    actions.style.padding = '4px 0';
    actions.style.clipPath = 'none';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    if (avail >= want) return;
    if (brand) brand.style.marginBottom = '2px';
    if (h2) h2.style.marginBottom = '2px';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    if (avail >= want) return;
    if (hint) {
      hint.style.display = 'none';
      pinned = pinnedH();
      avail = Math.floor(maxCap - pinned - SAFETY);
    }
    if (avail >= want) return;
    oc.classList.add('is-select-short');
    if (brand) brand.style.display = 'none';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    if (avail >= want) return;
    if (h2) {
      h2.style.fontSize = '15px';
      h2.style.margin = '0';
      h2.style.letterSpacing = '0.08em';
      pinned = pinnedH();
      avail = Math.floor(maxCap - pinned - SAFETY);
    }
    if (avail >= want) return;
    if (dossier) {
      dossier.style.padding = '2px 4px';
      dossier.style.marginBottom = '2px';
    }
    oc.style.paddingTop = '8px';
    oc.style.paddingBottom = '6px';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
  };

  reclaimForGrid(fullFloorWant);
  if (avail < softFloorWant) reclaimForGrid(softFloorWant);

  // Give the grid the full remaining flex slot (cards stretch via 1fr 1fr rows).
  const gridFloor = Math.max(0, avail);
  grid.style.minHeight = `${gridFloor}px`;
  grid.style.overflow = 'hidden';

  // Scale portraits so two rows fit without clipping when slot is short.
  const rowH = Math.max(36, Math.floor((gridFloor - gapY) / 2));
  const face = Math.max(36, Math.min(96, Math.floor(rowH * 0.62)));
  oc.style.setProperty('--select-face', `${face}px`);

  const ctaOverflow = () => {
    if (!app) return 0;
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const actR = actions.getBoundingClientRect();
    const overApp = Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top);
    const overOc = Math.max(0, actR.bottom - (ocR.bottom + 1), (ocR.top - 1) - actR.top);
    return Math.max(overApp, overOc);
  };

  for (let i = 0; i < 4; i += 1) {
    const over = ctaOverflow();
    if (over <= 0.5) break;
    if (resource) resource.style.display = 'none';
    if (deco) deco.style.display = 'none';
    if (blurb) blurb.style.display = 'none';
    const cur = parseFloat(grid.style.minHeight) || 0;
    if (cur > softFloorWant) {
      const next = Math.max(softFloorWant, Math.floor(cur - over - 4));
      grid.style.minHeight = `${next}px`;
      const rh = Math.max(36, Math.floor((next - gapY) / 2));
      oc.style.setProperty('--select-face', `${Math.max(36, Math.min(96, Math.floor(rh * 0.62)))}px`);
      continue;
    }
    // Tick144: Math.max(260, …) re-inflated above fitH on ultra-short
    // (live @400×280 fitH≈225 → maxH=260 / panelOver≈17.5).
    maxCap = Math.max(floorCap, Math.min(fitH, Math.floor(maxCap - over - 4)));
    oc.style.maxHeight = `${maxCap}px`;
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    if (avail > 0) {
      grid.style.minHeight = `${Math.max(softFloorWant, Math.min(fullFloorWant, avail))}px`;
      const rh = Math.max(36, Math.floor((parseFloat(grid.style.minHeight) - gapY) / 2));
      oc.style.setProperty('--select-face', `${Math.max(36, Math.min(96, Math.floor(rh * 0.62)))}px`);
    }
  }

  // Tick161: grid/maxCap floor can still leave CTA/back OOB when the
  // three-button actions row wraps under .btn-cta min-width:180 (live
  // actionsH≈108–110 / ctaOver≈49–81 @400×240·280 while panelOver=0).
  // Measure-then-reclaim chrome only — kit / SORTIE labels stay.
  const refundGrid = () => {
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    if (avail > 0) {
      grid.style.minHeight = `${Math.max(0, avail)}px`;
      const rh = Math.max(36, Math.floor((avail - gapY) / 2));
      oc.style.setProperty('--select-face', `${Math.max(36, Math.min(96, Math.floor(rh * 0.62)))}px`);
    }
  };
  if (ctaOverflow() > 0.5) {
    if (hint) hint.style.display = 'none';
    // Collapse 2-row wrap first (often enough to clear pt/es/en/ko + keep brand).
    actions.style.border = 'none';
    actions.style.backgroundImage = 'none';
    actions.style.clipPath = 'none';
    actions.style.padding = '2px 0';
    actions.style.gap = '4px';
    for (const b of actions.querySelectorAll('.btn')) {
      b.style.padding = '4px 8px';
      b.style.minHeight = '28px';
      b.style.fontSize = '12px';
    }
    const ctaBtn = actions.querySelector('.btn-cta');
    if (ctaBtn) ctaBtn.style.minWidth = '0';
    refundGrid();
  }
  if (ctaOverflow() > 0.5) {
    // Tall-kit locales (live ru dossier≈80): still need head chrome.
    oc.classList.add('is-select-short');
    if (brand) brand.style.display = 'none';
    refundGrid();
  }
  if (ctaOverflow() > 0.5 && h2) {
    h2.style.fontSize = '16px';
    h2.style.margin = '0';
    h2.style.letterSpacing = '0.1em';
    refundGrid();
  }
  if (ctaOverflow() > 0.5) {
    if (dossier) {
      dossier.style.padding = '2px 4px';
      dossier.style.marginBottom = '2px';
    }
    oc.style.paddingTop = '8px';
    oc.style.paddingBottom = '6px';
    refundGrid();
  }
}

/**
 * Tick127: keep OPTIONS BACK CTA inside #app after long-locale autofire /
 * padNote / key rows grow the panel past body overflow:hidden. Cap panel to
 * ~92% of app height; pin head/status/resource/actions; scroll only
 * `.opt-scroll` (CONTROLS/tutorial/select pattern).
 * Tick136: extreme-short soft scroll floor — after status/resource reclaim,
 * @640×360 still left `.opt-scroll` ~100–109px (softScrollWant 140) so the
 * first viewport only fit SYSTEM + language while BGM clipped. Measure-then-
 * reclaim decorative opt-head brand + Title_Deco (::after via .is-opt-short)
 * + compact h2, then re-fund scroll ≥140. Strings / tip61 / tick120–121 /
 * tick128 / dens / tick116–135 frozen.
 * Tick141: SE-class maxCap floor — clientHeight can read 320 while the
 * painted #app box is ≈319.5 (live panelOver≈0.25 / headroom≈−0.3; BACK
 * clear). Floor is min(320, fitH) with fitH from measured box. tip35/61 /
 * tick120–121 / 127–128 / 136 / dens / tick116–140 frozen.
 */
function syncOptionsPanelBudget() {
  const oc = content;
  if (!oc?.classList.contains('screen-options')) return;
  const scroll = oc.querySelector('.opt-scroll');
  const actions = oc.querySelector('.opt-actions');
  const head = oc.querySelector('.opt-head');
  const brand = head?.querySelector('.brand-mark');
  const h2 = head?.querySelector('h2');
  const status = oc.querySelector('.lobby-status-options');
  const resource = oc.querySelector('.lobby-resource-options');
  if (!scroll || !actions) return;

  // Clear prior tick136 compact so resize / remount remeasure is stable.
  oc.classList.remove('is-opt-short');
  oc.style.maxHeight = '';
  scroll.style.minHeight = '';
  if (status) status.style.display = '';
  if (resource) resource.style.display = '';
  if (brand) brand.style.display = '';
  if (head) {
    head.style.marginBottom = '';
    head.style.paddingBottom = '';
  }
  if (h2) {
    h2.style.fontSize = '';
    h2.style.margin = '';
    h2.style.letterSpacing = '';
  }

  const app = document.getElementById('app');
  const appH = app?.clientHeight || window.innerHeight || 540;
  // Hard ceiling 680 matches CSS.
  // Tick141: SE-class — clientHeight can read 320 while the painted #app
  // box is ≈319.5 (live panelOver≈0.25 / headroom≈−0.3; BACK clear /
  // scrollH≥soft floor). Keep the 320 floor intent, then clamp to the
  // measured box height. tip35/61 / tick120–121 / 127–128 / 136 / dens frozen.
  const appBoxH = app?.getBoundingClientRect?.().height || appH;
  const fitH = Math.floor(Math.min(appH, appBoxH));
  const ratioCap = Math.floor(fitH * 0.92);
  const floorCap = Math.min(320, fitH);
  let maxCap = Math.min(680, Math.max(floorCap, ratioCap));
  oc.style.maxHeight = `${maxCap}px`;

  // Compact landscapes: reclaim decorative INFO/CFG + SYSTEM/AUDIO/KEYS strips
  // so `.opt-scroll` keeps a readable slice under pinned BACK.
  if (appH <= 560) {
    if (resource) resource.style.display = 'none';
    if (status) status.style.display = 'none';
  }

  const csOc = getComputedStyle(oc);
  const padY =
    (parseFloat(csOc.paddingTop) || 0) + (parseFloat(csOc.paddingBottom) || 0);
  const pinnedH = () =>
    _blockBudgetH(head) +
    _blockBudgetH(status) +
    _blockBudgetH(resource) +
    _blockBudgetH(actions) +
    padY;

  const SAFETY = 10;
  // Soft floor ≈ system block peek — language + BGM + SFX start (tick136).
  const softScrollWant = 140;
  let pinned = pinnedH();
  let avail = Math.floor(maxCap - pinned - SAFETY);
  const softFloor = Math.min(softScrollWant, Math.max(0, avail));
  scroll.style.minHeight = softFloor >= 72 ? `${softFloor}px` : `${Math.max(0, avail)}px`;

  const ctaOverflow = () => {
    if (!app) return 0;
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const actR = actions.getBoundingClientRect();
    const overApp = Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top);
    const overOc = Math.max(0, actR.bottom - (ocR.bottom + 1), (ocR.top - 1) - actR.top);
    return Math.max(overApp, overOc);
  };

  for (let i = 0; i < 4; i += 1) {
    const over = ctaOverflow();
    if (over <= 0.5) break;
    if (resource) resource.style.display = 'none';
    if (status) status.style.display = 'none';
    const cur = parseFloat(scroll.style.minHeight) || 0;
    if (cur > 0) {
      scroll.style.minHeight = `${Math.max(0, Math.floor(cur - over - 4))}px`;
      continue;
    }
    maxCap = Math.max(260, Math.floor(maxCap - over - 4));
    oc.style.maxHeight = `${maxCap}px`;
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    if (avail > 0) scroll.style.minHeight = `${Math.min(softScrollWant, avail)}px`;
  }

  // Tick136: if scroll slice still below soft floor, reclaim head chrome.
  void oc.offsetHeight;
  if (scroll.clientHeight + 0.5 < softScrollWant) {
    oc.classList.add('is-opt-short');
    if (brand) brand.style.display = 'none';
    if (head) {
      head.style.marginBottom = '2px';
      head.style.paddingBottom = '0';
    }
    if (h2) {
      h2.style.fontSize = '18px';
      h2.style.margin = '0';
      h2.style.letterSpacing = '0.12em';
    }
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned - SAFETY);
    const funded = Math.min(softScrollWant, Math.max(0, avail));
    scroll.style.minHeight = funded >= 72 ? `${funded}px` : `${Math.max(0, avail)}px`;
    for (let i = 0; i < 2; i += 1) {
      const over = ctaOverflow();
      if (over <= 0.5) break;
      const cur = parseFloat(scroll.style.minHeight) || 0;
      if (cur > 0) {
        scroll.style.minHeight = `${Math.max(0, Math.floor(cur - over - 4))}px`;
      }
    }
  }
}

/**
 * Tick131: keep pause panel inside #app on short landscapes after long-locale
 * unmute / toTitle wrap. Live: ru@800×450 panelOver≈5 (panelH 460 > appH 450)
 * while CTA stayed inside (actionsOver≈−36). Reclaim decorative pause-deco →
 * compact blurb Box2 plate → tighten actions/panel pad; no nested scroll.
 * tip31/58 / dens / tick116–130 frozen.
 * Tick138: extreme-short (@640×360) — after tick131 ladder, es/ru still sat at
 * panelOver≈0 / headroom≈0 while decorative SYSTEM HOLD brand (~24px) + tall
 * h2 ate chrome (CTA clear; syncSteps=4 pad shrink). Measure-then-reclaim
 * brand + compact h2 (options/tutorial extreme-short parity) before actions
 * pad so the panel keeps breathing room without inventing tip/glow.
 * Tick140: SE-class (@568×320) — ≤400 CSS brand/h2 belt drops panelOver under
 * +1.5 (live over≈0.83) while raw headroom stays ≈−1.8 for ko/en/pt/zh-TW
 * (CTA clear; syncSteps=0 early return). Soft-continue when appH≤340 &&
 * rawHeadroom<8 (result tick139 parity) so actions/panel pad still fund
 * breathing room. tip31/58 / tick131 / tick138 / dens / tick116–139 frozen.
 * Tick162: after tick142 fitH / CSS max-height, resume CTA can stay fully
 * visible while #btn-quit (toTitle) clips under overflow:hidden (live
 * *@400×240·280 quitVis≈0–9 / actionsH≈166–191 / panelOver=0; also
 * ru@480×288). Measure-then-reclaim actions row compact (gap/pad/btn
 * pad/minH/font + btn-cta minWidth=0) — select tick161 peer. Strings /
 * tip31/58 / tick131/138/140/142 / dens / tick116–161 frozen.
 * Tick166: after tick162 compact, *@320×200 still HARD quit clip while
 * resume full (live quitVis≈0–21 / secOut / actionsOut; panelOver≈2 /
 * maxH=''). Measure-then-reclaim ultra actions compact (gap2 / pad1 /
 * btn 24×11px) — tutorial tick164 / result tick165 peer. Strings /
 * tip31/58 / tick131/138/140/142/162 / dens / tick116–165 frozen.
 */
function syncPausePanelBudget() {
  const oc = content;
  if (!oc?.classList.contains('screen-pause')) return;
  const deco = oc.querySelector('.pause-deco');
  const blurb = oc.querySelector('.pause-blurb');
  const actions = oc.querySelector('.pause-actions');
  const stamp = oc.querySelector('.pause-stamp');
  const brand = stamp?.querySelector('.brand-mark');
  const h2 = stamp?.querySelector('h2');
  const app = document.getElementById('app');
  if (!app || !actions) return;

  // Clear prior reclaim so unmute remount / resize remeasure is stable.
  oc.classList.remove('is-pause-short');
  oc.style.maxHeight = '';
  oc.style.paddingTop = '';
  oc.style.paddingBottom = '';
  if (deco) deco.style.display = '';
  if (brand) {
    brand.style.display = '';
    brand.style.marginBottom = '';
  }
  if (h2) {
    h2.style.fontSize = '';
    h2.style.margin = '';
    h2.style.letterSpacing = '';
  }
  if (blurb) {
    blurb.style.border = '';
    blurb.style.backgroundImage = '';
    blurb.style.padding = '';
    blurb.style.clipPath = '';
    blurb.style.marginTop = '';
  }
  actions.style.padding = '';
  actions.style.gap = '';
  actions.style.border = '';
  actions.style.backgroundImage = '';
  actions.style.clipPath = '';
  for (const b of actions.querySelectorAll('.btn')) {
    b.style.padding = '';
    b.style.minHeight = '';
    b.style.fontSize = '';
    b.style.minWidth = '';
  }

  const panelOver = () => {
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    return Math.max(
      0,
      ocR.bottom - (appR.bottom + 1),
      (appR.top - 1) - ocR.top,
    );
  };

  const appH0 = app.clientHeight || window.innerHeight || 450;
  const rawHeadroom = () => {
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    return appR.bottom - ocR.bottom;
  };
  const softContinue = () => appH0 <= 340 && rawHeadroom() < 8;

  // Tick162: quit/toTitle can clip under overflow:hidden while panelOver=0
  // and resume CTA stays fully painted (select tick161 chrome-health peer).
  const quitChromeOverflow = () => {
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const actR = actions.getBoundingClientRect();
    const overApp = Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top);
    const overOc = Math.max(0, actR.bottom - (ocR.bottom + 1), (ocR.top - 1) - actR.top);
    const quit = oc.querySelector('#btn-quit');
    let quitUnread = 0;
    if (quit) {
      const r = quit.getBoundingClientRect();
      const vis = Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
      const need = Math.min(20, Math.max(0, r.height - 2));
      if (vis + 0.5 < need) quitUnread = need - vis;
      if (r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5) {
        quitUnread = Math.max(quitUnread, r.bottom - (appR.bottom + 1));
      }
    }
    return Math.max(overApp, overOc, quitUnread);
  };

  let over = panelOver();
  // Tick140: ≤400 CSS brand/h2 belt can drop panelOver under the +1.5
  // tolerance while raw headroom stays negative @SE-class — still fund
  // actions/panel pad (result tick139 soft-continue parity).
  if (!(over <= 1.5 && !softContinue())) {
    // Step 1: hide Title_Deco1 (~22px with margins).
    if (deco) deco.style.display = 'none';
    over = panelOver();
    if (!(over <= 1.5 && !softContinue())) {
      // Step 2: flatten blurb Box2 plate (parity with max-height:420 CSS).
      if (blurb) {
        blurb.style.border = 'none';
        blurb.style.backgroundImage = 'none';
        blurb.style.padding = '0';
        blurb.style.clipPath = 'none';
        blurb.style.marginTop = '2px';
      }
      over = panelOver();
      if (!(over <= 1.5 && !softContinue())) {
        // Step 2.5 (Tick138): reclaim decorative SYSTEM HOLD brand + compact h2
        // before shaving actions/panel pad (title/OPTIONS/tutorial extreme-short).
        oc.classList.add('is-pause-short');
        if (brand) brand.style.display = 'none';
        if (h2) {
          h2.style.fontSize = '18px';
          h2.style.margin = '0';
          h2.style.letterSpacing = '0.12em';
        }
        over = panelOver();
        if (!(over <= 1.5 && !softContinue())) {
          // Step 3: compact actions plate padding.
          actions.style.padding = '6px';
          over = panelOver();
          if (!(over <= 1.5 && !softContinue())) {
            // Step 4: tighten panel chrome padding (base 36/28).
            oc.style.paddingTop = '22px';
            oc.style.paddingBottom = '16px';
            over = panelOver();
            if (over > 1.5) {
              // Step 5 last resort: hard cap to app (no nested scroll).
              // Tick142: same fitH floor as select/OPTIONS — Math.max(280, …) can exceed
              // painted #app on ultra-short (<280) landscapes (live @480×288 appBox≈270
              // → maxH=280 / panelOver≈5). tip31/58 / tick131/138/140 / dens frozen.
              const appH = app.clientHeight || window.innerHeight || 450;
              const appBoxH = app.getBoundingClientRect?.().height || appH;
              const fitH = Math.floor(Math.min(appH, appBoxH));
              const ratioCap = Math.floor(fitH * 0.96);
              const floorCap = Math.min(280, fitH);
              oc.style.maxHeight = `${Math.max(floorCap, ratioCap)}px`;
            }
          }
        }
      }
    }
  }

  // Tick162: panelOver-clear / fitH can still leave quit clipped (resume ok).
  if (quitChromeOverflow() > 0.5) {
    actions.style.border = 'none';
    actions.style.backgroundImage = 'none';
    actions.style.clipPath = 'none';
    actions.style.padding = '2px';
    actions.style.gap = '4px';
    for (const b of actions.querySelectorAll('.btn')) {
      b.style.padding = '6px 8px';
      b.style.minHeight = '0';
      b.style.fontSize = '12px';
    }
    const ctaBtn = actions.querySelector('.btn-cta');
    if (ctaBtn) ctaBtn.style.minWidth = '0';
  }
  if (quitChromeOverflow() > 0.5) {
    if (!oc.style.paddingTop) oc.style.paddingTop = '12px';
    if (!oc.style.paddingBottom) oc.style.paddingBottom = '10px';
    // When prior ladder already set 22/16, shave further.
    const pt = parseFloat(oc.style.paddingTop) || 0;
    const pb = parseFloat(oc.style.paddingBottom) || 0;
    if (pt > 12) oc.style.paddingTop = '12px';
    if (pb > 10) oc.style.paddingBottom = '10px';
  }
  // Tick166: tick162 compact still leaves quit unread @ultra (*@320×200
  // quitVis≈0–21). Cap btn chrome to ~24px (minHeight=0 grew ~30–32).
  if (quitChromeOverflow() > 0.5) {
    actions.style.padding = '1px';
    actions.style.gap = '2px';
    for (const b of actions.querySelectorAll('.btn')) {
      b.style.padding = '4px 6px';
      b.style.minHeight = '24px';
      b.style.fontSize = '11px';
    }
    const ctaBtn = actions.querySelector('.btn-cta');
    if (ctaBtn) ctaBtn.style.minWidth = '0';
  }
}

/**
 * Tick133: keep result panel inside #app on extreme short landscapes.
 * Live: @640×360 panelOver≈12.5 (panelH 385 > appH 360) while CTA stayed
 * inside (retryOver≈−14.5). Existing max-height:420 media already hid
 * `.result-deco` + compacted cell pads — residual was score/meta/h2 margins
 * + panel chrome pad. Measure-then-reclaim: deco → score/meta/h2 margins →
 * flatten cells → panel pad → CTA pad → maxCap. Strings / tip38/62 / dens /
 * tick116–132 frozen.
 * Tick139: SE-class extreme-short (@568×320) — after tick133 margins,
 * syncSteps=3 flattened Box2 cells while brand (~24px) + tall h2 still ate
 * chrome (headroom≈1.3; zh-CN headroom≈−0.8; CTA clear). Measure-then-reclaim
 * brand + compact h2 (pause/OPTIONS/tutorial extreme-short parity) before
 * cell flatten so tip62 plates stay and the panel keeps breathing room.
 * @640×360 already clears at step 2 with brand visible — CSS belt is ≤340
 * so 640 brand is retained. tip38/62 / tick133 / dens / tick116–138 frozen.
 * Tick143: ultra-short (@480×288) — after tick142 fitH last-resort exists,
 * CTA-pad step still hard-returned when tol over≈1 (≤1.5) while raw
 * headroom≈−2 / panelOverRaw≈2 (maxH=0; CTA clear). Soft-continue the
 * last-resort gate when appH≤340 && rawHeadroom<8 (pause tick140 /
 * result early-ladder parity) so fitH maxCap still funds. tip38/62 /
 * tick133/139/142 / dens / tick116–142 frozen.
 * Tick165: after tick133–143 panelOver / fitH, ultra-short can still leave
 * #btn-retry / #btn-title unread while panelOver=0 (live *@360×240·
 * *@400×280 maxH=fitH ctaVis≈12–36; *@400×240 / *@320×200 ladder-stop
 * ctaOut; *@360×200 early-return ctaVis=0). Measure-then-reclaim CTA
 * chrome (select tick161 / pause tick162 / tutorial tick164 peer):
 * btn compact → score/meta densify → pad → fitH + ultra → meta tail
 * hide (MAX COMBO/NO MISS) → meta hide last. Score + STAGE/PILOT +
 * retry/title kept through ultra; trailing meta only when *@320 needs.
 * tip38/62 / 133/139/142/143 / dens / tick116–164 frozen.
 */
function syncResultPanelBudget() {
  const oc = content;
  if (!oc?.classList.contains('screen-result')) return;
  const deco = oc.querySelector('.result-deco');
  const score = oc.querySelector('.result-score');
  const meta = oc.querySelector('.result-meta');
  const brand = oc.querySelector(':scope > .brand-mark');
  const h2 = oc.querySelector(':scope > h2');
  const retry = oc.querySelector('#btn-retry');
  const titleBtn = oc.querySelector('#btn-title');
  const app = document.getElementById('app');
  // Real result endScreen only — error overlays reuse screen-result class
  // without score/meta/retry and must not be rewritten.
  if (!app || !score || !meta || !retry) return;

  // Clear prior reclaim so resize / remount remeasure is stable.
  oc.classList.remove('is-result-short');
  oc.style.maxHeight = '';
  oc.style.paddingTop = '';
  oc.style.paddingBottom = '';
  if (deco) deco.style.display = '';
  if (brand) {
    brand.style.display = '';
    brand.style.marginBottom = '';
  }
  if (h2) {
    h2.style.fontSize = '';
    h2.style.margin = '';
    h2.style.marginBottom = '';
    h2.style.letterSpacing = '';
  }
  if (score) {
    score.style.marginTop = '';
    score.style.marginBottom = '';
    score.style.gap = '';
  }
  if (meta) {
    meta.style.marginBottom = '';
    meta.style.gap = '';
  }
  for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
    cell.style.padding = '';
    cell.style.border = '';
    cell.style.backgroundImage = '';
    cell.style.boxShadow = '';
    cell.style.clipPath = '';
    cell.style.display = '';
  }
  if (meta) meta.style.display = '';
  for (const b of [retry, titleBtn]) {
    if (!b) continue;
    b.style.padding = '';
    b.style.minHeight = '';
    b.style.fontSize = '';
    b.style.minWidth = '';
  }

  const panelOver = () => {
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    return Math.max(
      0,
      ocR.bottom - (appR.bottom + 1),
      (appR.top - 1) - ocR.top,
    );
  };

  const appH0 = app.clientHeight || window.innerHeight || 360;
  const rawHeadroom = () => {
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    return appR.bottom - ocR.bottom;
  };
  const softContinue = () => appH0 <= 340 && rawHeadroom() < 8;

  // Tick165: retry/title can clip under overflow:hidden while panelOver=0
  // (select/pause/tutorial chrome-health peer). Always run after panel ladder.
  const ctaChromeOverflow = () => {
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    let worst = 0;
    for (const el of [retry, titleBtn]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const vis = Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
      const need = Math.min(20, Math.max(0, r.height - 2));
      if (vis + 0.5 < need) worst = Math.max(worst, need - vis);
      if (r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5) {
        worst = Math.max(worst, r.bottom - (appR.bottom + 1));
      }
      if (r.bottom > ocR.bottom + 1.5) {
        worst = Math.max(worst, r.bottom - (ocR.bottom + 1));
      }
    }
    return worst;
  };

  let over = panelOver();
  // Tick139 / Tick143 soft-continue: do not early-return past Tick165 chrome.
  // Nested gates keep tick133–143 measure-then-reclaim order.
  if (!(over <= 1.5 && !softContinue())) {
    // Step 1: hide Title_Deco1 (~24px with margins; already none ≤420 CSS).
    if (deco) deco.style.display = 'none';
    over = panelOver();
    if (!(over <= 1.5 && !softContinue())) {
      // Step 2: compact score/meta/h2 vertical rhythm (live residual @640×360).
      if (brand) brand.style.marginBottom = '6px';
      if (h2) h2.style.marginBottom = '6px';
      if (score) {
        score.style.marginTop = '4px';
        score.style.marginBottom = '8px';
        score.style.gap = '12px';
      }
      if (meta) {
        meta.style.marginBottom = '8px';
        meta.style.gap = '6px 12px';
      }
      over = panelOver();
      if (!(over <= 1.5 && !softContinue())) {
        // Step 2.5 (Tick139): reclaim decorative brand + compact h2 before
        // flattening score/meta Box2 plates (pause/OPTIONS/tutorial extreme-short).
        oc.classList.add('is-result-short');
        if (brand) brand.style.display = 'none';
        if (h2) {
          h2.style.fontSize = '18px';
          h2.style.margin = '0';
          h2.style.letterSpacing = '0.12em';
        }
        over = panelOver();
        if (over > 1.5) {
          // Step 3: flatten score/meta Box2 plates further (parity with ≤420 CSS).
          for (const cell of oc.querySelectorAll(
            '.result-score .cell, .result-meta .cell',
          )) {
            cell.style.padding = '2px 4px';
            cell.style.border = 'none';
            cell.style.backgroundImage = 'none';
            cell.style.boxShadow = 'none';
            cell.style.clipPath = 'none';
          }
          over = panelOver();
          if (over > 1.5) {
            // Step 4: tighten panel chrome padding (base ~32/26).
            oc.style.paddingTop = '18px';
            oc.style.paddingBottom = '12px';
            over = panelOver();
            if (over > 1.5) {
              // Step 5: compact CTA pad only — keep both buttons + i18n strings.
              if (retry) retry.style.padding = '8px 20px';
              if (titleBtn) titleBtn.style.padding = '8px 20px';
              over = panelOver();
              // Tick143: @480×288 after full pad ladder, tol over≈1 (≤1.5) while raw
              // headroom≈−2 — hard return skipped fitH last-resort (live maxH=0 /
              // panelOverRaw≈2). Soft-continue when appH≤340 && rawHeadroom<8 so
              // tick142 fitH maxCap still funds (pause tick140 parity on last gate).
              if (!(over <= 1.5 && !softContinue())) {
                // Step 6 last resort: hard cap to app (no nested scroll / no string drop).
                // Tick142: same fitH floor as select/OPTIONS — Math.max(260, …) can exceed
                // painted #app on ultra-short (<260) landscapes (live @400×280 appBox≈225
                // → maxH=260 / panelOver≈17.5 / CTA out). tip38/62 / tick133/139 / dens frozen.
                const appH = app.clientHeight || window.innerHeight || 360;
                const appBoxH = app.getBoundingClientRect?.().height || appH;
                const fitH = Math.floor(Math.min(appH, appBoxH));
                const ratioCap = Math.floor(fitH * 0.96);
                const floorCap = Math.min(260, fitH);
                oc.style.maxHeight = `${Math.max(floorCap, ratioCap)}px`;
              }
            }
          }
        }
      }
    }
  }

  // Tick165: panelOver-clear / fitH can still leave retry/title clipped.
  if (ctaChromeOverflow() > 0.5) {
    for (const b of [retry, titleBtn]) {
      if (!b) continue;
      b.style.padding = '4px 10px';
      b.style.minHeight = '28px';
      b.style.fontSize = '12px';
      b.style.minWidth = '0';
    }
  }
  if (ctaChromeOverflow() > 0.5) {
    oc.classList.add('is-result-short');
    if (brand) brand.style.display = 'none';
    if (h2) {
      h2.style.fontSize = '16px';
      h2.style.margin = '0';
      h2.style.letterSpacing = '0.1em';
    }
    if (score) {
      score.style.marginTop = '2px';
      score.style.marginBottom = '4px';
      score.style.gap = '6px';
    }
    if (meta) {
      meta.style.marginBottom = '4px';
      meta.style.gap = '4px 8px';
    }
    for (const cell of oc.querySelectorAll('.result-score .cell, .result-meta .cell')) {
      cell.style.padding = '1px 3px';
      cell.style.border = 'none';
      cell.style.backgroundImage = 'none';
      cell.style.boxShadow = 'none';
      cell.style.clipPath = 'none';
    }
  }
  if (ctaChromeOverflow() > 0.5) {
    oc.style.paddingTop = '10px';
    oc.style.paddingBottom = '8px';
  }
  if (ctaChromeOverflow() > 0.5) {
    const appH = app.clientHeight || window.innerHeight || 360;
    const appBoxH = app.getBoundingClientRect?.().height || appH;
    const fitH = Math.floor(Math.min(appH, appBoxH));
    oc.style.maxHeight = `${fitH}px`;
    oc.style.paddingTop = '6px';
    oc.style.paddingBottom = '4px';
    if (h2) {
      h2.style.fontSize = '13px';
      h2.style.margin = '0';
      h2.style.letterSpacing = '0.1em';
    }
    if (score) {
      score.style.marginTop = '0';
      score.style.marginBottom = '0';
      score.style.gap = '2px';
    }
    if (meta) {
      meta.style.marginBottom = '0';
      meta.style.gap = '1px 4px';
    }
    for (const b of [retry, titleBtn]) {
      if (!b) continue;
      b.style.padding = '2px 8px';
      b.style.minHeight = '24px';
      b.style.fontSize = '11px';
      b.style.minWidth = '0';
    }
  }
  // Live *@320×200: after ultra, real STAGE/PILOT wrap still left meta≈93px
  // and retry/title unread (inject trials under-measured). Hide trailing
  // MAX COMBO / NO MISS cells first — score + STAGE/PILOT + CTA strings stay.
  if (ctaChromeOverflow() > 0.5 && meta) {
    const cells = [...meta.querySelectorAll('.cell')];
    for (const cell of cells.slice(2)) cell.style.display = 'none';
  }
  if (ctaChromeOverflow() > 0.5 && meta) {
    meta.style.display = 'none';
  }
}

/**
 * Tick125: keep tutorial sortie CTA inside #app after long-locale tut.p / note
 * wrap. Cap panel to ~92% of app height; pin head/note/actions; scroll only
 * `.tutorial-grid` (CONTROLS keys-grid pattern). Strings / tip65 / dens frozen.
 * Tick132: short landscapes (appH≤480) reclaim decorative `.tutorial-deco`
 * (+ flatten note / compact actions plate when needed) so the grid soft floor
 * does not collapse to 0 under pinned head+note+CTA (live: beginSortie
 * @800×450 gridH=0 while CTA stayed clear). tip41/65 / dens / tick116–131 frozen.
 * Tick142: ultra-short fitH maxCap floor — Math.max(300, …) overflowed painted
 * #app when fitH<300 (live @480×288 / @400×280). tip41/65 / 125/132/137 / dens
 * / tick116–141 frozen.
 * Tick163: ultra-short CTA-health must not re-inflate maxCap — legacy
 * Math.max(260, …) forced maxH=260 while fitH≈202 @360×240 (live
 * panelOver≈28.75 / skip secOut; ko/ru). Clamp shave to fitH / floorCap
 * (select tick144 parity). tip41/65 / 125/132/137/142 / dens / tick116–162 frozen.
 * Tick164: after tick163 fitH CTA-health, *@320×200 still HARD skip clip
 * while panelOver=0 / maxH=fitH / sortie CTA full (live secVis≈32–36 of
 * ~44–46 / secOut). Measure-then-reclaim: actions compact → brand/h2 →
 * pad (select tick161 / pause tick162 peer). SORTIE/skip strings kept.
 * tip41/65 / 125/132/137/142/163 / dens / tick116–163 frozen.
 */
function syncTutorialPanelBudget() {
  const oc = content;
  if (!oc?.classList.contains('screen-tutorial')) return;
  const grid = oc.querySelector('.tutorial-grid');
  const actions = oc.querySelector('.pause-actions');
  const note = oc.querySelector('.tutorial-note');
  const head = oc.querySelector('.opt-head');
  const deco = oc.querySelector('.tutorial-deco');
  const brand = head?.querySelector('.brand-mark');
  const h2 = head?.querySelector('h2');
  if (!grid || !actions) return;

  // Clear prior tick164 chrome so resize / remount remeasure is stable.
  oc.style.maxHeight = '';
  oc.style.paddingTop = '';
  oc.style.paddingBottom = '';
  grid.style.minHeight = '';
  oc.classList.remove('is-tut-short');
  if (brand) {
    brand.style.display = '';
    brand.style.marginBottom = '';
  }
  if (h2) {
    h2.style.fontSize = '';
    h2.style.margin = '';
    h2.style.letterSpacing = '';
  }
  if (head) head.style.marginBottom = '';
  if (deco) deco.style.display = '';
  if (note) {
    note.style.display = '';
    note.style.border = '';
    note.style.backgroundImage = '';
    note.style.padding = '';
    note.style.clipPath = '';
    note.style.boxShadow = '';
  }
  actions.style.padding = '';
  actions.style.border = '';
  actions.style.backgroundImage = '';
  actions.style.clipPath = '';
  actions.style.gap = '';
  for (const b of actions.querySelectorAll('.btn')) {
    b.style.padding = '';
    b.style.minHeight = '';
    b.style.fontSize = '';
    b.style.minWidth = '';
  }

  const app = document.getElementById('app');
  const appH = app?.clientHeight || window.innerHeight || 540;
  // Hard ceiling 560 matches CSS; floor keeps ~head+2 rows+note+CTA readable.
  // Tick142: SE/ultra-short fitH clamp — Math.max(300, clientHeight*0.92) forces
  // maxH=300 while painted #app can be <300 (live @480×288 appBox≈270 →
  // panelOver≈15 / headroom≈−15; @400×280 appBox≈225 → panelOver≈37.5).
  // SE @568×320 stays clear (maxH=300 < appBox≈319.5). tip41/65 / tick125/
  // 132/137 / dens / tick116–141 frozen.
  const appBoxH = app?.getBoundingClientRect?.().height || appH;
  const fitH = Math.floor(Math.min(appH, appBoxH));
  const ratioCap = Math.floor(fitH * 0.92);
  const floorCap = Math.min(300, fitH);
  let maxCap = Math.min(560, Math.max(floorCap, ratioCap));
  oc.style.maxHeight = `${maxCap}px`;

  // Short landscapes (tick132): Title_Deco1 eats ~24px while pinned
  // head+note+actions already fill maxCap — grid flex slot collapses to 0
  // (live beginSortie @800×450). Hide chrome only; brand/h2/note strings stay.
  if (appH <= 480 && deco) deco.style.display = 'none';

  const row = grid.querySelector('.tut-row');
  const rowH = row ? Math.max(28, _blockBudgetH(row)) : 40;
  const gap = parseFloat(getComputedStyle(grid).rowGap || getComputedStyle(grid).gap) || 8;
  const gridFloor = Math.ceil(rowH * 2 + gap);
  // Tick137 extreme-short soft floor (title tick135 / OPTIONS tick136 parity).
  const softGridWant = 40;
  const csOc = getComputedStyle(oc);
  const padY =
    (parseFloat(csOc.paddingTop) || 0) + (parseFloat(csOc.paddingBottom) || 0);
  const pinnedH = () =>
    _blockBudgetH(head) + _blockBudgetH(note) + _blockBudgetH(actions) + padY;

  let pinned = pinnedH();
  let avail = Math.floor(maxCap - pinned);
  // When pinned chrome still starves the 2-row floor, flatten note Box2 plate
  // then compact actions (parity with max-height:420 CSS, applied by measure).
  if (avail < gridFloor && note) {
    note.style.border = 'none';
    note.style.backgroundImage = 'none';
    note.style.padding = '0';
    note.style.clipPath = 'none';
    note.style.boxShadow = 'none';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned);
  }
  if (avail < gridFloor) {
    actions.style.border = 'none';
    actions.style.backgroundImage = 'none';
    actions.style.padding = '4px 0';
    actions.style.clipPath = 'none';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned);
  }
  // Very short / tall-note locales (live: ru@720×400): after plate reclaim,
  // 2-line note still starves the grid to ~2px. Hide note display only —
  // i18n string stays in DOM; user can still read keys in OPTIONS.
  if (avail < softGridWant && note) {
    note.style.display = 'none';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned);
  }
  // Tick137: after tick132 deco/note/actions reclaim, @640×360 still left
  // .tutorial-grid at ~14px (ko/ru) / ~36px (en/pt/es) while decorative
  // SORTIE BRIEFING brand (~24px) + tall h2 ate the flex slot (CTA clear;
  // nested scroll flagged because rows > viewport). Measure-then-reclaim
  // brand + compact h2, then re-fund soft floor ≥40 / 2-row when avail allows.
  // tip41/65 / tick125 / tick132 / dens / tick116–136 frozen.
  if (avail < gridFloor) {
    oc.classList.add('is-tut-short');
    if (brand) brand.style.display = 'none';
    if (h2) {
      h2.style.fontSize = '18px';
      h2.style.margin = '0';
      h2.style.letterSpacing = '0.12em';
    }
    if (head) head.style.marginBottom = '2px';
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned);
  }

  // Never force a grid floor that cannot fit under maxCap — that pushes the
  // pinned CTA past overflow:hidden (ru/ko live 800×450 before this clamp).
  const gridBudget = Math.max(0, Math.min(gridFloor, avail));
  if (gridBudget >= softGridWant) {
    grid.style.minHeight = `${gridBudget}px`;
  } else if (avail >= softGridWant) {
    grid.style.minHeight = `${softGridWant}px`;
  } else {
    grid.style.minHeight = `${Math.max(0, avail)}px`;
  }

  // Health: CTA must stay inside the app box (body overflow:hidden otherwise eats it).
  // Shave grid carefully — keep soft floor when possible (select/OPTIONS parity).
  const ctaOverflow = () => {
    if (!app) return 0;
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const actR = actions.getBoundingClientRect();
    const overApp = Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top);
    const overOc = Math.max(0, actR.bottom - (ocR.bottom + 1), (ocR.top - 1) - actR.top);
    return Math.max(overApp, overOc);
  };
  for (let i = 0; i < 4; i += 1) {
    const over = ctaOverflow();
    if (over <= 0.5) break;
    const cur = parseFloat(grid.style.minHeight) || 0;
    if (cur > softGridWant) {
      grid.style.minHeight = `${Math.max(softGridWant, Math.floor(cur - over - 4))}px`;
      continue;
    }
    // Tick163: Math.max(260, …) re-inflated above fitH on ultra-short
    // (live ko/ru@360×240 fitH≈202 → maxH=260 / panelOver≈28.75 / skipOut).
    maxCap = Math.max(floorCap, Math.min(fitH, Math.floor(maxCap - over - 4)));
    oc.style.maxHeight = `${maxCap}px`;
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned);
    if (avail > 0) {
      grid.style.minHeight = `${Math.min(gridFloor, Math.max(0, Math.min(softGridWant, avail)))}px`;
    }
  }

  // Tick164: grid/maxCap/fitH can still leave skip OOB when the stacked
  // SORTIE+skip actions column (~90–100px) pastes the painted #app bottom
  // (live *@320×200 maxH=180 panelOver=0 / cta full / secVis≈32–36).
  // Measure-then-reclaim chrome only — SORTIE / skip labels stay.
  const refundGrid = () => {
    pinned = pinnedH();
    avail = Math.floor(maxCap - pinned);
    if (avail > 0) {
      grid.style.minHeight = `${Math.min(gridFloor, Math.max(0, Math.min(softGridWant, avail)))}px`;
    } else {
      grid.style.minHeight = '0px';
    }
  };
  const skipChromeOverflow = () => {
    if (!app) return 0;
    void oc.offsetHeight;
    const appR = app.getBoundingClientRect();
    const ocR = oc.getBoundingClientRect();
    const actR = actions.getBoundingClientRect();
    const overApp = Math.max(0, actR.bottom - (appR.bottom + 1), (appR.top - 1) - actR.top);
    const overOc = Math.max(0, actR.bottom - (ocR.bottom + 1), (ocR.top - 1) - actR.top);
    const skip = oc.querySelector('#btn-tut-skip');
    let skipUnread = 0;
    if (skip) {
      const r = skip.getBoundingClientRect();
      const vis = Math.max(
        0,
        Math.min(r.bottom, Math.min(ocR.bottom, appR.bottom)) -
          Math.max(r.top, Math.max(ocR.top, appR.top)),
      );
      const need = Math.min(20, Math.max(0, r.height - 2));
      if (vis + 0.5 < need) skipUnread = need - vis;
      if (r.bottom > appR.bottom + 1.5 || r.top < appR.top - 1.5) {
        skipUnread = Math.max(skipUnread, r.bottom - (appR.bottom + 1));
      }
    }
    return Math.max(overApp, overOc, skipUnread);
  };
  if (skipChromeOverflow() > 0.5) {
    // Collapse stacked dual-CTA first (often enough @320; keep brand when idle).
    actions.style.border = 'none';
    actions.style.backgroundImage = 'none';
    actions.style.clipPath = 'none';
    actions.style.padding = '2px 0';
    actions.style.gap = '4px';
    for (const b of actions.querySelectorAll('.btn')) {
      b.style.padding = '4px 8px';
      b.style.minHeight = '28px';
      b.style.fontSize = '12px';
    }
    const ctaBtn = actions.querySelector('.btn-cta');
    if (ctaBtn) ctaBtn.style.minWidth = '0';
    refundGrid();
  }
  if (skipChromeOverflow() > 0.5) {
    // Still short: reclaim decorative SORTIE BRIEFING brand + compact h2.
    oc.classList.add('is-tut-short');
    if (brand) brand.style.display = 'none';
    if (h2) {
      h2.style.fontSize = '16px';
      h2.style.margin = '0';
      h2.style.letterSpacing = '0.1em';
    }
    if (head) head.style.marginBottom = '2px';
    refundGrid();
  }
  if (skipChromeOverflow() > 0.5) {
    oc.style.paddingTop = '8px';
    oc.style.paddingBottom = '6px';
    refundGrid();
  }
}
function beginSortie(charKey) {
  selectForcedRare = null;
  cheatBuf = [];
  // Opening story crawl (hold to skip) on the first sortie only; a retry goes straight to
  // the briefing / sortie (user).
  if (introPlayed) {
    showTutorialThen(() => startGame(charKey));
    return;
  }
  introPlayed = true;
  screen = 'intro';
  showIntroCrawl(() => showTutorialThen(() => startGame(charKey)));
}
/** The opening crawl has been shown this session (retries skip it). */
let introPlayed = false;
async function startGame(charKey = selected, { demo: demoRun = false } = {}) {
  // RANDOM's Hyper Rampalion roll (assets.js RAMPALION_HYPER_PICK): Rampalion, Hyper from the start.
  const sortiePick = charKey;
  const rampHyper = charKey === 'rampalion_hyper';
  if (rampHyper) charKey = 'rampalion';
  // Sortie line of the picked pilot (original SortiePick). Attract demo stays quiet.
  if (!demoRun) audio.playVoice(PILOT_VOICES[charKey]?.sortie);
  // Stage-1 + selected pilot before the field opens — later acts prefetch in background.
  if (assets?.bank && typeof assets.bank.loadSortie === 'function') {
    // Demo loads behind the arcade layer (black), not the LOADING card.
    if (!demoRun) showLoading();
    try {
      assets = await assets.bank.loadSortie(charKey, updateLoading);
      if (assets.metrics) {
        const snap = typeof assets.bank?.snapshotMetrics === 'function'
          ? assets.bank.snapshotMetrics()
          : assets.metrics;
        console.info('[assets] load metrics', {
          mode: snap.mode || assets.metrics.mode || 'progressive',
          titleMs: Math.round(assets.metrics.titleReadyMs || 0),
          selectMs: Math.round(assets.metrics.selectReadyMs || 0),
          stage1Ms: Math.round(assets.metrics.stage1ReadyMs || 0),
          eagerMs: Math.round(assets.metrics.eagerMs || 0),
          frames: assets.metrics.framesLoaded,
          clips: assets.metrics.clipsLoaded,
          transferBytes: snap.transferBytes || 0,
          heapBytes: snap.heapBytes || 0,
        });
      }
    } catch (err) {
      // Attract demo: a failed load just drops back to the title (no error card).
      if (demoRun) {
        console.warn('[demo] sortie load failed', err);
        return;
      }
      showOverlay(`
        <span class="brand-mark">ERROR</span>
        <h2>${t('err.sortieLoad')}</h2>
        <p>${err.message}</p>
        <button class="btn btn-primary" id="btn-sortie-retry">${t('btn.retry')}</button>
        <button class="btn" id="btn-sortie-back"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${t('btn.toSelect')}</button>
      `, 'screen-result gameover');
      document.getElementById('btn-sortie-retry').onclick = () => {
        assets?.bank?.clearFailed?.();
        assets?.bank?.clearLastError?.();
        startGame(sortiePick);
      };
      document.getElementById('btn-sortie-back').onclick = () => showSelect();
      console.error(err);
      return;
    }
  }
  // Demo cancelled (button press) while its sortie was still loading.
  if (demoRun && (!demoState || demoState.ending)) return;
  if (game) game.dispose();
  cancelAnimationFrame(raf);
  selected = charKey;
  // Build the Game (WebGL shader compile) and paint one frame (sprite-sheet GPU
  // upload) while the loading overlay is still up — both used to stall the
  // first ~0.5s of combat.
  game = new Game(canvas, assets, charKey, {
    rampHyper,
    cheats: cheatsOn,
    audio,
    settings,
    isInputBlocked: () => screen === 'options' || screen === 'tutorial',
    onPauseChange: (paused) => {
      // Attract demo: losing focus / pause just ends the demo.
      if (demoState) {
        if (paused) void endDemo('input');
        return;
      }
      if (paused) {
        if (screen !== 'options') showPauseMenu();
      } else if (screen === 'pause') {
        hideOverlay();
        setHudDimmed(false);
      }
    },
    onSettingsChange: (s) => {
      settings = saveSettings(s);
      const af = document.getElementById('opt-autofire');
      if (af) af.checked = !!settings.autoFire;
    },
  });
  try {
    // Touch every resident sprite sheet so the GPU uploads them now, then let
    // two frames flush before revealing the field. game.draw() clears these.
    // One sheet per frame (user: the loading screen froze, then play started all at once):
    // the uploads still happen before the reveal, but the loading screen keeps moving.
    const wctx = canvas.getContext('2d');
    for (const anim of Object.values(assets?.anims || {})) {
      for (const sheet of anim?.sheets || []) {
        if (!sheet) continue;
        wctx.drawImage(sheet, 0, 0, 1, 1);
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    game.draw();
    // 1px readback blocks until the GPU has finished those uploads.
    wctx.getImageData(0, 0, 1, 1);
  } catch (err) {
    console.warn('[startGame] warm draw failed', err);
  }
  await new Promise((r) => requestAnimationFrame(r));
  hideOverlay();
  setHudDimmed(false);
  last = performance.now();
  cancelAnimationFrame(raf);
  loop(last);
  syncTouchPads();
}
function showPauseMenu() {
  if (!game) return;
  screen = 'pause';
  audio.play('ui:open');
  setHudDimmed(true);
  showOverlay(`
    <div class="panel-frame" aria-hidden="true">
      <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
      <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
    </div>
    <div class="pause-stamp">
      <span class="brand-mark">SYSTEM HOLD</span>
      <h2>PAUSED</h2>
      <span class="pause-deco" aria-hidden="true"></span>
      <p class="pause-blurb">${t('pause.p')}</p>
    </div>
    <div class="pause-actions">
      <button class="btn btn-primary btn-cta" id="btn-resume">${t('btn.resume')}</button>
      <button class="btn" id="btn-pause-options">${t('btn.options')}</button>
      <button class="btn" id="btn-pause-help">${t('btn.help')}</button>
      <button class="btn btn-ghost" id="btn-quit"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${t('btn.toTitle')}</button>
    </div>
  `, 'screen-pause');
  // Tick131: long unmute / toTitle wrap can grow the centered pause plate
  // past #app on short landscapes (CTA stayed inside; panel chrome clipped).
  syncPausePanelBudget();
  requestAnimationFrame(() => syncPausePanelBudget());
  document.getElementById('btn-resume').onclick = () => {
    hideOverlay();
    setHudDimmed(false);
    game.setPaused(false);
  };
  document.getElementById('btn-pause-options').onclick = () => showOptions('pause');
  // HELP (user, replaces MUTE - sound stays in OPTIONS): the sortie briefing, then back here.
  document.getElementById('btn-pause-help').onclick = () => showTutorialPanel(() => showPauseMenu(), { help: true });
  document.getElementById('btn-quit').onclick = () => {
    game.dispose();
    game = null;
    cancelAnimationFrame(raf);
    raf = 0;
    showTitle();
  };
  // Keyboard / pad focus (user: the pause menu showed no focus and arrows did nothing).
  pauseMenuIndex = 0;
  const btns = pauseMenuButtons();
  btns.forEach((btn, i) => btn.addEventListener('pointerenter', () => setPauseMenuFocus(i)));
  setPauseMenuFocus(0);
}

let pauseMenuIndex = 0;
function pauseMenuButtons() {
  return [...content.querySelectorAll('.pause-actions .btn')];
}
function setPauseMenuFocus(idx) {
  const btns = pauseMenuButtons();
  if (!btns.length) return;
  const n = btns.length;
  pauseMenuIndex = ((idx % n) + n) % n;
  btns.forEach((b, i) => {
    const on = i === pauseMenuIndex;
    b.classList.toggle('is-menu-focus', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}
function onPauseMenuKey(e) {
  if (screen !== 'pause') return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    if (e.repeat) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pauseMenuButtons()[pauseMenuIndex]?.click();
    return;
  }
  const dir = selectDirFromEvent(e);
  if (!dir) return;
  if (e.repeat) return;
  e.preventDefault();
  const before = pauseMenuIndex;
  // OPTIONS / HELP share a row, so left / right step too (reading order).
  setPauseMenuFocus(pauseMenuIndex + (dir === 'up' || dir === 'left' ? -1 : 1));
  if (pauseMenuIndex !== before) audio.play('ui:move');
}
function showOptions(returnTo = 'title') {
  optionsReturn = returnTo;
  screen = 'options';
  rebindAction = null;
  const fsOn = isFullscreen() || settings.fullscreen;
  const actions = Object.keys(KEY_LABELS);
  const rows = actions.map((action) => {
    const chips = (settings.keys[action] || DEFAULT_KEYS[action])
      .map((c) => `<kbd>${codeLabel(c)}</kbd>`)
      .join(' ');
    return `
      <div class="opt-key-row" data-action="${action}">
        <span class="opt-key-label">${t(`key.${action}`)}</span>
        <span class="opt-key-binds">${chips}</span>
        <button type="button" class="btn btn-mini btn-rebind" data-action="${action}">${t('opt.rebind')}</button>
      </div>`;
  }).join('');
  showOverlay(`
    <div class="panel-frame" aria-hidden="true">
      <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
      <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
    </div>
    <header class="opt-head">
      <span class="brand-mark">OPTIONS</span>
      <h2>${t('opt.h2')}</h2>
    </header>
    <div class="lobby-status-bar lobby-status-options" aria-hidden="true">
      <i class="lobby-status-info lobby-ico-info"></i>
      <span>INFO</span><span class="lobby-status-sep">/</span>
      <span class="lobby-status-mint">CFG</span>
      <span class="lobby-status-spacer"></span>
      <span class="lobby-status-dim">NEWUI</span>
    </div>
    <div class="lobby-resource-strip lobby-resource-options" aria-hidden="true">
      <span class="lobby-chip"><i class="lobby-chip-ico lobby-ico-research"></i>SYSTEM</span>
      <span class="lobby-chip lobby-chip-mint"><i class="lobby-chip-ico lobby-ico-workshop"></i>AUDIO</span>
      <span class="lobby-chip lobby-chip-gold"><i class="lobby-chip-ico lobby-ico-equip"></i>KEYS</span>
    </div>
    <div class="opt-scroll">
      <div class="opt-block">
        <div class="opt-block-title">SYSTEM</div>
        <div class="opt-pad-row">
          <span class="opt-pad-label">${t('opt.language')}</span>
          <select id="opt-lang" class="opt-lang" aria-label="${t('opt.language')}">
            ${LOCALES.map((loc) => `<option value="${loc.id}"${settings.lang === loc.id ? ' selected' : ''}>${loc.native}</option>`).join('')}
          </select>
        </div>
        <label class="opt-slider">
          <span>BGM <em id="bgm-pct">${Math.round(settings.bgmVolume * 100)}</em></span>
          <input type="range" id="opt-bgm" min="0" max="100" value="${Math.round(settings.bgmVolume * 100)}" />
        </label>
        <label class="opt-slider">
          <span>SFX <em id="sfx-pct">${Math.round(settings.sfxVolume * 100)}</em></span>
          <input type="range" id="opt-sfx" min="0" max="100" value="${Math.round(settings.sfxVolume * 100)}" />
        </label>
        <div class="opt-checks">
          <label class="opt-check">
            <input type="checkbox" id="opt-mute" ${settings.muted ? 'checked' : ''} />
            <span>${t('opt.mute')}</span>
          </label>
          <label class="opt-check">
            <input type="checkbox" id="opt-fs" ${fsOn ? 'checked' : ''} />
            <span>${t('opt.fullscreen')}</span>
          </label>
          <label class="opt-check">
            <input type="checkbox" id="opt-autofire" ${settings.autoFire ? 'checked' : ''} />
            <span>${t('opt.autoFire')}</span>
          </label>
        </div>
        <div class="opt-pad-row">
          <span class="opt-pad-label">${t('opt.pad')}</span>
          <div class="opt-seg" role="group" aria-label="${t('opt.padAria')}">
            <button type="button" class="opt-seg-btn${settings.padMode !== 'floating' ? ' is-on' : ''}" data-pad="fixed">${t('opt.fixed')}</button>
            <button type="button" class="opt-seg-btn${settings.padMode === 'floating' ? ' is-on' : ''}" data-pad="floating">${t('opt.floating')}</button>
          </div>
        </div>
        ${touchUi ? `<div class="opt-pad-row">
          <span class="opt-pad-label">${t('opt.padLayout')}</span>
          <button type="button" class="btn btn-mini" id="btn-pad-layout">${t('opt.padLayoutEdit')}</button>
        </div>` : ''}
        <p class="opt-mobile-note">${t('opt.padNote')}</p>
        <p class="opt-mobile-note opt-fs-note" id="opt-fs-note" hidden>${t('opt.fsUnsupported')}</p>
      </div>
      <div class="opt-keys">
        <div class="opt-keys-head">${t('opt.keysHead')} <span id="rebind-hint" class="opt-hint"></span></div>
        ${touchUi ? `<p class="opt-mobile-note">${t('opt.keysMobile')}</p>` : ''}
        ${rows}
        <button type="button" class="btn btn-mini" id="btn-keys-reset">${t('opt.keysReset')}</button>
      </div>
    </div>
    <div class="opt-actions">
      <button class="btn btn-primary" id="btn-opt-back"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${t('opt.back')}</button>
    </div>
  `, 'screen-options');
  syncOptionsPanelBudget();
  requestAnimationFrame(() => {
    syncOptionsPanelBudget();
    requestAnimationFrame(() => syncOptionsPanelBudget());
  });
  const bgm = document.getElementById('opt-bgm');
  const sfx = document.getElementById('opt-sfx');
  bgm.oninput = () => {
    const v = Number(bgm.value) / 100;
    document.getElementById('bgm-pct').textContent = String(Math.round(v * 100));
    persistSettings({ bgmVolume: v });
  };
  sfx.oninput = () => {
    const v = Number(sfx.value) / 100;
    document.getElementById('sfx-pct').textContent = String(Math.round(v * 100));
    persistSettings({ sfxVolume: v });
    audio.play('cue');
  };
  document.getElementById('opt-mute').onchange = (e) => {
    persistSettings({ muted: e.target.checked });
  };
  document.getElementById('opt-fs').onchange = async (e) => {
    const on = !!e.target.checked;
    if (on && !canFullscreen()) {
      e.target.checked = false;
      const note = document.getElementById('opt-fs-note');
      if (note) note.hidden = false;
      return;
    }
    persistSettings({ fullscreen: on });
    const got = await applyFullscreen(on);
    e.target.checked = got;
    if (got !== settings.fullscreen) persistSettings({ fullscreen: got });
  };
  content.querySelectorAll('.opt-seg-btn').forEach((btn) => {
    btn.onclick = () => {
      const mode = btn.dataset.pad === 'floating' ? 'floating' : 'fixed';
      persistSettings({ padMode: mode });
      content.querySelectorAll('.opt-seg-btn').forEach((b) => {
        b.classList.toggle('is-on', b.dataset.pad === mode);
      });
    };
  });
  const padLayoutBtn = document.getElementById('btn-pad-layout');
  if (padLayoutBtn) padLayoutBtn.onclick = () => openPadLayoutEditor();
  const autoFireEl = document.getElementById('opt-autofire');
  if (autoFireEl) {
    autoFireEl.onchange = (e) => persistSettings({ autoFire: !!e.target.checked });
  }
  const langEl = document.getElementById('opt-lang');
  if (langEl) {
    langEl.onchange = () => {
      persistSettings({ lang: langEl.value, langSet: true });
      showOptions(optionsReturn);
    };
  }
  document.getElementById('btn-keys-reset').onclick = () => {
    persistSettings({ keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)) });
    showOptions(optionsReturn);
  };
  content.querySelectorAll('.btn-rebind').forEach((btn) => {
    btn.onclick = () => beginRebind(btn.dataset.action);
  });
  document.getElementById('btn-opt-back').onclick = leaveOptions;
  // Esc closes options when not capturing a rebind (game input is blocked while options is open).
  if (window.__laoOptEsc) window.removeEventListener('keydown', window.__laoOptEsc);
  window.__laoOptEsc = (e) => {
    if (screen !== 'options' || rebindAction) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      leaveOptions();
    }
  };
  window.addEventListener('keydown', window.__laoOptEsc);
}
/** OPTIONS > pad layout: drag / resize the stick and action pads on the real play layout. */
function openPadLayoutEditor() {
  const back = optionsReturn;
  hideOverlay();
  screen = 'padlayout';
  openPadEditor({
    root: document.getElementById('touch-controls'),
    layout: settings.padLayout,
    padMode: settings.padMode === 'floating' ? 'floating' : 'fixed',
    t,
    onSave: (layout) => persistSettings({ padLayout: layout }),
    onClose: () => showOptions(back),
  });
}
function beginRebind(action) {
  rebindAction = action;
  const hint = document.getElementById('rebind-hint');
  if (hint) hint.textContent = t('opt.rebindHint', { action: t(`key.${action}`) });
  content.querySelectorAll('.opt-key-row').forEach((row) => {
    row.classList.toggle('is-listening', row.dataset.action === action);
  });
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') {
      cleanup();
      showOptions(optionsReturn);
      return;
    }
    if (POWER_CHEAT_CODES.includes(e.code)) {
      if (hint) hint.textContent = 'P / O · POWER UP / DOWN';
      return;
    }
    const next = { ...settings.keys };
    // Keep secondary defaults for movement / shoot; replace primary.
    const prev = next[action] || DEFAULT_KEYS[action];
    next[action] = prev.length > 1 ? [e.code, ...prev.slice(1).filter((c) => c !== e.code)] : [e.code];
    persistSettings({ keys: next });
    cleanup();
    showOptions(optionsReturn);
  };
  const cleanup = () => {
    rebindAction = null;
    window.removeEventListener('keydown', onKey, true);
  };
  window.addEventListener('keydown', onKey, true);
}
function leaveOptions() {
  if (rebindAction) return;
  if (window.__laoOptEsc) {
    window.removeEventListener('keydown', window.__laoOptEsc);
    window.__laoOptEsc = null;
  }
  if (optionsReturn === 'pause' && game) {
    showPauseMenu();
    return;
  }
  if (optionsReturn === 'select') {
    showSelect();
    return;
  }
  showTitle();
}
function endScreen(stats) {
  setHudDimmed(true);
  const score = stats.score | 0;
  const cleared = !!stats.cleared;
  // Result: game over -> BGM_Sad_Story_01; a cleared run -> the pilot's theme (lobby if none).
  audio.playBgmTrack(cleared ? (BGM_TABLE.pilots[selected] || 'lobby') : BGM_TABLE.gameover);
  // Hi-score is still recorded (no longer shown on the result, user).
  writeHiScore(score);
  const resultClass = cleared ? 'cleared' : 'gameover';
  const stageLabel = cleared
    ? 'ALL 5'
    : t('hud.stageN', { n: stats.stage || 1 });
  screen = 'result';
  showOverlay(`
    <div class="panel-frame" aria-hidden="true">
      <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
      <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
    </div>
    <span class="brand-mark">${cleared ? 'MISSION COMPLETE' : 'SYSTEM DOWN'}</span>
    <h2>${cleared ? 'ALL CLEAR' : 'GAME OVER'}</h2>
    <span class="result-deco" aria-hidden="true"></span>
    <div class="result-score result-score-solo">
      <div class="cell"><span class="lbl">SCORE</span><span class="val">${padScore(score)}</span></div>
    </div>
    <div class="result-meta result-meta-duo">
      <div class="cell"><span class="lbl">STAGE</span><span class="val">${stageLabel}</span></div>
      <div class="cell"><span class="lbl">PILOT</span><span class="val">${charDisplayName(stats.charKey, stats.charName || '—')}</span></div>
    </div>
    <button class="btn btn-primary" id="btn-retry">${t('btn.retryRun')}</button>
    <button class="btn" id="btn-title"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${t('btn.title')}</button>
  `, `screen-result ${resultClass}`);
  // Tick133: extreme short landscapes (live @640×360 panelOver≈12.5) can grow
  // the centered result plate past #app while CTA stayed inside — reclaim.
  syncResultPanelBudget();
  requestAnimationFrame(() => syncResultPanelBudget());
  document.getElementById('btn-retry').onclick = showSelect;
  document.getElementById('btn-title').onclick = showTitle;
}
/** In-run asset-gate hard fail — Retry + back to select (not canvas-only hard-stop). */
let assetErrorUi = false;
function showAssetErrorRecovery() {
  if (!game || assetErrorUi) return;
  assetErrorUi = true;
  const msg = game._assetGateError?.message || assets?.bank?.getLastError?.()?.message || 'ASSET LOAD FAILED';
  const stageNo = (game.stageIndex | 0) + 1;
  setHudDimmed(true);
  game.setTouchPadsVisible?.(false);
  screen = 'result';
  showOverlay(`
    <span class="brand-mark">ASSET ERROR</span>
    <span class="asset-error-icon" aria-hidden="true"></span>
    <h2>${t('err.stageLoad', { n: stageNo })}</h2>
    <div class="asset-error-msg"><p>${msg}</p></div>
    <span class="asset-error-deco" aria-hidden="true"></span>
    <button class="btn btn-primary" id="btn-asset-retry">${t('btn.retry')}</button>
    <button class="btn" id="btn-asset-select"><i class="btn-ico lobby-ico-back" aria-hidden="true"></i>${t('btn.toSelect')}</button>
  `, 'screen-asset-error');
  document.getElementById('btn-asset-retry').onclick = () => {
    assetErrorUi = false;
    hideOverlay();
    setHudDimmed(false);
    screen = 'none';
    game?.retryStageAssets?.();
    syncTouchPads();
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  document.getElementById('btn-asset-select').onclick = () => {
    assetErrorUi = false;
    if (game) {
      game.dispose();
      game = null;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    showSelect();
  };
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!game) return;
  game.update(dt);
  game.draw();
  if (demoState) {
    if (game.state === 'cleared' || game.state === 'gameover' || game.time > DEMO_SECONDS) {
      void endDemo('timeout');
    }
    return;
  }
  if (game.stagePhase === 'asset-error') {
    showAssetErrorRecovery();
    return;
  }
  if (assetErrorUi && game.stagePhase !== 'asset-error') {
    assetErrorUi = false;
  }
  if (game.state === 'cleared' || game.state === 'gameover') {
    const stats = typeof game.getResultStats === 'function'
      ? game.getResultStats()
      : { cleared: game.state === 'cleared', score: game.score, graze: game.graze };
    if (stats.runMetrics) {
      console.info('[run] metrics', stats.runMetrics);
      try { window.__LAO_LAST_METRICS__ = stats.runMetrics; } catch { /* */ }
    }
    game.dispose();
    game = null;
    cancelAnimationFrame(raf);
    raf = 0;
    // All clear (the Commander beaten): the pilot's ending dialogue, FIN, then the result.
    if (stats.cleared && !navigator.webdriver) {
      screen = 'ending';
      showEnding(selected, () => endScreen(stats));
    } else {
      endScreen(stats);
    }
  }
}

/** Smoke / measure hooks — progressive vs `?eager=1`, turbo full clears. */
window.__LAO__ = {
  getGame: () => game,
  getAssets: () => assets,
  getAudio: () => audio,
  snapshotAssets: () => (assets?.bank?.snapshotMetrics?.() || assets?.metrics || null),
  setRngSeed: (seed) => game?.setRngSeed?.(seed),
  startInputRecord: () => game?.startInputRecord?.(),
  stopInputRecord: () => game?.stopInputRecord?.() || [],
  loadInputReplay: (events) => game?.loadInputReplay?.(events),
  getInputLog: () => game?.getInputLog?.() || [],
  getPerfLog: () => game?.getPerfLog?.() || [],
  getAssetError: () => assets?.bank?.getLastError?.() || game?._assetGateError || null,
  applySelectCheat: (key) => applySelectCheat(key),
  missingI18nKeys,
};
function showLoading() {
  setHudDimmed(true);
  syncHiHud();
  showOverlay(`
    <div class="panel-frame" aria-hidden="true">
      <i class="pf-corner pf-tl"></i><i class="pf-corner pf-tr"></i>
      <i class="pf-corner pf-bl"></i><i class="pf-corner pf-br"></i>
    </div>
    <span class="brand-mark">LAST SHOOTING</span>
    <h2>LOADING</h2>
    <span class="loading-deco" aria-hidden="true"></span>
    <p id="loading-label">${t('load.preparing')}</p>
    <div class="load-track" aria-hidden="true">
      <div class="load-fill" id="load-fill"></div>
    </div>
    <div class="load-meta">
      <span id="load-count">0 / 0</span>
      <span id="load-pct">0%</span>
    </div>
  `, 'screen-loading');
}
function updateLoading({ loaded, total, ratio, label }) {
  const fill = document.getElementById('load-fill');
  const pct = document.getElementById('load-pct');
  const count = document.getElementById('load-count');
  const lab = document.getElementById('loading-label');
  if (!fill) return;
  const pctVal = Math.round((ratio || 0) * 100);
  fill.style.width = `${pctVal}%`;
  if (pct) pct.textContent = `${pctVal}%`;
  if (count) count.textContent = `${loaded} / ${total}`;
  if (lab && label) lab.textContent = label;
}
function onFullscreenChange() {
  const on = isFullscreen();
  if (settings.fullscreen !== on) persistSettings({ fullscreen: on });
  const box = document.getElementById('opt-fs');
  if (box) box.checked = on;
  // Fullscreen changes the viewport: refit the field (again once the browser bars settle).
  window.dispatchEvent(new Event('resize'));
  setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);
if (fsDocument() !== document) {
  fsDocument().addEventListener('fullscreenchange', onFullscreenChange);
  fsDocument().addEventListener('webkitfullscreenchange', onFullscreenChange);
}
window.addEventListener('resize', () => {
  refitLogicalSize();
  syncPortraitHint();
  if (game) game.setTouchPadsVisible(screen === 'none' && !game.paused);
  if (screen === 'tutorial') syncTutorialPanelBudget();
  if (screen === 'select') syncSelectPanelBudget();
  if (screen === 'options') syncOptionsPanelBudget();
  if (screen === 'pause') syncPausePanelBudget();
  if (screen === 'result') syncResultPanelBudget();
});
window.addEventListener('orientationchange', () => {
  // Wait a tick for innerWidth/Height to settle after rotate.
  setTimeout(() => {
    syncPortraitHint();
    if (screen === 'tutorial') syncTutorialPanelBudget();
    if (screen === 'select') syncSelectPanelBudget();
    if (screen === 'options') syncOptionsPanelBudget();
    if (screen === 'pause') syncPausePanelBudget();
    if (screen === 'result') syncResultPanelBudget();
  }, 120);
});
// First tap anywhere unlocks audio (covers title before Game binds pads).
window.addEventListener('keydown', onTitleMenuKey);
window.addEventListener('keydown', onPauseMenuKey, true);
window.addEventListener('keydown', onSelectCheatKey);
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true, once: false });
// Menu sounds: buttons / menu items confirm, cards / toggles click (in-play pads excluded).
document.addEventListener('click', (e) => {
  const el = e.target.closest?.('#overlay button, #overlay [role=menuitem], #overlay .char-card, #overlay input[type=checkbox]');
  if (!el) return;
  audio.play(el.matches('.char-card, input[type=checkbox], .opt-seg-btn') ? 'ui:move' : 'ui:ok');
}, true);
// Fullscreen setting (mobile default): browsers only allow it from a tap, so enter it on the
// first one. Exiting later turns the setting off (onFullscreenChange), so no re-entry nagging.
function enterFullscreenOnTap() {
  document.removeEventListener('pointerup', enterFullscreenOnTap, true);
  if (navigator.webdriver) return;
  if (settings.fullscreen && !isFullscreen() && canFullscreen()) applyFullscreen(true);
}
document.addEventListener('pointerup', enterFullscreenOnTap, true);
// Soft-lock page scroll / rubber-band on iOS while playing.
document.addEventListener('touchmove', (e) => {
  if (dragScroll.el) return;
  if (e.target.closest?.('input, textarea, .opt-keys, .opt-scroll, #overlay-content')) return;
  e.preventDefault();
}, { passive: false });

// Mobile shell turned 90deg (play.html): the browser's own touch scrolling does not work in
// the rotated frame, so menus scroll by drag here (touch coordinates are already frame-local).
function shellRotated() {
  try {
    return window.parent !== window && !!window.parent.__LAO_SHELL__
      && window.parent.document.documentElement.classList.contains('is-rotated');
  } catch {
    return false;
  }
}
function scrollableAncestor(node) {
  for (let el = node; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy === 'auto' || oy === 'scroll') return el;
  }
  return null;
}
const dragScroll = { el: null, id: -1, y: 0, t: 0, v: 0, moved: 0, raf: 0 };
document.addEventListener('touchstart', (e) => {
  cancelAnimationFrame(dragScroll.raf);
  dragScroll.el = null;
  if (!shellRotated() || e.touches.length !== 1) return;
  const el = scrollableAncestor(e.target);
  if (!el || e.target.closest?.('input[type=range], select')) return;
  const tch = e.touches[0];
  Object.assign(dragScroll, { el, id: tch.identifier, y: tch.clientY, t: performance.now(), v: 0, moved: 0 });
}, { passive: true, capture: true });
document.addEventListener('touchmove', (e) => {
  const d = dragScroll;
  if (!d.el) return;
  const tch = [...e.changedTouches].find((x) => x.identifier === d.id);
  if (!tch) return;
  const dy = tch.clientY - d.y;
  const now = performance.now();
  d.moved += Math.abs(dy);
  d.el.scrollTop -= dy;
  d.v = 0.8 * (-dy / Math.max(1, now - d.t)) + 0.2 * d.v;
  d.y = tch.clientY;
  d.t = now;
  e.preventDefault();
}, { passive: false, capture: true });
document.addEventListener('touchend', (e) => {
  const d = dragScroll;
  if (!d.el || ![...e.changedTouches].some((x) => x.identifier === d.id)) return;
  // A real drag must not also click whatever is under the finger.
  if (d.moved > 8) {
    const block = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', block, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', block, { capture: true }), 350);
  }
  const el = d.el;
  let v = d.v; // px per ms
  let last = performance.now();
  d.el = null;
  const glide = (now) => {
    const dt = now - last;
    last = now;
    v *= Math.pow(0.995, dt);
    if (Math.abs(v) < 0.02) return;
    el.scrollTop += v * dt;
    dragScroll.raf = requestAnimationFrame(glide);
  };
  dragScroll.raf = requestAnimationFrame(glide);
}, { capture: true });

/* ——— Attract mode (arcade demo loop) ———
   Cabinet order: VALOFE logo -> DEMO PLAY -> title. Boot ends on the logo and goes straight
   into the demo; a title left alone for ATTRACT_IDLE_MS plays the logo again, then the demo.
   The demo (random base pilot, auto-pilot, invincible) runs DEMO_SECONDS and returns to the
   title; any key / tap during the logo or demo returns to the title at once. Demo runs never
   reach the result screen or the hi-score. */
const ATTRACT_IDLE_MS = 20000;
const DEMO_SECONDS = 40;
const DEMO_PILOTS = ['griffin', 'sleipnir', 'express76'];
let lastInputAt = performance.now();
/** @type {null | { prevSelected: string, ending: boolean, unbanner?: () => void, onInput: (e: Event) => void }} */
let demoState = null;
/** Attract loop arms only once boot (BIOS + logo) has handed over. */
let attractArmed = false;
let attractBusy = false;
const markInput = () => { lastInputAt = performance.now(); };
window.addEventListener('keydown', markInput, true);
window.addEventListener('pointerdown', markInput, true);
window.addEventListener('wheel', markInput, { capture: true, passive: true });
setInterval(() => {
  if (!attractArmed || attractBusy || screen !== 'title' || demoState) return;
  if (document.visibilityState !== 'visible') return;
  if (performance.now() - lastInputAt < ATTRACT_IDLE_MS) return;
  void runAttract();
}, 1000);

/** Idle title -> logo -> demo. A press during the logo keeps the player on the title. */
async function runAttract() {
  attractBusy = true;
  try {
    const before = lastInputAt;
    stopTitleNavPads();
    screen = 'logo';
    await playLogo();
    if (lastInputAt !== before) {
      lastInputAt = performance.now();
      blackNow();
      showTitle();
      await fadeIn(450);
      return;
    }
    await startDemo();
  } finally {
    attractBusy = false;
  }
}

async function startDemo() {
  const charKey = DEMO_PILOTS[(Math.random() * DEMO_PILOTS.length) | 0];
  const onInput = (e) => {
    if (e.type === 'keydown' && e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    void endDemo('input');
  };
  demoState = { prevSelected: selected, ending: false, onInput };
  window.addEventListener('keydown', onInput, true);
  window.addEventListener('pointerdown', onInput, true);
  stopTitleNavPads();
  // Black cabinet screen while the demo sortie loads (no LOADING card).
  const unblank = showBlank();
  demoState.unbanner = unblank;
  screen = 'demo';
  try {
    await startGame(charKey, { demo: true });
  } catch (err) {
    console.warn('[demo] start failed', err);
  }
  if (!demoState || demoState.ending) return;
  if (!game) { void endDemo('input'); return; }
  game.debug.autoPlay = true;
  game.player.godMode = true;
  screen = 'demo';
  game.setTouchPadsVisible(false);
  // Fade the demo field up out of black.
  blackNow();
  demoState.unbanner = showDemoBanner('PRESS ANY BUTTON');
  await fadeIn(650);
}

async function endDemo() {
  const st = demoState;
  if (!st || st.ending) return;
  st.ending = true;
  window.removeEventListener('keydown', st.onInput, true);
  window.removeEventListener('pointerdown', st.onInput, true);
  // Arcade hand-over: the demo picture collapses like a CRT powering off, a beat of black,
  // then the title warms up out of it (crtOn below).
  if (game) await crtOff(720);
  else blackNow();
  st.unbanner?.();
  if (game) {
    game.dispose();
    game = null;
  }
  cancelAnimationFrame(raf);
  raf = 0;
  selected = st.prevSelected;
  hideOverlay();
  demoState = null;
  lastInputAt = performance.now();
  showTitle();
  await new Promise((r) => setTimeout(r, 260));
  await crtOn(950);
}

async function boot() {
  syncPortraitHint();
  prefersLowEndGfx();
  document.body.classList.add('lao-newui');
  if (touchUi) document.body.classList.add('touch-ui');
  // NewUI ceremony bitmaps — parallel with progressive asset bank (tiny PNGs).
  void ensureNewUiSlices();
  try {
    // Arcade power-on: BIOS self test (its PROGRAM ROM bar is the real boot load), test
    // pattern, warning card, VALOFE logo -> DEMO PLAY (title underneath for when it ends).
    let biosProgress = null;
    const assetsReady = loadAssets((p) => biosProgress?.(p));
    // Automated runs (QA / release tools) go straight to the title: no BIOS, logo or demo.
    const automated = !!navigator.webdriver;
    const biosDone = automated ? Promise.resolve(true)
      : playBiosBoot({ assetsReady, onProgressHook: (fn) => { biosProgress = fn; } });
    assets = await assetsReady;
    // Skipped the boot / VALOFE logo with a press -> title, no demo first (user).
    const bootSkipped = await biosDone;
    if (settings.fullscreen) await applyFullscreen(true);
    showTitle();
    attractArmed = !automated;
    lastInputAt = performance.now();
    if (!automated && !bootSkipped) void startDemo();
  } catch (err) {
    showOverlay(`
      <span class="brand-mark">ERROR</span>
      <h2>${t('err.boot')}</h2>
      <p>${err.message}</p>
    `, 'screen-result gameover');
    console.error(err);
  }
}
boot();
