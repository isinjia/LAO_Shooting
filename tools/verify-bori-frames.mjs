// Verify the bomb's Bori sprites against the original fx_Hit_bori frames (sd_baked/bori/native).
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('lao_mini_settings_v1', JSON.stringify({ lang: 'ko', muted: true, bgmVolume: 0, sfxVolume: 0, autoFire: false, padMode: 'fixed', fullscreen: false }));
  localStorage.setItem('lao_mini_tutorial_seen', '1');
});
await page.goto('http://localhost:5188/?cb=bc' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#btn-start', { timeout: 90000 });
await page.click('#btn-start');
await page.waitForSelector('.char-card', { timeout: 90000 });
await page.evaluate(() => window.__LAO__.applySelectCheat('constantia'));
await page.waitForTimeout(800);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), null, { timeout: 300000 });
const res = await page.evaluate(async () => {
  window.requestAnimationFrame = () => 0;
  const g = window.__LAO__.getGame();
  g.debug.invuln = true;
  for (let i = 0; i < 1500; i++) g.update(1 / 60);
  // Reference frames: the baked original clip (148 frames, 768px canvas, dog centred at 384,384).
  const anim = await (await fetch('/assets/sd_baked/bori/anim.json')).json();
  const refs = await Promise.all(anim.skill2.map((rel) => new Promise((ok) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null);
    im.src = '/assets/sd_baked/bori/' + rel;
  })));
  const S = 7.4 / 48; // same display scale as the game
  const CW = 200, CH = 140;
  const mk = () => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return c; };
  const a = mk(); const ax = a.getContext('2d', { willReadFrequently: true });
  const b = mk(); const bx = b.getContext('2d', { willReadFrequently: true });
  const refData = refs.map((im) => {
    if (!im) return null;
    bx.clearRect(0, 0, CW, CH);
    bx.drawImage(im, CW / 2 - 384 * S, CH / 2 - 384 * S, 768 * S, 768 * S);
    const d = bx.getImageData(0, 0, CW, CH).data;
    let any = false; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { any = true; break; }
    return any ? d.slice() : null;
  });
  const sim = (p, q) => {
    // Similarity over the union of both silhouettes: colour + alpha agreement.
    let n = 0, err = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 40 && q[i + 3] < 40) continue;
      n++;
      err += (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2])) / 3
        + Math.abs(p[i + 3] - q[i + 3]) * 0.5;
    }
    return n ? 1 - err / n / 255 : 0;
  };
  const summ = (o) => o.length ? { n: o.length, mean: +(o.reduce((s, x) => s + x[0], 0) / o.length).toFixed(3),
    min: Math.min(...o.map((x) => x[0])), frames: [...new Set(o.map((x) => x[1]))].sort((x, y) => x - y) } : null;
  const p = g.player;
  p.bombs = 3; g._keyInput.bomb = true; g._syncMergedInput(); g.update(1 / 60);
  g._keyInput.bomb = false; g._syncMergedInput();
  const out = [];
  let frames = 0;
  while (p.skillRun && frames < 600) {
    g.update(1 / 60); frames++;
    if (frames % 4) continue;
    for (const f of (p.skillRun?.fx || []).filter((q) => q.bori && q.age < q.dur)) {
      ax.clearRect(0, 0, CW, CH);
      f.bx = CW / 2; f.by = CH / 2; f.ba = 0;
      f.draw(ax, f.age / f.dur, 0, 0, f);
      delete f.bx; delete f.by; delete f.ba;
      const d = ax.getImageData(0, 0, CW, CH).data;
      let anyPx = false; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { anyPx = true; break; }
      if (!anyPx) continue;
      let best = 0, bi = -1;
      refData.forEach((r, i) => { if (!r) return; const v = sim(d, r); if (v > best) { best = v; bi = i; } });
      out.push([+best.toFixed(3), bi, 'dissolve']);
    }
    for (const s of p.skillRun?.shots || []) {
      ax.clearRect(0, 0, CW, CH);
      // Draw this Bori alone, un-rotated, centred (game draw path).
      const keep = { x: s.x, y: s.y, ang: s.ang };
      s.x = CW / 2; s.y = CH / 2; s.ang = 0;
      s.draw(ax, s);
      Object.assign(s, keep);
      const d = ax.getImageData(0, 0, CW, CH).data;
      let best = 0, bi = -1;
      refData.forEach((r, i) => { if (!r) return; const v = sim(d, r); if (v > best) { best = v; bi = i; } });
      out.push([+best.toFixed(3), bi]);
    }
  }
  // Dissolve FX (spawnFx draw) after each hit: check those too.
  return { samples: out.length, mean: +(out.reduce((s, x) => s + x[0], 0) / out.length).toFixed(3),
    min: Math.min(...out.map((x) => x[0])), frames: [...new Set(out.map((x) => x[1]))].sort((x, y) => x - y),
    hist: [0.8, 0.85, 0.9, 0.95].map((th) => out.filter((x) => x[0] >= th).length),
    run: summ(out.filter((x) => !x[2])), dissolve: summ(out.filter((x) => x[2])) };
});
res.errs = errs;
console.log(JSON.stringify(res));
await browser.close();
