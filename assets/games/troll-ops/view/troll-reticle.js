// Troll Forces — the trollface reticles. The troll fist sits in the sight;
// the moment an enemy is lined up behind it, it flips to "get trolled".
//
// Earned at level 10 (progression getRank, so it never relocks after a
// prestige) and picked in the Locker (menu/menu-bo2.js, Reticle): from then
// on every optic wears it, the reflex included, in every mode. Troll Royale's
// sniper scopes wear it for everyone, whatever their level.
//
// The 3D optics carry it as hidden reticle variants (weapons/attachment-
// models.js sightMark "troll-idle" / "troll-hit"); the 8x scope's overlay
// shows it as a picture (view/sniper-scope.js). view/weapon-view.js decides
// which, once a frame, from trollReticleSkin().

import { getRank } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1";
import { game } from "../core/state.js?v=st1";

const PREF_KEY = "trollops:reticle";
export const TROLL_RETICLE_LEVEL = 10;
export const TROLL_RETICLE_URLS = {
  idle: new URL("../ui/reticles/troll-fist.png", import.meta.url).href,
  hit: new URL("../ui/reticles/get-trolled.png", import.meta.url).href,
};

export function trollReticleUnlocked() {
  try { return getRank() >= TROLL_RETICLE_LEVEL; } catch { return false; }
}
/* What the player picked: "troll" or "classic" (the optic's own). */
export function trollReticlePref() {
  try { return localStorage.getItem(PREF_KEY) === "troll"; } catch { return false; }
}
export function setTrollReticlePref(on) {
  try { on ? localStorage.setItem(PREF_KEY, "troll") : localStorage.removeItem(PREF_KEY); } catch {}
}

/* Does this gun's sight wear it right now? `w` the WeaponState, `optic`
   whether the gun has glass that can carry it (iron sights can't). */
export function trollReticleOn(w, optic) {
  if (!optic) return false;
  if (game.modeId === "royale" && w?.def?.cls === "sniper") return true;
  return trollReticlePref() && trollReticleUnlocked();
}

/* null (the optic's own reticle), "idle" (the fist) or "hit" (an enemy in
   the sights: `linedUp`, asked only when it's on). */
export function trollReticleSkin(w, optic, linedUp) {
  if (!trollReticleOn(w, optic)) return null;
  return linedUp() ? "hit" : "idle";
}
