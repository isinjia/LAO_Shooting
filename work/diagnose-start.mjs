import {chromium} from 'playwright';
const b=await chromium.launch({headless:true});const p=await b.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));p.on('response',r=>{if(r.status()>=400) console.log('HTTP',r.status(),r.url())});
await p.goto('http://127.0.0.1:5191/');console.log('TITLE',await p.title());console.log('BODY', (await p.locator('body').innerText()).slice(0,350));
await p.click('#btn-start');await p.waitForTimeout(5000);console.log('BTN',await p.locator('#btn-go').count(),await p.locator('#btn-go').isVisible());console.log('BODY2',(await p.locator('body').innerText()).slice(0,500));await b.close();
