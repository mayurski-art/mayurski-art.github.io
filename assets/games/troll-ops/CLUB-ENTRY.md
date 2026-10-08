# Trolling Loud: the door (Socialize)

Status: APPROVED 2026-10-08 (decisions below). Building in phases on tf-grinjuku.

User's ask, short: in Socialize on Trolling Loud you spawn in the line outside, among NPCs. At the front you show your ID (your profile card), say you're 18+, the bouncer unhooks the red rope and you get a wristband. Say you're under 18 and the bouncers throw you out, in a cinematic. The wristband is your pass: in and out of any door, no more line.

Scope: Socialize mode, Trolling Loud only. No weapons step (dropped by the user). Other maps and modes are untouched.

## Settled by the user

1. Signed-in players show their profile card, then answer 18+. Guests get only the 18+ question (no card).
2. Under 18: the kick-out cinematic, then a 2 minute lockout before you can rejoin the line. Free roam outside meanwhile (see below).
3. The guest band opens the main floor only. VIP and backstage stay bouncer-guarded. Room is left for a VIP band later.
4. troll_runner skips the whole ritual. He spawns inside wearing an exclusive owner band that opens every door, VIP and backstage included.
5. The band is the pass: once you have it, any door, any time, no line, no ID.
6. Band persistence is session-only, for signed-in players and guests alike. It survives the owner switching the room to a match and back, and walking in and out. It's gone when you leave the Socialize room or reload. Never saved to the account. troll_runner is exempt (his band is there from spawn, every time).
7. (2026-10-08) Step order ID → 18+ → wristband → rope → walk in. No alternative.
8. Band on the right wrist (the Rolex stays left). Guest band neon pink with a "TL" tab; owner band black and gold.
9. The line holds 6-7 NPCs, and where you're put in it is random: anywhere from 1 to 7 NPCs ahead of you.
10. Pinned in line with free look, emotes and chat; hold X to step out (you lose your place).
11. No line skip. The under-18 kick-out plays EVERY time you answer under 18; it is never skippable.
12. Side doors: a zone fence and a prompt, no extra door NPCs.
13. Others see a generic gold ID card in your hand, not your PFP.
14. Two check lanes: Big Lulz and Tank each have a podium; the front of the line goes to whichever is free.
15. Band wearers spawn in the lobby (≈ 0, 18).

## Band tiers

| Tier | Who | Look | Opens |
|---|---|---|---|
| guest | everyone who passes the door | neon pink fabric band (the marquee's #ff3fb4), a small "TL" tab, glows faintly on the beat | main floor: lobby, hall, bar, restrooms, coat check, mezzanine, terrace, Sky Bar |
| owner | troll_runner only, from spawn | black band, gold clasp, "OWNER" in gold | everything, incl. VIP and back of house |
| vip (later) | not built | open (e.g. violet/croc) | main floor + VIP lounge |

On the wire the tier is one small number (`wb`: 0 none, 1 guest, 2 owner, 3 reserved for vip), so adding VIP later is a new value, not a new system.

## Player flow (guest band)

1. **Spawn in line.** Entering Socialize on Trolling Loud without a band puts you in the queue along the rope (z ≈ 23.35, from x -4.3 going west). The line holds 6-7 NPCs and you're dropped in at random with 1-7 of them ahead of you (the line gets a few more posts to x ≈ -17 so there's room for several humans). Two lanes check people, so the wait at the back of a full line is roughly 15 s.
2. **In line.** Your feet are pinned to your slot (like a seat, `holdSeat` style). Free look, emotes, chat and the radio all work. The line shuffles you forward one slot per tick (about 3.5 s). Hold the leave key to step out and roam the street; you lose your place and rejoin at the back.
3. **Front of line.** You step up to whichever podium is free: Big Lulz's (≈ -3.4, 23.4) or Tank's, the second lane beside it. From here until you're through the rope, movement is locked.
4. **ID (signed-in only).** Your profile card (profile-card.js `renderCard(myCardData())`) rises from the bottom of the screen as if held up in your hand: tilted, slightly lit, your PFP, name, clan, rank. The camera eases toward Big Lulz, who leans in, looks at the card, up at you, back at the card (about 2.5 s). Guests skip this step.
5. **The question.** "You 18 or older?" with two buttons: "Yeah" / "No". Big Lulz waits, arms folded.
6. **Yes:** the order below (see "Step order"). Wristband, rope, walk in. About 7 s, then you're free in the lobby.
7. **No:** the kick-out (below).

### Step order: ID → 18+ → wristband → rope → walk in

Recommended over "rope, then band". Why:
- The band is proof you were checked, so it goes on at the podium while you're still face to face with the bouncer. The camera is already framed there; no second stop.
- The rope opening is the payoff. It ends the sequence and points you through the door, so control comes back exactly as the path opens.
- Real clubs do it this way: stamp or band at the desk, then the rope.

### The wristband snap (yes branch)

- **1P:** your right forearm and hand come up into view (the emote first-person hands, hand-model.js), palm down. Big Lulz's mitt comes in, wraps the band, a snap sound, the band glows once. About 1.6 s.
- **3P (what others see):** you hold out your right arm; the bouncer's arms meet your wrist; the band appears on your wrist and stays.
- **Wrist:** right. The Rolex (wristwear.js) lives on the left wrist, so both show and neither replaces the other. The rig already has `wristR` (character.js).

### The rope

There's no rope across the door today (the posts in the alley are the queue lane, the gold ones in the lobby are an inner lane). New: two chrome posts at the door mouth (≈ x ±1.6, z 23.6) with a red velvet rope hooked between them, as its own small mesh (not merged into the kit) so it can move.
- Big Lulz steps to the west post, lifts the hook, walks the rope round to the east post and hangs it there, and sweeps an arm: in you go. About 2.5 s.
- The camera holds on the rope, then turns with you. A scripted walk takes you from the podium through the door to the lobby (≈ 0, 19), about 2 s, then control is yours.
- The rope closes behind you (and for every NPC who goes in).

### Under 18: the kick-out cinematic

About 6 s, letterboxed (the match-intro look), third person on your own body:
1. Close on Big Lulz: a slow head shake. Caption: "Nah."
2. Tank comes in from the other side; they take an arm each and lift you off your feet. Side-on dolly as they carry you across the alley, your legs kicking.
3. Low angle by the curb under the scaffold: they toss you, slow-mo on the landing (on your back). Caption: "Come back when you're 18." The trollface art stamps in (the artwork, never the emoji).
4. Cut back to 1P, sitting on the curb (≈ 0, 29.5).

After it:
- **Locked out for 2 minutes.** A small timer chip: "Bounced · back in line in 1:42". You roam the street freely; the queue won't take you, and the club doors won't either (same fence as below).
- When it ends, the chip turns into "Get back in line" (hold X), which puts you at the back of the line. You'll be asked again.
- The answer is never stored. It's a joke dead end, not an age check.
- The cinematic plays in full every time you answer under 18. It is never skippable (user, 2026-10-08).

Note: a self-declared button is not age verification. The copy should stay playful so nobody reads it as one.

## The wristband as a pass

### Every way into the building

| Opening | Where | Leads to | Guest band |
|---|---|---|---|
| Front door (gold, 3.3 m) | south wall, x 0 | lobby | yes (and the line is here) |
| SW door | south wall, x -24 | restrooms | yes |
| SE door | south wall, x 24 | coat check | yes |
| East door | east wall, z 11.8 | main bar | yes |
| South fire escape | alley stair at x 7, up to the landing | terrace (upper) | yes |
| West door | west wall, z -4 | VIP lounge | no (VIP) |
| North doors x -22 / 0 / 22 | loading yard | green room / backstage / kitchen | no (back) |
| North fire escape | yard stair at x -7, upper door x -12.7 | back corridor (upper) | no (back) |

Inside, the guarded rooms are reached through: the hall's west wall doors (z -2, 8) and the restrooms' north door (x -22) into VIP; the DJ wall doors (x ±11.6), the side-hall doors at z -19.5 / -12 on both sides, the bar's north door (x 22) and the office stair down from the roof (ROOFST) into back of house. The fence below covers all of them without listing doors.

### How it's enforced: a zone fence (recommended)

trollingloud.js exports `entryZoneOf(x, y, z)` → `"street" | "main" | "vip" | "back"` (built from the existing `clubZone`). Each frame, after movement, club-entry.js checks your zone against your band. Not allowed → you're put back on your last allowed spot (no velocity), and a prompt shows:
- no band, at an outer door: "Wristband only. Line's out front." with an arrow chip toward the line.
- guest band, at VIP/back: "VIP only" / "Staff only".

Why a fence and not colliders: it catches every opening, stairs and the roof route included, needs no change to movement.js, and needs no new geometry. Positions are client-authoritative (net.js), so your own client fencing you is enough; others just see you stop at the door.

### Bouncers react

- A band wearer passing within ~3 m of a door guard (Big Lulz, Tank, Brick in the lobby, Rope at VIP, Knuckles/Moose at the back): he turns his head to you and nods. Owner band: he steps half a pace aside too.
- A guest band at a VIP/back door: Rope (or Knuckles/Moose) puts a hand up. No new NPCs are posted at side doors (each NPC is 4 draws); the prompt does the talking there.

### Persistence (settled, item 6)

For the session only. The band survives the owner switching the room to a match and back, and walking in and out. It's gone when you leave the Socialize room (back to the menu) or reload. Never saved to the account. Same for signed-in players and guests; troll_runner's owner band is there from spawn every time.

## troll_runner

- Spawns inside (lobby, ≈ 0, 18) already wearing the owner band. No line, no card, no question.
- Opens every door. Bouncers nod and step aside.
- His Socialize loadout rule (armed) is unchanged.

## Multiplayer

### The line with several humans

- Joining the line gives you a ticket (`cq`): the shared clock time you joined (same clock-offset trick as DJ Lulz). Everyone sorts the humans in line by ticket.
- Your slot is `max(your NPCs-ahead count, slot of the human ahead + 1)`, so humans never share a slot and keep join order.
- NPCs in the line are local filler (town-npcs are per client, not networked). Each client lays its NPCs into the slots no human holds. Small differences between clients are fine: NPCs have no collision.
- Two podiums (Big Lulz and Tank). The front human goes to whichever is free; with both busy, the next human waits at slot 1 until one frees up (phase "in", "kicked" or "left").
- AFK: if the front human doesn't answer in 25 s (or their tab goes hidden), they're sent to the back and the next one steps up. Their own client does the move; other clients also skip a front human whose state packets go stale.
- NPCs between humans still go in on the line's tick, so a human with NPCs ahead keeps moving even while another human is at the podium.

### What others see

New state packet fields (none named `t`):
- `wb` band tier (0-3). Remote rigs wear the right band.
- `cq` queue ticket (0 when not in line).
- `ce` club-entry phase + start time (`id`, `ask`, `band`, `rope`, `walk`, `kick`). Every client plays the same timeline locally: the card in hand, the bouncer's moves, the rope, the carry and toss. Bouncers are local NPCs, so each client drives its own copy from that phase.
- The ID card on a remote player is a small generic gold card mesh in their hand, not their PFP (no image loading for others' cards).

### Rejoin and respawn

- Socialize has no deaths. "Respawn" means: the room comes back from a match, or you reload.
- Band on (same session): you spawn inside, in the lobby. No line.
- Reload / rejoin the room: band gone, back in the line (settled item 6).
- Lockout running when the room switches to a match: the timer keeps counting.

## Controls

| | Desktop | Pad | Touch |
|---|---|---|---|
| Answer | 1 / Y = Yeah, 2 / N = No, or click | A = Yeah, B = No | two big buttons |
| Leave the line | hold X | hold X | "Leave line" button |
| Rejoin after lockout | hold X | hold X | button |

Prompts use the existing pad/touch prompt styling. Buttons have aria-labels and the 18+ question is a real dialog with focus on "Yeah".

## Technical plan

New code lives in its own files. game.js only gets hooks.

| File | Owns |
|---|---|
| `modes/club-entry.js` (new) | the state machine (none, queued, front, id, ask, band, rope, walk, in, kicked, lockout), tickets and slots, the line tick, the zone fence, the prompts and the 18+ dialog, the wire fields, the remote phase timelines |
| `view/club-entry-cine.js` (new) | the kick-out cinematic (camera shots, letterbox, captions), the 1P ID card overlay, the 1P band snap hands |
| `town-npcs.js` | a small directing API: `direct(name, act, t0)` / `release(name)` so club-entry can script a named NPC. New acts: `check`, `band`, `unhook`, `waveIn`, `nod`, `block`, `carry` (paired), `shake`. Queue NPCs flagged `queue: true` |
| `trollingloud.js` | `door: {podium, lineSlots, ropePosts, lobbySpot, curbSpot}` data, `entryZoneOf()`, the two new door posts, the extra lane posts, the rope as its own mesh |
| `wristwear.js` | `buildWristband(tier, ringR)` next to `buildWatch` |
| `character.js` | `syncWristband(rig)` on `wristR`, same pattern as `syncWristwear` (rig untouched otherwise) |
| `remote-players.js` | pose a remote player for a `ce` phase (card hold, arm out, carried, landed); read `wb` |
| `net.js` | `wb`, `cq`, `ce` in the state packet |
| `game.js` | hooks: init, per-frame update, the line/scripted-walk pin next to the `holdSeat` call, the spawn override, snapshot fields, `frozenPlayer()` also true while scripted |
| `style.css` | card, dialog, chips, letterbox reuse |

Reuse:
- Movement lock: the seat pattern (`holdSeat`: pin `move.pos`, zero velocity). Nothing new in movement.js.
- Cinematic: match-intro.js's letterbox, camera easing and caption overlay; game.js already hands the camera to `matchIntro.active`, add the same for the club cine.
- The card: profile-card.js `renderCard` / `myCardData` (guests never see it).
- 1P hands: the emote first-person hands (emotes.js `FP_HAND_POSES`, hand-model.js).
- Sync timelines: the DJ Lulz clock offset.

New animation work: 8 bouncer acts (above), the player's card-hold, arm-out and carried/landed poses, the rope (a catenary between hook and post, the hook moving), the band snap. All procedural on the existing rig, like the current acts and emotes.

Cache tags: bump every changed module and cascade importers; game.js's tag in troll-ops.html.

## Tests

New `tools/troll-ops-club-entry-test.mjs` (headless, Supabase blocked, BroadcastChannel only, never the live public room):
- Solo: spawn → queued with 1-7 NPCs ahead (a line of 6-7); ticks advance; front → card overlay shows your name; "Yeah" → `wb=1`, rope opened, ends in the lobby, movement unlocked.
- Guest: no card, straight to the question.
- "No" → kick phase, cine runs, ends at the curb, 2 minute lockout (clock sped up), fence holds, then hold X rejoins at the back.
- Fence: teleport toward every opening in the table with `wb` 0 / 1 / 2 and check where you end up (8 outer openings + VIP/back from inside + the roof stair).
- Owner: spawns in the lobby with `wb=2`, walks into VIP and backstage.
- 3 tabs: ticket order, one at the podium at a time, a remote sees `ce` phases and the band; AFK front gets sent back.
- Mobile viewport + pad answers.
- Screenshots of the card, the rope, the band in 1P and 3P, and the kick-out frames, looked at by eye before shipping.
- Existing `socialize-test`, `club-crowd-test`, `dj-test` still pass. Full gate once before the push.

## Phases and estimates

Re-estimated 2026-10-08 against what comparable Troll City work actually took (fist fights, the blacksmith, the duel sync), not padded.

| Phase | What | Estimate |
|---|---|---|
| 1 | solo flow with placeholder poses: line (6-7 NPCs, random place), ticks, two podiums, card, question, band state, scripted walk, zone fence, owner spawn | 1-1.5 h |
| 2 | the look: door posts and rope mesh, bouncer acts (check, band, unhook, nod, block), 1P card and band snap, band meshes (guest, owner) on the right wrist | 1.5-2 h |
| 3 | the kick-out cinematic (every time, never skippable) + lockout | about 1 h |
| 4 | multiplayer: tickets, two podiums, remote phases and poses, AFK | 1-1.5 h |
| 5 | pad/touch prompts, test pass, screenshots, gate | 30-45 min |

Total about 5-7 h, 2 sessions. Each phase ships on its own; phase 1 is playable (ugly) on its own.

All decision points were settled by the user on 2026-10-08: see "Settled by the user" items 7-15 at the top.
