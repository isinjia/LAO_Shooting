// Express 76 original skills as runs (skill-run.js), from Unity Char_PECS_Express76_N.
//
// C = skill1.anim "Freight Shipping" (4.23s): down smoke (0.33s), take-off sonic boom
// (0.62s), she rockets up and back out of frame (ch_root hidden 1.12-2.12s), dives in
// hauling the ATM on her hook rope (EX_grab), the grab rig throws the ATM onto the
// target (GrabMove 2.65-2.78s) which smashes at 2.8s (EventHit Express_skill1_attack,
// camera shake 0.8, time-scale dip) into EX_parts_atm_broken_grab while EX_money
// banknotes burst out (2.78/2.87/2.95s); she climbs away and lands home (3.27-3.9s).
// Single target: 6/12/18 damage, push-back, Courier Invoice (+20% Express damage taken).
// X = skill2.anim "Here's Your Delivery!" (5.82s): steps forward (0.12-0.43s), down
// smoke, Express_skill2_lighting (0.85s), parcel box_lighting + box_in_particle (2.28s),
// buff lands (EventBuffeffect 3.17s), Express_simple_skill_hit x4 (3.18-3.98s), star
// bling (4.45s), steps back. As a bomb the four hit flashes carry the blast (1/4 each).
import { W, H } from './canvas.js';
import { getNativeWeaponImage } from './native-weapon-fx.js';
import { bloom, drawSheetAt, clamp01 } from './run-fx.js';
import { spawnFx, spawnShot, runPos, liveTargets, cameraEvent, cameraStop, sfxEvent } from './skill-run.js';

const C_PATH = [
  [0, 0, 4.6], [0.1, 0, 4.4], [0.6, 2.9, 10.8], [1.1, -32.4, 31.2], [2.12, -32.4, 31.2],
  [2.52, -13.3, 21.5], [2.63, 4.0, 18.2], [2.78, 24.8, 20.6], [2.8, 30.6, 23.4],
  [3.38, 7.2, 31.8], [3.9, -0.9, 6.4], [4.07, 0.8, 4.8], [4.23, 0, 4.6],
];

function drawProp(ctx, key, x, y, w, rot, alpha = 1) {
  const img = getNativeWeaponImage(key);
  if (!img) return;
  const h = (w * img.height) / img.width;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function moneyBurst(run, x, y, n, t0) {
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const v = 160 + Math.random() * 220;
    const vx = Math.cos(ang) * v;
    const vy = Math.sin(ang) * v;
    const spin = (Math.random() - 0.5) * 14;
    const key = i % 4 === 0 ? 'express76-prop-moneystack' : 'express76-prop-bill';
    const w = key === 'express76-prop-bill' ? 16 + Math.random() * 6 : 26;
    spawnFx(run, { dur: 1.1, delay: t0, draw: (ctx, k) => {
      const s = k * 1.1;
      drawProp(ctx, key, x + vx * s, y + vy * s + 420 * s * s, w, spin * s, Math.min(1, (1 - k) / 0.3));
    } });
  }
}

export const EXPRESS_C = {
  clip: 'skill1', duration: 4.2333, y0: 4.6, path: C_PATH,
  targeted: true, reachX: 30.6, kMin: 8, kMax: 16, yScale: 0.55, laneToTarget: true,
  landFrom: 3.4, clampX: 46,
  // Fly-out to the left is 100% faster than the other travel legs, and the whole C
  // plays 50% faster on top of that (user tuning).
  travel: [[0.5, 1.12, 3.0], [1.12, 2.8], [3.27, 3.9]],
  speed: 1.5,
  timeline(run) {
    const total = run.level * 6;
    const list = [];
    list.push({ t: 0.33, do: (r) => spawnFx(r, { key: 'express76-fx-smoke', x: r.homeX, y: r.homeY + 34,
      w: 170, h: 130, dur: 0.6, blend: 'source-over', alpha: 0.8, layer: 'under' }) });
    // skill1 camera: release (1.83s), push in on the slam "0.35,0,5,20" (2.53s), release (2.93s).
    list.push(cameraStop(1.8333), cameraEvent(2.5333, 0.35, 20, 'target'), cameraStop(2.9333));
    // char_55_skill1_FULL (2.38s) plays from the skill1 clip clock (js/voice-events.js).
    list.push(sfxEvent(0, 'common_jet_whoosh'), sfxEvent(2.5667, 'common_swing_big_2'));
    list.push({ t: 0.62, do: (r, p) => {
      const q = runPos(p, r);
      spawnFx(r, { key: 'express76-fx-sonicboom', x: q.x, y: q.y + 20, w: 170, h: 170, dur: 0.35,
        rot: -Math.PI / 2 - 0.5, layer: 'under' });
    } });
    // EX_grab: the ATM swings off her rope (frames 61-63, GrabMove to 2.78s) onto the
    // target. Drawn here from where it hangs in frame 60; the body sheet omits it there.
    list.push({ t: 2.5417, do: (r, p) => {
      const q = runPos(p, r);
      spawnShot(r, {
        sx: q.x - p.drawSize * 0.6, sy: q.y + p.drawSize * 0.35, target: r.target, tx: r.tx, ty: r.ty,
        flight: 0.11, // lands on the 2.78s GrabMove end at the faster run pace
        curve: [[0, 0], [0.5, 0.35], [1, 1]],
        draw: (ctx, s) => drawProp(ctx, 'express76-prop-atm', s.x, s.y, 46, -0.5 + s.age * 9),
        onHit: (rr, x, y) => {
          rr.events.push({ type: 'shake', mag: 0.8 });
          rr.events.push({ type: 'hitstop', t: 0.05 });
          rr.events.push({ type: 'damage', target: rr.target, x, y, amount: total,
            knockback: 40 + rr.level * 30, invoice: 2.5 + rr.level });
          spawnFx(rr, { key: 'express76-fx-impact', x, y, w: 230, h: 230, dur: 0.45 });
          spawnFx(rr, { dur: 0.3, draw: (ctx, k) => bloom(ctx, x, y, 90, 80, 1 - k) });
          // EX_parts_atm_broken_grab tumbles off; EX_money waves at 2.78 / 2.87 / 2.95s.
          spawnFx(rr, { dur: 0.9, draw: (ctx, k) => drawProp(ctx, 'express76-prop-atmbroken',
            x + 60 * k, y - 50 * Math.sin(k * Math.PI) + 30 * k, 52, 0.4 + k * 2.2, Math.min(1, (1 - k) / 0.35)) });
          moneyBurst(rr, x, y - 6, 6, 0);
          moneyBurst(rr, x, y - 6, 5, 0.06);
          moneyBurst(rr, x, y - 6, 5, 0.12);
        },
      });
    } });
    return list;
  },
  drawUnder(ctx, p, run, size) {
    // Express_skill1_fire_particle (2.57s~): jet flames while she dives / climbs.
    const t = run.t;
    const a = runPos(p, run, t);
    const b = runPos(p, run, Math.max(0, t - 1 / 30));
    const vx = (a.x - b.x) * 30;
    const vy = (a.y - b.y) * 30;
    const speed = Math.hypot(vx, vy);
    if (speed > 220 && (t < 1.12 || t > 2.12)) {
      const ang = Math.atan2(vy, vx);
      if (t > 2.57) {
        // Express_skill1_fire_particle (2.57s~): DrM_skill2_last_hit flame bursts on the jets.
        drawSheetAt(ctx, 'express76-fx-fireparticle', (t * 3) % 1, a.x - Math.cos(ang) * size * 0.45,
          a.y - Math.sin(ang) * size * 0.45 + size * 0.1, size * 1.1, size * 0.8, { rot: ang + Math.PI });
      }
      const trail = getNativeWeaponImage('express76-fx-trail');
      bloom(ctx, a.x - Math.cos(ang) * size * 0.35, a.y - Math.sin(ang) * size * 0.35 + size * 0.08,
        size * 0.45, size * 0.3, Math.min(0.9, speed / 1600));
      if (trail) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp01(speed / 1200);
        ctx.translate(a.x - Math.cos(ang) * size * 0.4, a.y - Math.sin(ang) * size * 0.4 + size * 0.1);
        ctx.rotate(ang + Math.PI);
        ctx.drawImage(trail, 0, -size * 0.25, size * 1.3, size * 0.5);
        ctx.restore();
      }
    }
  },
};

// ch_root keys with the forward step (x ~12) removed (user direction): she delivers
// in place, keeping only the original vertical bob.
const X_PATH = [
  [0, 0, 3.9], [0.1, 0, 3.5], [0.2, 0, 5.4], [0.27, 0, 6.0], [0.33, 0, 5.5],
  [0.43, 0, 2.2], [0.6, 0, 2.0], [0.83, 0, 3.0], [1.33, 0, 3.3], [1.5, 0, 2.1],
  [2.28, 0, 2.4], [2.55, 0, 2.6], [3.0, 0, 3.1], [4.3, 0, 3.5], [4.93, 0, 3.3],
  [5.1, 0, 2.2], [5.27, 0, 5.8], [5.4, 0, 7.0], [5.53, 0, 6.2], [5.65, 0, 3.3], [5.82, 0, 3.9],
];
const X_HITS = [3.1833, 3.4, 3.65, 3.9833];

export const EXPRESS_X = {
  clip: 'skill2', duration: 5.8167, y0: 3.9, path: X_PATH, k: 9, landFrom: 5.1,
  travel: [[0.11, 0.43], [5.1, 5.65]],
  timeline() {
    const list = [];
    // skill2 camera: close on the delivery "0.35,16,0,15" (0s).
    list.push(cameraEvent(0, 0.35, 15));
    // char_55_skill2_FULL (0.95s) plays from the skill2 clip clock (js/voice-events.js).
    list.push(sfxEvent(0.95, 'common_atk_light'));
    list.push({ t: 0.45, do: (r, p) => {
      const q = runPos(p, r);
      spawnFx(r, { key: 'express76-fx-smoke', x: q.x, y: q.y + 34, w: 170, h: 120, dur: 0.6,
        blend: 'source-over', alpha: 0.8, layer: 'under' });
    } });
    // Express_skill2_lighting (0.85s): light-ray burst + glow-centre boom behind her
    // (express_light_text rays fanned out), settling into a soft halo.
    list.push({ t: 0.85, do: (r, p) => spawnFx(r, { dur: 1.3, layer: 'under', draw: (ctx, k) => {
      const q = runPos(p, r);
      const light = getNativeWeaponImage('express76-fx-light');
      const flash = Math.max(0, 1 - k / 0.25);
      const fade = Math.min(1, k / 0.06) * Math.min(1, (1 - k) / 0.45);
      bloom(ctx, q.x, q.y - 6, 70 + 50 * flash, 60 + 40 * flash, 0.55 * fade + 0.4 * flash);
      if (!light) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(q.x, q.y - 6);
      ctx.rotate(k * 0.6);
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i / 8) * Math.PI * 2);
        ctx.globalAlpha = 0.5 * fade * (i % 2 ? 0.7 : 1);
        const len = 90 + 40 * Math.sin(k * 6 + i);
        // Texture is narrow at the bottom: put that end at her, rays point outward.
        ctx.drawImage(light, -14, -len, 28, len);
        ctx.restore();
      }
      ctx.restore();
    } }) });
    // Parcel continuity: the body clip drops the box from her right hand after frame 40
    // (1.67s), but box_lighting only fires at 2.28s. Her own parcel (cut from frame 40,
    // express76-prop-heldbox) stays exactly where it was until it opens.
    const BOX_DX = 0.138; // x drawSize, from frame 40 (offset of the parcel from body centre)
    const BOX_DY = -0.051;
    const BOX_W = 0.2635;
    const boxAt = (p, r) => {
      const q = runPos(p, r);
      return { x: q.x + BOX_DX * p.drawSize, y: q.y + BOX_DY * p.drawSize };
    };
    list.push({ t: 1.7, do: (r, p) => spawnFx(r, { dur: 0.64, draw: (ctx, k) => {
      const img = getNativeWeaponImage('express76-prop-heldbox');
      if (!img) return;
      const t = 1.7 + k * 0.64;
      const b = boxAt(p, r);
      const bob = Math.sin(k * Math.PI * 2) * 1.5;
      const w = BOX_W * p.drawSize;
      const h = (w * img.height) / img.width;
      // Glow builds toward the opening (box_lighting).
      bloom(ctx, b.x, b.y + bob, w * 0.9, h * 0.9, 0.5 * Math.max(0, (t - 2.0) / 0.28));
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = t < 2.28 ? 1 : Math.max(0, 1 - (t - 2.28) / 0.06);
      ctx.drawImage(img, b.x - w / 2, b.y - h / 2 + bob, w, h);
      ctx.restore();
    } }) });
    // Express_box_lighting (2.28s): the parcel bursts open where it is. The original
    // express_box billboard (lid + two panels) is split into pieces: closed box first,
    // then the lid pops and the sides fall away in light.
    list.push({ t: 2.28, do: (r, p) => spawnFx(r, { dur: 0.6, draw: (ctx, k) => {
      const b = boxAt(p, r);
      const bx = b.x;
      const by = b.y;
      const sc = (BOX_W * p.drawSize * 1.12) / 145; // assembled pieces span ~145px
      const open = Math.max(0, Math.min(1, (k - 0.1) / 0.5));
      const fade = Math.min(1, k / 0.1) * Math.min(1, (1 - k) / 0.35);
      bloom(ctx, bx, by - 6 * open, (22 + 40 * open) * (p.drawSize / 80), (18 + 32 * open) * (p.drawSize / 80),
        (0.45 + 0.55 * Math.sin(open * Math.PI)) * Math.min(1, (1 - k) / 0.35));
      const piece = (key, cx, cy, rot) => {
        const img = getNativeWeaponImage(key);
        if (!img) return;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fade;
        ctx.translate(bx + cx * sc, by + cy * sc);
        ctx.rotate(rot);
        ctx.drawImage(img, (-img.width / 2) * sc, (-img.height / 2) * sc, img.width * sc, img.height * sc);
        ctx.restore();
      };
      // Texture centres: lid (259,217), left (200,294), right (309,296); box centre ~ (256,276).
      const e = open * open * (3 - 2 * open);
      piece('express76-prop-boxleft', -56 + 18 - 22 * e, 18 + 10 * e, -0.75 * e);
      piece('express76-prop-boxright', 53 - 18 + 22 * e, 20 + 10 * e, 0.75 * e);
      piece('express76-prop-boxlid', 3, -59 + 26 - 70 * e, -0.5 * e);
    } }) });
    // box_in_particle (2.28-3.12s): light motes streaming into the opened parcel.
    list.push({ t: 2.28, do: (r, p) => spawnFx(r, { dur: 0.84, draw: (ctx, k) => {
      const q = runPos(p, r);
      const bx = q.x + 0.138 * p.drawSize;
      const by = q.y - 0.051 * p.drawSize;
      for (let i = 0; i < 8; i++) {
        const ang = i * 0.785 + 0.3;
        const d = 64 * (1 - ((k * 1.8 + i * 0.125) % 1));
        bloom(ctx, bx + Math.cos(ang) * d, by + Math.sin(ang) * d, 4, 4, 0.9 * Math.min(1, (1 - k) / 0.2));
      }
    } }) });
    // EventBuffeffect (3.17s): "Delivery Complete!" lands on the courier.
    list.push({ t: 3.1667, do: (r, p) => {
      p._grantDeliveryBuff?.();
      // Express_skill2_buff_lighting_event: amber streaks + motes rise on the receiver.
      spawnFx(r, { dur: 1.0, draw: (ctx, k) => {
        const q = runPos(p, r);
        const line = getNativeWeaponImage('express76-fx-buffline');
        bloom(ctx, q.x, q.y + 6, 46, 30, 0.6 * Math.sin(k * Math.PI));
        for (let i = 0; i < 7; i++) {
          const a = k * 1.4 - i * 0.09;
          if (a < 0 || a > 1) continue;
          const x = q.x - 30 + i * 10;
          const y = q.y + 26 - a * 80;
          if (line) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.sin(a * Math.PI) * 0.9;
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(line, -20, -7, 48, 14);
            ctx.restore();
          }
          bloom(ctx, x, y - 10, 4, 4, Math.sin(a * Math.PI));
        }
      } });
    } });
    // Express_simple_skill_hit x4: the delivery light strikes every enemy on screen.
    for (const t of X_HITS) {
      list.push({ t, do: (r) => {
        r.events.push({ type: 'blast', share: 1 / X_HITS.length });
        for (const e of liveTargets(r.enemies)) {
          spawnFx(r, { key: 'express76-fx-hit', x: e.x + (Math.random() - 0.5) * 20, y: e.y + (Math.random() - 0.5) * 20,
            w: 150, h: 150, dur: 0.32 });
        }
      } });
    }
    // skill2_ande_bling (4.45s) + eye_bling_express (4.47s).
    list.push({ t: 4.45, do: (r, p) => {
      const q = runPos(p, r);
      spawnFx(r, { key: 'express76-fx-bling', x: q.x + 40, y: q.y - 28, w: 110, h: 110, dur: 0.45 });
      spawnFx(r, { key: 'express76-fx-bling', x: q.x + 12, y: q.y - 22, w: 80, h: 80, dur: 0.4, delay: 0.02 });
    } });
    return list;
  },
};

export { W, H };
