/**
 * Tick121: OPTIONS Mute|Fullscreen sit in a 2-col pair grid so long
 * es `opt.fullscreen` is not crushed into a phantom 3rd auto-fit track
 * (~141px, 3-line wrap) after tick120 autofire full-span.
 * Strings kept; tip61 / Box2 / tick35 / tick120 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Measure-based widen via 2-col pair (tick121).
assert.match(css, /TICK121 — OPTIONS mute\/fullscreen i18n pair widen/);
assert.match(
  css,
  /TICK121 — OPTIONS mute\/fullscreen i18n pair widen[\s\S]*?\.opt-checks\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(140px,\s*1fr\)\)/,
);

// Tick120 autofire full-span + align-items:start retained.
assert.match(css, /TICK120 — OPTIONS autofire i18n widen/);
assert.match(
  css,
  /\.opt-checks\s*>\s*\.opt-check:has\(#opt-autofire\)\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/,
);
assert.match(
  css,
  /TICK120 — OPTIONS autofire i18n widen[\s\S]*?\.opt-checks\s*\{[\s\S]*?align-items:\s*start/,
);

// Markup still wires mute / fullscreen / autofire.
assert.match(main, /id="opt-mute"/);
assert.match(main, /id="opt-fs"/);
assert.match(main, /id="opt-autofire"/);
assert.match(main, /t\('opt\.fullscreen'\)/);
assert.match(main, /t\('opt\.mute'\)/);

// Muddy input: es fullscreen stays the long crush case; peers stay shorter.
setLocale('es');
assert.ok(
  [...t('opt.fullscreen')].length >= 16,
  `es opt.fullscreen stays long (${[...t('opt.fullscreen')].length})`,
);
assert.equal(t('opt.fullscreen'), 'Pantalla completa');
for (const loc of ['en', 'pt', 'ru']) {
  setLocale(loc);
  assert.ok(
    [...t('opt.fullscreen')].length >= 10,
    `${loc} opt.fullscreen stays non-trivial (${[...t('opt.fullscreen')].length})`,
  );
}
setLocale('ko');
assert.ok(
  [...t('opt.fullscreen')].length <= 6,
  'ko opt.fullscreen stays compact',
);

// OPTIONS tip61 / tick35 markers untouched.
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);

assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-opt-fullscreen-i18n:',
  '2-col pair grid',
  'opt.fullscreen strings kept',
  'es Pantalla completa',
  'tick120 autofire full-span frozen',
  'OPTIONS tip35/61 frozen',
);
