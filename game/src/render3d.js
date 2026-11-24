// sprint-3d witness
// A pseudo-3D third-person renderer for Costa Dorada. It keeps the same world data the 2D renderer
// uses and paints it through a simple pinhole camera: a chase camera behind the player, extruded
// buildings with roofs and shaded walls, roads in perspective, traffic, police lights and a warm
// golden-hour sky. No libraries and no network; everything is plain canvas 2D.
import { CITY } from './config.js';

const SKY_TOP = '#141a2f';
const SKY_MID = '#6b4a63';
const SKY_LOW = '#ffb36b';
const WATER_DEEP = '#1f7f9d';
const WATER_LIGHT = '#3aa7bd';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function createRenderer3D(canvas, city) {
  const ctx = canvas.getContext('2d');
  const view = { w: canvas.width, h: canvas.height };
  const camera = { x: 0, y: 0, z: 0, angle: 0 };
  let dpr = 1;
  let focal = 720;
  let horizon = 300;
  let cameraYaw = 0;
  let cameraReady = false;
  let cameraDist = 210;
  let cameraHeight = 120;

  function resize(w, h, dprValue) {
    view.w = w;
    view.h = h;
    dpr = Math.min(2, dprValue || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setCamera(game) {
    if (game.state === 'title') {
      // A fixed establishing shot for the title screen: the city, never the hero car in the foreground.
      camera.x = city.cityW * 0.52;
      camera.y = city.height * 0.56;
      camera.z = 112;
      cameraYaw = 2.25;
      camera.angle = cameraYaw;
      focal = view.h * 1.08;
      horizon = view.h * 0.43;
      return;
    }
    const car = game.player.inCar;
    const px = car ? car.x : game.player.x;
    const py = car ? car.y : game.player.y;
    const coverYaw = game.shotMode === 'cover' && game.state !== 'title' ? -0.38 : 0;
    const target = (car ? car.angle : game.player.angle) + coverYaw;
    if (!cameraReady) {
      cameraYaw = target;
      cameraReady = true;
    } else {
      let diff = target - cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cameraYaw += diff * 0.22;
    }
    const speed = car ? Math.abs(car.speed) : 0;
    cameraDist = car ? 100 + Math.min(12, speed * 0.02) : 140;
    cameraHeight = car ? 42 : 58;
    // The car stays centred; on foot a shoulder offset puts the player in the lower-left quadrant.
    const side = car ? 0 : 38;
    camera.x = px - Math.cos(cameraYaw) * cameraDist - Math.sin(cameraYaw) * side;
    camera.y = py - Math.sin(cameraYaw) * cameraDist + Math.cos(cameraYaw) * side;
    // The cover screenshot uses a higher, wider angle so the hero car is not cut off.
    if (game.shotMode === 'cover' && game.state !== 'title') {
      cameraDist = 105;
      cameraHeight = 46;
      camera.x = px - Math.cos(cameraYaw) * cameraDist;
      camera.y = py - Math.sin(cameraYaw) * cameraDist;
      horizon = view.h * 0.36;
    }
    camera.z = cameraHeight;
    camera.angle = cameraYaw;
    focal = view.h * 1.08;
    horizon = game.shotMode === 'cover' && game.state !== 'title' ? view.h * 0.36 : view.h * 0.43;
  }

  function project(x, y, z) {
    const dx = x - camera.x;
    const dy = y - camera.y;
    const f = dx * Math.cos(cameraYaw) + dy * Math.sin(cameraYaw);
    if (f <= 12) return null;
    const r = -dx * Math.sin(cameraYaw) + dy * Math.cos(cameraYaw);
    const s = focal / f;
    const sx = view.w / 2 + r * s;
    const sy = horizon - (z - camera.z) * s;
    if (sx < -420 || sx > view.w + 420) return null;
    return { x: sx, y: sy, s, f };
  }

  function poly(points, fill, stroke, lineWidth) {
    const ps = [];
    for (const p of points) {
      const q = project(p.x, p.y, p.z ?? 0);
      if (!q) return false;
      ps.push(q);
    }
    ctx.beginPath();
    ctx.moveTo(ps[0].x, ps[0].y);
    for (let i = 1; i < ps.length; i += 1) ctx.lineTo(ps[i].x, ps[i].y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth ?? 1;
      ctx.stroke();
    }
    return true;
  }

  function quad(x1, y1, x2, y2, fill, stroke) {
    return poly([
      { x: x1, y: y1, z: 0 },
      { x: x2, y: y1, z: 0 },
      { x: x2, y: y2, z: 0 },
      { x: x1, y: y2, z: 0 },
    ], fill, stroke);
  }

  function drawSky(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, horizon + 8);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(0.55, SKY_MID);
    grad.addColorStop(1, SKY_LOW);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, horizon + 8);

    // Low sun and its bloom, fixed to the camera's left-of-centre like a coastal west view.
    const sunX = view.w * 0.28;
    const sunY = horizon - view.h * 0.035;
    const bloom = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, view.w * 0.34);
    bloom.addColorStop(0, 'rgba(255,236,185,0.72)');
    bloom.addColorStop(0.22, 'rgba(255,166,96,0.20)');
    bloom.addColorStop(1, 'rgba(255,166,96,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, view.w, horizon);
    ctx.fillStyle = 'rgba(255,240,200,0.92)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, Math.max(14, view.w * 0.026), 0, Math.PI * 2);
    ctx.fill();

    // Thin clouds for depth.
    ctx.fillStyle = 'rgba(255,220,185,0.08)';
    for (let i = 0; i < 5; i += 1) {
      const cy = horizon * (0.18 + i * 0.12) + Math.sin(time * 0.05 + i) * 3;
      ctx.beginPath();
      ctx.ellipse(view.w * (0.12 + i * 0.19), cy, view.w * 0.16, 3 + i, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGroundBase() {
    const grad = ctx.createLinearGradient(0, horizon, 0, view.h);
    grad.addColorStop(0, '#75634f');
    grad.addColorStop(0.25, '#51473d');
    grad.addColorStop(1, '#2b3034');
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizon, view.w, view.h - horizon);
  }

  function drawWater() {
    if (city.waterX > camera.x - 80 && city.waterX < camera.x + 1400) {
      for (let y = Math.floor((camera.y - 1200) / 260) * 260; y < camera.y + 1400; y += 260) {
        if (y > city.height + 260 || y < -260) continue;
        const g = ctx.createLinearGradient(0, horizon, 0, view.h);
        g.addColorStop(0, WATER_DEEP);
        g.addColorStop(1, WATER_LIGHT);
        quad(city.waterX, y, city.width + 80, y + 260, g);
      }
      // A bright sun track on the water.
      const a = project(city.waterX + 60, camera.y + 220, 0);
      const b = project(city.width, camera.y + 220, 0);
      if (a && b) {
        ctx.strokeStyle = 'rgba(255,230,180,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  function blockColor(kind) {
    if (kind === 'park') return '#7f9a62';
    if (kind === 'plaza') return '#cdbb9c';
    if (kind === 'lot') return '#4e5154';
    return '#b7ab96';
  }

  function drawBlocks() {
    for (const block of city.blocks) {
      if (block.x > camera.x + 1400 || block.x + block.w < camera.x - 200) continue;
      if (block.y > camera.y + 1400 || block.y + block.h < camera.y - 200) continue;
      const color = blockColor(block.kind);
      const step = 80;
      for (let x = block.x; x < block.x + block.w; x += step) {
        for (let y = block.y; y < block.y + block.h; y += step) {
          quad(x, y, Math.min(x + step, block.x + block.w), Math.min(y + step, block.y + block.h), color);
        }
      }
    }
  }

  function drawRoads() {
    // Vertical roads: full strips broken into short pieces so the near plane can clip cleanly.
    for (const road of city.vertical) {
      if (road.x1 < camera.x - 260 || road.x0 > camera.x + 1500) continue;
      for (let y = Math.floor((camera.y - 1300) / 120) * 120; y < camera.y + 1400; y += 120) {
        if (y > city.height || y < 0) continue;
        quad(road.x0, y, road.x1, y + 120, '#414347');
        quad(road.x0, y, road.x0 + 3, y + 120, 'rgba(25,26,28,0.45)');
        quad(road.x1 - 3, y, road.x1, y + 120, 'rgba(25,26,28,0.45)');
        // centre dashes
        const dash = project(road.center, y + 8, 0);
        const dash2 = project(road.center, y + 62, 0);
        if (dash && dash2) {
          ctx.strokeStyle = 'rgba(238,228,196,0.62)';
          ctx.lineWidth = Math.max(1, 2 * dash.s);
          ctx.beginPath();
          ctx.moveTo(dash.x, dash.y);
          ctx.lineTo(dash2.x, dash2.y);
          ctx.stroke();
        }
      }
    }
    // Horizontal roads.
    for (const road of city.horizontal) {
      if (road.y1 < camera.y - 260 || road.y0 > camera.y + 1500) continue;
      for (let x = Math.floor((camera.x - 1300) / 120) * 120; x < camera.x + 1500; x += 120) {
        if (x > city.cityW || x < 0) continue;
        quad(x, road.y0, x + 120, road.y1, '#414347');
        quad(x, road.y0, x + 120, road.y0 + 3, 'rgba(25,26,28,0.45)');
        quad(x, road.y1 - 3, x + 120, road.y1, 'rgba(25,26,28,0.45)');
        const dash = project(x + 8, road.center, 0);
        const dash2 = project(x + 62, road.center, 0);
        if (dash && dash2) {
          ctx.strokeStyle = 'rgba(238,228,196,0.62)';
          ctx.lineWidth = Math.max(1, 2 * dash.s);
          ctx.beginPath();
          ctx.moveTo(dash.x, dash.y);
          ctx.lineTo(dash2.x, dash2.y);
          ctx.stroke();
        }
      }
    }
  }

  function drawBuilding(b) {
    const x1 = b.x;
    const y1 = b.y;
    const x2 = b.x + b.w;
    const y2 = b.y + b.h;
    const hgt = 18 + b.floors * 14;
    const baseTone = b.tone;
    const faces = [];
    if (camera.x < x1) faces.push({ pts: [{ x: x1, y: y1 }, { x: x1, y: y2 }], tone: shade(baseTone, -42), depth: project(x1, (y1 + y2) / 2, 0)?.f ?? 99999 });
    if (camera.x > x2) faces.push({ pts: [{ x: x2, y: y2 }, { x: x2, y: y1 }], tone: shade(baseTone, -24), depth: project(x2, (y1 + y2) / 2, 0)?.f ?? 99999 });
    if (camera.y < y1) faces.push({ pts: [{ x: x2, y: y1 }, { x: x1, y: y1 }], tone: shade(baseTone, -54), depth: project((x1 + x2) / 2, y1, 0)?.f ?? 99999 });
    if (camera.y > y2) faces.push({ pts: [{ x: x1, y: y2 }, { x: x2, y: y2 }], tone: shade(baseTone, -10), depth: project((x1 + x2) / 2, y2, 0)?.f ?? 99999 });
    faces.sort((a, b2) => b2.depth - a.depth);
    for (const face of faces) {
      const p1 = face.pts[0];
      const p2 = face.pts[1];
      poly([
        { x: p1.x, y: p1.y, z: 0 },
        { x: p2.x, y: p2.y, z: 0 },
        { x: p2.x, y: p2.y, z: hgt },
        { x: p1.x, y: p1.y, z: hgt },
      ], face.tone);
    }
    // Roof plane.
    poly([
      { x: x1, y: y1, z: hgt },
      { x: x2, y: y1, z: hgt },
      { x: x2, y: y2, z: hgt },
      { x: x1, y: y2, z: hgt },
    ], shade(baseTone, 12));
    // Rooftop boxes.
    for (const u of b.units) {
      const uh = 6 + (u.w % 7);
      poly([
        { x: u.x, y: u.y, z: hgt },
        { x: u.x + u.w, y: u.y, z: hgt },
        { x: u.x + u.w, y: u.y, z: hgt + uh },
        { x: u.x, y: u.y, z: hgt + uh },
      ], shade(baseTone, -18));
      poly([
        { x: u.x, y: u.y + u.h, z: hgt },
        { x: u.x, y: u.y, z: hgt },
        { x: u.x, y: u.y, z: hgt + uh },
        { x: u.x, y: u.y + u.h, z: hgt + uh },
      ], shade(baseTone, -30));
      poly([
        { x: u.x, y: u.y, z: hgt + uh },
        { x: u.x + u.w, y: u.y, z: hgt + uh },
        { x: u.x + u.w, y: u.y + u.h, z: hgt + uh },
        { x: u.x, y: u.y + u.h, z: hgt + uh },
      ], shade(baseTone, 22));
    }
    // A warm window band low on the street-facing wall, so the city reads as inhabited.
    if (b.floors > 2) {
      const front = camera.y > y2 ? [{ x: x1, y: y2 }, { x: x2, y: y2 }] : camera.y < y1 ? [{ x: x2, y: y1 }, { x: x1, y: y1 }] : null;
      if (front) {
        poly([
          { x: front[0].x, y: front[0].y, z: 14 },
          { x: front[1].x, y: front[1].y, z: 14 },
          { x: front[1].x, y: front[1].y, z: 24 },
          { x: front[0].x, y: front[0].y, z: 24 },
        ], 'rgba(255,206,130,0.28)');
      }
    }
  }

  function carCorners(car) {
    const c = Math.cos(car.angle);
    const s = Math.sin(car.angle);
    const hl = car.length / 2;
    const hw = car.width / 2;
    const local = [[hl, -hw], [hl, hw], [-hl, hw], [-hl, -hw]];
    return local.map(([dx, dy]) => ({ x: car.x + c * dx - s * dy, y: car.y + s * dx + c * dy }));
  }

  function drawCarBox(car) {
    const corners = carCorners(car);
    const hgt = car.type === 'van' || car.type === 'armored' ? 20 : 13;
    const faces = [];
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const p = project(mid.x, mid.y, 0);
      if (!p) continue;
      const tone = i === 0 ? shade(car.color, 20) : i === 2 ? shade(car.color, -18) : shade(car.color, i === 1 ? 6 : -30);
      faces.push({ a, b, tone, depth: p.f });
    }
    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) {
      poly([
        { x: face.a.x, y: face.a.y, z: 0 },
        { x: face.b.x, y: face.b.y, z: 0 },
        { x: face.b.x, y: face.b.y, z: hgt },
        { x: face.a.x, y: face.a.y, z: hgt },
      ], face.tone);
    }
    poly(corners.map((p) => ({ x: p.x, y: p.y, z: hgt })), shade(car.color, 26));
    // Glass strip on the roof.
    const c = Math.cos(car.angle);
    const s = Math.sin(car.angle);
    const glass = [[car.length * 0.05, -car.width * 0.3], [car.length * 0.28, -car.width * 0.3], [car.length * 0.28, car.width * 0.3], [car.length * 0.05, car.width * 0.3]]
      .map(([dx, dy]) => ({ x: car.x + c * dx - s * dy, y: car.y + s * dx + c * dy, z: hgt + 0.7 }));
    poly(glass, 'rgba(25,36,46,0.72)');
    if (car.kind === 'player') {
      const c2 = Math.cos(car.angle);
      const s2 = Math.sin(car.angle);
      const hl = car.length / 2;
      const hw = car.width / 2;
      const world = (dx, dy, z) => ({ x: car.x + c2 * dx - s2 * dy, y: car.y + s2 * dx + c2 * dy, z });
      // Four black wheels at the corners of the chassis.
      const wheelR = Math.max(2.4, car.width * 0.12);
      for (const [dx, dy] of [[hl * 0.64, -hw], [hl * 0.64, hw], [-hl * 0.64, -hw], [-hl * 0.64, hw]]) {
        const wp = project(car.x + c2 * dx - s2 * dy, car.y + s2 * dx + c2 * dy, wheelR);
        if (!wp) continue;
        ctx.fillStyle = '#111318';
        ctx.beginPath();
        ctx.ellipse(wp.x, wp.y, Math.max(3, wheelR * wp.s * 1.2), Math.max(2, wheelR * wp.s * 0.72), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Tail-light bar across the rear face.
      const along = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const rearA = corners[2];
      const rearB = corners[3];
      const t1 = along(rearA, rearB, 0.2);
      const t2 = along(rearA, rearB, 0.8);
      poly([
        { ...t1, z: 7 }, { ...t2, z: 7 }, { ...t2, z: 9.4 }, { ...t1, z: 9.4 },
      ], '#ff3a30');
      // Rear window, a dark trapezoid on the back half of the roof.
      poly([
        world(-hl * 0.86, -hw * 0.64, hgt + 0.8),
        world(-hl * 0.86, hw * 0.64, hgt + 0.8),
        world(-hl * 0.5, hw * 0.45, hgt + 0.8),
        world(-hl * 0.5, -hw * 0.45, hgt + 0.8),
      ], 'rgba(18,26,36,0.82)');
    }
    if (car.type === 'police') {
      const flash = Math.sin(car.timeStamp ?? performance.now() * 0.012) > 0;
      const bar = [[-6, -car.width * 0.2], [6, -car.width * 0.2], [6, car.width * 0.2], [-6, car.width * 0.2]]
        .map(([dx, dy]) => ({ x: car.x + c * dx - s * dy, y: car.y + s * dx + c * dy }));
      poly(bar.map((p) => ({ x: p.x, y: p.y, z: hgt + 1 })), flash ? '#e74b42' : '#3f7ad8');
      const top = project(car.x, car.y, hgt + 16);
      if (top) {
        const glow = ctx.createRadialGradient(top.x, top.y, 2, top.x, top.y, 48 * top.s);
        glow.addColorStop(0, flash ? 'rgba(255,80,60,0.55)' : 'rgba(70,130,255,0.55)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(top.x, top.y, 48 * top.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (car.kind === 'player') {
      // headlights as ground cones
      const nose = corners[0];
      const left = corners[1];
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);
      poly([
        { x: left.x, y: left.y, z: 2 },
        { x: left.x + fx * 170 - fy * 42, y: left.y + fy * 170 + fx * 42, z: 2 },
        { x: left.x + fx * 170 + fy * 42, y: left.y + fy * 170 - fx * 42, z: 2 },
        { x: nose.x + fx * 24, y: nose.y + fy * 24, z: 2 },
      ], 'rgba(255,232,170,0.13)');
    }
    if (car.burning) {
      const p = project(car.x, car.y, hgt + 8);
      if (p) {
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 38 * p.s);
        g.addColorStop(0, 'rgba(255,160,50,0.8)');
        g.addColorStop(1, 'rgba(255,80,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 38 * p.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPerson(x, y, height, color, dead = false, armed = false) {
    const base = project(x, y, 0);
    const top = project(x, y, height);
    if (!base || !top) return;
    const h = Math.max(6, base.y - top.y);
    const width = Math.min(38, Math.max(4, h * 0.16));
    if (dead) {
      ctx.strokeStyle = 'rgba(150,60,50,0.55)';
      ctx.lineWidth = width * 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(base.x - width * 1.6, base.y);
      ctx.lineTo(base.x + width * 1.6, base.y);
      ctx.stroke();
      ctx.lineCap = 'butt';
      return;
    }
    const headR = width * 0.4;
    const headY = top.y + headR * 1.05;
    const shoulderY = headY + headR * 1.55;
    const hipY = base.y - h * 0.4;
    // Torso as a tapered slab, arms and legs as rounded limbs: reads as a person, not a pole.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(base.x - width * 0.55, shoulderY);
    ctx.lineTo(base.x + width * 0.55, shoulderY);
    ctx.lineTo(base.x + width * 0.4, hipY);
    ctx.lineTo(base.x - width * 0.4, hipY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, width * 0.3);
    ctx.beginPath();
    ctx.moveTo(base.x - width * 0.5, shoulderY + width * 0.1);
    ctx.lineTo(base.x - width * 0.72, hipY + width * 0.15);
    ctx.moveTo(base.x + width * 0.5, shoulderY + width * 0.1);
    ctx.lineTo(base.x + width * 0.7, hipY + width * 0.15);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, width * 0.34);
    ctx.beginPath();
    ctx.moveTo(base.x - width * 0.24, hipY);
    ctx.lineTo(base.x - width * 0.34, base.y);
    ctx.moveTo(base.x + width * 0.24, hipY);
    ctx.lineTo(base.x + width * 0.34, base.y);
    ctx.stroke();
    ctx.fillStyle = '#e2c49e';
    ctx.beginPath();
    ctx.arc(base.x, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    if (armed) {
      ctx.strokeStyle = '#2b2f34';
      ctx.lineWidth = Math.max(1.5, 2.2 * base.s);
      ctx.beginPath();
      ctx.moveTo(base.x + width * 0.28, hipY + width * 0.08);
      ctx.lineTo(base.x + width * 1.15, hipY + width * 0.02);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawPalm(x, y, size) {
    const base = project(x, y, 0);
    const top = project(x, y, size * 2.6);
    if (!base || !top) return;
    if (base.f < 140) return;
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = Math.max(1.5, 2.6 * base.s);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(48,78,48,0.92)';
    ctx.lineWidth = Math.max(1, 2 * base.s);
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI * 0.9 + (i / 5) * Math.PI * 0.8;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.quadraticCurveTo(
        top.x + Math.cos(a) * size * 0.8,
        top.y + Math.sin(a) * size * 0.8,
        top.x + Math.cos(a) * size * 1.45,
        top.y + Math.sin(a) * size * 1.45,
      );
      ctx.stroke();
    }
  }

  function drawMarker(game) {
    const missions = game.missions;
    let marker = missions.marker;
    let color = [255, 208, 92];
    if (!marker && missions.startPoint) {
      marker = missions.startPoint;
      color = [143, 224, 150];
    }
    if (!marker) return;
    const base = project(marker.x, marker.y, 0);
    const top = project(marker.x, marker.y, 190);
    if (!base || !top) return;
    const g = ctx.createLinearGradient(top.x, top.y, base.x, base.y);
    g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0.5)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(top.x - 2, top.y);
    ctx.lineTo(top.x + 2, top.y);
    ctx.lineTo(base.x + 26 * base.s, base.y);
    ctx.lineTo(base.x - 26 * base.s, base.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.18)`;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 52 * base.s, 18 * base.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function collect(game) {
    const items = [];
    for (const b of city.buildings) {
      const dx = b.x + b.w / 2 - camera.x;
      const dy = b.y + b.h / 2 - camera.y;
      const f = dx * Math.cos(cameraYaw) + dy * Math.sin(cameraYaw);
      if (f < 80 || f > 1350) continue;
      const r = -dx * Math.sin(cameraYaw) + dy * Math.cos(cameraYaw);
      if (Math.abs(r) > 950) continue;
      items.push({ kind: 'building', depth: f, data: b });
    }
    for (const car of game.cars) {
      const dx = car.x - camera.x;
      const dy = car.y - camera.y;
      const f = dx * Math.cos(cameraYaw) + dy * Math.sin(cameraYaw);
      if (f < 15 || f > 1200) continue;
      const r = -dx * Math.sin(cameraYaw) + dy * Math.cos(cameraYaw);
      if (Math.abs(r) > 700) continue;
      items.push({ kind: 'car', depth: f, data: car });
    }
    for (const ped of game.peds.peds) {
      const dx = ped.x - camera.x;
      const dy = ped.y - camera.y;
      const f = dx * Math.cos(cameraYaw) + dy * Math.sin(cameraYaw);
      // Keep people out of the lens and away from the staged player: a close capsule would fill the frame.
      if (f < 80 || f > 650) continue;
      if (Math.hypot(ped.x - game.player.x, ped.y - game.player.y) < 200) continue;
      items.push({ kind: 'ped', depth: f, data: ped });
    }
    for (const unit of game.police.units) {
      if (unit.kind !== 'foot') continue;
      const dx = unit.x - camera.x;
      const dy = unit.y - camera.y;
      const f = dx * Math.cos(cameraYaw) + dy * Math.sin(cameraYaw);
      if (f < 12 || f > 700) continue;
      items.push({ kind: 'cop', depth: f, data: unit });
    }
    for (const enemy of game.missions.enemies) {
      const dx = enemy.x - camera.x;
      const dy = enemy.y - camera.y;
      const f = dx * Math.cos(cameraYaw) + dy * Math.sin(cameraYaw);
      if (f < 12 || f > 700) continue;
      items.push({ kind: 'enemy', depth: f, data: enemy });
    }
    items.sort((a, b) => b.depth - a.depth);
    return items;
  }

  function draw(game) {
    const time = game.time;
    setCamera(game);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(time);
    drawGroundBase();
    drawWater();
    drawBlocks();
    drawRoads();
    drawMarker(game);

    // Palms and lamps first because they belong to the ground layer.
    for (const prop of city.props) {
      if (prop.kind !== 'palm') continue;
      const dx = prop.x - camera.x;
      const dy = prop.y - camera.y;
      const f = dx * Math.cos(cameraYaw) + dy * Math.sin(cameraYaw);
      if (f < 20 || f > 700) continue;
      drawPalm(prop.x, prop.y, prop.size ?? 28);
    }

    for (const item of collect(game)) {
      if (item.kind === 'building') drawBuilding(item.data);
      else if (item.kind === 'car') drawCarBox(item.data);
      else if (item.kind === 'ped') drawPerson(item.data.x, item.data.y, 26, item.data.shirt ?? '#d8cdb8', item.data.dead);
      else if (item.kind === 'cop') drawPerson(item.data.x, item.data.y, 30, '#28344a', false, true);
      else if (item.kind === 'enemy') drawPerson(item.data.x, item.data.y, 29, '#5a2a2a', item.data.dead, true);
    }
    // Player on foot (the in-car player is drawn as the car itself); never on the title screen.
    if (game.state !== 'title' && !game.player.inCar && !game.player.dead) {
      drawPerson(game.player.x, game.player.y, 34, '#2f3c52', false, true);
      if (game.player.muzzle > 0.02) {
        const mx = game.player.x + Math.cos(game.player.angle) * 26;
        const my = game.player.y + Math.sin(game.player.angle) * 26;
        const flash = project(mx, my, 26);
        if (flash) {
          const g = ctx.createRadialGradient(flash.x, flash.y, 1, flash.x, flash.y, 26 * flash.s);
          g.addColorStop(0, 'rgba(255,245,190,0.95)');
          g.addColorStop(0.4, 'rgba(255,190,80,0.55)');
          g.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(flash.x, flash.y, 26 * flash.s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Sun wash and vignette.
    const wash = ctx.createLinearGradient(0, 0, view.w, view.h);
    wash.addColorStop(0, 'rgba(255,206,140,0.16)');
    wash.addColorStop(0.5, 'rgba(255,170,110,0.04)');
    wash.addColorStop(1, 'rgba(10,20,35,0.22)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, view.w, view.h);
    const vignette = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(8,12,18,0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function screenToWorld(sx, sy) {
    const dx = sx - view.w / 2;
    const dy = sy - horizon;
    if (dy <= 1) return { x: camera.x + Math.cos(cameraYaw) * 200, y: camera.y + Math.sin(cameraYaw) * 200 };
    // Ground plane: screenY = horizon + camera.z * focal / f, so f = camera.z * focal / dy.
    const f = camera.z * focal / dy;
    const r = dx * f / focal;
    return {
      x: camera.x + Math.cos(cameraYaw) * f - Math.sin(cameraYaw) * r,
      y: camera.y + Math.sin(cameraYaw) * f + Math.cos(cameraYaw) * r,
    };
  }

  return {
    view,
    camera,
    resize,
    draw,
    screenToWorld,
  };
}
