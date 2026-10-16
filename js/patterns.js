/** Danmaku pattern helpers — fire into a BulletPool */

export function aimAt(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len };
}

export function fireAimed(pool, x, y, tx, ty, speed, opts = {}) {
  const { ux, uy } = aimAt(x, y, tx, ty);
  pool.spawn({
    x, y,
    vx: ux * speed,
    vy: uy * speed,
    r: opts.r ?? 5,
    color: opts.color ?? '#ff6b6b',
    damage: opts.damage ?? 1,
  });
}

export function fireRing(pool, x, y, count, speed, angleOffset = 0, opts = {}) {
  for (let i = 0; i < count; i++) {
    const a = angleOffset + (Math.PI * 2 * i) / count;
    pool.spawn({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: opts.r ?? 5,
      color: opts.color ?? '#ff9f43',
      damage: opts.damage ?? 1,
    });
  }
}

export function fireFan(pool, x, y, tx, ty, count, spread, speed, opts = {}) {
  const { ux, uy } = aimAt(x, y, tx, ty);
  const base = Math.atan2(uy, ux);
  const start = base - spread / 2;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const a = start + spread * t;
    pool.spawn({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: opts.r ?? 5,
      color: opts.color ?? '#f368e0',
      damage: opts.damage ?? 1,
    });
  }
}

export function fireSpiral(pool, x, y, arms, speed, angle, opts = {}) {
  for (let i = 0; i < arms; i++) {
    const a = angle + (Math.PI * 2 * i) / arms;
    pool.spawn({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: opts.r ?? 4.5,
      color: opts.color ?? '#54a0ff',
      damage: opts.damage ?? 1,
    });
  }
}

export function fireSpreadDown(pool, x, y, count, speed, opts = {}) {
  fireFan(pool, x, y, x, y + 100, count, opts.spread ?? 1.1, speed, opts);
}

/** Landscape: spread toward the left (player side) */
export function fireSpreadLeft(pool, x, y, count, speed, opts = {}) {
  fireFan(pool, x, y, x - 100, y, count, opts.spread ?? 1.1, speed, opts);
}
