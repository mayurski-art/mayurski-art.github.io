# Grin Sabers — handoff

Plan: the "Grin Sabers: design" doc (claude.ai/artifact/E5ci3p3huPKsoY8HzHeDPe).
Page: `sabers.html` (trollrunner.net/sabers), card on games.html + home Arcade menu.
`grin-sabers.html` only redirects old links to /sabers.

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
- 2026-10-16 key art: poster (loading screen) + banner (OG, future arcade card), rendered
  from the game by `node tools/grin-sabers-poster.mjs`.
- 2026-10-16 grip: sword fists on the hilt (the rig mitts hide while armed), hilt drawn
  1.3x, centred ready stance, high guard over the head, windups clear of the face (-gs2).
