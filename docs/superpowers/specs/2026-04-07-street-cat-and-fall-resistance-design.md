# Street Cat Breed & Per-Breed Fall Resistance

**Date:** 2026-04-07
**Status:** Approved

## Overview

Add a new "Street Cat" breed (id 5, default name "Fritzy") as an agile acrobat archetype — fast, high-jumping, excellent fall resistance, terrible digger, fragile HP. Simultaneously introduce a per-breed `fallResistance` stat that multiplies the safe-fall threshold, giving every breed a distinct fall damage profile.

## New Breed: Street Cat

| Field | Value |
|-------|-------|
| id | 5 |
| name | Street Cat |
| defaultName | Fritzy |
| desc | "Agile acrobat. Lightning reflexes, lands on her feet, can't dig worth a darn." |
| colors | body: `#708090` (slate gray), dark: `#3B3B3B` (charcoal), light: `#C0C0C0` (silver) |
| freeEmote | 4 (Celebrate) |
| hitboxWidth | 0.75 (standard) |
| hitboxHeight | 0.625 (shorter — cat proportions) |

### Stats

| Stat | Value | Rationale |
|------|-------|-----------|
| moveSpeed | 1.35 | Very fast, slightly under Pitty's 1.4 |
| jumpForce | 1.45 | Highest jumper — cats leap |
| digSpeed | 0.5 | Worst digger — cats don't dig |
| maxStamina | 1.1 | Good climber endurance |
| staminaRegen | 1.1 | Recovers quickly |
| maxHP | 0.75 | Fragile — glass cannon |
| fallResistance | 2.5 | Can fall 5 blocks safely (base 2 x 2.5) |

### Identity

The fastest, most vertical breed — amazing at traversal and surviving big falls, but terrible at the core digging loop and dies easily to hazards. High risk/high reward exploration pick.

## Fall Resistance Mechanic

### New Stat: `fallResistance`

A multiplier applied to `FALL_DAMAGE_MIN_BLOCKS` on a per-breed basis.

### Updated Formula

```
effectiveThreshold = FALL_DAMAGE_MIN_BLOCKS * breed.stats.fallResistance
damage = (fallBlocks - effectiveThreshold)^2 * FALL_DAMAGE_SCALE
```

Only applied when `fallBlocks > effectiveThreshold`. The quadratic scaling and stun frames remain unchanged.

### Per-Breed Values

| Breed | fallResistance | Effective safe-fall (blocks) | Rationale |
|-------|---------------|------------------------------|-----------|
| Pitty | 1.2 | 2.4 | Tanky, takes hits well |
| Dachshund | 0.8 | 1.6 | Short legs, fragile |
| Terrier | 1.0 | 2.0 | Balanced (unchanged) |
| Shorkie | 1.0 | 2.0 | Neutral |
| Street Cat | 2.5 | 5.0 | Signature ability — lands on feet |

### Interaction with Upgrades

The `fallResistance` stat should be eligible for upgrade/decoration/emote buff multipliers through the existing stat application chain, same as moveSpeed or maxStamina. If an upgrade provides `fallResistance: 0.2`, it adds 20% of the base value.

## Files to Change

### 1. `shared/constants.js`
- Add `fallResistance` to every breed's `stats` object
- Add Street Cat entry at id 5 in `DOG_BREEDS`

### 2. `server/rooms.js`
- Read `fallResistance` from breed stats in `createPlayer()`
- Update fall damage calculation to use `FALL_DAMAGE_MIN_BLOCKS * player.fallResistance`

### 3. `client/js/player.js`
- Store `baseFallResistance` from breed stats in constructor
- Update fall damage calculation to use per-breed threshold
- Ensure `applyUpgrades()` handles `fallResistance` if present

### 4. `client/js/local-game.js`
- Verify fall damage handling — if it delegates to player.js, no separate change needed

### 5. `shared/sprite-data.js`
- Add placeholder sprite data for Street Cat across all 6 animation states (idle, walk, dig, climb, jump, sit)
- Use gray-scale palette: slot 1 = slate gray body, slot 2 = charcoal dark, slot 3 = silver light

### 6. `client/changelog.html`
- New version entry documenting the Street Cat breed and fall resistance mechanic

### 7. `client/admin/index.html`
- Verify `fallResistance` appears in the constants editor if breed stats are editable there

## Out of Scope

- Cat-specific animations or sprite silhouette changes (uses same sprite format as dogs)
- New upgrade items specifically for fall resistance (can be added later)
- Sound effects for cat landing
