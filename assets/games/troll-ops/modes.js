// Troll Ops — game modes.
//
// A mode is mostly data: what wins, whether sides matter, and whether it
// overrides your loadout. The few behavioural hooks (`onKill`, `equipFor`)
// keep Gun Game and One in the Chamber from leaking special cases into the
// main loop.

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
    scoreLimit: 30,
    blurb: "Phantoms against Ghosts. First side to 30.",
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
    blurb: "Every kill moves you up the rack. Clear the rack to win.",
  },
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

/* King of the Hill: a capture ring that relocates on a timer. */
export class Hill {
  constructor(spawnPoints, period = 45) {
    this.points = spawnPoints.map((p) => ({ x: p.x, z: p.z }));
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

/* Two bomb sites, picked from a map's bounds rather than hand-authored — no
   map currently ships site geometry, and placing it well on all five is its
   own project. Every map here is built roughly symmetric around its centre
   (spawns ring the perimeter — see the `spawns` arrays in maps.js), which
   means splitting the spawn list in half like spawnForTeam does averages out
   to the same point both halves: not a usable axis. So this uses the bounds'
   own longer side instead — reliable on every map regardless of spawn
   layout — and offsets each site off-centre along the *shorter* side too, so
   A and B land in different corners rather than both sitting on one line
   through the middle. */
export function pickBombSites(bounds, spawnPoints) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const spanX = bounds.maxX - bounds.minX, spanZ = bounds.maxZ - bounds.minZ;
  const longAxisIsX = spanX >= spanZ;
  const along = (longAxisIsX ? spanX : spanZ) * 0.28;   // how far apart, along the long side
  const across = (longAxisIsX ? spanZ : spanX) * 0.22;  // how far off-centre, along the short side
  return longAxisIsX
    ? [{ id: "A", x: cx - along, z: cz - across }, { id: "B", x: cx + along, z: cz + across }]
    : [{ id: "A", x: cx - across, z: cz - along }, { id: "B", x: cx + across, z: cz + along }];
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
