/**
 * Tick45: HUD LIFE/BOMB/CHARGE cluster NewUI residual — stock Box2 +
 * cyan rim/inset/chamfer, LIFE/BOMB lbl dual-stroke, pip densify,
 * CHARGE track cyan rim/inset/chamfer + Tap1 + ready Activation cue.
 * Keep life-critical / extend / deathbomb pulses; hud-top sparse.
 * Boss HP / power-badge / asset-error / rotate / HOLD dens not churned.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Tick45 stock/charge cluster block present.
assert.match(css, /TICK45 — HUD LIFE\/BOMB\/CHARGE cluster NewUI residual/);

const tick45Idx = css.indexOf('TICK45 — HUD LIFE/BOMB/CHARGE cluster NewUI residual');
assert.ok(tick45Idx >= 0, 'TICK45 stock cluster marker present');
const tick45End = css.indexOf('/* ========== TICK46', tick45Idx);
const tick45 = css.slice(tick45Idx, tick45End > tick45Idx ? tick45End : undefined);
assert.ok(tick45.length > 200, 'TICK45 stock cluster block present');

// Stock plate Box2 + cyan rim / inset / chamfer.
assert.match(tick45, /\.lao-newui \.hud-stocks\s*\{/);
assert.match(tick45, /newui_Popup_Bg_Box2\.png/);
assert.match(tick45, /rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick45, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.34\)/);
assert.match(tick45, /clip-path:\s*polygon\(4px 0/);

// LIFE/BOMB labels dual-stroke + vals.
assert.match(tick45, /\.hud-stocks \.hud-lbl\s*\{/);
assert.match(tick45, /0 0 1px #000/);
assert.match(tick45, /font-weight:\s*800/);
assert.match(tick45, /\.hud-stocks \.hud-val-sm\s*\{/);

// Pip densify (life skew + bomb oval kept).
assert.match(tick45, /#lives-pips \.pip\.on/);
assert.match(tick45, /\.pip-bomb \.pip\.on/);
assert.match(tick45, /var\(--accent\)/);

// Critical / extend / deathbomb pulses retained.
assert.match(tick45, /#life-stock\.is-critical #lives-pips \.pip\.on/);
assert.match(tick45, /animation:\s*life-critical-pulse/);
assert.match(tick45, /#life-stock\.is-extend #lives-pips \.pip\.on/);
assert.match(tick45, /#bomb-stock\.is-deathbomb #bombs-pips \.pip\.on/);
assert.match(css, /@keyframes life-critical-pulse/);

// life-warn Activation plate.
assert.match(tick45, /\.life-warn-chip/);
assert.match(tick45, /newui_Btn_Activation\.png/);

// CHARGE track residual — cyan rim/inset/chamfer + Tap1 + ready cue.
assert.match(tick45, /\.lao-newui #charge-track\s*\{/);
assert.match(tick45, /inset 2px 0 0 rgba\(0,\s*232,\s*200,\s*0\.36\)/);
assert.match(tick45, /clip-path:\s*polygon\(3px 0/);
assert.match(tick45, /#charge-track::after/);
assert.match(tick45, /newui_Btn_Tap1\.png/);
assert.match(tick45, /#charge-row \.sp-label/);
assert.match(tick45, /#charge-track\.ready/);
assert.match(tick45, /rgba\(255,\s*210,\s*120/);

// Combat HUD sparse — no Top_Bg on hud-top / this tick.
assert.match(tick45, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.ok(!/newui_Top_Bg\.png/.test(tick45), 'no Top_Bg on stock cluster tick');

// Markup retained.
assert.match(html, /class="hud-cluster hud-stocks"/);
assert.match(html, /id="life-stock"/);
assert.match(html, /id="lives-pips"/);
assert.match(html, /id="bomb-stock"/);
assert.match(html, /id="bombs-pips"/);
assert.match(html, /id="life-warn"/);
assert.match(html, /id="charge-row"/);
assert.match(html, /id="charge-track"/);
assert.match(html, /id="charge-fill"/);
assert.match(html, /class="power-badge"/);

// Prior markers retained; boss HP / power-badge / asset-error / rotate / HOLD not churned.
assert.match(css, /TICK44 — boss HP bar NewUI residual/);
assert.match(css, /TICK43 — asset-error overlay NewUI residual/);
assert.match(css, /TICK42 — portrait-rotate overlay NewUI residual/);
assert.match(css, /TICK41 — tutorial NewUI residual/);
assert.match(css, /TICK40 — title lobby NewUI residual/);
assert.match(css, /TICK39 — HUD power-badge NewUI residual/);
assert.match(css, /TICK38 — result screen NewUI residual/);
assert.match(css, /TICK37 — select dossier NewUI residual/);
assert.match(css, /TICK36 — touch-pad label clarity/);
assert.match(css, /TICK35 — OPTIONS NewUI residual/);
assert.match(css, /TICK34 — loading bar NewUI residual/);
assert.match(css, /TICK32 — title CONTROLS NewUI leftover/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/HOLD dens/.test(tick45) || /untouched/.test(tick45),
  'HOLD dens not churned');
assert.ok(!/boss-frame|boss-hp-track|boss-tag/.test(tick45) || /untouched/.test(tick45),
  'boss HP not churned');
assert.ok(!/\.power-badge/.test(tick45) || /untouched/.test(tick45),
  'power-badge not churned');
assert.ok(!/screen-asset-error|asset-error-msg/.test(tick45) || /untouched/.test(tick45),
  'asset-error not churned');
assert.ok(!/rotate-hint|rotate-card/.test(tick45) || /untouched/.test(tick45),
  'rotate overlay not churned');

// Tick97 pulse-lbl tip densify retained; tick45 structure not churned.
assert.match(css, /TICK97 — HUD stock pulse lbl NewUI tip residual/);
const tick97Idx = css.indexOf('TICK97 — HUD stock pulse lbl NewUI tip residual');
assert.ok(tick97Idx >= 0, 'TICK97 stock pulse tip marker present');
const tick97 = css.slice(tick97Idx);
assert.match(tick97, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.85\)/);
assert.ok(!/newui_Popup_Bg_Box2\.png/.test(tick97), 'tick97 typography only — no Box2 churn');

console.log(
  'PASS qa-hud-stock-cluster:',
  'stocks Box2 cyan rim/inset',
  'lbl dual-stroke + pip densify',
  'critical/extend/deathbomb kept',
  'charge rim/Tap1/ready',
  'hud-top sparse',
  'boss/power/HOLD untouched',
  'tick97 pulse lbl tip densify',
);
