import assert from 'node:assert/strict';
import { AssetBank } from '../js/assets.js';
import { Bullet } from '../js/bullet.js';
import { Enemy } from '../js/enemy.js';
import { Game } from '../js/game.js';
import { Player } from '../js/player.js';
import { fireCharacterCharge } from '../js/weapon-skills.js';
import { SPECIAL_ATTACKS } from '../js/special-shots.js';

const meta = new AssetBank().CHAR_META;
const foe = {
  x: 500, y: 300, hitR: 25, hp: 100, alive: true, kind: 'grunt',
  boriMarkedFor: 0, boriRootFor: 0,
  damage(n) { this.hp -= n; return this.hp <= 0; },
};
const chargeSpecs = [];
fireCharacterCharge({ charKey: 'constantia', meta: meta.constantia,
  alive: true, x: 120, y: 300, shotLevel: 3, w: 1593 },
{ targets: [foe], spawn: (spec) => chargeSpecs.push(spec) });
assert.equal(chargeSpecs.length, 1);
assert.equal(chargeSpecs[0].style, 'lockround', 'charge is a separate Winchester slug');
assert(chargeSpecs[0].pierce && !(chargeSpecs[0].beamLength > 0));

const caster = Object.create(Player.prototype);
Object.assign(caster, { charKey: 'constantia', meta: meta.constantia,
  alive: true, x: 120, y: 300, spCost: 100, sp: 300,
  respawnTimer: 0, deathBombTimer: 0 });
const specs = [];
assert(caster.trySpecial({ targets: [foe], spawn: (spec) => specs.push(spec) }));
assert.equal(specs.length, 1, 'C sends one Bori even at Lv3');
assert.equal(specs[0].style, 'bori');
assert.equal(specs[0].damage, 18);
assert.equal(specs[0].homingTarget, foe);
const dog = new Bullet(specs[0]);
for (let frame = 0; frame < 120 && !Game.prototype._friendlyHitsEnemy(dog, foe); frame++) {
  dog.update(1 / 60, [foe]);
}
assert(Game.prototype._friendlyHitsEnemy(dog, foe), 'Bori reaches target');

const player = { charKey: 'constantia', alive: true, invuln: 1, x: 120, y: 300,
  addSp() {}, isRespawning: false };
const game = Object.create(Game.prototype);
Object.assign(game, {
  player, enemies: [foe], bullets: { list: [dog] },
  projectileVfx: { impact() {} }, audio: { play() {} },
  fx: { noteHit() {} }, _fxClock: 1,
});
game._collisions();
assert(foe.boriMarkedFor > 2 && foe.boriRootFor > 0,
  'Bori applies rifle mark and root on impact');
const afterDog = foe.hp;
game.bullets.list = [new Bullet({ x: foe.x, y: foe.y, r: 5, friendly: true,
  damage: 10, style: 'tracer' })];
game._collisions();
assert.equal(+(afterDog - foe.hp).toFixed(2), 12,
  'Constantia rifle deals 20% more damage to Bori-marked target');

const slowed = Object.create(Enemy.prototype);
Object.assign(slowed, {
  alive: true, age: 0, exposedFor: 0, hitFlash: 0,
  boriMarkedFor: 2, boriRootFor: 1,
  x: 100, y: 100, kind: 'grunt', fireTimer: 2,
  moveFn(enemy, dt) { enemy.x += dt * 100; },
  anim: { locked: false, play() {}, update() {} },
});
slowed.update(0.1, { isRespawning: true }, null);
assert(slowed.x < 102, 'root sharply slows grunt motion');

for (const power of [2, 3, 4, 5]) {
  const movers = [
    { alive: true, x: 550, y: 465, hitR: 25, hp: 40 },
    { alive: true, x: 590, y: 150, hitR: 25, hp: 40 },
  ];
  const flankShots = [];
  const mainShots = [];
  Player.prototype.shoot.call({
    charKey: 'constantia', meta: meta.constantia, x: 120, y: 300,
    shotLevel: power, focus: false, _shotCounter: 1,
  }, { targets: movers, spawn: (spec) => mainShots.push(new Bullet(spec)) });
  assert(mainShots.every((shot) => (shot.homing || 0) === 0),
    `P${power} rifle slugs must be aimed, not seeking`);
  assert(mainShots.every((shot) => movers.some((enemy) => {
    const ang = Math.atan2(shot.vy, shot.vx);
    const want = Math.atan2(enemy.y - shot.y, enemy.x - shot.x);
    return Math.abs(Math.atan2(Math.sin(ang - want), Math.cos(ang - want))) < 0.2;
  })), `P${power} rifle slugs must aim at a live enemy`);
  Player.prototype.fireOptions.call({
    charKey: 'constantia', meta: meta.constantia, x: 120, y: 300,
    shotLevel: power, focus: false, _shotCounter: 1,
  }, { targets: movers, spawn: (spec) => flankShots.push(new Bullet(spec)) });
  assert.equal(flankShots.length, power === 2 ? 1 : 2);
  assert(flankShots.every((shot) => (shot.homing || 0) === 0),
    `P${power} option bullets are aimed snapshots`);
  if (flankShots.length === 2) {
    const aimed = flankShots.map((shot) => movers.find((enemy) => {
      const ang = Math.atan2(shot.vy, shot.vx);
      const want = Math.atan2(enemy.y - shot.y, enemy.x - shot.x);
      return Math.abs(Math.atan2(Math.sin(ang - want), Math.cos(ang - want))) < 0.2;
    }));
    assert(aimed[0] && aimed[1] && aimed[0] !== aimed[1],
      'two flanks split aim when multiple enemies exist');
  }
  for (const shot of [...mainShots, ...flankShots]) {
    const target = movers.find((enemy) => {
      const ang = Math.atan2(shot.vy, shot.vx);
      const want = Math.atan2(enemy.y - shot.y, enemy.x - shot.x);
      return Math.abs(Math.atan2(Math.sin(ang - want), Math.cos(ang - want))) < 0.2;
    });
    let hit = false;
    for (let frame = 0; frame < 110 && shot.alive; frame++) {
      shot.update(1 / 60, movers);
      if (target && Game.prototype._friendlyHitsEnemy(shot, target)) { hit = true; break; }
    }
    assert(hit, `P${power} Winchester round must hit its aimed stationary enemy`);
  }
}

for (const level of [1, 2, 3]) {
  const emily = SPECIAL_ATTACKS.emily[level - 1].shots;
  assert.equal(emily.length, 1);
  assert.equal(emily[0].style, 'busterbeam');
  assert.equal(emily[0].damage, level * 6);
  assert(emily[0].beamLength > 0 && emily[0].blastRadius > 0);
  if (level === 1) {
    const farBoss = { alive: true, x: 1390, y: 300, hitR: 38 };
    const spec = emily[0];
    const buster = new Bullet({ ...spec, x: 120 + spec.x, y: 300,
      vx: meta.emily.shotSpeed * spec.speed, vy: 0, friendly: true });
    let reached = false;
    for (let frame = 0; frame < 100 && buster.alive; frame++) {
      buster.update(1 / 60);
      if (Game.prototype._friendlyHitsEnemy(buster, farBoss)) { reached = true; break; }
    }
    assert(reached, 'Lv1 buster reaches a far boss lane');
  }
  const eternity = SPECIAL_ATTACKS.eternity[level - 1].shots;
  assert(eternity.every((shot) => shot.origin === 'top' && shot.vy > 0 && !shot.homing));
}

const merlin = Object.create(Player.prototype);
Object.assign(merlin, { charKey: 'merlin', meta: meta.merlin, alive: true,
  x: 120, y: 300, sp: 200, spCost: 100, respawnTimer: 0, deathBombTimer: 0 });
const cast = [];
assert(merlin.trySpecial({ targets: [foe], spawn: (shot) => cast.push(shot) }));
assert(merlin.unrepFor > 4 && cast.length === 1 && cast[0].damage === 12,
  'Merlin UNREP grants a timed buff alongside the area marker');
assert(cast.every((s) => s.style === 'commandmissile' && s.vx === 0));

const fafnirC = [];
const fafnirCaster = Object.create(Player.prototype);
Object.assign(fafnirCaster, { charKey: 'fafnir', meta: meta.fafnir, alive: true,
  x: 120, y: 300, sp: 200, spCost: 100, respawnTimer: 0, deathBombTimer: 0 });
assert(fafnirCaster.trySpecial({ targets: [foe], spawn: (shot) => fafnirC.push(shot) }));
assert(fafnirC.length === 1 && fafnirC[0].damage === 12
  && fafnirC[0].chainCount === 2 && fafnirC.every((s) => s.style === 'teslacoil'
  && !(s.style === 'empfield') && (s.blastRadius || 0) > 0),
  'Fafnir C is Shock and Awe electric bloom, not EMP wipe');
assert(fafnirC.every((s) => Math.abs(s.x - foe.x) < 120),
  'Shock and Awe must park on the selected target area');

const labiataC = [];
const labiataCaster = Object.create(Player.prototype);
Object.assign(labiataCaster, { charKey: 'labiata', meta: meta.labiata, alive: true,
  x: 120, y: 300, sp: 200, spCost: 100, respawnTimer: 0, deathBombTimer: 0 });
assert(labiataCaster.trySpecial({ targets: [foe], spawn: (shot) => labiataC.push(shot) }));
assert(labiataC.length === 1 && labiataC[0].damage === 12
  && labiataC.every((s) => s.style === 'plasmacross'
  && s.vx === 0 && (s.blastRadius || 0) > 0),
  'Labiata C is parked Hundred Flower blooms, not a travelling cross-cut');

for (const key of ['fafnir', 'labiata']) {
  const target = { alive: true, x: 930, y: 210, hp: 80 };
  const player = Object.assign(Object.create(Player.prototype), {
    charKey: key, meta: meta[key], alive: true, x: 120, y: 300,
    sp: 100, spCost: 100, respawnTimer: 0, deathBombTimer: 0,
  });
  const shots = [];
  assert(player.trySpecial({ targets: [target], spawn: (shot) => shots.push(shot) }));
  assert.equal(shots.length, 1);
  assert.equal(shots[0].x, target.x,
    `${key} C must land on the selected enemy, not a fixed distance from player`);
  assert.equal(shots[0].y, target.y);
}

const lrlHold = [];
fireCharacterCharge({ charKey: 'lrl', meta: meta.lrl,
  alive: true, x: 120, y: 300, shotLevel: 3, w: 1593 },
{ targets: [foe], spawn: (spec) => lrlHold.push(spec) });
assert(lrlHold.length === 1 && lrlHold.every((s) => s.style === 'dragonaxe'
  && !s.returnOwner && s.vx > 0 && s.vy === 0));

const merlinShot = [];
Player.prototype.shoot.call({
  charKey: 'merlin', meta: meta.merlin, x: 120, y: 300,
  shotLevel: 1, focus: false, _shotCounter: 0,
}, { targets: [foe], spawn: (spec) => merlinShot.push(spec) });
assert.equal(merlinShot[0].style, 'shell');
assert(merlinShot[0].vx > 0);

const hirumeHold = [];
fireCharacterCharge({ charKey: 'hirume', meta: meta.hirume,
  alive: true, x: 120, y: 300, shotLevel: 3, w: 1593 },
{ targets: [foe], spawn: (spec) => hirumeHold.push(spec) });
assert(hirumeHold.length === 1);
assert(hirumeHold.every((s) => s.style === 'sunbird' && (s.homing || 0) > 0
  && s.blastRadius > 0 && !(s.ay > 0)));
const hirumeShot = [];
Player.prototype.shoot.call({
  charKey: 'hirume', meta: meta.hirume, x: 120, y: 300,
  shotLevel: 1, focus: false, _shotCounter: 0,
}, { targets: [foe], spawn: (spec) => hirumeShot.push(spec) });
assert.equal(hirumeShot[0].style, 'foxflame');
assert((hirumeShot[0].ay || 0) === 0 && (hirumeShot[0].homing || 0) === 0);

console.log('Original skill roles: Bori control, RIP area, Xenox buster, Merlin UNREP, Hirume phoenix passed');
