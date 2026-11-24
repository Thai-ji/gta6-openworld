// sprint-3d witness
// Builds the payload make.fun receives: the playable game folder, the four staged screenshots, and the
// dossier that is generated from them. Run by the judging sandbox with `node main.ts`; it uses only the
// Node standard library plus the untouched vendor helper, and writes nothing outside the output folder.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

function prepare(): void {
  const sourceGame = join(ROOT, 'game');
  const sourceShots = join(ROOT, 'screenshots');
  if (!existsSync(join(sourceGame, 'index.html'))) {
    throw new Error('game/index.html is not in the tree');
  }

  const shots = existsSync(sourceShots)
    ? readdirSync(sourceShots).filter((name) => /\.(png|jpe?g)$/i.test(name))
    : [];
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
  }

  mkdirSync(OUT, { recursive: true });
  const targetGame = join(OUT, 'game');
  const targetShots = join(OUT, 'screenshots');
  if (existsSync(targetGame)) rmSync(targetGame, { recursive: true, force: true });
  if (existsSync(targetShots)) rmSync(targetShots, { recursive: true, force: true });

  cpSync(sourceGame, targetGame, { recursive: true });
  mkdirSync(targetShots, { recursive: true });
  for (const name of shots) cpSync(join(sourceShots, name), join(targetShots, name));

  const files = walk(targetGame).length;
  if (files > CAPS.game_max_files) {
    throw new Error(`game tree has ${files} files, limit is ${CAPS.game_max_files}`);
  }
  for (const file of walk(targetGame)) {
    const relative = file.slice(targetGame.length + 1);
    if (relative.length > CAPS.game_path_max_bytes) {
      throw new Error(`path too long in game tree: ${relative}`);
    }
  }

  const dossier = buildDossier(OUT, CAPS);
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  console.log(`game files: ${files}`);
  console.log(`screenshots: ${shots.length} (${shots.join(', ')})`);
  console.log(`dossier: ${dossier.byteLength} bytes`);
}

prepare();