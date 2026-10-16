/**
 * Gameplay RNG (spawns / drops / fire cadence).
 * Visual polish should keep using Math.random so FX noise cannot desync combat.
 */

let _seeded = false;
let _state = 0;

export function setGameplaySeed(seed) {
  if (seed == null) {
    _seeded = false;
    _state = 0;
    return;
  }
  _seeded = true;
  _state = seed >>> 0;
}

export function isGameplaySeeded() {
  return _seeded;
}

export function gameplaySeed() {
  return _seeded ? (_state >>> 0) : null;
}

/** Mulberry32 — one uniform [0,1). */
export function rng() {
  if (!_seeded) return Math.random();
  let t = (_state += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
