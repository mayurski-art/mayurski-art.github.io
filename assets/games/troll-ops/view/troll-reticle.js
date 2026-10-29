// Troll Forces — the trollface reticles. The troll fist sits in the sight;
// the moment an enemy is lined up behind it, it flips to "get trolled".
//
// Earned at level 10 (progression getRank, so it never relocks after a
// prestige) and picked in the Locker (menu/menu-bo2.js, Reticle): from then
// on every optic wears it, the reflex included, in every mode. Below the
// level, picking it puts it on Troll Royale's sniper scopes only. Classic
// (each optic's own) is the default for everyone (user, 2026-10-29: "by
// default the regular reticles should be shown").
//
// The 3D optics carry it as hidden reticle variants (weapons/attachment-
// models.js sightMark "troll-idle" / "troll-hit"); the 8x scope's overlay
// shows it as a picture (view/sniper-scope.js). view/weapon-view.js decides
// which, once a frame, from trollReticleSkin().

import { getRank } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1-ars1";
import { game } from "../core/state.js?v=st1";

// -v2: a fresh key, so everyone starts back on Classic once.
const PREF_KEY = "trollops:reticle-v2";
export const TROLL_RETICLE_LEVEL = 10;
export const TROLL_RETICLE_URLS = {
  idle: new URL("../ui/reticles/troll-fist.png?v=hd1", import.meta.url).href,
  hit: new URL("../ui/reticles/get-trolled.png?v=hd1", import.meta.url).href,
};

export function trollReticleUnlocked() {
  try { return getRank() >= TROLL_RETICLE_LEVEL; } catch { return false; }
}
/* What the player picked: "troll", "classic" or nothing yet (classic). */
function pref() {
  try { return localStorage.getItem(PREF_KEY); } catch { return null; }
}
export function trollReticlePref() {
  return pref() === "troll";
}
export function setTrollReticlePref(on) {
  try { localStorage.setItem(PREF_KEY, on ? "troll" : "classic"); } catch {}
}
/* The Reticle row: below the level it only decides Royale's snipers. */
export function trollReticleLabel() {
  if (trollReticleUnlocked()) return trollReticlePref() ? "Trollface" : "Classic";
  return trollReticlePref() ? "Royale snipers" : "Classic";
}
export function toggleTrollReticle() {
  setTrollReticlePref(!trollReticlePref());
}

/* Does this gun's sight wear it right now? `w` the WeaponState, `optic`
   whether the gun has glass that can carry it (iron sights can't). */
export function trollReticleOn(w, optic) {
  if (!optic || !trollReticlePref()) return false;
  if (game.modeId === "royale" && w?.def?.cls === "sniper") return true;
  return trollReticleUnlocked();
}

/* null (the optic's own reticle), "idle" (the fist) or "hit" (an enemy in
   the sights: `linedUp`, asked only when it's on). */
export function trollReticleSkin(w, optic, linedUp) {
  if (!trollReticleOn(w, optic)) return null;
  return linedUp() ? "hit" : "idle";
}
