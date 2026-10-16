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
 *    docks and swaps ONE body location: Lv2 chest (replaces the lion head), Lv3 arm,
 *    Lv4 back (replaces the wing blades), Lv5 legs (replaces the shins and feet). Replaced
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
};

/**
 * Body locations, one per power stage, filled in this order (Lv2..Lv5). An option is one
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
      { robot: 'aeda', partName: '에너지 코어', mounts: [{ part: 'fc_aedaorb', bone: 'chest', x: 0.005, y: -0.015, rot: 0, scale: 0.1725, under: false, filter: 'brightness(1.9) saturate(1.3)', glow: 'rgba(130,215,255,' }],
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
        { part: 'fa_golt_L', seg: ['armBd1', 'armBd5'], t: 0.6, x: 0, y: -0.027, rot: 0, scale: 0.28, under: false, still: true },
        // Screen-left arm: always over the body / blade decorations (user; was behind at idle).
        // Sits on the elbow at idle too (x 0.041 -> 0.085; flight keeps the same total offset),
        // and holds its first frame so it does not wave on its own (user: awkward motion).
        { part: 'fa_golt_R', seg: ['armFd1', 'handFs'], t: 0.6, x: 0.085, y: -0.04, rot: 0, scale: 0.5, under: false, still: true, z: 2, flyDx: 0.011, flyDy: 0.015, filter: 'brightness(0.88)' }],
        gun: { mount: 0, x: 0.06, y: 0.06, kind: 'clawSlash' } },
    ],
  },
  {
    // Rampalion's own wing blades come off (rampalion_nowing); the new back unit sits on
    // the wing roots / upper back behind the body.
    id: 'back', label: '등', replaces: 'wing',
    options: [
      { robot: 'roc', partName: '날개', mounts: [{ part: 'fpart_thunder', bone: 'wingB', x: -0.126, y: -0.03, rot: 13, flyRot: 5, scale: 0.658, under: true,
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
        gun: { mount: 1, x: 0.04, y: 0.04, kind: 'shadowNeedles' } },
      { robot: 'alfred', partName: '다리', mounts: [
        { part: 'fleg_alfred_F', seg: ['kneeF', 'footF'], t: 0.55, x: 0, y: 0, rot: -24, scale: 0.235, under: false, filter: 'brightness(0.92) contrast(0.88)' },
        { part: 'fleg_alfred_B', seg: ['kneeB', 'footB'], t: 0.55, x: 0, y: 0, rot: -5, scale: 0.235, under: false, filter: 'brightness(0.92) contrast(0.88)' }],
        gun: { mount: 1, x: 0.04, y: 0.04, kind: 'gentleDrones' } },
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

/** Every extra sd_baked key the kit loads (assets.ensurePlayer via CHAR_META.fusePartners). */
/** Parts that hold their first frame (no idle animation of their own). */
const STILL_PARTS = new Set(RAMPALION_SLOTS.flatMap((s) => s.options.flatMap((o) => o.mounts.filter((m) => m.still).map((m) => m.part))));

export const RAMPALION_ASSET_KEYS = [
  ...new Set([
    ...Object.values(RAMPALION_BODY_KEYS),
    ...RAMPALION_SLOTS.flatMap((s) => s.options.flatMap((o) => o.mounts.map((m) => m.part))),
    ...Object.values(RAMPALION_ROBOTS).map((r) => r.dock),
    ...RAMPALION_SLOTS.flatMap((s) => s.options.flatMap((o) => [o.frontOverlay, o.frontOverlayNoArm]).filter(Boolean)),
  ]),
];

const FUSE_FLASH = 1.2;
const EJECT_TIME = 1.0;
const DOCK_FLY = 0.75; // robot flies in
const DOCK_MERGE = 0.35; // robot collapses onto its graft point

/**
 * Bullets each part adds (on top of the unchanged base shot). cd = seconds between volleys;
 * damage is a fraction of the kit's shotDamage. Every kind uses an existing bullet style.
 */
const PART_WEAPONS = {

  // Goltarion arms: a violet claw slash that pierces.
  clawSlash: { cd: 0.8, fire(p, b, mx, my, dmg) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 620, vy: 0, r: 10, pierce: true,
      damage: dmg * 0.9, lifetime: 1.3, color: '#e7c9ff', glow: '#a855f7', style: 'cleave' });
  } },
  // Tyrant head: a roaring fire blast cone of three flames.
  dinoRoar: { cd: 0.85, fire(p, b, mx, my, dmg) {
    for (const vy of [-110, 0, 110]) b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 760, vy, r: 6,
      damage: dmg * 0.4, lifetime: 0.9, color: '#ffd28a', glow: '#ff5a2a', style: 'foxflame' });
  } },
  // Aeda core: a slow piercing energy orb.
  orbPulse: { cd: 1.0, fire(p, b, mx, my, dmg) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 520, vy: 0, r: 8, pierce: true,
      damage: dmg * 1.0, lifetime: 2.0, color: '#e8f8ff', glow: '#7fd8ff', style: 'marionshot' });
  } },
  // Roc chest: a homing talon bolt.
  talonChain: { cd: 0.7, fire(p, b, mx, my, dmg, target) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 520, vy: -40, accel: 1600, maxSpeed: 900,
      homing: 6, homingTarget: target, r: 5, damage: dmg * 0.75, lifetime: 2.2,
      color: '#fff6c8', glow: '#ffe14a', style: 'p38missile' });
  } },
  // Roc wings: two lightning feathers from the wing tip, angled out.
  // Roc wings: Express-style full-width laser in gold, one from each wing tip (beam: fired
  // through the player's sub-beam, damage per 0.05 s tick x shotDamage).
  wingLaser: { cd: 1.1, beam: { dur: 0.28, half: 5, dmg: 0.6, dy: 3,
    pal: ['#ffb51f', '#ffd84a', '#fffbe0', '255,226,140', '255,170,30'] } },
  // Spartan Boomer missile pods: a pair of homing missiles.
  podMissiles: { cd: 0.8, fire(p, b, mx, my, dmg, target, target2) {
    [target, target2 || target].forEach((t, i) => b.spawn({ friendly: true, grazeable: false, x: mx, y: my + (i ? 6 : -6),
      vx: 260, vy: i ? 120 : -120, accel: 1500, maxSpeed: 820, homing: 5.5, homingTarget: t, r: 5,
      damage: dmg * 0.6, lifetime: 2.6, delay: i * 0.08, color: '#fff1c8', glow: '#ff4a1a', style: 'p38missile' }));
  } },
  // Aeda halo ring: three slow homing star orbs.
  haloOrbs: { cd: 0.9, fire(p, b, mx, my, dmg, target) {
    for (const vy of [-150, 0, 150]) b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 420, vy,
      homing: 3, homingTarget: target, r: 4.5, damage: dmg * 0.42, lifetime: 2.2,
      color: '#fffbe8', glow: '#ffd76a', style: 'marionshot' });
  } },
  // Roc legs: a pair of rockets from the talons.
  clawRockets: { cd: 0.75, fire(p, b, mx, my, dmg, target) {
    for (const vy of [-30, 30]) b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 420, vy, accel: 1700, maxSpeed: 1000,
      homing: 3.5, homingTarget: target, r: 4.5, damage: dmg * 0.5, lifetime: 2.0,
      color: '#fff6c8', glow: '#ffe14a', style: 'p38missile' });
  } },
  // Shade legs: quick teal needles skimming low.
  shadowNeedles: { cd: 0.3, fire(p, b, mx, my, dmg) {
    for (const vy of [-25, 25]) b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 1150, vy, r: 3,
      damage: dmg * 0.3, lifetime: 1.2, color: '#dffff4', glow: '#3fe0b0', style: 'p38shot' });
  } },
  // Mr. Alfred legs: a gentleman's homing drone shot.
  gentleDrones: { cd: 0.6, fire(p, b, mx, my, dmg, target) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 380, vy: -60, accel: 1200, maxSpeed: 780,
      homing: 5, homingTarget: target, r: 5, damage: dmg * 0.7, lifetime: 2.4,
      color: '#fff4d8', glow: '#ffcf5a', style: 'p38missile' });
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
  for (const key of [...Object.values(RAMPALION_BODY_KEYS), ...overlayKeys]) {
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
  const idx = r.slots.length;
  if (idx >= RAMPALION_SLOTS.length) return null;
  const slot = RAMPALION_SLOTS[idx];
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

/** Grafted parts fire their own bullets (called with the main shot cadence). */
export function fireRampalionParts(player, bullets) {
  const r = player?._ramp;
  if (!r) return;
  const dmg = player.meta?.shotDamage || 1;
  const ranked = (bullets.targets || []).filter((e) => e.alive && e.x > player.x + 20)
    .sort((a, b) => (a.x - player.x) ** 2 + (a.y - player.y) ** 2 - ((b.x - player.x) ** 2 + (b.y - player.y) ** 2));
  for (const e of r.slots) {
    if (!e.attached || e.cd > 0) continue;
    const w = PART_WEAPONS[e.opt.gun?.kind];
    if (!w) continue;
    const mz = e.opt.gun.muzzles;
    if (mz && w.beam) {
      // Beam weapon: the player's sub-beam, poured from the part's muzzles (follows the art).
      if (player._subBeam) continue;
      const mt = e.opt.mounts[e.opt.gun.mount || 0];
      const B = w.beam;
      player._subBeam = { t: 0, lv: player.shotLevel, dur: B.dur, half: B.half, dmg: dmg * B.dmg, pal: B.pal,
        pts: () => mz.map(([bx, by, piece]) => partPoint(player, mt, r.anims[mt.part], bx, by, piece))
          .filter(Boolean).map((q) => ({ x: q.x, y: q.y + (B.dy || 0) })) };
      e.cd = w.cd;
      continue;
    }
    if (mz) {
      // Several muzzles on the part's art: one shot from each.
      const mt = e.opt.mounts[e.opt.gun.mount || 0];
      for (const [bx, by, piece] of mz) {
        const q = partPoint(player, mt, r.anims[mt.part], bx, by, piece);
        if (q) w.fire(player, bullets, q.x, q.y, dmg, ranked[0] || null, ranked[1] || null);
      }
      e.cd = w.cd;
      continue;
    }
    const m = muzzlePoint(player, e.opt);
    if (!m) continue;
    w.fire(player, bullets, m.x, m.y, dmg, ranked[0] || null, ranked[1] || null);
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
  const clip = tr[st] || tr.idle;
  if (!clip?.length) return null;
  const [hx, hy, ang, sc] = clip[frameIndex(anim, clip.length)];
  const rest = tr.idle?.[0] || clip[0];
  const size = (player.drawSize || 80) * (anim.drawScale?.[st] || 1);
  const aspect = box.w / box.h;
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  const k = w / box.w;
  const cx = player.x + (player.drawOffsetX || 0) + (player.bombDx || 0);
  const cy = player.y + (player.drawOffsetY || 0) + (player.bombDy || 0);
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
  const oy = ((m.y || 0) + (m.flyDy || 0) * fb) * s;
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
  if (m.proc === 'halo') { drawHalo(ctx, g, (player.drawSize || 80) * m.scale * g.scale, m.glow, highlight); return; }
  if (!anim?.draw) return;
  const s = (player.drawSize || 80) * m.scale * g.scale;
  ctx.save();
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
    ctx.globalCompositeOperation = 'source-over';
  }
  const paint = (dy, piece) => {
    ctx.save();
    ctx.translate(g.x, g.y + dy);
    ctx.rotate(g.rot + (piece === 'in' ? (m.split.rot || 0) * Math.PI / 180 : 0));
    if (m.sy) ctx.scale(1, m.sy);
    if (piece) splitClip(ctx, anim, s, m.split.poly, piece === 'in');
    if (m.filter) ctx.filter = m.filter;
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
    // 2 = over Rampalion's own head / upper-arm overlay too (a hand in front of its elbow).
    if (!under && Math.min(2, m.z || 0) !== zLevel) continue;
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

/** Fusion aura + parts grafted behind Rampalion's body. (x, y) = body draw centre. */
export function drawRampalionBack(ctx, player, x, y, s) {
  const r = player?._ramp;
  if (!r) return;
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

/** Front parts, fusion / break flashes, robots docking in and parts knocked off. */
export function drawRampalionFront(ctx, player, x, y, s) {
  const r = player?._ramp;
  if (!r) return;
  drawShield(ctx, player, r, x, y, s);
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
  // Robots flying in from the upper right, then collapsing onto their graft point.
  for (const d of r.docks) {
    const robot = RAMPALION_ROBOTS[d.entry.robot];
    const anim = r.anims[robot.dock];
    const g = graftPoint(player, d.entry.opt.mounts[0]) || { x, y };
    ctx.save();
    if (d.t < DOCK_FLY) {
      const u = d.t / DOCK_FLY;
      const e = 1 - (1 - u) ** 3; // ease-out
      const sx = x + 430;
      const sy = y - 170;
      const px = sx + (g.x - sx) * e;
      const py = sy + (g.y - sy) * e - Math.sin(u * Math.PI) * 40;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = robot.glow;
      ctx.globalAlpha = 0.55 * (1 - u) * Math.max(0, Math.min(1, (u - 0.08) * 5));
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(px + 30 + i * 6, py - 12 + i * 9);
        ctx.lineTo(px + 120 + i * 14, py - 60 + i * 5);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.max(0, Math.min(1, (u - 0.08) * 3.5));
      if (ctx.globalAlpha > 0) anim?.draw?.(ctx, px, py, s * 1.05, { flipX: true });
    } else {
      const u = (d.t - DOCK_FLY) / DOCK_MERGE;
      ctx.globalAlpha = 1 - u;
      anim?.draw?.(ctx, g.x, g.y, s * (1.05 - 0.6 * u), { flipX: true });
      // Soft docking glare (robot colour rim) rather than a flat disc.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - u;
      const rad = s * (0.18 + 0.32 * u);
      const glare = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, rad);
      glare.addColorStop(0, 'rgba(255,255,255,0.85)');
      glare.addColorStop(0.45, `${robot.aura}0.45)`);
      glare.addColorStop(1, `${robot.aura}0)`);
      ctx.fillStyle = glare;
      ctx.beginPath();
      ctx.arc(g.x, g.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
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
