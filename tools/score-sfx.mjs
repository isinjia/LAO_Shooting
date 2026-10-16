// SFX quality score (0-100) from eval-sfx-files.py + eval-sfx-mix.mjs.
//  25 coverage        every fired cue + roster shot style plays a decoded clip in-game
//  10 original ratio  clips sourced from the original Last Origin library
//   5 responsiveness  leading silence <= 5 ms
//   5 length fit      active length within the category max (and >= 40 ms)
//  10 consistency     loudness within +-1.5 dB of the category target
//   5 hierarchy       category loudness order: graze < shot < hit < ui < kill < sting < big / event
//  10 headroom        file peaks <= -1 dBFS and the stress mix (with BGM) master peak < 0.99
//   5 variation       frequent cues (shots, hits, kills, graze) vary (variants or pitch jitter)
//   5 spam control    voice caps on frequent cues and stress-mix voices <= 32
//  20 mix balance     in-game master meter: BGM -28..-18 dBFS (4), kill chain 2..7 dB over
//                     the BGM (4), autofire 4..12 dB under it (4), bomb >= kill chain - 2 dB (4),
//                     every BGM track within 5 dB of each other (4)
// usage: node tools/score-sfx.mjs files.json mix.json
import fs from 'fs';

const f = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const m = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
// Cues switched off in-game (js/audio.js DISABLED_CUES) are left out of the score.
const DISABLED = new Set(['enemyDeath', 'cue', 'graze']);
const cues = Object.entries(f.cues).filter(([k]) => !DISABLED.has(k));
const clips = cues.flatMap(([, e]) => e.clips.map((c) => ({ ...c, cat: e.cat, loop: e.loop })));
const frac = (xs, p) => xs.filter(p).length / Math.max(1, xs.length);
const coverKeys = Object.keys(m.cover);
const parts = {};
parts.coverage = 25 * frac(coverKeys, (k) => m.cover[k] === true);
parts.original = 10 * frac(clips, (c) => c.original && c.exists);
parts.responsive = 5 * frac(clips, (c) => c.lead <= 0.005);
parts.length = 5 * frac(clips, (c) => c.loop || (c.active <= f.cats[c.cat].max + 0.02 && c.active >= 0.04));
parts.consistency = 10 * frac(clips, (c) => Math.abs(c.rms_db - f.cats[c.cat].target) <= 1.5);
const catLoud = {};
for (const c of clips) (catLoud[c.cat] ||= []).push(c.rms_db);
const mean = (k) => (catLoud[k] ? catLoud[k].reduce((a, b) => a + b, 0) / catLoud[k].length : null);
// Loudness ladder over the categories actually in use (a switched-off category drops out).
const ladder = ['graze', 'shot', 'hit', 'ui', 'kill', 'sting', 'big'].filter((k) => catLoud[k]);
const order = ladder.slice(1).map((k, i) => [ladder[i], k]);
if (catLoud.event && catLoud.sting) order.push(['sting', 'event']);
parts.hierarchy = 5 * frac(order, ([lo, hi]) => mean(lo) !== null && mean(hi) !== null && mean(lo) < mean(hi));
parts.headroom = 5 * frac(clips, (c) => c.peak_db <= -0.9) + (m.peak < 0.99 ? 5 : 0);
const frequent = [...cues.map(([k]) => k).filter((k) => k.startsWith('shoot'))];
parts.variation = 5 * frac(frequent, (k) => f.cues[k] && (f.cues[k].files.length > 1 || f.cues[k].jitter > 0));
parts.spam = 2.5 * frac(frequent, (k) => f.cues[k] && f.cues[k].voices <= 4) + (m.maxLive <= 32 ? 2.5 : 0);
const L = m.level || {};
const inRange = (v, lo, hi) => (v >= lo && v <= hi ? 1 : 0);
const bgmLv = Object.values(f.bgm || {});
const spread = bgmLv.length ? Math.max(...bgmLv) - Math.min(...bgmLv) : 99;
parts.balance = L.bgm === undefined ? 0 : 4 * inRange(L.bgm, -28, -18) + 4 * inRange(L.kills - L.bgm, 2, 7)
  + 4 * inRange(L.shots - L.bgm, -12, -4) + 4 * (L.bomb >= L.kills - 2 ? 1 : 0) + 4 * (spread <= 5 ? 1 : 0);
console.log(`bgm track loudness spread ${spread.toFixed(1)} dB over ${bgmLv.length} tracks`);
console.log(`levels dBFS: bgm ${L.bgm} kills ${L.kills} shots ${L.shots} bomb ${L.bomb}`);
for (const [k, v] of Object.entries(parts)) console.log(`${k.padEnd(12)} ${v.toFixed(1)}`);
const bad = clips.filter((c) => !(Math.abs(c.rms_db - f.cats[c.cat].target) <= 1.5) || c.lead > 0.005 || c.peak_db > -0.9);
if (bad.length) {
  console.log('off-spec:', bad.map((c) => `${c.stem}(rms ${c.rms_db.toFixed(1)} lead ${(c.lead * 1000).toFixed(0)}ms pk ${c.peak_db.toFixed(1)})`).join(', '));
}
const miss = coverKeys.filter((k) => m.cover[k] !== true);
if (miss.length) console.log('not covered:', miss.join(', '));
if (m.errors?.length) console.log('page errors:', m.errors.join(' | '));
console.log(`stress: master peak ${m.peak.toFixed(3)}, max voices ${m.maxLive}, bgm ${m.bgm}`);
console.log(`SFX SCORE ${Object.values(parts).reduce((a, b) => a + b, 0).toFixed(1)}`);
