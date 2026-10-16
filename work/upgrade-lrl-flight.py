from pathlib import Path
p=Path('js/native-weapon-fx.js');s=p.read_text(encoding='utf-8');s=s.replace("lrl: '#ff5269',", "lrl: '#ff5269', 'lrl-flight': '#ff5877',")
s=s.replace("'lrl-axe', 'lrl-hit-cut'", "'lrl-axe', 'lrl-flight', 'lrl-hit-cut'",1)
a=s.index('function drawLrlFlight(');z=s.index('const HIT_SHEETS',a)
s=s[:a]+'''export function lrlFlightLayers(age) {
  // Each wave plays all sixteen authored cells once. Staggered waves bridge the
  // transparent end cells without freezing a crescent or jumping to frame zero.
  const interval = 0.20, duration = 0.56;
  const newest = Math.floor(age / interval);
  const layers = [];
  for (let index = Math.max(0, newest - 2); index <= newest; index++) {
    const elapsed = age - index * interval;
    if (elapsed < 0 || elapsed >= duration) continue;
    const progress = elapsed / duration;
    layers.push({ progress, frame: progress * 15,
      x: -progress * 26,
      rotation: -Math.PI / 2 - 0.58 + progress * 1.05,
      alpha: Math.min(1, elapsed / 0.04) * Math.min(1, (1-progress) / 0.22) });
  }
  return layers;
}
function drawLrlFlight(ctx, b) {
  const entry = textures.get('lrl-flight');
  if (!entry) return;
  const size = b.r * 3.65, scale = size / 363;
  const cw = entry.image.width / 4, ch = entry.image.height / 4;
  const stamp = (frame, alpha, original) => {
    const first = Math.floor(frame), mix = frame - first;
    for (let n = 0; n < 2; n++) {
      const index = Math.min(15, first + n), weight = n ? mix : 1 - mix;
      if (weight * alpha < 0.001) continue;
      ctx.save();ctx.globalAlpha *= alpha * weight;
      ctx.drawImage(original ? entry.image : entry.texture,
        index % 4 * cw, Math.floor(index / 4) * ch, cw, ch,
        -257 * scale, -273 * scale, cw * scale, ch * scale);
      ctx.restore();
    }
  };
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));
  ctx.globalCompositeOperation = 'lighter';
  for (const layer of lrlFlightLayers(b.age + 0.055)) {
    ctx.save();ctx.translate(layer.x,0);ctx.rotate(layer.rotation);
    // Warm outer blade, narrow white interior. Avoid bleaching the entire texture.
    stamp(layer.frame,layer.alpha * 0.8,false);
    ctx.scale(0.94,0.94);stamp(layer.frame,layer.alpha * 0.30,true);
    ctx.restore();
  }
  // Tiny authored fragments peel off the back with their own short lifetimes.
  for(let i=0;i<3;i++) {
    const life=((b.age*2.8+i/3)%1);
    ctx.save();ctx.translate(-12-life*(24+b.powerLevel*3),
      Math.sin(i*2.4+life*1.7)*(4+life*b.r*.65));
    ctx.rotate(-Math.PI/2+i*.9+life*1.6);
    lrlFrame(ctx,textures.get('lrl'),6+life*4,b.r*(1-life*.55),.42*(1-life));
    ctx.restore();
  }
  ctx.restore();
}

''' +s[z:];p.write_text(s,encoding='utf-8')
