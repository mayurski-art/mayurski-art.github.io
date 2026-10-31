# Troll Forces: the arsenal upgrade (geometry, materials, gun mechanics)

Status: **analysis + Phase 1 plan, awaiting buy-in.** No game code written
for it yet. The Arms Book (renders of all 35 guns as they ship) is the
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

**Unique: THE BEAST.** Before: 46k tris, flat bone white, cone spikes, a
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
- [ ] ADS: the sight line on centre (existing check), irons fold under any optic, optics sit on the rail
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

## Open questions (my default in brackets)

- Phase 1 AR: the Problem 416 or the Snubgrin M4? [416: it's the starter
  everyone sees first, and it's the furthest from the bar]
- Texture compression: plain webp, or KTX2/Basis (smaller on the GPU,
  needs the transcoder)? [webp first, KTX2 if texture memory bites]
- Brass in third person? [no: viewmodel only]
