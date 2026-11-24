// sprint-3d witness
// Costa Dorada: wires the city, the crowd, the traffic, the player, the police and the story into one
// loop, then keeps the frame going. It owns the title and pause overlays, the wasted and busted
// respawns, the save file, and the four staged screenshot scenes reached with ?shot=.
import { CITY, PLAYER, RANKS, SHOT_SEED } from './config.js';
import { createCity } from './city.js';
import { createInput } from './input.js';
import { createPeds } from './peds.js';
import { createEffects } from './effects.js';
import { createTraffic, createParked, nearestCar, stepTrafficCar, collideWithCars } from './vehicles.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createRenderer } from './render.js';
import { createRenderer3D } from './render3d.js';
import { createHud } from './hud.js';
import { drawTitlePage, drawMapPage, drawGaragePage } from './pages.js';
import { loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';
import { stepBullets } from './combat.js';
import { clamp, createRandom } from './math.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const pageShot = shot === 'title' || shot === 'map' || shot === 'garage' ? shot : null;
const seed = Number(params.get('seed') ?? SHOT_SEED) || SHOT_SEED;

const canvas = document.getElementById('game');
const city = createCity(seed);
const renderer = params.get('render') === '2d' ? createRenderer(canvas, city) : createRenderer3D(canvas, city);
renderer.resize(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1));

const input = createInput(canvas);
const peds = createPeds(seed, city);
const effects = createEffects(seed);
const player = createPlayer(city.landmarks.hideout.x, city.landmarks.hideout.y);
const police = createPolice(seed, city);
const missions = createMissions(seed, city);
const cars = [...createTraffic(seed, city), ...createParked(city)];

const game = {
  city,
  peds,
  effects,
  cars,
  player,
  police,
  missions,
  bullets: [],
  cash: PLAYER.startCash,
  rep: 0,
  kills: 0,
  clockMinutes: 11 * 60 + 25,
  time: 0,
  state: 'title',
  focus: { x: player.x, y: player.y },
  mouseScreen: { x: window.innerWidth * 0.6, y: window.innerHeight * 0.45 },
  aim: { x: player.x, y: player.y },
  random: createRandom(seed + 909),
  nearestCarHint: false,
  shotMode: null,
  respawnTimer: 0,
  saveTimer: 0,
  hud: null,
  view: renderer.view,
  clockText() {
    const total = Math.floor(game.clockMinutes) % (24 * 60);
    const hh = Math.floor(total / 60).toString().padStart(2, '0');
    const mm = (total % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  },
  addCash(amount) {
    game.cash = Math.max(0, game.cash + amount);
  },
  addRep(amount) {
    game.rep = Math.max(0, game.rep + amount);
  },
  onWasted() {
    if (game.state !== 'playing') return;
    game.state = 'wasted';
    game.respawnTimer = PLAYER.respawnDelay;
  },
  onBusted() {
    if (game.state !== 'playing') return;
    game.state = 'busted';
    game.respawnTimer = PLAYER.respawnDelay;
  },
  onMissionComplete(def) {
    game.hud.banner('MISSION PASSED', `${def.title}  ·  +$${def.payout}  ·  REP +${def.rep}`);
    saveGame(game);
  },
  respawn(fee) {
    const car = game.player.inCar;
    if (car) {
      car.kind = 'parked';
      car.driver = null;
      car.speed = 0;
      game.player.inCar = null;
    }
    game.player.x = city.landmarks.hideout.x;
    game.player.y = city.landmarks.hideout.y;
    game.player.health = PLAYER.health;
    game.player.armor = 0;
    game.player.dead = false;
    game.cash = Math.max(0, game.cash - fee);
    game.police.clear(game);
    game.state = 'playing';
    game.focus = { x: game.player.x, y: game.player.y };
    saveGame(game);
  },
};

game.hud = createHud(canvas, city, renderer.view);
window.__costa = game;

if (shot) {
  const stage = pageShot === 'title' ? 'cover' : pageShot === 'garage' ? 'cruise' : pageShot === 'map' ? 'cover' : shot;
  stageShot(game, stage);
  if (pageShot === 'title') game.state = 'title';
  if (pageShot === 'map' || pageShot === 'garage') {
    game.state = 'playing';
    game.missions.completed = pageShot === 'map' ? 2 : 3;
  }
  game.mouseScreen = { x: renderer.view.w * 0.62, y: renderer.view.h * 0.42 };
} else {
  const saved = loadSave();
  if (saved) {
    game.cash = saved.cash;
    game.rep = saved.rep;
    game.missions.index = clamp(saved.index ?? 0, 0, missions.list.length);
    if (saved.finished || saved.index >= missions.list.length) {
      game.missions.index = missions.list.length;
      game.missions.finished = true;
    }
    if (typeof saved.x === 'number' && typeof saved.y === 'number' && !city.hitSolid(saved.x, saved.y, PLAYER.radius)) {
      game.player.x = saved.x;
      game.player.y = saved.y;
    }
    game.clockMinutes = saved.clock ?? game.clockMinutes;
    game.focus = { x: game.player.x, y: game.player.y };
  }
}

const loading = document.getElementById('loading');
if (loading) loading.remove();

function startGame() {
  if (game.state !== 'title') return;
  game.state = 'playing';
  game.hud.notice('WASD TO WALK  ·  MOUSE TO AIM  ·  F TO DRIVE');
}

function updateFocus(dt) {
  const car = game.player.inCar;
  let leadX = 0;
  let leadY = 0;
  if (car) {
    const speed = clamp(Math.abs(car.speed) / car.spec.maxSpeed, 0, 1);
    const ahead = 44 + speed * 86;
    leadX = Math.cos(car.angle) * ahead;
    leadY = Math.sin(car.angle) * ahead;
  }
  const tx = game.player.x + leadX;
  const ty = game.player.y + leadY;
  const k = Math.min(1, dt * 6);
  game.focus.x += (tx - game.focus.x) * k;
  game.focus.y += (ty - game.focus.y) * k;
}

function updateAmbient(dt) {
  game.time += dt;
  for (const car of game.cars) {
    if (car.kind === 'traffic') stepTrafficCar(car, dt, city, { cars: game.cars, peds: game.peds, player: game.player });
  }
  peds.step(dt, city, game.player, game.cars);
  effects.update(dt);
}

function updatePlaying(dt) {
  game.time += dt;
  game.clockMinutes += dt * 1.5;

  const dialogueOpen = missions.state === 'intro' || missions.state === 'outro';
  if (dialogueOpen) {
    updateAmbient(dt);
    if (input.pressed('confirm') || input.pressed('enter') || input.mouse.clicked) {
      missions.advance(game);
    }
    updateFocus(dt);
    game.view = renderer.view;
    return;
  }

  game.aim = renderer.screenToWorld
    ? renderer.screenToWorld(input.mouse.x, input.mouse.y)
    : { x: renderer.camera.x + (input.mouse.x - renderer.view.w / 2), y: renderer.camera.y + (input.mouse.y - renderer.view.h / 2) };
  game.mouseScreen = { x: input.mouse.x, y: input.mouse.y };

  updatePlayer(game.player, game, input, dt, game.aim);

  const world = { cars: game.cars, peds: game.peds, player: game.player };
  for (const car of game.cars) {
    if (car.kind === 'traffic') stepTrafficCar(car, dt, city, world);
    if ((car.kind === 'police' || car.kind === 'enemy') && car.burning) {
      const index = game.cars.indexOf(car);
      if (index >= 0) game.cars.splice(index, 1);
    }
  }
  peds.step(dt, city, game.player, game.cars);
  police.step(game, dt);
  missions.step(game, dt);
  stepBullets(game, dt);
  effects.update(dt);

  game.nearestCarHint = !game.player.inCar && nearestCar(game.cars, game.player.x, game.player.y, 46) !== null;
  updateFocus(dt);
  game.view = renderer.view;

  game.saveTimer += dt;
  if (game.saveTimer > 12) {
    game.saveTimer = 0;
    saveGame(game);
  }
}

function drawOverlay() {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = canvas.width / renderer.view.w;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = renderer.view.w;
  const h = renderer.view.h;

  if (params.get('debug')) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ffef9c';
    ctx.fillText(`player ${game.player.x.toFixed(0)},${game.player.y.toFixed(0)}  focus ${game.focus.x.toFixed(0)},${game.focus.y.toFixed(0)}  cam ${renderer.camera.x.toFixed(0)},${renderer.camera.y.toFixed(0)}  inCar ${game.player.inCar?.type ?? 'none'}`, 12, 74);
  }

  if (pageShot === 'map') {
    drawMapPage(ctx, w, h, game, city);
    return;
  }
  if (pageShot === 'garage') {
    drawGaragePage(ctx, w, h, game);
    return;
  }
  if (game.state === 'title') {
    drawTitlePage(ctx, w, h, game);
  } else if (game.state === 'paused') {
    ctx.fillStyle = 'rgba(6,11,14,0.7)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillStyle = '#f6c96a';
    ctx.fillText('PAUSED', w / 2, h * 0.4);
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillStyle = '#f4ead6';
    ctx.fillText('ESC  RESUME', w / 2, h * 0.5);
    ctx.fillStyle = 'rgba(244,234,214,0.6)';
    ctx.fillText('THE CITY KEEPS MOVING IN THE BACKGROUND', w / 2, h * 0.57);
  } else if (game.state === 'wasted') {
    ctx.fillStyle = 'rgba(60,10,10,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 62px Georgia, serif';
    ctx.fillStyle = '#e0523f';
    ctx.fillText('WASTED', w / 2, h * 0.4);
    ctx.fillStyle = '#f4ead6';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillText(`HOSPITAL FEE  $${PLAYER.wastedFee}`, w / 2, h * 0.5);
  } else if (game.state === 'busted') {
    ctx.fillStyle = 'rgba(10,20,45,0.5)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 62px Georgia, serif';
    ctx.fillStyle = '#8fb8ff';
    ctx.fillText('BUSTED', w / 2, h * 0.4);
    ctx.fillStyle = '#f4ead6';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillText(`BAIL  $${PLAYER.bustedFee}`, w / 2, h * 0.5);
  } else if (game.state === 'complete') {
    ctx.fillStyle = 'rgba(8,16,20,0.65)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillStyle = '#f6c96a';
    ctx.fillText('COSTA DORADA IS YOURS', w / 2, h * 0.36);
    ctx.fillStyle = '#f4ead6';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('every job done. the coast stays open.', w / 2, h * 0.36 + 58);
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(246,201,106,0.8)';
    ctx.fillText('CLICK TO KEEP DRIVING', w / 2, h * 0.55);
  }
}

let last = performance.now();
let running = true;

function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, Math.max(0, raw));
  last = now;

  if (shot) {
    game.view = renderer.view;
    renderer.draw(game);
    if (!pageShot) game.hud.draw(game, 0);
    drawOverlay();
    if (params.get('debug')) {
      const ctx = canvas.getContext('2d');
      const dpr = canvas.width / renderer.view.w;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffef9c';
      ctx.fillText(`player ${game.player.x.toFixed(0)},${game.player.y.toFixed(0)} focus ${game.focus.x.toFixed(0)},${game.focus.y.toFixed(0)} cam ${renderer.camera.x.toFixed(0)},${renderer.camera.y.toFixed(0)} car ${game.player.inCar?.type ?? 'none'}`, 14, 78);
    }
    requestAnimationFrame(frame);
    return;
  }

  if (game.state === 'playing') {
    updatePlaying(dt);
  } else if (game.state === 'title') {
    updateAmbient(dt);
    if (input.pressed('confirm') || input.mouse.clicked || input.pressed('enter')) startGame();
  } else if (game.state === 'paused') {
    updateAmbient(dt);
    if (input.pressed('pause')) game.state = 'playing';
  } else if (game.state === 'wasted' || game.state === 'busted') {
    updateAmbient(dt);
    game.respawnTimer -= dt;
    if (game.respawnTimer <= 0) {
      game.respawn(game.state === 'wasted' ? PLAYER.wastedFee : PLAYER.bustedFee);
    }
  } else if (game.state === 'complete') {
    updateAmbient(dt);
    if (input.mouse.clicked || input.pressed('confirm')) game.state = 'playing';
  }

  if (game.state === 'playing' && input.pressed('pause')) game.state = 'paused';

  renderer.draw(game);
  game.hud.draw(game, dt);
  drawOverlay();
  input.endFrame();
  if (running) requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1));
  game.view = renderer.view;
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && game.state === 'title') startGame();
});

requestAnimationFrame(frame);