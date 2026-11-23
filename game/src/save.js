// Save and resume: cash, reputation, which job is next, where the player stands.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(game) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: Math.round(game.cash),
        rep: Math.round(game.rep),
        index: game.missions.index,
        finished: game.missions.finished,
        x: Math.round(game.player.x),
        y: Math.round(game.player.y),
        clock: Math.round(game.clockMinutes),
      }),
    );
  } catch {
    // A full or disabled localStorage must never stop a game.
  }
}