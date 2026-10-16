/** Dump live SHOT / HOLD / C bullet types for Hirume and Constantia. */
import { AssetBank } from '../js/assets.js';
import { Player } from '../js/player.js';
import { fireCharacterCharge } from '../js/weapon-skills.js';
import { SPECIAL_ATTACKS } from '../js/special-shots.js';

const meta = new AssetBank().CHAR_META;
const foe = { alive: true, x: 520, y: 300, hitR: 22, hp: 80 };
const dump = (key, kind, specs) => specs.map((s) => ({
  key, kind,
  style: s.style,
  homing: s.homing || 0,
  ay: s.ay || 0,
  blastRadius: s.blastRadius || 0,
  beamLength: s.beamLength || 0,
  r: +(s.r || 0).toFixed(2),
  vx: +((s.vx || 0)).toFixed(1),
  vy: +((s.vy || 0)).toFixed(1),
  pierce: !!s.pierce,
  charge: !!s.charge,
  special: !!s.special,
}));

const rows = [];
for (const key of ['hirume', 'constantia']) {
  const shot = [];
  Player.prototype.shoot.call({
    charKey: key, meta: meta[key], x: 120, y: 300,
    shotLevel: 3, focus: false, _shotCounter: 0,
  }, { targets: [foe], spawn: (s) => shot.push(s) });
  rows.push(...dump(key, 'SHOT', shot));
  const hold = [];
  fireCharacterCharge({
    charKey: key, meta: meta[key], alive: true, x: 120, y: 300, shotLevel: 3, w: 1593,
  }, { targets: [foe], spawn: (s) => hold.push(s) });
  rows.push(...dump(key, 'HOLD', hold));
  const c = SPECIAL_ATTACKS[key][0].shots;
  rows.push(...dump(key, 'C', c));
}

const forbidden = rows.filter((r) => {
  if (r.key === 'constantia') {
    return r.style === 'sunbird' || r.style === 'sightbeam' || (r.kind !== 'C' && r.homing > 0);
  }
  return r.style === 'flameward' || r.style === 'sightbeam';
});
console.log(JSON.stringify({ rows, forbidden }, null, 2));
if (forbidden.length) {
  console.error('FORBIDDEN leftover flameward/sightbeam or Constantia homing');
  process.exit(1);
}
const hirume = rows.filter((r) => r.key === 'hirume');
if (!hirume.some((r) => r.kind === 'SHOT' && r.style === 'foxflame' && !(r.ay > 0))) process.exit(2);
if (!hirume.some((r) => r.kind === 'HOLD' && r.style === 'sunbird' && r.homing > 0)) process.exit(3);
const con = rows.filter((r) => r.key === 'constantia');
if (!con.some((r) => r.kind === 'SHOT' && r.style === 'tracer' && r.homing === 0)) process.exit(4);
if (!con.some((r) => r.kind === 'HOLD' && r.style === 'lockround' && r.ay > 0 && r.r > 10)) process.exit(5);
console.log('DUMP_OK');
