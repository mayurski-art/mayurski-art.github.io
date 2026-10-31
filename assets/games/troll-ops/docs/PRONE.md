# Prone, and bipods that deploy (2026-10-30; phase 1 built)

User, 2026-10-30: "add a feature where users can get prone, and it would
be nice if the little stand on the rifle can be propped up if the user is
trying to scope while proned. That would mean updating the controller
diagram." Phase 1 is built on claude/arms-ballista (the stance, the
steadiness, the controls; tools/troll-ops-prone-test.mjs); phases 2 to 4
are still the plan.

## 1. What exists today

- **The stance is already there.** `core/movement.js` has `STANCE.PRONE`:
  eye 0.5 m, crawl at 22% speed. The only way in is the **dive**: Ctrl
  (keyboard) from a sprint, which throws you
  forward and lands you prone. Crouch from prone stands you straight up.
- **No pad button reaches prone.** The pad's B is "Crouch · slide"
  (`input/gamepad.js`, `menu/controller-layout.js`); there is no dive on a
  pad, and keyboard C only toggles stand and crouch.
- **The body never lies down.** Third person and other players draw the
  crouch pose pushed all the way down (`net/remote-players.js`
  `STANCE_LOWER.prone = 1`, `character.js` `lower`), not a body on the
  ground. Shots land on the posed rig, so a deep crouch is what is hit.
- **Prone changes nothing about aim.** Sway (`view/weapon-view.js`),
  recoil and spread are the same standing and prone.
- **Bipods are props.** The Ballista exports its legs as hinge parts
  (`HB_BipodL` / `HB_BipodR`, folded, travel 1.5 rad) that nothing drives
  yet. Other guns with bipods (the LMGs, the other snipers) draw them as
  fixed shapes.

## 2. The feature, as Black Ops 2 does it

### Getting down and up
- **Tap crouch** = crouch, as now. **Hold crouch (0.35 s)** = go prone,
  from standing or crouched. From prone: tap crouch = crouch, jump = stand.
  Same on every device: keyboard C, pad B, touch the crouch button held.
- **The dive stays** (Ctrl from a sprint) as the fast way down. From a
  sprint, a tap of crouch slides as before; held through the slide, you
  skid down into prone (built that way rather than a held crouch diving:
  the slide has already started by the time the hold is known).
- **Going down takes 0.45 s, getting up 0.40 s**, eased; you can't fire or
  aim in the first 0.25 s of either (BO2's commit). Getting up is refused
  under anything lower than standing height (a check above the head), and
  prone is refused where the body won't fit lying down (a wall within the
  body's length ahead or behind).
- **Crawl** stays at 22%, no sprint, no slide; turning is free.

### Aim while prone
- **Prone is steadier:** idle sway x0.4, the gun's visual kick x0.7,
  hip-fire spread x0.6. Crouch gets a smaller share (sway x0.8, spread
  x0.85). Applied where sway and spread are worked out today
  (`weapon-view.js` `steady`, the spread in `combat/weapons.js`).

### The bipod
- **When you aim in while prone and still, the legs swing down** (0.25 s,
  eased, a short click) to the ground; while deployed the gun is mounted:
  sway x0.1 on top of prone's, kick x0.4.
- **They fold back up** when you let go of aim, crawl, or stand (0.2 s).
  Firing doesn't fold them.
- **Driven from the model:** any gun whose glb has `BipodL` / `BipodR`
  hinge parts deploys them (`view/gun-action.js` reads `gunParts`, so a
  new gun gets it by exporting the parts). The legs' length is fixed;
  the gun's prone pose puts the feet on the ground.
- **Scoped**, the 8x overlay hides the gun, so the deploy is seen as you
  raise the scope (the first 0.25 s of ADS) and in third person.
- **Guns:** the Ballista first (its legs exist). The LMGs and the other
  snipers get theirs as they're rebuilt on arsenal v2 (DESIGN-ARSENAL.md
  §6 "LMG: bipod folded under"); until then they get prone's steadiness
  without legs.

### Third person and other players
- **A real lying pose** in `characters/character.js`: torso flat, elbows
  down, the gun forward on the shoulder; a crawl cycle (elbows and knees);
  transitions down and up. Remote players already receive `stance:
  "prone"`, so they lie down with no net change. Hits land on the lying
  rig, so a prone player is a smaller, lower target, as in BO2.
- **The bipod for other players:** their copy of a gun is the LOD1, one
  merged node, so its legs can't move. Default: they see the legs folded.
  (A second LOD1 with the legs down is possible, ~200 tris, if wanted.)
- **Bots** don't go prone in this pass.

### Controls diagram and prompts
- `menu/controller-layout.js` BINDINGS: B becomes "Crouch · hold: prone ·
  slide"; the keyboard list in the Esc menu gets "C: crouch · hold: prone"
  and "Ctrl: dive to prone"; the touch crouch button's label and aria-label
  say "hold to go prone".

## 3. Phases

| Phase | What | Test |
|---|---|---|
| 1 | Hold-crouch to prone on every device, the transitions and their checks (head room, body room), prone and crouch steadiness, the controls diagram and labels | `troll-ops-prone-test`: hold C / pad B / touch hold reaches prone after 0.35 s; tap only crouches; eye height and crawl speed; standing refused under a low ceiling; sway and spread multipliers; the diagram's B text |
| 2 | The lying pose and crawl in third person and for other players, hit volumes lying down | prone-test: the remote rig's head below 0.6 m, a shot over a prone player misses, third-person shots |
| 3 | Bipod deploy on aim while prone and still, fold on move, release or stand; mounted steadiness; the Ballista | prone-test: the Ballista's legs rotate 1.5 rad within 0.3 s of aiming prone, fold on crawl; sway falls to the mounted value |
| 4 | Bipods on the other guns as each is rebuilt (one line in each gun's session) | each gun's own test |

Estimate: phase 1 about 3 h, phase 2 about 4 h (the pose is the work),
phase 3 about 2 h. Phases 1 and 3 touch `core/movement.js`, the inputs,
`view/weapon-view.js` and `view/gun-action.js`; phase 2 touches
`characters/character.js` and `net/remote-players.js`. One system per
commit (CLAUDE.md rule 5).

**Ordering with the arms work:** phase 3 drives the Ballista's bipod
parts from `view/gun-action.js`, which the MTAR session is changing for
the bolt cycle. Phases 1 and 2 can start now; phase 3 waits for the MTAR
branch to land, or is done on top of it.

## 4. Open questions (my default in brackets)

- Hold time to go prone? [0.35 s, BO2's feel]
- Does going prone from a sprint keep the dive's throw, or should a held
  crouch while sprinting slide, as now? [built: the tap slides, held
  through the slide you skid down into prone; Ctrl still dives]
- Bipod also on crouch behind cover (mounting on a ledge, as later CoDs)?
  [no: prone only, as asked]
- Other players see the legs down? [no: folded on the LOD1]
- Bots go prone? [not in this pass]
