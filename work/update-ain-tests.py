from pathlib import Path
p=Path('tools/test-basic-shots.mjs');s=p.read_text(encoding='utf-8')
s=s.replace('lrl: [1, 1, 1, 1, 1]','lrl: [1, 2, 2, 2, 2]')
a=s.index("assert(shots.lrl[2][0].r");z=s.index('assert(shots.merlin[5][0].blastRadius',a)
s=s[:a]+'''assert(shots.lrl[1][0].nativeKey === 'lrl-arrow' && shots.lrl[1][0].vy === 0,
  'Aine-style Lv1 is one narrow forward arrow');
for (let lv = 2; lv <= 5; lv++) {
  assert(shots.lrl[lv][0].nativeKey === 'lrl-arrow' && shots.lrl[lv][1].nativeKey === 'lrl',
    `LRL Lv${lv} must pair the arrow with a sword wave`);
  assert(shots.lrl[lv].every(s => s.vx > 0 && s.vy === 0));
}
assert(shots.lrl[3][1].pierce && !shots.lrl[2][1].pierce,
  'Power 3 upgrades the wave to pierce');
assert(shots.lrl[5][1].r > shots.lrl[2][1].r,
  'Higher power widens the sword wave without turning arrows into a fan');
''' +s[z:]
a=s.index("  assert(lrl.length === 1 && lrl.every((b) => b.returnOwner");z=s.index('  const merlin = sample',a)
s=s[:a]+'''  assert(lrl.length === 1 && lrl.every((b) => !b.returnOwner && (b.homing || 0) === 0
    && b.vx > 0 && b.vy === 0 && b.style === 'dragonaxe' && b.pierce
    && (b.blastRadius || 0) > 0),
    'LRL hold is one forward thrown axe');
''' +s[z:]
p.write_text(s,encoding='utf-8')
p=Path('tools/test-weapon-roles.mjs');s=p.read_text(encoding='utf-8')
s=s.replace("lrl: (c) => c.returnOwner && c.homing === 0 && c.style === 'dragonaxe' && c.pierce", "lrl: (c) => !c.returnOwner && c.vx > 0 && c.vy === 0 && c.homing === 0 && c.style === 'dragonaxe' && c.pierce")
a=s.index("  const axe = new Bullet(specs[0]);");z=s.index('\n}',a)
s=s[:a]+'''  const axe = new Bullet(specs[0]);
  let lastX = axe.x;
  for (let i = 0; i < 150 && axe.alive; i++) {
    axe.update(1 / 60);
    assert(axe.x > lastX && axe.vx > 0, 'LRL axe must keep travelling forward');
    lastX = axe.x;
  }
  assert(axe.x > 1000, 'LRL axe crosses the playfield');''' +s[z:]
p.write_text(s,encoding='utf-8')
p=Path('tools/test-lrl-axe.mjs');s=p.read_text(encoding='utf-8')
a=s.index('const b=new Bullet');z=s.index('\n}',a)
s=s[:a]+'''const b=new Bullet(specs[0]);let far=0;
assert(!b.returnOwner && b.vx>0 && b.vy===0);
let lastX=b.x;
for(let i=0;i<540&&b.alive;i++){
 b.update(1/120);far=Math.max(far,b.x);
 if(b.alive){assert(b.x>lastX&&b.vx>0,'Axe must never reverse');lastX=b.x;}
}
assert(far>1400,'Axe travels straight across the field');
assert(!b.alive,'Forward axe expires after its flight');''' +s[z:]
s=s.replace('outbound, return and catch passed','forward-only flight and natural expiry passed')
p.write_text(s,encoding='utf-8')
