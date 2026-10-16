import {chromium} from 'playwright';import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1000,height:420}});
await page.goto('http://127.0.0.1:5191/work/lrl-animation.html');await page.waitForFunction(()=>window.ready);
await mkdir('work/lrl-animation-frames',{recursive:true});
for(let i=0;i<42;i++){await page.evaluate(t=>window.renderAt(t),i/24);await page.screenshot({path:`work/lrl-animation-frames/${String(i).padStart(3,'0')}.png`});}
await browser.close();console.log('42 deterministic animation frames captured');
