# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies (better-sqlite3 requires native build)
npm start            # Run server at http://localhost:3000
npm run dev          # Run with nodemon (auto-restart)
```

No linter or test framework is configured. Validate changes by importing modules:
```bash
node -e "import('./shared/constants.js').then(() => console.log('OK'))"
node -e "import('./server/rooms.js').then(() => console.log('OK'))"
```

Quick smoke test — server should print the startup message and exit cleanly:
```bash
timeout 3 node server/index.js
```

## Architecture

### Two Game Modes, One Codebase

The game runs in **multiplayer** (Express + WebSocket server) and **single-player** (static files, works on GitHub Pages). The client dynamically imports `game.js` only when multiplayer is chosen; single-player uses `local-game.js` which runs the full game loop locally with localStorage saves.

Deployed to GitHub Pages at https://cvasquez.github.io/Dog-Game (single-player only).

### Directory Layout

- **`shared/`** — ES modules imported by both server and client (no build step)
  - `constants.js` — Tile types, physics values, breed stats, resource economy, message protocol
  - `sprite-data.js` — Pixel art data (16x16 grids of palette indices per breed/animation)
- **`server/`** — Node.js backend
  - `index.js` — Express + WebSocket, routes JOIN messages to rooms
  - `rooms.js` — Authoritative game loop (20Hz tick), physics, digging, hazards, economy
  - `world-gen.js` — Seeded terrain generation (6 passes: terrain, caves, tunnels, granite, lava, biomes)
  - `persistence.js` — SQLite storage for worlds and player progress
- **`client/`** — Vanilla JS frontend, no bundler
  - `js/main.js` — Entry point, lobby UI, breed picker
  - `js/local-game.js` — Single-player: runs physics locally, saves to localStorage
  - `js/game.js` — Multiplayer: forwards input to server, applies state updates
  - `js/player.js` — Player state machine, physics, stamina, climbing, mantling, hazard checks
  - `js/sprites.js` — Renders sprites from `sprite-data.js` palette data, tile sprites, decorations
  - `js/renderer.js` — Canvas drawing pipeline (sky, tiles, players, particles, HUD)
  - `editor/index.html` — In-browser sprite editor at `/editor/`

### Key Concepts

**Shared constants drive everything.** `shared/constants.js` defines tile enums, physics values, breed stats, resource names/values, and the WebSocket message protocol. Both server and client import it directly as an ES module.

**Sprites are data-driven.** Each breed has pixel art defined as arrays of 16-char strings (palette indices 0-8). Index 0 = transparent, 1-3 = breed colors (body/dark/light), 4-8 = fixed colors. The sprite editor at `/editor/` loads and exports this data.

**Player animation states:** idle, walk, dig, climb, jump, sit. The `sit` state triggers after ~2s of idle on ground. State is derived in `player.js`'s `predictUpdate()` method.

**World generation** uses a seeded Mulberry32 PRNG for reproducibility. The same seed produces the same world on both client and server. World is a flat `Uint8Array` of tile IDs (64 wide x 256 tall).

**Physics model:** AABB collision against tile grid. Player dimensions are fractional tiles (0.75 wide x 0.75 tall). Climbing uses a BotW-style stamina system with exhaustion. Ledge mantling auto-snaps players onto ledge tops.

### Multiplayer Protocol

Client sends `INPUT` messages with `{left, right, up, down, jump, dig}` booleans. Server runs physics authoritatively at 20Hz and broadcasts `STATE` snapshots. Tile breaks are broadcast as `TILE_UPDATE`. The client does prediction for local movement but server state wins on conflict.

### Adding New Content

- **New tile type:** Add to `TILE` enum in constants.js, add to `SOLID_TILES`/`HAZARD_TILES` if needed, add `HARDNESS` and `TILE_COLORS` entries, add `RESOURCE_NAMES`/`RESOURCE_VALUE` if it's a resource, add rendering in `sprites.js`'s `genTileSprite`, add generation logic in both `server/world-gen.js` and `client/js/world-gen.js`.
- **New breed:** Add to `DOG_BREEDS` array in constants.js (colors + stat multipliers), add sprite data in `sprite-data.js` for all 6 animation states, add breed button in `client/index.html`.
- **New decoration:** Add to `DECORATIONS` in constants.js, add draw function in `sprites.js`, add cost.
