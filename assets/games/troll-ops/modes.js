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

  if (!mode.scoreLimit) return null;

  if (mode.ffa) {
    if (selfScore >= mode.scoreLimit) return `${selfName} wins`;
    for (const p of peers) {
      if ((p.kills | 0) >= mode.scoreLimit) return `${p.name} wins`;
    }
    return null;
  }

  if (teamScores.phantom >= mode.scoreLimit) return "Phantoms win";
  if (teamScores.ghost >= mode.scoreLimit) return "Ghosts win";
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
