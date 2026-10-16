// Summarise tools/qa-sfx.mjs output: per pilot cue table, peak rates, C / X sound coverage,
// game events with no sound, synth fallbacks.
// usage: node tools/qa-sfx-report.mjs qa.json
import fs from 'fs';
const R = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const NOISE = (l) => l.kind === 'shoot' || l.kind === 'enemyHit';
for (const r of R.runs) {
  const played = r.log.filter((l) => l.out !== 'suppressed');
  console.log(`\n=== ${r.pilot}  sim ${r.sim}s  sounds played ${played.length} (${(played.length / r.sim).toFixed(1)}/s)  suppressed ${r.log.length - played.length}`);
  const by = {};
  for (const l of r.log) {
    const k = l.kind + (l.style && !['playClip', 'playVoice'].includes(l.kind) ? ':' + l.style : '');
    const o = (by[k] ||= { n: 0, played: 0, synth: 0, file: 0, clip: 0, ts: [] });
    o.n += 1;
    if (l.out !== 'suppressed') { o.played += 1; o.ts.push(l.t); }
    if (l.out.includes('synth')) o.synth += 1;
    if (l.out.includes('file')) o.file += 1;
    if (l.out === 'clip') o.clip += 1;
  }
  const peak = (ts, w) => { let m = 0, j = 0; for (let i = 0; i < ts.length; i++) { while (ts[i] - ts[j] > w) j++; m = Math.max(m, i - j + 1); } return m; };
  const rows = Object.entries(by).filter(([k]) => !k.startsWith('playClip') && !k.startsWith('playVoice')).sort((a, b) => b[1].n - a[1].n);
  for (const [k, o] of rows) {
    console.log(`  ${k.padEnd(28)} req ${String(o.n).padStart(6)} played ${String(o.played).padStart(6)} (${(o.played / r.sim).toFixed(2)}/s, peak ${peak(o.ts, 1)}/1s)  ${o.synth ? 'SYNTH ' + o.synth : ''}`);
  }
  const allTs = played.map((l) => l.t).sort((a, b) => a - b);
  console.log(`  peak all sounds: ${peak(allTs, 1)}/1s, ${peak(allTs, 0.1)}/0.1s`);
  // C / X coverage.
  for (const type of ['special', 'bomb']) {
    const evs = r.ev.filter((e) => e.type === type);
    const kinds = {};
    for (const e of evs) {
      const near = r.log.filter((l) => l.t >= e.t && l.t <= e.t + 2.5 && !NOISE(l) && l.out !== 'suppressed');
      const set = [...new Set(near.map((l) => l.kind === 'playClip' || l.kind === 'playVoice' ? l.style : l.kind))];
      for (const s of set) kinds[s] = (kinds[s] || 0) + 1;
    }
    console.log(`  ${type} x${evs.length}: ${Object.entries(kinds).map(([k, v]) => k + '(' + v + ')').join(', ') || 'NO SOUND'}`);
  }
  // Events with no sound nearby.
  const want = { hazard: 0.2, warning: 0.3, 'kill:boss': 1.5, stageClear: 3, playerHitForced: 0.3, enemyFire: 0.05 };
  const miss = {}; const tot = {};
  for (const e of r.ev) {
    const key = e.type === 'kill' && e.extra === 'boss' ? 'kill:boss' : e.type;
    if (!(key in want)) continue;
    const k2 = key === 'hazard' ? 'hazard:' + e.extra : key;
    tot[k2] = (tot[k2] || 0) + 1;
    const ok = r.log.some((l) => l.t >= e.t - 0.02 && l.t <= e.t + want[key] && !NOISE(l) && l.out !== 'suppressed');
    if (!ok) miss[k2] = (miss[k2] || 0) + 1;
  }
  console.log('  silent events: ' + Object.entries(tot).map(([k, n]) => `${k} ${miss[k] || 0}/${n}`).join(', '));
}
