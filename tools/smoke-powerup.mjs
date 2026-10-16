/** Browser smoke for the stage-one opener and visible 1945-style P carriers. */
import { chromium } from 'playwright';

const url = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  await page.click('.char-card[data-key="hirume"]');
  await page.click('#btn-go');
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 180000 });

  const result = await page.evaluate(() => {
    const g = window.__LAO__?.getGame?.();
    if (!g) return { ok: false, reason: 'game missing' };
    g.setPaused(true);
    const opening = g.stages[0].waves.slice(0, 6).map((wave) => wave.groups.reduce((n, group) => n + group.count, 0));
    g.stageClock = 2.9;
    g._updateStageFlow(0.2);
    const carriers = g.enemies.filter((enemy) => enemy.alive && enemy.dropsPower);
    const firstWave = { enemies: g.enemies.length, carriers: carriers.length, delayedFire: g.enemies.every((e) => e.fireTimer > 0.8) };

    const carrier = carriers[0];
    if (!carrier) return { ok: false, opening, firstWave };
    carrier.damage(carrier.hp);
    g._tryDropPowerUp(carrier);
    const firstDrop = g.powerUps.filter((item) => item.alive && item.type === 'power').length;
    for (const item of g.powerUps) {
      item.x = g.player.x;
      item.y = g.player.y;
      item.baseY = g.player.y;
    }
    g._updatePowerUps(0);
    const firstPickupLevel = g.player.shotLevel;

    g.player.shotLevel = 5;
    const beforeScore = g.score;
    g._tryDropPowerUp(carrier);
    for (const item of g.powerUps) {
      item.x = g.player.x;
      item.y = g.player.y;
      item.baseY = g.player.y;
    }
    g._updatePowerUps(0);
    const surplus = { level: g.player.shotLevel, score: g.score - beforeScore };

    g.enemies.length = 0;
    g.powerUps.length = 0;
    g.player.shotLevel = 1;
    g.stageClock = 40;
    g._lastPowerRecoveryAt = 0;
    g._maybeSpawnPowerRecovery();
    const recovery = { enemies: g.enemies.length, carriers: g.enemies.filter((e) => e.dropsPower).length, silent: g.enemies.every((e) => e.pattern === 'silent') };
    g._maybeSpawnPowerRecovery();
    recovery.noDuplicate = g.enemies.length === 4;

    return {
      ok: opening.join(',') === '2,2,4,3,2,1'
        && firstWave.enemies === 2 && firstWave.carriers === 1 && firstWave.delayedFire
        && firstDrop === 1 && firstPickupLevel === 2
        && surplus.level === 5 && surplus.score >= 500
        && recovery.enemies === 4 && recovery.carriers === 1 && recovery.silent && recovery.noDuplicate
        && g.player.enemyRankEnabled === false,
      opening, firstWave, firstDrop, firstPickupLevel, surplus, recovery,
    };
  });
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  process.exitCode = result.ok && errors.length === 0 ? 0 : 1;
} finally {
  await browser.close();
}
