const mod = await import('../js/leader-routines.js');
const rate = (a) => {
  switch (a.type) {
    case 'aimed': return (a.ways || 1) / a.every;
    case 'spiral': return a.arms * (a.twin ? 2 : 1) / a.every;
    case 'ring': return a.count / a.every;
    case 'curtain': return Math.max(0, (520 / (a.step || 34)) - a.gap / (a.step || 34)) / a.every;
    case 'sweep': return (a.ways || 1) / a.every;
    case 'grenade': return (1 + a.burst) / a.every;
    case 'lance': return ((a.dur - a.warn) / a.dur) * (a.side ? 3 : 1) / 0.045;
    case 'freeze': return a.ways / a.every;
    case 'rain': return 1 / a.every;
  }
};
for (const [k, d] of Object.entries(mod.LEADER_SCRIPTS)) {
  const out = d.phases.map((ph) => {
    let n = 0, t = 0;
    for (const a of ph.attacks) { n += rate(a) * a.dur; t += a.dur + 0.5; }
    t += d.rest ?? 1.3;
    return (n / t).toFixed(1);
  });
  console.log(k.padEnd(18), out.join(' / '), '| moves', [...new Set(d.phases.map((p) => p.move?.kind || 'drift'))].join(','));
}
