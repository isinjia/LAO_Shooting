import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:960}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5191/work/preview-native.html');
const result=await page.evaluate(async()=>{
 const {loadNativeWeaponFx,drawNativeWeapon}=await import('/js/native-weapon-fx.js');
 const {Player}=await import('/js/player.js'); const {AssetBank}=await import('/js/assets.js');
 const {Bullet}=await import('/js/bullet.js');await loadNativeWeaponFx();
 document.body.innerHTML='<canvas width="1400" height="960"></canvas>';
 const c=document.querySelector('canvas'),ctx=c.getContext('2d');
 ctx.fillStyle='#112536';ctx.fillRect(0,0,1400,960); const meta=new AssetBank().CHAR_META;
 Object.keys(meta).forEach((key,i)=>{ for(const [j,lv] of [1,5].entries()){
 const x=80+j*700,y=55+i*112;ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(key+' P'+lv,x,y);
 const p={x:x+110,y:y+30,meta:meta[key],shotLevel:lv,focus:false,_shotCounter:0};
 const specs=[];Player.prototype.shoot.call(p,{targets:[],spawn:s=>specs.push(s)});
 for(const s of specs){const b=new Bullet(s);b.update(.15,[]);drawNativeWeapon(ctx,b);}
 }}); return {loaded:true};
});
await page.screenshot({path:'work/native-basic-preview.png'});
console.log(JSON.stringify({result,errors}));await browser.close();

