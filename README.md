# Costa Dorada

[![make.fun entry](https://make.fun/badge/gta6-01.svg)](https://make.fun/)
[![leaderboard rank](https://make.fun/badge/gta6-01/Thai-ji/gta6-openworld/rank.svg)](https://make.fun/)
[![reward](https://make.fun/badge/gta6-01/Thai-ji/gta6-openworld/reward.svg)](https://make.fun/)

An original open-world crime game for the browser, built for the **gta6-01** jam on
[make.fun](https://make.fun/). No engine, no libraries, no assets: one canvas, a procedural coastal
city, and more than four thousand lines of plain JavaScript.

## The city

**Costa Dorada** is a sunlit Latin-American coast split into three districts: Los Brisas in the north,
Centro in the middle, Marina Salas in the south. Eleven blocks by eight, a beach along the eastern
shore, docks and a marina, a mercado, a bank tower, a scrapyard, a palm-lined overlook. Traffic runs
both directions on every street, pedestrians walk the sidewalks, and the afternoon light never quite
lets the shadows go.

You play **Marco Vela**, a driver with a debt and a cousin who knows people. Five jobs take you from
stealing a car off the street to taking the coast from the man who thinks he owns it.

## What you can do

- Walk, sprint, aim with the mouse, fire a pistol, and take cover behind the fact that bullets hurt.
- Enter or steal **any** car in the city. Traffic cars brake, swerve and honk at each other.
- Earn a wanted level from 1 to 5 stars: patrol cars spawn on nearby roads, foot officers join at
  three stars, and hiding out of sight slowly cools the heat.
- Get wasted or busted and wake up at the hideout with a fee taken out of your cash.
- Work five missions: car theft, a crew shootout, an armored-van heist, a sunset chase, and the
  final run at Hector Salas.
- Earn cash and reputation, rank up from Rookie to Coast King, and keep your progress in local
  storage between sessions.
- Drive with a HUD, a live minimap, a speedometer, a wanted display and objective markers.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrows | Walk or drive |
| `Shift` | Sprint on foot, throttle in a car |
| Mouse | Aim / steer while driving |
| Left click | Fire |
| `F` or `E` | Enter or leave a vehicle |
| `Space` | Handbrake while driving, confirm |
| `Esc` or `P` | Pause |

## Run it locally

ES modules need an HTTP origin, so serve the `game` folder instead of opening the HTML directly:

```sh
node tools/serve.mjs
# open http://127.0.0.1:4321/
```

## Submission build

`main.ts` copies `game/` and `screenshots/` into the output directory and writes the canonical
`dossier.json` with the vendor helper:

```sh
node main.ts
```

## Structure

```
game/index.html          canvas, loading card, module entry
game/src/config.js       city, cars, police, ranks, tuning
game/src/city.js         procedural blocks, buildings, landmarks, roads
game/src/render.js       static city bake + per-frame world pass
game/src/vehicles.js     car physics, traffic AI, parked cars
game/src/peds.js         sidewalk pedestrians and panic
game/src/player.js       on-foot movement, aiming, health
game/src/police.js       wanted stars, patrols, foot officers
game/src/missions.js     the five-job story and its markers
game/src/shots.js        deterministic staged scenes for the screenshots
screenshots/             the four scenes shown on the entry page
```

## Screenshots

Four frames, all rendered by the game itself: a police chase on the coastal boulevard, a firefight
in the plaza, a cruise past the marina, and the Meridian job in progress.