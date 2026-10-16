import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const six = process.argv.includes('--six');
const page = await browser.newPage({ viewport: six ? { width: 960, height: 630 } : { width: 720, height: 240 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:5188/work/${six ? 'six-special-preview.html' : 'bori-run-preview.html'}`);
await page.waitForTimeout(350);
await page.screenshot({ path: six ? 'work/six-special-preview.png' : 'work/bori-run-preview.png' });
await browser.close();
