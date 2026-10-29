// Troll Royale: which side of the island your match starts on ("Two
// Worlds": MODES.royale.sides), your pick in the lobby (user, 2026-10-28:
// "before starting the troll royale game there should be an option to
// choose from halloween version versus the default version"). Trollface
// Island is the default; Hollowgrin, the underside, the Halloween one. A
// room plays its host's (royale.js pickSide). Its own small module so the
// menu doesn't load all of royale.js for it.

const PREF_KEY = "trollops:royaleSide";
/* Each side's name and its line in the lobby. */
export const SIDE_NAMES = {
  trollface: { name: "Trollface Island", tag: "Default" },
  hollowgrin: { name: "Hollowgrin", tag: "Halloween" },
};

/* Your pick among `sides`, else the first (the default island). */
export function sidePref(sides) {
  let id = null;
  try { id = localStorage.getItem(PREF_KEY); } catch {}
  return sides.includes(id) ? id : sides[0];
}
/* Keeps it and tells the lobby (lobby-fn.js redraws its card). */
export function setSidePref(id) {
  try { localStorage.setItem(PREF_KEY, id); } catch {}
  window.dispatchEvent(new CustomEvent("tf-royale-side", { detail: id }));
}
