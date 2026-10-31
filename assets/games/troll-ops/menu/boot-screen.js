// Trollnite: the boot screen (troll-ops.html #to-loading), up from the first
// paint until the player enters the menu. The key art (ui/boot/key-art-*.webp,
// rendered from the game by tools/troll-ops-loading-art.mjs: the squad on the
// Troll Peak over Trollface Island on Halloween night), the TROLLNITE
// wordmark, and a prompt that names the device in hand (user, 2026-10-31):
//   keyboard   Press Space to enter
//   pad        Press A / ✕ / B to enter (menu/controller-layout.js names it)
//   touch      Tap to enter
// It switches live: a key press, a pad press or a tap each claim the prompt.
// While it's up nothing under it hears the keys or the pad (the radio and the
// menu's links are hidden through body.tf-booting), so the first press can't
// start a match, open the radio or type into a field.
//
// Headless harnesses (navigator.webdriver) skip the gate, as the old spinner
// did: the screen hides itself the moment the game is ready. ?boot=1 keeps
// the gate for its own test (tools/troll-ops-boot-screen-test.mjs).
import { padButtonName } from "./controller-layout.js?v=cl7-pd1-or1-pd2-hb4-xb1-mb2";
import { SEASON } from "../core/season.js?v=zf1-wb1";
import { mountBootMotion } from "./boot-motion.js?v=bm1";

export function initBootScreen(root) {
  const word = root.querySelector(".to-boot-word");
  const chapter = root.querySelector(".to-boot-chapter");
  const prompt = root.querySelector(".to-boot-prompt");
  const status = root.querySelector(".to-boot-status");
  if (chapter) chapter.textContent = SEASON.name.toUpperCase();
  void word;

  /* Two looks of the key art (user, 2026-10-31: "a normal version and then
     a halloween version ... users can click a pumpkin button that changes
     to halloween version"): normal unless the player picked the pumpkin;
     remembered on this device. */
  const ART = "assets/games/troll-ops/ui/boot", ART_V = "lk2", LOOK_KEY = "trollops:boot-look";
  const look = root.querySelector(".to-boot-look");
  const art = root.querySelector(".to-boot-art");
  // the picture's moving parts (menu/boot-motion.js)
  const motion = mountBootMotion(root, { art, base: ART, v: ART_V });
  function setLook(spooky, save) {
    const sfx = spooky ? "-halloween" : "";
    const src = art?.querySelector("source"), img = art?.querySelector("img");
    if (src) src.srcset = `${ART}/key-art-tall${sfx}.webp?v=${ART_V}`;
    if (img) {
      img.src = `${ART}/key-art-wide${sfx}.webp?v=${ART_V}`;
      img.alt = `The squad on the Troll Peak facing you, Trollface Island behind them${spooky ? " on Halloween night" : ""}`;
    }
    root.classList.toggle("is-halloween", spooky);
    motion.setLook(spooky);
    look?.setAttribute("aria-pressed", String(spooky));
    look?.setAttribute("aria-label", `Halloween look: ${spooky ? "on" : "off"}`);
    if (save) { try { localStorage.setItem(LOOK_KEY, spooky ? "halloween" : "normal"); } catch {} }
  }
  let spooky = false;
  try { spooky = localStorage.getItem(LOOK_KEY) === "halloween"; } catch {}
  if (spooky) setLook(true, false);
  const flipLook = () => { spooky = !spooky; setLook(spooky, true); };
  // (its click and press are its own: they never enter the menu)
  look?.addEventListener("pointerdown", (e) => e.stopPropagation());
  look?.addEventListener("click", (e) => { e.stopPropagation(); flipLook(); });

  const gate = /[?&]boot=1/.test(location.search) || !navigator.webdriver;
  const state = { ready: false, done: false, mode: "key", enteredBy: null };

  const firstPad = () => Array.from(navigator.getGamepads?.() || []).find((p) => p && p.connected) || null;
  const guessMode = () => (firstPad() ? "pad" : matchMedia("(pointer: coarse)").matches ? "touch" : "key");

  /* The prompt for the device in hand. The pad's bottom face button is the
     menu's confirm everywhere else too (lobby-fn.js padPress 0). */
  function setMode(mode) {
    // a pad swapped for another family (Xbox for PlayStation) re-labels too
    const label = mode === "touch" ? "Tap to enter"
      : mode === "pad" ? `Press <kbd>${padButtonName(0) || "A"}</kbd> to enter`
      : "Press <kbd>Space</kbd> to enter";
    state.mode = mode;
    if (prompt.dataset.mode === mode && prompt.innerHTML === label) return;
    prompt.dataset.mode = mode;
    prompt.innerHTML = label;
  }

  function enter(by) {
    if (state.done || !state.ready) return;
    state.done = true;
    state.enteredBy = by;
    stop();
    root.classList.add("is-leaving");
    document.body.classList.remove("tf-booting");
    setTimeout(() => { root.hidden = true; motion.stop(); }, 480);
    window.dispatchEvent(new CustomEvent("tf-boot-enter", { detail: { by } }));
  }

  // keys: every key is the screen's while it's up (the menu under it never
  // hears them); browser chords and the F keys pass
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
    // Tab reaches the pumpkin; Enter or Space on it flips the look
    if (e.key === "Tab") return;
    if (look && document.activeElement === look && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) flipLook();
      return;
    }
    setMode("key");
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat && (e.key === " " || e.key === "Enter")) enter("key");
  };
  const onPointer = (e) => { setMode(e.pointerType === "touch" ? "touch" : "key"); };
  const onClick = () => enter(state.mode === "touch" ? "touch" : "click");
  const onPadIn = () => setMode("pad");
  const onPadOut = () => { if (!firstPad()) setMode(guessMode()); };

  // the pad: polled while the screen is up; a held button from before the
  // screen was ready is no press
  let prev = null, raf = 0;
  function poll() {
    raf = requestAnimationFrame(poll);
    const gp = firstPad();
    if (!gp) { prev = null; return; }
    const b = (i) => !!gp.buttons[i]?.pressed;
    const any = gp.buttons.some((x) => x.pressed) || gp.axes.some((a) => Math.abs(a) > 0.5);
    if (any) setMode("pad");
    const now = [b(0), b(9)];
    if (prev && ((now[0] && !prev[0]) || (now[1] && !prev[1]))) enter("pad");
    prev = now;
  }

  function stop() {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("gamepadconnected", onPadIn);
    window.removeEventListener("gamepaddisconnected", onPadOut);
    cancelAnimationFrame(raf);
  }

  const api = {
    get state() { return state; },
    /* The game is booted (game.js, after the first frame's setup): the
       prompt replaces LOADING, or without the gate the screen just goes. */
    ready() {
      state.ready = true;
      if (!gate) {
        state.done = true;
        root.hidden = true;
        document.body.classList.remove("tf-booting");
        stop();
        return;
      }
      root.classList.add("is-ready");
      if (status) status.hidden = true;
      prompt.hidden = false;
    },
    enter,
    setMode,
  };

  if (gate) {
    document.body.classList.add("tf-booting");
    setMode(guessMode());
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("gamepadconnected", onPadIn);
    window.addEventListener("gamepaddisconnected", onPadOut);
    root.addEventListener("pointerdown", onPointer);
    root.addEventListener("click", onClick);
    raf = requestAnimationFrame(poll);
  }
  if (/[?&]tohooks=1/.test(location.search)) window.__tfBoot = api;
  return api;
}
