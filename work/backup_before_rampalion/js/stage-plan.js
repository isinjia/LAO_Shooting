// Five arcade acts (~2 min wave phase each). Wave clocks, midAt, and bossAt are
// UNIQUE per stage so pacing/breathing differs — not only formations.
// midAt must sit between wave[8].at and wave[9].at; bossAt after the finale wave.
// Times exclude midboss / boss fight duration (clock pauses outside 'waves').

const group = (def, key, count, hp, score, i, offset = 0, tags = {}) => {
  const formations = def.formations || ['diagonal', 'pincer', 'grid', 'chevron', 'helix', 'stagger', 'escort'];
  const moves = def.moves || ['dive', 'arc', 'sine', 'weave', 'side', 'hover'];
  const patterns = def.patterns || ['aimed', 'fan', 'spread', 'burst', 'ring'];
  return {
    key, count, hp, score,
    formation: tags.formation || formations[(i + offset + def.seed) % formations.length],
    move: tags.move || moves[(i * 2 + offset) % moves.length],
    pattern: tags.pattern || patterns[(i + offset) % patterns.length],
    // Optional per-group tint (S5 remix) — applied in game spawn.
    tint: def.gruntTint || '',
    ambush: !!tags.ambush,
    role: tags.role || '',
    opening: !!tags.opening,
    powerCarrierIndex: -1,
  };
};

function makeStage(def) {
  // Light difficulty curve: early stages breathe, later stages pack denser waves.
  const stageEase = def.ease ?? 1;
  const breathSet = new Set(def.breathWaves || []);
  const ambushSet = new Set(def.ambushWaves || []);
  const aftermathSet = new Set(def.aftermathWaves || [9, 10]);
  const finaleSet = new Set(def.finaleWaves || [16, 17]);
  const times = def.waveTimes;
  if (!times || times.length !== 18) {
    throw new Error(`[stage-plan] ${def.name || '?'} needs exactly 18 waveTimes`);
  }
  const midAt = def.midAt;
  const bossAt = def.bossAt;
  if (!(times[8] < midAt && midAt < times[9])) {
    throw new Error(`[stage-plan] ${def.name}: midAt ${midAt} must be between wave8=${times[8]} and wave9=${times[9]}`);
  }
  if (!(bossAt > times[17])) {
    throw new Error(`[stage-plan] ${def.name}: bossAt ${bossAt} must be after last wave ${times[17]}`);
  }

  const waves = times.map((at, i) => {
    // Three authored tactical beats per act interrupt the shared rank grammar.
    // Each pair asks for a different target order or lane; P schedules remain intact.
    const signature = def.signatureWaves?.[i];
    if (signature) {
      const groups = signature.groups.map((spec, offset) => {
        const elite = spec.tier === 'elite';
        const key = spec.key || (elite ? def.elites[0] : def.grunts[0]);
        const baseHp = elite ? def.eliteHp : def.gruntHp;
        const baseScore = elite ? def.eliteScore : def.gruntScore;
        const authored = group(def, key, spec.count,
          Math.ceil(baseHp * (def.ease ?? 1) * (spec.hpScale ?? 1)),
          Math.round(baseScore * (spec.scoreScale ?? 1)), i, offset, {
            formation: spec.formation, move: spec.move,
            pattern: spec.pattern, role: 'signature', ambush: !!spec.ambush,
          });
        if (spec.tint) authored.tint = spec.tint;
        authored.signatureAnchor = elite;
        return authored;
      });
      return { at, groups, cue: signature.cue, role: 'signature' };
    }
    const second = i >= 9;
    // High-ease stages already scale HP — keep the late multiplier modest so S4/S5 stay readable.
    const lateBoost = second ? (1.26 + (stageEase > 1 ? 0.04 : 0)) : 1;
    const scale = lateBoost * stageEase;
    const elite = i % 3 === 2 || i === 6 || i === 14 || i === 17;
    const mixed = i % 4 === 2 || i === 11 || i === 16;
    const density = def.density ?? 0;
    const earlyEase = stageEase < 0.95 && i < 5 ? 1 : 0;
    const breath = breathSet.has(i);
    const ambush = ambushSet.has(i);
    const aftermath = second && aftermathSet.has(i);
    const finale = finaleSet.has(i);
    const opening = i < (def.openingEaseWaves || 0);
    // Extra density only on the final push (was every second-half wave). Skip breath beats.
    const densityPush = density > 0 && i >= 14 && !breath ? 1 : 0;
    const groups = [];

    const role = breath ? 'breather' : aftermath ? 'aftermath' : finale ? 'finale' : ambush ? 'ambush' : '';
    const roleTags = {};
    if (opening) roleTags.opening = true;
    if (ambush) {
      roleTags.ambush = true;
      roleTags.role = 'ambush';
      roleTags.formation = def.ambushFormation || 'pincer';
      roleTags.move = def.ambushMove || 'side';
    } else if (aftermath) {
      roleTags.role = 'aftermath';
      roleTags.formation = def.aftermathFormation || 'escort';
      roleTags.move = def.aftermathMove || 'hover';
      roleTags.pattern = def.aftermathPattern || 'aimed';
    } else if (finale) {
      roleTags.role = 'finale';
      roleTags.formation = def.finaleFormation || 'chevron';
      roleTags.move = def.finaleMove || 'dive';
    } else if (breath) {
      roleTags.role = 'breather';
      roleTags.formation = def.breathFormation || 'stagger';
      roleTags.move = def.breathMove || 'arc';
    } else if (role) {
      roleTags.role = role;
    }

    if (!elite || mixed) {
      const key = def.grunts[i % def.grunts.length];
      let count = Math.max(2, 4 + (def.countBonus ?? 0) + (i % 4) + (second ? 1 : 0) + density
        - (stageEase < 0.95 ? 1 : 0) - earlyEase
        + densityPush);
      if (breath) count = Math.max(2, count - 2);
      if (aftermath) count = Math.max(2, count - 1);
      if (ambush) count = Math.max(3, Math.min(count + 1, 7));
      if (finale) count = Math.max(count, count + 1);
      if (opening) count = Math.min(count, [2, 2, 3, 3, 4, 4][i] || 4);
      groups.push(group(def, key, count,
        Math.ceil(def.gruntHp * scale * (earlyEase ? 0.9 : 1) * (breath ? 0.92 : 1) * (aftermath ? 0.9 : 1) * (opening ? 0.8 : 1) + i * 0.3),
        def.gruntScore + i * 12, i, 0, roleTags));
    }
    if (elite || mixed) {
      const key = def.elites[i % def.elites.length];
      let count = Math.max(1, 2 + (i % 3) + densityPush
        - (earlyEase ? 1 : 0));
      if (breath) count = Math.max(1, count - 1);
      if (aftermath) count = Math.max(1, count - (i === 9 ? 1 : 0));
      if (finale) count = Math.max(count, 2);
      if (opening) count = 1;
      const eliteTags = { ...roleTags };
      // Elites keep stage tint only on abyss remix; clear otherwise.
      const eliteGroup = group(def, key, count,
        Math.ceil(def.eliteHp * scale * (earlyEase ? 0.92 : 1) * (aftermath ? 0.94 : 1) * (opening ? 0.7 : 1) + i),
        def.eliteScore + i * 32, i, 3, eliteTags);
      if (!def.eliteTint) eliteGroup.tint = '';
      else eliteGroup.tint = def.eliteTint;
      groups.push(eliteGroup);
    }
    // Predictable red carriers: the last member of a scheduled rank holds P.
    // A missed carrier can be replaced by a low-power recovery rank in Game.
    if ((def.powerCarrierWaves || [0, 4, 9, 14]).includes(i) && groups.length) {
      groups[0].powerCarrierIndex = groups[0].count - 1;
    }
    if (opening) {
      for (const g of groups) {
        g.pattern = i < 3 ? 'aimed' : g.pattern;
      }
    }

    let cue = '';
    if (breath) cue = def.breathCue || '호흡 구간';
    else if (aftermath && i === 9) cue = def.aftermathCue || '잔당 소탕';
    else if (finale && i === 16) cue = def.finaleCue || '최종 방어선';
    else if (ambush) cue = def.ambushCue || '기습 편대';
    else {
      cue = ({ 0: def.cues[0], 3: def.cues[1], 7: def.cues[2],
        9: def.cues[3], 14: def.cues[4] })[i] || '';
    }
    return { at, groups, cue, role: roleTags.role || '' };
  });
  return { ...def, waves, midAt, bossAt };
}

export const STAGES = [
  makeStage({
    name: '프로그램 침입', subtitle: '도시 외곽 · 감염된 네트워크',
    color: '#74d4ff', scene: 'city', bossStyle: 'program',
    ease: 0.84, density: 0,
    seed: 0,
    openingEaseWaves: 3,
    powerCarrierWaves: [0, 2, 4, 7, 11, 15],
    // City: measured opener — longer early gaps, mid earlier, tidy finale lane.
    waveTimes: [3, 9, 15, 22, 28, 35, 41, 47, 50, 58, 65, 72, 79, 86, 93, 100, 107, 114],
    midAt: 55, bossAt: 120,
    formations: ['diagonal', 'stagger', 'grid', 'helix', 'diagonal', 'escort', 'stagger'],
    moves: ['dive', 'side', 'weave', 'hover', 'arc', 'side'],
    // Opening act: single aimed shots and narrow 3-way bursts only (walls / fans from stage 2).
    patterns: ['aimed', 'burst', 'aimed', 'burst', 'aimed'],
    grunts: ['programmob_an', 'programmob_as'], elites: ['deathstalker'],
    // Named mobs (user): before the midboss, then between midboss and boss (game.js _namedFlow).
    named: ['testudo', 'kidnapper'],
    countBonus: 12, trail: 1.3, fireMul: 4.6, firstShot: 0.7,
    gruntHp: 8, eliteHp: 20, gruntScore: 220, eliteScore: 540,
    mid: 'mid_triton', boss: 'boss_hachiko', midHp: 1380, bossHp: 2415,
    midScore: 8500, bossScore: 24000,
    breathWaves: [4, 11],
    ambushWaves: [12],
    aftermathWaves: [9, 10],
    finaleWaves: [16, 17],
    signatureWaves: {
      6: { cue: '중계기 우선 파괴', groups: [
        { tier: 'elite', count: 1, hpScale: 0.9, formation: 'escort', move: 'hover', pattern: 'ring' },
        { count: 3, formation: 'pincer', move: 'side', pattern: 'aimed' },
      ] },
      12: { cue: '상하 침투로 차단', groups: [
        { count: 4, formation: 'pincer', move: 'side', pattern: 'aimed', ambush: true },
        { tier: 'elite', count: 1, hpScale: 0.75, formation: 'escort', move: 'hover', pattern: 'aimed' },
      ] },
      16: { cue: '중추 방어선 분할', groups: [
        { tier: 'elite', count: 2, formation: 'grid', move: 'hover', pattern: 'spread' },
        { count: 3, formation: 'diagonal', move: 'dive', pattern: 'aimed' },
      ] },
    },
    breathCue: '패킷 공백',
    ambushCue: '우회 침투',
    aftermathCue: '잔존 프로세스',
    finaleCue: '중추 게이트',
    ambushFormation: 'pincer', ambushMove: 'side',
    aftermathFormation: 'stagger', aftermathMove: 'hover', aftermathPattern: 'aimed',
    finaleFormation: 'helix', finaleMove: 'dive',
    breathFormation: 'escort', breathMove: 'arc',
    cues: ['외곽 방어선', '차단 구역', '침입 심화', '방어선 붕괴', '중추 접근'],
  }),
  makeStage({
    name: '철충 군집', subtitle: '지하 갱도 · 증식하는 군체',
    color: '#d49aff', scene: 'hive', bossStyle: 'insect',
    ease: 0.96, density: 0,
    seed: 2,
    // Hive: tight swarm cadence — early pressure, mid sooner, shorter post-mid breath.
    waveTimes: [2, 7, 12, 17, 23, 29, 34, 40, 45, 53, 58, 64, 69, 75, 81, 87, 93, 100],
    midAt: 50, bossAt: 106,
    formations: ['helix', 'chevron', 'pincer', 'helix', 'escort', 'chevron', 'stagger'],
    moves: ['dive', 'arc', 'weave', 'hover', 'sine', 'dive'],
    patterns: ['aimed', 'fan', 'ring', 'spread', 'ring'],
    grunts: ['wasp', 'slasher'], elites: ['destroyer'],
    // Named mobs (user): before the midboss, then between midboss and boss (game.js _namedFlow).
    named: ['chiller', 'dreadlurker'],
    countBonus: 11, trail: 2.0, fireMul: 1.75,
    gruntHp: 6, eliteHp: 26, gruntScore: 260, eliteScore: 700,
    mid: 'mid_nidhogg', boss: 'boss_csperrault', midHp: 1790, bossHp: 3250,
    midScore: 10000, bossScore: 29000,
    breathWaves: [3, 12],
    ambushWaves: [6, 13],
    aftermathWaves: [9, 10],
    finaleWaves: [15, 17],
    signatureWaves: {
      6: { cue: '산란 개체를 먼저 차단', groups: [
        { count: 5, formation: 'helix', move: 'weave', pattern: 'aimed', hpScale: 0.7 },
        { tier: 'elite', count: 1, formation: 'escort', move: 'hover', pattern: 'ring' },
      ] },
      12: { cue: '껍질 방패의 측면', groups: [
        { tier: 'elite', count: 2, formation: 'pincer', move: 'side', pattern: 'fan' },
        { count: 3, formation: 'stagger', move: 'dive', pattern: 'aimed' },
      ] },
      16: { cue: '군체 핵심 격리', groups: [
        { tier: 'elite', count: 1, hpScale: 1.3, formation: 'escort', move: 'hover', pattern: 'ring' },
        { count: 5, formation: 'helix', move: 'weave', pattern: 'aimed', hpScale: 0.7 },
      ] },
    },
    breathCue: '산란 휴지',
    ambushCue: '천장 기습',
    aftermathCue: '산란 잔파',
    finaleCue: '여왕 직속',
    ambushFormation: 'pincer', ambushMove: 'sine',
    aftermathFormation: 'chevron', aftermathMove: 'weave', aftermathPattern: 'fan',
    finaleFormation: 'helix', finaleMove: 'dive',
    breathFormation: 'stagger', breathMove: 'hover',
    cues: ['갱도 진입', '산란 지대', '군체 역습', '여왕의 소굴', '심층 번식지'],
  }),
  makeStage({
    name: '나이트칙 둥지', subtitle: '폐허 지대 · 둥지의 심장',
    color: '#ffb778', scene: 'nest', bossStyle: 'chick',
    ease: 1, density: 0,
    seed: 4,
    // Nest: wider breaths, mid later, longer approach to emperor.
    waveTimes: [4, 10, 17, 24, 31, 38, 44, 50, 54, 63, 70, 77, 84, 91, 98, 105, 112, 119],
    midAt: 60, bossAt: 125,
    formations: ['escort', 'stagger', 'chevron', 'grid', 'escort', 'diagonal', 'stagger'],
    moves: ['sine', 'arc', 'hover', 'weave', 'dive', 'side'],
    patterns: ['spread', 'fan', 'ring', 'fan', 'burst'],
    grunts: ['nightchick', 'intruder'], elites: ['tarantula'],
    // Named mobs (user): before the midboss, then between midboss and boss (game.js _namedFlow).
    named: ['frostbite', 'tarantula'],
    countBonus: 14, trail: 2.0, fireMul: 0.82,
    gruntHp: 8, eliteHp: 38, gruntScore: 290, eliteScore: 820,
    mid: 'mid_glacias', boss: 'boss_snowfeather', midHp: 1600, bossHp: 2800,
    midScore: 12000, bossScore: 34000,
    breathWaves: [5, 11],
    ambushWaves: [7, 14],
    aftermathWaves: [9, 10],
    finaleWaves: [16, 17],
    signatureWaves: {
      6: { cue: '부화 무리의 빈틈', groups: [
        { count: 4, formation: 'chevron', move: 'dive', pattern: 'fan', hpScale: 0.75 },
        { tier: 'elite', count: 1, formation: 'escort', move: 'hover', pattern: 'spread' },
      ] },
      12: { cue: '둥지 양측 급습', groups: [
        { count: 4, formation: 'pincer', move: 'arc', pattern: 'aimed', ambush: true },
        { tier: 'elite', count: 2, formation: 'stagger', move: 'hover', pattern: 'burst' },
      ] },
      16: { cue: '황제 근위대 분리', groups: [
        { tier: 'elite', count: 2, formation: 'escort', move: 'hover', pattern: 'fan' },
        { count: 4, formation: 'diagonal', move: 'dive', pattern: 'aimed' },
      ] },
    },
    breathCue: '깃털 공백',
    ambushCue: '둥지 측면',
    aftermathCue: '부화 잔당',
    finaleCue: '황제 근위',
    ambushFormation: 'diagonal', ambushMove: 'arc',
    aftermathFormation: 'escort', aftermathMove: 'sine', aftermathPattern: 'spread',
    finaleFormation: 'grid', finaleMove: 'hover',
    breathFormation: 'stagger', breathMove: 'weave',
    cues: ['폐허 진입', '부화 구역', '둥지 경계선', '둥지 내부', '황제의 영역'],
  }),
  makeStage({
    name: '기계 강습', subtitle: '군사 공항 · 중장갑 전선',
    color: '#9cc7ff', scene: 'airfield', bossStyle: 'machine',
    ease: 1.05, density: 1,
    seed: 1,
    // Airfield: martial bursts + reload gaps — punchy pairs, mid mid-pack, crisp boss gate.
    waveTimes: [3, 7, 12, 16, 22, 27, 33, 38, 43, 55, 59, 65, 70, 76, 81, 88, 94, 101],
    midAt: 52, bossAt: 107,
    formations: ['grid', 'stagger', 'chevron', 'grid', 'pincer', 'escort', 'diagonal'],
    moves: ['side', 'hover', 'dive', 'weave', 'arc', 'side'],
    patterns: ['aimed', 'burst', 'spread', 'burst', 'fan'],
    grunts: ['scout', 'spector'], elites: ['legion', 'harvester'],
    // Named mobs (user): before the midboss, then between midboss and boss (game.js _namedFlow).
    named: ['lightningbomber', 'harvester'],
    countBonus: 10, trail: 1.3, fireMul: 3.3,
    gruntHp: 8, eliteHp: 44, gruntScore: 410, eliteScore: 1080,
    mid: 'mid_goltarion', boss: 'boss_blacklilith', midHp: 2210, bossHp: 4494, // +30% / +50% (user)
    midScore: 14000, bossScore: 40000,
    // Breath beats in late half — open the lane before the next wall.
    breathWaves: [4, 10, 13, 15],
    ambushWaves: [6, 12],
    aftermathWaves: [9, 10],
    finaleWaves: [16, 17],
    signatureWaves: {
      6: { cue: '측면 포대 먼저 제거', groups: [
        { tier: 'elite', count: 2, formation: 'pincer', move: 'hover', pattern: 'spread' },
        { count: 3, formation: 'diagonal', move: 'dive', pattern: 'aimed' },
      ] },
      12: { cue: '장갑벽 중앙 돌파', groups: [
        { tier: 'elite', count: 2, hpScale: 0.85, formation: 'grid', move: 'hover', pattern: 'burst' },
        { count: 3, formation: 'chevron', move: 'side', pattern: 'aimed' },
      ] },
      16: { cue: '활주로 교차 포화', groups: [
        { tier: 'elite', count: 2, formation: 'escort', move: 'hover', pattern: 'fan' },
        { count: 4, formation: 'pincer', move: 'side', pattern: 'burst' },
      ] },
    },
    breathCue: '재장전 공백',
    ambushCue: '측면 포대',
    aftermathCue: '잔존 장갑',
    finaleCue: '활주로 봉쇄',
    ambushFormation: 'pincer', ambushMove: 'side',
    aftermathFormation: 'grid', aftermathMove: 'hover', aftermathPattern: 'burst',
    finaleFormation: 'chevron', finaleMove: 'dive',
    breathFormation: 'escort', breathMove: 'arc',
    cues: ['활주로 진입', '격납고 전투', '방어 포대', '전면 공격', '지휘함 접근'],
  }),
  makeStage({
    name: '심층 포식자', subtitle: '오염 도시 · 최후의 군체',
    color: '#ff7789', scene: 'abyss', bossStyle: 'abyss',
    ease: 1.10, density: 1,
    seed: 3,
    // Abyss: irregular pulse — clustered ambushes, longer mid gate, extended finale.
    waveTimes: [3, 6, 12, 16, 23, 28, 35, 40, 47, 59, 63, 69, 76, 81, 88, 94, 102, 110],
    midAt: 56, bossAt: 117,
    formations: ['helix', 'pincer', 'chevron', 'stagger', 'helix', 'grid', 'escort'],
    moves: ['abyss', 'weave', 'abyss', 'hover', 'sine', 'abyss'],
    patterns: ['ring', 'fan', 'burst', 'ring', 'aimed'],
    grunts: ['tracker', 'nestchaser'], elites: ['emperorchick', 'juggernaut', 'phalangites'],
    // Named mobs (user): before the midboss, then between midboss and boss (game.js _namedFlow).
    named: ['mammoth', 'juggernaut'],
    gruntTint: '#ff3d6a', eliteTint: '#c44dff',
    countBonus: 14, trail: 2.0, fireMul: 0.28,
    gruntHp: 10, eliteHp: 48, gruntScore: 460, eliteScore: 1230,
    mid: 'mid_satgat', boss: 'final_yimir', midHp: 2366, bossHp: 4778, // +30% / +50% (user)
    midScore: 18000, bossScore: 55000,
    breathWaves: [4, 10, 12, 15],
    ambushWaves: [5, 11, 14],
    aftermathWaves: [9, 10],
    finaleWaves: [16, 17],
    signatureWaves: {
      6: { cue: '융합 편대의 핵', groups: [
        { key: 'emperorchick', tier: 'elite', count: 1, hpScale: 1.1, formation: 'escort', move: 'hover', pattern: 'ring', tint: '#c44dff' },
        { key: 'tracker', count: 4, hpScale: 0.8, formation: 'helix', move: 'abyss', pattern: 'aimed', tint: '#ff3d6a' },
      ] },
      12: { cue: '균열 양측 봉쇄', groups: [
        { key: 'phalangites', tier: 'elite', count: 2, formation: 'pincer', move: 'side', pattern: 'spread', tint: '#c44dff' },
        { key: 'tracker', count: 4, formation: 'stagger', move: 'abyss', pattern: 'burst', tint: '#ff3d6a' },
      ] },
      16: { cue: '포식 핵 분리', groups: [
        { key: 'juggernaut', tier: 'elite', count: 1, hpScale: 1.3, formation: 'escort', move: 'hover', pattern: 'fan', tint: '#c44dff' },
        { key: 'nestchaser', count: 4, formation: 'chevron', move: 'dive', pattern: 'aimed', tint: '#ff3d6a' },
      ] },
    },
    breathCue: '심층 공백',
    ambushCue: '균열 기습',
    aftermathCue: '흡수 잔해',
    finaleCue: '핵 접근',
    ambushFormation: 'helix', ambushMove: 'abyss',
    aftermathFormation: 'pincer', aftermathMove: 'abyss', aftermathPattern: 'ring',
    finaleFormation: 'chevron', finaleMove: 'abyss',
    breathFormation: 'stagger', breathMove: 'hover',
    cues: ['심층 입구', '오염된 잔해', '흡수 지대', '군체 융합', '포식자의 핵'],
  }),
];
