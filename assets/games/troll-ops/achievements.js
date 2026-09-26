// Troll Forces — one-off accomplishments.
//
// Everything here reads data the game already tracks: hit distance rides along
// with every bullet (ballistics.js), assists and headshots are already counted
// on `player`, and who killed us last is one field away. No new per-frame
// bookkeeping — these are checks at moments that already exist.
//
// Two layers: `earned` is per-match ("did this just happen"), and the
// localStorage set is permanent ("have I ever"). The per-match layer is what
// gates the callout, so you don't get told about First Blood twice.

const STORE = "trollops:achievements";

export const LONGSHOT_METRES = 40;
export const SHUTDOWN_STREAK = 5;    // ending a streak this long counts
export const MEDIC_ASSISTS = 5;
export const COMEBACK_DEFICIT = 15;  // points behind at the low point

export const ACHIEVEMENTS = {
  firstblood:  { id: "firstblood",  name: "First Blood",     blurb: "Opened the match." },
  longshot:    { id: "longshot",    name: "Longshot",        blurb: `A kill from ${LONGSHOT_METRES}m or further.` },
  revenge:     { id: "revenge",     name: "Revenge",         blurb: "Killed whoever killed you last." },
  shutdown:    { id: "shutdown",    name: "Shutdown",        blurb: "Ended someone's streak." },
  comeback:    { id: "comeback",    name: "Comeback",        blurb: "Won from well behind." },
  flawless:    { id: "flawless",    name: "Flawless",        blurb: "Finished without dying." },
  medic:       { id: "medic",       name: "Combat Medic",    blurb: `${MEDIC_ASSISTS} assists in a match.` },
  bombtech:    { id: "bombtech",    name: "Bomb Specialist", blurb: "Planted or defused." },
  gunship:     { id: "gunship",     name: "Air Superiority", blurb: "Called in a gunship." },
};

function loadUnlocked() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE)) || []); } catch { return new Set(); }
}

export class Achievements {
  constructor(onEarn) {
    this.onEarn = onEarn || (() => {});
    this.unlocked = loadUnlocked();
    this.reset();
  }

  reset() {
    this.earned = new Set();
    this.firstBloodTaken = false;
    this.maxDeficit = 0;
  }

  /* Awards once per match. Returns true the first time, so callers can treat
     it as "did this fire". */
  award(id) {
    if (!ACHIEVEMENTS[id] || this.earned.has(id)) return false;
    this.earned.add(id);
    if (!this.unlocked.has(id)) {
      this.unlocked.add(id);
      try { localStorage.setItem(STORE, JSON.stringify([...this.unlocked])); } catch { /* private mode */ }
    }
    this.onEarn(ACHIEVEMENTS[id]);
    return true;
  }

  /* Called from registerDeath's "I got the kill" branch. `victimStreak` comes
     off the wire — the victim's client knows its own streak and sends it with
     the death, since nobody else is tracking it. */
  onKill({ victimId, victimStreak = 0, distance = 0, lastKilledBy = null } = {}) {
    if (!this.firstBloodTaken) {
      this.firstBloodTaken = true;
      this.award("firstblood");
    }
    if (distance >= LONGSHOT_METRES) this.award("longshot");
    if (victimId && lastKilledBy && victimId === lastKilledBy) this.award("revenge");
    if (victimStreak >= SHUTDOWN_STREAK) this.award("shutdown");
  }

  /* Someone else drew first blood — the flag is per-match and match-wide, so
     a peer's kill closes it for us too. */
  noteKillByOther() {
    this.firstBloodTaken = true;
  }

  /* Track how far behind we ever got, for Comeback. */
  noteScores(mine, theirs) {
    this.maxDeficit = Math.max(this.maxDeficit, theirs - mine);
  }

  onMatchEnd({ won = false, deaths = 0, assists = 0, kills = 0 } = {}) {
    if (won && this.maxDeficit >= COMEBACK_DEFICIT) this.award("comeback");
    if (deaths === 0 && kills > 0) this.award("flawless");
    if (assists >= MEDIC_ASSISTS) this.award("medic");
  }
}
