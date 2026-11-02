# Troll Forces: the arsenal upgrade (geometry, materials, gun mechanics)

Status: **Phase 1 live on main (2026-10-30: the 416, MTAR and Ballista; THE BEAST
dropped). Part 2 in progress on `claude/arsenal-part2` (§9).** The Arms Book (renders of all 35 guns as they ship) is the
"before"; the user's four concept renders (2026-10-26: an OD-green AR, a
tan bullpup, THE BEAST in white, a black bolt chassis rifle) are the target
look for Phase 1.

Constraints carried over: DESIGN-ARMS.md (layered viewmodel animation, no
IK, no physics, additive layers, no per-frame allocation), DESIGN-PF.md (BO2
reloads, one track per gun), REALISM.md (stylised realism, the gun is drawn
inside the grade pass, envMap from the sky), texture-budget.js (1024 max on
touch). The characters stay ink-line trollfaces; the guns get serious, which
is the joke.

---

## 1. What exists (measured 2026-10-26)

Four build paths, picked in `weapon-model.js buildBaseMesh`:

| Path | Guns | Tris | Draws | Materials | What it really is |
|---|---|---|---|---|---|
| Blender (`models/build_*.blender.py`, `gunkit.py`, `arkit.py`) | 15 | 14k–93k | 12–30 | 6–19 | The traced side outline lofted into rounded solids (`arkit.spec` reads `weapon-ars.js`), plus lathed barrels, a rail, pins. 0.2–0.4 mm bevels. |
| Traced outline (`weapon-traced.js`) | 9 | 1.9k–5.3k | 66–86 | 5–29 | A photo's side outline extruded into a flat slab, 1.2 mm bevel. |
| Hand-coded (`weapon-416.js`, `revolvers.js`) | 2 | 1.2k / 10k | 54 / 144 | 8–10 | Dozens of hand-placed boxes. |
| Box primitives (`weapon-model.js` fallback) | 9 | 364–446 | 14–30 | 5–10 | Boxes and one cylinder from `model: { len, stock, mag }`. |

Every surface is one flat colour: no gun uses a texture map (no normal,
roughness, AO or albedo map anywhere in `weapons/`). Materials are made per
build, not shared.

The same `buildWeaponMesh` builds the viewmodel, the third-person gun, every
remote player's gun (`net/remote-players.js mergeHeld`), the killcam gun and
the zombies thumbnails. A 46k-tri gun is 46k tris per player on screen.

Mechanics that exist: BO2 staged reloads with the support hand
(`view/ar-reload.js`, 17 guns), pistol slides (`pistol-action.js`), pump
forends with a riding hand (Grinmington, Soul Blazer), shell-by-shell
reloads, the bolt cycle with the trigger hand (`rifle-action.js`, branch
`tf-sniper-bolt`). Missing everywhere: anything that moves on an automatic
or semi-auto rifle shot (carrier, charging handle, dust cover, trigger),
brass, a charging-handle or bolt-catch beat with a hand on it outside the
BO2 tracks, a lighter third-person model.

## 2. The ten highest-impact changes

| # | Change | Area | Effort |
|---|---|---|---|
| 1 | **Section-driven hard-surface bodies** in gunkit: the outline sets the side profile, but each region (receiver, handguard, grip, stock, mag) gets its own cross-section (chamfered rect, octagon, tapered trapezoid) and chamfer size, instead of one smoothed loft. This is what turns "rounded slab" into "machined part". | Geometry | 10 h |
| 2 | **High-to-low bake** (extend `bake_kit.py`): the script builds a high version (3-segment bevels, boolean panel lines, slots, screws, stippling and waffle textures as displacement) and a game version, and Cycles bakes normal, AO and curvature from high onto low. Detail costs texels, not tris. | Geometry + materials | 10 h |
| 3 | **Arms material kit**: 6 shared surface recipes (anodized aluminium, cerakote paint, polymer, parkerized steel, rubber, brass) authored once as Blender node groups, baked per gun into BaseColor (wear included), ORM (AO, roughness, metal) and Normal. One texture set per gun, `prepDetailed` binds it. Paint edges wear to the metal under them from the curvature bake. | Materials | 6 h |
| 4 | **Mechanism parts and a gun-action driver**: standard node names every gun exports (`P_Carrier`, `P_Charge`, `P_DustCover`, `P_Trigger`, `P_Catch`, `P_Selector`, `P_Mag`, `P_Bolt`) and one `view/gun-action.js` that moves them per shot from a cycle timer (generalising `rifle-action.js` and `pistol-action.js`): carrier back 30 ms and home 40 ms, locks back on empty, dust cover pops on the first shot, trigger pulls. | Animation | 8 h |
| 5 | **Brass** (`view/brass.js`): one pooled InstancedMesh (24 casings) spawned at `P_Eject` with velocity, spin and gravity, faded after 0.6 s, in weapon-camera space. Casing per class (5.56, 7.62, .338, red 12 ga hull, 9 mm), rate-limited for 900 rpm. | Animation | 4 h |
| 6 | **Reload v2**: `ar-reload.js` tracks gain a `charge` / `catch` key that sends a hand to `P_Charge` or `P_Catch` (the bolt-knob reach from `rifle-action.js`, generalised), plus archetype templates (AR, bullpup, AK rock-in, bolt, semi-sniper, pump, tube, belt LMG, pistol) so a gun lists only its overrides. Every gun gets an empty and a tactical reload. | Animation | 12 h, then ~1.5 h a gun |
| 7 | **LOD1 for everyone else**: each GLB exports a decimated copy (about 25 %) with the moving parts merged into one draw and 256-px maps; third person, remote players and the killcam use `buildWeaponMesh(def, { lod: 1 })`. | Performance | 4 h |
| 8 | **Draw-call merge** on what stays procedural: static parts merged per material at build (the snipers sit at 66–86 draws, the Peacemakers at 144). | Performance | 3 h |
| 9 | **Grip fit**: grips, handguards and charging handles sized to the hand rig (the grip box `hand-model.js` is tuned to, 0.05 m wide; the support claw's reach), checked from the rods' end points, so the hands close on real geometry. | Geometry | 3 h |
| 10 | **Arms sheet + budget tool** (`tools/troll-ops-arms-sheet.mjs`, the Arms Book renderer made official): side, 3/4 and a macro shot per gun, plus tris, draws, materials and texture memory against the budget below; and a per-gun animation strip (fire cycle, empty reload) from a headless match, as `troll-ops-snipers-test.mjs` does now. | Process | 4 h |

### Budgets

| | Viewmodel (LOD0) | Everyone else (LOD1) |
|---|---|---|
| Tris | ≤ 30k (unique guns ≤ 45k) | ≤ 6k |
| Draws | ≤ 8 (body, mag, carrier/bolt, charge, trigger, sight, glass, glow) | 1–2 |
| Textures | one set, 1024² (BaseColor, ORM, Normal webp); 512 on touch | 256² |

Green Candles (93k) and the Soul Blazer (77k) are over and get a pass in
Phase 3.

**First person over third (user, 2026-10-29):** the gun in your own hands
carries the detail and has no hard budget (the Problem 416: 88k tris, 2048
maps); what everyone else sees (third person, remote players, the killcam)
stays light, the LOD1 column above. More in first person, less for others,
is the rule, not a compromise.

## 3. Shared form language (from the four concepts)

What makes the concepts read as one game:
1. **Chamfers, not rounds.** Major panels meet at 45° chamfers (1.5–3 mm
   in game units); only grips, butt pads and organic pieces are round.
2. **Shell over core.** A coloured shell (OD, tan, bone white) over a black
   functional core that shows at the seams and through cut-outs: ejection
   port, skeleton stock, handguard slots.
3. **One small-feature vocabulary.** Hex screws and pins, M-LOK slots,
   vent slashes, stippled panels on grips and cheeks, waffle polymer mags.
   Every gun takes from the same kit at the same sizes.
4. **Visible mechanism.** You can see the part that moves: the carrier in
   the port, the bolt in the cut receiver, the charging handle.
5. **Worn paint.** Paint wears to darker metal at the edges, roughness
   varies between paint, polymer and steel, no flat colour anywhere.

Unique guns (THE BEAST, Soul Blazer, Green Candles) keep the black core,
the screw/slot vocabulary and the wear rules, and break silhouette freely.

## 4. Phases

### Phase 1: foundation + four guns (about 70 h)

Guns: **Problem 416** (the starter, the most-seen gun, hand-coded today;
concept 1), **MTAR** (the bullpup; concept 2), **THE BEAST** (the unique
one; concept 3), **Howl Ballista** (bolt sniper, builds on the bolt-hand
work; concept 4).

0. **References** (1 h a gun). `refs/arms/<id>/`: the user's concept
   (the target look), one clean side-on photo for proportions (the
   Commons photos the specs already cite), and close-ups of the moving
   parts. Proportions come from the photo, surface and colour from the
   concept.
1. **gunkit v2** (`models/gunkit.py`, `models/arkit.py`): `section_body(outline, regions)`
   (#1), `chamfer_box`, `panel_line(path, depth)`, `slot_array`,
   `vent_slashes`, `stipple(face_set)` and `waffle(face_set)` as high-poly
   displacement, `screw_set`; every builder exports `P_*` moving parts with
   pivots and `P_Eject`, `P_Charge`, `P_Catch` empties (#4).
2. **Bake** (`models/bake_kit.py bake_gun`): high and low from one recipe,
   UV unwrap of the low (Smart UV, 2 % margin), Cycles bakes normal, AO and
   curvature; the material kit (#3) composes BaseColor and ORM from them;
   export `<id>.glb` plus `<id>-base.webp`, `<id>-orm.webp`, `<id>-nrm.webp`,
   and the LOD1 (#7).
3. **Loader** (`weapon-model.js prepDetailed`): bind the three maps
   (BaseColor sRGB, ORM and Normal linear, `shrinkTexture` on touch), one
   shared material per surface set; `buildWeaponMesh(def, { lod })`.
4. **Mechanics**: `view/gun-action.js` (#4), `view/brass.js` (#5), reload v2
   keys `charge` and `catch` (#6), wired into `weapon-view.js` at layer 5
   (reload/action) like `boltGunPose`.
5. **The four guns**, one session each, in this order: 416 (the AR recipe
   every rifle reuses), MTAR (proves bullpup ejection and the tail reload),
   Ballista (proves the bolt-in-port and the bolt-sniper reload), BEAST
   (proves a unique gun on the shared kit).
6. **Tools** (#10) and a before/after sheet per gun.

Phase 1 is done when the four guns hit the budget, the arms sheet shows
them beside their concepts, and each passes its per-gun checklist (§6).

### Phase 2: the rest (about 4–6 h a gun)

Order by how often a gun is seen and how far it is from the bar: the box
guns first (Snubgrin M4, Widemouth 12 are starters; then Trollboy, Sneer,
Bellow, Cackle, Bellylaugh, Sawgrin, Guffaw), then the traced guns (SMGs,
the other three snipers, the two pistols), then the Blender rifles move onto
gunkit v2 (re-run their builders on section bodies + bake: about 3 h each
since the anchors already exist). The pump guns get a real pump part; the
LMGs get feed covers and belts; the semi snipers rack a charging handle on
empty.

### Phase 3: polish and unique effects

THE BEAST's jaw on fire, Soul Blazer and Green Candles under budget,
inspect animations that show off the mechanism, per-class sound beats on
every mechanism key, wear variants per prestige finish, camos on the baked
maps (a mask channel lets a skin tint only the shell).

## 5. Before / after

**AR: Problem 416.** Before: 1,158 tris, 54 draws, 10 flat materials;
hand-placed boxes; the charging handle is a box; no port, nothing moves on a
shot. After (concept 1): chamfered upper and lower with the split line, M-LOK
handguard with a top rail, an open ejection port showing the carrier,
forward assist, flip-up irons, a waffle polymer mag and a stippled grip
(both normal-baked), adjustable stock with its QD cut; OD cerakote wearing
to black anodize. Every shot the carrier cycles and brass flies right;
empty, it locks back; the empty reload ends on a palm slap of the bolt
catch.

**Bullpup: MTAR.** Before: 14k tris lofted from the traced Tavor outline;
it reads as one smooth slab, flat tan. After (concept 2): a faceted tan
shell with panel seams, vent slashes, stippled cheek and grip panels, a
dark polymer mag with windows behind the grip, the charging handle in its
slot. Brass ejects from behind the grip, by the cheek, which is what sells a
bullpup. The tail reload exists; the empty one gains the support hand
reaching forward for the charging handle.

**Unique: THE BEAST.** (Deleted from the game, user 2026-10-30; Phase 1
is three guns.) Before: 46k tris, flat bone white, cone spikes, a
lofted head. After (concept 3): bone-white armour plates with chamfered
seams over a black mechanical core showing through the cut-outs, brushed
gold inlays, faceted blade spikes, a dragon head at the muzzle with steel
teeth; a port in a side plate with the carrier behind it. Phase 3 opens the
jaw on each shot.

**Bolt sniper: Howl Ballista.** Before: 5.3k tris, 74 draws, 29
materials, a traced slab; the bolt is a box and a ball stuck on the side.
After (concept 4): a chassis with M-LOK cuts, cheek riser and butt pad
adjust lines, a cut receiver showing the bolt body, a real handle and knob,
fluted barrel and slotted brake, the bipod folded under. The bolt cycle
(hand on the knob, `tf-sniper-bolt`) now moves real geometry and throws a
.338 case on the rake.

## 6. The per-class checklist

Every gun, every class:
- [ ] Reference set in `refs/arms/<id>/` (concept, side photo, part close-ups): every image used, with a NOTES.md (CLAUDE.md rule 11)
- [ ] Not boxier than the real gun: grips, stocks, pads, guards and curved parts carry their curves; the side render checked against the reference (CLAUDE.md rule 10)
- [ ] Built on gunkit v2 (section body, shared vocabulary), baked maps, no flat colour
- [ ] Within budget (LOD0 and LOD1), checked by the arms sheet tool
- [ ] Silhouette reads at hip and at 3/4; the moving part is visible
- [ ] Grip, handguard and every hand target sized to the hand rig; hands close on geometry
- [ ] ADS: the sight line on centre (existing check), irons fold under any optic, optics sit on the rail; the sights read big and the look speed matches (§6a)
- [ ] Attachments: every optic, muzzle and underbarrel in its CLASS_FIT lines up
- [ ] Fire: the moving part cycles each shot, the trigger pulls, brass where the gun ejects
- [ ] Empty and tactical reloads, both with hands, ending on the gun's real finish (catch, handle, bolt, rack)
- [ ] Reload cut short by sprint or fire eases out, never snaps (`easeCutReload`)
- [ ] Sound beats land on the visual keys
- [ ] Sprint, inspect, swap-in all clean
- [ ] Third person, remote players and the killcam show LOD1
- [ ] Its own headless test: anchors, ADS line, the cycle, both reloads, no page errors

Per class, on top:
- **Assault / carbine:** carrier visible in the port, locks back on empty; dust cover pops on the first shot; empty reload ends on the bolt catch or charging handle (per gun: M4 family slaps the catch, AK family racks, the AN-94 reaches across to the right).
- **Bullpup:** brass ejects behind the grip; the reload works at the tail; the charging handle is forward.
- **PDW / SMG:** a cycle fast enough to read as a blur (≥ 850 rpm), brass rate-limited; MP7 and Vector charging handles pull on empty; the PDW-57's top mag shows its rounds.
- **Battle rifle:** heavier recoil read (carrier travel longer); SKS stripper-clip reload; SCAR side charging handle reciprocates.
- **Sniper, bolt:** hand on the knob, bolt visible in the port, case thrown on the rake, scope drop during the cycle (done on `tf-sniper-bolt`).
- **Sniper, semi:** charging handle racked on an empty reload; heavy .50 recoil in the hands (XPR).
- **LMG:** feed cover opens on reload, belt or drum visible, box swap; bipod folded under.
- **Shotgun:** a real pump part with the hand on it (the Widemouth and Sawgrin have none today), red hulls ejected on the pump, shell-by-shell reload; the Saiga racks AK-style.
- **Sidearm:** slide cycles and locks back (done); a case per shot; revolvers eject on the reload, never on a shot.
- **Launcher:** missile slides in on the reload; the tube's rear opens.

## 6a. Sights and aim: lessons (2026-10-31)

From the user's playtest of the 416, MTAR and Ballista. Every new gun follows these.

- **Look speed is the input code's job, never the gun's.** Aimed in, mouse, stick and
  touch turn by `adsLookScale()` (`input/aim-sens.js`): tan(aimed fov / 2) over
  tan(hip fov / 2), times the player's ADS sensitivity. A flick moves the picture the
  same distance through every sight. Don't give a gun its own look multiplier, and
  don't scale aim by `camera.fov` anywhere else. The old mouse path had no zoom term,
  so the Ballista's 8x moved about 4.8x faster on screen than the MTAR's irons and
  "felt like its own sensitivity". Check: `tools/troll-ops-ads-sens-test.mjs` with
  the new gun's sights in the list.
- **Irons must read big.** Bare irons sit 0.3 m from the eye by default
  (`IRON_ADS_DISTANCE`, `view/weapon-view.js`; optics keep 0.46 or their own). Build
  them wide: a ghost-ring rear aperture (a thin ring: hole radius ~5.5 mm in a ~21 mm block; at 3.4 mm the front post was a speck inside it),
  ears and front wings spread to frame the post, the post itself kept thin. A small
  MBUS block 0.3 m out reads as a pinhole.
- **Rear sight at the back of the rail, eye where the cheek is.** On a bullpup the
  cheek sits on the butt, so the eye rides close behind the rear aperture: the MTAR
  sets `adsDistance: 0.2` in its `DETAILED` entry, and its rear sight stands at the
  rail's rear end. Set the eye from where the cheek weld really is, per gun.
- **The red dot dims on the move** (to 35 %, `view/weapon-view.js`). It keys on
  `def.sight === "reddot"` and on reticle meshes marked by `sightMark()`, so a new
  dot optic gets it for free. Never draw a dot outside `sightMark()`.
- **Shoot every sight aimed in, before and after:** `tools/troll-ops-optic-shots.mjs
  <gun>:iron <gun>:reflex <gun>:acog` (and `:scope8` for snipers), and run
  `tools/troll-ops-iron-ads-test.mjs` with the gun's irons distance. Run a gun per
  process: a second page in one browser sometimes stalls its first load.
- **Moving the irons is a model change.** Edit the builder, then a FULL `bake`
  (never mask-only), a `KIT_VER` bump, and the prefetch manifest lines
  (the weapon camos lesson).

## 7. Where procedural generation hits a wall

| Wall | Path |
|---|---|
| Organic, sculpted shapes: THE BEAST's head and teeth, the Soul Blazer skull, anything with muscle or bone | Hand-sculpt that one piece once in Blender (`models/parts/<id>-<piece>.blend`); the builder imports it and bakes it with the rest. Keep it to the pieces scripts can't loft. |
| Stippling, knurling, waffle patterns, cast texture | Never geometry at this budget: high-poly displacement baked to the normal map (#2). |
| Wear that tells a story (worn mag well, scratched rail) | Curvature and AO masks cover 90 %; the rest from a small shared decal atlas placed by the builder. |
| Markings, selector letters, logos | Decals in the BaseColor bake, never geometry. |
| The hands | They're ink rods and blocks on purpose; the guns fit the hands, never the reverse. A detailed hand is a separate decision. |

The cleanest path is better scripts with a high-to-low bake, plus limited
hand modelling for the few organic pieces. A full rewrite isn't needed:
`gunkit.Part` already carries bmesh geometry, UVs, materials and pivots, and
the game already loads GLBs with named nodes (`prepDetailed`). What changes
is how the shapes are made and that they get textures.

## 8. Parallel sessions

Phase 1's foundation (steps 1–4) is one session: everything after it
depends on it. The four guns can then run as four sessions, each in its own
worktree and branch off the foundation branch. Shared files they all touch
(`ar-reload.js SPECS`, `weapon-model.js DETAILED`, `weapons.js`) take one
entry per gun, so merges stay mechanical. Each gun branch skips the `?v=`
cascade (CLAUDE.md rule 1); the session that merges them runs it once.

## 9. Shared runtime contracts (Part 2, 2026-11-02)

Part 1 landed the 416, the MTAR and the Ballista on these conventions
(`HB_Bolt` / `BoltKnob` / `tf_lift` / `tf_round` were agreed between the
Ballista and MTAR sessions). Part 2 (the Grinmington 870, the Bellylaugh
M60, the Snicker MP7, the Smug XPR) adds the pump, the feed cover and the
belt. Each mechanism has ONE runtime home, written once and used by every
gun that exports its nodes; a builder never carries its own animation.

Every v2 gun exports under a two-letter prefix `<P>`: moving parts are
`gunkit.moving()` Parts (names in `gunkit.MOVING`) with extras `tf_part`,
`tf_kind` ("slide" | "hinge"), `tf_axis`, `tf_travel` (metres along the
axis, + = toward the tail; or radians about it); points are empties
(`gunkit.POINTS`). `weapon-model.js buildDetailed` reads them into
`userData.gunParts` (node, kind, axis, travel, follow, rest pos / rot) and
`userData.gunPoints`; `view/gun-action.js setPart(part, k)` places a part
`k` (0..1) of the way along its travel. A part not exported is simply not
moved; a point not exported falls back to the old gun-local offsets.

### 9.1 The nodes and extras

| Mechanism | Nodes / extras | Runtime home | What drives it |
|---|---|---|---|
| Carrier / bolt (closed bolt: AR, SMG, PDW, semi sniper) | `<P>_Carrier` slide z; `<P>_Trigger` hinge x; `<P>_Catch` hinge; `<P>_DustCover` hinge; `<P>_Selector` | `gun-action.js placeParts` | a round gone outside a reload: back 30 ms, home 40 ms; locks back on the last round; released by the catch or a let-go handle |
| Reciprocating handle | `<P>_Charge` slide with `tf_follow: "Carrier"` | `placeParts` | rides back with the carrier each shot (travel scaled); sits back with it when it locks |
| Charging handle pulled on empty | `<P>_Charge` slide + `<P>_ChargeHand` point | `ar-reload.js` (finish `part: "charge"`), `arPartState` | the hand draws it to full travel, holds, lets go; carrier snaps home over `LET_GO` |
| Bolt catch slapped on empty | `<P>_Catch` + `<P>_CatchHand` point | `ar-reload.js` (finish `part: "catch"`) | pressed and held; drops the carrier |
| **Open bolt** (belt LMG) | `tf_open_bolt: 1` on `<P>_Carrier`; the part is BUILT at rest = back, `tf_travel` negative (the run forward to the breech) | `placeParts` | a shot runs it forward (k 1) and back (k 0) on the same curve; empty it stays forward (k 1, closed on nothing); the empty reload's charge pull returns it to 0 and it stays there (no slam, no catch) |
| Brass | `<P>_Eject` point; DETAILED `brass`: "556", "762", "338", "12ga", "9mm", "46" (4.6x30, MP7), "50" (.50 BMG, XPR); optional DETAILED `brassThrow: [right, up, back]` scale (default [1, 1, 1]; the M60 throws under the receiver) | `brass.js ejectBrass` | at 60 % of the carrier's run back; a pump gun on the pump stroke (below); rate-limited 0.04 s |
| **Pump** (shotgun) | `<P>_Pump` slide z, travel 0.085 (+ = back); `<P>_Support` point ON the pump (the support hand is parented to the pump node, so the arm rides a rack); `<P>_Shell` a loose 12 ga shell, hidden at rest (origin mid-shell, head +z); `<P>_LoadPort` point (the loading gate under the receiver); `<P>_Eject` at the port | `gun-action.js placePump` (kit guns; `weapon-view.js placePump` keeps the legacy curve for the Soul Blazer and the procedural pumps) | after a shot: a beat, back over `w.pumpDur` (weapons.js `pumpTime`), hold, home; the red hull ejects as the pump passes 55 % on the way back; an empty shell reload ends on the rack (`shellReload.rack`, `rl.rack`); the shell-by-shell reload itself stays `weapon-view.js shellReloadPose` / `placeReloadShell` (any gun with `def.shellReload`, kit or not) |
| **Feed cover** (belt LMG) | `<P>_FeedCover` hinge x, pivot at its rear hinge, travel the opening angle (radians); `<P>_CoverHand` point (the latch, where the hand goes) | `placeParts` reads `arPartState().cover` | `ar-reload.js` spec `cover: true`: both reloads open it after the box is seated, lay the belt, slam it; the empty one then racks `<P>_Charge` (finish `part: "charge"`) |
| **Belt** | `<P>_Belt` node, a child of `<P>_Mag` (the box), with `tf_rounds: 1`, `tf_rounds_pitch` (one link), `tf_rounds_max`, `tf_rounds_axis: "x"` (the MTAR's stack uses "y") | `placeRounds` | pulled through +x a link a shot (capped at max); fresh with the new box (gone = 0 from 35 % of a reload); leaves with the box because it is its child |
| Box / mag | `<P>_Mag` (pivot = the mag point; `magazinePoint`) | `ar-reload.js` | stripped, fetched, seated (templates below) |
| Bipod | `<P>_BipodL` / `<P>_BipodR` hinge, built folded | `gun-action.js updateBipod` | down prone, still and aiming (PRONE.md phase 3) |
| Bolt rifle | `<P>_Bolt` (+ `tf_lift`), `<P>_BoltKnob`, `<P>_Round` (`tf_round`) | `rifle-action.js` | unchanged from Part 1 |
| Hands | `<P>_Grip`, `<P>_Support`, DETAILED `rake`, `supportDrop` | `weapon-model.js buildDetailed` | the hidden hand meshes the rods and the TROLLS block arms aim at; the pump parents the support hand (above) |
| Sights | `<P>_IronRear` / `<P>_IronFront`, `<P>_Rail`, `<P>_Aim`, DETAILED `railY`, `adsDistance`, own `scope` | `buildDetailed` | §6a |

`gunkit.MOVING` gains "Pump" and "FeedCover"; `gunkit.POINTS` gains
"LoadPort" and "CoverHand". `KIT_VER` and the glb `?v=` tag bump on every
re-bake (full bake only: the mask shares the unwrap, DESIGN-SKINS §3.1).

### 9.2 Reload templates (`ar-reload.js TEMPLATES`)

| Template | Guns | Finish |
|---|---|---|
| `ar` | 416 | catch slap |
| `bullpup` | MTAR | forward handle, let go |
| `smg` | MP7 | rear T-handle drawn back, held, let go (`part: "charge"`, sound "rack"); the gun canted toward the camera as the 416's rack is |
| `semiSniper` | XPR | side handle racked on empty; heavy .50 recoil is `weapons.js` (recoilKickKnockback), not the reload |
| `beltLmg` (new keys) | M60 | `cover: true`: box off, new box on, cover up (`CoverHand`), belt laid, cover slammed (beat "slap"); empty adds the handle (`ChargeHand`, beat "rack") |
| shell-by-shell | 870 | not a template: `def.shellReload` stages in `weapons.js` drive `shellReloadPose`; an empty gun ends on the rack |

Timing in the belt template (empty): seat 0.50, reach the latch 0.58,
cover open 0.64, belt in 0.70, cover slam 0.76, handle grab 0.80, pull
0.86, let go 0.88, home 0.96. Tactical: the same without the handle, the
cover slam at 0.86. Both reloads on an open-bolt gun open the cover: the
real M60 is reloaded that way whether or not the belt ran out.

### 9.3 Rates and tests

- A cycle faster than the carrier's 70 ms (the MP7 at 950 rpm fires every
  63 ms) restarts the curve on each shot: the carrier never settles, which
  reads as the blur; brass keeps its 0.04 s gap (a case every shot up to
  1500 rpm). No per-gun timing.
- Every gun's test freezes the reload clock (`w.reloadTime = 1e4`,
  `w.reloadT = 1e4 * (1 - t)`) to sample the hands and parts at fixed
  progress; a shell reload is sampled by setting `shellStage`, `shellT`
  and `shellDur` the same way. The cycle is held with
  `userData.gunAction.hold`.
- Shots for the user: `OUT/<gun>-*.png` from the gun's test (hip view
  `<gun>-0-hip.png`), the 2x2 four-view sheet from
  `tools/troll-ops-arms-four.mjs` (side, front-right 3/4, rear-left 3/4,
  top through `labs/arms-sheet.html`), and the TROLLS #1718 hip view from
  `tools/troll-ops-nft-action-shots.mjs` (`action-1p-hip.png`).

## Open questions (my default in brackets)

- Phase 1 AR: the Problem 416 or the Snubgrin M4? [416: it's the starter
  everyone sees first, and it's the furthest from the bar]
- Texture compression: plain webp, or KTX2/Basis (smaller on the GPU,
  needs the transcoder)? [webp first, KTX2 if texture memory bites]
- Brass in third person? [no: viewmodel only]
