// Balance score (0-100) from eval-balance.mjs (pilot DPS / speed) and eval-bosses.mjs
// (measured leader kill times + stage length). Reference: Strikers 1945 II pacing.
//   A 40  DPS tiers vs Griffin at P Lv3 and Lv5 (+-15% band)
//   B 20  role constraints (human top DPS, bird fastest, human = bird - 2 speed steps, ...)
//   C 25  leader time-to-kill windows (midboss 22-38 s, boss 55-95 s, +8%/stage)
//   D 15  stage length 3-4.5 min (wave time + both fights)
// usage: node tools/score-balance.mjs pilots.json [bosses.json]
import fs from 'fs';

const pilots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const bosses = process.argv[3] && fs.existsSync(process.argv[3]) ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;

const TARGET = { griffin: 1.0, sleipnir: 1.2, express76: 0.9, constantia: 1.15, lrl: 1.25, peregrinus: 1.3, 'peregrinus*': 1.55 };
const lines = [];
let A = 0; let n = 0;
for (const [k, t] of Object.entries(TARGET)) {
  for (const lv of ['3', '5']) {
    const r = pilots[k].dps[lv] / pilots.griffin.dps[lv];
    const e = Math.abs(r / t - 1);
    A += Math.max(0, 1 - e / 0.15); n += 1;
    lines.push(`${k} Lv${lv}: ${r.toFixed(2)} (target ${t}) err ${(e * 100).toFixed(0)}%`);
  }
}
A = (A / n) * 40;

const sp = (k) => pilots[k].speed;
const d = (k, lv = '3') => pilots[k].dps[lv];
const checks = [
  ['human top DPS (Lv3, Lv5)', ['3', '5'].every((lv) => Object.keys(TARGET).every((k) => k === 'peregrinus*' || d(k, lv) < d('peregrinus*', lv)))],
  ['bird fastest', Object.keys(TARGET).every((k) => k === 'peregrinus' || sp(k) < sp('peregrinus'))],
  ['human speed = bird - 2 steps (50-70 px/s)', sp('peregrinus') - sp('peregrinus*') >= 50 && sp('peregrinus') - sp('peregrinus*') <= 70],
  ['bird DPS ~2 steps under human (0.75-0.9)', d('peregrinus') / d('peregrinus*') >= 0.75 && d('peregrinus') / d('peregrinus*') <= 0.9],
  ['sleipnir top DPS of the base three', d('sleipnir') > d('griffin') && d('sleipnir') > d('express76') && d('sleipnir', '5') > d('griffin', '5')],
  ['express fastest of the base three', sp('express76') > sp('griffin') && sp('express76') > sp('sleipnir')],
  ['griffin in the middle (speed and DPS)', sp('griffin') > sp('sleipnir') && sp('griffin') < sp('express76') && d('griffin') > d('express76') && d('griffin') < d('sleipnir')],
  ['LRL / Constantia beat every base pilot overall', ['lrl', 'constantia'].every((k) => ['griffin', 'sleipnir', 'express76'].every((b) => d(k) / d('griffin') + sp(k) / 300 > d(b) / d('griffin') + sp(b) / 300))],
];
const B = (checks.filter((c) => c[1]).length / checks.length) * 20;
checks.forEach((c) => lines.push(`${c[1] ? 'PASS' : 'FAIL'} ${c[0]}`));

let C = 0; let D = 0;
if (bosses) {
  let cn = 0; let dn = 0;
  for (const s of bosses.stages) {
    const grow = 1 + (s.stage - 1) * 0.08;
    for (const [kind, lo, hi] of [['mid', 22, 38], ['boss', 55, 95]]) {
      const t = s[kind + 'TTK'];
      const L = lo * grow; const Hh = hi * grow;
      const sc = t >= L && t <= Hh ? 1 : Math.max(0, 1 - (t < L ? (L - t) / L : (t - Hh) / Hh) / 0.4);
      C += sc; cn += 1;
      lines.push(`stage ${s.stage} ${kind} TTK ${t.toFixed(1)}s (window ${L.toFixed(0)}-${Hh.toFixed(0)}) -> ${sc.toFixed(2)}`);
    }
    const len = s.length;
    const sc = len >= 180 && len <= 270 ? 1 : Math.max(0, 1 - (len < 180 ? (180 - len) / 180 : (len - 270) / 270) / 0.4);
    D += sc; dn += 1;
    lines.push(`stage ${s.stage} length ${len.toFixed(0)}s -> ${sc.toFixed(2)}`);
  }
  C = (C / cn) * 25; D = (D / dn) * 15;
}
const total = A + B + C + D;
console.log(lines.join('\n'));
console.log(`A ${A.toFixed(1)}/40  B ${B.toFixed(1)}/20  C ${C.toFixed(1)}/25  D ${D.toFixed(1)}/15  => BALANCE ${total.toFixed(1)}`);
