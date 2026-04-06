# Multiplayer Physics Alignment

**Date:** 2026-04-05
**Status:** Approved

## Problem

Server and client use completely different physics models, causing:
1. **Janky controls** — server uses instant velocity (`vx = -speed`), client uses acceleration-based movement. Constant state corrections fight client prediction.
2. **Lag jumping** — server lacks coyote time, jump buffering, variable jump height, and apex gravity. Jump trajectories diverge.
3. **Missing climb/wall mechanics** — server has zero climbing, so wall interactions desync completely.
4. **Broken remote sprites** — server doesn't broadcast `climbing`/`clinging`/`mantling` state.

## Solution

Port client physics from `client/js/player.js` `predictUpdate()` to `server/rooms.js` `updatePlayer()`.

### Changes to `server/rooms.js`

**New imports:** `ACCEL_GROUND`, `DECEL_AIR`, `JUMP_CUT_MULTIPLIER`, `APEX_GRAVITY_MULT`, `COYOTE_TIME`, `JUMP_BUFFER_TIME`, `CLIMB_SPEED`, `CLING_SLIDE_SPEED`, `CLIMB_JUMP_FORCE`, `STAMINA_CLIMB_COST`, `STAMINA_CLING_COST`, `STAMINA_CLIMB_JUMP`, `ICY_TILES`, `SLIPPERY_TILES`

**New player fields in `createPlayer()`:**
- `prevJump: false`, `jumpHeld: false`
- `coyoteTimer: 0`, `jumpBufferTimer: 0`, `jumpWasCut: false`
- `climbing: false`, `clinging: false`, `clingWallSide: 0`, `mantling: false`
- `climbEfficiency: 1` (from breed stats)

**New helper functions:**
- `checkWall(room, player, side)` — check 3 points (head, mid, feet) for solid tiles
- `canMantle(room, player, side)` — check ledge geometry, return mantle target position
- `isOnIce(room, player)` / `isOnSlippery(room, player)` — tile-below checks

**Rewritten `updatePlayer()` physics:**
1. Acceleration-based horizontal movement with `ACCEL_GROUND`, ground turning boost, `DECEL_AIR`
2. Ice/slippery deceleration modifiers
3. Coyote time and jump buffering
4. Variable jump height (jump cut on release)
5. Apex gravity for floaty peak
6. Wall cling/climb/jump with stamina costs
7. Ledge mantle detection (instant teleport, no animation)
8. Corner correction on ceiling hits

**Updated STATE broadcast:** Add `climbing`, `clinging`, `clingWallSide`, `mantling` fields.

### Not Changed

- Client prediction code stays as-is (it's the reference implementation)
- Client reconciliation (`applyServerState`) stays as-is (will naturally work better with aligned physics)
- Mantle animation stays client-side only (server just teleports to final position)
- No tick rate changes (20Hz is fine once physics align)
