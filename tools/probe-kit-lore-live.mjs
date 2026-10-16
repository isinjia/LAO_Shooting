/**
 * Live SORTIE dump: friendly bullet styles after FIRE + HOLD + C.
 * Usage: node tools/probe-kit-lore-live.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5188/';
const CHARS = ['hirume', 'constantia', 'lrl', 'merlin', 'fafnir', 'eternity', 'labiata', 'emily'];

async function startSortie(page, charKey) {
  await page.evaluate(() => localStorage.setItem('lao_mini_tutorial_seen', '1'));
  await page.waitForSelector('#btn-start', { timeout: 120000 });
  await page.click('#btn-start');
  await page.waitForSelector('#btn-go', { timeout: 180000 });
  const rares = new Set(['eternity', 'labiata', 'emily']);
  if (rares.has(charKey)) {
    await page.evaluate(async (key) => {
      await window.__LAO__?.applySelectCheat?.(key);
    }, charKey);
    // RANDOM slot keeps data-key="random"; cheat paints is-rare / is-revealed.
    await page.waitForSelector('.char-card.is-rare, .char-card.is-revealed', { timeout: 60000 });
    const rareCard = await page.$('.char-card.is-rare, .char-card.is-revealed');
    if (rareCard) await rareCard.click();
  } else {
    const card = await page.$(`.char-card[data-key="${charKey}"]`);
    if (card) await card.click();
  }
  const kit = await page.evaluate((key) => {
    const el = document.querySelector(`.char-card[data-key="${key}"]`)
      || document.querySelector('.char-card.selected')
      || document.querySelector('.char-card.is-rare');
    return el?.innerText || '';
  }, charKey);
  await page.click('#btn-go');
  try {
    const tut = await page.waitForSelector('#btn-tut-go', { timeout: 1200 });
    if (tut) await tut.click();
  } catch { /* */ }
  await page.waitForFunction(() => document.getElementById('overlay')?.classList.contains('hidden'), {
    timeout: 180000,
  });
  return kit;
}

async function dumpChar(page, charKey) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const kitText = await startSortie(page, charKey);
  const bullets = await page.evaluate((key) => {
    const g = window.__LAO__?.getGame?.();
    if (!g) return { error: 'no game', leftover: [], styles: [], sample: [], n: 0 };
    g.debug.invuln = true;
    try { g.audio?.setMuted?.(true); } catch { /* */ }
    const p = g.player;
    if (p) {
      p.shotLevel = 3;
      p.sp = Math.max(p.sp || 0, 300);
      p.spCost = p.spCost || 100;
    }
    try { p?.shoot?.(g.bullets); } catch { /* */ }
    try { p?.fireOptions?.(g.bullets); } catch { /* */ }
    try { p?.fireCharge?.(g.bullets); } catch { /* */ }
    try { p?.trySpecial?.(g.bullets); } catch { /* */ }
    const list = g.bullets?.list || [];
    const rows = list.filter((b) => b.alive && b.friendly).map((b) => ({
      style: b.style,
      charge: !!b.charge,
      special: !!b.special,
      homing: b.homing || 0,
      ay: b.ay || 0,
      vx: +(b.vx || 0).toFixed(1),
      vy: +(b.vy || 0).toFixed(1),
      blastRadius: b.blastRadius || 0,
      beamLength: b.beamLength || 0,
      returnOwner: !!b.returnOwner,
      r: +(b.r || 0).toFixed(2),
    }));
    const styles = [...new Set(rows.map((r) => r.style))];
    const char = g?.player?.charKey;
    const leftover = rows.filter((r) => {
      if (char === 'hirume') return r.style === 'flameward' || r.style === 'sightbeam';
      if (char === 'constantia') {
        return r.style === 'sunbird' || r.style === 'sightbeam'
          || (r.homing > 0 && r.style !== 'bori');
      }
      if (char === 'lrl') return r.returnOwner || r.style === 'orbital';
      if (char === 'merlin') return r.style === 'orbital' || (r.charge && r.vx === 0);
      if (char === 'fafnir') return r.style === 'empfield';
      if (char === 'labiata') return false;
      if (char === 'emily') return r.style === 'xenoxcore';
      return r.style === 'sunbird' || r.style === 'sightbeam'
        || (r.homing > 0 && r.style !== 'bori');
    });
    return {
      char: p?.charKey || key,
      n: rows.length,
      styles,
      leftover,
      sample: rows.slice(0, 14),
    };
  }, charKey);
  return { kitText: kitText.slice(0, 400), bullets };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const out = {};
try {
  for (const key of CHARS) out[key] = await dumpChar(page, key);
} finally {
  await browser.close();
}
console.log(JSON.stringify(out, null, 2));
const bad = [];
const need = {
  hirume: ['foxflame', 'sunbird'],
  constantia: ['tracer', 'lockround'],
  lrl: ['cleave', 'dragonaxe'],
  merlin: ['shell', 'commandmissile'],
  fafnir: ['lightning', 'jupiterorb', 'teslacoil'],
  eternity: ['coffinround', 'coffinwall', 'coffinmissile'],
  labiata: ['orbitblade', 'plasmaslash', 'plasmacross'],
  emily: ['railbeam', 'busterbeam'],
};
for (const key of CHARS) {
  const b = out[key]?.bullets;
  if (!b || b.leftover?.length) bad.push(key + ':leftover');
  for (const style of need[key] || []) {
    if (!b?.styles?.includes(style)) bad.push(`${key}:missing ${style}`);
  }
}
if (out.hirume?.bullets?.styles?.includes('flameward')) bad.push('hirume:still flameward napalm');
if (out.merlin?.bullets?.styles?.includes('orbital')) bad.push('merlin:still vertical orbital');
if (out.fafnir?.bullets?.styles?.includes('empfield')) bad.push('fafnir:still empfield');
if (out.lrl?.bullets?.sample?.some((r) => r.returnOwner)) bad.push('lrl:returning axe');
if (bad.length) {
  console.error('LIVE_FAIL', bad);
  process.exit(1);
}
console.log('LIVE_SORTIE_DUMP_OK');
