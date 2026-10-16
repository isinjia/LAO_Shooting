from pathlib import Path
p=Path('js/player.js'); s=p.read_text(encoding='utf-8'); start=s.index("      case 'axe':",s.index('  fireOptions(bullets)')); end=s.index("      case 'railgun':",start); s=s[:start]+s[end:];p.write_text(s,encoding='utf-8')
p=Path('tools/test-basic-shots.mjs'); s=p.read_text(encoding='utf-8')
s=s.replace('lrl: [1, 1, 1, 2, 3]','lrl: [1, 1, 1, 1, 1]').replace('merlin: [1, 1, 3, 4, 6]','merlin: [1, 1, 1, 2, 2]').replace('labiata: [1, 1, 2, 3, 4]','labiata: [2, 2, 2, 2, 2]')
a=s.index('assert(shots.lrl[5]'); b=s.index('assert(shots.emily.slice',a)
s=s[:a]+'''assert(shots.lrl[5][0].pierce && shots.lrl[5][0].r > shots.lrl[3][0].r);
assert(shots.merlin[5][0].blastRadius > shots.merlin[1][0].blastRadius);
assert(shots.merlin[4][1].delay > 0 && shots.merlin[3].length === 1);
assert(shots.fafnir[1][0].homing > 0 && shots.fafnir[1][0].chainCount === 0);
assert.equal(shots.fafnir[3][0].chainCount, 1);
assert.equal(shots.fafnir[5][0].chainCount, 3);
assert(shots.eternity[5].every(s => s.vy === 0 && s.pierce));
assert.equal(new Set(shots.eternity[5].map(s => s.delay)).size, 4);
assert(shots.labiata[1][1].orbitOwner && !shots.labiata[1][0].orbitOwner);
assert(shots.labiata[1][1].damage > shots.labiata[1][0].damage);
assert(shots.labiata[5][1].clearRadius > 0 && !shots.labiata[1][1].clearRadius);
''' +s[b:]
s=s.replace("if (key === 'emily') continue;\n  const player = {", "if (!['hirume', 'constantia'].includes(key)) continue;\n  const player = {",1)
s=s.replace('return { player, shot: spawned[0] };','return { player, shot: spawned[0], shots: spawned };')
s=s.replace("new Bullet(roleShot('labiata').shot)","new Bullet(roleShot('labiata').shots.find(s => s.orbitOwner))")
s += '''\n// Pooled native bullets must not leak their appearance into enemy/special shots.
const recycled = new Bullet(shots.fafnir[5][0]);
assert.equal(recycled.nativeKey, 'fafnir');
recycled.reset({ x: 0, y: 0, vx: 100, vy: 0 });
assert.equal(recycled.nativeKey, null);
for (const key of ['lrl','merlin','fafnir','eternity','labiata']) {
  const extra=[];
  Player.prototype.fireOptions.call({meta:meta[key],shotLevel:5}, {spawn:s=>extra.push(s)});
  assert.equal(extra.length,0, `${key}: upgrades must not reintroduce generic escort bullets`);
}
'''
p.write_text(s,encoding='utf-8')
