# Money rain in Kabukigrin

Two ways cash comes down in the club: the crowd throws it, and players spray
it from a money gun emote. Both use one bill particle system.

## What's already there

`maps/club-money.js` (-mn1, 2026-10-24) already throws 22 notes on each beat
drop. They come from random points over the dance floor (no actual NPC
throws them), flutter down and land on the floor notes the build baked in
(`KB_PROPS.cash`), then vanish. It's one instanced draw with a 64-note pool,
run from club-live.js's tick in both match and Socialize. This work builds
on it rather than starting over.

## 1. The bill particle (club-money.js, widened)

- **Same mesh:** an instanced quad with the canvas banknote texture,
  Lambert, double-sided, no shadows, one draw per club.
- **New: emitters.** Right now notes only spawn from "the floor area". The
  module gets `emit(origin, dir, n, spread, speed)`, so a hand, the bar or a
  gun's muzzle can throw them. The beat drop becomes one caller of it.
- **New: land anywhere, then fade.** A note that isn't aimed at a baked
  floor note drops onto whatever is under it, using a short height list
  (hall floor 0, stage 0.45, bar top ~1.1, mezzanine 3.0) from
  kabukigrin-social.js's rooms, and no raycasts. It lies there 2.5 s, then
  fades over 0.6 s through a per-instance alpha attribute (one float per
  note, patched into the shader with onBeforeCompile). Notes aimed at
  baked notes still swap into them the way they do now, so the floor stays
  as the build laid it out.
- **Flutter:** keeps today's motion (thrown up, then a slow swaying fall
  that tumbles flat as it lands). Gun bills come out fast and flat, and the
  air slows them over ~0.4 s before they start fluttering.

## 2. NPC throws (Socialize: town-npcs.js; matches: the drop)

- **Who:** in Socialize, real cast members get a new `"throw"` beat. Six
  dance-floor Ravers, the two booth guests, the four mezzanine guests on
  the glass (their bills fall onto the floor below) and two Barflies. The
  NPC raises its right arm, fans its wrist three or four times, and each
  flick lets out 3–5 bills from that hand (`emit` at the hand's world
  position).
- **How often:**
  - On each beat drop, 2–4 of the throwers go, instead of today's
    anonymous points.
  - Between drops, one random thrower goes every 25–45 s, so the bar and
    booths get cash too.
  - The pick is seeded from the room clock (modes/room-clock.js), so
    everyone in the room sees the same NPC throw at the same moment. It
    costs no net traffic.
- **In matches** (no crowd): the drop keeps today's anonymous throw over the
  floor. Nothing changes there.
- **Sibling sessions:** this adds one `case "throw"` and a timer to
  town-npcs.js, and a `throws: true` flag on those cast entries in
  kabukigrin-social.js. The bar-drinks and North sessions probably edit the
  same two files. I'll keep my changes in small separate hunks and leave a
  note in the shared folder.

## 3. The money gun emote

- **The gun:** a real money gun (the pistol-shaped cash cannon: a squared
  body, a slot on top that takes a stack of bills, a front wheel that pushes
  them out of a wide flat mouth, a curved pistol grip with a trigger and
  guard, a battery door under the body). Built in `weapons/money-gun.js`
  with the Ballista builder's fillet / round_v helpers, so the grip, guard
  and body corners are rounded the way the real one is (rule 10). Its refs
  (product photos and the side render next to them) go in
  `refs/arms/money-gun/` with a NOTES.md (rule 11). It's a prop for the
  emote, not a weapon, so it doesn't go on the arsenal rack.
- **The emote:** `{ id: "moneygun", name: "Make it rain", kind: "fp",
  props: true, seconds: 4.5 }`, built like Pour up:
  - The right hand holds the gun up and out at about 40°. You see it in
    first person (the hand plus the gun, with the bills coming out of the
    mouth at you), and everyone else sees the body version.
  - It sprays for 3.5 s at about 14 bills a second, with a little wrist
    sweep.
- **Where it works:** it's an emote, so it plays anywhere, but the bills
  only exist where a club has the money system. On other maps the gun
  sprays a lighter stream from a small pool that `emit` creates on first
  use (the same module, so there's no second code path).
- **Unlock and wheel slot:** free for everyone, like Chug and Crutches.
  It's added last in `EMOTES` so every older emote keeps its wire code
  (slot 26). If a sibling session (bar drinks) also adds an emote, whichever
  merges second takes the next slot.

## 4. Net sync

- **Nothing new on the wire.** The emote already travels as `em` on the
  state packet. Each remote client plays the pose and runs the same spray
  off the emote's clock, emitting from the gun's muzzle on that player's
  rig. The bills' random scatter is local, so it won't match exactly
  between screens, but the timing and direction do.
- **NPC throws** use the room clock, as above. Nothing is sent.

## 5. Perf budget

- **One draw call** for every bill in a club (NPC throws, drops and every
  player's gun share the pool).
- **Pool size by graphics tier:** high 160, medium 96, low and phones 48.
  When the pool is full, the oldest lying note is reused first, then the
  oldest note in the air.
- **Per frame:** only the live notes are updated, and the instance matrix
  upload is skipped while nothing is moving (as today).
- **Spray rate:** a remote player's gun sprays at half rate on low, so
  three players spraying at once stays inside the pool.
- **Far away:** no bills are emitted from more than 30 m away.
- **Target:** under 0.3 ms of CPU per frame with the pool full on a
  mid-range phone. The headless test measures this.

## Tests

- `tools/troll-ops-money-test.mjs`, extended:
  - `emit` from a point.
  - Notes landing on the bar top and the mezzanine.
  - Fading out and the pool being reused.
  - The tier pool sizes.
  - The CPU time for a full pool.
- A new `tools/troll-ops-money-gun-test.mjs` (menu only, like the light-up
  test):
  - Pose and props in first and third person.
  - A remote rig fed the em code sprays bills.
  - The side render of the gun.
- `emote-test` and `import-check`.
- A private-room Socialize run in Kabukigrin for screenshots of an NPC
  throw at the bar, a drop on the floor and the gun in first and third
  person.

## Commits (one system each)

1. Bill particle: `emit`, land anywhere, fade, tier pools (maps/club-money.js).
2. NPC throws (maps/town-npcs.js, maps/kabukigrin-social.js).
3. Money gun model plus refs (weapons/money-gun.js, refs/arms/money-gun/).
4. The emote (characters/emotes.js, wheel icon) and remote spray.
5. Cache tags and a HANDOFF line, unless this branch is merged into
   another session's first.
