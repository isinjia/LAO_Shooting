// Wave fun / difficulty score per stage (0-100) and overall level balance (0-100) from
// eval-waves.mjs (+ the boss balance score).
//  Wave score: 20 pacing (enemies on screen 70-95% of the time)   15 kill ratio (>= 75%)
//              20 fair difficulty (bot hits/min 0.8-3.0)            10 readability (peak <= 100)
//              15 variety (>= 4 attack patterns, >= 4 move kinds)   10 escalation (2nd half >= 1st)
//              10 snappy grunts (time on screen to kill 0.4-1.8 s)
//  Level balance: 30 difficulty rises with the stage (wave hits/min, 20% slack, s5 > s1)
//                 20 power curve (P at boss: s1 >= 3, later >= 4)  20 wave length 100-150 s
//                 15 elite kill time 1.5-6 s                        15 boss balance score (/100)
// usage: node tools/score-waves.mjs waves.json [bossBalanceScore]
import fs from 'fs';

const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const bossBal = Number(process.argv[3] || 0);
const band = (v, lo, hi, falloff) => (v >= lo && v <= hi ? 1 : Math.max(0, 1 - (v < lo ? (lo - v) : (v - hi)) / falloff));
const rows = [];
for (const s of d.stages) {
  const pace = 20 * band(s.busy, 0.7, 0.95, 0.35);
  const kill = 15 * band(s.killRatio, 0.75, 1, 0.4);
  const fair = 20 * band(s.hitsPerMin, 0.8, 3.0, 3);
  const read = 10 * band(s.peak, 0, 100, 70);
  const variety = 15 * (Math.min(1, s.patterns.length / 4) * 0.5 + Math.min(1, s.moves.length / 4) * 0.5);
  const esc = 10 * (s.secondHalf >= s.firstHalf ? 1 : Math.max(0, s.secondHalf / Math.max(1, s.firstHalf)));
  const snap = s.gruntTTK == null ? 0 : 10 * band(s.gruntTTK, 0.4, 1.8, 1.5);
  const total = pace + kill + fair + read + variety + esc + snap;
  rows.push({ s, total });
  console.log(`stage ${s.stage}  ${total.toFixed(1).padStart(5)}  pace ${pace.toFixed(1)} kill ${kill.toFixed(1)} fair ${fair.toFixed(1)} read ${read.toFixed(1)} var ${variety.toFixed(1)} esc ${esc.toFixed(1)} snap ${snap.toFixed(1)}`
    + ` | busy ${s.busy} kills ${s.killRatio} hits/min ${s.hitsPerMin} peak ${s.peak} grunt ${s.gruntTTK}s elite ${s.eliteTTK}s P ${s.lvAtMid}/${s.lvAtBoss} wave ${s.waveTime}s`);
}
const avg = rows.reduce((a, r) => a + r.total, 0) / rows.length;
const min = Math.min(...rows.map((r) => r.total));
console.log(`WAVES avg ${avg.toFixed(1)} min ${min.toFixed(1)}`);

const st = d.stages;
let curve = 0;
for (let i = 1; i < st.length; i++) curve += st[i].hitsPerMin >= st[i - 1].hitsPerMin * 0.8 ? 1 : 0;
curve = 30 * (0.75 * curve / Math.max(1, st.length - 1) + 0.25 * (st[st.length - 1].hitsPerMin > st[0].hitsPerMin ? 1 : 0));
const power = 20 * st.reduce((a, s, i) => a + (s.lvAtBoss >= (i === 0 ? 3 : 4) ? 1 : s.lvAtBoss / (i === 0 ? 3 : 4)), 0) / st.length;
const len = 20 * st.reduce((a, s) => a + band(s.waveTime, 100, 150, 60), 0) / st.length;
const elite = 15 * st.reduce((a, s) => a + (s.eliteTTK == null ? 0.5 : band(s.eliteTTK, 1.5, 6, 4)), 0) / st.length;
const boss = 15 * Math.min(1, bossBal / 100);
const level = curve + power + len + elite + boss;
console.log(`LEVEL curve ${curve.toFixed(1)}/30 power ${power.toFixed(1)}/20 length ${len.toFixed(1)}/20 elite ${elite.toFixed(1)}/15 boss ${boss.toFixed(1)}/15 => LEVEL BALANCE ${level.toFixed(1)}`);
