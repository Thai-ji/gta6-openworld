// Every number that shapes Costa Dorada lives here: the city grid, the player's legs and gun,
// each kind of car, the traffic and crowd sizes, the police response and the money. The drawing
// and HUD modules read the same values, so the game's feel can be retuned in one place.
export const CITY = {
  cols: 11,
  rows: 8,
  block: 240,
  road: 120,
  beach: 170,
  water: 340,
  sidewalk: 14,
  lane: 29,
};

export const PLAYER = {
  walk: 168,
  sprint: 262,
  radius: 9,
  health: 100,
  armor: 100,
  fireDelay: 0.15,
  bulletSpeed: 1250,
  bulletDamage: 26,
  bulletLife: 0.8,
  respawnDelay: 2.4,
  wastedFee: 200,
  bustedFee: 300,
  startCash: 350,
  shootWanted: 1,
};

export const CARS = {
  sedan: { width: 22, length: 42, maxSpeed: 235, accel: 215, turn: 2.55, drag: 0.9, brake: 330 },
  taxi: { width: 22, length: 44, maxSpeed: 240, accel: 220, turn: 2.5, drag: 0.9, brake: 330 },
  van: { width: 26, length: 53, maxSpeed: 195, accel: 155, turn: 2.15, drag: 0.85, brake: 300 },
  sports: { width: 24, length: 46, maxSpeed: 335, accel: 360, turn: 2.95, drag: 0.86, brake: 380 },
  pickup: { width: 24, length: 50, maxSpeed: 210, accel: 185, turn: 2.2, drag: 0.88, brake: 300 },
  armored: { width: 28, length: 57, maxSpeed: 180, accel: 135, turn: 1.85, drag: 0.82, brake: 280 },
  police: { width: 24, length: 48, maxSpeed: 292, accel: 285, turn: 2.9, drag: 0.9, brake: 380 },
};

export const TRAFFIC = {
  cars: 54,
  peds: 88,
  speedMin: 95,
  speedMax: 168,
  wrap: 260,
  brakeGap: 96,
};

export const POLICE = {
  unitsByStars: [0, 1, 2, 2, 3, 4],
  spawnDelay: [0, 1.6, 1.4, 1.2, 1.0, 0.8],
  spawnNear: [0, 760, 820, 900, 980, 1080],
  hiddenDecay: 7.5,
  starFloorTime: 2.5,
  footAtStars: 3,
  arrestRange: 34,
  bullets: { speed: 860, damage: 7, life: 1.1 },
};

export const ECONOMY = {
  missionPayouts: [0, 0, 0, 0, 0, 0],
  pedKillReward: 0,
  heatPerCrime: 1,
};

export const RANKS = [
  { rep: 0, name: 'ROOKIE' },
  { rep: 260, name: 'RUNNER' },
  { rep: 620, name: 'HITTER' },
  { rep: 1080, name: 'OPERATOR' },
  { rep: 1660, name: 'CONNECTED' },
  { rep: 2400, name: 'KINGPIN' },
  { rep: 3400, name: 'COAST KING' },
];

export const SAVE_KEY = 'costa-dorada-save-v1';
export const SHOT_SEED = 7;