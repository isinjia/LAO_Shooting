/** C-gauge skills: offensive shots deal 6 / 12 / 18; Hirume's ward only clears bullets. */
const levels = (factory) => [1, 2, 3].map(factory);
const volley = (level, makeShot) => Array.from({ length: level }, (_, i) => makeShot(i, level));

export const SPECIAL_SKILL_PROFILES = {
  hirume: levels((level) => ({
    name: '야타가라스 정화 결계',
    role: 'bullet-clear',
    // Parked ward: each level multiplies both visible and bullet-clear radius.
    shots: [{ damage: 0, x: 36, vx: 0, vy: 0,
      r: 41 * level, clearRadius: 41 * level,
      lifetime: [0, 2, 4, 6][level], style: 'sunseal' }],
  })),
  constantia: levels((level) => ({
    name: '발목 잡기',
    role: 'pin-control',
    // One original Bori companion at every C level; higher levels strengthen
    // impact and the mark/root window instead of cloning the dog.
    shots: [{
      damage: level * 6, x: 42, y: 12,
      speed: 0.9, r: 31 + level * 3,
      homing: 8.5, lifetime: 2.2,
      markDuration: 1.7 + level * 0.75,
      rootDuration: 0.7 + level * 0.38,
      style: 'bori',
    }],
  })),
  lrl: levels((level) => ({
    name: '어둠의 도끼 · 환영 돌진',
    role: 'phantom-rush',
    // Lv1 uses the former Lv3 phantom. Lv2 fans three of those phantoms out;
    // Lv3 sends one phantom at triple the visual size and contact radius.
    shots: (level === 2 ? [-0.22, 0, 0.22] : [0]).map((angle) => ({
      damage: level === 2 ? 4 : level * 6,
      x: 48, vx: 961 * Math.cos(angle), vy: 961 * Math.sin(angle),
      r: level === 3 ? 177 : 59, clearRadius: level === 3 ? 177 : 59,
      cloneSize: level === 3 ? 354 : 118,
      pierce: true, lifetime: 1.8, style: 'lrlphantom',
      nativeKey: 'lrl-skill1-clone', color: '#62c9ff', glow: '#308bee',
    })),
  })),
  sleipnir: levels((level) => ({
    name: '제압 사격',
    role: 'suppression',
    // Unity Skill1: dual-gun burst + lastfire. Reuse HMG coffinround (no new shot type).
    shots: volley(level, (i, count) => {
      const lane = i - (count - 1) / 2;
      return {
        damage: 6,
        x: 44, y: lane * 18,
        vx: 900, vy: lane * 28,
        r: 5 + level,
        lifetime: 1.2,
        delay: i * 0.05,
        style: 'coffinround',
        color: '#ffbc73', glow: '#e81e2b',
      };
    }),
  })),
  merlin: levels((level) => ({
    name: 'UNREP 전술 지원',
    role: 'support-suppression',
    // Single target-designation impact. Player's UNREP fire support lasts
    // longer at higher C levels; the marker itself broadens for nearby packs.
    shots: [{ damage: level * 6, origin: 'target',
      vx: 0, vy: 0, r: 24 + level * 7, pierce: true,
      lifetime: 0.62 + level * 0.16,
      blastRadius: 16 + level * 19,
      clearRadius: level === 3 ? 22 : 0,
      style: 'commandmissile' }],
  })),
  express76: levels((level) => ({
    name: '화물 배송',
    role: 'freight-shipping',
    // Unity skill1 "Freight Shipping": Express herself jets to the target hauling
    // freight and slams it (single target), then flies back — see express76-skill.js.
    // This shot is the slam hitbox spawned on arrival: pushes the target back and
    // tags it with Courier Invoice (+20% damage taken from Express shots).
    shots: [{
      damage: level * 6,
      r: 30 + level * 8, clearRadius: 40 + level * 12,
      knockback: 40 + level * 30,
      invoiceDuration: 2.5 + level,
    }],
  })),
  fafnir: levels((level) => ({
    name: '쇼크 앤 오',
    role: 'area-shock',
    // A2 Shock and Awe starts on one enemy, then jumps into adjacent units.
    shots: [{ damage: level * 6, origin: 'target',
      vx: 0, vy: 0, r: 27 + level * 7, pierce: true,
      lifetime: 0.55 + level * 0.12,
      blastRadius: 25 + level * 13,
      chainCount: level, chainRadius: 78 + level * 25,
      style: 'teslacoil' }],
  })),
  eternity: levels((level) => ({
    name: '편히 잠드소서',
    role: 'area-salvo',
    // Active 2: coffin ordnance falls on a selected area; the hold remains a shield.
    shots: volley(level, (i, count) => {
      const lane = i - (count - 1) / 2;
      return {
        damage: 6,
        origin: 'top',
        x: lane * (58 + level * 6),
        y: lane * 18,
        vx: 0, vy: 1100,
        r: 24 + level * 3,
        blastRadius: 44 + level * 14,
        lifetime: 1.0,
        delay: i * 0.11, style: 'coffinmissile',
      };
    }),
  })),
  labiata: levels((level) => ({
    name: '백화제방',
    role: 'plasma-bloom',
    // One expanding plasma cross centered on the selected enemy.
    shots: [{ damage: level * 6, origin: 'target',
      vx: 0, vy: 0, r: 23 + level * 6, pierce: true,
      blastRadius: 30 + level * 16,
      lifetime: 0.58 + level * 0.14,
      style: 'plasmacross' }],
  })),
  griffin: levels((level) => ({
    name: '핸드 미사일',
    role: 'missile-strike',
    // Unity Skill1 hand missiles — pani_fire dart sheet from PA00EL_skill_1_fire.
    shots: volley(level, (i, count) => {
      const lane = i - (count - 1) / 2;
      return {
        damage: 6,
        x: 48, y: lane * 26,
        vx: 720, vy: lane * 40,
        r: 8 + level,
        blastRadius: 22 + level * 8,
        lifetime: 1.4,
        delay: i * 0.08,
        style: 'shell',
        nativeKey: 'griffin',
        color: '#ffc978', glow: '#ff6a2c',
      };
    }),
  })),
  emily: levels((level) => ({
    name: '버스터 캐논',
    role: 'buster-beam',
    // Active 2: one wide area cannon. Basic railgun stays thin and charge stays absent.
    shots: [{ damage: level * 6, x: 50, speed: 1.2,
      r: 20 + level * 9, pierce: true,
      beamLength: 360 + level * 135,
      blastRadius: 24 + level * 12,
      clearRadius: 12 + level * 6,
      lifetime: 1.08, style: 'busterbeam' }],
  })),
};
