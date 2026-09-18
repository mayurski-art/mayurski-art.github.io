# Troll Ops — first-person hand/arm
### Design doc v1 — viewmodel hand rig + scorestreak call gesture

Status: **Phase 1 not started.** No code written yet.

---

## 1. Why this exists

Every weapon and melee mesh in Troll Ops renders as a **free-floating
object** in the first-person overlay — there is no hand or forearm anywhere
in the game. This was fine as a stylized look, but it means the new UAV/
Lightning Strike flyover animations (see `streak-entities.js`) have no way
to show the BO2-style "look at your wrist/tablet to call it in" gesture,
because there's no arm to hold the tablet.

Building that gesture properly means building the hand/arm as a real,
reusable part of the viewmodel — not a one-off just for streaks — so a gun,
the melee weapons, and a new streak-device mesh all attach to the same
rig consistently.

## 2. What exists today (read this before changing anything)

- **`weaponRig`** (`game.js` ~2065): a `THREE.Group` in a separate
  `weaponScene`/`weaponCamera` overlay, rendered on top of the main scene so
  the tiny gun mesh never fights near-plane clipping. **`weaponRig` itself
  never moves** — it's a fixed parent.
- **`activeWeaponMesh`** (`game.js`, built by `setActiveWeaponMesh` →
  `weapon-model.js buildWeaponMesh(def)`): the one mesh that actually gets
  repositioned every frame, in `updateWeaponView()` (`game.js` ~5435). Its
  `.position`/`.rotation` are set directly each frame from hip/ADS lerp +
  bob + sway + recoil kick + inspect pose + reload pose. There is no
  intermediate "hand" transform — the gun *is* the whole viewmodel.
- **`activeMeleeMesh`** (`setActiveMeleeMesh` → `gear.js buildMeleeMesh(def)`):
  same idea, positioned every frame in `updateMeleeView()` (`game.js` ~5127)
  from `melee.pose()` plus bob/lower/idle-sway.
- **`setHolding(what)`** (`game.js` ~3185): the only tri-state switch that
  exists (`"gun" | "melee"`), toggles `.visible` on the two meshes above.
- **23 weapon defs** in `weapons.js`, all built by ONE shared procedural
  path in `weapon-model.js buildWeaponMesh()` — **except** `tank`-stock
  (`greencandle`), which is its own `buildTankLauncher()`. Every regular
  weapon's pistol grip is the exact same formula:
  ```js
  const grip = box(0.05, isPistol ? 0.13 : 0.15, 0.055, darkMat);
  grip.position.set(0, -bodyH * (isPistol ? 1.1 : 1.3), isPistol ? len * 0.18 : len * 0.02);
  grip.rotation.x = 0.32;
  ```
  `bodyH` and `len` are both derived from `def.model` (`len`, `heavy`,
  `def.cls === "sidearm"`) — nothing here is hand-authored per weapon.
  The tank launcher's grip is a second, different-but-equally-fixed formula
  (`weapon-model.js` ~92): `box(0.05, 0.16, 0.06)` at
  `(0, -bodyH*1.4, len*0.3)`, rotation `x=0.28`.
- **Melee** (`gear.js buildMeleeMesh`): every melee kind (`bat`/`bar`/blade/
  `keyboard`) shares one fixed local grip position, `(0, 0, 0.06)`.

**The load-bearing realization:** because grip position is a closed-form
function of fields already on `def.model`, we do **not** need 23
hand-authored anchor points. We need exactly **3 formulas**: the standard
grip formula, the tank-launcher grip formula, and the melee grip constant.
Any weapon added later that reuses `buildWeaponMesh`'s normal path gets a
correctly-placed hand for free.

## 3. Phase 1 — hand mesh + grip attachment (no streak changes yet)

Goal: every held item shows a hand at its grip point, riding along with
zero new per-frame transform code, by being a **child of the mesh that's
already being animated** rather than an independent rig with its own logic.

1. **New file `hand-model.js`**, matching the style of `weapon-model.js`
   (`box()`/`cyl()` helpers, `MATS`-style flat-color low-poly materials —
   no new textures, no skin shading system). Exports
   `buildGripHand(styleHint)` returning a small fist/forearm group: a
   forearm box, a fist block, maybe 2-3 finger boxes wrapped around the
   grip axis. Kept deliberately simple — this game's whole aesthetic is
   blocky geometric primitives (see every existing weapon), so the hand
   should read the same way, not suddenly photorealistic.
2. **Attach at build time, not per-frame:**
   - In `weapon-model.js buildWeaponMesh()`, after the existing grip box is
     added, add a hand as a **child of `group`** at the same local
     position/rotation as the grip box (reuse the exact formula — don't
     duplicate the numbers, compute the hand's anchor from the same
     `bodyH`/`len`/`isPistol` locals already in scope).
   - In `buildTankLauncher()`, same idea, anchored to its own grip formula.
   - In `gear.js buildMeleeMesh()`, same idea, anchored to the shared
     `(0, 0, 0.06)` grip constant.
   - Because the hand is a **child of the mesh**, `updateWeaponView()` and
     `updateMeleeView()` need **zero changes** — position/rotation set on
     the parent already carries the hand along.
3. **Two-handed weapons** (everything except sidearms): BO2-style support
   hand on the handguard is a nice-to-have, not required for Phase 1 to
   ship — one trigger hand at the grip already reads as "someone is holding
   this" and is the bulk of the visual win. Flag it as a Phase 1.5 if the
   single-hand version looks too sparse once built and screenshotted.
4. **Verify:** run `/run` or the Playwright harness against
   `troll-ops.html?tohooks=1`, cycle through a handful of weapon classes
   (sidearm, bullpup, LMG, the tank launcher) and melee, screenshot each,
   confirm the hand sits at the grip with no clipping/floating gap. This is
   a visual-quality task — per the project's graphics-quality-bar
   expectation, actually look at the screenshots and iterate, don't ship on
   "the math should work."

**Explicitly out of scope for Phase 1:** a real forearm-to-shoulder IK
chain, per-finger animation, left-hand support-hand rig. This is a single
static low-poly hand riding the existing grip transform — same fidelity
tier as the rest of the viewmodel.

## 4. Phase 2 — streak device + call gesture

Only start after Phase 1 is merged and looks right in-game.

1. **New streak-device mesh** (`streak-device.js` or inline in
   `weapon-model.js`): a small tablet/wrist-unit, built the same
   `box()`/`cyl()` way. Attach the Phase 1 hand to it the same way — child
   mesh, fixed local anchor, no new per-frame code.
2. **Extend `setHolding()`** (`game.js` ~3185) with a third state,
   `"streak"`, alongside the existing `"gun"`/`"melee"`. Add
   `activeStreakMesh` next to `activeWeaponMesh`/`activeMeleeMesh`,
   following the exact same visible-toggle pattern.
3. **Wire the call moment:**
   - `fireStreak("uav", ...)` (`game.js` ~468): briefly `setHolding("streak")`
     for a short beat (say 0.6–0.9s) before snapping back to `"gun"` — long
     enough to read as "checked the tablet," short enough not to block
     play. A simple timer alongside the existing `weaponLowerT`-style state
     is enough; no new animation system needed.
   - `callStreak("airstrike", ...)` → `confirmMark()` (`game.js` ~406-430):
     this one already has a multi-second "mark, then confirm" flow with its
     own reticle prompt (`updateMarking()`). Hold `"streak"` for the whole
     marking window, not just a flash — the player is meant to be looking
     at the device while lining up the strike, matching BO2's actual
     airstrike-marker gesture.
   - `helicopter`/`carepackage`/`drone` calls are instant (no marking, or
     marking already covered by the same flow) — decide case by case whether
     a quick device flash reads as a bonus polish item or as noise; not
     required for this doc's goal (UAV + airstrike were the two identified
     gaps).
4. **Verify** the same way as Phase 1: fire each of the two streaks in a
   live/headless run, confirm the device+hand appear for the call window
   and the gun returns correctly after, confirm no interaction bug when a
   streak is called while reloading/ADS/sprinting (those all touch
   `weaponLowerT`/`insp`/`rl` on `activeWeaponMesh` — `activeStreakMesh`
   needs its own equivalent lower/steady state or an explicit decision to
   ignore those inputs while a streak is up).

## 5. Open questions to resolve before Phase 2 code

- Exact device call-window duration for UAV (proposed 0.6–0.9s) — playtest
  feel, not a hard requirement.
- Whether the device should also appear when *opening* a landed care
  package (`claimPackage`), which is conceptually a similar "look at your
  hand" beat but wasn't part of the original ask.
- Whether the drone/heli/carepackage calls get a device flash too, once the
  UAV/airstrike version is playtested and approved.

## 6. Relationship to prior work

The UAV `ReconPlane` and Lightning Strike `StrikeJet` flyover aircraft
(`streak-entities.js`, shipped in commit `d910513`) are unaffected by this
doc — those are world-space objects representing what got called in, and
stay exactly as they are. This doc is purely about the first-person view
of the *player calling it in*, which is a separate, previously-nonexistent
piece of the viewmodel.
