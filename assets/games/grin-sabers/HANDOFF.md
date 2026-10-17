# Grin Sabers — handoff

Plan: the "Grin Sabers: design" doc (claude.ai/artifact/E5ci3p3huPKsoY8HzHeDPe).
Page: `grin-sabers.html` (`/grin-sabers`). Not linked from the arcade yet (phase 6).

## Rules for sessions
- New code goes in the folder that owns it; `game.js` is boot, menus and the loop only.
- Troll Forces files are imported read-only (`troll-ops/characters/character.js`).
  Never edit them from a Grin Sabers session.
- Bump `?v=` on every module you change, and in its importers.
- Test: `node tools/grin-sabers-p1-test.mjs [--shots]`. It steps the sim by hand
  (`__gs.manual(true)` + `__gs.step(sec)`): the headless GPU runs ~5 fps.

## Layout
combat/ (fighter, swings, forms, resolve) · bots/ · modes/duel.js · view/ (scene, saber)
· arenas/ · input/ · ui/hud.js · sound/sfx.js

## Shipped
- 2026-10-16 phase 1: duels vs 4 bot tiers, aim-based swings and guards, perfect
  block, disarm, feint, clash, combos, heavy, dodge, jump; temple courtyard; demo title.
