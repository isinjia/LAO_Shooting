/**
 * Tick162: after tick142 fitH, *@400×240·280 still HARD quit/toTitle clip
 * while resume CTA clear / panelOver=0. syncPausePanelBudget actions
 * compact must clear quitOut across ko/en/ru/pt/es/zh-Hant/ja.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

assert.match(main, /Tick162: after tick142 fitH/);
assert.match(main, /quitChromeOverflow/);
assert.match(main, /#btn-quit/);
assert.match(main, /ctaBtn\.style\.minWidth = '0'/);
assert.match(main, /b\.style\.minHeight = '0'/);
assert.match(main, /actions\.style\.gap = '4px'/);
// Clear path restores btn chrome between remounts.
assert.match(main, /actions\.style\.gap = ''/);
assert.match(main, /b\.style\.minWidth = ''/);
// Prior pause ladder preserved.
assert.match(main, /Tick140: SE-class/);
assert.match(main, /Tick142: same fitH floor/);
assert.match(main, /is-pause-short/);
assert.match(css, /TICK162 .* pause ultra-short quit chrome compact/);
assert.match(css, /\.is-pause-short .pause-stamp .brand-mark/);

console.log('qa-pause-quit-chrome-i18n: PASS');
