import {chromium} from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1400,height:900}});p.setDefaultTimeout(120000);const errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:5191/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('lao_mini_tutorial_seen','1'));
await p.waitForFunction(() => typeof document.querySelector('#btn-start')?.onclick === 'function');
await p.click('#btn-start');await p.waitForSelector('#btn-go',{timeout:120000});
await p.click('.char-card[data-key="lrl"]');await p.click('#btn-go');
await p.waitForFunction(()=>document.getElementById('overlay')?.classList.contains('hidden'),null,{timeout:120000});
await p.waitForTimeout(6000);
for(let i=0;i<5;i++){
 await p.evaluate(()=>{const g=window.__LAO__.getGame();g.player.shotLevel=5;g.player.fireCooldown=0;g.player.shoot(g.bullets);});
 await p.waitForTimeout(280);
}
console.log(await p.evaluate(()=>{const g=window.__LAO__.getGame();return {char:g.player.charKey,bullets:g.bullets.list.filter(b=>b.alive&&b.nativeKey).length};}));
await p.screenshot({path:'work/lrl-flight-volley-game.png'});console.log({errors});await b.close();

