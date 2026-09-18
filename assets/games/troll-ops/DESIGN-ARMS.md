# Troll Ops — first-person hand/arm + BO2-grade viewmodel animation
### Design doc v3 — layered animation architecture, merged with external review

Status: **Phases 0-6 shipped and verified on branch
`troll-ops-viewmodel-anim`, not yet merged to main.** All phases
this doc scopes are complete. Two items were explicitly skipped rather
than force-built with no way to verify them, and are documented at
their own section rather than silently dropped: Phase 4's per-melee-
class weight scaling (only one melee weapon exists in `MELEE_DEFS`
today) and Phase 6's directional hit reaction (`damagePlayer()` has no
direction/position parameter to key off — `fromId` is an actor id
string, not a resolvable hit vector, and adding that resolution was
out of this phase's scope). This revision keeps v2's grounded "what
exists today" audit
(still accurate, re-verified below) but restructures the plan around
an explicit **animation-ownership architecture** — layers, interaction
points, and an event system — per a structural review this doc went
through before any further code was written. The phase numbering below
is final; treat it as the source of truth over v1/v2.

---

## 1. Why this exists, and what "done" looks like

The ask: make Troll Ops' first-person feel land closer to Black Ops
2's — not by cranking up bob or camera shake, but by building an actual
small first-person animation system: hands that hold the weapon,
weapon parts that move independently (mag, bolt), reload as staged
choreography instead of one dip, melee with real hit/whiff
distinction, and streak calls as a physical device interaction. The
Trollface stick-figure aesthetic stays exactly as goofy as it is today
— the contrast between an absurd character and a serious, physical
weapon-handling system is the point, not a bug to fix.

**Quality bar (should be true without the player consciously noticing
why):** the weapon has weight; the character is physically holding and
manipulating it; movement affects the weapon and stopping lets it
settle; ADS is fast but physical, not a linear teleport; reloading is
a real action, not a timer with a dip; melee has anticipation and
recovery; equipment is physically used, not a HUD banner; impacts have
weight; every transition between these states is smooth, not a snap.

**What this explicitly is not:** a skeletal/IK animation system, a
physics simulation of weapon parts, or a rewrite of the working
melee/movement/recoil systems. Every phase is additive on top of what
`updateWeaponView`/`updateMeleeView`/`MeleeState` already do.

## 2. What exists today (verified against current source)

Unchanged from v2 — still accurate. Full detail kept for reference;
summarized here so this doc stays self-contained.

- **`updateMeleeView(dt)`** (`game.js:5127-5188`) and
  **`updateWeaponView(dt)`** (`game.js:5435-5498`) both compose a
  **single final position/rotation additively**: hip↔ADS lerp → bob →
  sway (inertia-lagged) → sprint/busy lower (`weaponLowerT`/
  `meleeLowerT`) → inspect pose → reload pose (`rl`) → recoil
  (`viewKick*`). This additive pipeline is the thing every new layer
  below must plug into, not compete with.
- **`movement.js`** already exposes, per frame: `velocity`, `stance`,
  `grounded`, `jumping`, `sprinting`, `moving`, **`justLanded`/
  `landSpeed`** (a landing-impact hook that exists today and is
  **completely unused**), `eyeHeight`, `slideT/slideDir`, `diveT`,
  `vault`, derived `crouched`/`busy`. No lean state exists.
- **Reload today** (`reloadPose()`, `game.js:5374-5394`) is one
  symmetric ease-in/ease-out dip/tilt on the whole gun mesh — no mag
  mesh is a separate movable object (`weapon-model.js:196-221` builds
  mag geometry as a static, permanently-parented child of `group`), no
  empty-vs-tac distinction, one `reloadTime` per weapon.
- **Weapon mag types in `weapons.js`** (checked directly for this
  revision): of 23 weapons, mags are `box`(x7)/`curved`(x5)/`drum`(x2)/
  `topbox`(x1)/`long`(x2)/`tube`(x1, the pump shotgun)/`none`(x2: one
  fixed-stock rifle, the tank launcher). This is the real distribution
  Phase 4's reload archetypes need to cover — tube-fed is a single
  weapon, not a large surface area.
- **Melee** (`gear.js:162-209`, `MeleeState`) already does real
  keyframed animation — `SWING_TRACK`/`THRUST_TRACK`, 7 keyframes each,
  smoothstep-sampled — not a lerp. Hit windows (`SWING_WINDOW`/
  `THRUST_WINDOW`) are damage-only today, decoupled from the visual:
  the swing plays identically whether it connects or whiffs.
- **Streak calls** (`callStreak`/`fireStreak`/`confirmMark`,
  `game.js:342-541`) are **2D HUD only** today — a text banner and, for
  `carepackage`/`airstrike`, a ground-aim reticle. Zero viewmodel,
  camera, or hand involvement anywhere in this path. Clean slate for
  Phase 6.
- **No shared easing module exists.** Cubic smoothstep is independently
  duplicated at minimum 3x (`game.js:5249` `rise()`, `gear.js:151`
  `sampleTrack`, `movement.js:174` vault easing); exponential-decay
  smoothing (`x += (target-x) * min(1, dt*k)`) is copy-pasted ~6+ times.

## 3. Animation ownership — the core architectural change

The single biggest gap this revision fixes: today, bob/sway/lower/
inspect/reload/recoil are already summed additively (good instinct
already in the code), but there's no *named* layer concept, no
priority rule for what owns the **base pose**, and no interaction-point
abstraction for where hands/parts attach. Both of those need to exist
before Phase 2+ adds more terms, or the pile of ad hoc offsets in
`updateWeaponView` becomes unmaintainable.

### 3.1 Layers (conceptual, not new classes)

Each frame, the final viewmodel transform is composed in this fixed
order — same additive idea already in the code, now named and ordered
explicitly:

1. **Base pose** — hip / ADS / sprint / melee / streak-device. Exactly
   one of these owns the base position at a time (see §3.3 priority).
2. **Movement layer** — walk bob, strafe sway, directional lag, jump/
   landing response. (New: landing response, directional strafe
   distinction. Existing: bob, sway.)
3. **Inertia layer** — settling/lag on starting, stopping, turning,
   ADS-transition, sprint-transition. (New concept, but
   `def.inertia`/`swaySmoothX/Y`'s exponential lag already
   *is* a primitive inertia system — this generalizes it rather than
   replacing it.)
4. **Recoil layer** — existing `viewKick*`, unchanged.
5. **Reload/action layer** — existing `rl` term, upgraded from one dip
   to staged choreography (Phase 4).
6. **Melee layer** — existing `melee.pose()` output; during an active
   swing this **replaces** the base pose entirely rather than adding to
   it (already true today — keep it that way, it's correct).
7. **Camera reaction** — a small, separate set of camera-only effects
   (landing kick, recoil kick, melee impact), explicitly **not** the
   same numbers as the viewmodel's own response. Kept as its own layer
   so a big viewmodel dip never has to mean the whole screen shakes.

Implementation note: this does **not** require a new "layer stack"
class. `updateWeaponView`/`updateMeleeView` already accumulate terms in
roughly this order — the deliverable is making the order explicit (a
comment block enumerating the layers in sequence) and auditing that
new terms get inserted at the right stage, not a new engine.

### 3.2 Interaction points, not per-animation hardcoded hand positions

Instead of hand-authoring a hand position for every weapon × every
animation (reload, sprint, ADS, idle...), each weapon mesh exposes
named anchor points as `Object3D`s (the same pattern v1 already
established for the grip — `hand.position.copy(grip.position)` in
`weapon-model.js`, now generalized):

- `mainGrip` — exists today as the grip box position; Phase 1 already
  anchors the hand here.
- `supportGrip` — new. For two-handed weapons, a point on the handguard
  (`weapon-model.js` already builds the handguard box at
  `hg.position`, `~line 162-165` — reuse that transform, don't
  invent a new one).
- `magazinePoint` — new. Exactly the existing per-mag-type position
  already computed in `buildWeaponMesh`'s magazine branch
  (`weapon-model.js:196-221`) — expose the mag mesh itself as
  `group.userData.magMesh` plus its rest position as
  `group.userData.magazinePoint`, rather than baking it in
  permanently.
- `boltPoint` — new, only for weapons where a bolt/charging-handle
  animation is worth building (see §7 scope note — most of this
  game's 23 weapons don't need one).
- `meleePoint` — already exists implicitly as the shared `(0,0,0.06)`
  melee grip constant (`gear.js`); name it explicitly.
- `devicePoint` — new, for Phase 6's streak device.

This is a closed-form-formula pattern, the same one v1 identified for
grips: **weapons that don't have a distinct part just omit that point**
(a pistol has no `supportGrip`; `mag:"none"` weapons have no
`magazinePoint`). No 23-weapon hand-authored table.

### 3.3 State priority (which system owns the base pose)

```
STREAK/DEVICE  >  MELEE (mid-swing)  >  RELOAD  >  SPRINT  >  ADS  >  NORMAL
```

Not rigid — explicitly, these overlap the state above them rather than
being blocked by it (matches what the code already does, just naming
it): recoil applies during ADS; movement inertia continues during ADS;
a landing response can occur during sprint; reload can be interrupted
by a higher-priority state (see §7.5) rather than blocking it outright.

### 3.4 Lightweight event hooks

No event bus framework — that's overkill for this codebase's size and
would fight the "no dependencies, one file per system" style already
established. Instead, add plain callback fields on the relevant state
objects, following the pattern this codebase already uses for e.g.
`justLanded` (a flag the caller checks and clears):

- `Weapon` (weapons.js) gets optional callback fields the reload
  choreography (Phase 4) can call synchronously at phase boundaries:
  `onReloadStart`, `onMagOut`, `onMagIn`, `onReloadComplete`. `game.js`
  wires these once, at weapon-switch time, to `audio.js` calls —
  exactly how `audio.reload()` is already invoked today
  (`game.js:651, 3258`), just moved to fire at the right *phase*
  instead of at reload-start only.
- `MeleeState` (gear.js) gets `onHit`/`onWhiff`, called from the exact
  spot the `landed` flag already flips (`gear.js:185-194`) — no new
  detection logic, just a callback at an already-detected event.
- These are called directly, synchronously, same frame — not queued,
  not decoupled pub/sub. Simple function references is enough for the
  handful of consumers (audio, and later maybe a debug overlay).

## 4. Ground rules (unchanged from v2, still binding)

1. Additive, not replacement — every new term is another summand in
   the existing pipeline, never a competing transform owner.
2. Shared easing module first (Phase 0) — before any new curve-shaped
   motion is authored.
3. Per-weapon-class data via existing `def` fields
   (`model.mag`/`model.heavy`/`model.len`/`bobAmp`/`inertia`), not
   per-weapon-ID hardcoding.
4. Screenshot/playtest-verify every phase before starting the next.
5. Merge each phase to main once verified — don't let this become one
   stranded branch.
6. **New:** debug lab (Phase 0) is dev-only, stripped/hidden in the
   shipped build path, same as any other test-hook gated behind
   `?tohooks=1` (the pattern this codebase already uses).

## 5. Phase plan

### Phase 0 — foundation (shared easing + debug lab + layer audit)
1. `anim-curves.js`: `smoothstep(k)`, `stage(t,a,b)`/`rise(t,a,b)`
   (moved from `game.js:5238-5250`), `damp(current, target, lambda,
   dt)` (formalizing the existing exponential-decay idiom). Repoint the
   3 duplicated smoothstep sites at it — pure extraction, verify by
   bit-identical output diff, not gameplay testing.
2. Write the layer-order comment block into `updateWeaponView`/
   `updateMeleeView` (§3.1) — no behavior change, just making the
   existing additive order explicit before more terms get added to it.
3. Debug lab: a `?tohooks=1`-gated overlay (reuse the existing test-
   hook convention, `game.js` already has one) showing current
   weapon/reload phase/ADS progress/sprint progress/melee phase/
   velocity/landSpeed, plus manual triggers (force reload, force
   melee, force landing response) for tuning without playing a full
   match each time.
- **Completion requirement:** zero behavior change to current
  gameplay; new module exists and is wired in; debug overlay renders.

### Phase 1 — grip hand (v1/v2 scope, code already written)
Status: code written (`hand-model.js`, wired into `buildWeaponMesh`,
`buildTankLauncher`, `buildMeleeMesh` incl. keyboard sword), **not yet
screenshot-verified.** Support-hand-on-handguard (two-handed weapons)
is pulled forward from "nice to have" into this phase's exit criteria
per the review's emphasis on the support hand specifically — see §6.2.
- **Completion requirement:** player visibly appears to hold the
  weapon (main hand always; support hand on two-handed weapons) rather
  than a floating gun. Verified via screenshot across sidearm/bullpup/
  LMG/tank-launcher/melee.

### Phase 2 — movement / ADS response
All new terms inserted into the movement/inertia layers (§3.1 items
2-3), all keyed off `movement.js` state already exposed — no new
movement-side plumbing except where noted.
1. **Landing impact** using the unused `justLanded`/`landSpeed` hook:
   downward dip + forward pitch scaled by `landSpeed`, `damp()`-eased
   back to rest. Camera gets a much smaller, separately-tuned version
   of the same response (§3.1 layer 7) — not the same magnitude.
2. **Directional strafe distinction** — left/right strafe currently
   produce symmetric sway; add a slight asymmetry so direction changes
   read (small, per the "do not exaggerate" rule).
3. **Start/stop settling** — moving-state transition edge (already
   detectable via `move.moving` going false→true or true→false) gets a
   brief inertia-lag term, distinct from steady-state bob.
4. **Sprint transition polish** — `weaponLowerT` exists; add roll/yaw
   "sling to the side" on sprint-out and settle-overshoot on sprint-in,
   scaled by `def.heavy`/`def.model.len` (already present, no new
   data).
5. **ADS transition weight** — replace the effectively-linear `adsT`
   lerp with an eased curve that has a small settle/overshoot on
   heavier weapons, using the new `damp()`.
6. Lean: **explicitly out of scope** — no lean state exists in
   `movement.js` today and it needs new input handling, not just pose
   math; not part of the original ask. Flag only, don't build.
- **Completion requirement:** movement makes the weapon feel carried
  without hurting aim responsiveness — verify by sprint-stop-sprint,
  jump/land at varying heights, ADS-in/out on lightest vs. heaviest
  weapon, confirm additive order doesn't fight existing bob/sway.

### Phase 3 — reload choreography
This is the biggest single phase and the one the review most sharpened
— reload becomes staged, hand-and-part-driven choreography instead of
one dip, using the interaction points from §3.2.
1. **Expose `magMesh`/`magazinePoint` as movable**, not baked-in:
   modify `buildWeaponMesh`'s magazine branch (`weapon-model.js:
   196-221`) so the mag mesh reference is stored on
   `group.userData.magMesh` and its rest transform on
   `group.userData.magazinePoint`, instead of only being added as an
   immovable child.
2. **Three archetypes derived from `def.model.mag`** (closed-form, not
   23 hand-authored timelines — confirmed distribution in §2: 7 box /
   5 curved / 2 drum / 1 topbox / 2 long / 1 tube / 2 none):
   - **Detachable-mag** (box/curved/drum/topbox/long, 17 of 23
     weapons): normalized-progress phases — weapon enters reload pose
     → support hand leaves `supportGrip` → travels to `magazinePoint`
     → mag detaches (hide/reposition `magMesh`, don't destroy/rebuild
     it) → hand returns empty → new mag mesh (a second cached instance
     of the same geometry) enters and is guided to `magazinePoint` →
     locks in → hand returns to `supportGrip` → weapon returns to
     combat pose. Timed as fractions of existing `def.reloadTime` — no
     new duration authored.
   - **Tube-fed** (the one pump shotgun): shell-by-shell insert loop
     instead of a mag swap — check the weapon's ammo-per-reload from
     its existing def before hardcoding a shell count.
   - **No-mag** (fixed-stock rifle + tank launcher, 2 weapons): each
     already has a bespoke build path (`stock:"fixed"` wood rifle,
     `buildTankLauncher`) — give each its own small bespoke reload
     (bolt-open/round-in/bolt-close for the rifle; cell-swap on the
     glowing "candle" for the tank launcher) rather than forcing them
     through the mag-swap archetype they don't have geometry for.
3. **Empty vs. tac reload**: `Weapon` already tracks mag/reserve ammo;
   branch pose selection in `startReload()` on whether the mag was
   empty at reload-start. Tac-reload (round still chambered) skips any
   chamber/bolt beat and runs the whole sequence faster. **Single
   highest-impact item in this phase** per both v2 and the review.
4. **Reload interruption** (§3.3 priority: higher-priority states can
   interrupt reload): sprint/fire/ADS/melee starting during a reload
   should transition from the *current* choreography-phase transform
   toward the new state, never snap to an arbitrary rest pose. If full
   resume-after-interrupt (finishing the reload later) is too complex
   initially, prioritize just the clean interrupt-and-recover half —
   explicitly allowed as a fallback by this doc.
5. **Event hooks** (§3.4): fire `onReloadStart`/`onMagOut`/`onMagIn`/
   `onReloadComplete` at the corresponding phase boundaries; wire
   existing `audio.js` reload sounds to these instead of only
   reload-start, so the magazine click/mechanical sounds land on the
   actual visual beat.
- **Completion requirement:** empty-reload and tac-reload verified on
  one weapon per archetype (a box-mag rifle, the shotgun, a sidearm,
  the fixed-stock rifle, the tank launcher); mag mesh visually detaches/
  reattaches with no pop/teleport; reload-interrupted-by-sprint
  transitions rather than snaps; HUD `reloadTag` timing still matches
  `reloadT`.

### Phase 4 — melee: hit/whiff/recovery + explicit phases
Builds directly on the existing `MeleeState` keyframe system (§2) —
does not replace it.
1. **Name the existing implicit phases explicitly** (anticipation =
   windup keyframes, strike = the cut/thrust keyframes, recovery = the
   settle/return keyframes) — `SWING_TRACK`/`THRUST_TRACK` already have
   this shape; this is documentation + hook points, not new keyframes.
2. **Hit vs. whiff visual distinction**, using the `onHit`/`onWhiff`
   event hooks (§3.4) fired exactly where the `landed` flag already
   flips (`gear.js:185-194`): on hit, blend in a brief impact-stop
   (sharp decel, small recoil-back, sampled the same way `viewKick*`
   perturbs the gun) plus a target reaction if the target actor
   supports one; on whiff, let the existing follow-through keyframe run
   slightly longer/looser so the overextension reads.
3. **Per-melee-class weight — SKIPPED for now.** `MELEE_DEFS` (gear.js)
   currently has exactly one entry, `keyboard` (Keyboard Warrior) — there
   is no second melee weapon to differentiate against, so scaling
   `SWING_TRACK`/`THRUST_TRACK` timing by `m.len`/`m.wide` would be
   infrastructure with no observable effect and nothing to verify it
   against. Revisit this item the moment a second melee weapon is
   added to `MELEE_DEFS`.
4. **Movement-transition protection** (§3.3 priority: melee mid-swing
   owns the base pose outright, already true today) — explicitly test
   sprint→melee, melee→sprint, ADS→melee, melee→ADS, jump→melee: bob/
   inertia/recoil must not leak into the pose during the strike phase
   (already correct per `updateMeleeView`'s `swinging` gate,
   `game.js:5127-5188` — this phase is verification, not new logic,
   for that specific guarantee).
5. Camera gets its own small, separate impact reaction on a confirmed
   hit (§3.1 layer 7) — not the same magnitude as the viewmodel's.
- **Completion requirement:** lightest vs. heaviest melee weapon
  visibly different weight; hit vs. whiff visually distinguishable
  without reading damage numbers; all 5 listed transitions clean.

### Phase 5 — streak device + call gesture
Zero existing conflicts (§2 confirms streak calls are pure 2D HUD
today) — this phase is a clean build.
1. New streak-device mesh (tablet/wrist-unit), `box()`/`cyl()`-built,
   Phase 1's hand attached the same child-mesh way, anchored at a new
   `devicePoint`.
2. Extend `setHolding()` (`game.js:~3185`) with a third state,
   `"streak"`; add `activeStreakMesh`, same visible-toggle pattern as
   the existing gun/melee pair.
3. Sequence (§3.3: streak is the highest-priority base-pose owner while
   active): weapon lowers → device raises into view → hand attaches →
   interaction beat (brief for UAV, held for the whole marking window
   for airstrike) → confirmation → device stows → weapon restores.
4. **UAV** (`fireStreak("uav",...)`): brief `setHolding("streak")` for
   ~0.6-0.9s.
5. **Airstrike** (`callStreak`→`confirmMark()`): hold `"streak"` for
   the entire marking window (`updateMarking()`, `454-467`) — the
   player is meant to be looking at the device while lining up the
   strike.
6. `helicopter`/`carepackage`/`drone`: decide case-by-case after UAV/
   airstrike are playtested whether a device flash is worth adding —
   not required to close this phase.
7. Event hooks: `streak.open`/`streak.confirm` fired at the raise/
   confirm beats, for future SFX/UI hookup.
- **Completion requirement:** fire each streak, confirm device+hand
  appear for the call window, confirm no interaction bug when called
  mid-reload/mid-ADS/mid-sprint (per §3.3, streak preempts those —
  `activeStreakMesh` needs its own explicit lower/steady handling
  rather than inheriting `weaponLowerT`/`insp`/`rl`, decide the exact
  behavior before merging).

### Phase 6 — camera polish (last, conditional)
Only build out further if Phases 2-5 don't already deliver the feel on
review. Separate, smaller-magnitude camera-only versions of: landing
kick, recoil kick, sprint camera movement, melee impact, and — if the
gameplay damage system supports a direction — a subtle directional hit
reaction (left/right/front/behind camera/viewmodel nudge). All subtle;
the target is felt motion, not visible screen shake.

**Built:** landing kick and melee-impact kick, both small separate
pitch nudges layered into the existing `viewYaw`/`viewPitch` camera
composition in `updatePlayer()` (`game.js`), keyed off the same
`landDipT`/`landDipMag` and `meleeImpactT` state Phases 2 and 4 already
maintain — no new trigger logic, just a smaller-magnitude echo.
**Recoil kick** and **sprint camera movement** were already present
before this doc (`w.recoilPitch`/`recoilYaw` in the same composition;
the FOV kick at `move.sprinting` in `animate()`) and needed no new
work. **Skipped: directional hit reaction.** Checked every
`damagePlayer(amount, fromId, weaponId, isHead)` call site
(`game.js`) — `fromId` is an actor id string (bot id, net peer id, or
`null`), never a position or direction vector, so there is no hit
direction to key off without adding new lookup/resolution plumbing
(resolve `fromId` to a live actor, get its position, handle the actor
having already despawned) that this phase's scope doesn't call for.
Revisit if/when the damage system is extended to carry a hit direction
for some other reason.
- **Completion requirement:** the full system (Phases 1-5 + this) reads
  as one cohesive feel, not stacked independent effects — re-run the
  transition test matrix in §6.3 end to end.

## 6. Cross-cutting requirements pulled from the architecture review

### 6.1 Performance
Browser game — stay lightweight. Prefer transform interpolation,
keyframed tracks (already the melee pattern), simple easing, reused
Object3D references (cache the second mag-mesh instance per weapon
type rather than allocating one per reload), no per-frame allocation,
no IK, no physics simulation for weapon parts. The whole system should
be negligible next to the rest of the game's per-frame cost.

### 6.2 Support hand is not optional set-dressing
Called out specifically because it's the single change that makes
reloads/interactions convincing: the support hand must be able to
leave `supportGrip`, travel to `magazinePoint`/`boltPoint`/
`devicePoint`, and return — never permanently welded to the weapon.
Promoted into Phase 1's completion criteria (§5) rather than left as a
Phase 1.5 stretch goal, since Phase 3/5 both depend on it existing.

### 6.3 Transition test matrix (run this at the end of Phase 6, and spot-check relevant pairs after each phase)
Idle→fire, fire→fire, fire→ADS, ADS→fire, ADS→sprint, sprint→ADS,
sprint→fire, sprint→reload, reload→sprint, reload→fire, reload→ADS,
jump→fire, jump→ADS, jump→land, land→ADS, land→sprint, melee→sprint,
sprint→melee, melee→ADS, streak→weapon, weapon→streak, damage→fire,
damage→reload. The transitions are what read as "polished," not the
individual animations in isolation.

### 6.4 What not to do (guardrails, unchanged in spirit from both prior drafts)
Don't just increase bob magnitude and call it done. Don't add camera
shake as a substitute for viewmodel physicality. Don't make every
weapon move identically — differences should come from existing `def`
fields, not new hardcoded per-weapon branches. Don't replace the
working melee keyframe system or movement controller. Don't weld the
support hand to the weapon during reload. Don't teleport between
poses — always transition from wherever the current transform is.
Don't build a full animation-framework/event-bus for a system this
size — plain callback fields are enough (§3.4). Don't sacrifice aim
responsiveness for visual realism — ADS in particular must stay fast.

## 7. Open questions to resolve before code

- Exact landing-dip/sprint-transition/ADS-overshoot magnitudes —
  playtest feel; start scaled off existing `weaponLowerT` magnitudes
  for a sane first pass.
- Tube-shotgun shell-count for reload staging — confirm the exact
  ammo-per-reload value in `weapons.js` for that one weapon before
  authoring the insert-loop beat count.
- Whether full reload-resume-after-interrupt is worth building in
  Phase 3, or whether clean-interrupt-only is sufficient (this doc
  allows either; resume is explicitly a stretch, not a requirement).
- Whether `helicopter`/`carepackage`/`drone` streak calls get a device
  flash in Phase 5, or stay HUD-only.
- Whether directional damage reaction (Phase 6) is worth building —
  depends on whether the existing damage system already carries hit
  direction; needs a quick check of the damage/hit-registration code
  before committing to this item.
- Device call-window duration for UAV (0.6-0.9s proposed) — playtest.
- Whether opening a landed care package (`claimPackage`) gets the same
  device gesture as calling the streak in the first place — unresolved
  since v1.

## 8. Relationship to prior work
The UAV `ReconPlane` and Lightning Strike `StrikeJet` flyover aircraft
(`streak-entities.js`, shipped in commit `d910513`) are world-space
objects representing what got called in and are unaffected by any
phase here — this doc is entirely about the first-person view of the
player's hands, weapon, and camera.
