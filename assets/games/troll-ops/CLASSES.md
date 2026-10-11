# Troll Forces: classes and perks

Built 2026-10-10 (user: "Users should also be able to presave their class sets which includes throwables, weapons, melee, scorestreaks. Should also add perks into the game as well. For now make them just like in call of duty black ops 2. I plan to customize them in the future.").

## Classes
- Five classes (`loadout.js`, `CLASS_COUNT`): name, primary, secondary, melee, the one throwable, three scorestreaks, a perk per tier. Attachments stay per gun, shared by every class carrying it.
- Saved in `trollops:loadout` as v2 `{ v, active, classes[5], attachments, mapId, poolMapId }`, plus the active class's picks flat (the v1 shape) for older builds. A v1 save becomes Class 1, with 2-5 copies of it. `trollops:streaks` mirrors the active class's three. Both keys are cloud-synced as before (whole blob).
- `restoreSaved()` reloads the whole save (boot and cloud restore alike).
- Menu (`menu-bo2.js`): Create a Class → the five → a class: Primary, Secondary, Attachments, Melee, Throwable, Perk 1-3, Scorestreaks, Rename.
- In a match: pause → Change Class. Saved at once, carried from the next respawn (gun, perks, the three streaks; the meter and anything earned stay). Hidden in Gun Game, One in the Chamber, Royale and Socialize (`combat/perk-carry.js classAllowed`).

## Perks (`perks.js`)
BO2's sixteen, one per tier, level-gated (two free per tier). Numbers in `PERK_TUNE`.

| Perk | Here | Where |
|---|---|---|
| Lightweight | move +7% | view/player-update.js |
| Flak Jacket | explosives (frags, exploding streaks) ×0.35 | combat/damage.js |
| Hardline | streaks cost 20% less | scorestreaks.js `costFor` |
| Blind Eye | air streaks don't pick you | streaks/fire.js, air.js, bot-streaks.js |
| Ghost | off the UAV while moving (VSAT still shows) | core/minimap.js, streaks/fire.js |
| Toughness | the hit kick ×0.25 (the kick is new, for everyone) | combat/damage.js |
| Fast Hands | throwables twice as fast | combat/throw-anim.js |
| Scavenger | your kills drop ammo packs | combat/scavenger.js |
| Cold Blooded | dogs don't pick you; name not red | streaks/k9.js, remote-players.js |
| Hard Wired | counter-UAV and EMP don't touch you | streaks/calling.js, combat/throwables.js |
| Dexterity | ADS ×2, out of a sprint ×2 | view/player-update.js, weapons.js |
| Extreme Conditioning | sprint +8% (no sprint limit exists) | view/player-update.js |
| Tactical Mask | flash, EMP ×0.2 | combat/throwables.js |
| Dead Silence | your steps silent to others | view/enemy-steps.js |
| Awareness | enemy steps ×2 | view/enemy-steps.js |
| Engineer | enemy streaks marked through walls | view/engineer-marks.js |

- Carried from each spawn (`combat/perk-carry.js`), shown on BO2's spawn card. Ghost, Dead Silence, Cold Blooded and Blind Eye go out as bits in the state message (`pk`), so other clients honour them.
- Bots carry no perks. Not done from BO2: Engineer's care-package re-roll, Blind Eye vs. the SAM turret's missiles.
- Tests: `troll-ops-classes-test.mjs`, `troll-ops-perks-test.mjs` (solo and two tabs).
