// sprint-3d witness
// Spray, smoke, blood, sparks, skid marks and the little floating price tags. One pooled list of
// short-lived particles the renderer draws after the city and before the HUD, plus the camera shake
// that makes a gunshot or a crash read as impact.
import { createRandom, rand, pick } from './math.js';

export function createEffects(seed = 5) {
  const rng = createRandom(seed + 2024);
  const particles = [];
  const skids = [];
  const floats = [];
  const state = { shake: 0, flash: 0, flashColor: '255,236,190' };

  function emit(x, y, angle, spread, speed, life, size, color, kind) {
    if (particles.length > 420) particlePoolTrim();
    const a = angle + rand(rng, -spread, spread);
    const s = rand(rng, speed * 0.35, speed);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      size,
      color,
      kind,
    });
  }

  function particlePoolTrim() {
    particles.splice(0, Math.floor(particles.length * 0.25));
  }

  return {
    particles,
    skids,
    floats,
    state,
    muzzle(x, y, angle) {
      for (let i = 0; i < 5; i += 1) emit(x, y, angle, 0.5, 180, 0.09, 3, '#ffe6a6', 'spark');
      for (let i = 0; i < 2; i += 1) emit(x, y, angle, 0.8, 60, 0.22, 5, '#f2d4a0', 'smoke');
      state.shake = Math.min(9, state.shake + 1.4);
      state.flash = Math.max(state.flash, 0.35);
    },
    sparks(x, y, angle) {
      for (let i = 0; i < 7; i += 1) emit(x, y, angle + Math.PI, 0.9, 150, 0.35, 2, pick(rng, ['#ffd479', '#ff9c4a', '#fff2c9']), 'spark');
      state.shake = Math.min(7, state.shake + 1.1);
    },
    blood(x, y, angle) {
      for (let i = 0; i < 6; i += 1) emit(x, y, angle, 1.2, 90, 0.5, 2.4, pick(rng, ['#8f1f1f', '#6f1414', '#a82626']), 'blood');
    },
    smoke(x, y, strength = 1) {
      for (let i = 0; i < 2 * strength; i += 1) {
        emit(x, y, rand(rng, 0, Math.PI * 2), 1.6, 28 * strength, 1.4, rand(rng, 4, 9), '#6f6a62', 'smoke');
      }
    },
    fire(x, y) {
      for (let i = 0; i < 3; i += 1) emit(x, y, rand(rng, 0, Math.PI * 2), 1.2, 40, 0.45, rand(rng, 3, 6), pick(rng, ['#ffb648', '#ff7a3c', '#ffe08a']), 'fire');
    },
    skid(x, y, angle) {
      skids.push({ x, y, angle, life: 11 });
      if (skids.length > 380) skids.splice(0, 80);
    },
    float(text, x, y, color = '#ffe6a1') {
      floats.push({ text, x, y, life: 1.4, color });
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 1.9 * dt;
        p.vy *= 1 - 1.9 * dt;
        if (p.kind === 'smoke') p.vy -= 6 * dt;
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      for (let i = floats.length - 1; i >= 0; i -= 1) {
        floats[i].life -= dt;
        floats[i].y -= 26 * dt;
        if (floats[i].life <= 0) floats.splice(i, 1);
      }
      state.shake *= Math.exp(-4.2 * dt);
      state.flash *= Math.exp(-9 * dt);
    },
  };
}