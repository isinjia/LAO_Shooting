import fs from 'fs';
const path = process.argv[2];
const j = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log('summary', j.summary);
const panels = j.muddy.filter((f) => f.sel === '#overlay-content');
console.log('panel clips', panels.length);
for (const f of panels) {
  console.log(f.screen, f.loc, `${f.w}x${f.h}`, `sh=${f.sh}`, `ch=${f.ch}`, f.overflowY);
}
console.log('--- pause ---');
for (const f of j.muddy.filter((f) => f.screen === 'pause')) console.log(f);
console.log('--- select non-panel ---');
for (const f of j.muddy.filter((f) => f.screen === 'select' && f.sel !== '#overlay-content')) console.log(f);
console.log('--- tutorial rows overlayClip by loc/size ---');
const map = new Map();
for (const f of j.muddy.filter((f) => f.screen === 'tutorial' && f.overlayClip)) {
  const k = `${f.loc}@${f.w}x${f.h}`;
  map.set(k, (map.get(k) || 0) + 1);
}
for (const [k, v] of [...map.entries()].sort()) console.log(v, k);
console.log('--- tutorial-ok ---');
for (const f of j.all.filter((f) => f.screen === 'tutorial-ok')) {
  console.log(f.loc, `${f.w}x${f.h}`, f.panel, 'tall', f.tallestRow?.sh, f.tallestRow?.text?.slice(0, 60));
}
