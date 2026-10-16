// Leader routines for leader-script.js. Per phase: hp = phase starts at/below this HP
// ratio, move = movement style, attacks = looping routine (each telegraphed, then a
// counter window after the last one). skills: attack type -> the leader's own skill clip.
//
// Rule (user): every attack type belongs to exactly ONE leader - no two leaders share a
// pattern. tools/check-leader-patterns.mjs fails the build if one is reused.
const C = { red: '#ff5a5a', pink: '#ff7ad9', gold: '#ffd24a', cyan: '#7fe7ff', ice: '#bfeeff',
  violet: '#b88cff', white: '#ffffff', orange: '#ff9a3c', rock: '#c98b4a', steel: '#9aa3b0' };

export const LEADER_SCRIPTS = {
  // ---- midbosses ----
  // Triton (missile artillery mech): aimed missile salvos, missile rain, a missile curtain.
  mid_triton: { skills: { aimed: 'attack', meteor: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'drift', amp: 90 }, attacks: [
      { type: 'aimed', dur: 2.0, every: 0.5, ways: 3, spread: 0.32, speed: 190, color: C.cyan },
      { type: 'curtain', dur: 2.4, every: 0.75, gap: 130, gapDrift: 110, speed: 165, color: C.white, r: 4.5 },
    ] },
    { hp: 0.6, move: { kind: 'swoop', amp: 120, speed: 0.55 }, attacks: [
      { type: 'meteor', dur: 2.4, every: 0.8, count: 2, r: 36, warn: 1.0, color: C.orange, color2: C.red, core: '#ffffff' },
      { type: 'aimed', dur: 1.8, every: 0.42, ways: 5, spread: 0.6, speed: 200, color: C.cyan },
    ] },
    { hp: 0.3, move: { kind: 'track', speed: 80 }, attacks: [
      { type: 'curtain', dur: 2.2, every: 0.5, gap: 115, gapDrift: 140, speed: 185, color: C.white, r: 4.5 },
      { type: 'meteor', dur: 2.4, every: 0.7, count: 3, r: 38, warn: 1.0, shards: 4, color: C.orange, color2: C.red, core: '#ffffff' },
      { type: 'aimed', dur: 1.6, every: 0.35, ways: 5, spread: 0.7, speed: 215, color: C.cyan },
    ] },
  ] },
  // Nidhogg (fire dragon): a hose sweep, twin fire spirals, a flamethrower cone.
  mid_nidhogg: { rest: 1.0, skills: { breath: 'attack', spiral: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'drift', amp: 110 }, attacks: [
      { type: 'sweep', dur: 2.6, every: 0.08, period: 2.4, arc: 0.75, ways: 1, speed: 241, color: C.orange },
      { type: 'breath', dur: 2.2, half: 0.15, len: 700, sweep: 0, warn: 0.95, life: 0.9, color: C.orange, color2: C.gold },
    ] },
    { hp: 0.6, move: { kind: 'track', speed: 106 }, attacks: [
      { type: 'spiral', dur: 2.8, every: 0.208, arms: 3, turn: 1.8, speed: 196, color: C.orange, twin: true, color2: C.gold },
      { type: 'breath', dur: 2.2, half: 0.17, len: 740, sweep: 0, warn: 0.9, life: 1.0, color: C.orange, color2: C.gold },
    ] },
    { hp: 0.3, move: { kind: 'swoop', amp: 140 }, attacks: [
      { type: 'sweep', dur: 2.4, every: 0.08, period: 1.6, arc: 0.9, ways: 2, speed: 246, color: C.orange },
      { type: 'spiral', dur: 2.4, every: 0.176, arms: 4, turn: 2.0, speed: 202, color: C.red, twin: true, color2: C.gold },
      { type: 'breath', dur: 2.2, half: 0.19, len: 780, sweep: 0, warn: 0.85, life: 1.0, color: C.red, color2: C.gold },
    ] },
  ] },
  // Glacias (ice dragon): freezing shard fans, ice pillars, crystals that shatter.
  mid_glacias: { skills: { freeze: 'attack', spike: 'attack', shatter: 'attack' }, phases: [
    { hp: 1, move: { kind: 'drift', amp: 100 }, attacks: [
      { type: 'freeze', dur: 2.4, every: 0.65, ways: 9, spread: 1.4, accel: 260, speed: 260, color: C.ice, r: 5 },
      { type: 'shatter', dur: 2.4, every: 1.0, count: 2, speed: 120, fuse: 0.9, shards: 8, shardSpeed: 150, color: C.ice, color2: C.cyan },
    ] },
    { hp: 0.6, move: { kind: 'swoop', amp: 130, speed: 0.55 }, attacks: [
      { type: 'spike', dur: 2.4, every: 1.2, rows: 1, fan: 0.5, count: 9, step: 62, r: 24, color: C.cyan, color2: C.white },
      { type: 'freeze', dur: 2.6, every: 0.75, ways: 11, spread: 1.7, accel: 280, speed: 270, color: C.ice },
    ] },
    { hp: 0.3, move: { kind: 'track', speed: 85 }, attacks: [
      { type: 'shatter', dur: 2.4, every: 0.8, count: 3, speed: 130, fuse: 0.85, shards: 9, shardSpeed: 160, color: C.ice, color2: C.cyan },
      { type: 'spike', dur: 2.4, every: 1.0, rows: 2, fan: 0.6, count: 9, step: 62, r: 24, color: C.cyan, color2: C.white },
      { type: 'freeze', dur: 2.4, every: 0.55, ways: 11, spread: 1.9, accel: 300, speed: 280, color: C.ice },
    ] },
  ] },
  // Goltarion (cloaked golem with a spiked chain blade): grenades, the chain whip, quakes.
  mid_goltarion: { skills: { grenade: 'attack', quake: 'attack', chainwhip: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'track', speed: 60 }, attacks: [
      { type: 'grenade', dur: 2.4, every: 0.85, fuse: 1.0, scatter: 0.6, speed: 160, burst: 9, burstSpeed: 140, color: C.orange, color2: C.gold },
      { type: 'chainwhip', dur: 2.0, links: 12, spacing: 26, arc: 1.6, swing: 0.9, speed: 230, color: C.rock, color2: C.gold },
    ] },
    { hp: 0.6, move: { kind: 'drift', amp: 130 }, attacks: [
      { type: 'quake', dur: 2.6, every: 1.2, count: 8, step: 82, w: 46, top: 190, warn: 0.6, gap: 0.09, color: C.rock, color2: C.gold },
      { type: 'grenade', dur: 2.6, every: 0.6, fuse: 0.9, scatter: 0.9, speed: 170, burst: 11, burstSpeed: 150, color: C.orange, color2: C.gold },
    ] },
    { hp: 0.3, move: { kind: 'swoop', amp: 150 }, attacks: [
      { type: 'chainwhip', dur: 2.0, links: 15, spacing: 26, arc: 2.0, swing: 0.8, speed: 260, color: C.rock, color2: C.gold },
      { type: 'quake', dur: 2.6, every: 1.0, count: 9, step: 78, w: 50, top: 160, warn: 0.55, gap: 0.08, color: C.rock, color2: C.gold },
      { type: 'grenade', dur: 2.4, every: 0.5, fuse: 0.85, scatter: 1.0, speed: 180, burst: 11, burstSpeed: 160, color: C.orange, color2: C.gold },
    ] },
  ] },
  // Satgat (wandering swordsman): blades raining down, sword-wind rings, field-wide slashes.
  mid_satgat: { skills: { slash: 'attack', rain: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'drift', amp: 120 }, attacks: [
      { type: 'rain', dur: 2.6, every: 0.09, speed: 175, color: C.violet, r: 5 },
      { type: 'ring', dur: 1.8, every: 0.6, count: 12, speed: 150, color: C.pink },
    ] },
    { hp: 0.6, move: { kind: 'swoop', amp: 140 }, attacks: [
      { type: 'slash', dur: 2.2, every: 0.8, count: 2, width: 12, warn: 0.6, life: 0.18, color: C.pink },
      { type: 'ring', dur: 1.8, every: 0.5, count: 14, speed: 160, color: C.violet },
    ] },
    { hp: 0.3, move: { kind: 'track', speed: 100 }, attacks: [
      { type: 'rain', dur: 2.4, every: 0.06, speed: 185, color: C.violet },
      { type: 'slash', dur: 2.2, every: 0.7, count: 3, width: 12, warn: 0.55, life: 0.18, color: C.pink },
      { type: 'ring', dur: 1.8, every: 0.42, count: 16, speed: 165, color: C.violet },
    ] },
  ] },
  // ---- stage bosses ----
  // Stage 1 Hachiko of the Rampart (siege): shield walls, mortar marks, the heavy cannon,
  // close-range buckshot. skill1 = cannon shot, skill2 = shield slam.
  boss_hachiko: { rest: 1.4, skills: { mortar: 'attack', lance: 'attack', buckshot: 'attack', wall: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'drift', amp: 100 }, attacks: [
      { type: 'wall', dur: 4.2, every: 2.6, gap: 130, step: 40, speed: 115, color: C.gold },
      { type: 'mortar', dur: 3.2, every: 1.1, warn: 1.1, radius: 46, burst: 7, burstSpeed: 100, color: C.orange, color2: C.gold },
      { type: 'buckshot', dur: 1.8, every: 0.7, pellets: 9, spread: 0.55, speed: 230, color: C.red, color2: C.gold },
    ] },
    { hp: 0.65, move: { kind: 'track', speed: 75 }, attacks: [
      { type: 'mortar', dur: 3.2, every: 1.15, warn: 1.15, radius: 48, burst: 6, burstSpeed: 100, color: C.orange, color2: C.gold },
      { type: 'lance', dur: 1.5, warn: 0.65, speed: 420, color: C.red },
      { type: 'wall', dur: 3.6, every: 1.6, gap: 130, step: 36, speed: 120, color: C.gold },
    ] },
    { hp: 0.32, move: { kind: 'swoop', amp: 150 }, attacks: [
      { type: 'wall', dur: 3.0, every: 2.0, gap: 120, step: 36, speed: 135, color: C.gold },
      { type: 'mortar', dur: 3.0, every: 1.0, warn: 1.1, radius: 50, burst: 6, burstSpeed: 105, color: C.orange, color2: C.gold },
      { type: 'lance', dur: 1.5, warn: 0.6, speed: 440, color: C.red, side: 0.2 },
      { type: 'buckshot', dur: 1.8, every: 0.55, pellets: 11, spread: 0.6, speed: 245, color: C.red, color2: C.gold },
    ] },
  ] },
  // Stage 2 CS Perrault (fairy-tale magic + cat): blooming flowers, magic circles, prism
  // lasers, claw rakes. skill1 = spinning leap, skill2 = claws flung open.
  // Stage 2 boss ~1.5x harder again (user): rest 0.7, every x0.83, counts x1.1, speed x1.12,
  // warn x0.85.
  boss_csperrault: { rest: 0.7, skills: { orbit: 'attack', claw: 'attack', bloom: 'skill2', laser: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'drift', amp: 130 }, attacks: [
      { type: 'bloom', dur: 2.8, every: 0.67, count: 18, petals: 4, speed: 188, color: C.pink, color2: C.white },
      { type: 'orbit', dur: 2.4, count: 8, radius: 72, hold: 1.2, spin: 3, speed: 289, color: C.pink, color2: C.violet },
      { type: 'claw', dur: 2.0, every: 0.72, len: 340, gapPx: 50, width: 9, warn: 0.64, color: C.pink },
    ] },
    { hp: 0.65, move: { kind: 'swoop', amp: 140 }, attacks: [
      { type: 'orbit', dur: 2.3, count: 12, radius: 80, hold: 1.12, spin: 3.6, speed: 301, color: C.violet, color2: C.pink },
      { type: 'laser', dur: 2.2, count: 3, spread: 1.1, width: 12, warn: 0.77, life: 0.6, spin: 0.16, color: C.pink },
      { type: 'bloom', dur: 2.6, every: 0.43, count: 20, petals: 6, speed: 200, color: C.pink, color2: C.gold },
    ] },
    { hp: 0.32, move: { kind: 'track', speed: 119 }, attacks: [
      { type: 'bloom', dur: 2.6, every: 0.43, count: 22, petals: 5, speed: 213, turn: 0.5, color: C.violet, color2: C.pink },
      { type: 'claw', dur: 2.0, every: 0.63, len: 380, gapPx: 50, width: 9, warn: 0.59, color: C.violet },
      { type: 'orbit', dur: 2.2, count: 15, radius: 88, hold: 1.04, spin: 4, speed: 314, color: C.pink, color2: C.white },
      { type: 'laser', dur: 2.2, count: 4, spread: 1.9, width: 12, warn: 0.77, life: 0.6, spin: 0.2, color: C.violet },
    ] },
  ] },
  // Stage 3 Snow Feather (blizzard): snowfall, icicles that hang then shoot, wind gusts, an
  // aurora ribbon. skill1 = dive into a wing spread, skill2 = ice crystals scattered.
  boss_snowfeather: { rest: 1.3, skills: { stall: 'attack', gust: 'attack', snowfall: 'skill2', aurora: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'drift', amp: 140, speed: 0.7 }, attacks: [
      { type: 'snowfall', dur: 3.0, every: 0.14, speed: 95, drift: 40, sway: 70, color: C.white, r: 4.5 },
      { type: 'stall', dur: 2.6, every: 1.0, count: 10, spread: 1.7, speed: 260, stop: 0.5, hold: 0.5, speed2: 220, color: C.ice, color2: C.cyan },
      { type: 'aurora', dur: 2.4, every: 0.7, step: 30, speed: 130, shift: 0.55, color: C.cyan, color2: C.white },
    ] },
    { hp: 0.65, move: { kind: 'swoop', amp: 150 }, attacks: [
      { type: 'stall', dur: 2.8, every: 1.0, count: 12, spread: 2.2, speed: 270, stop: 0.5, hold: 0.45, speed2: 235, color: C.ice, color2: C.cyan },
      { type: 'gust', dur: 2.6, every: 0.07, speed: 260, amp: 40, freq: 3, color: C.white },
      { type: 'snowfall', dur: 2.8, every: 0.1, speed: 105, drift: 45, sway: 80, color: C.white, r: 4.5 },
    ] },
    { hp: 0.32, move: { kind: 'track', speed: 90 }, attacks: [
      { type: 'aurora', dur: 2.4, every: 0.55, step: 28, speed: 145, shift: 0.7, color: C.cyan, color2: C.white },
      { type: 'stall', dur: 2.6, every: 0.85, count: 14, spread: 2.6, speed: 280, stop: 0.45, hold: 0.4, speed2: 250, color: C.ice, color2: C.cyan },
      { type: 'gust', dur: 2.4, every: 0.05, speed: 280, amp: 50, freq: 3.4, color: C.white },
      { type: 'snowfall', dur: 2.6, every: 0.075, speed: 115, drift: 50, sway: 90, color: C.white, r: 4.5 },
    ] },
  ] },
  // Stage 4 Black Lilith (dark witch): hunting orbs, pincer streams, black lightning, curse
  // sigils. skill1 = blade throws, skill2 = blades to both sides.
  boss_blacklilith: { rest: 1.2, skills: { homing: 'attack', sigil: 'attack', pincer: 'skill2', lightning: 'skill2' }, phases: [
    { hp: 1, move: { kind: 'track', speed: 80 }, attacks: [
      { type: 'homing', dur: 2.8, every: 0.55, ways: 2, speed: 165, turn: 2.8, home: 2.0, color: C.violet, r: 7 },
      { type: 'pincer', dur: 2.6, every: 0.5, chain: 4, speed: 215, color: C.red },
      { type: 'sigil', dur: 2.4, every: 1.0, count: 1, r: 54, warn: 0.9, color: C.violet, color2: C.red },
    ] },
    { hp: 0.65, move: { kind: 'swoop', amp: 150, speed: 0.75 }, attacks: [
      { type: 'pincer', dur: 2.6, every: 0.4, chain: 5, speed: 225, color: C.red },
      { type: 'homing', dur: 2.8, every: 0.6, ways: 3, speed: 170, turn: 3.0, home: 2.1, color: C.violet, r: 7 },
      { type: 'lightning', dur: 2.4, every: 0.9, count: 2, spacing: 150, width: 20, warn: 0.7, color: C.violet },
    ] },
    { hp: 0.32, move: { kind: 'drift', amp: 150, speed: 1.4 }, attacks: [
      { type: 'homing', dur: 2.6, every: 0.42, ways: 3, speed: 180, turn: 3.3, home: 2.2, color: C.violet, r: 7 },
      { type: 'sigil', dur: 2.4, every: 0.8, count: 2, r: 56, warn: 0.85, color: C.violet, color2: C.red },
      { type: 'pincer', dur: 2.4, every: 0.32, chain: 5, speed: 235, color: C.red },
      { type: 'lightning', dur: 2.4, every: 0.9, count: 3, spacing: 140, horizontal: 'alt', width: 20, warn: 0.7, color: C.violet },
    ] },
  ] },
  // Stage 5 the Commander: three separate fights, one body each (game.js FINAL_FORM_HP);
  // each body runs one of these phases for its whole fight.
  //  1 Yimir - construction mech: steel girders, a grinding drill, barricade tape
  //  2 Arachne - spider: the web, a closing cocoon, egg clutches that hatch
  //  3 Roc - giant bird: feather crescents, a tornado, a swooping dive (rushes across)
  doomeater: { rest: 1.1, phases: [
    // Yimir: skill1 = claw arm thrust (drill / girders), skill2 = warning sign planted (tape).
    { hp: 1, skills: { drill: 'attack', girder: 'attack', barricade: 'skill2' }, move: { kind: 'drift', amp: 120, speed: 0.6 }, attacks: [
      { type: 'girder', dur: 2.8, every: 1.1, count: 2, spacing: 150, width: 30, warn: 0.75, color: C.gold },
      { type: 'drill', dur: 3.0, every: 1.3, speed: 300, travel: 0.6, rings: 4, count: 10, ringSpeed: 150, color: C.steel, color2: C.gold },
      { type: 'barricade', dur: 2.6, every: 1.45, lanes: 5, width: 22, warn: 0.85, color: C.gold },
    ] },
    // Arachne: skill1 = cannon arm aimed (cocoon / eggs), skill2 = barrels raised (the web).
    { hp: 1, skills: { cocoon: 'attack', eggs: 'attack', web: 'skill2' }, move: { kind: 'swoop', amp: 140 }, attacks: [
      { type: 'web', dur: 2.6, strands: 6, spread: 2.6, length: 340, spacing: 44, rings: [130, 230], hold: 1.0, speed: 120, color: C.white, color2: C.violet },
      { type: 'cocoon', dur: 2.6, every: 0.95, count: 13, radius: 160, hold: 1.0, speed: 140, color: C.white },
      { type: 'eggs', dur: 3.0, count: 6, hatch: 1.0, gap: 0.2, brood: 6, speed: 150, color: C.violet, color2: C.red },
    ] },
    // Roc: skill1 = golden feathers raised (feathers / tornado), skill2 = wings spread (dive).
    { hp: 1, skills: { feather: 'attack', tornado: 'attack', dive: 'skill2' }, move: { kind: 'rush', period: 6, reach: 330, speed: 120 }, attacks: [
      { type: 'feather', dur: 2.8, every: 0.6, ways: 7, spread: 0.9, wing: 62, accel: 320, speed: 270, color: C.gold, color2: C.white },
      { type: 'tornado', dur: 2.8, every: 0.75, count: 14, radius: 52, spin: 6, speed: 150, color: C.gold, color2: C.white },
      { type: 'dive', dur: 2.4, every: 0.85, width: 62, warn: 0.8, life: 0.32, color: C.gold, color2: '#fff4c8' },
      { type: 'feather', dur: 2.6, every: 0.58, ways: 7, spread: 1.2, wing: 70, accel: 340, speed: 285, color: C.white, color2: C.gold },
    ] },
  ] },
};
// The final boss (the Commander) runs the doomeater routine, one phase per body.
LEADER_SCRIPTS.final_yimir = LEADER_SCRIPTS.doomeater;

// Hardening pass (user): stage 2 boss, stage 4-5 midbosses and bosses fire denser and
// faster, with shorter rests / telegraphs. Same attack types (one owner per pattern).
const COUNT_KEYS = ['count', 'ways', 'petals', 'arms', 'chain', 'links', 'burst', 'brood', 'strands', 'lanes'];
const SPEED_KEYS = ['speed', 'speed2', 'ringSpeed', 'burstSpeed'];
function harden(key, { every = 0.8, speed = 1.1, count = 1.25, rest = 0.75, warn = 0.9 }) {
  const s = LEADER_SCRIPTS[key];
  if (!s || s._hardened) return;
  s._hardened = true;
  if (s.rest) s.rest = +(s.rest * rest).toFixed(2);
  for (const ph of s.phases) {
    for (const a of ph.attacks) {
      if (a.every) a.every = +(a.every * every).toFixed(3);
      if (a.warn) a.warn = +Math.max(0.4, a.warn * warn).toFixed(2);
      for (const k of SPEED_KEYS) if (typeof a[k] === 'number') a[k] = Math.round(a[k] * speed);
      for (const k of COUNT_KEYS) if (typeof a[k] === 'number' && a[k] >= 2) a[k] = Math.round(a[k] * count);
    }
  }
}
harden('boss_csperrault', { every: 0.78, speed: 1.12, count: 1.3, rest: 0.6 });
harden('mid_goltarion', { every: 0.82, speed: 1.08, count: 1.25, rest: 0.8 });
harden('mid_satgat', { every: 0.82, speed: 1.08, count: 1.25, rest: 0.8 });
harden('boss_blacklilith', { every: 0.8, speed: 1.1, count: 1.25, rest: 0.75 });
harden('doomeater', { every: 0.8, speed: 1.1, count: 1.25, rest: 0.75 }); // = final_yimir
