/** Lazy Valofe NewUI bitmap cache for canvas ceremony / chrome. No AI images. */

const SLICES = {
  titleDeco: 'assets/ui/newui/newui_Popup_Bg_Title_Deco.png',
  topBg: 'assets/ui/newui/newui_Top_Bg.png',
  box2: 'assets/ui/newui/newui_Popup_Bg_Box2.png',
  textDeco: 'assets/ui/newui/newui_Popup_Bg_Text_Deco.png',
  /* Unity Valofe NewUI extras — CSS hooks + canvas-ready preload */
  popupClose: 'assets/ui/newui/newui_Popup_Icon_Close.png',
  loadingCue: 'assets/ui/newui/newui_OfflineBattle_InProgress_Loding.png',
  rankingBackplate: 'assets/ui/newui/UI_Ranking_Backplate.png',
  rankingFrame01: 'assets/ui/newui/UI_Ranking_Frame_01.png',
  rankingFrame02: 'assets/ui/newui/UI_Ranking_Frame_02.png',
  rankingFrame03: 'assets/ui/newui/UI_Ranking_Frame_03.png',
  btnDeactivation: 'assets/ui/newui/newui_Btn_Deactivation.png',
  popupBox: 'assets/ui/newui/newui_Popup_Bg_Box.png',
  /* Tick01 sync — OfflineBattle / SideStory / Base icons */
  offlineComplete: 'assets/ui/newui/btn_newui_OfflineBattle_Complete.png',
  offlineInProgress: 'assets/ui/newui/btn_newui_OfflineBattle_InProgress.png',
  sideStory: 'assets/ui/newui/btn_newui_SideStory.png',
  battlePassTicket: 'assets/ui/newui/btn_newui_BattlePassTicket.png',
  baseIconLayout: 'assets/ui/newui/newui_Base_Icon_BaseLayout.png',
  baseIconCollect: 'assets/ui/newui/newui_Base_Icon_CollectAll.png',
  baseIconPresent: 'assets/ui/newui/newui_Base_Icon_present.png',
  baseIconUpgrade: 'assets/ui/newui/newui_Base_Icon_Upgrade.png',
  /* Tick02 sync — SelectWorld event cards (MissORCA locale titles removed) */
  selectWorld01: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_01.png',
  selectWorld02: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_02.png',
  selectWorld09: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_09.png',
  selectWorld10: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_10.png',
  selectWorld15: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_15.png',
  selectWorld16: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_16.png',
  selectWorld24: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_24.png',
  selectWorld26: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_26.png',
  /* Tick03 sync — more Event_Btn for dossier / lobby / pause-options rails */
  selectWorld03: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_03.png',
  selectWorld04: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_04.png',
  selectWorld05: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_05.png',
  selectWorld06: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_06.png',
  selectWorld07: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_07.png',
  selectWorld08: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_08.png',
  selectWorld11: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_11.png',
  selectWorld12: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_12.png',
  /* Tick04 sync — remaining Event_Btn for tutorial/loading/rotate/lobby */
  selectWorld13: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_13.png',
  selectWorld14: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_14.png',
  selectWorld17: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_17.png',
  selectWorld18: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_18.png',
  selectWorld19: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_19.png',
  selectWorld20: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_20.png',
  selectWorld21: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_21.png',
  selectWorld22: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_22.png',
  selectWorld23: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_23.png',
  selectWorld25: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_25.png',
  selectWorld27: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_27.png',
  selectWorld28: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_28.png',
  selectWorld29: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_29.png',
  /* Tick05 sync — distinct underscore Event alts (idle rails); skip near-identical 23_/25_/27_ */
  selectWorld04Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_04_.png',
  selectWorld05Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_05_.png',
  selectWorld06Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_06_.png',
  selectWorld08Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_08_.png',
  selectWorld11Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_11_.png',
  selectWorld18Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_18_.png',
  selectWorld20Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_20_.png',
  selectWorld22Alt: 'assets/ui/newui/SelectWorld_Event_Btn/SelectWorld_Event_22_.png',
};

/** @type {Record<string, HTMLImageElement|null>} */
const cache = Object.create(null);
let loading = null;

function loadOne(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Slices the canvas actually draws via newUiSlice(). The rest of SLICES are
 * CSS-side art (the browser fetches those itself when shown) — preloading all
 * of them pulled ~18MB / ~100MB decoded before the title could paint.
 */
const CANVAS_KEYS = ['box2', 'topBg', 'titleDeco'];

/** Preload NewUI slices once (safe to call repeatedly). */
export function ensureNewUiSlices() {
  if (loading) return loading;
  loading = (async () => {
    await Promise.all(
      CANVAS_KEYS.map((key) => [key, SLICES[key]]).map(async ([key, src]) => {
        cache[key] = await loadOne(src);
      }),
    );
    return cache;
  })();
  return loading;
}

/** @returns {HTMLImageElement|null} ready bitmap or null */
export function newUiSlice(key) {
  const img = cache[key];
  if (!img || !img.complete || !(img.naturalWidth > 0)) return null;
  return img;
}
