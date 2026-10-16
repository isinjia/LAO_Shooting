/**
 * Tick120: OPTIONS `#opt-autofire` label full-spans `.opt-checks` so long
 * en/pt/es/ru `opt.autoFire` is not crushed into a minmax(140px) column
 * (3–5 line wrap + grid row stretch). Strings kept; tip61 / Box2 / tick35 frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');

// Measure-based widen via full-span (tick120).
assert.match(css, /TICK120 — OPTIONS autofire i18n widen/);
assert.match(css, /TICK120 — OPTIONS autofire i18n widen[\s\S]*?\.opt-checks\s*\{[\s\S]*?align-items:\s*start/);
assert.match(
  css,
  /\.opt-checks\s*>\s*\.opt-check:has\(#opt-autofire\)\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/,
);

// Markup still wires the autofire checkbox (selector target retained).
assert.match(main, /id="opt-autofire"/);
assert.match(main, /t\('opt\.autoFire'\)/);

// Base 3-check grid retained (mute / fullscreen / autofire).
assert.match(css, /\.opt-checks\s*\{[\s\S]*?minmax\(140px,\s*1fr\)/);
assert.match(main, /id="opt-mute"/);
assert.match(main, /id="opt-fs"/);

// Long locales prove the muddy input (narrow-column crush).
const longLocales = ['en', 'pt', 'es', 'ru'];
for (const loc of longLocales) {
  setLocale(loc);
  const s = t('opt.autoFire');
  assert.ok(
    [...s].length >= 55,
    `${loc} opt.autoFire stays long (${[...s].length})`,
  );
}
setLocale('ko');
assert.ok(
  [...t('opt.autoFire')].length < 40,
  'ko opt.autoFire stays compact',
);

// OPTIONS tip61 / tick35 markers untouched.
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK61 — OPTIONS \/ CONTROLS label NewUI tip residual/);

assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-opt-autofire-i18n:',
  'full-span grid-column',
  'opt.autoFire strings kept',
  'long en/pt/es/ru',
  'OPTIONS tip35/61 frozen',
);
