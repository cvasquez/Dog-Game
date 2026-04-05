# Manual Save & Keyboard Legend

## Overview

Two changes: (1) remove auto-save so the player controls when saves happen, with smart reminders to prevent data loss; (2) add a toggleable keyboard legend overlay in the bottom-left corner styled as keyboard key caps.

## 1. Manual Save

### Current behavior
- Single-player auto-saves every 60 seconds via `setInterval` in `local-game.js`
- Tab key triggers manual save
- Prestige triggers save

### New behavior
- **Remove the 60-second auto-save interval** (`AUTO_SAVE_MS` / `this.autoSaveInterval`)
- Save only on: Tab press, prestige action
- Add a **save reminder system** that nudges the player when they have unsaved progress

### Save Reminder

**Trigger conditions** — reminder shows when ALL of these are true:
1. A significant event has occurred since the last save (resource collected, decoration placed, upgrade/emote purchased, blueprint found)
2. It has been **5+ minutes** since the last save (or game start if never saved)
3. A reminder hasn't been shown in the last **60 seconds** (anti-spam)

**Significant events** (tracked via a simple `unsavedChanges` boolean flag):
- `resource_collected` — any resource tile broken
- `decoration_placed` — placed a decoration
- `purchase` — bought an emote, upgrade, or decoration from shop
- `blueprint_found` — discovered a blueprint drop
- Flag resets to `false` on save

**Display:**
- Reuse the existing HUD hint system (`hud.js`) to show `"Unsaved progress — press Tab to save"`
- Show for ~5 seconds, then fade
- After reminder is shown, set a 60-second cooldown before it can show again
- Reminder clears immediately when the player saves

**Implementation location:**
- `client/js/local-game.js` — remove auto-save interval, add `unsavedChanges` flag, add `lastSaveTime` tracking, add reminder check in game loop
- `client/js/hud.js` — add save reminder rendering (or reuse existing hint mechanism)

### Files modified
- `client/js/local-game.js` — remove auto-save, add reminder logic
- `client/js/hud.js` — save reminder display (if not reusing existing hints)

## 2. Keyboard Legend

### Design
A persistent HTML overlay in the bottom-left corner of the game canvas showing available controls as styled keyboard key caps.

### Layout
Compact two-column layout:

```
[W][A][S][D] Move      [Space] Jump
[Shift] Sprint         [F] Dig
[B] Shop               [Tab] Save
[1]-[8] Abilities      [H] Hide
```

### Styling
- **HTML overlay** positioned over the canvas (not canvas-rendered) for crispness
- Small keyboard key elements: dark background (`#2a2118` or similar earthy tone), subtle inset border to look like physical keys, pixel-style font (Press Start 2P or the game's existing retro font)
- Low-profile: small font size (~8-9px), semi-transparent background on the container so it doesn't fully obscure the game
- Bottom-left corner with some padding from edges
- Matches the game's underground/earthy aesthetic per the frontend design guidelines

### Toggle behavior
- **H key** toggles visibility (hide/show)
- Preference stored in `localStorage` key `'doggame_keysVisible'`
- Default: **visible** (for new players)
- When hidden, only a subtle `[H] Keys` indicator remains so the player knows how to bring it back

### Key display content
Shows all player-facing controls for the current mode (single-player):

| Key | Action |
|-----|--------|
| W/A/S/D | Move |
| Space | Jump |
| Shift | Sprint |
| F | Dig |
| B | Shop |
| Tab | Save |
| 1-8 | Abilities |
| R | Recall |
| Esc | Close menu |
| H | Hide/show keys |

### Implementation location
- `client/index.html` — add the key legend HTML structure and CSS
- `client/js/local-game.js` — add H key listener for toggle, localStorage read/write
- `client/js/game.js` — same H key toggle for multiplayer (if controls differ, adjust displayed keys)

### Files modified
- `client/index.html` — HTML + CSS for key legend overlay
- `client/js/local-game.js` ��� toggle logic, localStorage persistence
- `client/js/game.js` — toggle logic for multiplayer

## Out of scope
- Multiplayer auto-save changes (server-controlled)
- Rebindable keys
- Gamepad/controller support
