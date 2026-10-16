// Low-end mobile optimization score (0-100) from perf-mobile.mjs output.
//  25 frame rate     avg fps over the combat scenes (>= 55 full, <= 25 zero)
//  20 smoothness     worst scene p95 frame time (<= 22 ms full, >= 60 ms zero)
//  10 hitches        worst scene share of frames > 50 ms (<= 1 % full, >= 10 % zero)
//  10 CPU budget     worst scene JS update+draw per frame (<= 10 ms full, >= 30 ms zero)
//  10 startup        time to playable on the throttled CPU (<= 6 s full, >= 25 s zero)
//  10 memory         JS heap + decoded images (<= 300 MB full, >= 800 MB zero)
//   5 download       bytes before play (<= 15 MB full, >= 60 MB zero)
//  10 low-end path   low-end flag on, canvas buffer <= 1.5x CSS px, no page errors
// usage: node tools/score-perf.mjs perf.json
import fs from 'fs';

const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const lin = (v, good, bad) => Math.max(0, Math.min(1, (bad - v) / (bad - good)));
const sc = d.scenes;
const fpsAvg = sc.reduce((a, s) => a + s.fps, 0) / sc.length;
const p95 = Math.max(...sc.map((s) => s.p95));
const hitch = Math.max(...sc.map((s) => s.hitch50));
const cpu = Math.max(...sc.map((s) => s.updateMs + s.drawMs));
const memMB = d.mem.heapMB + d.mem.imageMB;
const c = d.mem.canvas;
const bufRatio = (c.bufW * c.bufH) / Math.max(1, c.cssW * c.cssH);
const parts = {
  fps: 25 * lin(fpsAvg, 55, 25),
  smooth: 20 * lin(p95, 22, 60),
  hitch: 10 * lin(hitch, 0.01, 0.1),
  cpu: 10 * lin(cpu, 10, 30),
  startup: 10 * lin(d.boot.tPlay, 6, 25),
  memory: 10 * lin(memMB, 300, 800),
  download: 5 * lin(d.boot.mbAtPlay, 15, 60),
  lowend: (d.mem.lowend ? 4 : 0) + (bufRatio <= 1.5 ? 3 : 0) + (d.errors.length ? 0 : 3),
};
for (const s of sc) {
  console.log(`${s.label.padEnd(6)} fps ${s.fps}  p95 ${s.p95}ms  hitch ${(s.hitch50 * 100).toFixed(1)}%  update ${s.updateMs}ms draw ${s.drawMs}ms  bullets ${s.peakBullets} enemies ${s.peakEnemies}`);
}
console.log(`boot title ${d.boot.tTitle}s play ${d.boot.tPlay}s  ${d.boot.mbAtPlay}MB | heap ${d.mem.heapMB}MB images ${d.mem.imageMB}MB (${d.mem.images}) | canvas ${c.cssW}x${c.cssH} buf ${c.bufW}x${c.bufH} lowend ${d.mem.lowend} | errors ${d.errors.length}`);
const total = Object.values(parts).reduce((a, b) => a + b, 0);
console.log(Object.entries(parts).map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  ') + `  => PERF ${total.toFixed(1)} (cpu x${d.cpuRate})`);
