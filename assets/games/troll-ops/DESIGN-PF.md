# Troll Ops → Phantom Forces
### Design doc v1 — PvP conversion, weapon roster, map rotation

Status: **awaiting buy-in.** No code written yet.

---

## 1. What "like Phantom Forces" actually means

Phantom Forces isn't just "an FPS with guns." Stripped to its load-bearing
parts, it's five things, and we need all five or it won't read as PF:

1. **Movement is the identity.** Sprint → **slide** (the iconic one), prone
   **dive**, **vault/mantle** over waist-high geometry, and **lean** on Q/E to
   peek corners without exposing your body. PF players describe the game by its
   movement before its guns.
2. **Bullets are projectiles, not hitscan.** Real muzzle velocity, real gravity
   drop, real travel time. You lead moving targets. This single change is the
   biggest tell between "a shooter" and "PF."
3. **A deep weapon roster with attachments.** Guns grouped into classes, each
   with optic / barrel / underbarrel / ammo slots that measurably change the
   stats — not cosmetic.
4. **Two teams, several modes, map rotation.** Phantoms vs Ghosts, TDM / KOTH /
   Gun Game, on a handful of visually distinct maps.
5. **Rank grind.** XP per kill, headshot bonuses, weapons unlocking as you rank.

Our version keeps the trollface skin and voice, but hits all five.

---

## 2. What exists today (honest read)

`assets/games/troll-ops/` is ~2,100 lines across 5 files. It's a **solo wave
survival horde game**, not a PvP shooter:

| File | What it does | Fate |
|---|---|---|
| `game.js` (995) | One hardcoded arena, hitscan raycasts, player controller, weapon view overlay scene, postprocessing | Heavy refactor — splits into modules |
| `weapons.js` (167) | 3 weapons, `WeaponState` machine, damage falloff | Extend — the state machine is good, roster is tiny |
| `enemies.js` (207) | `Grunt` + `WaveSpawner` horde AI | Keep, reused for Infection mode |
| `shaders.js` (223) | Dissolve, muzzle flash, tracer, sparks, ground | Keep, extend |
| `leaderboard.js` (40) | Weekly ladder wiring | Rework for PvP stats |

**What's genuinely good and worth keeping:** the separate weapon-camera overlay
scene (avoids near-plane distortion — a real technique), the `WeaponState`
recoil/spread/ADS machine, the dissolve shader, the postprocessing chain.

**Known problems to fix on the way:**
- `camera.rotation.x -= recoilPitch` writes directly to the camera while
  `PointerLockControls` also owns it — recoil and mouse-look fight each other.
- `camera.rotation.order = "YXZ"` is only set inside the touch branch, so
  desktop look math is subtly wrong.
- `spawnTracer` allocates a geometry + material per shot and disposes it — GC
  churn every trigger pull. Needs pooling once bullets become projectiles.
- The arena is built by top-level side effects at module load. Blocks map
  switching until it's a function.

---

## 3. The netcode reality check — read this one

**There is no dedicated server, and we can't build one here.** This is a static
GitHub Pages site. What we have is Supabase Realtime broadcast, which
Trollrreria already uses successfully (`assets/games/trollrreria/src/net.js`) —
peer-to-peer message fan-out with a `BroadcastChannel` fallback for same-browser
tabs.

So the model is **client-authoritative**: your browser simulates you, broadcasts
your position ~15–20×/sec, and when you shoot, *your* client decides whether it
hit and tells the victim "you took 34." The victim's client applies it to
itself. Remote players are interpolated between received snapshots.

Two things worth knowing before you sign off:

- **This is genuinely how PF works too.** Phantom Forces is famously
  client-side hit detection — it's why it feels so responsive and also why it
  has a cheating reputation. So this isn't a compromise on *feel*; it's the
  same trade PF made.
- **It is cheatable.** Anyone who opens devtools can send `hit` messages. For a
  fan arcade game with a friendly player base this is fine, and it's the same
  trust model Trollrreria's PvP already ships with. If cheating ever becomes a
  real problem, the fix is a real authoritative server, which is a different
  project entirely.

**Realistic room size: 8–12 players.** Above that, broadcast fan-out (n² message
volume) starts hurting the weakest client in the room.

---

## 4. Phase plan

Each phase merges to `main` and is playable on its own — per your standing
preference, I won't leave phases stranded on branches.

### Phase 1 — Gunplay + movement core ✅ SHIPPED
The PF *feel*, still against AI grunts so it stays playable throughout.
- ✅ Projectile ballistics (`ballistics.js`): per-weapon muzzle velocity, gravity
  drop, travel time, fixed-step integration so fast rounds can't tunnel, pooled
  tracers that follow the bullet
- ✅ Wall penetration via analytic slab test — material thickness × a per-collider
  `pen` cost, with damage falling off through the material
- ✅ Movement (`movement.js`): slide, dive-to-prone, vault/mantle, lean, crouch,
  sprint; crates are now walkable surfaces instead of invisible walls
- ✅ ADS moved to **right mouse** (PF parity), freeing Q/E for lean
- ✅ Replaced `PointerLockControls` with hand-composed look, so aim, recoil and
  lean roll no longer fight over the camera quaternion
- ✅ Slide + lean touch controls for mobile parity

### Phase 2 — Weapon roster + attachments ✅ SHIPPED
- ✅ **22 weapons across 8 classes** (table in §5), built from per-class base
  templates so each definition only states what makes that gun different
- ✅ Data-driven procedural model builder (`weapon-model.js`) — bullpups, drum
  mags, tube mags, wood furniture and pistols all come out of one code path
- ✅ Attachment system (`attachments.js`): **optic / barrel / underbarrel / ammo**
  with real stat deltas. Optics use `set` for zoom so magnification doesn't
  compound off the weapon's own ADS FOV
- ✅ PF-style loadout screen (`loadout.js`): class → weapon → attachments →
  stat bars, with lock states and rank requirements
- ✅ Rank/XP (`progression.js`) — localStorage for now, moves to the accounts
  system in phase 6. Weapons gate at ranks 0–40; XP is `kills×50 + wave×300`
  against 2,500 per rank, so the roster opens over a few sessions

### Phase 3 — Map system + 5 maps
- Extract arena construction into a data-driven loader (geometry, colliders,
  team spawn zones, objective points, sky/fog/light palette per map)
- Five maps covering PF's archetype spread (§6)
- Map vote / rotation between matches

### Phase 4 — Multiplayer PvP
- Supabase Realtime rooms with join codes, `BroadcastChannel` fallback
- Team assignment (Phantoms vs Ghosts), balanced on join
- Position/rotation/animation sync with interpolation + extrapolation
- Client-authoritative hit reporting, damage numbers, kill confirmation
- Remote player models — trollface operators with lean/crouch/slide poses
- Live killfeed, Tab scoreboard, team score HUD

### Phase 5 — Game modes
- **Team Deathmatch** — first team to N kills
- **King of the Hill** — single rotating capture point
- **Gun Game** — every kill advances you through the roster
- **One in the Chamber** — everyone gets a pistol, one bullet, and a one-shot
  kill. Land it and you're refunded a round; miss and you're down to melee until
  you take someone out. Three lives each, last grin standing wins.
- **Infection** — reuses the existing grunt AI; infected vs survivors
- **Ops** — the current PvE horde mode, preserved as solo play
- Match flow: lobby → warmup → match → end-of-round scoreboard → next map

### Phase 6 — Progression + polish
- Rank/XP on the existing Supabase accounts system; weapons unlock by rank
- Suppression effect (near-miss screen distortion — very PF)
- Minimap, positional-ish audio, hit/kill sounds
- Leaderboard rework for PvP stats (K/D, score/min, best streak)

---

## 5. Weapon roster (22, 8 classes)

Names follow the voice already established by *Grinder SMG* / *Widemouth 12* /
*Longsmile .50* — descriptive, faintly cheeky, never the troll emoji.

| Class | Weapon | Analog | Character |
|---|---|---|---|
| **Assault** | Grinstock AR-12 | AK-12 | Hard-hitting, punchy vertical recoil |
| | Problem 416 | HK416 | The balanced default |
| | Bugbear AUG | AUG A1 | Bullpup, fast ADS |
| | Coalface AN-94 | AN-94 | 2-round hyperburst |
| **Carbine** | Snubgrin M4 | M4A1 | Fast handling, mild recoil |
| | Trollboy G36C | G36C | Low recoil, middling damage |
| **PDW** | Grinder SMG *(exists)* | MP5 | Fast fire, low recoil |
| | Chuckle P90 | P90 | 50-round mag, hipfire monster |
| | Smirk Vector | Vector .45 | Absurd RPM, drains instantly |
| **Battle / DMR** | Bellow SCAR-H | SCAR-H | Heavy semi-auto punch |
| | Sneer SKS | SKS | Cheap, fast, 3-shot kill |
| **Sniper** | Longsmile .50 *(exists)* | BFG-50 | One-shot anywhere |
| | Hush Intervention | Intervention | Bolt, one-shot chest up |
| | Deadpan 700 | Remington 700 | Fast bolt, needs headshots |
| **LMG** | Bellylaugh M60 | M60 | 100 rounds, brutal recoil |
| | Cackle RPK | RPK | Controllable, huge mag |
| **Shotgun** | Widemouth 12 *(exists)* | Remington 870 | Pump, devastating close |
| | Sawgrin KSG | KSG | Tight pellet spread |
| | Guffaw Saiga | Saiga-12 | Semi-auto, panic button |
| **Sidearm** | Pocket Grin M9 | M9 | Reliable backup |
| | Wide Deagle | Desert Eagle | 2-shot, slow, loud |
| | Chortle 18 | Glock 18 | Full-auto machine pistol |

**Attachments** — each slot carries real stat deltas, not cosmetics:
- **Optic:** iron / reflex / coyote / ACOG 4× / sniper scope 8× (ADS speed and
  zoom trade against each other)
- **Barrel:** suppressor (quieter, hidden from killfeed, less damage) /
  compensator (less vertical recoil) / muzzle brake (less horizontal)
- **Underbarrel:** vertical grip (recoil) / angled grip (ADS speed) / laser
  (hipfire accuracy)
- **Ammo:** standard / hollow point (more damage, less penetration) / armor
  piercing (more penetration, less damage)

---

## 6. Maps (5 at launch)

Covering PF's archetype spread so each plays genuinely differently. Deliberately
*not* using real Inland Empire city names — same call we made on Trollrreria.

| Map | PF archetype | Character |
|---|---|---|
| **Grin Site** | Crane Site | Construction site. Heavy verticality, cranes, exposed girders, long diagonal sightlines |
| **Undergrin** | Metro | Subway platform. Tight CQB, pillars, two levels, shotgun/PDW territory |
| **Dust Bowl** | Desert Storm | Open desert ruin. Long sightlines, sniper duels, sparse hard cover |
| **The Depot** | Warehouse | Industrial interior. Crates, catwalks, close-to-mid, constant flanks |
| **Cul-de-Grin** | Suburbia | Suburban street. Houses to enter, backyard flank routes, mid-range |

Each map ships with its own sky gradient, fog color, sun angle and light palette
— the existing sky shader already takes three colors, so this is cheap and buys
a lot of visual variety.

---

## 7. Controls (PF parity)

| Input | Action | Change from today |
|---|---|---|
| WASD | Move | — |
| Mouse | Look | — |
| LMB | Fire | — |
| **RMB** | ADS | **was Q** |
| **Q / E** | **Lean left / right** | **new** |
| Shift | Sprint | — |
| **C** | Crouch → **slide** while sprinting | **new** |
| **Ctrl** | **Dive** | **new** |
| Space | Jump → **vault** at obstacles | extended |
| R | Reload | — |
| **1 / 2** | Primary / secondary | **new** |
| **Tab** | Scoreboard | **new** |

Touch controls get slide and lean buttons; the existing on-screen layout has
room on the left rail.

---

## 8. Decisions I need from you

1. **Keep the PvE horde mode?** I'd keep it as a solo "Ops" playlist — it's
   already built, it's the existing leaderboard, and it makes Infection mode
   nearly free. *(Recommend: keep.)*
2. **Rank-gate the weapons?** PF's whole identity is the unlock grind, but with
   a small player base gating can just feel like a wall. *(Recommend: gate, but
   with generous XP so the roster opens up in a few sessions — and everything
   unlocked in solo Ops so you can always try a gun.)*
3. **Room size cap** — 8, 10, or 12 players?
4. **Bots to fill empty rooms?** Realistically your lobbies will often have 1–3
   real people. The grunt AI could be re-skinned into enemy operators so a match
   is never empty. *(Recommend: yes — this is the difference between a mode that
   gets played and one that doesn't.)*

---

## 9. Scope honesty

This is a **multi-session build** — realistically 6 working sessions, one per
phase, possibly two for Phase 4. Phases 1–3 are large but well-understood
refactors. Phase 4 is the genuinely risky one: netcode always is, and
interpolation quality is the difference between "PvP" and "unplayable."

Nothing here requires new dependencies, a build step, or CSP changes — the
Supabase realtime endpoints are already allowlisted in `troll-ops.html`, and
`three.js` is already vendored at `assets/vendor/`.
