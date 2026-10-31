// The arsenal pipeline's test piece (models/build_armstest.blender.py):
// not a gun in the game. Tests and the arms sheet put it in a real gun's
// place (registerDetailed) to run the v2 loader, mechanism and brass on it.

import { registerDetailed } from "./weapon-model.js?v=p5-em1-wst-hf1-wb1-ar1-ar2-fj1-br1-or1-rt1-ut1-rb4-hp1-bx1-mg1-sp1-lz1-ret1-ret2-mrg1-hd1-rt2-fd1-ars1-mrg3-p416-mt2-sk1";
import { registerArReload } from "../view/ar-reload.js?v=ar1-br1-or1-ars1-p416-mt2";

export const ARMS_TEST = {
  url: new URL("../models/armstest.glb?v=at1", import.meta.url).href,
  kit: "armstest", p: "AT", device: "AT_None", rake: -0.37, railY: 0.036, adsDistance: null,
  glow: [], brass: "556",
};

/* The test piece in weapon `id`'s place, with the AR template's reload
   (the empty one ends on a slap of its P_Catch). */
export function useArmsTest(id = "lmao", build = id) {
  registerArReload(build, { template: "ar" });
  return registerDetailed(id, ARMS_TEST);
}
