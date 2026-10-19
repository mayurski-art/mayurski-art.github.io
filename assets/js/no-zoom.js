// Phones: no pinch or double-tap zoom. Zooming the whole page in and back
// out left fixed bars and HUDs out of place (user, 2026-10-19). Pages that
// pinch something themselves (the maps, the game's touch controls) still
// get their touch events; only the browser's own page zoom is stopped.
(function () {
  // Android Chrome: the viewport's own zoom lock.
  var vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/user-scalable\s*=\s*no/.test(vp.content)) {
    vp.content = vp.content.replace(/,?\s*(maximum-scale|user-scalable)\s*=\s*[^,]*/g, "") + ", maximum-scale=1, user-scalable=no";
  }
  // Double-tap zoom everywhere, pinch zoom outside Safari.
  var css = document.createElement("style");
  css.textContent = "html,body{touch-action:pan-x pan-y}";
  document.head.appendChild(css);
  // iOS Safari ignores both of those for pinching: its gesture events and a
  // two-finger move are where the page zoom starts.
  function stop(e) { e.preventDefault(); }
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  document.addEventListener("touchmove", function (e) {
    if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault();
  }, { passive: false });
})();
