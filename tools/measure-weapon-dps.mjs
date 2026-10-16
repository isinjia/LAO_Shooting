/** Isolated stationary-leader weapon budget; no stage or clear simulation. */
import { AssetBank } from '../js/assets.js';
import { Player } from '../js/player.js';
import { BulletPool } from '../js/bullet.js';
import { Game } from '../js/game.js';

const meta = new AssetBank().CHAR_META;
const dt = 1 / 60;
const fireSeconds = 12;
const settleSeconds = 3;
const playerX = Number(process.env.PLAYER_X || 120);
const rows = [];

for (const [key, character] of Object.entries(meta)) {
  for (const level of [1, 3, 5]) {
    const enemy = { alive: true, x: 1390, y: 300, hitR: 35, hp: 100000 };
    const player = { charKey: key, meta: character, x: playerX, y: 300,
      w: 1593, h: 900, shotLevel: level, focus: false, _shotCounter: 0 };
    const pool = new BulletPool();
    pool.targets = [enemy];
    let cooldown = 0;
    let damage = 0;
    let hits = 0;
    for (let frame = 0; frame < (fireSeconds + settleSeconds) / dt; frame++) {
      const t = frame * dt;
      cooldown -= dt;
      if (t < fireSeconds && cooldown <= 0) {
        Player.prototype.shoot.call(player, pool);
        Player.prototype.fireOptions.call(player, pool);
        cooldown = character.fireRate * (level === 1 ? 1.35 : 1);
      }
      pool.update(dt, player.w, player.h);
      for (const bullet of pool.list) {
        if (!bullet.alive || bullet.delay > 0) continue;
        if (bullet._pierceHit?.has(enemy)) continue;
        if (!Game.prototype._friendlyHitsEnemy(bullet, enemy)) continue;
        damage += bullet.damage;
        hits += 1;
        if (bullet.pierce) {
          if (!bullet._pierceHit) bullet._pierceHit = new Set();
          bullet._pierceHit.add(enemy);
        } else bullet.alive = false;
      }
    }
    rows.push({ key, level, dps: +(damage / fireSeconds).toFixed(2), hits });
  }
}

console.table(rows);
