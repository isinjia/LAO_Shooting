/**
 * 램파리온 (Rampalion) — hidden pilot: CT66 Rampart in the "램파리온 커스텀 팩" skin
 * (Unity Skin_AGS_Rampart_1 -> Model_AGS_Rampart_NS1, baked as assets/sd_baked/rampalion).
 *
 * Rules (user):
 *  - Only one life.
 *  - A hit does not cost the life: shot power drops one level instead, and the most recently
 *    fused part is knocked off. A hit at power Lv1 destroys it (game over).
 *  - The low-power supply convoy only comes on stage 1 (Game._maybeSpawnPowerRecovery).
 *  - It flies: the move clip is the booster flight (Unity move2), not the ground walk.
 *  - Part-by-part fusion over the 5 power stages: every level-up a random AGS robot flies in,
 *    docks and swaps ONE random free body location (user): chest (replaces the lion head),
 *    arm, back (replaces the wing blades), legs (replaces the shins and feet). Replaced
 *    locations use body variants baked without Rampalion's own part (same camera). Parts ride
 *    Rampalion's bones (bake "bone_tracks" -> anim.json boneTrack): point anchors follow a bone,
 *    leg anchors follow the knee -> ankle segment so they fold with the flight pose.
 *  - The base weapon never changes: each grafted part ADDS its own bullets, fired from where
 *    the part sits.
 *
 * Unlock: title "치트활성화온", then type 램파리온 (or rampalion) on the select screen ->
 * it comes out of RANDOM (rare-fanfare.js SELECT_TYPED_CODES).
 */

export const RAMPALION_KEY = 'rampalion';

/** Robots that can dock (dock = whole-robot bake that flies in). */
export const RAMPALION_ROBOTS = {
  roc: { name: 'RF87 로크', dock: 'dock_roc', form: '썬더 램파리온', glow: '#ffe14a', aura: 'rgba(255,230,90,' },
  shade: { name: 'S12 쉐이드', dock: 'dock_shade', form: '쉐도우 램파리온', glow: '#3fe0b0', aura: 'rgba(70,220,170,' },
  aeda: { name: '에이다 Type-G', dock: 'dock_aeda', form: '갤럭시 램파리온', glow: '#7fd8ff', aura: 'rgba(130,210,255,' },
  spartanb: { name: 'S25B 스파르탄 부머', dock: 'dock_spartanb', form: '파이어 램파리온', glow: '#ff4a1a', aura: 'rgba(255,100,40,' },
  alfred: { name: 'Mr. 알프레드', dock: 'dock_alfred', form: '젠틀 램파리온', glow: '#ffcf5a', aura: 'rgba(255,200,90,' },
  tyrant: { name: '타이런트', dock: 'dock_tyrant', form: '다이노 램파리온', glow: '#ff5a2a', aura: 'rgba(255,110,60,' },
  goltarion: { name: '골타리온 XIII세', dock: 'dock_goltarion', form: '골타리온 14세', glow: '#c27bff', aura: 'rgba(190,120,255,' },
  hestia: { name: '헤스티아', dock: 'dock_hestia', form: '인페르노 램파리온', glow: '#ff6a2a', aura: 'rgba(255,110,50,' },
};

/**
 * Body locations, one per power stage (Lv2..Lv5), filled in a random order (user). An option is one
 * robot's part set; it may need several images (both legs), each a mount:
 *  - point mount: part (fpart_* / fleg_* ... bake), bone (boneTrack slot), x / y = graft offset
 *    from the bone in drawSize units (rest pose, facing right), rot (deg), scale (drawSize
 *    units), sy (vertical stretch), under (behind the body), filter, sway (deg in the move cycle).
 *  - segment mount: seg = [fromBone, toBone] (knee -> ankle); the part rides the segment at
 *    fraction t, turns with it, offset x / y along / across it.
 *  - gun: which mount fires (mount index), muzzle offset from it, and the bullet kind.
 */
export const RAMPALION_SLOTS = [
  {
    id: 'chest', label: '가슴', replaces: 'lion',
    options: [
      // Tyrant dino head takes the lion head's place: a beast maw on the chest.
      // still: no chomp / bob of its own clip; follow: only 35% of the chest bone's swing (user:
      // "moves too much"). rot 0 = 20 deg lower on the right than before (user).
      { robot: 'tyrant', partName: '공룡 머리',
      mounts: [{ part: 'fc_tyranthead7', bone: 'chest', x: 0.027, y: -0.025, rot: 0, scale: 0.34, under: false, still: true, follow: 0.35, z: 1,
        filter: 'brightness(1.32) drop-shadow(0 0 1.2px rgba(20,10,10,0.95))' }],
        // Rampalion's head and front arm (screen-left) stay in front of the dino head (user):
        // they are drawn again over it from a head + arm-only bake on the body camera.
        frontOverlay: 'rampalion_ovl_F', frontOverlayNoArm: 'rampalion_ovl_Fup',
        // Effect (user): a shield. A hit only breaks the shield (no level / part lost);
        // it comes back SHIELD_REGEN seconds later.
        shield: true,
        gun: { mount: 0, x: 0.1, y: 0.02, kind: 'dinoRoar' } },
      // Orb 15% larger (user); it now fires the homing star orbs the back halo ring used to.
      // z 1: over the leg parts (user: the chest sat under the screen-right leg).
      { robot: 'aeda', partName: '에너지 코어', mounts: [{ part: 'fc_aedaorb', bone: 'chest', x: 0.005, y: -0.015, rot: 0, scale: 0.1725, under: false, z: 1, filter: 'brightness(1.9) saturate(1.3)', glow: 'rgba(130,215,255,' }],
        gun: { mount: 0, x: 0.06, y: 0, kind: 'haloOrbs' } },
      // (Roc breastplate dropped: the chest is the Tyrant head or the Aeda orb only - user.)
    ],
  },
  {
    // Both forearms + hands are swapped (rampalion_no...arm variants hide Rampalion's own).
    // Anchored on the visible forearm sprites, elbow -> fist (the arm bones drift in flight):
    // front arm armBd1 -> armBd5 (drawn over the body), rear arm armFd1 -> handFs (behind).
    id: 'arm', label: '팔', replaces: 'arm',
    options: [
      { robot: 'goltarion', partName: '양팔', mounts: [
        // Goltarion's sword in the left (screen-right) hand (user), blade up and forward, drawn
        // over the hand (user); the hand itself sits behind the body (user).
        { part: 'fw_golt_sword', seg: ['armBd1', 'armBd5'], t: 1.0, x: 0.06, y: -0.1, rot: -135, scale: 0.62, under: false, still: true },
        { part: 'fa_golt_L', seg: ['armBd1', 'armBd5'], t: 0.6, x: 0, y: -0.027, rot: 0, scale: 0.28, under: true, still: true },
        // Screen-left arm: always over the body / blade decorations (user; was behind at idle).
        // Sits on the elbow at idle too (x 0.041 -> 0.085; flight keeps the same total offset),
        // and holds its first frame so it does not wave on its own (user: awkward motion).
        { part: 'fa_golt_R', seg: ['armFd1', 'handFs'], t: 0.6, x: 0.085, y: -0.04, rot: 0, scale: 0.5, under: false, still: true, z: 3, flyDx: 0.011, flyDy: 0.015, filter: 'brightness(0.88)' }],
        gun: { mount: 0, x: 0, y: 0, kind: 'swordWaves' } },
      // Hestia's hands (user).
      // Both hands 40% smaller (user: too big; were 0.36 / 0.32). Each art is forearm + hand:
      // its elbow cap (fa_hest_L bake px 180,245 / fa_hest_R 542,270) is pinned on the elbow
      // (x / y = minus that point rotated by rot, times scale), so a smaller hand stays on the
      // arm instead of floating off it (user). t -0.3: the cap tucks up into the elbow block
      // (the bone sits at its lower edge, which left a gap).
      { robot: 'hestia', partName: '양손', mounts: [
        // (L / R swapped - user: the clawed hand reads as the left one on Rampalion.)
        // Screen-right hand: behind the body, legs included (user). The screen-left one below is
        // drawn over the body and its legs (z 1).
        { part: 'fa_hest_R', seg: ['armBd1', 'armBd5'], t: -0.3, x: 0.044, y: 0.0778, rot: -82, scale: 0.216, under: true, still: true },
        // Along the forearm (bone ~63 deg down-forward; the art's own axis ~22 deg).
        // Standing: lifted a bit more into the elbow block; the flight pose (user: fits best) keeps
        // the old spot via flyDy.
        { part: 'fa_hest_L', seg: ['armFd1', 'handFs'], t: -0.3, x: 0.0242, y: 0.0579, rot: 40, scale: 0.192, under: false, still: true, z: 1, flyDy: 0.035 }],
        // One fireball from each hand (mount 0 / 1), each at its own target.
        gun: { mounts: [0, 1], x: 0.03, y: 0.03, kind: 'hestiaFireball' },
        // Rampalion's own upper arm (elbow block) + head drawn back over the screen-left hand's
        // cap (z 1 goes under it - user: the upper arm sits above the forearm).
        frontOverlay: 'rampalion_ovl_Fup', frontOverlayNoArm: 'rampalion_ovl_Fup' },
    ],
  },
  {
    // Rampalion's own wing blades come off (rampalion_nowing); the new back unit sits on
    // the wing roots / upper back behind the body.
    id: 'back', label: '등', replaces: 'wing',
    options: [
      { robot: 'roc', partName: '날개', mounts: [{ part: 'fpart_thunder', bone: 'wingB', x: -0.126, y: -0.03, rot: 13, flyRot: 5, scale: 0.658, under: true, z: 2,
        // The left wing of the pair hangs lower, tilted 10 deg left, and is drawn whole in front of the
        // body (wrapping the rear shoulder); the right wing stays behind (bake px outline of the left wing).
        split: { dy: 0.14, rot: -10, front: true, poly: [[0, 0], [480, 0], [480, 215], [462, 252], [405, 296], [385, 322], [342, 360], [300, 768], [0, 768]] },
        // Booster flames out of the left wing's two tail nozzles while moving (bake px + exhaust dir).
        boosters: { dir: [-300, 168], at: [[150, 381], [163, 454]] } }],
        // The wing boosters also make Rampalion faster.
        speedMul: 1.2,
        // Laser beams forward from the top feather tip of each wing (bake px, on which split piece).
        gun: { mount: 0, x: 0.12, y: -0.12, kind: 'wingLaser', muzzles: [[450, 214, 'in'], [572, 244, 'out']] } },
      // One pod at 2x (user: the second, smaller pod read as a duplicate - removed).
      { robot: 'spartanb', partName: '미사일 포드', mounts: [{ part: 'fpart_fire', bone: 'shoulderF', x: -0.065, y: -0.178, rot: 0, scale: 0.49, under: true }],
        gun: { mount: 0, x: 0.08, y: -0.03, kind: 'podMissiles' } },
      // (Aeda halo ring removed from the back slot - its star orbs moved to the Aeda chest orb.)
    ],
  },
  {
    // The shins and feet come off (rampalion_noleg); new lower legs ride knee -> ankle.
    // F = the far (rear) leg, B = the near (front) leg; both drawn over the body so the rear
    // shin isn't washed out by the booster jet baked into the flight frames.
    id: 'leg', label: '다리', replaces: 'leg',
    options: [
      { robot: 'shade', partName: '다리', mounts: [
        { part: 'fleg_shade_F', seg: ['kneeF', 'footF'], t: 0.55, x: 0, y: 0, rot: 0, scale: 0.255, under: false },
        { part: 'fleg_shade_B', seg: ['kneeB', 'footB'], t: 0.55, x: 0, y: 0, rot: 0, scale: 0.255, under: false }],
        gun: { mount: 1, x: 0.04, y: 0.04, kind: 'shadowNeedles' },
        // Z (user): a short shadow dash with i-frames (rampLegSkill).
        legSkill: 'dash' },
      { robot: 'alfred', partName: '다리', mounts: [
        { part: 'fleg_alfred_F', seg: ['kneeF', 'footF'], t: 0.55, x: 0, y: 0, rot: -24, scale: 0.235, under: false, filter: 'brightness(0.92) contrast(0.88)' },
        { part: 'fleg_alfred_B', seg: ['kneeB', 'footB'], t: 0.55, x: 0, y: 0, rot: -5, scale: 0.235, under: false, filter: 'brightness(0.92) contrast(0.88)' }],
        gun: { mount: 1, x: 0.04, y: 0.04, kind: 'gentleDrones' },
        // Z (user): a gentleman's barrier that eats enemy shots for a while (rampLegSkill).
        legSkill: 'barrier' },
    ],
  },
];

/**
 * Body variants with Rampalion's own parts removed (same camera as the base bake), one per
 * combination of replaced locations: rampalion_no + wing / lion / leg + (arm).
 */
const REPLACEABLE = ['wing', 'lion', 'leg'];
function bodyKey(off) {
  const name = REPLACEABLE.filter((k) => off.has(k)).join('') + (off.has('arm') ? 'arm' : '');
  return name ? `rampalion_no${name}` : null;
}
export const RAMPALION_BODY_KEYS = (() => {
  const out = {};
  for (let mask = 1; mask < 16; mask++) {
    const off = new Set([...REPLACEABLE, 'arm'].filter((_, i) => mask & (1 << i)));
    out[[...off].join('+')] = bodyKey(off);
  }
  return out;
})();
/**
 * Body variants actually drawn: plain Rampalion never has its own wings and Hyper fuses
 * nothing, so only the wing-less ones (user: restarting with the kit lagged - the unused
 * winged variants were ~0.5 GB decoded). Missing keys fall back to the base body.
 */
const RAMPALION_LIVE_BODIES = Object.values(RAMPALION_BODY_KEYS).filter((k) => k.startsWith('rampalion_nowing'));

/** Every extra sd_baked key the kit loads (assets.ensurePlayer via CHAR_META.fusePartners). */
/** Parts that hold their first frame (no idle animation of their own). */
const STILL_PARTS = new Set(RAMPALION_SLOTS.flatMap((s) => s.options.flatMap((o) => o.mounts.filter((m) => m.still).map((m) => m.part))));

export const RAMPALION_ASSET_KEYS = [
  ...new Set([
    ...RAMPALION_LIVE_BODIES,
    ...RAMPALION_SLOTS.flatMap((s) => s.options.flatMap((o) => o.mounts.map((m) => m.part))),
    ...Object.values(RAMPALION_ROBOTS).map((r) => r.dock),
    ...RAMPALION_SLOTS.flatMap((s) => s.options.flatMap((o) => [o.frontOverlay, o.frontOverlayNoArm]).filter(Boolean)),
    'fx_ramp_lion', // the bomb's giant lion (rampalion-skill.js)
    'fx_ramp_wings', // its own wing blades flying in for Hyper Rampalion
    'fx_ramp_dashpose', // Hell and Heaven charge pose (skill_1 lance kept on the wrist)
  ]),
];

const FUSE_FLASH = 1.2;
const EJECT_TIME = 1.0;
const DOCK_FLY = 0.5; // robot flies in (user: 50% faster than 0.75)
const DOCK_MERGE = 0.175; // robot collapses onto its graft point (user: twice as fast)

/**
 * Every part fires its robot's OWN original shot (user: the bullets must follow each part's
 * original character), rebuilt from that robot's skill / Bullet_Effect textures
 * (tools/import-rampalion-part-fx.py -> ramp-pf-*): style 'ramppart' + pfx = the projectile
 * sprite (shot-fx.js drawRampPart), hitStyle = the robot's own hit burst (hit-fx.js),
 * partGlow = a halo in its colour under it (bullet.js, low-end too: they must read next to the
 * base gun). The muzzle flash per gun is PART_FLASH (fireRampalionParts -> game.js).
 * Volleys are big (user: a fully fused Lv5 must look lavish) - damage is split over the shots.
 * pick(i) = the i-th target of the volley: with 2+ enemies on screen every shot / muzzle goes
 * for a different one (user).
 */
const PART_SHOT = { friendly: true, grazeable: false, style: 'ramppart', partGlow: true };
/** Muzzle flash per part gun: original sheet, size (px), duration (s), push ahead of the muzzle. */
const PART_FLASH = {
  swordWaves: { key: 'ramp-pf-golt-ring', size: 56, dur: 0.2 },
  dinoRoar: { key: 'ramp-pf-tyrant-mouth', size: 84, dur: 0.22, ahead: 0.35 },
  hestiaFireball: { key: 'ramp-pf-hest-muzzle', size: 50, dur: 0.22 },
  podMissiles: { key: 'ramp-pf-sb-muzzle', size: 56, dur: 0.22, ahead: 0.25 },
  haloOrbs: { key: 'ramp-pf-aeda-orb', size: 44, dur: 0.14 },
  shadowNeedles: { key: 'ramp-pf-shade-muzzle', size: 48, dur: 0.14, ahead: 0.3 },
  gentleDrones: { key: 'ramp-pf-alfred-dot', size: 40, dur: 0.16 },
};

/**
 * Bullets each part adds (on top of the unchanged base shot). cd = seconds between volleys;
 * damage is a fraction of the kit's shotDamage.
 * Balance (tools/eval-rampalion-balance.mjs): every option adds ~the same single-target DPS
 * (~10 at PART_LV_MUL 1); the piercing / sweeping ones (Goltarion crescents, Roc beams) ~0.8
 * of it, as they pay off on packs instead.
 */
const PART_WEAPONS = {
  // Goltarion arms (user): violet crescent sword waves in Goltarion's colour, five fanned
  // forward off the held sword, piercing; violet ring flash and hit.
  swordWaves: { cd: 0.9, fire(p, b, mx, my, dmg) {
    for (const vy of [-200, -100, 0, 100, 200]) b.spawn({ ...PART_SHOT, partGlow: false, x: mx, y: my, vx: 640, vy, r: 13, pierce: true,
      damage: dmg * 0.78, lifetime: 1.3, color: '#ecdcff', glow: '#a855f7', hitStyle: 'ramp-golt',
      pfx: { crescent: '#a855f7', w: 34, h: 64, ax: 0.6 } });
  } },
  // Tyrant head: its fire breath - five rolling flames in a cone off the maw (Tyrant_skill2
  // fire sheet), the Fortress flame flash on the mouth, its claw-spark bite on hit.
  dinoRoar: { cd: 0.85, fire(p, b, mx, my, dmg) {
    for (const vy of [-180, -90, 0, 90, 180]) b.spawn({ ...PART_SHOT, x: mx, y: my, vx: 760, vy, r: 9,
      damage: dmg * 0.97, lifetime: 0.9, color: '#ffd28a', glow: '#ff6a1a', hitStyle: 'ramp-tyrant',
      pfx: { tex: 'ramp-pf-tyrant-flame', w: 50, h: 50, sheet: [2, 128, 4, 14] } });
  } },
  // Hestia hands: her skill2 beam in short homing bolts (Hirume_beam body), a fan of three from
  // each hand, bursting on impact; her flame sheet at the hand, her orange flash on hit.
  hestiaFireball: { cd: 1.1, fire(p, b, mx, my, dmg, pick) {
    [-150, 0, 150].forEach((vy, i) => b.spawn({ ...PART_SHOT, x: mx, y: my, vx: 420, vy, accel: 900, maxSpeed: 760,
      homing: 4, homingTarget: pick(i), r: 10, damage: dmg * 1.21, lifetime: 2.4, blastRadius: 60, blastFx: true,
      color: '#ffb36a', glow: '#ff4a10', hitStyle: 'ramp-hest',
      pfx: { tex: 'ramp-pf-hest-beam', w: 74, h: 18, ax: 0.8, tint: 'rgba(255,90,20,0.55)' } }));
  } },
  // Roc wings: the thunder bird's lightning (user) - a beam from each wing tip shot at its own
  // target, then its far end sweeps up or down for a second; its lightning strands crackle
  // along it, its electric orb on the tip (player.js sub-beam, damage per 0.05 s tick x
  // shotDamage while it crosses an enemy); orange spark burst on hit.
  wingLaser: { cd: 1.6, beam: { dur: 1.0, half: 6.5, dmg: 0.23, hitStyle: 'ramp-roc',
    sweep: 150, bolt: 'ramp-pf-roc-bolt', orb: 'ramp-pf-roc-orb',
    pal: ['#ffb51f', '#ffd84a', '#fffbe0', '255,226,140', '255,170,30'] } },
  // Spartan Boomer missile pod (user): a salvo of 8 of its own rockets (Calista_skill2_bullet)
  // with smoke trails, fired one after another at the targets in turn, then a reload (cd
  // counts from the volley); its flame flash at the pod, its fire explosion on hit.
  podMissiles: { cd: 2.4, fire(p, b, mx, my, dmg, pick) {
    for (let i = 0; i < 8; i++) {
      const up = i % 2 === 0;
      b.spawn({ ...PART_SHOT, x: mx, y: my + (up ? -5 : 5),
        vx: 240, vy: (up ? -1 : 1) * (80 + i * 14), accel: 1500, maxSpeed: 820, homing: 5.5,
        homingTarget: pick(i), r: 7,
        damage: dmg * 1.52, lifetime: 2.8, delay: i * 0.07, color: '#ffd9a8', glow: '#ff5a1a', hitStyle: 'ramp-sb',
        pfx: { tex: 'ramp-pf-sb-rocket', w: 40, h: 11, ax: 0.62, solid: true, smoke: 'ramp-pf-sb-smoke' } });
    }
  } },
  // Aeda core: its skill1 cyan barrage - two quick volleys of four fast parallel laser streaks
  // (light homing, spread over the targets); cyan orb flash on the core, its blue hit sheet.
  haloOrbs: { cd: 0.9, fire(p, b, mx, my, dmg, pick) {
    for (let v = 0; v < 2; v++) {
      [-10, -3.5, 3.5, 10].forEach((dy, i) => b.spawn({ ...PART_SHOT, x: mx, y: my + dy, vx: 1300, vy: 0,
        homing: 2, homingTarget: pick(i), r: 6, damage: dmg * 0.61, lifetime: 1.2, delay: v * 0.09,
        color: '#e8fbff', glow: '#2bdcff', hitStyle: 'ramp-aeda',
        pfx: { tex: 'ramp-pf-aeda-orb', w: 62, h: 12, ax: 0.75, core: '#f2feff' } }));
    }
  } },
  // Shade legs: its SMG - a 5-round burst of thin orange tracers (gigantes_bullet), its 4x2
  // muzzle flash, a hard impact pop.
  shadowNeedles: { cd: 0.3, fire(p, b, mx, my, dmg) {
    for (let i = 0; i < 5; i++) b.spawn({ ...PART_SHOT, x: mx, y: my + (i - 2) * 2.5, vx: 1400, vy: (i - 2) * 16, r: 5,
      damage: dmg * 0.49, lifetime: 1.0, delay: i * 0.04, color: '#ffe0b0', glow: '#ff8a1a', hitStyle: 'ramp-shade',
      pfx: { tex: 'ramp-pf-shade-tracer', w: 66, h: 12, ax: 0.85 } });
  } },
  // Mr. Alfred legs: its drones' red laser - three fast homing red beam bolts fanned out, each
  // at its own target (its own FX_beam), the red eye-dot flash, its orange star-burst hit.
  gentleDrones: { cd: 0.6, fire(p, b, mx, my, dmg, pick) {
    [-120, 0, 120].forEach((vy, i) => b.spawn({ ...PART_SHOT, x: mx, y: my, vx: 900, vy, accel: 2400, maxSpeed: 1500,
      homing: 5, homingTarget: pick(i), r: 6, damage: dmg * 1.04, lifetime: 1.6,
      color: '#ffd0c8', glow: '#ff2a1a', hitStyle: 'ramp-alfred',
      pfx: { tex: 'ramp-pf-alfred-beam', w: 62, h: 16, ax: 0.8 } }));
  } },
};

/**
 * Attach the Rampalion rules to a freshly built Player.
 * @param {object} player
 * @param {{clips: Record<string, any>, makeAnimator: (clips:any)=>any, boneTrack?: object,
 *   onEvent?: (type: string, data: object) => void}} deps
 */
export function initRampalion(player, { clips, makeAnimator, boneTrack, onEvent }) {
  const anim = (key) => {
    const c = clips?.[key];
    if (!c || !makeAnimator) return null;
    try { return makeAnimator(c); } catch { return null; }
  };
  const anims = {};
  for (const key of RAMPALION_ASSET_KEYS) anims[key] = anim(key);
  // Variants (and the front overlays) share the base camera box so they overlay pixel-exact.
  const overlayKeys = RAMPALION_SLOTS.flatMap((s) => s.options.flatMap((o) => [o.frontOverlay, o.frontOverlayNoArm]).filter(Boolean));
  for (const key of [...RAMPALION_LIVE_BODIES, ...overlayKeys, 'fx_ramp_wings', 'fx_ramp_dashpose']) {
    if (anims[key]) {
      anims[key]._box = player.anim._box;
      anims[key].drawScale = player.anim.drawScale;
    }
  }
  player._ramp = {
    anims,
    tracks: boneTrack || clips?.rampalion?.boneTrack || null,
    slots: [], // [{ slot, opt, robot, attached, cd }]
    docks: [], // robots flying in: { entry, t }
    ejects: [],
    fuseFlash: 0,
    breakFlash: 0,
    lastRobot: null,
    fusions: 0,
    onEvent: onEvent || null,
    // Hyper Rampalion (user): it starts without its wing blades; clearing the stage 1
    // midboss without taking any power-up flies them in and turns the body gold.
    hyper: false,
    tookPower: false,
    hyperFly: null,
  };
  player.lives = 1;
}

export function isRampalion(player) {
  return !!player?._ramp;
}

/** Current form name (latest robot), or null when plain Rampalion. */
export function rampFormName(player) {
  const r = player?._ramp;
  const top = r?.slots[r.slots.length - 1];
  if (!top) return null;
  const name = RAMPALION_ROBOTS[top.robot].form;
  return r.slots.length >= RAMPALION_SLOTS.length ? `완전 합체 ${name}` : name;
}

/**
 * Level-up: a random robot flies in and docks; its part set swaps the next body location.
 * @param {() => number} [rand] 0..1 RNG (deterministic runs pass the game RNG)
 */
export function rampFuse(player, rand = Math.random) {
  const r = player?._ramp;
  if (!r) return null;
  // Hyper Rampalion fuses nothing (user): it is its own complete form.
  if (r.hyper || r.hyperFly) return null;
  // A random location still free (user: no fixed chest -> arm -> back -> leg order).
  const free = RAMPALION_SLOTS.filter((sl) => !r.slots.some((e) => e.slot === sl));
  if (!free.length) return null;
  const slot = free[Math.min(free.length - 1, Math.floor(rand() * free.length))];
  const pool = slot.options.filter((o) => o.robot !== r.lastRobot);
  const list = pool.length ? pool : slot.options;
  const opt = list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const entry = { slot, opt, robot: opt.robot, attached: false, cd: 0.3 };
  r.slots.push(entry);
  r.docks.push({ entry, t: 0 });
  r.lastRobot = opt.robot;
  r.fusions += 1;
  const robot = RAMPALION_ROBOTS[opt.robot];
  r.onEvent?.('dockStart', { robot, slot, opt });
  return { robot, robotKey: opt.robot, slot, opt };
}

/**
 * Power lost (hit / body contact / practice key): the newest part set is knocked off.
 * all = drop every part (death).
 */
export function rampBreak(player, { eject = true, silent = false, all = false } = {}) {
  const r = player?._ramp;
  if (!r || !r.slots.length) return null;
  let last = null;
  do {
    last = r.slots.pop();
    r.docks = r.docks.filter((d) => d.entry !== last);
    if (eject && last.attached) {
      const s = player.drawSize || 80;
      for (const m of last.opt.mounts) {
        const g = graftPoint(player, m);
        r.ejects.push({
          opt: last.opt, mount: m, anim: r.anims[m.part],
          x: g ? g.x : player.x, y: g ? g.y : player.y, rot: g ? g.rot : 0,
          vx: -150 - Math.random() * 80, vy: -240 - Math.random() * 60,
          vr: -2.4 - Math.random(), t: EJECT_TIME, size: s * m.scale,
        });
      }
    }
  } while (all && r.slots.length);
  if (!silent) r.breakFlash = 0.45;
  return last;
}

/** Hyper Rampalion's lives: no parts to lose, so it gets the regular 3 (user: a super hero). */
const HYPER_LIVES = 3;
/** Hyper Rampalion: the wing blades' flight in (s). */
const HYPER_FLY = 1.1;
/** Canvas filter for the gold Hyper body. */
export const HYPER_GOLD = 'sepia(1) saturate(2.6) hue-rotate(-12deg) brightness(1.18) contrast(1.05)';

/** Rampalion's body without its wing blades, at rest (idle frame 0) - the bomb's
 *  before / after while the wings drop on and fly off (rampalion-skill.js). */
export function rampRestBody(player) {
  const v = player?._ramp?.anims?.[RAMPALION_BODY_KEYS.wing];
  if (!v) return null;
  v.state = 'idle';
  v.time = 0;
  v.locked = false;
  return v;
}

/** Start the run as Hyper Rampalion (RANDOM's 1% roll): no fly-in, power locked at Lv5. */
export function rampMakeHyper(player) {
  const r = player?._ramp;
  if (!r) return;
  r.hyper = true;
  r.hyperFly = null;
  r.tookPower = true;
  if (r.slots.length) rampBreak(player, { eject: false, all: true, silent: true });
  player.shotLevel = player.shotLevelMax || 5;
  player.lives = HYPER_LIVES;
  r.fuseFlash = FUSE_FLASH;
  r.onEvent?.('hyper', {});
}

/** Stage 1 midboss down with no power-up taken: the wing blades fly in (true if started). */
export function rampHyperStart(player, { force = false } = {}) {
  const r = player?._ramp;
  if (!r || r.hyper || r.hyperFly || (r.tookPower && !force)) return false;
  r.hyperFly = { t: 0 };
  r.onEvent?.('hyperStart', {});
  return true;
}

/**
 * Leg-slot Z skill (user), each with its own cooldown: Shade legs = a short shadow dash with
 * i-frames, Mr. Alfred legs = a barrier bubble that eats enemy shots for a while.
 */
const LEG_SKILLS = {
  dash: { cd: 2.5 },
  // A shield in front of the body (user), not a bubble: ellipse ahead of the chest, x drawSize.
  barrier: { cd: 10, dur: 3, ahead: 0.46, rx: 0.13, ry: 0.56 },
};
const DASH_TIME = 0.16;
const DASH_DIST = 170; // px
const DASH_IFRAME = 0.3;

/** 'dash' / 'barrier' while a leg part with a Z skill is fused, else null. */
export function rampLegSkillKind(player) {
  const e = player?._ramp?.slots.find((q) => q.attached && q.slot.id === 'leg');
  return e?.opt.legSkill || null;
}

/** Leg skill cooldown: seconds left and the full length (HUD sweep). */
export function rampLegCooldown(player) {
  const r = player?._ramp;
  return { left: r?.legCd || 0, total: r?.legCdMax || 1 };
}

/**
 * Z pressed: fire the leg skill. Returns the kind used, 'cooldown' while recharging, or
 * null with no leg skill. input = the merged game input (dash direction).
 */
export function rampLegSkill(player, input) {
  const r = player?._ramp;
  const kind = rampLegSkillKind(player);
  if (!r || !kind || !player.alive || player.isRespawning) return null;
  if ((r.legCd || 0) > 0) return 'cooldown';
  const L = LEG_SKILLS[kind];
  if (kind === 'dash') {
    let dx = (input?.right ? 1 : 0) - (input?.left ? 1 : 0);
    let dy = (input?.down ? 1 : 0) - (input?.up ? 1 : 0);
    if (!dx && !dy) { dx = Number(input?.ax) || 0; dy = Number(input?.ay) || 0; }
    const m = Math.hypot(dx, dy);
    if (m < 0.2) { dx = 1; dy = 0; } else { dx /= m; dy /= m; } // no input: forward
    r.dash = { t: 0, vx: (dx * DASH_DIST) / DASH_TIME, vy: (dy * DASH_DIST) / DASH_TIME };
    r.dashTrail = [{ x: player.x, y: player.y, a: 1 }];
    player.invuln = Math.max(player.invuln || 0, DASH_IFRAME);
  } else {
    r.barrier = { t: L.dur, dur: L.dur, flash: 0 };
  }
  r.legCd = L.cd;
  r.legCdMax = L.cd;
  r.onEvent?.('legSkill', { kind });
  return kind;
}

/** skill_2 sheet time with the hand thrust out (rampalion-skill.js X_HAND). */
const SHIELD_HAND = 0.75;

/**
 * Body pose while the front shield is up (user: keep skill_2's hand-out pose): a view of the
 * body clips held on that frame (drawRampalionSkill draws it with the parts on its bones),
 * or null when no shield / during a skill run.
 */
export function rampShieldPose(player) {
  const r = player?._ramp;
  if (!r?.barrier || player.skillRun || !player.anim?.hasSkill2) return null;
  const a = (r.shieldView ||= Object.create(player.anim));
  a.state = 'skill2';
  a.time = SHIELD_HAND;
  a.locked = true;
  a.dropWing = true; // its own wings stay off (not Hyper), unlike skill_1's lance / the bomb
  return a;
}

/** The front shield's ellipse in px (centre + radii) while it is up, else null. */
function barrierShape(player) {
  if (!player?._ramp?.barrier) return null;
  const s = player.drawSize || 80;
  const B = LEG_SKILLS.barrier;
  const dir = player.facing < 0 ? -1 : 1;
  return { x: player.x + (player.drawOffsetX || 0) + B.ahead * s * dir, y: player.y + (player.drawOffsetY || 0), rx: B.rx * s, ry: B.ry * s };
}

/** True when an enemy shot at (x, y), radius r, runs into the front shield (Game eats it). */
export function rampBarrierHit(player, x, y, r = 0) {
  const e = barrierShape(player);
  if (!e) return false;
  const dx = (x - e.x) / (e.rx + r);
  const dy = (y - e.y) / (e.ry + r);
  return dx * dx + dy * dy < 1;
}

/** An enemy shot eaten by the barrier at (x, y): a spark there and a rim flash. */
export function rampBarrierAbsorb(player, x, y) {
  const r = player?._ramp;
  if (!r?.barrier) return;
  r.barrier.flash = 0.15;
  (r.barrierSparks ||= []).push({ x, y, t: 0 });
  if (r.barrierSparks.length > 24) r.barrierSparks.shift();
}

function tickLegSkill(player, r, dt) {
  if (r.legCd > 0) r.legCd = Math.max(0, r.legCd - dt);
  if (r.dash) {
    r.dash.t += dt;
    player.x += r.dash.vx * dt;
    player.y += r.dash.vy * dt;
    r.dashTrail.push({ x: player.x, y: player.y, a: 1 });
    if (r.dash.t >= DASH_TIME) r.dash = null;
  }
  if (r.dashTrail?.length) {
    for (const g of r.dashTrail) g.a -= dt * 2.4;
    r.dashTrail = r.dashTrail.filter((g) => g.a > 0);
  }
  if (r.barrier) {
    r.barrier.t -= dt;
    if (r.barrier.flash > 0) r.barrier.flash -= dt;
    if (r.barrier.t <= 0) r.barrier = null;
  }
  if (r.barrierSparks?.length) {
    for (const k of r.barrierSparks) k.t += dt;
    r.barrierSparks = r.barrierSparks.filter((k) => k.t < 0.35);
  }
}

/** Shadow after-images of a dash, behind the body (bx - player.x = the body's draw offset). */
function drawDashTrail(ctx, player, r, bx, by, s) {
  if (!r.dashTrail?.length) return;
  const body = rampBodyAnim(player);
  const ox = bx - player.x;
  const oy = by - player.y;
  // Afterimages of the body itself (user), every other sample, fading out; a faint shadow-teal
  // edge so they read as Shade's.
  ctx.save();
  r.dashTrail.forEach((g, i) => {
    if (i % 2) return;
    const a = Math.max(0, g.a);
    ctx.globalAlpha = a * 0.55;
    ctx.filter = 'saturate(0.7) brightness(1.05)';
    body.draw(ctx, g.x + ox, g.y + oy, s, { flipX: player.facing < 0 });
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.25;
    ctx.filter = 'brightness(0.6) sepia(1) hue-rotate(115deg) saturate(5)';
    body.draw(ctx, g.x + ox, g.y + oy, s, { flipX: player.facing < 0 });
    ctx.globalCompositeOperation = 'source-over';
  });
  ctx.restore();
}

/** Mr. Alfred's barrier bubble, its eaten-shot sparks, and the Z cooldown ring under the feet. */
function drawLegSkillFront(ctx, player, r, x, y, s) {
  const B = r.barrier;
  const E = B && barrierShape(player);
  if (E) {
    // Front shield: a tall gold energy ellipse ahead of the body with a rim and crest lines.
    const t = player._t || 0;
    const fadeIn = Math.min(1, (B.dur - B.t) / 0.15);
    const fadeOut = Math.min(1, B.t / 0.4);
    const blink = B.t < 0.8 ? 0.6 + 0.4 * Math.sin(t * 30) : 1;
    const a = fadeIn * fadeOut * blink;
    const cx = x + (E.x - player.x - (player.drawOffsetX || 0));
    const cy = y + (E.y - player.y - (player.drawOffsetY || 0));
    const grow = 0.6 + 0.4 * fadeIn;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    ctx.scale(1, grow);
    const g = ctx.createRadialGradient(-E.rx * 0.6, 0, E.rx * 0.2, 0, 0, E.ry);
    g.addColorStop(0, `rgba(255,236,170,${(0.32 + (B.flash > 0 ? 0.35 : 0)) * a})`);
    g.addColorStop(0.6, `rgba(255,205,100,${0.18 * a})`);
    g.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, E.rx, E.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,236,170,${(0.85 + (B.flash > 0 ? 0.15 : 0)) * a})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, E.rx, E.ry, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // Crest lines sweeping down the face of the shield.
    ctx.strokeStyle = `rgba(255,248,215,${0.5 * a})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.9 + i / 3) % 1) * 2 - 1;
      const yy = k * E.ry * 0.9;
      const xx = E.rx * Math.sqrt(Math.max(0, 1 - (yy / E.ry) ** 2));
      ctx.beginPath();
      ctx.moveTo(-xx * 0.4, yy);
      ctx.lineTo(xx * 0.95, yy);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (r.barrierSparks?.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const k of r.barrierSparks) {
      const u = k.t / 0.35;
      ctx.strokeStyle = `rgba(255,236,170,${1 - u})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 4 + u * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (r.legCd > 0 && rampLegSkillKind(player)) {
    // Recharging Z skill: a small arc under the feet that fills up.
    const k = 1 - r.legCd / (r.legCdMax || 1);
    const cx = x;
    const cy = y + s * 0.47;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.16, s * 0.05, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rampLegSkillKind(player) === 'dash' ? 'rgba(90,240,190,0.9)' : 'rgba(255,214,110,0.9)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.16, s * 0.05, 0, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Seconds for the Tyrant-head shield to come back after it breaks. */
const SHIELD_REGEN = 60;

/** A hit on a raised shield: the shield breaks instead (true), nothing else is lost. */
export function rampShieldHit(player) {
  const r = player?._ramp;
  if (!r?.shieldUp) return false;
  r.shieldUp = false;
  r.shieldRegen = SHIELD_REGEN;
  r.shieldBreak = 0.5;
  player.invuln = Math.max(player.invuln || 0, 1.5);
  return true;
}

/** Rampalion struck above power Lv1: lose a level (and the newest part), not the life. */
export function rampArmorHit(player) {
  player._cancelChange?.();
  player.skillRun = null;
  player.charge = 0;
  player.unrepFor = 0;
  player._chargeQueued = false;
  player.shotLevel = Math.max(1, player.shotLevel - 1);
  player.powerFlash = 'down';
  player.powerFlashT = 0.6;
  player.recoveryTimer = Math.max(player.recoveryTimer || 0, 3);
  // Same grace as a fresh fly-in, so one pattern cannot strip two levels at once.
  player.invuln = Math.max(player.invuln || 0, 2.2);
  player._ramp.lastArmorBreak = rampBreak(player, { eject: true });
  return 'armor';
}

export function tickRampalion(player, dt) {
  const r = player?._ramp;
  if (!r) return;
  // 0 = idle pose, 1 = flight pose; eased so rear arms slide / fade between layers (no pop).
  const target = player.anim?.state === 'move' ? 1 : 0;
  const step = dt / 0.12;
  r.flyBlend = r.flyBlend === undefined ? target
    : target > r.flyBlend ? Math.min(target, r.flyBlend + step) : Math.max(target, r.flyBlend - step);
  if (r.fuseFlash > 0) r.fuseFlash = Math.max(0, r.fuseFlash - dt);
  if (r.breakFlash > 0) r.breakFlash = Math.max(0, r.breakFlash - dt);
  tickLegSkill(player, r, dt);
  if (r.hyper) player.shotLevel = player.shotLevelMax || 5; // Hyper: always Lv5
  if (r.hyperFly) {
    r.hyperFly.t += dt;
    if (r.hyperFly.t >= HYPER_FLY) {
      r.hyperFly = null;
      r.hyper = true;
      // Hyper (user): no fused parts, power locked at Lv5, 3 lives (a super hero - user).
      if (r.slots.length) rampBreak(player, { eject: true, all: true, silent: true });
      player.shotLevel = player.shotLevelMax || 5;
      player.lives = Math.max(player.lives, HYPER_LIVES);
      r.fuseFlash = FUSE_FLASH;
      r.onEvent?.('hyper', {});
    }
  }
  // Shield (Tyrant head): raised when the head docks, regrows SHIELD_REGEN s after a break,
  // gone with the head.
  if (r.shieldBreak > 0) r.shieldBreak = Math.max(0, r.shieldBreak - dt);
  if (r.shieldFlash > 0) r.shieldFlash = Math.max(0, r.shieldFlash - dt);
  const shieldPart = r.slots.some((e) => e.attached && e.opt.shield);
  if (!shieldPart) {
    r.shieldHad = false;
    r.shieldUp = false;
    r.shieldRegen = 0;
  } else if (!r.shieldHad) {
    r.shieldHad = true;
    r.shieldUp = true;
    r.shieldFlash = 0.6;
  } else if (!r.shieldUp) {
    r.shieldRegen -= dt;
    if (r.shieldRegen <= 0) {
      r.shieldUp = true;
      r.shieldRegen = 0;
      r.shieldFlash = 0.6;
      r.onEvent?.('shieldUp', {});
    }
  }
  for (const [key, a] of Object.entries(r.anims)) {
    // Body variants are slaved to the base clock in rampBodyAnim; still parts hold frame 0.
    if (a && !key.startsWith('rampalion_') && !STILL_PARTS.has(key)) a.update(dt);
  }
  for (const e of r.slots) if (e.cd > 0) e.cd -= dt;
  if (r.hyperCd) for (const k in r.hyperCd) if (r.hyperCd[k] > 0) r.hyperCd[k] -= dt;
  for (let i = r.docks.length - 1; i >= 0; i--) {
    const d = r.docks[i];
    d.t += dt;
    if (d.t >= DOCK_FLY + DOCK_MERGE) {
      d.entry.attached = true;
      r.docks.splice(i, 1);
      r.fuseFlash = FUSE_FLASH;
      r.lastGraft = d.entry;
      r.onEvent?.('dockDone', {
        robot: RAMPALION_ROBOTS[d.entry.robot], slot: d.entry.slot, opt: d.entry.opt,
        formName: rampFormName(player), parts: r.slots.filter((x) => x.attached).length,
      });
    }
  }
  for (let i = r.ejects.length - 1; i >= 0; i--) {
    const e = r.ejects[i];
    e.t -= dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vy += 620 * dt;
    e.rot += e.vr * dt;
    if (e.t <= 0) r.ejects.splice(i, 1);
  }
}

/**
 * Part power by power level: the more of the body is fused, the harder every part hits.
 * With the base gun (Griffin Lv1 DPS) the fully fused Lv5 lands in the 100s single-target
 * (user), ~1.6x Griffin Lv5 - heavy and slow, one life, a hit costs a level and a part.
 */
const PART_LV_TABLE = [0, 1, 1.0, 1.35, 1.8, 2.3];
/** Damage unit the part fractions are written in (fixed: the base gun's shotDamage is tuned apart). */
const PART_DMG_UNIT = 1.95;
export const PART_LV_MUL = (lv) => PART_LV_TABLE[Math.max(1, Math.min(5, lv | 0))];
/**
 * Hyper Rampalion's gun on top of the Lv5 pattern: in the 120s single-target (user), above the
 * fully fused form (one hit ends the run, no parts / shield / leg skill - the reward for
 * clearing stage 1's midboss unpowered).
 */
const HYPER_SHOT_MUL = 1.35; // + the arsenal (HYPER_ARSENAL) = the 120s

/** Base-gun damage multiplier for Player.shoot (Hyper only). */
export function rampShotMul(player) {
  return player?._ramp?.hyper ? HYPER_SHOT_MUL : 1;
}

/**
 * Hyper Rampalion's own arsenal (user: a lavish sub-weapon set, 5 kinds - it has no parts).
 * Fired with the main gun; damage is a fraction of PART_DMG_UNIT. Balance: with the Lion
 * Buster (HYPER_SHOT_MUL) the whole set keeps Hyper in the 120s single-target
 * (tools/eval-rampalion-balance.mjs hyper).
 *   lionMissiles  3 up + 3 down fan out, then home in 0.5 s later (user)
 *   lionLaser     a thick gold beam off the chest with lightning strands (user: a laser)
 *   wingBlades    gold crescent blades off the wings, fanned, piercing
 *   lionHead      a roaring lion's head of fire, big, piercing, bursting on what it hits
 *   thunderOrbs   electric orbs flung out four ways, then homing, lightning on hit
 */
const HYPER_SHOT = { friendly: true, grazeable: false, style: 'ramppart', partGlow: true };
const HYPER_ARSENAL = {
  lionMissiles: { cd: 1.6, from: 'wingB', flash: { key: 'ramp-pf-sb-muzzle', size: 60, dur: 0.22 },
    fire(p, b, x, y, dmg, pick) {
      [-1, 1].forEach((side) => [0, 1, 2].forEach((i) => b.spawn({ ...HYPER_SHOT, x, y: y + side * 6,
        vx: 140 + i * 40, vy: side * (230 - i * 50), accel: 1700, maxSpeed: 980, homing: 7, homingAfter: 0.5,
        homingTarget: pick(i + (side > 0 ? 3 : 0)), r: 7, damage: dmg * 1.6, lifetime: 3, delay: i * 0.04,
        color: '#fff0c0', glow: '#ffb020', hitStyle: 'ramp-sb',
        pfx: { tex: 'ramp-pf-sb-rocket', w: 42, h: 12, ax: 0.62, solid: true, smoke: 'ramp-pf-sb-smoke' } })));
    } },
  lionLaser: { cd: 2.2, from: 'chest', beam: { dur: 0.6, half: 9, dmg: 1.1, hitStyle: 'ramp-roc',
    bolt: 'ramp-pf-roc-bolt', orb: 'ramp-pf-roc-orb',
    pal: ['#ffb51f', '#ffe04a', '#fffbe0', '255,232,150', '255,180,40'] } },
  wingBlades: { cd: 0.8, from: 'wingF', flash: { key: 'ramp-fx-ring', size: 56, dur: 0.18 },
    fire(p, b, x, y, dmg) {
      for (const vy of [-150, 0, 150]) b.spawn({ ...HYPER_SHOT, partGlow: false, x, y, vx: 720, vy, r: 12, pierce: true,
        damage: dmg * 3.5, lifetime: 1.3, color: '#fff3c8', glow: '#ffc21a', hitStyle: 'ramp-gold',
        pfx: { crescent: '#ffc21a', w: 32, h: 60, ax: 0.6 } });
    } },
  lionHead: { cd: 1.4, from: 'chest', flash: { key: 'ramp-pf-tyrant-mouth', size: 90, dur: 0.24, ahead: 0.3 },
    fire(p, b, x, y, dmg) {
      b.spawn({ ...HYPER_SHOT, x, y, vx: 520, vy: 0, accel: 300, maxSpeed: 760, r: 26, pierce: true,
        damage: dmg * 8.5, lifetime: 2.2, blastRadius: 80, blastFx: true,
        color: '#ffd28a', glow: '#ff7a10', hitStyle: 'ramp-fire',
        pfx: { lion: true, w: 96, h: 96 } });
    } },
  thunderOrbs: { cd: 1.0, from: 'chest', flash: { key: 'ramp-pf-roc-orb', size: 54, dur: 0.16 },
    fire(p, b, x, y, dmg, pick) {
      [[340, -260], [340, 260], [120, -380], [120, 380]].forEach(([vx, vy], i) => b.spawn({ ...HYPER_SHOT, x, y,
        vx, vy, homing: 6, homingAfter: 0.3, homingTarget: pick(i), r: 9, damage: dmg * 1.3, lifetime: 2.2,
        color: '#fffbe0', glow: '#ffd84a', hitStyle: 'ramp-roc',
        pfx: { tex: 'ramp-pf-roc-orb', w: 34, h: 34, ax: 0.5, spin: 9 } }));
    } },
};

/** Hyper Rampalion: every arsenal weapon off its cooldown fires from its body point. */
function fireHyperArsenal(player, bullets, picker) {
  const r = player._ramp;
  const cds = (r.hyperCd ||= {});
  const dmg = PART_DMG_UNIT;
  for (const [kind, w] of Object.entries(HYPER_ARSENAL)) {
    if ((cds[kind] || 0) > 0) continue;
    const at = () => {
      const q = bonePoint(player, w.from);
      const s = player.drawSize || 100;
      return q ? { x: q.x + s * 0.08, y: q.y } : { x: player.x + s * 0.3, y: player.y };
    };
    if (w.beam) {
      if (player._subBeam) continue;
      const B = w.beam;
      player._subBeam = { t: 0, lv: player.shotLevel, dur: B.dur, half: B.half, dmg: dmg * B.dmg, pal: B.pal,
        hitStyle: B.hitStyle, bolt: B.bolt, orb: B.orb, pts: () => [at()] };
    } else {
      const q = at();
      w.fire(player, bullets, q.x, q.y, dmg, picker(0));
      if (w.flash) r.onEvent?.('partFire', { x: q.x, y: q.y, ...w.flash });
    }
    cds[kind] = w.cd;
  }
}

/** Grafted parts fire their own bullets (called with the main shot cadence). */
export function fireRampalionParts(player, bullets) {
  const r = player?._ramp;
  if (!r) return;
  const dmg = PART_DMG_UNIT * PART_LV_MUL(player.shotLevel);
  const ranked = (bullets.targets || []).filter((e) => e.alive && e.x > player.x + 20)
    .sort((a, b) => (a.x - player.x) ** 2 + (a.y - player.y) ** 2 - ((b.x - player.x) ** 2 + (b.y - player.y) ** 2));
  // pick(i) = the i-th target of a volley (nearest first, wrapping); off staggers muzzles /
  // hands so with 2+ enemies each one goes for a different enemy (user).
  const picker = (off) => (i) => (ranked.length ? ranked[(i + off) % ranked.length] : null);
  // Hyper Rampalion has no parts: its own arsenal instead.
  if (r.hyper) {
    fireHyperArsenal(player, bullets, picker);
    return;
  }
  for (const e of r.slots) {
    if (!e.attached || e.cd > 0) continue;
    const w = PART_WEAPONS[e.opt.gun?.kind];
    if (!w) continue;
    const fl = PART_FLASH[e.opt.gun.kind];
    const flash = (q) => fl && r.onEvent?.('partFire', { x: q.x, y: q.y, ...fl });
    const mz = e.opt.gun.muzzles;
    if (mz && w.beam) {
      // Beam weapon: the player's sub-beam, poured from the part's muzzles (follows the art).
      // Each muzzle is shot at its own target, then its far end sweeps B.sweep px up or down
      // over the beam's life (user: Roc's lasers).
      if (player._subBeam) continue;
      const mt = e.opt.mounts[e.opt.gun.mount || 0];
      const B = w.beam;
      const pick = picker(0);
      const aims = mz.map((_, i) => ({ target: pick(i), dir: Math.random() < 0.5 ? -1 : 1, base: null, reach: 0 }));
      const sb = { t: 0, lv: player.shotLevel, dur: B.dur, half: B.half, dmg: dmg * B.dmg, pal: B.pal,
        hitStyle: B.hitStyle, bolt: B.bolt, orb: B.orb,
        pts: () => mz.map(([bx, by, piece], i) => {
          const q = partPoint(player, mt, r.anims[mt.part], bx, by, piece);
          if (!q) return null;
          const a = aims[i];
          if (a.base === null) {
            const tg = a.target?.alive ? a.target : null;
            const tx = tg ? tg.x : q.x + 600;
            const ty = tg ? tg.y : q.y;
            a.base = Math.atan2(ty - q.y, tx - q.x);
            a.reach = Math.max(120, Math.hypot(tx - q.x, ty - q.y));
          }
          const u = Math.min(1, sb.t / B.dur);
          return { x: q.x, y: q.y, ang: a.base + a.dir * Math.atan2(B.sweep * u * u * (3 - 2 * u), a.reach) };
        }).filter(Boolean) };
      player._subBeam = sb;
      e.cd = w.cd;
      continue;
    }
    if (mz) {
      // Several muzzles on the part's art: one volley from each.
      const mt = e.opt.mounts[e.opt.gun.mount || 0];
      mz.forEach(([bx, by, piece], k) => {
        const q = partPoint(player, mt, r.anims[mt.part], bx, by, piece);
        if (q) { w.fire(player, bullets, q.x, q.y, dmg, picker(k)); flash(q); }
      });
      e.cd = w.cd;
      continue;
    }
    if (e.opt.gun.mounts) {
      // One volley from each listed mount (both hands), each on its own targets.
      e.opt.gun.mounts.forEach((mi, i) => {
        const q = muzzlePoint(player, { ...e.opt, gun: { ...e.opt.gun, mount: mi } });
        if (q) { w.fire(player, bullets, q.x, q.y, dmg, picker(i * 3)); flash(q); }
      });
      e.cd = w.cd;
      continue;
    }
    const m = muzzlePoint(player, e.opt);
    if (!m) continue;
    w.fire(player, bullets, m.x, m.y, dmg, picker(0));
    flash(m);
    e.cd = w.cd;
  }
}

/** Body animator to draw: a variant without the replaced own parts, synced to the base. */
export function rampBodyAnim(player) {
  const r = player?._ramp;
  const base = player.anim;
  if (!r) return base;
  const st = base.state;
  if (st === 'die') return base; // parts are already knocked off at death
  const off = new Set();
  if (!r.hyper) off.add('wing');
  for (const e of r.slots) if (e.attached && e.slot.replaces) off.add(e.slot.replaces);
  const key = off.size ? bodyKey(off) : null;
  const v = key ? r.anims[key] : null;
  if (!v) return base;
  // Variants carry idle / move on the base camera (players never play skill clips).
  if ((st === 'attack' && !v.hasAttack) || (st === 'skill2' && !v.hasSkill2)) return base;
  v.state = st;
  v.time = base.time;
  v.locked = base.locked;
  return v;
}

/** skill_1 time of the Hell and Heaven charge pose (fx_ramp_dashpose bake). */
const DASHPOSE_TIME = 3.47;

/**
 * Track clip + full-clip frame for a skill run's body. The sheet keeps every 2nd skill frame
 * from SKILL_PRE (1 s) before the release (pack_sprite_sheets), the tracks every frame.
 */
export function skillPose(player, bodyAnim) {
  const r = player._ramp;
  if (bodyAnim === r.anims.fx_ramp_dashpose) return { key: 'skill1', n: Math.round(DASHPOSE_TIME * 24) };
  const a = bodyAnim === player.anim || !bodyAnim ? player.anim : bodyAnim;
  const st = a.state;
  // a may be a view of the body clips (Object.create(player.anim)) on another clip / time.
  if (a.clips === player.anim.clips && (st === 'attack' || st === 'skill2')) {
    const key = st === 'attack' ? 'skill1' : 'skill2';
    const n = a.clips[st]?.length || 1;
    const full = (a.fps[st] || 12) * 2;
    const hit = a.hitTime?.[st];
    // The sheet starts at (full-clip release - sheet release) on the full clip (user: the leg
    // parts drifted off the body in C Lv1 when this used the sheet's own release time).
    const clipHit = a.clipHit?.[st];
    // round, not floor: the packer's window start is a whole frame; float error slipped one.
    let lo = hit != null ? Math.max(0, Math.round(((clipHit ?? hit) - (clipHit != null ? hit : 1)) * full)) : 0;
    lo -= lo % 2;
    return { key, n: lo + 2 * frameIndex(a, n) };
  }
  const key = st === 'move' ? 'move' : 'idle';
  return { key, n: frameIndex(a, r.tracks?.chest?.[key]?.length || 1) };
}

/** Skill-run body: Rampalion's own lion / legs / forearms off where parts replaced them
 *  (wings: see below). */
function skillBodyAnim(player, base = player.anim) {
  const r = player._ramp;
  const st = base.state;
  // Runs held in the stand pose use the normal variant, wings off too.
  if (st === 'idle' || st === 'move') return base === player.anim ? rampBodyAnim(player) : base;
  const off = new Set();
  for (const e of r.slots) if (e.attached && e.slot.replaces && e.slot.replaces !== 'wing') off.add(e.slot.replaces);
  // Own wings: off outside Hyper for the shield pose and skill_1 (user: plain Rampalion's C Lv1
  // throws its arm; Hyper's wings fold into the lance), kept by the bomb (its wings dropped on).
  if (!r.hyper && (base.dropWing || (st === 'attack' && !base.keepWing))) off.add('wing');
  const key = off.size ? bodyKey(off) : null;
  const v = key ? r.anims[key] : null;
  if (!v || (st === 'attack' && !v.hasAttack) || (st === 'skill2' && !v.hasSkill2)) return base;
  v.state = st;
  v.time = base.time;
  v.locked = base.locked;
  return v;
}

/** Every attached part, behind-body layer first (no aura / flashes / docks). */
function drawParts(ctx, player, r) {
  for (const e of r.slots) if (e.attached) drawOption(ctx, player, e.opt, r, true);
  for (let z = 0; z <= 3; z++) for (const e of r.slots) if (e.attached) drawOption(ctx, player, e.opt, r, false, 0, z);
}

/** The body a skill run draws for the clip itself (C Lv1 cuts its flying arm / lance from it). */
export function rampSkillBody(player) {
  return player?._ramp ? skillBodyAnim(player) : player.anim;
}

/**
 * Skill / bomb run: the body with its fused parts kept on (user), the parts riding the
 * skill clip's bone tracks. bodyAnim = the spec's override (null = the skill clip itself);
 * drawBody(anim) draws the body. (dx, dy) = the run's body offset. fx = the body's
 * { filter, glow } (bomb turning gold), applied to the parts too (user).
 */
export function drawRampalionSkill(ctx, player, bodyAnim, x, y, s, dx, dy, drawBody, fx = null) {
  const r = player._ramp;
  const body = !bodyAnim ? skillBodyAnim(player)
    : bodyAnim.clips === player.anim.clips ? skillBodyAnim(player, bodyAnim) : bodyAnim;
  const fb = r.flyBlend;
  r.pose = { ...skillPose(player, bodyAnim), dx, dy };
  r.flyBlend = 0; // idle layering / no flight nudges in skill poses
  try {
    r.partFilter = fx?.filter || null;
    drawRampalionBack(ctx, player, x, y, s);
    r.partFilter = null;
    // spec.bodyCut(player, run): a screen rect left out of the body (C Lv1: the lance while it
    // flies off on its own).
    const cut = player.skillRun?.spec?.bodyCut?.(player, player.skillRun);
    if (cut) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cut.x - 4000, cut.y - 4000, 8000 + cut.w, 8000 + cut.h);
      ctx.rect(cut.x, cut.y, cut.w, cut.h);
      ctx.clip('evenodd');
    }
    drawBody(body);
    if (cut) ctx.restore();
    r.partFilter = fx?.filter || null;
    drawRampalionFront(ctx, player, x, y, s);
    if (fx?.glow > 0) {
      // Same white glow pass as the body.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, fx.glow);
      r.partFilter = 'brightness(3) saturate(0.2)';
      drawParts(ctx, player, r);
      ctx.restore();
    }
  } finally {
    r.partFilter = null;
    r.pose = null;
    r.flyBlend = fb;
  }
}

/** Index of the base animator's current frame in a clip of n frames. */
function frameIndex(anim, n) {
  const st = anim.state;
  const fps = anim.fps?.[st] || 24;
  const f = Math.floor(anim.time * fps);
  return Math.max(0, anim.locked || st === 'die' ? Math.min(n - 1, f) : ((f % n) + n) % n);
}

/** Tracked bone in screen space for the base animator's current frame. */
export function bonePoint(player, bone) {
  const r = player._ramp;
  const tr = r?.tracks?.[bone];
  const anim = player.anim;
  const box = anim?._box;
  if (!tr || !box) return null;
  const st = anim.state;
  // r.pose (drawRampalionSkill): a skill run's track clip / frame and its body offset.
  const pose = r.pose;
  const clip = (pose ? tr[pose.key] : tr[st]) || tr.idle;
  if (!clip?.length) return null;
  const [hx, hy, ang, sc] = clip[pose ? Math.max(0, Math.min(clip.length - 1, pose.n)) : frameIndex(anim, clip.length)];
  const rest = tr.idle?.[0] || clip[0];
  const size = (player.drawSize || 80) * (pose ? 1 : (anim.drawScale?.[st] || 1));
  const aspect = box.w / box.h;
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  const k = w / box.w;
  const cx = player.x + (player.drawOffsetX || 0) + (pose ? pose.dx : (player.bombDx || 0));
  const cy = player.y + (player.drawOffsetY || 0) + (pose ? pose.dy : (player.bombDy || 0));
  let x = cx - w / 2 + (hx - box.x) * k;
  const y = cy - h / 2 + (hy - box.y) * k;
  // Bake space is y-down; the bone's world angle grows counter-clockwise.
  let rot = -(ang - rest[2]);
  const flip = player.facing < 0;
  if (flip) { x = 2 * cx - x; rot = -rot; }
  return { x, y, rot, scale: rest[3] ? sc / rest[3] : 1, flip, rx: (rest[0] - box.x) * k, ry: (rest[1] - box.y) * k };
}

/** A segment anchor (knee -> ankle): point at fraction t, turned like the segment. */
function segmentPoint(player, [a, b], t) {
  const pa = bonePoint(player, a);
  const pb = bonePoint(player, b);
  if (!pa || !pb) return null;
  const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
  // Rest direction from the idle pose (screen units, facing right).
  const restAng = Math.atan2(pb.ry - pa.ry, (pb.rx - pa.rx) * (pa.flip ? -1 : 1));
  return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t, rot: ang - restAng, scale: 1, flip: pa.flip };
}

/** Where a mount's centre sits right now (anchor + offset rotated with it). */
function graftPoint(player, m) {
  const b = m.seg ? segmentPoint(player, m.seg, m.t ?? 0.5) : bonePoint(player, m.bone);
  if (!b) return null;
  const s = player.drawSize || 80;
  const dir = b.flip ? -1 : 1;
  // Optional flight-pose nudge (rear arms peek out below the leaning torso in flight).
  const fb = player._ramp?.flyBlend ?? (player.anim?.state === 'move' ? 1 : 0);
  const ox = ((m.x || 0) + (m.flyDx || 0) * fb) * s * dir;
  // bob: a hovering part (Mr. Alfred's drone) floats up and down.
  const oy = ((m.y || 0) + (m.flyDy || 0) * fb + (m.bob ? Math.sin((player._t || 0) * 4) * m.bob : 0)) * s;
  const c = Math.cos(b.rot);
  const sn = Math.sin(b.rot);
  // Optional walk sway (deg) so held weapons lean with the forearm in the move cycle.
  const a = player.anim;
  const sway = m.sway && a?.state === 'move'
    ? Math.sin((a.time / ((a.clips?.move?.length || 21) / (a.fps?.move || 24))) * Math.PI * 2) * m.sway : 0;
  return {
    x: b.x + ox * c - oy * sn,
    y: b.y + ox * sn + oy * c,
    // follow < 1: the part only takes that share of the anchor's swing.
    rot: b.rot * (m.follow ?? 1) + (((m.rot || 0) + (m.flyRot || 0) * fb + sway) * Math.PI / 180) * dir,
    scale: b.scale * (m.flyScale ? 1 + (m.flyScale - 1) * fb : 1),
    flip: b.flip,
  };
}

function muzzlePoint(player, opt) {
  const m = opt.mounts[opt.gun?.mount || 0];
  const g = m && graftPoint(player, m);
  if (!g) return null;
  const s = player.drawSize || 80;
  const dir = g.flip ? -1 : 1;
  const gx = (opt.gun?.x || 0) * s * dir;
  const gy = (opt.gun?.y || 0) * s;
  const c = Math.cos(g.rot);
  const sn = Math.sin(g.rot);
  return { x: g.x + gx * c - gy * sn, y: g.y + gx * sn + gy * c };
}

/** Aeda-style halo: a closed ivory ring with a gold inner line (no baked art has a whole ring). */
function drawHalo(ctx, g, s, glowCol, highlight) {
  const R = s * 0.5;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.rot);
  ctx.scale(0.86, 1);
  if (glowCol) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `${glowCol}0.35)`;
    ctx.lineWidth = R * 0.42;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.strokeStyle = '#4a3b26';
  ctx.lineWidth = R * 0.19;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#f0c868';
  ctx.lineWidth = R * 0.13;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#fff1c0';
  ctx.lineWidth = R * 0.035;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.93, 0, Math.PI * 2); ctx.stroke();
  if (highlight > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = highlight;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = R * 0.2;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawMount(ctx, player, m, anim, highlight = 0, pieces = 'both') {
  const g = graftPoint(player, m);
  if (!g) return;
  if (m.proc === 'halo') {
    const pf = player._ramp?.partFilter;
    if (pf) { ctx.save(); ctx.filter = pf; }
    drawHalo(ctx, g, (player.drawSize || 80) * m.scale * g.scale, m.glow, highlight);
    if (pf) ctx.restore();
    return;
  }
  if (!anim?.draw) return;
  const s = (player.drawSize || 80) * m.scale * g.scale;
  ctx.save();
  const op = ctx.globalCompositeOperation; // 'lighter' in a skill's white glow pass
  if (m.glow) {
    const pulse = 0.75 + 0.25 * Math.sin((player._t || 0) * 6);
    const rad = s * 0.75;
    const gl = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, rad);
    gl.addColorStop(0, `${m.glow}${0.55 * pulse})`);
    gl.addColorStop(1, `${m.glow}0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(g.x, g.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = op;
  }
  const paint = (dy, piece) => {
    ctx.save();
    ctx.translate(g.x, g.y + dy);
    ctx.rotate(g.rot + (piece === 'in' ? (m.split.rot || 0) * Math.PI / 180 : 0));
    if (m.sy) ctx.scale(1, m.sy);
    if (piece) splitClip(ctx, anim, s, m.split.poly, piece === 'in');
    // r.partFilter: the body's skill filter carried onto the parts (bomb gold - user).
    const f = [m.filter, player._ramp?.partFilter].filter(Boolean).join(' ');
    if (f) ctx.filter = f;
    anim.draw(ctx, 0, 0, s, { flipX: g.flip });
    if (highlight > 0) {
      // Freshly grafted part flashes white so it reads inside the fusion ring.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = highlight;
      ctx.filter = 'brightness(2.2) saturate(0.3)';
      anim.draw(ctx, 0, 0, s, { flipX: g.flip });
    }
    ctx.restore();
  };
  if (m.split && anim._box) {
    // One baked sprite holding two pieces: the outlined piece is drawn shifted down.
    if (pieces !== 'in') paint(0, 'out');
    if (pieces !== 'out') paint(m.split.dy * s, 'in');
  } else paint(0, null);
  ctx.restore();
}

/** World position of a bake-px point on a mount (on its split piece when 'in'). */
function partPoint(player, m, anim, bx, by, piece) {
  const g = graftPoint(player, m);
  const box = anim?._box;
  if (!g || !box) return null;
  const s = (player.drawSize || 80) * m.scale * g.scale;
  const aspect = box.w / box.h;
  const w = aspect < 1 ? s * aspect : s;
  const h = aspect < 1 ? s : s / aspect;
  const dir = g.flip ? -1 : 1;
  let lx = ((bx - box.x) * w / box.w - w / 2) * dir;
  let ly = ((by - box.y) * h / box.h - h / 2) * (m.sy || 1);
  const inPiece = piece === 'in' && m.split;
  const rot = g.rot + (inPiece ? (m.split.rot || 0) * Math.PI / 180 : 0);
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  return { x: g.x + lx * c - ly * sn, y: g.y + (inPiece ? m.split.dy * s : 0) + lx * sn + ly * c, s };
}

/** Booster flames from a part's nozzles, fading in with the flight pose. */
function drawBoosters(ctx, player, m, anim, fb) {
  const B = m.boosters;
  const t = player._t || 0;
  const piece = m.split ? 'in' : null;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  B.at.forEach(([bx, by], i) => {
    const p0 = partPoint(player, m, anim, bx, by, piece);
    const p1 = partPoint(player, m, anim, bx + B.dir[0] * 0.1, by + B.dir[1] * 0.1, piece);
    if (!p0 || !p1) return;
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const flick = 0.85 + 0.15 * Math.sin(t * 47 + i * 2.1) + 0.08 * Math.sin(t * 83 + i);
    const len = p0.s * 0.3 * fb * flick;
    const wid = p0.s * 0.045;
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * fb})`);
    g.addColorStop(0.25, `rgba(255,236,120,${0.8 * fb})`);
    g.addColorStop(0.7, `rgba(255,150,40,${0.35 * fb})`);
    g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -wid);
    ctx.quadraticCurveTo(len * 0.45, -wid * 1.1, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid * 1.1, 0, wid);
    ctx.closePath();
    ctx.fill();
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, wid * 2.4);
    glow.addColorStop(0, `rgba(255,245,200,${0.7 * fb})`);
    glow.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, wid * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

/** Move-speed multiplier from attached parts (e.g. Roc wing boosters). */
export function rampSpeedMul(player) {
  const r = player?._ramp;
  if (!r) return 1;
  let k = 1;
  for (const e of r.slots) if (e.attached && e.opt.speedMul) k *= e.opt.speedMul;
  return k;
}

/** Clip to a polygon given in bake pixels (inside, or everything outside it). */
function splitClip(ctx, anim, s, poly, inside) {
  const box = anim._box;
  const aspect = box.w / box.h;
  const w = aspect < 1 ? s * aspect : s;
  const h = aspect < 1 ? s : s / aspect;
  const px = (bx) => (bx - box.x) * w / box.w - w / 2;
  const py = (by) => (by - box.y) * h / box.h - h / 2;
  ctx.beginPath();
  if (!inside) ctx.rect(-s * 4, -s * 4, s * 8, s * 8);
  poly.forEach(([bx, by], i) => (i ? ctx.lineTo(px(bx), py(by)) : ctx.moveTo(px(bx), py(by))));
  ctx.closePath();
  ctx.clip('evenodd');
}

/** Layer of a mount right now: rear arms come forward in flight (the leaning torso and the
 *  baked booster jet would otherwise hide them completely). */
function drawOption(ctx, player, opt, r, under, highlight = 0, zLevel = 0) {
  for (const m of opt.mounts) {
    // Front layer in depth passes: z 0 = default, 1 = chest graft over the other parts,
    // 2 = over Rampalion's own head / upper-arm overlay too (the Roc wing's front piece, so the
    // shoulder tucks under it), 3 = over all of that (a hand in front of its elbow).
    if (!under && Math.min(3, m.z || 0) !== zLevel) continue;
    if (m.under && m.flyFront) {
      // Cross-fade between the behind-body (idle) and front (flight) layers.
      const fb = r.flyBlend ?? 0;
      const a = under ? 1 - fb : fb;
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha *= a;
      drawMount(ctx, player, m, r.anims[m.part], highlight);
      ctx.restore();
    } else if (m.split?.front) {
      // Split sprite: the outlined piece goes on the front layer, the rest stays behind.
      drawMount(ctx, player, m, r.anims[m.part], highlight, under ? 'out' : 'in');
    } else if (!!m.under === under) drawMount(ctx, player, m, r.anims[m.part], highlight);
    if (m.wrap != null && !under) {
      // Wraps around the body: the part also draws over the rear (screen-left) shoulder,
      // clipped left of the chest so the head and torso stay in front.
      const c = bonePoint(player, 'chest');
      if (!c) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x + m.wrap * (player.drawSize || 80) - 2000, c.y - 2000, 2000, 4000);
      ctx.clip();
      drawMount(ctx, player, m, r.anims[m.part], highlight);
      ctx.restore();
    }
  }
}

/**
 * Back booster in every pose (user): the body bakes no longer carry the move2 plume
 * (bake_sd_character RAMPALION_BOOSTER_PARTS); this jet comes out of the back (bake px from
 * the chest bone), angled down-back while standing and turning back to the old baked flight
 * plume's line (up-back, a little longer) as the flight pose blends in.
 */
const JET_IDLE = { dx: -140, dy: 16, ang: 150, len: 0.5, wid: 0.11 };
// ang 168 (user: the old 198 bent up too far; turned 30 deg).
const JET_FLY = { dx: -170, dy: -30, ang: 168, len: 0.55, wid: 0.11 };
function drawBooster(ctx, player, r, s) {
  if ((r.pose && player.skillRun) || player.anim.state === 'die') return;
  const fb = r.flyBlend ?? 0;
  const J = {};
  for (const key of Object.keys(JET_IDLE)) J[key] = JET_IDLE[key] + (JET_FLY[key] - JET_IDLE[key]) * fb;
  const c = bonePoint(player, 'chest');
  const box = player.anim?._box;
  if (!c || !box) return;
  const k = s / Math.max(box.w, box.h);
  const dir = c.flip ? -1 : 1;
  const nx = c.x + J.dx * k * dir;
  const ny = c.y + J.dy * k;
  const t = player._t || 0;
  const flick = 0.9 + 0.07 * Math.sin(t * 41) + 0.05 * Math.sin(t * 73 + 1.3);
  const len = s * J.len * flick;
  const wid = s * J.wid;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(nx, ny);
  ctx.rotate(((c.flip ? 180 - J.ang : J.ang) * Math.PI) / 180);
  // Soft plume (a long ellipse, brightest at the nozzle) + a hot core.
  for (const [w, l, col, al] of [[1, 1, '235,245,255', 0.55], [0.45, 0.6, '255,255,255', 0.9]]) {
    ctx.save();
    ctx.scale((len * l) / (wid * w), 1);
    const g = ctx.createRadialGradient(wid * w * 0.15, 0, 0, wid * w * 0.35, 0, wid * w);
    g.addColorStop(0, `rgba(${col},${al})`);
    g.addColorStop(0.5, `rgba(${col},${al * 0.45})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(wid * w * 0.35, 0, wid * w, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, wid * 1.6);
  glow.addColorStop(0, `rgba(255,255,255,0.7)`);
  glow.addColorStop(1, 'rgba(200,225,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, wid * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Fusion aura + parts grafted behind Rampalion's body. (x, y) = body draw centre. */
export function drawRampalionBack(ctx, player, x, y, s) {
  const r = player?._ramp;
  if (!r) return;
  drawDashTrail(ctx, player, r, x, y, s);
  drawBooster(ctx, player, r, s);
  const attached = r.slots.filter((e) => e.attached);
  if (!attached.length) return;
  const top = RAMPALION_ROBOTS[attached[attached.length - 1].robot];
  const t = player._t || 0;
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.save();
  const k = 0.14 + 0.05 * attached.length; // stronger aura with more parts
  const g = ctx.createRadialGradient(x, y, s * 0.1, x, y, s * 0.75);
  g.addColorStop(0, `${top.aura}${k + 0.08 * pulse})`);
  g.addColorStop(1, `${top.aura}0)`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (const e of attached) drawOption(ctx, player, e.opt, r, true);
}

/** Tyrant-head shield: a warm bubble while up, shards when it breaks, a regen arc while down. */
function drawShield(ctx, player, r, x, y, s) {
  const t = player._t || 0;
  const R = s * 0.38;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (r.shieldUp) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 4);
    const up = r.shieldFlash > 0 ? 1 + r.shieldFlash * 1.2 : 1;
    const g = ctx.createRadialGradient(x, y, R * 0.55, x, y, R);
    g.addColorStop(0, 'rgba(255,120,60,0)');
    g.addColorStop(0.8, `rgba(255,120,60,${0.16 * pulse * up})`);
    g.addColorStop(1, `rgba(255,190,120,${0.4 * pulse * up})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, R, R * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hex shimmer sweeping round the rim.
    ctx.strokeStyle = `rgba(255,214,160,${0.55 * pulse})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = t * 0.8 + (i / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * R * 0.98;
      const py = y + Math.sin(a) * R * 1.03;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  } else if (r.shieldHad) {
    // Regrowing: a thin arc above the head fills up over SHIELD_REGEN.
    const k = 1 - Math.max(0, r.shieldRegen) / SHIELD_REGEN;
    ctx.strokeStyle = 'rgba(255,150,90,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - R * 0.95, s * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,190,120,0.85)';
    ctx.beginPath();
    ctx.arc(x, y - R * 0.95, s * 0.09, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.stroke();
  }
  if (r.shieldBreak > 0) {
    // Breaking: the bubble bursts outward in shards.
    const k = 1 - r.shieldBreak / 0.5;
    ctx.strokeStyle = `rgba(255,200,140,${1 - k})`;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const r0 = R * (1 + k * 0.6);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a + 0.25) * (r0 + 10), y + Math.sin(a + 0.25) * (r0 + 10));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Docking robot size, x drawSize: about Rampalion's own on-screen size (user: was 1.05). */
const DOCK_SIZE = 0.7;

/** A soft additive glow disc. */
function glowDisc(ctx, x, y, rad, rgba, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
  g.addColorStop(0.35, `${rgba}${0.5 * a})`);
  g.addColorStop(1, `${rgba}0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One robot docking: it flies in straight from behind into Rampalion's centre (user: not over
 * its head) with bright afterimages, a soft colour streak and a booster glow behind it, then
 * shrinks into the body with a ring flash.
 */
function drawDock(ctx, player, r, d, x, y, s) {
  const robot = RAMPALION_ROBOTS[d.entry.robot];
  const anim = r.anims[robot.dock];
  const g = { x, y };
  const size = s * DOCK_SIZE;
  const sx = x - 430;
  const at = (u) => {
    const e = 1 - (1 - u) ** 3; // ease-out
    return { x: sx + (g.x - sx) * e, y: g.y };
  };
  ctx.save();
  if (d.t < DOCK_FLY) {
    const u = d.t / DOCK_FLY;
    const q = at(u);
    const show = Math.max(0, Math.min(1, u * 6));
    // Soft streak along the path behind it, robot colour, fading to the tail.
    const tail = at(Math.max(0, u - 0.3));
    const len = Math.hypot(q.x - tail.x, q.y - tail.y);
    if (len > 4) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(q.x, q.y);
      ctx.rotate(Math.atan2(q.y - tail.y, q.x - tail.x));
      const lg = ctx.createLinearGradient(0, 0, -len, 0);
      lg.addColorStop(0, `${robot.aura}${0.45 * show})`);
      lg.addColorStop(1, `${robot.aura}0)`);
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(-len / 2, 0, len / 2, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Bright afterimages a beat behind it.
    if (anim?.draw) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'brightness(1.7) saturate(0.6)';
      for (let i = 3; i >= 1; i--) {
        const p2 = at(Math.max(0, u - i * 0.07));
        ctx.globalAlpha = show * 0.14 * (4 - i);
        anim.draw(ctx, p2.x, p2.y, size, { flipX: false });
      }
      ctx.restore();
    }
    // Booster glow at its back, then the robot itself.
    ctx.globalCompositeOperation = 'lighter';
    glowDisc(ctx, q.x - size * 0.3, q.y + size * 0.05, size * 0.3, robot.aura, show * (0.6 + 0.2 * Math.sin(d.t * 50)));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = show;
    anim?.draw?.(ctx, q.x, q.y, size, { flipX: false });
  } else {
    const u = (d.t - DOCK_FLY) / DOCK_MERGE;
    ctx.globalAlpha = 1 - u;
    anim?.draw?.(ctx, g.x, g.y, size * (1 - 0.65 * u), { flipX: false });
    // Docking flash: a glare and a thin ring in the robot's colour opening out.
    ctx.globalCompositeOperation = 'lighter';
    glowDisc(ctx, g.x, g.y, s * (0.16 + 0.22 * u), robot.aura, 1 - u);
    ctx.globalAlpha = 1 - u;
    ctx.strokeStyle = robot.glow;
    ctx.lineWidth = 1 + 3 * (1 - u);
    ctx.beginPath();
    ctx.arc(g.x, g.y, s * (0.12 + 0.4 * u), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Front parts, fusion / break flashes, robots docking in and parts knocked off. */
export function drawRampalionFront(ctx, player, x, y, s) {
  const r = player?._ramp;
  if (!r) return;
  drawShield(ctx, player, r, x, y, s);
  drawLegSkillFront(ctx, player, r, x, y, s);
  if (r.hyperFly) {
    // The wing blades swoop down from the top-left onto its back, trailing gold.
    const w = r.anims.fx_ramp_wings;
    if (w?.draw) {
      const k = Math.min(1, r.hyperFly.t / HYPER_FLY);
      const e = 1 - (1 - k) ** 3;
      const ox = -s * 2.4 * (1 - e);
      const oy = -s * 1.8 * (1 - e);
      w.state = player.anim.state === 'move' ? 'move' : 'idle';
      w.time = player.anim.time;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.18 * (1 - e) * (4 - i) / 3;
        ctx.filter = HYPER_GOLD;
        w.draw(ctx, x + ox * (1 + i * 0.12), y + oy * (1 + i * 0.12), s, { flipX: player.facing < 0 });
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.6 * e;
      w.draw(ctx, x + ox, y + oy, s, { flipX: player.facing < 0 });
      ctx.restore();
    }
  }
  for (const e of r.slots) if (e.attached) drawOption(ctx, player, e.opt, r, false, 0, 0);
  for (const e of r.slots) if (e.attached) drawOption(ctx, player, e.opt, r, false, 0, 1);
  // Body pieces that must stay in front of a graft (Tyrant head: Rampalion's head + front arm).
  const st = player.anim.state;
  if (st === 'idle' || st === 'move') {
    // Forearms replaced by the arm slot: the overlay must not bring them back.
    const armOff = r.slots.some((q) => q.attached && q.slot.replaces === 'arm');
    for (const e of r.slots) {
      const key = e.attached ? (armOff ? e.opt.frontOverlayNoArm : e.opt.frontOverlay) : null;
      const ov = key ? r.anims[key] : null;
      if (!ov) continue;
      ov.state = st;
      ov.time = player.anim.time;
      ov.locked = player.anim.locked;
      ov.draw(ctx, x, y, s, { flipX: player.facing < 0 });
    }
  }
  for (const e of r.slots) if (e.attached) drawOption(ctx, player, e.opt, r, false, 0, 2);
  for (const e of r.slots) if (e.attached) drawOption(ctx, player, e.opt, r, false, 0, 3);
  const fb = r.flyBlend ?? 0;
  if (fb > 0.02) for (const e of r.slots) {
    if (!e.attached) continue;
    for (const m of e.opt.mounts) if (m.boosters) drawBoosters(ctx, player, m, r.anims[m.part], fb);
  }
  const body = rampBodyAnim(player);
  if (r.fuseFlash > 0 && r.lastGraft?.attached) {
    const k = r.fuseFlash / FUSE_FLASH;
    const hl = Math.max(0, (k - 0.62) / 0.38) * 0.85;
    if (hl > 0) for (const m of r.lastGraft.opt.mounts) drawMount(ctx, player, m, r.anims[m.part], hl);
  }
  if (r.fuseFlash > 0) {
    const k = r.fuseFlash / FUSE_FLASH;
    const top = r.slots[r.slots.length - 1];
    const glow = top ? RAMPALION_ROBOTS[top.robot].glow : '#ffb347';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, k * 1.4);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 4 * k + 1;
    ctx.beginPath();
    ctx.arc(x, y, s * (0.25 + (1 - k) * 0.65), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.55 * k;
    ctx.filter = 'brightness(1.8) saturate(1.6)';
    body.draw(ctx, x, y, s, { flipX: player.facing < 0 });
    ctx.restore();
  }
  if (r.breakFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = r.breakFlash * 1.6;
    ctx.filter = 'brightness(0.8) sepia(1) saturate(8) hue-rotate(-20deg)';
    body.draw(ctx, x, y, s, { flipX: player.facing < 0 });
    ctx.restore();
  }
  // Robots flying in from the upper left (user), then collapsing onto their graft point.
  for (const d of r.docks) drawDock(ctx, player, r, d, x, y, s);
  for (const e of r.ejects) {
    const a = Math.max(0, e.t / EJECT_TIME);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    if (e.mount?.proc === 'halo') drawHalo(ctx, { x: 0, y: 0, rot: 0 }, e.size, null, 0);
    else e.anim?.draw?.(ctx, 0, 0, e.size, {});
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = RAMPALION_ROBOTS[e.opt.robot].glow;
    for (let i = 0; i < 5; i++) {
      const ang = i * 1.3 + e.t * 9;
      ctx.globalAlpha = a * 0.7;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * e.size * 0.3, Math.sin(ang) * e.size * 0.3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
