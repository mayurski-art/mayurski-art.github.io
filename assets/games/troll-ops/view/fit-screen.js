// A screen's card that never scrolls (user, 2026-10-31: "Users shouldn't
// have to scroll up and down on the match summary"). When the card is
// taller than its screen it is CSS-zoomed down until it fits, never below
// `min` (past that the screen scrolls as before). It re-fits whenever the
// screen or the card changes size: a new tab, medals or the map vote
// coming in, a phone turned on its side.
//
// Sizes: offsetHeight is the card's own px, before its zoom, and the
// screen's clientHeight is in the same px as the card's zoomed box.

export function fitToScreen(screen, card, { min = 0.55 } = {}) {
  if (!screen || !card || typeof ResizeObserver === "undefined") return;
  let queued = 0;
  const fit = () => {
    queued = 0;
    if (screen.hidden || !screen.clientHeight) return;
    const avail = screen.clientHeight;
    let z = 1;
    card.style.zoom = "";
    // zoomed out, the card is wider and wraps less, so it settles in a few steps
    for (let i = 0; i < 4 && card.offsetHeight * z > avail + 0.5; i++) {
      z = Math.max(min, Math.floor(z * (avail / (card.offsetHeight * z)) * 1000) / 1000);
      card.style.zoom = String(z);
      if (z === min) break;
    }
  };
  const later = () => { if (!queued) queued = requestAnimationFrame(fit); };
  const ro = new ResizeObserver(later);
  ro.observe(screen);
  ro.observe(card);
  // what's inside changing size (tabs, medals, the vote) without the card's
  // box changing, while it's already squeezed to the screen
  new MutationObserver(later).observe(card, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
}
