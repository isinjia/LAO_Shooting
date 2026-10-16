// Visual adaptations of Last Origin skills; damage/stock/invulnerability stay in Game/Player.
// Sources and adaptation notes: tools/bomb-effects.md
import { W, H } from './canvas.js';
import { prefersLightFx } from './mobile.js';
import { t } from './i18n.js';

/** Banner text = the original skill-2 name, localized (i18n bomb.*); profile.label is the fallback. */
function bombLabel(key) {
  const id = key === 'peregrinus_human' ? 'bomb.peregrinus_human' : key === 'peregrinus_bird' ? 'bomb.peregrinus' : `bomb.${key}`;
  const v = t(id);
  return v && v !== id ? v : BOMB_PROFILES[key]?.label || '';
}

export const BOMB_PROFILES = {
  griffin: { label: '핸드 미사일 · 폭격', color: '#ffc978', accent: '#ff6a2c', duration: 1.7 },
  sleipnir: { label: '제압 사격 · 돌격', color: '#ffbc73', accent: '#e81e2b', duration: 1.65 },
  express76: { label: '배송 왔습니다! · 특급 택배', color: '#ffd27a', accent: '#ff7a2c', duration: 1.75 },
  hirume: { label: '야타가라스 · 봉황 날개', color: '#ffd36b', accent: '#ff682c', duration: 1.65 },
  constantia: { label: '라이플 사격 · 발목 잡기', color: '#ffe0a0', accent: '#83e0ba', duration: 1.45 },
  lrl: { label: '사이클롭스 영원의 광선', color: '#ffb84b', accent: '#ff712b', duration: 1.65 },
  merlin: { label: '빅 건 · UNREP', color: '#ffbc73', accent: '#ff5868', duration: 1.85 },
  fafnir: { label: '흐로티 · 쇼크 앤 오', color: '#7ef5ff', accent: '#a68cff', duration: 1.65 },
  eternity: { label: '보모의 기관총 · 편히 잠드소서', color: '#d4c4ff', accent: '#7a5cff', duration: 1.5 },
  labiata: { label: '백화난만 · 백화제방', color: '#ff6ad5', accent: '#a855f7', duration: 1.65 },
  emily: { label: '레일건 사격 · 버스터 캐논', color: '#7ef0ff', accent: '#3aa0ff', duration: 1.7 },
  rampalion: { label: '헤븐 앤드 헬', color: '#ffc27a', accent: '#ff5a1f', duration: 1.7 },
  // Peregrinus human-form X (original Skil_2 giant beam; its FX are peregrinus-fx.js).
  peregrinus_human: { label: '페레그리누스 · 그린 빔', color: '#c8ffe9', accent: '#00ffa3', duration: 1.65 },
  peregrinus_bird: { label: '페레그리누스 · 다이브 스트라이크', color: '#c8ffe9', accent: '#00ffa3', duration: 1.65 },
};
const clamp = v => Math.max(0, Math.min(1, v));
const TAU = Math.PI * 2;

export class BombVfx {
  constructor() { this.casts = []; }
  trigger(player, enemies, time) {
    const key = player.hBomb ? (player.hBomb.cfg.endsBird ? 'peregrinus_human' : 'peregrinus_bird')
      : (BOMB_PROFILES[player.charKey] ? player.charKey : 'hirume');
    // Snapshot before damage removes enemies. Effects never retain enemy objects.
    // Prefer on-field targets without allocating a filtered intermediate array.
    const targets = [];
    for (let i = 0; i < enemies.length && targets.length < 10; i++) {
      const e = enemies[i];
      if (!e.alive || e.x < 0 || e.x > W || e.y < 0 || e.y > H) continue;
      targets.push({ x: e.x, y: e.y });
    }
    if (!targets.length) for (let i = 0; i < 6; i++) targets.push({ x: 370 + (i % 3) * 215, y: 150 + Math.floor(i / 3) * 240 });
    // Express's delivery FX stay anchored to her (box, buff lighting, eye bling).
    this.casts.push({ key, label: bombLabel(key), x: player.x + 22, y: player.y - 8, start: time, targets,
      owner: key === 'express76' ? player : null });
    // Keep newest three — drawLabel reads the tail; rare overflow so head-trim is fine.
    if (this.casts.length > 3) this.casts.splice(0, this.casts.length - 3);
  }
  prune(time) {
    // Swap-remove — avoid allocating a fresh casts array every GPU/canvas emit.
    let write = 0;
    const casts = this.casts;
    for (let i = 0; i < casts.length; i++) {
      const b = casts[i];
      if (time - b.start >= BOMB_PROFILES[b.key].duration) continue;
      casts[write++] = b;
    }
    casts.length = write;
  }
  clear() { this.casts.length = 0; }
  // LRL's Skill2 eye-star used to be drawn here; her bomb is now a run (lrl-skill.js).
  drawOriginalSkill2() {}
  drawGpu(vfx, time) {
    // Legacy emit used shader types 5–13 (rings / crosshairs / jagged beams).
    // Particle layer only ships soft types 0–4 — remap so bombs stay motes/streaks.
    const light = prefersLightFx();
    this.emit((x, y, angle, w, h, type, age, opacity, color) => {
      if (opacity <= 0.002 || w <= 0 || h <= 0) return;
      const put = (px, py, ang, pw, ph, t, ag, op, col) => {
        vfx.put(px, py, ang, pw, ph, t, ag, op, col);
      };
      // Expanding ring → soft mote necklace with size variance (not a geometric ellipse stroke).
      if (type === 6 || type === 8 || type === 9 || type === 11) {
        const rad = Math.max(w, h) * 0.38;
        put(x, y, 0, Math.max(8, rad * 0.16), Math.max(8, rad * 0.16), 3, age, opacity * 0.5, '#fffef4');
        put(x, y, 0, Math.max(12, rad * 0.28), Math.max(12, rad * 0.28), type === 11 ? 4 : 0, age, opacity * 0.3, color);
        // Grit quality: tip-forward stretch + fine chips (n / cast budget unchanged).
        const n = light ? (type === 9 ? 7 : 10) : (type === 9 ? 11 : 16);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + (age || 0) * (type === 11 ? 1.2 : 0.35) + (i % 3) * 0.07;
          const rMul = 0.86 + (i % 5) * 0.045 + (i % 2) * 0.03;
          const px = x + Math.cos(a) * rad * rMul;
          const py = y + Math.sin(a) * rad * rMul;
          const fine = i % 3 !== 0;
          const sz = (fine ? 2.6 : 3.8) + (i % 5) * (fine ? 1.6 : 2.4) + rad * 0.028 + (i % 7) * 0.35;
          const streak = i % 3 !== 0;
          const stretch = streak ? (1.62 + (i % 4) * 0.28) : 1;
          put(
            px, py, a,
            streak ? sz * stretch : sz,
            streak ? sz * (0.32 + (i % 3) * 0.035) : sz,
            streak ? 1 : (type === 11 || type === 8 ? 4 : 0),
            age,
            opacity * (0.42 + (i % 3) * 0.14),
            i % 4 === 0 ? '#fffef4' : color,
          );
          // Tip-forward white grit core on streaks — soft disk only.
          if (streak && i % 2 === 0) {
            put(px, py, a, sz * 0.55, sz * 0.22, 3, age, opacity * 0.38, '#fffef4');
          }
        }
        return;
      }
      // Beam / Fafnir arc → elongated streak + drip motes (never a zigzag polyline).
      if (type === 10 || type === 13) {
        put(x, y, angle, w, Math.max(3.5, h * 0.3), 1, age, opacity * 0.85, color);
        put(x, y, angle, w * 0.55, Math.max(2.5, h * 0.16), 3, age, opacity * 0.55, '#fffef4');
        const drips = light ? 6 : (type === 13 ? 12 : 8);
        for (let i = 1; i <= drips; i++) {
          const t = i / (drips + 1);
          const px = x + Math.cos(angle) * w * (t - 0.5) * 0.92;
          const py = y + Math.sin(angle) * w * (t - 0.5) * 0.92
            + Math.sin(i * 2.1 + (age || 0) * 12) * h * 0.12;
          const sz = 3.2 + h * 0.06 + (i % 3) * 2.6 + (i % 5) * 0.4;
          const stretch = 1.55 + (i % 2) * 0.32;
          put(px, py, angle, sz * stretch, sz * 0.34, type === 13 ? 4 : 1, age + t, opacity * (0.48 + t * 0.22),
            i % 3 === 0 ? '#fffef4' : color);
          if (i % 2 === 0) {
            put(px, py, angle, sz * 0.48, sz * 0.18, 3, age + t, opacity * 0.36, '#fffef4');
          }
        }
        return;
      }
      // Soft spray streak (detonate grit) — tip-weighted body + white core.
      if (type === 7) {
        put(x, y, angle, w * 1.12, Math.max(2.8, h * 0.85), 1, age, opacity, color);
        put(x, y, angle, w * 0.42, Math.max(1.6, h * 0.28), 3, age, opacity * 0.55, '#fffef4');
        return;
      }
      // Flash / core / soft fill → particle types only.
      let t = 0;
      if (type === 3 || type === 12) t = type === 3 ? 1 : 0;
      else if (type === 5) t = 3;
      else if (type === 4) t = 4;
      else if (type >= 5) t = type % 2 ? 4 : 0;
      put(x, y, angle, w, h, t, age, opacity, color);
    }, time);
  }
  emit(put, time) {
    this.prune(time);
    // Shared GPU/canvas budget across overlapping casts — Merlin/Emily volleys used to
    // enqueue 10×14 detonate sparks per boom and pin the projectile instance LIMIT.
    // Newest cast first so an emergency X isn't starved by a fading prior boom.
    const light = prefersLightFx();
    let budget = light ? 260 : 520;
    for (let ci = this.casts.length - 1; ci >= 0; ci--) {
      const b = this.casts[ci];
      const profile = BOMB_PROFILES[b.key], t = Math.max(0, time - b.start);
      const tail = clamp((profile.duration - t) / .4), c = profile.color, a = profile.accent;
      const dense = b.targets.length > 6;
      const sprite = (x, y, w, h, type, age = t, opacity = 1, color = c, angle = 0) => {
        if (budget <= 0 || w <= 0 || h <= 0 || opacity <= .002) return;
        budget -= 1;
        put(x, y, angle, w, h, type, age, opacity * tail, color);
      };
      const beam = (x, y, tx, ty, width, opacity, color = c, type = 10) => {
        const length = Math.hypot(tx - x, ty - y);
        if (length < 1) return;
        sprite((x + tx) / 2, (y + ty) / 2, length * 1.08, width, type, t, opacity, color, Math.atan2(ty - y, tx - x));
      };
      const ring = (x, y, diameter, opacity, color = c, type = 6) => sprite(x, y, diameter, diameter, type, .72, opacity, color);
      const detonate = (x, y, age, scale = 1, color = c) => {
        const boom = light ? .42 : .5;
        const after = light ? .62 : .88;
        if (age < 0 || age > after) return;
        if (age <= boom) {
          const k = age / boom, fade = (1 - k) ** 2;
          // Bright core → dual shock rings → tip-variance streaks (character color kept).
          // Keep soft fill small so detonations read as rings/streaks, not muddy blobs.
          sprite(x, y, (52 + k * 90) * scale, (52 + k * 90) * scale, 5, age, fade * .72, color);
          sprite(x, y, (34 + k * 42) * scale, (34 + k * 42) * scale, 5, age, fade * .98, '#fffef4');
          ring(x, y, (34 + k * 210) * scale, fade * .98, '#fff8e0');
          ring(x, y, (48 + k * 270) * scale, fade * .55, a, 8);
          if (!light) ring(x, y, (60 + k * 320) * scale, fade * .3, color, 6);
          // Modest spark bump inside shared cast budget — dense fields stay leaner.
          // sparkN frozen — tip-forward length / thin aspect only (soft remap type 7).
          const sparkN = dense ? (light ? 4 : 8) : (light ? 5 : 11);
          for (let j = 0; j < sparkN; j++) {
            const ang = (j / sparkN) * TAU + (j % 2) * 0.11;
            const distance = (20 + (j % 4) * 10) * Math.sqrt(k) * 3.35 * scale;
            const fine = j % 3 !== 0;
            const len = ((fine ? 16 : 22) + (j % 3) * (fine ? 7 : 9) + (j % 5) * 2) * scale;
            const thick = ((fine ? 3.4 : 4.8) + (j % 3) * 1.1) * scale;
            sprite(x + Math.cos(ang) * distance, y + Math.sin(ang) * distance,
              len, thick, 7, age, fade * (0.85 + (j % 3) * 0.05), j % 2 ? color : '#fff3d8', ang);
          }
        } else {
          const k = (age - boom) / (after - boom);
          const fade = (1 - k) ** 1.6;
          ring(x, y, (220 + k * 170) * scale, fade * .4, color, 8);
          if (!light) ring(x, y, (250 + k * 130) * scale, fade * .2, a, 6);
          // Residual grit so the fade doesn't collapse to a single soft ring.
          // Tip-forward length/thin aspect + cool tip — gritN / cast budget frozen.
          const gritN = dense ? (light ? 2 : 4) : (light ? 3 : 6);
          for (let j = 0; j < gritN; j++) {
            const ang = (j / gritN) * TAU + k * 0.8;
            const distance = (90 + j * 18 + k * 40) * scale;
            const fine = j % 3 !== 0;
            const len = ((fine ? 18 : 24) + (j % 3) * (fine ? 8 : 9) + (j % 2) * 3) * scale;
            const thick = ((fine ? 2.55 : 3.6) + (j % 3) * 0.75) * scale;
            sprite(x + Math.cos(ang) * distance, y + Math.sin(ang) * distance,
              len, thick, 7, age, fade * 0.55, j % 2 ? color : '#fffef8', ang);
          }
        }
      };
      // Immediate cast flash acknowledges the immediate enemy-bullet clear.
      sprite(b.x, b.y, 96, 96, 5, t, clamp(1 - t / .22) * .95, '#fffef4');
      sprite(b.x, b.y, 70, 70, 5, t, clamp(1 - t / .18) * .82, c);
      ring(b.x, b.y, 90 + t * 500, clamp(1 - t / .3) * .62, a, 8);
      ring(b.x, b.y, 70 + t * 260, clamp(1 - t / (light ? .42 : .7)) * .38, c, 6);
      if (!light) ring(b.x, b.y, 55 + t * 180, clamp(1 - t / .5) * .26, '#fff8e0', 6);
      if (b.key === 'hirume') {
        const expand = 1 - Math.exp(-t * 3.2);
        ring(b.x, b.y, 70 + expand * 1650, (1 - t / 1.8) * .8, a, 8);
        ring(b.x, b.y, 70 + expand * 1470, (1 - t / 1.8) * .42, c);
        // A protective seal persists around the caster after the fire front passes.
        sprite(b.x, b.y, 145, 145, 11, t, .7, c);
        for (let i = 0; i < 12; i++) {
          const ang = i * TAU / 12 + t * .4;
          sprite(b.x + Math.cos(ang) * 64, b.y + Math.sin(ang) * 64, 26, 34, 0, t + i, .7, c, ang + Math.PI / 2);
        }
        b.targets.forEach((p, i) => {
          const age = t - .22 - i * .025;
          detonate(p.x, p.y, age, .75, a);
          if (age > 0 && age < .85) {
            const fade = (1 - age / .85);
            // Tall purification pillars — bright core + colored sheath (readable vs stage art).
            sprite(p.x, p.y - age * 45, 240, 92, 0, t + i, fade * .55, a, -Math.PI / 2);
            sprite(p.x, p.y - age * 45, 170, 58, 0, t + i, fade * .95, c, -Math.PI / 2);
            sprite(p.x, p.y - age * 40, 70, 70, 5, age, fade * .7, '#fffef4');
          }
        });
      } else if (b.key === 'sleipnir' || b.key === 'lrl' || b.key === 'peregrinus_human' || b.key === 'peregrinus_bird' || b.key === 'express76' || b.key === 'labiata'
        || b.key === 'constantia') {
        // Original Skill2 runs draw their own FX (sleipnir / express76 / labiata / lrl-skill.js).
      } else if (b.key === 'merlin') {
        sprite(b.x, b.y, 140, 140, 9, -t * .5, .6, '#8bd8ff');
        b.targets.forEach((p, i) => {
          const land = .38 + i * .085, age = t - land;
          if (age < .1) sprite(p.x, p.y, 100, 100, 9, t, .75, a);
          if (age > -.32 && age < 0) {
            const k = 1 + age / .32, sx = p.x - 155, sy = -100;
            const x = sx + (p.x - sx) * k, y = sy + (p.y - sy) * k;
            sprite(x, y, 195, 70, 3, t + i, 1, a, Math.atan2(p.y - sy, p.x - sx));
          }
          detonate(p.x, p.y, age, 1.35, c);
          detonate(p.x + 24, p.y - 17, age - .13, .65, a);
        });
      } else if (b.key === 'fafnir') {
        const expand = 1 - Math.exp(-t * 3.6);
        ring(b.x, b.y, 70 + expand * 1720, (1 - t / 1.7) * .6, c, 8);
        ring(b.x, b.y, 70 + expand * 1410, (1 - t / 1.7) * .5, a);
        sprite(b.x, b.y, 170, 170, 11, t * 2, .7, a);
        sprite(b.x, b.y, 100, 100, 5, t, .65, c);
        const power = clamp((t - .1) / .1) * clamp((1.25 - t) / .4);
        b.targets.forEach((p, i) => {
          beam(b.x, b.y, p.x, p.y, 95, power * .8, c, 13);
          if (i > 0) beam(b.targets[i - 1].x, b.targets[i - 1].y, p.x, p.y, 60, power * .6, a, 13);
          detonate(p.x, p.y, t - .22 - i * .035, .65, c);
          if (power > 0) sprite(p.x, p.y, 80, 80, 11, t + i, power * .4, a);
        });
      } else if (b.key === 'eternity') {
        // Coffin ward + rapid HMG volleys (Constantia-like locks, violet).
        sprite(b.x, b.y, 150, 150, 11, t, .65, a);
        b.targets.forEach((p, i) => {
          const lock = clamp(t / .18);
          if (t < 1.1) sprite(p.x, p.y, 90 - lock * 28, 110 - lock * 20, 9, t, .55, a);
          for (let volley = 0; volley < 4; volley++) {
            const age = t - .16 - i * .02 - volley * .2;
            if (age >= 0 && age < .14) {
              const fade = 1 - age / .14;
              beam(b.x, b.y, p.x, p.y, 10, fade, c);
              sprite(b.x, b.y, 70, 48, 5, t, fade, c);
            }
            detonate(p.x, p.y, age, .42, c);
          }
        });
      } else if (b.key === 'emily') {
        // Xenox artillery drops (Merlin-like rail strikes, cyan).
        sprite(b.x, b.y, 140, 140, 9, -t * .5, .55, '#8bd8ff');
        b.targets.forEach((p, i) => {
          const land = .34 + i * .08, age = t - land;
          if (age < .1) sprite(p.x, p.y, 100, 100, 9, t, .7, a);
          if (age > -.3 && age < 0) {
            const k = 1 + age / .3, sx = p.x - 140, sy = -90;
            const x = sx + (p.x - sx) * k, y = sy + (p.y - sy) * k;
            sprite(x, y, 210, 56, 3, t + i, 1, a, Math.atan2(p.y - sy, p.x - sx));
          }
          detonate(p.x, p.y, age, 1.2, c);
          detonate(p.x + 18, p.y - 12, age - .1, .55, a);
        });
      } else if (b.key === 'griffin') {
        // Original Skill2 bombing run (flight, missiles, hits) is drawn by griffin-skill.js.
      }
    }
  }
  drawLabel(ctx, time) {
    this.prune(time);
    const b = this.casts[this.casts.length - 1];
    if (!b) return;
    const t = time - b.start, alpha = clamp(t / .08) * clamp((1.1 - t) / .3);
    if (alpha <= 0) return;
    const profile = BOMB_PROFILES[b.key];
    // Sit above bottom HUD / touch pads so identity text stays readable.
    // Centred on the live field (W / H vary with the screen aspect).
    const w = 400;
    const h = 44;
    const x = (W - w) / 2;
    const y = H - 138;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(6,10,18,.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(210,230,245,.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // Brass corner ticks
    ctx.strokeStyle = profile.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 10); ctx.lineTo(x, y); ctx.lineTo(x + 10, y);
    ctx.moveTo(x + w - 10, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + 10);
    ctx.moveTo(x + w, y + h - 10); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - 10, y + h);
    ctx.moveTo(x + 10, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - 10);
    ctx.stroke();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, profile.color);
    g.addColorStop(1, profile.accent);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 5, h);
    ctx.fillStyle = 'rgba(255,248,230,.16)';
    ctx.fillRect(x + 5, y, w - 5, 1);
    ctx.font = '700 15px "Chakra Petch", "Noto Sans KR", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // Caption dual-stroke: dark outer + cool cream rim so fade alpha never muddies bomb identity.
    const lx = x + w / 2;
    const ly = y + h / 2;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8, 10, 18, 0.88)';
    ctx.strokeText(b.label || profile.label, lx, ly);
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = 'rgba(255, 230, 180, 0.4)';
    ctx.strokeText(b.label || profile.label, lx, ly);
    ctx.fillStyle = '#fff6e8';
    ctx.fillText(b.label || profile.label, lx, ly);
    ctx.restore();
  }
  drawCanvas(ctx, time) {
    // Same choreography without WebGL; reduced detail, no separate clock or events.
    this.emit((x,y,angle,w,h,type,age,opacity,color) => {
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=Math.min(1,opacity);ctx.strokeStyle=color;ctx.fillStyle=color;
      // Layered fills already read as glow — per-sprite shadowBlur crushed canvas fallback FPS.
      ctx.shadowBlur=0;ctx.lineWidth=2;
      if ([6,8,9,11].includes(type)) {
        // Soft mote ring with size variance — grit chips, not equal disks / seal strokes.
        const rad=Math.max(w,h)*.38;
        const n=type===9?11:15;
        for(let i=0;i<n;i++){
          const a=(i/n)*TAU+(age||0)*(type===11?1.2:.3)+(i%3)*.05;
          const sz=Math.max(1.1,rad*(.032+(i%5)*.02+(i%7)*.004));
          const rMul=.86+(i%5)*.04+(i%2)*.025;
          const px=Math.cos(a)*rad*rMul;
          const py=Math.sin(a)*rad*rMul;
          ctx.fillStyle=i%4===0?'#fffef4':color;
          ctx.globalAlpha=Math.min(1,opacity*(.4+(i%3)*.12));
          ctx.save();ctx.translate(px,py);ctx.rotate(a);
          ctx.scale(i%3===0?1:1.7+(i%4)*.12,.5);
          ctx.beginPath();ctx.arc(0,0,sz,0,TAU);ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha=Math.min(1,opacity*.45);ctx.fillStyle='#fffef4';
        ctx.beginPath();ctx.arc(0,0,Math.max(1.6,rad*.1),0,TAU);ctx.fill();
      } else if(type===10 || type===13) {
        // Soft streak core + drip motes (Fafnir 13 never zigzags).
        ctx.globalAlpha=Math.min(1,opacity*.55);ctx.fillStyle=color;
        ctx.beginPath();ctx.ellipse(0,0,w*.46,Math.max(2,h*.12),0,0,TAU);ctx.fill();
        const drips=type===13?12:8;
        for(let i=1;i<=drips;i++){
          const px=-w*.46+w*.92*i/(drips+1);
          const py=Math.sin(i*2.2+age*14)*h*.18;
          const sz=Math.max(0.9,h*(.04+(i%3)*.025));
          ctx.fillStyle=i%3===0?'#fffef4':color;
          ctx.globalAlpha=Math.min(1,opacity*(.4+.5*Math.abs(Math.sin(age*10+i))));
          ctx.save();ctx.translate(px,py);ctx.scale(1.8,.5);
          ctx.beginPath();ctx.arc(0,0,sz,0,TAU);ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha=Math.min(1,opacity);
      } else if(type===12) {
        ctx.beginPath();ctx.ellipse(0,0,w*.38,h*.2,0,0,TAU);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,0,w*.05,h*.12,0,0,TAU);ctx.fill();
      } else {
        const g=ctx.createRadialGradient(0,0,0,0,0,Math.max(w,h)*.5);
        g.addColorStop(0,'#fffef4');g.addColorStop(.12,color);g.addColorStop(.42,color);g.addColorStop(1,'transparent');
        ctx.fillStyle=g;ctx.scale(1,h/w);ctx.fillRect(-w/2,-w/2,w,w);
      }
      ctx.restore();
    }, time);
  }
}
