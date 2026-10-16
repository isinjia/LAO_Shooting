from pathlib import Path
p=Path('js/native-weapon-fx.js');s=p.read_text(encoding='utf-8');at=s.index('export function drawNativeWeapon')
s=s[:at]+'''// Unity sheet: 4 x 3 cells, including the two transparent terminal cells.
// A single pivot/scale preserves the authored thinning and drifting of the slash.
export const LRL_CLIP = Object.freeze({ columns: 4, rows: 3, count: 12,
  pivotX: 245, pivotY: 315, referenceWidth: 300, duration: 0.46 });

export function sampleLrlClip(progress) {
  const frame = Math.max(0, Math.min(11, progress * 11));
  const first = Math.floor(frame);
  return { first, second: Math.min(11, first + 1), mix: frame - first };
}

function lrlCell(ctx, entry, index, size, alpha, original = false) {
  if (alpha <= 0.001) return;
  const cw = entry.image.width / 4, ch = entry.image.height / 3;
  const scale = size / LRL_CLIP.referenceWidth;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(original ? entry.image : entry.texture,
    (index % 4) * cw, Math.floor(index / 4) * ch, cw, ch,
    -LRL_CLIP.pivotX * scale, -LRL_CLIP.pivotY * scale, cw * scale, ch * scale);
  ctx.restore();
}

function lrlFrame(ctx, entry, frame, size, alpha = 1, original = false) {
  const { first, second, mix } = sampleLrlClip(frame / 11);
  // Additive interpolation avoids dark seams between translucent animation cells.
  lrlCell(ctx, entry, first, size, alpha * (1 - mix), original);
  lrlCell(ctx, entry, second, size, alpha * mix, original);
}

function drawLrlFlight(ctx, b, entry) {
  const angle = Math.atan2(b.vy, b.vx);
  const size = b.r * 3.35;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  // Detached strips decay through the full source sequence behind the live edge.
  for (let i = 3; i >= 1; i--) {
    const lag = i * 0.035;
    if (b.age < lag) continue;
    ctx.save(); ctx.translate(-i * (8 + b.powerLevel * 1.5), 0);
    ctx.rotate(-Math.PI / 2 - i * 0.055);
    lrlFrame(ctx, entry, 4 + i * 1.6 + Math.sin(b.age * 15) * 0.35,
      size * (1 - i * 0.035), 0.25 / i);
    ctx.restore();
  }
  // Sustain only the readable edge while its collision remains active. No blank
  // frames on a damaging projectile, and no hard wrap from frame 5 back to 0.
  const phase = (1 - Math.cos(b.age * 15)) * 1.5;
  ctx.rotate(-Math.PI / 2 + Math.sin(b.age * 12) * 0.07);
  const birth = 0.82 + 0.18 * Math.min(1, b.age / 0.045);
  lrlFrame(ctx, entry, phase, size * birth, 0.88);
  lrlFrame(ctx, entry, phase, size * birth, 0.60, true);
  ctx.restore();
}

/** Cosmetic snapshots survive bullet recycling; bounded and advanced by sim time. */
export class NativeShotEffects {
  constructor() { this.list = []; }
  emit(b, kind = 'launch', point = b) {
    if (b.nativeKey !== 'lrl') return;
    if (this.list.length >= 48) this.list.shift();
    this.list.push({ x: point.x, y: point.y, r: b.r,
      angle: Math.atan2(b.vy, b.vx), age: 0, kind,
      duration: kind === 'launch' ? 0.34 : LRL_CLIP.duration });
  }
  update(dt) {
    let n = 0;
    for (const fx of this.list) {
      fx.age += dt;
      if (fx.age < fx.duration) this.list[n++] = fx;
    }
    this.list.length = n;
  }
  clear() { this.list.length = 0; }
  draw(ctx) {
    const entry = textures.get('lrl');
    if (!entry) return;
    for (const fx of this.list) {
      const t = fx.age / fx.duration;
      const hit = fx.kind === 'impact';
      ctx.save(); ctx.translate(fx.x + t * (hit ? 12 : 6), fx.y);
      ctx.rotate(fx.angle - Math.PI / 2 + (hit ? -0.18 : 0.12));
      ctx.globalCompositeOperation = 'lighter';
      const size = fx.r * (hit ? 4.8 : 3.5) * (1 + 0.22 * t);
      lrlFrame(ctx, entry, t * 11, size, hit ? 1 : 0.65);
      lrlFrame(ctx, entry, t * 11, size, hit ? 0.65 : 0.3, true);
      ctx.restore();
    }
  }
}

''' +s[at:]
s=s.replace("  const key = b.nativeKey, r = b.r, power = b.powerLevel || 1;", "  if (b.nativeKey === 'lrl') { drawLrlFlight(ctx, b, entry); return true; }\n  const key = b.nativeKey, r = b.r, power = b.powerLevel || 1;")
a=s.index("    case 'lrl':");z=s.index("    case 'merlin':",a);s=s[:a]+s[z:];p.write_text(s,encoding='utf-8')
p=Path('js/bullet.js');s=p.read_text(encoding='utf-8');s="import { NativeShotEffects } from './native-weapon-fx.js';\n"+s
s=s.replace('    this.targets = [];','    this.targets = [];\n    this.nativeEffects = new NativeShotEffects();',1)
s=s.replace('    this.list.push(b);\n    return b;','    this.list.push(b);\n    this.nativeEffects.emit(b);\n    return b;',1)
s=s.replace('  update(dt, w, h) {\n','  update(dt, w, h) {\n    this.nativeEffects.update(dt);\n',1)
s=s.replace('  draw(ctx, gpuFriendly = false) {','  draw(ctx, gpuFriendly = false) {\n    this.nativeEffects.draw(ctx);',1)
s=s.replace('  clearAll() {','  clearAll() {\n    this.nativeEffects.clear();',1)
p.write_text(s,encoding='utf-8')
p=Path('js/game.js');s=p.read_text(encoding='utf-8');needle='this.projectileVfx.impact(b);';s=s.replace(needle,"this.bullets.nativeEffects?.emit(b, 'impact', e);\n              "+needle);p.write_text(s,encoding='utf-8')
