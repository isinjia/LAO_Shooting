import {chromium} from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1400,height:900}});const errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:5191/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('lao_mini_tutorial_seen','1'));
await p.click('#btn-start');await p.waitForSelector('#btn-go',{timeout:120000});
await p.click('.char-card[data-key="lrl"]');await p.click('#btn-go');
await p.waitForFunction(()=>document.getElementById('overlay')?.classList.contains('hidden'),null,{timeout:120000});
await p.waitForTimeout(6000);
await p.evaluate(()=>{const g=window.__LAO__.getGame();const enemy=g.enemies.find(e=>e.alive);if(!enemy)throw Error('No target');g.player.x=enemy.x-220;g.player.y=enemy.y;g.player.invuln=20;g.player.shotLevel=1;g.player.shoot(g.bullets);});
await p.waitForFunction(()=>{const g=window.__LAO__.getGame();const hit=g.bullets.nativeEffects.list.find(f=>f.kind==='impact');if(!hit)return false;g.debug.manualTick=true;hit.age=.065;return true;},null,{timeout:5000});
console.log(await p.evaluate(()=>{const g=window.__LAO__.getGame();return {char:g.player.charKey,bullets:g.bullets.list.filter(b=>b.alive&&b.nativeKey).length};}));
await p.screenshot({path:'work/lrl-slash-hit-game.png'});console.log({errors});await b.close();

