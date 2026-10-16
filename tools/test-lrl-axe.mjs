import assert from 'node:assert/strict';
import {AssetBank} from '../js/assets.js';import {fireCharacterCharge} from '../js/weapon-skills.js';import {Bullet} from '../js/bullet.js';
const meta=new AssetBank().CHAR_META.lrl;
for(const lv of [1,5]){
const p={charKey:'lrl',meta,alive:true,x:120,y:300,w:1400,shotLevel:lv};const specs=[];
fireCharacterCharge(p,{targets:[],spawn:s=>specs.push(s)});
assert.equal(specs.length,1);assert.equal(specs[0].nativeKey,'lrl-axe');
const b=new Bullet(specs[0]);let far=0;
assert(!b.returnOwner && b.vx>0 && b.vy===0);
let lastX=b.x;
for(let i=0;i<540&&b.alive;i++){
 b.update(1/120);far=Math.max(far,b.x);
 if(b.alive){assert(b.x>lastX&&b.vx>0,'Axe must never reverse');lastX=b.x;}
}
assert(far>1400,'Axe travels straight across the field');
assert(!b.alive,'Forward axe expires after its flight');
}
console.log('LRL charge: original axe texture, single projectile, forward-only flight and natural expiry passed');

