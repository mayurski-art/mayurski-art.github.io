// Troll Forces — game modes.
//
// A mode is mostly data: what wins, whether sides matter, and whether it
// overrides your loadout. The few behavioural hooks (`onKill`, `equipFor`)
// keep Gun Game and One in the Chamber from leaking special cases into the
// main loop.

import { FlowField } from "./nav.js";

export const MODES = {
  ops: {
    id: "ops",
    name: "Ops",
    short: "Ops · solo horde",
    pvp: false,
    blurb: "Solo. Waves of grunts until they get you.",
  },

  range: {
    id: "range",
    name: "Test Range",
    short: "Test Range",
    pvp: false,
    range: true,
    forceMap: "range",
    blurb: "No enemies, no clock. Set your sensitivity and FOV, then shoot things that stand back up.",
  },

  zombies: {
    id: "zombies",
    name: "Zombies",
    short: "Zombies · The Pentagrin",
    pvp: false,
    zombies: true,
    forceMap: "pentagrin",
    blurb: "Three floors of Pentagon. Pepe and trollface, and they do not stop coming.",
  },

  tdm: {
    id: "tdm",
    name: "Team Deathmatch",
    short: "Team Deathmatch",
    pvp: true, ffa: false,
    scoreLimit: 50,
    timeLimit: 600,   // 10 minutes — highest score wins if nobody hits 50 first
    blurb: "Phantoms against Ghosts. First side to 50 kills, or most at the buzzer.",
  },

  koth: {
    id: "koth",
    name: "King of the Hill",
    short: "King of the Hill",
    pvp: true, ffa: false,
    scoreLimit: 150,
    hill: true,
    blurb: "One ring, moving every 45 seconds. Hold it and the meter ticks.",
  },

  oitc: {
    id: "oitc",
    name: "One in the Chamber",
    short: "One in the Chamber",
    pvp: true, ffa: true,
    scoreLimit: 12,
    weapon: "widedeagle",
    oneShot: true,
    // Both this and Gun Game are decided entirely by the weapon in your
    // hands, so a gunship overhead reads as broken rather than earned.
    noStreaks: true,
    noBotNades: true,
    blurb: "One bullet, one kill. Land it and you get the round back; miss and you're empty.",
    // Everyone is lethal and nearly out of ammo.
    tuneWeapon(def) {
      return { ...def, damage: 500, magSize: 1, reserveMax: 1, fireMode: "semi", reloadTime: 0.01 };
    },
  },

  snd: {
    id: "snd",
    name: "Search & Destroy",
    short: "Search & Destroy",
    pvp: true, ffa: false,
    rounds: true,
    roundsToWin: 6,     // first to 6 — Black Ops 2's number, no overtime
    blurb: "One life. Phantoms plant, Ghosts defuse. First to 6 rounds, sides swap at 5.",
  },

  gungame: {
    id: "gungame",
    name: "Gun Game",
    short: "Gun Game",
    pvp: true, ffa: true,
    ladder: [
      "pocketgrin", "smg", "snubgrin", "chuckle", "problem416",
      "sneer", "shotgun", "bellow", "cackle", "deadpan", "widedeagle",
    ],
    noStreaks: true,   // see oitc
    noBotNades: true,
    blurb: "Every kill moves you up the rack. Clear the rack to win.",
  },

  /* Everyone starts a survivor (the Phantoms slot, relabelled); a few
     seconds in, one or two are picked to be infected (the Ghosts slot).
     Infected carry only the sword, move faster and take more to put down;
     a survivor who dies gets up infected. Survivors win if anyone is left
     when the clock runs out. game.js owns the flow (updateInfection). */
  infection: {
    id: "infection",
    name: "Infection",
    short: "Infection",
    pvp: true, ffa: false,
    infection: true,
    timeLimit: 180,     // counts from the first infection, not from GO
    noStreaks: true,    // a gunship over a knife fight isn't a fight
    blurb: "One of you starts infected. Every survivor they cut down joins them. Last three minutes to win.",
  },
};

/* Infection tuning. */
export const INFECTION = {
  firstDelay: 8,          // seconds after GO before anyone is infected
  twoFirstAt: 8,          // with this many in the match, two start infected
  speed: 1.2,             // infected move this much faster
  hp: 150,
  respawn: 3,             // infected are back up quicker than the usual 4s
};

export const MODE_IDS = Object.keys(MODES);
export const PVP_MODE_IDS = MODE_IDS.filter((id) => MODES[id].pvp);

/* Which weapon id this mode wants a player holding right now. `null` means
   "whatever they picked in the loadout". */
export function weaponForMode(mode, progress = 0) {
  if (mode.weapon) return mode.weapon;
  if (mode.ladder) return mode.ladder[Math.min(progress, mode.ladder.length - 1)];
  return null;
}

/* Has this player finished the mode single-handedly? (Gun Game only.) */
export function playerWon(mode, progress) {
  return !!mode.ladder && progress >= mode.ladder.length;
}

/* Has a side or a player hit the score limit? Returns a winner label or null. */
export function matchWinner(mode, { teamScores, selfScore, selfName, peers }) {
  if (mode.ladder) return null; // decided by ladder progress instead

  // Search & Destroy scores round wins onto the same teamScores bucket
  // everything else scores kills onto, so it shares this check — just against
  // roundsToWin instead of scoreLimit.
  const limit = mode.rounds ? mode.roundsToWin : mode.scoreLimit;
  if (!limit) return null;

  if (mode.ffa) {
    if (selfScore >= limit) return `${selfName} wins`;
    for (const p of peers) {
      if ((p.kills | 0) >= limit) return `${p.name} wins`;
    }
    return null;
  }

  if (teamScores.phantom >= limit) return "Phantoms win";
  if (teamScores.ghost >= limit) return "Ghosts win";
  return null;
}

/* The clock ran out before anyone hit the score limit: highest score takes
   it, a tie splits the difference rather than picking a side arbitrarily. */
export function matchWinnerOnTimeout(mode, { teamScores, selfScore, selfName, peers }) {
  // Anyone still standing as a survivor when the clock runs out wins it for
  // them; the moment the last one falls, game.js ends it for the infected.
  if (mode.infection) return "Survivors win";
  if (mode.ffa) {
    let bestName = selfName, bestScore = selfScore, tie = false;
    for (const p of peers) {
      const k = p.kills | 0;
      if (k > bestScore) { bestScore = k; bestName = p.name; tie = false; }
      else if (k === bestScore) tie = true;
    }
    return tie ? "Time's up — tie" : `${bestName} wins`;
  }

  if (teamScores.phantom === teamScores.ghost) return "Time's up — tie";
  return teamScores.phantom > teamScores.ghost ? "Phantoms win" : "Ghosts win";
}

/* King of the Hill: a capture ring that relocates on a timer. */
export class Hill {
  /* `points` from pickHillPoints — the stride below walks all of them when
     their count isn't a multiple of 3 (it's 7 on an unobstructed map). */
  constructor(points, period = 45) {
    this.points = points.map((p) => ({ x: p.x, z: p.z }));
    this.period = period;
    this.radius = 6;
    this.index = 0;
    this.t = 0;
    this.holder = null;
  }

  get position() { return this.points[this.index % this.points.length] || { x: 0, z: 0 }; }

  contains(x, z) {
    const p = this.position;
    return Math.hypot(x - p.x, z - p.z) <= this.radius;
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.period) {
      this.t = 0;
      // step by a prime-ish stride so it doesn't just cycle the same pair
      this.index = (this.index + 3) % this.points.length;
      return true; // moved
    }
    return false;
  }

  get secondsLeft() { return Math.max(0, Math.ceil(this.period - this.t)); }
}

/* Which spawn points belong to which side of the map.

   Every map lists its spawns as a ring (corners, then edge midpoints), so
   splitting the *list* in half — what spawnForTeam used to do — handed one
   team all four corners and the other all four midpoints: interleaved round
   the perimeter, enemies spawning 9m apart on Undergrin. Sides are split by
   position instead, along whichever axis leaves the two halves furthest
   apart. Deterministic (ties fall back to the other axis, then list order),
   so every client derives the same sides with no messages. */
export function splitSpawnSides(points) {
  const n = points.length;
  const cut = Math.floor(n / 2);
  let best = null;
  for (const axis of ["x", "z"]) {
    const other = axis === "x" ? "z" : "x";
    const order = points.map((_, i) => i).sort((a, b) =>
      (points[a][axis] - points[b][axis]) || (points[a][other] - points[b][other]) || (a - b));
    const lo = order.slice(0, cut), hi = order.slice(cut);
    let gap = Infinity;
    for (const a of lo) for (const b of hi) {
      gap = Math.min(gap, Math.hypot(points[a].x - points[b].x, points[a].z - points[b].z));
    }
    if (!best || gap > best.gap + 1e-6) best = { axis, lo, hi, gap };
  }
  return best;
}

/* Is there room to stand here? Nothing between knee and head height inside
   `r`, and inside the map. Knee-high decking passes — it's walked over. */
function openAt(colliders, bounds, x, z, r) {
  if (x < bounds.minX + r + 1 || x > bounds.maxX - r - 1) return false;
  if (z < bounds.minZ + r + 1 || z > bounds.maxZ - r - 1) return false;
  for (const c of colliders) {
    if (c.max.y <= 0.45 || c.min.y >= 2.4) continue;
    const cx = Math.max(c.min.x, Math.min(x, c.max.x));
    const cz = Math.max(c.min.z, Math.min(z, c.max.z));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  return true;
}

/* Nearest open, ground-level spot to (x, z), searched outward in rings. The
   raw point is usually fine; when it lands inside a house or under a
   catwalk this walks it out to the nearest street. `reachable` optionally
   rejects spots nobody can walk to. Falls back to the raw point. */
export function findOpenGround(colliders, bounds, x, z, r = 2, reachable = null) {
  const STEP = 0.75, MAX = 16;
  for (let ring = 0; ring * STEP <= MAX; ring++) {
    const rad = ring * STEP;
    const count = ring === 0 ? 1 : Math.max(8, Math.round(rad * 2 * Math.PI / STEP));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad;
      if (!openAt(colliders, bounds, px, pz, r)) continue;
      if (reachable && !reachable(px, pz)) continue;
      return { x: Math.round(px * 100) / 100, z: Math.round(pz * 100) / 100 };
    }
  }
  return { x, z };
}

/* A predicate: can someone walking from the spawns get to (x, z)? One flow
   field swept out from the first spawn; everything else just asks it. */
function reachableFrom(colliders, bounds, spawnPoints) {
  if (!spawnPoints?.length) return null;
  const field = new FlowField(colliders, bounds, 0);
  const s = spawnPoints[0];
  if (!field.compute(s.x, s.z)) return null;
  return (x, z) => {
    const i = field.index(x, z);
    return i >= 0 && !field.blocked[i] && field.dist[i] > 0;
  };
}

/* Two bomb sites on the defenders' half of the map.

   The first version placed sites off the bounds alone, which put Depot's on
   top of a catwalk (4.8m up) and Cul-de-Grin's on a roof — the ring floated
   where nobody could stand, while planting was only checked in 2D. Sites now
   sit between the middle and the defending spawns (`hi` side from
   splitSpawnSides — S&D spawns attackers on `lo`), spread across the map,
   then snap to the nearest open ground someone can actually walk to. */
export function pickBombSites(bounds, spawnPoints, colliders = []) {
  const sides = splitSpawnSides(spawnPoints);
  const axis = sides.axis;
  const mean = (idx) => idx.reduce((s, i) => s + spawnPoints[i][axis], 0) / idx.length;
  const loC = mean(sides.lo), hiC = mean(sides.hi);
  const mid = (loC + hiC) / 2;
  const min = axis === "x" ? "minZ" : "minX", max = axis === "x" ? "maxZ" : "maxX";
  const acrossC = (bounds[min] + bounds[max]) / 2;
  const acrossSpan = bounds[max] - bounds[min];

  let across = acrossSpan * 0.27;
  let alongA = mid + (hiC - mid) * 0.5, alongB = alongA;
  // A narrow map (Undergrin's platform) can't spread sites sideways far
  // enough to be two places — stagger them along the long axis instead.
  if (across * 2 < 14) {
    across = acrossSpan * 0.18;
    alongA = mid + (hiC - mid) * 0.25;
    alongB = mid + (hiC - mid) * 0.72;
  }
  const at = (along, off) => axis === "x"
    ? { x: along, z: acrossC + off }
    : { x: acrossC + off, z: along };
  const reach = reachableFrom(colliders, bounds, spawnPoints);
  const pa = at(alongA, -across), pb = at(alongB, across);
  const a = findOpenGround(colliders, bounds, pa.x, pa.z, 2.2, reach);
  // Snapping can walk both sites onto the same open patch (Undergrin's
  // pillars leave one clear stretch), so B has to keep its distance from A.
  const apart = (x, z) => Math.hypot(x - a.x, z - a.z) >= 14 && (!reach || reach(x, z));
  const b = findOpenGround(colliders, bounds, pb.x, pb.z, 2.2, apart);
  return [{ id: "A", ...a }, { id: "B", ...b }];
}

/* Where King of the Hill's ring goes. It used to cycle through the spawn
   points, which put the objective on the map edge and let a team respawn
   straight into it. Now: the middle, then a ring through the contested band
   between the sides, each snapped to open reachable ground. */
export function pickHillPoints(bounds, spawnPoints, colliders = []) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const rx = (bounds.maxX - bounds.minX) * 0.26;
  const rz = (bounds.maxZ - bounds.minZ) * 0.26;
  const reach = reachableFrom(colliders, bounds, spawnPoints);
  const raw = [{ x: cx, z: cz }];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    raw.push({ x: cx + Math.cos(a) * rx, z: cz + Math.sin(a) * rz });
  }
  const out = [];
  for (const p of raw) {
    const q = findOpenGround(colliders, bounds, p.x, p.z, 1.4, reach);
    if (out.every((o) => Math.hypot(o.x - q.x, o.z - q.z) > 6)) out.push(q);
  }
  return out;
}

/* Search & Destroy round/bomb state. One life a side, no economy — carry
   your loadout in, plant or defend, next round starts fresh. Bomb state is
   client-authoritative like everything else here: whoever is planting or
   defusing owns the progress and broadcasts it, and a `bomb` net message
   carries the outcome (plant/defuse/explode) to everyone else. */
export const BOMB_TIME = 40;        // seconds the bomb ticks once planted
export const PLANT_TIME = 3.5;
export const DEFUSE_TIME = 6;

export class Bomb {
  constructor(sites) {
    this.sites = sites;             // [{id, x, z}, {id, x, z}]
    this.reset();
  }

  reset() {
    this.state = "carried";         // carried | planted | defused | exploded
    this.site = null;               // which site it's planted at
    this.fuse = 0;                  // seconds left once planted
    this.carrierId = null;          // who has it when it's not planted
    this.action = null;             // { kind: "plant"|"defuse", by, progress, site? } or null
  }

  siteAt(id) { return this.sites.find((s) => s.id === id) || this.sites[0]; }

  plant(siteId) {
    this.state = "planted";
    this.site = siteId;
    this.fuse = BOMB_TIME;
    this.carrierId = null;
    this.action = null;
  }

  explode() { this.state = "exploded"; this.action = null; }
  defuse() { this.state = "defused"; this.action = null; }

  update(dt) {
    if (this.state !== "planted") return false;
    this.fuse = Math.max(0, this.fuse - dt);
    if (this.fuse <= 0) { this.explode(); return true; }
    return false;
  }
}
