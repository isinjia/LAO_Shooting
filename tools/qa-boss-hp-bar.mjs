/**
 * Tick44: boss HP bar NewUI residual — frame Box2 + rose rim/inset/chamfer,
 * tag Activation plate, name/pct dual-stroke, track Box2 + Tap1 end cue.
 * Keep midboss-frame-pulse + critical pulse; hud-top sparse.
 * Asset-error / rotate / power-badge / HOLD dens not churned.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const game = readFileSync(join(root, 'js/game.js'), 'utf8');

// Tick44 boss HP block present.
assert.match(css, /TICK44 — boss HP bar NewUI residual/);

const tick44Idx = css.indexOf('TICK44 — boss HP bar NewUI residual');
assert.ok(tick44Idx >= 0, 'TICK44 boss HP marker present');
const tick44End = css.indexOf('/* ========== TICK45', tick44Idx);
const tick44 = css.slice(tick44Idx, tick44End > tick44Idx ? tick44End : undefined);
assert.ok(tick44.length > 200, 'TICK44 boss HP block present');

// Frame Box2 + rose rim / inset / chamfer.
assert.match(tick44, /\.lao-newui \.boss-frame\s*\{/);
assert.match(tick44, /newui_Popup_Bg_Box2\.png/);
assert.match(tick44, /rgba\(232,\s*96,\s*110,\s*0\.55\)/);
assert.match(tick44, /inset 3px 0 0 rgba\(232,\s*96,\s*110,\s*0\.38\)/);
assert.match(tick44, /clip-path:\s*polygon\(5px 0/);

// Tag Activation plate + phase-hot.
assert.match(tick44, /\.lao-newui #boss-tag\s*\{/);
assert.match(tick44, /newui_Btn_Activation\.png/);
assert.match(tick44, /#boss-tag\.phase-hot/);

// Name / pct dual-stroke readability.
assert.match(tick44, /\.lao-newui #boss-name\s*\{/);
assert.match(tick44, /0 0 1px #000/);
assert.match(tick44, /\.lao-newui #boss-hp-pct\s*\{/);
assert.match(tick44, /font-weight:\s*800/);

// Track Box2 + Tap1 end cue (charge/load parity).
assert.match(tick44, /\.lao-newui #boss-hp-track\s*\{/);
assert.match(tick44, /#boss-hp-track::after/);
assert.match(tick44, /newui_Btn_Tap1\.png/);
assert.match(tick44, /opacity:\s*0\.3/);

// Midboss densify + midboss-frame-pulse retained.
assert.match(tick44, /#boss-bar\.is-mid \.boss-frame/);
assert.match(tick44, /animation:\s*midboss-frame-pulse/);
assert.match(css, /@keyframes midboss-frame-pulse/);
assert.match(tick44, /rgba\(212,\s*162,\s*74/);

// Critical fill pulse retained.
assert.match(tick44, /#boss-bar\.is-critical #boss-hp-fill/);
assert.match(tick44, /animation:\s*life-critical-pulse/);
assert.match(css, /@keyframes life-critical-pulse/);

// Combat HUD sparse — no Top_Bg on hud-top / this tick.
assert.match(tick44, /\.lao-newui \.hud-top\s*\{\s*background-image:\s*none;/);
assert.ok(!/newui_Top_Bg\.png/.test(tick44), 'no Top_Bg on boss HP tick');

// Markup + HUD wiring retained.
assert.match(html, /id="boss-bar"/);
assert.match(html, /class="boss-frame"/);
assert.match(html, /id="boss-tag"/);
assert.match(html, /id="boss-name"/);
assert.match(html, /id="boss-hp-pct"/);
assert.match(html, /id="boss-hp-track"/);
assert.match(html, /id="boss-hp-fill"/);
assert.match(html, /class="boss-hp-ticks"/);
assert.match(game, /bossBar: id\('boss-bar'\)/);
assert.match(game, /classList\.toggle\('is-mid'/);
assert.match(game, /classList\.toggle\('is-critical'/);
assert.match(game, /phase-hot/);

// Prior markers retained; asset-error / rotate / power-badge / HOLD not churned.
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
assert.ok(!/HOLD dens/.test(tick44) || /untouched/.test(tick44),
  'HOLD dens not churned');
assert.ok(!/screen-asset-error|asset-error-msg/.test(tick44) || /untouched/.test(tick44),
  'asset-error not churned');
assert.ok(!/rotate-hint|rotate-card/.test(tick44) || /untouched/.test(tick44),
  'rotate overlay not churned');
assert.ok(!/\.power-badge/.test(tick44) || /untouched/.test(tick44),
  'power-badge not churned');

console.log(
  'PASS qa-boss-hp-bar:',
  'frame Box2 rose rim/inset',
  'tag Activation',
  'name/pct dual-stroke',
  'track Box2+Tap1',
  'midboss-frame-pulse kept',
  'critical pulse kept',
  'hud-top sparse',
  'asset-error/rotate/HOLD untouched',
);
