// The police response: a wanted level of up to five stars, patrol cars that spawn on the nearest
// lanes and ram the player, foot officers at three stars and above, the bullets they fire, and the
// slow cooling of the wanted level once the player is out of their sight.
import { POLICE } from './config.js';
import { clamp, angleDiff, dist, rand } from './math.js';
import { createCar, stepFreeCar, collideWithCars } from './vehicles.js';
import { fire } from './combat.js';

export function createPolice(seed, city) {
  const units = [];
  let stars = 0;
  let hidden = 0;
  let spawnTimer = 1;
  let bustTimer = 0;
  let nextUnit = 1;

  function addWanted(n) {
    stars = clamp(stars + n, 0, 5);
    hidden = 0;
    spawnTimer = Math.min(spawnTimer, 0.35);
  }

  function removeCar(game, car) {
    const index = game.cars.indexOf(car);
    if (index >= 0) game.cars.splice(index, 1);
  }

  function spawnCarUnit(game) {
    const player = game.player;
    const point = city.nearestLane(player.x, player.y, POLICE.spawnNear[stars] + rand(game.random, -80, 160));
    const car = createCar('police', point.x, point.y, point.angle, '#f2f1e8', { kind: 'police', siren: true });
    car.health = 170;
    car.cruise = 0;
    game.cars.push(car);
    units.push({
      id: nextUnit++,
      kind: 'car',
      car,
      x: point.x,
      y: point.y,
      health: 170,
      dead: false,
      shootTimer: rand(game.random, 0.7, 1.5),
      stuck: 0,
      lastX: point.x,
      lastY: point.y,
    });
  }

  function spawnFootUnit(game) {
    const player = game.player;
    const point = city.nearestLane(player.x, player.y, 420);
    units.push({
      id: nextUnit++,
      kind: 'foot',
      x: point.x,
      y: point.y,
      angle: 0,
      health: 70,
      dead: false,
      shootTimer: rand(game.random, 0.5, 1.2),
      stuck: 0,
      lastX: point.x,
      lastY: point.y,
    });
  }

  function aimAt(game, fromX, fromY, target, spread) {
    const angle = Math.atan2(target.y - fromY, target.x - fromX);
    fire(game, fromX + Math.cos(angle) * 12, fromY + Math.sin(angle) * 12, angle, 'cop', { spread });
    game.effects.muzzle(fromX + Math.cos(angle) * 12, fromY + Math.sin(angle) * 12, angle);
  }

  function clearUnits(game) {
    for (const unit of units) {
      if (unit.kind === 'car' && unit.car) removeCar(game, unit.car);
    }
    units.length = 0;
  }

  function stepFoot(unit, game, dt) {
    const player = game.player;
    const target = player.inCar ? player.inCar : player;
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const d = Math.hypot(dx, dy) || 1;
    unit.angle = Math.atan2(dy, dx);
    if (d > 110) {
      const speed = 190;
      const nx = (dx / d) * speed * dt;
      const ny = (dy / d) * speed * dt;
      if (!city.hitSolid(unit.x + nx, unit.y, 8)) unit.x += nx;
      if (!city.hitSolid(unit.x, unit.y + ny, 8)) unit.y += ny;
    } else {
      unit.x += Math.cos(unit.angle + Math.PI / 2) * Math.sin(game.time * 1.4) * 26 * dt;
      unit.y += Math.sin(unit.angle + Math.PI / 2) * Math.cos(game.time * 1.1) * 26 * dt;
    }
    unit.shootTimer -= dt;
    if (d < 560 && unit.shootTimer <= 0) {
      unit.shootTimer = rand(game.random, 1.0, 1.9);
      aimAt(game, unit.x, unit.y, target, 0.22);
    }
  }

  function stepCar(unit, game, dt) {
    const car = unit.car;
    if (!car || car.burning) {
      unit.dead = true;
      return;
    }
    const player = game.player;
    const target = player.inCar ? player.inCar : player;
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const d = Math.hypot(dx, dy) || 1;
    const desired = Math.atan2(dy, dx);
    const steer = clamp(angleDiff(car.angle, desired) * 2.2, -1, 1);
    const throttle = d > 90 ? 1 : d > 55 ? 0.4 : -0.7;
    stepFreeCar(car, { throttle, steer, brake: d < 45 }, dt, city, game.effects);
    collideWithCars(car, game.cars, game.effects);
    unit.x = car.x;
    unit.y = car.y;
    unit.shootTimer -= dt;
    if (d < 360 && unit.shootTimer <= 0 && Math.abs(car.speed) < 210) {
      unit.shootTimer = rand(game.random, 0.9, 1.8);
      aimAt(game, car.x, car.y, target, 0.16);
    }
    if (Math.abs(car.x - unit.lastX) + Math.abs(car.y - unit.lastY) < 1.5) {
      unit.stuck += dt;
      if (unit.stuck > 3.5 && d > 380) {
        const point = city.nearestLane(player.x, player.y, 720);
        car.x = point.x;
        car.y = point.y;
        car.angle = point.angle;
        car.speed = 0;
        unit.stuck = 0;
      }
    } else {
      unit.stuck = 0;
    }
    unit.lastX = car.x;
    unit.lastY = car.y;
  }

  function step(game, dt) {
    const player = game.player;

    if (stars > 0) {
      let near = false;
      for (const unit of units) {
        if (dist(unit.x, unit.y, player.x, player.y) < 620) {
          near = true;
          break;
        }
      }
      if (near) hidden = 0;
      else hidden += dt;
      if (hidden > POLICE.hiddenDecay && stars > 0) {
        stars -= 1;
        hidden = 0;
        if (stars === 0) clearUnits(game);
      }

      spawnTimer -= dt;
      const cap = POLICE.unitsByStars[clamp(stars, 0, 5)];
      if (spawnTimer <= 0 && units.length < cap) {
        spawnTimer = POLICE.spawnDelay[clamp(stars, 0, 5)];
        if (stars >= POLICE.footAtStars && units.length > 0 && game.random() < 0.45) spawnFootUnit(game);
        else spawnCarUnit(game);
      }
    } else if (units.length) {
      clearUnits(game);
    }

    for (const unit of units) {
      if (unit.dead) continue;
      if (unit.kind === 'car') stepCar(unit, game, dt);
      else stepFoot(unit, game, dt);
    }

    if (!player.inCar && stars > 0) {
      let close = false;
      for (const unit of units) {
        if (dist(unit.x, unit.y, player.x, player.y) < POLICE.arrestRange) {
          close = true;
          break;
        }
      }
      if (close) {
        bustTimer += dt;
        if (bustTimer > 1.1) {
          bustTimer = 0;
          game.onBusted();
        }
      } else {
        bustTimer = Math.max(0, bustTimer - dt * 2);
      }
    } else {
      bustTimer = 0;
    }

    for (let i = units.length - 1; i >= 0; i -= 1) {
      if (units[i].dead) units.splice(i, 1);
    }
  }

  return {
    units,
    get stars() {
      return stars;
    },
    get hidden() {
      return hidden;
    },
    addWanted,
    step,
    setStars(value) {
      stars = clamp(value, 0, 5);
      hidden = 0;
      spawnTimer = 0.6;
    },
    hitUnit(x, y, damage) {
      for (const unit of units) {
        if (unit.dead) continue;
        if (unit.kind === 'car' && unit.car) {
          if (Math.hypot(unit.car.x - x, unit.car.y - y) < 15) {
            unit.car.health = Math.max(0, unit.car.health - damage);
            if (unit.car.health <= 0) unit.car.burning = true;
            return true;
          }
        } else if (Math.hypot(unit.x - x, unit.y - y) < 11) {
          unit.health -= damage;
          if (unit.health <= 0) {
            unit.dead = true;
            stars = clamp(stars + 1, 0, 5);
          }
          return true;
        }
      }
      return false;
    },
    clear(game) {
      stars = 0;
      hidden = 0;
      clearUnits(game);
    },
  };
}