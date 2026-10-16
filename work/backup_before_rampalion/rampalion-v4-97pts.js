/**
 * 램파리온 (Rampalion) — hidden pilot: CT66 Rampart in the "램파리온 커스텀 팩" skin
 * (Unity Skin_AGS_Rampart_1 -> Model_AGS_Rampart_NS1, baked as assets/sd_baked/rampalion).
 *
 * Rules (user):
 *  - Only one life.
 *  - A hit does not cost the life: shot power drops one level instead, and the most recently
 *    fused part is knocked off. A hit at power Lv1 destroys it (game over).
 *  - The low-power supply convoy only comes on stage 1 (Game._maybeSpawnPowerRecovery).
 *  - Part-by-part fusion: every power level-up, a random AGS robot flies in, docks and grafts
 *    ONE part onto ONE body location (Lv2 back, Lv3 chest, Lv4 hand, Lv5 shoulder). Back and
 *    chest REPLACE Rampalion's own wings / lion head (body variants baked without them); hand
 *    and shoulder are ADDED. Parts ride Rampalion's bones (bake "bone_tracks" -> anim.json
 *    boneTrack), so they swing with every idle / move / skill / death pose.
 *  - The base weapon never changes: each grafted part ADDS its own bullets, fired from where
 *    the part sits (wing tips, shoulder cannon muzzle, gun barrel ...).
 *  - Form name follows the latest robot (community fan art "램파리온 합성물": 썬더 / 슈퍼노바 /
 *    그레이트 / 파이어 / 아쿠아 램파리온, 골타리온 14세); all four parts = "완전 합체".
 *
 * Unlock: title "치트활성화온", then type 램파리온 (or rampalion) on the select screen ->
 * it comes out of RANDOM (rare-fanfare.js SELECT_TYPED_CODES).
 */

export const RAMPALION_KEY = 'rampalion';

/** Robots that can dock (dock = whole-robot bake that flies in). */
export const RAMPALION_ROBOTS = {
  roc: { name: 'RF87 로크', dock: 'dock_roc', form: '썬더 램파리온', glow: '#ffe14a', aura: 'rgba(255,230,90,' },
  albatross: { name: 'HQ1 알바트로스', dock: 'dock_albatross', form: '슈퍼노바 램파리온', glow: '#5fd0ff', aura: 'rgba(120,210,255,' },
  goltarion: { name: '골타리온 XIII세', dock: 'dock_goltarion', form: '골타리온 14세', glow: '#ff2a1a', aura: 'rgba(255,70,50,' },
  seljuq: { name: 'K180 셀주크', dock: 'dock_seljuq', form: '그레이트 램파리온', glow: '#ffae00', aura: 'rgba(255,196,64,' },
  spartanb: { name: 'S25B 스파르탄 부머', dock: 'dock_spartanb', form: '파이어 램파리온', glow: '#ff4a1a', aura: 'rgba(255,100,40,' },
  watcher: { name: '와쳐 MQ-20', dock: 'dock_watcher', form: '스톰 램파리온', glow: '#8fe8ff', aura: 'rgba(140,230,255,' },
};

/**
 * Body locations, one part each, filled one per level-up in this order (Lv2..Lv5).
 * Option fields:
 *  - part: parts-only bake (fpart_*), drawn centred on the graft point.
 *  - bone: boneTrack slot it rides; x / y = graft offset from the bone in drawSize units
 *    (rest pose, Rampalion facing right), rot = extra rotation (deg), scale = part size in
 *    drawSize units, under = drawn behind the body.
 *  - gun: muzzle offset from the graft point (drawSize units) + the bullets it adds.
 */
export const RAMPALION_SLOTS = [
  {
    // Rampalion's own wing blades come off (rampalion_nowing); the new back unit sits on the
    // wing roots / upper back behind the body.
    id: 'back', label: '등', replaces: 'wing',
    options: [
      { robot: 'roc', part: 'fpart_thunder', partName: '날개', bone: 'wingB', x: -0.126, y: -0.06, rot: 28, scale: 0.506, under: true,
        gun: { x: 0.12, y: -0.12, kind: 'featherBolt' } },
      { robot: 'albatross', part: 'fpart_supernova', partName: '부스터', bone: 'body', x: -0.177, y: -0.162, rot: 0, scale: 0.273, under: true,
        gun: { x: 0.1, y: 0, kind: 'starBurst' } },
      // Cape hangs from the shoulder line to the knees, toned toward the dark-red palette.
      { robot: 'goltarion', part: 'fpart_goltarion14', partName: '망토', bone: 'body', x: -0.118, y: -0.003, rot: 0, scale: 0.55, sy: 1.25, under: true,
        filter: 'hue-rotate(35deg) saturate(0.95) brightness(0.78)',
        gun: { x: 0.3, y: -0.05, kind: 'crimsonCrescent' } },
    ],
  },
  {
    // The chest lion head comes off (rampalion_nolion); the new chest piece takes its place.
    id: 'chest', label: '가슴', replaces: 'lion',
    options: [
      // Beak turned to face forward (right).
      { robot: 'roc', part: 'fpart_rochead', partName: '맹금 흉갑', bone: 'chest', x: 0.007, y: -0.023, rot: -73, scale: 0.264, under: false,
        filter: 'brightness(1.28) saturate(1.15)',
        gun: { x: 0.08, y: 0, kind: 'talonChain' } },
      { robot: 'albatross', part: 'fpart_alhead', partName: '투구 흉갑', bone: 'chest', x: 0, y: -0.03, rot: 0, scale: 0.184, sy: 0.9, under: false,
        gun: { x: 0.08, y: 0, kind: 'visorBeam' } },
    ],
  },
  {
    // Held in the forward hand (bone handB is the hand on Rampalion's facing side).
    id: 'hand', label: '손',
    options: [
      { robot: 'spartanb', part: 'fpart_gun', partName: '부머 기관총', bone: 'handB', x: 0.105, y: 0.003, rot: 5, scale: 0.29, under: false, sway: 2.5,
        gun: { x: 0.15, y: 0.01, kind: 'rapidFire' } },
      { robot: 'watcher', part: 'fpart_watcherw', partName: '개틀링', bone: 'handB', x: 0.102, y: 0, rot: 0, scale: 0.276, under: false, sway: 2.5,
        gun: { x: 0.14, y: 0.03, kind: 'gatling' } },
    ],
  },
  {
    // Shoulder weapons: the twin cannon rests on the front pauldron (shoulderB) pointing
    // forward; the missile pods sit on the rear shoulder pad (shoulderF), clear of the head.
    id: 'shoulder', label: '어깨',
    options: [
      { robot: 'seljuq', part: 'fpart_great', partName: '어깨 쌍포', bone: 'shoulderB', x: 0.192, y: -0.076, rot: 0, scale: 0.3, sy: 1.3, under: false,
        gun: { x: 0.17, y: 0, kind: 'cannonShell' } },
      // With Albatross boosters on the back, slide the pods forward so the two don't pile up.
      { robot: 'spartanb', part: 'fpart_fire', partName: '미사일 포드', bone: 'shoulderF', x: -0.09, y: -0.175, rot: 0, scale: 0.195, under: false,
        shiftIf: { robot: 'albatross', x: 0.02 },
        gun: { x: 0.08, y: -0.03, kind: 'podMissiles' } },
    ],
  },
];

/** Body variants with Rampalion's own parts removed (same camera as the base bake). */
export const RAMPALION_BODY_KEYS = {
  wing: 'rampalion_nowing',
  lion: 'rampalion_nolion',
  'wing+lion': 'rampalion_nowinglion',
};

/** Every extra sd_baked key the kit loads (assets.ensurePlayer via CHAR_META.fusePartners). */
export const RAMPALION_ASSET_KEYS = [
  ...new Set([
    ...Object.values(RAMPALION_BODY_KEYS),
    ...RAMPALION_SLOTS.flatMap((s) => s.options.map((o) => o.part)),
    ...Object.values(RAMPALION_ROBOTS).map((r) => r.dock),
  ]),
];

const FUSE_FLASH = 0.9;
const EJECT_TIME = 1.0;
const DOCK_FLY = 0.75; // robot flies in
const DOCK_MERGE = 0.35; // robot collapses onto its graft point

/**
 * Bullets each part adds (on top of the unchanged base shot). cd = seconds between volleys;
 * damage is a fraction of the kit's shotDamage. Every kind uses an existing bullet style.
 */
const PART_WEAPONS = {
  // Roc wings: two lightning feathers from the wing tip, angled out.
  featherBolt: { cd: 0.42, fire(p, b, mx, my, dmg) {
    for (const vy of [-90, 90]) b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 980, vy, r: 4,
      damage: dmg * 0.55, lifetime: 1.4, color: '#e9fbff', glow: '#ffe14a', style: 'lightning' });
  } },
  // Albatross boosters: a three-way star spread.
  starBurst: { cd: 0.5, fire(p, b, mx, my, dmg) {
    for (const vy of [-160, 0, 160]) b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 760, vy, r: 4.5,
      damage: dmg * 0.4, lifetime: 1.6, color: '#f4fbff', glow: '#5fd0ff', style: 'marionshot' });
  } },
  // Goltarion cape: a slow, wide crimson crescent that pierces.
  crimsonCrescent: { cd: 1.0, fire(p, b, mx, my, dmg) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 560, vy: 0, r: 9, pierce: true,
      damage: dmg * 0.9, lifetime: 1.6, color: '#ff6a3d', glow: '#ff2a1a', style: 'cleave' });
  } },
  // Albatross helmet on the chest: a short visor beam.
  visorBeam: { cd: 0.9, fire(p, b, mx, my, dmg) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 1250, vy: 0, r: 4, pierce: true,
      damage: dmg * 0.8, lifetime: 0.8, color: '#e8fbff', glow: '#3aa8ff', style: 'railbeam' });
  } },
  // Roc head on the chest: a homing talon bolt.
  talonChain: { cd: 0.7, fire(p, b, mx, my, dmg, target) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 520, vy: -40, accel: 1600, maxSpeed: 900,
      homing: 6, homingTarget: target, r: 5, damage: dmg * 0.75, lifetime: 2.2,
      color: '#fff6c8', glow: '#ffe14a', style: 'p38missile' });
  } },
  // Spartan Boomer machine gun in the hand: fast straight rounds.
  rapidFire: { cd: 0.11, fire(p, b, mx, my, dmg) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 1100, vy: (Math.random() - 0.5) * 50, r: 3,
      damage: dmg * 0.22, lifetime: 1.2, color: '#ffe6b0', glow: '#ff7a2a', style: 'coffinround' });
  } },
  // Watcher gatling in the hand: a fanned stream of fast rounds.
  gatling: { cd: 0.16, fire(p, b, mx, my, dmg) {
    for (const vy of [-70, 70]) b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 1250, vy: vy + (Math.random() - 0.5) * 40, r: 3,
      damage: dmg * 0.18, lifetime: 1.1, color: '#e8fbff', glow: '#8fe8ff', style: 'p38shot' });
  } },
  // Seljuq shoulder cannon: a heavy shell that bursts on impact.
  cannonShell: { cd: 1.1, fire(p, b, mx, my, dmg) {
    b.spawn({ friendly: true, grazeable: false, x: mx, y: my, vx: 700, vy: 0, r: 8, blastRadius: 46,
      damage: dmg * 1.5, lifetime: 1.8, color: '#ffe58a', glow: '#ffae00', style: 'shell' });
  } },
  // Spartan Boomer missile pods: a pair of homing missiles.
  podMissiles: { cd: 0.8, fire(p, b, mx, my, dmg, target, target2) {
    [target, target2 || target].forEach((t, i) => b.spawn({ friendly: true, grazeable: false, x: mx, y: my + (i ? 6 : -6),
      vx: 260, vy: i ? 120 : -120, accel: 1500, maxSpeed: 820, homing: 5.5, homingTarget: t, r: 5,
      damage: dmg * 0.6, lifetime: 2.6, delay: i * 0.08, color: '#fff1c8', glow: '#ff4a1a', style: 'p38missile' }));
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
  // Variants share the base camera box so they overlay pixel-exact.
  for (const key of Object.values(RAMPALION_BODY_KEYS)) {
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
 * Level-up: a random robot flies in and docks; its part fills the next body location.
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
 * Power lost (hit / body contact / practice key): the newest part is knocked off.
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
      const g = graftPoint(player, last.opt);
      const s = player.drawSize || 80;
      r.ejects.push({
        opt: last.opt, anim: r.anims[last.opt.part],
        x: g ? g.x : player.x, y: g ? g.y : player.y, rot: g ? g.rot : 0,
        vx: -150 - Math.random() * 80, vy: -240 - Math.random() * 60,
        vr: -2.4 - Math.random(), t: EJECT_TIME, size: s * last.opt.scale,
      });
    }
  } while (all && r.slots.length);
  if (!silent) r.breakFlash = 0.45;
  return last;
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
  if (r.fuseFlash > 0) r.fuseFlash = Math.max(0, r.fuseFlash - dt);
  if (r.breakFlash > 0) r.breakFlash = Math.max(0, r.breakFlash - dt);
  for (const [key, a] of Object.entries(r.anims)) {
    // Body variants are slaved to the base clock in rampBodyAnim.
    if (a && !key.startsWith('rampalion_')) a.update(dt);
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
  let wing = false;
  let lion = false;
  for (const e of r.slots) {
    if (!e.attached) continue;
    if (e.slot.replaces === 'wing') wing = true;
    if (e.slot.replaces === 'lion') lion = true;
  }
  const key = wing && lion ? 'wing+lion' : wing ? 'wing' : lion ? 'lion' : null;
  const v = key ? r.anims[RAMPALION_BODY_KEYS[key]] : null;
  if (!v) return base;
  // Variants carry idle / move / skill1 (attack) / skill2 on the base camera.
  if ((st === 'attack' && !v.hasAttack) || (st === 'skill2' && !v.hasSkill2)) return base;
  v.state = st;
  v.time = base.time;
  v.locked = base.locked;
  return v;
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
  const fps = anim.fps?.[st] || 24;
  const n = clip.length;
  const f = Math.floor(anim.time * fps);
  const idx = anim.locked || st === 'die' ? Math.min(n - 1, f) : ((f % n) + n) % n;
  const [hx, hy, ang, sc] = clip[Math.max(0, idx)];
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
  return { x, y, rot, scale: rest[3] ? sc / rest[3] : 1, flip };
}

/** Where a part's centre sits right now (bone point + offset rotated with the bone). */
function graftPoint(player, opt) {
  const b = bonePoint(player, opt.bone);
  if (!b) return null;
  const s = player.drawSize || 80;
  const dir = b.flip ? -1 : 1;
  const shift = opt.shiftIf && player._ramp?.slots.some((e) => e.opt !== opt && e.robot === opt.shiftIf.robot)
    ? (opt.shiftIf.x || 0) : 0;
  const ox = (opt.x + shift) * s * dir;
  const oy = opt.y * s;
  const c = Math.cos(b.rot);
  const sn = Math.sin(b.rot);
  // Optional walk sway (deg) so held weapons lean with the forearm in the move cycle.
  const a = player.anim;
  const sway = opt.sway && a?.state === 'move'
    ? Math.sin((a.time / ((a.clips?.move?.length || 21) / (a.fps?.move || 24))) * Math.PI * 2) * opt.sway : 0;
  return {
    x: b.x + ox * c - oy * sn,
    y: b.y + ox * sn + oy * c,
    rot: b.rot + (((opt.rot || 0) + sway) * Math.PI / 180) * dir,
    scale: b.scale,
    flip: b.flip,
  };
}

function muzzlePoint(player, opt) {
  const g = graftPoint(player, opt);
  if (!g) return null;
  const s = player.drawSize || 80;
  const dir = g.flip ? -1 : 1;
  const gx = (opt.gun?.x || 0) * s * dir;
  const gy = (opt.gun?.y || 0) * s;
  const c = Math.cos(g.rot);
  const sn = Math.sin(g.rot);
  return { x: g.x + gx * c - gy * sn, y: g.y + gx * sn + gy * c };
}

function drawPart(ctx, player, opt, anim, highlight = 0) {
  if (!anim?.draw) return;
  const g = graftPoint(player, opt);
  if (!g) return;
  const s = (player.drawSize || 80) * opt.scale * g.scale;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.rot);
  if (opt.sy) ctx.scale(1, opt.sy);
  if (opt.filter) ctx.filter = opt.filter;
  anim.draw(ctx, 0, 0, s, { flipX: g.flip });
  if (highlight > 0) {
    // Freshly grafted part flashes white so it reads inside the fusion ring.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = highlight;
    ctx.filter = 'brightness(2.2) saturate(0.3)';
    anim.draw(ctx, 0, 0, s, { flipX: g.flip });
  }
  ctx.restore();
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
  for (const e of attached) if (e.opt.under) drawPart(ctx, player, e.opt, r.anims[e.opt.part]);
}

/** Front parts, fusion / break flashes, robots docking in and parts knocked off. */
export function drawRampalionFront(ctx, player, x, y, s) {
  const r = player?._ramp;
  if (!r) return;
  for (const e of r.slots) if (e.attached && !e.opt.under) drawPart(ctx, player, e.opt, r.anims[e.opt.part]);
  const body = rampBodyAnim(player);
  if (r.fuseFlash > 0 && r.lastGraft?.attached) {
    const k = r.fuseFlash / FUSE_FLASH;
    drawPart(ctx, player, r.lastGraft.opt, r.anims[r.lastGraft.opt.part], Math.min(1, k * 1.6) * 0.8);
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
    ctx.arc(x, y, s * (0.25 + (1 - k) * 0.9), 0, Math.PI * 2);
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
    const g = graftPoint(player, d.entry.opt) || { x, y };
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
    e.anim?.draw?.(ctx, 0, 0, e.size, {});
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
