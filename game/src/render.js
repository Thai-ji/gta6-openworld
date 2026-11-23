// The picture: a sun-soaked top-down city baked once into a static layer (roads, sidewalks, roofs,
// palms, docks), then animated on top every frame (sea, cars, people, gunfire, marker). The camera
// follows the player, the palette is warm, and every entity gets a long shadow so the streets read
// as three-dimensional from above.
import { CITY } from './config.js';
import { clamp } from './math.js';

function hash(n) {
  const x = Math.sin(n * 12.9898 + 7.233) * 43758.5453;
  return x - Math.floor(x);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function buildStatic(city) {
  const canvas = document.createElement('canvas');
  canvas.width = city.width;
  canvas.height = city.height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4b4c4a';
  ctx.fillRect(0, 0, city.width, city.height);

  // Road surface with a faint warm grade and a thin gutter along every curb.
  for (const road of city.vertical) {
    ctx.fillStyle = '#454648';
    ctx.fillRect(road.x0, 0, CITY.road, city.height);
    ctx.fillStyle = 'rgba(255,236,200,0.035)';
    ctx.fillRect(road.x0 + 4, 0, CITY.road - 8, city.height);
  }
  for (const road of city.horizontal) {
    ctx.fillStyle = '#454648';
    ctx.fillRect(0, road.y0, city.width, CITY.road);
    ctx.fillStyle = 'rgba(255,236,200,0.035)';
    ctx.fillRect(0, road.y0 + 4, city.width, CITY.road - 8);
  }

  // Lane dashes only between intersections, so crossings stay clean.
  ctx.strokeStyle = 'rgba(238,228,196,0.78)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 20]);
  for (let i = 0; i < city.vertical.length; i += 1) {
    const road = city.vertical[i];
    for (let r = 0; r < CITY.rows; r += 1) {
      const from = city.horizontal[r].y1 + 10;
      const to = city.horizontal[r + 1].y0 - 10;
      ctx.beginPath();
      ctx.moveTo(road.center, from);
      ctx.lineTo(road.center, to);
      ctx.stroke();
    }
  }
  for (let j = 0; j < city.horizontal.length; j += 1) {
    const road = city.horizontal[j];
    for (let c = 0; c < CITY.cols; c += 1) {
      const from = city.vertical[c].x1 + 10;
      const to = city.vertical[c + 1].x0 - 10;
      ctx.beginPath();
      ctx.moveTo(from, road.center);
      ctx.lineTo(to, road.center);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Crosswalks and stop lines at every crossing.
  ctx.fillStyle = 'rgba(240,232,210,0.85)';
  for (const v of city.vertical) {
    for (const h of city.horizontal) {
      for (const side of [-1, 1]) {
        const y = h.center + side * (CITY.road / 2 - 12);
        for (let k = 0; k < 4; k += 1) ctx.fillRect(v.x0 + 12 + k * 17, y - 6, 10, 12);
      }
      for (const side of [-1, 1]) {
        const x = v.center + side * (CITY.road / 2 - 12);
        for (let k = 0; k < 4; k += 1) ctx.fillRect(x - 6, h.y0 + 12 + k * 17, 12, 10);
      }
    }
  }

  // Blocks: sidewalk ring, then the ground of whatever kind of block it is.
  for (const block of city.blocks) {
    ctx.fillStyle = '#b8ad99';
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.fillStyle = 'rgba(255,250,235,0.35)';
    ctx.fillRect(block.x + 2, block.y + 2, block.w - 4, 4);
    ctx.strokeStyle = 'rgba(90,80,70,0.16)';
    ctx.lineWidth = 1;
    for (let x = block.x + 14; x < block.x + block.w; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, block.y + 3);
      ctx.lineTo(x, block.y + CITY.sidewalk - 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, block.y + block.h - CITY.sidewalk + 3);
      ctx.lineTo(x, block.y + block.h - 3);
      ctx.stroke();
    }
    const ix = block.x + CITY.sidewalk;
    const iy = block.y + CITY.sidewalk;
    const iw = block.w - CITY.sidewalk * 2;
    const ih = block.h - CITY.sidewalk * 2;
    if (block.kind === 'park') {
      ctx.fillStyle = '#84a263';
      ctx.fillRect(ix, iy, iw, ih);
      for (let i = 0; i < 70; i += 1) {
        const gx = ix + hash(i * 3 + block.x) * iw;
        const gy = iy + hash(i * 7 + block.y) * ih;
        ctx.fillStyle = hash(i + block.y) > 0.5 ? 'rgba(116,145,84,0.5)' : 'rgba(151,175,112,0.5)';
        ctx.beginPath();
        ctx.arc(gx, gy, 2 + hash(i * 11) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (block.kind === 'lot') {
      ctx.fillStyle = '#4d4f51';
      ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeStyle = 'rgba(210,205,190,0.15)';
      for (let x = ix + 30; x < ix + iw; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, iy);
        ctx.lineTo(x, iy + ih);
        ctx.stroke();
      }
    } else if (block.kind === 'plaza') {
      ctx.fillStyle = '#d3c3a5';
      ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeStyle = 'rgba(120,100,80,0.18)';
      for (let x = ix; x < ix + iw; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, iy);
        ctx.lineTo(x, iy + ih);
        ctx.stroke();
      }
      for (let y = iy; y < iy + ih; y += 26) {
        ctx.beginPath();
        ctx.moveTo(ix, y);
        ctx.lineTo(ix + iw, y);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#cfc4ae';
      ctx.fillRect(ix, iy, iw, ih);
      for (let i = 0; i < 26; i += 1) {
        const gx = ix + hash(i * 5 + block.x) * iw;
        const gy = iy + hash(i * 9 + block.y) * ih;
        ctx.fillStyle = 'rgba(255,250,235,0.12)';
        ctx.fillRect(gx, gy, 6 + hash(i) * 20, 4);
      }
    }
  }

  // Buildings: long shadow, roof, parapet, roof clutter.
  for (const b of city.buildings) {
    const depth = 7 + b.floors * 1.9;
    ctx.fillStyle = 'rgba(38,40,42,0.26)';
    ctx.fillRect(b.x + depth, b.y + depth, b.w, b.h);
    ctx.fillStyle = b.tone;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    grad.addColorStop(0, 'rgba(255,246,225,0.18)');
    grad.addColorStop(1, 'rgba(60,50,40,0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,250,235,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    ctx.strokeStyle = 'rgba(60,50,40,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    for (const u of b.units) {
      ctx.fillStyle = 'rgba(70,62,52,0.3)';
      ctx.fillRect(u.x, u.y, u.w, u.h);
      ctx.fillStyle = 'rgba(240,232,212,0.5)';
      ctx.fillRect(u.x + 2, u.y + 2, Math.max(3, u.w - 8), 3);
    }
    if (b.floors >= 7) {
      const ax = b.x + b.w * 0.72;
      const ay = b.y + b.h * 0.35;
      ctx.strokeStyle = 'rgba(50,45,40,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + 10, ay - 16);
      ctx.stroke();
      ctx.fillStyle = '#c9553f';
      ctx.beginPath();
      ctx.arc(ax + 10, ay - 17, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.sign) {
      ctx.save();
      ctx.fillStyle = 'rgba(30,30,32,0.72)';
      ctx.fillRect(b.x + b.w * 0.1, b.y + b.h * 0.42, b.w * 0.8, 26);
      ctx.fillStyle = '#f6e9c9';
      ctx.font = 'bold 17px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h * 0.42 + 14);
      ctx.restore();
    }
  }

  // Park paths and plaza details over the ground.
  for (const block of city.blocks) {
    if (block.kind === 'park' && block.park) {
      const p = block.park;
      ctx.fillStyle = 'rgba(214,198,164,0.9)';
      ctx.fillRect(p.x, p.y + p.h / 2 - 8, p.w, 16);
      ctx.fillRect(p.x + p.w / 2 - 8, p.y, 16, p.h);
    }
  }

  for (const prop of city.props) drawProp(ctx, prop, city);

  // Beach and the wet line where the sea reaches the sand.
  ctx.fillStyle = '#e9d6a7';
  ctx.fillRect(city.cityW, 0, CITY.beach, city.height);
  for (let i = 0; i < 220; i += 1) {
    const x = city.beachX + hash(i * 3.1) * CITY.beach;
    const y = hash(i * 7.7) * city.height;
    ctx.fillStyle = 'rgba(196,174,132,0.4)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = 'rgba(214,190,140,0.7)';
  ctx.fillRect(city.waterX - 18, 0, 18, city.height);
  ctx.fillStyle = 'rgba(255,252,240,0.85)';
  for (let y = 0; y < city.height; y += 26) {
    const w = 6 + Math.sin(y * 0.07) * 5;
    ctx.fillRect(city.waterX - w, y, w, 12);
  }
  for (let i = 0; i < 40; i += 1) {
    const x = city.waterX - 40 - hash(i * 2.3) * 120;
    const y = hash(i * 5.1) * city.height;
    ctx.fillStyle = 'rgba(255,250,235,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The open water is animated, so the baked layer leaves it clear instead of painting over it.
  ctx.clearRect(city.waterX, 0, city.width - city.waterX, city.height);

  return canvas;
}

function drawPalm(ctx, prop) {
  const { x, y } = prop;
  const s = prop.size ?? 30;
  const lean = (hash(prop.seed) - 0.5) * s * 0.5;
  ctx.strokeStyle = 'rgba(70,55,40,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 8);
  ctx.lineTo(x + 6 + lean, y - s * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#8a6b43';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.4, y - s * 0.5, x + lean, y - s * 0.9);
  ctx.stroke();
  const tx = x + lean;
  const ty = y - s * 0.9;
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + hash(prop.seed + i) * 0.6;
    const len = s * (0.5 + hash(prop.seed + i * 3) * 0.35);
    ctx.strokeStyle = i % 2 === 0 ? '#3f6f3a' : '#4f8043';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.5 - 4, tx + Math.cos(a) * len, ty + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.fillStyle = '#6a4c2e';
  ctx.beginPath();
  ctx.arc(tx, ty, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx, prop) {
  const s = prop.size ?? 22;
  ctx.fillStyle = 'rgba(40,50,30,0.3)';
  ctx.beginPath();
  ctx.ellipse(prop.x + 6, prop.y + 7, s * 0.9, s * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f6b39';
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(prop.x + Math.cos(a) * s * 0.35, prop.y + Math.sin(a) * s * 0.35, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#57884a';
  ctx.beginPath();
  ctx.arc(prop.x - s * 0.15, prop.y - s * 0.2, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawProp(ctx, prop, city) {
  const { x, y } = prop;
  if (prop.kind === 'palm') return drawPalm(ctx, prop);
  if (prop.kind === 'tree') return drawTree(ctx, prop);
  if (prop.kind === 'lamp') {
    ctx.fillStyle = 'rgba(30,30,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5c5f60';
    ctx.fillRect(x - 2, y - 26, 4, 28);
    ctx.beginPath();
    ctx.arc(x, y - 27, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f2ddac';
    ctx.fill();
    return;
  }
  if (prop.kind === 'bench') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(prop.rot ?? 0);
    ctx.fillStyle = 'rgba(40,35,30,0.25)';
    ctx.fillRect(-12, -3, 26, 10);
    ctx.fillStyle = '#8a6b45';
    ctx.fillRect(-12, -6, 24, 6);
    ctx.fillStyle = '#6a5034';
    ctx.fillRect(-10, 0, 20, 3);
    ctx.restore();
    return;
  }
  if (prop.kind === 'fountain') {
    ctx.fillStyle = 'rgba(40,40,45,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 6, 30, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9cbb0';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6fb6c9';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(x - 5, y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (prop.kind === 'umbrella') {
    const colors = ['#d0543e', '#3e7d9e', '#e0ac3c', '#4c8a5c'];
    const c = colors[Math.floor(hash(prop.seed) * colors.length)];
    ctx.fillStyle = 'rgba(50,40,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 6, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a5540';
    ctx.fillRect(x - 1, y - 1, 2, 12);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,235,0.7)';
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,250,235,0.55)';
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(235,225,205,0.85)';
    ctx.fillRect(x + 14, y + 6, 10, 6);
    return;
  }
  if (prop.kind === 'stall') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(prop.rot ?? 0);
    ctx.fillStyle = 'rgba(40,30,20,0.25)';
    ctx.fillRect(-16, 6, 34, 10);
    ctx.fillStyle = '#b9573e';
    ctx.fillRect(-18, -8, 36, 14);
    ctx.fillStyle = '#f0dfb8';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(-16 + i * 7, -8, 3, 14);
    ctx.fillStyle = '#6b4c31';
    ctx.fillRect(-16, 6, 2, 8);
    ctx.fillRect(14, 6, 2, 8);
    ctx.restore();
    return;
  }
  if (prop.kind === 'dock') {
    ctx.fillStyle = 'rgba(40,30,20,0.25)';
    ctx.fillRect(prop.x + 4, prop.y + 5, prop.w, prop.h);
    ctx.fillStyle = '#8d7355';
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.strokeStyle = 'rgba(70,55,40,0.45)';
    ctx.lineWidth = 1;
    for (let px = prop.x; px < prop.x + prop.w; px += 9) {
      ctx.beginPath();
      ctx.moveTo(px, prop.y);
      ctx.lineTo(px, prop.y + prop.h);
      ctx.stroke();
    }
    return;
  }
  if (prop.kind === 'boat') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(prop.rot ?? 0);
    ctx.fillStyle = 'rgba(20,40,50,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2efe4';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9c9cc';
    ctx.beginPath();
    ctx.ellipse(4, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (prop.kind === 'hut') {
    ctx.fillStyle = 'rgba(50,40,30,0.3)';
    ctx.fillRect(x + 4, y + 5, 22, 18);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(x, y, 22, 18);
    ctx.fillStyle = '#c9543e';
    ctx.fillRect(x - 3, y - 3, 28, 5);
    ctx.fillStyle = '#5f7f8a';
    ctx.fillRect(x + 4, y + 5, 14, 8);
    return;
  }
  if (prop.kind === 'crane') {
    ctx.fillStyle = 'rgba(40,40,40,0.3)';
    ctx.fillRect(x + 4, y + 4, 12, 34);
    ctx.strokeStyle = '#c1743c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 34);
    ctx.lineTo(x, y - 26);
    ctx.lineTo(x + 34, y - 14);
    ctx.stroke();
    ctx.strokeStyle = '#43474a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 26);
    ctx.lineTo(x, y + 2);
    ctx.stroke();
    return;
  }
  if (prop.kind === 'warehouse') {
    ctx.fillStyle = 'rgba(30,30,30,0.28)';
    ctx.fillRect(prop.x + 8, prop.y + 8, prop.w, prop.h);
    ctx.fillStyle = '#9a978d';
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.strokeStyle = 'rgba(60,60,60,0.25)';
    ctx.lineWidth = 1;
    for (let px = prop.x + 6; px < prop.x + prop.w; px += 12) {
      ctx.beginPath();
      ctx.moveTo(px, prop.y + 4);
      ctx.lineTo(px, prop.y + prop.h - 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#6d6a60';
    ctx.fillRect(prop.x + prop.w * 0.35, prop.y + prop.h * 0.2, prop.w * 0.3, prop.h * 0.6);
    return;
  }
  if (prop.kind === 'path') {
    ctx.fillStyle = 'rgba(214,198,164,0.9)';
    if (prop.horizontal) ctx.fillRect(prop.x, prop.y + prop.h / 2 - 8, prop.w, 16);
    else ctx.fillRect(prop.x + prop.w / 2 - 8, prop.y, 16, prop.h);
    return;
  }
  if (prop.kind === 'stripe') {
    ctx.fillStyle = 'rgba(235,230,210,0.6)';
    ctx.fillRect(prop.x, prop.y, 2, prop.h);
    return;
  }
  if (prop.kind === 'lot') {
    return;
  }
}

export function createRenderer(canvas, city) {
  const ctx = canvas.getContext('2d');
  const staticLayer = buildStatic(city);
  const view = { w: canvas.width, h: canvas.height };
  const camera = { x: city.landmarks.hideout.x, y: city.landmarks.hideout.y };

  function resize(w, h, dpr) {
    view.w = w;
    view.h = h;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSea(time, left, right) {
    const top = -200;
    const height = city.height + 400;
    const grad = ctx.createLinearGradient(city.waterX, 0, city.width, 0);
    grad.addColorStop(0, '#63c6d4');
    grad.addColorStop(0.35, '#36a6bf');
    grad.addColorStop(1, '#2189ac');
    ctx.fillStyle = grad;
    ctx.fillRect(city.waterX - 6, top, right - city.waterX + 300, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i += 1) {
      const baseY = top + i * 130 + (time * 7 + i * 31) % 120;
      ctx.beginPath();
      for (let x = city.waterX + 10; x < right + 40; x += 28) {
        const yy = baseY + Math.sin(x * 0.012 + time * 0.9 + i) * 7;
        if (x === city.waterX + 10) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,250,235,0.5)';
    for (let i = 0; i < 18; i += 1) {
      const yy = (i / 18) * city.height + Math.sin(time * 0.6 + i) * 8;
      const xx = city.waterX + 18 + hash(i * 3.7) * 120;
      ctx.beginPath();
      ctx.ellipse(xx, yy, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function visible(x, y, margin = 90) {
    return x > camera.x - view.w / 2 - margin && x < camera.x + view.w / 2 + margin && y > camera.y - view.h / 2 - margin && y < camera.y + view.h / 2 + margin;
  }

  function drawShadow(x, y, rx, ry) {
    ctx.fillStyle = 'rgba(30,32,34,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 6, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPed(ped, time) {
    if (!visible(ped.x, ped.y, 30)) return;
    drawShadow(ped.x, ped.y, 9, 6);
    if (ped.dead) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = 'rgba(120,30,30,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(9, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = ped.state === 'walk' ? Math.sin(ped.step * 7) * 1.3 : Math.sin(time * 20) * 1.8;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.pants;
    ctx.fillRect(-4, 2, 3, 7);
    ctx.fillRect(2, 2, 3, 7);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,30,20,0.75)';
    ctx.beginPath();
    ctx.arc(0, -6.2, 3.4, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCop(unit, time) {
    if (unit.kind === 'foot') {
      if (!visible(unit.x, unit.y, 30)) return;
      drawShadow(unit.x, unit.y, 8, 5);
      ctx.save();
      ctx.translate(unit.x, unit.y);
      ctx.rotate(unit.angle + Math.PI / 2);
      ctx.fillStyle = '#232a3a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e7c3a1';
      ctx.beginPath();
      ctx.arc(0, -5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d2534';
      ctx.beginPath();
      ctx.arc(0, -6, 3.6, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd45a';
      ctx.fillRect(-1.5, -4, 3, 2);
      ctx.restore();
      return;
    }
    return;
  }

  function drawEnemy(enemy, time) {
    if (enemy.dead || !visible(enemy.x, enemy.y, 40)) return;
    drawShadow(enemy.x, enemy.y, 10, 6);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle + Math.PI / 2);
    ctx.fillStyle = '#2b2b31';
    ctx.fillRect(-4, 2, 3, 7);
    ctx.fillRect(2, 2, 3, 7);
    ctx.fillStyle = enemy.boss ? '#3c201f' : '#4a2c27';
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.boss ? 8 : 6, enemy.boss ? 10 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d3a078';
    ctx.beginPath();
    ctx.arc(0, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1d22';
    ctx.beginPath();
    ctx.arc(0, -6.3, 3.5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const frac = enemy.health / enemy.maxHealth;
    if (frac < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(enemy.x - 10, enemy.y - 18, 20, 3);
      ctx.fillStyle = frac > 0.5 ? '#8fe07a' : frac > 0.25 ? '#e8c95a' : '#e0614a';
      ctx.fillRect(enemy.x - 10, enemy.y - 18, 20 * frac, 3);
    }
  }

  function drawCar(car, time) {
    if (!visible(car.x, car.y, 90)) return;
    const w = car.width;
    const l = car.length;
    drawShadow(car.x, car.y, l * 0.5, w * 0.55);
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = '#2a2c2e';
    for (const [dx, dy] of [[-l * 0.3, -w * 0.5], [-l * 0.3, w * 0.5], [l * 0.3, -w * 0.5], [l * 0.3, w * 0.5]]) {
      ctx.fillRect(dx - 4, dy - 2, 9, 4);
    }
    ctx.fillStyle = car.color;
    roundRect(ctx, -l / 2, -w / 2, l, w, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,30,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, -l / 2 + 3, -w / 2 + 3, l - 6, w * 0.28, 3);
    ctx.fill();
    ctx.fillStyle = '#28323a';
    roundRect(ctx, l * 0.12, -w / 2 + 4, l * 0.18, w - 8, 3);
    ctx.fill();
    roundRect(ctx, -l * 0.36, -w / 2 + 4, l * 0.12, w - 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,25,30,0.55)';
    roundRect(ctx, -l * 0.12, -w / 2 + 4, l * 0.3, w - 8, 3);
    ctx.fill();
    if (car.type === 'taxi') {
      ctx.fillStyle = '#f5efe0';
      ctx.fillRect(-3, -4, 6, 8);
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#1c2433';
      ctx.fillRect(-l * 0.05, -w / 2 + 4, l * 0.26, w - 8);
      const flash = Math.sin(time * 14) > 0;
      ctx.fillStyle = flash ? '#e3524a' : '#3f7ad8';
      ctx.beginPath();
      ctx.arc(-2, -w * 0.18, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#3f7ad8' : '#e3524a';
      ctx.beginPath();
      ctx.arc(-2, w * 0.18, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(90,140,255,0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, 46 + Math.sin(time * 10) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.type === 'sports') {
      ctx.fillStyle = 'rgba(20,25,30,0.5)';
      ctx.fillRect(-l / 2 + 2, -w / 2 + 3, 5, w - 6);
    }
    ctx.fillStyle = car.health < 40 ? '#8a3c32' : '#f4e7b8';
    ctx.fillRect(l / 2 - 2, -w / 2 + 4, 2, 5);
    ctx.fillRect(l / 2 - 2, w / 2 - 9, 2, 5);
    ctx.fillStyle = '#b8433a';
    ctx.fillRect(-l / 2, -w / 2 + 4, 2, 5);
    ctx.fillRect(-l / 2, w / 2 - 9, 2, 5);
    if (car.burning) {
      ctx.fillStyle = 'rgba(255,110,40,0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, l * 0.4 + Math.sin(time * 20) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(game, time) {
    const player = game.player;
    if (player.inCar || player.dead) return;
    drawShadow(player.x, player.y, 9, 6);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.fillStyle = '#2b3038';
    const swing = player.moving ? Math.sin(player.stepPhase) * 3 : 0;
    ctx.fillRect(-4, 2 + swing * 0.2, 3, 8);
    ctx.fillRect(2, 2 - swing * 0.2, 3, 8);
    ctx.fillStyle = '#f0e6d2';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0c39d';
    ctx.beginPath();
    ctx.arc(0, -5, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.arc(0, -6.2, 3.6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3c3c42';
    ctx.fillRect(5, -2, 11, 3);
    if (player.muzzle > 0.02) {
      ctx.fillStyle = 'rgba(255,230,150,0.9)';
      ctx.beginPath();
      ctx.arc(16, -0.5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(game, time) {
    const missions = game.missions;
    let marker = missions.marker;
    let color = '255,208,92';
    if (!marker && missions.startPoint) {
      marker = missions.startPoint;
      color = '143,224,150';
    }
    if (!marker) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.4);
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.fillStyle = `rgba(${color},0.14)`;
    ctx.beginPath();
    ctx.arc(0, 0, 44 + pulse * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${color},0.9)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(${color},0.95)`;
    ctx.beginPath();
    ctx.moveTo(0, -50);
    ctx.lineTo(-10, -64);
    ctx.lineTo(10, -64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#232326';
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(missions.state === 'idle' ? 'JOB' : 'GO', 0, -57);
    ctx.restore();
  }

  function drawBullets(game) {
    ctx.lineWidth = 2.2;
    for (const b of game.bullets) {
      if (!visible(b.x, b.y, 40)) continue;
      const alpha = clamp(b.life * 4, 0, 1);
      ctx.strokeStyle = b.owner === 'player' ? `rgba(255,236,170,${alpha})` : `rgba(255,170,120,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.stroke();
    }
  }

  function drawEffects(game) {
    for (const s of game.effects.skids) {
      if (!visible(s.x, s.y, 30)) continue;
      ctx.strokeStyle = `rgba(24,24,26,${0.28 * Math.min(1, s.life / 4)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(s.angle) * 13, s.y + Math.sin(s.angle) * 13);
      ctx.stroke();
    }
    for (const p of game.effects.particles) {
      if (!visible(p.x, p.y, 20)) continue;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.kind === 'smoke' ? `rgba(110,105,96,${alpha * 0.4})` : p.color;
      ctx.globalAlpha = p.kind === 'smoke' ? alpha * 0.4 : alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1.5 - alpha * 0.4 : alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const t of game.effects.floats) {
      if (!visible(t.x, t.y, 60)) continue;
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 15px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }

  function draw(game) {
    const time = game.time;
    const shake = game.effects.state.shake;
    const sx = shake ? (hash(Math.floor(time * 60) * 3.1) - 0.5) * shake : 0;
    const sy = shake ? (hash(Math.floor(time * 60) * 5.7) - 0.5) * shake : 0;
    const halfW = view.w / 2;
    const halfH = view.h / 2;
    camera.x = clamp(game.focus.x, halfW, Math.max(halfW, city.width - halfW));
    camera.y = clamp(game.focus.y, halfH, Math.max(halfH, city.height - halfH));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = canvas.width / view.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2189ac';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(Math.round(halfW - camera.x + sx), Math.round(halfH - camera.y + sy));

    drawSea(time, camera.x - halfW, camera.x + halfW);
    ctx.drawImage(staticLayer, 0, 0);

    drawMarker(game, time);

    for (const ped of game.peds.peds) drawPed(ped, time);
    for (const unit of game.police.units) drawCop(unit, time);
    for (const car of game.cars) drawCar(car, time);
    drawPlayer(game, time);
    for (const enemy of game.missions.enemies) drawEnemy(enemy, time);
    drawBullets(game);
    drawEffects(game);
    ctx.restore();

    // Sun wash and a soft vignette, in screen space.
    const wash = ctx.createLinearGradient(0, 0, view.w, view.h);
    wash.addColorStop(0, 'rgba(255,236,190,0.10)');
    wash.addColorStop(0.55, 'rgba(255,220,170,0.03)');
    wash.addColorStop(1, 'rgba(20,40,60,0.10)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, view.w, view.h);
    const vignette = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(10,15,20,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, view.w, view.h);
    if (game.effects.state.flash > 0.02) {
      ctx.fillStyle = `rgba(${game.effects.state.flashColor},${game.effects.state.flash * 0.16})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  return {
    view,
    camera,
    resize,
    draw,
    getStatic: () => staticLayer,
  };
}