/**
 * Tick118: title CONTROLS `.keys-rules` grows max-height for long i18n
 * (es/ru contact+combo wrap) so fixed 3.6em overflow:hidden does not clip.
 * CONTROLS opaque pins / keys-grid scroll / tip61 keys-head·HI dual-stroke frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

// Measure-then-grow max-height (tick118) — not fixed-only 3.6em.
assert.match(main, /Tick118: long es\/ru contact\+combo rules/);
assert.match(main, /function syncTitleKeysRulesHeight/);
assert.match(main, /syncTitleKeysRulesHeight\(\)/);
assert.match(main, /rules\.style\.maxHeight = 'none'/);
assert.match(main, /scrollHeight\) \+ 1/);
assert.match(main, /fs \* 3\.6/);
assert.match(main, /fs \* 6\.6/);
assert.match(main, /Math\.min\(cap, Math\.max\(floor, need\)\)/);

// CSS floor retained (grow is inline; floor stays as baseline).
assert.match(
  css,
  /#overlay-content\.screen-title \.keys-rules\s*\{[\s\S]*?max-height:\s*3\.6em/,
);
assert.match(
  css,
  /#overlay-content\.screen-title \.keys-rules\s*\{[\s\S]*?overflow:\s*hidden/,
);

// CONTROLS pin / keys-grid scroll / tip61 retained.
assert.match(css, /TICK6 — title CONTROLS safe-zone/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);
assert.match(css, /#overlay-content\.screen-title \.keys-grid/);
assert.match(main, /keys-head">CONTROLS/);
assert.match(main, /title\.contactRule/);
assert.match(main, /title\.comboRule/);

// Long locales prove muddy vs the old 3.6em two-line budget (~2×11px body).
// es/ru contact+combo are the wrap offenders (live DOM: scrollH 66 > clientH 46).
const longLocales = ['es', 'ru'];
for (const loc of longLocales) {
  setLocale(loc);
  const a = t('title.contactRule');
  const b = t('title.comboRule');
  assert.ok(
    [...a].length + [...b].length >= 100,
    `${loc} contact+combo stay long (${[...a].length + [...b].length})`,
  );
}
setLocale('ko');
assert.ok(
  [...t('title.contactRule')].length + [...t('title.comboRule')].length < 60,
  'ko contact+combo stay compact',
);

assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-keys-rules-i18n:',
  'measure-then-grow maxHeight',
  'floor 3.6em / cap 6.6em',
  'CONTROLS pins + tip61 frozen',
  'long es/ru contact+combo',
);
