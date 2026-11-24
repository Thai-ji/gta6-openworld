// sprint-3d witness
// Small geometry and randomness helpers shared by the simulation: distances, angles, a seeded
// generator so a screenshot scene is the same every run, and the easing the camera uses.
export const TAU = Math.PI * 2;

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export function angleDiff(from, to) {
  return wrapAngle(to - from);
}

export function approachAngle(from, to, step) {
  const d = angleDiff(from, to);
  if (Math.abs(d) <= step) return to;
  return wrapAngle(from + Math.sign(d) * step);
}

export function rand(rng, low, high) {
  return low + rng() * (high - low);
}

export function randInt(rng, low, high) {
  return Math.floor(low + rng() * (high - low + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// Mulberry32: tiny, deterministic, good enough for a city and a crowd.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Converts a screen point to world space for the aim line, given the camera's offset and zoom.
export function screenToWorld(sx, sy, camX, camY, zoom, viewW, viewH) {
  return {
    x: camX + (sx - viewW / 2) / zoom,
    y: camY + (sy - viewH / 2) / zoom,
  };
}