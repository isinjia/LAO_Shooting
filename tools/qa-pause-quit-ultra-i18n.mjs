/**
 * Tick166: after tick162 compact, *@320×200 still HARD quit/toTitle clip
 * while resume CTA clear. syncPausePanelBudget ultra actions compact
 * (gap2 / pad1 / btn 24×11px) must be present; tick162 / tip31/58 kept.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /Tick166: after tick162 compact/);
assert.match(main, /Tick166: tick162 compact still leaves quit unread/);
assert.match(main, /actions\.style\.gap = '2px'/);
assert.match(main, /actions\.style\.padding = '1px'/);
assert.match(main, /b\.style\.minHeight = '24px'/);
assert.match(main, /b\.style\.fontSize = '11px'/);
assert.match(main, /b\.style\.padding = '4px 6px'/);
// Prior tick162 ladder preserved.
assert.match(main, /Tick162: after tick142 fitH/);
assert.match(main, /quitChromeOverflow/);
assert.match(main, /actions\.style\.gap = '4px'/);
assert.match(main, /b\.style\.minHeight = '0'/);
assert.match(main, /Tick140: SE-class/);
assert.match(main, /is-pause-short/);
assert.match(css, /TICK166 .* pause ultra-short quit chrome deepen/);
assert.match(css, /TICK162 .* pause ultra-short quit chrome compact/);
assert.match(css, /\.is-pause-short .pause-stamp .brand-mark/);

console.log('qa-pause-quit-ultra-i18n: PASS');
