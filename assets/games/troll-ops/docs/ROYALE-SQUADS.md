# Troll Royale: Solo, Duo, Trio, Squad

User, 2026-10-30: "there should also be option to do duo trio and squad,
squad being 4 players". The party already holds four (-p4).

## What it is
Troll Royale gets a team size: Solo (1), Duo (2), Trio (3), Squad (4).
Still 100 on the island, so 100, 50, 33 (+1 solo spare) or 25 teams.
Last team standing wins.

## The picker
- On the Royale mode card and the mode select: Solo / Duo / Trio / Squad,
  four buttons, keyboard and pad reachable. The party leader picks; the
  rest see it.
- Default: the smallest size your party fits (party of 3 -> Trio).
  A size smaller than the party is greyed out ("Your party is 3").
- The room code carries the size, so everyone in a room plays the same one.

## Teams
- Your party is your team. Empty seats are filled with bots ("Fill"),
  as in a public match. Bots are grouped into teams of the same size.
- Each player gets a squad id; a team-aware check, sameSquad(a, b),
  replaces the `ffa` checks: friendly fire, aim assist, the minimap,
  bot targets, throwables, streak hostility, scoring (~20 sites, today
  either FFA or two sides).
- Teammates: name and a coloured marker over their head, on the minimap
  and the compass, and in a small team panel (name, health).
- The drop: your team rides the same plane and jumps together (the jump
  is still each player's own).

## Down, not out (Duo and up)
- At 0 health you go down: crawl slowly, can't shoot, bleed out in 30 s.
- A teammate holds the interact key next to you for 5 s to revive you, at
  30 health. Your whole team down = all eliminated.
- Solo keeps one hit, one life, as now.

## Out, spectate, the report
- Eliminated: you watch your teammates first, then whoever's left.
  The live match report (-rlr1) shows team placement.
- After the match: "Your team's place", the team's kills, each
  teammate's row on the Summary tab.

## Bots
- Bot teams move as a group (follow the leader within ~15 m), never shoot
  each other, revive a downed teammate when it's safe.

## Phases (one system each, each with its own test)
1. Team size: the picker, the room carries it, squad ids for players and
   bots, no friendly fire, last team standing wins.
2. Teammate markers: overhead, minimap, compass, team panel.
3. Down and revive.
4. The drop together, bot squads move together.
5. Spectate teammates first; the end screen by team.

## Decisions for the user
1. Down-and-revive in Duo/Trio/Squad, or straight elimination like Solo?
2. Fill empty seats with bots, or play short-handed?
3. Team size choices only in Troll Royale, or also somewhere else?
