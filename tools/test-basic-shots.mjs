import assert from 'node:assert/strict';
import { AssetBank } from '../js/assets.js';
import { Player } from '../js/player.js';
import { Bullet } from '../js/bullet.js';
import { Game } from '../js/game.js';
import {
  fireCharacterCharge,
  pickSplitTarget,
  rankChargeTargets,
  volleyFan,
  volleyOffset,
} from '../js/weapon-skills.js';

const meta = new AssetBank().CHAR_META;
/** Main-shot bullet counts per power level — identity via size/trajectory/function, not clone spam. */
const expected = {
  hirume: [1, 1, 3, 4, 6],
  constantia: [1, 1, 3, 4, 5],
  lrl: [1, 2, 2, 2, 2],
  merlin: [1, 1, 1, 2, 2],
  fafnir: [1, 1, 1, 1, 1],
  eternity: [1, 2, 2, 3, 4],
  labiata: [2, 2, 2, 2, 2],
  emily: [1, 1, 1, 1, 1],
};

const shots = {};
for (const [key, levels] of Object.entries(expected)) {
  shots[key] = [];
  for (let level = 1; level <= 5; level++) {
    const player = { x: 120, y: 300, meta: meta[key], shotLevel: level, focus: false, _shotCounter: 0 };
    const volley = [];
    Player.prototype.shoot.call(player, { spawn: (shot) => volley.push(shot) });
    assert.equal(volley.length, levels[level - 1], `${key} Lv${level} shot count`);
    assert(volley.every((shot) => shot.friendly && shot.damage > 0));
    shots[key][level] = volley;
  }
}

// Identity checks: upgrades change size / trajectory / function, not only count.
assert(shots.hirume[1][0].vx > 700 && (shots.hirume[1][0].ay || 0) === 0
  && shots.hirume[1][0].style === 'foxflame' && (shots.hirume[1][0].homing || 0) === 0,
  'Hirume Lv1 must fire a forward fire jet, not falling napalm');
assert(shots.hirume[2][0].r > shots.hirume[1][0].r, 'Hirume Lv2 grows flame caliber');
assert(shots.hirume[3].some((s) => s.vy < 0) && shots.hirume[3].some((s) => s.vy > 0),
  'Hirume Lv3 widens into a real fan');
assert(shots.hirume[2][0].pierce, 'Hirume jets pierce from Lv2');
assert(shots.constantia[2][0].pierce, 'Constantia Lv2 unlocks pierce');
assert(shots.constantia[3].length === 3, 'Constantia Lv3 adds extra rifle slugs');
assert(shots.constantia[5].some((s) => s.delay >= 0.1 && s.pierce), 'Constantia Lv5 extra delayed slug');
assert(shots.lrl[1][0].nativeKey === 'lrl-arrow' && shots.lrl[1][0].vy === 0,
  'Aine-style Lv1 is one narrow forward arrow');
for (let lv = 2; lv <= 5; lv++) {
  assert(shots.lrl[lv][0].nativeKey === 'lrl-arrow' && shots.lrl[lv][1].nativeKey === 'lrl',
    `LRL Lv${lv} must pair the arrow with a sword wave`);
  assert(shots.lrl[lv].every(s => s.vx > 0 && s.vy === 0));
}
assert(shots.lrl[3][1].pierce && !shots.lrl[2][1].pierce,
  'Power 3 upgrades the wave to pierce');
assert(shots.lrl[5][1].r > shots.lrl[2][1].r,
  'Higher power widens the sword wave without turning arrows into a fan');
assert(shots.merlin[5][0].blastRadius > shots.merlin[1][0].blastRadius);
assert(shots.merlin[4][1].delay > 0 && shots.merlin[3].length === 1);
assert(shots.fafnir[1][0].homing > 0 && shots.fafnir[1][0].chainCount === 0);
assert.equal(shots.fafnir[3][0].chainCount, 1);
assert.equal(shots.fafnir[5][0].chainCount, 3);
assert(shots.eternity[5].every(s => s.vy === 0 && s.pierce));
assert.equal(new Set(shots.eternity[5].map(s => s.delay)).size, 4);
assert(shots.labiata[1][1].orbitOwner && !shots.labiata[1][0].orbitOwner);
assert(shots.labiata[1][1].damage > shots.labiata[1][0].damage);
assert(shots.labiata[5][1].clearRadius > 0 && !shots.labiata[1][1].clearRadius);
assert(shots.emily.slice(1).every((volley) => volley[0].style === 'railbeam'
  && volley[0].pierce && volley[0].vy === 0), 'Emily basic shot is always a straight laser');
for (let lv = 2; lv <= 5; lv++) {
  assert(shots.emily[lv][0].r > shots.emily[lv - 1][0].r,
    `Emily Lv${lv} laser must grow wider`);
  assert(shots.emily[lv][0].beamLength > shots.emily[lv - 1][0].beamLength,
    `Emily Lv${lv} laser must grow longer`);
}
{
  const player = { charKey: 'emily', meta: meta.emily, alive: true,
    x: 120, y: 300, shotLevel: 5 };
  const options = [];
  const charge = [];
  Player.prototype.fireOptions.call(player, { targets: [], spawn: (spec) => options.push(spec) });
  fireCharacterCharge(player, { targets: [], spawn: (spec) => charge.push(spec) });
  assert.equal(options.length, 0, 'Emily must have no option projectiles');
  assert.equal(charge.length, 0, 'Emily must have no charge shot');
}
{
  const player = Object.assign(Object.create(Player.prototype), {
    charKey: 'emily', meta: meta.emily, alive: true,
    x: 120, y: 300, shotLevel: 5, focus: false,
    deathBombTimer: 0, respawnTimer: 0, invuln: 0,
    bombFlash: 0, specialFlash: 0, powerFlashT: 0,
    fireCooldown: 0, charge: 0, _chargeQueued: false,
    _shootQueued: false, _wasShooting: false,
    _tickLocomotion() {},
  });
  const spawned = [];
  const pool = { targets: [], spawn: (spec) => spawned.push(spec) };
  for (let frame = 0; frame < 150; frame++) {
    player.update(1 / 60, { shoot: true, autoFire: false }, pool);
  }
  assert(spawned.some((shot) => shot.style === 'railbeam' && !shot.charge),
    'Holding Emily FIRE must still stream the basic laser');
  assert(!spawned.some((shot) => shot.charge),
    'Holding Emily FIRE must not release charge shots');
}

// Lv2 escort shots must add a new path or function, not a copy of the core.
for (const key of Object.keys(expected)) {
  if (!['hirume', 'constantia'].includes(key)) continue;
  const player = {
    x: 120, y: 300, meta: meta[key], shotLevel: 2, focus: false,
    _shotCounter: 1, _t: 0.7,
  };
  const support = [];
  Player.prototype.fireOptions.call(player, { spawn: (shot) => support.push(shot) });
  assert(support.length > 0, `${key} Lv2 should unlock an escort shot`);
  const core = shots[key][2][0];
  assert(support.some((shot) =>
    shot.style !== core.style || shot.vy !== core.vy || shot.ay !== core.ay
    || shot.waveShape !== core.waveShape || shot.waveAmplitude !== core.waveAmplitude
    || shot.blastRadius !== core.blastRadius || shot.x !== core.x
    || shot.y !== core.y || shot.r !== core.r), `${key} escort must differ from core`);
}

const arc = new Bullet({ x: 0, y: 0, vx: 100, vy: -50, ay: 100 });
arc.update(1);
assert.equal(arc.y, 0, 'curved shot should bend back to its starting lane');
assert.equal(arc.vy, 50);

// Role checks use live target coordinates, then advance the real Bullet movement.
const enemy = { alive: true, x: 600, y: 220, hp: 20 };
for (const targetY of [220, 380]) {
  const escort = [];
  Player.prototype.fireOptions.call({
    x: 120, y: 300, meta: meta.constantia, shotLevel: 2,
    focus: false, _shotCounter: 1,
  }, {
    targets: [{ alive: true, x: 600, y: targetY, hp: 20 }],
    spawn: (spec) => escort.push(spec),
  });
  const shot = escort[0];
  const travel = (600 - shot.x) / shot.vx;
  assert(Math.abs(shot.y + shot.vy * travel - targetY) < 1,
    'Constantia power-up escort must aim at its selected enemy');
}
const roleShot = (key) => {
  const spawned = [];
  const player = { x: 120, y: 300, w: 1593, meta: meta[key], shotLevel: 1,
    focus: false, _shotCounter: 0 };
  Player.prototype.shoot.call(player, {
    targets: [enemy], spawn: (spec) => spawned.push(spec),
  });
  return { player, shot: spawned[0], shots: spawned };
};
const artillery = roleShot('merlin').shot;
assert(artillery.style === 'shell' && artillery.vx > 0,
  'Merlin Big Gun must fire a forward cannon slug');
const flyingShell = new Bullet(artillery);
let merlinHit = false;
for (let frame = 0; frame < 180 && flyingShell.alive; frame++) {
  flyingShell.update(1 / 60, [enemy]);
  if (Game.prototype._friendlyHitsEnemy(flyingShell, { ...enemy, hitR: 28 })) {
    merlinHit = true;
    break;
  }
}
assert(merlinHit, 'Merlin cannon slug must close on the selected lane');
const searchBolt = roleShot('fafnir').shot;
assert(searchBolt.x < enemy.x && searchBolt.homingTarget === enemy);
const trackingBolt = new Bullet(searchBolt);
trackingBolt.update(0.1, [enemy]);
assert(trackingBolt.x > searchBolt.x && trackingBolt.y < searchBolt.y,
  'Fafnir search bolt must advance and steer toward the target');
const axeRole = roleShot('lrl');
const travellingSlash = new Bullet(axeRole.shot);
travellingSlash.update(0.3);
assert(travellingSlash.vx > 0);
travellingSlash.update(0.3);
assert(travellingSlash.vx > 0 && travellingSlash.x > enemy.x - 120,
  'LRL slash must keep travelling through the enemy side of the screen');
for (const key of ['hirume', 'lrl', 'fafnir']) {
  const aligned = { alive: true, x: 680, y: key === 'fafnir' ? 220 : 300, hitR: 22 };
  const player = { x: 120, y: 300, w: 1593, meta: meta[key], shotLevel: 1,
    focus: false, _shotCounter: 0 };
  const specs = [];
  Player.prototype.shoot.call(player, {
    targets: [aligned], spawn: (spec) => specs.push(spec),
  });
  const projectile = new Bullet(specs[0]);
  let hit = false;
  for (let frame = 0; frame < 120 && projectile.alive; frame++) {
    projectile.update(1 / 60, [aligned]);
    if (Game.prototype._friendlyHitsEnemy(projectile, aligned)) { hit = true; break; }
  }
  assert(hit, `${key} Lv1 basic shot must reach and hit an enemy on the far side`);
}
const slash = new Bullet(roleShot('labiata').shots.find(s => s.orbitOwner));
const slashX = slash.x, slashY = slash.y;
slash.update(0.1);
assert(slash.x !== slashX && slash.y !== slashY, 'Labiata blade must orbit the pilot');

// Hold-FIRE enhanced shot must scale with P (count and/or mass).
for (const key of Object.keys(expected)) {
  if (key === 'emily') continue;
  const sizes = [];
  for (const level of [1, 5]) {
    const player = {
      charKey: key, meta: meta[key], alive: true, x: 120, y: 300, shotLevel: level,
    };
    const pool = [];
    fireCharacterCharge(player, {
      targets: [{ alive: true, x: 500, y: 300, hitR: 20 }],
      spawn: (spec) => pool.push(spec),
    });
    assert(pool.length > 0, `${key} hold shot empty at Lv${level}`);
    sizes.push({
      n: pool.length,
      r: pool.reduce((s, b) => s + (b.r || 0), 0),
      dmg: pool.reduce((s, b) => s + (b.damage || 0), 0),
    });
  }
  assert(
    sizes[1].n > sizes[0].n || sizes[1].r > sizes[0].r * 1.15 || sizes[1].dmg > sizes[0].dmg * 1.2,
    `${key} hold shot should grow with power`,
  );
}

// Hold archetypes: each kit keeps a distinct behaviour family (not shared homing/laser clones).
{
  const sample = (key, level = 2) => {
    const pool = [];
    fireCharacterCharge(
      { charKey: key, meta: meta[key], alive: true, x: 120, y: 300, shotLevel: level, w: 1593 },
      { targets: [{ alive: true, x: 500, y: 300, hitR: 20 }], spawn: (spec) => pool.push(spec) },
    );
    return pool;
  };
  const hirume = sample('hirume');
  assert(hirume.every((b) => (b.homing || 0) > 0 && b.blastRadius > 0
    && b.style === 'sunbird' && !(b.ay > 0)),
    'Hirume hold is a seeking phoenix wing-fan, not falling napalm');
  assert(hirume.every((b) => b.style !== 'flameward'));
  const constantia = sample('constantia');
  assert(constantia.length === 1 && constantia[0].style === 'lockround'
    && !(constantia[0].beamLength > 0) && constantia[0].pierce
    && (constantia[0].homing || 0) === 0 && (constantia[0].ay || 0) > 0,
  'Constantia hold is a dropping Winchester slug, not a laser lance');
  assert(constantia[0].r > 10, 'charged slug must be visibly fatter than basic tracers');
  const lrl = sample('lrl');
  assert(lrl.length === 1 && lrl.every((b) => !b.returnOwner && (b.homing || 0) === 0
    && b.vx > 0 && b.vy === 0 && b.style === 'dragonaxe' && b.pierce
    && (b.blastRadius || 0) > 0),
    'LRL hold is one forward thrown axe');
  const merlin = sample('merlin');
  assert(merlin.every((b) => b.vx > 0 && b.vy === 0 && b.blastRadius > 0 && (b.homing || 0) === 0),
    'Merlin hold is a horizontal breaching shell, not basic vertical artillery');
  const fafnir = sample('fafnir');
  assert(fafnir.every((b) => b.style === 'jupiterorb' && b.chainCount > 0 && b.clearRadius > 0),
    'Fafnir hold is a chain thunder field');
  const eternity = sample('eternity');
  assert(eternity.every((b) => b.style === 'coffinwall' && b.clearRadius > 0 && b.vx === 0),
    'Eternity hold is a local defensive barricade');
  const labiata = sample('labiata');
  assert(labiata.every((b) => b.style === 'plasmaslash' && (b.waveAmplitude || 0) > 0
    && !(b.beamLength > 0)), 'Labiata hold is a crescent slash wave');
  const emily = sample('emily');
  assert.equal(emily.length, 0, 'Emily has no charge shot');
}

// Multi-hold volleys must be visually distinct — not identical clones on one aim vector.
assert.deepEqual(volleyOffset(0, 2, 16), { ox: 8 * 0.15, oy: -8 });
assert.deepEqual(volleyOffset(1, 2, 16), { ox: 8 * 0.15, oy: 8 });
assert.equal(volleyFan(0, 2, 0.3), -0.15);
assert.equal(volleyFan(1, 2, 0.3), 0.15);
const rankedTwo = rankChargeTargets(
  { x: 100, y: 300 },
  [
    { alive: true, x: 500, y: 300 },
    { alive: true, x: 520, y: 360 },
    { alive: false, x: 400, y: 300 },
  ],
);
assert.equal(rankedTwo.length, 2);
assert.notEqual(pickSplitTarget(rankedTwo, 0, 2), pickSplitTarget(rankedTwo, 1, 2));

/** Characters whose hold volley becomes multi-projectile at high P. */
const multiHoldAt = {
  merlin: 3,
  fafnir: 5,
  labiata: 3,
};

const enemies = [
  { alive: true, x: 520, y: 260, hitR: 18 },
  { alive: true, x: 540, y: 340, hitR: 18 },
];

for (const [key, minLv] of Object.entries(multiHoldAt)) {
  const player = {
    charKey: key, meta: meta[key], alive: true, x: 120, y: 300, shotLevel: minLv,
  };
  const pool = [];
  fireCharacterCharge(player, {
    targets: enemies,
    spawn: (spec) => pool.push(spec),
  });
  assert(pool.length >= 2, `${key} Lv${minLv} should fire a multi hold volley`);

  // Pairwise: at least one of spawn y, launch angle, delay, or homing lock differs.
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      const angA = Math.atan2(a.vy || 0, a.vx || 1);
      const angB = Math.atan2(b.vy || 0, b.vx || 1);
      const distinct =
        Math.abs((a.y ?? 300) - (b.y ?? 300)) >= 6
        || Math.abs(angA - angB) >= 0.06
        || Math.abs((a.delay || 0) - (b.delay || 0)) >= 0.03
        || (a.homingTarget && b.homingTarget && a.homingTarget !== b.homingTarget);
      assert(
        distinct,
        `${key} hold shots ${i}/${j} look like stacked clones `
          + `(y=${a.y}/${b.y} ang=${angA.toFixed(3)}/${angB.toFixed(3)} `
          + `delay=${a.delay}/${b.delay})`,
      );
    }
  }

  // Homing multi-missiles should split locks when 2+ enemies are available.
  const homers = pool.filter((b) => (b.homing || 0) > 0);
  if (homers.length >= 2) {
    const locks = new Set(homers.map((b) => b.homingTarget));
    assert(
      locks.size >= 2,
      `${key} multi-homing should split targets (got ${locks.size})`,
    );
  }

  // Single-enemy case still needs spatial separation so twins stay readable.
  const soloPool = [];
  fireCharacterCharge(player, {
    targets: [enemies[0]],
    spawn: (spec) => soloPool.push(spec),
  });
  if (soloPool.length >= 2) {
    const ys = soloPool.map((b) => b.y ?? 300);
    const xs = soloPool.map((b) => b.x ?? 120);
    const angs = soloPool.map((b) => Math.atan2(b.vy || 0, b.vx || 1));
    const ySpread = Math.max(...ys) - Math.min(...ys);
    const xSpread = Math.max(...xs) - Math.min(...xs);
    const angSpread = Math.max(...angs) - Math.min(...angs);
    assert(
      xSpread >= 6 || ySpread >= 6 || angSpread >= 0.08,
      `${key} single-enemy multi-hold must still fan/offset (xSpread=${xSpread} ySpread=${ySpread} angSpread=${angSpread})`,
    );
  }
}

// Power formula: Lv = 1 + pickups, max 5; death resets to Lv1.
{
  const p = Object.assign(Object.create(Player.prototype), {
    shotLevel: 1, shotLevelMax: 5, shotPowerItemCap: 5,
    alive: true, invuln: 0, charge: 0, _chargeQueued: false,
    powerFlash: null, powerFlashT: 0,
  });
  assert.equal(p.shotLevelMax, 5);
  assert.equal(p.shotPowerItemCap, 5);
  for (let i = 0; i < 4; i++) assert(p.powerUpShot(), `pickup ${i + 1} should raise power`);
  assert.equal(p.shotLevel, 5, 'four P pickups reach Lv5');
  assert.equal(p.powerUpShot(), false, 'P pickup must cap at Lv5');
  assert(p.resetShotPower(), 'death power reset should drop from Lv5');
  assert.equal(p.shotLevel, 1, 'death resets shot power to Lv1');
}

console.log('Basic shot progression + hold-shot P scaling + distinct multi-hold: 8 characters × 5 levels passed');

// Pooled native bullets must not leak their appearance into enemy/special shots.
const recycled = new Bullet(shots.fafnir[5][0]);
assert.equal(recycled.nativeKey, 'fafnir');
recycled.reset({ x: 0, y: 0, vx: 100, vy: 0 });
assert.equal(recycled.nativeKey, null);
for (const key of ['lrl','merlin','fafnir','eternity','labiata']) {
  const extra=[];
  Player.prototype.fireOptions.call({meta:meta[key],shotLevel:5}, {spawn:s=>extra.push(s)});
  assert.equal(extra.length,0, `${key}: upgrades must not reintroduce generic escort bullets`);
}

// Live target selection and chain dispatch, independent of presentation.
{
  const near={alive:true,x:400,y:240,hp:10};
  const heavy={alive:true,x:700,y:360,hp:200};
  const specs=[];
  Player.prototype.shoot.call({x:120,y:300,meta:meta.merlin,shotLevel:1,focus:false,_shotCounter:0},
    {targets:[near,heavy],spawn:s=>specs.push(s)});
  const s=specs[0], t=(heavy.x-s.x)/s.vx;
  assert(Math.abs(s.y+s.vy*t-heavy.y)<1,'Merlin must aim at the durable target');
  const links=[];
  Game.prototype._spawnChainLinks.call({enemies:[near,heavy,{alive:true,x:440,y:250}],
    bullets:{spawn:s=>links.push(s)}},new Bullet(shots.fafnir[5][0]),near);
  assert.equal(links.length,1,'Chain excludes distant and already struck enemies');
  assert.equal(links[0].ignoreEnemy,near);
  const owner={x:120,y:300};
  const blade=new Bullet({...shots.labiata[5][1],orbitOwner:owner});
  blade.update(.05);const before=blade.x;
  owner.x+=70;blade.update(0);
  assert(Math.abs(blade.x-before-70)<.001,'Melee swing follows player movement');
}
