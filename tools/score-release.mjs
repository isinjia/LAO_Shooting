// Release readiness score (0-100): weighted roll-up of every quality gate.
//   20 stability   tools/test-release.mjs: all pilots clear stages 1-5 with no page / console
//                  errors, failed requests, stalls or NaN state
//   10 ux          test-release UI flows (pause, retry, overflow, >= 40 px touch targets)
//   15 mobile perf tools/score-perf.mjs
//   15 effects     tools/score-fx.py average
//   10 sound       tools/score-sfx.mjs
//   10 boss fun    tools/score-fun.mjs average
//   10 waves       tools/score-waves.mjs wave average
//   10 balance     tools/score-waves.mjs level balance
// usage: node tools/score-release.mjs <dir>   (dir holds release.json perf.json fx/ sfx-files.json
//        sfx-mix.json bosses.json waves.json)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const D = process.argv[2];
const run = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 1 << 26 });
const num = (txt, re) => { const m = txt.match(re); return m ? Number(m[1]) : NaN; };
const f = (n) => path.join(D, n);

// Stability.
const rel = JSON.parse(fs.readFileSync(f('release.json'), 'utf8'));
const runs = rel.runs;
const issues = [];
let stab = 0;
for (const r of runs) {
  let s = 1;
  if (!r.cleared) { s -= 0.5; issues.push(`${r.pilot}: did not clear (stage ${r.stagesCleared})`); }
  if (r.stalls?.length) { s -= 0.3; issues.push(`${r.pilot}: stall ${r.stalls[0]}`); }
  if (r.nan) { s -= 0.3; issues.push(`${r.pilot}: NaN state x${r.nan}`); }
  const errs = [...new Set([...(r.pageErrors || []), ...(r.consoleErrors || [])])];
  if (errs.length) { s -= Math.min(0.5, errs.length * 0.15); issues.push(`${r.pilot}: errors ${errs.slice(0, 2).join(' | ')}`); }
  if (r.failed?.length) { s -= Math.min(0.3, r.failed.length * 0.05); issues.push(`${r.pilot}: failed ${r.failed.slice(0, 2).join(', ')}`); }
  stab += Math.max(0, s);
}
const stability = 100 * stab / Math.max(1, runs.length);

// UX.
let pass = 0; let total = 0;
for (const u of rel.ui) {
  for (const [k, v] of Object.entries(u.checks)) {
    total += 1;
    const ok = Array.isArray(v) ? v.length === 0 : !!v;
    if (ok) pass += 1; else issues.push(`${u.label}: ${k} ${Array.isArray(v) ? v.join(',') : v}`);
  }
  const errs = [...new Set([...(u.pageErrors || []), ...(u.consoleErrors || [])])];
  total += 1; if (!errs.length && !u.failed?.length) pass += 1; else issues.push(`${u.label}: ${errs[0] || u.failed[0]}`);
}
const ux = 100 * pass / Math.max(1, total);

const perf = num(run(`node tools/score-perf.mjs "${f('perf.json')}"`), /PERF ([0-9.]+)/);
const fx = num(run(`python tools/score-fx.py "${f('fx')}"`), /FX avg ([0-9.]+)/);
const sfx = num(run(`node tools/score-sfx.mjs "${f('sfx-files.json')}" "${f('sfx-mix.json')}"`), /SFX[^0-9]*([0-9.]+)/);
const fun = num(run(`node tools/score-fun.mjs "${f('bosses.json')}"`), /FUN avg ([0-9.]+)/);
const wv = run(`node tools/score-waves.mjs "${f('waves.json')}" ${fun}`);
const waves = num(wv, /WAVES avg ([0-9.]+)/);
const balance = num(wv, /LEVEL BALANCE ([0-9.]+)/);

const parts = { stability: [stability, 20], ux: [ux, 10], perf: [perf, 15], fx: [fx, 15], sfx: [sfx, 10], fun: [fun, 10], waves: [waves, 10], balance: [balance, 10] };
let score = 0;
for (const [k, [v, w]] of Object.entries(parts)) {
  console.log(`${k.padEnd(10)} ${String(Number.isFinite(v) ? v.toFixed(1) : 'n/a').padStart(6)}  (weight ${w})`);
  score += (Number.isFinite(v) ? v : 0) * w / 100;
}
if (issues.length) console.log('issues:\n  ' + issues.join('\n  '));
console.log(`RELEASE ${score.toFixed(1)}`);
