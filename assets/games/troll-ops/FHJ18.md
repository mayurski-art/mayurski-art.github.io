# FHJ-18 AA: the anti-air launcher (design, awaiting OK)

Status: **design only. Nothing below is built until the user says go.**

## Why

Air streaks are hard to answer. A UAV, a Counter-UAV, a gunship or the warship stay up until they expire, unless a SAM Turret happens to be down or someone empties mags into them. BO2's FHJ-18 AA is the answer: a shoulder launcher that only locks onto aircraft. This adds it for players and for bots.

## Decisions (user, 2026-10-10)

- **FHJ-18 AA only.** No SMAW and no RPG in this batch. It locks onto air targets only, as in BO2.
- **Players get it in the Secondary slot** of Create a Class, level-unlocked, with a lock-on reticle.
- **About 1 in 5 bots carry it as their secondary.** They switch to it when enemy air is up.

## What it does (the player)

1. **Pick it.** It sits in the Secondary slot's list next to the pistols, under a new "Launchers" heading.
   - Unlocks at **level 20** (proposed; the pistols run 0 to 25, the guns 0 to 44).
   - A locked row shows "Level 20" like any gun.
2. **Raise it** with the weapon switch. It sits on the shoulder in third person and fills the right of the screen in first person.
3. **ADS to look for air.** There's no hip fire (BO2): firing without ADS does nothing and shows a short "Aim to lock" hint.
4. **The lock.**
   - Aim within **6°** of an enemy aircraft with line of sight, and hold it there for **1.2 s**.
   - A bracket from `.to-hk-lock` (style.css:1418) closes on the target, with a rising tone in the `audio.candleCharge` style (audio.js:442).
   - At full lock the bracket turns red, reads **LOCKED**, and the tone goes solid.
   - Drifting off the 6° cone bleeds the lock away at twice the rate it builds.
5. **Fire.** It can't fire without a lock. A locked shot launches one missile that homes on the target.
6. **Ammo.** Mag 1, reserve 2 (three missiles a life), reload about 3 s.
7. **Hits and credit.** One hit downs a UAV, Counter-UAV, Hunter drone or Dragonfire; two down a gunship; three down the warship. Each down pays `SCORE.airKill` 125 (scorestreaks.js:33) with the "Aircraft down" feed line, as SAM and bullet kills already do.

**Not targets:** airstrike jets, care-package helis and the VSAT (BO2's satellite is out of reach). On a ground target, a player or a vehicle, it never locks and the bracket never appears.

## Built from what exists

| Need | Reuse | Where |
|---|---|---|
| Which aircraft are enemies, and how many hits each takes | `enemyAirFor(team, me)` already returns `{id, pos, need, e}` with need 1, 2 or 3 | streaks/dragonfire.js:69 |
| Line of sight to it | `raycastWorld(colliders, eye, dir, d)` | as in combat/bot-fire.js:193 |
| The missile: mesh, homing, hit radius, lifetime | the SAM's `missileMesh` / `spawnMissile` / `updateMissiles` (speed 55, turn 3.2 rad/s, hit 2.2 m) | sam-turret.js:262, 348, 360 |
| Counting hits per aircraft | the SAM's `samHitCount` and `samMissileHit` | dragonfire.js:158 |
| Downing it, credit, banners, wire | `shootDownAir(id, byId, true)` | dragonfire.js:185 |
| The wire for a launch | like the SAM's `{kind:"sam", action:"launch", …}`; receivers spawn the same missile | dragonfire.js:150, streaks/bot-streaks.js:627 |
| Lock bracket | `.to-hk-lock` | style.css:1418 |
| Lock tone | `audio.candleCharge(level, full)` | audio.js:442 |

**One refactor first, as its own commit.** The missile code lives as `SamTurret` methods today. It moves into exported functions over a holder `{ scene, missiles }`, with `SamTurret` calling them. The launcher then shares exactly the SAM's flight and hit code, and the SAM's own tests check that nothing changed.

## The weapon

- **weapons.js:** `fhj18`, `cls: "launcher"`, `hidden: true` (kept out of Royale loot, royale.js:215), `rank: 20`, mag 1, reserve 2, reload 3.0 s, `lockOn: true`, `noHip: true`. Its damage on people is zero, because the missile ignores ground targets.
- **CLASS_ORDER** (weapons.js:164) gains `"launcher"` with the label "Launchers". It isn't offered in the Primary slot.
- **loadout.js:**
  - The Secondary list at :518 changes from `["sidearm"]` to `["sidearm", "launcher"]`.
  - The fallback at :178 ("not a sidearm, so a .69") also accepts a launcher.
- **attachments.js CLASS_FIT** (:117): `launcher: iron / none / none`, so it takes no attachments.
- **Model:**
  - A traced Blender build from reference photos of the BO2 FHJ-18 AA. Following the "real guns must look like *that* gun" rule, it's the Chinese tube launcher with the boxy optic and front grip.
  - Built with `models/gunkit.py` `slab_body`, exported as a GLB in `weapon-model.js` `DETAILED`, with the empties `P_Grip`, `P_Support`, `P_Muzzle` and `P_Aim` (weapon-model.js:97).
  - In third person it rests on the right shoulder: a launcher hold in character.js `_gripSupport`, tube over the shoulder, both hands forward.
  - First person uses the same empties.
  - Screenshots and iteration until it reads, per the graphics bar.

## Bots

- **Who carries it:** about 1 in 5 (`counter % 5 === 0` beside `BOT_SIDEARMS`, bots.js:177/192) get `secondaryId = "fhj18"`. Their pistol fallback when the primary is dry stays: a launcher bot draws its primary's reload instead.
- **When:** in `updateBotAntiAir` (combat/bot-fire.js:179), a launcher bot with an enemy aircraft within 140 m and in the clear (the same pick it uses today) and nobody shooting at it:
  1. sets `holdingSecondary`, faces the aircraft and pitches up (it already computes `b.yaw` and `b.pitch` there);
  2. locks over 1.2 to 2.0 s, scaled by difficulty;
  3. fires one missile through the player's launch path (owner = the bot, credit via `game.botEarn`);
  4. switches back after the shot, or when the target is gone.
  
  Bots without the launcher keep shooting air with their guns as today.
- **Seen raised:** bot states send the bot's real pitch (net.js:703 `rp: 0` → `rp: round2(bot.pitch)`), so everyone sees the tube pointed at the sky.

## Fixes the launcher brings to light

Downing air becomes common, so three existing rules start to show:
1. **Downing one UAV kills the whole team's UAV clock** (dragonfire.js:205 sets `uavUntil[team] = 0`). With two UAVs stacked, one missile wipes both. Fix: take off only that plane's remaining time.
2. **Downing an enemy Counter-UAV clears the jam** (`jammedUntil = 0`, dragonfire.js:209), but the UAV **lockout** it put on you stays (`lockStreak("uav", …)`, streaks/air.js:197). Fix: lift the lockout when the Counter-UAV that caused it goes down.
3. **VSATs can't be shot.** Keep it that way; BO2's satellite is out of reach. The launcher simply doesn't lock on it.

## Wire

```
{t:"streak", kind:"aa", action:"launch", eid:<owner id>, t:<target eid>, x,y,z, dx,dy,dz}
```
Every client spawns the same missile and flies it. Only the owner's client counts the hit and calls `shootDownAir(…, true)`, as the SAM does. Bots' launches go out under the host's id with the bot as owner.

## Tests (tools/troll-ops-fhj18-test.mjs, new; then into the gate)

1. A player with the launcher, aiming at an enemy UAV: lock in about 1.2 s, LOCKED shown, one missile, the UAV is down, +125.
2. Hip fire does nothing. Aiming at a ground bot never shows the bracket.
3. A gunship takes two missiles and the warship three.
4. A launcher bot downs an enemy Counter-UAV, and our radar comes back with no lockout left (fix 2).
5. Two stacked UAVs, one shot down: the other's time remains (fix 1).
6. Two tabs: the missile flies on both, and the second tab sees the aircraft go down.
7. Create a Class: the Secondary list shows Launchers; it's locked below level 20; the Royale loot table never has it.

## Build order (once approved)

1. Refactor: the missile code out of `SamTurret` (SAM tests green).
2. Weapon data, loadout slot, class fit, unlock.
3. The model (Blender trace, GLB, holds), with screenshots.
4. Player lock-on, fire, missile, credit, and the wire.
5. Bots.
6. Fixes 1 and 2.
7. Tests, cascade, one gate, push.

Each step is its own commit with its own targeted test (one system per commit).

## Open questions for the user

- **Unlock level:** 20 is proposed.
- **Should it also take out a SAM Turret?** BO2's couldn't (ground target). Proposed: no.
- **Three missiles a life.** Is that the right budget, or should Scavenger refill it?
