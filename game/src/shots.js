// sprint-3d witness
// Four staged scenes for the four screenshots: each one puts the player, the traffic, the cops, the
// crew and the job objective where the camera can read them together. A shot URL turns the game into
// a still, so the same code that plays also poses.
import { createCar, createParked } from './vehicles.js';

function cleanWorld(game) {
  const city = game.city;
  game.police.clear(game);
  game.cars.length = 0;
  for (const car of createParked(city)) game.cars.push(car);
  game.missions.enemies.length = 0;
  game.missions.chasers.length = 0;
  game.bullets.length = 0;
  game.effects.particles.length = 0;
  game.player.inCar = null;
  game.player.dead = false;
  game.player.health = 100;
  game.player.armor = 100;
  game.cash = 12480;
  game.rep = 540;
  game.clockMinutes = 11 * 60 + 25;
  game.time = 8.4;
  game.player.muzzle = 0;
  game.missions.marker = null;
  game.missions.kills = 0;
  game.missions.totalKills = 0;
}

function trafficCar(game, type, x, y, angle, color, cruise = 110) {
  const car = createCar(type, x, y, angle, color, { kind: 'traffic' });
  car.cruise = cruise;
  car.speed = cruise;
  game.cars.push(car);
  return car;
}

function copCar(game, x, y, angle) {
  const car = createCar('police', x, y, angle, '#202b4a', { kind: 'police', siren: true });
  car.health = 170;
  game.cars.push(car);
  game.police.units.push({ kind: 'car', car, x, y, health: 170, dead: false, shootTimer: 9, stuck: 0, lastX: x, lastY: y });
  return car;
}

function footCop(game, x, y, angle) {
  game.police.units.push({ kind: 'foot', x, y, angle, health: 70, dead: false, shootTimer: 9, stuck: 0, lastX: x, lastY: y });
}

function crew(game, x, y, boss = false, angle = 0) {
  const enemy = {
    id: game.missions.enemies.length,
    x,
    y,
    angle: angle === 0 ? Math.atan2(game.player.y - y, game.player.x - x) : angle,
    health: boss ? 180 : 65,
    maxHealth: boss ? 180 : 65,
    boss,
    dead: false,
    shootTimer: 9,
    speed: 92,
  };
  game.missions.enemies.push(enemy);
  return enemy;
}

function setMission(game, index, stage, marker = null, kills = 0, total = 0) {
  const missions = game.missions;
  missions.index = index;
  missions.def = missions.list[index];
  missions.state = 'active';
  missions.stage = stage;
  missions.marker = marker;
  missions.kills = kills;
  missions.totalKills = total;
  missions.dialogue = { lines: [], i: 0, mode: 'intro' };
}

function placePlayerInCar(game, type, x, y, angle, color, speed) {
  const car = createCar(type, x, y, angle, color, { kind: 'player' });
  car.speed = speed;
  car.health = 100;
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
}

export function stageShot(game, kind) {
  cleanWorld(game);
  const city = game.city;
  const peds = game.peds.peds;
  game.player.muzzle = 0;

  if (kind === 'cover') {
    const x = 3991;
    const y = 1500;
    const spyder = placePlayerInCar(game, 'sports', x, y, Math.PI / 2, '#d64230', 300);
    spyder.health = 82;
    copCar(game, x + 84, 1760, Math.PI / 2);
    copCar(game, x - 80, 1800, Math.PI / 2);
    copCar(game, 4049, 1745, -Math.PI / 2);
    footCop(game, 3978, 1568, Math.PI * 0.75);
    trafficCar(game, 'sedan', x, 1740, Math.PI / 2, '#d9d4c7', 120);
    trafficCar(game, 'taxi', 4049, 1650, -Math.PI / 2, '#e8b83a', 105);
    trafficCar(game, 'van', x, 1820, Math.PI / 2, '#8fb3c9', 110);
    trafficCar(game, 'pickup', 4049, 1760, -Math.PI / 2, '#7d9b76', 95);
    peds.slice(0, 6).forEach((ped, i) => {
      ped.dead = false;
      ped.x = 4112 + (i * 47) % 92;
      ped.y = 1412 + (i * 61) % 176;
      ped.state = 'walk';
      ped.angle = Math.PI / 2;
    });
    setMission(game, 4, 2);
    game.police.setStars(4);
    game.focus = { x: 4012, y: 1448 };
    game.player.health = 88;
  } else if (kind === 'onfoot') {
    // Plaza centre, facing east: the player is central, the crew is 80–140 units directly ahead.
    game.player.x = 960;
    game.player.y = 1680;
    game.player.angle = 0;
    game.player.health = 72;
    game.player.armor = 45;
    game.player.muzzle = 0.04;
    crew(game, 1090, 1650);
    crew(game, 1105, 1720);
    crew(game, 1085, 1760);
    const boss = crew(game, 1110, 1690, true);
    boss.health = 140;
    copCar(game, 1180, 1860, Math.PI);
    footCop(game, 1090, 1860, Math.PI);
    game.police.setStars(2);
    setMission(game, 1, 1, { x: 1120, y: 1680, kind: 'kill' }, 2, 5);
    const dead = peds.find((p) => !p.dead);
    if (dead) {
      dead.dead = true;
      dead.down = true;
      dead.state = 'down';
      dead.x = 1014;
      dead.y = 1632;
      dead.angle = 0.6;
    }
    peds.slice(1, 7).forEach((ped, i) => {
      if (ped.dead) return;
      ped.x = 842 + (i % 3) * 30;
      ped.y = 1604 + Math.floor(i / 3) * 26;
      ped.state = 'flee';
      ped.panic = 8;
      ped.angle = Math.PI;
    });
    game.effects.blood(1044, 1652, 0.3);
    game.effects.muzzle(972, 1680, 0);
    game.bullets.push({ x: 990, y: 1682, vx: 900, vy: 0, life: 0.6, damage: 26, owner: 'player' });
    game.focus = { x: 1000, y: 1700 };
  } else if (kind === 'cruise') {
    const x = 3991;
    const y = 2330;
    placePlayerInCar(game, 'sports', x, y, Math.PI / 2, '#d64230', 255);
    trafficCar(game, 'sedan', x, 2460, Math.PI / 2, '#8fb3c9', 120);
    trafficCar(game, 'van', 4049, 2410, -Math.PI / 2, '#d9d4c7', 100);
    trafficCar(game, 'taxi', x, 2560, Math.PI / 2, '#e8b83a', 110);
    trafficCar(game, 'pickup', 4049, 2280, -Math.PI / 2, '#7d9b76', 90);
    const chase1 = createCar('sports', 3991, 2230, Math.PI / 2, '#2f4658', { kind: 'enemy' });
    chase1.speed = 240;
    const chase2 = createCar('pickup', 3991, 2170, Math.PI / 2, '#7b3f32', { kind: 'enemy' });
    chase2.speed = 230;
    game.cars.push(chase1, chase2);
    game.missions.chasers.push({ car: chase1, shootTimer: 9 }, { car: chase2, shootTimer: 9 });
    peds.slice(0, 5).forEach((ped, i) => {
      ped.dead = false;
      ped.x = 4104 + (i * 53) % 88;
      ped.y = 2300 + (i * 57) % 150;
      ped.state = 'walk';
    });
    setMission(game, 3, 2, { ...city.landmarks.overlook, kind: 'chase' });
    game.focus = { x: 4014, y: 2240 };
  } else if (kind === 'heist') {
    const x = 1990;
    const y = 760;
    const van = placePlayerInCar(game, 'armored', x, y, 0, '#ded6bd', 175);
    van.health = 74;
    copCar(game, 1760, 740, 0);
    copCar(game, 1650, 800, 0);
    copCar(game, 1860, 480, Math.PI / 2);
    footCop(game, 1908, 700, 0.4);
    trafficCar(game, 'sedan', 2130, 740, 0, '#d9d4c7', 110);
    trafficCar(game, 'van', 2250, 820, Math.PI, '#8fb3c9', 100);
    peds.slice(0, 6).forEach((ped, i) => {
      ped.dead = false;
      ped.x = 1840 + i * 26;
      ped.y = 712;
      ped.state = 'flee';
      ped.panic = 6;
    });
    setMission(game, 2, 3);
    game.police.setStars(4);
    game.focus = { x: 1966, y: 742 };
    game.player.health = 64;
    game.player.armor = 30;
  }

  game.player.x = game.player.inCar ? game.player.inCar.x : game.player.x;
  game.player.y = game.player.inCar ? game.player.inCar.y : game.player.y;
  game.state = 'playing';
  game.shotMode = kind;
  window.__shot = kind;
}