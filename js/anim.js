/** Frame-based sprite animation from PROP SD pose sheets */

export class SpriteAnim {
  /**
   * @param {{ idle?: HTMLImageElement[], move?: HTMLImageElement[] }} frames
   * @param {{ fps?: number, moveFps?: number }} [opts]
   */
  constructor(frames, opts = {}) {
    this.idle = frames.idle?.length ? frames.idle : (frames.move || []);
    this.move = frames.move?.length ? frames.move : this.idle;
    this.fps = opts.fps ?? 10;
    this.moveFps = opts.moveFps ?? 12;
    this.time = Math.random() * 10;
    this.moving = false;
    this.bob = 0;
  }

  get frames() {
    return this.moving ? this.move : this.idle;
  }

  get currentFps() {
    return this.moving ? this.moveFps : this.fps;
  }

  update(dt, moving = false) {
    this.moving = !!moving;
    this.time += dt;
    this.bob = Math.sin(this.time * 4.2) * 2.5;
  }

  get image() {
    const list = this.frames;
    if (!list.length) return null;
    const idx = Math.floor(this.time * this.currentFps) % list.length;
    return list[idx];
  }

  draw(ctx, x, y, size, opts = {}) {
    const img = this.image;
    if (!img) return;
    const bob = opts.bob !== false ? this.bob : 0;
    const flash = opts.flash || false;
    ctx.save();
    if (flash) ctx.globalAlpha = 0.55;
    ctx.drawImage(img, x - size / 2, y - size / 2 + bob, size, size);
    ctx.restore();
  }
}

export async function loadFrameSet(basePath, idleCount, moveCount = 0) {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed ${src}`));
      img.src = src;
    });

  const idle = [];
  for (let i = 0; i < idleCount; i++) {
    idle.push(await load(`${basePath}/idle_${i}.png`));
  }
  const move = [];
  for (let i = 0; i < moveCount; i++) {
    move.push(await load(`${basePath}/move_${i}.png`));
  }
  return { idle, move };
}
