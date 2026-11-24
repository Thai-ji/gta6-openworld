// sprint-3d witness
// Bullets, the only combat object in the game: the player's pistol round, the police's, and the
// crew's. A round is a short line that walks forward in two steps a frame and stops at the first
// wall, car, body or cop it meets, so the HUD never has to know who fired it.
import { PLAYER, POLICE } from './config.js';
import { damageCar } from './vehicles.js';
import { damagePlayer } from './player.js';

export function fire(game, x, y, angle, owner, overrides = {}) {
  const speed = overrides.speed ?? (owner === 'player' ? PLAYER.bulletSpeed : POLICE.bullets.speed);
  const damage = overrides.damage ?? (owner === 'player' ? PLAYER.bulletDamage : POLICE.bullets.damage);
  const life = overrides.life ?? (owner === 'player' ? PLAYER.bulletLife : POLICE.bullets.life);
  const spread = overrides.spread ?? 0;
  const a = angle + (spread ? (game.random() - 0.5) * spread : 0);
  game.bullets.push({
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    life,
    damage,
    owner,
  });
}

function nearest(list, x, y, radius) {
  let best = null;
  let bestD = radius * radius;
  for (const item of list) {
    if (item.dead) continue;
    const dx = item.x - x;
    const dy = item.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

export function stepBullets(game, dt) {
  const { bullets, city, effects } = game;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    let gone = false;
    for (let s = 0; s < 2 && !gone; s += 1) {
      b.x += (b.vx * dt) / 2;
      b.y += (b.vy * dt) / 2;
      b.life -= dt / 2;
      if (b.life <= 0 || city.hitSolid(b.x, b.y, 2)) {
        effects.sparks(b.x, b.y, Math.atan2(b.vy, b.vx));
        gone = true;
        break;
      }

      if (b.owner === 'player') {
        if (game.missions.hitEnemy(b.x, b.y, b.damage)) {
          effects.blood(b.x, b.y, Math.atan2(b.vy, b.vx));
          gone = true;
          break;
        }
        if (game.police.hitUnit(b.x, b.y, b.damage)) {
          effects.blood(b.x, b.y, Math.atan2(b.vy, b.vx));
          gone = true;
          break;
        }
        const ped = nearest(game.peds.peds, b.x, b.y, 9);
        if (ped) {
          game.peds.hit(ped);
          effects.blood(b.x, b.y, Math.atan2(b.vy, b.vx));
          game.peds.alarm(ped.x, ped.y, 330);
          game.police.addWanted(1);
          gone = true;
          break;
        }
        for (const car of game.cars) {
          if (car.burning || car.kind === 'player') continue;
          const d = Math.hypot(car.x - b.x, car.y - b.y);
          if (d < car.length * 0.3) {
            damageCar(car, b.damage, effects);
            effects.sparks(b.x, b.y, Math.atan2(b.vy, b.vx));
            gone = true;
            break;
          }
        }
      } else {
        const p = game.player;
        if (p.dead) break;
        if (p.inCar) {
          const car = p.inCar;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 15) {
            damageCar(car, b.damage, effects);
            damagePlayer(game, b.damage * 0.45);
            effects.sparks(b.x, b.y, Math.atan2(b.vy, b.vx));
            gone = true;
            break;
          }
        } else if (Math.hypot(p.x - b.x, p.y - b.y) < 10) {
          damagePlayer(game, b.damage);
          effects.blood(b.x, b.y, Math.atan2(b.vy, b.vx));
          gone = true;
          break;
        }
      }
    }
    if (gone) bullets.splice(i, 1);
  }
}