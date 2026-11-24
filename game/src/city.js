// sprint-3d witness
// The city itself: an 11 by 8 grid of blocks around a road network, three districts of different
// height and colour, a beach and the sea on the east side, and the landmarks the story uses. It
// generates every building, palm, lamp, parked car and collision box from one seed, and answers the
// queries the simulation needs: what is solid, where a lane runs, where a block's sidewalk is.
import { CITY } from './config.js';
import { createRandom, rand, randInt, pick, chance, clamp } from './math.js';

export const DISTRICTS = {
  hills: {
    name: 'LOS BRISAS',
    roofs: ['#d9c9ad', '#c9b493', '#e4d6bb', '#b7a78c', '#d8bfa6'],
    floors: [1, 3],
  },
  centro: {
    name: 'CENTRO',
    roofs: ['#dfc9b0', '#c9b39a', '#e8d9c2', '#b8a48e', '#d3a489', '#e3cbb3'],
    floors: [3, 11],
  },
  marina: {
    name: 'MARINA SALAS',
    roofs: ['#a4b3ab', '#bab8a5', '#8fa4a1', '#c3b49a', '#9fae9d'],
    floors: [1, 3],
  },
};

export function createCity(seed = 11) {
  const rng = createRandom(seed);
  const pitch = CITY.block + CITY.road;
  const cityW = CITY.cols * pitch + CITY.road;
  const cityH = CITY.rows * pitch + CITY.road;
  const beachX = cityW;
  const waterX = cityW + CITY.beach;
  const width = waterX + CITY.water;
  const height = cityH;

  const vertical = [];
  for (let i = 0; i <= CITY.cols; i += 1) {
    const x0 = i * pitch;
    vertical.push({ index: i, x0, x1: x0 + CITY.road, center: x0 + CITY.road / 2 });
  }
  const horizontal = [];
  for (let i = 0; i <= CITY.rows; i += 1) {
    const y0 = i * pitch;
    horizontal.push({ index: i, y0, y1: y0 + CITY.road, center: y0 + CITY.road / 2 });
  }

  const blocks = [];
  const buildings = [];
  const props = [];
  const solids = [];
  const parked = [];

  const forcedKind = {
    '2,4': 'plaza',
    '5,1': 'bank',
    '9,1': 'park',
    '9,6': 'yard',
    '9,7': 'yard',
    '1,3': 'park',
    '4,6': 'plaza',
  };

  function solid(x, y, w, h, tag) {
    solids.push({ x, y, w, h, tag });
  }

  function blockRect(c, r) {
    return {
      c,
      r,
      x: c * pitch + CITY.road,
      y: r * pitch + CITY.road,
      w: CITY.block,
      h: CITY.block,
    };
  }

  function districtFor(r) {
    if (r < 3) return 'hills';
    if (r < 6) return 'centro';
    return 'marina';
  }

  function kindFor(c, r, district) {
    const forced = forcedKind[`${c},${r}`];
    if (forced) return forced;
    const roll = rng();
    if (district === 'centro') {
      if (roll < 0.08) return 'park';
      if (roll < 0.16) return 'plaza';
      if (roll < 0.24) return 'lot';
      return 'urban';
    }
    if (district === 'hills') {
      if (roll < 0.24) return 'park';
      if (roll < 0.34) return 'lot';
      return 'urban';
    }
    if (roll < 0.2) return 'park';
    if (roll < 0.34) return 'lot';
    return 'urban';
  }

  function roofTone(district) {
    return pick(rng, DISTRICTS[district].roofs);
  }

  function unitsFor(building) {
    const units = [];
    const count = Math.floor(rand(rng, 1, 3.4));
    for (let i = 0; i < count; i += 1) {
      const w = rand(rng, 8, 22);
      const h = rand(rng, 8, 18);
      units.push({
        x: building.x + rand(rng, 8, Math.max(9, building.w - w - 8)),
        y: building.y + rand(rng, 8, Math.max(9, building.h - h - 8)),
        w,
        h,
      });
    }
    return units;
  }

  function addBuilding(block, district, x, y, w, h, signName) {
    if (w < 26 || h < 26) return;
    const floors = randInt(rng, DISTRICT_FLOORS(district)[0], DISTRICT_FLOORS(district)[1]);
    const building = {
      x,
      y,
      w,
      h,
      district,
      floors,
      tone: roofTone(district),
      units: [],
      sign: signName ?? null,
      seed: Math.floor(rng() * 1e9),
    };
    building.units = unitsFor(building);
    buildings.push(building);
    solid(x, y, w, h, 'building');
    block.buildings += 1;
  }

  function DISTRICT_FLOORS(district) {
    return DISTRICTS[district].floors;
  }

  function urbanBlock(block, district, landmark) {
    const inset = CITY.sidewalk + 5;
    const inner = {
      x: block.x + inset,
      y: block.y + inset,
      w: block.w - inset * 2,
      h: block.h - inset * 2,
    };
    if (landmark === 'bank') {
      addBuilding(block, district, inner.x + 22, inner.y + 16, inner.w - 44, inner.h - 46, 'MERIDIAN BANK');
      return;
    }
    if (landmark === 'warehouse') {
      addBuilding(block, district, inner.x + 10, inner.y + 24, inner.w - 20, inner.h - 64, 'SALAS FRUIT CO.');
      return;
    }
    const cols = chance(rng, 0.42) ? 1 : chance(rng, 0.6) ? 2 : 3;
    const rows = chance(rng, 0.38) ? 1 : 2;
    const gap = 9;
    const cellW = (inner.w - gap * (cols - 1)) / cols;
    const cellH = (inner.h - gap * (rows - 1)) / rows;
    for (let cy = 0; cy < rows; cy += 1) {
      for (let cx = 0; cx < cols; cx += 1) {
        if (chance(rng, 0.09)) continue;
        const pad = rand(rng, 3, 7);
        addBuilding(
          block,
          district,
          inner.x + cx * (cellW + gap) + pad,
          inner.y + cy * (cellH + gap) + pad,
          cellW - pad * 2,
          cellH - pad * 2,
          null,
        );
      }
    }
  }

  function parkBlock(block, district) {
    const x = block.x + CITY.sidewalk;
    const y = block.y + CITY.sidewalk;
    const w = block.w - CITY.sidewalk * 2;
    const h = block.h - CITY.sidewalk * 2;
    block.park = { x, y, w, h };
    const count = randInt(rng, 5, 9);
    for (let i = 0; i < count; i += 1) {
      props.push({
        kind: chance(rng, 0.7) ? 'tree' : 'palm',
        x: rand(rng, x + 18, x + w - 18),
        y: rand(rng, y + 18, y + h - 18),
        size: rand(rng, 16, 30),
        seed: Math.floor(rng() * 1e9),
      });
    }
    props.push({ kind: 'fountain', x: x + w / 2, y: y + h / 2, size: 30, seed: Math.floor(rng() * 1e9) });
    solid(x + w / 2 - 16, y + h / 2 - 16, 32, 32, 'fountain');
    for (let i = 0; i < 4; i += 1) {
      const side = i % 2 === 0;
      props.push({
        kind: 'bench',
        x: side ? x + 30 : x + w - 30,
        y: y + 28 + (i >> 1) * (h - 56),
        rot: side ? Math.PI / 2 : -Math.PI / 2,
        seed: Math.floor(rng() * 1e9),
      });
    }
    props.push({ kind: 'path', x, y, w, h, horizontal: true });
    props.push({ kind: 'path', x, y, w, h, horizontal: false });
    if (district === 'marina') block.marinaPark = true;
  }

  function plazaBlock(block, district) {
    const x = block.x + CITY.sidewalk;
    const y = block.y + CITY.sidewalk;
    const w = block.w - CITY.sidewalk * 2;
    const h = block.h - CITY.sidewalk * 2;
    block.plaza = { x, y, w, h };
    props.push({ kind: 'fountain', x: x + w / 2, y: y + h / 2, size: 36, seed: Math.floor(rng() * 1e9) });
    solid(x + w / 2 - 18, y + h / 2 - 18, 36, 36, 'fountain');
    props.push({ kind: 'stall', x: x + 26, y: y + 44, rot: 0, seed: Math.floor(rng() * 1e9) });
    props.push({ kind: 'stall', x: x + w - 26, y: y + h - 44, rot: Math.PI, seed: Math.floor(rng() * 1e9) });
    for (let i = 0; i < 4; i += 1) {
      props.push({
        kind: 'palm',
        x: x + 22 + (i % 2) * (w - 44),
        y: y + 34 + Math.floor(i / 2) * (h - 68),
        size: rand(rng, 26, 36),
        seed: Math.floor(rng() * 1e9),
      });
    }
  }

  function lotBlock(block, district) {
    const x = block.x + CITY.sidewalk;
    const y = block.y + CITY.sidewalk;
    const w = block.w - CITY.sidewalk * 2;
    const h = block.h - CITY.sidewalk * 2;
    block.lot = { x, y, w, h };
    props.push({ kind: 'lot', x, y, w, h, seed: Math.floor(rng() * 1e9) });
    const lines = Math.floor(w / 34);
    for (let i = 0; i < lines; i += 1) {
      const px = x + 18 + i * 34;
      props.push({ kind: 'stripe', x: px, y: y + 14, h: 22 });
      props.push({ kind: 'stripe', x: px, y: y + h - 36, h: 22 });
    }
    if (district === 'marina' || chance(rng, 0.4)) {
      const wx = x + w * 0.08;
      const wy = y + h * 0.2;
      const ww = w * 0.84;
      const wh = h * 0.52;
      props.push({ kind: 'warehouse', x: wx, y: wy, w: ww, h: wh, seed: Math.floor(rng() * 1e9) });
      solid(wx, wy, ww, wh, 'warehouse');
    }
    const cars = randInt(rng, 2, 5);
    for (let i = 0; i < cars; i += 1) {
      const side = chance(rng, 0.5);
      parked.push({
        type: pick(rng, ['sedan', 'pickup', 'van', 'sedan']),
        x: x + 24 + i * 30,
        y: side ? y + 26 : y + h - 26,
        angle: side ? Math.PI : 0,
        color: pick(rng, ['#d9d4c7', '#8fb3c9', '#c96f5a', '#5e6b7a', '#e8d9a8', '#7d9b76']),
      });
    }
  }

  function addCurbCars(block) {
    if (!chance(rng, 0.55)) return;
    const side = randInt(rng, 0, 3);
    const type = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'pickup']);
    const color = pick(rng, ['#d9d4c7', '#8fb3c9', '#c96f5a', '#5e6b7a', '#e8d9a8', '#7d9b76', '#e8b83a']);
    const along = rand(rng, 40, block.w - 40);
    if (side === 0) parked.push({ type, x: block.x + along, y: block.y - 25, angle: 0, color });
    else if (side === 1) parked.push({ type, x: block.x + along, y: block.y + block.h + 25, angle: Math.PI, color });
    else if (side === 2) parked.push({ type, x: block.x - 25, y: block.y + along, angle: Math.PI / 2, color });
    else parked.push({ type, x: block.x + block.w + 25, y: block.y + along, angle: -Math.PI / 2, color });
  }

  for (let r = 0; r < CITY.rows; r += 1) {
    for (let c = 0; c < CITY.cols; c += 1) {
      const block = blockRect(c, r);
      const district = districtFor(r);
      block.district = district;
      block.buildings = 0;
      let kind = kindFor(c, r, district);
      if (kind === 'bank') {
        block.kind = 'urban';
        urbanBlock(block, district, 'bank');
      } else if (kind === 'park') {
        block.kind = 'park';
        parkBlock(block, district);
      } else if (kind === 'plaza') {
        block.kind = 'plaza';
        plazaBlock(block, district);
      } else if (kind === 'lot' || kind === 'yard') {
        block.kind = 'lot';
        lotBlock(block, district);
        if (kind === 'yard' && c === 9 && r === 6) {
          props.push({ kind: 'warehouse', x: block.x + 24, y: block.y + 30, w: block.w - 48, h: 96, seed: 913 });
          solid(block.x + 24, block.y + 30, block.w - 48, 96, 'warehouse');
        }
      } else {
        block.kind = 'urban';
        urbanBlock(block, district, null);
      }
      blocks.push(block);
      addCurbCars(block);
      if (block.kind === 'urban' && chance(rng, 0.35)) {
        props.push({
          kind: 'lamp',
          x: block.x + rand(rng, 10, block.w - 10),
          y: block.y + 4,
          rot: 0,
          seed: Math.floor(rng() * 1e9),
        });
      }
      if (block.district === 'marina' && chance(rng, 0.3)) {
        props.push({
          kind: 'crane',
          x: block.x + block.w * 0.8,
          y: block.y + block.h * 0.6,
          size: rand(rng, 28, 40),
          seed: Math.floor(rng() * 1e9),
        });
      }
    }
  }

  // The beach: umbrellas, towels, palms leaning over the sand, a lifeguard hut and the marina docks.
  for (let i = 0; i < 26; i += 1) {
    props.push({
      kind: 'umbrella',
      x: rand(rng, beachX + 22, waterX - 30),
      y: rand(rng, 140, cityH - 100),
      seed: Math.floor(rng() * 1e9),
    });
  }
  for (let y = 80; y < cityH - 20; y += rand(rng, 120, 190)) {
    props.push({ kind: 'palm', x: beachX + rand(rng, 18, 60), y, size: rand(rng, 30, 44), seed: Math.floor(rng() * 1e9) });
  }
  props.push({ kind: 'hut', x: beachX + 46, y: 1180, size: 26, seed: 71 });
  const dockYs = [2320, 2440, 2560, 2680];
  for (const y of dockYs) {
    props.push({ kind: 'dock', x: waterX - 4, y, w: 150, h: 16, seed: 200 + y });
    props.push({ kind: 'boat', x: waterX + 126 + rand(rng, 0, 30), y: y + 8, rot: rand(rng, -0.25, 0.25), seed: Math.floor(rng() * 1e9) });
  }

  // Landmarks: names the story and the HUD can point at.
  function blockAt(c, r) {
    return blocks[r * CITY.cols + c];
  }
  function sidePoint(c, r, side) {
    const b = blockAt(c, r);
    const inset = 8;
    if (side === 'north') return { x: b.x + b.w / 2, y: b.y + inset };
    if (side === 'south') return { x: b.x + b.w / 2, y: b.y + b.h - inset };
    if (side === 'west') return { x: b.x + inset, y: b.y + b.h / 2 };
    return { x: b.x + b.w - inset, y: b.y + b.h / 2 };
  }

  const landmarks = {
    mercado: sidePoint(2, 4, 'south'),
    bank: sidePoint(5, 1, 'south'),
    warehouse: sidePoint(9, 6, 'west'),
    marina: sidePoint(9, 7, 'east'),
    overlook: sidePoint(9, 1, 'north'),
    hideout: sidePoint(1, 7, 'south'),
    downtown: sidePoint(4, 2, 'south'),
  };

  function blockInfoAt(x, y) {
    const c = clamp(Math.floor((x - CITY.road) / pitch), 0, CITY.cols - 1);
    const r = clamp(Math.floor((y - CITY.road) / pitch), 0, CITY.rows - 1);
    return blockAt(c, r);
  }

  function districtAt(x, y) {
    return districtFor(blockInfoAt(x, y).r);
  }

  function lanePoint(axis, index, dir, along) {
    const lane = CITY.lane;
    if (axis === 'v') {
      const road = vertical[index];
      return {
        x: road.center + (dir > 0 ? -lane : lane),
        y: along,
        angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      };
    }
    const road = horizontal[index];
    return {
      x: along,
      y: road.center + (dir > 0 ? lane : -lane),
      angle: dir > 0 ? 0 : Math.PI,
    };
  }

  function trafficSpawn() {
    const axis = chance(rng, 0.5) ? 'v' : 'h';
    if (axis === 'v') {
      const index = randInt(rng, 1, CITY.cols);
      const dir = chance(rng, 0.5) ? 1 : -1;
      return { axis, index, dir, along: rand(rng, 0, cityH) };
    }
    const index = randInt(rng, 1, CITY.rows);
    const dir = chance(rng, 0.5) ? 1 : -1;
    return { axis, index, dir, along: rand(rng, 0, cityW) };
  }

  function nearestLane(x, y, distance) {
    const axis = chance(rng, 0.5) ? 'v' : 'h';
    const dir = chance(rng, 0.5) ? 1 : -1;
    if (axis === 'v') {
      let index = 0;
      let best = Infinity;
      for (let i = 1; i <= CITY.cols; i += 1) {
        const d = Math.abs(vertical[i].center - x);
        if (d < best) { best = d; index = i; }
      }
      const along = clamp(y + (chance(rng, 0.5) ? distance : -distance), 60, cityH - 60);
      return lanePoint(axis, index, dir, along);
    }
    let index = 0;
    let best = Infinity;
    for (let i = 1; i <= CITY.rows; i += 1) {
      const d = Math.abs(horizontal[i].center - y);
      if (d < best) { best = d; index = i; }
    }
    const along = clamp(x + (chance(rng, 0.5) ? distance : -distance), 60, cityW - 60);
    return lanePoint(axis, index, dir, along);
  }

  function hitSolid(x, y, radius) {
    if (x < radius || y < radius || x > waterX - radius || y > cityH - radius) return true;
    for (let i = 0; i < solids.length; i += 1) {
      const s = solids[i];
      const nx = clamp(x, s.x, s.x + s.w);
      const ny = clamp(y, s.y, s.y + s.h);
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  function blockSidewalkPath(block) {
    const inset = 7;
    return {
      left: block.x + inset,
      right: block.x + block.w - inset,
      top: block.y + inset,
      bottom: block.y + block.h - inset,
    };
  }

  function perimeterPoint(block, t) {
    const p = blockSidewalkPath(block);
    const w = p.right - p.left;
    const h = p.bottom - p.top;
    const total = 2 * (w + h);
    let d = ((t % total) + total) % total;
    if (d < w) return { x: p.left + d, y: p.top, angle: 0 };
    d -= w;
    if (d < h) return { x: p.right, y: p.top + d, angle: Math.PI / 2 };
    d -= h;
    if (d < w) return { x: p.right - d, y: p.bottom, angle: Math.PI };
    d -= w;
    return { x: p.left, y: p.bottom - d, angle: -Math.PI / 2 };
  }

  function isOnRoad(x, y) {
    for (const road of vertical) if (x >= road.x0 && x <= road.x1) return true;
    for (const road of horizontal) if (y >= road.y0 && y <= road.y1) return true;
    return false;
  }

  return {
    seed,
    rng,
    width,
    height,
    cityW,
    cityH,
    beachX,
    waterX,
    pitch,
    vertical,
    horizontal,
    blocks,
    buildings,
    props,
    solids,
    parked,
    landmarks,
    blockAt,
    blockInfoAt,
    districtAt,
    sidePoint,
    lanePoint,
    trafficSpawn,
    nearestLane,
    hitSolid,
    blockSidewalkPath,
    perimeterPoint,
    isOnRoad,
    districtName: (x, y) => DISTRICTS[districtAt(x, y)].name,
  };
}