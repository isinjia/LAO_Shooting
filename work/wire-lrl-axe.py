from pathlib import Path
p=Path('js/native-weapon-fx.js');s=p.read_text(encoding='utf-8');s=s.replace("Object.keys(NATIVE_SHOT_FRAMES).map(async (key)","[...Object.keys(NATIVE_SHOT_FRAMES), 'lrl-axe'].map(async (key)")
pos=s.index('export function drawNativeWeapon')
s=s[:pos]+'''function drawLrlAxe(ctx, b, entry) {
  // Opaque original weapon art owns the silhouette, never an additive light blob.
  const width = b.r * 3.2;
  const height = width * entry.image.height / entry.image.width;
  const angle = -Math.PI / 4 + b.age * 11;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.globalCompositeOperation = 'source-over';
  const stamp = (rotation, alpha) => {
    ctx.save(); ctx.rotate(rotation); ctx.globalAlpha *= alpha;
    ctx.drawImage(entry.image, -width / 2, -height / 2, width, height);
    ctx.restore();
  };
  // Two quiet rotational echoes; solid blade and handle remain dominant.
  if (b.age > 0.06) stamp(angle - 0.65, 0.08);
  if (b.age > 0.03) stamp(angle - 0.32, 0.14);
  ctx.shadowColor = 'rgba(8, 3, 10, 0.85)'; ctx.shadowBlur = 2;
  stamp(angle, 1);
  ctx.restore();
}

''' + s[pos:]
s=s.replace("  if (b.nativeKey === 'lrl')", "  if (b.nativeKey === 'lrl-axe') { drawLrlAxe(ctx, b, entry); return true; }\n  if (b.nativeKey === 'lrl')",1)
p.write_text(s,encoding='utf-8')
p=Path('js/weapon-skills.js');s=p.read_text(encoding='utf-8');s=s.replace("style: 'dragonaxe',", "style: 'dragonaxe', nativeKey: 'lrl-axe', powerLevel: lv,",1);p.write_text(s,encoding='utf-8')
