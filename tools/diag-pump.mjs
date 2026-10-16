import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => {
  const t = m.text() || '';
  if (m.type() === 'error' || t.includes('[run]') || t.includes('[assets]') || t.includes('ensure')) {
    console.log('CON', t);
  }
});

await page.goto('http://127.0.0.1:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
await page.click('#btn-start');
await page.waitForSelector('#btn-go', { timeout: 180000 });
await page.click('.char-card[data-key="hirume"]');
await page.click('#btn-go');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), {
  timeout: 300000,
});
await page.evaluate(() => {
  const g = window.__LAO__.getGame();
  g.debug.pumpSteps = 24;
  g.debug.invuln = true;
  g.debug.autoPlay = true;
  g.audio.setMuted(true);
  g._keyInput.shoot = true;
  g._syncMergedInput();
});

for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => {
    const g = window.__LAO__?.getGame?.();
    if (!g) {
      return { gone: true, text: document.getElementById('overlay')?.innerText?.slice(0, 160) };
    }
    return {
      state: g.state,
      stage: g.stageIndex + 1,
      phase: g.stagePhase,
      clock: +g.stageClock.toFixed(1),
      wave: g.stageWaveIndex,
      lives: g.player.lives,
      score: g.score,
      bossHp: g.boss ? +g.boss.hp.toFixed(0) : null,
      pump: g.debug.pumpSteps,
      auto: g.debug.autoPlay,
      assetsReady: g._assetsReady,
      time: +g.time.toFixed(1),
      shoot: g.input.shoot,
    };
  });
  console.log(JSON.stringify(s));
  if (s.gone || s.state === 'cleared' || s.state === 'gameover') break;
}

await browser.close();
