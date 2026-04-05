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

Deployed to GitHub Pages at https://cvasquez.github.io/Dog-Game (single-player only). GitHub Pages is configured to deploy from the `main` branch.

### Directory Layout

- **`shared/`** — ES modules imported by both server and client (no build step)
  - `constants.js` — Tile types, physics values, breed stats, resource economy, message protocol
  - `sprite-data.js` — Pixel art data (16x16 grids of palette indices per breed/animation)
- **`server/`** — Node.js backend
  - `index.js` — Express + WebSocket, routes JOIN messages to rooms
  - `rooms.js` — Authoritative game loop (20Hz tick), physics, digging, hazards, economy
  - `world-gen.js` — Seeded terrain generation (6 passes: terrain, caves, tunnels, granite, lava, biomes)
  - `persistence.js` — Local SQLite storage for worlds and player progress (multiplayer fallback)
  - **`scripts/`** — Utility scripts
  - `seed-sprites.js` — Seeds dog breed sprites to Supabase
  - `seed-decoration-sprites.js` — Seeds decoration sprites to Supabase
  - `seed-shop-sprites.js` — Seeds shop machine sprites (stash, decorations, emotes, upgrades) to Supabase
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

### Database — Supabase

**Supabase is the primary database.** All persistent data that needs to survive across deployments or be available on GitHub Pages goes through Supabase. Schema changes must be made in the Supabase SQL editor and reflected in `supabase-schema.sql`.

- **Config:** `client/js/supabase.js` holds the project URL and anon key. The Supabase JS SDK is loaded via CDN in `client/index.html` and `client/editor/index.html`.
- **Schema:** `supabase-schema.sql` is the source of truth for all Supabase tables. Run it in the Supabase SQL editor to set up or update the database.

**Tables:**

| Table | Purpose | Used by |
|-------|---------|---------|
| `custom_sprites` | User-edited dog breed sprites from the sprite editor | `sprites.js`, `editor/index.html`, `scripts/seed-sprites.js` |
| `decoration_sprites` | Decoration pixel art and palettes from the sprite editor | `sprites.js`, `editor/index.html`, `scripts/seed-decoration-sprites.js` |
| `shop_sprites` | Shop machine pixel art (decorations, emotes, upgrades, stash) | `sprites.js`, `editor/index.html`, `scripts/seed-shop-sprites.js` |
| `worlds` | Persistent world data (tiles, placed decorations) | Schema defined but currently only used via local SQLite |
| `players` | Player progress per world (resources, upgrades) | Schema defined but currently only used via local SQLite |

**When making database changes:**
1. Add/modify the table in `supabase-schema.sql`
2. Run the migration SQL in the Supabase SQL editor
3. If seeding data, add or update the relevant script in `scripts/`
4. Update any client code that reads/writes the table (`sprites.js`, editor, etc.)
5. The local SQLite schema in `server/persistence.js` is a **multiplayer-only fallback** — keep it in sync but Supabase is authoritative

**Seeding data:**

Seed scripts auto-load `.env` via dotenv. Create a `.env` file in the project root with:
```
SUPABASE_URL=<your-supabase-url>
SUPABASE_KEY=<your-supabase-anon-key>
```

```bash
node scripts/seed-sprites.js              # Seed breed sprites (inserts new only, skips existing)
node scripts/seed-decoration-sprites.js   # Seed decoration sprites (inserts new only, skips existing)
node scripts/seed-shop-sprites.js         # Seed shop sprites (inserts new only, skips existing)
# Pass --force to overwrite existing rows (DESTRUCTIVE — will replace DB edits with local files)
```

### Multiplayer Protocol

Client sends `INPUT` messages with `{left, right, up, down, jump, dig}` booleans. Server runs physics authoritatively at 20Hz and broadcasts `STATE` snapshots. Tile breaks are broadcast as `TILE_UPDATE`. The client does prediction for local movement but server state wins on conflict.

### Adding New Content

- **New tile type:** Add to `TILE` enum in constants.js, add to `SOLID_TILES`/`HAZARD_TILES` if needed, add `HARDNESS` and `TILE_COLORS` entries, add `RESOURCE_NAMES`/`RESOURCE_VALUE` if it's a resource, add rendering in `sprites.js`'s `genTileSprite`, add generation logic in both `server/world-gen.js` and `client/js/world-gen.js`.
- **New breed:** Add to `DOG_BREEDS` array in constants.js (colors + stat multipliers), add sprite data in `sprite-data.js` for all 6 animation states, add breed button in `client/index.html`.
- **New decoration:** Add to `DECORATIONS` array in constants.js (id, name, cost, w, h, color, desc, effect), add pixel art in `sprite-data.js` (`DECORATION_SPRITES` and `DECORATION_PALETTES` entries), run `node scripts/seed-decoration-sprites.js` to push to Supabase. The local SQLite DB auto-seeds missing decorations on server startup.
- **New upgrade:** Add to `UPGRADES` in constants.js with id, name, icon, desc, category, cost, effect (stat multipliers), and optional `requires` (prerequisite upgrade id). Server-side `applyServerUpgrades()` in `rooms.js` and client-side `applyUpgrades()` in `player.js` handle stat recalculation.
- **Tuning balance:** All gameplay constants (stamina, climbing, movement feel, tile hardness, dig cost) are in `shared/constants.js`.

## Changelog

**Every significant change must include a changelog entry.** When you make changes to gameplay balance, add features, fix bugs, or make other player-facing changes, add an entry to `client/changelog.html`.

### What requires a changelog entry
- New features (breeds, tiles, decorations, upgrades, game modes)
- Balance changes (stamina, physics, dig speed, resource values, tile hardness)
- Bug fixes that affect gameplay
- UI/UX improvements visible to players
- New or modified game mechanics

### What does NOT require a changelog entry
- Code refactors with no player-visible effect
- Documentation-only changes (CLAUDE.md, comments)
- Dev tooling changes (scripts, build config)

### How to add an entry
1. Open `client/changelog.html`
2. Add a new `<div class="version-entry">` block **at the top** of the entries section (below the HTML comment template)
3. Use the appropriate category labels: `added`, `changed`, `fixed`, `balance`
4. Bump the version number: patch (x.x.**X**) for fixes/tweaks, minor (x.**X**.0) for new features
5. Set the date to the current date (YYYY-MM-DD format)

### Entry format
```html
<div class="version-entry">
  <div class="version-heading">
    <span class="version-tag">vX.X.X</span>
    <span class="version-date">YYYY-MM-DD</span>
  </div>
  <div class="version-title">Short summary</div>
  <div class="change-category">
    <div class="category-label added">Added</div>
    <ul class="change-list">
      <li>Description of what was added</li>
    </ul>
  </div>
</div>
```

Available category labels: `added` (green), `changed` (gold), `fixed` (red), `balance` (purple).

## Pre-Commit Consistency Checks

Before committing changes, verify the following. These checks apply to **every commit** that touches game content.

### 1. Sprites — Editor & Database Sync

If new sprites were added (breed, decoration, or shop/machine sprites):
- **Sprite data** must exist in `shared/sprite-data.js` (as default fallback)
- **Editor support**: the sprite must be selectable in `client/editor/index.html`
  - Breeds: auto-populated from `DOG_BREEDS` — no changes needed
  - Decorations: auto-populated from `DECORATIONS` — no changes needed
  - Shops: check the `shopEntries` array includes the new type (stash, etc.)
- **Seed script**: ensure the relevant seed script in `scripts/` can insert the new sprite
- **Database seeding** (how to add to DB without overwriting existing edits):
  ```bash
  node scripts/seed-sprites.js              # inserts new only, skips existing
  node scripts/seed-decoration-sprites.js   # inserts new only, skips existing
  node scripts/seed-shop-sprites.js         # inserts new only, skips existing
  # NEVER use --force unless you intentionally want to overwrite DB edits
  ```

### 2. Constants — File Completeness

If `shared/constants.js` was modified (new exports, new constants, changed signatures):
- Verify the new constant is **imported** in `client/admin/index.html`
- If it's a numeric tuning value, add it to the **C object** and appropriate **CONST_SECTIONS** entry
- If it's a complex structure (array, object, Set), add it to the **deep-clone block** and the **export function**

### 3. Constants Editor — Export Parity

The admin editor's `generateConstantsJS()` function must produce a **valid drop-in replacement** for `shared/constants.js`. When any of the following change, update the export function:
- New exported constants or functions
- New properties on existing structures (breed fields, emote flags, decoration flags)
- New helper functions (like `getNearbyBank`)
- Static data structures (Sets, arrays) that aren't editable but must be present

**Quick check**: diff `shared/constants.js` exports against the export function's output. Every `export const` and `export function` in the source must appear in the generated output.

## Frontend Design Guidelines

When building or modifying UI for this game, follow these principles to create distinctive, polished interfaces that avoid generic "AI slop" aesthetics.

### Design Thinking

Before coding any UI, consider:

- **Context**: This is a pixel art digging game with dogs. The aesthetic should feel playful, tactile, and grounded in the pixel art world — not like a corporate SaaS dashboard.
- **Tone**: Lean into the game's personality — earthy, underground, charming, slightly rugged. Think retro game UI meets cozy exploration.
- **Consistency**: UI elements should feel like they belong in the same world as the pixel sprites and tile-based terrain.

### Typography

- Prefer pixel-style or characterful fonts that complement the game's retro aesthetic (e.g., Press Start 2P, Silkscreen, or similar bitmap-inspired fonts).
- Avoid generic system fonts (Arial, Inter, Roboto) for game-facing UI. These break the pixel art immersion.
- Use readable body fonts where needed for longer text, but pair them with a distinctive display font for headings and labels.

### Color & Theme

- Draw colors from the game's existing palette — earth tones, stone grays, warm browns, lava oranges, gem-like accent colors.
- Use CSS variables for theming consistency across lobby, HUD, and menus.
- Avoid: purple-on-white gradients, generic blue primary buttons, washed-out neutral palettes. These scream "AI-generated."
- Dominant earthy tones with sharp gem/mineral accents (ruby red, sapphire blue, emerald green) match the digging theme.

### Layout & Spatial Design

- Game UI (HUD, menus, breed picker) should use pixel-snapped sizing where possible — borders, padding, and margins that align to the tile grid.
- The lobby and menus can break from strict pixel grids but should still feel handcrafted, not template-generated.
- Use generous spacing and clear visual hierarchy. Avoid cramming elements together.
- Asymmetry and personality are welcome — not every element needs to be perfectly centered.

### Motion & Interaction

- Prefer CSS-only animations for HTML UI elements.
- Canvas animations should use the existing particle system and rendering pipeline.
- Micro-interactions (hover effects on breed buttons, menu transitions) should feel snappy and game-like, not floaty corporate animations.
- Prioritize responsiveness — interactions should feel instant in a game context.

### Visual Details & Atmosphere

- Add depth through textures and effects that match the underground theme:
  - Subtle noise/grain overlays for a dig-site feel
  - Vignette effects on the game canvas
  - Layered backgrounds with parallax for menus
  - Border styles that evoke stone, dirt, or carved surfaces
- Avoid: flat white backgrounds, generic card layouts, drop shadows that look like Material Design.

### What to Avoid

**Never produce generic AI aesthetics:**
- Overused fonts (Inter, Roboto, Arial, system-ui as display fonts)
- Purple/blue gradient hero sections
- Perfectly symmetrical, predictable grid layouts with rounded cards
- Cookie-cutter component patterns that ignore the game's personality
- Generic placeholder imagery or icons — use pixel art or game-themed elements

### Canvas & Game-Specific UI

- HUD elements rendered on canvas should use the existing sprite and color systems from `sprites.js` and `constants.js`.
- New HUD elements should match the pixel density and rendering style of existing ones.
- Overlays (pause screens, death screens, inventory) should integrate with the canvas pipeline, not awkwardly float HTML on top unless there's a clear UX reason.
- Respect the existing 16x16 tile grid and sprite dimensions when designing in-game UI.

### Guiding Principle

Every UI element should feel like it was designed specifically for a game about dogs digging underground. If you could swap the UI into a random web app and it would still look "fine," it's too generic. Commit to the game's identity.

