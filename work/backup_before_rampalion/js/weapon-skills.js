/** Hold-FIRE tactical attacks. Each solves a different problem from basic fire. */
export const CHARGE_NAMES = {
  hirume: '봉황 날개',
  constantia: '라이플 강사격',
  lrl: '어둠의 도끼',
  merlin: '빅 건 강사격',
  fafnir: '주피터 뇌운장',
  eternity: '두 사람을 위한 관',
  labiata: '슈스이 옵션',
  griffin: '유도 미사일',
  sleipnir: '열추적 미사일',
  express76: '자동 레이저',
};

/** Front-half enemies sorted nearest → farthest (for split locks / artillery aim). */
export function rankChargeTargets(player, targets) {
  return (targets || [])
    .filter((enemy) => enemy.alive && enemy.x > player.x + 45)
    .sort((a, b) => (a.x - player.x) ** 2 + (a.y - player.y) ** 2
      - (b.x - player.x) ** 2 - (b.y - player.y) ** 2);
}

/**
 * Pick a distinct lock for missile `i` of `n`.
 * Prefer unique nearest enemies; with only one foe, return that foe (caller fans aim).
 */
export function pickSplitTarget(ranked, i, n) {
  if (!ranked.length) return null;
  if (ranked.length === 1) return ranked[0];
  if (n <= 1) return ranked[0];
  // Round-robin across available enemies so twins/triples don't pile on #1.
  return ranked[i % ranked.length];
}

/** Side-by-side muzzle offset for readable multi-shots (even with one enemy). */
export function volleyOffset(i, n, spacing = 14) {
  if (n <= 1) return { ox: 0, oy: 0 };
  const oy = (i - (n - 1) / 2) * spacing;
  return { ox: Math.abs(oy) * 0.15, oy };
}

/** Fan aim angle (radians) around a base heading — keeps clones off one vector. */
export function volleyFan(i, n, fanRad = 0.22) {
  if (n <= 1) return 0;
  return (i - (n - 1) / 2) * fanRad;
}

export function fireCharacterCharge(player, bullets) {
  if (!player.alive || player.meta?.chargeEnabled === false) return;
  const key = player.charKey;
  const shot = player.meta.shot || {};
  const lv = Math.max(1, Math.min(5, player.shotLevel | 0));
  // P level scales the hold volley like 1945 power options — not a flat bolt.
  const damage = 5.4 + lv * 1.45;
  const speed = player.meta.shotSpeed || 800;
  const base = {
    friendly: true, grazeable: false, charge: true,
    color: shot.color || '#9ef0ff', glow: shot.glow || shot.color || '#9ef0ff',
  };
  const spawn = (spec) => bullets.spawn({ x: player.x + 30, y: player.y, ...base, ...spec });
  const ranked = rankChargeTargets(player, bullets.targets);
  const nearest = ranked[0] || null;
  const aimAt = (enemy, fan = 0) => {
    let ang = 0;
    if (enemy) {
      ang = Math.atan2(enemy.y - player.y, Math.max(180, enemy.x - player.x));
    }
    ang += fan;
    return { ang, c: Math.cos(ang), s: Math.sin(ang) };
  };
  const aim = (fan = 0) => aimAt(nearest, fan);

  switch (key) {
    case 'hirume': {
      // Pre-lore phoenix wing-fan (tick73): one sunbird seed, not napalm.
      const lock = ranked.sort((a, b) => (b.hp || 0) - (a.hp || 0))[0] || nearest;
      const { c, s } = aimAt(lock, 0);
      const spd = speed * (0.655 + lv * 0.04);
      spawn({
        x: player.x + 48, y: player.y,
        vx: c * spd, vy: s * spd * 0.28,
        r: 12 + lv * 2.4,
        damage: damage * (1.35 + lv * 0.1),
        pierce: true,
        homing: 2.75 + lv * 0.4,
        homingTarget: lock,
        blastRadius: 15 + lv * 8,
        lifetime: 2.1 + lv * 0.08,
        style: 'sunbird',
      });
      break;
    }
    case 'constantia': {
      // Charged rifle: one slow fat Winchester slug (1945 cannon), not a lance or seeker.
      const { c, s } = aimAt(nearest);
      const spd = 520 + lv * 24;
      spawn({
        x: player.x + 44, y: player.y,
        vx: c * spd, vy: s * spd,
        ay: 55,
        r: 11 + lv * 1.6, damage: damage * (1.28 + lv * 0.14),
        pierce: true,
        lifetime: 1.55, style: 'lockround',
      });
      break;
    }
    case 'sleipnir':
    case 'lrl': {
      // One heavy axe thrown straight forward. No return path or homing.
      const spd = speed * (1.1 + lv * 0.05);
      spawn({
        x: player.x + 42, y: player.y,
        vx: spd, vy: 0,
        r: 17 + lv * 4.2, damage: damage * (1.15 + lv * 0.06),
        pierce: true, blastRadius: 13 + lv * 6,
        lifetime: 2.7,
        style: 'dragonaxe', nativeKey: 'lrl-axe', powerLevel: lv,
      });
      break;
    }
    case 'griffin':
    case 'express76':
    case 'merlin': {
      // Charged Big Gun — heavier horizontal cannon shells (wiki A1, not Prydwen rain).
      const n = lv <= 2 ? 1 : lv === 3 ? 2 : lv === 4 ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const { ox, oy } = volleyOffset(i, n, 52 + lv * 12);
        spawn({
          x: player.x + 46 + ox, y: player.y + oy,
          vx: speed * (0.75 + lv * 0.04), vy: 0,
          r: 10 + lv * 1.9, damage: damage * (n === 1 ? 1.22 : 0.72),
          blastRadius: 34 + lv * 12,
          lifetime: 1.5 + lv * 0.05,
          style: 'shell',
          delay: 0.08 + i * 0.09,
        });
      }
      break;
    }
    case 'fafnir': {
      // Thunder-field cloud — slow particle orb that chains; not a gear or seeker dart.
      // Spawn ahead as a weather seed (≠ muzzle-fired homing missile silhouette).
      const chains = lv <= 1 ? 1 : lv === 2 ? 2 : lv === 3 ? 3 : lv === 4 ? 3 : 4;
      const lock = nearest;
      const { c, s } = aimAt(lock, 0);
      const spd = speed * (0.58 + lv * 0.04);
      spawn({
        x: player.x + 52, y: player.y,
        vx: c * spd, vy: s * spd * 0.22,
        r: 16 + lv * 3.6, damage: damage * (1.5 + lv * 0.12),
        // Soft drift toward densest threat — field presence, not missile lock.
        homing: 1.15 + lv * 0.12, lifetime: 2.45 + lv * 0.12,
        homingTarget: lock,
        chainCount: chains, chainRadius: 165 + lv * 32,
        clearRadius: 20 + lv * 7,
        style: 'jupiterorb',
      });
      if (lv >= 5) {
        // Twin storm seed on a parallel lane (particle cloud, not a stacked clone).
        const { c: c2, s: s2 } = aim(0.28);
        spawn({
          x: player.x + 36, y: player.y + 28,
          vx: c2 * spd * 0.86, vy: s2 * spd * 0.55,
          r: 12 + lv, damage: damage * 0.78,
          homing: 1.0, lifetime: 2.1,
          homingTarget: pickSplitTarget(ranked, 1, 2) || lock,
          chainCount: 2, chainRadius: 130 + lv * 22,
          clearRadius: 16 + lv * 4,
          style: 'jupiterorb', delay: 0.08,
        });
      }
      break;
    }
    case 'eternity': {
      // P1 Coffin for Two: short local nullify/DR wall. RIP bombardment stays on C.
      spawn({
        x: player.x + 105, y: player.y,
        vx: 0, vy: 0,
        r: 28 + lv * 5, clearRadius: 38 + lv * 8,
        damage: damage * 0.7, pierce: true,
        lifetime: 0.62 + lv * 0.1,
        style: 'coffinwall',
      });
      break;
    }
    case 'labiata': {
      // Charged A1 Hundred Flower Blossoms: wide plasma bloom arcs (Trollsberd).
      // Aim-split widened so multi-arc stacks do not collapse into parallel laser pillars.
      const arcs = lv <= 2 ? 1 : lv === 3 ? 2 : lv === 4 ? 3 : 4;
      for (let i = 0; i < arcs; i++) {
        const side = arcs === 1 ? 0 : (i - (arcs - 1) / 2);
        const fan = side * (0.52 + lv * 0.05);
        const { c, s } = aim(fan);
        const spd = speed * (0.86 + lv * 0.03);
        spawn({
          x: player.x + 28, y: player.y + side * (20 + lv * 2),
          vx: c * spd, vy: s * spd,
          r: 13 + lv * 2.6,
          damage: damage * (arcs === 1 ? 1.58 : 0.82),
          pierce: true,
          waveAmplitude: 25 + lv * 7,
          waveFrequency: 6.8 + lv * 0.45,
          waveShape: 'sine',
          lifetime: 1.15 + lv * 0.07,
          style: 'plasmaslash',
          delay: i * 0.065,
        });
      }
      break;
    }
    default:
      spawn({
        vx: speed, vy: 0, r: 7 + lv, damage, pierce: true,
        style: 'railbolt', lifetime: 1.2,
      });
  }
  player.lastChargeName = CHARGE_NAMES[key] || '강화 사격';
}
