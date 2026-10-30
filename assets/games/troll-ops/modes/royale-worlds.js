// Troll Royale: Two Worlds in the after-action report's Map tab
// (modes/after-action.js). The plan of the level is a top-down render of the
// map as the match ends (view/blueprint-capture.js), and by then the island
// has turned over: the side you dropped on is gone. So the old side is drawn
// just before the flip swaps it out (royale.js swapRoyaleSide; the camera is
// on the island model then, and the swap's own load hitches anyway), and
// the report gets a plan per side, each with what you did there.
//   Survived the flip: both sides, a toggle between them (user, 2026-10-29:
//   "they should be able to see both maps in the maps after the match ends").
//   Out before it: only the side you played (the end's render would be the
//   other one, where you never were).

import { captureBlueprintLater } from "../view/blueprint-capture.js?v=bc1-rw1";
import { matchLog } from "../combat/match-log.js?v=ml1-bp2";
import { SIDE_NAMES } from "./royale-side.js?v=rs1-tw1";
import { game } from "../core/state.js?v=st1";

export const sideName = (id) => SIDE_NAMES[id]?.name || id || "";

/* The side `from` as it stands, before the swap: its plan (rendered now,
   traced at the report: the flip runs on the room's clock, so time spent
   in the swap's frame comes off the cinematic), its bounds and walls, and
   when (on the match log's clock) you left it. */
export function noteWorldBeforeSwap(r, from) {
  if (!r || r.lateJoin || r.worlds) return;
  const events = matchLog.events.slice();
  // the storm's wall isn't part of the level
  const wall = r.visual?.group, shown = wall?.visible;
  if (wall) wall.visible = false;
  const capture = captureBlueprintLater({
    renderer: game.renderer, scene: game.scene, colliders: game.colliders, arena: game.ARENA,
    floorY: game.player.alive ? game.move.pos.y : 0, events,
  });
  if (wall) wall.visible = shown;
  r.worlds = [{ id: from, arena: { ...game.ARENA }, colliders: game.colliders.slice(), untilT: game.player.matchT, alive: !!game.player.alive, capture }];
}

function countOf(events) {
  const c = { kill: 0, death: 0, assist: 0 };
  for (const e of events) c[e.kind]++;
  return c;
}

/* The report's sides, for after-action.js (null: one map, as before). `d`
   is afterActionData's: the events, bounds and walls as the match ended.
   `live` marks the side the end's render (queueBlueprint) belongs to. */
export function royaleWorlds(r, d) {
  const w = r?.worlds?.[0];
  if (!w) return null;
  const first = { id: w.id, name: sideName(w.id), arena: w.arena, colliders: w.colliders, capture: w.capture?.finish() || null };
  if (!w.alive) return [{ ...first, events: d.events, counts: countOf(d.events) }];
  const before = d.events.filter((e) => (e.t || 0) <= w.untilT), after = d.events.filter((e) => (e.t || 0) > w.untilT);
  return [
    { ...first, events: before, counts: countOf(before) },
    { id: game.loadedMapId, name: sideName(game.loadedMapId), arena: d.arena, colliders: d.colliders, events: after, counts: countOf(after), live: true },
  ];
}
