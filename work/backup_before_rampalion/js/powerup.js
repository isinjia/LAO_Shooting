/**
 * Floating power / bomb items (전국블레이드·1945식 혼합).
 *
 * Drop rules:
 * - Visible, scheduled carrier enemies drop P when destroyed.
 * - P raises shot level through Lv5; surplus P becomes score.
 * - A low-power recovery formation offers another carrier if the player missed P.
 * - B (bomb stock) drops sparsely; skipped when bombs already maxed.
 */

import { rng } from './rng.js';

/** Arcade pickup burst colors — match drawPowerIcon / drawBombIcon. */
const PICKUP_PALETTE = {
  power: {
    label: 'POWER UP',
    fill: '#fff8e0',
    stroke: 'rgba(212, 162, 74, 0.95)',
    glow: 'rgba(255, 224, 138, 0.85)',
    ring: 'rgba(126, 200, 232, 0.75)',
    sparks: ['#ffe08a', '#d4a24a', '#7ec8e8', '#fff6c8'],
  },
  bomb: {
    label: 'BOMB',
    fill: '#e8f4ff',
    stroke: 'rgba(90, 168, 220, 0.95)',
    glow: 'rgba(126, 200, 232, 0.9)',
    ring: 'rgba(255, 224, 138, 0.7)',
    sparks: ['#7ec8e8', '#b4e6ff', '#d4a24a', '#e8f4ff'],
  },
};

/**
 * Short-lived label + spark burst anchored near the player on P/B pickup.
 * Does not affect magnet, shot level, or bomb stock — visual only.
 */
export class PickupFeedback {
  constructor() {
    /** @type {Array<{
     *   type: 'power'|'bomb',
     *   ox: number, oy: number,
     *   age: number, life: number,
     *   sparks: Array<{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string,r:number,stretch?:number}>
     * }>} */
    this.popups = [];
  }

  clear() {
    this.popups.length = 0;
  }

  /**
   * @param {'power'|'bomb'} type
   * @param {number} x player x
   * @param {number} y player y
   */
  spawn(type, x, y) {
    const kind = type === 'bomb' ? 'bomb' : 'power';
    const pal = PICKUP_PALETTE[kind];
    // Dense magnet chains used to stack dozens of gradient popups per frame.
    const POPUP_CAP = 4;
    while (this.popups.length >= POPUP_CAP) {
      this.popups[0] = this.popups[this.popups.length - 1];
      this.popups.pop();
    }
    const load = this.popups.length / POPUP_CAP;
    const sparks = [];
    // Soft grit + needle mix (not equal blob ring) — still popup-capped.
    // n / POPUP_CAP frozen — tip-forward stretch + cool #fffef8 only (no dens churn).
    const baseN = kind === 'bomb' ? 16 : 18;
    const n = Math.max(7, Math.round(baseN * (load > 0.5 ? 0.55 : 1)));
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.55;
      const fine = i % 3 !== 0;
      const tip = 0.65 + Math.random() * 0.7;
      const sp = ((fine ? 90 : 55) + Math.random() * (fine ? 150 : 100)) * tip;
      const max = 0.28 + Math.random() * (fine ? 0.28 : 0.4);
      sparks.push({
        x: (Math.random() - 0.5) * 4,
        y: -8 + (Math.random() - 0.5) * 3,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (fine ? 52 : 28),
        life: max,
        max,
        color: i % 4 === 0 ? '#fffef8' : pal.sparks[i % pal.sparks.length],
        r: fine ? 0.7 + Math.random() * 1.4 : 1.6 + Math.random() * 2.2,
        stretch: fine ? 2.65 + Math.random() * 2.4 : 1.85 + Math.random() * 1.6,
      });
    }
    this.popups.push({
      type: kind,
      ox: x,
      oy: y,
      age: 0,
      life: 0.85,
      sparks,
    });
  }

  /**
   * @param {number} dt
   * @param {{ x: number, y: number } | null} [player] follow character slightly
   */
  update(dt, player = null) {
    let pWrite = 0;
    const popups = this.popups;
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      p.age += dt;
      if (player) {
        // Ease toward current player so the cue stays near the ship
        p.ox += (player.x - p.ox) * Math.min(1, 8 * dt);
        p.oy += (player.y - p.oy) * Math.min(1, 8 * dt);
      }
      let sWrite = 0;
      const sparks = p.sparks;
      for (let j = 0; j < sparks.length; j++) {
        const s = sparks[j];
        s.life -= dt;
        if (s.life <= 0) continue;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.vy += 40 * dt;
        sparks[sWrite++] = s;
      }
      sparks.length = sWrite;
      if (p.age < p.life) popups[pWrite++] = p;
    }
    popups.length = pWrite;
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    for (const p of this.popups) {
      const pal = PICKUP_PALETTE[p.type];
      const t = p.age / p.life;
      const fade = t < 0.15 ? t / 0.15 : t > 0.65 ? (1 - t) / 0.35 : 1;
      const rise = -28 - t * 36;
      const pop = 1 + (t < 0.12 ? (1 - t / 0.12) * 0.35 : 0);
      const x = p.ox;
      const y = p.oy + rise;

      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);

      // Expanding ring burst — dark under-rim + tip edge keep the pickup confirm
      // cue readable against same-hue cyan/brass neon wash (cue only;
      // ringR / POPUP_CAP / spark dens / magnet / drop frozen).
      const ringR = 10 + t * 42;
      const outerLw = 4.5 * (1 - t);
      const innerLw = 1.6 * (1 - t);
      const outerA = fade * 0.4;
      const ringCy = p.oy - 6;
      ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
      ctx.globalAlpha = outerA * 0.9;
      ctx.lineWidth = outerLw + 2;
      ctx.beginPath();
      ctx.arc(p.ox, ringCy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pal.ring;
      ctx.globalAlpha = outerA;
      ctx.lineWidth = outerLw;
      ctx.beginPath();
      ctx.arc(p.ox, ringCy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fffef8';
      ctx.globalAlpha = outerA * 0.72;
      ctx.lineWidth = Math.max(0.85, outerLw * 0.32);
      ctx.beginPath();
      ctx.arc(p.ox, ringCy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
      ctx.globalAlpha = fade * 0.9;
      ctx.lineWidth = innerLw + 1.6;
      ctx.beginPath();
      ctx.arc(p.ox, ringCy, ringR * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pal.ring;
      ctx.globalAlpha = fade;
      ctx.lineWidth = innerLw;
      ctx.beginPath();
      ctx.arc(p.ox, ringCy, ringR * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fffef8';
      ctx.globalAlpha = fade * 0.72;
      ctx.lineWidth = Math.max(0.7, innerLw * 0.55);
      ctx.beginPath();
      ctx.arc(p.ox, ringCy, ringR * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade;

      // Soft glow under label — skip heavy radial when several popups already stack.
      if (this.popups.length <= 2) {
        const glow = ctx.createRadialGradient(x, y, 2, x, y, 36);
        glow.addColorStop(0, pal.glow);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 36, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mini icon stamp
      if (p.type === 'bomb') {
        drawBombIcon(ctx, x - 34 * pop, y, 9 * pop, p.age * 4);
      } else {
        drawPowerIcon(ctx, x - 42 * pop, y, 9 * pop, p.age * 4);
      }

      // Arcade label above head
      ctx.font = `bold ${Math.round(15 * pop)}px "Chakra Petch", "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(8, 12, 20, 0.85)';
      ctx.strokeText(pal.label, x + 4, y);
      ctx.fillStyle = pal.stroke;
      ctx.fillText(pal.label, x + 4, y + 1);
      ctx.fillStyle = pal.fill;
      ctx.fillText(pal.label, x + 4, y);

      // Soft-sprite sparkle chips (velocity streaks) — no diamond / slash geometry.
      const prevComp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      for (const s of p.sparks) {
        const a = Math.max(0, s.life / s.max);
        const sx = p.ox + s.x;
        const sy = p.oy + s.y - 6;
        const spd = Math.hypot(s.vx, s.vy);
        const ang = spd > 8 ? Math.atan2(s.vy, s.vx) : 0;
        const stretch = (s.stretch || 1.4) * (1 + Math.min(1.4, spd * 0.006));
        const rad = s.r * (0.5 + a * 0.65);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.scale(stretch, 1);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = fade * a * 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * a * 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        // Tip-forward cool-white core along stretch axis (graze/polish language).
        ctx.fillStyle = '#fffef8';
        ctx.globalAlpha = fade * a * 0.95;
        ctx.beginPath();
        ctx.arc(rad * 0.28, 0, Math.max(0.4, rad * 0.34), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = prevComp;

      ctx.restore();
    }
  }
}

export class PowerUp {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'power'|'bomb'} [type]
   */
  constructor(x, y, type = 'power') {
    this.x = x;
    this.y = y;
    this.type = type === 'bomb' ? 'bomb' : 'power';
    this.alive = true;
    this.age = 0;
    this.r = 16;
    this.vx = -55 - rng() * 25;
    this.vy = (rng() - 0.5) * 30;
    this.bobAmp = 18 + rng() * 8;
    this.bobFreq = 2.2 + rng() * 0.6;
    this.baseY = y;
  }

  update(dt, canvasW, canvasH) {
    if (!this.alive) return;
    this.age += dt;
    this.x += this.vx * dt;
    this.baseY += this.vy * dt;

    if (this.baseY < 40) {
      this.baseY = 40;
      this.vy = Math.abs(this.vy) * 0.8;
    } else if (this.baseY > canvasH - 40) {
      this.baseY = canvasH - 40;
      this.vy = -Math.abs(this.vy) * 0.8;
    }

    this.y = this.baseY + Math.sin(this.age * this.bobFreq) * this.bobAmp;

    if (this.x < -40 || this.age > 18) this.alive = false;
  }

  /**
   * Attract toward player when nearby (classic Psikyo / Tengai item feel).
   * @param {{ x: number, y: number }} player
   * @param {number} dt
   * @param {number} [radius]
   * @param {number} [pullMul] post-miss vacuum multiplier
   */
  magnetToward(player, dt, radius = 120, pullMul = 1) {
    if (!this.alive) return;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > radius * radius || d2 < 1) return;
    const d = Math.sqrt(d2);
    const pull = (240 + (1 - d / radius) * 180) * Math.max(0.5, pullMul);
    // Kill leftover drift so pull doesn't fight the item's leftward spawn velocity.
    const damp = Math.max(0, 1 - 4.5 * dt);
    this.vx *= damp;
    this.vy *= damp;
    this.x += (dx / d) * pull * dt;
    this.baseY += (dy / d) * pull * dt;
    this.y = this.baseY + Math.sin(this.age * this.bobFreq) * this.bobAmp * (pullMul > 1.2 ? 0.15 : 0.35);
  }

  /** One-shot corpse / panic vacuum (game-over frame has no further ticks). */
  snapToward(x, y, radius = 340, strength = 0.72) {
    if (!this.alive) return;
    const dx = x - this.x;
    const dy = y - this.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > radius * radius || d2 < 1) return;
    const t = Math.max(0.35, Math.min(1, strength));
    this.x += dx * t;
    this.baseY += dy * t;
    this.y = this.baseY;
    this.vx *= 0.2;
    this.vy *= 0.2;
  }

  /**
   * @param {{ x: number, y: number }} player
   * @param {number} [pickupR]
   */
  tryPickup(player, pickupR = 32) {
    if (!this.alive) return false;
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    if (dx * dx + dy * dy <= pickupR * pickupR) {
      this.alive = false;
      return true;
    }
    return false;
  }

  draw(ctx) {
    if (!this.alive) return;
    if (this.type === 'bomb') drawBombIcon(ctx, this.x, this.y, this.r, this.age);
    else drawPowerIcon(ctx, this.x, this.y, this.r, this.age);
  }
}

/**
 * Brass/cyan gem orb with a crisp P monogram — readable at ~32px.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {number} age
 */
function drawPowerIcon(ctx, x, y, r, age) {
  const pulse = 0.82 + 0.18 * Math.sin(age * 5.5);
  const spin = age * 1.35;
  ctx.save();

  // Soft brass aura
  ctx.globalAlpha = 0.28 * pulse;
  const aura = ctx.createRadialGradient(x, y, r * 0.2, x, y, r + 14);
  aura.addColorStop(0, 'rgba(255, 220, 120, 0.85)');
  aura.addColorStop(0.55, 'rgba(212, 162, 74, 0.35)');
  aura.addColorStop(1, 'rgba(212, 162, 74, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, r + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Rotating dashed ring telegraph — dark under-rim + tip edge keep the
  // P-pickup brass cue readable against brass/neon wash (cue only;
  // drop / magnet / P stamp / dash geometry frozen).
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.setLineDash([4.5, 3.5]);
  ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 224, 138, ${0.48 + 0.32 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#fffef8';
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Hex gem body
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const gem = ctx.createLinearGradient(x - r, y - r, x + r * 0.6, y + r);
  gem.addColorStop(0, '#fff6c8');
  gem.addColorStop(0.25, '#ffe08a');
  gem.addColorStop(0.55, '#d4a24a');
  gem.addColorStop(0.82, '#8a5a18');
  gem.addColorStop(1, '#3a2410');
  ctx.fillStyle = gem;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 240, 200, 0.92)';
  ctx.lineWidth = 1.75;
  ctx.stroke();

  // Inner cyan core (weapon energy)
  const coreR = r * 0.58;
  const core = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, coreR);
  core.addColorStop(0, '#f0fbff');
  core.addColorStop(0.35, '#7ec8e8');
  core.addColorStop(0.75, '#3a7a96');
  core.addColorStop(1, 'rgba(20, 40, 55, 0.85)');
  ctx.beginPath();
  ctx.arc(x, y + 0.5, coreR, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 220, 240, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Facet ticks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3 + spin * 0.15;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r * 0.22), y + Math.sin(a) * (r * 0.22));
    ctx.lineTo(x + Math.cos(a) * (r * 0.72), y + Math.sin(a) * (r * 0.72));
    ctx.stroke();
  }

  // Specular shine sweep
  const shine = (Math.sin(age * 3.2) + 1) * 0.5;
  ctx.globalAlpha = 0.35 + 0.35 * shine;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.32, r * 0.18, r * 0.1, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Compact P monogram
  ctx.fillStyle = '#0a1218';
  ctx.strokeStyle = 'rgba(255, 246, 200, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.font = 'bold 13px "Chakra Petch", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('P', x, y + 0.5);
  ctx.fillStyle = '#fff8e0';
  ctx.fillText('P', x, y + 0.5);

  ctx.restore();
}

/**
 * Metallic capsule bomb with fuse spark — distinct from the P gem.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {number} age
 */
function drawBombIcon(ctx, x, y, r, age) {
  const pulse = 0.8 + 0.2 * Math.sin(age * 7);
  const spark = (Math.sin(age * 14) + 1) * 0.5;
  ctx.save();

  // Cool cyan aura
  ctx.globalAlpha = 0.3 * pulse;
  const aura = ctx.createRadialGradient(x, y, r * 0.15, x, y, r + 13);
  aura.addColorStop(0, 'rgba(180, 230, 255, 0.9)');
  aura.addColorStop(0.5, 'rgba(90, 168, 220, 0.35)');
  aura.addColorStop(1, 'rgba(60, 120, 160, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, r + 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Orbit ring telegraph — dark under-rim + tip edge keep the B-pickup cue
  // readable against pale-cyan neon wash (cue only; drop / magnet / B stamp frozen).
  const orbitR = r + 4.5;
  const orbitA0 = age * 2.2;
  const orbitA1 = orbitA0 + Math.PI * 1.35;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(12, 8, 18, 0.82)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(x, y, orbitR, orbitA0, orbitA1);
  ctx.stroke();
  ctx.strokeStyle = `rgba(126, 200, 232, ${0.42 + 0.28 * pulse})`;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.arc(x, y, orbitR, orbitA0, orbitA1);
  ctx.stroke();
  ctx.strokeStyle = '#fffef8';
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(x, y, orbitR, orbitA0, orbitA1);
  ctx.stroke();
  ctx.restore();

  const bodyR = r * 0.78;
  const by = y + 1.5;

  // Capsule shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 1.5, by + 2, bodyR * 0.95, bodyR * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bomb body (steel + cyan)
  const body = ctx.createRadialGradient(x - 4, by - 5, 2, x, by, bodyR);
  body.addColorStop(0, '#e8f4ff');
  body.addColorStop(0.3, '#7ec8e8');
  body.addColorStop(0.65, '#2a5a78');
  body.addColorStop(1, '#0c1824');
  ctx.beginPath();
  ctx.arc(x, by, bodyR, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 230, 245, 0.85)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Brass equatorial band
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, by, bodyR - 0.5, 0, Math.PI * 2);
  ctx.clip();
  const band = ctx.createLinearGradient(x - bodyR, by, x + bodyR, by);
  band.addColorStop(0, 'rgba(90, 60, 20, 0.15)');
  band.addColorStop(0.35, 'rgba(255, 224, 138, 0.75)');
  band.addColorStop(0.5, 'rgba(212, 162, 74, 0.95)');
  band.addColorStop(0.65, 'rgba(255, 224, 138, 0.75)');
  band.addColorStop(1, 'rgba(90, 60, 20, 0.15)');
  ctx.fillStyle = band;
  ctx.fillRect(x - bodyR, by - 3.2, bodyR * 2, 6.4);
  ctx.strokeStyle = 'rgba(40, 28, 10, 0.45)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(x - bodyR, by - 3.2);
  ctx.lineTo(x + bodyR, by - 3.2);
  ctx.moveTo(x - bodyR, by + 3.2);
  ctx.lineTo(x + bodyR, by + 3.2);
  ctx.stroke();
  ctx.restore();

  // Cap / fuse stem
  const capY = by - bodyR + 1;
  const capG = ctx.createLinearGradient(x - 4, capY - 8, x + 4, capY + 2);
  capG.addColorStop(0, '#ffe08a');
  capG.addColorStop(0.45, '#d4a24a');
  capG.addColorStop(1, '#6a4418');
  ctx.fillStyle = capG;
  ctx.beginPath();
  const cw = 6.4, ch = 9, cx0 = x - 3.2, cy0 = capY - 7, rr = 1.5;
  ctx.moveTo(cx0 + rr, cy0);
  ctx.lineTo(cx0 + cw - rr, cy0);
  ctx.quadraticCurveTo(cx0 + cw, cy0, cx0 + cw, cy0 + rr);
  ctx.lineTo(cx0 + cw, cy0 + ch - rr);
  ctx.quadraticCurveTo(cx0 + cw, cy0 + ch, cx0 + cw - rr, cy0 + ch);
  ctx.lineTo(cx0 + rr, cy0 + ch);
  ctx.quadraticCurveTo(cx0, cy0 + ch, cx0, cy0 + ch - rr);
  ctx.lineTo(cx0, cy0 + rr);
  ctx.quadraticCurveTo(cx0, cy0, cx0 + rr, cy0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 240, 200, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Fuse wire
  ctx.strokeStyle = '#c8a878';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, capY - 7);
  ctx.quadraticCurveTo(x + 5, capY - 14, x + 2, capY - 17);
  ctx.stroke();

  // Spark at fuse tip
  const sx = x + 2;
  const sy = capY - 17;
  ctx.globalAlpha = 0.55 + 0.45 * spark;
  const sparkG = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5.5);
  sparkG.addColorStop(0, '#fff8e0');
  sparkG.addColorStop(0.4, '#ffe08a');
  sparkG.addColorStop(1, 'rgba(232, 120, 40, 0)');
  ctx.fillStyle = sparkG;
  ctx.beginPath();
  ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(sx, sy, 1.4 + spark * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body highlight
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - bodyR * 0.32, by - bodyR * 0.35, bodyR * 0.22, bodyR * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Tiny B stamp on band (secondary ID, icon still reads as bomb)
  ctx.fillStyle = 'rgba(10, 14, 20, 0.75)';
  ctx.font = 'bold 9px "Chakra Petch", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', x, by + 0.5);

  ctx.restore();
}

/**
 * Only an explicitly marked carrier drops P. Full-power pickups remain score items.
 * @param {number} _shotLevel
 * @param {{ dropsPower?: boolean } | string} [enemyOrKind]
 */
export function shouldDropPowerUp(_shotLevel, enemyOrKind = 'grunt') {
  return !!(enemyOrKind && typeof enemyOrKind === 'object' && enemyOrKind.dropsPower);
}

/**
 * Sparse B (bomb) drop chance — 전국블레이드 B 아이템 느낌.
 * @param {string} [enemyKind]
 * @param {number} [bombs]
 * @param {number} [bombsMax]
 */
export function shouldDropBomb(enemyKind = 'grunt', bombs = 0, bombsMax = 3) {
  if (bombs >= bombsMax) return false;
  // Dry stock: slightly friendlier restock so deathbomb / X aren't soft-locked empty.
  // Feedback "too many bombs": measured 13-35 drops a stage (4-9 a minute) at the old
  // 4.5% grunt / 14% elite rates. Now ~2 a stage in all (incl. +1 on clear), and Game spaces drops
  // at least BOMB_DROP_GAP apart. Bosses drop none: the stage clear already adds one.
  const dry = bombs <= 0 ? 1.5 : 1;
  if (enemyKind === 'boss') return false;
  if (enemyKind === 'midboss') return rng() < 0.3 * dry;
  if (enemyKind === 'elite') return rng() < 0.01 * dry;
  return rng() < 0.002 * dry;
}
