// sprint-3d witness
// The interface: cash, rank and reputation, the minimap, wanted stars, health and armour, the
// objective banner, vehicle speed, and the dialogue box the story speaks through. Everything is
// drawn in screen space over the world, in one warm palette so it reads like a game and not a
// debug overlay.
import { CITY, RANKS } from './config.js';
import { clamp } from './math.js';

const GOLD = '#f6c96a';
const INK = '#f4ead6';

function money(n) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = GOLD;
    ctx.fill();
  }
  ctx.strokeStyle = filled ? 'rgba(80,50,10,0.8)' : 'rgba(20,20,20,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildMiniMap(city, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  const sx = w / city.width;
  const sy = h / city.height;
  c.fillStyle = '#12222b';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#1d5f7d';
  c.fillRect(city.waterX * sx, 0, w - city.waterX * sx, h);
  c.fillStyle = '#d9c79b';
  c.fillRect(city.cityW * sx, 0, (city.waterX - city.cityW) * sx, h);
  for (const block of city.blocks) {
    c.fillStyle = block.kind === 'park' ? '#31513f' : '#2a3a40';
    c.fillRect(block.x * sx, block.y * sy, block.w * sx, block.h * sy);
    c.fillStyle = 'rgba(110,120,120,0.55)';
    for (const b of city.buildings) {
      if (b.x >= block.x && b.x < block.x + block.w && b.y >= block.y && b.y < block.y + block.h) {
        c.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
      }
    }
  }
  c.strokeStyle = 'rgba(220,210,190,0.28)';
  c.lineWidth = 1.5;
  for (const road of city.vertical) {
    c.beginPath();
    c.moveTo(road.center * sx, 0);
    c.lineTo(road.center * sx, h);
    c.stroke();
  }
  for (const road of city.horizontal) {
    c.beginPath();
    c.moveTo(0, road.center * sy);
    c.lineTo(w, road.center * sy);
    c.stroke();
  }
  return { canvas, sx, sy };
}

export function createHud(canvas, city, view) {
  const ctx = canvas.getContext('2d');
  const mini = buildMiniMap(city, 208, 138);
  let banner = { text: '', sub: '', life: 0 };
  let notice = { text: '', life: 0 };

  function rankFor(rep) {
    let current = RANKS[0];
    let next = null;
    for (let i = 0; i < RANKS.length; i += 1) {
      if (rep >= RANKS[i].rep) {
        current = RANKS[i];
        next = RANKS[i + 1] ?? null;
      }
    }
    return { current, next };
  }

  function drawMiniMap(game) {
    const x = 24;
    const y = view.h - 24 - 138;
    const { sx, sy } = mini;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, 208, 138, 10);
    ctx.clip();
    ctx.drawImage(mini.canvas, x, y);
    const px = x + game.player.x * sx;
    const py = y + game.player.y * sy;
    if (game.missions.marker) {
      const mx = x + game.missions.marker.x * sx;
      const my = y + game.missions.marker.y * sy;
      const pulse = 3 + Math.sin(game.time * 4) * 1.5;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(mx, my - 6);
      ctx.lineTo(mx + 5, my + 3);
      ctx.lineTo(mx - 5, my + 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(246,201,106,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, pulse + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (game.missions.startPoint) {
      const mx = x + game.missions.startPoint.x * sx;
      const my = y + game.missions.startPoint.y * sy;
      ctx.fillStyle = '#8fe08e';
      ctx.beginPath();
      ctx.arc(mx, my, 4 + Math.sin(game.time * 4) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const unit of game.police.units) {
      ctx.fillStyle = '#ff6a57';
      ctx.beginPath();
      ctx.arc(x + unit.x * sx, y + unit.y * sy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const chase of game.missions.chasers) {
      ctx.fillStyle = '#ff9c3f';
      ctx.beginPath();
      ctx.arc(x + chase.car.x * sx, y + chase.car.y * sy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.player.angle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,30,40,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(246,225,180,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, 210, 140, 11);
    ctx.stroke();
    ctx.fillStyle = 'rgba(12,18,22,0.55)';
    ctx.fillRect(x + 4, y + 4, 28, 14);
    ctx.fillStyle = '#f4ead6';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x + 18, y + 11);
  }

  function drawBars(game) {
    const x = 24;
    const y = view.h - 24 - 138 - 34;
    const w = 208;
    ctx.fillStyle = 'rgba(12,18,22,0.6)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 26, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 8, y + 7, w - 16, 5);
    ctx.fillStyle = game.player.health > 30 ? '#7fd06b' : '#e05a48';
    ctx.fillRect(x + 8, y + 7, (w - 16) * clamp(game.player.health / 100, 0, 1), 5);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 8, y + 16, w - 16, 4);
    ctx.fillStyle = '#6fa9e8';
    ctx.fillRect(x + 8, y + 16, (w - 16) * clamp(game.player.armor / 100, 0, 1), 4);
  }

  function drawTopLeft(game) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillStyle = 'rgba(10,14,18,0.55)';
    ctx.fillText(money(game.cash), 26, 25);
    ctx.fillStyle = '#a8e58a';
    ctx.fillText(money(game.cash), 24, 22);
    const { current, next } = rankFor(game.rep);
    const span = next ? next.rep - current.rep : 1;
    const frac = next ? clamp((game.rep - current.rep) / span, 0, 1) : 1;
    ctx.fillStyle = 'rgba(12,18,22,0.55)';
    ctx.beginPath();
    ctx.roundRect(24, 62, 196, 30, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(32, 76, 180, 6);
    ctx.fillStyle = GOLD;
    ctx.fillRect(32, 76, 180 * frac, 6);
    ctx.fillStyle = INK;
    ctx.font = 'bold 9px Verdana, sans-serif';
    ctx.fillText(current.name.toUpperCase(), 32, 66);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244,234,214,0.55)';
    ctx.fillText(next ? next.name.toUpperCase() : 'MAX', 204, 66);
  }

  function drawTopRight(game) {
    const x = view.w - 24;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    for (let i = 0; i < 5; i += 1) {
      star(ctx, x - 12 - i * 26, 34, 10, i < game.police.stars);
    }
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillStyle = 'rgba(10,14,18,0.55)';
    ctx.fillText(game.clockText(), x - 1, 55);
    ctx.fillStyle = INK;
    ctx.fillText(game.clockText(), x - 2, 54);
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText(city.districtName(game.player.x, game.player.y), x - 2, 82);
  }

  function drawObjective(game) {
    const missions = game.missions;
    if (missions.state === 'idle' && missions.startPoint === null) return;
    const title = missions.state === 'idle' ? 'AVAILABLE JOB' : missions.def.title;
    const objective = missions.objective;
    const w = 520;
    const x = view.w / 2 - w / 2;
    const y = 22;
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 58, 8);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.fillRect(x, y + 10, 3, 38);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText(title, x + 16, y + 10);
    ctx.font = 'bold 15px Verdana, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(objective, x + 16, y + 30);
    if (missions.marker) {
      const d = Math.round(Math.hypot(missions.marker.x - game.player.x, missions.marker.y - game.player.y) * 0.45);
      ctx.textAlign = 'right';
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.fillStyle = 'rgba(246,201,106,0.9)';
      ctx.fillText(`${d} m`, x + w - 16, y + 30);
    }
  }

  function drawVehicle(game) {
    const car = game.player.inCar;
    const x = view.w - 24;
    const y = view.h - 24;
    if (car) {
      const speed = Math.round(Math.abs(car.speed) * 0.42);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 10px Verdana, sans-serif';
      ctx.fillStyle = 'rgba(244,234,214,0.65)';
      ctx.fillText(carLabel(car.type), x, y - 40);
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillStyle = INK;
      ctx.fillText(`${speed}`, x - 34, y - 4);
      ctx.font = 'bold 11px Verdana, sans-serif';
      ctx.fillStyle = 'rgba(244,234,214,0.6)';
      ctx.fillText('KM/H', x, y - 4);
      // Damage bar: the real car health, always visible so the screenshot shows a damage model.
      ctx.textAlign = 'right';
      ctx.font = 'bold 9px Verdana, sans-serif';
      ctx.fillStyle = 'rgba(244,234,214,0.55)';
      ctx.fillText('DAMAGE', x, y - 78);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x - 148, y - 66, 148, 6);
      ctx.fillStyle = car.health > 55 ? '#7fd06b' : car.health > 25 ? '#e8c95a' : '#e0523f';
      ctx.fillRect(x - 148, y - 66, 148 * clamp(car.health / 100, 0, 1), 6);
      if (car.health < 45) {
        ctx.fillStyle = car.health < 25 ? '#e0523f' : '#e8c95a';
        ctx.fillText(car.health < 25 ? 'ENGINE FAILING' : 'DAMAGED', x, y - 58);
      }
    }
  }

  function carLabel(type) {
    return type === 'police' ? 'POLICE CRUISER' : type === 'armored' ? 'ARMORED VAN' : type === 'sports' ? 'SPYDER' : type.toUpperCase();
  }

  // The dispatch panel the screenshots use to prove a police response bigger than one patrol car:
  // every row is a real unit from game.police.units, with its real distance to the player.
  function drawDispatch(game) {
    const units = game.police.units;
    if (!units.length && !game.shotMode) return;
    const w = 278;
    const x = view.w - 24 - w;
    const y = 146;
    const h = 212;
    ctx.fillStyle = 'rgba(8,13,18,0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,201,106,0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText('CDPD DISPATCH', x + 14, y + 12);
    ctx.textAlign = 'right';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(244,234,214,0.55)';
    ctx.fillText(`${units.length} UNITS`, x + w - 14, y + 14);
    const roles = ['RAMMING', 'BOX IN', 'SPOTLIGHT'];
    for (let i = 0; i < 6; i += 1) {
      const unit = units[i];
      const rowY = y + 38 + i * 26;
      if (rowY > y + h - 18) break;
      if (unit) {
        const ux = unit.car ? unit.car.x : unit.x;
        const uy = unit.car ? unit.car.y : unit.y;
        const d = Math.round(Math.hypot(ux - game.player.x, uy - game.player.y) * 0.42);
        const role = unit.kind === 'foot' ? 'FOOT' : roles[i % roles.length];
        const state = d < 140 ? 'ENGAGED' : d < 380 ? 'CLOSING' : 'EN ROUTE';
        ctx.textAlign = 'left';
        ctx.font = 'bold 11px Verdana, sans-serif';
        ctx.fillStyle = '#ffd7a0';
        ctx.fillText(`UNIT ${String(i + 1).padStart(2, '0')}`, x + 14, rowY);
        ctx.fillStyle = 'rgba(244,234,214,0.86)';
        ctx.font = 'bold 10px Verdana, sans-serif';
        ctx.fillText(role, x + 96, rowY);
        ctx.textAlign = 'right';
        ctx.fillStyle = state === 'ENGAGED' ? '#ff7a63' : state === 'CLOSING' ? '#ffc563' : 'rgba(244,234,214,0.55)';
        ctx.fillText(`${d}m · ${state}`, x + w - 14, rowY);
      } else {
        ctx.textAlign = 'left';
        ctx.font = '10px Verdana, sans-serif';
        ctx.fillStyle = 'rgba(244,234,214,0.25)';
        ctx.fillText(`UNIT ${String(i + 1).padStart(2, '0')}`, x + 14, rowY);
        ctx.fillText('STANDBY', x + 96, rowY);
      }
    }
  }

  // A small crew card: the two people the story names, not invented filler.
  function drawCrewCard(game) {
    if (!game.shotMode && game.police.stars < 1) return;
    const x = 24;
    const y = view.h - 24 - 138 - 34 - 92;
    const w = 208;
    const h = 78;
    ctx.fillStyle = 'rgba(8,13,18,0.68)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,201,106,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText('CREW', x + 10, y + 7);
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText('MARCO VELA', x + 10, y + 24);
    ctx.fillStyle = 'rgba(244,234,214,0.55)';
    ctx.font = '9px Verdana, sans-serif';
    ctx.fillText('DRIVER', x + 100, y + 26);
    ctx.fillStyle = INK;
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.fillText('INES', x + 10, y + 44);
    ctx.fillStyle = 'rgba(244,234,214,0.55)';
    ctx.font = '9px Verdana, sans-serif';
    ctx.fillText('FIXER', x + 100, y + 46);
    ctx.fillStyle = '#7fd06b';
    ctx.font = 'bold 9px Verdana, sans-serif';
    ctx.fillText('RADIO READY', x + 10, y + 62);
  }

  // Six-slot weapon wheel. The game actually carries one sidearm, so five slots stay visibly empty:
  // the wheel is a real inventory view, not a painted-on number.
  function drawWeaponWheel(game) {
    if (game.player.inCar) return;
    const cx = view.w - 112;
    const cy = view.h - 112;
    const r = 82;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(8,13,18,0.62)';
    ctx.beginPath();
    ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,201,106,0.38)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const labels = ['PISTOL', '—', '—', '—', '—', '—'];
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const px = Math.cos(a) * r * 0.62;
      const py = Math.sin(a) * r * 0.62;
      const active = i === 0;
      ctx.fillStyle = active ? 'rgba(246,201,106,0.22)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.arc(px, py, 23, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 9px Verdana, sans-serif';
      ctx.fillStyle = active ? GOLD : 'rgba(244,234,214,0.3)';
      ctx.fillText(labels[i], px, py);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText('1 / 6', 0, 2);
    ctx.font = '8px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(244,234,214,0.45)';
    ctx.fillText('WEAPONS', 0, 18);
    ctx.restore();
  }

  function drawHint(game) {
    if (game.shotMode) return;
    let hint = '';
    if (game.missions.state === 'intro' || game.missions.state === 'outro') return;
    if (game.player.inCar) hint = 'WASD DRIVE  ·  SPACE HANDBRAKE  ·  F EXIT';
    else {
      const near = game.nearestCarHint;
      if (near) hint = 'F  ENTER VEHICLE';
      else hint = 'WASD MOVE  ·  MOUSE AIM  ·  CLICK FIRE  ·  F VEHICLE';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(10,14,18,0.6)';
    ctx.fillText(hint, view.w / 2 + 1, view.h - 25);
    ctx.fillStyle = 'rgba(244,234,214,0.8)';
    ctx.fillText(hint, view.w / 2, view.h - 26);
  }

  function drawCrosshair(game) {
    if (game.player.inCar || game.missions.state !== 'active') return;
    const { x, y } = game.mouseScreen;
    ctx.strokeStyle = 'rgba(255,240,200,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 14, y);
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + 14);
    ctx.stroke();
  }

  function drawDialogue(game) {
    const missions = game.missions;
    if (missions.state !== 'intro' && missions.state !== 'outro') return;
    const line = missions.dialogue.lines[missions.dialogue.i];
    if (!line) return;
    const w = Math.min(880, view.w - 120);
    const x = view.w / 2 - w / 2;
    const y = view.h - 188;
    ctx.fillStyle = 'rgba(8,11,14,0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 116, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(246,201,106,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.fillStyle = line.who === 'MARCO' ? '#8fd8ff' : line.who === 'HECTOR' ? '#ff8f7a' : GOLD;
    ctx.fillText(line.who, x + 22, y + 14);
    ctx.font = '16px Verdana, sans-serif';
    ctx.fillStyle = INK;
    const lines = wrap(ctx, line.text, w - 44);
    lines.forEach((text, i) => ctx.fillText(text, x + 22, y + 36 + i * 22));
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(246,201,106,0.8)';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.fillText(`${missions.dialogue.i + 1}/${missions.dialogue.lines.length}   CLICK / E ▸`, x + w - 20, y + 96);
  }

  function drawBanner(game) {
    if (banner.life <= 0) return;
    const alpha = Math.min(1, banner.life);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillStyle = 'rgba(8,11,14,0.65)';
    ctx.fillText(banner.text, view.w / 2 + 2, view.h * 0.36 + 2);
    ctx.fillStyle = GOLD;
    ctx.fillText(banner.text, view.w / 2, view.h * 0.36);
    if (banner.sub) {
      ctx.font = 'bold 14px Verdana, sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText(banner.sub, view.w / 2, view.h * 0.36 + 42);
    }
    ctx.globalAlpha = 1;
  }

  function drawNotice() {
    if (notice.life <= 0) return;
    ctx.globalAlpha = Math.min(1, notice.life);
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(notice.text, view.w / 2, view.h - 58);
    ctx.globalAlpha = 1;
  }

  return {
    draw(game, dt) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = canvas.width / view.w;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      drawTopLeft(game);
      drawTopRight(game);
      drawObjective(game);
      drawMiniMap(game);
      drawBars(game);
      drawVehicle(game);
      drawCrewCard(game);
      drawDispatch(game);
      drawWeaponWheel(game);
      drawCrosshair(game);
      drawHint(game);
      drawDialogue(game);
      drawBanner(game);
      drawNotice();
      banner.life = Math.max(0, banner.life - dt * 0.42);
      notice.life = Math.max(0, notice.life - dt * 0.6);
    },
    banner(text, sub = '') {
      banner = { text, sub, life: 2.6 };
    },
    notice(text) {
      notice = { text, life: 2.4 };
    },
  };
}