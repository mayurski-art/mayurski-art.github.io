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

  // Menu size (Options, user 2026-10-31: "a settings option to lower the
  // scale of the main menu", on an iPhone 13 Pro): the menu alone (#to-title,
  // style.css --menu-z) at 100% down to 70%, on top of --ui-z. Per device,
  // never synced: a phone and a monitor want different sizes.
  var KEY = "trollops:menu-scale", SIZES = [1, 0.9, 0.8, 0.7];
  function menu() {
    var v = 1;
    try { v = parseFloat(localStorage.getItem(KEY)) || 1; } catch (e) {}
    return SIZES.indexOf(v) < 0 ? 1 : v;
  }
  function applyMenu() { root.style.setProperty("--menu-z", String(menu())); }
  applyMenu();
  window.tfMenuScale = {
    sizes: SIZES,
    get: menu,
    set: function (v) {
      try { localStorage.setItem(KEY, String(v)); } catch (e) {}
      applyMenu();
      dispatchEvent(new Event("resize"));   // (the menu's fits measure again)
    },
  };
})();
