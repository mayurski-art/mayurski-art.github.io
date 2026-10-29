// Troll Forces — the trollface reticles. The troll fist sits in the sight;
// the moment an enemy is lined up behind it, it flips to "get trolled".
//
// Earned at level 10 (progression getRank, so it never relocks after a
// prestige) and picked in the Locker (menu/menu-bo2.js, Reticle): from then
// on every optic wears it, the reflex included, in every mode. Troll Royale's
// sniper scopes wear it for everyone, whatever their level, unless they
// picked Classic (the Reticle row, in the Locker and in Options: user,
// 2026-10-29, "I don't see the option to switch to a regular reticle").
//
// The 3D optics carry it as hidden reticle variants (weapons/attachment-
// models.js sightMark "troll-idle" / "troll-hit"); the 8x scope's overlay
// shows it as a picture (view/sniper-scope.js). view/weapon-view.js decides
// which, once a frame, from trollReticleSkin().

import { getRank } from "../progression/progression.js?v=p5-wst-sb2-fu1-wb1-ar1-ar2-cl1-fj1-zc1-zc2-nf1-or1-rfx1-ret1-mrg1-mrc1-tw1";
import { game } from "../core/state.js?v=st1";

const PREF_KEY = "trollops:reticle";
export const TROLL_RETICLE_LEVEL = 10;
export const TROLL_RETICLE_URLS = {
  idle: new URL("../ui/reticles/troll-fist.png?v=hd1", import.meta.url).href,
  hit: new URL("../ui/reticles/get-trolled.png?v=hd1", import.meta.url).href,
};

export function trollReticleUnlocked() {
  try { return getRank() >= TROLL_RETICLE_LEVEL; } catch { return false; }
}
/* What the player picked: "troll", "classic" (the optic's own, Royale's
   snipers too) or nothing yet (classic, but Royale's snipers wear it). */
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
  return pref() === "classic" ? "Classic" : "Royale snipers";
}
export function toggleTrollReticle() {
  setTrollReticlePref(trollReticleUnlocked() ? !trollReticlePref() : pref() === "classic");
}

/* Does this gun's sight wear it right now? `w` the WeaponState, `optic`
   whether the gun has glass that can carry it (iron sights can't). */
export function trollReticleOn(w, optic) {
  if (!optic || pref() === "classic") return false;
  if (game.modeId === "royale" && w?.def?.cls === "sniper") return true;
  return trollReticlePref() && trollReticleUnlocked();
}

/* null (the optic's own reticle), "idle" (the fist) or "hit" (an enemy in
   the sights: `linedUp`, asked only when it's on). */
export function trollReticleSkin(w, optic, linedUp) {
  if (!trollReticleOn(w, optic)) return null;
  return linedUp() ? "hit" : "idle";
}
