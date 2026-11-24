// sprint-3d witness
// The body the person controls: walking, sprinting, aiming at the pointer, shooting, and climbing
// into or out of any car within reach. Driving itself is the car's model in vehicles.js; this file
// only feeds the pedals and decides where the player stands when they get out.
import { PLAYER } from './config.js';
import { clamp, dist } from './math.js';
import { fire } from './combat.js';
import { nearestCar, stepFreeCar, collideWithCars } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    armor: PLAYER.armor,
    inCar: null,
    fireTimer: 0,
    muzzle: 0,
    moving: false,
    dead: false,
    stepPhase: 0,
    kills: 0,
  };
}

function moveWalking(player, game, dx, dy, speed, dt) {
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const nx = (dx / len) * speed * dt;
  const ny = (dy / len) * speed * dt;
  const city = game.city;
  if (!city.hitSolid(player.x + nx, player.y, PLAYER.radius)) player.x += nx;
  if (!city.hitSolid(player.x, player.y + ny, PLAYER.radius)) player.y += ny;
  player.stepPhase += speed * dt * 0.09;
}

function enterCar(game, car) {
  if (!car || car.kind === 'police' || car.burning) return false;
  if (car.kind === 'traffic') {
    game.police.addWanted(1);
    game.effects.float('CARJACKED', car.x, car.y - 30, '#ffcf6b');
    game.peds.alarm(car.x, car.y, 260);
  }
  car.kind = 'player';
  car.driver = 'player';
  car.cruise = 0;
  car.speed = 0;
  car.stolen = true;
  game.player.inCar = car;
  game.effects.float(car.type === 'sports' ? 'NICE RIDE' : 'HOT WIRE', car.x, car.y - 34, '#cfe8ff');
  return true;
}

function exitCar(game) {
  const car = game.player.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  const options = [
    { x: car.x + Math.cos(side) * (car.length * 0.55 + 8), y: car.y + Math.sin(side) * (car.length * 0.55 + 8) },
    { x: car.x - Math.cos(side) * (car.length * 0.55 + 8), y: car.y - Math.sin(side) * (car.length * 0.55 + 8) },
    { x: car.x - Math.cos(car.angle) * (car.length * 0.55 + 8), y: car.y - Math.sin(car.angle) * (car.length * 0.55 + 8) },
  ];
  const spot = options.find((p) => !game.city.hitSolid(p.x, p.y, PLAYER.radius + 2));
  if (!spot) return;
  game.player.x = spot.x;
  game.player.y = spot.y;
  game.player.angle = car.angle;
  car.kind = 'parked';
  car.driver = null;
  car.speed = 0;
  game.player.inCar = null;
}

export function damagePlayer(game, amount) {
  const player = game.player;
  if (player.dead) return;
  let left = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, left * 0.6);
    player.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  game.effects.state.shake = Math.min(10, game.effects.state.shake + 1.6);
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    game.onWasted();
  }
}

export function updatePlayer(player, game, input, dt, aim) {
  if (player.dead) return;
  player.muzzle = Math.max(0, player.muzzle - dt);

  if (player.inCar) {
    const car = player.inCar;
    const throttle = (input.down('up') ? 1 : 0) - (input.down('down') ? 1 : 0);
    const steer = input.moveX();
    const brake = input.down('confirm');
    stepFreeCar(car, { throttle, steer, brake }, dt, game.city, game.effects);
    collideWithCars(car, game.cars, game.effects);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.moving = Math.abs(car.speed) > 12;
    if (input.pressed('enter')) exitCar(game);
    return;
  }

  const dx = input.moveX();
  const dy = input.moveY();
  const sprint = input.down('run');
  const speed = sprint ? PLAYER.sprint : PLAYER.walk;
  moveWalking(player, game, dx, dy, speed, dt);
  player.moving = dx !== 0 || dy !== 0;

  if (aim) player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
  player.fireTimer = Math.max(0, player.fireTimer - dt);

  const shooting = input.mouse.down;
  if (shooting && player.fireTimer <= 0) {
    const mx = player.x + Math.cos(player.angle) * 14;
    const my = player.y + Math.sin(player.angle) * 14 - 2;
    fire(game, mx, my, player.angle, 'player', { spread: 0.035 });
    game.effects.muzzle(mx, my, player.angle);
    player.muzzle = 0.06;
    player.fireTimer = PLAYER.fireDelay;
    game.police.addWanted(PLAYER.shootWanted);
    game.peds.alarm(mx, my, 420);
  }

  if (input.pressed('enter')) {
    const car = nearestCar(game.cars, player.x, player.y, 46);
    if (car) enterCar(game, car);
  }
}

export function playerSpawn(city) {
  const spot = city.landmarks.hideout;
  return createPlayer(spot.x, spot.y);
}