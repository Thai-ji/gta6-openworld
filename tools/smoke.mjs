// Drives the real game in headless Chrome over the DevTools protocol: starts it, walks with W, enters
// the nearest car with F, and reports state so a broken loop cannot hide behind a pretty screenshot.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = 4401;
const DEBUG_PORT = 9333;
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const server = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
const profile = join(tmpdir(), `costa-smoke-${Date.now()}`);
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--force-device-scale-factor=1',
  '--window-size=1280,720',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function targets() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await response.json();
      const page = list.find((entry) => entry.type === 'page');
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error('chrome debugging endpoint did not appear');
}

const page = await targets();
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const events = [];
let nextId = 1;

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve: done, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else done(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    events.push(`exception: ${message.params.exceptionDetails.text} ${message.params.exceptionDetails.exception?.description ?? ''}`);
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    events.push(`log: ${message.params.entry.text}`);
  }
});

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

function key(type, key, code, keyCode) {
  return call('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

await new Promise((done) => socket.addEventListener('open', done));
await call('Runtime.enable');
await call('Log.enable');
await call('Page.enable');
await call('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });

let ready = false;
for (let attempt = 0; attempt < 80; attempt += 1) {
  await sleep(200);
  try {
    ready = await evaluate('!!window.__costa');
  } catch {
    ready = false;
  }
  if (ready) break;
}
console.log('ready', ready);

const before = await evaluate(`(() => { const g = window.__costa; return g && { state: g.state, cash: g.cash, cars: g.cars.length, peds: g.peds.peds.length, x: Math.round(g.player.x), y: Math.round(g.player.y) }; })()`);
console.log('boot', JSON.stringify(before));

await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
await sleep(400);
const started = await evaluate('window.__costa.state');
console.log('after click', started);

// The first job starts the moment the player wakes up at the hideout; advance its dialogue first.
let dialogue = await evaluate('window.__costa.missions.state');
for (let attempt = 0; attempt < 8 && dialogue === 'intro'; attempt += 1) {
  await key('keyDown', 'Enter', 'Enter', 13);
  await key('keyUp', 'Enter', 'Enter', 13);
  await sleep(180);
  dialogue = await evaluate('window.__costa.missions.state');
}
console.log('after dialogue', dialogue);

const startPos = await evaluate('({x: window.__costa.player.x, y: window.__costa.player.y})');
await key('keyDown', 'w', 'KeyW', 87);
await sleep(900);
await key('keyUp', 'w', 'KeyW', 87);
const moved = await evaluate('({x: window.__costa.player.x, y: window.__costa.player.y, state: window.__costa.state})');
const distance = Math.hypot(moved.x - startPos.x, moved.y - startPos.y);
console.log('after W', JSON.stringify({ ...moved, distance: Math.round(distance) }));

const mission = await evaluate(`(() => { const m = window.__costa.missions; return { state: m.state, index: m.index, objective: m.objective }; })()`);
console.log('mission', JSON.stringify(mission));

// Steal a parked car, then park it on the delivery marker to prove the job chain advances.
await evaluate(`(() => { const g = window.__costa; const car = g.cars.find((c) => c.kind === 'parked' && !c.driver); g.player.x = car.x; g.player.y = car.y + 18; return car.type; })()`);
await key('keyDown', 'f', 'KeyF', 70);
await key('keyUp', 'f', 'KeyF', 70);
await sleep(350);
const carState = await evaluate(`(() => { const g = window.__costa; return { inCar: g.player.inCar?.type ?? null, stage: g.missions.stage, marker: g.missions.marker && { x: Math.round(g.missions.marker.x), y: Math.round(g.missions.marker.y) } }; })()`);
console.log('in car', JSON.stringify(carState));

const delivered = await evaluate(`(() => { const g = window.__costa; const m = g.missions.marker; if (!m || !g.player.inCar) return null; g.player.inCar.x = m.x; g.player.inCar.y = m.y; g.player.x = m.x; g.player.y = m.y; return true; })()`);
await sleep(700);
const afterJob = await evaluate(`(() => { const g = window.__costa; return { index: g.missions.index, stage: g.missions.stage, cash: g.cash, inCar: !!g.player.inCar }; })()`);
console.log('after delivery', JSON.stringify({ delivered, ...afterJob }));

// Next job opens with a dialogue; clear it so the world keeps simulating.
for (let attempt = 0; attempt < 8; attempt += 1) {
  const state = await evaluate('window.__costa.missions.state');
  if (state !== 'intro' && state !== 'outro') break;
  await key('keyDown', 'Enter', 'Enter', 13);
  await key('keyUp', 'Enter', 'Enter', 13);
  await sleep(160);
}

// Wanted level should actually spawn patrol cars.
await evaluate('window.__costa.police.addWanted(2)');
await sleep(2600);
const wanted = await evaluate(`(() => { const g = window.__costa; return { stars: g.police.stars, state: g.missions.state, units: g.police.units.length, policeCars: g.cars.filter((c) => c.kind === 'police').length }; })()`);
console.log('wanted', JSON.stringify(wanted));

console.log('errors', events.length ? events.join(' | ') : 'none');

const failed = !before
  || started !== 'playing'
  || distance < 10
  || dialogue !== 'active'
  || !carState.inCar
  || afterJob.index < 1
  || wanted.units < 1
  || events.length > 0;
socket.close();
chrome.kill();
server.kill();
try {
  await sleep(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
} catch {
  /* chrome may still hold the profile; it lives in temp anyway */
}
process.exit(failed ? 1 : 0);