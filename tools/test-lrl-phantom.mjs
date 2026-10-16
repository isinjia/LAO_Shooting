import assert from 'node:assert/strict';
import {Player} from '../js/player.js';
import {Bullet} from '../js/bullet.js';
import {Game} from '../js/game.js';
import {AssetBank} from '../js/assets.js';
import {SPECIAL_SKILL_PROFILES} from '../js/special-skill-profiles.js';
const meta=new AssetBank().CHAR_META.lrl;
for(let lv=1;lv<=3;lv++){
 const player=Object.assign(Object.create(Player.prototype),{
  charKey:'lrl',meta,alive:true,respawnTimer:0,spCost:100,sp:lv*100,
  x:120,y:300,shotLevel:1,
 });
 const specs=[];
 assert(Player.prototype.trySpecial.call(player,{targets:[],spawn:s=>specs.push(s)}));
 assert.equal(specs.length,lv===2?3:1);assert.equal(player.sp,0);
 assert.equal(specs.reduce((total,s)=>total+s.damage,0),lv*6);
 assert.deepEqual(specs.map(s=>Math.sign(s.vy)),lv===2?[-1,0,1]:[0]);
 for(const shot of specs){
  assert.equal(shot.nativeKey,'lrl-skill1-clone');
  assert.equal(shot.style,'lrlphantom');
  assert.equal(shot.cloneSize,lv===3?354:118);
  assert.equal(shot.r,lv===3?177:59);
  assert.equal(shot.clearRadius,shot.r);
  assert(shot.beamLength===0&&shot.vx>900&&shot.pierce);
  assert.equal(new Bullet(shot).cloneSize,shot.cloneSize);
 }
 const shot=specs.find(s=>s.vy===0);
 const b=new Bullet(shot),enemy={alive:true,x:1390,y:300,hitR:38};let hit=false;
 for(let i=0;i<150&&b.alive;i++){b.update(1/60);if(Game.prototype._friendlyHitsEnemy(b,enemy)){hit=true;break;}}
 assert(hit,`Lv${lv} phantom cannot reach far boss lane`);
}
assert.equal(SPECIAL_SKILL_PROFILES.lrl[2].shots[0].r,3*SPECIAL_SKILL_PROFILES.lrl[0].shots[0].r);
console.log('LRL C: Lv1 former Lv3, Lv2 three-way fan, Lv3 triple-size rush; balance and far reach passed');

