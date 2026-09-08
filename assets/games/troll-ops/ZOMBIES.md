# Troll Zombies — "The Pentagrin"
### Design doc v1 — a Black Ops "Five" tribute inside Troll Ops

Status: **building**. Phase Z1 in progress.

---

## 1. What we're making

A round-based zombies mode modelled on **"Five"** from Black Ops (2010) — the
Pentagon map with the briefing room, the war room and the elevators. Ours is
**The Pentagrin**: five-sided, same three-floor shape, troll-flavoured.

Enemies are **3D Pepe the Frog zombies** and **zombie trollfaces**, per your
call.

### What "Five" actually is (checked, not recalled)

Worth writing down because I had one detail wrong from memory:

- **Three floors** plus a sealed **Panic Room** holding Pack-a-Punch.
  - **Floor 1 — the briefing/conference room.** Where you start. The long
    table and flags: the "presidential room" you remembered.
  - **Floor 2 — the war room.** Holds the **four DEFCON switches**.
  - **Floor 3 — the laboratories.**
- **Elevators** connect all three floors, and using one **redistributes the
  zombies** onto your new floor — which is why elevator-spamming is a real
  survival tactic.
- Flipping all four switches takes the building to **DEFCON 5**, which opens
  the Panic Room and its Pack-a-Punch.
- The **Pentagon Thief** appears on certain rounds once the power is on,
  **steals the weapon you're holding** and escapes through the teleporters.
  You get it back by killing him.
- Perks: Quick Revive (500 solo / 1500), Juggernog (2500, 100 → 250 health),
  Speed Cola (halves reload), Double Tap.
- *(I had thought George Romero featured here — he's Call of the Dead. He is
  not in this map and won't be in ours.)*

---

## 2. Where it lives

A new **mode inside Troll Ops**, not a separate game. It reuses everything
already built: projectile ballistics, the movement stance machine, the
22-weapon roster, the humanoid character rig, the audio engine, the minimap.
What's genuinely new is the map, the round/economy loop and the zombie AI.

New modules: `zombies.js` (round director, economy, zombie AI),
`pentagrin.js` (the map). `character.js` gains a `face` option so one rig can
wear a grin or a frog face.

---

## 3. The enemies

| Type | Look | Behaviour |
|---|---|---|
| **Troll zombie** | Pale grey humanoid, classic grin, sunken eyes | The baseline. Shambles, speeds up by round |
| **Pepe zombie** | Green, wide frog mouth, high-set bulging eyes | Slightly faster, slightly less health |
| **Crawler** | Either face, legless | Spawns when a runner's legs are blown off; fast, low |
| **The Thief** | Tall, dark, masked grin | Appears on set rounds once power is on. Steals your equipped weapon and flees to a teleporter; kill him to get it back |

Zombies path to the player, break through **barricades**, and take extra
damage on headshots. Health and speed scale per round the way the genre
expects — flat early growth, then a steeper curve.

---

## 4. The loop

1. **Round starts.** N zombies, scaled by round. Banner announces it.
2. **Kill for points** — 10 a hit, 60 a body kill, 100 a headshot kill.
3. **Spend points** on doors/debris to open the building, wall-buy weapons,
   the Mystery Box (950), perks, and Pack-a-Punch (5000).
4. **Turn on the power** to enable perks and elevators.
5. **Flip four DEFCON switches** in the war room to open the Panic Room.
6. **Go down, get revived** — or on solo, use Quick Revive's self-revive once.
7. Round ends when the last zombie drops. Next round, more of them.

---

## 5. The map — The Pentagrin

Five-sided shell, three floors, connected by two elevators and a stairwell.

| Floor | Area | Contents |
|---|---|---|
| **1 · top** | **Briefing Room** (start) | Long table, flags, boarded windows. Wall-buy pistol + SMG. Two doors out |
| | Side offices | Debris to clear, wall-buy shotgun |
| **2 · mid** | **War Room** | Four DEFCON switches, big wall screens, the power switch |
| | Corridors | Mystery Box spot, Juggernog |
| **3 · bottom** | **Laboratories** | Speed Cola, wall-buy rifle, furnace |
| | Teleporter pad | Routes to the Panic Room once DEFCON 5 |
| **Sealed** | **Panic Room** | Pack-a-Punch |

Palette: institutional grey-green concrete, warm emergency lighting, red alert
strobes when DEFCON changes. Built with the existing `maps.js` helper API
(boxes, stairs, walls with door gaps), so no new geometry system is needed.

---

## 6. Phases

Each merges to `main` playable, same as the Phantom Forces conversion.

- **Z1 — Core loop.** ✅ **SHIPPED.** The Pentagrin's three floors and props,
  the round director, both zombie types on the shared rig, points, boarded
  windows as spawn points, damage and death. Playable start to game-over.
  - Rounds use the genre's curve: 150 HP at round 1, +100 a round to 9, then
    ×1.1 compounding; counts grow 7 → 28.
  - Zombies spawn from windows **on the player's current floor**, which is both
    faithful and avoids cross-floor pathfinding on a three-storey map.
  - Props modelled on the real map: conference table with chairs and red
    telephones, flags, wall displays, metal detectors, four DEFCON consoles
    around the war-room teleporter, lab benches, a Ray Gun mid-build, weapons
    lockers, the prototype teleporter, the furnace, perk machines, Mystery Box,
    Pack-a-Punch and elevator doors.
  - Found and fixed a shared AI bug: a blanket per-frame `velocity *= 0.9`
    applied on top of the steering lerp settles velocity at **0.375× the
    configured speed**. Zombies and the Ops grunts were both far slower than
    their stats claimed. Damping now only applies when not steering.
- **Z2 — Economy.** Buyable doors and debris, wall-buys, the Mystery Box, the
  power switch.
- **Z3 — Progression.** Perks (Juggernog, Speed Cola, Quick Revive, Double
  Tap), elevators with zombie redistribution, the four DEFCON switches and
  Pack-a-Punch.
- **Z4 — The Thief, downs and revives, round-record leaderboard, polish.**

---

## 7. Decisions taken (say if you'd rather otherwise)

1. **Solo first.** The existing netcode is client-authoritative and fine for
   PvP, but co-op zombies needs shared enemy state, which is a much bigger
   ask. Z1–Z4 are solo; co-op is a later phase if you want it.
2. **Reuse the weapon roster** rather than authoring CoD-style guns. Wall-buys
   and the box draw from the 22 weapons already built.
3. **No rank gating in Zombies** — the mode is its own economy, so every wall
   buy and box roll is available regardless of rank.
