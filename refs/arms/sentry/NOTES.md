# Sentry gun (zombies turret, BO2 style)

Builder: `assets/games/troll-ops/models/build_zkit.blender.py` (`build_turret`)
-> `zk-turret.glb`. Pivots: `turret_head` (yaw), `turret_gun` (pitch),
`turret_barrels` (spins while firing), `turret_muzzle`.

## Files

- `bo2-sentry-reference.png`: **missing, add it.** The user pasted a
  Black Ops 2 sentry gun render in chat (2026-11-01, "use this"): a
  six-barrel rotary gun on a boxy receiver, a big ammo box on the right,
  a light grey camera on top at the back, a pan head on a stout column,
  three straight splayed legs with knee collars and flat octagonal pads,
  all in worn dark gunmetal. The session that built the model could not
  save a pasted image. Drop the file here under this name.
- `build-four-views.png`: the build (v3), four views (side, two 3/4s,
  top), Blender EEVEE, before the x1.2 scale.
- `game-trollcity.png`: in the game on Troll City, beside a walker, firing
  at a second one (barrels spinning). This is the BO2 size: about 1.24 m
  to the camera, barrels at a soldier's waist.

## Picks where the reference and the build disagree

- Camera: the reference has it over the receiver at the back. v1 put it
  on the ammo box, and v2 moved it over the receiver.
- Ammo box: the reference box is dark grey with lighter worn edges. The
  build is a flat grey-olive with no edge wear yet. Edge wear could be a
  later pass.
- Size: the user asked for BO2's size. The model is laid out at 1/1.2 and
  scaled by `SCALE = 1.2` at export. The kit footprint
  (`modes/zombies/kits.js`) is 1.05 x 1.05 x 1.3 m.
