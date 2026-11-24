// sprint-3d witness
// The story: five jobs that walk Marco Vela from a borrowed car to the coast, each with its own
// intro dialogue, its marker, a stage that checks itself, armed crew who shoot back, and a payout.
// The mission is data; the state here runs one job at a time and the HUD reads its marker and text.
import { clamp, dist } from './math.js';
import { createCar, stepFreeCar, collideWithCars } from './vehicles.js';
import { fire } from './combat.js';

export const STORY_TITLE = 'COSTA DORADA';

const MISSIONS = [
  {
    num: 1,
    title: 'OFF THE BOOKS',
    start: 'hideout',
    intro: [
      { who: 'INES', text: 'Cousin. This coast runs on cash and favors, and you just ran out of both.' },
      { who: 'INES', text: 'Take any car off the street. The market boys will not ask for the keys.' },
      { who: 'MARCO', text: 'And if the owner asks?' },
      { who: 'INES', text: 'You smile. Bring it to the fruit stalls at Mercado Viejo. Try not to get famous.' },
    ],
    stages: [
      { kind: 'enterCar', text: 'Steal any car off the street' },
      { kind: 'goto', at: 'mercado', radius: 64, inCar: true, text: 'Deliver the car to Mercado Viejo' },
    ],
    outro: [
      { who: 'INES', text: 'Not bad for a delivery boy. That is your first honest crime.' },
      { who: 'INES', text: 'Keep the car. The next job pays better.' },
    ],
    payout: 250,
    rep: 60,
  },
  {
    num: 2,
    title: 'BAD BLOOD',
    start: 'downtown',
    intro: [
      { who: 'INES', text: 'Salas boys put Tio Ramon in the hospital over a delivery cut.' },
      { who: 'INES', text: 'They drink at the old cannery yard on the marina. Go show them the door.' },
      { who: 'MARCO', text: 'Five of them, one of me.' },
      { who: 'INES', text: 'Six, if you count the one who runs. Take the pistol.' },
    ],
    stages: [
      { kind: 'goto', at: 'warehouse', radius: 78, text: 'Meet the crew at the cannery yard' },
      { kind: 'kill', count: 5, wanted: 2, text: 'Take out the Salas crew' },
      { kind: 'escape', text: 'Lose the cops' },
    ],
    outro: [
      { who: 'INES', text: 'Salas will hear about this by sunset. Good. He should know your name.' },
      { who: 'INES', text: 'Take the back streets home. And Marco? Thank you.' },
    ],
    payout: 400,
    rep: 90,
  },
  {
    num: 3,
    title: 'THE MERIDIAN JOB',
    start: 'bank',
    intro: [
      { who: 'INES', text: 'The Meridian moves its cash on Fridays. One armored van, two lazy guards, one narrow alley.' },
      { who: 'INES', text: 'Take the van before the escort wakes up, then bring it to the marina.' },
      { who: 'MARCO', text: 'Stealing from a bank is a big step from stealing a hatchback.' },
      { who: 'INES', text: 'That is why it pays seven hundred.' },
    ],
    stages: [
      { kind: 'goto', at: 'bankAlley', radius: 62, text: 'Get to the bank service alley' },
      { kind: 'stealCar', type: 'armored', at: 'bankAlley', target: 'van', wanted: 2, text: 'Steal the Meridian armored van' },
      { kind: 'deliver', at: 'marina', target: 'van', radius: 66, text: 'Deliver the van to the marina' },
      { kind: 'escape', text: 'Lose the cops' },
    ],
    outro: [
      { who: 'INES', text: 'The Meridian is calling it a maintenance error. Reyes is calling it a war.' },
      { who: 'INES', text: 'Your share is in the glove box. Do not spend it on the same street twice.' },
    ],
    payout: 700,
    rep: 140,
  },
  {
    num: 4,
    title: 'SUNSET RUN',
    start: 'marina',
    intro: [
      { who: 'INES', text: 'A collector up the coast wants the red Spyder by sundown. There is one in the marina lot.' },
      { who: 'INES', text: 'Salas runners will try to take it off you. Do not stop for anyone.' },
      { who: 'MARCO', text: 'And the collector?' },
      { who: 'INES', text: 'He pays cash, asks nothing. My favorite kind of man.' },
    ],
    stages: [
      { kind: 'goto', at: 'marinaLot', radius: 62, text: 'Find the red Spyder in the marina lot' },
      { kind: 'stealCar', type: 'sports', at: 'marinaLot', target: 'spyder', text: 'Take the Spyder' },
      { kind: 'chase', at: 'overlook', target: 'spyder', radius: 68, chasers: 2, text: 'Outrun the Salas runners to the overlook' },
    ],
    outro: [
      { who: 'INES', text: 'He took the car and left a briefcase. I counted it twice.' },
      { who: 'INES', text: 'Salas is losing his grip. That is when a man like him gets dangerous.' },
    ],
    payout: 800,
    rep: 180,
  },
  {
    num: 5,
    title: 'KING OF THE COAST',
    start: 'hideout',
    intro: [
      { who: 'INES', text: 'Salas is at the cannery with what is left of his crew. He knows we are coming.' },
      { who: 'MARCO', text: 'And Reyes?' },
      { who: 'INES', text: 'Reyes has four cars on the marina road. After this, there is no road back.' },
      { who: 'INES', text: 'Marco. When it is done, the coast is ours. Or it is nobody\'s.' },
    ],
    stages: [
      { kind: 'goto', at: 'warehouse', radius: 78, text: 'Drive to the cannery yard' },
      { kind: 'kill', count: 6, boss: true, wanted: 4, text: 'Take the yard from Hector Salas' },
      { kind: 'escape', text: 'Escape the dragnet' },
    ],
    outro: [
      { who: 'INES', text: 'It is done. The Meridian, the marina, the whole coast will remember tonight.' },
      { who: 'MARCO', text: 'Let them remember quietly. I am going to sleep for a week.' },
      { who: 'INES', text: 'Costa Dorada is yours, Marco. Try to be the kind of king it deserves.' },
    ],
    payout: 2000,
    rep: 400,
  },
];

function pointFor(city, at) {
  if (city.landmarks[at]) return { ...city.landmarks[at] };
  if (at === 'bankAlley') {
    const p = city.sidePoint(5, 1, 'west');
    return { x: p.x - 60, y: p.y };
  }
  if (at === 'marinaLot') {
    const b = city.blockAt(9, 7);
    return { x: b.x + b.w * 0.5, y: b.y + b.h * 0.5 };
  }
  return { ...city.landmarks.warehouse };
}

function spawnCrew(game, center, count, boss) {
  const enemies = game.missions.enemies;
  for (let i = 0; i < count + (boss ? 1 : 0); i += 1) {
    const a = (i / (count + 1)) * Math.PI * 2;
    const r = 46 + (i % 3) * 20;
    let x = center.x + Math.cos(a) * r;
    let y = center.y + Math.sin(a) * r;
    if (game.city.hitSolid(x, y, 10)) {
      x = center.x + Math.cos(a + 0.7) * (r + 26);
      y = center.y + Math.sin(a + 0.7) * (r + 26);
    }
    const isBoss = boss && i === count + (boss ? 1 : 0) - 1;
    enemies.push({
      id: i,
      x,
      y,
      angle: a + Math.PI,
      health: isBoss ? 180 : 65,
      maxHealth: isBoss ? 180 : 65,
      boss: isBoss,
      dead: false,
      shootTimer: 0.8 + i * 0.14,
      speed: 92,
    });
  }
}

function spawnChasers(game, center) {
  const chasers = game.missions.chasers;
  for (let i = 0; i < 2; i += 1) {
    const p = game.city.lanePoint('h', 7, -1, center.x + 120 + i * 90);
    const car = createCar(i === 0 ? 'sports' : 'pickup', p.x, p.y, p.angle, i === 0 ? '#2f4658' : '#7b3f32', { kind: 'enemy' });
    car.health = 240;
    game.cars.push(car);
    chasers.push({ car, shootTimer: 2.6 });
  }
}

export function createMissions(seed, city) {
  const missions = {
    list: MISSIONS,
    index: 0,
    state: 'idle',
    def: null,
    stage: 0,
    kills: 0,
    totalKills: 0,
    marker: null,
    targetCar: null,
    enemies: [],
    chasers: [],
    dialogue: { lines: [], i: 0, mode: 'intro' },
    completed: 0,
    finished: false,

    get objective() {
      if (this.state === 'idle') return this.index < MISSIONS.length ? `Next job: ${MISSIONS[this.index].title}` : 'The coast is yours';
      const stage = this.def.stages[this.stage];
      if (!stage) return '';
      if (stage.kind === 'kill') return `${stage.text} (${this.kills}/${this.totalKills})`;
      if (stage.kind === 'escape') return `${stage.text}`;
      return stage.text;
    },

    get startPoint() {
      if (this.state !== 'idle' || this.index >= MISSIONS.length) return null;
      return pointFor(city, MISSIONS[this.index].start);
    },

    begin(game, index) {
      this.index = index;
      this.def = MISSIONS[index];
      this.state = 'intro';
      this.stage = 0;
      this.kills = 0;
      this.totalKills = 0;
      this.enemies.length = 0;
      this.chasers.length = 0;
      this.marker = null;
      this.targetCar = null;
      this.dialogue = { lines: this.def.intro, i: 0, mode: 'intro' };
    },

    advance(game) {
      if (this.state !== 'intro' && this.state !== 'outro') return;
      this.dialogue.i += 1;
      if (this.dialogue.i < this.dialogue.lines.length) return;
      if (this.dialogue.mode === 'intro') {
        this.state = 'active';
        this.beginStage(game);
      } else {
        this.state = 'idle';
        this.def = null;
        this.marker = null;
        this.targetCar = null;
        this.enemies.length = 0;
        this.clearChasers(game);
        if (this.index >= MISSIONS.length) this.finished = true;
      }
    },

    beginStage(game) {
      const stage = this.def.stages[this.stage];
      if (!stage) return;
      if (stage.kind === 'goto' || stage.kind === 'deliver' || stage.kind === 'chase' || stage.kind === 'kill') {
        this.marker = { ...pointFor(city, stage.at), kind: stage.kind };
      } else {
        this.marker = null;
      }
      if (stage.kind === 'kill') {
        this.totalKills = stage.count + (stage.boss ? 1 : 0);
        spawnCrew(game, pointFor(city, stage.at), stage.count, stage.boss);
        game.police.addWanted(stage.wanted ?? 1);
        game.effects.state.shake = Math.min(7, game.effects.state.shake + 2);
      }
      if (stage.kind === 'stealCar') {
        const p = pointFor(city, stage.at);
        const car = createCar(stage.type, p.x + 24, p.y + 10, -Math.PI / 2, stage.type === 'sports' ? '#d64230' : '#5d675e', { kind: 'parked' });
        car.health = 10000;
        car.missionTarget = stage.target;
        game.cars.push(car);
        this.targetCar = car;
        this.marker = { ...p, kind: 'target' };
      }
      if (stage.kind === 'chase') {
        spawnChasers(game, this.marker ?? { x: 0, y: 0 });
      }
    },

    hitEnemy(x, y, damage) {
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (Math.hypot(enemy.x - x, enemy.y - y) < 12) {
          enemy.health -= damage;
          if (enemy.health <= 0) {
            enemy.dead = true;
            this.kills += 1;
          }
          return true;
        }
      }
      return false;
    },

    clearChasers(game) {
      for (const chase of this.chasers) {
        const i = game.cars.indexOf(chase.car);
        if (i >= 0) game.cars.splice(i, 1);
      }
      this.chasers.length = 0;
    },

    step(game, dt) {
      if (this.state === 'idle' && this.index < MISSIONS.length) {
        const start = this.startPoint;
        if (start && dist(game.player.x, game.player.y, start.x, start.y) < 54) {
          if (game.player.inCar) return;
          this.begin(game, this.index);
        }
        return;
      }
      if (this.state !== 'active') return;

      const player = game.player;
      const stage = this.def.stages[this.stage];

      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const d = Math.hypot(dx, dy) || 1;
        enemy.angle = Math.atan2(dy, dx);
        if (d > 190) {
          const nx = (dx / d) * enemy.speed * dt;
          const ny = (dy / d) * enemy.speed * dt;
          if (!game.city.hitSolid(enemy.x + nx, enemy.y, 8)) enemy.x += nx;
          if (!game.city.hitSolid(enemy.x, enemy.y + ny, 8)) enemy.y += ny;
        } else if (d < 95) {
          enemy.x -= (dx / d) * enemy.speed * 0.5 * dt;
          enemy.y -= (dy / d) * enemy.speed * 0.5 * dt;
        }
        enemy.shootTimer -= dt;
        if (d < 520 && enemy.shootTimer <= 0 && !player.dead) {
          enemy.shootTimer = 1.1 + (enemy.boss ? 0.1 : 0.35);
          fire(game, enemy.x + Math.cos(enemy.angle) * 10, enemy.y + Math.sin(enemy.angle) * 10, enemy.angle, 'enemy', { spread: 0.2, damage: 6 });
          game.effects.muzzle(enemy.x, enemy.y, enemy.angle);
        }
      }

      for (const chase of this.chasers) {
        const car = chase.car;
        if (car.burning) continue;
        const target = player.inCar ? player.inCar : player;
        const dx = target.x - car.x;
        const dy = target.y - car.y;
        const d = Math.hypot(dx, dy) || 1;
        const desired = Math.atan2(dy, dx);
        const steer = clamp(Math.atan2(Math.sin(desired - car.angle), Math.cos(desired - car.angle)) * 2.2, -1, 1);
        stepFreeCar(car, { throttle: 1, steer, brake: false }, dt, game.city, game.effects);
        collideWithCars(car, game.cars, game.effects);
        chase.x = car.x;
        chase.y = car.y;
      }

      if (stage.kind === 'enterCar') {
        if (player.inCar) this.completeStage(game);
        return;
      }

      if (stage.kind === 'goto') {
        if (this.marker && dist(player.x, player.y, this.marker.x, this.marker.y) < stage.radius) {
          if (stage.inCar && !player.inCar) {
            if (game.time - (this.hintTime ?? -9) > 3) {
              this.hintTime = game.time;
              game.effects.float('GET IN A CAR', player.x, player.y - 26, '#ffd98a');
            }
            return;
          }
          this.completeStage(game);
        }
        return;
      }

      if (stage.kind === 'stealCar') {
        if (player.inCar && player.inCar === this.targetCar) {
          game.police.addWanted(stage.wanted ?? 1);
          this.completeStage(game);
        }
        return;
      }

      if (stage.kind === 'deliver') {
        if (player.inCar && player.inCar === this.targetCar && this.marker && dist(player.x, player.y, this.marker.x, this.marker.y) < stage.radius) {
          this.completeStage(game);
        }
        return;
      }

      if (stage.kind === 'kill') {
        if (this.kills >= this.totalKills) this.completeStage(game);
        return;
      }

      if (stage.kind === 'escape') {
        if (game.police.stars === 0) this.completeStage(game);
        return;
      }

      if (stage.kind === 'chase') {
        if (player.inCar && player.inCar === this.targetCar && this.marker && dist(player.x, player.y, this.marker.x, this.marker.y) < stage.radius) {
          this.completeStage(game);
        }
        return;
      }
    },

    completeStage(game) {
      this.hintTime = null;
      this.stage += 1;
      if (this.stage >= this.def.stages.length) {
        game.addCash(this.def.payout);
        game.addRep(this.def.rep);
        game.effects.float(`MISSION COMPLETE  +$${this.def.payout}`, game.player.x, game.player.y - 44, '#8ff0b8');
        this.completed = this.def.num;
        const finishedDef = this.def;
        this.state = 'outro';
        this.dialogue = { lines: finishedDef.outro, i: 0, mode: 'outro' };
        this.marker = null;
        this.index = this.def.num;
        this.def = finishedDef;
        if (game.onMissionComplete) game.onMissionComplete(finishedDef);
        return;
      }
      this.beginStage(game);
    },
  };
  return missions;
}