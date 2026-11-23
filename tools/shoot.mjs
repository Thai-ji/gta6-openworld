// Captures the four entry screenshots from the game itself. Starts the local server, drives headless
// Chrome through the deterministic ?shot= scenes at 1280x720, then hands the PNGs to shrink.py so the
// final JPEGs stay under the 256 KiB gate.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'shots-raw');
const OUT = join(ROOT, 'screenshots');
const PORT = Number(process.env.SHOT_PORT ?? 4399);
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHOTS = ['cover', 'onfoot', 'cruise', 'heist'];

mkdirSync(RAW, { recursive: true });
if (!existsSync(CHROME)) {
  console.error(`chrome not found at ${CHROME}; set CHROME_PATH`);
  process.exit(1);
}

const server = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/index.html`);
      if (response.ok) return true;
    } catch {
      /* still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

function capture(shot) {
  const target = join(RAW, `${shot}.png`);
  const profile = join(tmpdir(), `costa-chrome-${shot}-${Date.now()}`);
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--window-size=1280,720',
    `--user-data-dir=${profile}`,
    `--screenshot=${target}`,
    '--virtual-time-budget=6000',
    `http://127.0.0.1:${PORT}/?shot=${shot}${process.env.SHOT_DEBUG ? '&debug=1' : ''}`,
  ];
  const result = spawnSync(CHROME, args, { stdio: 'inherit', timeout: 90000 });
  rmSync(profile, { recursive: true, force: true });
  if (result.error || result.status !== 0) {
    throw new Error(`chrome failed for ${shot}: ${result.error ?? result.status}`);
  }
  if (!existsSync(target) || statSync(target).size < 4096) {
    throw new Error(`empty screenshot for ${shot}`);
  }
  return target;
}

try {
  const ready = await waitForServer();
  if (!ready) throw new Error(`server did not answer on ${PORT}`);
  for (const shot of SHOTS) {
    const file = capture(shot);
    console.log(`captured ${shot}: ${statSync(file).size} bytes`);
  }
} finally {
  server.kill();
}

const python = process.env.PYTHON ?? 'python';
const shrink = spawnSync(python, [join(ROOT, 'tools', 'shrink.py'), RAW, OUT], { stdio: 'inherit' });
if (shrink.status !== 0) {
  console.error('shrink step failed');
  process.exit(1);
}
const finals = readdirSync(OUT).filter((name) => name.endsWith('.jpg'));
console.log(`final screenshots: ${finals.join(', ')}`);