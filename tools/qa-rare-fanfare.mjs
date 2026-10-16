/**
 * Tick28: rare reveal fanfare — soft-sprite orbit grit + white tip cores.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RARE_FANFARE_MOTE_COUNT,
  buildRareFanfareMotesHtml,
  rareInfo,
  RARE_CHAR_KEYS,
} from '../js/rare-fanfare.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const src = readFileSync(join(root, 'js/rare-fanfare.js'), 'utf8');

assert.equal(RARE_FANFARE_MOTE_COUNT, 8, 'budget-capped mote count');

const html = buildRareFanfareMotesHtml();
assert.match(html, /rare-fanfare-motes/, 'motes container');
const moteHits = html.match(/class="rare-fanfare-mote"/g) || [];
assert.equal(moteHits.length, 8, 'exactly 8 soft motes');

const stretches = [...html.matchAll(/data-stretch="([0-9.]+)"/g)].map((m) => Number(m[1]));
assert.equal(stretches.length, 8, 'stretch attrs on every mote');
assert.ok(stretches.every((s) => s >= 1.5), `stretch ≥1.5, got ${stretches.join(',')}`);

const tips = html.match(/data-tip="1"/g) || [];
assert.equal(tips.length, 8, 'white tip marker on every mote');

const empty = buildRareFanfareMotesHtml(0);
assert.equal((empty.match(/class="rare-fanfare-mote"/g) || []).length, 0, 'zero-count silent');
assert.match(empty, /rare-fanfare-motes/, 'empty still has container');

assert.match(src, /buildRareFanfareMotesHtml\(\)/, 'playRareFanfare injects motes');
assert.match(src, /export function fitRareFanfareCard/, 'tick170 short-landscape fit export');
assert.match(src, /is-rare-compact/, 'compact reclaim class');
assert.match(src, /is-rare-ultra/, 'ultra portrait-hide reclaim class');
assert.ok(!/polygon|zigzag|slash|gear/i.test(html), 'no geometry marks in mote html');

assert.match(css, /\.rare-fanfare-mote\b/, 'mote style present');
assert.match(css, /\.rare-fanfare-mote::after/, 'white tip ::after core');
assert.match(css, /scaleX\(var\(--mote-stretch/, 'CSS stretch ≥1.5 via --mote-stretch');
assert.match(css, /@keyframes rare-mote-drift/, 'drift animation');
assert.match(css, /mix-blend-mode:\s*screen/, 'soft additive-ish blend');
assert.match(css, /TICK170 — rare fanfare short-landscape chrome reclaim/, 'tick170 CSS marker');
assert.match(css, /\.rare-fanfare\.is-rare-compact/, 'compact card rules');
assert.match(css, /\.rare-fanfare\.is-rare-ultra/, 'ultra card rules');
assert.ok(!/clip-path:\s*polygon/i.test(css.match(/\.rare-fanfare-mote[\s\S]{0,400}/)?.[0] || ''),
  'mote rule avoids polygon clip');

for (const key of RARE_CHAR_KEYS) {
  const info = rareInfo(key);
  assert.ok(info?.accent && info?.glow, `${key} keeps accent/glow`);
}

console.log(
  'PASS qa-rare-fanfare:',
  `motes=${moteHits.length}`,
  `stretchMin=${Math.min(...stretches).toFixed(2)}`,
  `tips=${tips.length}`,
  'burst+card retained',
  'tick170 fitRareFanfareCard compact/ultra retained',
);
