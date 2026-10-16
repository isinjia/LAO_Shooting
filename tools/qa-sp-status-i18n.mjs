/**
 * Tick117: #sp-status ready-line grows max-width for long i18n strings
 * (en/pt/es/ru hud.spReady) so dual-stroke tip densify is not ellipsis-clipped
 * at the fixed 260px floor. Tick60 dual-stroke/brass + max-height wiring frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t, specialDisplayName, LOCALES } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

// Measure-then-grow max-width (tick117) — not fixed-only 260.
assert.match(game, /Tick117: long i18n ready-lines/);
assert.match(game, /measureText\(spStatusText\)/);
assert.match(game, /statusMax = Math\.min\(400, Math\.max\(260,/);
assert.match(game, /spStatus\.style\.maxWidth/);
assert.match(game, /tracking = \[\.\.\.spStatusText\]\.length \* 11 \* 0\.04/);

// CSS floor + ellipsis safety retained (grow is inline; floor stays).
assert.match(css, /#sp-status\s*\{[\s\S]*?max-width:\s*260px/);
assert.match(css, /#sp-status\s*\{[\s\S]*?text-overflow:\s*ellipsis/);

// Tick60 ready-line dual-stroke / brass + max-height wiring frozen.
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);
assert.match(
  css,
  /#sp-row:has\(#sp-track\.ready\) \+ #sp-status,[\s\S]*?#sp-row:has\(#sp-track\.is-ready-flash\) \+ #sp-status\s*\{[\s\S]*?max-height:\s*1\.4em/,
);
assert.match(css, /\.lao-newui #sp-row:has\(#sp-track\.ready\) \+ #sp-status/);
assert.match(css, /0 0 8px rgba\(255,\s*200,\s*90/);

// Long locales prove muddy vs the old 260 floor (approx at 11px + tracking).
function approxReadyW(s) {
  let raw = 0;
  for (const ch of [...s]) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0400 && cp <= 0x04FF) raw += 11 * 0.62;
    else if (cp > 0x2E80) raw += 11;
    else if (/[A-Z]/.test(ch)) raw += 11 * 0.66;
    else if (/[a-z]/.test(ch)) raw += 11 * 0.52;
    else if (ch === ' ') raw += 11 * 0.3;
    else raw += 11 * 0.45;
  }
  return raw + [...s].length * 11 * 0.04;
}

const longLocales = ['en', 'pt', 'es', 'ru'];
let overflowHits = 0;
for (const loc of longLocales) {
  setLocale(loc);
  for (const c of ['hirume', 'eternity', 'labiata', 'merlin']) {
    const name = specialDisplayName(c) || c;
    const s = t('hud.spReady', { lv: 3, name, n: 3 });
    if (approxReadyW(s) > 260) overflowHits += 1;
  }
}
assert.ok(
  overflowHits >= 4,
  `expected multiple en/pt/es/ru hud.spReady lines over 260 (got ${overflowHits})`,
);
setLocale('ko');
assert.ok(
  approxReadyW(t('hud.spReady', {
    lv: 3,
    name: specialDisplayName('hirume') || 'hirume',
    n: 3,
  })) < 260,
  'ko hirume ready stays under 260 floor',
);

// Locale table still has 8 langs.
assert.equal(LOCALES.length, 8, '8 locales retained');

console.log(
  'PASS qa-sp-status-i18n:',
  'measure-then-grow maxWidth',
  'floor 260 / cap 400',
  'tracking pad',
  'tick60 dual-stroke frozen',
  `long-locale overflows=${overflowHits}`,
);
