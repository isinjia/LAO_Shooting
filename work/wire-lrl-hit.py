from pathlib import Path
p=Path('js/native-weapon-fx.js');s=p.read_text(encoding='utf-8')
s=s.replace("labiata: '#ff85e2', emily: '#8beaff'", "labiata: '#ff85e2', emily: '#8beaff', 'lrl-hit-cut': '#ff7d90', 'lrl-hit-sparks': '#ffc4b2'")
s=s.replace("'lrl-axe'].map", "'lrl-axe', 'lrl-hit-cut', 'lrl-hit-sparks'].map")
pos=s.index('/** Cosmetic snapshots')
s=s[:pos]+'''const HIT_SHEETS = {
  cut: { key: 'lrl-hit-cut', columns: 4, rows: 2, pivot: [256, 255], span: 479 },
  sparks: { key: 'lrl-hit-sparks', columns: 3, rows: 2, pivot: [253, 288], span: 358 },
};
function hitSheet(ctx, sheet, progress, size, alpha, original = false) {
  const entry = textures.get(sheet.key);
  if (!entry || progress >= 1) return;
  const cw = entry.image.width / sheet.columns, ch = entry.image.height / sheet.rows;
  const frame = Math.min(sheet.columns * sheet.rows - 1, progress * (sheet.columns * sheet.rows - 1));
  const first = Math.floor(frame), mix = frame - first;
  for (let n = 0; n < 2; n++) {
    const index = Math.min(sheet.columns * sheet.rows - 1, first + n);
    const weight = n ? mix : 1 - mix;
    if (weight < 0.001) continue;
    const scale = size / sheet.span;
    ctx.save(); ctx.globalAlpha *= alpha * weight;
    ctx.drawImage(original ? entry.image : entry.texture,
      index % sheet.columns * cw, Math.floor(index / sheet.columns) * ch, cw, ch,
      -sheet.pivot[0] * scale, -sheet.pivot[1] * scale, cw * scale, ch * scale);
    ctx.restore();
  }
}
function drawLrlImpact(ctx, fx) {
  const t = fx.age / fx.duration;
  const size = 40 + Math.min(42, fx.r) * 2.4;
  ctx.save(); ctx.translate(fx.x, fx.y);
  ctx.globalCompositeOperation = 'lighter';
  // A short diagonal cut stays at the contact point. It never travels like a shot.
  ctx.rotate(fx.angle - Math.PI * 0.28);
  hitSheet(ctx, HIT_SHEETS.cut, t, size, 0.95);
  hitSheet(ctx, HIT_SHEETS.cut, t, size * 0.92, 0.85, true);
  if (fx.heavy && t > 0.08) {
    ctx.rotate(Math.PI * 0.56);
    hitSheet(ctx, HIT_SHEETS.cut, (t - 0.08) / 0.92, size * 0.75, 0.65);
  }
  ctx.restore();
  ctx.save(); ctx.translate(fx.x, fx.y);
  ctx.globalCompositeOperation = 'lighter';
  hitSheet(ctx, HIT_SHEETS.sparks, t, size * 0.42, 0.72 * (1 - t));
  ctx.restore();
}

''' +s[pos:]
s=s.replace("    if (b.nativeKey !== 'lrl') return;", "    if (b.nativeKey !== 'lrl' && b.nativeKey !== 'lrl-axe') return;\n    if (b.nativeKey === 'lrl-axe' && kind !== 'impact') return;")
s=s.replace("angle: Math.atan2(b.vy, b.vx), age: 0, kind,\n      duration: kind === 'launch' ? 0.34 : LRL_CLIP.duration", "angle: Math.atan2(b.vy, b.vx), age: 0, kind, heavy: b.nativeKey === 'lrl-axe',\n      duration: kind === 'launch' ? 0.34 : b.nativeKey === 'lrl-axe' ? 0.32 : 0.26")
s=s.replace("      const t = fx.age / fx.duration;\n      const hit = fx.kind === 'impact';", "      if (fx.kind === 'impact') { drawLrlImpact(ctx, fx); continue; }\n      const t = fx.age / fx.duration;")
s=s.replace("ctx.translate(fx.x + t * (hit ? 12 : 6), fx.y)","ctx.translate(fx.x + t * 6, fx.y)").replace("(hit ? -0.18 : 0.12)","0.12").replace("fx.r * (hit ? 4.8 : 3.5)","fx.r * 3.5").replace("hit ? 1 : 0.65","0.65").replace("hit ? 0.65 : 0.3","0.3")
p.write_text(s,encoding='utf-8')
p=Path('js/projectile-vfx.js');s=p.read_text(encoding='utf-8');s=s.replace("  impact(b) {\n", "  impact(b) {\n    // LRL uses its dedicated cut/contact sheet, including thrown-axe hits.\n    if (b.nativeKey === 'lrl' || b.nativeKey === 'lrl-axe') return;\n",1);p.write_text(s,encoding='utf-8')
p=Path('tools/test-native-animation.mjs');s=p.read_text();s=s.replace('pool.update(.35,1600,900);','pool.update(.28,1600,900);').replace("'Launch ends before impact tail'","'Brief hit ends before launch tail'");p.write_text(s)
