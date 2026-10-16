import assert from 'node:assert/strict';
import { STAGES } from '../js/stage-plan.js';
import { Game } from '../js/game.js';
import { Enemy } from '../js/enemy.js';
import { Bullet, BulletPool } from '../js/bullet.js';
import { SPECIAL_ATTACKS, assertSpecialBalance } from '../js/special-shots.js';

// Authored beats must interrupt every act's procedural ranks without losing P carriers.
const signatures = STAGES.map((stage) => stage.waves.filter((wave) => wave.role === 'signature'));
assert(signatures.every((waves) => waves.length === 3 && waves.every((w) => w.groups.length >= 2)));
assert.equal(new Set(signatures.flat().map((w) => w.cue)).size, 15);
for (const stage of STAGES) {
  const carrierWaves = stage.waves.map((wave, i) =>
    wave.groups.some((group) => group.powerCarrierIndex >= 0) ? i : -1).filter((i) => i >= 0);
  assert.deepEqual(carrierWaves, stage.powerCarrierWaves || [0, 4, 9, 14]);
  for (const wave of stage.waves.filter((entry) => entry.role === 'signature')) {
    assert(wave.groups.some((group) => group.signatureAnchor));
  }
}
const signature = STAGES[0].waves.find((wave) => wave.role === 'signature');
const packs = signature.groups.map((group) =>
  Array.from({ length: group.count }, () => ({ alive: true })));
Game.prototype._linkSignatureEncounter.call({}, signature, packs);
const anchor = packs[signature.groups.findIndex((group) => group.signatureAnchor)][0];
assert(anchor.isSignatureAnchor);
assert(packs.flat().filter((enemy) => enemy !== anchor)
  .every((enemy) => enemy.commanderRef === anchor));

// Lv2/Lv3 must add a utility axis besides the fixed 6 damage per gauge segment.
assertSpecialBalance();
const utility = (attack) => Math.max(...attack.shots.map((s) =>
  (s.clearRadius || 0) + (s.blastRadius || 0) + (s.beamLength || 0)
  + (s.chainCount || 0) * 12 + (s.pierce ? 10 : 0)
  + (s.markDuration || 0) * 12 + (s.rootDuration || 0) * 14));
for (const [key, attacks] of Object.entries(SPECIAL_ATTACKS)) {
  assert(utility(attacks[2]) > utility(attacks[0]), `${key}: Lv3 needs added utility`);
}

// A real miss schedules a recovery carrier soon, even before the ordinary opener gate.
const spawned = [];
const recoveryGame = Object.assign(Object.create(Game.prototype), {
  player: { alive: true, shotLevel: 1 }, stageIndex: 0, stagePhase: 'waves',
  stages: STAGES, stageClock: 10, time: 6, _lastPowerRecoveryAt: 0,
  _powerRecoveryDueAt: 5, powerUps: [], enemies: [],
  assets: { ENEMY_META: { [STAGES[0].grunts[0]]: { size: 60, name: 'supply' } } },
  _clipsFor: () => ({}),
  _spawnEnemy: (spec) => { spawned.push(spec); return { fireTimer: 0 }; },
  audio: { play() {} },
});
Game.prototype._maybeSpawnPowerRecovery.call(recoveryGame);
assert.equal(spawned.length, 4);
assert.equal(spawned.filter((s) => s.powerCarrier).length, 1);
assert.equal(recoveryGame._powerRecoveryDueAt, Infinity);
const dropGame = Object.assign(Object.create(Game.prototype), {
  player: { shotLevel: 1 }, powerUps: [], _itemMagnetBoost: 0,
  _trimPowerUps() {},
});
Game.prototype._tryDropPowerUp.call(dropGame, {
  x: 1400, y: 300, dropsPower: true, recoveryCarrier: true,
});
assert.equal(dropGame.powerUps.length, 1);
assert(dropGame.powerUps[0].vx < -180 && dropGame._itemMagnetBoost >= 8);

const escort = Object.assign(Object.create(Enemy.prototype), {
  anim: { hasAttack: false }, kind: 'grunt', pattern: 'aimed',
  x: 700, y: 300, color: '#fff', fireTimer: 0,
});
const normalBullets = new BulletPool();
escort.fire({ x: 100, y: 300, shotLevel: 1, recoveryTimer: 0 }, normalBullets);
const normalDelay = escort.fireTimer;
const normalSpeed = Math.hypot(normalBullets.list[0].vx, normalBullets.list[0].vy);
const recoveryBullets = new BulletPool();
escort.fire({ x: 100, y: 300, shotLevel: 1, recoveryTimer: 5 }, recoveryBullets);
assert(escort.fireTimer > normalDelay);
assert(Math.hypot(recoveryBullets.list[0].vx, recoveryBullets.list[0].vy) < normalSpeed);
escort.commanderRef = { alive: true, x: 500 };
escort.fire({ x: 100, y: 300, shotLevel: 1, recoveryTimer: 0 }, new BulletPool());
assert(escort.fireTimer < normalDelay, 'linked signature escorts should pressure until anchor dies');
escort.commanderRef.alive = false;
escort.fire({ x: 100, y: 300, shotLevel: 1, recoveryTimer: 0 }, new BulletPool());
assert.equal(escort.fireTimer, normalDelay);

// The boss exposes a counterattack window after a completed pattern, and basic
// shots gain damage there while C's separate 6/12/18 budget stays unchanged.
const boss = Object.assign(Object.create(Enemy.prototype), {
  kind: 'boss', hp: 100, maxHp: 100, attackPhase: 0, style: 'program',
  color: '#ffffff', x: 900, y: 300, spiralAngle: 0, volleyCount: 0,
  exposedFor: 0, fireTimer: 0,
});
const pool = new BulletPool();
for (let i = 0; i < 4; i++) boss._bossFire({ x: 100, y: 300, shotLevel: 1 }, pool);
assert(boss.exposedFor > 0 && boss.fireTimer >= 1.15);
boss.hp = 60;
boss._bossFire({ x: 100, y: 300, shotLevel: 1 }, pool);
assert.equal(boss.attackPhase, 1);
assert(boss.exposedFor >= 1.25);

const target = {
  x: 900, y: 300, hitR: 30, hp: 100, alive: true,
  kind: 'boss', exposedFor: 1,
  damage(amount) { this.hp -= amount; return false; },
};
const shot = new Bullet({ x: 900, y: 300, friendly: true, damage: 10, r: 5 });
const collisionGame = Object.assign(Object.create(Game.prototype), {
  player: { alive: false, addSp() {} }, bullets: { list: [shot] }, enemies: [target],
  fx: { noteHit() {} }, audio: { play() {} }, projectileVfx: { impact() {} }, _fxClock: 0,
});
Game.prototype._collisions.call(collisionGame);
assert.equal(target.hp, 87);

console.log('Gameplay design: signature leaders, C utility, urgent P recovery, boss counterattack passed');
