# Troll Ops hand-off — 2026-10-02 (session 25)

## STREAM B (menu) — SHIPPED 2026-10-02: BO2 Zombies menu over the troll-map planet
Branch `worktree-to-menu-bo2`, all on main (295fb06). The user also asked
for trollrunner.net itself to get this design; that shipped from the same
stream (the "trollrunner.net Simplified" session was folded in and deleted).
- **Shared pieces in `assets/js/`** (both the site home and Troll Forces use
  them; change once): `bo2-menu.js` (the stacked list: screens, drill-down,
  arrows/W S/Enter/Esc, value rows with A D, phone tap-twice, onHot,
  backTo), `menu-globe.js` (the molten planet: MapLibre 5.24 globe from
  assets/geo/countries.json, no tiles, troll pins; CSS sun + canvas asteroid
  belt; `enterMap/exitMap/flyTo` = Troll Map mode; pause/resume),
  `troll-map-mode.js` (map screens: top cities, find a city via Nominatim,
  drop my pin -> maps.html pin flow, pin card), `site-presence.js` (N Online,
  global getViewerRoster for troll-accounts).
- **Troll Forces: `menu-bo2.js` drives the OLD lobby, it doesn't replace
  it.** game.js/loadout.js still build every list; the menu reads and
  clicks their buttons and the hidden tab bar (showLobbyPanel), so new
  weapons/modes/maps appear automatically. `#to-pf-center` is MOVED into
  the BO2 detail pane (stats, room code, key lists); the parts that became
  lists are hidden by CSS (style.css "Main menu v3" block at the end).
- **game.js touch (1 line, near `composer.render()` in animate):** skips
  the arena render in the menu while `body.to-bo2-cover` is set. If the
  lobby ever looks black behind a screen, that class is the reason.
- CSP (troll-ops.html, index.html): `worker-src 'self' blob:` (MapLibre),
  Nominatim in connect-src.
- trollrunner.net: new `index.html` (old desktop OS kept unlinked at
  `/desktop.html`; phones get the same menu, world.html is no longer the
  phone home; Messages dropped per the user). Old `?open=` links forward.
- Design canvas row "v3" in https://claude.ai/artifact/XXhnWGcoA1BfCYvUC49LKa
  (renders are placeholders; the live planet is code).
- **Open / next:** Drop my pin still hands off to maps.html (X-link +
  consent flow lives there); gamepad D-pad navigation for the BO2 list isn't
  wired; the operator preview on phones is small; real planet art may come
  from the user (ChatGPT) later and would replace menu-globe's sky/limb CSS.

## RESUME HERE (2026-10-02, session 25, later) — phase 6b SHIPPED; 3 new asks queued

## RESUME HERE (2026-10-02, session 25, latest) — 6f, 6g chapel, 6h mannequins SHIPPED: Hollowgrin pass DONE (`game.js?v=to-padbo2-hg6h`, maps/loadout/hollowgrin/chapel/mannequins `?v=hg6h`); next 6f
- **6g chapel** (`hollowgrin-chapel.js`, buildChapel; hollowgrin.js hands
  its helpers in as H, so the module never imports hollowgrin.js back: a
  second `?v=` would make a second copy of it). St. Grinsworth's rebuilt
  whole from the two church refs: brick, hammer-beam roof over painted
  red/gold panels (trollface roundels), stained lancets (a saint with a
  trollface), oak pews + red runner, rail, pulpit, the altar on two red
  steps under a gold trollface sunburst, a half-domed mosaic apse (text
  band, star lantern) poking 2.7 m out west against the map edge (its stone
  benches cover the edge's ghost wall at x -51; boundary wall + trees skip
  it). Side door at x -42.6 (was the breach), rose window + bellcote on the
  east gable. One light (the chapel's old one).
  **Zombie-reach gotchas** (all fixed, sim-checked): pew rows are ONE
  collider per run, 1.2 m tall (rows' 0.5 m gaps were player-only pockets;
  1.2 is over the 1.1 m jump); front row 1.7 m off the rail; the apse behind
  the altar is shut; pulpit and the priest's/beggar's colliders run to the
  walls/pews. The sim's "reached" is 1.6 m horizontal THROUGH walls: a
  zombie outside the west wall "reached" the altar. Use 0.9-1.35 m.
- **6h mannequins** (`hollowgrin-mannequins.js`, placeMannequins; table
  MANNEQUINS = [name, x, y, z, facing, collider, offset]). 17 people + 3 pets
  as `models/mq-<name>.glb`, built by `models/build_mannequins.blender.py`
  (`-- render [names]` for Cycles previews, `-- export [names]`). People are
  MakeHuman (MPFB 2) via the zombie builder's plumbing (exec'd minus its
  main()): clean skin with a sheen, eyebrows/lashes, recoloured clothes
  (tint keep 0 = flat colour), poses on the game_engine rig, props laid ON
  the posed surface by BVH ray casts (stole, aprons, skeleton bones), frozen,
  decimated, ONE 768 atlas per figure. Pets: primitives fused by a voxel
  remesh (metaballs came apart). Each person has a pen-6 collider.
  **Builder gotchas:** MPFB purges unused materials while building a human
  (palette needs use_fake_user); join() merges UV layers BY NAME (rename
  every part's to "UVMap" first or clothes get zeroed UVs); keep a UV-layer
  handle across an edit-mode round trip and Blender segfaults; only hair /
  brows / lashes may bake alpha (clothes textures carry alpha too and
  decimated triangles land on clear texels). The render_glb.py preview draws
  alpha opaque: judge the GLBs in game.
- **Concurrency:** another session ran `git pull --rebase --autostash` in
  THIS checkout and stashed my uncommitted builder (it sat in
  `stash@{0}: autostash`). Commit work in progress early.
- **6f SHIPPED** (`game.js?v=to-padbo2-hg6i`, hollowgrin/maps `?v=hg6i`): six
  zombie rise points in the park (pet cemetery x2, splash pool, cave, under
  the coaster x2); no bot roam points needed (bots walk the flow field to
  the nearest enemy; the park has a spawn at each end). Map-vote preview
  re-shot over the fair: run tools/troll-ops-map-previews.mjs with
  WAIT=25000 or the GLBs (mansion) aren't in yet. The previews' `?v=mp1`
  (game.js + menu-bo2.js) was NOT bumped (Pages caches ~10 min).
  **The Hollowgrin detail pass (6a-6h) is DONE.**

## (previous) RESUME HERE (2026-10-02, session 25) — 6c, 6d, 6e SHIPPED; next chapel + mannequins, then 6f
All in hollowgrin.js (buildMansion, buildMountain, buildCoaster run after
buildPark) + models/build_grinmoor.blender.py (`-- mansion mountain moat`).
Tags now `game.js?v=to-hg6e`, every troll-ops import ?v=hg6e.
- **6c U Mad Mansion** (x 62..77, z 20.5..30.5, floor 0.4): lace galleries
  (upper one playable from the attic), hipped roof + cupola, scarecrow,
  naughty list, planters + queue arch. Inside: stretching-portrait foyer ->
  endless hallway (ghost rush + scare sting via new `attachAudio` map hook,
  game.js calls builtMap.map.attachAudio(audio)) -> ballroom (ghost dancers,
  chandelier, the one new real light: 14 of 14) -> mirror maze -> back door
  -> pet cemetery; ballroom stair -> attic. Zombie floor "mansion" + link.
  **Gotchas:** (1) a floor > 0.45 m makes the zombie flow field treat the
  whole house as a wall -> floor 0.4; (2) the field only passes a doorway
  with a whole free 0.55 cell after 0.3 m padding each side -> doorways >=
  1.7 m; (3) wall() can't take openings that overlap along the wall -> one
  opening per column, storeys stacked in its spans.
- **6d Skull Mountain + moat**: mountain = grid of rock columns, height
  mountainH(x, z) (15 m peak, -1.35 m/m, min 3.2 / 4.6 over the cave path),
  same grid for colliders (JS mountainCells) and boulders (Python
  mountain_cells); cave path from the lane's end (x 72.7, z 35) out north
  (x 75, z 30.6). Skull (red pulsing eyes), pines, flume chute into the
  splash pool (67.5, 41.1). Waterway U round the island (MOAT_ARMS), glowing
  teal, wadeable (MOAT_WADE joined to the creek/pond wade polygon by a
  doubled slit outside the map: even-odd cancels it), curbs 0.2, three
  bridges (decks 0.55 so you stay dry: wading = y < 0.5), corn-husk posts,
  log boats on the loop + down the chute with a splash. **The 5 m ledge was
  dropped** (no stair spot that doesn't land in the mansion or the cave path).
  South park spawn moved to (60.5, 38.2).
- **6e The Grinder**: track generated in JS from one closed CatmullRom
  curve (coasterPoints: station z -18.5, lift x 74 to 21 m, drop west, loop
  at x 55, corkscrew along z -26, brake run x 78.9 at 9 m, back along
  z -13.2 at 3.2 m), parallel-transport up vectors (transportUps), rails +
  spine + ties, tan supports (ghost columns, pen 0.6), a 4-car train timed
  by gravity (chain lift 3.2 m/s, 5 s station dwell). Station with two
  platforms (0.3 m step rises: 0.4 was too much), queue maze, brake deck
  (x 80.2..83.2, z -37.2..-30.4, y 9) up a 30-step stair, zombie floor
  "brake" + link. Drop tower at (85, -43.5) (ring climbs 8 s, falls 1.4 s).
- Tests: audit all maps PASS (hollowgrin 1035 colliders); map-walk hollowgrin
  ALL PASS with STEP=1 (new runs for mansion, moat, cave, station, brake
  deck, stall alley/walkway); zombie sim: attic 33-42 s, gallery, maze 15 s,
  cave path 28 s, brake deck 15 s, coaster yard 9 s; fps 25-28.5, ~470-500
  draws (no regression vs 6b).

**Next in THIS session (user moved it here): chapel + mannequins.**
Prototype: models/build_mannequins.blender.py (skin-modifier bodies,
painted faces; `-- proto` -> mq-proto.glb, NOT in the game, not committed).
Plan sent to the user (chapel rebuilt intact in its 10 x 10 m footprint:
hammer-beam roof, brick, lancets, pews + red aisle, raised altar, mosaic
half-dome apse west, rose window to the east gable, the breach becomes a
side door; cast of ~19 people + 4 pets: chapel priest/kneeling man/2 in
pews, lane families + pets, park bench couple/kid/vendor/attendant,
shopkeeper, farmer). **Waiting on 3 answers** (defaults if no reply): what
goes over the altar (gold trollface sunburst), ghoulish touches (no, clean
Nuketown), shootable knock-over (no, just stop bullets). Put the chapel in
hollowgrin-chapel.js and the figures in hollowgrin-mannequins.js as planned.
Then **6f**: bot roam waypoints into the park, zombie rise points (splash
pool, pet cemetery, cave, under the coaster), previews, final look.

## (previous) RESUME HERE (2026-10-02, session 25, later) — phase 6b SHIPPED; 3 new asks queued
**Two workstreams now. Run them in separate sessions, each in its OWN git
worktree + branch** (the main checkout is shared; see "Splitting work"
below). Stream A = Hollowgrin map (phase 6 + the new map asks). Stream B =
the main menu redesign (self-contained, menu files only).

### 6b SHIPPED (`game.js?v=to-hg6b`; maps.js / hollowgrin.js / loadout.js ?v=hg6b)
- BOUNDS maxX 51 -> 87 (map 138 x 90). **Bug fixed on the way:**
  api.ghostWalls was centred on (0, 0); it's now centred on the bounds'
  middle (on an asymmetric map it put the east wall through the park and
  opened the west edge).
- New `models/build_grinmoor.blender.py` (`-- carousel ride horse fountain
  plaza wheel stalls`) -> hg-carousel (still parts), hg-carousel-ride (the
  turning deck/poles/pumpkin coaches, about the carousel centre; JS spins it),
  hg-horse (one horse; JS instances 8 and bobs them), hg-fountain, hg-plaza
  (benches, banner lamp posts, edging), hg-wheelbase (A-frames, boarding deck,
  stair, lamp deck, shack boxed in with lattice up to the deck, podium),
  hg-stalls. Shared constants at the top of both files (PLAZA, FERRIS,
  WHEEL_*, BOARDING, SHACK, PODIUM, STALL_Z, STALLS): change one, change the
  other.
- hollowgrin.js `buildPark()` (runs after buildOutskirts): the park fence at
  x 51 (brick piers + low wall are solid, the iron bars pen 0.25) with gaps
  for the main gate z 0..5 (+1.1 m of pier each side), a staff gap
  z -40..-37.5 and the lane; the main gate (tall piers, jacks, bracket
  lanterns, iron arch, GRINMOOR FAIR sign, bulbs, leaves swung open); the
  plaza at (63, 2.5) r 9 in granite setts (settsTexture/settsRing/settsRect);
  the pumpkin fountain (discCollider = AABB bands for round things; water
  discs with a scrolling ripple emissive, additive falling sheets, spray
  sparks, a bronze troll with a trollface and a lantern, 5 giant jacks);
  8 lamp posts + 6 benches; the Ferris wheel moved to (80, 2.5) facing the
  gate; a lamp deck at y 6 (x 74..78, z -8.8..-5.4) up a 20-step stair; 5
  stalls (Balloon Pop, Shooting Gallery, Hook-a-Pepe, Cotton Candy, Corn
  Dogs), each with a counter flap at its east end. One new real light (the
  fountain): 13 of the 14 budget.
- **The shooting gallery's tin trolls flip when shot**: new map hook
  `HOLLOWGRIN.onShot(point)`, called from game.js onWorldHit (any map may
  export onShot); hollowgrin keeps SHOT_HOOKS (cleared each build).
- hgModel(api, name, { wash, bounce, parent, then }) now returns its promise
  and can parent to a group (the carousel ride).
- signTexture squeezes text to fit its frame (fillText maxWidth).
- Spawns: + [70, -41] (north side) and [58, 40] (south side): 7 + 7.
- Zombies: HG_FLOORS.wheel 6.0. hgFloorOf: x 73.5..78.5, z -9.3..1 ->
  "wheel" when y >= 4.6 and z < -5, else ground. Link ground->wheel a
  (77.2, 1.9) b (77.2, -6.6). **Gotcha:** a link's end must be ON the floor
  it names. The first try ended on the 0.4 m boarding steps: zombies coming
  down never read as "level" and hung in the climb. The steps now sit at
  z 2.0..4.2 only. East walk-ins moved to x 86.2, plus three more on the north
  edge and one on the south.
- Tests: audit all maps PASS (hollowgrin 713 colliders). map-walk hollowgrin
  ALL PASS in STEP=1 mode (new: main gate, fence holds, lane through, wheel
  stair, deck rail, stall flap, counter stops you). Real-time mode failed the
  glasshouse west door once from timing noise; STEP=1 passes it. Zombie sim
  (scratchpad zloft.mjs): wheel deck reached in 26 s, plaza in 14 s, loft in
  34 s. fps was noisy on this machine today (old build 9.5 vs new 18-21 in
  the same run; ~480-520 draws both): no regression visible.
- The park's north (coaster yard) and south (mansion/mountain) are open grass
  until 6c-6e.

### Stream A next (Hollowgrin): 6c mansion -> 6d mountain + moat -> 6e coaster -> 6f tuning, PLUS two new asks
1. **Mannequins all over Hollowgrin** (user, 2026-10-02): "make them look as
   realistic as possible, kind of like Nuketown in Call of Duty". Their ref
   is a Nuketown mannequin: a woman in a 60s orange shift dress with a white
   pattern, dark long sleeves, patterned tights, a bob haircut, a painted
   face with rosy cheeks, mid-stride. Scenes asked for: **a priest with a man
   begging on his knees inside the church**, kids and adults
   trick-or-treating (costumes, candy buckets) on the lane, pets (dogs,
   cats), "etc.". Static posed props (no AI) modelled in Blender: realistic
   proportions, a painted-plastic look, real clothes and hair, varied poses.
   A shared body with per-pose rigs would keep it cheap (instance where
   possible). Bullets should hit them (a low-pen ghostBox per figure); maybe
   later they get knocked over like in Nuketown. **Design doc first** (cast
   list, placement map, poly budget).
2. **Remake the church interior** (St. Grinsworth's chapel, CHAPEL in
   hollowgrin.js, currently a ruin with a broken south wall). User refs:
   (a) a Gothic-revival nave: buff brick walls, a dark timber hammer-beam
   roof with painted red/gold panels, stained-glass lancets, carved pews
   either side of a red-carpet aisle, a raised altar on red steps, a hanging
   lantern; (b) a domed chapel: a blue/gold mosaic dome with saints, a
   painted band of text round its base, a hanging star lantern, arched side
   bays with stained glass, warm uplights, a marble floor with inlaid
   borders, pews. The goal is a beautiful, lit, intact interior that stays
   playable (centre aisle + side aisles, cover from the pews). It hosts the
   priest + kneeling man mannequins. Keep the trollface spin (stained glass,
   mosaics); no real-church branding. Fold it into the mannequin design doc
   or give it its own. Ask the user whether to do church + mannequins before
   or after 6c-6f.

3. **Redesign the zombies "like actual zombies"** (user, 2026-10-02, NOT
   started). Their reference: a Resident Evil-style rotting zombie with
   grey-green decayed skin, milky white eyes, torn lips showing the teeth,
   and a blood-stained, torn shirt. A second ref (2026-10-02): a swamp horde
   in the style of Back 4 Blood: a gaunt zombie LEAPING at the camera with
   long, overlong arms and hooked claws, a rotted, bloody chest, torn green
   trousers; ordinary-clothed runners sprinting through water behind it;
   fog and reeds. So: plain-clothed walkers/runners plus a lanky leaper
   variant. **Reference images are LOCAL ONLY, untracked on purpose** (other
   studios' screenshots; the repo is public): the main checkout's
   assets/games/troll-ops/refs/ holds zombie-ref.png,
   mannequin-nuketown-ref.webp, church-nave-ref.webp, church-dome-ref.webp,
   menu-bo2-zombies-ref.png (worktrees: read them by absolute path from
   C:/Users/mayur/OneDrive/Documents/GitHub/mayurski-art.github.io/...).
   The horde image wasn't saved; ask the user to re-send it if needed.
   Never commit refs/. Design doc
   first: how the models are made (Blender), variants (shirt colours,
   wounds, a few body types), animation (shamble, lunge, crawl?), and keep
   the hitboxes zombies.js already uses. Self-contained (zombies.js +
   models), so it suits its own session/worktree too.

### Session "zombies" status (2026-10-02, branch worktree-to-zombies, worktree .claude/worktrees/to-zombies)
Design doc v2: https://claude.ai/artifact/Motm585y8qJeknjWVv9CuC
- **User decided:** bodies = MakeHuman via MPFB 2; YES to a rare (~1/40)
  rubber trollface-mask zombie made from the real mascot art.
- Installed: Blender extension `mpfb` (`blender --online-mode --command
  extension install -s -e mpfb`) + CC0 packs (makehuman system assets,
  shirts01, pants01, dress01) extracted into MPFB user data
  (%APPDATA%/Blender Foundation/Blender/5.2/extensions/.user/blender_org/mpfb/data).
  CC-BY packs deliberately NOT used. Assets stay out of the repo; only the
  exported GLB will be committed.
- `models/build_zombies.blender.py` now builds looks walker / runner / leaper
  on MPFB bodies (game_engine rig, UE bone names), snarl from expression
  units, zmask colour attribute (R lips, G sockets, B blood) from the `lips`
  vertex group + eye centres, zombie skin/cloth/teeth/hair materials, render
  poses via aim(). `-- render [look]`, env ZB_* (docstring). Renders are in
  the doc. **Gotchas:** never call read_factory_settings (unloads MPFB);
  MPFB's "Delete.*" MASK modifiers hide the body under clothes, removed so
  tears show skin; the eyes object is "Human.low-poly"; MakeHuman's rest pose
  bends the forearms forward, so pose by aiming bones, not world-axis turns;
  AgX at exposure 0 blows dark red up to bright red (renders use -0.9).
- **ZR1 SHIPPED (2026-10-02, game.js?v=to-zr1, zombies.js?v=zr1):** the
  realistic zombies are in the game.
  - `-- export walker runner` -> models/zombie-walker.glb / zombie-runner.glb
    (~13-14k tris, ~0.9 MB each): body decimated (ZB_BODY_RATIO 0.26) with
    its rot baked to colour + a normal map from the full-detail body; each
    garment/hair baked to colour+alpha (512); teeth 256; eyes flat. Clips
    (NLA_TRACKS, 30 fps): walk, run, idle, attack, die, keyed with the
    aim() pose specs in CLIPS. Bake PNGs go to %TEMP%/zb_bake (ZB_BAKE_DIR).
  - zombie-models.js: one load per GLB, cloneSkinned() (r160 has no
    SkeletonUtils), clothes alphaTest not blend, skin tint per instance,
    11 hitboxes on bones placed from rest-pose bone positions (head sphere
    r 0.15, user OK'd). CLIP_SPEED maps ground speed to clip timeScale.
  - zombies.js: types are now walker / runner (runners from round 5, 25%,
    HP x0.8); any look can be either. Death = die clip, lie 1.6 s, sink.
    flinchFrom() (game.js calls it when the actor has no stick rig).
    Spawning waits for the GLBs; if they fail, the old stick figures stand
    in. resolve() goes by mesh.userData.zombie now.
  - **CSP:** troll-ops.html img-src AND connect-src need `blob:` or
    GLTFLoader's embedded textures silently fail (untextured zombies).
  - tools/troll-ops-zombie-test.mjs: ALL PASS on hollowgrin + pentagrin
    (bodies, clips, head vs chest hitbox, death+cleanup, textures, no
    errors). FPS=1: round-10 horde of 12 = 33 fps / 473 draws vs 29.6 / 385
    on the old build (headless, noisy).
- **ZR2 SHIPPED (2026-10-02, game.js?v=to-hg6e-zr2, zombies.js?v=zr2,
  GLBs ?v=zr2):** five looks, all with a sixth clip `rise`.
  - New looks: `woman` (female_casualsuit01, long01 hair, tear 0.7),
    `worker` (male_worksuit01, african skin, cloth_value 0.38 = filthier),
    `trollmask` (the rare one). `-- export walker runner woman worker
    trollmask` rebuilds all (13-17k tris, 0.9-1.1 MB each).
  - **Trollmask:** rubber_mask() copies the body's head (head-weight >= 0.5),
    pushes it out 6 mm, swells the jaw, rigid on the head bone; the body's
    eye openings become eye holes. Its face is the REAL art
    assets/pfp/base/og.webp projected from the front (ART_EYES/ART_CHIN/
    ART_M_PER_PX place it); that webp is transparent round the face, so the
    ink is gated on its alpha. Baked to one 512 texture; teeth dropped.
    The look uses HOLLOW (no snarl) so the mouth is closed under it.
  - Garments now get a 5 mm DISPLACE "standoff" (the body is kept under torn
    clothes, and tight tops showed skin through without it). Garments over
    CLOTH_TRIS (7000) are decimated down to it.
  - zombie-models.js: RARE_LOOKS { trollmask: 1/40 } + pickLook();
    ONE_SHOTS (attack, die, rise). zombies.js: grave spawns play `rise`
    (48 frames = RISE_TIME) while lifted out of the ground; z.look is kept.
  - Test: ALL PASS both maps, plus a forced trollmask close-up (it sets
    RARE_LOOKS.trollmask = 1 for one round). FPS=1: 35 fps / 470 draws.
- **ZR3 SHIPPED (2026-10-02, game.js?v=to-hg6e-zr3, zombies.js?v=zr3,
  audio.js?v=to-r100-zr3, zombie-leaper.glb?v=zr3):** the leaper.
  - Body: the `leaper` look, its long arms/fingers from MakeHuman's
    arms/measure-*-length-incr + hands/*-fingers-length-incr targets (so
    the rig fits them; pose-bone scale does NOT survive glTF, three
    inherits scale). 10.9k tris, 839 KB. Claws = a ("fingers", ("curl",
    deg)) spec. Own clip set LEAPER_CLIPS (look "clips": "leaper"): idle,
    lope, crouch, leap, attack, die, rise. Preview any clip key without
    exporting: ZB_CLIPS="crouch:12,leap:6" with `-- render leaper`.
  - zombie-models.js: TYPE_LOOKS { leaper: "leaper" } (only the leaper
    wears it, it wears nothing else), lookReady(), CLIP_SPEED.lope 4.0.
  - zombies.js: type leaper (HP x0.7, speed 2.9, dmg 26), from round 8,
    12% share, max 2 alive. At 3.5-7.5 m, level, with lineClear() (2D slab
    test vs the collider boxes): 0.4 s crouch + shriek event, a 0.7 s arc
    1.2 m high landing 1 m short of where you stood (walls still stop it),
    swipe on landing if you're in reach, 0.5 s recovery, 3.5 s cooldown.
    Shot/stunned mid-air it drops. director.forceType for tests.
  - audio.js zombieShriek(at): positional saw scream + hiss; game.js plays
    it on the director's "shriek" event.
  - Test: ALL PASS both maps incl. a forced leaper (crouch, leap, land,
    shriek, landing hit) + a mid-air screenshot.
- NEXT: ZR4 gore (head-pop, blood), groans, tuning. Draw calls: merge each
  zombie's clothes into one mesh.
- Old procedural metaball prototype is in commit cf7e64c if ever needed.
- Animation plan changed from the plan below: baked Blender clips +
  AnimationMixer (poseHumanoid is stick-tuned), with procedural as fallback.
  Death = fall + sink instead of the dissolve.

### Zombie redesign plan (for its own session; user asked for the plan 2026-10-02)
**Today:** zombies.js builds every zombie with character.js `buildHumanoid`
(the procedural stick-limb rig the bots use) in a flat dissolve material,
with a "grin" (trollface) or "pepe" face: ZOMBIE_TYPES troll/pepe. Hit
detection is the rig's invisible `hitboxMeshes` (head, torso, hips, arms,
legs) that game.js raycasts. Motion is `poseHumanoid(..., { zombie: true })`.

**Goal (refs in refs/zombie-ref.png + the horde shot described above):**
real zombies, not trolls in green paint. Grey-green rotting skin, milky
eyes, torn lips over bare teeth, ordinary clothes torn and bloodied, a
shambling-to-sprinting horde, and a rarer lanky leaper with claws.

**Build**
1. `models/build_zombies.blender.py` -> `zombie.glb`: ONE skinned base body
   (~4-6k tris), modelled in Blender at real proportions, with an armature
   whose bones match buildHumanoid's joints (hips, spine, chest, neck, head,
   upper/lower arm, hand, thigh, shin, foot), so poseHumanoid's angles drive
   it directly. No new animation system to start with: copy the procedural
   pose onto the bones each frame. If that reads stiff, phase 2 bakes clips
   in Blender (shamble, run, swipe, lunge, rise, die) and uses an
   AnimationMixer.
2. Look: one 1024² texture atlas painted procedurally in Blender (bake):
   mottled grey-green skin, veins, bruising, dried blood round the mouth
   and on the chest; eyes as a separate milky-white emissive-ish material;
   a lipless jaw with modelled teeth. Clothes as separate meshes on the same
   skeleton: shirt (torn hem, open collar), trousers, a hoodie, a dress, a
   suit jacket, a work coat. Per-zombie variety = which clothing meshes are
   on + a vertex-colour/tint per piece (shirt colour, skin tone, blood
   amount) + a scale jitter. 6-8 looks from one GLB.
3. Variants (ZOMBIE_TYPES):
   - walker (most): shambles, speedForRound as now.
   - runner (from ~round 5, 25%): sprint, lower HP (x0.8).
   - **leaper** (from ~round 8, rare, max 2 alive): gaunt body variant with
     arms ~25% longer and hooked claw hands; at 4-7 m with line of sight it
     crouches 0.4 s then leaps (a ballistic arc, ~1.2 m up) and swipes on
     landing; a clear wind-up sound so it's fair.
   - Keep ONE troll easter egg: a rare zombie in a trollface mask (the
     mascot artwork on a rubber mask mesh), never the Unicode emoji.
     **Ask the user** if they want this or zero trollfaces on zombies.
4. Hitboxes: keep the same named hitbox set, parented to the matching bones
   (same sizes as today), so game.js's damage/headshot code is untouched.
   The dissolve-on-death shader (makeEnemyDissolveMaterial) must be applied
   to the skinned materials (onBeforeCompile on MeshStandardMaterial, or
   swap to a quick fade + sink into the ground).
5. Gore-lite feedback: a blood decal/puff on hit (impactFx "zombie" surface
   exists), a head-pop on headshot kills (hide the head mesh + burst).
6. Audio: groans per variant (pitch-shifted), a leaper shriek on wind-up.
7. Performance: MAX_ALIVE 12 skinned meshes is fine; one shared geometry and
   one material set (clone only the tint uniforms), no per-zombie textures.
   Measure with tools/troll-ops-map-fps.mjs on Hollowgrin zombies at round 10.
8. Tests: the scratchpad zombie sim (see session 25 notes: zloft.mjs) for
   routing, plus a hitbox test (headshot on a walking zombie lands as a
   head hit), screenshots up close at night on Hollowgrin and the Pentagrin.
Order: design doc with a Blender turnaround render of the base body + 3
looks -> user OK -> build 1-4 -> 5-6 -> tune. Branch/worktree of its own;
it touches zombies.js, character.js (only if a bone hook is needed),
models/, audio.js.

### Stream B (another session): main menu redesign, BO2 Zombies style
The user wants the Troll Forces menu screen "similar to" a Black Ops 2
Zombies menu:
- A cinematic full-bleed background: a huge planet lit from behind, molten
  cracks, an asteroid field, a warm sunburst.
- The menu as a plain, left-aligned, stacked text list in a condensed sans:
  a section title on top, the hovered item highlighted orange, items in
  small clusters (e.g. PUBLIC MATCH / SOLO PLAY // CUSTOM GAMES / THEATER //
  LEADERBOARDS // OPTIONS / STORE).
- A one-line description of the hovered item under the list.
- The party list top-right ("1 Player (8 Max)" + names).
- "N Online" bottom-left with a Back prompt; button hints bottom-right.

**The globe:** "for the globe we can use the maps that we have" and "remake
the globe to look similar to this ... just as a placeholder for now, so we
can essentially integrate the function of trollrunner.net/maps into here".
So the planet in the menu should BE the troll world map: the MapLibre globe
from trollrunner.net/maps (main repo: maps.html + assets/js/troll-map.js,
MapLibre pinned to v5, OpenFreeMap tiles, troll pins from Supabase
troll_locations), styled dark and molten to look like the BO2 planet, behind
the menu. A placeholder is fine; the user may make art with ChatGPT later.

Rules for that session:
- The approved menu design lives in the Design canvas
  https://claude.ai/artifact/XXhnWGcoA1BfCYvUC49LKa. Re-read it fresh (the
  user edits it), mock the new direction there first (design doc before big
  builds), get the OK, then build in troll-ops.html + style.css (+ a small
  menu module).
- Mind CSP (connect-src/script-src for MapLibre + tiles).
- Keep it light on mobile: the menu runs on phones, and a WebGL globe behind
  it must not tank the game's first load (lazy-load it, pause it when a
  match starts).

### Who does what (user OK'd parallel sessions, 2026-10-02)
- **Session "park"** (the main session): 6c mansion -> 6d mountain + moat ->
  6e coaster. Owns hollowgrin.js buildPark() and models/build_grinmoor.
- **Session "zombies"**: the zombie redesign plan above. zombies.js,
  models/build_zombies.blender.py, audio.js. Doesn't touch hollowgrin.js.
- **Session "chapel"**: church interior FIRST, then the mannequins (the
  priest scene lives in the church). To stay out of the park session's way
  in hollowgrin.js: put the chapel in a NEW module `hollowgrin-chapel.js`
  (export buildChapel(api, K, M, SP, root, lights); move the CHAPEL block out
  of buildOutskirts into it, keep its colliders/doors where they are unless
  the design says otherwise) and the figures in `hollowgrin-mannequins.js`
  (export placeMannequins(...)); hollowgrin.js only gets the import + one
  call line each. Blender: models/build_chapel.blender.py,
  models/build_mannequins.blender.py (hg-chapel*.glb, mq-*.glb).
  Kit/place/jack/etc. live in hollowgrin.js: export what the new modules
  need (named exports; ES module cycles are fine for functions/classes used
  at build time).
- **Session "menu"**: Stream B below.

### Splitting work (all sessions)
- Each session: `git worktree add ../to-<name>-wt -b <branch>` (or the
  desktop app's worktree option). Never work in the shared main checkout in
  parallel.
- Before pushing: `git fetch && git rebase origin/main`, run the tests for
  what you touched, commit only your own files.
- Shared files to coordinate: HANDOFF.md (add your own RESUME section, don't
  rewrite the other's), troll-ops.html (the game.js ?v= tag: if both changed
  it, bump to a fresh unique tag on rebase), and game.js's import ?v= tags.

## (previous) RESUME HERE (2026-10-02, session 25) — phase 6a SHIPPED, next 6b
User OK'd design doc rev 2 (all defaults: 36 m strip, park spawn pair per
team, wade moat, keep 4 high spots, "Grinmoor Fair", barn loft / scare
sting / moving rides yes): https://claude.ai/artifact/92dGJceNRbWv5zViUnxocN
**6a SHIPPED** (commit 556a057, `game.js?v=to-hg6a`, every ?v=rl1 -> hg6a,
surface-textures.js now tagged ?v=hg6a everywhere, zombies.js?v=to-hg6a):
- models/build_hollowgrin.blender.py (`-- mausoleum barn shop`) ->
  hg-mausoleum/hg-barn/hg-candyshop.glb in MAP coords over unchanged
  colliders (walls/solids now pass no mat). Its Wall class mirrors
  hollowgrin.js wall() (holes, battens, lap boards, ashlar joints, casings).
  hollowgrin.js hgModel(api, name, { wash, bounce }) loads with no mapping,
  remembers Blender material names, retextures, applies bounce by name.
- RETEXTURE rule may carry a 3rd value = paint mix (surface-textures.js).
  Painted boards (HG_BarnRed, HG_Clapboard) use the PLASTER photo: on the
  dark wood photo the red read black at night.
- nightFx(material): ground fog (GROUND_FOG uniform: strength, base y,
  falloff, per-metre build-up) + optional `userData.wash` {color, top,
  strength} emissive gradient; applied to every material under the map root
  INCLUDING maps.js's ground plane (root.parent) at the end of build, and to
  models as they stream in. Skips additive/Shader/Points. The park's colour
  washes (6b+) go through this.
- lantern()/candleCluster() helpers (emissive + lanternPool glow + spark
  halo, no lights): graveyard gate + 8 graves, hedge garden (8), mausoleum
  steps, barn loft + west door, shop back door. Moon 0xb4c4ff 1.75 from
  [-30,40,-60], hemi 1.25; mausoleum green light 6 -> 4.5.
- Barn loft PLAYABLE: BARN_LOFT x 17.35..20.4, z 20.35..28.65, y 2.4; stair
  climbs WEST along the south wall (stairs(24.4, 27.7, ..., "-x")), landing
  x 20.4..21.04, rail along x 20.36 for z < 27.1; west door now 2.2 tall,
  loft window c 22 [3.0, 4.25]. Zombies: HG_FLOORS.loft, hgFloorOf(y, x, z)
  (barn rect + y>=1.6 -> loft), link a (25.3, 27.7) b (19.6, 27.7).
  **Gotchas found**: (1) a link entry within 1.3 m of a wall lets zombies
  OUTSIDE the wall start "climbing" into it; (2) with 2+ links zombies took
  the nearest stair, not one toward the player's floor -> fixed with
  ZombieDirector.nextFloor (BFS over links); (3) within 2.5 m zombies beeline
  and walked into a rail beside the stair -> they now keep the field while
  |dy| >= 0.25, and the stair no longer runs beside a rail.
- Tests: audit all PvP maps PASS (hollowgrin 543 colliders); map-walk
  hollowgrin ALL PASS (new: loft stair, loft rail, barn west door,
  mausoleum); zombie sim (scratchpad zloft.mjs, throwaway): loft 23 s,
  manor upstairs 26 s, loft-from-manor 26 s, ground 13 s; Pentagrin
  unchanged. fps (15 s settle, warm): old 36-39, new 29-40, draws +45 (the
  first 7 s of tools/troll-ops-map-fps.mjs read low while GLBs stream in).
- Preview ui/maps/hollowgrin.jpg re-rendered.

**Next: 6b** park shell + plaza: BOUNDS maxX 51 -> 87, east field-stone
wall -> painted park fence, main gate opposite the carousel (z 0..4), plaza
~(60, 0) + pumpkin fountain, Ferris wheel moved to ~(79, 0) with base +
6 m deck, stall row on the plaza's north edge, carousel Blender model,
woods/zombie walk-ins moved to the new edge, park spawn pair per team.
Then 6c mansion, 6d skull mountain + moat, 6e coaster + drop tower, 6f
tuning.

**New user request (2026-10-02, not started, not yet ordered): redesign the
zombies "like actual zombies"** (reference: a Resident Evil-style rotting
zombie, image NOT saved, see the newer section: grey-green decayed skin, milky white eyes, torn
lips/teeth, blood-stained torn shirt). Design doc first (models via
Blender/PixelLab?, variants, animation, keep hitboxes in zombies.js).


## (previous) RESUME HERE (2026-10-02, session 25) — design doc rev 2 (approved)
The user answered the phase 6 questions (new district, village untouched;
all four rides; Halloween night; the proposed order for the rest of their
list), then sent 3 inspiration photos (scratchpad park-refs/1-3.webp, NOT
shipped): a white antebellum haunted mansion with green cast-iron lace
galleries + giant pumpkin-head scarecrow; a skull-topped log-flume mountain
at night with blue/green/red colour washes and a lantern-lined waterway;
a vine-wrapped pumpkin fountain in front of a teal steel coaster + drop
tower. They said "replan the plan ... take your time". Design doc rev 2:
https://claude.ai/artifact/92dGJceNRbWv5zViUnxocN (scratchpad source
hollowgrin-phase6.html). The plan: bounds maxX 51 -> 87 (138 x 90 m). Main
gate opposite the carousel -> round plaza ~(60, 0) with the PUMPKIN FOUNTAIN
(bronze troll with lantern on top) -> Ferris wheel MOVED to ~(79, 0) behind
it (base + 6 m deck). Stalls row on the plaza's north edge. North: "The
Grinder" now a STEEL coaster (teal track, tan supports, loop + corkscrew;
station ~(62, -18); 9 m brake deck via lift-hill stair; train runs ~40 s;
drop tower NE, art). South: "U Mad Mansion" (photo-1 mansion: iron-lace
porches = alpha panels, playable upper balcony, 7 m trollface-pumpkin
scarecrow, brick planter + queue rail; interior walk-through: stretching
portraits, endless hall, ghost ballroom, mirror maze, pet-cemetery exit) on
an island ringed by the flume WATERWAY (wade; 3 footbridges; lane enters
over one). SE: SKULL MOUNTAIN (~15 m, trollface skull with red eyes, flume
drop into a splash pool at ~(66, 40), cave flank path, 5 m ledge; logs
animated). Night look = a "colour wash" shader chunk (emissive gradient
fading with height) per material instead of real lights; real lights <= 14.
No real-park branding (no Disney/Knott's names, no Jack/Sandy Claws
costume). Order: 6a village models (mausoleum, barn, candy shop) + light +
the wash shader, 6b park shell + plaza + fountain + wheel + stalls +
carousel model, 6c mansion, 6d mountain + moat, 6e coaster + drop tower, 6f
spawns/bots/zombies/tuning. **Open decisions** (defaults): 36 m strip
[yes], park spawn pair per team [yes], moat [wade], 4 high spots [keep],
name [Grinmoor Fair], barn loft / scare sting / moving rides [yes]. Get the
OK, then 6a.

## RESUME HERE (2026-10-02, session 24, realism pass)
User (after phase 5): "i want all objects in all maps to looks more realistic.
so go do that finish that then we move to phase 6", then "you know how we
turned those trees to be more realistic, well i image theres other objects.
walls buildings etc." **Realism pass SHIPPED** (below, live as
`game.js?v=to-rl1`, commits 120f90b + e1b319e). Shots were sent; the user
hasn't commented on them yet.

**Next: phase 6 (Hollowgrin models)** with the user's amusement-park ask
folded in. Questions put to the user, NOT yet answered (get answers, then
write the design doc, get the OK, then build):
1. The park: a new district bolted onto Hollowgrin, or replacing part of
   the village?
2. Rides: proposed default = Ferris wheel, carousel, haunted funhouse, game
   stalls, a climbable coaster track (not a working coaster).
3. Keep it Halloween-night themed like the rest of Hollowgrin?
Phase 6's own scope (design doc): real models for the mausoleum, barn and
shop; moonlight + ground fog; dark corners lit by decor (lanterns,
candles, glowing pumpkins), not global light; zombie paths unchanged.

**After phase 6, the user's other list** (the "(previous) RESUME HERE
... later" section below, items 1-9, with the Trollernaut / knight /
metamorph references): tablet streak animation, bus-deploy camera shots,
Pointstreaks + Trollernaut, TDM/S&D intros, animated skins, "For You"
emote, three characters + L4D-style zombies mode. My proposed order (not
yet confirmed by the user): quick polish (tablet, animated skins) ->
Trollernaut -> cinematics (bus deploy, match intros, For You) -> the L4D
mode (design doc first). Item 8 (VTOL gun swap on mobile) is done.

Remaining realism gaps if the user wants more: Pentagrin's props.js
pieces (lab benches, desks, cabinets) are still simple boxes; Depot
wrapped pallets/boxes are plain; Hollowgrin is phase 6. Known pre-existing:
pentagrin's map audit FAILs on 4 unused spawns (zombies use windows).

## Realism pass SHIPPED (2026-10-02) — `game.js?v=to-rl1`; maps/loadout/map-models/map-dressing/house-props/pentagrin/grinleria/hollowgrin/trollface-island all `?v=rl1`
Every collider unchanged (audit PASS on all maps, same counts; pentagrin's
audit FAILs on 4 unused `spawns` exactly as before the pass: zombies use
the windows). The look moved into Blender models / JS meshes over ghosts:
- **Grin Beach** (models/build_grinbeach.blender.py, now buildable by name:
  `-- shops towers beach bluffs boardwalk pier foodtruck`, quantized):
  gb-shops (stucco per shop GS_StuccoA-D, storefront glass + mullions,
  pilasters, striped awnings with scalloped valances, roof fascia, sign
  frames; interiors stocked by theme: SURF SHACK boards, TROLL TACOS
  griddle, ICE SCREAM freezer + giant cone, 1UP ARCADE cabinets; AC units
  and meters out back), gb-towers (braced stilts, red lap siding, LIFEGUARD
  board, buoy, flag, stair stringers + rails), gb-beach (umbrellas with
  ribs/valances + loungers, cast fire rings with ash and charred logs, the
  JS embers sit in them, driftwood, a real net, precast seawall with weed),
  gb-bluffs (sandstone bluffs close both ends and run into the sea; the back
  wall is painted with pilasters; `beachMural` canvas GRIN BEACH mural),
  gb-boardwalk (gapped boards GS_Deck, fascia, posts, baluster rail, steps).
  Shop sign lettering = `shopSignMaterial` canvases. Fire glow is a bare
  PointLight (api.lamp drew a bulb). Sign lamps moved up over the boards
  (they blew the awnings out white).
- **Cul-de-Grin houses** rebuilt: models/build_cg_houses.blender.py writes
  the same house-<variant>[-attic].glb (map kit, GAME coords, door +x):
  lap siding, cased windows + shutters + curtains, open double doors with a
  transom, porch with columns and lamp, shingled gable roof with fascia,
  gutters + downpipes, gable vents + barge boards, exterior brick chimney,
  interior paint, wood floor, skirting, ceiling + light. Attic houses are
  storey-and-a-half (pent roof skirt, sided attic storey with its window,
  the +z sniper opening). The old build_houses.blender.py still makes the
  yard props (toy car, gnome, can, swing, streetlamp, portrait). Baked
  lightmaps deleted (they don't fit). house-props.js uses map-models
  RETEXTURE now. picketFence = merged pickets/rails/posts over a ghost;
  mailbox rounded with a flag; kiddiePool = inflatable tubes + water. Attic
  stair = drawn treads/risers/stringer/handrail over ghost steps; the house
  lamp moved to 2.85 (inside the ceiling it left the ceiling brown).
- **Palms**: map_kit.palm() is a no-op now; palms are JS `palmTrees`
  (spots [x, z, h, baseY]) on Dust Bowl (maps.js PALMS) and the Grinleria
  (from layout solids palmplanter / palmbed). db-*.glb and gl-*.glb rebuilt
  (db-* quantized for the first time).
- **The Grinnery** (models/build_range.blender.py -> gr-range.glb): block
  shell, pilasters, coping, dado band, sandbag backstop, timber firing line
  with plywood bays and baffles under a corrugated steel roof, concrete
  block / sandbag / jersey cover, scaffold platform + grated stair. Distance
  boards + pen-wall labels = `rangeBoardMaterial`. Gravel ground. Dressing:
  brass casings at the line, lane lines, scuffs.
- **Pentagrin**: real surfaces through api options: painted plaster walls
  (new maps.js surf mode `"<set>-paint"`: flat colour + the set's normal
  and roughness, because the plaster photo is tan), lab tile ground,
  polished-concrete war floor, marble boardroom floor, wood panelling,
  desks, counters, crates; suspended-ceiling tile planes under every slab.
- fps (meadow-style first view, warm): culdegrin 44.3, grinbeach 42-43 (was
  42-46; draws 412 -> ~570), dustbowl 41-55, grinleria 43.8.
- tools/troll-ops-map-shots.mjs: `MODE=view` (owner stub + View mode) and
  `cache-control: no-store` (Chrome served stale modules between pages).

## (previous) RESUME HERE (2026-10-02, session 24, later)
Phase 4 got the user's OK ("continue"). **Phase 5 (PvP second pass) SHIPPED**
(section below): show the shots, get the OK at the gate, then phase 6
(Hollowgrin models). **The user's new list (2026-10-02)**, not started, to
be ordered with the user (design doc first for the big ones):
1. Hollowgrin: expand/modify it to have an amusement park (fold into phase 6?).
2. Tablet scorestreaks: more animation, e.g. the right hand presses confirm;
   the tablet must never say "boarding" / "onboarding".
3. Troll Royale bus deploy: really good third-person AND first-person
   shots when players jump off the bus.
4. **Pointstreaks**, a new kind of streak. First one: **Trollernaut**, the
   player turns into a giant troll monster: 10 s invincible, then 3x health
   but 0.75x movement speed.
   Look (user's reference, memedepot image, refs/trollernaut-ref.jpg): a giant, ripped, glossy-white trollface body, a
   diamond-encrusted gauntlet (Infinity-Gauntlet style, sparkling) on the
   right hand, black briefs with a neon-green "U MAD BRO?" waistband and
   green piping. The user ALSO shared a knight (muscular trollface in dark
   plate, blue cape, trollface brooch, a giant RGB keyboard greatsword with a
   trollface pommel) and said "that can be a knight instead": a separate
   knight character/skin, not the Trollernaut.
5. Cinematic intro of both teams at the start of every Team Deathmatch and
   Search & Destroy.
6. Animated weapon skins with effects coming off them (certain skins).
7. **"For You"**: an optional emote on the emote wheel that only works
   while falling from the sky in Troll Royale: the trollface reaches out his
   hand as if romantically saving someone; cinematic shots (face, hand,
   body, background...).
9. **Three characters** (user: "the knight, the trollernaut and this
   character"): the knight (above), the Trollernaut (above), and a
   **metamorphic character**: mid-transformation, the left half Pepe (green,
   screaming open mouth, torn white lab coat, clawed hand), the right half a
   huge glossy chrome-white muscular trollface, a ragged seam between them,
   white wisps, green-black background with a light shaft. For a **Left 4
   Dead-style zombies mode** (the user's idea; design doc first: co-op
   campaign, specials, where the metamorph fits).
   **Roster update (2026-10-03):** the user re-sent the refs and now names
   FOUR characters, plus the Trollernaut as a pointstreak (separate). All in
   `assets/games/troll-ops/refs/` (local only, never committed):
   - **Troll Knight** `knight-ref.jpg`: muscular trollface, dark plate,
     blue cape, trollface brooch, RGB keyboard greatsword over the shoulder,
     trollface pommel on the wrapped grip.
   - **Troll Hunter** `hunter-ref.jpg` (NEW): crouching tribal hunter, ram-
     skull helmet over the trollface, burlap/fur cloak, tattooed pale skin,
     tall spear + bloodied curved knife, a Doge (shiba) companion. Savanna.
   - **Super Troll** `super-troll-ref.jpg` (NEW, "superman style"): blue
     suit, red cape + briefs, yellow belt, red/black "T" diamond chest crest.
   - **Troll Metamorphosis** `metamorph-ref.jpg`: the Pepe/chrome-trollface
     half-and-half described above.
   - **Trollernaut** `trollernaut-ref.jpg` (re-sent 2026-10-03): glossy
     chrome-white ripped body, sparkling diamond gauntlet on the RIGHT hand
     (fist forward), black briefs, neon-green "U MAD BRO?" waistband + green
     piping, misty dark backdrop.
   **Direction (2026-10-03, user):** these characters are for "a funny mod
   game mode", "with funny characters and funny weapons" (Garry's Mod
   energy; existing guns are all realistic, this mode gets the joke ones).
   Brainstorm so far, NOT approved, design doc still to write:
   - Heroes: Knight (keyboard greatsword charge), Hunter (spear + Doge pins
     a target), Super Troll (flight / superhero-landing slam), Metamorph
     (weak fast Pepe, kills fill a meter -> chrome brute). Trollernaut = the
     mode's pointstreak (diamond-gauntlet punches launch people).
   - Weapons pitched: RGB Keyboard Greatsword (insults float up), Rubber
     Chicken, Ban Hammer (fake BANNED death screen), Copium Launcher,
     Ratio Rifle, Doge Cannon, Dial-Up Shotgun, Trollface Boomerang,
     Diamond Gauntlet, and the user's own: **Reverse Uno card** (reflects
     incoming damage/projectiles back at the shooter for a short window).
   - Tone: ragdolls, comic-book kill text, meme sounds, joke killfeed icons.
   - Open: standalone FFA first vs the L4D zombies idea; is the L4D mode a
     funny co-op version of this one?
8b. ~~Grin Beach palms (user: "could use some work, more realistic")~~ DONE
   (`game.js?v=to-pm1`, `maps.js?v=dr2`): map-dressing.js `palmTrees(root,
   spots)`: leaning tapered ringed trunks (vertex colours are LINEAR, keep
   them dark), drooping V-folded fronds with a canvas leaflet texture
   (alphaTest), young upright fronds, coconuts; 3 merged meshes for all six.
   Colliders unchanged (ghost trunk cylinders).
8. ~~BUG: on mobile you can't swap guns in the VTOL Warship~~ FIXED
   (`game.js?v=to-ws1`, `style.css?v=to-ws1`): tap the 25MM / 105MM labels
   on the warship HUD (pointer-events on touch), or tap the swap button.

## Map detail pass phase 5 (PvP second pass) SHIPPED (2026-10-02) — `game.js?v=to-dr1`, `maps.js?v=dr1`, `loadout.js?v=dr1`, `map-dressing.js?v=dr1`
- **map-dressing.js** (new): a map opts in with `dress` (maps.js "dressing"
  section, after the MAPS table); buildMap calls `dressMap(root, colliders,
  map)` after build, so the seeded scatter keeps clear of every collider
  (a collider topping out at the floor counts as floor: `areas` take a
  floor y, e.g. Undergrin's platforms at 1.1), spawns (`spawnPad`) and
  `avoid` rects (house floors, the pier). Decoration only: no colliders.
  - Decals: ONE merged mesh per map off a 4x4 canvas atlas (`DECAL`: crack,
    oil, tyre, scorch, grin, puddle, dirt, leaves, steps, ripples, splat,
    drain, stripe, wrack, streak, tag), tinted by vertex colour+alpha;
    `decals` scatter, `place` exact spots (`wall: yaw` stands one up).
  - Clutter: one InstancedMesh per kind (pebble, rubble, can, bottle, paper,
    plank, rebar, cone, tuft, weed, shrub, jar, basket, cardboard, pallet,
    shell, seaweed, towel, bucket, castle, ball, leafpile, hose, ticket),
    no shadow casting. Thinned by tier through `userData.clutterShare`
    (low 0.4 / medium 0.7 / high 1); game.js applyClutter reads it (the
    island's own clutter keeps CLUTTER_SHARE).
- **Grin Beach**: the ground is the textured sand now (was the grid
  shader); the sea is `beachWaterMaterial` (lit MeshStandard +
  onBeforeCompile: shallow turquoise -> deep blue, 4 travelling-sine wave
  normals faded with distance, a swash foam line washing up to the seawall
  plus broken breakers ~7 m out; uTime set in onBeforeRender). The old
  wet-sand and foam planes are gone. Towels, buckets, sandcastles, balls,
  shells, kelp, dune grass, ripples, footprints, a tideline of wrack, a grin
  drawn in the sand, sand blown onto the boardwalk, lot oil/cracks.
- Grin Site: muck, puddles, tyre tracks, oil under the van/forklift, cracks
  on the slab + L1 deck, a pink sprayed grin on the slab; pebbles, rubble,
  offcuts, rebar, cones, cans, litter, weeds along the hoardings.
  Dust Bowl: dirt, tracks, footprints, riverbed ripples, scorch round the
  wrecked truck, a grin on the centre roof; pebbles, scrub, dry weeds, clay
  jars + baskets in the market, litter. Depot: yellow aisle lines, oil,
  forklift tracks, cracks, drains, a pink grin on the north wall over the
  catwalk; boxes, pallets, litter. Cul-de-Grin: leaf drifts + grass tufts on
  the lawns, leaf piles, hoses, balls; road cracks/oil/tracks/drains, a
  pink chalk grin + paint splat on the road. Undergrin: decals only
  (grime, cracks, puddles on the platforms, oil in the track bed).
- Audit: all six PASS, collider counts unchanged. fps (tools/troll-ops-
  map-fps.mjs; noisy, first map of a run reads low): before grinsite 39.3 /
  dustbowl 43.5 / depot 38.3 / undergrin 43 / culdegrin 41 / grinbeach 42;
  after (best of runs) 42.8 / 45.3 / 39.5 / 39.5 / 44 / 46.3; +5..15 draws.
- Previews re-rendered (ui/maps/*.jpg). tools/troll-ops-map-shots.mjs now
  takes MODE=view (owner stub + View mode: no bots, HUD or gun in shots;
  in ops mode the bots' hits tint every shot red).
- Shot views (scratchpad only): grinbeach sea [0,0,-6 -> 0,0,-40], aerial
  [0,16,14 -> 0,0,-18], walk [-20,0.45,12 -> 0,1,12]; grinsite aerial
  [0,14,30 -> 0,0,0]; dustbowl channel [-25,0,25 -> 10,0,25]; depot aisle
  [-26,0,-5.5 -> 10,0.5,-5.5]; culdegrin road [0,0,26 -> 0,0,6], lawn
  [-27,0,-12 -> -22,0,8].

## (previous) RESUME HERE (2026-10-02, session 24, before phase 5)
Phase 3 got the user's OK ("continue"). **Phase 4 (island landmarks B)
SHIPPED** (section below): show the user the shots, get their OK at the
gate, then **phase 5 = PvP second pass** (per the design doc; Grin Beach
water is in it), then phase 6 (Hollowgrin models).

## Map detail pass phase 4 SHIPPED (2026-10-02) — `game.js?v=to-tf4`, `maps.js?v=tf4`, `loadout.js?v=tf4`, `trollface-island.js?v=tf4`
- build_island.blender.py now builds by name:
  `blender --background --python build_island.blender.py -- cave skate`
  (no names = all 18). New: tf-memelab, tf-observatory, tf-portal,
  tf-skate, tf-cave, tf-dock, tf-tree, tf-boat, tf-market, tf-bridge
  (palette `pal4()`, helpers torus / sheet / arc / crag_box / catenary).
  Every landmark B collider is unchanged (audit: 424 colliders, PASS);
  the JS blocks pass `null` and call mapModel. Dock's model origin is
  (x0, z0) of the jetty, the Bridge's is the deck's middle.
- Reference art (trollface.io world layers, scratchpad only, never
  shipped) drove: Meme Lab = slate ring with cream cuffs, orbs with green
  cores, cyan sparks, the swirl a JS canvas (`swirlTexture`), steel deck
  with hazard edging + underglow; Observatory = grey-blue house, round
  windows, white dome with a dark slit + rails, fat yellow telescope;
  Portal = chunky terracotta gateway, glowing runes, floating pebbles,
  sandstone plateau (door = JS canvas `portalDoorTexture`); Cave = teal
  rounded sides + a faceted heightfield hill (slabs of lumps looked like a
  box), dark lining, crystals, lanterns, sand spilling out, yellow "!"
  sign; Dock = plank jetty on piles, mooring posts, crate, lamp, ladder;
  Old Tree = bonsai trunk + limbs, lumpy crowns, tyre swing; Boat = lofted
  hull with navy boot stripe, cabin, mast/boom, both sails (blue blob on
  the main), rigging, lifelines; Marketplace = wooden stalls, sagging
  cloth canopies with scalloped valances, goods, fairy-light strings,
  banner poles. Skate Bowl and Bridge aren't in the art: coping, graffiti,
  painted funboxes, yellow rails, bleachers, flood lights; plank bridge on
  pile bents with post-and-rail sides and lanterns.
- Island materials no longer used were dropped from `M`.
- fps (meadow view): 41.5 warm-up / 49 — same as after phase 3.
  tf-market.glb is the biggest new file (690 KB, the fairy bulbs).
- Shots: scratchpad only; views memelab [-118,2,-92 -> -127,6,-114], obs
  [92,2,-76 -> 82,7,-100], portal [104,3,-78 -> 122,8,-105], skate aerial
  [131,22,-20 -> 131,0,-60], cave [-2,1,-8 -> -9,3,-32], dock
  [-68,4,-4 -> -95,0,-30], tree [-64,1.5,-36 -> -75,5,-46], boat
  [82,3,32 -> 100,5,16], market [128,2,118 -> 145,2,97], bridge
  [-6,3,92 -> -28,1,78].

## (previous) RESUME HERE (2026-10-02, session 23)
Phase 2 got the user's OK ("proceed"). **Phase 3 (island landmarks A + the
Royale props) SHIPPED** (section below). Also shipped: **View mode**
(owner-only setting, section below).

## Map detail pass phase 3 SHIPPED (2026-10-02) — `game.js?v=to-vm1`, `maps.js?v=tf3`, `trollface-island.js?v=tf3`, `royale-drop.js?v=rp3`, `remote-players.js?v=rp3`
- **models/build_island.blender.py** (Blender 5.2, `--background --python`)
  writes tf-city, tf-cityface, tf-peak, tf-gallery, tf-shop, tf-bus,
  tf-busface, tf-skybox (quantized). Landmarks are authored in their
  LANDMARKS-local coords; trollface-island.js places them with mapModel.
  Their numbers (TOWERS, TIERS, stairs, rooms + doors) are copies of the
  JS colliders: change one, change the other. `GreyKit.add(geo, null)` now
  means collider only, so the landmark blocks keep every collider with a
  `null` material.
- **Troll City**: towers with lit window grids (TF_Window emissive 0.55;
  1.6 bloomed everything white), black corner posts + parapets (the art's
  outlines), lobby storefronts, door frames, roof kit, the yellow tower's
  red-tipped aerial, plaza lamps. **The dome's grin** is build_grinleria's
  build_trollhead carving (white, black cuts) WRAPPED onto the dome: a
  stand-in `GLB.Vector` bends each face-space point round the sphere
  (build_city_face). Width 14.
- **Troll Peak**: flat-painted cartoon facets (the textured purple rock
  read dark grey: surface-textures lerps tints 55% to white), grass/rock/snow
  tops, jagged snow summit, crags, the flag, stone stairs step for step.
- **The Gallery**: glass is JS (the room walls are now M.glass, pyramid
  base on the walls, apex 18); frames, diamond lattice, marble floor,
  plinths + art (golden orb, cube stack, ribbon, easel), Hollowgrin's white
  trollbust on the middle plinth, red ropes on brass posts, 4 spotlights.
- **U Mad Bro Shop**: white walls, red cornice + wing slopes, blue windows +
  awnings, open glass doors, black board with marquee bulbs; the neon
  lettering is a canvas (`neonSignTexture`, once a page). Inside: tile,
  light strips, shelves of merch, counter + register.
- **Royale props** (royale-drop.js): the bus = tf-bus + tf-busface (carved
  grin on the nose) + JS flames, grey bus kept as the fallback; the sky box
  frame/deck rim/hull/anti-grav ring = tf-skybox (glass + roof face still
  JS); models preload in the RoyaleDrop constructor; `disposeOwn` leaves
  the loader's shared geometry alone. **The paraglider was redone in JS**
  (user: "could be better designed"): airfoil cells with seams, green tips,
  black nose, cascaded A/B/C lines to two risers, and the trollface PRINTED
  on the curved canopy (UV skins on the top, head to the nose, and the
  underside, head to the tail so it's upright to the rider). 3 draws a
  glider (was 5).
- Tests: map audit trollface PASS; royale-drop test all pass; view-mode
  test all pass. fps (meadow view, 3 runs): 40.5 (warm-up) / 50.5 / 49.3 vs
  ~54 before: a small cost (city face 38k verts, window boxes). If it
  matters: lower build_city_face res (190 -> 120) first.
- Shots: scratchpad only; re-shoot views city [-36,0,-48 -> -36,9,-87],
  peak [56,0,-2 -> 57,14,-43], gallery [-99,0,76 -> -99,6,45], shop
  [38.6,0,99 -> 38.6,6,78].

## View mode (user, 2026-10-02) — owner only
"only for troll_runner, create a settings feature called View mode. where
this is only to view the maps. no fighting." Lobby Settings row
`#to-set-viewmode-lobby` (hidden unless the cached profile's username is
troll_runner, re-checked on auth-changed); `settings.viewMode`. On, Deploy
swaps in the hidden mode `view` (modes.js) on the lobby's map: offline, no
spawner/bots/streaks, HUD hidden, no viewmodel, no firing/ADS, keys only
fly (`flyView`: WASD where you look, Space up, C/Ctrl down, Shift x3.5),
no gravity or collisions. Quit restores the lobby's mode (`viewPrevMode`).
The gate is client-side only (it's a viewer, nothing to protect).
Test: tools/troll-ops-view-mode-test.mjs (11 checks).

## (previous) RESUME HERE (2026-10-01, session 22): the queue, in the user's order
1. ~~Hollowgrin expansion~~: SHIPPED this session (below).
2. ~~Bot scorestreaks phases 2 + 3~~: SHIPPED this session (below).
3. **Map detail pass** (design doc link in the session 19 section): six
   phases. Phase 1 (atmosphere) SHIPPED. Phase 2 (Trollface Island
   ground) SHIPPED 2026-10-01 night (below). **RESUME HERE (next session):
   show the user phase 2 (before/after shots + the fps numbers below) and
   get their OK at the gate, then phase 3 = island landmarks A (Troll
   City, Troll Peak, the Gallery, U Mad Bro Shop; Blender glbs over the
   existing colliders; royale props bus/glider/glass box folded in).**
3b. ~~Custom guns (user, 2026-10-01)~~: SHIPPED (below): THE BEAST, the
   Hyuck Colt LMG and the Ghost Glass finish. The user then said: "after
   doing these guns then work on the rest of the tasks", so next is the
   fix list (4), then the map pass phases 2+ (phase 2 still wants the
   user's OK at the design's gate).
4. **The user's fix list (2026-10-01)**, status:
   - ~~Emote hands duplicate~~ DONE: first-person emotes hide the gun's arms
     (pfArms / gloveRig) when the gun is put away; the glove has its own
     "point" pose (glove-model.js GLOVE_POSES.point, thumb folded in; the
     white hand's values stuck it out like an L, user caught it).
   - ~~Dragonfire~~ DONE: forward flies where you look past a +-0.2 rad
     level band (DF_LEVEL_BAND, player only, bots fly by altitude); climb /
     dive hint on the feed (.to-df-keys); its own airframe hidden from its
     camera (the gun and arms hung across the view); aim assist while
     shooting or aiming (applyAimAssist with DF cone 10 deg, range 90, 0.7
     pull; a constant pull steered it into walls) + shot magnetism (3 deg).
     Test: tools/troll-ops-dragonfire-test.mjs.
   - ~~Guest progress~~ DONE: progression.js keeps guest XP in memory only
     (isSignedIn = cached profile OR a stored 'trollrunner-accounts-auth'
     session); old 'trollops:xp' guest total removed on load and no longer
     credited on sign-in; achievements not saved for guests.
     Test: tools/troll-ops-guest-progress-test.mjs.
   - ~~VSAT for all teammates~~ CHECKED, already true: vsatUntil is per
     team, published to peers, every teammate's minimap reads it; bot VSATs
     reach their human team too. Bots don't need it (they always path to
     the nearest enemy, seen or not).
   - Undergrin "stuck in place": the literal bug is FIXED (spawns were put
     at y 0 inside the 1.1 m platforms and pushed out past the end wall;
     loadMap now stands every spawn on the floor under it). EXPANDED too
     (user chose "expand it", `game.js?v=to-ug1`, `maps.js?v=ug1`):
     maps.js undergrinExpansion() + build_undergrin.blender.py
     build_expansion (ug-expansion.glb) and the cut-open ug-station.glb:
       * staff doors in both side walls at z -3.5 and 11.7 (2 m, platform
         height) into service corridors x +-(13..17.5), floor 1.1;
       * steps down at both corridor ends into cross passages z +-(32..38)
         at track level; the tunnel mouths are open, so each end is a loop;
       * a ticket hall over the station (floor 7 = the old ceiling slab,
         walls to 10.6) up an 11-step stair along the end wall of each
         mezzanine, a railed light well (x +-1.6, z +-5) onto the train,
         gate lines, ticket offices, machines, columns, trollface murals;
       * 6 more real lights (2 hall, 1 per corridor, 1 per passage); fps
         within noise of before; bounds now x +-18.5, z +-39;
       * spawns can be [x, z, floorY]; bots never take upstairs spawns
         (botSpawn -> spawnForTeam groundOnly) since they path on one
         ground-level flow field and can't reach the hall (known limit,
         same as other multi-level maps).
     Walks: 7 new undergrin runs in tools/troll-ops-map-walk.mjs, all pass.
     A 60 s bot match: bots use corridors and passages, none stuck.
   Known stale test: tools/troll-ops-cuav-cooldown-test.mjs fails the same
   2 checks on the pushed build (gunship cooldown now 60 s; pad emote wheel
   stick), not caused by this session.
   The old smaller TODOs (Halloween skin, flamethrower, Grinleria leftovers,
   cosmetic slots, royale art) and the backlog (audio/dialogue, purge XP,
   $TRUTHS tournaments, park map) are ON HOLD until the user says otherwise.

Note: the user asked to "compact the session after each task until task 3
is done". Claude can't run /compact itself; the session compacts on its own
and this file carries everything across.

## Map detail pass phase 2 (Trollface Island ground) SHIPPED (2026-10-01) — `game.js?v=to-tf2`, `maps.js?v=tf2`, `trollface-island.js?v=tf2`
All in trollface-island.js (groundMask, groundMaterial, dressIsland):
- **Ground**: one shader on the island top. A mask baked at build time
  (2 m/texel over BOUNDS: R sand = coast + lake shore + the portal/old-tree
  patches, G packed earth = the ROADS + worn rings round each landmark,
  B rock outcrops from value noise, A colour noise) blends grass / sand /
  dirt / rock textures sampled in world space; sand, dirt and rock are
  only sampled where their weight > 0 (most pixels: 2 reads). The old
  road ribbons, beach ribbon and sandy patches are gone (the mask draws
  them). Cliffs: rock texture (extrude side UVs are metres). Plazas:
  "cast" texture with world UVs.
- **Trees**: broadleaf (3 lumpy icosahedron crowns) or pine (3 cones),
  per-tree tint via vertex colours so they still merge into one mesh.
  **Boulders**: textured, lumpy, 2 small stones at the foot.
- **Clutter** (instanced, no colliders, Lambert): 360 bushes (round the
  tree clumps), 1800 grass tufts (2 crossed alpha-tested planes), ~670
  flowers in drifts. game.js applyClutter() sets InstancedMesh.count from
  userData.clutter x CLUTTER_SHARE {low .15, medium .35, high .55}, on
  map load and every applyGraphics.
- **Paddocks** (2, fenced, a gate gap, colliders), **10 signposts** (canvas
  atlas of landmark names, arrow-tipped board pointing at the landmark,
  on the nearest road point), **3 billboards** facing the roads (key art,
  sad trollface; 2 placed, the third had no room), **grin graffiti**
  decals on 4 plazas.
- **fps** (tools/troll-ops-map-fps.mjs trollface, new "meadow" view in
  tools/troll-ops-map-views.json; very noisy, 3-5 runs each): old ~44-49.
  New with clutter off ~50; with full clutter ~40, so the clutter was the
  cost: now Lambert + 55% on high. At 75% it read ~44 vs ~50 old, so 55%
  should be about even. **Re-measured 2026-10-02 at 55%** (meadow view, 3
  runs each, alternating, old = ee11954^ in a worktree): new 53.8 / 57.0 /
  50.8 (avg ~54) vs old 55.5 / 48.5 / 51.5 (avg ~52): even, no change
  needed. Draws 164-178 vs 163-176.
- Shots: before/after were rendered to the scratchpad only; re-shoot with
  tools/troll-ops-map-shots.mjs (views: aerial [-10,30,10 -> -36,0,-60],
  meadow [-50,0,-20 -> -36,3,-70], billboards at (53.3,-131.9) and
  (116.3,61) seen from the road side).

## Custom guns SHIPPED (2026-10-01, session 22) — `game.js?v=to-cg1`, changed modules `?v=cg1`
- **THE BEAST** (`beast`, assault, rank 25): the user's two references
  combined: structure from a modern AK/AR hybrid (flattop upper, angular
  lower + flared magwell, long faceted handguard sweeping into a toothed
  blade, A-frame front sight, slotted hider, tactical stock), style from
  PF's modded "THE BEAST" (bone/ivory over dark olive-steel, a mane of
  bone + crystal spikes off the upper round a glowing core, glowing veins,
  grip talons, comb teeth). The user asked for the gun itself to look like
  a beast: a faceted **dragon head** on the front (horns, angry brow,
  big glowing slit-pupil eyes, fanged open jaws, the barrel out of its
  mouth). User feedback on the way: spikes were too big (halved), "better".
  Nothing rises into the iron/optic sight line. 44k tris.
- **Hyuck Colt LMG** (`coltlmg`, LMG, rank 22): M16-pattern LMG, flattop
  rail, square ribbed handguard, heavy barrel, A2 front sight, birdcage,
  A2 stock, 100-round drum. 28k tris.
- Both are Blender builds (models/build_beast.blender.py,
  build_coltlmg.blender.py; shared helpers in models/gunkit.py, lifted from
  the Grinmington builder) loaded by ONE generic path in weapon-model.js:
  `DETAILED` table + `buildDetailed` (P_Body, P_Mag with the mag point as
  its pivot, P_IronRear/Front, a muzzle device, P_* empties). Add the next
  detailed rifle as a table entry. Glow materials breathe (onBeforeRender).
- **Ghost Glass finish** (skins.js `FINISHES`): a new skin kind that ANY
  gun can wear (the picker now shows on every gun: Factory + finishes,
  plus the banner skins on the 416). weapon-model.js `applyFinish`: clear
  glass, white edge lines (EdgesGeometry, cached per shared geometry),
  small hardware frosted white; hands/glows/lenses/beams untouched. Goes
  over the wire like any skin id. Thumb: tools/troll-ops-finish-thumbs.mjs.
- Test: tools/troll-ops-custom-guns-test.mjs (both models load with mag +
  both arm anchors, reload pulls the mag and returns it, glass on the Colt
  and the 416, no page errors; all pass).
- Cache tags: every module whose import lines changed was bumped to cg1,
  cascaded to a fixed point (bots, royale-drop, scorestreaks too).

## Map detail pass phase 1 (atmosphere) SHIPPED (2026-10-01, session 22) — `game.js?v=to-atm1`, `maps.js`/`loadout.js`/`hollowgrin.js`/`grinleria.js`/`trollface-island.js` all `?v=atm1`
- New sky shader (game.js `skyMat`): gradient + horizon haze + sun disc and
  glow at the sun light's direction + drifting fbm clouds (octaves by
  graphics tier, none on low; fbm normalised so coverage means the same on
  every tier). Per map in `sky`: `sun` (glow strength, 0/absent = no
  disc), `sunSize`, `sunColor`, `haze`, `clouds` (0..1), `cloudColor`,
  `cloudShade`; per map `exposure` (default 1.5).
- **Dust Bowl is a sunset** (user's call): sun at [90,17,34], violet->orange
  sky, cool lavender hemi as the shadow fill (brown fill looked muddy).
  Grin Site: real blue day + clouds (the murky green is gone). Cul-de-Grin
  golden hour kept, pink clouds. Grin Beach afternoon, sun over the water.
  Grinnery overcast. Grinleria day (seen through the dome). Island: hard
  sun in space, no cloud. Hollowgrin: no disc (moon mesh), thin dark
  cloud. Undergrin/Depot unchanged (no sky).
- fps: same draw counts, readings within run-to-run noise vs the shipped
  build (2 runs each, grinsite/dustbowl/culdegrin). Previews re-rendered.
- Grin Beach water is NOT improved yet (still the plain MeshStandard
  plane); it belongs to the beach phase.

## Bot scorestreaks phases 2 + 3 SHIPPED (2026-10-01, session 22) — `game.js?v=to-bs2`
Every streak is now in `BOT_STREAK_POOL` (game.js), so any bot can roll
any of them:
- **Care Package**: the bot lobs the marker ahead (same MarkerCanister as a
  player); on the bot host the crate is `owned` but carries `botId`, and
  its side is the bot's. `botObjective` walks the bot to its crate,
  `updateBotCrate` runs the owner's 0.8 s capture, and the reward streak
  goes into the bot's ready list (one bots can't call becomes a random one
  they can). A crate crushing someone is the bot's kill and spares its side.
  The host player now steals an enemy bot's crate on the steal clock (3.5 s)
  and sees "Steal", not their own 0.8 s (`packageCaptureTime`).
- **Lightning Strike**: `noteBotSightings` keeps each side's sightings
  (bots' `lastSeen`) for 25 s; `botStrikeSpots` picks up to 3 densest
  clusters, 9 m apart, none on a friend. A bot holds the strike until its
  side has seen someone. Damage goes through `areaDamage(..., { botId })`, so
  kills read "<bot> Lightning Strike -> victim".
- **VTOL Warship**: the bot stands still (`bot.gunning`, `botBusy`) and
  `botWarshipGunner` works the guns: nearest enemy in the clear from the gun
  deck, 25MM in ~1.2 s bursts, a 105MM shell when two are bunched (4 s
  apart), aim error by skill. The bot dying sends the ship home. One bot
  warship a match (`botWarshipMatch`), and it counts toward the air cap.
- **Callouts**: a friendly bot's call is a quiet one-line banner now; an
  enemy's keeps the big red one (the callout message carries `team`).
- Test: `tools/troll-ops-bot-streaks2-test.mjs` (9 checks, all pass); the
  phase 1 test and the streak-control test still pass.
- Not done: bots don't react to an enemy UAV beyond the minimap.

## Hollowgrin expansion SHIPPED (2026-10-01, session 22) — `game.js?v=to-hg2`, `maps.js?v=hg2`, `hollowgrin.js?v=hg2`, `loadout.js?v=hg2`
The map is twice the area (72 x 64 -> 102 x 90 m, `BOUNDS` -51..51 x
-45..45). The old village is untouched in the middle; everything new is in
`buildOutskirts()` (hollowgrin.js), built through the same Kit so it merges by
material. Districts and where they are:
- **Graveyard west gate** (x -35.6, pillars at z 0.1 / 3.9) -> dirt path ->
  **St. Grinsworth's chapel** (x -49.5..-39, z -3..7): east door z 2, a
  breach in the south wall (x -45..-42.2), half the roof gone (bare
  rafters), bell tower over the east gable, a dais, altar, candles, pews
  (south side smashed), the trollface **rose window** on both faces of the
  west wall, violet light, wisps. **Churchyard** south of it with 2 open
  graves (zombie rise points).
- **Witch's hollow** (NW): the pond (wade), mud bank, reeds, lily pads,
  **Pepe on the big lily pad** (-47.5, -19.3) facing east (easter egg 1), a
  thatched hut (doors S and E, glowing potion shelves), a bubbling cauldron
  (green glow, no real light), a toadstool fairy ring (rise point), dead
  trees, wisps, fireflies. Paths from the hedge garden's west gap and pond ->
  hut.
- **Glasshouse** behind the manor (x -9..9, z -43..-34): glass colliders
  (pen 0.6) with doors S x +-6.5, N x 0, E/W z -38.5; brick knee wall, iron
  mullions, ~25% panes smashed, raised beds of glowing plants, string lights
  under the ridge. Paths from the manor's back doors.
- **Grinmoor Fair** (E, midway x 39.2): "GRINMOOR FAIR" arch on a new path
  at z 4.1 from the east road; **carousel** (44.5, -4) that turns (8 horses
  bobbing, 4 pumpkin coaches, platform colliders 0.3 high); **Whack-a-Troll**
  (troll heads popping) and **Ring Toss** booths; candy-apple cart; ticket
  booth with the **"Dark Planetoid" poster** on its north face (easter egg
  2); "TEST YOUR LULZ" high striker; Madame Lulz's fortune tent (crystal
  ball); string lights zig-zagging on poles; the **Ferris wheel** (60, 2)
  past the wall, turning, cabins kept upright, art only.
- **Trick-or-Treat Lane** (z 33.4..36.6, the south edge): 6 closed houses
  (lit/dark windows, porches, picket fences; decor rotates: porch ghosts,
  foam tombstones, a giant roof spider), string lights on the north verge,
  gas lamps. **The Troll House** (x -6..6) is enterable: both paintings in
  gold frames on the back wall (poster at x -3.15, meme gallery at +3.15)
  with picture lamps, fireplace, sofa, armchairs, bookcase, "U MAD?"
  doormat. **Meme Gallery** front yard: hg-trollbust + hg-pepe on black
  plinths, purple discs and glow, "MEME GALLERY" banners on the fence.
- **Creek + covered Troll Bridge** (SW): water ribbon + mud banks (wade),
  stones and reeds, bridge deck x -40.4..-34.4 0.54 high with 0.18/0.36
  steps, barn-red walls, roof, "TROLL BRIDGE" signs, "TOLL: 1 LULZ" post,
  and a **trollface peeking out from under the deck** (north edge).
- **Atmosphere**: one-layer scrolling ground mist (graveyard, corn/patch,
  pond, hollow, creek, churchyard), fireflies, wisps, bulb halos, halos on
  every gas lamp and the porch lanterns; fog 0.019 -> 0.016.
- **Spawns**: 6 north edge + 6 on the lane. **Zombies**: new woods walk-ins
  all round the new edge, rise points at the churchyard graves, fairy ring,
  glasshouse aisle, pond. `HOLLOWGRIN.wade = wadePolygon()`.

**Perf (important if you add more):** the first build ran at a THIRD of the
old fps. Causes, measured: (1) 7 extra real point lights (every lit pixel
pays per light), (2) the two-layer double-sided mist, (3) the 150-tree woods
casting shadows. Fixed: only 3 new real lights (chapel, carousel, Troll
House: 12 total), one mist layer, glass is MeshBasic, woods don't cast
shadows. Warm readings now match the old map within ~10-30% per view (some
views faster). Profiler/test scripts were throwaway; to re-measure, measure
each view TWICE (the first view always reads low: shader warm-up).

**Zombies note (not caused by this map):** with staging played out normally,
BOTH the old and new Hollowgrin show multi-second long tasks during a
zombies round in headless Chrome, almost all `getProgramInfoLog` (shader
compiles mid-round). Worth a look some day (warm zombie/drop materials in
warmShaders?), on a real GPU it may be far smaller.

**Tests run (all pass):** map audit (522 colliders, no traps/blocked
spawns), map walk (8 new hollowgrin runs in tools/troll-ops-map-walk.mjs:
chapel door + breach, glasshouse S/W doors, hut door, bridge, Troll House,
carousel), a 60 s bot TDM (bots roam, fight, none stuck 20 s), a zombies
round (spawn, reach the player). Preview `ui/maps/hollowgrin.jpg` re-rendered
from a wider view (tools/troll-ops-map-previews.mjs).

Not done / ideas: the chapel's bell doesn't swing; the Ferris wheel and
carousel have no sound; bots rarely visit the far districts (fair, chapel)
in a 60 s match since spawns are N/S, which is fine but could use objective
points out there.

## New map: The Grinleria (2026-10-01, session 21) — `game.js?v=to-gl1`, `style.css?v=to-gl1`, `maps.js?v=gl1`
Branch `claude/bold-shannon-0h5uzi` (cloud session; not merged). User asks,
in order: "troll forces map idea: the Galleria mall in Houston with various
restaurants and shopping spots", "think deeply and take your time",
"make the map twice as big" (read as twice the AREA: 80x56 -> 112x80 m;
ask if they meant twice each side), "a trollface sculpture with a nearby
waterfall and some flora, blend the trollface nicely".
- **Layout** (`grinleria-layout.js`, no imports): ONE source of truth.
  `grinleriaLayout()` returns `solids` ({k, x, z, w, d, h, y, pen, f}),
  escalators, lights, spawns. grinleria.js turns every solid into a ghost
  collider; `node tools/troll-ops-grinleria-layout.mjs` dumps it to
  `models/grinleria-layout.json`, and `models/build_grinleria.blender.py`
  draws a model for each solid BY KIND (`PROPS` dispatch; `_kinds` are
  drawn by their parent). Change the layout, re-dump, re-run Blender.
  180° rotationally symmetric (team halves), each half dressed as
  different shops via `alt` kinds (`S2()`).
- **What's in it**: ice rink (painted ice canvas, trollface at centre ice,
  the Trollboni zamboni, nets, boards with ads) under a glass barrel vault;
  4 escalators (atrium ends) up to the end decks; upper concourses round the
  vault + a mid bridge; 20 parody shopfronts (10 open with interiors:
  Trolliffany, Trapple, GameStonk, Troll Locker, H-Town Threads, Sephtroll,
  Grand Lulz Cafe (2 units), Cheesecake Trollery, Brick Problem, Hot
  Trollpic, Lulzlemon, Build-A-Troll, Trollbucks Reserve; closed ones show a
  window display); service corridors behind both shop rows (stock-room
  doors, fire exits, doors into the wings); west wing Neiman Narcus
  (beauty island, racks, runways, fitting rooms, shoe salon); east wing food
  court (6 stalls with kitchens you can hop into, skylight); outside north
  the Westheimer valet drive (canopies, palms, monument sign), outside south
  the garage's ground level; Houston skyline incl. Williams Tower beyond
  the bounds (`viewFar` 420, fog 0.0026). Spawns: 4 per wing + 1 outside
  each street door, split W/E.
- **Trollface Falls** (food court centrepiece, replaced the tiered
  fountain): `build_trollhead()` reads `images/wallpaper/trollface
  transparent.png`, makes the outline a rounded solid (distance-transform
  dome), carves the ink lines as grooves, relaxes the stair-stepped rim,
  weathered sandstone vertex colours + moss -> `gl-trollhead.glb`. Grotto
  rocks, rock collar, moss, ivy, ferns, flowers -> `gl-falls.glb`. The
  waterfall (two scrolling sheets, foam, mist, ripples) is JS (`buildFalls`),
  plus one warm accent light on the face. Colliders `falls` + `_head`.
- **Glass/signs/lights are JS** (grinleria.js): one transparent batch for
  shopfronts, balustrades, board glass, escalator glass; the vault glazing
  separately (no shadows: the sun stripes the ice through the ribs). Every
  sign is a rect in ONE 2048 canvas atlas (`signSpecs()`/`bannerSpecs()`,
  80 px/m, tallest-first shelf packing; it overflowed at 110 px/m and the
  last signs drew as colour blocks). Atlas, ice, waterfall textures are made
  once per page (maps dispose geometry/materials, never textures). 15
  point lights, all at load.
- **Gameplay notes**: shop glass is penetrable (`pen` 1.2 open / 3 closed);
  bots are ground-floor only (like every map) but shoot up; escalator feet
  were first 0.5 m behind the rink boards (unwalkable), moved to x0 14.8.
- **Perf** (swiftshader headless, so relative only): 46 draw calls, 161k
  tris. Models 8.6 MB after `models/quantize_glb.py` (byte colours/normals
  via KHR_mesh_quantization, UVs dropped where never textured; was 16.3).
  Biggest is gl-shops (2.9 MB). If phones struggle: lower trollhead `res`,
  thin the shop props.
- **Marble**: new baked surface `marble` (`bake_surfaces.blender.py --
  marble`), `GS_Marble`/`GS_MarbleUp` in RETEXTURE; the map sets
  `noGroundPlane` and draws its own floors.
- **Preview** `ui/maps/grinleria.jpg`; views in
  `tools/troll-ops-map-views.json`.
- Not done / ideas: escalator treads don't move; no zombies layout; the
  sky is a gradient (the vault would love clouds); bots don't use the
  upper level; parody names are my picks (user may want others).

### HUD fix (same session): streak text over the scoreboard
User: "scorestreak text should not get in the way of the scoreboard text
... while using VTOL Warship". `.to-ks-banner` (streak ready + enemy
callouts) was at `top: 12.5%`, 45-90 px on most screens, i.e. on the team
score (46 px; 10 px on touch) and S&D/Royale status (to ~84 px); now
`top: max(12.5%, 100px)`. The VTOL Warship / Dragonfire title bars
(`.to-ws-top`, `.to-df-top`) moved from the top centre to just above their
gun / HP readouts (bottom 128 / 116 px; 180 px under 760 px wide).

### Tools changed this session (all maps re-audited, all PASS)
- `troll-ops-map-audit.mjs`: drops must fall through a clear column (a
  floor slab over the landing spot was read as a way down); a top with a
  solid starting right on it (a wall run up under a slab) isn't a floor;
  spawns stand at y 0 / on a low platform, not on a roof overhead (matches
  the game); `AUDIT_WHY="x,z,y"` prints the route the audit found to there.
- `troll-ops-map-walk.mjs`, `troll-ops-map-previews.mjs`: `ANGLE=swiftshader`
  for machines without d3d11; walk `STEP=1` drives movement at a fixed
  60 Hz (software GL can't walk in real time; Depot passes the same way).
- **Blender in a Linux cloud container**: `pip install bpy==4.2.0` into a
  venv (Python 3.11) works headless; run scripts with
  `runpy.run_path(script, run_name="__main__")` after setting
  `sys.argv = [script, "--", ...]`. Chromium for Playwright is at
  /opt/pw-browsers (Playwright 1.56 matches it).

## RESUME HERE (2026-09-30, session 19) — read this first
Worktree `to-opus-wt` (branch `game-improvements`), push =
`git push origin HEAD:main`, then `git pull --ff-only` in the main checkout,
then curl the live `?v=` tag (`troll-ops.html` loads `game.js?v=to-bs1`).
Two approved design docs drive the next work, in this order:
1. **Bot scorestreaks** — https://claude.ai/code/artifact/39ee72a4-672a-4d4e-a60e-44eaf81fffc3
   Phase 1 SHIPPED (below). Next: phase 2 (Care Package: mark, run to the
   crate, capture, use; Lightning Strike: pick 3 spots from where its team
   last saw the most enemies), then phase 3 (AI gunner on the VTOL
   Warship; bots shoot down enemy drones/gunships/warships, which they
   ignore today). Add each to `BOT_STREAK_POOL` as it lands. Decisions:
   sky cap 2 air streaks per team + 1 bot warship a match; friendly bots'
   streaks count for your team; toggle on by default; no bot streaks in
   the Test Range.
2. **Map detail pass** — https://claude.ai/code/artifact/6c5f187b-8e24-4227-b0cb-823fb3646b46
   (Claude Docs doc; its Decisions section has the user's answers). Six
   phases: atmosphere on all maps first (Dust Bowl turns SUNSET, others
   keep their time of day), island ground + clutter, island landmarks A
   (follow trollface.io, then restyle; bus/glider/glass box art folded in
   here), landmarks B, PvP second pass, Hollowgrin models. Hollowgrin's
   dark parts get brighter through light-giving decor (lanterns, candles,
   pumpkins), not global light (my reading of "lighter"; confirm). Re-run
   `tools/troll-ops-map-previews.mjs` after any map's look changes.
Parked by the user: the park map (wants ~5 inspiration images first).

## Second fix list + Dragonfire / SAM Turret / Cosmetics (2026-09-30, session 20) — `game.js?v=to-fx3`, `style.css?v=to-fx3`
Branch `claude/nifty-bardeen-l6xrcp` (not yet merged to main). Test:
`tools/troll-ops-fx3-test.mjs` (19 checks; in a Linux container run with
`ANGLE=swiftshader VW=640 VH=360`, it steps streaks via updateStreakEntities
because software GL draws only a few fps).
- **Menu operator** (char-inspector.js): square to the camera (FACING PI,
  REST_YAW 0, no auto sway, eases back 2.5 s after a drag), no idle head
  glances (`rig.noIdleGlance`), rifle at port arms across the chest
  (new `carryYaw`/`carryRoll` in character.js `_gripSupport`).
- **Bot skill is room-wide**: bots run on the bot host (longest in the room,
  normally whoever started it) with the host's setting. Each bot now carries
  its tier on the wire (`bs` on a bot's state, net.js BOT_SKILLS); every
  client reads `roomBotSkill()`; a client that takes over mid-match keeps the
  room's tier (`roomSkillSeen`). Lobby note `#to-set-botskill-note`.
- **+10% XP with veteran bots**: `boostedXp` at every settle point (finishRun,
  quit, tab hidden) once veteran bots were in the room for half the match
  (`player.matchT` / `player.vetBotT`).
- **Controller card** (controller-layout.js, lobby Settings + Esc menu): a
  blueprint of the user's Voyee pad (Switch Pro layout), callouts in the
  pad's own names (Switch / Xbox / PlayStation picker), live highlights,
  narrow mode = pad + list. **Emote on a pad = the Voyee's T button**
  (`padEmoteButton`, localStorage `trollops:padEmote`, default "any button
  past index 16"; "Set emote button" rebinds it, since T is often a
  hardware turbo the browser never sees). Hold Y/Triangle is the fallback
  (superseded, see the follow-up below). Desktop stays H = emotes, T = inspect.
- **Killcam melee**: killcam.js records `mid/sw/si/bk` per actor; replays
  swing the sword / raise the saber guard on every body and show the
  killer's melee viewmodel (`updateKillcamMelee`).
- **Saber parries**: 4 zones by where the round came from (character.js
  `parryZone`/`parryWeight`, `PARRY` poses on the body, gear.js
  `SABER_PARRY` first person), remote bodies via `rp.startParry`.
- **Melee reach**: keyboard 2.0 m / saber 2.2 m / reaper 1.8 / chainsaw 2.1,
  fan of rays at 3 heights, thrusts narrower and a touch longer; bots'
  MELEE_REACH 1.9.
- **Death**: no viewmodel, your own body on the ground empty-handed and a
  slow orbit camera until respawn (`updateLocalDeadBody`/`placeDeathCamera`);
  remote bodies drop their weapons and stay down 8 s (BODY_LINGER).
- **Dragonfire** (dragonfire.js, 750 score, LV 31, 60 s, 60 s cooldown):
  procedural model off the user's reference (ringed ducts, desert digital
  camo, LMG + lens under the nose), flown in first person (WASD/stick,
  Space/A up, C/Ctrl/B down, fire), 300 hp, owner hitscan 34 dmg; wire
  `kind:"dragonfire"` spawn/pos/shot/end. Icon `streak-icons/dragonfire.png`.
- **SAM Turret** (sam-turret.js, 500 score, LV 22, 90 s): tripod + 2x2 pods
  + radome off the reference; owner AI locks the nearest enemy aircraft in
  LOS (UAV/CUAV planes, HK drones, gunships x2, warships x3, Dragonfires),
  fires pairs of homing missiles. Shoot-downs: `shootDownAir` + wire
  `kind:"air"` hit/down (also bullets on enemy Dragonfire/SAM). Recon planes
  now carry a shared `eid`. `SCORE.airKill` 125 + XP.
- **Sad trollface emote** (last in EMOTES, wire code 15): trolltruths.com's
  sad trollface (copied from trollrunner-terminal `public/boot/trollface-sad.png`
  to `ui/trollface-sad.png`), head hung, sobbing, wiping eyes.
- **Cosmetics tab** (cosmetics.js): face expression (Trollface / Sad
  trollface) + skin tint (8 colours), saved `trollops:cosmetics`, shown on
  the menu operator and your body, sent as `fc` so others see it
  (character.js `faceMaterial` / `setFace`, `rig.face`).
- **Follow-up (same session):**
  - **Swivel** (user's spec, basketball spin move): running forward,
    double-tap A or D (pad: click the left or right stick alone) -> a 360
    spin toward that side over `SWIVEL_TIME` 0.5 s, coming out
    `SWIVEL_SIDE` 0.9 m to that side of where it started, still running.
    game.js `trySwivel`/`updateSwivel` (sideways shift through
    `move.resolveHorizontal`), body spin on the 3P rig (`swivelSpin`) and on
    everyone else's view (wire `sv` = side * count, remote-players.js). In
    first person: a roll + FOV kick, not a full camera turn. The user said
    "left ... clockwise": left currently turns the body's left first;
    `SWIVEL_LEFT_SIGN` flips it if that reads wrong to them.
  - **Pad emotes = L3 + R3 clicked together** (user; the Voyee's T is a
    hardware turbo the browser never sees). A single stick click waits
    `STICK_CHORD` 0.12 s for the other before it's a swivel. Y is an
    instant weapon swap again. The controller card can still set one
    button for emotes instead (`padEmoteButton`, "Use both sticks" resets).
  - **Tablet dive** (user item 7): Lightning Strike, VTOL Warship and
    Dragonfire tip the view down onto the tablet, push into its screen and
    cut through a green scan flash (`startTabletDive`, `.to-tablet-dive`)
    into the strike map / gunner feed / drone camera. UAV, gunship, VSAT
    etc. keep the plain confirm. DF_BOARD_AT is 1.2 s now.
  - **Bots call Dragonfire and SAM Turrets** (BOT_STREAK_POOL; Dragonfire is
    an air streak under BOT_AIR_CAP). A bot's Dragonfire is flown by
    `flyBotDragonfire` (holds ~9 m off its target and 5 m up, faces it,
    fires on the bot's hit chance x0.8); the bot stands still while it
    flies (`bot.piloting` via botBusy) and the drone drops if the bot dies.
    Bot SAMs use the same AI as ours (`samTargets` by `botTeam`).
  - Swivel on a pad confirmed by the user: L3 alone = left, R3 alone =
    right, both together = emotes.
  - **Aircraft can be shot with guns** (user: bots should learn to shoot
    aircraft). HK drones (60 hp), gunships (600) and UAV/Counter-UAV planes
    (450) get an invisible hit sphere (`attachAirHitbox`, userData.air) on
    top of the Dragonfire (300) and SAM (500). Our bullets hit enemy ones
    (targetMeshes from `enemyAirFor`); the owner applies hits
    (`damageStreakEntity`; recon planes have no owner copy, so every client
    counts the same `air hit` messages). Warships stay out of reach.
    `enemyAirFor(team, owner)` is the one enemy-aircraft list (SAM, bots,
    us). **Bot anti-air** (`updateBotAntiAir`, bot host, after bots.update):
    with no enemy seen for 1.2 s a bot turns on the nearest enemy aircraft
    or SAM in the clear within 85 m and fires at its skill's rate, hit
    chance scaled by size and range (BOT_AA_SIZE); a kill pays the bot
    SCORE.airKill toward its streaks.
- Not done / next: more cosmetic slots (face is the first); killcam doesn't
  record swivels.
- Pre-existing failures under software GL (same on the base commit): sync,
  bot-moves, bot-streaks killfeed, streaks-bo2/trollsaber start timeouts.

## Bot scorestreaks phase 1 (2026-09-30) — `game.js?v=to-bs1`
- Bots we host roll 3 streaks a match (`botStreakState`, from
  `BOT_STREAK_POOL`: uav, counteruav, vsat, drone, k9, helicopter, swarm;
  radar ones left out in FFA), earn on kills (`botEarn` from
  registerDeath; meter empties on death, earned ones stay), and call one
  after `BOT_QUIET` s with nobody in sight (`updateBotStreaks`, bot host
  only, after `bots.update`). `botFireStreak` mirrors `fireStreak` with the
  bot as owner and sends the same streak messages + a callout banner.
- Owner plumbing: entities carry `botId` / `botTeam`. `streakDamage(botId,
  target, dmg, wid)` routes through `botDealDamage` (bot credit, can hit
  the local player; a bot that left drops the damage).
  `streakOwnerHates(team, botId)` adds the local player as a target for
  drone picks (`pickDroneTarget(from, eyeUp, {team, botId})`), gunship,
  K9 (`k9Hostiles`) and Swarm runs. `k9Hostile` lets you shoot an enemy
  bot's dogs even though your client hosts them.
- Limits: `BOT_AIR_CAP` 2 air streaks per team (drone/gunship/swarm), the
  same cooldowns as players (per bot `s.lock`). Lobby checkbox
  `#to-botstreaks` "Bot scorestreaks" (on, saved in localStorage
  `trollops:botStreaks`). Off in Royale, Test Range, non-PvP.
- `botStreakLog` (hook) = recent bot calls. Test:
  `tools/troll-ops-bot-streaks-test.mjs` (8 checks). streaks-bo2 + sync
  suites still green.
- Not done: bot callouts are one red banner per call (can get busy with 12
  bots; consider only enemy calls, or a softer friendly banner); bots
  don't react to an enemy UAV beyond the minimap.

## BACKLOG: audio + dialogue pass (user, 2026-09-30) — BIG PROJECT, not started
The game needs lots of audio and voice lines. The user wants the dialogue to be
**very close to Call of Duty: Black Ops 2**: announcer and operator callouts
for streaks earned and called in ("UAV online", "Enemy UAV spotted",
"Care package inbound", "Enemy VTOL Warship inbound"), match flow ("Mission
start", "One minute remaining", "We're losing / winning", "Mission failed /
accomplished"), objective lines (S&D bomb planted / defused, KOTH hill
moving), multikill and medal stingers, reload / grenade / "frag out" chatter
from your own troll and from bots, and pickup and landing lines for Troll Royale.
Write it in the troll voice, not copied BO2 lines (same beats and cadence,
original wording). Needs a design doc first (feedback: design doc before
big builds): line list per event, who says it (announcer vs own troll vs
enemy), how it's voiced (TTS? recorded? which provider), the audio.js
hooks it plugs into, a volume/voice setting, and a rule for how often chatter
fires so it doesn't spam in a 100-troll Royale.

## BACKLOG: open asks from the 2026-09-30 list — waiting on the user
- **Purge XP** ("purge xp level in players to incentivize using terminal
  site to earn xp?"). Not done. The Troll Forces XP cut to a tenth and the
  user's own reset to LV 69 may cover it; ask before touching anyone
  else's XP. A reset of all players can't be undone: back up
  troll_profiles / troll_xp_events first.
- **Game tournaments paid in $TRUTHS.** Not started. Needs a design doc
  first: entry fee or free entry, prize pool and payout (troll-pay.js is the
  live Solana lib), which games, anti-cheat (Troll Forces is
  client-authoritative, so scores are forgeable), and the legal side (paid
  entry + token prizes can count as gambling/sweepstakes). $TRUTHS is the
  terminal's own coin with a no-shill boundary (memory
  truths-token-terminal-coin).

## Fix list (user, 2026-09-30) — `game.js?v=to-fx1`, `style.css?v=to-fx1`
- **No select / highlight / drag anywhere** (style.css top + document
  dragstart/selectstart/contextmenu in game.js; inputs still select).
- **Touch: throwable buttons aim when dragged** (`dragAims`, same as Fire).
- **Map vote previews**: `ui/maps/<id>.jpg`, rendered by
  `tools/troll-ops-map-previews.mjs` (VIEWS table = camera spots). Re-run it
  after a map's look changes (the map detail pass will).
- **Emote wheel is press-to-open now**: H / L3 toggles; hover (mouse, free
  cursor, right stick; the stick's pick is sticky) then click / X / Cross-A
  plays, Esc / right click / Circle-B closes. Touch unchanged.
- **Emotes in the main menu**: `menuEmoteWheel` on `#to-title`, Emote pill
  under the operator (`#to-char-emote`), H and L3 too; plays on the menu
  operator (`CharacterInspector.playEmote`).
- **VTOL Warship look sensitivity** x0.35, lower still on the zoomed gun
  (`lookSensScale`).
- K9s were already killable (hit -> owner -> die, +50); nobody but you
  calls them yet, so you never meet enemy dogs.
- Test: `tools/troll-ops-fixlist-test.mjs` (11 checks).
- **Bots move like players** (user: never saw them scope, slide or jump;
  `game.js?v=to-fx2`): bots.js hop (`startHop`, in fights by
  `diff.jump`, and when pinned `STUCK_HOP`) and slide (`startSlide`, by
  `diff.slide`, or after a hit), `bot.stance` on the wire ("slide").
  Throwables rolled per life: lethal frag|firebomb, tactical
  flash|smoke|EMP; smoke goes between a hurt bot and its enemy, then it
  backs off (`retreatT`). Test: `tools/troll-ops-bot-moves-test.mjs`.
- **Scoped pose is readable now** (character.js, all rigs incl. yours in
  3P): only the Problem 416 has grip points (`_gripSupport`); every other
  gun uses the arm-rotation path, where ADS lifted the arm 0.2 rad (looked
  like nothing). Now 0.6 + support arm follows. character.js tag bumped to
  `to-ads2` in every importer (emotes/enemies/zombies tags bumped too).
- Pre-existing (fails on main too): royale-bots "most bots have picked
  something up" (5/9).
- Bot scorestreaks: see the section above (phase 1 shipped). Park map on
  hold (user).

## Troll Royale phase C: everyone's drop + late join (2026-09-30) — `game.js?v=to-rdc`
- **Wire field `dr`** on every state msg (you and hosted bots): 1 bus,
  2 freefall, 3 glider (`DROP_BUS/FALL/GLIDE`, remote-players.js; bots carry
  `b.dropCode`). Remote rigs: hidden on the bus (inside it), belly-down
  skydive in freefall, `poseDrop` + a glider when gliding (`sharedParaglider()`
  clones one build, never disposed). Your own third-person body uses the
  same `poseDrop`. While gliding your sent yaw = the wing's heading. Gliders
  stay drawn to 300 m in the crowd LOD (bodies still 150 m).
- **Glider is ~5 draw calls** (cells and rims merged), was ~21.
- **Bot host = longest in the room** (net.js `since`, sent as `js` in
  hello/here; lowest id only breaks a tie; unknown = older). Before, a
  late joiner with a lower random id took the bots over and 99 fresh bots
  spawned mid-Royale. Affects every mode's host (stage clock, S&D carrier,
  infection pick). Assumes clocks roughly agree across machines.
- **Late join**: the host answers a newcomer's hello with a `stage`
  carrying `bt` (bus clock) / `rt` / `lv` (`publishRoyaleCatchUp`); the
  joiner skips its own sky lobby, boards the bus where it is and runs the
  match clock from the room's (`applyRoyaleCatchUp`, held until their Royale
  is set up). Joining after the bus crossed the island: spectate
  (`royale.lateJoin`, "Joined mid-match", no placement XP).
- Test: `tools/troll-ops-royale-phase-c-test.mjs` (9 checks). Drop, royale-mp
  and sync suites green. Sync's infection check was a timing race (C's
  countdown + 8 s delay ran out before D loaded; it passed only when D stole
  host), now opens C and D together.
- Not done: real art for bus/glider/box; landmark art (ask first).

## Troll Royale: 100 trolls, landing roll, Grin Site spawn (2026-09-30) — `game.js?v=to-r100`
- **100 trolls** on Trollface Island (`royale.players` in trollface-island.js);
  real players each take one bot's place (bots.fill already did that).
- **net.js batches every send**: everything queued inside 50 ms goes out as
  one `{t:"batch", m:[...]}` broadcast (Supabase's client silently drops
  past eventsPerSecond 30, which one-message-per-bot blew through long
  before 100). Past 24 hosted bots each bot's state goes at 10 Hz
  (`net.botCount`, set by game.js after bots.fill).
- **Crowd LOD** (only when a room has > 24 trolls, so every other mode is
  untouched). Measured with `tools/troll-ops-royale-fps.mjs 20 100`
  (headless, real GPU; `HIDE_RIGS=1` hides every body): at 100 trolls the
  frame was bots 16.6 ms, rig posing 23.6 ms, render 53.6 ms (1,176 calls).
  - bots.js: a bot > 70 m from every real player (`ctx.lodNear`,
    game.js `humanEyes()`) thinks every 2nd frame, > 150 m every 4th, with
    the skipped dt handed over; flow-field sweeps capped at 6 a frame
    (a pooled field is reused a few frames stale past that).
  - remote-players.js: posing every 2nd frame past 40 m, 4th past 100 m;
    no shadow past 40 m; not drawn past 150 m (`FAR_HIDE`, still hittable).
  - Rig bodies were most of the render cost (45 ms visible vs 18 ms
    hidden). If phones still struggle: a one-mesh impostor for 60-150 m
    trolls is the next step, or a lower bot count on touch devices.
- **Quickplay cap counts humans only** (`net.humanCount`); Royale's cap is
  `MAX_PLAYERS_ROYALE` (100). Before this, a lobby's bots made it look full.
- **Tuck and roll on landing**: `royale.me` goes glide → "roll" → "ground".
  0.8 s (`ROLL_TIME`, remote-players.js), carried forward along the glider's
  heading, gun comes up at the end. `rollRig(rig, k)` tumbles any rig about
  hip height; wire field `ro` (0..1) so peers and bots roll on every screen.
  First person: the camera flips once and dips.
- **Grin Site corner spawns** were exactly on the light towers at (±30, ±30):
  moved to (±30, ±24).
- **Match XP cut to a tenth** (user: "way too much xp"): progression.js
  `XP` (kill 10, win 80, ...), `xpForRun`, `XP_SCALE = 0.1` on medal points
  (the scorestreak meter still gets full medal points), Royale placement
  bonus. XP already queued in `trollops:xp-pending` is scaled once
  (`trollops:xp-rate-2`).
- **Daily login XP paid more than once** (user, on phone): every page and
  game iframe asked for `login_streak` on load, plus the login itself, and
  the server's cooldown check races. Client now asks once per account per
  UTC day (`awardLoginXp`, key `trollrunner:login-xp`);
  `assets/supabase/troll_login_once_a_day.sql` adds a unique per-day index
  (the real guard) and sets troll_runner to LV 69 (231,200 XP). **User must
  run that SQL.** DONE: user ran it 2026-09-30.

## Troll Royale polish (2026-09-29, user list) — `game.js?v=to-rs1`
- **Loot pickup keycap**: Royale's gun prompt is the ONE exception to the
  "no key hints" rule (user asked): pulsing X / "D-pad →" keycap + HOLD,
  bigger line and bar (`.to-hold-key`, `#to-pickup-prompt.is-royale`). No
  cap on touch (the PICK UP button is already labelled).
- **Two hands on melee in third person**: character.js `MELEE_SUPPORT` puts
  the left fist on the saber hilt, keyboard grip and chainsaw hoop, carry
  and swings; the saber guard still lays over it. Reaper stays one-handed.
- **Crosshair in third-person ADS**: stays (scaled to .62, `.is-ads-tp`);
  first person still hides it for the gun's own sight.
- **Spectating**: no death fade / low-HP pulse / spawn pill; free orbit on
  look.yaw/pitch round the watched troll (their nametag hidden); bottom bar
  with prev/next (buttons, A/D/Q/E/arrows, click/right-click, LB/RB or
  D-pad). `cycleSpectate`, `spectateOrder`. Royale test now 26 checks.

## RESUME HERE (2026-09-29, end of session) — read this first
Everything below is pushed to main and live (`troll-ops.html` loads
`game.js?v=to-lv3`). Worktree: `to-opus-wt`, branch `game-improvements`;
push = `git push origin game-improvements:main`, then `git pull --ff-only`
in the main checkout, then curl the live `?v=` tag.

### Shipped this session (newest first)
- **No white hands anywhere** (user). Melee (keyboard, chainsaw, reaper)
  now held by the gloves or the PF rods like the saber (`poseMeleeArms`: the
  block hands are invisible grip points, `userData.gripAxis` per hand; the
  chainsaw support hand sits on the hoop top). Gloves-off FP emotes = the
  rods act them out with no fingers (user: funnier, "its trolling"). Gun
  inspect with gloves off keeps the rods on the gun (white showcase arms
  retired: `inspectArms` never shown).
- **Batch of six fixes (user list, 2026-09-29 evening)**. Test:
  `tools/troll-ops-cuav-cooldown-test.mjs` (19 checks); streaks-bo2,
  trollsaber and emote suites still green.
  - **Tablet hands**: hand-model.js `HAND_GRIPS.side` + `HAND_POSES.grip`
    now hold the tablet by its sides, fingers round the back, thumbs on the
    front bezel (the thumb taps CONFIRM). User: "we're not using white
    hands": the two live looks are Settings > Gloves ON (tactical gloves) and
    OFF (PF black rods). Streak devices with gloves off now use rods
    (`arm.rod` in streakArms, tip = STREAK_ROD_TIP on the tablet edge), never
    the white hands. The first-person EMOTES still use white hands with
    gloves off (rods can't gesture): not changed, ask the user.
    glove-model.js now imports hand-model.js with the same ?v tag as game.js
    (one module instance: the gloves also get the emote finger poses now).
    Glove poses are cached by pose NAME (poseGlove key): a runtime tweak to a
    pose's numbers doesn't re-bake unless the name changes.
  - **Pad emote wheel**: hold L3, right stick points (EmoteWheel.aim), let go
    to play. Every other pad button was taken.
  - **Gunship cooldown 90 s** from the call (STREAK_DEFS.helicopter.cooldown).
    Generic lockouts: game.js `streakLockUntil` / `lockStreak(id, s, why)`;
    a locked streak keeps its charge, the HUD slot shows COOLDOWN/JAMMED Ns
    (`.is-locked`), readyStreaksOrdered skips locked ids.
  - **Counter-UAV** (250, LV 3, silver): my reading of the ask: an enemy
    Counter-UAV jams your minimap 30 s (static + JAMMED), knocks your side's
    UAV down (its plane peels off), and whoever called that UAV
    (`myUavUntil`) can't call UAV for 45 s. Wire msg kind "cuav".
    Jammer plane = recon-drone in red (ReconPlane `counter`); HUD picture
    rendered with render_streak_icons (FINISH tint). In the care package pool.
  - **Saber black rectangle**: it was the menu/loadout preview (transparent
    canvas): the beam and trail shaders wrote alpha 1 over their whole quad.
    Now alpha = brightness with premultipliedAlpha additive (same look in game).
  - **Chainsaw**: own swing tracks in gear.js (CS_PLUNGE overhead drive +
    grind, CS_SWEEP gutting sweep; rev-up first, hit at 0.34 s, 0.86 s total),
    `chainsawRevAt` drives engine vibration, screen shake (`sawShake`),
    chain speed, the new `CS_Throttle` trigger node and exhaust smoke from
    `CS_Exhaust` (build_halloween_melee.blender.py, chainsaw.glb?v=hw2).
    Admire (T / D-pad up / touch) on the chainsaw = rev it (applySawRev, three
    blips). Sounds: chainsawRev + new chainsawRip. The old block grip hand
    (white stub on the rear handle) still shows on it: pre-existing.
- **K9 Unit (550, LV 25), VTOL Warship (850, LV 35), Swarm (1000, LV 48)**,
  the BO2 top tier. Models: `models/build_streaks2.blender.py` -> `k9-dog.glb`
  (German shepherd in a vest; K9_Head/Jaw/Tail/Leg*_Lo nodes posed in
  code) and `vtol-warship.glb` (VTOL_Nacelle_L/R tilt, VTOL_Rotor_L/R spin);
  HUD pictures via `render_streak_icons.blender.py` (ICON_ONLY=k9,warship,swarm).
  - K9 (`k9-unit.js`): 6 dogs, 90 hp, bite 55, 45 s, FlowField per target;
    owner simulates, snapshots at 8 Hz ("k9" pos msgs), hits on dogs go to
    the owner ("hit" -> "die"); bots target dogs (`k9:<eid>:<i>` ids in
    botTargets/botDealDamage); +50 score (SCORE.dogKill) for a dog.
  - Warship (`VtolWarship` in streak-entities.js): you ride the port gun
    for 40 s, ground-stabilised aim, thermal CSS filter + `.to-ws` HUD,
    25 mm chain gun / 105 mm cannon (switchWeapon toggles), body stays on
    the ground and dying ends the ride ("leave" msg).
  - Swarm: 24 Hunter-Killers over 30 s, max 6 in the air, diving from the
    map edge (HunterDrone `sky` option, credit "swarm"), reuses the drone
    "launch" message with sky:1.
  - Test: `tools/troll-ops-streaks-bo2-test.mjs` (18 checks).
  - Not done: bots don't shoot down the warship / swarm drones (BO2 lets
    you); dogs only walk the ground floor field.
- **Chainsaw (LV 45) + Reaper's Grin (LV 15)** melee (gear.js MELEE_DEFS
  `chainsaw` / `reaper`). Blender-built: `models/build_halloween_melee.blender.py`
  -> `chainsaw.glb`, `reaper.glb` (run with `-- render` for Cycles studio
  shots; set HW_RENDER_DIR). `melee-models.js` loads them (weapon env map via
  setHalloweenEnvMap), falls back to procedural stand-ins until loaded,
  runs the chain teeth live (`userData.tick`, fast mid-swing), prints our own
  gold "hooded trollface reaper" engraving on the knife panels (canvas).
  Knife = karambit folder after the user's reference image (images/2.png of
  session 4a7b655b); its blade is its own node on RG_Pivot
  (`userData.setFold(0..1)`). Admire (T / touch sparkle) on the knife:
  applyReaperInspect in game.js = fold shut, flick open (click), two wrist
  rolls + toss, show engraving. Per-weapon view framing: `model.view`
  {pos, rot, scale} applied in updateMeleeView. Sounds: audio.chainsawRev /
  chainsawHit / reaperSwing. User wants these "really clean like Green
  Candles"; latest in-game look was approved-in-progress, not yet reviewed
  by the user in game. Chainsaw framing may still need tuning (bar points a
  bit left; swings reuse the sword tracks).
- **Games hub**: only Troll Kombat + Troll Forces visible (the other nine
  cards are `<article hidden>`, CSS `.hub-card[hidden]`); the ⚙️ settings
  link removed; Troll Forces key art = `assets/games/troll-ops/ui/troll-forces-key-art.jpg`
  (the user's image, re-encoded through a canvas to strip C2PA/Grok
  metadata: user said "do not mark it as AI"; do the same for any new art).
  "Log in to save progress" copy; Troll Wizard card removed.
- **Troll Royale sky lobby + Troll Bus + paraglider** (phases A+B of the
  design doc below; `royale-drop.js`), space sky + stars on Trollface
  Island (`map.stars`, setStarField), touch Admire button (`to-touch-admire`).
- Care package on touch (swap button becomes CAPTURE / PICK UP), captured
  streaks bank with a READY pulse and never auto-fire, package streaks
  don't cost meter; one Throwable slot (lethal OR tactical, loadout
  `throwKind`); HUD layout editor (Settings > HUD layout > Customize,
  `hud-layout.js`, per device); royale gun pickups fixed; royale sprint
  x1.25; Mini Royale hidden (kept only as a test fixture, room `QTRM`).

### Troll Royale status (user asked)
Playable end to end on Trollface Island: 90 s sky lobby (glass box 330 m
up, lobby guns, no damage) -> Troll Bus across the island -> jump, freefall,
trollface paraglider -> land -> loot, zone, last troll standing, 20 players
with bots. Phase C sync + late join DONE 2026-09-30 (section at the top).
NOT done: real art for the bus/glider/box, and the landmarks' real art pass (ask
before Blender for landmarks; weapons were explicitly requested).

### TODO (user asked to note it)
- **Create a Halloween-themed weapon skin** (for the Problem 416, the only
  skinnable gun: skins.js SKINS + a baked atlas in skins/). Pairs with the
  Halloween melee (Reaper's Grin, Chainsaw): think pumpkins, reaper, bone,
  violet/orange. Not started.
- **Create a flamethrower** (user, 2026-09-30): it must be a VERY unique
  design, not a stock military flamer. Needs its own silhouette (the way the
  Green Candles is a candle-tank launcher, not a rocket tube): pitch 2-3
  concept directions to the user before modelling (design doc first, per the
  big-build rule), then Blender model + PF-style reload (tank swap, like
  Green Candles' tankSwap) + fire stream/burn FX. Not started.

### Streaks (done, 2026-09-29)
BO2 names kept (UAV, Care Package, Hunter-Killer Drone, Lightning Strike,
Helicopter Gunship). Each has a tier badge (scorestreaks.js streakBadgeSvg:
silver UAV/Care Package, gold Hunter-Killer/Lightning, red Gunship) shown on
the HUD slot corner and in the lobby picker; slots show picture + name +
cost (or READY + key); ready banner names the key. Slots sort left to right
cheapest to dearest (streakSlotIds). Max 3 in the loadout (LOADOUT_SIZE).
All five verified callable on an emulated phone by tapping (Care Package
confirm button, Lightning Strike tablet taps). Touch: only the big right
Fire button now (left fire hidden); Admire button is a praise-hands icon.

### Open questions / waiting on the user
1. (answered) Streak names stay BO2, with symbols and badges: done above.
2. Chainsaw/knife unlock levels (15 / 45) were my pick.
3. The banner image: user is fixing the Vice Grin rifle in Grok with the
   prompt I gave (two images: scene + `vice416-3q-transparent.png`); fallback
   offered: composite the real render ourselves. They then picked
   `Downloads/4kWO0.jpg` as the banner (now live).

### Tests (all in tools/, NODE_PATH=<main checkout>/node_modules)
royale-phase-c (9 checks), royale-drop (14 checks), royale-island (sets DROP.enabled=false), royale,
royale-bots, royale-mp, sync, emote, trollsaber, saber-mp, map-walk
trollface, map-audit trollface. Known flake: sync "infection: everyone
starts a survivor" (fails on and off, before this session too); run tests
ONE AT A TIME (parallel headless runs starve each other and fail timing
checks). Headless sim runs ~2.5x slow.

## DESIGN (APPROVED 2026-09-29): Troll Royale sky lobby + Troll Bus drop
User answers: lobby guns do NO damage; third-person camera behind the bus;
trollface PARAGLIDER. Build phases A -> B -> C below, push each.

STATUS: A + B BUILT (royale-drop.js + game.js glue), tested by
`tools/troll-ops-royale-drop-test.mjs` (14 checks: lobby, no damage, lobby
gun pick-up + respawn, bus boarding, box gone, pistol-only drop, jump, glider
opens ~30 m, land on the island, all bots land, zone live). Space sky + stars
on Trollface Island (map.stars, setStarField). Other royale tests switch the
drop off with `T.DROP.enabled = false` (Mini Royale / Grin Beach never has it:
no map.edge). NEXT (phase C): gliders seen by others (snapshot flag + remote
rig glider), bots' gliders on the host, late joiners, then real art (bus,
glider, box). Known: headless sim runs ~2.5x slow, so the 90 s lobby takes
longer there; tests shorten it with T.DROP.lobbySeconds.
User's asks: "a 90 second countdown where we spawn in a lobby with everyone
(can run around and test random weapons lying all around the floor), before
spawning in a troll vehicle (a bus for now), kind of like Fortnite, then we
deploy, drop down and land." Lobby: "up in outer space in a transparent glass
box where users can look down at the map surrounded by space", and the Troll
Royale sky "should be an outer-space sky". Drop: jump + glide (user's pick).

### The flow
1. **Sky lobby, 90 s.** Everyone spawns in a glass box floating ~600 m above
   Trollface Island. The existing staging countdown (`stageT`, host-owned
   clock, already synced over the wire) runs 90 s for royale; late joiners
   land in the box too. Bots fill in at the end, as now.
2. **Board.** At 0 everyone is put on the Troll Bus (no walking to it).
3. **Flight, ~20 s.** The bus flies a straight line across the island at
   ~220 m, 30 m/s. The line comes from the match seed, so every client flies
   the same one (like the loot and zone). Its path shows on the minimap.
4. **Jump.** Space / a big JUMP button (touch) / A (pad), any time once the
   bus is over the island; anyone still aboard is kicked out at the far edge.
5. **Freefall.** ~45 m/s down, steer ~18 m/s sideways; hold forward and look
   down to dive faster (~60 m/s).
6. **Glide.** A glider opens by itself at ~30 m above the ground (or press
   jump again under 120 m to open early): ~10 m/s down, ~16 m/s forward,
   steerable. No fall damage on landing.
7. **Land and play.** Pistol only, as now. Zone 1's timer starts when the bus
   leaves the island, so early and late droppers get the same zone.

### The glass box (grey-box first, art later)
- ~40 x 40 m floor, 6 m high: glass floor, walls and roof (see-through,
  thin white frame so you can tell where the walls are), you look straight
  down through the floor at the island.
- 30-40 random guns scattered on the floor, every rarity, with the normal
  pick-up (hold X / Pick up). Infinite ammo, they respawn when taken.
- Lobby rule (my pick, say if you want it different): guns fire and show
  hit markers but do NO damage in the lobby. Nothing carries over: everyone
  drops with the usual pistol.
- A big countdown on the wall and the HUD: "Bus leaves in 0:42".

### Space sky (the whole royale map)
- Troll Royale swaps the island's blue sky for space: a black-to-deep-blue
  dome, a star field and a faint nebula band, a bright sun (the island stays
  lit by it). Fog goes dark blue-black so the island's edges fade into space.
  The island floating in space matches the trollface.io look and the art
  you generated.

### The Troll Bus (grey box)
- A chunky bus with a trollface on the front, stubby wings and rear thrusters
  (grey box now, real model later). Seen from a third-person camera behind
  it while you ride; the HUD says "JUMP" + how many are still aboard.

### Bots
- Each picks a landing spot (weighted toward landmarks with loot), jumps
  when the bus passes nearest to it, glides there. Hosted by whoever hosts
  bots now.

### Netcode
- Bus path = f(seed): nobody sends it. A player's state goes on the wire as
  now plus a phase (lobby / bus / fall / glide / ground), so others see
  gliders in the air. Jumping is local. Joining after the bus leaves =
  spectate, as now.

### Build phases
- A: space sky + glass lobby + lobby guns + 90 s countdown (reuses staging).
- B: bus, jump, freefall, glider, landing; solo + bots; touch + pad controls.
- C: multiplayer sync (gliders seen by others), spectate edge cases, tests
  (royale tests start from the lobby), then real art (bus, glider, box).

### Questions for the user
1. Lobby guns: no damage (my pick) or real damage with instant respawn?
2. Riding the bus: third-person behind the bus (my pick) or first-person
   inside it?
3. Glider look: a trollface paraglider (my pick), a parachute, or wings?

## (older) Trollface Island rebuilt to the trollface.io map (SHIPPED grey box, 2026-09-29)
User (2026-09-29): "build the battle royale map to be like the trollface.io
map". trollface.io = the official $TROLL site (same mint as ours); its home
page is a floating-island world map. User's reference screenshot:
scratchpad `images/1.png` of session 4a7b655b (if gone: open
https://www.trollface.io in the built-in browser; the page is a lock screen,
but its layers are readable with JS). The user pasted the per-landmark
animation frames (`/assets/world/<name>/0000.png`..): REFERENCE ONLY. We
model our own 3D versions; never download or ship their art.

### Reference assets (for accuracy: open them to check shapes, proportions,
colours and details of each landmark while modelling)
View them in the built-in browser, or read them in-page with a canvas as below.
Don't copy them into the repo or the game.
Desktop layers, animation frames (the user's list):
- City: https://www.trollface.io/assets/world/city/0000.png .. 0010.png
- Observatory: https://www.trollface.io/assets/world/observatory/0000.png .. 0017.png
- Meme Lab (meme-gen): https://www.trollface.io/assets/world/meme-gen/0000.png .. 0005.png
- Gallery: https://www.trollface.io/assets/world/gallery/0000.png .. 0004.png
- Marketplace: https://www.trollface.io/assets/world/marketplace/0000.png .. 0002.png
- Portal: https://www.trollface.io/assets/world/portal/0000.png .. 0004.png
- Shop lights: https://www.trollface.io/assets/world/shop-lights/0000.png .. 0009.png
Also on the page (found in its DOM, frame 0000 each; desktop copies are
probably at /assets/world/<name>/ too):
- Land (terrain, roads, Skate Bowl, beach): https://www.trollface.io/assets/world/land.svg
- https://www.trollface.io/assets/world-mobile/<layer>/0000.png for layer =
  water, mountain, dock, boat, trees/trees-1, trees/trees-2, city,
  shop-lights, portal, observatory, meme-gen, gallery, marketplace, cave
- App cards (what each landmark is): https://www.trollface.io/assets/apps/
  portal.jpg, city.jpg, shop.jpg, marketplace.png, meme-lab.jpg, gallery.jpg,
  cave.jpg, nft.jpg (links: /portal, /city, umadbro.shop, /marketplace,
  /meme-lab, /gallery, /cave)
All layers share one frame (1536x952; water 1536x1627 from 30.05% down), so
a pixel's position in any of them is its map position.

### Where the data came from (so nobody has to redo it)
The page stacks full-frame transparent PNG layers over `/assets/world/land.svg`
(`/assets/world-mobile/<layer>/0000.png`, 1536x952 frame; water is 1536x1627
drawn from 30.05% down the frame). I read each layer's pixel bounds in-page
(canvas getImageData), traced the island top and the lake (+river) with a
Moore boundary trace + Douglas-Peucker, and took tree-clump blobs off the
two tree layers. Checked by drawing the composite with the traced outlines
on top: they sit on the art. All numbers are % of the land frame, turned
into metres by `P(px, py)`: x = (px-50)*4.54, z = (py-47)*3.62 (the map is
drawn tilted; SZ un-squashes depth). Island ~400 x 300 m, bounds unchanged.

### Layout (layer name -> our landmark, map % -> what we build)
| layer | ours | at (px, py) | grey-box build |
|---|---|---|---|
| meme-gen | Meme Lab | 22, 15.5 | 18x12 platform (1.32 m, stairs S+E), blue ring portal (torus + swirl disc), orbiting lights, solar panel |
| city | Troll City | 42, 23 | black trollface DOME (r 11) in a 76x46 plaza; 9 blue/yellow towers 10-40 m, 5 with walk-through lobbies |
| observatory | The Observatory | 68, 19.5 | 14x14 white room (doors S, N), dome + telescope, mount inside |
| portal | The Portal | 76.6, 19.2 | sandy rock plateau (2 tiers, stairs), green door frame on top |
| (in land.svg) | Skate Bowl | 79, 30 | 60x36 walled concrete park, 2 funboxes, rails, ledges, a stand on the N rim |
| mountain | Troll Peak | 62.5, 35 | 3 terraces (r 22/15/9, tops 4.62/8.58/12.21) linked by stairs S/E/N, snowy summit + flag (not climbable) |
| cave | The Cave | 48, 38 | mossy rock mound, 5 m tunnel N-S, side chamber E, warning sign |
| dock | The Dock | 27, 36-42 | L jetty into the lake (0.66 m deck, step at the shore) |
| (in land.svg) | Old Tree | 33.6, 34.2 | big tree on a sand patch |
| boat | The Boat | 72, 51.5 | sailboat on the lake: 17 m hull 1.32 m (stern steps), bow, cabin, mast, main + jib |
| gallery | The Gallery | 28.2, 59.5 | framed glass pyramid (26 m base, 16 m) over a 3.4 m plinth, doors N+S, plinths inside |
| shop / shop-lights | U Mad Bro Shop | 58.5, 68.5 | 26x14 store (doors S/N/E), neon sign + bulbs on the roof, shelves, counter |
| marketplace | The Marketplace | 82, 74 | 6 stalls on a SW-NE diagonal, red/yellow/blue/green canopies |
| (river) | The Bridge | 37.6-49.9, 68.5 | 54 m wooden bridge + rails on the south path |
Terrain: the L-shaped lake (west lobe down to the Gallery, east bay up to
the Skate Bowl), the river south to a waterfall off the cliff (`RIVER_MOUTH`),
beach round the shore. Roads: the winding NORTH_ROAD (Meme Lab -> Observatory),
the SWITCHBACK down into the city, the south sand path (Gallery -> Bridge ->
Shop -> Marketplace -> up the east side -> Skate Bowl). Trees: the map's 38
clumps (2-6 trees each). 45 seeded rocks. Spawns: 20 farthest-point picks
on open ground (`spreadSpawns`), cover keeps 4 m off them.
My picks (tell the user, change if they object): Peak terraces climbable but
not the summit; cave is a walk-through tunnel; pyramid and shop enterable;
the boat can be boarded.

### Status: SHIPPED (grey box), waiting on the user's play-test
Done this session, on top of the draft:
- Look: the map was washed out (ACES at exposure 1.5 + hemi 1.9). Now sun
  2.5 / hemi 0.75 / ambient 0.28 / fog 0.0018, and stronger base colours
  (grass 0x3fbf62, sand 0xecd08e, water 0x3cc8ff, lakebed 0x49b8d8).
- Troll Peak: steeper. Terraces r 22/15/9, tops 4.62/8.58/12.21 (each ring
  as wide as the flight to the next), tiers lean in (visual rTop r-1.2,
  collider at r-0.6), snow cone 26 m, flag at ~41 m. Summit not climbable.
- Cave: mossy green (caveRock) with big lumps on top, dark lining inside
  so the tunnel mouth reads as a hole.
- Gallery: white ridge + course frame on the glass (opacity 0.5).
- Boat: 17 m hull + pointed bow, waterline, 18 m mast, main + jib, blue mark.
- Gallery and Portal nudged in (28.2, 59.5 / 76.6, 19.2): both stuck out
  over the cliff; their patches shrank to 34x32 / 30x24.
- Wading only counts with your feet in it (y < 0.5, game.js + bots.js), so
  the bridge, dock and boat deck are full speed.
- Tests: `troll-ops-map-walk.mjs trollface` (11 runs: all three Peak
  flights, summit blocked, cave tunnel, portal plateau + door, bridge dry,
  boat deck, gallery + shop doors), map audit PASS (409 colliders, no
  traps), island test dry walk moved to the SE path (68, 92).
- Perf (headless, loaded machine): 33 draw calls, ~23 fps with bots vs 34
  without bot AI; the map itself isn't the cost.
- Tags: trollface-island ti2, maps.js ti2 (game.js + loadout.js),
  loadout.js ti2, bots.js to-ti2, game.js to-ti2.
Known, fine for a grey box: the Skate Bowl's north stand and the Portal
stairs leave a 2.6 m alley between them; 41 collider overlaps (wall corners).

### Next
1. User play-test feedback on the island (layout, sizes, what's fun).
2. Later (unchanged): real art per landmark (ask before Blender), then Duos /
Squads + Troll Court.

## Troll Royale phase 3 grey box SHIPPED (2026-09-29)
Troll Royale now plays on Trollface Island (grey box); Grin Beach is the
separate "Mini Royale" mode (`royale_mini`, QTRM). NEXT: ask the user how
the island plays and runs on their hardware, then real art for the
landmarks (ask before any Blender work), then duos/squads + Troll Court.
User decisions (2026-09-29): layout approved as drawn; INVISIBLE WALL at the
cliff edge (no falling off); the lake is SHALLOW (wade through, slow).
- `trollface-island.js`: ISLAND_EDGE / ISLAND_LAKE polygons, ring + north
  roads, 10 landmark blockouts (GreyKit merges per material), extruded slab +
  cliff, lake/water/waterfall, 2 bridges, 90 seeded trees + 50 rocks. Map
  spec: bounds +-205/+-155, `edge`, `wade`, `navCell: 2`, `noGroundPlane`,
  `viewFar: 480`, `royale: { players 20, lootPerSqM 1/210, doc phases }`.
  Not in MAP_IDS (Royale-only via `forceMap`).
- `edge.js`: insidePolygon / clampInsidePolygon. The wall is a polygon clamp
  in movement.js resolveHorizontal and bots.js, not colliders. Wading =
  `ARENA.wade` in game.js move.update (x0.55, no sprint), bots x0.6.
- Zone circle centres AND loot use `dry` (on the island, out of the lake).
- lootSpots flow field step 0.34 / pad 0.7: loot on 0.5 m ledges used to be
  unreachable (you only step 0.36 m) - since phase 1.
- Sky dome follows the camera (renderOrder -1); `camera.far = map.viewFar`.
- PERF: loot beams + floor rings are 2 InstancedMeshes total (were 2 draws an
  item; ~230 -> ~150 calls on the island), rings/boxes only < 40 m
  (`lootRing`), nothing past 95 m. bots.js field pool = max(12, 2/bot) (it
  thrashed at 12 with 20 bots). Island headless ~26-31 fps; render is most
  of the frame (shadows + zone-wall fill), bots ~2-6 ms.
- `isReady` error, general fix: game.js holds every Material.dispose while a
  renderer.compileAsync runs (wraps both), so teardown mid warm-up is safe.
- Cache tags: maps/movement/nav.js now tagged `?v=ti1` in EVERY importer
  (were untagged), royale.js `ti1`, bots.js `to-ti1`, game.js `to-ti1`.
- Tests all pass: new `tools/troll-ops-royale-island-test.mjs` (8: 20 trolls,
  loot/circles on dry land, the wall holds, wade peak speed 0.55x), royale,
  royale-mp, royale-bots, sync (infection team check flaked once under load,
  passed alone), trollsaber, saber-mp, emote; map-audit trollface PASS.

## Troll Royale phase 2 DONE (2026-09-29)
2026-09-29 session:
- Gate PASSES: royale-bots test 13/13, Royale-18 33.1 fps vs TDM-6 39.7.
  Fix: remote-players.js `mergeHeld` merges a held gun into one mesh per
  material (hands, onBeforeRender meshes and multi-material ones stay
  loose); a body went 39 -> 19 meshes. Close-ups of 416 / 870 / Green
  Candles / RPK look unchanged. Remote gun swaps now `disposeLater` too
  (the `isReady` error came back when bots swapped pistols at match start).
- Spectating hides our own FP viewmodel (`royaleSpectating()` in render).
- royale test: death-drop check counts our own drop ids (bots loot now).
- All tests pass: sync, saber-mp, trollsaber, royale, royale-mp, emote,
  royale-bots. Tags: remote-players/bots `?v=to-tr3`, royale.js `?v=tr3`,
  game.js `?v=to-tr3`.
- Not verified on real hardware: ask the user how Royale runs on their
  laptop/phone.

Phase 2 notes (2026-09-28), game.js "Troll Royale bots" block + bots.js:
- Bots land with a pistol (`initRoyaleBot`), carry gunRarity/gunAtt/armor/
  plates/heals, and drop exactly that on death. Damage follows the gun
  (`royaleBotDamage`: pistol x0.65, looted 0.95 + 0.07/rarity).
- `royaleBotObjective` order: zone (urgent if already outside the circle)
  -> loot (`royaleBotLoot`, unclaimed, inside the next circle; urgent for an
  unarmed bot's gun, a needed plate/heal, or anything < 8 m) -> gunfire
  (`royaleNoise`, armed bots, < 45 m, 4 s) -> hunt. bots.js: an `urgent`
  objective steers the bot there (flow field) even while fighting.
- `updateRoyaleBot`: pickup at 1.3 m, plate/heal when nobody in sight or not
  hit for 2 s, cancelled by a hit (`bot.hurtAt`). Bot armour in
  `bots.applyHit(id, dmg, { pierce })` (the Cringe pierces).
- PERF: bots now re-check line of sight every ~0.15 s (`SIGHT_RECHECK`,
  ALL modes), keeping their pick in between: bot AI 6.2 -> 2.4 ms at 18 bots.
- Fixed: `isReady` page error (compileAsync polling a material Royale had
  disposed): royale.js `disposeLater`.
- Test `tools/troll-ops-royale-bots-test.mjs` (13 checks incl. the perf gate).

## Troll Royale (battle royale) PHASE 1 SHIPPED (2026-09-28)
Design doc (Claude Docs, edit via the docs connector):
https://claude.ai/code/artifact/b21bbfbf-170d-4fa6-b4ce-1e092fc8df46
User decided: new Trollface Island map, Solo + Duos + Squads of 4, loot
only, Troll Court 1v1 second chance. Rest = my picks (20 players, plane
drop, streaks off, 5-phase zone "the Cringe"). 5-phase build plan in the doc.
Phase 1 "Mini Royale" (this commit), mode id `royale`, forceMap grinbeach:
- `royale.js`: ROYALE tuning, seeded RNG (mulberry32 + hashSeed),
  `RoyaleZone` (all circles decided up front; `state(t)` for any t),
  `ZoneVisual` (shader cylinder + next-circle ring, no lights), `LootField`
  (items keyed "s<n>" seeded / "<netId>.<n>" dropped; gun models only within
  26 m, beams beyond), `lootSpots` (open ground cells of a nav FlowField),
  rarity = attachment count.
- game.js "Troll Royale" section: setup/teardown, `updateRoyale` (HUD,
  Cringe damage ignores armour, host applies it to bots, auto-pickup of
  plates/Hopium/ammo, plating (4) / Hopium (5) channels cancelled by firing,
  spectate cam, end when <= 1 alive), gun pickup reuses the X-hold prompt
  (`royalePickupGun`: empty slot first, else swaps the held gun, which drops),
  armour soak in damagePlayer, death drops all gear + no respawn, placement
  XP (40/place + 400 win), end card shows "Your place". Bots: noRespawn,
  botObjective walks them into the next circle (no looting yet = phase 2).
- Sync: seed = hash(room:matchesPlayed) but the stage owner sends `sd` in
  stage messages and everyone adopts it during staging. Net `loot` msg:
  `take` {i} / `add` {item}. Known gaps: two players grabbing the same item
  in one latency window both get it; a mid-match joiner sees stale loot.
- Grenades still come from your loadout (doc says looted; later phase).
- Tests: `tools/troll-ops-royale-test.mjs` (21 checks, solo + bots) and
  `tools/troll-ops-royale-mp-test.mjs` (7, two tabs). Sync + saber mp pass.
  Tags: royale.js `?v=tr1`, modes.js `?v=tr1`, net/game/style `?v=to-tr1`.
- NEXT: phase 2 (bots that loot, rotate, plate; measure 18 bots on one host).
  Duos/Squads need N teams (today only phantom/ghost): phase 4.

## Trollsaber multiplayer (2026-09-28, shipped)
Picked by the user from the NEXT SESSION list (no decisions needed).
- **Guard on the wire:** state packet `bl: 1` while blocking (`p.blocking`).
  RemotePlayer damps `blockT` and passes `block` to poseHumanoid; the local
  3P body does the same (`localBlockT`). character.js `_saberGuard`: both
  fists on the hilt by the gun's two-bone IK (`_reachArm`; right fist at the
  emitter end, left 0.11 below it), then the right hand is turned until the
  held mesh's -Z runs along `SABER_GUARD_DIR` (up and left, clear of the
  face). The held melee mesh must carry `userData.meleeId` (remote + local
  set it) or the blade isn't turned.
- **Sounds for everyone:** RemotePlayer queues `sfx` (ignite / retract /
  swing, positioned at the body); game.js `updateRemoteSabers()` drains them
  after every `remotes.update` and runs ONE shared hum voice
  (`audio.saberHumAt`) on the nearest lit remote blade within 30 m. The blade
  snaps out on their screen when it enters the hand. Fixed on the way: a peer
  switching keyboard -> saber kept the keyboard mesh (ensureMelee never
  rebuilt).
- **Deflects for everyone:** `tryDeflect` sends `{t:"deflect", id, by}`;
  receivers spark the blocker's blade (`rp.bladeMid()`) + clash; the shooter
  gets a "DEFLECTED" word in place of the damage number
  (`spawnDamageNumber(..., text)`, `.to-dmg-num.is-word`).
- **Bots respect a guard:** bot targets carry `blocking`/`yaw`/`blockCone`;
  bots.js `isGuarding` (same 0.26 cone as the deflect). Regular/veteran
  (`readsGuard`) stop shooting into it after `reaction * 2` s, flank hard
  sideways (back off inside 8 m), and reach for a frag/flash (planThrow's
  first reason; guard onset cuts the grenade timer unless one went in the
  last 6 s). Recruits keep shooting.
- Test: `tools/troll-ops-saber-mp-test.mjs` (20 checks: 7 bot sim with a
  seeded RNG, 13 two-tab). Saber + sync tests still pass. Tags `?v=to-sb1`:
  character.js (every importer), net, remote-players, audio, bots, game.js,
  style.css.

## HUD cleanup (2026-09-28, shipped)
User: no control instructions while playing (incl. Test Range) and no
top-left Kills counter. Gone: V/G/F letters on the gear chips, "Press 4 to
call it in" banner line, 4/5/6 on ready streak slots (now READY), key names
in the pickup / care package / plant / defuse / marker prompts, killcam "Space
to skip" (button just says Skip). Kills box hidden except Zombies (Points).
Kept: "Click to take the mouse back" (only when a relock fails) and the Esc
menu / lobby Controls lists. Touch buttons are inline SVG icons now (no
words; aria-labels carry the names; nade/tac labels follow the loadout).
game.js + style.css `?v=to-hud2`.

## Trollsaber SHIPPED (2026-09-28, queue item 1)
User: Darth Vader's exact hilt, NO text on it, red blade, melee slot, LV 30,
one-hit, deflects frontal rounds while blocking.
- `models/build_trollsaber.blender.py` -> `models/trollsaber.glb` (~39k tris,
  1.2 MB): ESB/ROTJ Vader (MPP) read off a side-on reference: ribbed chrome
  end cap, 6 black T-track grips, black clamp + screw + bubble strip, chrome
  body with black top plate, red pill button, amber slot, pin hole, screws,
  crinkle-black shroud collar, knurled thumb screw, slanted hood. Empties
  TS_Grip / TS_Support / TS_Emitter. `-- render` adds a stand-in blade.
- `trollsaber.js`: hilt streams in (stand-in until then, swapped in place);
  blade = axial-billboard capsule shader (white core, red glow, halo faded
  across the quad) + solid core rod + emitter sprite; self-animating in
  onBeforeRender (ignite 0.2 s, flicker, flare); `SaberTrail` ribbon.
- gear.js `MELEE_DEFS.trollsaber` (damage 400, `deflect` tuning),
  `SABER_BLOCK` guard pose. game.js: ignite on draw, hum bends with swing
  speed, trail only during the cut, hold aim = block (`updateSaberBlock`,
  red arc meter #to-saber-meter; blinks when broken), `tryDeflect` in
  damagePlayer (WEAPON_DEFS rounds inside the front cone; blasts/melee/
  zombies go through), sparks re-aimed from view space. The gun behind a
  held melee weapon no longer scopes in. audio.js saber* sounds.
- **Held like a saber** (user, same day): two-handed mid guard (hilt low
  right, blade up and across to the left, clear of the crosshair), both
  gloved fists round the hilt (`poseSaberArms`: each hand frame built from
  the hilt axis + the way to its shoulder; rods when Gloves is off; the
  `saberArmsOn` flag keeps posePfArms off the arms). Own tracks in gear.js
  (`SABER_CUT` high-right to low-left, `SABER_RISE` backhand), windows
  0.24-0.34. NB gear.js `basisPointing` builds a MIRRORED basis (det -1,
  non-unit quats); the keyboard was tuned on top of it so it stays, the
  saber uses `saberBasis`. 3P body carries it one-handed except in the guard.
- ~~Not done: others don't see your block pose or hear your saber; bots
  don't react to a block.~~ DONE, see "Trollsaber multiplayer" at the top.
- Test: `tools/troll-ops-trollsaber-test.mjs` (13 checks). Tags: gear.js and
  trollsaber.js `?v=ts1` in every importer; loadout `?v=ts1`, inspector /
  remote-players / audio `?v=to-ts1`, game.js + style.css `?v=to-ts1`.

## Streak HUD images, gloved streak arms, Trolls vs Jeets (2026-09-28)
- **Live-site gotcha:** GitHub Pages ran NO deploy for six pushes in a row
  (5bda5e3 -> 540c998); the site sat on game.js `?v=to-gl1` and the user
  saw the old HUD. An empty commit pushed to main alone kicked a deploy.
  After pushing, check `curl -s https://trollrunner.net/troll-ops.html |
  grep game.js?v=` and the Actions runs API before calling it live.
- Streak HUD: one 80 px picture tile per streak (64 px x --k on touch), no
  names; rendered from the game's own models by
  `models/render_streak_icons.blender.py` -> `streak-icons/<id>.png`
  (olive finish, fitted to the outline). Ready = colour + green rim, not yet
  = dim grey, marking/pad-selected = gold rim; name in title/aria-label.
- Streak devices (tablet, marker, drone) and FP emotes are held in the
  tactical gloves + sleeves when Gloves is on (`streakGloves`, posed off the
  placed white hand; `layGloveSleeve` shared with the gun gloves). The gun
  gloves are hidden while a streak device is out (they froze on screen).
- Teams display as **Trolls** (phantom) and **Jeets** (ghost); ids unchanged.

## Grinmington 870 model SHIPPED (2026-09-28, queue item 2)
- `models/build_grinmington.blender.py` -> `models/grinmington.glb` (~61k
  tris, 1.9 MB), BO2 870 MCS read off the Pick 10 icon: rail + ghost ring,
  vented heat shield, toothed breacher + front post, ribbed pump on the tube,
  barrel clamp + sling loop, flashlight, raked stippled grip, M4-style stock
  (dropped low so ADS stays clear), 4-shell side saddle (left). No text.
  Nodes: GM_Body, GM_Pump (pivot = rest centre), GM_Breacher, GM_IronRear,
  GM_IronFront, GM_Shell; empties GM_Grip/Support/Muzzle/Aim/Port/Under/Rail.
- weapon-model.js `buildGrinmington` (procedural pump gun stands in until
  it streams): keeps pumpMesh/pumpRestZ/shellMesh/loadPort/pfAnchors (support
  hand on the pump, `pfSupportDrop` 0.05), grip hand raked -0.315 to match
  the grip. Optic -> on the rail, irons hidden; barrel device -> breacher
  hidden, muzzleZ moves; underbarrel -> on the pump (racks with it). Irons ADS
  distance 0.3 (ghost ring is at the back of the receiver). `hasDetailedModel`
  replaces the tank-only rebuild check in game.js.
- Shotgun test +4 checks (model, attachments). One run in ~5 failed a
  timing check under load; 3 reruns clean. Tags: weapon-model `?v=gm1` in
  every importer, glb `?v=gm2`, inspector/remote-players `?v=to-gm1`,
  char-inspector + pickups `?v=gm1`, game.js `?v=to-gm1`.

## QUEUE (user, 2026-09-28): do these in this order
1. ~~**Lightsaber: a new weapon.**~~ SHIPPED (see above). The graphics have to be really good, on the
   Green Candles bar: its own Blender build script -> glb (like
   `build_greencandles.blender.py`), glowing emissive blade + halo sprites
   tuned for ACES, detailed hilt, PMREM env map, and real mechanics (not a
   reskinned knife): ignite/retract, hum + swing audio, blade trail on swings.
   User decided: **Trollsaber**, **melee slot** (replaces the knife when
   equipped, still quick-melee, can be held as the active weapon), **red
   blade**, **one-hit kill + deflects frontal bullets while blocking**
   (block drains a meter), **unlock LV 30**.
2. ~~**Grinmington 870: same treatment.**~~ SHIPPED (see above). Replace the procedural
   `spec.pump` model with a detailed Blender glb at Green Candles quality,
   keeping the pump / shell-by-shell reload / rack mechanics and hooks
   (`pumpMesh`, `shellMesh`, `loadPort`, forend-parented support hand).
   The shotgun test must still pass.
3. Then everything else in this file (NEXT SESSION list below, reminders,
   bugs, parked ideas).

## Session 18: tactical gloves SHIPPED (Settings → Gloves, on by default)
User's CoD reference: black leather gloves + dark sleeves. Off = the PF look
from before (black rod arms, old hip framing, white showcase inspect arms).
- `models/build_gloves.blender.py` -> `models/gloves.glb` (244 KB): ONE
  skinned glove mesh on a bone rig (Hand, F{i}_{k}, T0-2) with the same
  frame/joints/sizes as hand-model.js buildHumanHand, plus GL_Sleeve. Kept
  lean on purpose (~5.8k tris a glove, 1.3k a sleeve, no subsurf): at ~66k
  per hand the software-rendered tests (SwiftShader) crawled to 3-20 fps and
  the sync test's grenade timings failed. `-- render` + GL_POSE for studio shots.
- `glove-model.js`: buildGlove(side, env) parses its own copy of the glb per
  hand (three r160 has no SkeletonUtils); HAND_POSES + GLOVE_POSES (trigger,
  support, foregrip) are converted into bone space (W⁻¹·R·W); each pose change
  is CPU-skinned once into plain baked meshes (skinned ones never draw);
  physical materials swapped for standard (sheen exported white); charcoal
  accents on knuckle guard / cuff / stitching.
- game.js `placeGlove`: right hand wraps the pistol grip; left hand C-clamps
  the side of the handguard (a hand under it is invisible from the eye),
  fists a vertical foregrip (`mesh.userData.supportStyle = "foregrip"`, the
  Green Candles), or holds the mag when magBlend > 0.35. Sleeves run wrist ->
  PF_ARM_SHOULDER. Poses are placed in gloveRig space (world anchors ->
  worldToLocal). With gloves on the hip framing is 0.2,-0.165,-0.5 (was
  0.22,-0.2,-0.55) so the hands show; inspect keeps the gloves.
- Test Range info box removed (user): N still spawns bots, Esc has the rest.
- `tools/static-serve.mjs [port]`: no-deps local server for trying a
  checkout (user tested the gloves on localhost:5190).
- OPEN: user reported "can't shoot or reload" on localhost; never reproduced
  (headless + in-app pane both fire/reload fine). Suspects: pointer lock not
  engaged, or a device enumerating as a gamepad (Y cycles weapons, d-pad
  right held swaps). Ask for the console snippet output if it recurs.
- Cache-bust: game.js `?v=to-gl1`, weapons/weapon-model `?v=to-gl1` in every
  importer, glove-model `?v=gl3`, gloves.glb `?v=gl3`.

## Session 18 (2026-09-28): Green Candles redesign SHIPPED
Design pass: https://claude.ai/artifact/C1sceMWU1LyUWGZqR8PPU4 (user: "blueprint
is good", wants very high detail). Recommended options taken: charge shot,
tank-swap reload, held level. Sightless became iron sights (ADS otherwise
stared at the back of the dome).
- **Model**: `models/build_greencandles.blender.py` (Blender 5.2 headless;
  `-- render` for Cycles studio shots, env GC_RENDER_DIR/GC_VIEWS/GC_SAMPLES)
  -> `models/greencandles.glb` (~93k tris, 3 MB), authored in game coords.
  Nodes: GC_Body, GC_BodyPrint, GC_Tank (+GC_TankPrint, GC_GaugeFill),
  empties GC_Grip/Support/Muzzle/Aim. User had "KEEP LIT · NO REFUNDS"
  removed; the tank just says GREEN CANDLES.
- **Loader**: weapon-model.js `preloadWeaponModels` / `buildGreenCandles`
  (scale baked in, GC_TUNE glow levels for ACES, per-instance materials,
  hose pulse shader via a `hoseT` attribute, 2 additive halo sprites,
  `setWeaponEnvMap` = small PMREM studio built in game.js that only these
  materials use). Tank = magMesh, so the PF reload pulls it off. New
  per-mesh hooks: `hipOffset`, `hipYaw`, `pfSupportDrop`.
- **Mechanism**: weapons.js fireMode "charge" + `def.charge`,
  `chargedShotDef(def, level)`, WeaponState `charging/chargeT/chargeCap/
  chargeLevel/cancelCharge`, `fire(cells, kick)`. game.js
  `updateCandleCharge` (its own press latch, not fireEdgeTrigger) and
  `updateGreenCandles` (gauge, candle breathe/flare/low-tank flicker,
  reload dark -> relight, hose pulse, halos, full-charge strain, the
  #to-charge ring). Net shot carries `c` (charge level). Audio:
  candleShot / candleCharge hum / tankSwap.
- **It fires actual green candles** (user ask): ballistics.js CandleRound pool draws each
  candleShot round as an upright candlestick-chart bar (body + wicks + glow),
  bigger when charged; rounds slowed to 110 / 150 m/s with `gravityScale`
  0.25 so you can watch them fly. Menu previews refresh once the model loads
  (Play-tab card, operator, Loadout viewer); the Play-tab thumbnail no longer
  auto-swings (it showed the fat gun from behind). Cache-bust `?v=to-gc2`.
- Test: `tools/troll-ops-greencandles-test.mjs` (19 checks, all pass).
  Shotgun, medal and sync tests pass. fps same as the 416.
- User asked about **realistic gloved hands** (CoD-style black tactical
  gloves, from their reference image): told them yes, doable in Blender with
  a finger rig; it would replace the PF black rods. Not started: ask first.
- **Lobby fixes (same session):** phones start with no mode picked, so the
  Scorestreaks tab only showed the versus-only note: now the picker shows
  until a no-streak mode is picked. "Back to arcade" is a pill left of the
  logo on every size (icon-only on phones; the old corner text and the
  copy hidden in Servers are gone). Landscape phones: short tab labels,
  radio/X/$TRUTHS chips top right (they covered Test Range) and hidden off
  the Play tab; portrait: profile button joins that chip row (it had been
  stuck top-left, unpositioned). Cache-bust `?v=to-lobby1`.
- Next asked: Troll Kombat pause button, better mobile UI, landscape only.

# (previous) end of session 17

Work happens on branch `game-improvements` in the worktree `GitHub/to-opus-wt`,
and each finished piece is fast-forwarded onto `main` (`git push origin
game-improvements:main`): "push" means land it on main. After pushing, also
`git pull --ff-only` in the user's own checkout (`GitHub/mayurski-art.github.io`),
or they see stale files there. github.com DNS drops out now and then; retry the
push in a loop. Sync test: `NODE_PATH=<main checkout>/node_modules node
tools/troll-ops-sync-test.mjs` (passes). Cache-bust in troll-ops.html is
`?v=to-lobby1` (game.js, style.css); bump on any change.
Modules imported with their own `?v=` (medals.js, killstreak-ui.js,
achievements.js, audio.js, and weapons.js + weapon-model.js in EVERY importer)
need that tag bumped too, and every importer of one module must use the same
tag or the browser loads two copies.

## NEXT SESSION: start here
Everything left needs the user first (ask before building):
1. **Username rename list** (bots, killfeed, scoreboard, nametags).
2. **Weapon rename list** (display names only; ids stay, or saved loadouts
   and XP break). Include the Grinmington 870 if they want it renamed.
3. **Custom crosshairs**: which options (style, colour, size, gap, dot,
   outline, per class?).
4. **Battle Royale**: design doc DRAFTED 2026-09-28, waiting on the user's
   decisions: https://claude.ai/code/artifact/b21bbfbf-170d-4fa6-b4ce-1e092fc8df46
   ("Troll Forces Battle Royale design"; a Claude Docs doc, edit it through the
   docs connector). Picks proposed: Troll Royale, 20 players + bots, solo/duos,
   new 400 m Trollface Island (World-page landmarks as POIs), plane drop,
   loot only, 5-phase zone "the Cringe", Troll Court 1v1 second chance,
   streaks off. Phase 1 = Mini Royale on an existing map. No code yet.
5. **Green Candles redesign** design pass (reference notes further down).
Also parked: troll NFT weapon skins (Tank Runner #1718 first; touches
wallets, ask), more radio songs (user sends mp3s), skins on hold.
Not verified on real hardware: medals, the 870, PF arms (headless only). Ask
how they feel on the user's laptop/phone.

## Session 17 (2026-09-28): Grinmington 870 SHIPPED

The BO2 Remington 870 MCS; the user said "you pick" the name + unlock:
**Grinmington 870**, id `grinmington`, shotgun class, **LV 16** (between
the Sawgrin KSG 11 and Guffaw Saiga 24). weapons.js:
- 8 pellets x 19 dmg, spread 0.085 (tighter than the Widemouth), falloff
  7-19 m: one-shot close. Tube of 8, reserve 40. 70 rpm (BO2's rate) and
  `pumpTime: 0.82`, so the pump animation fills the whole shot cycle.
- **Shell-by-shell reload** (`def.shellReload: { start, each, end, rack }`):
  WeaponState stages `shellStage` start -> shell (x N, +1 ammo each) -> end;
  an empty gun's end opens with a rack. `interruptReload()`: fire mid-reload
  stops loading (`fireQueued` fires as soon as it's back up, ~0.26 s); no
  rack if a shell was already chambered. `abortReload()` on a weapon swap.
  reloadT/reloadTime stay a whole-reload estimate. Any weapon can use
  shellReload now (Widemouth/Sawgrin still mag-style: ask before changing).
- `events` ("shell" | "pump" | "rack") are drained by the viewmodel
  (`drainWeaponEvents`) for `audio.shellIn()` / `audio.pump(dur)`.
Model (weapon-model.js `spec.pump`): ribbed forend group on a longer mag
tube (cap + barrel clamp); the support hand is parented to the forend, so
`userData.pfAnchors` is pre-set (the PF arm lookup only scans direct
children). `pumpMesh`/`pumpRestZ`, `shellMesh` (red hull, brass head),
`loadPort`. game.js: `shellReloadPose` (gun rolls port-side toward you,
muzzle up, a shove as each shell seats; support rod follows the shell via
magHold), `placePump` (forend back/home after a shot and on the rack),
`placeReloadShell`.
Test: `NODE_PATH=<main checkout>/node_modules node tools/troll-ops-shotgun-test.mjs`
(14 checks, all pass). Sync test passes solo.

## Session 17 (2026-09-28): BO2 medals SHIPPED

User picked: **Oswald** (not Barlow), **drawn badges** (not trollface art),
**+points shown**, **sound sting**. Built from the mockup:
- `medals.js` (new): the catalog (label -> shape/glyph/metal/pts; shield =
  kill, chevron = multikill, star = streak, hexagon = feat; silver/gold/red
  = rarity) and `badgeSvg`/`medalSvg`. "N Kill Streak" and "N× Multi Kill"
  are pattern families. Labels compare case-insensitively.
- `killstreak-ui.js`: `splash()` = badge + title + gold +pts under the
  crosshair (top 60%), newest on top, older shrink/fade/lose the badge, max
  3. `banner()` = the "UAV READY / Press 4 to call it in" bar (top 12.5%),
  also used for a peer's Nuclear callout (red). One sting per burst, pitched
  for the rarest metal (`audio.medal(metal)`).
- **Medal points are real**: `onPoints` pays them into the scorestreak meter
  and match XP (PvP). The headshot XP bonus moved INTO the Headshot medal
  (+50), so kill XP totals are unchanged; streaks now fill a bit faster
  (BO2-accurate). XP pops moved above the crosshair (top 41%).
- Streak rungs 3/5/7/10 are star medals now (the old "RAMPAGE — 5 in a
  row" wave banner is gone).
- New medals: **Avenger** (kill the enemy who killed a teammate within 5 s,
  `recentTeamKillers`), **Suicide** (PvP, 0 pts).
- After-action: badge grid with counts + "Medal bonus +N".
- Test: `NODE_PATH=<main checkout>/node_modules node tools/troll-ops-medal-test.mjs`
  (`OUT=<dir>` for screenshots), all pass. Cache-bust `?v=to-medals2`
  (game.js, style.css, killstreak-ui.js, medals.js, achievements.js, audio.js).
- Sync test: "infection: everyone starts a survivor" is timing-flaky under
  load (fails on unchanged main too when two runs share the machine).
Waiting items: see "NEXT SESSION" at the top.

## Session 16 (2026-09-27): logout -> guest fix, then PAUSED by the user

Fixed "Bugs to fix next" #1 (logged out, still `troll_runner`), in
`assets/js/troll-accounts.js`:
- `logout()` ignored signOut's result. supabase-js 2.110 keeps the stored
  session when the access token has expired and the refresh can't go
  through (sessionError path), so the page looked signed out and the next
  load restored the account. Now on any error it removes
  `trollrunner-accounts-auth` and the SSO cookie itself. Reproduced headless
  (expired token + API blocked): old code left the session stored, new
  clears it.
- Cross-origin: sign-out stamps a `trollrunner_sso_out` cookie (time);
  each origin keeps `trollrunner-accounts-auth-at` (set on a SIGNED_IN with
  NEW tokens, on cookie adoption and on the iframe bridge). A local session
  older than the last sign-out is dropped BEFORE createClient (else
  INITIAL_SESSION re-mirrors it into the SSO cookie). Only on
  *.trollrunner.net; not testable on localhost.
- Same-origin tabs: a `storage` listener dispatches auth-changed(null).
Test gotcha: troll-ops.html loads troll-accounts.js from the ABSOLUTE URL
`https://mayurski-art.github.io/assets/js/...`, so headless tests run the
LIVE file unless they route that URL to the local copy.

**Session 16 later (resumed): shipped** end-of-match medal list
(killstreakUi.medal/count/medals(), repeatable Revenge/Longshot/Shutdown via
Achievements onRepeat, "N Kill Streak" rungs, renderMatchMedals on the
game-over panel), range N key + Esc-menu bot buttons, PF arms/reload/
sprint/turn/slide (below), touch EMOTE button + X-hold duo accept,
inspect no longer cancelled by sprinting (user: PF lets you admire the gun
while running), compact Test Range strip on touch. Cache-bust
`?v=to-medals1` (game.js, style.css, killstreak-ui.js, achievements.js).
**BO2 medal mockup** for approval: https://claude.ai/artifact/KBMEkVCr471CLRCqWM5NBG
(drawn silver/gold/red badges: shield = kill, chevrons = multikill, star =
streak, hexagon = feat; centre stack; "UAV READY" banner; after-action grid
with icons). Open questions on the page: font (Barlow Condensed vs Oswald),
drawn badges vs trollface art, show +points or not, a sound sting. Build it
into killstreak-ui.js + renderMatchMedals once the user answers.
**Still waiting on the user:** username + weapon rename lists, Remington
shotgun (name + unlock level), crosshair options, and design docs for
Battle Royale + the Green Candles redesign. Details in the reminders below.

### PF build, session 16: user picked arms + reload + sprint/turn feel
(NOT the flat one-colour guns). All in game.js, shipped:
- `pfArms` / `posePfArms(mesh, magBlend)`: two black MeshBasicMaterial
  rods (unit cylinders, `stretchBetween`) from `PF_ARM_SHOULDER` to the
  hidden hand anchors; the support tip drops `PF_SUPPORT_DROP` under the
  handguard; sidearms put both on the grip. Anchors are cached per mesh
  as `userData.pfAnchors` (support = the hand at `supportHandPos`; build
  order differs per model). Hidden during inspect (inspectArms has its
  own), melee, streak devices.
- Reload: `reloadPose` = envelope only (roll 0.72 rad, sidearms x0.55) +
  `magT`/`magHold`; `placeReloadMag(mesh, t)` runs AFTER the gun is posed
  (screen-space targets need this frame's matrix): rest -> `MAG_HOLD_SCREEN`
  (visible, low-left, slerped upright to `MAG_HOLD_QUAT`) -> off-screen
  `MAG_DROP_SCREEN` swap -> back. Sidearms: straight down in gun frame.
  The support rod follows the mag by `magHold`.
- Sprint cant `sprintCant` (yaw, muzzle up-left), turn lag `turnLagX/Y`
  from look rates (position + yaw + roll), slide camera roll `slideTiltT`.
- Test hooks added: currentWeapon, tryReload, switchWeapon, pfArms,
  setAds, openPauseMenu, endMatch. Screenshot scripts were scratchpad-only.

### Phantom Forces video study (user sent a clip, 2026-09-27)
Source: a 22 s phone recording of a TikTok live of Phantom Forces (Roblox),
`Downloads/ScreenRecording_09-27-2026 20-57-08_1.mov` (888x1920, game area
is y 340-1600). User: "really study the various mechanisms... jumping,
sliding, reloading, aiming, speed, sensitivity... look at the arms,
there's no hands, the front end of the arms are 'hands', black coloured"
+ "study the weapon design too". Nothing built yet; confirm before building.
What the clip shows:
- **Arms:** two thin, pure-black, unlit tapered rods rising from off the
  bottom of the screen. No hands, no fingers, no visible elbow. The rod's
  tip IS the hand: the right rod ends at the pistol grip, the left rod at
  the handguard or magazine. They read as silhouettes, so they never fight
  the gun's colours. Troll Forces today hides its first-person hands on
  guns (user choice, session 9); PF's rods are the answer to "arms without
  ugly hands". Build: one tapered cylinder per arm, MeshBasicMaterial black,
  from a fixed off-screen shoulder to the existing grip/support anchors
  (`gripPos`/`supportHandPos`, the same targets `inspectArms` uses).
- **Weapon design:** low-poly, flat-shaded, one solid colour per gun (the
  AK is plain copper/salmon with a slight sheen), true-to-life
  silhouettes, chunky parts (big mag, top cover, tall front sight). The gun
  is BIG in view: bottom-right ~40% of the screen, muzzle pointing in
  toward the centre. The skinned C7A1 wears a black camo with copper
  crack lines over the same geometry. Loadout menu = a pegboard "gun
  wall" with the weapon hung on it, class tabs (Support, Recon, Carbine,
  Shotgun), blueprints/custom-slot cards.
- **Reload:** the gun rolls ~35-45° (muzzle up, mag side facing you), the
  left rod pulls the magazine out and down off screen, a fresh mag rises
  on the rod and seats, then the gun rolls back. The mag is its own mesh
  that travels with the arm; the old mag is not dropped in the world.
- **Sprint / move:** heavy weapon lag and roll when turning; sprint cants
  the gun diagonally (muzzle up-left). Weapon switch dips the gun off the
  bottom and raises the next.
- **Slide:** camera drops low and fast (sliding down the escalator), gun
  lowered and canted; momentum carries on slopes.
- **Aim (ADS):** iron sights centred, the gun's top (rear sight, top
  cover) fills the lower middle; modest zoom. Hip crosshair is tiny ticks.
- **Melee:** a quick-melee item (pink, held on the black rod) swings out,
  then the gun comes straight back.
- **Feedback:** floating damage numbers in orange italic at the hit (18,
  29), a red arc round the crosshair pointing at the damage source, small
  serif italic score lines ("+100 Enemy Killed", "Headshot Bonus", "Assist
  Counts As Kill"), "Hold [V] to pick up [MOSIN NAGANT]" prompts.
- **Speed / sensitivity:** can't be measured from a phone-filmed stream
  (no input, variable frame timing). Tune by feel against PF instead.
Already in Troll Forces (don't rebuild): slide, dive-to-prone, vault
(movement.js), idle sway + walk bob, damage numbers, hitmarkers, a
damage-direction indicator, weapon pickups. Gaps worth proposing: the
black rod arms, the mag-in-hand reload with a gun roll, sprint cant and
turn lag, slide camera, and a flatter one-colour weapon look (clashes
with skins on the 416; ask).

### FIXED (session 16): can't click "Spawn a bot" in the Test Range
Shipped: N key in the range, Spawn a bot (n/6) + Clear bots in the Esc menu
(renderPauseRange; Clear uses net.dropBot so rigs go too), HUD button kept
for touch and shows <kbd>N</kbd>. Headless gotcha: Esc does NOT release
pointer lock under Playwright, so mouse clicks land on the canvas; call
document.exitPointerLock() before clicking menu buttons in tests.
The button (`#to-range-spawnbot` in troll-ops.html, click handler
`spawnRangeBot` wired at game.js ~6561) lives in the in-match HUD, which is
only on screen while the mouse is pointer-locked to aiming. A locked cursor
can't click anything, and Esc (unlock) opens the pause panel on top, so on
desktop the button is unreachable; only touch can use it. The same trap
applies to ANY clickable control in #to-hud (check for others while fixing).
Proposed fix (confirm with the user before building):
1. **A key for it** while playing the range: e.g. `N` = spawn a bot (check
   it's free first: B third person, H emotes, T inspect, X pick up,
   Enter/Y chat, G/F grenades, 4/5/6 streaks, -/= sens, [/] fov). Show it
   on the button as `<kbd>N</kbd> Spawn a bot` like the sens/fov rows.
2. **The same button in the Esc pause panel** when the match is the range
   (plus "Clear bots"), where the mouse is free, so it's clickable too.
3. Keep the HUD button for touch (body.to-touch-play) and have it NOT take
   focus/pointer on desktop (it's a label there, not a trap).

## Session 15 (2026-09-27): emotes: first person, third person, duo

User ask: emotes in first person, third person, and duo emotes you invite a
teammate to by aiming at them (they hold X). Decided with the user: the
"troll starter pack", duo partners snap face to face, teammates only, 6 s
invite, hold X to accept.
- `emotes.js` holds the list: 3P (the 4 dances, Trollface sit, Dab), 1P
  (Point & laugh, L on forehead, Gun spin, Facepalm: `fp(t)` gives hand
  targets in viewmodel space + camera motion; `pose` is what others see),
  DUO (Dap up, High five, Chest bump, Duo dance: `pose[0]` inviter,
  `pose[1]` accepter, `dist` apart). Wire code: index+1, +64 for the
  accepter's half (emoteCode / poseEmoteCode). FP_HAND_POSES (point, L,
  flat) are merged into hand-model.js's HAND_POSES at startup.
- Wheel (emote-wheel.js) is a ring of all 14, tagged 1P/3P/DUO; duo slices
  are greyed until the crosshair line passes through a teammate's body
  (findDuoTarget: 0.9 m column, feet to head, in sight, within 10 m).
- Duo flow (game.js): pick -> net `{t:"duo", k:"invite", to, e}`; the
  teammate sees "<name> wants to Dap up: hold X" (ring fills, 0.5 s);
  accepting sends `k:"accept"` with the midpoint + direction, both snap and
  start. While an invite is up, X accepts instead of picking up.
- 1P emotes stay first person (the streak arms' real hands, layStreakArm);
  3P and duo pull the camera out (duo at a 3/4 angle, centred on the pair).
- Test: `tools/troll-ops-emote-test.mjs` (two tabs). Sync test still passes.
  The new/changed modules are imported with `?v=to-emotes1`.

## Session 14 (2026-09-27): match chat + in-game profiles

User asks: a chatbox in Troll Forces (match only; the site-wide TROLLCHAT
room was removed from trollrunner.net the same day, DMs/groups kept as
"Messages"), and the player profile inside the game.
- **Match chat** (`chat.js`, class MatchChat): rides the room's broadcast
  channel as `{ t: "chat", n, u, tm, x, tt }` (net.sendChat / onChat);
  nothing is stored. **Enter** = all, **Y** = team (team modes; receivers drop
  the other side's team lines). T stays weapon inspect (it was taken). While
  typing, the input swallows keys and game keys are cleared. Log lives in
  #to-hud bottom-left above the gear chips; closed it shows the last 6 lines
  for 9 s. Touch has no way to type yet.
- **Profiles**: each player's account id travels in hello/here (`u`, uuid-
  checked) as `peer.uid`. Names open the site's profile card
  (TrollrunnerAccounts.openProfileCard) from chat, the paused roster (a
  scoreboard copy) and the lobby "In the room" list. The lobby header has a
  round **your profile** button (openProfile, or sign-in when signed out).
  The Tab scoreboard itself can't be clicked (mouse is locked there).
- Test: `NODE_PATH=<main checkout>/node_modules node tools/troll-ops-chat-test.mjs`
  (two tabs, fake accounts). The sync test still passes.

## Session 13 (2026-09-26): GTA 6 skin "Vice Grin" + skin editor upgrades

Worked in the user's own checkout on `main`, committed + pushed at the end.
**Vice Grin is Final locked** (user, 2026-09-26). New skin `vice` / "Vice Grin" in skins.js, built from Deep Cover
(banner-11) and the GTA VI robbery key art (`skin-art/vice-robbery.jpg`, from
`banners/Jason_and_Lucia_Robbery_With_Logo_landscape...avif`). The user designs
it in the editor; don't overwrite their crops.

Skin tooling added (tools/troll-skin-draw.js, -editor.html, -editor.mjs):
- **Joined box:** `crops.receiver` = one box for upper + lower (JOINS /
  splitJoins); the art runs across the seam. Only skins that have it.
- **Any picture per part:** `art: { part: "banners/banner-11.jpg" }` (a path
  with a folder is under assets/images; bare names are skin-art). Editor strip
  of every banner + skin-art picture (server `GET /images`); Save writes `art`.
- **Text areas on a part's own picture:** `art: { part: { file, textAreas } }`,
  flipped in place on the right side (sides formula).
- **✂ Snip** (S): drag a part-shaped rectangle on the picture, like a screenshot.
- **Box opacity** slider (fades the picture INSIDE the coloured boxes; outside
  stays full), **box layer order** (▲▼ column, PgUp/PgDn; editor view only).
- **Part layers:** `layers: { part: [{ file, src, at, rot, flip, opacity,
  feather, text, lock }] }` lay pieces of any picture over a part's locked
  base without moving it. Edited in the Layers panel + flat part view under
  the parts table. `text: 1` flips a piece in place on the right side.
  Layers flip with ⇆ (`flip`) / ⇅ (`flipY`). **Opacity eraser** (🧽, E) and
  🖌 Restore paint a per-layer mask on the part view (Strength caps how far
  one stroke fades); Save writes it to
  `assets/images/skin-art/masks/<skin>-<layerId>-<ver>.png` (older versions
  of that layer's mask are deleted) and the layer keeps `mask: "<file>"`.
  Unsaved strokes live in the draft as `maskData`. Wheel over the picture
  zooms a selected layer's snip; Size slider and +/− size it on the part.

Vice's stock: plain sky base + the GTA VI logo as a `text: 1` layer, so it
reads correctly on both sides. The raw source files
`banners/gta6-trollbanner.webp` and `banners/Jason_and_Lucia_...avif` are
left untracked on purpose (unused by any skin; banner-17.jpg and
skin-art/vice-robbery.jpg are the converted copies).

### Idea (user, 2026-09-26): troll NFT based weapon skins
Make weapon skins from the user's troll NFTs (OpenSea collection
"trollsoneth"; see the autotrollinfo skill). Thoughts to explore, nothing
decided: a skin per NFT (or per trait set) using the PFP art as banner/layers;
possibly unlocked by holding that NFT (wallet check via the Phase 10 wallet
layer, flag-gated) or as cosmetic-only for everyone. Ask the user before
building; it touches wallets/ownership.

**First candidate: TROLLS #1718 "Tank Runner"** — the user's own troll
(troll_runner bought it for 0.11 ETH, 2026-09-27; lore §66 in
trollrunner-terminal/docs/TROLL-LORE.md). Moustache trollface, black "U MAD
BRO?" cap, neon-green tank top reading RUNNER, grey stone gradient. The art
(1000x1000) is copied to `assets/images/skin-art/trolls-1718-tank-runner.jpg`
(source: trollrunner-terminal/public/lore/), so it's already in the editor's
picture strip. Neon green + black palette. When built: mark text areas round
"U MAD BRO?" and "RUNNER" so both read correctly on the right side.

## Session 12 (2026-09-26): Halloween map "Hollowgrin"

Worktree `GitHub/to-halloween-wt`, branch `halloween-map` (from main cdc07c9).
User ask: "create a halloween themed map. take your time... think deeply.
this map should be able to be played in multiplayer and zombies mode."
Decided with the user: Zombies stays ONE mode; its map card gets a **Change**
button that picks between The Pentagrin and the Halloween map (not a second
mode row).

**Also noted, NOT started: GTA 6 themed skin for the Problem 416.** The user
will SEND the image (GTA-style troll art). When it arrives: put it in
assets/images/banners (or skin-art), add a SKINS entry in skins.js, bake,
then the user fine-tunes the crops in the skin editor. Follow the sides
formula (mirrored placement, text readable on both sides).

### Plan
Map id `hollowgrin`, its own module `hollowgrin.js` (like pentagrin.js),
procedural three.js geometry (no GLBs), registered in MAPS so it's in the
PvP picker too. Night, full moon behind the manor, purple fog, jack-o'-lanterns
(emissive, flicker via onBeforeRender). Only a handful of real lights, all
built at load: NEVER add lights at runtime (see light-pool.js).
- North: **Grinmoor Manor**, 2 floors (ground y 0, upper y 3.6), grand stair
  in the foyer, balcony over the front porch, doors on every side.
- Centre: town square round a dead oak: pumpkin stalls, hay bales, well, cart.
- West: **graveyard** (tombstone rows as low cover, iron fence with gates, a
  mausoleum you can enter). Zombies claw up out of the graves.
- East: **pumpkin patch + corn rows** (tall soft cover, bullets pass), scarecrow.
- South: candy shop + barn. Team spawns split north/south.
Engine work so zombies runs on a map other than the Pentagrin:
1. ZombieDirector takes a per-map zombie layout (windows, floorOf, floors,
   stair links) instead of importing pentagrin.js directly.
2. Zombies on another floor walk to the stair link, climb it, then chase.
   FlowField gets a `needSupport` option so upper-floor fields don't route
   through thin air.
3. Grave spawns rise out of the ground.
4. Max Ammo drop (once a round), so zombie runs don't run dry (both maps).
5. Lobby: zombies map pool + Change button, with its own saved zombies map id.
Verify with tools/troll-ops-map-audit.mjs, -walk, -shots and -fps (NODE_PATH =
main checkout node_modules), plus a zombies logic check, then screenshots.

### Status: v1 SHIPPED to main (cache-bust `?v=to-s12a`)
All of the plan above is built and checked headless:
- Map audit PASS (no traps/floating/blocked spawns; upstairs, balcony and
  mausoleum reachable). fps from the aerial view: 34.8 (Cul-de-Grin 38,
  Grin Site 44), 278 draws/frame (fewer than either).
- Zombie routing sim: 24/24 zombies reach the player across 9 cases (ground to
  upstairs, upstairs to ground, into the mausoleum/corn/shop/barn).
- Live zombies match: grave rises, Max Ammo drop + pickup refills reserve.
- TDM with bots: spawns split N/S, bots cross all three lanes, kills land.
- Lobby: Zombies map card shows Change (Pentagrin / Hollowgrin); picking one
  is saved as `poolMapId`, separate from the versus `mapId`.
Things learned:
- Zombies step ~0.5 m but FlowField treated anything under 1 m as walkable,
  so zombies jammed on hay bales, wells and tables. New `navStep` layout
  option (0.45). Also applied to the Pentagrin, which FIXES a pre-existing
  main bug: zombies stuck at the boardroom table at (0.3, -11.4).
- Interiors at night go black on hemisphere light alone: interior materials
  use `bounce` (emissive = the texture, x0.2) instead of more real lights.
- metreUVs must pick the projection per triangle, not per vertex, or low-poly
  cylinders (the obelisk) smear.
- `matchMapId()` in game.js decides a match's map from the mode itself
  (forceMap / mapPool / room map), not from lobby UI state.
- Test hooks added: `__trollOps.zdir()`, `__trollOps.loadedMapId()`.
Ideas not done: zombie economy (doors, wall-buys, box) is still Pentagrin Z2
backlog for both maps; co-op zombies; remote players on the upper floor for
bots (bots nav is ground-floor only, like every other map).

## Reminders from the user (2026-09-27, not started)

- **Change the usernames.** The names shown in-match (bots, killfeed,
  scoreboard, nametags) need a pass. Ask the user what they want them
  changed to before touching anything.
- **Change the weapon names.** Rename weapons across the loadout, killfeed
  and HUD. Get the new list from the user; weapon ids/storage keys should
  stay put so saved loadouts and XP don't break (display names only).
- **DONE session 17.** **Restyle the killstreak and medal callouts.** The font and display of
  the on-screen titles: HEADSHOT, REVENGE, AVENGER, SUICIDE, double/triple
  kill, the streak "ready" notes, etc. (killstreak-ui.js badges). Target
  look: **Call of Duty: Black Ops 2** — its medal/splash style (the medal
  icon with the title and "+score" underneath, stacking centre-screen,
  BO2's condensed uppercase font). This includes the medal badges
  themselves (the icon art), not just the text. Confirm the look with the
  user (mockup first).
- **DONE session 16-17.** **Show earned medals at the end of the match.** Like BO2's after-action
  screen: the post-match summary should list every medal/badge earned that
  match (with counts, e.g. HEADSHOT x4), not just flash them mid-game.
- **New game mode: Battle Royale.** The user wants a battle royale mode
  added to Troll Forces. Nothing decided yet: player count / bots filling
  the lobby, map (a new big map vs. an existing one), drop-in, shrinking
  zone, looting vs. loadouts, solo/duo/squads. Big build: draft a design
  doc and settle those with the user before any code (see the "design doc
  before big builds" rule).
- **DONE session 17 (Grinmington 870).** **Add a Remington shotgun.** Like the Remington 870 MCS in Call of Duty:
  Black Ops 2: pump action (a pump per shot, shell-by-shell reload you can
  interrupt), wide close-range pellet spread. New weapon in weapons.js +
  model + loadout slot + unlock level; ask the user for its in-game name
  (weapon names are also due a rename pass, see above).
- **Custom weapon crosshairs.** Let players customize their aim crosshair
  (style, colour, size, gap, dot, outline; maybe per weapon class), saved
  with their settings. Ask the user what options they want first.

## Reminders from the user (2026-09-26)

- **More songs to add.** The user has more tracks for the in-game radio.
  Ask them for the files, drop the mp3s in `music/` and add each to
  `TRACKS` in `music.js` (title, artist, src). Radio shuffles by default now
  (storage key `trollops:radio-v2`).
- The game is now called **Troll Forces** (display name only; the URL,
  folder, storage keys and ids still say troll-ops on purpose).
- Done 2026-09-26: **emote wheel** (hold H, emote-wheel.js; emotes are
  `DANCES` from character.js, index rides the state packet as `em`,
  front-facing emote camera; moving/firing/8 s ends it). Not yet on the
  touch HUD, and remote emotes aren't covered by the sync test. Also done:
  two-handed gun hold (chest `gunMount` + arm IK, needs `gripPos` and
  `supportHandPos` on a weapon mesh), weapon preview stage right of
  Loadout/Customize/Gear/Scorestreaks, primary thumbnail in the Play card.

## Session 9 task list (2026-09-25)

**Skins are ON HOLD** (user: no more skins for now). Work these instead:

1. **Startup lag.** On the user's HP laptop the game lags for ~30 s after
   loading, then runs smooth. Likely shader compiles / texture uploads / model
   streaming happening mid-play: warm them up behind the loading screen.
2. **Care package animation.** Needs work; sometimes when deployed it looks
   like the hunter-killer drone deploy animation plays instead (glitch).
3. **Grenade deploy glitch.** Believed fixed; re-check and harden anyway.
   **Smoke grenade**: add one if it doesn't exist.
4. **Team Deathmatch = first to 50 kills.**
5. **Every device**: iPad, desktop, laptop, phones. Phones play in
   **landscape** with a CoD Mobile-style touch HUD (left move stick, right
   look area, fire/ADS/jump/crouch/reload/grenade buttons; rotate prompt in
   portrait).
6. (Added mid-session) **Keyboard Warrior RGB wave**: glow between the keys
   sweeping along the board like a gaming keyboard.

### Session 9 status: ALL DONE and on main (last commit bd93ae0)
1. Lag: the cause was runtime lights. Every grenade/blast/fire pool/gunship
   searchlight added a light, and each new light COUNT recompiles every lit
   shader (2-2.6 s freezes, smooth once each count had been seen). Now
   `light-pool.js` (3 point + 1 spot, parked at 0) is borrowed from; grenade
   glow is emissive; third-person guns `stripLights()`. `warmShaders()`
   compiles during staging. `adaptResolution()` scales pixel ratio from fps.
   **Rule: never `new THREE.*Light` at runtime in the world scene.**
2. Care package: the "hunter-killer glitch" was key 4 firing the PRICIEST
   ready streak (HK 350 > package 300). Keys 4/5/6 now call their own row;
   touch taps the row. The drop itself: heli pass, freefall, chute, sway,
   thump, fold, green smoke (all from `age` + id hash, so clients agree).
   Also `groundAimPoint` had never used the crosshair: `raycastWorld`
   returns a DISTANCE, not an object.
3. Grenades: `cancelCook()` on death/pause/blur/unlock (releasing G on the
   death cam used to throw one); throw origin can't pass through a wall.
   Smoke already existed (tactical, rank 4).
4. TDM `scoreLimit: 50`.
5. Touch (body.to-touch-play, --k scale by height): floating stick, left
   FIRE, drag-to-aim right FIRE, TAC button, counts on grenade buttons,
   streak rows tappable + CONFIRM while marking, rotate card in portrait,
   fullscreen + orientation lock where supported (Android).
6. Keyboard RGB: underglow sheet + rim strips + legends share one shader
   clock (`KB_RGB_TIME`, stamped in onBeforeRender).
7. (Late asks) The in-game 416 now matches the skin editor: **no
   first-person hands on guns** (user picked "hide the hands"; meshes stay,
   tagged `userData.hand`, just invisible; melee + streak device keep
   theirs). The Problem 416's **butt pad and charging handle wear the skin's
   accent** (red-orange), the "two pops of colour on the stock" the user
   liked from an older build.

### Open / offered, not done
- In-game lighting makes the gun paler than the editor (whites read blue:
  weaponScene's AmbientLight 0xaab8ff + rim light). Offered "match editor
  colours"; the user chose only hiding the hands. Ask before changing.
- Not verified on real hardware: the user's HP laptop, a real phone/iPad
  (headless + emulation only). Ask how it felt.

## NEXT: Green Candles redesign (user asked 2026-09-25, NOT started)

User: "take your time in redesigning the green candles weapon. I believe we
already have this weapon but it's a very terrible version. And also make sure
that the mechanism of the weapon is pristine as well." Asked to park it here
until the streak work is done. Ask before starting; do a design pass first
(see the design-doc-before-big-builds rule).

Existing version: `weapons.js` id `greencandle` (rank 28, sight none),
model in `weapon-model.js` (~line 78: "side tank ('Green Candles'), fed by a
hose forward into the horn"); its cell glow used to be a PointLight, now
stripped (`stripLights`, never add runtime lights: light-pool.js).

Reference art the user sent (two images, in chat only, not on disk: ask
them to drop copies into assets/images if you need the files):
1. The trollface character in a black "problem?" tee with a brown backpack,
   holding the gun up two-handed like a Ghostbusters thrower, blue sky.
2. A clean product render of the same gun standing upright, grey background.
The gun, from the render:
- Main body: a tall cone/bottle shape, matte dark grey, widening to a
  rounded, domed base (a separate base ring with a round button/port on
  its side).
- A brass/gold banded mid-section (vertical panel seams) between the grey
  base and a dark grey collar near the top.
- Muzzle: a glowing lime-green translucent cylinder (a "candle") sitting in
  the collar, with a thinner green nub/wick on top. This is the emitter.
- Side tank: a smaller grey cylinder clamped to the body's left side on a
  bracket, "GREEN CANDLES" printed vertically on it, a glowing green
  vertical window slot (fill gauge) down its length, metal end caps.
- A glowing green ribbed hose arcs from the tank's top into the body just
  under the gold section.
- Red and blue wires loop from the tank's bottom cap into the base.
- Details: a small screw, a round dial/indicator with a green light on the
  lower body, a panel seam/latch on the right side.
"Mechanism pristine": the firing behaviour, recoil, reload (tank swap?),
glow feedback (gauge drains with ammo, candle pulses on fire) all need to
be clean, not just the model. Check how it fires today before proposing.

## Session 11: scorestreak + streak animation overhaul (2026-09-25)

### Status: done, verified headless, pushed to main (see git log)
BO2-accurate rework of every streak, on the user's ask ("all scorestreaks
need to be very accurate to call of duty black ops 2, including care
packages", "not so rushed", "lightning strike: I want to see the tablet and
choosing target spots, then the explosions"):
- **Lightning Strike** (`streak-tablet.js`, new): a rugged tablet slides up
  with an orthographic overhead render of the live map (render target ->
  canvas, gamma by hand, fog off for the shot), blips, you-arrow. Mark 3
  spots (mouse moves a reticle while pointer-locked, click marks, right
  click undoes, Esc cancels; pad sticks/A/B; touch taps). Player frozen
  while it's up. Nothing spent until the 3rd mark. Then `AirstrikeRun`
  per mark (strikeDelay(i) = 4 + 1.7 i s): red smoke, a jet on one
  constant-speed line, 5 bombs released and falling on real arcs, blasts in
  game time. Wire: `mark` with `runs: [{x,z,delay}]` + yaw/team (old single
  x/z still accepted).
- **Care package**: hold a smoke marker (viewmodel `buildMarkerDevice`),
  fire/its key throws it (`MarkerCanister`, bounces, settles, red smoke).
  Wire `marker` (throw origin/dir, copies fly it for show) then `drop` at
  the rest point (replaces the copy). Heli brakes into a hover over the
  smoke (s = v(t - h tanh(t/h))), crate slung on a cable, cut at 6.5 s,
  free-falls (no chute in BO2), slams down, crushes anyone under it
  (owner decides, 400 dmg, killfeed "Care Package"). Floating icon of the
  contents (`streakIconTexture`). Capture: owner 0.8 s, teammate 1.6 s,
  enemy steal 3.5 s ("Stealing the care package…").
- **Hunter-Killer**: comes out in the hand (viewmodel = the real drone
  model), spins up, tossed at 0.6 s (`launchPendingDrone`; target picked
  at the toss, LOS-preferred). Climbs (cut short under a roof), then
  hunts: straight at the chest when visible, else follows the bots' flow
  field (`droneRoute`, nav.js, per floor height). Swept AABB collision
  (`sweepWorld` gives the face normal) so it slides along walls with 0.35
  m clearance; hitting cover within 6 m of the target detonates. Retargets
  when the target dies (`retarget` msg). Splash via areaDamage (spares
  teammates, hurts the caller). Red LOCKED bracket on the target
  (`.to-hk-lock`). Copies fly the same steering; target can be the local
  player ("HUNTER-KILLER INBOUND — MOVE"). Test over 6 maps, 73 launches:
  0 clips, 67 hits, 4 cover blasts near the target, 2 expired (Depot).
- **Gunship**: heading from the path derivative (was tail-first), muzzle
  and searchlight on the nose (-z), flies in and out from off the map
  (HELI_ENTER/EXIT), fires only with line of sight, cosmetic tracers on
  every client (copies can target the local player).
- **UAV**: remote-press beat, plane circles high for the whole duration.
- **Blasts** (`BlastFx`): fireball (additive core + opaque body), smoke
  column, shock ring; no lights.
- **Tablet/device**: raise and lower animate both ways; the gun comes back
  from the lowered pose. Pre-existing bug fixed: updateMeleeView re-showed
  the gun every frame, so it sat beside any streak device.

Test scripts live in the session scratchpad (not the repo): streak-shots,
strike, cp, hk, hklogic (drone pathing over maps), remote (every streak
wire message against one client). Worth moving into tools/ if reused.

### Original bug list (all fixed above)

User: "really fix the scorestreaks and scorestreak animations, they are quite
buggy, the biggest issue for now". Filmed every streak headless (scratchpad
harness: grant a streak, call it, screenshot a sequence with a chase camera
rendered from a second PerspectiveCamera over the game scene).

Bugs found:
- Gunship flies TAIL-FIRST its whole orbit: wantYaw = -tangent + PI/2 is the
  mirror of the model forward (-sin yaw, -cos yaw). Its muzzle and
  searchlight sat at +z = the TAIL. It also popped into existence mid-orbit,
  started at yaw 0 and blinked out at the end. No tracers.
- Lightning Strike jet: lerped 24 m in 2.4 s (crawling), then jumped to
  40 m/s; spawned 12 m from the mark in plain sight; bombs were setTimeout
  (ignored pause, not tied to the jet) and exploded with no bomb visible.
  Explosions were sparks + a light only.
- UAV recon plane popped into existence 34 m above the caller.
- Hunter-Killer: remote copies were updated with a null target, so on
  everyone else's screen it flew straight north and blew up wherever it got.
  Plus every item in "Bugs to fix next #2" below.
- Streak device: gun/device swap was an instant pop both ways.
- Care package: sway snapped to 0 on touchdown; crate blinked out when opened.

## Graphics setting (session 10, on main)
Settings → Graphics: Auto / High / Medium / Low, in both the lobby and Esc
panels (`settings.gfx`). High = SSAO + bloom + 2048 shadows, Medium drops
SSAO (the big one: it re-renders the scene every frame; measured 21 → 31
fps), Low also drops bloom and uses 1024 shadows. Auto sheds tiers BEFORE
resolution when a 2 s window is under 40 fps, climbs back after 3 windows
over 57, won't retry a tier that just failed, and remembers where it
settled per device (`trollops:gfx-auto`). Tiers never change shadow type
or light count (that would recompile every shader mid-match). Purely local.
Hook: `__trollOps.gfx()`.

## Inspect animations (session 10, on main)
- **Long guns (4.2 s):** raised to screen centre side-on (left side, muzzle
  left, whole gun fills ~72% of the width, aspect-aware), slow drift, a
  wrist twist through muzzle-away to the right side, drift, back to the
  hip. Keyframed in `GUN_INSPECT_KEYS` (Catmull-Rom via `sampleKeys`),
  blended from the live hip pose by `applyGunInspect`. Sidearms keep the
  old 2.2 s twirl.
- **Showcase arms:** the block hands stay hidden (the user's rule); during
  the gun inspect only, `inspectArms` draws sleeves from off-screen
  shoulders to fists at the built hand anchors (support fist dropped under
  the handguard so it doesn't cover the skin). Shoulders swap with
  sin(yaw) so the arms never cross.
- **Keyboard Warrior (3.6 s):** wind-up, toss with an end-over-end flip,
  floats centre screen keys-out (esc left, RGB running), barrel-rolls down
  into a catch. The hands are moved into the rig and sink off screen while
  it's airborne; `restoreMeleeHands` puts them back whenever the toss
  isn't playing (cancel, death, weapon swap, mesh rebuild).
- Test hook: `__trollOps.setInspectFreeze(t)` pins the animation at t.

## Bugs to fix next (reported by the user 2026-09-25, not started)

1. **FIXED in session 16 (see top).** **Logged out, but Troll Ops still says `troll_runner`.** After logging
   out, opening Troll Ops should make you a guest; instead the callsign is
   still the account. Name comes from `playerName()` in game.js (~1597), which
   reads `TrollrunnerAccounts.getCachedProfile()`. Suspects, check in order:
   - `assets/js/troll-accounts.js` `adoptSsoCookie()`: if the logout ran on
     another origin/subdomain, the shared SSO cookie may not have been
     cleared (`writeSsoCookie(null)` has to run on sign-out, on the same
     cookie domain), so Troll Ops adopts the old session again.
   - This origin's own Supabase session in localStorage survives a logout
     done elsewhere (`adoptSsoCookie` returns early when a local session
     exists, so a stale local session wins over a missing cookie).
   - game.js only redraws on `trollrunner:auth-changed`; make sure a
     sign-out fires it and that a stale callsign/net name isn't kept.
   Repro: log in, log out from the main site, open /troll-ops. Expect
   "operator"/guest.

2. **Hunter-Killer drone is dumb and just crashes.** User isn't sure the
   homing works at all. Code: `case "drone"` + `spawnDrone()` in game.js
   (~600-670), the detonation block in the streak loop (~790), and
   `HunterDrone.update()` in streak-entities.js (~352). What I saw:
   - Target is `nearestHostileTo(move.pos)`, picked ONCE at launch, only
     from `remotes.byId`, ignoring line of sight. No target (or the target
     dies) = it flies straight and burns out after `DRONE_LIFETIME` 12 s.
     Should re-acquire a new nearest target when the current one dies, and
     prefer visible targets. Check bots really are in `remotes.byId`.
   - No world collision or ground clearance at all: it flies through walls
     and can dive into the floor. Needs obstacle avoidance (climb over,
     then dive) or at least a raycast; hitting a wall should detonate there.
   - Turning: `DRONE_TURN` 2.8 rad/s at `DRONE_SPEED` 17 gives a ~6 m turn
     circle, so a target behind or close to you makes it orbit. Launch
     upward first, then turn toward the target.
   - Splash loop skips the target with `rp.id === target.id`, but
     RemotePlayer keys by `.netId` (see the comment at the `case "drone"`),
     so the target is probably hit twice. Use `netId`.
   - Add a lock-on cue so the user can tell homing works: target name in
     the banner, a marker on the locked enemy, maybe a drone-cam.
   - **Self-damage:** the user wants the blast to be able to kill the
     caller if they set it off right next to themselves. Today splash only
     checks remotes, never the local player; add a distance check against
     `move.pos` within `DRONE_SPLASH_RADIUS` (and on "expire" blasts).
   Test in a bot match: launch with a bot behind you, behind a wall, and
   with no bots, and screenshot the flight.

## Where we are

Session 7 built the **weapon skin editor**; the user designs skins in it
themselves. Session 8 finished **"You Have a Problem"**: it is **Final
locked** and on main. Its stock wears its own picture (the trollface stick
figure on the trim blue: see `art` below), the first part to use one.

**Next session: likely the other fifteen skins** (on hold at the user's
word; ask first). The user is testing the Problem 416 in the game, then comes back to design the rest in the editor, one
at a time, the same way. None of them is locked; their crops are rough first
passes. Ask which skin they want to start on. Expect requests like: a part
wearing its own picture (drop the file in assets/images/skin-art, add `art`),
text rewritten or added, text areas marked (Green Room's TROLL still needs
them), right-side tweaks.

## Weapon skins (session 7)

### The editor: how the user works
- Run `node tools/troll-skin-editor.mjs` in the user's checkout, open
  http://127.0.0.1:5174/tools/troll-skin-editor.html (takes 5175, 5176... if
  5174 is busy). It serves that checkout and Save writes into it: skins.js plus
  `skins/<id>.jpg` and `<id>-thumb.jpg`, re-baked on the spot.
- **The user edits in their own checkout, not the worktree.** Before changing
  skins.js or the skin tools: `git diff` their skins.js (they may have saved
  since you last looked) and copy it, plus any re-baked `skins/<id>.jpg` and
  `-thumb.jpg`, into the worktree; make the change there, commit, push.
  Then sync their checkout with `git stash push -m "<what>" -- <those files>`
  and `git pull --ff-only`. (`git checkout --` on their files is refused by
  the permission guard: it discards work. Stash keeps it recoverable.) After
  any change to the editor server (tools/troll-skin-editor.mjs), restart the
  5174 server from their checkout.
- To try a change before the user sees it, run a second editor from the
  worktree (`node tools/troll-skin-editor.mjs 5180`) and drive it with
  headless Playwright (`NODE_PATH=<checkout>/node_modules`,
  `--use-angle=d3d11`): `window.__editor.save(id)` re-bakes and saves into
  the worktree; the `#view` canvas with the `[data-cam]`/`[data-pan]`
  buttons gives close-ups of the gun. Stop it afterwards; the user's editor
  is 5174, never 5180.
- **An open editor tab keeps its own copy of the skin.** If it was opened
  before a change, its next Save overwrites the change (this dropped the text
  areas once). Always tell the user to refresh (Ctrl+Shift+R) before saving;
  if the skin then shows unsaved, that's an old draft: Revert skin.
- Unsaved edits live in localStorage (per skin) and survive a refresh.

### What a skin is (skins.js)
- **The banner only**, per part: no emblem, rollmark, vents, stipple, ribs,
  border or wear (user rule). Only the Problem 416 (`weapon-416.js`) wears skins.
- `crops`: per part `[cx, cy, zoom, rot, flip]` (fractions of the banner; zoom
  = share of the banner's width). Unturned crops are kept inside the banner.
- `lines`: text rewritten on the banner in its own pixel lettering (Tahoma at
  its real size, hard-edged, scaled up square). `cutouts`: art lifted off the
  banner (the trollface), paper keyed out from the box edges. Both are movable
  pieces (dx, dy, size, rot, flip).
- `textAreas`: boxes round writing baked into the banner art.
- `right`: the right side's own: `crops` per part, `lines`/`cutouts` overrides
  by index (text "" leaves a line off), `newLines` (right-only text; `smooth`
  title style, `bg: "rows"` paints out a gradient bar), `flipV` (parts upside
  down on the right).
- `final: true`: the Final lock; the editor folds down to the gun.
- `art`: a part's own picture in place of the banner, e.g.
  `art: { stock: "problem-stock.jpg" }` (files in assets/images/skin-art). That
  part's crop is a crop of the picture, on both sides (the right just mirrors
  it: no text flipping). The editor shows the picture when the part is
  selected. `{ file, bg, paper }` keys the picture's white paper out onto
  `bg` (paper: extra [x, y] seeds for white shut in by lines). You Have a
  Problem's stock: the trollface stick figure on the trim blue.

### The sides formula (user rule, in memory too)
The right side **mirrors** the left: the same art at the same spot along the
gun (weapon-416.js maps both faces by z). **Writing still reads correctly on
both sides.** The atlas is 1024x1024: top half = left side, bottom half
(`SKIN_ATLAS.rightY`) = right side, baked from the banner with each text line
redrawn mirrored and each text area flipped in place along the part's crop
direction, before cropping (so a word split across parts stays whole).

### Editor features
Drag/zoom/rotate/flip part boxes (Shift = one axis); per-part locks, **per
side**; Left side / Right side switch (a part not edited on the right follows
the left, shown as "same as left"); Banner pieces (text, trollface; right-only
text); Text areas mode (draw/remove boxes); Right ↕ tick; 3D view with pan
(right-drag or arrows) and zoom; atlas preview (both halves); Final lock /
Unlock to edit. Code: tools/troll-skin-editor.html, tools/troll-skin-editor.mjs,
drawing shared with the baker in tools/troll-skin-draw.js.

### Skin gotchas
- The 3D view (editor and game) lights the gun's left side harder than the
  right, so the same colour reads darker on the right. The atlas is right;
  check pixel values before "fixing" a colour.
- Keyed pictures (`art` with `bg`): white shut in by lines survives the
  edge flood. List those pockets (connected light regions not touching the
  picture's edge, with size and a seed pixel) in a headless page, keep the
  ones that belong to the art (the trollface and its eyes/teeth), and add the
  rest to `paper`. Seeds flood at a lower cut-off (lum > 120) than the open
  paper (> 200), so small greyish gaps go too.
- Text areas must hug the letters: a box that also covers neighbouring art
  flips that art too. Text *lines* are safe (redrawn, not pixel-flipped).
- Thin strokes vanish in pixel lettering at the normal ink cut-off; "$" and
  "|" columns use a lower one.
- Text areas marked so far: You Have a Problem, Buy $TROLL, Speed of Light.
  Other banners with writing (Green Room's TROLL) need them marked in the editor.
- Removed from the gun model because they sat on the art: fire selector,
  ejection-port cover, forward assist.
- Batch re-bake: `NODE_PATH=<checkout>/node_modules node tools/troll-skin-bake.mjs [ids]`
  (it also rewrites factory-thumb.jpg; revert that if nothing changed).

## Session 8: done and on main
- Per-part pictures (`art`) in skins.js, the baker and the editor — 67d3368
- Paper keyed out onto a colour, with `paper` seeds — 269abe9, c5c935c
- You Have a Problem: stock figure turned by the user, then Final locked — this commit

## Session 6: done and on main
- Bots throw grenades (1 frag + 1 flash a life; clusters, objectives, lob over cover; skill scales) — 089c3d8
- Melee swings sent over the net + overhand throw arm on remote/3rd-person rigs — 089c3d8
- S&D plant/defuse moved E -> hold F (F still throws tactical off-site) — c528a4d
- LEAN: DROPPED by the user. Q stays aim. Don't build it.
- Third person: parallel over-shoulder camera, own head ghosts on ADS; every head 1.4x + half-emissive (hitbox 0.24) — d04ddf2
- Painted shipping containers (gs-container-*), no metal texture on props, red lifeguard towers — 271bc55
- Infection mode (modes.js INFECTION, game.js 'Infection' block, bots meleeOnly, net 'infect') — fd731f6
- Keyboard Warrior rebuilt from the user's reference render (real 16x6 layout, silver guard, leather grip, trollface pommel) — a5e28f2
- Undergrin fps: now on par with Grin Site headless (18-22), left alone.

## Infection notes
- Survivors = phantom slot, Infected = ghost slot, relabelled via teamName().
- Bot host picks first infected 8s after GO (2 if 8+), clock starts then.
- Bots-only matches end in ~40s (infected snowball); survivor bots kite swords.

## Blender (for later, if skins move to real models)
Not started, and not what the user meant by the skins revision. Blender 5.2.1
LTS is at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` and runs
headless (`--background --python`); it could model UV'd .glb guns so every
weapon can wear skins (today only weapon-416.js is panelled).

Blender know-how from the maps that carries straight over:
- `models/map_kit.py` is the shared kit every `build_<map>.blender.py`
  imports: the `Builder` (bmesh primitives in game coordinates, rotated to
  Z-up only at export, world-metre box UVs, one-call glTF export), `lump()`
  (boulders, sacks), `walls_geo()`, `arch()`, `palm()`, `sedan()`,
  `steel_stair()`, `edge_rail()`, `pallet()`, and the palette.
- At export, flat-painted parts merge into one vertex-coloured `GS_Paint`
  material per model (a model costs one draw for its paint plus one per
  photo-textured material). Names in `TEXTURED` keep their own material and
  must match `RETEXTURE` in map-models.js.
- `models/bake_surfaces.blender.py -- <name>` bakes seamless procedural texture
  sets (colour/rough/normal) by sampling 4D noise on a torus: dirt, cast
  concrete, sand, plaster, tile and grass so far. The same trick would make
  tileable wear, scratches or camo for skins.
- **No environment map in this renderer**: metalness above ~0.3, and the
  ambientCG "metal" set, render near-black. Keep metalness low, or add an env
  map deliberately (it would change every map's look).
- glTF base colours are linear; convert sRGB hex first (`hexlin()`).

## Maps: done

Everything in the maps doc (https://claude.ai/artifact/DuitoHJf53Uu6PYopkh2Jc,
now with a "Status" section at the top) is on main:

| Map | What shipped | Commit |
| --- | --- | --- |
| Grin Site | 27 modelled props, dirt ground, cast concrete | faeb1e4 |
| Dust Bowl | desert village, 72 x 72 (db-*.glb) | 20f2b73 |
| The Depot | racking, catwalk ring, glass office, loading bay (dp-*) | e0f013f |
| Undergrin | tiled station, train, mezzanines, red tunnel mouths (ug-*) | a9155ef |
| Cul-de-Grin | fences/trees/houses beyond the edge, sidewalks, cars, furniture (cg-*) | a622b74 |
| Grin Beach | modelled pier with working ramps, cars + food truck (gb-*) | 3caa986 |
| Shared | metre UVs on every box; map check tool | b9d3854 |
| Perf | Undergrin: half the lamps, no model shadows | 48302f7 |

How every rebuilt map is put together: the approved blockout's colliders stay
in maps.js as **ghosts** (`api.box(..., { ghost: true })`, `api.ghostWalls`,
`api.cylinder(..., { ghost: true })`), and `mapModel(api, "<file>", {...})`
(map-models.js) draws the models. Change a collider, change the model to
match. No `_wip` maps remain.

Bugs fixed on the way: Grin Beach's pier ramps were dead ends (they topped out
against an unbroken railing; a fire ring sat on the west ramp's first step);
the pier deck ran 4 m past the map edge.

Performance (headless, `tools/troll-ops-map-fps.mjs`): five maps match or beat
their pre-rework builds; Undergrin is ~19 fps vs ~23 for its blockout. The
cost is per-pixel shading of the station, spread across all four models (no
single culprit). If it matters, next steps would be fewer lit surfaces in
view or fewer point lights; don't expect shadows to help (already off).

### Map tools (all need `NODE_PATH=<main checkout>/node_modules`)
- `tools/troll-ops-map-audit.mjs [ids]`: the map check. Fails on floating
  solids, blocked spawns and traps (reachable but no way back); reports
  unreachable tops and overlaps. All six maps pass; planted faults are
  caught. Not for pentagrin (elevators read as traps). `AUDIT_AT="x,z"` dumps
  walkable levels round a point.
- `tools/troll-ops-map-walk.mjs [ids]`: 47 walk runs across the six maps
  (stairs, doors, rails, ramps). All pass.
- `tools/troll-ops-map-shots.mjs [views.json] [ids]`: screenshots from the
  cameras in `tools/troll-ops-map-views.json`; `OUT=<dir>` for output.
- `tools/troll-ops-map-fps.mjs [ids]`: fps + draws/frame; `ROOT_DIR=<checkout>`
  measures another build (e.g. a `git worktree add --detach` of an old commit).

## Session-5 task list

All done in session 6 (see above); lean was dropped by the user.

## Gotchas

- `textures/concrete_*` is a split-face **block** wall texture, very pale. For
  poured concrete use the baked `cast` set.
- Texture sets in surface-textures.js load lazily (first access), so a map
  only downloads what it uses.
- Test hooks (`?tohooks=1`) expose `renderer` and `scene` too.
- The first walk run after a map loads crawls while models stream in: always
  warm up first (the walk tool does).
- `house-*.glb` (Cul-de-Grin houses) have no floor: cg-street lays boards.
- Cul-de-Grin's picket fences cross each front path: route walk tests round them.
- Inline `node -e '...'` breaks on apostrophes (even in comments): write a
  .cjs file instead. A "does the file already mention X" guard can be fooled
  by a comment.
- The docs connector takes images as: Artifact asset upload to the doc's URL
  -> connector `create` blob from the asset id -> `![alt](blob/<id>)`.
- Files are CRLF on disk (autocrlf); normalise line endings before multi-line
  string replacements.
- The game auto-pauses without pointer lock in the in-app browser; drive it
  with headless Playwright + `--use-angle=d3d11` (real GPU).
- `api.stairs(x, z, ...)`'s origin is the BOTTOM step's outer edge; it runs
  toward `dir`. Prove stairs with a walk-up test, not by eye.
- The menu character inspector camera sits on +z; rigs face -z.
