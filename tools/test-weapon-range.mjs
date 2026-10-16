import assert from 'node:assert/strict';
import { AssetBank } from '../js/assets.js';
import { Player } from '../js/player.js';
import { Bullet } from '../js/bullet.js';
import { Game } from '../js/game.js';

const meta = new AssetBank().CHAR_META;
const enemy = { alive: true, x: 1390, y: 300, hitR: 35, hp: 450 };

for (const [key, character] of Object.entries(meta)) {
  for (const level of [1, 5]) {
    const player = { x: 120, y: 300, w: 1593, h: 900,
      meta: character, shotLevel: level, focus: false, _shotCounter: 0 };
    const specs = [];
    Player.prototype.shoot.call(player, {
      targets: [enemy], spawn: (spec) => specs.push(spec),
    });
    const projectiles = specs.map((spec) => new Bullet(spec));
    let reached = false;
    for (let frame = 0; frame < 210 && !reached; frame++) {
      for (const bullet of projectiles) {
        if (!bullet.alive) continue;
        bullet.update(1 / 60, [enemy]);
        if (bullet.delay <= 0 && Game.prototype._friendlyHitsEnemy(bullet, enemy)) {
          reached = true;
          break;
        }
      }
    }
    assert(reached, `${key} Lv${level}: basic fire has no way to hit the far boss lane`);
  }
}

console.log('Weapon range: all 8 basic attacks can reach the far boss lane at Lv1/Lv5');
