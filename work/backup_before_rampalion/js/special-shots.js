import { SPECIAL_SKILL_PROFILES } from './special-skill-profiles.js';

// Each level spends all complete gauge segments. Offensive skills deal 6 / 12 / 18;
// Hirume's purification ward only clears bullets and deals no damage.
// X bomb remains stronger (pack 40 / leader 22, bullet clear, defensive invulnerability).
export const BOMB_LEADER_DAMAGE = 22;
export const BOMB_PACK_DAMAGE = 40;
/** Expected per-target special volley totals by level (Lv1–3). */
export const SPECIAL_VOLLEY_TARGETS = [6, 12, 18];

export function expectedSpecialDamage(key, level) {
  return key === 'hirume' ? 0 : SPECIAL_VOLLEY_TARGETS[level - 1];
}

/** Sum of shot.damage for one special definition (per-target budget). */
export function volleyDamageTotal(attack) {
  if (!attack?.shots?.length) return 0;
  return +attack.shots.reduce((s, sh) => s + (Number(sh.damage) || 0), 0).toFixed(4);
}

/** Bullet count spawned by one special definition. */
export function volleyBulletCount(attack) {
  return attack?.shots?.length || 0;
}

/**
 * Numeric special profile for all characters × Lv1–3.
 * Fails soft (returns rows); use assertSpecialBalance() to throw.
 */
export function analyzeSpecialAttacks(attacks = SPECIAL_ATTACKS) {
  const rows = [];
  for (const [key, levels] of Object.entries(attacks)) {
    for (let i = 0; i < 3; i++) {
      const attack = levels[i];
      const damage = volleyDamageTotal(attack);
      const bullets = volleyBulletCount(attack);
      const expected = expectedSpecialDamage(key, i + 1);
      const gaugeCost = i + 1; // spends `level` complete segments
      rows.push({
        key,
        level: i + 1,
        name: attack?.name || '',
        bullets,
        damage,
        expectedDamage: expected,
        damageOk: Math.abs(damage - expected) < 1e-6,
        gaugeCost,
        vsBombLeader: BOMB_LEADER_DAMAGE,
        belowBomb: damage < BOMB_LEADER_DAMAGE,
      });
    }
  }
  return rows;
}

/** Throw if any char/level has wrong total or Lv3 >= bomb leader chip. */
export function assertSpecialBalance(attacks = SPECIAL_ATTACKS) {
  const rows = analyzeSpecialAttacks(attacks);
  const bad = rows.filter((r) => !r.damageOk || (r.level === 3 && !r.belowBomb));
  if (bad.length) {
    const msg = bad.map((r) =>
      `${r.key} Lv${r.level}: dmg=${r.damage} (want ${r.expectedDamage}), belowBomb=${r.belowBomb}`,
    ).join('; ');
    throw new Error(`special balance failed: ${msg}`);
  }
  return rows;
}

export const SPECIAL_ATTACKS = SPECIAL_SKILL_PROFILES;
