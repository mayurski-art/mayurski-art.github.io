// The menus and HUD at the same share of the screen on every monitor (user,
// 2026-10-29: "100% scaling on a smaller screen" looked tiny on a bigger
// one). Everything is laid out in px for a laptop-sized window, so a bigger
// window zooms the UI layers (style.css, --ui-z) by how much bigger it is
// than REF, never below 1: phones and small windows keep their own layouts.
// A plain script loaded in <head>, so the first paint is already scaled.
(function () {
  var REF_W = 1536, REF_H = 864;   // 1920x1080 at 125%, the common laptop
  var MAX = 3;
  var root = document.documentElement;
  function apply() {
    var k = Math.min(innerWidth / REF_W, innerHeight / REF_H);
    k = Math.max(1, Math.min(MAX, Math.round(k * 100) / 100));
    root.style.setProperty("--ui-z", String(k));
  }
  apply();
  addEventListener("resize", apply);
})();
