// Rampalion (hidden pilot) checks against the real game in a browser.
// 1) title "치트활성화온" -> select "램파리온" (physical keys) reveals it on RANDOM; without the
//    title cheat the same typing does nothing.
// 2) one life; P level-up fuses with a random robot (meta / shot change, partner drawn);
//    a hit above Lv1 drops a level and breaks the fusion instead of the life;
//    a hit at Lv1 is game over.
// 3) supply convoy: stage 1 yes, stage 2+ never.
// usage: node tools/static-server.mjs  (port 5188)  then  node tools/test-rampalion.mjs [shotsDir]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = 'http://localhost:5188/';
const SHOTS = process.argv[2] || 'work/rampalion-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' :: ' + info : ''}`); };

const TITLE_CHEAT = ['KeyC', 'KeyL', 'KeyX', 'KeyM', 'KeyG', 'KeyH', 'KeyK', 'KeyF', 'KeyT',
  'KeyJ', 'KeyD', 'KeyG', 'KeyH', 'KeyK', 'KeyD', 'KeyH', 'KeyS'];
const RAMPALION_KO = ['KeyF', 'KeyO', 'KeyA', 'KeyV', 'KeyK', 'KeyF', 'KeyL', 'KeyD', 'KeyH', 'KeyS'];
const keyOf = (code) => code.replace('Key', '').toLowerCase();

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(URL, '')}`); });
  await page.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: true }));
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await page.goto(URL + '?cb=ramp' + Date.now());
  await page.waitForSelector('#btn-start', { state: 'visible', timeout: 300000 });
  return { ctx, page, errors };
}
async function typeCodes(page, codes) {
  for (const c of codes) { await page.keyboard.press(keyOf(c)); await page.waitForTimeout(60); }
}
const randomCardKey = (page) => page.evaluate(() => {
  const card = document.querySelector('.char-card[data-key="random"]');
  return { text: card?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60), selected: document.querySelector('.char-card.selected')?.dataset.key };
});

// ---- A) without the title cheat, typing does nothing ----
{
  const { ctx, page } = await open();
  await page.click('#btn-start');
  await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
  await typeCodes(page, RAMPALION_KO); await page.waitForTimeout(600);
  const r = await randomCardKey(page);
  check('치트 없이 "램파리온" 입력 시 해금 안 됨', !/램파리온/.test(r.text || ''), JSON.stringify(r));
  await ctx.close();
}

// ---- B) title cheat -> select typing -> sortie ----
const { ctx, page, errors } = await open();
await page.waitForTimeout(500);
await typeCodes(page, TITLE_CHEAT);
await page.waitForTimeout(400);
check('타이틀 치트 활성화', await page.evaluate(() => sessionStorage.getItem('lao_cheats') === '1'));
await page.click('#btn-start');
await page.waitForSelector('.char-card'); await page.waitForTimeout(400);
await typeCodes(page, RAMPALION_KO);
await page.waitForTimeout(2500);
const card = await randomCardKey(page);
check('선택 화면 "램파리온" 입력 → RANDOM 칸에 램파리온', /램파리온/.test(card.text || ''), JSON.stringify(card));
await page.screenshot({ path: path.join(SHOTS, '1-select.png') });
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
await page.waitForTimeout(1500);

const st = await page.evaluate(() => {
  const g = window.__LAO__.getGame(); const p = g.player; const r = p._ramp;
  const anims = r ? Object.entries(r.anims) : [];
  return { charKey: p.charKey, lives: p.lives, ramp: !!r, level: p.shotLevel,
    loaded: anims.filter(([, a]) => a).length, total: anims.length,
    missing: anims.filter(([, a]) => !a).map(([k]) => k),
    tracks: r?.tracks ? Object.keys(r.tracks) : [] };
});
check('출격 캐릭터 = 램파리온', st.charKey === 'rampalion', JSON.stringify(st));
check('목숨 1개', st.lives === 1);
check('합체 그림(교체 몸통·부품·로봇) 전부 로드', st.total > 0 && st.loaded === st.total, `${st.loaded}/${st.total} missing=${st.missing}`);
check('뼈대 추적 정보 로드 (가슴·팔·등·다리)', ['chest', 'handB', 'wingB', 'shoulderF', 'kneeF', 'footF', 'kneeB', 'footB'].every((b) => st.tracks.includes(b)), st.tracks.join(','));

// Freeze the real loop; drive the sim by hand.
const sim = (fn, arg) => page.evaluate(fn, arg);
await sim(() => { window.__rafStop = true; window.requestAnimationFrame = () => 0; });

// Level-ups: one robot docks per level, one location each, base shot unchanged.
const fuse = await sim(() => {
  const g = window.__LAO__.getGame(); const p = g.player; const r = p._ramp;
  const out = [];
  for (let i = 0; i < 4; i++) {
    g._adjustPowerCheat(1);
    const docking = r.docks.length;
    for (let k = 0; k < 75; k++) g.update(1 / 60); // fly-in + merge (1.1 s)
    out.push({ lv: p.shotLevel, slots: r.slots.map((e) => e.slot.id + ':' + e.opt.mounts[0].part), attached: r.slots.every((e) => e.attached),
      docking, pattern: p.meta.shot?.pattern, sub: p.meta.subWeapon });
  }
  return out;
});
check('레벨업마다 로봇이 날아와 합체 (Lv2~5)', fuse.every((f) => f.docking === 1 && f.attached), JSON.stringify(fuse));
check('부위가 레벨 순서대로 하나씩: 가슴 → 팔 → 등 → 다리',
  JSON.stringify(fuse.map((f) => f.slots.map((x) => x.split(':')[0]))) === JSON.stringify([['chest'], ['chest', 'arm'], ['chest', 'arm', 'back'], ['chest', 'arm', 'back', 'leg']]));
check('기본 무기는 그대로 (라이온 버스터, 보조무기 없음)', fuse.every((f) => f.pattern === 'shinden' && !f.sub));

// Parts add their own bullets on top of the base shot.
const fire = await sim(() => {
  const g = window.__LAO__.getGame(); const p = g.player;
  const count = () => { const c = {}; for (const b of g.bullets.list) if (b.alive && b.friendly) c[b.style] = (c[b.style] || 0) + 1; return c; };
  g.bullets.list.forEach((b) => { b.alive = false; });
  g._keyInput.shoot = true; g._syncMergedInput();
  const seen = {};
  for (let k = 0; k < 90; k++) { g.update(1 / 60); for (const [st, n] of Object.entries(count())) seen[st] = Math.max(seen[st] || 0, n); }
  g._keyInput.shoot = false; g._syncMergedInput();
  return { seen, parts: p._ramp.slots.map((e) => e.opt.gun.kind) };
});
const baseStyles = ['shindenshot'];
const extra = Object.keys(fire.seen).filter((k) => !baseStyles.includes(k));
check('기본 탄 + 파츠 추가 탄이 함께 발사 (파란 미사일 없음)', baseStyles.every((k) => fire.seen[k] > 0) && !fire.seen.heatmissile && extra.length >= 3, JSON.stringify(fire));
await page.evaluate(() => { const g = window.__LAO__.getGame(); g.player.invuln = 0; g.player.x = 300; g.player.y = 300; });
for (let i = 0; i < 6; i++) await sim(() => { const g = window.__LAO__.getGame(); g.update(1 / 60); });
await sim(() => { const g = window.__LAO__.getGame(); g.draw?.(); });
await page.screenshot({ path: path.join(SHOTS, '2-fused.png') });

// Real P pickup path (game._updatePowerUps): drop to Lv2 then pick a P item.
const pick = await sim(() => {
  const g = window.__LAO__.getGame(); const p = g.player; const r = p._ramp;
  while (r.slots.length > 1) r.slots.pop();
  p.shotLevel = 2;
  // Clean field: no stray P items or carriers that could add a second level-up.
  g.powerUps.length = 0;
  for (const e of g.enemies) { e.alive = false; e.dropsPower = false; }
  g.enemies.length = 0;
  g._powerRecoveryDueAt = Infinity;
  const before = r.fusions;
  g._tryDropPowerUp?.({ x: p.x, y: p.y, dropsPower: true, alive: false });
  const item = g.powerUps.find((u) => u.type === 'power' && u.alive);
  if (item) { item.x = p.x; item.y = p.y; }
  for (let k = 0; k < 90; k++) g.update(1 / 60);
  return { dropped: !!item, lv: p.shotLevel, slots: r.slots.map((e) => e.slot.id), attached: r.slots.every((e) => e.attached), fusions: r.fusions - before };
});
check('P 아이템 획득 레벨업 → 다음 부위 합체', pick.dropped && pick.lv === 3 && pick.fusions === 1 && pick.slots.join() === 'chest,arm' && pick.attached, JSON.stringify(pick));

// Armour hit: the newest part is knocked off, level -1, life kept.
const armor = await sim(() => {
  const g = window.__LAO__.getGame(); const p = g.player; const r = p._ramp;
  p.invuln = 0; p.godMode = false;
  const before = { lv: p.shotLevel, lives: p.lives, slots: r.slots.map((e) => e.slot.id) };
  const res = p.hit();
  if (res === 'armor') g._onRampalionArmorHit();
  for (let k = 0; k < 10; k++) g.update(1 / 60);
  return { r: res, before, after: { lv: p.shotLevel, lives: p.lives, slots: r.slots.map((e) => e.slot.id), ejects: r.ejects.length, alive: p.alive, invuln: p.invuln, state: g.state } };
});
check('파워 2단계 이상 피격 → 파워 -1, 목숨 유지, 마지막 부품만 이탈',
  armor.r === 'armor' && armor.after.lv === armor.before.lv - 1 && armor.after.lives === 1
  && armor.after.slots.join() === armor.before.slots.slice(0, -1).join() && armor.after.ejects >= 1 && armor.after.alive,
  JSON.stringify(armor));
check('피격 후 무적 시간', armor.after.invuln > 1);
await sim(() => { const g = window.__LAO__.getGame(); g.draw?.(); });
await page.screenshot({ path: path.join(SHOTS, '3-armor-break.png') });

// Supply convoy gating.
const supply = await sim(() => {
  const g = window.__LAO__.getGame(); const p = g.player;
  const run = (stageIndex) => {
    g.stageIndex = stageIndex;
    p.shotLevel = 1; p.invuln = 5; p._ramp.slots = [];
    g.powerUps.length = 0;
    for (const e of g.enemies) e.dropsPower = false;
    g._powerRecoveryDueAt = 0; g._lastPowerRecoveryTime = -Infinity;
    const n0 = g.enemies.filter((e) => e.recoveryCarrier).length;
    g._maybeSpawnPowerRecovery();
    return g.enemies.filter((e) => e.recoveryCarrier).length - n0;
  };
  const s1 = run(0);
  const s2 = run(1);
  const s3 = run(3);
  g.stageIndex = 0;
  return { s1, s2, s3 };
});
check('1스테이지 보급 편대 옴', supply.s1 > 0, JSON.stringify(supply));
check('2스테이지 이후 보급 편대 안 옴', supply.s2 === 0 && supply.s3 === 0);

// No-miss extend is blocked (one life only) - logic check on the guard.
// Lv1 hit = destroyed -> game over.
const death = await sim(() => {
  const g = window.__LAO__.getGame(); const p = g.player;
  for (const e of g.enemies) e.recoveryCarrier = false;
  p.shotLevel = 1; p.invuln = 0;
  const r = p.hit();
  if (r === 'armor') g._onRampalionArmorHit(); else if (r) g._onPlayerStruck();
  for (let k = 0; k < 400 && g.state !== 'gameover'; k++) g.update(1 / 60);
  return { r, alive: p.alive, lives: p.lives, state: g.state };
});
check('파워 1단계 피격 → 격파, 게임 오버', death.r === true && !death.alive && death.state === 'gameover', JSON.stringify(death));

check('콘솔/페이지 오류 없음', errors.length === 0, errors.slice(0, 5).join(' | '));
await ctx.close();
await browser.close();
const fail = results.filter((r) => !r.ok).length;
console.log(`\n결과: ${results.length - fail} 통과 / ${fail} 실패`);
fs.writeFileSync(path.join(SHOTS, 'result.json'), JSON.stringify(results, null, 1));
process.exit(fail ? 1 : 0);
