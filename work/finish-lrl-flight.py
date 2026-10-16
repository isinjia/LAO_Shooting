from pathlib import Path
p=Path('js/native-weapon-fx.js');s=p.read_text(encoding='utf-8').replace('ctx.rotate(layer.rotation);','ctx.rotate(layer.rotation + b.age * 6.0);');p.write_text(s,encoding='utf-8')
p=Path('work/lrl-animation.html');s=p.read_text();a=s.index('window.renderAt=');b=s.index("ctx.fillStyle='#142536'",a)
s=s[:a]+'''window.renderAt=(time)=>{const pool=new BulletPool();
let next=0;
for(let t=0;t<time;t+=1/120){
 if(t>=next){for(const [i,lv] of [1,5].entries()){
 const p={x:100,y:125+i*180,meta:meta.lrl,shotLevel:lv,focus:false,_shotCounter:0};Player.prototype.shoot.call(p,pool);
 }next+=.28;}
 pool.update(Math.min(1/120,time-t),1000,420);
 for(const b of pool.list){if(b.alive&&b.x>=800){pool.nativeEffects.emit(b,'impact',{x:800,y:b.y});b.alive=false;}}
}
''' +s[b:];Path('work/lrl-flight-volley.html').write_text(s)
p=Path('work/capture-lrl-animation.mjs');s=p.read_text().replace('lrl-animation.html','lrl-flight-volley.html').replace('lrl-animation-frames','lrl-flight-volley-frames').replace('i<42','i<60');Path('work/capture-lrl-volley.mjs').write_text(s)
