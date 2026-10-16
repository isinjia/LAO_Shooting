// Depth / overlay audit (user: nothing drawn at the wrong place or depth; 100/100).
// Everything layered onto a body in this game rides a per-frame bake track: Rampalion's fused
// parts (bone tracks), the final boss's commander face (head track), and the body variants /
// form clips drawn in place of the base body. Each bug so far was a track or variant out of
// step with the body image actually drawn. Items:
//   track-coverage   every bone / head track a layer uses exists for every clip the body plays,
//                    one entry per full bake frame
//   variant-camera   a body variant / form clip shares the base's contentBox and frame counts
//                    (drawn in its place, pixel-exact)
//   anchor-on-body   live game math: every anchor the game computes (bonePoint / the face's
//                    trackFrame) for every frame of every clip lands on the body image drawn
//                    that frame (an opaque pixel within 5% of the draw size)
//   draw-order       one live frame of the field, every layer logged in draw order: enemies,
//                    then friendly shots, the ship, enemy shots over the ship (user), hit FX /
//                    pickups / explosions over the enemies, a skill run's behind-enemies layer
//                    under them; the WebGL shot layer above the field and below the HUD
//   part-z           the depths the user set for Rampalion's parts (regression guard)
//   ui-clip          HUD / touch controls at desktop 960x540 and phone 915x412: nothing
//                    outside the screen, no label text overflowing its box
// Score = 100 x passed items / items.  usage: node tools/check-depth.mjs [out.json]
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=dp' + Date.now());
await page.waitForSelector('#btn-start', { state: 'visible', timeout: 120000 });
await page.click('#btn-start');
await page.waitForSelector('.char-card');
await page.evaluate(() => window.__LAO__.applySelectCheat('rampalion'));
await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });

const res = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const R = await import('/js/rampalion.js');
  const { ClipAnimator, trackFrame } = await import('/js/clip-anim.js');
  const g = window.__LAO__.getGame();
  const A = window.__LAO__.getAssets();
  const bank = g.assets.bank;
  const items = [];
  const item = (kind, key, ok, detail = '') => items.push({ kind, key, ok, detail });
  const manifest = async (key) => (await fetch(`/assets/sd_baked/${key}/anim.json`)).json();
  const sheetOf = async (key) => (await fetch(`/assets/sd_baked/${key}/sheet.json`)).json();

  // ---- offscreen body mask
  const cv = document.createElement('canvas');
  cv.width = 960; cv.height = 540;
  const cx2 = cv.getContext('2d', { willReadFrequently: true });
  const onBody = (data, x, y, rad) => {
    const r = Math.ceil(rad);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const px = Math.round(x + dx); const py = Math.round(y + dy);
        if (px < 0 || py < 0 || px >= 960 || py >= 540) continue;
        if (data[(py * 960 + px) * 4 + 3] > 40) return true;
      }
    }
    return false;
  };

  // ================= Rampalion =================
  const p = g.player; const r = p._ramp;
  g._updateStageFlow = () => {}; g.enemies.length = 0;
  const bones = new Set();
  for (const slot of R.RAMPALION_SLOTS) for (const opt of slot.options) for (const m of opt.mounts) {
    if (m.bone) bones.add(m.bone);
    if (m.seg) m.seg.forEach((b) => bones.add(b));
  }
  // Also the anchors the skills use directly (lion on the chest, Shining Hand fist).
  bones.add('chest');
  const man = await manifest('rampalion');
  const full = { idle: man.idle?.length, move: man.move?.length, skill1: man.skill1?.length, skill2: man.skill2?.length };
  for (const b of bones) {
    const tr = r.tracks?.[b];
    for (const clip of ['idle', 'move', 'skill1', 'skill2']) {
      const n = tr?.[clip]?.length || 0;
      item('track-coverage', `rampalion ${b}.${clip}`, n > 0 && n === full[clip], `${n} vs ${full[clip]} frames`);
    }
  }
  // Body variants / overlays drawn in the base's place: the box and scale they actually draw
  // with in game (initRampalion pins them to the base camera) must equal the base's.
  const baseBox = JSON.stringify(p.anim._box);
  const baseScale = JSON.stringify(p.anim.drawScale || null);
  const baseSheet = await sheetOf('rampalion');
  for (const [k, an] of Object.entries(r.anims)) {
    if (!k.startsWith('rampalion_') || !an) continue;
    item('variant-camera', `${k} box`, JSON.stringify(an._box) === baseBox, `${JSON.stringify(an._box)} vs ${baseBox}`);
    item('variant-camera', `${k} scale`, JSON.stringify(an.drawScale || null) === baseScale, `${JSON.stringify(an.drawScale)} vs ${baseScale}`);
    let sj = null;
    try { sj = await sheetOf(k); } catch { /* */ }
    for (const clip of ['idle', 'move', 'skill1', 'skill2']) {
      if (!sj?.[clip]?.length) continue;
      item('variant-camera', `${k} ${clip} frames`, sj[clip].length === baseSheet[clip].length, `${sj[clip].length} vs ${baseSheet[clip].length}`);
    }
  }
  // Live anchors on the drawn body, every frame of every state.
  r.slots.length = 0; r.hyper = false; p.skillRun = null; p.bombRun = null;
  const X = 480; const Y = 270;
  p.x = X; p.y = Y;
  const a = p.anim;
  const states = [['idle', 'idle'], ['move', 'move'], ['attack', 'skill1'], ['skill2', 'skill2']];
  for (const [st] of states) {
    const n = a.clips[st]?.length || 0;
    const fps = a.fps[st] || 24;
    let bad = 0; let worst = null; let total = 0;
    for (let i = 0; i < n; i++) {
      a.state = st; a.time = (i + 0.5) / fps; a.locked = st !== 'idle' && st !== 'move';
      r.pose = (st === 'attack' || st === 'skill2') ? { ...R.skillPose(p, null), dx: 0, dy: 0 } : null;
      cx2.clearRect(0, 0, 960, 540);
      a.draw(cx2, X + (p.drawOffsetX || 0), Y + (p.drawOffsetY || 0), p.drawSize, { flipX: false });
      const data = cx2.getImageData(0, 0, 960, 540).data;
      for (const b of bones) {
        const q = R.bonePoint(p, b);
        if (!q) continue;
        total += 1;
        if (!onBody(data, q.x, q.y, p.drawSize * 0.05)) {
          bad += 1;
          let d = 1; while (d < 60 && !onBody(data, q.x, q.y, d)) d += 1;
          worst ||= `${b} frame ${i} at (${q.x.toFixed(0)},${q.y.toFixed(0)}), nearest body ${d}px (limit ${(p.drawSize * 0.05).toFixed(1)})`;
        }
      }
    }
    r.pose = null;
    item('anchor-on-body', `rampalion ${st}`, bad === 0, `${bad}/${total} anchors off the body${worst ? ', e.g. ' + worst : ''}`);
  }
  a.state = 'idle'; a.time = 0; a.locked = false;

  // ================= Final boss face =================
  await bank.ensureStage(4);
  for (const key of ['final_yimir', 'final_arachne', 'final_roc']) {
    const clips = A.anims[key];
    const mf = await manifest(key);
    const ht = clips?.headTrack;
    for (const clip of ['idle', 'move', 'die', 'skill1', 'skill2']) {
      const n = ht?.[clip]?.length || 0;
      const want = mf[clip]?.length || 0;
      item('track-coverage', `${key} head.${clip}`, n > 0 && n === want, `${n} vs ${want} frames`);
    }
    const an = new ClipAnimator(clips);
    const size = 260;
    for (const st of ['idle', 'move', 'attack', 'skill2', 'die']) {
      const n = an.clips[st]?.length || 0;
      const fps = an.fps[st] || 24;
      let bad = 0; let worst = null;
      for (let i = 0; i < n; i++) {
        an.state = st; an.time = (i + 0.5) / fps; an.locked = !(st === 'idle' || st === 'move');
        cx2.clearRect(0, 0, 960, 540);
        an.draw(cx2, X, Y, size, { flipX: false });
        const data = cx2.getImageData(0, 0, 960, 540).data;
        // Same math as Enemy._drawFace.
        const tr = ht?.[st === 'attack' ? 'skill1' : st] || ht?.idle;
        const box = an._box;
        if (!tr || !box) { bad += 1; continue; }
        const [hx, hy] = tr[trackFrame(an, tr.length)];
        const aspect = box.w / box.h;
        const w = aspect >= 1 ? size : size * aspect;
        const h = aspect >= 1 ? size / aspect : size;
        const sc = w / box.w;
        const fx = X - w / 2 + (hx - box.x) * sc;
        const fy = Y - h / 2 + (hy - box.y) * sc;
        // The head itself is left out of these bakes: the neck must be right there.
        if (!onBody(data, fx, fy, size * 0.08)) { bad += 1; worst ||= `frame ${i}`; }
      }
      item('anchor-on-body', `${key} face ${st}`, bad === 0, `${bad}/${n} frames off the body${worst ? ', e.g. ' + worst : ''}`);
    }
  }

  // ================= Field draw order (one live frame) =================
  {
    const { Enemy } = await import('/js/enemy.js');
    const { Player } = await import('/js/player.js');
    const { PowerUp } = await import('/js/powerup.js');
    await bank.ensureEnemy('programmob_an');
    g.stageIndex = 0; g.enemies.length = 0; g.boss = null; g.bullets.list.length = 0;
    r.slots.length = 0; r.pose = null;
    p.x = 200; p.y = 270; p.invuln = 999; p.hit = () => false;
    g._keyInput.shoot = true; g._syncMergedInput();
    // Rampalion C Lv3 (Shining Hand) has a behind-enemies layer (the halo behind its target).
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    for (let tries = 0; tries < 30 && !p.skillRun; tries++) {
      p.sp = p.spMax; g._keyInput.special = true; g._syncMergedInput(); g.update(1 / 60);
      g._keyInput.special = false; g._syncMergedInput(); g.update(1 / 60);
    }
    const mk = (x, y) => new Enemy({ x, y, clips: A.anims.programmob_an, hp: 1e6, score: 1, size: 70 });
    g.enemies.push(mk(560, 200), mk(620, 330));
    for (let i = 0; i < 4; i++) { g.update(1 / 60); p.x = 200; p.y = 270; }
    g.powerUps.push(new PowerUp(500, 270, 'power'));
    g.bullets.spawn({ friendly: false, x: 300, y: 270, vx: -50, vy: 0, r: 6, damage: 1, style: 'orb', color: '#ff5050' });
    g.bullets.spawn({ friendly: true, x: 400, y: 270, vx: 600, vy: 0, r: 6, damage: 0, style: 'p38shot' });
    g.hitFx.spawn({ style: 'p38shot', vx: 1, vy: 0 }, 560, 200);
    g._spawnSheetFx?.('lao-fx-airboom', 600, 300, 80, 0.5);
    const log = [];
    const wrap = (obj, name, label) => {
      const orig = obj[name];
      obj[name] = function (...a) { log.push(typeof label === 'function' ? label(a) : label); return orig.apply(this, a); };
      return () => { obj[name] = orig; };
    };
    const undo = [
      wrap(Enemy.prototype, 'draw', 'enemy'),
      wrap(PowerUp.prototype, 'draw', 'powerup'),
      wrap(Player.prototype, 'draw', 'player'),
      wrap(g.bullets, 'draw', (a) => 'bullets:' + (a[2] || 'all')),
      wrap(g.hitFx, 'draw', 'hitfx'),
      wrap(g, '_drawSheetFx', 'sheetfx'),
      wrap(g.projectileVfx, 'render', 'gpu'),
      wrap(g.fx, 'draw', 'fx'),
    ];
    const spec = p.skillRun?.spec;
    if (spec?.drawBehindEnemies) undo.push(wrap(spec, 'drawBehindEnemies', 'behindEnemies'));
    g.draw();
    undo.forEach((u) => u());
    const first = (k) => log.indexOf(k);
    const last = (k) => log.lastIndexOf(k);
    const order = (a, b, why) => item('draw-order', why, first(a) >= 0 && first(b) >= 0 && last(a) < first(b), `${a} -> ${b}: ${log.join(' ')}`);
    order('enemy', 'bullets:friendly', 'friendly shots over the enemies');
    order('bullets:friendly', 'player', 'the ship over its own shots');
    order('player', 'bullets:hostile', 'enemy shots over the ship (user)');
    order('enemy', 'hitfx', 'hit bursts over the enemies');
    order('enemy', 'powerup', 'pickups over the enemies');
    order('enemy', 'sheetfx', 'sheet explosions over the enemies');
    order('enemy', 'fx', 'kill explosions over the enemies');
    item('draw-order', 'a skill run with a behind-enemies layer was live', !!spec?.drawBehindEnemies, spec ? 'spec without drawBehindEnemies' : 'no skill run');
    if (spec?.drawBehindEnemies) order('behindEnemies', 'enemy', 'skill layer behind the enemies drawn under them');
    g._keyInput.shoot = false; g._syncMergedInput();
    // Canvas stack: field < WebGL shot layer < HUD (screen-space z order of the elements).
    const z = (el) => { let n = el; while (n && n !== document.body) { const zi = getComputedStyle(n).zIndex; if (zi !== 'auto') return +zi; n = n.parentElement; } return 0; };
    const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const field = document.getElementById('game');
    const gpu = document.querySelector('canvas.projectile-vfx');
    const hud = document.getElementById('hud');
    item('draw-order', 'WebGL shot layer present', !!gpu);
    if (gpu) item('draw-order', 'WebGL shot layer above the field canvas', z(gpu) > z(field) || (z(gpu) === z(field) && after(field, gpu)), `field ${z(field)} gpu ${z(gpu)}`);
    if (gpu && hud) item('draw-order', 'HUD above the WebGL shot layer', z(hud) > z(gpu) || (z(hud) === z(gpu) && after(gpu, hud)), `gpu ${z(gpu)} hud ${z(hud)}`);
  }

  // ================= Rampalion part depths the user set =================
  {
    const opt = (robot) => R.RAMPALION_SLOTS.flatMap((sl) => sl.options).find((o) => o.robot === robot);
    const m = (robot, part) => opt(robot)?.mounts.find((x) => x.part === part);
    item('part-z', 'goltarion sword over the hand (user)', m('goltarion', 'fw_golt_sword')?.under === false && m('goltarion', 'fa_golt_L')?.under === true);
    item('part-z', 'goltarion screen-right hand behind the body (user)', m('goltarion', 'fa_golt_L')?.under === true);
    item('part-z', 'goltarion screen-left arm over the body (user)', m('goltarion', 'fa_golt_R')?.under === false && (m('goltarion', 'fa_golt_R')?.z || 0) >= 1);
    item('part-z', 'hestia screen-right hand behind the body (user)', m('hestia', 'fa_hest_R')?.under === true);
    item('part-z', 'hestia screen-left hand over the body (user)', m('hestia', 'fa_hest_L')?.under === false && (m('hestia', 'fa_hest_L')?.z || 0) >= 1);
    item('part-z', 'tyrant head under Rampalion head / front arm overlay (user)', m('tyrant', 'fc_tyranthead7')?.under === false && !!opt('tyrant')?.frontOverlay);
    item('part-z', 'aeda chest core over the leg parts (user)', (m('aeda', 'fc_aedaorb')?.z || 0) >= 1);
    item('part-z', 'roc wings behind, left wing piece in front (user)', m('roc', 'fpart_thunder')?.under === true && m('roc', 'fpart_thunder')?.split?.front === true);
    for (const robot of ['shade', 'alfred']) {
      const legs = opt(robot)?.mounts || [];
      item('part-z', `${robot} legs over the body (not washed out by the booster)`, legs.length > 0 && legs.every((x) => x.under === false));
    }
  }

  // ================= Peregrinus form / skill bodies =================
  const pb = await sheetOf('peregrinus');
  for (const k of ['peregrinus_human', 'peregrinus_change', 'peregrinus_revert', 'peregrinus_hskill2', 'peregrinus_bskill2']) {
    const sj = await sheetOf(k);
    item('variant-camera', `${k} box`, JSON.stringify(sj.contentBox) === JSON.stringify(pb.contentBox), `${JSON.stringify(sj.contentBox)}`);
  }
  return items;
});

// ================= HUD / touch controls clipping at desktop and phone sizes =================
async function uiClip(label, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ muted: true, autoFire: false }));
    localStorage.setItem('lao_mini_tutorial_seen', '1');
  });
  await pg.goto('http://localhost:5188/?cb=ui' + Date.now());
  await pg.waitForSelector('#btn-start', { state: 'visible', timeout: 120000 });
  await pg.click('#btn-start');
  await pg.waitForSelector('.char-card');
  await pg.waitForTimeout(300);
  await pg.keyboard.press('Space');
  await pg.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
  await pg.waitForTimeout(2500);
  const out = await pg.evaluate((label) => {
    const items = [];
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const roots = ['#hud', '#touch-controls'].map((q) => document.querySelector(q)).filter(Boolean);
    const vis = (el) => {
      const cs = getComputedStyle(el);
      const rc = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && rc.width > 1 && rc.height > 1;
    };
    const off = [];
    const over = [];
    for (const root of roots) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!vis(el) || el.closest('[hidden]')) continue;
        const rc = el.getBoundingClientRect();
        if (rc.left < -1 || rc.top < -1 || rc.right > vw + 1 || rc.bottom > vh + 1) {
          off.push(`${el.id || el.className || el.tagName} [${rc.left | 0},${rc.top | 0},${rc.right | 0},${rc.bottom | 0}]`);
        }
        const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (txt && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
          const cs = getComputedStyle(el);
          if (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap') {
            over.push(`${el.id || el.className} "${el.textContent.trim().slice(0, 20)}" ${el.scrollWidth}>${el.clientWidth}`);
          }
        }
      }
    }
    items.push({ kind: 'ui-clip', key: `${label}: HUD inside the screen`, ok: off.length === 0, detail: off.slice(0, 4).join('; ') });
    items.push({ kind: 'ui-clip', key: `${label}: no label text overflowing`, ok: over.length === 0, detail: over.slice(0, 4).join('; ') });
    return items;
  }, label);
  await ctx.close();
  return out;
}
res.push(...await uiClip('desktop 960x540', { viewport: { width: 960, height: 540 } }));
res.push(...await uiClip('phone 915x412', {
  viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-A325F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
}));

const pass = res.filter((x) => x.ok).length;
const by = {};
for (const it of res) (by[it.kind] ||= []).push(it);
for (const [k, l] of Object.entries(by)) {
  const bad = l.filter((x) => !x.ok);
  console.log(`== ${k}: ${l.length - bad.length}/${l.length}`);
  for (const b of bad) console.log(`  FAIL ${b.key}: ${b.detail}`);
}
const score = (100 * pass) / Math.max(1, res.length);
console.log(`checked ${res.length} items, ${res.length - pass} failing  => DEPTH ${score.toFixed(1)}`);
if (errs.length) console.log('ERR', JSON.stringify(errs.slice(0, 3)));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ score, items: res }, null, 1));
await browser.close();
