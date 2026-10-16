/**
 * Tick47: HUD SCORE/HI/stage-meta NewUI residual — score + meta plates
 * Box2 + cyan rim/inset/chamfer, SCORE brass dual-stroke, HI quieter
 * dual-stroke, STAGE/GRAZE/COMBO/AUDIO lbl dual-stroke.
 * Keep combo is-hot / mute; hud-top sparse.
 * Stocks / CHARGE / SP / boss / power / HOLD dens not churned.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

// Tick47 score/meta block present.
assert.match(css, /TICK47 — HUD SCORE\/HI\/stage-meta NewUI residual/);

const tick47Idx = css.indexOf('TICK47 — HUD SCORE/HI/stage-meta NewUI residual');
assert.ok(tick47Idx >= 0, 'TICK47 score/meta marker present');
// Slice ends at next CSS tick marker (TICK58 pause tip) — not TICK48 (VFX-only era).
const tick47End = css.indexOf('/* ========== TICK58', tick47Idx);
const tick47 = css.slice(tick47Idx, tick47End > tick47Idx ? tick47End : undefined);
assert.ok(tick47.length > 200, 'TICK47 score/meta block present');
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);

// Score plate Box2 + cyan rim / inset / chamfer.
assert.match(tick47, /\.lao-newui \.hud-scores\s*\{/);
assert.match(tick47, /newui_Popup_Bg_Box2\.png/);
assert.match(tick47, /rgba\(0,\s*232,\s*200,\s*0\.42\)/);
assert.match(tick47, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.34\)/);
assert.match(tick47, /clip-path:\s*polygon\(4px 0/);

// SCORE brass dominance + dual-stroke val.
assert.match(tick47, /\.hud-stat-score \.hud-lbl\s*\{/);
assert.match(tick47, /#ffe08a/);
assert.match(tick47, /0 0 1px #000/);
assert.match(tick47, /font-weight:\s*800/);
assert.match(tick47, /\.hud-stat-score \.hud-val\s*\{/);

// HI quieter dual-stroke.
assert.match(tick47, /\.hud-stat-hi \.hud-lbl\s*\{/);
assert.match(tick47, /\.hud-stat-hi \.hud-val\s*\{/);
assert.match(tick47, /#c8e8e0/);

// Meta plate Box2 + stage-label dual-stroke.
assert.match(tick47, /\.lao-newui \.hud-meta\s*\{/);
assert.equal(
  (tick47.match(/newui_Popup_Bg_Box2\.png/g) || []).length,
  2,
  'Box2 on scores + meta',
);
assert.match(tick47, /\.hud-meta \.hud-lbl\s*\{/);
assert.match(tick47, /\.hud-meta \.hud-val\s*\{/);

// Combo hot / mute cues retained in this tick.
assert.match(tick47, /#combo-val\.is-hot/);
assert.match(tick47, /#mute-flag\.is-muted/);

// Combat HUD sparse — no Top_Bg on hud-top / this tick.
assert.match(tick47, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.ok(!/newui_Top_Bg\.png/.test(tick47), 'no Top_Bg on score/meta tick');

// Markup + wiring retained.
assert.match(html, /class="hud-cluster hud-scores"/);
assert.match(html, /class="hud-stat hud-stat-score"/);
assert.match(html, /id="score"/);
assert.match(html, /class="hud-stat hud-stat-hi"/);
assert.match(html, /id="hi-score"/);
assert.match(html, /class="hud-cluster hud-meta"/);
assert.match(html, /id="stage-num"/);
assert.match(html, /id="graze"/);
assert.match(html, /id="combo-val"/);
assert.match(html, /id="mute-flag"/);
assert.match(html, /id="pause-flag"/);
assert.match(game, /is-hot/);
assert.match(game, /hud-audio/);

// Prior markers retained; stocks / CHARGE / SP / boss / power / HOLD not churned.
assert.match(css, /TICK46 — SP gauge NewUI residual/);
assert.match(css, /TICK45 — HUD LIFE\/BOMB\/CHARGE cluster NewUI residual/);
assert.match(css, /TICK44 — boss HP bar NewUI residual/);
assert.match(css, /TICK39 — HUD power-badge NewUI residual/);
assert.match(css, /TICK31 — pause overlay NewUI residual/);
assert.ok(!/HOLD dens/.test(tick47) || /untouched/.test(tick47),
  'HOLD dens not churned');
assert.ok(!/hud-stocks|lives-pips|bombs-pips/.test(tick47) || /untouched/.test(tick47),
  'stocks not churned');
assert.ok(!/#charge-track/.test(tick47) || /untouched/.test(tick47),
  'CHARGE not churned');
assert.ok(!/#sp-track/.test(tick47) || /untouched/.test(tick47),
  'SP not churned');
assert.ok(!/boss-frame|boss-hp-track|boss-tag/.test(tick47) || /untouched/.test(tick47),
  'boss HP not churned');
assert.ok(!/\.power-badge/.test(tick47) || /untouched/.test(tick47),
  'power-badge not churned');
assert.ok(!/screen-pause|pause-blurb/.test(tick47) || /untouched/.test(tick47),
  'pause overlay tip not churned');

console.log(
  'PASS qa-hud-score-meta:',
  'scores+meta Box2 cyan rim/inset/chamfer',
  'SCORE brass + HI dual-stroke',
  'STAGE/meta lbl dual-stroke',
  'combo/mute kept',
  'hud-top sparse',
  'stocks/CHARGE/SP/boss/power/HOLD untouched',
);
