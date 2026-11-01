// A screen's card that never scrolls (user, 2026-10-31: "Users shouldn't
// have to scroll up and down on the match summary"). When the card is
// taller than its screen it is CSS-zoomed down until it fits, never below
// `min` (past that the screen scrolls as before). It re-fits whenever the
// screen or the card changes size: a new tab, medals or the map vote
// coming in, a phone turned on its side.
//
// Sizes are read as on-screen boxes (getBoundingClientRect), so the screen's
// own --ui-z zoom and the card's fit zoom never have to be untangled.

export function fitToScreen(screen, card, { min = 0.55 } = {}) {
  if (!screen || !card || typeof ResizeObserver === "undefined") return;
  let queued = 0, last = null;   // the sizes the last fit left: its own zoom's resize is no reason to fit again
  const sizes = () => ({ w: screen.getBoundingClientRect().width, h: screen.getBoundingClientRect().height, c: card.getBoundingClientRect().height });
  const fit = () => {
    queued = 0;
    if (screen.hidden || !screen.clientHeight) return;
    // the screen's height inside its padding (kept clear for the radio), on screen
    const cs = getComputedStyle(screen), inner = screen.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const avail = screen.getBoundingClientRect().height * (inner / screen.clientHeight);
    const tall = () => card.getBoundingClientRect().height;
    let z = 1;
    card.style.zoom = "";
    // zoomed out, the card is wider and wraps less, and cq-sized parts (the
    // Map tab's sheet) don't shrink with it: a few steps, a nudge more each
    for (let i = 0; i < 8 && tall() > avail + 0.5; i++) {
      z = Math.max(min, Math.floor(z * (avail / tall()) * (i ? 0.99 : 1) * 1000) / 1000);
      card.style.zoom = String(z);
      if (z === min) break;
    }
    last = sizes();
  };
  const later = () => { if (!queued) queued = setTimeout(fit, 0); };
  const same = (a, b) => a && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5 && Math.abs(a.c - b.c) < 0.5;
  const ro = new ResizeObserver(() => { if (!same(last, sizes())) later(); });
  ro.observe(screen);
  ro.observe(card);
  // what's inside changing size (tabs, medals, the vote) without the card's
  // box changing, while it's already squeezed to the screen
  // (a number ticking over on a bar is text, not a reason)
  new MutationObserver((recs) => {
    if (recs.some((r) => r.type === "attributes" || [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeType === 1))) later();
  }).observe(card, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
}
