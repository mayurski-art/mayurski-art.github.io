// The match view's size: the renderer, its post passes and both cameras
// follow the cabinet.

/* Turning a phone sideways (user, 2026-10-22: iPhone, the rotate card, then
   "the game bugged and i got kicked out"). iOS fires resize several times
   through one rotation while its bars animate, and each one reallocated
   every full-size render target, right after a match loaded, when memory is
   tightest. iOS answers a spike like that by killing the tab and reloading
   it, which lands back on the menu. A window resize is taken once, after
   the size has held for a moment. */
const SETTLE_MS = 150;

export function initResize({ cabinet, renderer, composer, passes, cameras }) {
  function resize() {
    const w = cabinet.clientWidth, h = cabinet.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    for (const p of passes) p.setSize(w, h);
    for (const c of cameras) {
      c.aspect = w / h;
      c.updateProjectionMatrix();
    }
  }
  let timer = 0;
  let sizedTo = "";
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const size = `${cabinet.clientWidth}x${cabinet.clientHeight}`;
      if (size === sizedTo) return;
      sizedTo = size;
      resize();
    }, SETTLE_MS);
  });
  return resize;
}
