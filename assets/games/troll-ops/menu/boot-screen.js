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

export function initBootScreen(root) {
  const word = root.querySelector(".to-boot-word");
  const chapter = root.querySelector(".to-boot-chapter");
  const prompt = root.querySelector(".to-boot-prompt");
  const status = root.querySelector(".to-boot-status");
  if (chapter) chapter.textContent = SEASON.name.toUpperCase();
  void word;

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
    setTimeout(() => { root.hidden = true; }, 480);
    window.dispatchEvent(new CustomEvent("tf-boot-enter", { detail: { by } }));
  }

  // keys: every key is the screen's while it's up (the menu under it never
  // hears them); browser chords and the F keys pass
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
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
