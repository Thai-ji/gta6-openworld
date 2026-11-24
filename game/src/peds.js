// sprint-3d witness
// The crowd: pedestrians who loop their own block's sidewalk, and break into a run when a gun
// goes off or a car bears down on them. They have no pathfinding beyond the block ring, which is
// all a street scene needs, and they can be knocked down, which the police and the wanted level
// notice.
import { TRAFFIC } from './config.js';
import { createRandom, rand, randInt, pick, chance, clamp } from './math.js';

const SHIRTS = ['#e8e2d3', '#d96b4e', '#5f8fa6', '#e0b64a', '#8a9c72', '#c98a9e', '#6d6f8f', '#f0d7a8', '#b04d3f'];
const SKINS = ['#e7c3a1', '#c99a72', '#8d5f43', '#f0d3b4', '#6d4833'];
const PANTS = ['#3b4354', '#6b6252', '#8d8a7f', '#2f4a58', '#5a4c63'];

export function createPeds(seed, city) {
  const rng = createRandom(seed + 977);
  const peds = [];
  const walkable = city.blocks.filter((b) => b.kind !== 'lot');
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const block = pick(rng, walkable);
    const path = city.blockSidewalkPath(block);
    const perimeter = 2 * ((path.right - path.left) + (path.bottom - path.top));
    const t = rand(rng, 0, perimeter);
    const spot = city.perimeterPoint(block, t);
    peds.push({
      id: i,
      x: spot.x,
      y: spot.y,
      angle: spot.angle,
      block,
      perimeter,
      t,
      dir: chance(rng, 0.5) ? 1 : -1,
      walkSpeed: rand(rng, 42, 68),
      state: 'walk',
      panic: 0,
      health: 40,
      dead: false,
      down: false,
      downTimer: 0,
      shirt: pick(rng, SHIRTS),
      skin: pick(rng, SKINS),
      pants: pick(rng, PANTS),
      step: rand(rng, 0, 10),
      seed: Math.floor(rng() * 1e9),
    });
  }

  function flee(ped, seconds) {
    if (ped.dead) return;
    ped.state = 'flee';
    ped.panic = Math.max(ped.panic, seconds);
  }

  return {
    peds,
    alarm(x, y, radius) {
      for (const ped of peds) {
        if (ped.dead) continue;
        const dx = ped.x - x;
        const dy = ped.y - y;
        if (dx * dx + dy * dy < radius * radius) flee(ped, rand(rng, 5, 11));
      }
    },
    kill(ped) {
      if (ped.dead) return false;
      ped.dead = true;
      ped.down = true;
      ped.downTimer = 0.6;
      ped.state = 'down';
      return true;
    },
    hit(ped) {
      if (ped.dead) return;
      ped.health -= 14;
      if (ped.health <= 0) {
        ped.dead = true;
        ped.down = true;
        ped.downTimer = 0.6;
        ped.state = 'down';
      } else {
        flee(ped, 7);
      }
    },
    step(dt, city, player, cars) {
      for (const ped of peds) {
        ped.step += dt * (ped.dead ? 0 : 1);
        if (ped.dead) {
          ped.downTimer = Math.min(2, ped.downTimer + dt);
          continue;
        }
        if (ped.state === 'flee') {
          ped.panic -= dt;
          const dx = ped.x - player.x;
          const dy = ped.y - player.y;
          const len = Math.hypot(dx, dy) || 1;
          const speed = 265;
          const vx = (dx / len) * speed;
          const vy = (dy / len) * speed;
          let nx = ped.x + vx * dt;
          let ny = ped.y + vy * dt;
          if (city.hitSolid(nx, ped.y, 6)) nx = ped.x;
          if (city.hitSolid(ped.x, ny, 6)) ny = ped.y;
          ped.x = nx;
          ped.y = ny;
          ped.angle = Math.atan2(vy, vx);
          if (ped.panic <= 0) {
            ped.state = 'walk';
            const block = city.blockInfoAt(ped.x, ped.y);
            ped.block = block;
            const path = city.blockSidewalkPath(block);
            ped.perimeter = 2 * ((path.right - path.left) + (path.bottom - path.top));
            ped.t = rand(rng, 0, ped.perimeter);
            ped.dir = chance(rng, 0.5) ? 1 : -1;
          }
          continue;
        }
        ped.t += ped.dir * ped.walkSpeed * dt;
        const point = city.perimeterPoint(ped.block, ped.t);
        ped.x = point.x;
        ped.y = point.y;
        ped.angle = point.angle + (ped.dir < 0 ? Math.PI : 0);
        // Sidestep anything barrelling down the road nearby.
        for (const car of cars) {
          if (car.kind !== 'traffic' && car.kind !== 'player' && car.kind !== 'police') continue;
          if (Math.abs(car.speed) < 90) continue;
          const d = Math.hypot(car.x - ped.x, car.y - ped.y);
          if (d < 34 && chance(rng, 0.35)) {
            flee(ped, rand(rng, 2.5, 4.5));
            break;
          }
        }
      }
    },
  };
}