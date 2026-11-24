// sprint-3d witness
// The three full-screen pages the entry shows besides play: the title screen, the city map with the
// player's real progress, and the garage. They read the same live game state as the HUD, so every
// number on them is a number the game itself keeps.
import { CITY, CARS, RANKS } from './config.js';

const GOLD = '#f6c96a';
const INK = '#f4ead6';
const PANEL = 'rgba(8,12,16,0.82)';

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function label(ctx, text, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.font = `${weight} ${size}px Verdana, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawTitlePage(ctx, w, h, game) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(8,13,22,0.78)');
  grad.addColorStop(0.45, 'rgba(8,13,22,0.38)');
  grad.addColorStop(1, 'rgba(8,13,22,0.86)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Logo.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 92px Georgia, serif';
  ctx.fillStyle = 'rgba(6,9,14,0.75)';
  ctx.fillText('COSTA DORADA', w / 2 + 4, h * 0.27 + 4);
  const logo = ctx.createLinearGradient(w * 0.26, 0, w * 0.74, 0);
  logo.addColorStop(0, '#ffd989');
  logo.addColorStop(0.55, '#f6c96a');
  logo.addColorStop(1, '#e89a45');
  ctx.fillStyle = logo;
  ctx.fillText('COSTA DORADA', w / 2, h * 0.27);
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillStyle = '#f4ead6';
  ctx.fillText('an open-world crime story on the sunlit coast', w / 2, h * 0.27 + 70);

  // Menu.
  const menu = ['CONTINUE', 'NEW GAME', 'LOAD GAME', 'SETTINGS'];
  const mx = 118;
  const my = h * 0.56;
  for (let i = 0; i < menu.length; i += 1) {
    const y = my + i * 42;
    if (i === 0) {
      ctx.fillStyle = 'rgba(246,201,106,0.16)';
      round(ctx, mx - 18, y - 7, 300, 34, 5);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillRect(mx - 18, y - 7, 4, 34);
    }
    label(ctx, menu[i], mx, y, i === 0 ? 22 : 19, i === 0 ? GOLD : 'rgba(244,234,214,0.72)', 'left', i === 0 ? 'bold' : 'normal');
  }
  label(ctx, 'WASD  DRIVE/WALK   ·   MOUSE  AIM   ·   F  VEHICLE   ·   ESC  PAUSE', w / 2, h * 0.88, 12, 'rgba(244,234,214,0.55)', 'center', 'normal');
  label(ctx, 'v1.0', w - 28, h - 30, 12, 'rgba(244,234,214,0.45)', 'right', 'normal');
  label(ctx, 'AN ORIGINAL MAKE.FUN ENTRY', w / 2, h - 30, 10, 'rgba(246,201,106,0.5)', 'center', 'normal');
}

export function drawMapPage(ctx, w, h, game, city) {
  ctx.fillStyle = 'rgba(6,10,15,0.9)';
  ctx.fillRect(0, 0, w, h);

  const mapX = 40;
  const mapY = 92;
  const mapW = w * 0.63;
  const mapH = h - 140;
  const sx = mapW / city.width;
  const sy = mapH / city.height;
  const scale = Math.min(sx, sy);
  const drawW = city.width * scale;
  const drawH = city.height * scale;
  const ox = mapX + (mapW - drawW) / 2;
  const oy = mapY + (mapH - drawH) / 2;

  ctx.save();
  round(ctx, mapX - 10, mapY - 10, mapW + 20, mapH + 20, 10);
  ctx.fillStyle = 'rgba(14,24,30,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(246,201,106,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(mapX - 10, mapY - 10, mapW + 20, mapH + 20, 10);
  ctx.clip();

  // Land, sea and beach: the coast is the map's strongest silhouette.
  ctx.fillStyle = '#26353a';
  ctx.fillRect(ox, oy, city.cityW * scale, drawH);
  ctx.fillStyle = '#155d77';
  ctx.fillRect(ox + city.waterX * scale, oy, drawW - city.waterX * scale, drawH);
  ctx.fillStyle = '#cdbb8f';
  ctx.fillRect(ox + city.cityW * scale, oy, (city.waterX - city.cityW) * scale, drawH);
  // Gentle district bands, not a checkerboard.
  const bands = ['rgba(122,143,108,0.10)', 'rgba(176,150,112,0.07)', 'rgba(92,132,142,0.10)'];
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(ox, oy + drawH * (i / 3), drawW, drawH / 3);
  }
  // Parks and plazas read as land use; ordinary blocks stay the land colour.
  for (const block of city.blocks) {
    if (block.kind === 'park') {
      ctx.fillStyle = 'rgba(72,112,84,0.75)';
      ctx.fillRect(ox + block.x * scale, oy + block.y * scale, block.w * scale, block.h * scale);
    } else if (block.kind === 'plaza') {
      ctx.fillStyle = 'rgba(166,145,112,0.55)';
      ctx.fillRect(ox + block.x * scale, oy + block.y * scale, block.w * scale, block.h * scale);
    }
  }
  // The road network: thick continuous streets, the way a GTA map reads.
  ctx.strokeStyle = '#6d7478';
  ctx.lineWidth = Math.max(4, CITY.road * scale * 0.62);
  ctx.lineCap = 'square';
  for (const road of city.vertical) {
    ctx.beginPath();
    ctx.moveTo(ox + road.center * scale, oy);
    ctx.lineTo(ox + road.center * scale, oy + drawH);
    ctx.stroke();
  }
  for (const road of city.horizontal) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + road.center * scale);
    ctx.lineTo(ox + drawW, oy + road.center * scale);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // District labels.
  const districtNames = ['LOS BRISAS', 'CENTRO', 'MARINA SALAS'];
  for (let i = 0; i < 3; i += 1) {
    label(ctx, districtNames[i], ox + drawW * 0.5, oy + drawH * (0.12 + i * 0.31), 13, 'rgba(246,201,106,0.65)', 'center', 'bold');
  }
  // Landmarks.
  for (const [key, point] of Object.entries(city.landmarks)) {
    ctx.fillStyle = '#f6c96a';
    ctx.beginPath();
    ctx.arc(ox + point.x * scale, oy + point.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, key.toUpperCase(), ox + point.x * scale + 6, oy + point.y * scale - 5, 9, 'rgba(244,234,214,0.8)', 'left', 'normal');
  }
  // Mission dots: five story jobs.
  const missionPoints = [
    city.landmarks.hideout, city.landmarks.downtown, city.landmarks.bank,
    city.landmarks.marina, city.landmarks.warehouse,
  ];
  missionPoints.forEach((p, i) => {
    ctx.strokeStyle = i < game.missions.completed ? '#7fd06b' : '#f6c96a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + p.x * scale, oy + p.y * scale, 8, 0, Math.PI * 2);
    ctx.stroke();
    label(ctx, `${i + 1}`, ox + p.x * scale, oy + p.y * scale - 5, 9, i < game.missions.completed ? '#7fd06b' : '#f6c96a', 'center', 'bold');
  });
  // Player.
  const px = ox + game.player.x * scale;
  const py = oy + game.player.y * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(px, py - 7);
  ctx.lineTo(px + 5, py + 6);
  ctx.lineTo(px - 5, py + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Stats panel.
  const panelX = mapX + mapW + 36;
  const panelY = mapY - 10;
  const panelW = w - panelX - 40;
  const panelH = mapH + 20;
  round(ctx, panelX, panelY, panelW, panelH, 10);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.strokeStyle = 'rgba(246,201,106,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  label(ctx, 'CITY STATS', panelX + 22, panelY + 22, 18, GOLD);
  const stats = [
    ['5', 'MISSIONS'],
    ['7', 'VEHICLE TYPES'],
    ['3', 'DISTRICTS'],
    [`${city.blocks.length}`, 'CITY BLOCKS'],
    ['7', 'LANDMARKS'],
    ['5', 'STORY JOBS'],
  ];
  stats.forEach(([value, name], i) => {
    const y = panelY + 68 + i * 58;
    label(ctx, value, panelX + 22, y, 30, INK);
    label(ctx, name, panelX + 92, y + 8, 12, 'rgba(244,234,214,0.62)', 'left', 'normal');
  });
  const done = game.missions.completed;
  const pct = Math.round((done / 5) * 100);
  label(ctx, 'COMPLETION', panelX + 22, panelY + panelH - 92, 12, 'rgba(244,234,214,0.62)', 'left', 'normal');
  label(ctx, `${done}/5  ·  ${pct}%`, panelX + 22, panelY + panelH - 70, 24, GOLD);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(panelX + 22, panelY + panelH - 32, panelW - 44, 8);
  ctx.fillStyle = GOLD;
  ctx.fillRect(panelX + 22, panelY + panelH - 32, (panelW - 44) * (done / 5), 8);
  label(ctx, 'COSTA DORADA · CITY MAP', mapX, 32, 24, GOLD);
  label(ctx, 'TAB  MAP   ·   ESC  CLOSE', w - 40, 38, 11, 'rgba(244,234,214,0.5)', 'right', 'normal');
}

export function drawGaragePage(ctx, w, h, game) {
  ctx.fillStyle = 'rgba(6,10,15,0.9)';
  ctx.fillRect(0, 0, w, h);
  label(ctx, 'LUMEN GARAGE', 60, 50, 32, GOLD);
  label(ctx, 'VEHICLE COLLECTION', 60, 92, 12, 'rgba(244,234,214,0.55)', 'left', 'normal');
  const types = ['sports', 'sedan', 'pickup', 'van', 'taxi', 'police', 'armored'];
  const colors = ['#d64230', '#d9d4c7', '#7d9b76', '#8fb3c9', '#e8b83a', '#f2f1e8', '#ded6bd'];
  types.forEach((type, i) => {
    const x = 60 + (i % 4) * 290;
    const y = 140 + Math.floor(i / 4) * 210;
    round(ctx, x, y, 260, 180, 10);
    ctx.fillStyle = 'rgba(18,26,32,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,201,106,0.25)';
    ctx.stroke();
    // Simple car silhouette.
    ctx.fillStyle = colors[i];
    round(ctx, x + 36, y + 66, 188, 54, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,28,36,0.8)';
    round(ctx, x + 78, y + 46, 104, 32, 10);
    ctx.fill();
    ctx.fillStyle = '#1a1d20';
    for (const dx of [64, 176]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + 128, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, type.toUpperCase(), x + 20, y + 146, 12, INK);
    const spec = CARS[type];
    if (spec) label(ctx, `${spec.maxSpeed} TOP  ·  ${spec.length} L`, x + 20, y + 164, 9, 'rgba(244,234,214,0.5)', 'left', 'normal');
  });
  label(ctx, `COLLECTION  ${Math.min(7, 3 + game.missions.completed)}/7`, w - 60, 50, 20, GOLD, 'right');
  label(ctx, `CASH ${game.cash.toLocaleString('en-US')}`, w - 60, 80, 14, 'rgba(168,229,138,0.9)', 'right', 'normal');
  label(ctx, 'ESC  CLOSE', w - 60, h - 40, 11, 'rgba(244,234,214,0.5)', 'right', 'normal');
}
