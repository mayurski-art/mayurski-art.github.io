// Phones and tablets: the browser's bars off the game (user, 2026-10-18:
// "i see the safari tab thingy which i dont like to see").
//   - Android, iPad: the first tap asks for real fullscreen (and landscape).
//   - iPhone Safari can't: Apple only lets video go fullscreen. Opened from
//     the Home Screen (troll-forces.webmanifest + the apple-mobile-web-app
//     tags in troll-ops.html) it runs with no bars at all, so a one-time tip
//     says how. Already launched from the Home Screen, nothing shows.

const TIP_KEY = "to-pwa-tip-seen";

const standalone = () => window.navigator.standalone === true || matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
const canFullscreen = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

function goFullscreen() {
  if (standalone() || isFullscreen() || !canFullscreen()) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el, { navigationUI: "hide" });
    if (p?.then) p.then(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => {});
  } catch { /* refused: stay as we are */ }
}

function showHomeScreenTip() {
  try { if (localStorage.getItem(TIP_KEY)) return; } catch { /* storage blocked: show it anyway */ }
  const tip = document.createElement("div");
  tip.className = "to-pwa-tip";
  tip.setAttribute("role", "status");
  // Safari won't let a page hide its bars (user, 2026-10-18: "cant you set
  // it up such that the toolbar can be hidden"): its own Hide Toolbar can.
  tip.innerHTML = `<span>Bigger screen: tap the icon at the left of <b>trollrunner.net</b> in the address bar, then <b>Hide Toolbar</b>. Fully fullscreen: <b>Share</b> &rarr; <b>Add to Home Screen</b>.</span>
    <button type="button" aria-label="Close tip">&times;</button>`;
  const close = () => {
    tip.remove();
    try { localStorage.setItem(TIP_KEY, "1"); } catch { /* fine */ }
  };
  tip.querySelector("button").addEventListener("click", close);
  setTimeout(close, 20000);
  document.body.appendChild(tip);
}

export function initFullscreen() {
  const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (!touch || standalone()) return;
  if (canFullscreen()) {
    // Asked again on later taps if it was left (a swipe, the back gesture).
    document.addEventListener("touchend", goFullscreen, { passive: true });
  } else if (/iPhone|iPod/.test(navigator.userAgent)) {
    setTimeout(showHomeScreenTip, 2500);
  }
}
