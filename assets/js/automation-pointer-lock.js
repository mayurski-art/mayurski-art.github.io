// Under automation only (Playwright, puppeteer: navigator.webdriver is
// true), pointer lock is faked. Headless Chrome on Windows honours a real
// lock with ClipCursor on the DESKTOP's cursor, trapping the person at the
// computer in a box the size of the test's viewport until something frees it.
//
// The fake keeps the game's view of it identical: requestPointerLock sets
// document.pointerLockElement and fires pointerlockchange, exitPointerLock
// clears it and fires it again. Real players never get here.
//
// Import it first thing from any page's input code that takes pointer lock
// (troll-ops input/keyboard-mouse.js, grin-sabers input/input.js).

if (typeof navigator !== "undefined" && navigator.webdriver && typeof Document !== "undefined" && !Document.prototype.__fakePointerLock) {
  let locked = null;
  const changed = () => setTimeout(() => document.dispatchEvent(new Event("pointerlockchange")));
  Object.defineProperty(Document.prototype, "pointerLockElement", { configurable: true, get: () => locked });
  Element.prototype.requestPointerLock = function () { locked = this; changed(); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { if (!locked) return; locked = null; changed(); };
  Document.prototype.__fakePointerLock = true;
}
