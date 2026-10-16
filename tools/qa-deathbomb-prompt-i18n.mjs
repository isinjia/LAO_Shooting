/**
 * Tick116: deathbomb grace prompt plate grows for long i18n subs
 * (en/pt/es/ru) so dual-stroke captions do not overflow fixed 268/236 boxes.
 * Caption dual-stroke / pulse / title language / deathbomb timers frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLocale, t } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

const prompt = game.match(
  /Deathbomb grace prompt[\s\S]*?(?=\n\s*if \(this\.paused\))/,
)?.[0] || '';
assert.ok(prompt.length > 200, 'deathbomb grace prompt block present');

// Measure-then-grow plate (tick116) — not fixed-only boxW.
assert.match(prompt, /Tick116: long i18n subs/);
assert.match(prompt, /measureText\(dbSub\)/);
assert.match(prompt, /measureText\(dbTitle\)/);
assert.match(prompt, /baseW = first \? 268 : 236/);
assert.match(
  prompt,
  /boxW = Math\.min\(W - 48, Math\.max\(baseW, Math\.ceil\(Math\.max\(subW, titleW\) \+ 28\)\)\)/,
);
assert.match(prompt, /boxH = first \? 52 : 44/);

// Caption dual-stroke retained (tick90).
assert.match(
  prompt,
  /Caption dual-stroke: dark outer \+ amber\/rose rim so pulse bar never muddies title\/sub/,
);
assert.match(prompt, /strokeText\(dbTitle/);
assert.match(prompt, /strokeText\(dbSub/);
assert.ok(
  (prompt.match(/strokeText\(dbTitle/g) || []).length >= 2,
  'title dual-stroke kept',
);
assert.ok(
  (prompt.match(/strokeText\(dbSub/g) || []).length >= 2,
  'sub dual-stroke kept',
);

// i18n keys still drive the teach / ok / needDrop subs.
assert.match(prompt, /t\('deathbomb\.first'\)/);
assert.match(prompt, /t\('deathbomb\.ok'\)/);
assert.match(prompt, /t\('deathbomb\.needDrop'\)/);

// Long locales must exceed the old fixed first-teach plate (proof of muddy).
const longLocales = ['en', 'pt', 'es', 'ru'];
for (const loc of longLocales) {
  setLocale(loc);
  const s = t('deathbomb.first');
  // Conservative: latin/cyrillic teach lines are longer than ko CJK compact.
  assert.ok(
    [...s].length >= 40,
    `${loc} deathbomb.first stays a long teach line (${[...s].length})`,
  );
}
setLocale('ko');
assert.ok([...t('deathbomb.first')].length < 30, 'ko teach stays compact');

// No timer / dens / HOLD churn in this block.
assert.ok(!/deathBombTimer|HOLD dens|emitRate/.test(prompt),
  'no deathbomb timer / HOLD dens churn');

console.log(
  'PASS qa-deathbomb-prompt-i18n:',
  'measure-then-grow plate',
  'dual-stroke kept',
  'base 268/236 floor',
  'long en/pt/es/ru teach',
  'timers/HOLD frozen',
);
