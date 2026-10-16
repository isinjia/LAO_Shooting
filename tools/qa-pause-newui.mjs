/**
 * Tick31 + Tick58: pause overlay NewUI residual —
 * menubg+world2 wash, Box2 blurb/actions plates, brand Activation cue,
 * tip densify (blurb dual-stroke + cyan inset, h2 dual-stroke,
 * actions inset rail, pause-chip Activation; is-on wiring kept).
 * Combat HUD stays sparse; no fake lobby destinations; CONTROLS untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const main = readFileSync(join(root, 'js/main.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Tick31 pause block present.
assert.match(css, /TICK31 — pause overlay NewUI residual/);

const tick31Idx = css.indexOf('TICK31 — pause overlay NewUI residual');
assert.ok(tick31Idx >= 0, 'TICK31 pause marker present');
const tick31End = css.indexOf('/* ========== TICK32', tick31Idx);
const tick31 = css.slice(tick31Idx, tick31End > tick31Idx ? tick31End : undefined);
assert.ok(tick31.length > 200, 'TICK31 pause block present');

// menubg + world2 layered wash on screen-pause.
assert.match(tick31, /#overlay-content\.screen-pause\s*\{/);
assert.match(tick31, /btn_newui_menubg\.png/);
assert.match(tick31, /btn_newui_world2\.png/);
assert.match(tick31, /background-blend-mode:\s*normal,\s*soft-light,\s*overlay/);

// Box2 plates on blurb + actions (chamfer clip, no geometry marks).
assert.match(tick31, /\.pause-blurb\s*\{/);
assert.match(tick31, /\.pause-actions\s*\{/);
assert.equal(
  (tick31.match(/newui_Popup_Bg_Box2\.png/g) || []).length,
  2,
  'Box2 on blurb + actions',
);
assert.match(tick31, /clip-path:\s*polygon\(8px 0/);

// Brand Activation + Title_Deco2 cue.
assert.match(tick31, /\.pause-stamp \.brand-mark/);
assert.match(tick31, /newui_Btn_Activation\.png/);
assert.match(tick31, /newui_Popup_Bg_Title_Deco2\.png/);

// Tick58 tip densify block (bounded before TICK60 SP status ready-line).
assert.match(css, /TICK58 — pause overlay NewUI tip residual/);
const tick58Idx = css.indexOf('TICK58 — pause overlay NewUI tip residual');
assert.ok(tick58Idx >= 0, 'TICK58 pause tip marker present');
const tick58End = css.indexOf('/* ========== TICK60', tick58Idx);
const tick58 = css.slice(tick58Idx, tick58End > tick58Idx ? tick58End : undefined);
assert.ok(tick58.length > 200, 'TICK58 pause tip block present');
assert.match(css, /TICK60 — SP status ready-line NewUI tip residual/);

// Blurb dual-stroke + cyan inset tip densify (tutorial-note parity).
assert.match(tick58, /\.pause-blurb\s*\{/);
assert.match(tick58, /inset 3px 0 0 rgba\(0,\s*232,\s*200/);
assert.match(tick58, /text-shadow:\s*[\s\S]*?0 0 1px #000/);
assert.match(tick58, /color:\s*#d8e8e4/);

// pause-stamp h2 dual-stroke (keep brass glow language).
assert.match(tick58, /\.pause-stamp h2\s*\{/);
assert.match(tick58, /1px 0 0 rgba\(0,\s*0,\s*0,\s*0\.75\)/);

// pause-actions inset rail densify (Box2 plate retained from tick31).
assert.match(tick58, /\.pause-actions\s*\{/);
assert.match(tick58, /inset 3px 0 0 rgba\(0,\s*232,\s*200,\s*0\.34\)/);

// pause-chip Activation densify — is-on wiring retained.
assert.match(tick58, /\.lao-newui \.pause-chip\s*\{/);
assert.match(tick58, /newui_Btn_Activation\.png/);
assert.match(css, /\.pause-chip\.is-on\s*\{/);
assert.match(html, /id="pause-flag"[^>]*class="pause-chip"/);

// HOLD dens / SCORE meta / explosion not churned this tip.
assert.ok(!/HOLD dens/.test(tick58) || /untouched/.test(tick58),
  'HOLD dens not churned');
assert.ok(!/hud-scores|hud-stat-score|#sp-track/.test(tick58) || /untouched/.test(tick58),
  'SCORE/SP not churned');
assert.ok(!/wipeSpark|hitSpark|explosion/.test(tick58) || /untouched/.test(tick58),
  'soft-blob VFX not churned');

// Retained from earlier ticks: pause-deco Title_Deco1 + panel-frame Top_Bg rails.
assert.match(css, /\.lao-newui \.pause-deco\s*\{/);
assert.match(css, /newui_Popup_Bg_Title_Deco1\.png/);
assert.match(
  css,
  /#overlay-content\.screen-pause > \.panel-frame[\s\S]{0,180}?newui_Top_Bg\.png/,
);

// Combat HUD sparse — never Top_Bg full fill on hud-top.
assert.match(css, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);

// Pause menu markup: no fake lobby destinations / rails.
const pauseFn = main.match(/function showPauseMenu\(\)[\s\S]*?\n\}/)?.[0] || '';
assert.ok(pauseFn.includes('screen-pause'), 'showPauseMenu present');
assert.ok(pauseFn.includes('pause-deco'), 'pause-deco retained');
assert.ok(pauseFn.includes('pause-actions'), 'pause-actions retained');
assert.ok(pauseFn.includes('pause-blurb'), 'pause-blurb retained');
assert.ok(!/lobby-rail|lobby-status|lobby-resource|lobby-foot/.test(pauseFn),
  'pause has no fake lobby destinations');

// Title CONTROLS scroll-only keys-grid retained (untouched this tick).
assert.match(css, /#overlay-content\.screen-title \.keys-grid/);
assert.match(css, /Scroll only \.keys-grid/);

console.log(
  'PASS qa-pause-newui:',
  'menubg+world2',
  'Box2 blurb+actions',
  'brand Activation+Deco2',
  'tick58 blurb dual-stroke+inset',
  'h2 dual-stroke',
  'actions inset',
  'pause-chip Activation',
  'is-on kept',
  'pause-deco+Top_Bg retained',
  'hud-top sparse',
  'no fake lobby',
  'CONTROLS scroll kept',
);
