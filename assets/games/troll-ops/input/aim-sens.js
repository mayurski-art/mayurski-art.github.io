// Aim-down-sights look speed, shared by mouse, stick and touch.
//
// Mouse look used to turn the same radians per count aimed or not, so the
// tighter a gun's zoom the faster the picture swam: the Ballista's 8x felt
// like a sensitivity of its own and the MTAR's irons slow beside it (user,
// 2026-10-31). Aimed, the turn now scales with the zoom (the tangent of the
// half-FOV, so a flick moves the target the same distance across the
// screen through any sight), times the ADS sensitivity setting.

import { game } from "../core/state.js?v=st1";

const halfTan = (deg) => Math.tan((deg * Math.PI) / 360);

/* 0..1 of the way from the eye to the sight's zoom: tan(aimed fov / 2)
   over tan(hip fov / 2). The irons at 78 come out ~0.73, the 8x ~0.15. */
export function zoomLookRatio(adsFovMult, baseFov = game.baseFov || 78) {
  return halfTan(baseFov * (adsFovMult ?? 1)) / halfTan(baseFov);
}

/* The look multiplier for this frame: 1 at the hip, the zoom ratio times
   ADS sensitivity (settings.adsSens, %) fully aimed, blended by adsT. */
export function adsLookScale() {
  const w = game.currentWeapon?.();
  const t = w?.adsT || 0;
  if (t <= 0 || game.player?.holding !== "gun") return 1;
  const aimed = zoomLookRatio(w.def?.adsFovMult) * ((game.settings?.adsSens ?? 100) / 100);
  return 1 + (aimed - 1) * t;
}
