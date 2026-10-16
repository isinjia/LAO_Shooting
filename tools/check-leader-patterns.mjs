// Pattern ownership check (user rule): every leader attack type is used by exactly one
// leader body (the Commander's three bodies count separately). Also checks every type
// exists in leader-script.js ATTACKS. Exit code 1 on a shared or unknown type.
// usage: node tools/check-leader-patterns.mjs
import { LEADER_SCRIPTS } from '../js/leader-routines.js';

const owners = {};
for (const [key, def] of Object.entries(LEADER_SCRIPTS)) {
  if (key === 'final_yimir') continue; // alias of doomeater
  def.phases.forEach((ph, i) => {
    const who = key === 'doomeater' ? ['final_yimir', 'final_arachne', 'final_roc'][i] : key;
    for (const a of ph.attacks) (owners[a.type] ||= new Set()).add(who);
  });
}
let bad = 0;
const src = (await import('fs')).readFileSync(new URL('../js/leader-script.js', import.meta.url), 'utf8');
for (const [type, set] of Object.entries(owners).sort()) {
  const known = src.includes(`
  ${type}(e, s, dt`);
  const shared = set.size > 1;
  if (shared || !known) bad += 1;
  console.log(`${shared || !known ? 'FAIL' : 'ok  '} ${type.padEnd(10)} ${[...set].join(', ')}${known ? '' : '  (no such attack)'}`);
}
console.log(bad ? `${bad} problem(s)` : `all ${Object.keys(owners).length} attack types have a single owner`);
process.exit(bad ? 1 : 0);
