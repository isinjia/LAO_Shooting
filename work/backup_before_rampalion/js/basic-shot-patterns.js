/** Ordinary weapons: upgrade their jobs, not a shared forward volley. */
export function fireRoleBasic(player, bullets, { lv, dmg, spd, r, base, targets }) {
  const focus = player.focus ? 1.12 : 1;
  const spawn = (spec) => bullets.spawn({ x: player.x + 36, y: player.y,
    ...base, ...spec });
  const ahead = targets.filter((e) => e.x > player.x + 45);
  switch (player.meta.shot.pattern) {
    case 'axe': {
      // Red spinning sword wave only (no straight arrow): it grows with P level and
      // always pierces (each enemy hit once per wave).
      spawn({ x: player.x + 25, y: player.y,
        vx: spd * (0.82 + lv * 0.035), vy: 0,
        r: [0, 10, 13, 16, 19.5, 23][lv], damage: dmg * focus * (1.05 + lv * 0.12),
        pierce: true, lifetime: 2.5, style: 'cleave',
        nativeKey: 'lrl' });
      break;
    }
    case 'baton': {
      // Big Gun: ballistic shell aimed at the strongest enemy, splash for packs.
      const target = ahead.sort((a, b) => (b.hp || 0) - (a.hp || 0))[0];
      const count = lv >= 4 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const y = player.y + (i ? 7 : -3);
        const angle = target ? Math.atan2(target.y - y, target.x - player.x - 40) : 0;
        spawn({ x: player.x + 40, y,
          vx: Math.cos(angle) * spd * 0.86, vy: Math.sin(angle) * spd * 0.86,
          r: 5 + lv * 1.25, damage: dmg * focus * (i ? 0.58 : 1.25),
          blastRadius: 14 + lv * 10, delay: i * 0.12,
          lifetime: 2.6, style: 'shell' });
      }
      break;
    }
    case 'tesla': {
      // Hroti tracks a single enemy; upgraded discharge jumps after impact.
      const target = ahead.sort((a, b) => Math.hypot(a.x-player.x,a.y-player.y)
        - Math.hypot(b.x-player.x,b.y-player.y))[0];
      const angle = target ? Math.atan2(target.y-player.y,target.x-player.x) : 0;
      spawn({ vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
        r: 4.5 + lv * 0.65, damage: dmg * focus * 1.08,
        homing: 3.8 + lv * 0.4, homingTarget: target,
        chainCount: Math.max(0, lv - 2), chainRadius: 80 + lv * 18,
        lifetime: 2.4, style: 'lightning' });
      break;
    }
    case 'hmg': {
      // Sustained narrow suppression: power changes burst length and penetration.
      const count = [0, 1, 2, 2, 3, 4][lv];
      for (let i = 0; i < count; i++) spawn({
        x: player.x + 38, y: player.y + (i % 2 ? 3 : -3),
        vx: spd, vy: 0, r: 3.5 + lv * 0.35,
        damage: dmg * focus * (i ? 0.55 : 1),
        delay: i * 0.035, pierce: lv >= 3,
        lifetime: 1.9, style: 'coffinround',
      });
      break;
    }
    case 'plasma': {
      // Trollsberd: a modest ranged wave plus one strong swing attached to Labiata.
      spawn({ vx: spd * 1.1, vy: 0, r: 8 + lv * 1.8,
        damage: dmg * focus * 0.7, pierce: true,
        lifetime: 2.3, style: 'plasmaslash' });
      const radius = 48 + lv * 10;
      const angle = -1.28;
      spawn({ x: player.x + 20 + Math.cos(angle)*radius,
        y: player.y + Math.sin(angle)*radius, vx: 0, vy: 0,
        orbitOwner: player, orbitOffsetX: 20, orbitRadius: radius,
        orbitAngle: angle, orbitSpeed: 9.2, lifetime: 0.28,
        r: 12 + lv * 2, damage: dmg * focus * (1.3 + lv * 0.12),
        pierce: true, clearRadius: lv >= 3 ? 4 + lv : 0,
        style: 'orbitblade' });
      break;
    }
  }
}
