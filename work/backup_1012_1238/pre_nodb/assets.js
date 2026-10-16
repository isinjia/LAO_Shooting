import { t } from './i18n.js';
import { loadNativeWeaponFx } from './native-weapon-fx.js';
import { prefersLowEndGfx } from './mobile.js';
import {
  countAnimFrames,
  fetchAnimJson,
  fetchSheetJson,
  loadDecodedImage,
  loadNativeAnim,
} from './clip-anim.js';

const LOAD_RETRIES = 2;
const LOAD_RETRY_MS = 280;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetries(label, fn, retries = LOAD_RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      console.warn(`[assets] ${label} attempt ${attempt + 1}/${retries + 1} failed`, err);
      if (attempt < retries) await sleep(LOAD_RETRY_MS * (attempt + 1));
    }
  }
  throw lastErr || new Error(`[assets] ${label} failed`);
}


/** Named select roster (slots 1–3). Also the Random pool. */
const BASE_PLAYER_KEYS = ['griffin', 'sleipnir', 'express76'];
/** Legacy kits stay loadable (cheats / fallback); not named select slots. */
const LEGACY_PLAYER_KEYS = ['hirume', 'constantia', 'lrl', 'merlin', 'fafnir', 'peregrinus'];
/** Hidden unlock kits (cheats). Loaded on demand / prefetch. */
const RARE_PLAYER_KEYS = ['eternity', 'labiata', 'emily'];
/** All playable keys (bake + CHAR_META + load). */
const PLAYER_KEYS = [...BASE_PLAYER_KEYS, ...LEGACY_PLAYER_KEYS, ...RARE_PLAYER_KEYS];
/** Character-select slot key for Random (resolved on sortie). */
const RANDOM_SLOT_KEY = 'random';
/** Baked Metal Parasite / monster skins (not bioroid player chars). */
const ENEMY_KEYS = [
  // Grunts (one look per act - user: more monster types, no resized copies)
  'programmob_an', 'programmob_as',
  'wasp', 'slasher', 'nightchick', 'intruder', 'scout', 'spector',
  'tracker', 'nestchaser',
  // Elites
  'deathstalker', 'destroyer', 'tarantula', 'legion', 'harvester',
  'emperorchick', 'juggernaut', 'phalangites',
  // Unused look-alikes kept loadable (scarab = recoloured wasp, bigchick = big nightchick).
  'scarab', 'bigchick',
  // Named mobs (original monster prefabs, tools/bake_monster_sprites.py).
  'testudo', 'kidnapper', 'chiller', 'dreadlurker', 'frostbite', 'lightningbomber', 'mammoth',
  // Stage midbosses (5 acts): bioroid / AGS leaders (bake_sd_character mid_*).
  'mid_triton', 'mid_nidhogg', 'mid_glacias', 'mid_goltarion', 'mid_satgat',
  // Final boss bodies (phase 1 / 2 / 3), the commander's face drawn over the head.
  'final_yimir', 'final_arachne', 'final_roc',
  // Stage bosses (5 acts). Acts 1-4: bioroid leaders (bake_sd_character boss_*).
  'boss_hachiko', 'boss_csperrault', 'boss_snowfeather', 'boss_blacklilith', 'doomeater',
  // Former act 1-4 bosses (kept loadable).
  'predator',
];

/** Per-act enemy roster — used for priority load / prefetch / unload. */
export const STAGE_ENEMY_KEYS = [
  ['programmob_an', 'programmob_as', 'deathstalker', 'testudo', 'kidnapper', 'mid_triton', 'boss_hachiko'],
  ['wasp', 'slasher', 'destroyer', 'chiller', 'dreadlurker', 'mid_nidhogg', 'boss_csperrault'],
  ['nightchick', 'intruder', 'tarantula', 'frostbite', 'mid_glacias', 'boss_snowfeather'],
  ['scout', 'spector', 'legion', 'harvester', 'lightningbomber', 'mid_goltarion', 'boss_blacklilith'],
  ['tracker', 'nestchaser', 'emperorchick', 'juggernaut', 'phalangites', 'mammoth', 'mid_satgat', 'final_yimir', 'final_arachne', 'final_roc'],
];

/** On-screen draw size (px). Baseline 100 = elite top.
 *  Grunt 0.55–0.70 · Elite 0.85–1.00 · Midboss 1.12–1.18 · Boss 1.36–1.48 */
// drawScale compensates for wide animation bounds around slim humanoid bodies.
// drawSize = size * drawScale; enemy damage hitR = drawSize * 0.5 (sprite footprint).
// oneHit: small fry (1945-style) — any single hit kills; big bodies keep stage HP.
const ENEMY_META = {
  // drawScale sets the visible body (tools/measure-enemy-size.mjs, logical px): one-hit small
  // fry >= 64 (stage 2's wasp / slasher 80, user: they were ~40), and anything that takes more
  // than one hit is visibly bigger than its stage's fry (>= ~1.3x).
  // Grunts (small / low threat)
  wasp: { name: 'Wasp', size: 56, drawScale: 2.0, oneHit: true },
  nightchick: { name: 'Night Chick', size: 58, drawScale: 1.54, oneHit: true },
  programmob_an: { name: 'Program Mob', size: 60, drawScale: 1.45, oneHit: true },
  programmob_as: { name: 'Program Mob AS', size: 66, drawScale: 3.7 },
  scout: { name: 'Scout', size: 70, drawScale: 1.56, oneHit: true },
  slasher: { name: 'Slasher', size: 66, drawScale: 1.67, oneHit: true },
  intruder: { name: 'Intruder', size: 70, drawScale: 2.15, oneHit: true },
  spector: { name: 'Spector', size: 72, drawScale: 1.49, oneHit: true },
  tracker: { name: 'Tracker', size: 70, drawScale: 1.56, oneHit: true },
  nestchaser: { name: 'Nest Chaser', size: 58, drawScale: 2.15, oneHit: true },
  // Elites (medium–large)
  scarab: { name: 'Scarab', size: 88, drawScale: 1.63 },
  bigchick: { name: 'Big Chick', size: 96, drawScale: 1.43 },
  legion: { name: 'Legion', size: 100, drawScale: 1.36 },
  deathstalker: { name: 'Death Stalker', size: 104, drawScale: 1.69 },
  destroyer: { name: 'Destroyer', size: 108, drawScale: 1.26 },
  tarantula: { name: 'Tarantula', size: 104, drawScale: 1.2 },
  harvester: { name: 'Harvester', size: 100, drawScale: 1.37 },
  emperorchick: { name: 'Emperor Chick', size: 108, drawScale: 1.28 },
  juggernaut: { name: 'Juggernaut', size: 96, drawScale: 1.6 },
  phalangites: { name: 'Phalangites', size: 104, drawScale: 1.37 },
  // Named mobs: one before / one after each midboss (game.js _namedFlow), ~2x an elite.
  testudo: { name: 'Testudo', size: 100, drawScale: 2.43, named: true },
  kidnapper: { name: 'Kidnapper', size: 100, drawScale: 2.9, named: true },
  chiller: { name: 'Chiller', size: 100, drawScale: 2.81, named: true },
  dreadlurker: { name: 'Dreadlurker', size: 100, drawScale: 2.2, named: true },
  frostbite: { name: 'Frostbite', size: 100, drawScale: 2.5, named: true },
  lightningbomber: { name: 'Lightning Bomber', size: 100, drawScale: 2.73, named: true },
  mammoth: { name: 'Mammoth', size: 100, drawScale: 2.25, named: true },
  // Stage bosses (largest + highest HP). Bioroid leaders are baked facing right: flipX.
  // Stage midbosses (bioroid / AGS, baked facing right).
  // Midbosses drawn at 2x (user request); hitbox follows drawSize.
  mid_triton: { name: '트리톤', size: 224, flipX: true },
  mid_nidhogg: { name: '니드호그', size: 224, flipX: true },
  mid_glacias: { name: '글라시아스', size: 224, flipX: true },
  mid_goltarion: { name: '골타리온', size: 232, flipX: true },
  mid_satgat: { name: '데카르트 보이저 삿갓', size: 224, flipX: true },
  boss_hachiko: { name: '성벽의 하치코', size: 128, flipX: true },
  // Final boss: the commander, wearing Yimir -> N2E-888 Arachne -> RF87 Roc by HP phase.
  final_yimir: { name: '사령관', size: 140, flipX: true, phaseBodies: ['final_yimir', 'final_arachne', 'final_roc'], face: true },
  final_arachne: { name: '사령관', size: 140, flipX: true },
  final_roc: { name: '사령관', size: 140, flipX: true },
  boss_csperrault: { name: 'CS 페로', size: 128, flipX: true },
  boss_snowfeather: { name: '스노우 페더', size: 128, flipX: true },
  boss_blacklilith: { name: '블랙 리리스', size: 128, flipX: true },
  predator: { name: 'Predator', size: 136 },
  doomeater: { name: 'Doom Eater', size: 148 },
};
// LAO battle BG style: wide strips tiled on X (IW / Factory)
const BG_KEYS = ['loop_far', 'loop_mid', 'loop_near', 'bg1', 'bg3', 'lao_bg_2_8_1', 'lao_bg_13_30'];
/** Per-act painted plates — deferred until that stage gates (title boots with zero BGs). */
const STAGE_BG_KEYS = [
  ['bg1'],
  ['loop_far', 'loop_mid', 'loop_near'],
  ['lao_bg_2_8_1'],
  ['bg3'],
  ['lao_bg_13_30'],
];

/** Per-character shot profile (pattern / color / style → player.shoot + bullet draw). */
const CHAR_META = {
  // P/A-00 Griffin — Unity attack_hand_missile_skill (A1) / PA00EL skill2 rocket dive (A2).
  // Shot = 1945 II P-38 Lightning: parallel twin-boom vulcan streams that widen with P.
  // 보조무기 (sub weapon) = P-38 homing missiles, auto-launched with the main shot (no hold).
  // C = Skill1 missiles; X = Skill2 bombing VFX.
  griffin: {
    // C / X damage multipliers (tools/eval-bomb-dps.mjs: every C level and X >= Lv5 fire DPS).
    specialMul: 18, bombMul: 33,
    speed: 300, // Move speed (px/s): balanced
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -1.1, y: 6.8 },
    name: 'P/A-00 그리폰',
    // Baseline player SD footprint (drawSize 78). Other kits scale to match.
    drawSize: 78,
    fireRate: 0.1,
    shotSpeed: 1150,
    // Boss DPS by shot shape (user): straight lines hit harder, spreads less.
    shotDamage: 1.31,
    kit: { shot: '라이트닝 샷', charge: '유도 미사일', special: '핸드 미사일' },
    chargeEnabled: false,
    subWeapon: 'homing',
    shot: {
      pattern: 'p38',
      color: '#ffe36a',
      glow: '#ff9a2a',
      style: 'p38shot',
      r: 3.6,
    },
  },
  // P-49 Sleipnir — Unity Skil_1 gunfire (A1) / Skil_2 sonic-boom charge (A2).
  // Shot = 1945 II J7W Shinden concentrated shot: a continuous column of lavender flame blades.
  // 보조무기 = Shinden heat missiles that lodge in enemies and burn (auto, no hold).
  // C = Skill1 zone dashes; X = Skill2 centre-line charge.
  sleipnir: {
    // C / X damage multipliers (tools/eval-bomb-dps.mjs: every C level and X >= Lv5 fire DPS).
    specialMul: 15, bombMul: 18,
    // Damage growth per P level [-, Lv1..Lv5] (keeps the role's DPS tier at every level).
    lvDmg: [1, 1, 1, 1, 1.2, 1.41],
    speed: 280, // Move speed (px/s): attack type: slower
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: 0.9, y: 5.7 },
    name: 'P-49 슬레이프니르',
    drawSize: 79,
    fireRate: 0.1,
    shotSpeed: 800,
    // Boss DPS by shot shape (user): straight lines hit harder, spreads less.
    shotDamage: 1.17,
    kit: { shot: '집중 사격', charge: '열추적 미사일', special: '제압 사격' },
    chargeEnabled: false,
    subWeapon: 'heat',
    shot: {
      pattern: 'shinden',
      color: '#dccaff',
      glow: '#9a6bff',
      style: 'shindenshot',
      r: 7,
    },
  },
  // Express 76 — courier SMG / package ordnance. Shot reuses rifle aim; HOLD reuses Merlin shells.
  express76: {
    // Lv4-5 +10% (balance pass: weakest Lv5 DPS and slowest full clear).
    lvDmg: [1, 1, 1, 1, 1.1, 1.1],
    // C / X damage multipliers (tools/eval-bomb-dps.mjs: every C level and X >= Lv5 fire DPS).
    specialMul: 15, bombMul: 22,
    speed: 360, // Move speed (px/s): speed type
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -4.8, y: 0.1 },
    name: '익스프레스 76',
    // Baked contentBox is wider (ponytail) — bump drawSize so body diag ≈ Griffin.
    drawSize: 92,
    fireRate: 0.13,
    shotSpeed: 980,
    // Boss DPS by shot shape (user): straight lines hit harder, spreads less.
    shotDamage: 1.27,
    // C/X follow Unity skill1 (Freight Shipping) / skill2 (Here's Your Delivery!).
    // Shot = 1945 II XF5U Flying Pancake wide shot (fan of pellets).
    // 보조무기 = Pancake automatic laser: precisely aimed blue lasers (auto, no hold).
    kit: { shot: '와이드 샷', charge: '자동 레이저', special: '화물 배송' },
    chargeEnabled: false,
    subWeapon: 'laser',
    shot: {
      pattern: 'pancake',
      color: '#c9a2ff',
      glow: '#7a3cff',
      style: 'pancakeshot',
      r: 4,
    },
  },
  // Miko / fox / Yatagarasu — Yatagarasu flame projectiles
  hirume: {
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -1.4, y: 10 },
    name: 'Hirume',
    drawSize: 75,
    // Autofire cadence ×2 delay (half shots/sec) vs prior 0.09.
    fireRate: 0.18,
    shotSpeed: 800,
    shotDamage: 1,
    kit: { shot: '야타가라스', charge: '봉황 날개', special: '야타가라스 정화 결계' },
    shot: {
      pattern: 'yatagarasu',
      color: '#ffd56a',
      glow: '#ff9a3c',
      style: 'foxflame',
      r: 7.8,
    },
  },
  // Winchester rifle hunter — precise ballistic tracers
  constantia: {
    // C / X damage multipliers (tools/eval-bomb-dps.mjs: every C level and X >= Lv5 fire DPS).
    specialMul: 27, bombMul: 8.4, // +5%: X sat just under Lv5 fire
    // Damage growth per P level [-, Lv1..Lv5] (keeps the role's DPS tier at every level).
    lvDmg: [1, 1.065, 1.065, 1.065, 1.1, 1.14],
    speed: 320, // Move speed (px/s): better than the base three
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -3.5, y: 0.8 },
    name: '콘스탄챠',
    drawSize: 79,
    // Shot = Gunbird Marion: a wide magic spread (3 -> 7 ways with power).
    // 보조무기 = Marion's homing stars, as hearts by request (faster when close to enemies).
    fireRate: 0.1,
    shotSpeed: 820,
    // Boss DPS by shot shape (user): straight lines hit harder, spreads less.
    shotDamage: 2.69,
    kit: { shot: '매직 스프레드', charge: '하트 유도탄', special: '발목 잡기' },
    chargeEnabled: false,
    subWeapon: 'hearts',
    shot: {
      pattern: 'marion',
      color: '#ffe6fb',
      glow: '#ff5fc8',
      style: 'marionshot',
      r: 4.5,
    },
  },
  // Dragon Slayer axe / Cyclops — Dragon Slayer slash waves
  lrl: {
    // C / X damage multipliers (tools/eval-bomb-dps.mjs: every C level and X >= Lv5 fire DPS).
    specialMul: 11, bombMul: 27,
    // Damage growth per P level [-, Lv1..Lv5] (keeps the role's DPS tier at every level).
    lvDmg: [1, 1.17, 1.17, 1.17, 1.4, 1.67],
    speed: 310, // Move speed (px/s): better than the base three
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -2.9, y: 4.4 },
    name: 'LRL',
    drawSize: 79,
    // Autofire cadence ×2 delay (half shots/sec) vs prior 0.14.
    fireRate: 0.28,
    shotSpeed: 620,
    // Boss DPS by shot shape (user): straight lines hit harder, spreads less.
    shotDamage: 4.4,
      kit: { shot: '붉은 회전 검기', charge: '어둠의 도끼', special: '어둠의 도끼 · 환영 돌진' },
    shot: {
      pattern: 'axe',
      color: '#e81e2b',
      glow: '#ff1744',
      style: 'cleave',
      r: 8.5,
    },
  },
  // Peregrinus, bird form (bird_* clips; sprite-only bake). Cheat-only unlock.
  // Shot: twin falcon darts straight ahead, P adds angled side pairs. C/X: later.
  peregrinus: {
    // C / X damage multipliers (tools/eval-bomb-dps.mjs: every C level and X >= Lv5 fire DPS).
    specialMul: 1, bombMul: 15,
    // Damage growth per P level [-, Lv1..Lv5] (keeps the role's DPS tier at every level).
    lvDmg: [1, 1, 1, 1, 1.25, 1.53],
    speed: 400, // Move speed (px/s): bird form: fastest pilot
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -15, y: 8 }, // torso (hand-set: weapon / wings pull the alpha centroid off)
    name: '페레그리누스',
    // Shared box with the human / change bakes (one camera), so one draw size fits all.
    drawSize: 156,
    fireRate: 0.1,
    shotSpeed: 1000,
    shotDamage: 1.84,
    kit: { shot: '팔콘 샷', charge: '소닉 붐', special: '휴먼폼 변신' },
    chargeEnabled: false,
    // 보조무기 (bird form): sonic boom - the original Peregrinus_sonicboom crescent
    // (assets/native-shots/peregrinus-sonicboom.png) rolls forward, swelling, piercing.
    subWeapon: 'sonic',
    shot: {
      pattern: 'falcon',
      color: '#fbffd8',
      glow: '#c8e83a',
      style: 'falconshot',
      r: 4,
    },
    // X in bird form = her original bird_Skil_2 (4.5s) played as a straight dash through
    // the field (body only - the ship stays) that wraps round the screen back to her.
    birdBomb: {
      clips: 'peregrinus_bskill2',
      speed: 1.5, // was 1.25: X 20% faster (bomb DPS above Lv5 fire with the halved leader damage)
      fx: 'bskill2',
      // Dash straight ahead (dash pose = clip 1.08s held); touching an enemy stops her for
      // the clip's flurry (1.15-2.55s, 9 EventHits on what the body touches), then she dashes
      // on, leaves the right edge, flies back in from the left (backTime s, bird move loop),
      // and lands with the clip's end (3.8-4.5s). No contact: straight through.
      dash: { pose: 1.08, flurry: [1.15, 2.55], land: [3.8, 4.5], out: [0.8], margin: 180,
        accel: 2600, maxSpeed: 1500, backTime: 0.9 },
      hitRadius: 70,
      events: [
        [0.333, 'sfx', 'peregrinus_bird_skill2_01'], [1.15, 'sfx', 'peregrinus_bird_skill2_02'],
        [1.17, 'shake', 0.3], [1.18, 'blast', 0.111], [1.35, 'blast', 0.111], [1.5, 'shake', 0.7],
        [1.52, 'blast', 0.111], [1.68, 'blast', 0.111], [1.85, 'blast', 0.111], [2.02, 'blast', 0.111],
        [2.18, 'blast', 0.111], [2.35, 'blast', 0.111], [2.383, 'sfx', 'peregrinus_bird_skill2_03'],
        [2.45, 'shake', 0.3], [2.52, 'blast', 0.111],
      ],
    },
    // C: transforms into her human form for a time scaled by C level. Human form
    // (assets/sd_baked/peregrinus_human): shot = 1945 III X-36 Lv1 super shot "Spiral
    // Laser" turned sideways - one continuous narrow beam held while FIRE is down, two
    // counter-phased green (#00FFA3) strands spiralling round a white core; continuous piercing
    // damage on a straight band. 보조무기 = orange homing missiles.
    humanForm: {
      bombMul: 45, // human-form X (Skil_2 beam): ~2x its Lv5 fire, like every other X
      clips: 'peregrinus_human',
      hitOffset: { x: 0, y: 14 }, // torso (hand-set: weapon / wings pull the alpha centroid off)
      // bird_change_motion (5.33s) plays before the swap, change_motion (6.45s) when it
      // runs out; both at changeSpeed. The last warnSeconds blink yellow, faster and faster.
      changeClips: 'peregrinus_change',
      revertClips: 'peregrinus_revert',
      // X in human form = her original human Skil_2 (7.48s: charge, giant beam, back to the
      // bird). Events in clip time: [t, type, arg] (sfx stem / shake magnitude / damage share).
      bomb: {
        clips: 'peregrinus_hskill2',
        speed: 1.92, // was 1.6: X 20% faster (bomb DPS above Lv5 fire with the halved leader damage)
        fx: 'hskill2',
        endsBird: true,
        // She can move while firing; only enemies inside the beam band take the hits.
        mobile: true,
        // The beam window (clip 3.16-4.66s) plays 3.75x slower: the laser lasts 3.75x longer.
        stretch: [3.16, 4.66, 3.75],
        beamY: -18,        // beam line vs ship y (px)
        beamHalf: 70,      // hit band half-height (px)
        events: [
          [0.5, 'sfx', 'peregrinus_skill2_01'], [0.767, 'sfx', 'peregrinus_skill2_02'],
          [1.25, 'shake', 1.4], [3.15, 'sfx', 'peregrinus_skill2_03'], [3.333, 'shake', 0.35],
          // 10 beam ticks over the (stretched) beam, 1 bomb in total.
          [3.4, 'blast', 0.1], [3.52, 'blast', 0.1], [3.617, 'blast', 0.1], [3.7, 'shake', 0.5],
          [3.72, 'blast', 0.1], [3.833, 'blast', 0.1], [3.94, 'blast', 0.1], [4.033, 'blast', 0.1],
          [4.15, 'blast', 0.1], [4.25, 'shake', 0.3], [4.283, 'blast', 0.1], [4.4, 'blast', 0.1],
        ],
      },
      changeSpeed: 6.08, // 4.5 x 1.35 (user: transform 35% faster)
      warnSeconds: 3,
      seconds: [0, 6, 10, 15],
      drawSize: 156,
      fireRate: 0.16,
      shotSpeed: 760,
      shotDamage: 2.48,
      speed: 340, // human form: top damage, 2 speed steps below the bird (400)
      lvDmg: [1, 1, 1, 1, 1, 1], // beam growth lives in the spiral settings
      subWeapon: 'x36missile',
      shot: {
        pattern: 'spiral',
        color: '#eaf6ff',
        glow: '#3f8dff',
        style: 'spiral',
        r: 4,
      },
      // Spiral Laser settings (all tunable here).
      spiral: {
        width: 18,         // hit band half-height (px); visual core/strands scale from it
        glowWidth: 44,     // outer glow half-height (px)
        amp: 20,           // strand swing (px)
        strandWidth: 2,    // strand line-width multiplier
        wave: 0.05,        // strand turns per px (radians)
        speed: 16,         // strand travel / spin (radians per second)
        grow: 0.12,        // s for the beam to reach the right edge
        fade: 0.14,        // s to collapse after release (no damage meanwhile)
        tick: 0.07,        // damage interval (s)
        // x shot damage per tick: the human form is the top-DPS kit (Lv5 ~100/s with its
        // missiles vs a boss, above every other pilot and the bird form).
        damage: 1.0,
        // Beam size per P level (Lv1 = the base size above; Lv5 = twice as thick).
        levelWidth: [0, 1, 1.25, 1.5, 1.75, 2],
        // Original Peregrinus FX colour: startColor (0, 1, 0.64) = #00FFA3, white cores.
        core: '#f2fff9',
        strand: '#00ffa3',
        strandBack: '#00a86a',
        glow: '#00e08f',
        glowRgb: '0,255,163',
        highlight: '#c8ffe9',
      },
    },
  },
  // War Maestro / Prydwen baton — Big Gun cannon shells (wiki A1)
  merlin: {
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -0.9, y: 2.6 },
    name: '멀린',
    drawSize: 86,
    // Autofire cadence ×2 delay (half shots/sec) vs prior 0.095.
    fireRate: 0.19,
    shotSpeed: 780,
    shotDamage: 1.12,
    kit: { shot: '빅 건', charge: '빅 건 강사격', special: 'UNREP 전술 지원' },
    shot: {
      pattern: 'baton',
      color: '#e63946',
      glow: '#9b2226',
      style: 'shell',
      r: 4,
    },
  },
  // Tesla Tail Jupiter — Tesla discharge bolts
  fafnir: {
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -0.4, y: 2.6 },
    name: '파프니르',
    drawSize: 78,
    // Autofire cadence ×2 delay (half shots/sec) vs prior 0.08.
    fireRate: 0.16,
    shotSpeed: 860,
    shotDamage: 1.08,
    kit: { shot: '흐로티', charge: '주피터 뇌운장', special: '쇼크 앤 오' },
    shot: {
      pattern: 'tesla',
      color: '#7cf5ff',
      glow: '#b388ff',
      style: 'lightning',
      r: 4,
    },
  },
  // Special Nanny / HMG R.I.P. — coffin-veiled machinegun (Random 3%)
  eternity: {
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -3.3, y: 7.4 },
    name: '이터니티',
    drawSize: 79,
    // Was 0.055 / 0.9 — Lv4 lane spam outpaced readable rare identity vs Constantia.
    // Autofire cadence ×2 delay (half shots/sec) vs prior 0.072; HMG pattern unchanged.
    fireRate: 0.144,
    shotSpeed: 900,
    shotDamage: 0.9,
    rare: true,
    kit: { shot: '보모의 기관총', charge: '두 사람을 위한 관', special: '편히 잠드소서' },
    shot: {
      pattern: 'hmg',
      color: '#d4c4ff',
      glow: '#7a5cff',
      style: 'coffinround',
      r: 3.2,
    },
  },
  // Weapon Master / Trollsberd plasma sword (Random 3%)
  labiata: {
    // C / X damage multipliers (tools/eval-bomb-dps.mjs: every C level and X >= Lv5 fire DPS).
    specialMul: 13, bombMul: 41,
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -9, y: -3 }, // torso (hand-set: weapon / wings pull the alpha centroid off)
    name: '라비아타',
    // Oversized Trollsberd/gauntlet in bake. Sized so HER BODY (head) matches Griffin's,
    // not the whole sprite incl. gauntlet; head width tuned vs Griffin, eyes just above the
    // hit point. Re-tuned after the IK rebake (sword raised, seated on the battery).
    drawSize: 257,
    drawOffsetX: -33,
    drawOffsetY: -59,
    // Was 0.13 / 1.45 — Lv4 cleave fan outpaced LRL readability while still piercing.
    // Autofire cadence ×2 delay (half shots/sec) vs prior 0.138.
    // Shot = 1945 II Ki-84 Hayate wide shot (blue-violet crystal shards fanning out).
    // 보조무기 = Hayate's Shusui options: one per power level, they fly to enemies,
    // latch on and keep firing (auto while shooting, no hold).
    fireRate: 0.1,
    shotSpeed: 900,
    // Boss DPS by shot shape (user): straight lines hit harder, spreads less.
    shotDamage: 1.71,
    rare: true,
    kit: { shot: '와이드 샷', charge: '슈스이 옵션', special: '백화제방' },
    chargeEnabled: false,
    subWeapon: 'syusui',
    shot: {
      pattern: 'hayate',
      color: '#c3b8ff',
      glow: '#6a5cff',
      style: 'hayateshot',
      r: 4,
    },
  },
  // Bombardier / Xenox railgun (Random 3%)
  emily: {
    // Hurt point = body centre of the idle sprite (alpha centroid), offset from (x, y).
    hitOffset: { x: -0.4, y: 4.8 },
    name: '에밀리',
    drawSize: 72,
    // Her growing basic laser is the entire hold identity; C remains separate.
    chargeEnabled: false,
    // Autofire cadence ×2 delay (half shots/sec) vs prior 0.11.
    fireRate: 0.22,
    shotSpeed: 1100,
    shotDamage: 1.2,
    rare: true,
    kit: { shot: '레일건 사격', charge: '', special: '버스터 캐논' },
    shot: {
      pattern: 'railgun',
      color: '#7ef0ff',
      glow: '#3aa0ff',
      style: 'railbeam',
      r: 3.8,
    },
  },
};

/**
 * Random slot: uniform among named select roster (Griffin / Sleipnir / Express 76).
 * Hidden kits stay cheat-only (not in this roll).
 * @param {() => number} [rng]
 */
/** Hidden (cheat) kits RANDOM can also roll: 2.5% each (user); the rest is uniform. */
export const RANDOM_HIDDEN_KEYS = ['labiata', 'lrl', 'constantia', 'peregrinus'];
const RANDOM_HIDDEN_CHANCE = 0.025;

export function resolveRandomCharacter(rng = Math.random) {
  const r = rng();
  const hidden = Math.floor(r / RANDOM_HIDDEN_CHANCE);
  if (hidden < RANDOM_HIDDEN_KEYS.length) return RANDOM_HIDDEN_KEYS[hidden];
  // Rescale the leftover roll onto the named roster.
  const rest = (r - RANDOM_HIDDEN_KEYS.length * RANDOM_HIDDEN_CHANCE) / (1 - RANDOM_HIDDEN_KEYS.length * RANDOM_HIDDEN_CHANCE);
  const i = Math.floor(rest * BASE_PLAYER_KEYS.length) % BASE_PLAYER_KEYS.length;
  return BASE_PLAYER_KEYS[i];
}

function loadImage(src) {
  return loadDecodedImage(src);
}

function releaseDecodedImage(img) {
  if (!img) return;
  if (typeof img.close === 'function') {
    try { img.close(); } catch { /* ImageBitmap */ }
  }
  try { if ('src' in img) img.src = ''; } catch { /* */ }
}

function estimateHeapBytes() {
  if (performance && typeof performance.memory?.usedJSHeapSize === 'number') {
    return performance.memory.usedJSHeapSize;
  }
  return 0;
}

/** Sum network transfer for asset URLs (Resource Timing). Falls back to encoded body. */
export function measureAssetTransferBytes() {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return 0;
  let sum = 0;
  for (const e of performance.getEntriesByType('resource')) {
    const n = e.name || '';
    if (!n.includes('/assets/')) continue;
    sum += e.transferSize || e.encodedBodySize || 0;
  }
  return sum;
}

export function wantsEagerLoad() {
  try {
    return new URLSearchParams(location.search).get('eager') === '1';
  } catch {
    return false;
  }
}

/**
 * Streaming asset bank: title → select roster → stage1 → prefetch later acts.
 * Never returns empty enemy/player sprites (fallback chain always filled).
 */
export class AssetBank {
  constructor() {
    this.images = {};
    this.anims = {};
    this.manifests = {};
    this.CHAR_META = CHAR_META;
    this.PLAYER_KEYS = PLAYER_KEYS;
    this.BASE_PLAYER_KEYS = BASE_PLAYER_KEYS;
    this.RARE_PLAYER_KEYS = RARE_PLAYER_KEYS;
    this.RANDOM_SLOT_KEY = RANDOM_SLOT_KEY;
    this.resolveRandomCharacter = resolveRandomCharacter;
    this.ENEMY_KEYS = ENEMY_KEYS;
    this.ENEMY_META = ENEMY_META;
    this.BG_KEYS = BG_KEYS;
    this.STAGE_BG_KEYS = STAGE_BG_KEYS;
    this.STAGE_ENEMY_KEYS = STAGE_ENEMY_KEYS;

    /** @type {Map<string, Promise<any>>} */
    this._inflight = new Map();
    this._enemyFallback = null;
    this._hirumeAnim = null;
    this._prefetchTimer = 0;
    this._prefetchIdle = 0;
    this.metrics = {
      bootMs: 0,
      bootBytesProxy: 0,
      heapBytes: 0,
      transferBytes: 0,
      titleReadyMs: 0,
      selectReadyMs: 0,
      stage1ReadyMs: 0,
      eagerMs: 0,
      mode: 'progressive',
      framesLoaded: 0,
      sheetsLoaded: 0,
      clipsLoaded: 0,
      unloadedClips: 0,
      phases: [],
    };
    /** @type {Set<number>} stages whose enemy roster is fully ensured */
    this._stageReady = new Set();
    /** @type {Map<string, Error>} keys that exhausted retries — never spawn with substitute art */
    this._failed = new Map();
    /** Last fatal load error surfaced to UI / asset-gate */
    this.lastError = null;
  }

  _phase(label, extra = {}) {
    this.metrics.phases.push({ label, t: performance.now(), ...extra });
  }

  /**
   * @param {(info: { loaded: number, total: number, ratio: number, label: string }) => void} [onProgress]
   */
  async boot(onProgress) {
    // Weapon FX sheets (~4MB) only matter in combat — decode in the background
    // so the title isn't gated on them; loadSortie awaits the same promise.
    this._nativeFx = loadNativeWeaponFx();
    this._nativeFx.catch(() => { /* surfaced again by loadSortie */ });
    const t0 = performance.now();
    const heap0 = estimateHeapBytes();
    const xfer0 = measureAssetTransferBytes();
    this._report = typeof onProgress === 'function' ? onProgress : null;
    this.metrics.mode = wantsEagerLoad() ? 'eager' : 'progressive';

    // Title is overlay-only — defer every painted BG until the act that needs it
    // (~7MB of stage plates used to ride the cold boot even for STAGE 1 city).
    this._total = 1;
    this._loaded = 1;
    this._emit(t('load.titleReady'));

    this.metrics.titleReadyMs = performance.now() - t0;
    this.metrics.bootBytesProxy = Math.max(0, estimateHeapBytes() - heap0);
    this.metrics.heapBytes = estimateHeapBytes();
    this.metrics.transferBytes = Math.max(0, measureAssetTransferBytes() - xfer0);
    this._phase('title', { ms: this.metrics.titleReadyMs });
    return this._bundle();
  }

  _emit(label = '') {
    if (!this._report) return;
    const total = Math.max(this._total, 1);
    this._report({
      loaded: this._loaded,
      total,
      ratio: Math.min(1, this._loaded / total),
      label,
    });
  }

  _bundle() {
    return {
      images: this.images,
      anims: this.anims,
      CHAR_META,
      PLAYER_KEYS,
      BASE_PLAYER_KEYS,
      RARE_PLAYER_KEYS,
      RANDOM_SLOT_KEY,
      resolveRandomCharacter,
      ENEMY_KEYS,
      ENEMY_META,
      BG_KEYS,
      STAGE_BG_KEYS,
      STAGE_ENEMY_KEYS,
      bank: this,
      metrics: this.metrics,
      ensurePlayer: (key) => this.ensurePlayer(key),
      ensurePlayers: (keys) => this.ensurePlayers(keys),
      ensureStage: (index) => this.ensureStage(index),
      isStageReady: (index) => this.isStageReady(index),
      hasClip: (key) => this.hasClip(key),
      prefetchFrom: (index) => this.prefetchFrom(index),
      unloadDistantStages: (current) => this.unloadDistantStages(current),
      getAnim: (key) => this.getAnim(key),
      snapshotMetrics: () => this.snapshotMetrics(),
      loadEagerAll: (charKey, onProgress) => this.loadEagerAll(charKey, onProgress),
      hasFailed: (key) => this.hasFailed(key),
      getLastError: () => this.lastError,
      clearLastError: () => { this.lastError = null; },
      clearFailed: (keys) => this.clearFailed(keys),
    };
  }

  hasClip(key) {
    return !!(key && this.anims[key] && !this._failed.has(key));
  }

  hasFailed(key) {
    return !!(key && this._failed.has(key));
  }

  /**
   * Drop failed-key marks so ensureStage / ensureEnemy can retry.
   * @param {string[]|null} [keys] specific keys, or all when omitted
   */
  clearFailed(keys = null) {
    if (!keys) {
      this._failed.clear();
    } else {
      for (const k of keys) {
        if (k) this._failed.delete(k);
      }
    }
    this.lastError = null;
  }

  isStageReady(index) {
    const i = Math.max(0, Math.min(STAGE_ENEMY_KEYS.length - 1, index | 0));
    if (this._stageReady.has(i)) return true;
    const keys = STAGE_ENEMY_KEYS[i] || [];
    if (keys.some((k) => this._failed.has(k))) return false;
    // BG plates soft-fail to color-grade fallback — never block the roster gate.
    const ready = keys.every((k) => !!this.anims[k]);
    if (ready) this._stageReady.add(i);
    return ready;
  }

  async ensureBg(key) {
    if (!key || this.images[key]) return this.images[key];
    if (this._inflight.has(`bg:${key}`)) return this._inflight.get(`bg:${key}`);
    const job = (async () => {
      const img = await withRetries(`bg:${key}`, () => loadImage(`assets/bg/${key}.png`));
      this.images[key] = img;
      this.metrics.framesLoaded += 1;
      this._loaded += 1;
      // Progress only: the loading screen keeps its generic line (no asset names).
      this._emit();
      return img;
    })();
    this._inflight.set(`bg:${key}`, job);
    try {
      return await job;
    } finally {
      this._inflight.delete(`bg:${key}`);
    }
  }

  async ensureStageBackgrounds(index) {
    const i = Math.max(0, Math.min(STAGE_BG_KEYS.length - 1, index | 0));
    const keys = STAGE_BG_KEYS[i] || [];
    this._total += keys.filter((k) => !this.images[k] && !this._inflight.has(`bg:${k}`)).length;
    await Promise.all(keys.map((k) => this.ensureBg(k)));
    return keys;
  }

  snapshotMetrics() {
    return {
      ...this.metrics,
      heapBytes: estimateHeapBytes(),
      transferBytes: measureAssetTransferBytes(),
      clipsResident: Object.keys(this.anims).length,
      mode: this.metrics.mode,
    };
  }

  getAnim(key) {
    if (this._failed.has(key)) return null;
    if (this.anims[key]) return this.anims[key];
    // Players may soft-fallback for UI only; monsters never use substitute art.
    if (PLAYER_KEYS.includes(key)) return this._hirumeAnim || null;
    return null;
  }

  async _loadClip(key, label) {
    if (this.anims[key]) return this.anims[key];
    if (this._failed.has(key)) throw this._failed.get(key);
    if (this._inflight.has(key)) return this._inflight.get(key);

    const job = (async () => {
      const anim = await withRetries(key, async () => {
        let data = this.manifests[key];
        if (!data) {
          data = await fetchAnimJson(`assets/sd_baked/${key}`);
          this.manifests[key] = data;
        }
        const baseDir = `assets/sd_baked/${key}`;
        let sheetData = null;
        if (typeof data?.sheet === 'string' && data.sheet) {
          try {
            sheetData = await fetchSheetJson(baseDir, data.sheet);
          } catch {
            sheetData = null;
          }
        }
        const frameBudget = countAnimFrames(sheetData || data);
        this._total += frameBudget;
        return loadNativeAnim(baseDir, {
          data,
          preferSheet: true,
          sheetData,
          sheetFile: typeof data?.sheet === 'string' ? data.sheet : undefined,
          onFrame: () => {
            this._loaded += 1;
            this.metrics.framesLoaded += 1;
            this._emit();
          },
        });
      });
      // Baked head track (face overlay) / content box ride along with the clips.
      anim.headTrack = this.manifests[key]?.headTrack || null;
      this.anims[key] = anim;
      this._failed.delete(key);
      if (PLAYER_KEYS.includes(key)) this.images[`player_${key}`] = anim.preview;
      else this.images[`enemy_${key}`] = anim.preview;
      this.metrics.clipsLoaded += 1;
      if (anim.fromSheet) this.metrics.sheetsLoaded = (this.metrics.sheetsLoaded || 0) + (anim.sheets?.length || 0);
      if (key === 'hirume') this._hirumeAnim = anim;
      if (!this._enemyFallback && ENEMY_KEYS.includes(key)) {
        this._enemyFallback = anim;
        this.images.enemy_preview = anim.preview;
      }
      return anim;
    })();

    this._inflight.set(key, job);
    try {
      return await job;
    } catch (err) {
      this._failed.set(key, err instanceof Error ? err : new Error(String(err)));
      this.lastError = {
        key,
        message: err?.message || String(err),
        at: performance.now(),
      };
      throw err;
    } finally {
      this._inflight.delete(key);
    }
  }

  async ensurePlayer(key) {
    if (!key || key === RANDOM_SLOT_KEY) return null;
    // Alternate-form clips (Peregrinus human form) load alongside the main kit.
    const form = CHAR_META[key]?.humanForm;
    const birdBomb = CHAR_META[key]?.birdBomb?.clips;
    for (const alt of [form?.clips, form?.changeClips, form?.revertClips, form?.bomb?.clips, birdBomb]) {
      if (!alt || this.anims[alt]) continue;
      try { await this._loadClip(alt, alt); } catch (err) { console.warn(`[assets] ${alt} missing`, err); }
    }
    if (this.anims[key]) return this.anims[key];
    try {
      return await this._loadClip(key, CHAR_META[key]?.name || key);
    } catch (err) {
      console.warn(`[assets] missing bake for ${key}, falling back to hirume`, err);
      if (!this._hirumeAnim) {
        try {
          this._hirumeAnim = await this._loadClip('hirume', 'Hirume');
        } catch (e2) {
          console.warn('[assets] hirume fallback failed', e2);
        }
      }
      // Soft UI fallback only — do not register foreign art under the failed key.
      if (this._hirumeAnim) return this._hirumeAnim;
      throw err;
    }
  }

  async ensurePlayers(keys) {
    const list = [...new Set(keys.filter(Boolean))];
    await Promise.all(list.map((k) => this.ensurePlayer(k)));
  }

  async ensureEnemy(key) {
    if (this.anims[key]) return this.anims[key];
    if (this._failed.has(key)) throw this._failed.get(key);
    // Hard fail — never bind another monster's art to this key.
    return this._loadClip(key, ENEMY_META[key]?.name || key);
  }

  async ensureStage(index) {
    const i = Math.max(0, Math.min(STAGE_ENEMY_KEYS.length - 1, index | 0));
    const keys = STAGE_ENEMY_KEYS[i] || STAGE_ENEMY_KEYS[0];
    // Painted plate for this act first — cheap vs clips, but was formerly boot-eager.
    try {
      await this.ensureStageBackgrounds(i);
    } catch (err) {
      console.warn(`[assets] stage ${i} background failed`, err);
    }
    // Always keep a cheap grunt resident when available (for VFX / misc), but each
    // roster key must load as itself — failures abort the stage gate.
    const need = [...new Set(['programmob_an', ...keys])];
    const errors = [];
    await Promise.all(
      need.map(async (k) => {
        try {
          await this.ensureEnemy(k);
        } catch (err) {
          errors.push({ key: k, message: err?.message || String(err) });
        }
      }),
    );
    if (!this._enemyFallback) {
      for (const k of ENEMY_KEYS) {
        if (this.anims[k]) {
          this._enemyFallback = this.anims[k];
          this.images.enemy_preview = this.anims[k].preview;
          break;
        }
      }
    }
    const ready = keys.every((k) => !!this.anims[k] && !this._failed.has(k));
    if (ready) this._stageReady.add(i);
    else this._stageReady.delete(i);
    this._phase('ensureStage', { index: i, ready, errors });
    if (errors.length) {
      const detail = errors.map((e) => e.key).join(', ');
      const err = new Error(`ASSET LOAD FAILED: ${detail}`);
      this.lastError = { key: errors[0].key, message: err.message, keys: errors, at: performance.now() };
      throw err;
    }
    return keys;
  }

  /** Background load later acts (and rares) without blocking play.
   *  Mobile: wait for idle / after stage clear, concurrency 1, pause when tab hidden. */
  prefetchFrom(index = 0, opts = {}) {
    const start = Math.max(0, index | 0);
    // Only warm the near horizon — full remaining-campaign prefetch pulled abyss
    // plates (~2MB) while the player was still in STAGE 1.
    // Low-end phones: one act ahead only (each act's leaders are ~100MB of decoded sheets).
    const horizon = opts.horizon != null ? Math.max(1, opts.horizon | 0) : (prefersLowEndGfx() ? 1 : 2);
    const end = Math.min(STAGE_ENEMY_KEYS.length, start + horizon);
    const queue = [];
    /** @type {Array<{ kind: 'bg'|'clip', key: string }>} */
    const jobs = [];
    for (let i = start; i < end; i++) {
      for (const k of STAGE_BG_KEYS[i] || []) {
        if (!this.images[k] && !this._inflight.has(`bg:${k}`)) jobs.push({ kind: 'bg', key: k });
      }
      for (const k of STAGE_ENEMY_KEYS[i]) queue.push(k);
    }
    // Rares are large Random-only clips — defer until act 3+ so sortie bandwidth
    // stays on the next enemy roster (override with includeRares: true).
    const includeRares = opts.includeRares != null ? !!opts.includeRares : start >= 2;
    if (includeRares) {
      for (const k of RARE_PLAYER_KEYS) queue.push(k);
    }
    for (const k of [...new Set(queue)]) {
      if (!this.anims[k] && !this._inflight.has(k)) jobs.push({ kind: 'clip', key: k });
    }
    let cursor = 0;
    const mobileish = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0);
    const waitIdle = opts.waitIdle != null ? !!opts.waitIdle : mobileish;
    const gapMs = mobileish ? 90 : 24;
    const pump = () => {
      if (cursor >= jobs.length) return;
      if (typeof document !== 'undefined' && document.hidden) {
        this._prefetchTimer = setTimeout(pump, 480);
        return;
      }
      const item = jobs[cursor++];
      const job = item.kind === 'bg'
        ? this.ensureBg(item.key)
        : (PLAYER_KEYS.includes(item.key) ? this.ensurePlayer(item.key) : this.ensureEnemy(item.key));
      Promise.resolve(job).finally(() => {
        this._prefetchTimer = setTimeout(pump, gapMs);
      });
    };
    const kick = () => {
      clearTimeout(this._prefetchTimer);
      this._prefetchTimer = setTimeout(pump, waitIdle ? 80 : 30);
    };
    if (this._prefetchIdle && typeof cancelIdleCallback === 'function') {
      try { cancelIdleCallback(this._prefetchIdle); } catch { /* */ }
      this._prefetchIdle = 0;
    }
    clearTimeout(this._prefetchTimer);
    if (waitIdle && typeof requestIdleCallback === 'function') {
      this._prefetchIdle = requestIdleCallback(() => kick(), { timeout: 2200 });
    } else if (waitIdle) {
      this._prefetchTimer = setTimeout(kick, 600);
    } else {
      kick();
    }
  }

  /**
   * Drop decoded frames for acts far behind the playhead.
   * Keeps current + next + shared finale remix skins.
   */
  /** Low-end: drop the select-screen roster sheets the sortie doesn't fly (reloaded on return). */
  releaseOtherPilots(charKey) {
    const form = CHAR_META[charKey]?.humanForm;
    const keep = new Set([charKey, 'hirume']);
    for (const k of [form?.clips, form?.changeClips, form?.revertClips, form?.bomb?.clips]) if (k) keep.add(k);
    let dropped = 0;
    for (const key of PLAYER_KEYS) {
      if (keep.has(key) || !this.anims[key] || this.anims[key] === this._hirumeAnim) continue;
      const anim = this.anims[key];
      for (const img of anim.sheets || []) releaseDecodedImage(img);
      delete this.anims[key];
      delete this.images[`player_${key}`];
      dropped += 1;
    }
    if (dropped) this._phase('releasePilots', { dropped, keep: [...keep] });
    return dropped;
  }

  unloadDistantStages(currentIndex) {
    const cur = Math.max(0, currentIndex | 0);
    const keep = new Set();
    const keepBg = new Set();
    for (let i = Math.max(0, cur); i < Math.min(STAGE_ENEMY_KEYS.length, cur + 2); i++) {
      for (const k of STAGE_ENEMY_KEYS[i]) keep.add(k);
      for (const k of STAGE_BG_KEYS[i] || []) keepBg.add(k);
    }
    // Finale remix can pull mid-run skins — never unload once S5 is in the keep window.
    if (cur >= 3) {
      for (const k of STAGE_ENEMY_KEYS[4]) keep.add(k);
      for (const k of STAGE_BG_KEYS[4] || []) keepBg.add(k);
    }
    keep.add('programmob_an');
    let dropped = 0;
    let droppedBg = 0;
    for (const key of ENEMY_KEYS) {
      if (keep.has(key)) continue;
      if (!this.anims[key]) continue;
      // Don't drop the live fallback identity.
      if (this.anims[key] === this._enemyFallback) continue;
      const anim = this.anims[key];
      if (anim.fromSheet && anim.sheets?.length) {
        for (const img of anim.sheets) releaseDecodedImage(img);
      } else {
        for (const list of [anim.idle, anim.move, anim.die, anim.attack, anim.skill2]) {
          if (!list) continue;
          for (const img of list) {
            if (img?.sheet) continue;
            releaseDecodedImage(img);
          }
        }
      }
      delete this.anims[key];
      delete this.images[`enemy_${key}`];
      dropped += 1;
    }
    for (const key of BG_KEYS) {
      if (keepBg.has(key)) continue;
      if (!this.images[key]) continue;
      releaseDecodedImage(this.images[key]);
      delete this.images[key];
      droppedBg += 1;
    }
    this.metrics.unloadedClips += dropped;
    if (dropped || droppedBg) {
      this._phase('unload', { dropped, droppedBg, keep: [...keep], keepBg: [...keepBg], current: cur });
    }
    return dropped + droppedBg;
  }

  /**
   * Select screen: base roster (+ optional rares for preview warm).
   * @param {(info) => void} [onProgress]
   */
  async loadSelect(onProgress) {
    if (onProgress) this._report = onProgress;
    const t0 = performance.now();
    await this.ensurePlayers(BASE_PLAYER_KEYS);
    // Warm hirume fallback even if a base bake failed.
    if (!this._hirumeAnim && this.manifests.hirume) {
      await this.ensurePlayer('hirume');
    }
    this.metrics.selectReadyMs = performance.now() - t0;
    this._phase('select', { ms: this.metrics.selectReadyMs });
    this._emit(t('load.selectReady'));
    return this._bundle();
  }

  /**
   * Sortie gate: selected pilot + stage 1 enemies, then kick prefetch.
   * `?eager=1` loads the full roster before the field opens (A/B vs progressive).
   * @param {string} charKey
   * @param {(info) => void} [onProgress]
   */
  async loadSortie(charKey, onProgress) {
    // Shared FX (boot) + this pilot's kit textures; other kits load on first use.
    await Promise.all([this._nativeFx || loadNativeWeaponFx(), loadNativeWeaponFx(charKey)]);
    if (charKey === 'constantia') import('./shot-fx.js').then((m) => m.preloadBori?.()).catch(() => {});
    if (wantsEagerLoad()) {
      return this.loadEagerAll(charKey, onProgress);
    }
    if (onProgress) this._report = onProgress;
    const t0 = performance.now();
    const heap0 = estimateHeapBytes();
    const xfer0 = measureAssetTransferBytes();
    this.metrics.mode = 'progressive';
    await this.ensurePlayer(charKey || 'hirume');
    await this.ensureStage(0);
    // Warm the next act's plates in the background; rares wait until act 3+.
    // (ensureStage already kicked enemy prefetch via Game; keep sortie lean.)
    this.metrics.stage1ReadyMs = performance.now() - t0;
    this.metrics.bootMs =
      (this.metrics.titleReadyMs || 0) +
      (this.metrics.selectReadyMs || 0) +
      (this.metrics.stage1ReadyMs || 0);
    this.metrics.heapBytes = estimateHeapBytes();
    this.metrics.bootBytesProxy = Math.max(0, this.metrics.heapBytes - heap0);
    this.metrics.transferBytes = measureAssetTransferBytes();
    this._phase('stage1', {
      ms: this.metrics.stage1ReadyMs,
      charKey,
      heapDelta: Math.max(0, this.metrics.heapBytes - heap0),
      transfer: Math.max(0, this.metrics.transferBytes - xfer0),
    });
    this._emit(t('load.sortieReady'));
    if (prefersLowEndGfx()) this.releaseOtherPilots(charKey);
    this.prefetchFrom(1, { includeRares: false });
    return this._bundle();
  }

  /**
   * Full-eager A/B path: every player + every enemy clip before sortie.
   * Enabled via `?eager=1` (or direct call). Progressive path stays the default.
   */
  async loadEagerAll(charKey, onProgress) {
    if (onProgress) this._report = onProgress;
    const t0 = performance.now();
    const heap0 = estimateHeapBytes();
    const xfer0 = measureAssetTransferBytes();
    this.metrics.mode = 'eager';
    this._emit(t('load.eager'));
    await Promise.all(BG_KEYS.map((k) => this.ensureBg(k)));
    await this.ensurePlayers(PLAYER_KEYS);
    await Promise.all(ENEMY_KEYS.map((k) => this.ensureEnemy(k)));
    for (let i = 0; i < STAGE_ENEMY_KEYS.length; i++) this._stageReady.add(i);
    this.metrics.eagerMs = performance.now() - t0;
    this.metrics.stage1ReadyMs = this.metrics.eagerMs;
    this.metrics.bootMs =
      (this.metrics.titleReadyMs || 0) +
      (this.metrics.selectReadyMs || 0) +
      (this.metrics.eagerMs || 0);
    this.metrics.heapBytes = estimateHeapBytes();
    this.metrics.bootBytesProxy = Math.max(0, this.metrics.heapBytes - heap0);
    this.metrics.transferBytes = measureAssetTransferBytes();
    this._phase('eager', {
      ms: this.metrics.eagerMs,
      charKey,
      heapDelta: Math.max(0, this.metrics.heapBytes - heap0),
      transfer: Math.max(0, this.metrics.transferBytes - xfer0),
    });
    this._emit(t('load.sortieReadyEager'));
    return this._bundle();
  }
}

/**
 * Back-compat entry: title-ready bank (BG + manifests). Select/sortie load more.
 * @param {(info: { loaded: number, total: number, ratio: number, label: string }) => void} [onProgress]
 */
export async function loadAssets(onProgress) {
  const bank = new AssetBank();
  return bank.boot(onProgress);
}
