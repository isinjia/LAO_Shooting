import {chromium} from 'playwright';import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1080,height:600}});
await page.goto('http://127.0.0.1:5191/work/lrl-phantom-preview.html');await page.waitForFunction(()=>window.ready);
await mkdir('work/lrl-phantom-frames',{recursive:true});
for(let i=0;i<22;i++){await page.evaluate(t=>window.renderAt(t),i*.07);await page.screenshot({path:`work/lrl-phantom-frames/${String(i).padStart(3,'0')}.png`});}
await browser.close();console.log('22 phantom frames captured');
