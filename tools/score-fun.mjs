// Leader fun score (0-100 each) from eval-bosses.mjs output.
//   15 variety (distinct attacks: mid >= 3, boss >= 4; each owned by one leader)      15 escalation (bullets/s rises per phase)
//   15 readability (peak on-screen bullets <= 150)          20 fair difficulty (bot hits/min 1.5-4.5)
//   10 fight length (mid 44-76 s, boss 55-95 s (final x1.5), +8%/stage)  10 telegraph + counter window
//   10 movement variety (3 move kinds)                       5 signature attacks (>= 2 special kinds)
// usage: node tools/score-fun.mjs bosses.json
import fs from 'fs';

const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const SPECIAL = new Set(['grenade', 'lance', 'freeze', 'curtain', 'rain',
  // per-boss concept attacks (leader-script)
  'mortar', 'wall', 'bloom', 'orbit', 'snowfall', 'stall', 'homing', 'pincer', 'web', 'feather',
  // area attacks (leader-hazards)
  'laser', 'lightning', 'meteor', 'spike',
  // one-owner signatures (leader-routines: no two leaders share a pattern)
  'breath', 'shatter', 'chainwhip', 'quake', 'slash', 'buckshot', 'claw', 'gust', 'aurora', 'sigil',
  'girder', 'drill', 'barricade', 'cocoon', 'eggs', 'tornado', 'dive']);
const rows = [];
for (const s of d.stages) {
  const grow = 1 + (s.stage - 1) * 0.08;
  for (const L of [s.mid, s.boss]) {
    const boss = L.kind === 'boss';
    // Every leader owns its patterns (no sharing): 3 per midboss, 4 per boss.
    const need = boss ? 4 : 3;
    const variety = 15 * Math.min(1, L.kinds.length / need);
    const r = L.rate;
    const esc = 15 * ((r[1] > r[0] ? 0.5 : 0) + (r[2] > r[1] ? 0.5 : 0));
    const read = L.peak <= 150 ? 15 : Math.max(0, 15 * (1 - (L.peak - 150) / 70));
    const h = L.hitsPerMin;
    const fair = h >= 1.5 && h <= 4.5 ? 20 : h < 1.5 ? 20 * (h / 1.5) : Math.max(0, 20 * (1 - (h - 4.5) / 4.5));
    // Midboss HP was doubled (user) -> twice the fight; the final boss is three bodies at
    // half the stage HP each -> 1.5x.
    const span = boss ? (L.forms ? 1.5 : 1) : 2;
    const [lo, hi] = boss ? [55 * grow * span, 95 * grow * span] : [22 * grow * span, 38 * grow * span];
    const len = L.ttk >= lo && L.ttk <= hi ? 10 : Math.max(0, 10 * (1 - (L.ttk < lo ? (lo - L.ttk) / lo : (L.ttk - hi) / hi) / 0.4));
    const tele = (L.telegraph ? 5 : 0) + (L.rest ? 5 : 0);
    const move = 10 * Math.min(1, (L.moves.length - 1) / 2);
    const sig = 5 * Math.min(1, L.kinds.filter((k) => SPECIAL.has(k)).length / 2);
    const total = variety + esc + read + fair + len + tele + move + sig;
    rows.push({ key: L.key, total, parts: { variety, esc, read, fair, len, tele, move, sig }, h, peak: L.peak, rate: r, ttk: L.ttk });
  }
}
for (const r of rows) {
  console.log(`${r.key.padEnd(18)} ${r.total.toFixed(1).padStart(5)}  var ${r.parts.variety.toFixed(0)} esc ${r.parts.esc.toFixed(1)} read ${r.parts.read.toFixed(1)} fair ${r.parts.fair.toFixed(1)} len ${r.parts.len.toFixed(1)} move ${r.parts.move.toFixed(0)} sig ${r.parts.sig}  | hits/min ${r.h} peak ${r.peak} rate ${r.rate.join('/')} ttk ${r.ttk}`);
}
const avg = rows.reduce((a, r) => a + r.total, 0) / rows.length;
const min = Math.min(...rows.map((r) => r.total));
console.log(`FUN avg ${avg.toFixed(1)}  min ${min.toFixed(1)}`);
