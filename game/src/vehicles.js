// Cars: the lane-following traffic that fills the streets, the free-driving model the player and the
// police use, entering and leaving a car, bumps, damage and the smoke that comes out of a wreck.
import { CARS, TRAFFIC } from './config.js';
import { createRandom, clamp, damp, rand, pick, chance } from './math.js';

export const CAR_COLORS = ['#d9d4c7', '#8fb3c9', '#c96f5a', '#5e6b7a', '#e8d9a8', '#7d9b76', '#e8b83a', '#b04d3f', '#f2efe4'];

let nextCarId = 1;

export function createCar(type, x, y, angle, color = '#d9d4c7', options = {}) {
  const spec = CARS[type] ?? CARS.sedan;
  return {
    id: nextCarId++,
    type,
    spec,
    x,
    y,
    angle,
    speed: 0,
    width: spec.width,
    length: spec.length,
    color,
    health: 100,
    kind: options.kind ?? 'parked',
    driver: options.driver ?? null,
    axis: options.axis ?? null,
    index: options.index ?? 0,
    dir: options.dir ?? 1,
    along: options.along ?? 0,
    cruise: options.cruise ?? 110,
    siren: options.siren ?? type === 'police',
    stolen: false,
    burning: false,
    skidTimer: 0,
    smokeTimer: 0,
    bump: 0,
    idTag: options.idTag ?? null,
  };
}

export function createTraffic(seed, city) {
  const rng = createRandom(seed + 401);
  const cars = [];
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'pickup', 'sports'];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const lane = city.trafficSpawn();
    const type = pick(rng, types);
    const color = type === 'taxi' ? '#e8b83a' : pick(rng, CAR_COLORS);
    const car = createCar(type, 0, 0, 0, color, {
      kind: 'traffic',
      ...lane,
    });
    car.cruise = rand(rng, TRAFFIC.speedMin, TRAFFIC.speedMax);
    const point = city.lanePoint(lane.axis, lane.index, lane.dir, lane.along);
    car.x = point.x;
    car.y = point.y;
    car.angle = point.angle;
    car.speed = car.cruise;
    cars.push(car);
  }
  return cars;
}

export function createParked(city) {
  const rng = createRandom(city.seed + 733);
  return city.parked.map((p) => {
    const car = createCar(p.type, p.x, p.y, p.angle, p.color, { kind: 'parked' });
    car.health = 100;
    return car;
  });
}

export function nearestCar(cars, x, y, maxDistance = 48, includePolice = false) {
  let best = null;
  let bestD = maxDistance * maxDistance;
  for (const car of cars) {
    if (car.kind === 'police' && !includePolice) continue;
    if (car.burning) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function blockedAhead(car, world) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const check = (x, y, sideLimit, aheadLimit) => {
    const dx = x - car.x;
    const dy = y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead <= 0 || ahead > aheadLimit) return false;
    const side = Math.abs(-dx * fy + dy * fx);
    return side < sideLimit;
  };
  if (check(world.player.x, world.player.y, 26, 62)) return true;
  for (const other of world.cars) {
    if (other === car) continue;
    if (other.kind === 'parked' && sideDistanceLess(car, other, 40)) {
      if (check(other.x, other.y, 26, 86)) return true;
    } else if (other.kind !== 'parked' && check(other.x, other.y, 26, 88)) {
      return true;
    }
  }
  for (const ped of world.peds.peds) {
    if (!ped.dead && check(ped.x, ped.y, 18, 54)) return true;
  }
  return false;
}

function sideDistanceLess(a, b, limit) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < limit;
}

export function stepTrafficCar(car, dt, city, world) {
  if (car.kind !== 'traffic') return;
  const blocked = blockedAhead(car, world);
  car.speed = damp(car.speed, blocked ? 0 : car.cruise, blocked ? 5 : 1.7, dt);
  car.along += car.dir * car.speed * dt;
  const far = car.axis === 'v' ? city.cityH : city.cityW;
  if (car.dir > 0 && car.along > far + TRAFFIC.wrap) car.along = -TRAFFIC.wrap;
  if (car.dir < 0 && car.along < -TRAFFIC.wrap) car.along = far + TRAFFIC.wrap;
  const point = city.lanePoint(car.axis, car.index, car.dir, car.along);
  car.x = point.x;
  car.y = point.y;
  car.angle = point.angle;
}

export function stepFreeCar(car, controls, dt, city, effects) {
  const spec = car.spec;
  const throttle = controls.throttle || 0;
  const steer = controls.steer || 0;

  if (controls.brake) {
    car.speed = damp(car.speed, 0, 3.4, dt);
  } else if (throttle !== 0) {
    const sameDirection = car.speed === 0 || Math.sign(car.speed) === Math.sign(throttle);
    car.speed += (sameDirection ? spec.accel : spec.brake) * throttle * dt;
  } else {
    car.speed = damp(car.speed, 0, 0.9, dt);
  }
  car.speed = clamp(car.speed, -spec.maxSpeed * 0.38, spec.maxSpeed);

  const speedFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
  const turn = spec.turn * (controls.brake ? 1.35 : 1);
  car.angle += steer * turn * dt * speedFactor * (car.speed < 0 ? -1 : 1);

  if (Math.abs(car.speed) > 155 && (controls.brake || Math.abs(steer) > 0.65)) {
    car.skidTimer -= dt;
    if (car.skidTimer <= 0) {
      car.skidTimer = 0.055;
      const rear = car.length * 0.32;
      effects.skid(car.x - Math.cos(car.angle) * rear, car.y - Math.sin(car.angle) * rear, car.angle + Math.PI / 2);
      effects.skid(car.x - Math.cos(car.angle) * rear + Math.sin(car.angle) * 8, car.y - Math.sin(car.angle) * rear - Math.cos(car.angle) * 8, car.angle + Math.PI / 2);
    }
  }

  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  if (city.hitSolid(car.x, car.y, 14)) {
    car.x = prevX;
    car.y = prevY;
    const impact = Math.abs(car.speed);
    if (impact > 60) {
      effects.sparks(car.x, car.y, car.angle);
      car.health = Math.max(0, car.health - impact * 0.035);
    }
    car.speed *= -0.24;
    return true;
  }

  if (car.health < 35) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.11;
      effects.smoke(car.x + rand(Math.random, -3, 3), car.y + rand(Math.random, -3, 3), 1);
    }
  }
  return false;
}

export function collideWithCars(car, cars, effects) {
  const radius = car.length * 0.32;
  let bumped = false;
  for (const other of cars) {
    if (other === car) continue;
    if (other.kind === 'police' && car.kind === 'police') continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const min = radius + other.length * 0.32;
    const d = Math.hypot(dx, dy);
    if (d <= 0 || d >= min) continue;
    const nx = dx / d;
    const ny = dy / d;
    const overlap = min - d;
    if (other.kind !== 'parked') {
      car.x += nx * overlap * 0.6;
      car.y += ny * overlap * 0.6;
    } else {
      car.x += nx * overlap;
      car.y += ny * overlap;
    }
    const impact = Math.abs(car.speed) + Math.abs(other.speed);
    if (impact > 70) {
      effects.sparks((car.x + other.x) / 2, (car.y + other.y) / 2, car.angle + Math.PI / 2);
      if (car.kind === 'player') effects.state.shake = Math.min(9, effects.state.shake + impact * 0.02);
    }
    car.health = Math.max(0, car.health - impact * 0.02);
    other.health = Math.max(0, other.health - impact * 0.012);
    car.speed *= 0.62;
    other.bump = 0.25;
    bumped = true;
  }
  return bumped;
}

export function damageCar(car, amount, effects) {
  if (car.burning) return;
  car.health = Math.max(0, car.health - amount);
  if (car.health <= 0) {
    car.burning = true;
    car.speed *= 0.2;
  } else if (amount > 10) {
    effects.sparks(car.x, car.y, car.angle);
  }
}

export function enterableCar(car) {
  return car.kind !== 'police';
}