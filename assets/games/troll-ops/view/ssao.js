// Troll Forces ambient occlusion (High graphics). three's SSAOPass draws the
// scene once more with a plain normal material to find depth and creases,
// and that material ignores a mesh's texture alpha: the trollface board (a
// square with the face cut out by alphaTest), the loot beams and glass all
// counted as solid squares there, so High drew a faint see-through box round
// every face and floor gun (user 2026-10-12). Anything see-through is left
// out of that pass, so only solid geometry casts the shading.
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

const seeThrough = (m) => Array.isArray(m) ? m.some(seeThrough) : !!m && (m.transparent || m.alphaTest > 0);

export function makeSsao(scene, camera) {
  const ssao = new SSAOPass(scene, camera, 1, 1);
  ssao.kernelRadius = 0.6;
  ssao.minDistance = 0.001;
  ssao.maxDistance = 0.15;
  ssao.output = SSAOPass.OUTPUT.Default;
  hideSeeThrough(ssao);
  return ssao;
}

/* High's AO since three r186: ground-truth AO (GTAOPass), which reads how
   much of the sky each pixel's surroundings hide, then denoises it. Softer,
   wider and truer than SSAO's creases: the dark where a wall meets the
   street, under a porch roof, round a barrel's foot. */
export function makeGtao(scene, camera) {
  const ao = new GTAOPass(scene, camera, 1, 1, {}, {
    radius: 1.2, distanceExponent: 1.5, thickness: 2, distanceFallOff: 1, scale: 1.7, samples: 16,
  }, { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  ao.blendIntensity = 1;
  hideSeeThrough(ao);
  return ao;
}

/* three r186's AO passes hide what they skip in _overrideVisibility, pushing
   each object they hid on _visibilityCache (an array) for
   _restoreVisibility to show again; r160's was overrideVisibility over a
   Map, and the old override of that name stopped being called. */
export function hideSeeThrough(pass) {
  pass._overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (!o.visible) return;
      if (o.isPoints || o.isLine || o.isLine2 || o.isSprite || (o.isMesh && seeThrough(o.material))) {
        o.visible = false;
        cache.push(o);
      }
    });
  };
}
