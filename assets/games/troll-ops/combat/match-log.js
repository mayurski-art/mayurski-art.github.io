// Troll Forces match log: where this match's kills, deaths and assists
// happened, for the after-action screen's blueprint map
// (modes/after-action.js). Positions are arena x/z; `from` is the other
// party where it's known (the shooter of a death, the victim of a kill), so
// the map can draw the line of the shot.
//
// Reset from beginMatch; fed from scoring.js (kills, assists) and damage.js
// (our deaths). Nothing here goes on the wire.

const MAX_EVENTS = 400;

export const matchLog = {
  events: [],   // { kind: "kill" | "death" | "assist", x, y, z, from: {x, z} | null, weapon, head, t }

  reset() { this.events.length = 0; },

  /* A kill of ours: where the victim fell, and where we stood. */
  kill(victimPos, myPos, weapon, head = false, t = 0) {
    this.push("kill", victimPos || myPos, victimPos ? myPos : null, weapon, head, t);
  },

  /* Our death: where we fell, and where the shot came from. */
  death(myPos, killerPos, weapon, t = 0) {
    this.push("death", myPos, killerPos, weapon, false, t);
  },

  assist(victimPos, myPos, t = 0) {
    this.push("assist", victimPos || myPos, null, null, false, t);
  },

  push(kind, at, from, weapon, head, t) {
    if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return;
    if (this.events.length >= MAX_EVENTS) this.events.shift();
    this.events.push({
      kind, x: at.x, z: at.z, y: Number.isFinite(at.y) ? at.y : null,
      from: from && Number.isFinite(from.x) && Number.isFinite(from.z) ? { x: from.x, z: from.z } : null,
      weapon: weapon || null, head: !!head, t,
    });
  },

  counts() {
    const c = { kill: 0, death: 0, assist: 0 };
    for (const e of this.events) c[e.kind]++;
    return c;
  },
};
