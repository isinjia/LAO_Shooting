import assert from 'node:assert/strict';
import { AssetBank } from '../js/assets.js';
import { Bullet, BulletPool } from '../js/bullet.js';
import { Game } from '../js/game.js';
import { Player } from '../js/player.js';
import { fireCharacterCharge } from '../js/weapon-skills.js';
import { SPECIAL_ATTACKS, assertSpecialBalance, expectedSpecialDamage } from '../js/special-shots.js';

const meta = new AssetBank().CHAR_META;
assert.equal(assertSpecialBalance().length, 24);
const roles = new Set();
const chargeByCharacter = new Map();
for (const key of Object.keys(SPECIAL_ATTACKS)) {
  const player = Object.create(Player.prototype);
  Object.assign(player, { charKey: key, meta: meta[key], alive: true,
    x: 120, y: 300, shotLevel: 2, spCost: 100,
    respawnTimer: 0, deathBombTimer: 0 });
  const bullets = new BulletPool();
  bullets.targets = [{ alive: true, x: 500, y: 385, hitR: 20 }];
  fireCharacterCharge(player, bullets);
  const charge = bullets.list.filter((b) => b.charge);
  if (key === 'emily') assert.equal(charge.length, 0, 'Emily has no charge shot');
  else assert(charge.length > 0, `${key}: no charge`);
  if (charge.length) {
    assert(charge.every((b) => !b.special && b.damage > 0));
    chargeByCharacter.set(key, {
    style: charge[0].style, beamLength: charge[0].beamLength || 0,
    vx: charge[0].vx, vy: charge[0].vy, ay: charge[0].ay || 0,
    chainCount: charge[0].chainCount || 0, chainRadius: charge[0].chainRadius || 0,
    damage: charge[0].damage, color: charge[0].color, glow: charge[0].glow,
    returnOwner: !!charge[0].returnOwner, blastRadius: charge[0].blastRadius || 0,
    clearRadius: charge[0].clearRadius || 0, waveAmplitude: charge[0].waveAmplitude || 0,
    pierce: !!charge[0].pierce, homing: charge[0].homing || 0,
    rootDuration: charge[0].rootDuration || 0,
    });
  }
  const chargeStyles = new Set(charge.map((b) => b.style));
  for (let level = 1; level <= 3; level++) {
    bullets.clearAll();
    player.sp = level * player.spCost;
    assert(Player.prototype.trySpecial.call(player, bullets), `${key} Lv${level}: no C skill`);
    const special = bullets.list.filter((b) => b.alive && b.special);
    assert.equal(special.length, SPECIAL_ATTACKS[key][level - 1].shots.length);
    assert.equal(special.reduce((sum, b) => sum + b.damage, 0), expectedSpecialDamage(key, level));
    assert(special.every((b) => !chargeStyles.has(b.style)), `${key}: charge and C look identical`);
    roles.add(SPECIAL_ATTACKS[key][level - 1].role);
  }
}
assert(roles.size >= 6, 'C skills should have several combat roles');

// Hold kits must not collapse into shared homing-missile / plain-laser templates.
const holdIdentity = {
  hirume: (c) => c.homing > 0 && c.blastRadius > 0 && c.style === 'sunbird' && (c.ay || 0) === 0,
  constantia: (c) => c.style === 'lockround' && c.beamLength === 0 && c.pierce
    && c.homing === 0 && (c.ay || 0) > 0,
  lrl: (c) => !c.returnOwner && c.vx > 0 && c.vy === 0 && c.homing === 0 && c.style === 'dragonaxe' && c.pierce
    && c.blastRadius > 0,
  merlin: (c) => c.blastRadius > 0 && c.vx > 0 && c.vy === 0 && c.style === 'shell',
  fafnir: (c) => c.style === 'jupiterorb' && c.chainCount > 0 && c.clearRadius > 0,
  eternity: (c) => c.pierce && c.clearRadius > 0 && c.style === 'coffinwall' && c.beamLength === 0,
  labiata: (c) => c.waveAmplitude > 0 && c.style === 'plasmaslash' && c.beamLength === 0,
};
for (const [key, check] of Object.entries(holdIdentity)) {
  assert(check(chargeByCharacter.get(key)), `${key}: hold identity drifted toward shared template`);
}
const primaryStyles = [...chargeByCharacter.values()].map((c) => c.style);
assert.equal(new Set(primaryStyles).size, primaryStyles.length, 'each hold kit needs a unique primary style');

// Offensive hold attacks must actually reach an aligned mid-screen target at Lv1.
for (const key of ['hirume', 'constantia', 'lrl', 'merlin', 'fafnir', 'labiata']) {
  const enemy = { alive: true, x: 500, y: 300, hitR: 25, hp: 100 };
  const player = { charKey: key, meta: meta[key], alive: true,
    x: 120, y: 300, shotLevel: 1, w: 1593 };
  const specs = [];
  fireCharacterCharge(player, { targets: [enemy], spawn: (spec) => specs.push(spec) });
  const projectiles = specs.map((spec) => new Bullet(spec));
  let hit = false;
  for (let frame = 0; frame < 150 && !hit; frame++) {
    for (const bullet of projectiles) {
      if (!bullet.alive) continue;
      bullet.update(1 / 60, [enemy]);
      if (bullet.delay <= 0 && Game.prototype._friendlyHitsEnemy(bullet, enemy)) {
        hit = true;
        break;
      }
    }
  }
  assert(hit, `${key}: Lv1 hold cannot hit an aligned mid-screen target`);
}
for (const key of ['lrl', 'fafnir']) {
  const farBoss = { alive: true, x: 1390, y: 300, hitR: 45, hp: 450 };
  const specs = [];
  fireCharacterCharge({ charKey: key, meta: meta[key], alive: true,
    x: 120, y: 300, shotLevel: 1, w: 1593 },
  { targets: [farBoss], spawn: (spec) => specs.push(spec) });
  const projectile = new Bullet(specs[0]);
  let reached = false;
  for (let frame = 0; frame < 180 && projectile.alive; frame++) {
    projectile.update(1 / 60, [farBoss]);
    if (Game.prototype._friendlyHitsEnemy(projectile, farBoss)) { reached = true; break; }
  }
  assert(reached, `${key} Lv1 hold must reach the far boss lane`);
}
{
  const owner = { charKey: 'lrl', meta: meta.lrl, alive: true,
    x: 120, y: 300, shotLevel: 3, w: 1593 };
  const specs = [];
  fireCharacterCharge(owner, { targets: [], spawn: (spec) => specs.push(spec) });
  assert.equal(specs.length, 1, 'LRL charge stays one large axe at higher power');
  const axe = new Bullet(specs[0]);
  let lastX = axe.x;
  for (let i = 0; i < 150 && axe.alive; i++) {
    axe.update(1 / 60);
    assert(axe.x > lastX && axe.vx > 0, 'LRL axe must keep travelling forward');
    lastX = axe.x;
  }
  assert(axe.x > 1000, 'LRL axe crosses the playfield');
}

const fafnirCharge = chargeByCharacter.get('fafnir');
assert.equal(fafnirCharge.style, 'jupiterorb');
assert.equal(fafnirCharge.beamLength, 0);
assert.equal(fafnirCharge.chainCount, 2);

const chainPool = new BulletPool();
const struck = { alive: true, x: 400, y: 300 };
const closeA = { alive: true, x: 490, y: 260 };
const closeB = { alive: true, x: 510, y: 355 };
const farAway = { alive: true, x: 730, y: 300 };
const chainGame = Object.assign(Object.create(Game.prototype), {
  bullets: chainPool, enemies: [struck, closeA, closeB, farAway],
});
Game.prototype._spawnChainLinks.call(chainGame, fafnirCharge, struck);
assert.equal(chainPool.list.length, 2, 'Jupiter should jump to two nearby enemies');
assert(chainPool.list.every((b) => b.style === 'chainarc' && b.ignoreEnemy === struck));
assert.deepEqual(new Set(chainPool.list.map((b) => b.homingTarget)), new Set([closeA, closeB]));

const homing = new Bullet({ x: 0, y: 0, vx: 600, vy: 0, homing: 5, friendly: true });
homing.update(0.1, [{ alive: true, x: 300, y: 200 }]);
assert(homing.vy > 0 && homing.y > 0, 'guided shot should turn toward enemy');

const field = new Bullet({ x: 100, y: 100, vx: 0, vy: 0, clearRadius: 40, lifetime: 0.5, friendly: true });
assert(Game.prototype._friendlyClearsBullet(field, { x: 130, y: 100, r: 4 }));
assert(!Game.prototype._friendlyClearsBullet(field, { x: 220, y: 100, r: 4 }));
const near = new Bullet({ x: 130, y: 100, r: 4 });
const far = new Bullet({ x: 220, y: 100, r: 4 });
const fakeGame = Object.assign(Object.create(Game.prototype), {
  player: { alive: false }, bullets: { list: [field, near, far] }, enemies: [],
  fx: { hitSpark() {} },
});
Game.prototype._collisions.call(fakeGame);
assert(!near.alive && far.alive, 'field must clear locally rather than act as a bomb');
field.update(0.6);
assert(!field.alive, 'temporary shield should expire');

console.log('Weapon roles: 7 distinct hold kits, Emily laser-only, 24 C skills, homing and local bullet clear passed');
